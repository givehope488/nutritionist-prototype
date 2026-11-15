#!/usr/bin/env node
/**
 * 配料复核（第二版）：查**校准后克重是否现实**。
 *
 * 为什么不用「校准系数偏离 1」当判据：
 * 校准系数 = 标注 kcal ÷ 配方名义热量。系数偏离大，只说明**配方表里写的原始克重**
 * 与标注值对不上——而校准机制本来就会把它纠正，最终克重 = 与标注热量一致的那一组。
 * 所以真正该问的是：**校准之后，那道菜的主料到底多少克？现实吗？**
 *
 * 例：单加大肉肠系数 0.31（偏离大），但校准后是「五花 28g + 淀粉 3g + 油 3g」——
 * 一根肠 28g，完全现实，不是问题。
 * 反例：套餐系数 1.81，校准后米饭 363g —— 一碗饭 363g 不现实，是问题。
 *
 * 用法：node server/scripts/portion-review-report.mjs
 */
import { readFileSync } from 'node:fs';
import { buildIngredients } from './ingredient-engine.mjs';
import { EXACT, TOPPING } from './nutrition-templates.mjs';

// 各类食材「一道菜里」的合理上限（克）。超过即视为份量失真，需要人工确认。
const PLAUSIBLE_MAX = {
  米饭: 300,
  面条: 350,
  意面: 280,
  粉丝: 250,
  宽粉: 250,
  粉条: 250,
  米粉: 300, // 南昌拌粉一碗粉 250~300g 是常事（含水多、粉条粗）
  面粉: 160,
  包子皮: 110,
  饺子皮: 140,
  馄饨皮: 130,
  番茄: 180,
  西红柿: 180,
  香菇: 100,
  花菇: 100,
  玉菇: 120,
  土豆: 250,
  紫薯: 200,
  南瓜: 250,
  茄子: 250,
  黄瓜: 200,
  大白菜: 250,
  小白菜: 250,
  娃娃菜: 250,
  青椒: 160,
  尖椒: 160,
  辣椒: 160, // 青椒肉丝这类里青椒常比肉多，126g 合理
  木耳: 150,
  海带: 180,
  莲藕: 200,
  豆干: 130, // 一份凉拌豆干 120g 合理，上限 120 定得太紧
  千张: 120,
  腐竹: 90,
  猪五花肉: 160,
  猪里脊: 180,
  猪梅花肉: 180,
  牛肉: 180,
  牛里脊: 180,
  牛腩: 180,
  鸡胸肉: 160,
  鸡腿肉: 150,
  鸡腿: 150,
  鸭腿: 150,
  鸡肉串: 120,
  猪肉末: 130,
  鸡腿肉: 150,
  植物油: 30,
  芝麻酱: 40,
  糖: 30,
  白糖: 30,
  冰糖: 20,
  醋: 25,
  生抽: 20,
  蚝油: 30,
  淀粉: 40,
  鸡蛋: 120,
  肠: 120,
  肠仔: 120,
  虾仁: 150,
  蟹棒: 120,
  鱼豆腐: 120,
  牛肉丸: 120,
  肉丸: 120,
  汤圆: 120,
  年糕: 150,
  玉米: 150,
  白菜: 250,
  豆芽: 200,
  金针菇: 150,
  杏鲍菇: 130,
  口蘑: 130,
  紫甘蓝: 150,
  洋葱: 150,
  胡萝卜: 120,
  白萝卜: 150,
  豆角: 200,
  四季豆: 200,
  芹菜: 200,
  竹笋: 180,
  茭笋: 160,
  榨菜: 130,
  酸菜: 160,
  韭菜: 120,
  豆苗: 120,
};

const obs = JSON.parse(readFileSync('server/data/observed-menu.json', 'utf8')).items;
const toppingKeys = Object.keys(TOPPING);

const norm = (s) =>
  String(s)
    .replace(/[（(]([^)）]*)[)）]/g, '$1')
    .replace(/[\s·、,，/／&+]/g, '')
    .replace(/份|个|根|碗|只|串|片|块|粉|丝/g, '');

function inferKcal(name) {
  if (EXACT[name]) return EXACT[name][0];
  const k = norm(name);
  if (EXACT[k]) return EXACT[k][0];
  return null;
}

const flagged = [];
let checked = 0;

for (const o of obs) {
  const kcal = inferKcal(o.name);
  if (!kcal) continue;
  checked++;
  const ing = buildIngredients(o.name, kcal, o.category, toppingKeys);
  const over = ing.ingredients.filter((i) => {
    const max = PLAUSIBLE_MAX[i.name];
    return max !== undefined && i.grams > max;
  });
  if (over.length) {
    flagged.push({
      name: o.name,
      kcal,
      ratio: ing.ratio,
      over: over.map((i) => `${i.name} ${i.grams}g（上限 ${PLAUSIBLE_MAX[i.name]}g）`),
      all: ing.ingredients.map((i) => `${i.name} ${i.grams}g`).join(' / '),
    });
  }
}

console.log(`校准后克重超出「一道菜的合理上限」的：${flagged.length} / ${checked} 道\n`);
for (const f of flagged) {
  console.log(`【${f.name}】${f.kcal} kcal（校准系数 ${f.ratio.toFixed(2)}）`);
  f.over.forEach((o) => console.log('   超量：' + o));
  console.log('   全部：' + f.all);
  console.log();
}
