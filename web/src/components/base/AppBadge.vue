<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'ok' | 'warn' | 'info' | 'danger' | 'brand';
    size?: 'sm' | 'md';
    /** 圆点前缀：用于 verdict / 状态标识 */
    dot?: boolean;
  }>(),
  { tone: 'neutral', size: 'sm', dot: false },
);
</script>

<template>
  <span :class="['badge', `badge--${tone}`, `badge--${size}`, { 'badge--dot': dot }]">
    <i v-if="dot" class="badge__dot" aria-hidden="true" />
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}
.badge--md {
  font-size: var(--font-size-sm);
  padding: var(--space-1) var(--space-3);
}
.badge__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: currentColor;
}
.badge--neutral {
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
}
.badge--brand {
  background: var(--color-brand-50);
  color: var(--color-brand-600);
}
.badge--ok {
  background: var(--color-ok-bg);
  color: var(--color-ok);
}
.badge--warn {
  background: var(--color-warn-bg);
  color: var(--color-warn);
}
.badge--info {
  background: var(--color-info-bg);
  color: var(--color-info);
}
.badge--danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}
</style>
