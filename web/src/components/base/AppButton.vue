<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    block?: boolean;
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit';
  }>(),
  { variant: 'primary', size: 'md', block: false, loading: false, disabled: false, type: 'button' },
);

const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <button
    :class="[
      'btn',
      `btn--${variant}`,
      `btn--${size}`,
      { 'btn--block': block, 'btn--loading': loading, 'btn--disabled': disabled },
    ]"
    :type="type"
    :disabled="disabled || loading"
    @click="emit('click')"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--size-touch);
  padding: 0 var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: var(--font-size-lg);
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s ease, background 0.15s ease;
}
.btn--block {
  width: 100%;
}
.btn--sm {
  min-height: 32px;
  padding: 0 var(--space-3);
  font-size: var(--font-size-md);
}
.btn--lg {
  min-height: 52px;
  font-size: var(--font-size-xl);
}
.btn--primary {
  background: var(--color-brand-500);
  color: var(--color-text-inverse);
}
.btn--primary:active {
  background: var(--color-brand-600);
}
.btn--secondary {
  background: var(--color-bg-surface);
  color: var(--color-brand-600);
  border-color: var(--color-brand-300);
}
.btn--ghost {
  background: transparent;
  color: var(--color-brand-600);
}
.btn--danger {
  background: var(--color-danger);
  color: var(--color-text-inverse);
}
.btn--disabled,
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn--loading {
  cursor: progress;
}
.btn__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: var(--radius-pill);
  animation: btn-spin 0.7s linear infinite;
}
@keyframes btn-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
