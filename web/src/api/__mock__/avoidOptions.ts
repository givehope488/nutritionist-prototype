// 忌口选项：契约规定由服务端下发，避免前后端硬编码两份（API.md §2.1）。
// BE-B 实装后此文件随 __mock__ 目录一起删除；key 与 excludes_tag 是前后端约定的取值，勿随意改名。
import type { AvoidOption } from '@shared/types';

export const AVOID_OPTIONS: AvoidOption[] = [
  { key: 'nopork', label: '不吃猪肉', excludes_tag: 'pork' },
  { key: 'nobeef', label: '不吃牛肉', excludes_tag: 'beef' },
  { key: 'noseafood', label: '不吃海鲜', excludes_tag: 'seafood' },
  { key: 'noegg', label: '不吃蛋', excludes_tag: 'egg' },
  { key: 'nomilk', label: '不吃奶制品', excludes_tag: 'milk' },
  { key: 'nogluten', label: '不吃面食/麸质', excludes_tag: 'gluten' },
  { key: 'nopeanut', label: '不吃花生', excludes_tag: 'peanut' },
  { key: 'nospicy', label: '不吃辣', excludes_tag: 'spicy' },
  { key: 'vegan', label: '素食（不吃肉）', excludes_tag: 'meat' },
];

export const AVOID_TAG_MAP: Record<string, AvoidOption['excludes_tag']> = Object.fromEntries(
  AVOID_OPTIONS.map((option) => [option.key, option.excludes_tag]),
);

export function isKnownAvoidKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(AVOID_TAG_MAP, key);
}
