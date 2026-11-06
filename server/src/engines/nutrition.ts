import type {
  Activity,
  Goal,
  Meal,
  ProfileInput,
  Profile,
  MealTarget,
  Sex,
} from '@canteen/shared';

/**
 * 营养计算引擎（BE-A）。
 *
 * 全部口径来自 docs/API.md 附录 A，是服务端唯一的计算事实源。
 * 规则（COLLAB.md 防线 F4 / API.md 附录 C）：营养计算公式口径禁止 Agent 擅自修改，
 * 改动须先走 API.md 变更流程并经 PD 复核——本文件只实现、不定义口径。
 *
 * 纯函数、无 I/O、无副作用，便于单测。
 */

const ACTIVITY_FACTOR: Record<Activity, number> = { low: 1.2, mid: 1.4, high: 1.6 };
const GOAL_FACTOR: Record<Goal, number> = { health: 1.0, lose: 0.8, gain: 1.12 };
const PROTEIN_PER_KG: Record<Goal, number> = { health: 1.2, lose: 1.6, gain: 1.8 };
const MEAL_RATIO: Record<Meal, number> = { breakfast: 0.3, lunch: 0.4, dinner: 0.35 };

const FAT_ENERGY_RATIO = 0.27;
const CARBS_FLOOR_G = 60;
const SODIUM_MEAL_LINE_MG = 1600;
const MINOR_AGE = 18;

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** BMI 按 API.md §2.2 示例保留 2 位小数（21.97），与普通数值的 1 位小数区分 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Mifflin-St Jeor 基础代谢率（附录 A） */
export function calcBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

/**
 * 未成年（age<18）且目标为 lose 时，强制降级为 health（附录 A / §2.2）。
 * 返回降级标记，供 warnings 使用。
 */
export function resolveGoal(
  goal: Goal,
  age: number,
): { goal: Goal; minorDowngraded: boolean } {
  if (goal === 'lose' && age < MINOR_AGE) {
    return { goal: 'health', minorDowngraded: true };
  }
  return { goal, minorDowngraded: false };
}

export interface TargetsResult {
  profile: Profile;
  mealTargets: Record<Meal, MealTarget>;
}

/**
 * 由档案输入派生全部营养目标。
 *
 * 返回：
 * - profile：含 bmi / bmi_tag / day_kcal / warnings 的派生档案；
 * - mealTargets：三餐各自的 MealTarget（kcal = day_kcal × 餐次占比；宏量 = 日宏量 × 餐次占比）。
 *
 * 注：§2.3 示例里的 meal 级宏量数字仅为示意；本实现与附录 A 严格自洽（日宏量 × 餐次占比）。
 */
export function calcTargets(input: ProfileInput): TargetsResult {
  const { goal: effectiveGoal, minorDowngraded } = resolveGoal(input.goal, input.age);

  const bmr = calcBMR(input.sex, input.weight_kg, input.height_cm, input.age);
  const tdee = Math.round(bmr * ACTIVITY_FACTOR[input.activity]);

  const dayKcalRaw = tdee * GOAL_FACTOR[effectiveGoal];
  const dayKcalFloor = bmr * 1.05;
  const dayKcal = Math.round(Math.max(dayKcalRaw, dayKcalFloor));

  const proteinDay = round1(input.weight_kg * PROTEIN_PER_KG[effectiveGoal]);
  const fatDay = round1((dayKcal * FAT_ENERGY_RATIO) / 9);
  const carbsDay = round1(
    Math.max((dayKcal - proteinDay * 4 - fatDay * 9) / 4, CARBS_FLOOR_G),
  );

  const bmi = round2(input.weight_kg / Math.pow(input.height_cm / 100, 2));
  const bmiTag = bmi < 18.5 ? '偏瘦' : bmi < 24 ? '正常' : bmi < 28 ? '偏胖' : '肥胖';

  const warnings: string[] = [];
  if (minorDowngraded) {
    warnings.push('未满18岁不提供热量缺口方案，已调整为日常保健');
  }

  const profile: Profile = {
    ...input,
    goal: effectiveGoal,
    bmi,
    bmi_tag: bmiTag,
    day_kcal: dayKcal,
    warnings,
  };

  const mealTargets = {} as Record<Meal, MealTarget>;
  for (const meal of Object.keys(MEAL_RATIO) as Meal[]) {
    const ratio = MEAL_RATIO[meal];
    mealTargets[meal] = {
      day_kcal: dayKcal,
      meal_ratio: ratio,
      kcal: round1(dayKcal * ratio),
      protein_g: round1(proteinDay * ratio),
      fat_g: round1(fatDay * ratio),
      carbs_g: round1(carbsDay * ratio),
      sodium_mg: SODIUM_MEAL_LINE_MG,
    };
  }

  return { profile, mealTargets };
}
