<script setup lang="ts">
// 建档页（主流程第 1 步）：体征 + 活动量 + 默认餐次。
// 边界：区间提示直接取 PROFILE_BOUNDS（与 §2.2 同源）；BMI / 日目标是服务端派生值，
// 本页只展示 getProfile / saveProfile 的返回值，不做任何营养计算（架构 D1）。
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { MINOR_AGE, PROFILE_BOUNDS } from '@canteen/shared';
import type { Activity, ApiError, Goal, Meal, Profile, ProfileInput, Sex } from '@canteen/shared';
import { deleteProfile, getProfile, saveProfile } from '@/api/endpoints';
import AppButton from '@/components/base/AppButton.vue';
import AppCard from '@/components/base/AppCard.vue';
import AppErrorBanner from '@/components/base/AppErrorBanner.vue';
import AppField from '@/components/base/AppField.vue';
import AppLoading from '@/components/base/AppLoading.vue';
import AppNavBar from '@/components/base/AppNavBar.vue';
import AppNumberField from '@/components/base/AppNumberField.vue';
import AppRadioGroup from '@/components/base/AppRadioGroup.vue';
import AppSegmented from '@/components/base/AppSegmented.vue';
import AppStepBar from '@/components/base/AppStepBar.vue';
import type { RadioOption } from '@/components/types';
import { sessionId } from '@/composables/useSession';
import { clearRecommendationCache } from '@/composables/useRecommendationCache';
import { MEAL_OPTIONS } from '@/utils/labels';

const router = useRouter();

const loading = ref(true);
const saving = ref(false);
const error = ref<ApiError | null>(null);
const fieldErrors = reactive<Record<string, string>>({});
const serverProfile = ref<Profile | null>(null);
// 合规删除入口（API.md v1.2.4 §2.2）：必须二次确认，且文案写明连带删除全部用餐记录
const confirmingDelete = ref(false);
const deleting = ref(false);
const deleteError = ref<ApiError | null>(null);
const deleted = ref(false);

const form = reactive({
  sex: 'male' as Sex,
  height: '',
  weight: '',
  age: '',
  activity: 'mid' as Activity,
  defaultMeal: 'lunch' as Meal,
  // 第 2 步才编辑；建档保存时沿用服务端已有值（新用户为默认值）
  goal: 'health' as Goal,
  avoid: [] as string[],
});

const STEPS = ['建档', '目标与忌口', '推荐', '回填', '反馈'];

const sexOptions: RadioOption[] = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
];

const activityOptions: RadioOption[] = [
  { value: 'low', label: '久坐少动', hint: '几乎不运动，久坐办公 / 上课' },
  { value: 'mid', label: '每周有几次', hint: '每周 2~3 次轻度运动' },
  { value: 'high', label: '经常运动', hint: '每周 4 次以上或体力劳动' },
];

const mealItems = MEAL_OPTIONS.map((option) => ({ value: option.value, label: option.label }));

const heightHint = `范围 ${PROFILE_BOUNDS.height_cm.min}~${PROFILE_BOUNDS.height_cm.max} cm`;
const weightHint = `范围 ${PROFILE_BOUNDS.weight_kg.min}~${PROFILE_BOUNDS.weight_kg.max} kg`;
const ageHint = `范围 ${PROFILE_BOUNDS.age.min}~${PROFILE_BOUNDS.age.max} 岁；未满 ${MINOR_AGE} 岁不提供热量缺口方案`;

const summary = computed(() => {
  const profile = serverProfile.value;
  if (!profile) return null;
  return {
    bmi: profile.bmi,
    tag: profile.bmi_tag,
    dayKcal: profile.day_kcal,
    warnings: profile.warnings,
  };
});

function fillForm(profile: Profile): void {
  form.sex = profile.sex;
  form.height = String(profile.height_cm);
  form.weight = String(profile.weight_kg);
  form.age = String(profile.age);
  form.activity = profile.activity;
  form.defaultMeal = profile.default_meal;
  form.goal = profile.goal;
  form.avoid = [...profile.avoid];
}

function clearErrors(): void {
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
}

const FIELD_KEYS = new Set([
  'sex',
  'height_cm',
  'weight_kg',
  'age',
  'activity',
  'goal',
  'avoid',
  'default_meal',
]);

function applyServerError(err: ApiError): void {
  for (const field of err.fields ?? []) {
    if (FIELD_KEYS.has(field.path)) fieldErrors[field.path] = field.issue;
  }
}

function numeric(raw: string): number {
  const trimmed = raw.trim();
  return trimmed === '' ? Number.NaN : Number(trimmed);
}

/** 预校验只按 §2.2 的区间和必填判断，最终判定仍在服务端；错误文案与服务端 fields 一致 */
function validate(): boolean {
  clearErrors();
  let valid = true;

  const check = (key: 'height_cm' | 'weight_kg' | 'age', raw: string) => {
    const value = numeric(raw);
    const { min, max } = PROFILE_BOUNDS[key];
    if (Number.isNaN(value)) {
      fieldErrors[key] = '请填写数字';
      valid = false;
    } else if (value < min || value > max) {
      fieldErrors[key] = `取值须在 ${min}~${max}`;
      valid = false;
    }
  };

  check('height_cm', form.height);
  check('weight_kg', form.weight);
  check('age', form.age);
  return valid;
}

