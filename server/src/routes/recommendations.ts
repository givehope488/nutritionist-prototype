import { Router } from 'express';
import type { DishTag, Goal, Meal, ProfileInput, RecommendationResponse } from '@canteen/shared';
import { AVOID_OPTIONS } from '../data/avoid-options';
import { getDishesByMeal } from '../data/dishes';
import { profileRepository } from '../data/repositories';
import { calcTargets } from '../engines/nutrition';
import { recommendCombos } from '../engines/recommend';
import { bodyObject, invalid, optionalEnum, requireEnum, requireString } from '../http/validation';

const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner'];
const GOALS: readonly Goal[] = ['health', 'lose', 'gain'];
const AVOID_KEYS: readonly string[] = AVOID_OPTIONS.map((option) => option.key);

/** avoid key → 排除的菜品标签（与 data/recommendations 旧 Mock 同源，现由引擎统一消费） */
const AVOID_TO_TAG = new Map<string, DishTag>(
  AVOID_OPTIONS.map((option) => [option.key, option.excludes_tag]),
);

export const recommendationsRouter: Router = Router();

/**
 * POST /api/v1/recommendations （API.md §2.3）
 *
 * overrides 只覆盖本次请求、不落库；缺省用档案值；档案不存在时按「保健 + 默认体征」兜底
 * （契约允许请求内联档案，见 §2.3 的说明）。
 *
 * BE-A 引擎接入点（PROGRESS W2）：target 由 calcTargets 计算、combos 由 recommendCombos
 * 按附录 B 评分产出，取代原先的 Mock。
 */
recommendationsRouter.post('/', (req, res) => {
  const body = bodyObject(req);

  const sessionId = requireString(body, 'session_id', 'session_id', 64);
  const meal = requireEnum(body, 'meal', 'meal', MEALS);

  let overrideGoal: Goal | undefined;
  let overrideAvoid: string[] | undefined;

  if (body.overrides !== undefined) {
    const overrides = body.overrides;
    if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) {
      invalid([{ path: 'overrides', issue: '必须是对象' }]);
    }
    const record = overrides as Record<string, unknown>;
    overrideGoal = optionalEnum(record, 'goal', 'overrides.goal', GOALS);
    if (record.avoid !== undefined) {
      if (!Array.isArray(record.avoid)) {
        invalid([{ path: 'overrides.avoid', issue: '必须是字符串数组' }]);
      }
      record.avoid.forEach((item, index) => {
        if (typeof item !== 'string' || !AVOID_KEYS.includes(item)) {
          invalid([{ path: `overrides.avoid[${index}]`, issue: `未知取值 ${String(item)}` }]);
        }
      });
      overrideAvoid = record.avoid as string[];
    }
  }

  const profile = profileRepository.find(sessionId);
  const avoid = overrideAvoid ?? profile?.avoid ?? [];
  const goal: Goal = overrideGoal ?? profile?.goal ?? 'health';

  // 档案缺失时给一份「保健 + 默认体征」兜底，保证 target 与 combos 仍有数可算
  const input: ProfileInput = {
    session_id: sessionId,
    sex: profile?.sex ?? 'male',
    height_cm: profile?.height_cm ?? 170,
    weight_kg: profile?.weight_kg ?? 65,
    age: profile?.age ?? 30,
    activity: profile?.activity ?? 'mid',
    goal,
    avoid,
    default_meal: profile?.default_meal ?? meal,
  };

  // BE-A 引擎：营养目标（target 来源唯一）
  const { mealTargets } = calcTargets(input);
  const target = mealTargets[meal];

  // avoid key → 菜品标签，交由推荐引擎过滤
  const avoidTags: DishTag[] = avoid
    .map((key) => AVOID_TO_TAG.get(key))
    .filter((tag): tag is DishTag => tag !== undefined);

  const dishes = getDishesByMeal(meal, false);
  const { combos, notice } = recommendCombos(dishes, { meal, goal, avoidTags, target });

  const response: RecommendationResponse = { target, combos, notice };
  res.json(response);
});
