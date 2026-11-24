<script setup lang="ts">
// 推荐页（主流程第 3 步）：按档案与忌口请求 1~3 套组合。
// 边界：kcal / 营养值 / notice 全部来自服务端响应；本页不做营养计算，也不改契约字段。
// 「换一批」= 重新 POST /recommendations（API.md §2.3，没有 refill 字段）。
// 「这组不行」= 只换被点的那一张（PD 2026-11-24），做法见 replayOne()。
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ApiError, Meal, RecommendationResponse } from '@canteen/shared';
import { createRecommendation, getProfile } from '@/api/endpoints';
import AppButton from '@/components/base/AppButton.vue';
import AppCard from '@/components/base/AppCard.vue';
import AppEmpty from '@/components/base/AppEmpty.vue';
import AppErrorBanner from '@/components/base/AppErrorBanner.vue';
import AppLoading from '@/components/base/AppLoading.vue';
import AppNavBar from '@/components/base/AppNavBar.vue';
import AppSegmented from '@/components/base/AppSegmented.vue';
import AppStepBar from '@/components/base/AppStepBar.vue';
import ComboCard from '@/components/business/ComboCard.vue';
import NoSolutionNotice from '@/components/business/NoSolutionNotice.vue';
import { saveRecommendationResponse } from '@/composables/useRecommendationCache';
import { sessionId } from '@/composables/useSession';
import { formatDateLabel, toDateStr } from '@/utils/display';
import { MEAL_OPTIONS } from '@/utils/labels';

const route = useRoute();
const router = useRouter();

const STEPS = ['建档', '目标与忌口', '推荐', '回填', '反馈'];
const mealItems = MEAL_OPTIONS.map((option) => ({ value: option.value, label: option.label }));

const loading = ref(true);
const missingProfile = ref(false);
const error = ref<ApiError | null>(null);
const response = ref<RecommendationResponse | null>(null);
const meal = ref<Meal>('lunch');

/** 防止连点「换一批」时旧响应覆盖新响应 */
let requestSeq = 0;

/** 「这组不行」正在换第几张（null = 没有在换）；同时用于禁用该卡按钮 */
const replacingIndex = ref<number | null>(null);
const replayNotice = ref<string | null>(null);

const mealLabel = computed(
  () => MEAL_OPTIONS.find((option) => option.value === meal.value)?.label ?? meal.value,
);
const today = computed(() => formatDateLabel(toDateStr(new Date())));

async function load(nextMeal: Meal): Promise<void> {
  const seq = ++requestSeq;
  meal.value = nextMeal;
  // 整批刷新时，单卡替换的中间状态一并作废
  replacingIndex.value = null;
  replayNotice.value = null;
  loading.value = true;
  error.value = null;
  const result = await createRecommendation({ session_id: sessionId, meal: nextMeal });
  if (seq !== requestSeq) return;
  loading.value = false;
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') {
      missingProfile.value = true;
      return;
    }
    error.value = result.error;
    return;
  }
  response.value = result.data;
  // 仅供回填页「按推荐预填」使用；空组合没有可采纳内容，不覆盖上一次有效缓存
  if (result.data.combos.length > 0) {
    saveRecommendationResponse(sessionId, nextMeal, result.data);
  }
}

function setMeal(value: string): void {
  if (value === meal.value) return;
  void load(value as Meal);
}

/** 换一批：再请求一次，服务端会重新挑选（B3 结案口径） */
function refresh(): void {
  void load(meal.value);
}

/**
 * 「这组不行」：只替换被点的那一张，另外两张原样保留（PD 2026-11-24 反馈 1）。
 * 契约里没有「排除指定组合」的入参（§4.1 A 已定不加参数），所以做法是：重新 POST 拿新的一批，
 * 从中挑一个当前列表里没有的组合顶上；一批里挑不到就再要一次。两次都没有新组合就如实告知，
 * 而不是假装换过。
 */
async function replayOne(index: number): Promise<void> {
  if (!response.value || replacingIndex.value !== null) return;
  const seq = ++requestSeq;
  replacingIndex.value = index;
  replayNotice.value = null;
  error.value = null;

  const current = response.value;
  const used = new Set(current.combos.map((combo) => combo.id));
  let replaced = false;

  for (let attempt = 0; attempt < 2 && !replaced; attempt += 1) {
    const result = await createRecommendation({ session_id: sessionId, meal: meal.value });
    // 期间用户点了「换一批」或切了餐次：丢弃本次结果，不能用旧批覆盖新批
    if (seq !== requestSeq) return;
    if (!result.ok) {
      error.value = result.error;
      break;
    }
    const candidate = result.data.combos.find((combo) => !used.has(combo.id));
    if (!candidate) continue;
    const combos = [...current.combos];
    combos[index] = candidate;
    const next: RecommendationResponse = { ...current, combos };
    response.value = next;
    // 采纳新卡时回填页要从缓存取明细，替换后必须同步重写缓存
    saveRecommendationResponse(sessionId, meal.value, next);
    replaced = true;
  }

  if (!replaced && !error.value) {
    replayNotice.value = '这回没配出不一样的，可以点右上角「换一批」整批重来';
  }
  replacingIndex.value = null;
}

