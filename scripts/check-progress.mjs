#!/usr/bin/env node
/**
 * 公用进程文档体检（CI 必跑）。
 *
 * 解决的问题：`docs/PROGRESS.md` 是五个人共用的协调入口。如果谁都能改「当前状态」和「分工」，
 * 两个人各改各的，这份文档三天内就会变成第二个信息污染源。
 *
 * 所以把它切成两半：
 *   - §0~§4（规则 / 状态 / 分工 / 时间线 / 未决事项）—— 只有 PD 能改，靠内容指纹强制；
 *   - §5 变更记录、§6 问题登记 —— 所有人可以追加，但格式和倒序由这里校验。
 *
 * 用法：
 *   npm run check:progress            # 校验（CI 里跑的就是这个）
 *   npm run check:progress -- --sign  # PD 改完 §0~§4 后重新签名
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DOC = 'docs/PROGRESS.md';
const SIGN = '.github/progress-pd.sha256';

/** §5 之前的内容 = PD 专区 */
const PD_SECTIONS_END = '## 5. 变更记录';

const REQUIRED = [
  '## 0. 维护规则',
  '## 1. 当前状态',
  '## 2. 接下来各成员的工作',
  '## 3. 时间线',
  '## 4. 未决事项',
  '## 5. 变更记录',
  '## 6. 问题登记',
];

/** `- 2026-11-06 姓名 | 类型 | 说清什么 | 影响谁` */
const ENTRY = /^- \d{4}-\d{2}-\d{2} \S+ \| (变更|阻塞|决策|风险) \| [^|]+ \| [^|]+$/;

const args = process.argv.slice(2);
const sign = args.includes('--sign');

if (!existsSync(DOC)) {
  console.error(`✗ 找不到 ${DOC}`);
  process.exit(1);
}

const raw = readFileSync(DOC, 'utf8');
const text = raw.replace(/\r\n/g, '\n');

const errors = [];
const err = (msg) => errors.push(msg);

// ---- 1. 章节齐全且顺序正确 ----
let cursor = -1;
for (const heading of REQUIRED) {
  const at = text.indexOf(heading);
  if (at === -1) {
    err(`缺少章节「${heading}」`);
    continue;
  }
  if (at < cursor) err(`章节顺序不对：「${heading}」应该在上一节之后`);
  cursor = at;
}

// ---- 2. PD 专区指纹 ----
const pdEnd = text.indexOf(PD_SECTIONS_END);
const pdText = pdEnd === -1 ? '' : text.slice(0, pdEnd);
const fingerprint = createHash('sha256')
  .update(
    pdText
      .split('\n')
      .map((l) => l.replace(/\s+$/, ''))
      .join('\n'),
  )
  .digest('hex');

if (sign) {
  writeFileSync(
    SIGN,
    [
      '# 由 `npm run check:progress -- --sign` 自动生成，请勿手改。',
      '# 覆盖范围：docs/PROGRESS.md 的 §0~§4（规则 / 状态 / 分工 / 时间线 / 未决事项）。',
      '# 这几节只有 PD 能改；其他人只需往 §5 / §6 追加。',
      `sha256=${fingerprint}`,
      '',
    ].join('\n'),
    'utf8',
  );
  console.log(`✓ 已重新签名 → ${SIGN}`);
} else if (!existsSync(SIGN)) {
  err(`缺少签名文件 ${SIGN}，PD 请先跑 npm run check:progress -- --sign`);
} else {
  const signed = /sha256=([0-9a-f]{64})/.exec(readFileSync(SIGN, 'utf8'));
  if (signed === null) {
    err(`签名文件 ${SIGN} 格式损坏，PD 请重跑 npm run check:progress -- --sign`);
  } else if (signed[1] !== fingerprint) {
    err(
      [
        '§0~§4（规则 / 状态 / 分工 / 时间线 / 未决事项）被改动了，但这几节只有 PD 能改。',
        '  · 如果你只是想记录改动或问题 → 撤掉这几节的修改，改往 §5 变更记录 或 §6 问题登记 追加一行。',
        '  · 如果你是 PD → 跑 npm run check:progress -- --sign 重新签名，并把签名文件一起提交。',
        `  · 当前指纹 ${fingerprint.slice(0, 12)}…，签名文件里是 ${signed[1].slice(0, 12)}…`,
      ].join('\n'),
    );
  }
}

// ---- 3. §5 / §6 的追加行格式与倒序 ----
function sectionLines(heading, nextHeading) {
  const start = text.indexOf(heading);
  if (start === -1) return [];
  const from = start + heading.length;
  const to = nextHeading === null ? text.length : text.indexOf(nextHeading, from);
  return text.slice(from, to === -1 ? text.length : to).split('\n');
}

for (const [heading, next] of [
  ['## 5. 变更记录', '## 6. 问题登记'],
  ['## 6. 问题登记', null],
]) {
  const label = heading.replace('## ', '');
  const lines = sectionLines(heading, next);
  const entries = lines.filter((l) => l.startsWith('- '));

  let prevDate = '9999-99-99';
  for (const line of entries) {
    const trimmed = line.trim();
    if (!ENTRY.test(trimmed)) {
      err(`${label} 有一行格式不对：\n    ${trimmed}\n    应为：- 2026-11-06 姓名 | 变更|阻塞|决策|风险 | 说清什么 | 影响谁`);
      continue;
    }
    const date = trimmed.slice(2, 12);
    if (date > prevDate) {
      err(`${label} 要按日期倒序（新的在上）：${date} 这一行排在了更新的条目下面`);
    }
    prevDate = date;
  }
}

// ---- 汇总 ----
if (errors.length) {
  console.error(`进程文档体检失败（${errors.length} 条）：\n`);
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}

console.log(`✓ ${DOC} 体检通过（PD 专区指纹一致，§5 §6 追加行格式正确）`);
