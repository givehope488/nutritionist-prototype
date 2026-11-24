import { Router } from 'express';
import { MAX_SERVINGS, SERVING_STEP } from '@canteen/shared';
import type {
  AdoptedComboSnapshot,
  Meal,
  MealLogItem,
  MealLogItemInput,
  MealLogListResponse,
  MealLogResponse,
  NutritionTotals,
  ProfileInput,
} from '@canteen/shared';
import { getAllDishes } from '../data/dishes';
import { profileRepository } from '../data/repositories';
import { mealLogRepository } from '../data/repositories';
import { calcTargets } from '../engines/nutrition';
import { judgeAdoption, judgeVerdict } from '../services/meallog';
import {
  bodyObject,
  invalid,
  queryDate,
  queryInt,
  queryString,
  requireEnum,
  requireNumber,
  requireString,
} from '../http/validation';

const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner'];
const MAX_ITEMS = 20;

function parseItems(raw: unknown): MealLogItemInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    invalid([{ path: 'items', issue: '至少要有一道菜' }]);
  }
  if (raw.length > MAX_ITEMS) {
    invalid([{ path: 'items', issue: `最多 ${MAX_ITEMS} 道菜` }]);
  }

  return raw.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      invalid([{ path: `items[${index}]`, issue: '必须是对象' }]);
    }
    const record = item as Record<string, unknown>;
    const dishId = requireString(record, 'dish_id', `items[${index}].dish_id`, 64);
    const servings = requireNumber(record, 'servings', `items[${index}].servings`, {
      min: SERVING_STEP,
      max: MAX_SERVINGS,
    });
    // 份数必须落在 0.5 的步进上（shared 的 SERVING_STEP / MAX_SERVINGS，API.md §2.4）
    if (!Number.isInteger(Math.round((servings / SERVING_STEP) * 1000) / 1000)) {
      invalid([{ path: `items[${index}].servings`, issue: `须按 ${SERVING_STEP} 步进` }]);
    }
    return { dish_id: dishId, servings };
  });
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * 解析「被采纳组合的快照」（API v1.2.5，PD 2026-11-17 裁决策略 B）。
 *
 * 约束：**带 `adopted_combo_id` 必带快照**（否则 400）——不允许「只带 id 不带证据」，
 * 否则服务端无法判断用户是不是真的照那套吃的。反之，没有 id 却带快照也是调用方写错，
 * 一并 400，避免留下没人认领的数据。
 */
function parseAdoptedCombo(
  body: Record<string, unknown>,
  adoptedComboId: string | null,
): AdoptedComboSnapshot | null {
  const raw = body.adopted_combo;
  const hasSnapshot = raw !== undefined && raw !== null;

  if (adoptedComboId === null) {
    if (hasSnapshot) {
      invalid([{ path: 'adopted_combo', issue: '没有 adopted_combo_id 时不应携带快照' }]);
    }
    return null;
  }
  if (!hasSnapshot) {
    invalid([{ path: 'adopted_combo', issue: '带 adopted_combo_id 时必须携带组合快照' }]);
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    invalid([{ path: 'adopted_combo', issue: '必须是对象' }]);
  }

  const record = raw as Record<string, unknown>;
  const snapshotId = requireString(record, 'id', 'adopted_combo.id', 64);
  if (snapshotId !== adoptedComboId) {
    invalid([{ path: 'adopted_combo.id', issue: '必须与 adopted_combo_id 一致' }]);
  }
  return { id: snapshotId, items: parseItems(record.items) };
}

export const mealLogsRouter: Router = Router();

/**
 * POST /api/v1/meal-logs （API.md §2.4）
 * 幂等：以请求体 id（客户端 UUID）为键，重复提交返回首次结果 + duplicate:true。
 */
