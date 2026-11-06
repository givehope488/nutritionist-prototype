<script setup lang="ts">
// 菜品行卡（回填页）：名称 + 份量 + 价格 + 份数步进器。
// 合规：reliability 非 A 级不展示精确克重（README 合规边界 4 / 架构 D5）。
import { computed } from 'vue';
import type { Dish } from '@canteen/shared';
import { formatYuan } from '@/utils/display';
import AppStepper from '../base/AppStepper.vue';
import AppBadge from '../base/AppBadge.vue';

const props = defineProps<{
  dish: Dish;
  modelValue: number;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const showPrecision = computed(() => props.dish.reliability === 'A');
const selected = computed(() => props.modelValue > 0);
</script>

<template>
  <article class="dish" :class="{ 'dish--selected': selected }">
    <div class="dish__main">
      <div class="dish__title">
        <span class="dish__name">{{ dish.name }}</span>
        <AppBadge v-if="dish.drink" tone="info">饮品</AppBadge>
        <AppBadge v-if="!showPrecision" tone="neutral">估算值</AppBadge>
      </div>
      <p class="dish__meta">
        <span v-if="showPrecision">{{ dish.portion_label }}</span>
        <span v-else>份量按食堂常见规格</span>
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
