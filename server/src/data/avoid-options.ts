import type { AvoidOption } from '@canteen/shared';

/**
 * 忌口选项由服务端唯一下发（API.md §2.1），前端不硬编码。
 *
 * **本列表必须与 `docs/API.md` 附录 D「忌口选项全表」逐行一致**，
 * `server/test/contract.test.ts` 会解析附录 D 与本文件比对，不一致 CI 直接红。
 *
 * 注意 `excludes_tag` 是单值：一个 key 只能排除一类标签。
 * 「素食」排的是 `meat`（含鱼虾），不代表纯素；纯素的表达方式见 v1.3 议题。
 */
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
