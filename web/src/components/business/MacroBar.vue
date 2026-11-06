<script setup lang="ts">
// 单条宏量对比条：条宽是渲染比例（actual/target），不代表任何营养数值口径。
// 数值一律来自服务端响应，组件只负责显示（架构 D1）。
import { computed } from 'vue';
import { ratioPercent } from '@/utils/display';

const props = withDefaults(
  defineProps<{
    label: string;
    actual: number;
    target: number;
    /** 单位后缀，仅用于展示 */
    unit?: string;
    /** CSS 变量名，取自 tokens.css 的 --color-macro-* */
    color?: string;
    /** 超过目标多少算偏出（默认 10%） */
    tolerance?: number;
  }>(),
  { unit: '', color: 'var(--color-macro-kcal)', tolerance: 0.1 },
);

const fill = computed(() => ratioPercent(props.actual, props.target));
const hasTarget = computed(() => props.target > 0);
const state = computed(() => {
  if (props.target <= 0) return 'neutral';
  const diff = (props.actual - props.target) / props.target;
  if (Math.abs(diff) <= props.tolerance) return 'ok';
  return diff > 0 ? 'over' : 'under';
});
</script>

<template>
  <div class="macro" :data-state="state">
    <div class="macro__head">
      <span class="macro__label">{{ label }}</span>
      <span class="macro__values">
        <strong class="tabular">{{ actual }}</strong>
        <span class="macro__unit">{{ unit }}</span>
        <span class="macro__target">{{ hasTarget ? `/ 目标 ${target}` : '/ 暂无目标' }}</span>
      </span>
    </div>
    <div
      class="macro__track"
      role="img"
      :aria-label="`${label} ${actual} ${unit}，${hasTarget ? `目标 ${target}` : '暂无本餐目标'}`"
    >
      <i class="macro__fill" :style="{ width: `${fill}%`, background: color }" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
.macro {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.macro__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: var(--font-size-sm);
}
.macro__label {
  color: var(--color-text-secondary);
}
.macro__values {
  color: var(--color-text-secondary);
}
.macro__values strong {
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
}
.macro__unit {
  margin-left: 2px;
  margin-right: var(--space-1);
}
.macro__target {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.macro__track {
  position: relative;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--color-bg-subtle);
  overflow: hidden;
}
.macro__fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: var(--radius-pill);
  transition: width 0.25s ease;
}
/* 目标 = 轨道满格；超出目标时条满格并切到 over 状态提示 */
.macro__track::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-pill);
  opacity: 0.5;
  pointer-events: none;
}
.macro[data-state='over'] .macro__fill {
  opacity: 1;
}
.macro[data-state='under'] .macro__fill {
  opacity: 0.75;
}
/* 没有目标值时不画「目标线」，避免把空轨道读成 0 目标 */
.macro[data-state='neutral'] .macro__track::after {
  border-style: solid;
  opacity: 0.2;
}
</style>
