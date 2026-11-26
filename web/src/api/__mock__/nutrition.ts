// 附录 A 营养计算口径的转写（API.md 附录 A）——服务端替身专用，视图层禁止 import。
// 口径以附录 A 为准；API.md §2.3 响应示例中的 target.fat_g 与附录 A 算不拢，
// 已记入 web/docs/FE-B-开发记录.md「待评审议题 Q1」，等 BE-A 定夺。
import { BMI_OVERWEIGHT, BMI_UNDERWEIGHT, MINOR_AGE } from '@canteen/shared';
import type { Goal, MealTarget, Meal, Profile, Sex } from '@canteen/shared';

const ACTIVITY_FACTOR: Record<Profile['activity'], number> = { low: 1.2, mid: 1.4, high: 1.6 };
const GOAL_FACTOR: Record<Goal, number> = {
  health: 1.0,
  lose: 0.8,
  gain: 1.12,
  weight_gain: 1.15,
};
const PROTEIN_PER_KG: Record<Goal, number> = {
  health: 1.2,
  lose: 1.6,
  gain: 1.8,
  weight_gain: 1.2,
};
/**
 * 附录 A：餐次占比。v1.2.3 起和为 1.0（dinner 由 0.35 改 0.30）。
 * 提案分支（2026-11-24）：暂改为 0.25 / 0.40 / 0.35 以对齐 BE-A 的验证实现；
 * 契约定稿前以 docs/API.md 为准，本文件随契约变更一起回退或确认。
 */
export const MEAL_RATIO: Record<Meal, number> = {
  breakfast: 0.25,
  lunch: 0.4,
  dinner: 0.35,
};
/** 附录 A：单餐钠参考线 */
export const MEAL_SODIUM_REF_MG = 1600;
/** 脂肪能量占比：减肥 25%，其余 27%（API.md v1.2.9 附录 A） */
const FAT_ENERGY_RATIO: Record<Goal, number> = {
  health: 0.27,
  lose: 0.25,
  gain: 0.27,
  weight_gain: 0.27,
};
const CARBS_MIN_G = 60;

export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  // Mifflin-St Jeor
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/**
 * 合规护栏（与 server/src/engines/nutrition.ts 同口径）：
 * - 未成年 / BMI<18.5 且 goal=lose → 强制降级 health；
 * - BMI≥24 且 goal=gain → 只给提示，不降级。
 */
export function resolveGoal(
  age: number,
  goal: Goal,
  bmi: number,
): { goal: Goal; warnings: string[] } {
  if (goal === 'lose') {
    if (age < MINOR_AGE) {
      return {
        goal: 'health',
        warnings: ['未满18岁不提供热量缺口方案，已调整为保持'],
      };
    }
    if (bmi < BMI_UNDERWEIGHT) {
      return {
        goal: 'health',
        warnings: ['BMI 低于 18.5 不提供热量缺口方案，已调整为保持'],
      };
    }
    return { goal, warnings: [] };
  }
  if (goal === 'gain' && bmi >= BMI_OVERWEIGHT) {
    return {
      goal,
      warnings: ['当前 BMI 属超重/肥胖，增肌期建议优先增肌、控制增重速度'],
    };
  }
  return { goal, warnings: [] };
}

export function bmiTag(bmi: number): string {
  if (bmi < BMI_UNDERWEIGHT) return '偏瘦';
  if (bmi < BMI_OVERWEIGHT) return '正常';
  if (bmi < 28) return '超重';
  return '肥胖';
}

export function dayKcal(profile: Pick<Profile, 'sex' | 'height_cm' | 'weight_kg' | 'age' | 'activity' | 'goal'>): number {
  const basal = bmr(profile.sex, profile.weight_kg, profile.height_cm, profile.age);
  const goal = profile.goal;
  let kcal = basal * ACTIVITY_FACTOR[profile.activity] * GOAL_FACTOR[goal];
  // lose 的减幅下限：不低于 BMR×1.05
  if (goal === 'lose') kcal = Math.max(kcal, basal * 1.05);
  return Math.round(kcal);
}

/** 全日宏量目标：蛋白按 g/kg，脂肪按目标占比（减肥 25%，其余 27%），碳水吃余量（下限 60g） */
export function dayMacros(
  dayKcalValue: number,
  weightKg: number,
  goal: Goal,
): { protein_g: number; fat_g: number; carbs_g: number } {
  const protein_g = PROTEIN_PER_KG[goal] * weightKg;
  const fat_g = (dayKcalValue * FAT_ENERGY_RATIO[goal]) / 9;
  const remainder = dayKcalValue - protein_g * 4 - fat_g * 9;
  return { protein_g, fat_g, carbs_g: Math.max(remainder / 4, CARBS_MIN_G) };
}

/** 本餐目标：全日宏量 × 餐次占比；钠为参考线，不按占比切 */
export function mealTarget(profile: Profile, meal: Meal): MealTarget {
  const day_kcal = dayKcal(profile);
  const macros = dayMacros(day_kcal, profile.weight_kg, profile.goal);
  const ratio = MEAL_RATIO[meal];
  return {
    day_kcal,
    kcal: Math.round(day_kcal * ratio),
    protein_g: Math.round(macros.protein_g * ratio),
    fat_g: Math.round(macros.fat_g * ratio),
    carbs_g: Math.round(macros.carbs_g * ratio),
    sodium_mg: MEAL_SODIUM_REF_MG,
    meal_ratio: ratio,
  };
}

export interface ScaledNutrition {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  sodium_mg: number;
}

/** 按份数放大单份营养，合计口径：热量取整，宏量保留 1 位小数 */
export function scale(nutrition: ScaledNutrition, servings: number): ScaledNutrition {
  return {
    kcal: nutrition.kcal * servings,
    protein_g: nutrition.protein_g * servings,
    fat_g: nutrition.fat_g * servings,
    carbs_g: nutrition.carbs_g * servings,
    sodium_mg: nutrition.sodium_mg * servings,
  };
}

export function sumNutrition(list: ScaledNutrition[]): ScaledNutrition {
  const total = list.reduce(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      protein_g: acc.protein_g + item.protein_g,
      fat_g: acc.fat_g + item.fat_g,
      carbs_g: acc.carbs_g + item.carbs_g,
      sodium_mg: acc.sodium_mg + item.sodium_mg,
    }),
    { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, sodium_mg: 0 } as ScaledNutrition,
  );
  return {
    kcal: Math.round(total.kcal),
    protein_g: round1(total.protein_g),
    fat_g: round1(total.fat_g),
    carbs_g: round1(total.carbs_g),
    sodium_mg: Math.round(total.sodium_mg),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
