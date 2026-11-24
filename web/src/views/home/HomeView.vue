<script setup lang="ts">
// 首页：底部导航取消后，四个入口都从这里进（PD 2026-11-24）。
// 边界：这里只做导航与档案概览；BMI / 日目标来自 GET /profiles/me，不在前端重算。
// 未建档时把建档做成一张显眼的卡，而不是自动跳转——否则「首页 → 建档 → 返回首页」会打转。
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Profile } from '@canteen/shared';
import { getProfile } from '@/api/endpoints';
import AppCard from '@/components/base/AppCard.vue';
import AppLoading from '@/components/base/AppLoading.vue';
import { sessionId } from '@/composables/useSession';

const router = useRouter();

const loading = ref(true);
const profile = ref<Profile | null>(null);

const WEEK_LABEL = ['日', '一', '二', '三', '四', '五', '六'];
const today = computed(() => {
  const now = new Date();
  return `今天 · ${now.getMonth() + 1}月${now.getDate()}日 周${WEEK_LABEL[now.getDay()]}`;
});

const entries = [
  {
    name: 'recommend',
    title: '饮食推荐',
    desc: '按你的档案配这一餐，可换一批或只换其中一张',
  },
  {
    name: 'log',
    title: '用餐回填',
    desc: '吃完了来打卡，热量对比由服务端算给你',
  },
  {
    name: 'history',
    title: '营养历史',
    desc: '看最近几天的执行情况与达标率',
  },
  {
    name: 'mine',
    title: '个人中心',
    desc: '改体征、调目标与忌口，或删除档案',
  },
] as const;

onMounted(async () => {
  const result = await getProfile(sessionId);
  loading.value = false;
  if (result.ok) profile.value = result.data;
});
</script>

<template>
  <div class="home">
    <header class="home__head">
      <p class="home__date">{{ today }}</p>
      <h1 class="home__title">食堂营养师</h1>
      <p class="home__sub">先看清这一餐的目标，再决定吃什么</p>
    </header>

    <div class="home__body">
      <AppLoading v-if="loading" :rows="2" label="读取档案…" />

      <template v-else>
        <AppCard v-if="profile" padding="tight" class="brief">
          <div class="brief__row">
            <div class="brief__item">
              <span class="brief__label">BMI</span>
              <strong class="brief__value">{{ profile.bmi }}</strong>
              <span class="brief__tag">{{ profile.bmi_tag }}</span>
            </div>
            <div class="brief__item">
              <span class="brief__label">日目标</span>
              <strong class="brief__value">{{ profile.day_kcal }}</strong>
              <span class="brief__tag">kcal</span>
            </div>
          </div>
        </AppCard>

        <AppCard v-else padding="tight" class="brief brief--empty">
          <p class="brief__line">还没有建档，先填三项体征，推荐和回填才能对上你的目标。</p>
          <button class="brief__action" type="button" @click="router.push({ name: 'profile' })">
            去建档
          </button>
        </AppCard>

        <nav class="entries" aria-label="功能入口">
          <button
            v-for="entry in entries"
            :key="entry.name"
            class="entry"
            type="button"
            @click="router.push({ name: entry.name })"
          >
            <span class="entry__text">
              <span class="entry__title">{{ entry.title }}</span>
              <span class="entry__desc">{{ entry.desc }}</span>
            </span>
            <span class="entry__arrow" aria-hidden="true">›</span>
          </button>
        </nav>
      </template>
    </div>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
}
.home__head {
  padding: calc(var(--space-6) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-4);
  background: linear-gradient(160deg, var(--color-brand-50), var(--color-bg-page) 70%);
}
.home__date {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
.home__title {
  margin: var(--space-1) 0 0;
  font-size: var(--font-size-2xl, var(--font-size-xl));
  font-weight: 700;
  letter-spacing: 1px;
}
.home__sub {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
.home__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3) var(--space-6);
}
.brief {
  background: var(--color-info-bg);
}
.brief__row {
  display: flex;
  gap: var(--space-6);
}
.brief__item {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}
.brief__label {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.brief__value {
  font-size: var(--font-size-xl);
  font-variant-numeric: tabular-nums;
}
.brief__tag {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}
.brief--empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  background: var(--color-warn-bg, var(--color-info-bg));
}
.brief__line {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
}
.brief__action {
  min-height: var(--size-touch);
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-brand-600);
  color: #fff;
  font-size: var(--font-size-md);
  font-weight: 600;
  cursor: pointer;
}
.entries {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: calc(var(--size-touch) + var(--space-4));
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  text-align: left;
  cursor: pointer;
}
.entry:active {
  background: var(--color-brand-50);
  border-color: var(--color-brand-300);
}
.entry__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.entry__title {
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  font-weight: 600;
}
.entry__desc {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}
.entry__arrow {
  flex: none;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xl);
}
</style>
