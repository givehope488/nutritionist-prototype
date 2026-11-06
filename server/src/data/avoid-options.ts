import type { AvoidOption } from '@canteen/shared';

/**
 * 忌口选项由服务端唯一下发（API.md §2.1），前端不硬编码。
 *
 * TODO(BE-A / PD)：key 与 label 的措辞需按杭电绍兴校区食堂实际场景确认后冻结，
 * 当前列表由 API.md §2.1 的 tags 枚举反推而来，属于待评审草案。
 */
export const AVOID_OPTIONS: AvoidOption[] = [
  { key: 'nospicy', label: '不吃辣', excludes_tag: 'spicy' },
  { key: 'nopork', label: '不吃猪肉', excludes_tag: 'pork' },
  { key: 'nobeef', label: '不吃牛肉', excludes_tag: 'beef' },
  { key: 'noseafood', label: '不吃海鲜', excludes_tag: 'seafood' },
  { key: 'noegg', label: '不吃鸡蛋', excludes_tag: 'egg' },
  { key: 'nomilk', label: '不吃奶制品', excludes_tag: 'milk' },
  { key: 'nopeanut', label: '不吃花生', excludes_tag: 'peanut' },
  { key: 'nomeat', label: '素食', excludes_tag: 'meat' },
];
