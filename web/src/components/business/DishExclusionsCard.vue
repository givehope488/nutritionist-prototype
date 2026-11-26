<script setup lang="ts">
// 个人排除入口（W3-C5 / API v1.2.12 §2.6）：点一下菜名 → 以后推荐跳过它；再点恢复。
// 只影响当前匿名 session；不改菜品状态，也不影响历史记录。
// 组件自己读排除列表，父级只需给「可操作的菜」，并在 changed 后决定是否重新请求推荐。
// 读写状态收敛在 useDishExclusions（组件层禁止直接 import @/api）。
import { computed, onMounted } from 'vue';
import { useDishExclusions } from '@/composables/useDishExclusions';
import AppCard from '../base/AppCard.vue';
import AppChip from '../base/AppChip.vue';

const props = withDefaults(
  defineProps<{
    /** 当前可操作的菜（反馈页=这餐的菜；推荐页=当前组合里的菜） */
    dishes: { id: string; name: string }[];
    title?: string;
    hint?: string;
  }>(),
  {
    title: '不想再看到某道菜？',
    hint: '点菜名后，下次推荐会跳过它；再点一次恢复。只影响你自己。',
  },
);

const emit = defineEmits<{ changed: [] }>();

const { exclusions, busyIds, status, loadError, excludedIds, reload, toggle } =
  useDishExclusions();

/**
 * 合并「当前可操作的菜」与「已排除的菜」：
 * 推荐页在排除后可能已经配不出组合，此时仍要能看到并恢复已排除项。
 */
const merged = computed(() => {
  const map = new Map<string, string>();
  for (const dish of props.dishes) map.set(dish.id, dish.name);
  for (const item of exclusions.value) {
    if (!map.has(item.dish_id)) map.set(item.dish_id, item.name);
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }));
});

async function onToggle(dish: { id: string; name: string }): Promise<void> {
  if (await toggle(dish)) emit('changed');
}

onMounted(reload);
</script>

<template>
  <AppCard v-if="merged.length" :title="title" :subtitle="hint">
    <div class="exclude__chips">
      <AppChip
        v-for="dish in merged"
        :key="dish.id"
        :label="excludedIds.has(dish.id) ? `${dish.name} · 已排除` : dish.name"
        :active="excludedIds.has(dish.id)"
        :disabled="busyIds.has(dish.id)"
        @toggle="onToggle(dish)"
      />
    </div>
    <p v-if="status" class="exclude__status" role="status">{{ status }}</p>
    <p v-if="loadError" class="exclude__error">读取排除列表失败：{{ loadError }}</p>
    <p v-if="excludedIds.size" class="exclude__count">
      已排除 {{ excludedIds.size }} 道；点「已排除」的菜名即可恢复。
    </p>
  </AppCard>
</template>

<style scoped>
.exclude__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.exclude__status {
  margin: var(--space-3) 0 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
.exclude__error {
  margin: var(--space-3) 0 0;
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}
.exclude__count {
  margin: var(--space-2) 0 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
</style>