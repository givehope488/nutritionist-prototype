<script setup lang="ts">
// 表单字段外壳：label + 控件 + 规则提示；错误文案优先展示服务端 fields（API.md §1）
withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
    inline?: boolean;
  }>(),
  { hint: '', error: '', required: false, inline: false },
);
</script>

<template>
  <div :class="['field', { 'field--inline': inline }]">
    <div class="field__head">
      <span class="field__label">
        {{ label }}
        <i v-if="required" class="field__required" aria-hidden="true">*</i>
      </span>
      <span v-if="error" class="field__error" role="alert">{{ error }}</span>
    </div>
    <div class="field__control">
      <slot />
    </div>
    <p v-if="hint && !error" class="field__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.field--inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  min-height: var(--size-touch);
}
.field__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}
.field--inline .field__head {
  flex: none;
}
.field__label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}
.field__required {
  color: var(--color-danger);
  font-style: normal;
}
.field__error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}
.field__hint {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.field__control {
  flex: 1;
  min-width: 0;
}
</style>
