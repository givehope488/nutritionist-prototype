<script setup lang="ts">
// 回填页：分类 Tab + 份数步进器 + 采纳预填（TEAM.md W2-W3「回填页」）。
// 边界：本页不展示任何热量数字——营养合计只在提交后由服务端给出（架构 D1）。
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DISH_CATEGORY_LABEL, DISH_CATEGORY_ORDER, MEAL_OPTIONS } from '@/utils/labels';
import type { ApiError, Dish, Category, Meal } from '@canteen/shared';
import { createMealLog, getMenu, getProfile } from '@/api/endpoints';
import AppButton from '@/components/base/AppButton.vue';
import AppCard from '@/components/base/AppCard.vue';
import AppEmpty from '@/components/base/AppEmpty.vue';
import AppErrorBanner from '@/components/base/AppErrorBanner.vue';
import AppLoading from '@/components/base/AppLoading.vue';
import AppNavBar from '@/components/base/AppNavBar.vue';
import AppSegmented from '@/components/base/AppSegmented.vue';
import AppTabs from '@/components/base/AppTabs.vue';
import DishCard from '@/components/business/DishCard.vue';
import { cacheMealLog } from '@/composables/useMealLogLookup';
import { findCachedCombo } from '@/composables/useRecommendationCache';
import { useLogDraft } from '@/composables/useLogDraft';
import { sessionId } from '@/composables/useSession';
import { formatDateLabel, toDateStr } from '@/utils/display';

const route = useRoute();
const router = useRouter();

const meal = ref<Meal>((route.query.meal as Meal) || 'lunch');
const date = ref<string>(
  typeof route.query.date === 'string' && route.query.date ? route.query.date : toDateStr(new Date()),
);

const draft = useLogDraft(sessionId, date, meal);

const dishes = ref<Dish[]>([]);
const menuLoading = ref(false);
const menuError = ref<ApiError | null>(null);
const noProfile = ref(false);
const activeCategory = ref<Category>('staple');
const prefillNotice = ref<string | null>(null);
const submitting = ref(false);
const submitError = ref<ApiError | null>(null);

function setMeal(value: string): void {
  meal.value = value as Meal;
}

const mealItems = MEAL_OPTIONS.map((option) => ({ value: option.value, label: option.label }));
const mealLabel = computed(
  () => MEAL_OPTIONS.find((option) => option.value === meal.value)?.label ?? meal.value,
);
const dateItems = [0, 1].map((offset) => {
  const value = toDateStr(new Date(Date.now() - offset * 86400000));
  return { value, label: formatDateLabel(value) };
});

const grouped = computed(() => {
  const map = new Map<Category, Dish[]>();
  for (const dish of dishes.value) {
    const list = map.get(dish.category) ?? [];
    list.push(dish);
    map.set(dish.category, list);
  }
  return DISH_CATEGORY_ORDER.filter((category) => map.has(category)).map((category) => ({
    category,
    items: map.get(category)!,
  }));
});

const tabItems = computed(() =>
  grouped.value.map((group) => ({
    value: group.category,
    label: DISH_CATEGORY_LABEL[group.category],
    count: group.items.length,
  })),
);

const currentDishes = computed(
  () => grouped.value.find((group) => group.category === activeCategory.value)?.items ?? [],
);

const selectedLabels = computed(() =>
  draft.buildItems()
    .map((item) => {
      const dish = dishes.value.find((candidate) => candidate.id === item.dish_id);
      return dish ? dish.name : item.dish_id;
    })
    .slice(0, 3),
);

async function loadMenu(): Promise<void> {
  menuLoading.value = true;
  menuError.value = null;
  const result = await getMenu({ meal: meal.value });
  menuLoading.value = false;
  if (result.ok) {
    dishes.value = result.data.dishes;
    const first = grouped.value[0];
    if (first && !grouped.value.some((group) => group.category === activeCategory.value)) {
      activeCategory.value = first.category;
    }
    return;
  }
  if (result.error.code === 'NOT_FOUND') noProfile.value = true;
  menuError.value = result.error;
}

function applyPrefillFromCombo(): void {
  const comboId = typeof route.query.combo === 'string' ? route.query.combo : '';
  if (!comboId) return;
  const combo = findCachedCombo(comboId, sessionId);
  if (!combo) {
    prefillNotice.value = '推荐组合已超过 24 小时，请自选这餐吃了什么';
    return;
  }
  for (const dish of combo.dishes) {
    draft.items.value[dish.id] = dish.servings;
  }
  draft.adoptedComboId.value = combo.id;
  prefillNotice.value = `已按推荐搭配预填 ${combo.dishes.length} 项，吃完后按实际调整份数即可`;
}

