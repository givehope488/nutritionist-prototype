import { Router } from 'express';
import type { Goal, Meal, RecommendationResponse } from '@canteen/shared';
import { AVOID_OPTIONS } from '../data/avoid-options';
import { PLACEHOLDER_TARGET, buildMockRecommendation } from '../data/recommendations';
import { profileStore } from '../data/stores';
import { bodyObject, invalid, optionalEnum, requireEnum, requireString } from '../http/validation';

const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner'];
const GOALS: readonly Goal[] = ['health', 'lose', 'gain'];
const AVOID_KEYS: readonly string[] = AVOID_OPTIONS.map((option) => option.key);

export const recommendationsRouter: Router = Router();

/**
 * POST /api/v1/recommendations （API.md §2.3）
 *
 * overrides 只覆盖本次请求、不落库；缺省用档案值；档案不存在时按「保健 + 无忌口」兜底
 * （契约允许请求内联档案，见 §2.3 的说明）。
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

  const profile = profileStore.get(sessionId);
  const avoid = overrideAvoid ?? profile?.avoid ?? [];

  // goal 目前不参与 Mock 组合（真实评分在引擎里），保留变量以便引擎接入时直接接上
  const goal: Goal = overrideGoal ?? profile?.goal ?? 'health';
  void goal;

  const { combos, notice } = buildMockRecommendation(meal, avoid);

  const response: RecommendationResponse = {
    target: { ...PLACEHOLDER_TARGET },
    combos,
    notice,
  };
  res.json(response);
});
