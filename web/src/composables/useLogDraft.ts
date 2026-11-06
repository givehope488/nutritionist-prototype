// 回填草稿：幂等 id 与已选份数按「日期 + 餐次」存 sessionStorage。
// 为什么存：弱网下提交失败、页面刷新或用户重进时，必须用同一个 id 重试，
// 服务端才能按幂等键判重（API.md §0.7）；否则每次刷新都会生成一条新记录。
import { computed, ref, watch, type Ref } from 'vue';
import type { Meal } from '@canteen/shared';

const NAMESPACE = 'cn.draft';

export interface DraftItem {
  dish_id: string;
  servings: number;
}

interface DraftState {
  id: string;
  items: Record<string, number>;
}

function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function keyOf(sessionId: string, date: string, meal: Meal): string {
  return `${NAMESPACE}.${sessionId}.${date}.${meal}`;
}

function load(key: string): DraftState {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) return JSON.parse(raw) as DraftState;
  } catch {
    /* 损坏草稿按空处理 */
  }
  return { id: newClientId(), items: {} };
}

export interface UseLogDraft {
  /** 幂等键：同一份草稿在提交成功前保持不变 */
  logId: Ref<string>;
  /** dish_id → servings */
  items: Ref<Record<string, number>>;
  selectedCount: Ref<number>;
  /** 采纳的推荐组合 id；非空表示这餐是按推荐吃的 */
  adoptedComboId: Ref<string | null>;
  buildItems: () => DraftItem[];
  resetDraft: () => void;
}

export function useLogDraft(
  sessionId: string,
  date: Ref<string>,
  meal: Ref<Meal>,
): UseLogDraft {
  const key = computed(() => keyOf(sessionId, date.value, meal.value));
  const initial = load(key.value);
  const logId = ref(initial.id);
  const items = ref<Record<string, number>>(initial.items);
  const adoptedComboId = ref<string | null>(null);

  watch(key, (next) => {
    const restored = load(next);
    logId.value = restored.id;
    items.value = restored.items;
    adoptedComboId.value = null;
  });

  watch(
    items,
    (value) => {
      sessionStorage.setItem(key.value, JSON.stringify({ id: logId.value, items: value }));
    },
    { deep: true },
  );

  const selectedCount = computed(
    () => Object.values(items.value).filter((servings) => servings > 0).length,
  );

  function buildItems(): DraftItem[] {
    return Object.entries(items.value)
      .filter(([, servings]) => servings > 0)
      .map(([dish_id, servings]) => ({ dish_id, servings }));
  }

  function resetDraft(): void {
    sessionStorage.removeItem(key.value);
    items.value = {};
    logId.value = newClientId();
  }

  return { logId, items, selectedCount, adoptedComboId, buildItems, resetDraft };
}
