// 路由：FE-B 负责回填 / 反馈 / 历史 三页与组件故事页。
// 建档 / 目标 / 推荐三页属 FE-A（COLLAB.md 防线 2），此处只登记其占位路径，避免路由名冲突。
import { createRouter, createWebHistory } from 'vue-router';
import HistoryView from '@/views/HistoryView.vue';
import LogView from '@/views/LogView.vue';
import FeedbackView from '@/views/FeedbackView.vue';
import StoryView from '@/dev/StoryView.vue';

export const routes = [
  // 临时落地页：FE-A 的建档页（/profile）合并后改回 '/profile' 并同步 README
  { path: '/', redirect: '/history' },
  { path: '/log', name: 'log', component: LogView, meta: { step: 4 } },
  { path: '/feedback', name: 'feedback', component: FeedbackView, meta: { step: 5 } },
  { path: '/history', name: 'history', component: HistoryView },
  { path: '/dev/components', name: 'design-system', component: StoryView },
  // FE-A 路由占位：合并后由 FE-A 替换 component，FE-B 不改这段
  { path: '/profile', name: 'profile-placeholder', redirect: '/history' },
  { path: '/recommend', name: 'recommend-placeholder', redirect: '/log' },
  { path: '/:pathMatch(.*)*', name: 'not-found', redirect: '/history' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});
