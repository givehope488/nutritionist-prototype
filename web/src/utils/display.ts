// 展示层数值格式化：只做取整与单位拼接，不做任何营养口径计算（架构 D1）。
// 对比条的百分比属于「渲染比例」，不是营养数值，统一收敛在这里，便于 Review 时一眼扫完。
import { SERVING_STEP } from '@canteen/shared';

export function formatKcal(value: number): string {
  return `${Math.round(value)} kcal`;
}

export function formatGram(value: number): string {
  return `${roundTo(value, 1)} g`;
}

export function formatSodium(value: number): string {
  return `${Math.round(value)} mg`;
}

export function formatYuan(value: number): string {
  return `¥${value.toFixed(1)}`;
}

/** 对比条填充比例：以目标为满格（100%），超出部分封顶，避免条形溢出轨道 */
export function ratioPercent(actual: number, target: number, cap = 100): number {
  if (target <= 0) return 0;
  const percent = (actual / target) * 100;
  if (!Number.isFinite(percent)) return 0;
  return Math.min(Math.max(percent, 0), cap);
}

/** 份数显示：0.5 份显示「半份」，整数不带小数 */
export function formatServings(servings: number): string {
  if (servings === 0) return '不选';
  if (servings === 0.5) return '半份';
  return Number.isInteger(servings) ? `${servings} 份` : `${roundTo(servings, 1)} 份`;
}

export function clampServings(servings: number): number {
  const stepped = Math.round(servings / SERVING_STEP) * SERVING_STEP;
  return Math.min(Math.max(stepped, 0), 5);
}

export function formatDateLabel(date: string): string {
  const today = toDateStr(new Date());
  if (date === today) return '今天';
  const yesterday = toDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (date === yesterday) return '昨天';
  return date.slice(5).replace('-', '/');
}

export function toDateStr(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
