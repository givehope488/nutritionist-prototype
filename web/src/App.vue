<script setup lang="ts">
// 应用外壳：页面容器 + 全局免责声明。
// 2026-11-24 PD：底部导航取消，导航收进首页；页面之间的「上一层」由各页顶部返回键
// 统一回到首页（返回键在各 View 的 AppNavBar 上）。组件故事页是 FE-B 的开发页，
// 直接访问 /dev/components，不进任何用户导航。
import { useRoute } from 'vue-router';
import AppDisclaimer from '@/components/base/AppDisclaimer.vue';

const route = useRoute();
const isStory = route.name === 'design-system';
</script>

<template>
  <div class="app">
    <main :class="['app__main', { 'app__main--story': isStory }]">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>

    <footer v-if="!isStory" class="app__footer">
      <AppDisclaimer />
    </footer>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.app__main {
  flex: 1;
}
.app__main--story {
  padding-bottom: var(--space-6);
}
.app__footer {
  padding: var(--space-2) var(--space-3) calc(var(--space-3) + var(--app-safe-bottom));
}
</style>
