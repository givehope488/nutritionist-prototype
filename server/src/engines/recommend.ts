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
 *
 * 早餐池优先级（v1.2.10，2026-11-26）：只有早餐线菜（仅早餐供应）+ 常见早餐成品
 * （炒饭/炒面/炒米粉）参与早餐推荐；全天供应的盖浇饭 / 拌面不再按热量贴合度挤进早餐。
 * 早餐线不足 3 套时才用完整池补齐（见 recommendCombos）。plate（一楼早餐自选线）
 * 只允许在早餐进入组合——午晚仍按 E5 排除。
 */

const SODIUM_LINE_MG = 1600;

/**
 * P2-1（UI 走查 2026-11-22）：池子压缩时，single 路单菜可能被当作「一餐」补位，
 * 出现 260/70 kcal 对 750 目标（-65%/-90%）的极端套餐。偏离超过该比例的单菜
 * 只作「单点/加餐参考」，并优先让位于真正的组合（有正餐可选时不输出）。
 */
const LIGHT_FILL_DEV = 0.4;

/** 套餐热量相对目标的绝对偏离比例（目标为 0 时按 0 处理，避免除零） */
function kcalDeviation(t: NutritionTotals, target: MealTarget): number {
  return target.kcal > 0 ? Math.abs(t.kcal - target.kcal) / target.kcal : 0;
}

export interface RecommendInput {
  meal: Meal;
  goal: Goal;
  /** 已解析成 DishTag 的忌口标签（调用方用 avoid_options 把 key 映射成 tag） */
  avoidTags: DishTag[];
  target: MealTarget;
  /**
   * 用户 BMI（2026-11-25 用户决策）：BMI ≥ 24（超重/肥胖）时，只返回热量不超过
   * 本餐目标的组合；估算可能略超的称重菜也不例外。缺省 undefined = 不做该上限
   * （老调用方 / 单测保持原行为）。
   */
  bmi?: number;
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

/** 从候选窗口里随机取一个（「换一批」的变化性由调用处的 PICK_WINDOW 控制） */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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
  // 保持 / 增肌 / 增重 下热量 <85% 目标额外罚 ×140（含称重菜时同样放宽）
  if (
    (goal === 'health' || goal === 'gain' || goal === 'weight_gain') &&
    t.kcal < 0.85 * target.kcal
  ) {
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
  // 增肌且蛋白达标 +9（增重只做能量盈余，不加蛋白分）
  if (goal === 'gain' && t.protein_g >= target.protein_g) bonus += 9;

  return 1000 - penalty + bonus;
}

function buildReason(
  t: NutritionTotals,
  target: MealTarget,
  hasPlant: boolean,
  hasWeighed: boolean,
  lightFill = false,
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
  // P2-1：单菜补位且严重偏离目标时，明确标成「单点/加餐参考」，不冒充完整一餐
  const lightNote = lightFill
    ? '；本套为单点/加餐参考，与目标热量差距较大，建议搭配其它菜品组成一餐'
    : '';
  return `这一餐约 ${t.kcal}kcal（${kcalNote}）；蛋白质 ${t.protein_g}g（${proteinNote}）,${
    hasPlant ? '含蔬果' : '未配蔬果'
  }，钠 ${t.sodium_mg}mg${saltNote}${weighNote}${lightNote}。`;
}

function toCombo(dishes: Dish[], target: MealTarget, lightFill = false): Combo {
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
    reason: buildReason(totals, target, hasPlant, hasWeighed, lightFill),
    // 组合级称重标记：服务端算好，前端一行判断即可显示「份量以现场称重为准」
    has_weighed_dish: hasWeighed,
    engine: 'template' as TextEngine,
  };
}

const NO_SOLUTION_NOTICE =
  '符合忌口条件的菜品太少，建议放宽一两个限制或换个时段';

