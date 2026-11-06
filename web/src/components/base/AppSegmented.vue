<script setup lang="ts">
// 分段控件：日期 / 餐次切换，触控目标 44px
import type { SegmentedItem } from '../types';

defineProps<{
  modelValue: string;
  items: SegmentedItem[];
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <div class="segmented" role="group">
    <button
      v-for="item in items"
      :key="item.value"
      class="segmented__item"
      :class="{ 'segmented__item--active': item.value === modelValue }"
      type="button"
      :aria-pressed="item.value === modelValue"
      @click="emit('update:modelValue', item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  padding: 2px;
  background: var(--color-bg-subtle);
  border-radius: var(--radius-md);
}
.segmented__item {
  min-width: 64px;
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  cursor: pointer;
}
.segmented__item--active {
  background: var(--color-bg-surface);
  color: var(--color-brand-600);
  font-weight: 600;
  box-shadow: var(--shadow-card);
}
</style>
