import { Router } from 'express';
import { MAX_SERVINGS, SERVING_STEP } from '@canteen/shared';
import type {
  Meal,
  MealLogItem,
  MealLogItemInput,
  MealLogListResponse,
  MealLogResponse,
  NutritionTotals,
} from '@canteen/shared';
import { getAllDishes } from '../data/dishes';
import { PLACEHOLDER_TARGET } from '../data/recommendations';
import { mealLogRepository } from '../data/repositories';
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
   * TODO(W2 反馈服务)：判定规则属于 services/meallog，这里用「与占位目标差 10% 以内算准」
   * 临时顶替，等引擎给出真实本餐目标后再替换。
   */
  const deviation = Math.abs(totals.kcal - PLACEHOLDER_TARGET.kcal) / PLACEHOLDER_TARGET.kcal;
  const isOnTarget = deviation <= 0.1;
  const gap = Math.abs(totals.kcal - PLACEHOLDER_TARGET.kcal);

  const log: MealLogResponse = {
    id,
    duplicate: false,
    date,
    meal,
    items: resolvedItems,
    totals,
    target: { kcal: PLACEHOLDER_TARGET.kcal, protein_g: PLACEHOLDER_TARGET.protein_g },
    verdict: isOnTarget
      ? {
          level: 'ok',
          title: '吃得挺准',
          body: `这一餐 ${totals.kcal} kcal，和本餐目标 ${PLACEHOLDER_TARGET.kcal} kcal 相差 ${gap} kcal。`,
        }
      : {
          level: 'warn',
          title: '偏离目标较多',
          body: `这一餐 ${totals.kcal} kcal，目标 ${PLACEHOLDER_TARGET.kcal} kcal，相差 ${gap} kcal，下一餐可以调整一下。`,
        },
    // TODO(W2)：combo.id 有效期 24 小时，过期后 adopted 如何判定契约未定义（PROGRESS §6 待决）
    adopted: adoptedComboId !== null,
  };

  mealLogRepository.save(sessionId, log);
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
