<script setup lang="ts">
// 菜品行卡（回填页）：名称 + 份量 + 价格 + 份数步进器。
// D4：只展示份量用语、不展示克重，A / B 级用同一套 UI、不加「估算」标记。
// 依据 API.md v1.2.1：portion_grams 一律不下发，前端本来就拿不到克重。
import type { Dish } from '@canteen/shared';
import { formatYuan } from '@/utils/display';
import AppStepper from '../base/AppStepper.vue';
import AppBadge from '../base/AppBadge.vue';

defineProps<{
  dish: Dish;
  modelValue: number;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const selected = (value: number): boolean => value > 0;
</script>

<template>
  <article class="dish" :class="{ 'dish--selected': selected(modelValue) }">
    <div class="dish__main">
      <div class="dish__title">
        <span class="dish__name">{{ dish.name }}</span>
        <AppBadge v-if="dish.drink" tone="info">饮品</AppBadge>
      </div>
      <p class="dish__meta">
        <span>{{ dish.portion_label }}</span>
        <span class="dish__dot" aria-hidden="true">·</span>
        <span class="tabular">{{ formatYuan(dish.price_yuan) }}</span>
      </p>
    </div>
    <AppStepper :model-value="modelValue" :size="'sm'" @update:model-value="emit('update:modelValue', $event)" />
  </article>
</template>
<style scoped>
.dish {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
}
.dish--selected {
  border-color: var(--color-brand-300);
  background: var(--color-brand-50);
}
.dish__main {
  min-width: 0;
}
.dish__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
}
.dish__name {
  font-size: var(--font-size-lg);
  font-weight: 600;
}
.dish__meta {
  margin: 2px 0 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
.dish__dot {
  margin: 0 var(--space-1);
}
</style>
