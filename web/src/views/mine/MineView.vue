<script setup lang="ts">
// 个人中心：档案概览 + 改体征/饮食目标 + 忌口入口 + 合规删除（PD 2026-11-24）。
// 2026-11-25：饮食目标（四档）放进下方 ProfileForm 直接改，概览区同步展示当前目标。
// 建档页只服务新用户，所有「已有档案之后的管理动作」都收在这里，避免两处表单互相漂移。
// 边界：BMI / 日目标仍是服务端派生值；删除会连带清空用餐记录，必须二次确认。
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { ApiError, AvoidOption, Profile, ProfileInput } from '@canteen/shared';
import { deleteProfile, getMenu, getProfile, saveProfile } from '@/api/endpoints';
import AppButton from '@/components/base/AppButton.vue';
import AppCard from '@/components/base/AppCard.vue';
import AppEmpty from '@/components/base/AppEmpty.vue';
import AppErrorBanner from '@/components/base/AppErrorBanner.vue';
import AppLoading from '@/components/base/AppLoading.vue';
import AppNavBar from '@/components/base/AppNavBar.vue';
import ProfileForm from '@/components/business/ProfileForm.vue';
import { clearRecommendationCache } from '@/composables/useRecommendationCache';
import { sessionId } from '@/composables/useSession';
import { GOAL_LABEL, MEAL_OPTIONS } from '@/utils/labels';

const router = useRouter();

const loading = ref(true);
const error = ref<ApiError | null>(null);
const profile = ref<Profile | null>(null);
const savedNotice = ref<string | null>(null);
const saving = ref(false);
const saveError = ref<ApiError | null>(null);
const avoidOptions = ref<AvoidOption[]>([]);

// 合规删除入口（API.md v1.2.4 §2.2）：必须二次确认，文案写明连带删除全部用餐记录
const confirmingDelete = ref(false);
const deleting = ref(false);
const deleteError = ref<ApiError | null>(null);
const deleted = ref(false);

const mealLabel = computed(() => {
  const current = profile.value;
  if (!current) return '';
  return MEAL_OPTIONS.find((option) => option.value === current.default_meal)?.label ?? '';
});

/** 忌口选项来自服务端 GET /menu（不硬编码 key）；菜单没加载到时退化成 key 本身 */
const avoidLabels = computed(() =>
  (profile.value?.avoid ?? []).map(
    (key) => avoidOptions.value.find((option) => option.key === key)?.label ?? key,
  ),
);

function goHome(): void {
  void router.push({ name: 'home' });
}

async function save(input: ProfileInput): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  saveError.value = null;
  const result = await saveProfile(input);
  saving.value = false;
  if (!result.ok) {
    saveError.value = result.error;
    return;
  }
  const next = result.data;
  const previous = profile.value;
  profile.value = next;
  deleted.value = false;
  savedNotice.value = `已保存：BMI ${next.bmi}（${next.bmi_tag}） · 日目标 ${next.day_kcal} kcal`;
  // 体征变了日目标就变了：旧的推荐组合不再对应当前目标，清掉缓存让推荐页重新配
  if (!previous || previous.day_kcal !== next.day_kcal) clearRecommendationCache();
}

/**
 * 删除成功后清掉本机残留（数据最小化）：推荐缓存（含 combo.id 预填）、
 * 回填草稿与单条记录缓存（键前缀见 useLogDraft / useMealLogLookup）。
 */
function clearLocalResidue(): void {
  clearRecommendationCache();
  const prefixes = ['cn.draft.', 'cn.last_log.'];
  const stale: string[] = [];
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) stale.push(key);
  }
  for (const key of stale) sessionStorage.removeItem(key);
}

async function confirmDelete(): Promise<void> {
  if (deleting.value) return;
  deleting.value = true;
  deleteError.value = null;
  const result = await deleteProfile(sessionId);
  deleting.value = false;
  // 404 = 档案已不存在（可能此前删过），与 204 一样按「已删除」收尾；其他错误留在确认区可重试
  if (!result.ok && result.error.code !== 'NOT_FOUND') {
    deleteError.value = result.error;
    return;
  }
  clearLocalResidue();
  profile.value = null;
  confirmingDelete.value = false;
  savedNotice.value = null;
  deleted.value = true;
}

onMounted(async () => {
  const [profileResult, menuResult] = await Promise.all([getProfile(sessionId), getMenu()]);
  loading.value = false;
  if (menuResult.ok) avoidOptions.value = menuResult.data.avoid_options;
  if (profileResult.ok) {
    profile.value = profileResult.data;
    return;
  }
  if (profileResult.error.code !== 'NOT_FOUND') error.value = profileResult.error;
});
</script>

