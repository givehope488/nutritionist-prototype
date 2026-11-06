import { Router } from 'express';
import type { Dish, Meal, MenuResponse } from '@canteen/shared';
import { HttpError } from '../http/errors';
import { getActiveDishes, getDishesByMeal } from '../data/dishes';
import { AVOID_OPTIONS } from '../data/avoid-options';

const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner'];

function isMeal(value: string): value is Meal {
  return (MEALS as readonly string[]).includes(value);
}

export const menuRouter: Router = Router();

/**
 * GET /api/v1/menu?meal=lunch&include_inactive=false
 * 按餐段返回可选菜品与忌口选项（API.md §2.1）。
 * 不带 meal 时返回全部在架菜品，便于前端首屏预取。
 */
menuRouter.get('/', (req, res) => {
  const mealQuery = req.query.meal;
  const includeInactive = req.query.include_inactive === 'true';

  let dishes: Dish[];
  if (mealQuery === undefined) {
    dishes = getActiveDishes(includeInactive);
  } else if (typeof mealQuery === 'string' && isMeal(mealQuery)) {
    dishes = getDishesByMeal(mealQuery, includeInactive);
  } else {
    throw new HttpError('VALIDATION_ERROR', 'meal 取值须为 breakfast / lunch / dinner', [
      { path: 'meal', issue: '取值非法' },
    ]);
  }

  const body: MenuResponse = { dishes, avoid_options: AVOID_OPTIONS };
  res.json(body);
});
