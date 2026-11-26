/**
 * 忌口选择的互斥规则。
 *
 * 产品口径（2026-11-26）：`nomeat` 的文案从「素食」改为「不吃荤」，
 * 它是「不吃猪肉 / 不吃牛肉 / 不吃海鲜」的**超集**（`excludes_tag: meat` 覆盖这三类的 tag，
 * 见 API.md 附录 D 的硬约束「带 pork/beef/seafood 的菜必须同时带 meat」）。
 *
 * 所以：
 * - 勾了「不吃荤」→ 三个具体荤菜项置灰，不可再勾；
 * - 先勾了具体项、再勾「不吃荤」→ 把具体项清掉，避免出现「不吃荤 + 不吃猪肉」这种冗余状态；
 * - 取消「不吃荤」→ 三个具体项恢复可选。
 *
 * 抽成纯函数是为了能单测：组件里只保留一行调用。
 */

/** 「不吃荤」的 key（服务端下发，API.md 附录 D） */
export const MEAT_FREE_KEY = 'nomeat';

/** 被「不吃荤」覆盖的具体荤菜项 */
export const MEAT_SPECIFIC_KEYS = ['nopork', 'nobeef', 'noseafood'] as const;

const MEAT_SPECIFIC_SET: ReadonlySet<string> = new Set(MEAT_SPECIFIC_KEYS);

/** 当前选择下，这一项是否应该置灰 */
export function isAvoidDisabled(selected: readonly string[], key: string): boolean {
  return key !== MEAT_FREE_KEY && selected.includes(MEAT_FREE_KEY) && MEAT_SPECIFIC_SET.has(key);
}

/**
 * 点击一个忌口项后的新选择。
 *
 * 注意：置灰的项传进来也按「不处理」对待（组件禁用按钮是双保险，这里再兜一层）。
 */
export function toggleAvoidKey(selected: readonly string[], key: string): string[] {
  if (isAvoidDisabled(selected, key)) return [...selected];

  if (selected.includes(key)) {
    return selected.filter((item) => item !== key);
  }

  if (key === MEAT_FREE_KEY) {
    // 勾「不吃荤」时清掉被它覆盖的具体项
    return [...selected.filter((item) => !MEAT_SPECIFIC_SET.has(item)), key];
  }

  return [...selected, key];
}