<template>
  <div class="page">
    <AppNavBar title="个人中心" subtitle="改档案、调目标、管理数据" back-label="首页" @back="goHome" />

    <div class="page__body">
      <AppLoading v-if="loading" :rows="4" label="读取档案…" />

      <template v-else>
        <AppErrorBanner v-if="error" :error="error" />

        <AppCard v-if="deleted" padding="tight" class="notice-card">
          <p class="notice-card__line">档案与全部用餐记录已删除，可以重新建档。</p>
          <AppButton size="sm" variant="secondary" @click="router.push({ name: 'profile' })">
            去建档
          </AppButton>
        </AppCard>

        <AppEmpty
          v-else-if="!profile"
          title="还没有建档"
          description="建档后才能按你的体征算目标、配这餐。"
          action-label="去建档"
          @action="router.push({ name: 'profile' })"
        />

        <template v-else>
          <AppCard padding="tight" class="summary">
            <div class="summary__row">
              <div class="summary__item">
                <span class="summary__label">BMI</span>
                <strong class="summary__value">{{ profile.bmi }}</strong>
                <span class="summary__tag">{{ profile.bmi_tag }}</span>
              </div>
              <div class="summary__item">
                <span class="summary__label">日目标</span>
                <strong class="summary__value">{{ profile.day_kcal }}</strong>
                <span class="summary__tag">kcal</span>
              </div>
              <div class="summary__item">
                <span class="summary__label">饮食目标</span>
                <strong class="summary__value summary__value--text">{{ GOAL_LABEL[profile.goal] }}</strong>
              </div>
              <div class="summary__item">
                <span class="summary__label">默认餐次</span>
                <strong class="summary__value summary__value--text">{{ mealLabel }}</strong>
              </div>
            </div>
            <ul v-if="profile.warnings.length" class="summary__warnings">
              <li v-for="warning in profile.warnings" :key="warning">{{ warning }}</li>
            </ul>
          </AppCard>

          <p v-if="savedNotice" class="notice">{{ savedNotice }}</p>

          <AppCard padding="tight" class="target-entry">
            <div class="target-entry__text">
              <p class="target-entry__title">忌口设置</p>
              <p class="target-entry__meta">
                <template v-if="avoidLabels.length">不吃 {{ avoidLabels.join('、') }}</template>
                <template v-else>未设忌口</template>
              </p>
            </div>
            <AppButton size="sm" variant="secondary" @click="router.push({ name: 'goal' })">
              去设置
            </AppButton>
          </AppCard>

          <ProfileForm
            :profile="profile"
            submit-label="保存修改"
            :saving="saving"
            :error="saveError"
            @submit="save"
          />

          <AppCard padding="tight" class="danger">
            <template v-if="!confirmingDelete">
              <p class="danger__title">删除档案</p>
              <p class="danger__text">
                不再使用时可删除本档案；服务端会同步清理该档案下的全部用餐记录。
              </p>
              <AppButton size="sm" variant="secondary" @click="confirmingDelete = true">
                删除档案…
              </AppButton>
            </template>
            <template v-else>
              <p class="danger__title">确认删除？</p>
              <p class="danger__text">
                将删除档案与全部用餐记录，删除后无法恢复，历史统计会一并归零。
              </p>
              <AppErrorBanner v-if="deleteError" :error="deleteError" />
              <div class="danger__actions">
                <AppButton
                  size="sm"
                  variant="secondary"
                  :disabled="deleting"
                  @click="confirmingDelete = false"
                >
                  取消
                </AppButton>
                <AppButton size="sm" variant="danger" :loading="deleting" @click="confirmDelete">
                  确认删除
                </AppButton>
              </div>
            </template>
          </AppCard>
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
.summary {
  background: var(--color-info-bg);
}
.summary__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}
.summary__item {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}
.summary__label {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.summary__value {
  font-size: var(--font-size-lg);
  font-variant-numeric: tabular-nums;
}
.summary__value--text {
  font-size: var(--font-size-md);
}
.summary__tag {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}
.summary__warnings {
  margin: var(--space-2) 0 0;
  padding-left: 1.2em;
  color: var(--color-warn);
  font-size: var(--font-size-sm);
}
.notice {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-ok-bg);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}
.notice-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  background: var(--color-info-bg);
}
.notice-card__line {
  margin: 0;
  color: var(--color-info);
  font-size: var(--font-size-md);
}
.target-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.target-entry__title {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
}
.target-entry__meta {
  margin: 2px 0 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
.danger {
  border-color: var(--color-danger);
}
.danger__title {
  margin: 0 0 var(--space-1);
  color: var(--color-danger);
  font-size: var(--font-size-md);
  font-weight: 600;
}
.danger__text {
  margin: 0 0 var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
.danger__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
