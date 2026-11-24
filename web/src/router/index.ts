// 路由：FE-A 负责建档 / 目标与忌口 / 推荐；FE-B 负责回填 / 反馈 / 历史 与组件故事页（COLLAB.md 防线 2）。
// 2026-11-24 PD：底部导航取消，改由首页（/）四张卡片做入口；建档页只在没有档案时出现，
// 改档与删除走个人中心（/mine）。
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/home/HomeView.vue';
import HistoryView from '@/views/history/HistoryView.vue';
import LogView from '@/views/log/LogView.vue';
import FeedbackView from '@/views/feedback/FeedbackView.vue';
import ProfileView from '@/views/profile/ProfileView.vue';
import MineView from '@/views/mine/MineView.vue';
import GoalView from '@/views/goal/GoalView.vue';
import RecommendView from '@/views/recommend/RecommendView.vue';
import StoryView from '@/dev/StoryView.vue';

export const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/profile', name: 'profile', component: ProfileView },
  { path: '/goal', name: 'goal', component: GoalView },
  { path: '/recommend', name: 'recommend', component: RecommendView },
  { path: '/log', name: 'log', component: LogView },
  { path: '/feedback', name: 'feedback', component: FeedbackView },
  { path: '/history', name: 'history', component: HistoryView },
  { path: '/mine', name: 'mine', component: MineView },
  { path: '/dev/components', name: 'design-system', component: StoryView },
  { path: '/:pathMatch(.*)*', name: 'not-found', redirect: '/' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});