async function submit(): Promise<void> {
  if (submitting.value || draft.selectedCount.value === 0) return;
  submitting.value = true;
  submitError.value = null;
  const result = await createMealLog({
    id: draft.logId.value,
    session_id: sessionId,
    date: date.value,
    meal: meal.value,
    items: draft.buildItems(),
    adopted_combo_id: draft.adoptedComboId.value,
  });
  submitting.value = false;
  if (!result.ok) {
    submitError.value = result.error;
    return;
  }
  // 提交成功：记录进本地缓存供反馈页直接渲染，并作废草稿（下次进入是新的幂等 id）
  cacheMealLog(result.data);
  draft.resetDraft();
  await router.push({ name: 'feedback', query: { id: result.data.id } });
}

watch(meal, () => void loadMenu());
watch([date, meal], () => {
  prefillNotice.value = null;
  applyPrefillFromCombo();
});

onMounted(async () => {
  const profile = await getProfile(sessionId);
  if (!profile.ok) {
    if (profile.error.code === 'NOT_FOUND') noProfile.value = true;
    else menuError.value = profile.error;
    return;
  }
  if (!route.query.meal) meal.value = profile.data.default_meal;
  await loadMenu();
  applyPrefillFromCombo();
});
</script>

<template>
  <div class="page">
    <AppNavBar title="这餐吃了什么" :subtitle="`${formatDateLabel(date)} · ${mealLabel}`">
      <template #action>
        <router-link class="page__link" to="/history">历史</router-link>
      </template>
    </AppNavBar>

    <div class="page__body">
      <AppErrorBanner v-if="menuError" :error="menuError">
        <template #action>
          <AppButton size="sm" variant="secondary" @click="loadMenu">重新加载菜单</AppButton>
        </template>
      </AppErrorBanner>

      <AppEmpty
        v-if="noProfile"
        title="还没有建档"
        description="先填一下身高体重和目标，回填时才能和这餐的目标做对比。"
        action-label="去建档"
        @action="router.push('/profile')"
      />

      <template v-else>
        <AppCard padding="tight" class="switcher">
          <div class="switcher__row">
            <span class="switcher__label">餐次</span>
            <AppSegmented :model-value="meal" :items="mealItems" @update:model-value="setMeal($event)" />
          </div>
          <div class="switcher__row">
            <span class="switcher__label">日期</span>
            <AppSegmented :model-value="date" :items="dateItems" @update:model-value="date = $event" />
          </div>
        </AppCard>

        <p v-if="prefillNotice" class="notice">{{ prefillNotice }}</p>

        <AppLoading v-if="menuLoading" :rows="4" label="加载食堂菜单…" />

        <AppEmpty
          v-else-if="dishes.length === 0 && !menuError"
          title="这个餐段暂时没有菜品"
          description="菜单由食堂管理员维护，换一个餐段试试。"
        />

        <template v-else-if="dishes.length > 0">
          <AppTabs
            v-model="activeCategory"
            class="page__tabs"
            :items="tabItems"
            role="tablist"
          />
          <ul class="page__list">
            <li v-for="dish in currentDishes" :key="dish.id">
              <DishCard
                :dish="dish"
                :model-value="draft.items.value[dish.id] ?? 0"
                @update:model-value="
                  (value) => {
                    if (value === 0) delete draft.items.value[dish.id];
                    else draft.items.value[dish.id] = value;
                  }
                "
              />
            </li>
          </ul>
        </template>
      </template>
    </div>

    <div class="submitbar">
      <AppErrorBanner v-if="submitError" :error="submitError" class="submitbar__error" />
      <div class="submitbar__row">
        <div class="submitbar__summary">
          <strong>{{ draft.selectedCount.value }}</strong> 项已选
          <span v-if="selectedLabels.length" class="submitbar__names">
            {{ selectedLabels.join('、') }}{{ draft.selectedCount.value > 3 ? '…' : '' }}
          </span>
          <p class="submitbar__hint">热量与蛋白对比在提交后由服务端计算</p>
        </div>
        <AppButton
          :loading="submitting"
          :disabled="draft.selectedCount.value === 0"
          @click="submit"
        >
          生成反馈
        </AppButton>
      </div>
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
.page__link {
  font-size: var(--font-size-sm);
}
.switcher__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.switcher__label {
  flex: none;
  width: 3em;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
.notice {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-info-bg);
  color: var(--color-info);
  font-size: var(--font-size-sm);
}
.page__tabs {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--color-bg-page);
}
.page__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.submitbar {
  position: sticky;
  bottom: calc(var(--size-touch) + var(--app-safe-bottom));
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0 var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  box-shadow: var(--shadow-raised);
}
.submitbar__error {
  margin-bottom: var(--space-2);
}
.submitbar__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.submitbar__summary {
  min-width: 0;
  font-size: var(--font-size-md);
}
.submitbar__names {
  display: block;
  overflow: hidden;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.submitbar__hint {
  margin: 2px 0 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
</style>
