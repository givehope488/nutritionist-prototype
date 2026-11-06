<script setup lang="ts">
// 反馈页：对比条 + 判定文案（TEAM.md W2-W3「反馈页」）。
// 判定、合计、目标全部来自服务端 MealLog 响应；本页不计算任何营养数值（架构 D1）。
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MEAL_OPTIONS } from '@shared/constants';
import type { ApiError, MealLog } from '@shared/types';
import AppButton from '@/components/base/AppButton.vue';
import AppCard from '@/components/base/AppCard.vue';
import AppErrorBanner from '@/components/base/AppErrorBanner.vue';
import AppLoading from '@/components/base/AppLoading.vue';
import AppNavBar from '@/components/base/AppNavBar.vue';
import NutritionSummary from '@/components/business/NutritionSummary.vue';
import VerdictCard from '@/components/business/VerdictCard.vue';
import { findMealLog } from '@/composables/useMealLogLookup';
import { sessionId } from '@/composables/useSession';
import { formatGram, formatKcal, formatSodium, formatDateLabel, formatServings } from '@/utils/display';

const route = useRoute();
const router = useRouter();

const log = ref<MealLog | null>(null);
const error = ref<ApiError | null>(null);
const loading = ref(true);

const mealLabel = computed(() => {
  const option = MEAL_OPTIONS.find((item) => item.value === log.value?.meal);
  return option?.label ?? '';
});

/**
 * MealLog.target 按契约只含 kcal 与 protein_g（API.md §2.4），
 * 所以脂肪/碳水/钠三条只显示数值、标注「暂无目标」；补齐目标字段需走接口变更流程（待评审议题 Q4）。
 */
const comparisonTarget = computed(() => {
  const target = log.value?.target;
  if (!target) return undefined;
  return { kcal: target.kcal, protein_g: target.protein_g };
});

async function load(): Promise<void> {
  const id = typeof route.query.id === 'string' ? route.query.id : '';
  if (!id) {
    loading.value = false;
    error.value = { code: 'VALIDATION_ERROR', message: '缺少用餐记录标识，请从回填页进入' };
    return;
  }
  loading.value = true;
  error.value = null;
  const result = await findMealLog(sessionId, id);
  loading.value = false;
  if (result.ok) log.value = result.data;
  else error.value = result.error;
}

onMounted(load);
</script>

<template>
  <div class="page">
    <AppNavBar title="这一餐的反馈" back-label="回填" @back="router.push('/log')">
      <template #action>
        <router-link class="page__link" to="/history">历史</router-link>
      </template>
    </AppNavBar>

    <div class="page__body">
      <AppLoading v-if="loading" :rows="3" label="正在核对这餐…" />
      <AppErrorBanner v-else-if="error" :error="error">
        <template #action>
          <AppButton size="sm" variant="secondary" @click="router.push('/log')">去回填</AppButton>
        </template>
      </AppErrorBanner>

      <template v-else-if="log">
        <VerdictCard :verdict="log.verdict" :adopted="log.adopted" :duplicate="log.duplicate" />

        <AppCard :title="`${formatDateLabel(log.date)} · ${mealLabel}`">
          <template #action>
            <span class="page__id tabular">{{ log.id.slice(0, 8) }}</span>
          </template>
          <NutritionSummary :totals="log.totals" :target="comparisonTarget" />
        </AppCard>

        <AppCard title="吃了什么" :subtitle="`${log.items.length} 项`">
          <ul class="page__items">
            <li v-for="item in log.items" :key="item.dish_id" class="page__item">
              <span>{{ item.name }}</span>
              <span class="page__servings">{{ formatServings(item.servings) }}</span>
            </li>
          </ul>
          <p class="page__totals tabular">
            合计 {{ formatKcal(log.totals.kcal) }} · 蛋白 {{ formatGram(log.totals.protein_g) }} · 钠
            {{ formatSodium(log.totals.sodium_mg) }}
          </p>
        </AppCard>

        <div class="page__actions">
          <AppButton variant="secondary" @click="router.push('/history')">看这周记录</AppButton>
          <AppButton @click="router.push('/log')">再填一餐</AppButton>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.page__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
}
.page__link {
  font-size: var(--font-size-sm);
}
.page__id {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.page__items {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.page__item {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-md);
}
.page__servings {
  color: var(--color-text-tertiary);
}
.page__totals {
  margin: var(--space-3) 0 0;
  padding-top: var(--space-2);
  border-top: 1px dashed var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
.page__actions {
  display: flex;
  gap: var(--space-2);
}
.page__actions > * {
  flex: 1;
}
</style>
