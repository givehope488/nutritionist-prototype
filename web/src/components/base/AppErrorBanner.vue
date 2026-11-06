<script setup lang="ts">
// 统一错误提示：按 API.md §1 的「前端处置」列把错误码翻成可操作文案
import { computed } from 'vue';
import type { ApiError } from '@shared/types';

const props = defineProps<{ error: ApiError }>();

const GUIDE: Record<ApiError['code'], string> = {
  VALIDATION_ERROR: '请检查填写内容',
  UNAUTHORIZED: '登录状态已失效，请重新登录',
  NOT_FOUND: '内容不存在或已下架',
  CONFLICT: '数据已被他人修改，请刷新后重试',
  RATE_LIMITED: '操作太快了，稍后再试',
  INTERNAL: '服务开小差了，稍后重试',
};

const tone = computed(() => (props.error.code === 'INTERNAL' ? 'danger' : 'warn'));
</script>

<template>
  <div :class="['errorbox', `errorbox--${tone}`]" role="alert">
    <div class="errorbox__head">
      <strong>{{ error.message || GUIDE[error.code] }}</strong>
      <span class="errorbox__code">{{ error.code }}</span>
    </div>
    <ul v-if="error.fields?.length" class="errorbox__fields">
      <li v-for="field in error.fields" :key="field.path">
        <code>{{ field.path }}</code>：{{ field.issue }}
      </li>
    </ul>
    <slot name="action" />
  </div>
</template>

<style scoped>
.errorbox {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
}
.errorbox--warn {
  background: var(--color-warn-bg);
  color: var(--color-warn);
}
.errorbox--danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}
.errorbox__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.errorbox__code {
  opacity: 0.7;
  font-size: var(--font-size-xs);
}
.errorbox__fields {
  margin: var(--space-2) 0 0;
  padding-left: var(--space-4);
}
.errorbox__fields code {
  font-size: var(--font-size-xs);
}
</style>
