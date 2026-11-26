// 个人排除的状态与读写（API v1.2.12 §2.6）。
// 放在 composables 而不是组件里：组件层禁止直接 import @/api（layerBoundary 护栏），
// 视图/组件只消费这里的响应式状态与 toggle 动作。
import { computed, ref } from 'vue';
import type { DishExclusion } from '@canteen/shared';
import { addDishExclusion, listDishExclusions, removeDishExclusion } from '@/api/endpoints';
import { sessionId } from './useSession';

export interface ExclusionTarget {
  id: string;
  name: string;
}

export function useDishExclusions() {
  const exclusions = ref<DishExclusion[]>([]);
  const busyIds = ref<Set<string>>(new Set());
  const status = ref('');
  const loadError = ref('');

  const excludedIds = computed(() => new Set(exclusions.value.map((item) => item.dish_id)));

  async function reload(): Promise<void> {
    const result = await listDishExclusions(sessionId);
    if (result.ok) {
      exclusions.value = result.data.dishes;
      loadError.value = '';
    } else {
      loadError.value = result.error.message;
    }
  }

  function setBusy(id: string, busy: boolean): void {
    const next = new Set(busyIds.value);
    if (busy) next.add(id);
    else next.delete(id);
    busyIds.value = next;
  }

  /** 返回 true 表示状态确实变了（调用方据此决定是否重新请求推荐） */
  async function toggle(dish: ExclusionTarget): Promise<boolean> {
    if (busyIds.value.has(dish.id)) return false;
    const isExcluded = excludedIds.value.has(dish.id);
    setBusy(dish.id, true);
    status.value = '';
    const result = isExcluded
      ? await removeDishExclusion(sessionId, dish.id)
      : await addDishExclusion({ session_id: sessionId, dish_id: dish.id });
    setBusy(dish.id, false);

    if (!result.ok) {
      status.value = result.error.message;
      return false;
    }
    if (isExcluded) {
      exclusions.value = exclusions.value.filter((item) => item.dish_id !== dish.id);
      status.value = `已恢复推荐「${dish.name}」`;
    } else {
      exclusions.value = [{ dish_id: dish.id, name: dish.name }, ...exclusions.value];
      status.value = `已排除「${dish.name}」，下次推荐不再出现`;
    }
    return true;
  }

  return { exclusions, busyIds, status, loadError, excludedIds, reload, toggle };
}