<script setup lang="ts">
// 可选项 Chip：忌口多选、菜品筛选等场景
withDefaults(
  defineProps<{
    label: string;
    active?: boolean;
    disabled?: boolean;
  }>(),
  { active: false, disabled: false },
);

const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    class="chip"
    :class="{ 'chip--active': active, 'chip--disabled': disabled }"
    type="button"
    role="checkbox"
    :aria-checked="active"
    :disabled="disabled"
    @click="emit('toggle')"
  >
    {{ label }}
  </button>
</template>

<style scoped>
.chip {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  cursor: pointer;
}
.chip--active {
  border-color: var(--color-brand-500);
  background: var(--color-brand-50);
  color: var(--color-brand-600);
  font-weight: 600;
}
.chip--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
