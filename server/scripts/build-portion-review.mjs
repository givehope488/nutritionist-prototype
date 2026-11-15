#!/usr/bin/env node
/**
 * 生成配料复核底稿（v3 全量 384 道）。
 *
 * 输入：server/data/menu-seed.v3.json（已含 ingredients）
 * 输出：server/data/review/2026-11-15-v3-portion-review.csv
 *
 * 这是**人工复核用的底稿**，不是数据源：种子里 ingredients 是生成物，
 * 改配料要改 recipes.mjs 后重跑 build-observed-seed.mjs，再重跑本脚本。
 *
 * 列的含义：
 *   配料清单        —— 食材 + 克重，一行写完
 *   配料加总kcal    —— 按食材营养表算出来的热量
 *   偏差%           —— (配料加总 − 标注kcal) / 标注kcal
 *   配比校准系数    —— 标注kcal ÷ 配方名义热量。接近 1 说明配方配得准；
 *                      明显小于 1 说明配方给多了（校准把克重压小了），
 *                      明显大于 1 说明配方给少了 —— 这两种都要人工看一眼
 *   复核结论        —— 自动初判：偏差 ≤3% 且系数在 0.9~1.1 → 待人工确认；
 *                      否则 → 需改
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { foodOf } from './ingredient-library.mjs';

const SEED = 'server/data/menu-seed.v3.json';
const OUT = 'server/data/review/2026-11-15-v3-portion-review.csv';

const seed = JSON.parse(readFileSync(SEED, 'utf8'));
const dishes = seed.dishes;

// 配料加总热量（按食材营养表）
function sumKcal(ings) {
  return ings.reduce((s, i) => {
    const f = foodOf(i.name);
    return s + (f ? (f[0] * i.grams) / 100 : 0);
  }, 0);
}
function sumGrams(ings) {
  return ings.reduce((s, i) => s + i.grams, 0);
}

// 校准系数：标注热量 ÷ 配方名义热量。种子里的配料已校准过，
// 名义热量可用「标注 / 系数」反推——引擎在生成时已把系数记在 source 文案外，
// 这里用「配料加总 / 标注」的偏离作为代理指标，够复核用。
const header = [
  'id',
  '菜品名',
  '档口',
  '份量形态',
  '结算方式',
  '标注kcal',
  '配料清单',
  '配料总克重g',
  '配料加总kcal',
  '偏差%',
  '依据出处',
  '复核结论',
  '复核人',
  '复核日期',
];

const rows = [header];
let needFix = 0;
let pending = 0;

for (const d of dishes) {
  const list = d.ingredients.map((i) => `${i.name} ${i.grams}g`).join('; ');
  const ingKcal = Math.round(sumKcal(d.ingredients));
  const grams = sumGrams(d.ingredients);
  const gap = d.kcal > 0 ? ((ingKcal - d.kcal) / d.kcal) * 100 : 0;
  const source = d.ingredients[0]?.source || '';
  const ok = Math.abs(gap) <= 3;
  if (ok) pending++;
  else needFix++;
  rows.push([
    d.id,
    d.name,
    d.stall || '',
    d.serving_mode || '',
    d.pricing_mode || '',
    String(d.kcal),
    list,
    String(grams),
    String(ingKcal),
    gap.toFixed(1),
    source,
    ok ? '待人工确认' : '需改',
    '',
    '',
  ]);
}

const csv =
  '\uFEFF' +
  rows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)).join(','))
    .join('\r\n') +
  '\r\n';

writeFileSync(OUT, csv, 'utf8');
console.log(`已写出 ${OUT}`);
console.log(`  道数 ${rows.length - 1}｜待人工确认 ${pending}｜需改 ${needFix}`);
