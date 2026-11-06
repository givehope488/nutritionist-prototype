<script setup lang="ts">
// 份数步进器：0.5 步进、上限 5（API.md §2.4），0 表示未选。
// 数值口径仍由服务端在提交后计算，这里只维护「份数」这一用户输入。
import { MAX_SERVINGS, SERVING_STEP } from '@canteen/shared';
import { clampServings, formatServings } from '@/utils/display';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    disabled?: boolean;
    size?: 'sm' | 'md';
  }>(),
  { disabled: false, size: 'md' },
);

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

function step(delta: number): void {
  if (props.disabled) return;
  emit('update:modelValue', clampServings(props.modelValue + delta));
}
</script>

<template>
  <div :class="['stepper', `stepper--${size}`, { 'stepper--disabled': disabled }]">
    <button
      class="stepper__btn"
      type="button"
      aria-label="减少份数"
      :disabled="disabled || modelValue <= 0"
      @click="step(-SERVING_STEP)"
    >
      −
    </button>
    <span class="stepper__value" :class="{ 'stepper__value--empty': modelValue === 0 }">
      {{ formatServings(modelValue) }}
    </span>
    <button
      class="stepper__btn"
      type="button"
      aria-label="增加份数"
      :disabled="disabled || modelValue >= MAX_SERVINGS"
      @click="step(SERVING_STEP)"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.stepper {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px;
  background: var(--color-bg-subtle);
  border-radius: var(--radius-pill);
}
.stepper__btn {
  display: grid;
  place-items: center;
  width: var(--size-touch);
  height: var(--size-touch);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-bg-surface);
  color: var(--color-brand-600);
  font-size: var(--font-size-xl);
  line-height: 1;
  cursor: pointer;
  box-shadow: var(--shadow-card);
}
.stepper--sm .stepper__btn {
  width: 32px;
  height: 32px;
  font-size: var(--font-size-lg);
}
.stepper__btn:disabled {
  color: var(--color-text-tertiary);
  opacity: 0.5;
  cursor: not-allowed;
}
.stepper__value {
  min-width: 48px;
  text-align: center;
  font-size: var(--font-size-md);
  font-variant-numeric: tabular-nums;
}
.stepper__value--empty {
  color: var(--color-text-tertiary);
}
.stepper--disabled {
  opacity: 0.5;
}
</style>
