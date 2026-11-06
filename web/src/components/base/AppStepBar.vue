<script setup lang="ts">
// 步骤条：主流程（建档 → 目标与忌口 → 推荐 → 回填 → 反馈）进度指示。
// 状态由页面传入，组件不做流程判断。
withDefaults(
  defineProps<{
    steps: string[];
    /** 0-based 当前步 */
    current: number;
  }>(),
  {},
);
</script>

<template>
  <ol class="stepbar">
    <li
      v-for="(label, index) in steps"
      :key="label"
      class="stepbar__item"
      :class="{
        'stepbar__item--done': index < current,
        'stepbar__item--current': index === current,
      }"
    >
      <span class="stepbar__dot">{{ index < current ? '✓' : index + 1 }}</span>
      <span class="stepbar__label">{{ label }}</span>
      <span v-if="index < steps.length - 1" class="stepbar__line" aria-hidden="true" />
    </li>
  </ol>
</template>

<style scoped>
.stepbar {
  display: flex;
  align-items: flex-start;
  margin: 0;
  padding: var(--space-3) var(--space-2);
  list-style: none;
}
.stepbar__item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  position: relative;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  text-align: center;
}
.stepbar__item--done,
.stepbar__item--current {
  color: var(--color-brand-600);
}
.stepbar__dot {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid currentColor;
  border-radius: var(--radius-pill);
  background: var(--color-bg-surface);
  font-size: var(--font-size-xs);
  font-weight: 600;
}
.stepbar__item--current .stepbar__dot {
  background: var(--color-brand-500);
  border-color: var(--color-brand-500);
  color: var(--color-text-inverse);
}
.stepbar__line {
  position: absolute;
  top: 11px;
  left: calc(50% + 14px);
  width: calc(100% - 28px);
  height: 1px;
  background: var(--color-border);
}
.stepbar__item--done .stepbar__line {
  background: var(--color-brand-300);
}
</style>
