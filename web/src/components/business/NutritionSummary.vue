<script setup lang="ts">
// 五项营养合计展示：热量 / 蛋白 / 脂肪 / 碳水 / 钠。
// 输入完全来自服务端 totals + target，组件不做加减换算。
import type { NutritionTotals, MealTarget } from '@canteen/shared';
import MacroBar from './MacroBar.vue';

withDefaults(
  defineProps<{
    totals: NutritionTotals;
    target?: Partial<MealTarget>;
    density?: 'compact' | 'normal';
  }>(),
  { target: undefined, density: 'normal' },
);
</script>

<template>
  <div :class="['macros', { 'macros--compact': density === 'compact' }]">
    <MacroBar
      label="热量"
      :actual="totals.kcal"
      :target="target?.kcal ?? 0"
      unit="kcal"
      color="var(--color-macro-kcal)"
    />
    <MacroBar
      label="蛋白质"
      :actual="totals.protein_g"
      :target="target?.protein_g ?? 0"
      unit="g"
      color="var(--color-macro-protein)"
    />
    <MacroBar
      label="脂肪"
      :actual="totals.fat_g"
      :target="target?.fat_g ?? 0"
      unit="g"
      color="var(--color-macro-fat)"
    />
    <MacroBar
      label="碳水"
      :actual="totals.carbs_g"
      :target="target?.carbs_g ?? 0"
      unit="g"
      color="var(--color-macro-carbs)"
    />
    <MacroBar
      label="钠"
      :actual="totals.sodium_mg"
      :target="target?.sodium_mg ?? 0"
      unit="mg"
      color="var(--color-macro-sodium)"
    />
  </div>
</template>

<style scoped>
.macros {
  display: grid;
  gap: var(--space-3);
}
.macros--compact {
  gap: var(--space-2);
}
</style>
