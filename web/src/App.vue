<script setup lang="ts">
// 应用外壳：页面容器 + 底部导航 + 全局免责声明。
// FE-B 只在导航里挂自己负责的两页，FE-A 页面合并后补「推荐」入口。
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

    <nav v-if="!isStory" class="tabbar" aria-label="主导航">
      <RouterLink class="tabbar__item" to="/log">回填</RouterLink>
      <RouterLink class="tabbar__item" to="/history">历史</RouterLink>
      <RouterLink class="tabbar__item tabbar__item--dev" to="/dev/components">组件库</RouterLink>
    </nav>

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
  padding-bottom: calc(var(--size-touch) + var(--space-8) + var(--app-safe-bottom));
}
.app__main--story {
  padding-bottom: var(--space-6);
}
.app__footer {
  padding-bottom: calc(var(--size-touch) + var(--app-safe-bottom));
}
.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  margin: 0 auto;
  max-width: var(--app-max-width);
  padding-bottom: var(--app-safe-bottom);
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-surface);
}
.tabbar__item {
  flex: 1;
  min-height: var(--size-touch);
  display: grid;
  place-items: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}
.tabbar__item--dev {
  color: var(--color-text-tertiary);
}
.tabbar__item.router-link-active {
  color: var(--color-brand-600);
  font-weight: 600;
}
</style>
