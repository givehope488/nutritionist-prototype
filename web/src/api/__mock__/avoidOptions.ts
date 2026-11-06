// 忌口选项：契约规定由服务端下发，避免前后端硬编码两份（API.md §2.1）。
// 内容逐行对齐 API.md 附录 D（v1.2 起的唯一事实源），顺序也一致；
// avoidOptionsContract.test.ts 会解析附录 D 与这里比对，漂移即红。
// BE-B 实装后此文件随 __mock__ 目录一起删除。
import type { AvoidOption } from '@canteen/shared';

export const AVOID_OPTIONS: AvoidOption[] = [
  { key: 'nospicy', label: '不吃辣', excludes_tag: 'spicy' },
  { key: 'nopork', label: '不吃猪肉', excludes_tag: 'pork' },
  { key: 'nobeef', label: '不吃牛肉', excludes_tag: 'beef' },
  { key: 'noseafood', label: '不吃海鲜', excludes_tag: 'seafood' },
  { key: 'noegg', label: '不吃鸡蛋', excludes_tag: 'egg' },
  { key: 'nomilk', label: '不吃奶制品', excludes_tag: 'milk' },
  { key: 'nopeanut', label: '不吃花生', excludes_tag: 'peanut' },
  { key: 'nogluten', label: '不吃麸质（小麦制品）', excludes_tag: 'gluten' },
  { key: 'nomeat', label: '素食', excludes_tag: 'meat' },
];

export const AVOID_TAG_MAP: Record<string, AvoidOption['excludes_tag']> = Object.fromEntries(
  AVOID_OPTIONS.map((option) => [option.key, option.excludes_tag]),
);

export function isKnownAvoidKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(AVOID_TAG_MAP, key);
}
