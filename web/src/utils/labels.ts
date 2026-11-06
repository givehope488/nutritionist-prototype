// 展示用文案与排序，不属于接口契约（契约在 @canteen/shared）。
// 放这里而不是 shared/：同一份契约服务端不需要中文餐次名，混进契约会让 shared 变成 UI 配置。
import type { Category, Meal } from '@canteen/shared';

export const MEAL_OPTIONS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'dinner', label: '晚餐' },
];

/** API.md §2.1 category 枚举的展示顺序：主食 → 主菜 → 蔬菜 → 汤品 → 水果 */
export const DISH_CATEGORY_ORDER: Category[] = ['staple', 'protein', 'veg', 'soup', 'fruit'];

export const DISH_CATEGORY_LABEL: Record<Category, string> = {
  staple: '主食',
  protein: '主菜',
  veg: '蔬菜',
  soup: '汤品',
  fruit: '水果',
};

/** API.md §2.4 date 字段格式；服务端为最终判定，前端只做预校验 */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
