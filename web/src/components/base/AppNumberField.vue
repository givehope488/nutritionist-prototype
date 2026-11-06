<script setup lang="ts">
// 数字输入：只收集原始输入，格式化为字符串交给父级校验，避免前端参与营养口径
withDefaults(
  defineProps<{
    modelValue: string | number;
    unit?: string;
    placeholder?: string;
    inputmode?: 'numeric' | 'decimal';
    disabled?: boolean;
    invalid?: boolean;
  }>(),
  { unit: '', placeholder: '请输入', inputmode: 'numeric', disabled: false, invalid: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [] }>();
</script>

<template>
  <div :class="['numfield', { 'numfield--invalid': invalid, 'numfield--disabled': disabled }]">
    <input
      class="numfield__input"
      type="text"
      :inputmode="inputmode"
      :value="String(modelValue)"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @blur="emit('blur')"
    >
    <span v-if="unit" class="numfield__unit">{{ unit }}</span>
  </div>
</template>

<style scoped>
.numfield {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
}
.numfield--invalid {
  border-color: var(--color-danger);
  background: var(--color-danger-bg);
}
.numfield--disabled {
  background: var(--color-bg-subtle);
  opacity: 0.7;
}
.numfield__input {
  flex: 1;
  min-width: 0;
  min-height: var(--size-touch);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  font-variant-numeric: tabular-nums;
  outline: none;
}
.numfield__unit {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
</style>
