// 契约护栏（附录 D）：忌口全表是唯一事实源，Mock 必须逐行一致，漂移即红。
// 对应评审意见「前端也建议加一条同样的比对」——服务端有 contract.test.ts，前端这边由本文件守。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AVOID_OPTIONS } from '@/api/__mock__/avoidOptions';
import { handleMockRequest } from '@/api/__mock__';
import { API_PREFIX } from '@canteen/shared';
import type { MenuResponse } from '@canteen/shared';

const API_MD = join(process.cwd(), '..', 'docs', 'API.md');

interface AppendixRow {
  key: string;
  label: string;
  tag: string;
}

function appendixD(): AppendixRow[] {
  const text = readFileSync(API_MD, 'utf-8').replace(/\r\n/g, '\n');
  const start = text.indexOf('### 附录 D');
  if (start === -1) throw new Error('docs/API.md 找不到「附录 D」');
  const rest = text.slice(start);
  const end = rest.indexOf('\n## ', 1);
  const section = end === -1 ? rest : rest.slice(0, end);
  const rows: AppendixRow[] = [];
  for (const line of section.split('\n')) {
    const match = /^\|\s*`([a-z]+)`\s*\|\s*([^|]+?)\s*\|\s*`([a-z]+)`\s*\|$/.exec(line.trim());
    if (match) rows.push({ key: match[1], label: match[2], tag: match[3] });
  }
  return rows;
}

describe('忌口选项与附录 D 一致', () => {
  it('key / label / excludes_tag 与顺序逐行相同', () => {
    const expected = appendixD();
    expect(expected.length).toBeGreaterThan(0);
    expect(AVOID_OPTIONS.map((o) => ({ key: o.key, label: o.label, tag: o.excludes_tag }))).toEqual(
      expected,
    );
  });

  it('素食的 key 是 nomeat（不是历史上写错的 vegan）', () => {
    expect(AVOID_OPTIONS.some((o) => o.key === 'nomeat')).toBe(true);
    expect(AVOID_OPTIONS.some((o) => (o.key as string) === 'vegan')).toBe(false);
  });
});

describe('菜单响应不下发数据治理字段', () => {
  it('portion_grams / ingredients / source 不出现在 GET /menu 响应里', async () => {
    const res = await handleMockRequest('GET', `mock://local${API_PREFIX}/menu`, undefined);
    expect(res.status).toBe(200);
    const body = res.body as MenuResponse;
    expect(body.dishes.length).toBeGreaterThan(0);
    for (const dish of body.dishes) {
      const keys = Object.keys(dish as unknown as Record<string, unknown>);
      expect(keys).not.toContain('portion_grams');
      expect(keys).not.toContain('ingredients');
      expect(keys).not.toContain('source');
    }
  });
});