/** BMI ≥ 24：只允许 kcal ≤ 本餐目标的组合；全超时给这条引导，而不是硬塞超热量套 */
const OVERWEIGHT_NOTICE =
  '按你的体重管理目标，暂无不超过本餐热量的搭配，建议减少份量或选择更清淡的菜品';

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
  const { meal, goal, avoidTags, target, bmi } = input;
  // BMI ≥ 24（中国标准：超重 24~27.9、肥胖 ≥28）不推荐超出本餐目标热量的组合
  const overweightCap = bmi !== undefined && bmi >= 24;

  // E1 + E4：候选池先过滤（recommendable=false 的 78 道不进池；忌口在组合生成之前过滤）
  const pool = allDishes.filter(
    (d) =>
      d.status === 'active' &&
      d.meals.includes(meal) &&
      d.recommendable !== false &&
      !d.tags.some((tag) => avoidTags.includes(tag)),
  );

  // MENU-V3 §2.4 四路分流。serving_mode 缺省按 'combo'（老 55 道种子行为不变）。
  // plate 是称重自选线：午晚不进 combos（E5）；早餐线本身就是 plate，允许参与早餐组合（v1.2.10）。
  const modeOf = (d: Dish) => d.serving_mode ?? 'combo';

  type Candidate = {
    dishes: Dish[];
    /** 分组键：三件套 = 主食 id（主食互不相同）；single = 菜 id（不重复同一道菜，E3） */
    group: string;
    /** 次键：三件套的主菜 id（主菜不重复）；single 无 */
    secondary?: string;
    /** 是否含称重菜（评分放宽 + 文案提示 + E7 排除） */
    weighed: boolean;
  };

  const byCat = (c: Dish['category'], from: Dish[]) =>
    from.filter((d) => d.category === c);

  const buildCandidates = (from: Dish[]): Candidate[] => {
    const trioPool = from.filter((d) => {
      const m = modeOf(d);
      return m === 'combo' || m === 'component' || (meal === 'breakfast' && m === 'plate');
    });
    const singlePool = from.filter((d) => modeOf(d) === 'single');

    const staples = byCat('staple', trioPool);
    const proteins = byCat('protein', trioPool);
    const veg = byCat('veg', trioPool);
    const soup = byCat('soup', trioPool);
    const fruit = byCat('fruit', trioPool);

    // 午晚额外要求素菜；早餐不要求素菜、不要求汤（§4.1-E）
    const requireVeg = meal !== 'breakfast';
    const side = meal === 'breakfast' ? fruit : soup;

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
    return candidates;
  };

  // 早餐优先池（v1.2.10）：只取早餐线菜（仅早餐供应）+ 常见早餐成品（炒饭/炒面/炒米粉，
  // 且热量在目标的 0.8~1.15 倍内，避免把 550kcal 的大碗炒饭塞给目标 430 的用户）。
  // 全天供应的盖浇饭 / 拌面 / 鸡排饭不再进入早餐主推荐。
  const COMMON_BREAKFAST_SINGLE = /炒饭|炒面|炒米粉/;
  const breakfastPrimaryPool =
    meal === 'breakfast'
      ? pool.filter((d) => {
          if (d.meals.length === 1 && d.meals[0] === 'breakfast') return true;
          return (
            modeOf(d) === 'single' &&
            COMMON_BREAKFAST_SINGLE.test(d.name) &&
            d.kcal >= target.kcal * 0.8 &&
            d.kcal <= target.kcal * 1.15
          );
        })
      : pool;

  const primaryCandidates = buildCandidates(breakfastPrimaryPool);
  // 早餐线不足时用完整池补齐；午晚 primary = pool，不存在第二层。
  const fallbackCandidates =
    breakfastPrimaryPool.length === pool.length ? [] : buildCandidates(pool);

  if (primaryCandidates.length === 0 && fallbackCandidates.length === 0) {
    return { combos: [], notice: NO_SOLUTION_NOTICE };
  }

  // 注（v1.2.3）：补小荤不得新增菜品、不得改变 §2.3 组合件数——低热量组合靠热量偏离罚自然淘汰。
  // 评分 + 去重（按菜品 id 集合；primary 先算，fallback 里的同款组合不再重复）
  const seen = new Set<string>();
  type Scored = {
    candidate: Candidate;
    score: number;
    weighed: boolean;
    light: boolean;
  };
  const scoreCandidates = (candidates: Candidate[]): Scored[] =>
    candidates
      .filter((c) => {
        // 超重/肥胖硬上限：先按热量剔除，再参与去重与评分
        if (overweightCap && totalsOf(c.dishes).kcal > target.kcal) return false;
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
          // P2-1：单菜（single 路）且热量严重偏离目标 = 只配当「单点/加餐参考」
          light: c.dishes.length === 1 && kcalDeviation(t, target) > LIGHT_FILL_DEV,
        };
      })
      .sort((a, b) => b.score - a.score);

  const primaryScored = scoreCandidates(primaryCandidates);
  const fallbackScored = scoreCandidates(fallbackCandidates);
  const scored = [...primaryScored, ...fallbackScored];

  // 超重/肥胖上限把所有候选都筛掉时，如实返回空 + 引导，不退回超热量组合
  if (scored.length === 0) {
    return {
      combos: [],
      notice: overweightCap ? OVERWEIGHT_NOTICE : NO_SOLUTION_NOTICE,
    };
  }

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

  // 1) 贴合度最优兜底：非称重候选里的最高分；P2-1 再优先排除单菜补位（light），
  //    有正餐组合时绝不拿单菜当第一套；只有全是单菜/称重才逐级退让。
  //    早餐优先池（v1.2.10）：第一套一定来自早餐线，完整池只用于补齐。
  const tiers = [primaryScored, fallbackScored].filter((tier) => tier.length > 0);
  const best =
    tiers[0].find((s) => !s.weighed && !s.light) ??
    tiers[0].find((s) => !s.weighed) ??
    tiers[0][0];
  take(best);

  // 2) 其余两套：**按得分降序**挑，在「前 K 名可用候选」里随机取一个。
  //
  //    旧做法是「随机顺序遍历主食组 → 组内取最优」。问题在于组是随机挑的，等于让
  //    「最高分只有 550kcal 的主食组」和「最高分 910kcal 的主食组」等概率入选：
  //    PD 2026-11-24 实测 15 套，8 套偏离目标 >20%，平均 −16.7%，最差 −39.7%，且全部偏低。
  //    改成前 K 名随机后：变化性仍在（同样请求每次不同），但不会再把明显偏低的组顶上来。
  //    约束不变：主食互不相同（usedGroups）、主菜不重复（usedSecondary）、单菜补位靠后。
  //    早餐：先把优先池挑完，仍不足 3 套才落到完整池（v1.2.10）。
  const PICK_WINDOW = 5;
  while (chosen.length < 3) {
    let picked: Scored | undefined;
    for (const tier of tiers) {
      const available = tier.filter((s) => {
        if (chosen.includes(s)) return false;
        if (usedGroups.has(s.candidate.group)) return false;
        const sec = s.candidate.secondary;
        if (sec && usedSecondary.has(sec)) return false;
        return true;
      });
      if (available.length === 0) continue;
      const proper = available.filter((s) => !s.light);
      picked = pickRandom((proper.length > 0 ? proper : available).slice(0, PICK_WINDOW));
      break;
    }
    if (!picked) break;
    take(picked);
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

  const combos = chosen.map((c) => toCombo(c.candidate.dishes, target, c.light));
  // E6：候选不足跨形态补齐时，在 notice 里说明（不是错误，HTTP 仍 200）
  // P2-1：若最终仍混入单菜补位，明确告知「单点/加餐参考」，不冒充完整一餐
  const notices: string[] = [];
  if (chosen.length < 3) {
    notices.push('符合忌口与份量条件的组合较少，已从可用菜品中跨形态补齐');
  }
  if (chosen.some((c) => c.light)) {
    notices.push('部分套餐为单菜补位，与目标热量差距较大，仅作单点/加餐参考');
  }
  const notice = notices.length > 0 ? notices.join('；') : null;
  return { combos, notice };
}
