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
import AppChip from '@/components/base/AppChip.vue';
import AppEmpty from '@/components/base/AppEmpty.vue';
import AppErrorBanner from '@/components/base/AppErrorBanner.vue';
import AppLoading from '@/components/base/AppLoading.vue';
import AppNavBar from '@/components/base/AppNavBar.vue';
import AppSegmented from '@/components/base/AppSegmented.vue';
import AppTabs from '@/components/base/AppTabs.vue';
import DishCard from '@/components/business/DishCard.vue';
import { cacheMealLog } from '@/composables/useMealLogLookup';
import { findCachedCombo, buildAdoptedSnapshot } from '@/composables/useRecommendationCache';
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

// 推荐组合只对「带来它的那次餐次 + 日期」有效：切餐次或补填昨天都视为自选，
// 否则会把午餐组合预填进晚餐、并按 adopted 计入采纳率。
const comboMeal = meal.value;
const comboDate = date.value;

const dishes = ref<Dish[]>([]);
const menuLoading = ref(false);
const menuError = ref<ApiError | null>(null);
const noProfile = ref(false);
const activeCategory = ref<Category>('staple');
const prefillNotice = ref<string | null>(null);
const submitting = ref(false);
const submitError = ref<ApiError | null>(null);

/**
 * 筛选（PD 2026-11-24 反馈 2：几百款菜品翻不过来）。
 * 菜单里本来就有 `floor` / `stall`（API.md v1.2.4 起下发），按三个维度逐层收敛：
 * 关键词（菜名或店铺）→ 楼层 → 店铺，最后落在品类 Tab 上。
 */
const keyword = ref('');
const activeFloor = ref<number | 'all'>('all');
const activeStall = ref<string>('all');

/** 有关键词时跨品类搜索：用户通常不知道「炸酱面」属于哪个品类 */
const searching = computed(() => keyword.value.trim().length > 0);

const floors = computed(() => {
  const set = new Set<number>();
  for (const dish of dishes.value) {
    if (typeof dish.floor === 'number') set.add(dish.floor);
  }
  return [...set].sort((a, b) => a - b);
});

const stallOptions = computed(() => {
  const set = new Set<string>();
  for (const dish of dishes.value) {
    if (activeFloor.value !== 'all' && dish.floor !== activeFloor.value) continue;
    if (dish.stall) set.add(dish.stall);
  }
  return [...set];
});

/** chip 上省掉「一楼·」前缀（楼层已经单独筛过），列表分组标题仍用全名便于定位 */
function stallLabel(stall: string): string {
  const parts = stall.split('·');
  return parts.length > 1 ? parts.slice(1).join('·') : stall;
}

