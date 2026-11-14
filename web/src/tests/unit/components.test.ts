import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppStepper from '@/components/base/AppStepper.vue';
import AppTabs from '@/components/base/AppTabs.vue';
import DishCard from '@/components/business/DishCard.vue';
import MacroBar from '@/components/business/MacroBar.vue';
import NoSolutionNotice from '@/components/business/NoSolutionNotice.vue';
import VerdictCard from '@/components/business/VerdictCard.vue';
import { sampleDishA, sampleDishB, sampleMealLog } from '@/dev/fixtures';
import { MAX_SERVINGS } from '@canteen/shared';

describe('AppStepper 份数步进器', () => {
  it('按 0.5 步进增加并回传', async () => {
    const wrapper = mount(AppStepper, { props: { modelValue: 1 } });
    await wrapper.findAll('button')[1]?.trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([1.5]);
  });

  it('0 份时禁止再减，上限 5 份时禁止再加', () => {
    const zero = mount(AppStepper, { props: { modelValue: 0 } });
    expect(zero.findAll('button')[0]?.attributes('disabled')).toBeDefined();
    const max = mount(AppStepper, { props: { modelValue: MAX_SERVINGS } });
    expect(max.findAll('button')[1]?.attributes('disabled')).toBeDefined();
  });

  it('0 份显示「不选」，半份显示「半份」', () => {
    expect(mount(AppStepper, { props: { modelValue: 0 } }).text()).toContain('不选');
    expect(mount(AppStepper, { props: { modelValue: 0.5 } }).text()).toContain('半份');
  });
});

describe('AppTabs', () => {
  it('点击分类回传 value（回填页分类 Tab）', async () => {
    const items = [
      { value: 'staple', label: '主食', count: 16 },
      { value: 'protein', label: '主菜', count: 24 },
    ];
    const wrapper = mount(AppTabs, { props: { modelValue: 'staple', items } });
    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['protein']);
    expect(wrapper.text()).toContain('16');
  });
});

describe('DishCard 份量展示（D4：A / B 同一套 UI）', () => {
  it('A 级只展示份量用语：无克重、无「估算值」标记', () => {
    const wrapper = mount(DishCard, { props: { dish: sampleDishA, modelValue: 1 } });
    expect(wrapper.text()).toContain('1 份');
    expect(wrapper.text()).not.toContain('估算值');
    expect(wrapper.text()).not.toMatch(/\d+\s*(g|ml)\b/);
  });

  it('B 级与 A 级渲染完全同构（portion_grams 一律不下发）', () => {
    const wrapper = mount(DishCard, { props: { dish: sampleDishB, modelValue: 0 } });
    expect(wrapper.text()).toContain('1 份');
    expect(wrapper.text()).not.toContain('估算值');
    expect(wrapper.text()).not.toMatch(/\d+\s*(g|ml)\b/);
  });

  it('不展示价格（产品 2026-11-13 决策：不向用户提供价格）', () => {
    const wrapper = mount(DishCard, { props: { dish: sampleDishA, modelValue: 1 } });
    expect(wrapper.text()).not.toContain('¥');
    expect(wrapper.text()).not.toMatch(/\d+\.\d\s*元/);
  });
});

describe('MacroBar 对比条', () => {
  it('按目标刻度渲染条宽并给出无障碍描述', () => {
    const wrapper = mount(MacroBar, {
      props: { label: '热量', actual: 913, target: 913, unit: 'kcal' },
    });
    // 目标即满格：actual == target 时条宽 100%
    expect(wrapper.get('.macro__fill').attributes('style')).toContain('width: 100%');
    expect(wrapper.attributes('data-state')).toBe('ok');
    expect(wrapper.get('.macro__track').attributes('aria-label')).toBe('热量 913 kcal，目标 913');
  });

  it('超出目标时条宽封顶 100% 并标记 over 状态', () => {
    const wrapper = mount(MacroBar, { props: { label: '热量', actual: 1200, target: 913, unit: 'kcal' } });
    expect(wrapper.get('.macro__fill').attributes('style')).toContain('width: 100%');
    expect(wrapper.attributes('data-state')).toBe('over');
  });

  it('target 缺失时条宽为 0，不出现 NaN', () => {
    const wrapper = mount(MacroBar, { props: { label: '脂肪', actual: 20, target: 0, unit: 'g' } });
    expect(wrapper.get('.macro__fill').attributes('style')).toContain('width: 0%');
  });

  it('无目标时标注「暂无目标」，不显示「目标 0」', () => {
    const wrapper = mount(MacroBar, { props: { label: '钠', actual: 751, target: 0, unit: 'mg' } });
    expect(wrapper.text()).toContain('暂无目标');
    expect(wrapper.text()).not.toContain('目标 0');
    expect(wrapper.attributes('data-state')).toBe('neutral');
  });
});

describe('VerdictCard 判定文案', () => {
  it('ok 与 warn 用不同语义色，duplicate 时提示展示首次结果', () => {
    const ok = mount(VerdictCard, { props: { verdict: sampleMealLog.verdict, adopted: true } });
    expect(ok.attributes('data-level')).toBe('ok');
    expect(ok.text()).toContain('吃得挺准');

    const warn = mount(VerdictCard, {
      props: {
        verdict: { level: 'warn', title: '蛋白质没跟上', body: '这一餐蛋白质 12 g。' },
        adopted: false,
        duplicate: true,
      },
    });
    expect(warn.attributes('data-level')).toBe('warn');
    expect(warn.text()).toContain('这餐已记录过');
    expect(warn.text()).toContain('自选搭配');
  });
});

describe('NoSolutionNotice 忌口无解引导', () => {
  it('原样展示服务端 notice 并可触发放宽', async () => {
    const wrapper = mount(NoSolutionNotice, {
      props: { notice: '符合忌口条件的菜品太少，建议放宽一两个限制或换个时段' },
    });
    await wrapper.findAll('button')[0]?.trigger('click');
    expect(wrapper.text()).toContain('建议放宽一两个限制');
    expect(wrapper.emitted('relax')).toBeTruthy();
  });
});
