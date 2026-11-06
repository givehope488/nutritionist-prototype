<script setup lang="ts">
// 组件故事页（TEAM.md W1 验收：组件故事页可预览）。
// 只在开发环境路由 /dev/components 下可见，用于设计系统走查与 FE-A 取用参考。
import { ref } from 'vue';
import { APP_ERROR_CODES, SWATCHES, TYPOGRAPHY_ROWS } from '@/dev/storyData';
import {
  sampleCombo,
  sampleDishA,
  sampleDishB,
  sampleDishDrink,
  sampleMealLog,
  sampleProfile,
  sampleTarget,
} from '@/dev/fixtures';
import AppBadge from '@/components/base/AppBadge.vue';
import AppButton from '@/components/base/AppButton.vue';
import AppCard from '@/components/base/AppCard.vue';
import AppChip from '@/components/base/AppChip.vue';
import AppDisclaimer from '@/components/base/AppDisclaimer.vue';
import AppEmpty from '@/components/base/AppEmpty.vue';
import AppErrorBanner from '@/components/base/AppErrorBanner.vue';
import AppField from '@/components/base/AppField.vue';
import AppLoading from '@/components/base/AppLoading.vue';
import AppNavBar from '@/components/base/AppNavBar.vue';
import AppNumberField from '@/components/base/AppNumberField.vue';
import AppRadioGroup from '@/components/base/AppRadioGroup.vue';
import AppSegmented from '@/components/base/AppSegmented.vue';
import AppStepBar from '@/components/base/AppStepBar.vue';
import AppStepper from '@/components/base/AppStepper.vue';
import AppTabs from '@/components/base/AppTabs.vue';
import ComboCard from '@/components/business/ComboCard.vue';
import DishCard from '@/components/business/DishCard.vue';
import NutritionSummary from '@/components/business/NutritionSummary.vue';
import VerdictCard from '@/components/business/VerdictCard.vue';

const servings = ref(1);
const category = ref('protein');
const meal = ref('lunch');
const goal = ref('health');
const avoid = ref<string[]>(['nospicy']);
const height = ref('172');

const tabs = [
  { value: 'staple', label: '主食', count: 16 },
  { value: 'protein', label: '主菜', count: 24 },
  { value: 'veg', label: '蔬菜', count: 9 },
  { value: 'soup', label: '汤品', count: 4 },
  { value: 'fruit', label: '水果', count: 2 },
];

const goalOptions = [
  { value: 'health', label: '日常保健', hint: '维持体重' },
  { value: 'lose', label: '减脂', hint: '热量缺口' },
  { value: 'gain', label: '增肌', hint: '热量盈余' },
];

const lockedGoalOptions = [
  ...goalOptions.slice(0, 1),
  { ...goalOptions[1], disabled: true, disabledReason: '未满 18 岁不提供热量缺口' },
  ...goalOptions.slice(2),
];

function goBack(): void {
  window.history.back();
}

const avoidOptions = ['不吃辣', '不吃猪肉', '不吃海鲜', '素食', '不吃奶制品'];
</script>

