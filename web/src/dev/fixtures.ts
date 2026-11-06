// 组件故事页用的展示样例：结构与 API.md 响应一致，数值为手写占位（不做任何计算）。
import type { Combo, ComboTotals, Dish, MealLog, MealTarget, Profile } from '@shared/types';

export const sampleDishA: Dish = {
  id: 's01',
  name: '白米饭',
  category: 'staple',
  portion_label: '200g',
  meals: ['lunch', 'dinner'],
  kcal: 232,
  protein_g: 4.4,
  fat_g: 0.6,
  carbs_g: 51.6,
  sodium_mg: 2,
  price_yuan: 1,
  tags: [],
  drink: false,
  reliability: 'A',
  status: 'active',
};

export const sampleDishB: Dish = {
  ...sampleDishA,
  id: 'm08',
  name: '白切鸡',
  category: 'protein',
  portion_label: '120g',
  kcal: 190,
  protein_g: 22,
  fat_g: 10,
  carbs_g: 0,
  sodium_mg: 450,
  price_yuan: 9,
  tags: ['meat'],
  reliability: 'B',
};

export const sampleDishDrink: Dish = {
  ...sampleDishB,
  id: 'b04',
  name: '牛奶',
  kcal: 130,
  protein_g: 8,
  fat_g: 7,
  carbs_g: 6,
  sodium_mg: 100,
  price_yuan: 3,
  tags: ['milk', 'vegprotein'],
  drink: true,
  meals: ['breakfast'],
  portion_label: '250ml',
};

export const sampleTarget: MealTarget = {
  day_kcal: 2282,
  kcal: 913,
  protein_g: 37,
  fat_g: 27,
  carbs_g: 114,
  sodium_mg: 1600,
  meal_ratio: 0.4,
};

const totals: ComboTotals = {
  kcal: 872,
  protein_g: 40,
  fat_g: 23,
  carbs_g: 103,
  sodium_mg: 1440,
};

export const sampleCombo: Combo = {
  id: 'c9f31a02',
  dishes: [
    {
      id: 's01',
      name: '白米饭',
      category: 'staple',
      portion_label: '200g',
      servings: 1,
      kcal: 232,
      protein_g: 4.4,
      fat_g: 0.6,
      carbs_g: 51.6,
      sodium_mg: 2,
    },
    {
      id: 'm08',
      name: '白切鸡',
      category: 'protein',
      portion_label: '120g',
      servings: 1,
      kcal: 190,
      protein_g: 22,
      fat_g: 10,
      carbs_g: 0,
      sodium_mg: 450,
    },
    {
      id: 'v01',
      name: '清炒时蔬',
      category: 'veg',
      portion_label: '150g',
      servings: 1.5,
      kcal: 105,
      protein_g: 3,
      fat_g: 7.5,
      carbs_g: 4,
      sodium_mg: 600,
    },
    {
      id: 't01',
      name: '番茄蛋汤',
      category: 'soup',
      portion_label: '一碗',
      servings: 1,
      kcal: 60,
      protein_g: 3,
      fat_g: 3,
      carbs_g: 3,
      sodium_mg: 500,
    },
  ],
  totals,
  reason:
    '这一餐约 872 kcal，比午餐目标 913 kcal 少了 41 kcal；蛋白质 40 g 达到本餐目标 37 g；钠 1440 mg 在参考线内。搭配为白米饭、白切鸡、清炒时蔬、番茄蛋汤。',
  engine: 'template',
};

export const sampleMealLog: MealLog = {
  id: 'b7e2-client-uuid-0001',
  duplicate: false,
  date: '2026-11-04',
  meal: 'lunch',
  items: [
    { dish_id: 's01', name: '白米饭', servings: 1 },
    { dish_id: 'm08', name: '白切鸡', servings: 1 },
    { dish_id: 'v01', name: '清炒时蔬', servings: 1.5 },
  ],
  totals,
  target: { kcal: 913, protein_g: 37 },
  verdict: {
    level: 'ok',
    title: '吃得挺准',
    body: '这一餐 872 kcal，和午餐目标只差 41 kcal；蛋白质 40 g 也够。保持这个节奏就行。',
  },
  adopted: true,
};

export const sampleProfile: Profile = {
  session_id: '3f2b1c-devdemo',
  sex: 'male',
  height_cm: 172,
  weight_kg: 65,
  age: 20,
  activity: 'mid',
  goal: 'health',
  avoid: ['nospicy'],
  default_meal: 'lunch',
  bmi: 21.97,
  bmi_tag: '正常',
  day_kcal: 2282,
  warnings: [],
};
