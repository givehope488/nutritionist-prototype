// 展示用文案与排序，不属于接口契约（契约在 @canteen/shared）。
// 放这里而不是 shared/：同一份契约服务端不需要中文餐次名，混进契约会让 shared 变成 UI 配置。
import type { Category, Goal, Meal } from '@canteen/shared';

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

/** 四档饮食目标（API.md v1.2.9 §2.2）：顺序即建档 / 目标页 / 个人中心的展示顺序 */
export const GOAL_LABEL: Record<Goal, string> = {
  health: '保持',
  lose: '减肥',
  gain: '增肌',
  weight_gain: '增重',
};

export const GOAL_OPTIONS: { value: Goal; label: string; hint: string }[] = [
  { value: 'health', label: '保持', hint: '维持体重，吃得均衡就好' },
  { value: 'lose', label: '减肥', hint: '留出热量缺口，脂肪占比更低' },
  { value: 'gain', label: '增肌', hint: '小幅热量盈余，优先高蛋白' },
  { value: 'weight_gain', label: '增重', hint: '提高总能量，体重稳步上升' },
];

/** API.md §2.4 date 字段格式；服务端为最终判定，前端只做预校验 */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
