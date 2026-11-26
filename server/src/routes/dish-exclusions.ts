import { Router } from 'express';
import type { DishExclusionListResponse } from '@canteen/shared';
import { getAllDishes } from '../data/dishes';
import { dishExclusionRepository } from '../data/repositories';
import { HttpError } from '../http/errors';
import { bodyObject, invalid, queryString, requireString } from '../http/validation';

/**
 * 个人排除（API.md v1.2.12 §2.6）。
 *
 * 语义：用户说「以后别再推荐这道菜」，只影响**该 session 的后续推荐候选池**；
 * 不改菜品状态、不影响其他用户，也不动历史记录。
 *
 * 为什么单独建表而不是塞进 profile.avoid：
 * - avoid 是「忌口标签」（荤/辣），语义是全局营养约束；
 * - 排除是「个人偏好」，按菜品 id 生效，且需要单条增删与恢复。
 * 两者混在一起会让档案保存把排除列表整体覆盖掉。
 */
export const dishExclusionsRouter: Router = Router();

function findDish(dishId: string) {
  const dish = getAllDishes().find((item) => item.id === dishId);
  if (dish === undefined) {
    invalid([{ path: 'dish_id', issue: `菜品 ${dishId} 不存在` }]);
  }
  return dish;
}

/** GET /api/v1/dish-exclusions?session_id=... → 该 session 已排除的菜 */
dishExclusionsRouter.get('/', (req, res) => {
  const sessionId = queryString(req.query as Record<string, unknown>, 'session_id');
  const body: DishExclusionListResponse = {
    dishes: dishExclusionRepository.listBySession(sessionId),
  };
  res.json(body);
});

/**
 * POST /api/v1/dish-exclusions —— 加入排除列表。
 * 幂等：已存在时 200（不重复写），新写入时 201。响应都是同一个菜品条目。
 */
dishExclusionsRouter.post('/', (req, res) => {
  const body = bodyObject(req);
  const sessionId = requireString(body, 'session_id', 'session_id', 64);
  const dishId = requireString(body, 'dish_id', 'dish_id', 64);
  const dish = findDish(dishId);
  const created = dishExclusionRepository.add(sessionId, dish.id, dish.name);
  res.status(created ? 201 : 200).json({ dish_id: dish.id, name: dish.name });
});

/** DELETE /api/v1/dish-exclusions/:dish_id?session_id=... —— 恢复推荐 */
dishExclusionsRouter.delete('/:dishId', (req, res) => {
  const sessionId = queryString(req.query as Record<string, unknown>, 'session_id');
  const dishId = String(req.params.dishId ?? '');
  if (!dishExclusionRepository.remove(sessionId, dishId)) {
    throw new HttpError('NOT_FOUND', '这道菜不在你的排除列表里');
  }
  res.status(204).end();
});