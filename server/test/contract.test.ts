import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AVOID_OPTIONS } from '../src/data/avoid-options';
import { getAllDishes } from '../src/data/dishes';
import { seedDishes } from '../src/data/seed';

/**
 * 契约一致性测试。
 *
 * 解决的问题：忌口 key 曾经有三份互不相干的定义（服务端 `nomeat`、文档示例 `vegan`、
 * 前端 Mock `vegan` + 自造的 `nogluten`），谁都不知道哪份才算数。
 *
 * 现在约定：**`docs/API.md` 附录 D 是唯一事实源**，本测试直接解析那份表格与实现比对。
 * 也就是说，想加一个忌口项，必须先改文档，否则这里立刻红。
 */

const API_MD_PATH = new URL('../../docs/API.md', import.meta.url);
const API_MD = readFileSync(API_MD_PATH, 'utf8');

// 数据源已从 JSON 改为 SQLite：本文件的断言在「收集阶段」就要读菜品，所以先灌种子。
// 测试进程用的是内存库（server/vitest.config.ts 设了 DATABASE_URL=:memory:）。
seedDishes();

interface AvoidRow {
  key: string;
  label: string;
  excludes_tag: string;
}

/** 从 API.md 附录 D 抓 `| \`key\` | label | \`tag\` |` 形式的表格行 */
function parseAvoidTable(md: string): AvoidRow[] {
  const start = md.indexOf('### 附录 D');
  if (start === -1) throw new Error('docs/API.md 找不到「附录 D：忌口选项全表」');
  const rest = md.slice(start + 1);
  const end = rest.indexOf('\n### ');
  const section = end === -1 ? rest : rest.slice(0, end);

  const rows: AvoidRow[] = [];
  for (const line of section.split('\n')) {
    const m = /^\|\s*`([a-z]+)`\s*\|\s*([^|]+?)\s*\|\s*`([a-z]+)`\s*\|\s*$/.exec(line.trim());
    if (m !== null) {
      rows.push({ key: m[1], label: m[2], excludes_tag: m[3] });
    }
  }
  return rows;
}

/** 从 §2.1 的 `tags` 枚举行抓出允许的标签集合 */
function parseTagEnum(md: string): string[] {
  const line = md.split('\n').find((l) => l.startsWith('`tags` 枚举'));
  if (line === undefined) throw new Error('docs/API.md 找不到 `tags` 枚举行');
  return [...line.matchAll(/`([a-z]+)`/g)].map((m) => m[1]).filter((t) => t !== 'tags');
}

describe('契约一致性：忌口选项（API.md 附录 D ↔ server/src/data/avoid-options.ts）', () => {
  const docRows = parseAvoidTable(API_MD);

  it('附录 D 确实解析出了 9 行（防止表格格式被改坏后测试假绿）', () => {
    expect(docRows).toHaveLength(9);
  });

  it('文档表格与实现逐行一致：key / label / excludes_tag 三项都不能差', () => {
    expect(AVOID_OPTIONS.map((o) => ({ key: o.key, label: o.label, excludes_tag: o.excludes_tag }))).toEqual(
      docRows,
    );
  });

  it('每个 excludes_tag 都在 §2.1 的 tags 枚举内', () => {
    const tagEnum = parseTagEnum(API_MD);
    expect(tagEnum.length).toBeGreaterThan(0);
    for (const o of AVOID_OPTIONS) {
      expect(tagEnum, `${o.key} 的 excludes_tag=${o.excludes_tag} 不在 tags 枚举内`).toContain(o.excludes_tag);
    }
  });

  it('key 不重复，且统一用 no 前缀（避免再出现 vegan 这种第三种写法）', () => {
    const keys = AVOID_OPTIONS.map((o) => o.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k.startsWith('no'), `key「${k}」不符合 no 前缀约定`).toBe(true);
  });
});

describe('契约一致性：素食过滤确实挡得住荤菜', () => {
  const meatOption = AVOID_OPTIONS.find((o) => o.key === 'nomeat');
  const dishes = getAllDishes();

  it('「素食」选项存在且排除的是 meat 标签', () => {
    expect(meatOption).toBeDefined();
    expect(meatOption?.excludes_tag).toBe('meat');
  });

  it('勾选素食后，池子里不残留任何带 pork / beef / seafood 的菜', () => {
    const tag = meatOption?.excludes_tag ?? 'meat';
    const remaining = dishes.filter((d) => d.status === 'active' && !d.tags.includes(tag));
    const leaked = remaining.filter(
      (d) => d.tags.includes('pork') || d.tags.includes('beef') || d.tags.includes('seafood'),
    );
    expect(leaked.map((d) => `${d.id} ${d.name} [${d.tags.join(',')}]`)).toEqual([]);
  });

  it('每个含肉 / 鱼虾标签的菜都带 meat 兜底标签', () => {
    const offenders = dishes
      .filter((d) => d.tags.some((t) => t === 'pork' || t === 'beef' || t === 'seafood'))
      .filter((d) => !d.tags.includes('meat'))
      .map((d) => d.id);
    expect(offenders).toEqual([]);
  });
});
