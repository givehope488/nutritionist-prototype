#!/usr/bin/env node
/**
 * 由实测清单生成菜单种子 v3。
 *
 * 输入：server/data/observed-menu.json（照片识别结果，379 条）
 * 输出：server/data/menu-seed.v3.json
 *
 * 口径（2026-11-13 用户决策）：
 *   - 一切餐食以照片数据为准：原型估算的 55 道基线数据**全部抛弃**，不读、不合并、不保留
 *   - 产品不向用户提供价格：种子里**不含任何价格字段**
 *   - 二楼只有正餐档口进推荐池；汉堡工厂/缙云烧饼/绍兴小吃/炸串精选入库但不推荐
 *   - 一楼自选线只给餐食建议，不计价 → serving_mode = 'plate'
 *   - 二楼全天供应 → meals = breakfast/lunch/dinner
 *
 * 营养值：单菜精确 → 组合菜拆解（主食基底 + 浇头）→ 同类兜底，全部过 4/9/4 自洽。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EXACT, TOPPING, BASE, FALLBACK } from './nutrition-templates.mjs';

const OBS = 'server/data/observed-menu.json';
const SEED = 'server/data/menu-seed.v3.json';
const obs = JSON.parse(readFileSync(OBS, 'utf8')).items;

// ---------- 档口 → id 前缀 / 推荐池 / 上菜形态 ----------
const STALL = {
  '一楼·早餐': { code: 'f1b', serving: 'plate', recommendable: true, meals: ['breakfast'] },
  '一楼·中晚餐': { code: 'f1l', serving: 'plate', recommendable: true, meals: ['lunch', 'dinner'] },
  '二楼·兰州牛肉面': { code: 'lzx', serving: 'single', recommendable: true, meals: ['breakfast', 'lunch', 'dinner'] },
  '二楼·奉天朱家小馆': { code: 'ftj', serving: 'single', recommendable: true, meals: ['breakfast', 'lunch', 'dinner'] },
  '二楼·广东猪脚饭': { code: 'gzj', serving: 'single', recommendable: true, meals: ['breakfast', 'lunch', 'dinner'] },
  '二楼·拌个饭饭': { code: 'bfg', serving: 'single', recommendable: true, meals: ['breakfast', 'lunch', 'dinner'] },
  '二楼·朝陇阳': { code: 'cly', serving: 'single', recommendable: true, meals: ['breakfast', 'lunch', 'dinner'] },
  '二楼·江西小炒': { code: 'jx', serving: 'single', recommendable: true, meals: ['breakfast', 'lunch', 'dinner'] },
  '二楼·绍兴小吃': { code: 'sx', serving: 'single', recommendable: false, meals: ['breakfast', 'lunch', 'dinner'] },
  '二楼·缙云烧饼': { code: 'jy', serving: 'single', recommendable: false, meals: ['breakfast', 'lunch', 'dinner'] },
  '二楼·汉堡工厂': { code: 'hbj', serving: 'single', recommendable: false, meals: ['breakfast', 'lunch', 'dinner'] },
  '二楼·西蜀毛哥麻辣烫': { code: 'mlt', serving: 'component', recommendable: true, meals: ['breakfast', 'lunch', 'dinner'] },
  '二楼·健康餐': { code: 'jk', serving: 'component', recommendable: true, meals: ['breakfast', 'lunch', 'dinner'] },
  '二楼·炸串精选': { code: 'zcj', serving: 'single', recommendable: false, meals: ['breakfast', 'lunch', 'dinner'] },
};

// ---------- 名字归一 ----------
const norm = (s) =>
  String(s)
    // 括号内容要保留：它常常是区分依据（「馄饨（猪肉馅）」≠「温州瘦肉丸·馄饨」）
    .replace(/[（(]([^)）]*)[)）]/g, '$1')
    .replace(/[\s·、,，/／&+]/g, '')
    .replace(/份|个|根|碗|只|串|片|块|粉|丝/g, '');

const cleanLabel = (label) =>
  String(label)
    .replace(/[（(][^)）]*\d[^^)）]*[)）]/g, '')
    .replace(/\s*\d+(\.\d+)?\s*(g|G|kg|千克|克|ml|mL|毫升)\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim() || '1 份';

// ---------- 标签推断 ----------
const TAG_RULES = [
  ['pork', /猪|排骨|叉烧|培根|火腿|香肠|腊肉|肉松|里脊|肉肠/],
  // 牛肉丸不标 beef：丸子用肉可能是猪/鸡/牛，照片无法分辨，不做无依据断言
  ['beef', /牛肉(?!丸)|牛杂|肥牛|牛柳|牛排|牛腩/],
  ['seafood', /虾|蟹|鱿鱼|鱼|海带|紫菜|蛏|蛤/],
  ['egg', /蛋|蛋挞/],
  ['milk', /奶|酸奶|芝士|奶油/],
  // 粉类多为米粉/红薯粉，不含麸质，不标 gluten
  ['gluten', /面|饼|馒头|包|饺|馄饨|乌冬|吐司|三明治|意面/],
  ['peanut', /花生/],
  ['spicy', /辣|麻辣|红油|辣子|香辣|椒麻|藤椒|剁椒|酸辣|泡椒/],
  ['vegprotein', /豆腐|豆干|豆皮|腐竹|千张|豆泡|油豆腐|素肉|豆芽/],
];
function inferTags(name, category, stall) {
  const tags = [];
  for (const [tag, re] of TAG_RULES) if (re.test(name)) tags.push(tag);
  // 麻辣烫档口的配菜都泡在辣汤里，菜名不带「辣」字但实际是辣的
  if (stall === '二楼·西蜀毛哥麻辣烫' && category !== 'staple' && !tags.includes('spicy')) tags.push('spicy');
  if (tags.some((t) => ['pork', 'beef', 'seafood', 'egg', 'milk'].includes(t))) tags.push('meat');
  if (category === 'veg' && !tags.includes('vegprotein') && !tags.includes('meat')) tags.push('vegprotein');
  return [...new Set(tags)];
}

// ---------- 营养值推断 ----------
function harmonize(kcal, p, f, c) {
  const atwater = 4 * p + 9 * f + 4 * c;
  if (kcal <= 0) return Math.round(atwater);
  const dev = Math.abs(atwater - kcal) / kcal;
  if (dev <= 0.12) return Math.round(kcal);
  return Math.round(atwater);
}

/** 组合菜拆解：主食基底 + 浇头 */
const PREFIX = /^(小馆|招牌|经典|特色|网红|意式|爆款)/;

