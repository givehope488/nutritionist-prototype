<script setup lang="ts">
// 历史页：统计摘要 + 记录列表 + 分页（TEAM.md W2-W3「历史页」）。
// 数字全部来自 /insights/summary 与 /meal-logs，本页只做格式化展示。
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { MEAL_OPTIONS } from '@/utils/labels';
import type { ApiError, InsightsSummaryResponse, MealLogResponse } from '@canteen/shared';
import { getInsightsSummary, listMealLogs } from '@/api/endpoints';
import AppButton from '@/components/base/AppButton.vue';
import AppCard from '@/components/base/AppCard.vue';
import AppEmpty from '@/components/base/AppEmpty.vue';
import AppErrorBanner from '@/components/base/AppErrorBanner.vue';
import AppLoading from '@/components/base/AppLoading.vue';
import AppNavBar from '@/components/base/AppNavBar.vue';
import AppSegmented from '@/components/base/AppSegmented.vue';
import AppBadge from '@/components/base/AppBadge.vue';
import { sessionId } from '@/composables/useSession';
import { formatDateLabel, formatGram, formatKcal, toDateStr } from '@/utils/display';

const router = useRouter();

const days = ref(7);
const logs = ref<MealLogResponse[]>([]);
const summary = ref<InsightsSummaryResponse | null>(null);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const loading = ref(true);
const loadingMore = ref(false);
const error = ref<ApiError | null>(null);

const dayItems = [7, 14, 30].map((value) => ({ value: String(value), label: `${value} 天` }));
const mealLabels = computed(() =>
  Object.fromEntries(MEAL_OPTIONS.map((option) => [option.value, option.label])),
);

const hasMore = computed(() => logs.value.length < total.value);
const adoptionPercent = computed(() =>
  summary.value ? Math.round(summary.value.adoption_rate * 100) : 0,
);

function windowFrom(rangeDays: number): string {
  return toDateStr(new Date(Date.now() - (rangeDays - 1) * 86400000));
}

async function loadAll(): Promise<void> {
  loading.value = true;
  error.value = null;
  page.value = 1;
  const from = windowFrom(days.value);
  const to = toDateStr(new Date());
  const [summaryResult, listResult] = await Promise.all([
    getInsightsSummary({ session_id: sessionId, days: days.value }),
    listMealLogs({ session_id: sessionId, from, to, page: 1, page_size: pageSize }),
  ]);
  loading.value = false;
  const failure = !summaryResult.ok ? summaryResult.error : !listResult.ok ? listResult.error : null;
  if (failure) {
    error.value = failure;
    return;
  }
  summary.value = (summaryResult as { ok: true; data: InsightsSummaryResponse }).data;
  const list = (listResult as { ok: true; data: { total: number; logs: MealLogResponse[] } }).data;
  logs.value = list.logs;
  total.value = list.total;
}

async function loadMore(): Promise<void> {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  const next = page.value + 1;
  const result = await listMealLogs({
    session_id: sessionId,
    from: windowFrom(days.value),
    to: toDateStr(new Date()),
    page: next,
    page_size: pageSize,
  });
  loadingMore.value = false;
  if (!result.ok) {
    error.value = result.error;
    return;
  }
  logs.value = [...logs.value, ...result.data.logs];
  page.value = next;
}

watch(days, () => void loadAll());
onMounted(() => void loadAll());
</script>

<template>
  <div class="page">
    <AppNavBar title="我的记录" subtitle="建议 → 执行 → 反馈">
      <template #action>
        <router-link class="page__link" to="/log">去回填</router-link>
      </template>
    </AppNavBar>

    <div class="page__body">
      <AppSegmented :model-value="String(days)" :items="dayItems" @update:model-value="days = Number($event)" />

      <AppErrorBanner v-if="error" :error="error">
        <template #action>
          <AppButton size="sm" variant="secondary" @click="loadAll">重试</AppButton>
        </template>
      </AppErrorBanner>

      <AppLoading v-else-if="loading" :rows="3" label="正在汇总你的记录…" />

      <template v-else>
        <AppCard :title="`近 ${days} 天`">
          <dl class="stats">
            <div class="stats__item">
              <dt>已回填</dt>
              <dd class="tabular">{{ summary?.logged_meals ?? 0 }} 餐</dd>
            </div>
            <div class="stats__item">
              <dt>采纳率</dt>
              <dd class="tabular">{{ adoptionPercent }}%</dd>
            </div>
            <div class="stats__item">
              <dt>平均热量</dt>
              <dd class="tabular">{{ formatKcal(summary?.avg_kcal ?? 0) }}</dd>
            </div>
            <div class="stats__item">
              <dt>平均蛋白</dt>
              <dd class="tabular">{{ formatGram(summary?.avg_protein_g ?? 0) }}</dd>
            </div>
          </dl>
          <p class="stats__hint">采纳率 = 按推荐吃的那几餐 ÷ 回填总餐数</p>
        </AppCard>

        <AppEmpty
          v-if="logs.length === 0"
          title="这段时间还没有记录"
          description="吃完饭在回填页选一下吃了什么，这里就会出现对比反馈。"
          action-label="去回填这一餐"
          @action="router.push('/log')"
        />

        <ul v-else class="list">
          <li v-for="log in logs" :key="log.id">
            <button class="row" type="button" @click="router.push({ name: 'feedback', query: { id: log.id } })">
              <div class="row__head">
                <span class="row__date">{{ formatDateLabel(log.date) }}</span>
                <span class="row__meal">{{ mealLabels[log.meal] }}</span>
                <AppBadge :tone="log.verdict.level === 'ok' ? 'ok' : 'warn'" dot>
                  {{ log.verdict.title }}
                </AppBadge>
                <AppBadge v-if="log.adopted" tone="brand">按推荐</AppBadge>
              </div>
              <div class="row__numbers tabular">
                <span>{{ formatKcal(log.totals.kcal) }} / 目标 {{ log.target.kcal }}</span>
                <span class="row__protein">蛋白 {{ formatGram(log.totals.protein_g) }}</span>
              </div>
            </button>
          </li>
        </ul>

        <AppButton v-if="hasMore" variant="ghost" :loading="loadingMore" @click="loadMore">
          加载更多（共 {{ total }} 条）
        </AppButton>
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
.stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  margin: 0;
}
.stats__item dt {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.stats__item dd {
  margin: 2px 0 0;
  font-size: var(--font-size-xl);
  font-weight: 600;
}
.stats__hint {
  margin: var(--space-3) 0 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  text-align: left;
  cursor: pointer;
}
.row__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.row__date {
  font-weight: 600;
}
.row__meal {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
.row__numbers {
  display: flex;
  justify-content: space-between;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
.row__protein {
  color: var(--color-text-tertiary);
}
</style>
