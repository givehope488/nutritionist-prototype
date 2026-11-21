// W3-C5 菜品反馈入口：反馈页固定入口 + 可转发的收集文本（不新增请求）。
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DishFeedbackCard from '@/components/business/DishFeedbackCard.vue';

const props = {
  items: [
    { dish_id: 's01', name: '白米饭' },
    { dish_id: 'm08', name: '白切鸡' },
  ],
  date: '2026-11-19',
  mealLabel: '午餐',
};

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

describe('DishFeedbackCard 菜品反馈入口', () => {
  beforeEach(() => {
    stubClipboard(async () => undefined);
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('未填菜名时禁止复制，点这一餐的菜可快速选中', async () => {
    const wrapper = mount(DishFeedbackCard, { props });
    const button = wrapper.findAll('button').find((node) => node.text() === '复制反馈内容');
    expect(button?.attributes('disabled')).toBeDefined();

    const chip = wrapper.findAll('button').find((node) => node.text() === '白切鸡');
    await chip?.trigger('click');
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('白切鸡');
    expect(button?.attributes('disabled')).toBeUndefined();
  });

  it('复制内容带日期 / 餐次 / 菜名 / 说明，可发到反馈群汇总进菜品清单', async () => {
    const written: string[] = [];
    stubClipboard(async (text) => {
      written.push(text);
    });
    const wrapper = mount(DishFeedbackCard, { props });

    const chip = wrapper.findAll('button').find((node) => node.text() === '白米饭');
    await chip?.trigger('click');
    await wrapper.get('textarea').setValue('牌子上写的是热干面');
    const button = wrapper.findAll('button').find((node) => node.text() === '复制反馈内容');
    await button?.trigger('click');

    expect(written).toHaveLength(1);
    expect(written[0]).toContain('【菜品反馈】2026-11-19 午餐');
    expect(written[0]).toContain('菜名：白米饭');
    expect(written[0]).toContain('说明：牌子上写的是热干面');
    expect(wrapper.text()).toContain('已复制，发到食堂反馈群即可');
  });

  it('剪贴板不可用时提示手动复制并展示原文，入口不失效', async () => {
    Reflect.deleteProperty(navigator, 'clipboard');
    const wrapper = mount(DishFeedbackCard, { props });

    const chip = wrapper.findAll('button').find((node) => node.text() === '白切鸡');
    await chip?.trigger('click');
    const button = wrapper.findAll('button').find((node) => node.text() === '复制反馈内容');
    await button?.trigger('click');

    expect(wrapper.text()).toContain('请长按下面的文字手动复制');
    expect(wrapper.get('.report__fallback').text()).toContain('菜名：白切鸡');
  });
});
