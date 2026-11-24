import type {
  AdoptedComboSnapshot,
  MealLogItem,
  MealLogTarget,
  NutritionTotals,
  PricingMode,
  Verdict,
} from '@canteen/shared';

/**
 * 用餐记录的判定规则（W2 #4，PD 2026-11-17 裁决策略 B「快照逐菜比对」）。
 *
 * 为什么要单独一层：以前 `adopted = adopted_combo_id !== null` 把「预填后改了菜」
 * 也算成采纳，采纳率虚高；判定规则和 HTTP 解析混在路由里也没法单独测。
 * 现在这里只放**纯函数**，路由只负责解析与落库。
 */

/** 达标阈值：与本餐目标相差 10% 以内算准（API.md §2.4） */
export const ON_TARGET_TOLERANCE = 0.1;

/** 称重菜的份量容差：±15%（PD 裁决细则 ②） */
export const WEIGH_SERVINGS_TOLERANCE = 0.15;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * 判定达标与判语（API.md §2.4）。
 *
 * `gap` 必须 round1：引擎给出的目标带小数（如 937.6），直接相减会算出
 * `107.60000000000002` 这种尾巴，而它会被原样拼进 `verdict.body` 直出给用户。
 */
/**
 * 判定只看热量与蛋白：v1.2.6 起 `target` 已带六项，但把入参收窄成两项，
 * 免得调用方为了过类型检查去凑脂肪/碳水/钠——那三项不参与判定。
 */
export function judgeVerdict(
  totals: NutritionTotals,
  target: Pick<MealLogTarget, 'kcal' | 'protein_g'>,
): Verdict {
  const gap = round1(Math.abs(totals.kcal - target.kcal));
  const isOnTarget = target.kcal > 0 && gap / target.kcal <= ON_TARGET_TOLERANCE;

  return isOnTarget
    ? {
        level: 'ok',
        title: '吃得挺准',
        body: `这一餐 ${totals.kcal} kcal，和本餐目标 ${target.kcal} kcal 相差 ${gap} kcal。`,
      }
    : {
        level: 'warn',
        title: '偏离目标较多',
        body: `这一餐 ${totals.kcal} kcal，目标 ${target.kcal} kcal，相差 ${gap} kcal，下一餐可以调整一下。`,
      };
}

export interface AdoptionInput {
  /** 被采纳组合的快照；`null` 表示用户没带推荐（自选） */
  snapshot: AdoptedComboSnapshot | null;
  /** 用户实际吃的菜 */
  actualItems: MealLogItem[];
  /** 某道菜的结算方式；缺失按 `fixed` 处理（与 `Dish.pricing_mode` 的缺省语义一致） */
  pricingModeOf: (dishId: string) => PricingMode;
}

export interface AdoptionJudgement {
  adopted: boolean;
  /** 判定依据，便于排查与测试断言（不进接口响应） */
  reason: string;
}

/**
 * 判定「这次回填是不是真的按推荐那套吃的」。
 *
 * 规则（PD 2026-11-17 裁决细则 ②）：
 * 1. 没有快照 → `false`（自选；`adopted_combo_id` 单独存在视为非法，路由层已 400）
 * 2. **菜集合必须完全一致**（多一道、少一道、换一道都不算采纳）
 * 3. `fixed` 菜：只看集合，不比份量——没多吃/少吃/换菜就是吃了那套
 * 4. `weigh` 菜：实际份量须在推荐份量 **±15%** 以内（称重现场定，允许称量误差）
 */
export function judgeAdoption(input: AdoptionInput): AdoptionJudgement {
  const { snapshot, actualItems, pricingModeOf } = input;
  if (snapshot === null) return { adopted: false, reason: '自选：没有组合快照' };

  const actualById = new Map(actualItems.map((item) => [item.dish_id, item.servings]));
  const recommendedById = new Map(snapshot.items.map((item) => [item.dish_id, item.servings]));

  if (actualById.size !== recommendedById.size) {
    return { adopted: false, reason: `菜数不一致：推荐 ${recommendedById.size}，实际 ${actualById.size}` };
  }
  for (const dishId of recommendedById.keys()) {
    if (!actualById.has(dishId)) {
      return { adopted: false, reason: `换了菜：${dishId} 不在实际菜品里` };
    }
  }

  for (const [dishId, recommended] of recommendedById) {
    if (pricingModeOf(dishId) !== 'weigh') continue; // fixed：不比份量
    const actual = actualById.get(dishId) ?? 0;
    if (recommended <= 0) continue;
    const deviation = Math.abs(actual - recommended) / recommended;
    if (deviation > WEIGH_SERVINGS_TOLERANCE) {
      return {
        adopted: false,
        reason: `称重菜 ${dishId} 份量偏离 ${(deviation * 100).toFixed(0)}%，超出 ±15%`,
      };
    }
  }

  return { adopted: true, reason: '菜集合一致，称重菜份量在容差内' };
}