const filteredDishes = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return dishes.value.filter((dish) => {
    if (activeFloor.value !== 'all' && dish.floor !== activeFloor.value) return false;
    if (activeStall.value !== 'all' && dish.stall !== activeStall.value) return false;
    if (!kw) return true;
    return dish.name.toLowerCase().includes(kw) || (dish.stall ?? '').toLowerCase().includes(kw);
  });
});

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
  for (const dish of filteredDishes.value) {
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

/** 搜索时跨品类显示，否则只显示当前品类 */
const visibleDishes = computed(() =>
  searching.value ? filteredDishes.value : currentDishes.value,
);

/** 列表按店铺分段，让「一楼·早餐」「二楼·轻食」各自成块 */
const stallGroups = computed(() => {
  const map = new Map<string, Dish[]>();
  for (const dish of visibleDishes.value) {
    const key = dish.stall || '未标注店铺';
    const list = map.get(key);
    if (list) list.push(dish);
    else map.set(key, [dish]);
  }
  return [...map.entries()].map(([stall, items]) => ({ stall, items }));
});

// 筛完可能把当前品类筛空：自动落到第一个还有菜的品类，避免用户看着空白以为没菜
watch([activeFloor, activeStall, keyword], () => {
  if (activeStall.value !== 'all' && !stallOptions.value.includes(activeStall.value)) {
    activeStall.value = 'all';
    return;
  }
  if (!grouped.value.some((group) => group.category === activeCategory.value)) {
    const first = grouped.value[0];
    if (first) activeCategory.value = first.category;
  }
});

// 只展示能对上菜名的项：菜单未就绪时宁可显示「加载中」，也不能把内部 dish_id 漏给用户
// （PD 视觉走查 P2-3：预填进入瞬间摘要闪 s01、m10 这类 id）。
const selectedNames = computed(() =>
  draft
    .buildItems()
    .map((item) => dishes.value.find((candidate) => candidate.id === item.dish_id)?.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 3),
);

const namesPending = computed(
  () => menuLoading.value && draft.selectedCount.value > 0 && selectedNames.value.length === 0,
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
  if (meal.value !== comboMeal || date.value !== comboDate) return;
  const combo = findCachedCombo(comboId, sessionId, meal.value);
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
  // 采纳快照取自预填用的推荐缓存（零额外请求）；缓存过期或丢失时按自选提交，
  // 避免带上 id 却没有快照被服务端 400（API.md v1.2.5）。
  const combo = draft.adoptedComboId.value
    ? findCachedCombo(draft.adoptedComboId.value, sessionId, meal.value)
    : null;
  const result = await createMealLog({
    id: draft.logId.value,
    session_id: sessionId,
    date: date.value,
    meal: meal.value,
    items: draft.buildItems(),
    adopted_combo_id: combo ? combo.id : null,
    ...(combo ? { adopted_combo: buildAdoptedSnapshot(combo) } : {}),
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
          <div class="filters">
            <div class="filters__search">
              <input
                v-model="keyword"
                class="filters__input"
                type="search"
                placeholder="搜菜名或店铺，例如「炸酱面」「轻食」"
                aria-label="搜索菜品"
              />
              <button v-if="searching" class="filters__clear" type="button" @click="keyword = ''">
                清除
              </button>
            </div>

            <div v-if="floors.length > 1" class="filters__row">
              <span class="filters__label">楼层</span>
              <div class="filters__chips">
                <AppChip label="全部" :active="activeFloor === 'all'" @toggle="activeFloor = 'all'" />
                <AppChip
                  v-for="floor in floors"
                  :key="floor"
                  :label="`${floor}F`"
                  :active="activeFloor === floor"
                  @toggle="activeFloor = floor"
                />
              </div>
            </div>

            <div v-if="stallOptions.length > 1" class="filters__row">
              <span class="filters__label">店铺</span>
              <div class="filters__chips filters__chips--scroll">
                <AppChip label="全部" :active="activeStall === 'all'" @toggle="activeStall = 'all'" />
                <AppChip
                  v-for="stall in stallOptions"
                  :key="stall"
                  :label="stallLabel(stall)"
                  :active="activeStall === stall"
                  @toggle="activeStall = stall"
                />
              </div>
            </div>
          </div>

          <AppTabs
            v-if="!searching"
            v-model="activeCategory"
            class="page__tabs"
            :items="tabItems"
            role="tablist"
          />

          <p v-if="searching" class="filters__hint">
            找到 {{ filteredDishes.length }} 道（搜索时跨品类显示）
          </p>

          <AppEmpty
            v-if="visibleDishes.length === 0"
            title="没有匹配的菜"
            description="换个关键词，或把楼层 / 店铺切回「全部」。"
          />

          <template v-else>
            <section v-for="group in stallGroups" :key="group.stall" class="stall">
              <h3 class="stall__title">
                {{ group.stall }}
                <span class="stall__count">{{ group.items.length }}</span>
              </h3>
              <ul class="page__list">
                <li v-for="dish in group.items" :key="dish.id">
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
            </section>
          </template>
        </template>
      </template>
    </div>

    <div class="submitbar">
      <AppErrorBanner v-if="submitError" :error="submitError" class="submitbar__error" />
      <div class="submitbar__row">
        <div class="submitbar__summary">
          <strong>{{ draft.selectedCount.value }}</strong> 项已选
          <span v-if="namesPending" class="submitbar__names">菜单加载中…</span>
          <span v-else-if="selectedNames.length" class="submitbar__names">
            {{ selectedNames.join('、') }}{{ draft.selectedCount.value > 3 ? '…' : '' }}
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
.filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.filters__search {
  position: relative;
  display: flex;
  align-items: center;
}
.filters__input {
  width: 100%;
  box-sizing: border-box;
  min-height: var(--size-touch);
  padding: var(--space-2) var(--space-3);
  padding-right: 4.5em;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
}
.filters__clear {
  position: absolute;
  right: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.filters__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.filters__label {
  flex: none;
  width: 2.6em;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
.filters__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
/* chip 是子组件根元素：不给 flex: none 会在横向滚动容器里被压成竖排文字 */
.filters__chips > * {
  flex: none;
  white-space: nowrap;
}
/* 店铺可能十几个，横向滚动比换行更省屏幕 */
.filters__chips--scroll {
  flex-wrap: nowrap;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: thin;
}
.filters__hint {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.stall {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.stall__title {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
}
.stall__count {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 400;
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
