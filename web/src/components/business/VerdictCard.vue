<script setup lang="ts">
// 判定卡：level / title / body 全部来自服务端 verdict（API.md §2.4），前端不判断达标与否。
import type { Verdict } from '@canteen/shared';
import AppBadge from '../base/AppBadge.vue';

withDefaults(
  defineProps<{
    verdict: Verdict;
    adopted?: boolean;
    duplicate?: boolean;
  }>(),
  { adopted: false, duplicate: false },
);
</script>

<template>
  <div class="verdict" :data-level="verdict.level">
    <div class="verdict__head">
      <AppBadge :tone="verdict.level === 'ok' ? 'ok' : 'warn'" size="md" dot>
        {{ verdict.level === 'ok' ? '达标' : '需调整' }}
      </AppBadge>
      <h2 class="verdict__title">{{ verdict.title }}</h2>
    </div>
    <p class="verdict__body">{{ verdict.body }}</p>
    <p class="verdict__notes">
      <span v-if="adopted" class="verdict__note">按推荐搭配吃的，继续保持</span>
      <span v-else class="verdict__note">这次是自选搭配</span>
      <span v-if="duplicate" class="verdict__note verdict__note--warn">
        这餐已记录过，展示的是首次提交结果
      </span>
    </p>
  </div>
</template>

<style scoped>
.verdict {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--color-ok-bg);
}
.verdict[data-level='warn'] {
  background: var(--color-warn-bg);
}
.verdict__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.verdict__title {
  margin: 0;
  font-size: var(--font-size-xl);
}
.verdict[data-level='ok'] .verdict__title {
  color: var(--color-ok);
}
.verdict[data-level='warn'] .verdict__title {
  color: var(--color-warn);
}
.verdict__body {
  margin: var(--space-2) 0 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
}
.verdict__notes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
}
.verdict__note {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}
.verdict__note--warn {
  color: var(--color-warn);
}
</style>
