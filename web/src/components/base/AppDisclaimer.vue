<script setup lang="ts">
// 合规免责声明：全流程展示（README 合规边界 1），页面底部统一引用本组件
</script>

<template>
  <p class="disclaimer">
    <slot>本产品输出为日常膳食参考，不构成医疗或营养处方建议。未满 18 岁用户不提供热量缺口方案。</slot>
  </p>
</template>

<style scoped>
.disclaimer {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.45;
  text-align: center;
}
</style>