mealLogsRouter.post('/', (req, res) => {
  const body = bodyObject(req);

  const id = requireString(body, 'id', 'id', 64);
  const sessionId = requireString(body, 'session_id', 'session_id', 64);
  const date = requireString(body, 'date', 'date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    invalid([{ path: 'date', issue: '日期格式须为 YYYY-MM-DD' }]);
  }
  const meal = requireEnum(body, 'meal', 'meal', MEALS);
  const items = parseItems(body.items);

  const adoptedComboId =
    body.adopted_combo_id === undefined || body.adopted_combo_id === null
      ? null
      : requireString(body, 'adopted_combo_id', 'adopted_combo_id', 64);
  const adoptedCombo = parseAdoptedCombo(body, adoptedComboId);

  const existing = mealLogRepository.find(id);
  if (existing !== undefined) {
    res.json({ ...existing, duplicate: true } satisfies MealLogResponse);
    return;
  }

  // 解析菜品并累加营养值（数据聚合，不是营养公式）
  const dishesById = new Map(getAllDishes().map((dish) => [dish.id, dish]));
  const fields: Array<{ path: string; issue: string }> = [];
  const resolvedItems: MealLogItem[] = [];
  let kcal = 0;
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let sodium = 0;

  items.forEach((item, index) => {
    const dish = dishesById.get(item.dish_id);
    if (dish === undefined) {
      fields.push({ path: `items[${index}].dish_id`, issue: `菜品不存在: ${item.dish_id}` });
      return;
    }
    resolvedItems.push({ dish_id: dish.id, name: dish.name, servings: item.servings });
    kcal += dish.kcal * item.servings;
    protein += dish.protein_g * item.servings;
    fat += dish.fat_g * item.servings;
    carbs += dish.carbs_g * item.servings;
    sodium += dish.sodium_mg * item.servings;
  });

  if (fields.length > 0) {
    invalid(fields);
  }

  const totals: NutritionTotals = {
    kcal: Math.round(kcal),
    protein_g: round1(protein),
    fat_g: round1(fat),
    carbs_g: round1(carbs),
    sodium_mg: Math.round(sodium),
  };

  /**
   * 本餐目标改由真实引擎计算（PROGRESS §2.1 BE-B 第 3 条，硬约束「#23 合并前完成」）。
   *
   * 口径与 `routes/recommendations.ts` 保持一致：档案存在就用档案，
   * 缺失时给一份保守默认体征，保证回填永远有目标可比，不会因为没建档就 500。
   */
  const profile = profileRepository.find(sessionId);
  const targetInput: ProfileInput = {
    session_id: sessionId,
    sex: profile?.sex ?? 'male',
    height_cm: profile?.height_cm ?? 170,
    weight_kg: profile?.weight_kg ?? 65,
    age: profile?.age ?? 30,
    activity: profile?.activity ?? 'mid',
    goal: profile?.goal ?? 'health',
    avoid: profile?.avoid ?? [],
    default_meal: profile?.default_meal ?? meal,
  };
  const mealTarget = calcTargets(targetInput).mealTargets[meal];

  /**
   * 判定规则已收敛到 `services/meallog.ts`（W2 #4）：
   * - `judgeVerdict`：达标阈值 10% + 判语文案（gap 必须 round1，见该函数注释）
   * - `judgeAdoption`：PD 2026-11-17 裁决策略 B「快照逐菜比对」
   */
  const target: MealLogResponse['target'] = {
    kcal: mealTarget.kcal,
    protein_g: mealTarget.protein_g,
    // v1.2.6：六项一起下发，反馈页的脂肪/碳水/钠才有目标可比（判定仍只用前两项）
    fat_g: mealTarget.fat_g,
    carbs_g: mealTarget.carbs_g,
    sodium_mg: mealTarget.sodium_mg,
  };
  const verdict = judgeVerdict(totals, target);
  const judgement = judgeAdoption({
    snapshot: adoptedCombo,
    actualItems: resolvedItems,
    // 缺省 fixed：与 `Dish.pricing_mode` 的可选语义一致（老种子没有这个键）
    pricingModeOf: (dishId) => dishesById.get(dishId)?.pricing_mode ?? 'fixed',
  });

  const log: MealLogResponse = {
    id,
    duplicate: false,
    date,
    meal,
    items: resolvedItems,
    totals,
    target,
    verdict,
    adopted: judgement.adopted,
  };

  mealLogRepository.save(sessionId, log, adoptedCombo);
  res.json(log);
});

/**
 * GET /api/v1/meal-logs?session_id=&from=&to=&page=&page_size= （API.md §2.5）
 */
mealLogsRouter.get('/', (req, res) => {
  const sessionId = queryString(req.query, 'session_id');
  const from = queryDate(req.query, 'from');
  const to = queryDate(req.query, 'to');
  const page = queryInt(req.query, 'page', 1, { min: 1 });
  const pageSize = queryInt(req.query, 'page_size', 20, { min: 1, max: 100 });

  const matched = mealLogRepository
    .listBySession(sessionId)
    .filter((log) => (from === undefined ? true : log.date >= from))
    .filter((log) => (to === undefined ? true : log.date <= to));

  const start = (page - 1) * pageSize;
  const response: MealLogListResponse = {
    total: matched.length,
    page,
    logs: matched.slice(start, start + pageSize),
  };
  res.json(response);
});