<template>
  <div class="story">
    <AppNavBar title="设计系统 · 组件库" subtitle="FE-B / 移动端 H5" :back-label="'页面'" @back="goBack()" />

    <div class="story__body">
      <AppCard title="色板 Tokens">
        <ul class="swatches">
          <li v-for="item in SWATCHES" :key="item.token" class="swatch">
            <i class="swatch__chip" :style="{ background: `var(${item.token})` }" />
            <span class="swatch__token">{{ item.token }}</span>
            <span class="swatch__use">{{ item.use }}</span>
          </li>
        </ul>
      </AppCard>

      <AppCard title="字号">
        <p v-for="row in TYPOGRAPHY_ROWS" :key="row.token" :style="{ fontSize: `var(${row.token})` }">
          {{ row.sample }}
          <span class="story__meta">{{ row.token }} · {{ row.use }}</span>
        </p>
      </AppCard>

      <AppCard title="按钮 AppButton">
        <div class="story__row">
          <AppButton>主要操作</AppButton>
          <AppButton variant="secondary">次要</AppButton>
          <AppButton variant="ghost">文字</AppButton>
          <AppButton variant="danger">危险</AppButton>
        </div>
        <div class="story__row">
          <AppButton size="sm">小号</AppButton>
          <AppButton loading>提交中</AppButton>
          <AppButton disabled>不可用</AppButton>
        </div>
        <AppButton block>整行按钮</AppButton>
      </AppCard>

      <AppCard title="主流程步骤条 AppStepBar">
        <AppStepBar :steps="['建档', '目标与忌口', '推荐', '回填', '反馈']" :current="3" />
      </AppCard>

      <AppCard title="分段控件 / Tab / Chip">
        <AppSegmented
          v-model="meal" :items="[
            { value: 'breakfast', label: '早餐' },
            { value: 'lunch', label: '午餐' },
            { value: 'dinner', label: '晚餐' },
          ]"
        />
        <AppTabs v-model="category" class="story__tabs" :items="tabs" />
        <div class="story__row story__row--wrap">
          <AppChip
            v-for="option in avoidOptions"
            :key="option"
            :label="option"
            :active="avoid.includes(option)"
            @toggle="
              avoid = avoid.includes(option) ? avoid.filter((item) => item !== option) : [...avoid, option]
            "
          />
        </div>
      </AppCard>

      <AppCard title="份数步进器 AppStepper（0.5 步进 / 上限 5）">
        <div class="story__row">
          <AppStepper v-model="servings" />
          <AppStepper v-model="servings" size="sm" />
          <AppStepper :model-value="0" disabled />
        </div>
        <p class="story__meta">当前 {{ servings }} 份</p>
      </AppCard>

      <AppCard title="表单 AppField + AppNumberField + AppRadioGroup">
        <AppField label="身高" required :hint="`范围 140~210，服务端也会校验（当前档案 ${sampleProfile.height_cm}cm）`">
          <AppNumberField v-model="height" unit="cm" inputmode="decimal" />
        </AppField>
        <AppField label="体重" required error="取值须在 35~150">
          <AppNumberField model-value="32" unit="kg" invalid />
        </AppField>
        <AppField label="目标">
          <AppRadioGroup v-model="goal" :options="goalOptions" :name="'goal-demo'" />
        </AppField>
        <AppField label="目标（未成年双保险）" hint="age<18 时减脂不可选，服务端会强制降级并回 warnings">
          <AppRadioGroup model-value="health" :options="lockedGoalOptions" :name="'goal-locked'" />
        </AppField>
      </AppCard>

      <AppCard title="菜品行卡 DishCard">
        <div class="story__stack">
          <DishCard :dish="sampleDishA" :model-value="servings" @update:model-value="servings = $event" />
          <DishCard :dish="sampleDishB" :model-value="0" />
          <DishCard :dish="sampleDishDrink" :model-value="1" />
        </div>
        <p class="story__meta">
          A 级数据显示精确克重，B/C 级只显示「估算值」徽标（README 合规边界 4）。
        </p>
      </AppCard>

      <AppCard title="宏量对比条 NutritionSummary / MacroBar">
        <NutritionSummary :totals="sampleCombo.totals" :target="sampleTarget" />
      </AppCard>

      <AppCard title="判定卡 VerdictCard">
        <div class="story__stack">
          <VerdictCard :verdict="sampleMealLog.verdict" :adopted="true" />
          <VerdictCard
            :verdict="{ level: 'warn', title: '这餐超了不少', body: '这一餐 1120 kcal，比午餐目标 913 kcal 多了 207 kcal。' }"
            :adopted="false"
            :duplicate="true"
          />
        </div>
      </AppCard>

      <AppCard title="推荐组合卡 ComboCard（FE-A 推荐页消费）">
        <ComboCard :combo="sampleCombo" :target="sampleTarget" :index="1" />
      </AppCard>

      <AppCard title="状态组件 徽标 / 空态 / 加载 / 错误">
        <div class="story__row story__row--wrap">
          <AppBadge>neutral</AppBadge>
          <AppBadge tone="brand">brand</AppBadge>
          <AppBadge tone="ok" dot>达标</AppBadge>
          <AppBadge tone="warn" dot>需调整</AppBadge>
          <AppBadge tone="info">饮品</AppBadge>
          <AppBadge tone="danger">降级</AppBadge>
        </div>
        <AppEmpty title="这段时间还没有记录" description="吃完饭回填一下就有反馈了。" action-label="去回填" />
        <AppLoading :rows="2" />
        <AppErrorBanner :error="{ code: 'VALIDATION_ERROR', message: '请求参数不合法', fields: [{ path: 'height_cm', issue: '取值须在 140~210' }] }" />
        <AppErrorBanner v-for="code in APP_ERROR_CODES" :key="code" :error="{ code, message: `${code} 示例` }" />
      </AppCard>

      <AppDisclaimer />
    </div>
  </div>
</template>

<style scoped>
.story__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
}
.story__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.story__row--wrap {
  flex-wrap: wrap;
}
.story__stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.story__tabs {
  margin: var(--space-3) 0;
}
.story__meta {
  margin: var(--space-1) 0 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.swatch {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--font-size-xs);
}
.swatch__chip {
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.swatch__token {
  font-family: ui-monospace, monospace;
}
.swatch__use {
  color: var(--color-text-tertiary);
}
</style>
