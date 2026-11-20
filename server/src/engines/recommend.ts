import type {
  Combo,
  ComboDish,
  Dish,
  DishTag,
  Goal,
  Meal,
  MealTarget,
  NutritionTotals,
  TextEngine,
} from '@canteen/shared';

/**
 * 推荐引擎（BE-A）。
 *
 * 口径来自 docs/API.md 附录 B（评分权重）与 §4.1-E（组合结构）。
 * 纯函数、无 I/O：调用方负责把菜品池 / 目标 / 忌口标签传进来。
 *
 * 组合结构（§4.1-E，v1.2.2 新定）：
 * - 午晚：主食 × 主菜 × 素菜（汤为可选加分项）
 * - 早餐：主食 × 主菜（不要求素菜、不要求汤），水果为可选加分项
 *   依据：早餐 14 道里素菜 0、汤 0，沿用午晚规则则组合数恒为 0。
 */

const SODIUM_LINE_MG = 1600;

export interface RecommendInput {
  meal: Meal;
  goal: Goal;
  /** 已解析成 DishTag 的忌口标签（调用方用 avoid_options 把 key 映射成 tag） */
  avoidTags: DishTag[];
  target: MealTarget;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function totalsOf(dishes: Dish[]): NutritionTotals {
  return dishes.reduce<NutritionTotals>(
    (a, d) => ({
      kcal: round1(a.kcal + d.kcal),
      protein_g: round1(a.protein_g + d.protein_g),
      fat_g: round1(a.fat_g + d.fat_g),
      carbs_g: round1(a.carbs_g + d.carbs_g),
      sodium_mg: Math.round(a.sodium_mg + d.sodium_mg),
    }),
    { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, sodium_mg: 0 },
  );
}

/** 由菜品 id 集合生成短哈希（供回填关联采纳，API.md §2.3） */
function shortId(ids: string[]): string {
  const s = ids.slice().sort().join('|');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0').slice(0, 8);
}

/** 钠罚分（v1.2.3 分段系数）：≤1600 不罚；1600~1900 线性 ×0.05；>1900 再叠 ×0.10 */
export function sodiumPenalty(sodiumMg: number): number {
  if (sodiumMg <= SODIUM_LINE_MG) return 0;
  let p = (sodiumMg - SODIUM_LINE_MG) * 0.05;
  if (sodiumMg > 1900) p += (sodiumMg - 1900) * 0.1;
  return p;
}

/** Fisher–Yates 洗牌（供「换一批」随机抽取，使结果可变化） */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 附录 B 评分：返回「越大越好」的得分。
 * 各类偏离按文档系数转为惩罚，达标项给奖励。
 *
 * `weigh` 放大容忍度（MENU-V3 §2.4⑤）：称重菜份量现场定、热量只作参考，
 * 用同一套点值惩罚会把所有含称重菜的组合压到后面去。故含称重菜时
 * 热量相关惩罚按 `WEIGH_TOLERANCE` 放宽，蛋白 / 脂肪 / 钠照常（标签与配比不随份量漂移）。
 */
const WEIGH_TOLERANCE = 2.5;

function scoreCombo(
  t: NutritionTotals,
  target: MealTarget,
  goal: Goal,
  hasPlant: boolean,
  hasWeighed: boolean,
): number {
  let penalty = 0;

  // 热量偏离 ×120（含称重菜时放宽）
  const kcalWeight = hasWeighed ? 1 / WEIGH_TOLERANCE : 1;
  const kcalDev = Math.abs(t.kcal - target.kcal) / target.kcal;
  penalty += kcalDev * 120 * kcalWeight;
  // health / gain 下热量 <85% 目标额外罚 ×140（含称重菜时同样放宽）
  if ((goal === 'health' || goal === 'gain') && t.kcal < 0.85 * target.kcal) {
    penalty += ((0.85 * target.kcal - t.kcal) / target.kcal) * 140 * kcalWeight;
  }

  // 蛋白不足罚 ×45、超 160% 罚 ×35
  if (t.protein_g < target.protein_g) {
    penalty += ((target.protein_g - t.protein_g) / target.protein_g) * 45;
  }
  if (t.protein_g > 1.6 * target.protein_g) {
    penalty += ((t.protein_g - 1.6 * target.protein_g) / target.protein_g) * 35;
  }

  // 脂肪能量占比 >42% 罚 ×200、<15% 罚 ×100
  const fatRatio = t.kcal > 0 ? (t.fat_g * 9) / t.kcal : 1;
  if (fatRatio > 0.42) penalty += (fatRatio - 0.42) * 200;
  if (fatRatio < 0.15) penalty += (0.15 - fatRatio) * 100;

  // 钠罚分（v1.2.3 分段系数，见 sodiumPenalty）
  penalty += sodiumPenalty(t.sodium_mg);

  let bonus = 0;
  // 含蔬菜 / 水果 +7
  if (hasPlant) bonus += 7;
  // lose 且脂肪 <32% +6
  if (goal === 'lose' && fatRatio < 0.32) bonus += 6;
  // gain 且蛋白达标 +9
  if (goal === 'gain' && t.protein_g >= target.protein_g) bonus += 9;

  return 1000 - penalty + bonus;
}

function buildReason(
  t: NutritionTotals,
  target: MealTarget,
  hasPlant: boolean,
  hasWeighed: boolean,
): string {
  const diff = round1(t.kcal - target.kcal);
  const kcalNote =
    Math.abs(diff) <= target.kcal * 0.1
      ? '基本贴着目标'
      : diff > 0
        ? `比目标高 ${diff}kcal`
        : `比目标低 ${-diff}kcal`;
  const proteinNote = t.protein_g >= target.protein_g ? '蛋白质达标' : '蛋白质略低';
  const saltNote = t.sodium_mg > 1900 ? '；钠偏高，建议控制盐分摄入' : '';
  // MENU-V3 §2.4⑤ / I5：称重菜热量只给参考值，文案不承诺精确 kcal
  const weighNote = hasWeighed ? '；含称重菜，份量以现场称重为准，热量仅供参考' : '';
  return `这一餐约 ${t.kcal}kcal（${kcalNote}）；蛋白质 ${t.protein_g}g（${proteinNote}）,${
    hasPlant ? '含蔬果' : '未配蔬果'
  }，钠 ${t.sodium_mg}mg${saltNote}${weighNote}。`;
}

function toCombo(dishes: Dish[], target: MealTarget): Combo {
  const totals = totalsOf(dishes);
  const hasPlant = dishes.some((d) => d.category === 'veg' || d.category === 'fruit');
  const hasWeighed = dishes.some((d) => d.pricing_mode === 'weigh');

  const comboDishes: ComboDish[] = dishes.map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    portion_label: d.portion_label,
    servings: 1,
    kcal: round1(d.kcal),
    protein_g: round1(d.protein_g),
    fat_g: round1(d.fat_g),
    carbs_g: round1(d.carbs_g),
    sodium_mg: Math.round(d.sodium_mg),
    // 称重标记（API.md v1.2.4 §2.3，PROGRESS §2.2 #7）：与 Dish 同规则——
    // 老种子没有 pricing_mode 键时不下发，只有 v3 菜才带这个键。
    ...(d.pricing_mode !== undefined ? { pricing_mode: d.pricing_mode } : {}),
  }));

  return {
    id: shortId(dishes.map((d) => d.id)),
    dishes: comboDishes,
    totals,
    reason: buildReason(totals, target, hasPlant, hasWeighed),
    // 组合级称重标记：服务端算好，前端一行判断即可显示「份量以现场称重为准」
    has_weighed_dish: hasWeighed,
    engine: 'template' as TextEngine,
  };
}

