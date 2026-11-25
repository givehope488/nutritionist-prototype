<script setup lang="ts">
// 体征表单：建档页（新用户）与个人中心（改档）共用（PD 2026-11-24）。
// 2026-11-25：饮食目标改为四档（保持 / 减肥 / 增肌 / 增重）直接在这里选，
// 建档和个人中心共用同一份控件；避免只在一处能改、另一处悄悄带默认值。
// 边界（架构 D1 / 分层护栏）：组件只维护输入与区间预校验，**不直接调接口**——
// submit 事件把 ProfileInput 交给页面，保存结果与错误再由 props 回传。
import { computed, reactive, watch } from 'vue';
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
import { GOAL_OPTIONS, MEAL_OPTIONS } from '@/utils/labels';

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
  // 目标在下方「饮食目标」卡片里选；忌口仍由目标页编辑，这里原样带回，避免保存体征时被重置
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

/** 表单里的年龄是实时输入的：改到 18 岁以下时立刻锁掉减肥，不必等保存 */
const isMinor = computed(() => {
  const age = Number(form.age.trim());
  return Number.isFinite(age) && age > 0 && age < MINOR_AGE;
});

/** 未成年双保险的前端半边：禁用减肥并写明原因；服务端仍会兜底降级。 */
const goalOptions = computed<RadioOption[]>(() =>
  GOAL_OPTIONS.map((option) =>
    option.value === 'lose' && isMinor.value
      ? {
          ...option,
          disabled: true,
          disabledReason: `未满 ${MINOR_AGE} 岁不提供热量缺口方案`,
        }
      : { ...option },
  ),
);

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

    <AppCard title="饮食目标" subtitle="决定目标热量与脂肪口径，推荐会按它调整">
      <AppField label="目标" required :error="fieldErrors.goal">
        <AppRadioGroup v-model="form.goal" name="goal" direction="column" :options="goalOptions" />
      </AppField>
      <p v-if="isMinor" class="rule-note">
        未满 {{ MINOR_AGE }} 岁只提供保持 / 增肌 / 增重方案；减肥选项已锁定，服务端会再次校验。
      </p>
      <p v-else class="rule-note">减肥会下调目标热量并减少脂肪占比；增肌、增重会提高目标热量。</p>
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
.rule-note {
  margin: var(--space-2) 0 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
</style>
