// 路由：FE-A 负责建档 / 目标与忌口 / 推荐；FE-B 负责回填 / 反馈 / 历史 与组件故事页（COLLAB.md 防线 2）。
import { createRouter, createWebHistory } from 'vue-router';
import HistoryView from '@/views/history/HistoryView.vue';
import LogView from '@/views/log/LogView.vue';
import FeedbackView from '@/views/feedback/FeedbackView.vue';
import ProfileView from '@/views/profile/ProfileView.vue';
import GoalView from '@/views/goal/GoalView.vue';
import RecommendView from '@/views/recommend/RecommendView.vue';
import StoryView from '@/dev/StoryView.vue';

export const routes = [
  // 主流程从建档开始；已建档用户可在导航里直接切到推荐
  { path: '/', redirect: '/profile' },
  { path: '/profile', name: 'profile', component: ProfileView, meta: { step: 1 } },
  { path: '/goal', name: 'goal', component: GoalView, meta: { step: 2 } },
  { path: '/recommend', name: 'recommend', component: RecommendView, meta: { step: 3 } },
  { path: '/log', name: 'log', component: LogView, meta: { step: 4 } },
  { path: '/feedback', name: 'feedback', component: FeedbackView, meta: { step: 5 } },
  { path: '/history', name: 'history', component: HistoryView },
  { path: '/dev/components', name: 'design-system', component: StoryView },
  { path: '/:pathMatch(.*)*', name: 'not-found', redirect: '/profile' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});
