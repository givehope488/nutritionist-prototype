// W3 合规 A1 免责声明 / A6 数据可信度披露：
// 全局唯一文案（App.vue 挂载），对外口径必须包含「营养值为估算，不宣称精确」。
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppDisclaimer from '@/components/base/AppDisclaimer.vue';

describe('免责声明（W3-A1 / A6）', () => {
  it('默认文案包含估算口径、非处方建议与未成年降级说明', () => {
    const text = mount(AppDisclaimer).text();
    expect(text).toContain('本产品输出为日常膳食参考');
    expect(text).toContain('营养值为估算值，不宣称精确');
    expect(text).toContain('不构成医疗或营养处方建议');
    expect(text).toContain('未满 18 岁用户不提供热量缺口方案');
  });
});