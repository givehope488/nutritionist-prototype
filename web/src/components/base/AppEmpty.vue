<script setup lang="ts">
// 空态：菜单为空、无历史记录等
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    actionLabel?: string;
  }>(),
  { description: '', actionLabel: '' },
);

const emit = defineEmits<{ action: [] }>();
</script>

<template>
  <div class="empty">
    <div class="empty__mark" aria-hidden="true">—</div>
    <h3 class="empty__title">{{ title }}</h3>
    <p v-if="description" class="empty__desc">{{ description }}</p>
    <slot name="extra" />
    <button v-if="actionLabel" class="empty__action" type="button" @click="emit('action')">
      {{ actionLabel }}
    </button>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}
.empty__mark {
  color: var(--color-border-strong);
  font-size: var(--font-size-2xl);
}
.empty__title {
  margin: 0;
  font-size: var(--font-size-lg);
}
.empty__desc {
  margin: 0;
  max-width: 30ch;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}
.empty__action {
  min-height: var(--size-touch);
  margin-top: var(--space-2);
  padding: 0 var(--space-4);
  border: 1px solid var(--color-brand-300);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  color: var(--color-brand-600);
  font-weight: 600;
  cursor: pointer;
}
</style>
