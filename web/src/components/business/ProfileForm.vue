<script setup lang="ts">
// 体征表单：建档页（新用户）与个人中心（改档）共用（PD 2026-11-24）。
// 边界（架构 D1 / 分层护栏）：组件只维护输入与区间预校验，**不直接调接口**——
// submit 事件把 ProfileInput 交给页面，保存结果与错误再由 props 回传。
import { reactive, watch } from 'vue';
import { MINOR_AGE, PROFILE_BOUNDS } from '@canteen/shared';
import type { Activity, ApiError, Goal, Meal, Profile, ProfileInput, Sex } from '@canteen/shared';
import AppButton from '@/components/base/AppButton.vue';
import AppCard from '@/components/base/AppCard.vue';
import AppErrorBanner from '@/components/base/AppErrorBanner.vue';
import AppField from '@/components/base/AppField.vue';
import AppNumberField from '@/components/base/AppNumberField.vue';
import AppRadioGroup from '@/components/base/AppRadioGroup.vue';
import AppSegmented from '@/components/base/AppSegmented.vue';
import type { RadioOption } from '@/components/types';
import { sessionId } from '@/composables/useSession';
import { MEAL_OPTIONS } from '@/utils/labels';

const props = withDefaults(
  defineProps<{
    /** 已有档案时用于预填；为空则按新用户默认值 */
    profile?: Profile | null;
    submitLabel?: string;
    /** 页面正在保存：按钮转 loading，禁止重复提交 */
    saving?: boolean;
    /** 页面保存失败：字段级错误从这里回填到对应输入框 */
    error?: ApiError | null;
  }>(),
  { profile: null, submitLabel: '保存', saving: false, error: null },
);

const emit = defineEmits<{ submit: [input: ProfileInput] }>();

const fieldErrors = reactive<Record<string, string>>({});

const form = reactive({
  sex: 'male' as Sex,
  height: '',
  weight: '',
  age: '',
  activity: 'mid' as Activity,
  defaultMeal: 'lunch' as Meal,
  // 目标与忌口在专门页面编辑；这里原样带回去，避免保存体征时把它们重置成默认值
  goal: 'health' as Goal,
  avoid: [] as string[],
});

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

watch(
  () => props.profile,
  (profile) => {
    if (profile) fillForm(profile);
  },
  { immediate: true },
);

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

watch(
  () => props.error,
  (err) => {
    clearErrors();
    for (const field of err?.fields ?? []) {
      if (FIELD_KEYS.has(field.path)) fieldErrors[field.path] = field.issue;
    }
  },
);

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

function submit(): void {
  if (props.saving) return;
  if (!validate()) return;
  emit('submit', {
    session_id: sessionId,
    sex: form.sex,
    height_cm: numeric(form.height),
    weight_kg: numeric(form.weight),
    age: numeric(form.age),
    activity: form.activity,
    goal: form.goal,
    avoid: form.avoid,
    default_meal: form.defaultMeal,
  });
}

/** 保存成功后由页面回写服务端档案；这里同步一次，避免服务端改写（如未成年改 goal）后表单还显示旧值 */
defineExpose({ fillForm });
</script>

<template>
  <div class="profile-form">
    <AppErrorBanner v-if="error" :error="error" />

    <AppCard title="基础信息" subtitle="区间与产品规则一致，保存后由服务端复核">
      <div class="form">
        <AppField label="性别" required>
          <AppRadioGroup v-model="form.sex" name="sex" :options="sexOptions" />
        </AppField>

        <AppField label="身高" required :hint="heightHint" :error="fieldErrors.height_cm">
          <AppNumberField
            v-model="form.height"
            unit="cm"
            inputmode="decimal"
            :invalid="Boolean(fieldErrors.height_cm)"
          />
        </AppField>

        <AppField label="体重" required :hint="weightHint" :error="fieldErrors.weight_kg">
          <AppNumberField
            v-model="form.weight"
            unit="kg"
            inputmode="decimal"
            :invalid="Boolean(fieldErrors.weight_kg)"
          />
        </AppField>

        <AppField label="年龄" required :hint="ageHint" :error="fieldErrors.age">
          <AppNumberField v-model="form.age" unit="岁" :invalid="Boolean(fieldErrors.age)" />
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

    <AppButton block :loading="saving" @click="submit">{{ submitLabel }}</AppButton>
  </div>
</template>

<style scoped>
.profile-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
