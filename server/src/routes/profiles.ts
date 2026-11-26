import { Router } from 'express';
import { PROFILE_BOUNDS } from '@canteen/shared';
import type { Activity, Goal, Meal, Sex } from '@canteen/shared';
import { AVOID_OPTIONS } from '../data/avoid-options';
import { profileRepository } from '../data/repositories';
import { calcTargets } from '../engines/nutrition';
import { HttpError } from '../http/errors';
import {
  bodyObject,
  queryString,
  requireEnum,
  requireNumber,
  requireString,
  requireStringArray,
} from '../http/validation';

const SEXES: readonly Sex[] = ['male', 'female'];
const ACTIVITIES: readonly Activity[] = ['low', 'mid', 'high'];
const GOALS: readonly Goal[] = ['health', 'lose', 'gain', 'weight_gain'];
const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner'];
const AVOID_KEYS: readonly string[] = AVOID_OPTIONS.map((option) => option.key);

export const profilesRouter: Router = Router();

/**
 * POST /api/v1/profiles —— upsert，以 session_id 为键（API.md §2.2）
 */
profilesRouter.post('/', (req, res) => {
  const body = bodyObject(req);

  const sessionId = requireString(body, 'session_id', 'session_id', 64);
  const sex = requireEnum(body, 'sex', 'sex', SEXES);
  const heightCm = requireNumber(body, 'height_cm', 'height_cm', PROFILE_BOUNDS.height_cm);
  const weightKg = requireNumber(body, 'weight_kg', 'weight_kg', PROFILE_BOUNDS.weight_kg);
  const age = requireNumber(body, 'age', 'age', { ...PROFILE_BOUNDS.age, integer: true });
  const activity = requireEnum(body, 'activity', 'activity', ACTIVITIES);
  const requestedGoal = requireEnum(body, 'goal', 'goal', GOALS);
  const avoid = requireStringArray(body, 'avoid', 'avoid', AVOID_KEYS);
  const defaultMeal = requireEnum(body, 'default_meal', 'default_meal', MEALS);

  // 目标降级（未成年 / BMI<18.5 禁热量缺口）、BMI 分级与 warnings 全部由营养引擎派生，
  // 路由只透传入参、落库并回传，避免同一合规规则在两层各写一遍（规则 I）。
  const { profile } = calcTargets({
    session_id: sessionId,
    sex,
    height_cm: heightCm,
    weight_kg: weightKg,
    age,
    activity,
    goal: requestedGoal,
    avoid,
    default_meal: defaultMeal,
  });

  profileRepository.save(profile);
  res.json(profile);
});

/**
 * GET /api/v1/profiles/me?session_id=... （API.md §2.2）
 */
profilesRouter.get('/me', (req, res) => {
  const sessionId = queryString(req.query, 'session_id');
  const profile = profileRepository.find(sessionId);
  if (profile === undefined) {
    throw new HttpError('NOT_FOUND', '档案不存在');
  }
  res.json(profile);
});

/**
 * DELETE /api/v1/profiles/me?session_id=... （API.md §2.2，v1.2.4 合规删除入口）
 * 删除成功 204（无响应体）；档案不存在 404。
 * 仓储层事务内连带删除该 session 的全部 meal-logs——只删档案不算清干净个人数据。
 */
profilesRouter.delete('/me', (req, res) => {
  const sessionId = queryString(req.query, 'session_id');
  const deleted = profileRepository.deleteBySession(sessionId);
  if (!deleted) {
    throw new HttpError('NOT_FOUND', '档案不存在');
  }
  res.status(204).end();
});
