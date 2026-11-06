<script setup lang="ts">
// 顶部导航：移动端返回 + 标题 + 右侧动作。
// backLabel 为空时不渲染返回按钮——根页面（回填 / 历史）没有上一页，摆个死按钮比不摆更糟。
withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    /** 返回按钮文案；留空则不显示返回按钮 */
    backLabel?: string;
  }>(),
  { subtitle: '', backLabel: '' },
);

const emit = defineEmits<{ back: [] }>();
</script>

<template>
  <header class="navbar">
    <button v-if="backLabel" class="navbar__back" type="button" @click="emit('back')">
      <span aria-hidden="true">‹</span>
      {{ backLabel }}
    </button>
    <span v-else class="navbar__spacer" aria-hidden="true" />
    <div class="navbar__title">
      <h1>{{ title }}</h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div class="navbar__action">
      <slot name="action" />
    </div>
  </header>
</template>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: grid;
  grid-template-columns: 72px 1fr 72px;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
}
.navbar__back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-brand-600);
  font-size: var(--font-size-md);
  text-align: left;
  cursor: pointer;
}
.navbar__title h1 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  text-align: center;
}
.navbar__title p {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  text-align: center;
}
.navbar__action {
  display: flex;
  justify-content: flex-end;
}
</style>