function tryParseCombo(name) {
  let baseKey = null;
  if (/盖浇饭|盖饭/.test(name)) baseKey = 'rice';
  else if (/拌粉/.test(name)) baseKey = 'rice_noodle';
  else if (/拌面/.test(name)) baseKey = 'noodle';
  else if (/汤面|汤粉/.test(name)) baseKey = 'noodle_soup';
  else if (/油泼面/.test(name)) baseKey = 'noodle_oil';
  else if (/面$/.test(name)) baseKey = 'noodle_soup';
  else if (/饭/.test(name)) baseKey = 'rice';
  if (!baseKey) return null;

  const rest = name
    .replace(/盖浇饭|盖饭/g, '')
    .replace(/拌面|拌粉/g, '')
    .replace(/汤面|汤粉/g, '')
    .replace(/油泼面/g, '')
    .replace(/饭/g, '')
    .replace(/面/g, '')
    .replace(/粉/g, '')
    .replace(/[（(].*?[)）]/g, '')
    .replace(/[/·、,，\s]/g, '')
    .trim();

  // 浇头：取名称里出现的浇头关键词（长的优先），可叠加
  const hits = [];
  let rest2 = rest;
  for (const key of Object.keys(TOPPING).sort((a, b) => b.length - a.length)) {
    if (rest2.includes(key)) {
      hits.push(TOPPING[key]);
      rest2 = rest2.replaceAll(key, '');
    }
  }
  if (hits.length === 0) {
    if (baseKey === 'noodle_oil') {
      // 油泼面自带油泼浇头
      const base = BASE.noodle_oil;
      const oil = [120, 3, 8, 12, 600];
      return { t: [0, base[1] + oil[0], base[2] + oil[1], base[3] + oil[2], base[4] + oil[3], base[5]] };
    }
    return null; // 认不出浇头，交给兜底
  }
  const base = BASE[baseKey];
  let p = base[1], f = base[2], c = base[3], na = base[4];
  // 浇头值格式 [kcal, protein, fat, carbs, sodium] —— 解构要带 kcal 位
  for (const [, tp, tf, tc, tna] of hits) { p += tp; f += tf; c += tc; na += tna; }
  return { t: [0, p, f, c, na, base[5]] };
}