async function submit(): Promise<void> {
  if (saving.value) return;
  if (!validate()) return;
  saving.value = true;
  error.value = null;
  const input: ProfileInput = {
    session_id: sessionId,
    sex: form.sex,
    height_cm: numeric(form.height),
    weight_kg: numeric(form.weight),
    age: numeric(form.age),
    activity: form.activity,
    goal: form.goal,
    avoid: form.avoid,
    default_meal: form.defaultMeal,
  };
  const result = await saveProfile(input);
  saving.value = false;
  if (!result.ok) {
    error.value = result.error;
    applyServerError(result.error);
    return;
  }
  serverProfile.value = result.data;
  deleted.value = false;
  await router.push({ name: 'goal' });
}

function resetForm(): void {
  form.sex = 'male';
  form.height = '';
  form.weight = '';
  form.age = '';
  form.activity = 'mid';
  form.defaultMeal = 'lunch';
  form.goal = 'health';
  form.avoid = [];
  clearErrors();
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

function startDelete(): void {
  deleteError.value = null;
  confirmingDelete.value = true;
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
  serverProfile.value = null;
  confirmingDelete.value = false;
  deleted.value = true;
  resetForm();
}

onMounted(async () => {
  const result = await getProfile(sessionId);
  loading.value = false;
  if (result.ok) {
    serverProfile.value = result.data;
    fillForm(result.data);
    return;
  }
  // 404 = 尚未建档，保持空白表单；其他错误才提示
  if (result.error.code !== 'NOT_FOUND') error.value = result.error;
});
</script>

<template>
  <div class="page">
    <AppNavBar title="先认识一下你" subtitle="这些信息只用来估算这一餐的目标" />

    <div class="page__body">
      <AppStepBar :steps="STEPS" :current="0" />

      <AppErrorBanner v-if="error" :error="error">
        <template #action>
          <AppButton size="sm" variant="secondary" @click="error = null">知道了</AppButton>
        </template>
      </AppErrorBanner>

      <AppLoading v-if="loading" :rows="4" label="读取已有档案…" />

      <template v-else>
        <AppCard v-if="deleted" padding="tight" class="deleted">
          <p class="deleted__line">档案与全部用餐记录已删除，表单已清空，可以重新建档。</p>
        </AppCard>

        <AppCard v-if="summary" padding="tight" class="summary">
          <p class="summary__line">
            服务端当前档案：BMI <strong>{{ summary.bmi }}</strong>（{{ summary.tag }}） ·
            日目标 <strong>{{ summary.dayKcal }}</strong> kcal
          </p>
          <ul v-if="summary.warnings.length" class="summary__warnings">
            <li v-for="warning in summary.warnings" :key="warning">{{ warning }}</li>
          </ul>
        </AppCard>

        <AppCard title="基础信息" subtitle="区间与产品规则一致，保存后由服务端复核">
          <div class="form">
            <AppField label="性别" required>
              <AppRadioGroup v-model="form.sex" name="sex" :options="sexOptions" />
            </AppField>

            <AppField
              label="身高"
              required
              :hint="heightHint"
              :error="fieldErrors.height_cm"
            >
              <AppNumberField
                v-model="form.height"
                unit="cm"
                inputmode="decimal"
                :invalid="Boolean(fieldErrors.height_cm)"
              />
            </AppField>

            <AppField
              label="体重"
              required
              :hint="weightHint"
              :error="fieldErrors.weight_kg"
            >
              <AppNumberField
                v-model="form.weight"
                unit="kg"
                inputmode="decimal"
                :invalid="Boolean(fieldErrors.weight_kg)"
              />
            </AppField>

            <AppField label="年龄" required :hint="ageHint" :error="fieldErrors.age">
              <AppNumberField
                v-model="form.age"
                unit="岁"
                :invalid="Boolean(fieldErrors.age)"
              />
            </AppField>

            <AppField label="活动量" :error="fieldErrors.activity">
              <AppRadioGroup
                v-model="form.activity"
                name="activity"
                direction="column"
                :options="activityOptions"
              />
            </AppField>

            <AppField
              label="默认看哪一餐"
              hint="推荐页进入时默认选这个餐段"
              :error="fieldErrors.default_meal"
            >
              <AppSegmented v-model="form.defaultMeal" :items="mealItems" />
            </AppField>
          </div>
        </AppCard>

        <p class="hint">下一步设置目标和忌口；BMI 与日目标都由服务端计算后展示。</p>

        <AppButton block :loading="saving" @click="submit">保存，下一步设置目标</AppButton>

        <AppCard v-if="serverProfile" padding="tight" class="danger">
          <template v-if="!confirmingDelete">
            <p class="danger__title">删除档案</p>
            <p class="danger__text">
              不再使用时可删除本档案；服务端会同步清理该档案下的全部用餐记录。
            </p>
            <AppButton size="sm" variant="secondary" @click="startDelete">删除档案…</AppButton>
          </template>
          <template v-else>
            <p class="danger__title">确认删除？</p>
            <p class="danger__text">
              将删除档案与全部用餐记录，删除后无法恢复，历史统计会一并归零。
            </p>
            <AppErrorBanner v-if="deleteError" :error="deleteError" />
            <div class="danger__actions">
              <AppButton size="sm" variant="secondary" :disabled="deleting" @click="confirmingDelete = false">
                取消
              </AppButton>
              <AppButton size="sm" variant="danger" :loading="deleting" @click="confirmDelete">
                确认删除
              </AppButton>
            </div>
          </template>
        </AppCard>
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
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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
.hint {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
.deleted {
  background: var(--color-info-bg);
}
.deleted__line {
  margin: 0;
  color: var(--color-info);
  font-size: var(--font-size-md);
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
