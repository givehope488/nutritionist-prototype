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

/**
 * 附录 B 评分：返回「越大越好」的得分。
 * 各类偏离按文档系数转为惩罚，达标项给奖励。
 */
function scoreCombo(
  t: NutritionTotals,
  target: MealTarget,
  goal: Goal,
  hasPlant: boolean,
): number {
  let penalty = 0;

  // 热量偏离 ×120
  const kcalDev = Math.abs(t.kcal - target.kcal) / target.kcal;
  penalty += kcalDev * 120;
  // health / gain 下热量 <85% 目标额外罚 ×140
  if ((goal === 'health' || goal === 'gain') && t.kcal < 0.85 * target.kcal) {
    penalty += ((0.85 * target.kcal - t.kcal) / target.kcal) * 140;
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

  // 钠 >1600mg 线性罚
  if (t.sodium_mg > SODIUM_LINE_MG) {
    penalty += (t.sodium_mg - SODIUM_LINE_MG) * 0.01;
  }

  let bonus = 0;
  // 含蔬菜 / 水果 +7
  if (hasPlant) bonus += 7;
  // lose 且脂肪 <32% +6
  if (goal === 'lose' && fatRatio < 0.32) bonus += 6;
  // gain 且蛋白达标 +9
  if (goal === 'gain' && t.protein_g >= target.protein_g) bonus += 9;

  return 1000 - penalty + bonus;
}

function buildReason(t: NutritionTotals, target: MealTarget, hasPlant: boolean): string {
  const diff = round1(t.kcal - target.kcal);
  const kcalNote =
    Math.abs(diff) <= target.kcal * 0.1
      ? '基本贴着目标'
      : diff > 0
        ? `比目标高 ${diff}kcal`
        : `比目标低 ${-diff}kcal`;
  const proteinNote = t.protein_g >= target.protein_g ? '蛋白质达标' : '蛋白质略低';
  return `这一餐约 ${t.kcal}kcal（${kcalNote}）；蛋白质 ${t.protein_g}g（${proteinNote}），${
    hasPlant ? '含蔬果' : '未配蔬果'
  }，钠 ${t.sodium_mg}mg。`;
}

function toCombo(dishes: Dish[], target: MealTarget): Combo {
  const totals = totalsOf(dishes);
  const hasPlant = dishes.some((d) => d.category === 'veg' || d.category === 'fruit');

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
  }));

  return {
    id: shortId(dishes.map((d) => d.id)),
    dishes: comboDishes,
    totals,
    reason: buildReason(totals, target, hasPlant),
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

  const pool = allDishes.filter(
    (d) =>
      d.status === 'active' &&
      d.meals.includes(meal) &&
      !d.tags.some((tag) => avoidTags.includes(tag)),
  );

  const byCat = (c: Dish['category']) => pool.filter((d) => d.category === c);
  const staples = byCat('staple');
  const proteins = byCat('protein');
  const veg = byCat('veg');
  const soup = byCat('soup');
  const fruit = byCat('fruit');

  // 午晚额外要求素菜；早餐不要求素菜、不要求汤（§4.1-E）
  const requireVeg = meal !== 'breakfast';
  const side = meal === 'breakfast' ? fruit : soup;

  type Candidate = { dishes: Dish[] };
  const candidates: Candidate[] = [];

  for (const s of staples) {
    for (const p of proteins) {
      const base = [s, p];
      const bodies = requireVeg
        ? veg.length > 0
          ? veg.map((v) => [...base, v])
          : []
        : [base];
      for (const body of bodies) {
        candidates.push({ dishes: body });
        for (const sd of side) candidates.push({ dishes: [...body, sd] });
      }
    }
  }

  if (candidates.length === 0) {
    return { combos: [], notice: NO_SOLUTION_NOTICE };
  }

  // 两阶段补「小荤」：能量过低（kcal≤260 或 fat≤12g）时，尝试再加一道荤/半荤提升满足感（附录 B）
  const augmented: Candidate[] = [];
  for (const c of candidates) {
    const t = totalsOf(c.dishes);
    if (t.kcal <= 260 || t.fat_g <= 12) {
      const extra = proteins.find(
        (p) => !c.dishes.some((d) => d.id === p.id),
      );
      if (extra) augmented.push({ dishes: [...c.dishes, extra] });
    }
  }

  const all = [...candidates, ...augmented];

  // 评分 + 去重（按菜品 id 集合）
  const seen = new Set<string>();
  const scored = all
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
      return { candidate: c, score: scoreCombo(t, target, goal, hasPlant) };
    })
    .sort((a, b) => b.score - a.score);

  // 选 top3：主食互不相同、主菜不重复
  const combos: Combo[] = [];
  const usedStaples = new Set<string>();
  const usedProteins = new Set<string>();
  for (const { candidate } of scored) {
    if (combos.length >= 3) break;
    const staple = candidate.dishes.find((d) => d.category === 'staple');
    const protein = candidate.dishes.find((d) => d.category === 'protein');
    if (staple && usedStaples.has(staple.id)) continue;
    if (protein && usedProteins.has(protein.id)) continue;
    if (staple) usedStaples.add(staple.id);
    if (protein) usedProteins.add(protein.id);
    combos.push(toCombo(candidate.dishes, target));
  }

  if (combos.length === 0) {
    return { combos: [], notice: NO_SOLUTION_NOTICE };
  }
  return { combos, notice: null };
}
