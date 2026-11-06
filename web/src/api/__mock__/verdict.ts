// 回填判定替身：level 枚举与判定归属服务端（API.md §2.4），视图层禁止 import 本目录。
import type { ComboTotals, MealTarget, Verdict } from '@shared/types';

const KCAL_OK_BAND = 0.1;
const PROTEIN_OK_RATIO = 0.9;

type TargetPair = Pick<MealTarget, 'kcal' | 'protein_g'>;

export function verdictOf(totals: ComboTotals, target: TargetPair, mealLabel: string): Verdict {
  const diff = totals.kcal - target.kcal;
  const ratio = target.kcal > 0 ? diff / target.kcal : 0;
  const proteinShortfall = totals.protein_g < target.protein_g * PROTEIN_OK_RATIO;
  const withinBand = Math.abs(ratio) <= KCAL_OK_BAND;

  if (withinBand && !proteinShortfall) {
    return {
      level: 'ok',
      title: '吃得挺准',
      body: `这一餐 ${totals.kcal} kcal，和${mealLabel}目标只差 ${Math.abs(diff)} kcal；蛋白质 ${totals.protein_g} g 也够。保持这个节奏就行。`,
    };
  }
  if (diff > 0) {
    return {
      level: 'warn',
      title: '这餐超了不少',
      body: `这一餐 ${totals.kcal} kcal，比${mealLabel}目标 ${target.kcal} kcal 多了 ${diff} kcal。下一餐可以少一点主食或把汤里的油撇掉。`,
    };
  }
  if (proteinShortfall) {
    return {
      level: 'warn',
      title: '蛋白质没跟上',
      body: `这一餐蛋白质 ${totals.protein_g} g，低于${mealLabel}目标 ${target.protein_g} g。可以加一个蛋、一份豆腐或换点瘦肉。`,
    };
  }
  return {
    level: 'warn',
    title: '这餐吃得有点少',
    body: `这一餐 ${totals.kcal} kcal，比${mealLabel}目标 ${target.kcal} kcal 少了 ${-diff} kcal。下午饿的话可以加个水果。`,
  };
}
