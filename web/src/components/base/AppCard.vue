<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    /** flush：去掉内边距，由内部组件自行控制间距 */
    padding?: 'normal' | 'tight' | 'flush';
    elevated?: boolean;
  }>(),
  { title: '', subtitle: '', padding: 'normal', elevated: false },
);
</script>

<template>
  <section :class="['card', `card--${padding}`, { 'card--elevated': elevated }]">
    <header v-if="title || $slots.action" class="card__head">
      <div>
        <h3 class="card__title">{{ title }}</h3>
        <p v-if="subtitle" class="card__subtitle">{{ subtitle }}</p>
      </div>
      <div class="card__action">
        <slot name="action" />
      </div>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}
.card--normal {
  padding: var(--space-4);
}
.card--tight {
  padding: var(--space-3);
}
.card--flush {
  padding: 0;
}
.card--elevated {
  box-shadow: var(--shadow-raised);
}
.card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.card--flush .card__head {
  padding: var(--space-4) var(--space-4) 0;
}
.card__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}
.card__subtitle {
  margin-top: 2px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
</style>
