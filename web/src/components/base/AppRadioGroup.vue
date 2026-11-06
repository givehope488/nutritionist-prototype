<script setup lang="ts">
// 单选组：目标（health/lose/gain）、性别、活动量。支持 disabledReason 解释规则来源。
import type { RadioOption } from '../types';

defineProps<{
  modelValue: string;
  options: RadioOption[];
  direction?: 'row' | 'column';
  name: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <div :class="['radio-group', `radio-group--${direction ?? 'row'}`]" role="radiogroup">
    <label
      v-for="option in options"
      :key="option.value"
      class="radio-group__item"
      :class="{
        'radio-group__item--active': option.value === modelValue,
        'radio-group__item--disabled': option.disabled,
      }"
    >
      <input
        class="radio-group__input"
        type="radio"
        :name="name"
        :value="option.value"
        :checked="option.value === modelValue"
        :disabled="option.disabled"
        @change="emit('update:modelValue', option.value)"
      >
      <span class="radio-group__label">{{ option.label }}</span>
      <span v-if="option.hint" class="radio-group__hint">{{ option.hint }}</span>
      <span v-else-if="option.disabled && option.disabledReason" class="radio-group__hint">
        {{ option.disabledReason }}
      </span>
    </label>
  </div>
</template>

<style scoped>
.radio-group {
  display: flex;
  gap: var(--space-2);
}
.radio-group--column {
  flex-direction: column;
}
.radio-group__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: var(--size-touch);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  cursor: pointer;
}
.radio-group__item--active {
  border-color: var(--color-brand-500);
  background: var(--color-brand-50);
}
.radio-group__item--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.radio-group__input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.radio-group__label {
  font-size: var(--font-size-md);
  font-weight: 600;
}
.radio-group__item--active .radio-group__label {
  color: var(--color-brand-600);
}
.radio-group__hint {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
</style>