function switchMeal(): void {
  const index = MEAL_OPTIONS.findIndex((option) => option.value === meal.value);
  const next = MEAL_OPTIONS[(index + 1) % MEAL_OPTIONS.length];
  void load(next.value);
}

function adopt(comboId: string): void {
  void router.push({ name: 'log', query: { meal: meal.value, combo: comboId } });
}

onMounted(async () => {
  const profile = await getProfile(sessionId);
  if (!profile.ok) {
    loading.value = false;
    if (profile.error.code === 'NOT_FOUND') missingProfile.value = true;
    else error.value = profile.error;
    return;
  }
  const fromQuery = typeof route.query.meal === 'string' ? route.query.meal : '';
  const requested = MEAL_OPTIONS.find((option) => option.value === fromQuery);
  await load(requested ? (requested.value as Meal) : profile.data.default_meal);
});
</script>

<template>
  <div class="page">
    <AppNavBar title="这餐怎么吃" :subtitle="`${today} · ${mealLabel}`">
      <template #action>
        <button
          v-if="!missingProfile"
          class="page__refresh"
          type="button"
          :disabled="loading"
          @click="refresh"
        >
          换一批
        </button>
      </template>
    </AppNavBar>

    <div class="page__body">
      <AppStepBar :steps="STEPS" :current="2" />

      <AppEmpty
        v-if="missingProfile"
        title="还没有建档"
        description="推荐要按你的体征、目标和忌口来配，先建档再回来。"
        action-label="去建档"
        @action="router.push({ name: 'profile' })"
      />

      <template v-else>
        <AppCard padding="tight">
          <div class="switcher">
            <span class="switcher__label">餐次</span>
            <AppSegmented :model-value="meal" :items="mealItems" @update:model-value="setMeal($event)" />
          </div>
        </AppCard>

        <AppErrorBanner v-if="error" :error="error">
          <template #action>
            <AppButton size="sm" variant="secondary" @click="refresh">重试</AppButton>
          </template>
        </AppErrorBanner>

        <AppLoading v-if="loading" :rows="4" label="正在按你的档案配餐…" />

        <template v-else-if="response">
          <AppCard padding="tight" class="target">
            <div class="target__head">
              <span class="target__title">本餐目标</span>
              <span class="target__meta">日目标 {{ response.target.day_kcal }} kcal · 服务端计算</span>
            </div>
            <dl class="target__grid">
              <div class="target__item">
                <dt>热量</dt>
                <dd>{{ response.target.kcal }} kcal</dd>
              </div>
              <div class="target__item">
                <dt>蛋白质</dt>
                <dd>{{ response.target.protein_g }} g</dd>
              </div>
              <div class="target__item">
                <dt>脂肪</dt>
                <dd>{{ response.target.fat_g }} g</dd>
              </div>
              <div class="target__item">
                <dt>碳水</dt>
                <dd>{{ response.target.carbs_g }} g</dd>
              </div>
              <div class="target__item">
                <dt>钠</dt>
                <dd>{{ response.target.sodium_mg }} mg</dd>
              </div>
            </dl>
          </AppCard>

          <p v-if="replayNotice" class="replay-notice">{{ replayNotice }}</p>

          <ul v-if="response.combos.length" class="list">
            <li v-for="(combo, index) in response.combos" :key="combo.id">
              <ComboCard
                :combo="combo"
                :target="response.target"
                :index="index + 1"
                :replacing="replacingIndex === index"
                @adopt="adopt(combo.id)"
                @replay="replayOne(index)"
              />
              <!-- A6/I5：服务端算好的组合级标记（API.md v1.2.4 §2.3），本页只做一行判断 -->
              <p v-if="combo.has_weighed_dish" class="weigh-note">
                含称重菜：份量以现场称重为准，热量为参考值。
              </p>
            </li>
          </ul>

          <NoSolutionNotice
            v-else-if="response.notice"
            :notice="response.notice"
            @relax="router.push({ name: 'goal' })"
            @switch-meal="switchMeal"
          />

          <AppEmpty
            v-else
            title="这餐暂时配不出来"
            description="服务端没有返回可用组合，换个餐段或放宽忌口再试。"
            action-label="换个餐段"
            @action="switchMeal"
          />

          <p v-if="response.combos.length" class="foot">
            「换一批」会重新请求；采纳组合后回填页会自动预填，份数仍可在回填时调整。
          </p>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
}
.page__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
}
.page__refresh {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-brand-600);
  font-size: var(--font-size-md);
  cursor: pointer;
}
.page__refresh:disabled {
  color: var(--color-text-tertiary);
  cursor: default;
}
.switcher {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.switcher__label {
  flex: none;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
.target__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.target__title {
  font-size: var(--font-size-md);
  font-weight: 600;
}
.target__meta {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.target__grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  margin: 0;
}
.target__item {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}
.target__item dt {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.target__item dd {
  margin: 0;
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.replay-notice {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-info-bg);
  color: var(--color-info);
  font-size: var(--font-size-sm);
}
.weigh-note {
  margin: calc(-1 * var(--space-2)) var(--space-2) 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.foot {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
</style>
