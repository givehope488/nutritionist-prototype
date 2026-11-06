<script setup lang="ts">
// 忌口无解提示（TEAM.md W5「忌口无解提示」）：§2.3 规定这不是错误，
// 服务端返回 200 + combos: [] + notice，前端按引导文案放宽条件。
// 由 FE-A 的推荐页消费：notice 文案一律用服务端下发的，禁止前端自造。
import AppButton from '../base/AppButton.vue';
import AppCard from '../base/AppCard.vue';

defineProps<{
  notice: string;
}>();

const emit = defineEmits<{ relax: []; switchMeal: [] }>();
</script>

<template>
  <AppCard class="nosolution" elevated>
    <h3 class="nosolution__title">这餐暂时配不出来</h3>
    <p class="nosolution__body">{{ notice }}</p>
    <div class="nosolution__actions">
      <AppButton size="sm" variant="secondary" @click="emit('relax')">放宽一两个忌口</AppButton>
      <AppButton size="sm" variant="ghost" @click="emit('switchMeal')">换个餐段看看</AppButton>
    </div>
    <p class="nosolution__foot">提示：菜单由食堂管理员维护，菜品池会随季节变化。</p>
  </AppCard>
</template>

<style scoped>
.nosolution__title {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-lg);
}
.nosolution__body {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}
.nosolution__actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
.nosolution__foot {
  margin: var(--space-3) 0 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
</style>
