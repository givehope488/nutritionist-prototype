<script setup lang="ts">
// 目标与忌口页（主流程第 2 步）：目标单选 + 忌口多选。
// 边界：忌口选项一律用 GET /menu 的 avoid_options（不硬编码）；未成年减肥在本地先禁用，
// 服务端仍会兜底改写 goal 并下发 warnings，本页如实展示。
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { MINOR_AGE } from '@canteen/shared';
import type { ApiError, AvoidOption, Goal, Profile, ProfileInput } from '@canteen/shared';
import { getMenu, getProfile, saveProfile } from '@/api/endpoints';
import AppButton from '@/components/base/AppButton.vue';
import AppCard from '@/components/base/AppCard.vue';
import AppChip from '@/components/base/AppChip.vue';
import AppEmpty from '@/components/base/AppEmpty.vue';
import AppErrorBanner from '@/components/base/AppErrorBanner.vue';
import AppField from '@/components/base/AppField.vue';
import AppLoading from '@/components/base/AppLoading.vue';
import AppNavBar from '@/components/base/AppNavBar.vue';
import AppRadioGroup from '@/components/base/AppRadioGroup.vue';
import type { RadioOption } from '@/components/types';
import { sessionId } from '@/composables/useSession';
import { GOAL_OPTIONS } from '@/utils/labels';

const router = useRouter();

const loading = ref(true);
const saving = ref(false);
const missingProfile = ref(false);
const error = ref<ApiError | null>(null);
const menuError = ref<ApiError | null>(null);
const savedNotice = ref<string | null>(null);

const profile = ref<Profile | null>(null);
const avoidOptions = ref<AvoidOption[]>([]);
const goal = ref<Goal>('health');
const avoid = ref<string[]>([]);

const isMinor = computed(() => (profile.value ? profile.value.age < MINOR_AGE : false));

const goalOptions = computed<RadioOption[]>(() =>
  GOAL_OPTIONS.map((option) =>
    option.value === 'lose' && isMinor.value
      ? { ...option, disabled: true, disabledReason: `未满 ${MINOR_AGE} 岁不提供热量缺口方案` }
      : { ...option },
  ),
);

const summary = computed(() => {
  const current = profile.value;
  if (!current) return null;
  return {
    bmi: current.bmi,
    tag: current.bmi_tag,
    dayKcal: current.day_kcal,
    warnings: current.warnings,
  };
});

function toggleAvoid(key: string): void {
  avoid.value = avoid.value.includes(key)
    ? avoid.value.filter((item) => item !== key)
    : [...avoid.value, key];
}

async function loadMenu(): Promise<void> {
  menuError.value = null;
  const result = await getMenu();
  if (result.ok) {
    avoidOptions.value = result.data.avoid_options;
    return;
  }
  menuError.value = result.error;
}

function buildInput(current: Profile): ProfileInput {
  return {
    session_id: sessionId,
    sex: current.sex,
    height_cm: current.height_cm,
    weight_kg: current.weight_kg,
    age: current.age,
    activity: current.activity,
    goal: goal.value,
    avoid: [...avoid.value],
    default_meal: current.default_meal,
  };
}

async function submit(goRecommend: boolean): Promise<void> {
  if (!profile.value || saving.value) return;
  saving.value = true;
  error.value = null;
  savedNotice.value = null;
  const result = await saveProfile(buildInput(profile.value));
  saving.value = false;
  if (!result.ok) {
    error.value = result.error;
    return;
  }
  profile.value = result.data;
  // 服务端可能因未成年把 lose 改回 health，以前端收到的值为准
  goal.value = result.data.goal;
  avoid.value = [...result.data.avoid];
  savedNotice.value = `已保存：日目标 ${result.data.day_kcal} kcal · BMI ${result.data.bmi}（${result.data.bmi_tag}）`;
  if (goRecommend) await router.push({ name: 'recommend' });
}

onMounted(async () => {
  const [profileResult] = await Promise.all([getProfile(sessionId), loadMenu()]);
  loading.value = false;
  if (!profileResult.ok) {
    if (profileResult.error.code === 'NOT_FOUND') missingProfile.value = true;
    else error.value = profileResult.error;
    return;
  }
  profile.value = profileResult.data;
  goal.value = profileResult.data.goal;
  avoid.value = [...profileResult.data.avoid];
});
</script>

<template>
  <div class="page">
    <AppNavBar
      title="目标与忌口"
      subtitle="决定推荐的能量口径和过滤条件"
      back-label="首页"
      @back="router.push({ name: 'home' })"
    />

    <div class="page__body">
      <AppErrorBanner v-if="error" :error="error" />
      <AppErrorBanner v-if="menuError" :error="menuError">
        <template #action>
          <AppButton size="sm" variant="secondary" @click="loadMenu">重新加载忌口选项</AppButton>
        </template>
      </AppErrorBanner>

      <AppLoading v-if="loading" :rows="4" label="读取档案与忌口选项…" />

      <AppEmpty
        v-else-if="missingProfile"
        title="还没有建档"
        description="目标和忌口要基于身高体重来算，先花一分钟建档吧。"
        action-label="去建档"
        @action="router.push({ name: 'profile' })"
      />

      <template v-else-if="profile">
        <AppCard v-if="summary" padding="tight" class="summary">
          <p class="summary__line">
            服务端当前档案：BMI <strong>{{ summary.bmi }}</strong>（{{ summary.tag }}） ·
            日目标 <strong>{{ summary.dayKcal }}</strong> kcal
          </p>
          <ul v-if="summary.warnings.length" class="summary__warnings">
            <li v-for="warning in summary.warnings" :key="warning">{{ warning }}</li>
          </ul>
        </AppCard>

        <p v-if="savedNotice" class="saved" role="status">{{ savedNotice }}</p>

        <AppCard title="你想吃成什么样">
          <AppField label="目标" required>
            <AppRadioGroup v-model="goal" name="goal" direction="column" :options="goalOptions" />
          </AppField>
          <p v-if="isMinor" class="rule-note">
            未满 {{ MINOR_AGE }} 岁只提供保持 / 增肌 / 增重方案；这是产品合规规则，服务端会再次校验。
          </p>
        </AppCard>

        <AppCard title="不吃什么" subtitle="可多选；推荐时会过滤掉带对应标签的菜">
          <div v-if="avoidOptions.length" class="chips">
            <AppChip
              v-for="option in avoidOptions"
              :key="option.key"
              :label="option.label"
              :active="avoid.includes(option.key)"
              @toggle="toggleAvoid(option.key)"
            />
          </div>
          <p v-else class="rule-note">忌口选项暂时没加载到，可以先保存目标，稍后再来选。</p>
        </AppCard>

        <AppButton block :loading="saving" @click="submit(true)">保存，看这餐推荐</AppButton>
        <AppButton block variant="secondary" :disabled="saving" @click="submit(false)">
          只保存目标
        </AppButton>
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
.summary__line {
  margin: 0;
  color: var(--color-info);
  font-size: var(--font-size-md);
}
.summary__warnings {
  margin: var(--space-2) 0 0;
  padding-left: 1.2em;
  color: var(--color-warn);
  font-size: var(--font-size-sm);
}
.saved {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-ok-bg);
  color: var(--color-ok);
  font-size: var(--font-size-sm);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.rule-note {
  margin: var(--space-2) 0 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
</style>
