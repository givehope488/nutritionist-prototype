#!/usr/bin/env node
/**
 * 菜品数据体检（CI 必跑）。
 *
 * 目的：55 条数据将由 PD 手工逐条复核，人工录入最容易犯的是「格式对但语义错」。
 * 这里把能机器判定的规则全部固化，让录入错误在 CI 就暴露，而不是等联调或上线。
 *
 * 判定分两级：
 *   - error：违反契约或合规硬约束，退出码 1，CI 红；
 *   - warn ：口径问题或统计异常，只提示，不阻塞。
 *
 * 用法：npm run check:data
 */
import { readFileSync } from 'node:fs';

const SEED = 'server/data/menu-seed.json';

const CATEGORIES = ['staple', 'protein', 'veg', 'soup', 'fruit'];
const MEALS = ['breakfast', 'lunch', 'dinner'];
const TAGS = ['pork', 'beef', 'seafood', 'egg', 'milk', 'gluten', 'peanut', 'spicy', 'meat', 'vegprotein'];
const RELIABILITY = ['A', 'B', 'C'];
const STATUS = ['active', 'inactive'];

/** 含这些标签的菜品必须同时带 meat，否则素食过滤会放行荤菜（s11/s12/s13 曾踩过） */
const MUST_IMPLY_MEAT = ['pork', 'beef'];
/**
 * seafood 不能强制 meat：紫菜蛋花汤的 seafood 指紫菜/虾皮，并不含鱼肉。
 * 但若真含鱼虾而漏标 meat，素食会被推错，所以只告警、由 PD 逐条判定。
 */
const SEAFOOD_NEEDS_REVIEW = 'seafood';

/** 份量展示用语中不允许出现数字克重（README 合规条目 4：B 级以下不展示精确克重） */
const WEIGHT_UNIT = /\d+(\.\d+)?\s*(g|G|kg|KG|克|千克|ml|mL|ML|毫升)/;

const errors = [];
const warns = [];
const err = (id, msg) => errors.push(`[${id}] ${msg}`);
const warn = (id, msg) => warns.push(`[${id}] ${msg}`);

const seed = JSON.parse(readFileSync(SEED, 'utf8'));
if (!Array.isArray(seed.dishes)) {
  console.error('种子文件缺少 dishes 数组');
  process.exit(1);
}

const seen = new Set();

for (const d of seed.dishes) {
  const id = d.id || '(无 id)';

  if (!d.id) err(id, '缺少 id');
  if (seen.has(d.id)) err(id, 'id 重复');
  seen.add(d.id);

  if (!d.name || typeof d.name !== 'string') err(id, '缺少 name');
  if (!CATEGORIES.includes(d.category)) err(id, `category 非法：${d.category}`);
  if (!Array.isArray(d.meals) || d.meals.length === 0) err(id, 'meals 为空');
  else for (const m of d.meals) if (!MEALS.includes(m)) err(id, `meals 含非法值：${m}`);
  if (!RELIABILITY.includes(d.reliability)) err(id, `reliability 非法：${d.reliability}`);
  if (!STATUS.includes(d.status)) err(id, `status 非法：${d.status}`);

  // ---- 份量：展示用语不得含数字克重 ----
  if (typeof d.portion_label !== 'string' || d.portion_label.trim() === '') {
    err(id, 'portion_label 缺失');
  } else if (WEIGHT_UNIT.test(d.portion_label)) {
    err(id, `portion_label 含精确克重「${d.portion_label}」，违反「B 级以下不展示精确克重」`);
  }

  if (!('portion_grams' in d)) {
    err(id, '缺少 portion_grams 字段（无克重时显式写 null）');
  } else if (d.portion_grams !== null) {
    if (typeof d.portion_grams !== 'number' || !Number.isFinite(d.portion_grams) || d.portion_grams <= 0) {
      err(id, `portion_grams 非法：${d.portion_grams}`);
    } else if (d.portion_grams > 1500) {
      warn(id, `portion_grams 偏大：${d.portion_grams}g，请确认是否单人份`);
    }
  }

  // ---- 标签 ----
  if (!Array.isArray(d.tags)) {
    err(id, 'tags 不是数组');
  } else {
    for (const t of d.tags) if (!TAGS.includes(t)) err(id, `tag 不在枚举内：${t}`);
    for (const t of MUST_IMPLY_MEAT) {
      if (d.tags.includes(t) && !d.tags.includes('meat')) {
        err(id, `标了 ${t} 却没标 meat，素食过滤会放行该菜`);
      }
    }
    if (d.tags.includes(SEAFOOD_NEEDS_REVIEW) && !d.tags.includes('meat')) {
      warn(id, '标了 seafood 但未标 meat：若含鱼虾，素食会被推错；若只是紫菜/虾皮可忽略');
    }
  }

  // ---- 营养值 ----
  for (const k of ['kcal', 'protein_g', 'fat_g', 'carbs_g', 'sodium_mg', 'price_yuan']) {
    if (typeof d[k] !== 'number' || !Number.isFinite(d[k]) || d[k] < 0) err(id, `${k} 非法：${d[k]}`);
  }
  if (typeof d.kcal === 'number' && d.kcal > 1200) warn(id, `kcal 偏大：${d.kcal}，请确认是否单人份`);
  if (typeof d.kcal === 'number' && d.kcal > 0 && typeof d.protein_g === 'number') {
    const atwater = 4 * d.protein_g + 9 * d.fat_g + 4 * d.carbs_g;
    const dev = (atwater - d.kcal) / d.kcal;
    if (Math.abs(dev) > 0.25) {
      err(id, `热量与三大营养素不符：标注 ${d.kcal} kcal，按 4/9/4 应为 ${atwater.toFixed(1)}（偏差 ${(dev * 100).toFixed(0)}%）`);
    } else if (Math.abs(dev) > 0.15) {
      warn(id, `热量偏差 ${(dev * 100).toFixed(0)}%，建议复核`);
    }
  }

  // ---- 配料依据 ----
  if (!Array.isArray(d.ingredients)) {
    err(id, '缺少 ingredients 数组（未复核时写 []）');
  } else {
    d.ingredients.forEach((ing, i) => {
      if (!ing || typeof ing.name !== 'string' || ing.name.trim() === '') err(id, `ingredients[${i}] 缺 name`);
      if (!ing || typeof ing.grams !== 'number' || !(ing.grams > 0)) err(id, `ingredients[${i}] 缺 grams`);
      if (!ing || typeof ing.source !== 'string' || ing.source.trim() === '') err(id, `ingredients[${i}] 缺 source（依据出处）`);
    });
  }

  // ---- A 级的门槛：没有配料依据就不许升 A ----
  if (d.reliability === 'A') {
    if (d.portion_grams === null) err(id, 'A 级必须提供 portion_grams（称重）');
    if (!Array.isArray(d.ingredients) || d.ingredients.length === 0) err(id, 'A 级必须提供 ingredients 配料依据');
  }
  if (d.reliability === 'B' && Array.isArray(d.ingredients) && d.ingredients.length > 0) {
    warn(id, '已填配料依据但仍为 B 级，可考虑升 A 级');
  }
}

// ---- 汇总 ----
console.log(`菜品数据体检：${seed.dishes.length} 道`);

if (warns.length) {
  console.log(`\n告警 ${warns.length} 条（不阻塞 CI）：`);
  for (const w of warns) console.log('  ⚠ ' + w);
}

if (errors.length) {
  console.error(`\n错误 ${errors.length} 条（阻塞）：`);
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}

console.log('\n✓ 全部通过');
