<script setup lang="ts">
// 建档页：**只在没有档案时出现**（PD 2026-11-24）。
// 已有档案访问 /profile 时直接回首页——改档走个人中心，避免同一份表单两处逻辑漂移。
// 边界：BMI / 日目标是服务端派生值，本页只展示 getProfile / saveProfile 的返回值（架构 D1）。
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { ApiError, ProfileInput } from '@canteen/shared';
import { getProfile, saveProfile } from '@/api/endpoints';
import AppCard from '@/components/base/AppCard.vue';
import AppErrorBanner from '@/components/base/AppErrorBanner.vue';
import AppLoading from '@/components/base/AppLoading.vue';
import AppNavBar from '@/components/base/AppNavBar.vue';
import ProfileForm from '@/components/business/ProfileForm.vue';
import { sessionId } from '@/composables/useSession';

const router = useRouter();

const loading = ref(true);
const error = ref<ApiError | null>(null);
const saving = ref(false);
const saveError = ref<ApiError | null>(null);

function goHome(): void {
  void router.push({ name: 'home' });
}

async function save(input: ProfileInput): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  saveError.value = null;
  const result = await saveProfile(input);
  saving.value = false;
  if (!result.ok) {
    saveError.value = result.error;
    return;
  }
  // 建档完成直接回首页（PD 2026-11-24）；目标与忌口在个人中心里继续调
  goHome();
}

onMounted(async () => {
  const result = await getProfile(sessionId);
  loading.value = false;
  if (result.ok) {
    // 已有档案：建档页不该再出现（首页也不再给建档入口）
    await router.replace({ name: 'home' });
    return;
  }
  // 404 = 尚未建档，保持空白表单；其他错误才提示
  if (result.error.code !== 'NOT_FOUND') error.value = result.error;
});
</script>

<template>
  <div class="page">
    <AppNavBar
      title="先认识一下你"
      subtitle="这些信息只用来估算这一餐的目标"
      back-label="首页"
      @back="goHome"
    />

    <div class="page__body">
      <AppLoading v-if="loading" :rows="4" label="检查是否已建档…" />

      <template v-else>
        <AppErrorBanner v-if="error" :error="error" />

        <AppCard padding="tight" class="intro">
          <p class="intro__line">
            填三项体征即可开始；建档后可在「个人中心」随时修改，目标和忌口也在那里调整。
          </p>
        </AppCard>

        <ProfileForm
          submit-label="保存并开始"
          :saving="saving"
          :error="saveError"
          @submit="save"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
}
.page__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
}
.intro {
  background: var(--color-info-bg);
}
.intro__line {
  margin: 0;
  color: var(--color-info);
  font-size: var(--font-size-md);
}
</style>
