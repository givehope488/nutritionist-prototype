import { Router } from 'express';
import { MINOR_AGE, PROFILE_BOUNDS } from '@canteen/shared';
import type { Activity, Goal, Meal, Profile, Sex } from '@canteen/shared';
import { AVOID_OPTIONS } from '../data/avoid-options';
import { profileStore } from '../data/stores';
import { PLACEHOLDER_TARGET } from '../data/recommendations';
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
const GOALS: readonly Goal[] = ['health', 'lose', 'gain'];
const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner'];
const AVOID_KEYS: readonly string[] = AVOID_OPTIONS.map((option) => option.key);

/**
 * BMI 与分级：属于档案服务的派生值（API.md §2.2 响应里明确要求下发），
 * 不是营养公式——BMR/TDEE 在 engines/，这边不碰。
 */
function deriveBmi(heightCm: number, weightKg: number): { bmi: number; bmi_tag: string } {
  const meters = heightCm / 100;
  const bmi = Math.round((weightKg / (meters * meters)) * 100) / 100;
  const tag = bmi < 18.5 ? '偏瘦' : bmi < 24 ? '正常' : bmi < 28 ? '超重' : '肥胖';
  return { bmi, bmi_tag: tag };
}

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

  const warnings: string[] = [];
  let goal: Goal = requestedGoal;

  // 合规硬规则（README 合规边界 2）：未成年不提供热量缺口，服务端强制降级。
  // 前端也会禁用减脂选项，这里是双保险——只信服务端这道。
  if (age < MINOR_AGE && goal === 'lose') {
    goal = 'health';
    warnings.push('未满18岁不提供热量缺口方案，已调整为日常保健');
  }

  const { bmi, bmi_tag } = deriveBmi(heightCm, weightKg);

  const profile: Profile = {
    session_id: sessionId,
    sex,
    height_cm: heightCm,
    weight_kg: weightKg,
    age,
    activity,
    goal,
    avoid,
    default_meal: defaultMeal,
    bmi,
    bmi_tag,
    // TODO(W2 引擎就绪)：day_kcal 必须由 engines/calcTarget 计算，这里是占位
    day_kcal: PLACEHOLDER_TARGET.day_kcal,
    warnings,
  };

  profileStore.save(profile);
  res.json(profile);
});

/**
 * GET /api/v1/profiles/me?session_id=... （API.md §2.2）
 */
profilesRouter.get('/me', (req, res) => {
  const sessionId = queryString(req.query, 'session_id');
  const profile = profileStore.get(sessionId);
  if (profile === undefined) {
    throw new HttpError('NOT_FOUND', '档案不存在');
  }
  res.json(profile);
});