function parseCombo(name) {
  // 逐级剥掉前缀修饰（「小馆招牌牛肉面」→「招牌牛肉面」→「牛肉面」）
  let v = name;
  for (let i = 0; i < 3; i++) {
    const stripped = v.replace(PREFIX, '');
    if (stripped === v) break;
    v = stripped;
    const r = tryParseCombo(v);
    if (r) return r;
  }
  return tryParseCombo(name);
}

function inferNutrition(name, category) {
  if (EXACT[name]) return { t: EXACT[name], how: 'exact' };
  const k = norm(name);
  if (EXACT[k]) return { t: EXACT[k], how: 'exact' };

  const combo = parseCombo(name);
  if (combo) return { t: combo.t, how: 'combo' };

  let best = null;
  for (const key of Object.keys(EXACT)) {
    const nk = norm(key);
    if (nk.length >= 2 && (k.includes(nk) || nk.includes(k))) {
      if (!best || nk.length > norm(best[0]).length) best = [key, EXACT[key]];
    }
  }
  if (best) return { t: best[1], how: 'partial' };

  return { t: FALLBACK[category] || FALLBACK.staple, how: 'fallback' };
}

// ---------- 组装 ----------
const out = [];
const seq = {};
const stats = { exact: 0, combo: 0, partial: 0, fallback: 0 };
const fallbackNames = [];

for (const o of obs) {
  const st = STALL[o.area];
  if (!st) throw new Error(`未知档口：${o.area}`);
  seq[st.code] = (seq[st.code] || 0) + 1;

  let category = o.category;
  if (category === 'other') category = 'protein';

  const { t, how } = inferNutrition(o.name, category);
  stats[how]++;
  if (how === 'fallback') fallbackNames.push(`${o.area} · ${o.name}`);

  out.push({
    id: `${st.code}-${String(seq[st.code]).padStart(2, '0')}`,
    name: o.name,
    category,
    portion_label: cleanLabel(t[5]),
    portion_grams: null,
    meals: st.meals,
    kcal: harmonize(t[0], t[1], t[2], t[3]),
    protein_g: t[1], fat_g: t[2], carbs_g: t[3], sodium_mg: t[4],
    tags: inferTags(o.name, category, o.area),
    drink: /奶|豆浆|可乐|雪碧|美年达|果汁/.test(o.name),
    reliability: 'B',
    status: 'active',
    ingredients: [],
    source:
      o.source === 'sign'
        ? '照片牌面抄录菜名；营养值按标准配方估算，待配料反推'
        : o.source === 'user'
          ? '用户口述菜名；营养值按标准配方估算，待配料反推'
          : '照片推测菜名（置信度低）；营养值按品类模板估算，待配料反推',
    floor: o.floor,
    stall: o.area,
    serving_mode: o.serving_mode ?? st.serving,
    recommendable: st.recommendable,
    evidence: o.source,
    confidence: o.confidence,
  });
}

const payload = {
  version: 3,
  exported_at: new Date().toISOString(),
  note:
    'v3 = 实测菜单。**一切餐食以照片数据为准**：原型估算的 55 道基线数据已全部抛弃，本种子只含照片识别与用户口述的条目。' +
    '**本产品不向用户提供价格**：种子里不含任何价格字段。' +
    '治理字段 floor/stall/serving_mode/recommendable/evidence/confidence 当前不入库、不出接口——' +
    'seed.ts 是逐字段 INSERT，需 BE-B 扩 shared 类型与 SQLite 列后生效。' +
    'serving_mode 语义：plate=一盘自选（只给餐食建议）/ single=独立成品餐 / component=可选组件（配菜、浇头）。',
  dishes: out,
};

writeFileSync(SEED, JSON.stringify(payload, null, 2) + '\n');

console.log(`已生成 seed v3：${out.length} 道`);
console.log('营养值来源：', JSON.stringify(stats));
const byS = {};
out.forEach((d) => { byS[d.serving_mode] = (byS[d.serving_mode] || 0) + 1; });
console.log('上菜形态：', JSON.stringify(byS));
console.log('推荐池内：', out.filter((d) => d.recommendable !== false).length, '道 / 池外：', out.filter((d) => d.recommendable === false).length, '道');
const byM = {};
out.forEach((d) => d.meals.forEach((m) => { byM[m] = (byM[m] || 0) + 1; }));
console.log('餐段覆盖：', JSON.stringify(byM));
console.log('含价格字段的条目：', out.filter((d) => 'price_yuan' in d).length);
console.log('仍靠兜底的（人工复核优先）：', fallbackNames.length, '道');
if (fallbackNames.length) console.log('  ' + fallbackNames.join('\n  '));
