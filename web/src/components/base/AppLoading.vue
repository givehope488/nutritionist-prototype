<script setup lang="ts">
// 加载占位：弱网下给出进度感，避免页面空白被误认为无数据
withDefaults(
  defineProps<{ rows?: number; label?: string }>(),
  { rows: 3, label: '加载中…' },
);
</script>

<template>
  <div class="loading" role="status" aria-live="polite">
    <p class="loading__label">{{ label }}</p>
    <div v-for="row in rows" :key="row" class="loading__row" :style="{ width: `${90 - row * 8}%` }" />
  </div>
</template>

<style scoped>
.loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) 0;
}
.loading__label {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
.loading__row {
  height: 44px;
  border-radius: var(--radius-md);
  background: linear-gradient(
    90deg,
    var(--color-bg-subtle) 25%,
    var(--color-border) 37%,
    var(--color-bg-subtle) 63%
  );
  background-size: 400% 100%;
  animation: loading-sweep 1.2s ease-in-out infinite;
}
@keyframes loading-sweep {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: 0 0;
  }
}
</style>
