<script setup lang="ts">
// 分类 Tab：横向可滑，选中项自动滚入视野（回填页菜品分类用）。
import { ref, watch } from 'vue';
import type { TabItem } from '../types';

const props = defineProps<{
  modelValue: string;
  items: TabItem[];
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const scroller = ref<HTMLElement | null>(null);

watch(
  () => props.modelValue,
  () => {
    const active = scroller.value?.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'center' });
  },
);
</script>

<template>
  <div ref="scroller" class="tabs" role="tablist">
    <button
      v-for="item in items"
      :key="item.value"
      class="tabs__item"
      :class="{ 'tabs__item--active': item.value === modelValue }"
      type="button"
      role="tab"
      :aria-selected="item.value === modelValue"
      @click="emit('update:modelValue', item.value)"
    >
      {{ item.label }}
      <span v-if="item.count !== undefined" class="tabs__count">{{ item.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: var(--space-1);
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid var(--color-border);
}
.tabs::-webkit-scrollbar {
  display: none;
}
.tabs__item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--size-touch);
  padding: 0 var(--space-3);
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  white-space: nowrap;
  cursor: pointer;
}
.tabs__item--active {
  color: var(--color-brand-600);
  border-bottom-color: var(--color-brand-500);
  font-weight: 600;
}
.tabs__count {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
</style>
