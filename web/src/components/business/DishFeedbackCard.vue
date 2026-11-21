<script setup lang="ts">
// 菜品反馈入口（W3-C5）：固定入口放在反馈页，复用「反馈走群收集」的既有渠道。
// 只生成可转发的文本，不发请求——上报链路不新增契约与后端端点。
import { computed, ref } from 'vue';
import AppButton from '../base/AppButton.vue';
import AppCard from '../base/AppCard.vue';
import AppChip from '../base/AppChip.vue';
import AppField from '../base/AppField.vue';

const props = defineProps<{
  items: { dish_id: string; name: string }[];
  date: string;
  mealLabel: string;
}>();

const dishName = ref('');
const note = ref('');
const status = ref('');
const fallback = ref('');

const quickNames = computed(() => props.items.map((item) => item.name));

const payload = computed(() =>
  [
    `【菜品反馈】${props.date} ${props.mealLabel}`,
    `菜名：${dishName.value.trim()}`,
    ...(note.value.trim() ? [`说明：${note.value.trim()}`] : []),
    '（来自「这餐怎么吃」反馈页）',
  ].join('\n'),
);

function pick(name: string): void {
  dishName.value = name;
  status.value = '';
  fallback.value = '';
}

async function copy(): Promise<void> {
  if (!dishName.value.trim()) {
    status.value = '请先填写或选择菜名';
    return;
  }
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(payload.value);
    status.value = '已复制，发到食堂反馈群即可';
    fallback.value = '';
  } catch {
    status.value = '复制失败，请长按下面的文字手动复制';
    fallback.value = payload.value;
  }
}
</script>

<template>
  <AppCard title="菜品有出入？" subtitle="菜名对不上、或是菜单里没有的菜">
    <p class="report__hint">复制下面的内容发到食堂反馈群，我们会汇总进菜品清单。</p>

    <AppField label="菜名" required>
      <input v-model="dishName" class="report__input" type="text" placeholder="例如：炸酱面">
    </AppField>

    <div v-if="quickNames.length" class="report__quick">
      <span class="report__quick-label">这一餐的菜：</span>
      <AppChip
        v-for="name in quickNames"
        :key="name"
        :label="name"
        :active="dishName === name"
        @toggle="pick(name)"
      />
    </div>

    <AppField label="补充说明" hint="选填：哪里不对、希望改成什么">
      <textarea v-model="note" class="report__input report__textarea" rows="2" placeholder="例如：牌子上写的是热干面" />
    </AppField>

    <AppButton variant="secondary" :disabled="!dishName.trim()" @click="copy">复制反馈内容</AppButton>
    <p v-if="status" class="report__status" role="status">{{ status }}</p>
    <pre v-if="fallback" class="report__fallback">{{ fallback }}</pre>
  </AppCard>
</template>

<style scoped>
.report__hint {
  margin: 0 0 var(--space-3);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.report__input {
  width: 100%;
  box-sizing: border-box;
  min-height: var(--size-touch);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
}
.report__textarea {
  min-height: auto;
  resize: vertical;
}
.report__quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-3) 0;
}
.report__quick-label {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
.report__status {
  margin: var(--space-2) 0 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
.report__fallback {
  margin: var(--space-2) 0 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-bg-subtle);
  font-size: var(--font-size-sm);
  white-space: pre-wrap;
  user-select: text;
}
</style>