const NO_SOLUTION_NOTICE =
  '符合忌口条件的菜品太少，建议放宽一两个限制或换个时段';

/**
 * 生成推荐组合。
 *
 * 返回最多 3 套；同一响应内保证主食互不相同、主菜不重复（API.md §2.3 / PROGRESS §2.2）。
 * 忌口过滤后无可行组合时返回空数组 + notice（不是错误，HTTP 仍为 200）。
 */
export function recommendCombos(
  allDishes: Dish[],
  input: RecommendInput,
): { combos: Combo[]; notice: string | null } {
  const { meal, goal, avoidTags, target } = input;

  // E1 + E4：候选池先过滤（recommendable=false 的 78 道不进池；忌口在组合生成之前过滤）
  const pool = allDishes.filter(
    (d) =>
      d.status === 'active' &&
      d.meals.includes(meal) &&
      d.recommendable !== false &&
      !d.tags.some((tag) => avoidTags.includes(tag)),
  );

  // MENU-V3 §2.4 四路分流。serving_mode 缺省按 'combo'（老 55 道种子行为不变）。
  // plate 是称重自选线：不进 combos（E5）。
  const modeOf = (d: Dish) => d.serving_mode ?? 'combo';
  const trioPool = pool.filter((d) => {
    const m = modeOf(d);
    return m === 'combo' || m === 'component';
  });
  const singlePool = pool.filter((d) => modeOf(d) === 'single');

  const byCat = (c: Dish['category'], from: Dish[] = trioPool) =>
    from.filter((d) => d.category === c);
  const staples = byCat('staple');
  const proteins = byCat('protein');
  const veg = byCat('veg');
  const soup = byCat('soup');
  const fruit = byCat('fruit');

  // 午晚额外要求素菜；早餐不要求素菜、不要求汤（§4.1-E）
  const requireVeg = meal !== 'breakfast';
  const side = meal === 'breakfast' ? fruit : soup;

  type Candidate = {
    dishes: Dish[];
    /** 分组键：三件套 = 主食 id（主食互不相同）；single = 菜 id（不重复同一道菜，E3） */
    group: string;
    /** 次键：三件套的主菜 id（主菜不重复）；single 无 */
    secondary?: string;
    /** 是否含称重菜（评分放宽 + 文案提示 + E7 排除） */
    weighed: boolean;
  };
  const candidates: Candidate[] = [];

  // ②③ combo / component 路：沿用现有「主食 × 主菜 × 素菜」结构（轻食与麻辣烫配菜
  // 都是 staple/protein/veg 三类；麻辣烫汤底是 soup，作为可选 side，辣度由微辣汤底把关，
  // 忌口过滤已在 pool 阶段完成——不吃辣时微辣汤底不在池里，E4）。
  for (const s of staples) {
    for (const p of proteins) {
      const base = [s, p];
      const bodies = requireVeg
        ? veg.length > 0
          ? veg.map((v) => [...base, v])
          : []
        : [base];
      for (const body of bodies) {
        const make = (ds: Dish[]): Candidate => ({
          dishes: ds,
          group: s.id,
          secondary: p.id,
          weighed: ds.some((d) => d.pricing_mode === 'weigh'),
        });
        candidates.push(make(body));
        for (const sd of side) candidates.push(make([...body, sd]));
      }
    }
  }

  // ③ single 路：每道成品餐自成一套，不再配主食（E2 dishes.length===1 / E3 无双主食）
  for (const d of singlePool) {
    candidates.push({
      dishes: [d],
      group: d.id,
      weighed: d.pricing_mode === 'weigh',
    });
  }

  if (candidates.length === 0) {
    return { combos: [], notice: NO_SOLUTION_NOTICE };
  }

  // 注（v1.2.3）：补小荤不得新增菜品、不得改变 §2.3 组合件数——低热量组合靠热量偏离罚自然淘汰。
  // 评分 + 去重（按菜品 id 集合）
  const seen = new Set<string>();
  const scored = candidates
    .filter((c) => {
      const key = c.dishes
        .map((d) => d.id)
        .slice()
        .sort()
        .join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => {
      const t = totalsOf(c.dishes);
      const hasPlant = c.dishes.some(
        (d) => d.category === 'veg' || d.category === 'fruit',
      );
      return {
        candidate: c,
        score: scoreCombo(t, target, goal, hasPlant, c.weighed),
        weighed: c.weighed,
      };
    })
    .sort((a, b) => b.score - a.score);

  type Scored = (typeof scored)[number];

  // 选 3 套：先放「非称重里得分最高」的一套（E7 贴合度兜底——判定对象限定非称重组合），
  // 其余按 group 分组、组内降序，随机抽「主食/单菜互不相同、主菜不重复」的最优凑满 3 套
  // （保留可变化性 + 防 #27 套数坍缩）。若某些形态候选不足 3 组，按分数从剩余里补齐并在
  // notice 里说明（E6 允许跨形态补齐）。
  const chosen: Scored[] = [];
  const usedGroups = new Set<string>();
  const usedSecondary = new Set<string>();
  const take = (s: Scored) => {
    usedGroups.add(s.candidate.group);
    if (s.candidate.secondary) usedSecondary.add(s.candidate.secondary);
    chosen.push(s);
  };

  // 1) 贴合度最优兜底：非称重候选里的最高分；全都是称重菜时才退而取全局最高
  const best = scored.find((s) => !s.weighed) ?? scored[0];
  take(best);

  // 2) 其余按 group 分组（排除已占用），组内按得分降序
  const byGroup = new Map<string, Scored[]>();
  for (const s of scored) {
    if (chosen.includes(s)) continue;
    const g = s.candidate.group;
    if (usedGroups.has(g)) continue;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(s);
  }
  for (const arr of byGroup.values()) arr.sort((a, b) => b.score - a.score);

  // 3) 随机顺序遍历各组，组内取首个「次键（主菜）未占用」的最优，凑满 3 套
  for (const g of shuffle([...byGroup.keys()])) {
    if (chosen.length >= 3) break;
    const group = byGroup.get(g)!;
    const pick = group.find((x) => {
      const sec = x.candidate.secondary;
      return !sec || !usedSecondary.has(sec);
    });
    if (!pick) continue;
    take(pick);
  }

  // 4) 跨形态补齐：仍不足 3 套时按分数从剩余候选补（跳过已选的完全相同的菜集合）
  if (chosen.length < 3) {
    const chosenKeys = new Set(chosen.map((c) => c.candidate.dishes.map((d) => d.id).sort().join('|')));
    for (const s of scored) {
      if (chosen.length >= 3) break;
      if (chosen.includes(s)) continue;
      const k = s.candidate.dishes.map((d) => d.id).sort().join('|');
      if (chosenKeys.has(k)) continue;
      take(s);
      chosenKeys.add(k);
    }
  }

  const combos = chosen.map((c) => toCombo(c.candidate.dishes, target));
  // E6：候选不足跨形态补齐时，在 notice 里说明（不是错误，HTTP 仍 200）
  const notice = chosen.length < 3
    ? '符合忌口与份量条件的组合较少，已从可用菜品中跨形态补齐'
    : null;
  return { combos, notice };
}
