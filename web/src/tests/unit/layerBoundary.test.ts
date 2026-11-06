// 分层护栏（COLLAB.md §5 禁止项 + 架构 D1 的自动化版本）：
// 「前端偷偷做营养计算」是团队失败模式 F1/速查表里最难人肉查出的一条，这里用测试兜住。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// vitest 的 jsdom 环境下 import.meta.url 不是 file scheme，用进程工作目录（npm run test 在 web/ 下执行）
const SRC = join(process.cwd(), 'src');
if (!existsSync(SRC)) throw new Error(`扫描目录不存在：${SRC}（请在 web/ 下运行 npm run test）`);

function filesUnder(dir: string, filter: (path: string) => boolean): string[] {
  const absolute = join(SRC, dir);
  const walk = (current: string): string[] =>
    readdirSync(current).flatMap((entry) => {
      const child = join(current, entry);
      if (statSync(child).isDirectory()) return walk(child);
      return filter(child) ? [child] : [];
    });
  return walk(absolute);
}

const viewAndComponentFiles = filesUnder('views', (p) => /\.(vue|ts)$/.test(p)).concat(
  filesUnder('components', (p) => /\.(vue|ts)$/.test(p)),
);

const sourceOf = (path: string): string => readFileSync(path, 'utf-8');
const rel = (path: string): string => relative(SRC, path).replace(/\\/g, '/');

describe('分层边界', () => {
  it('至少扫描到视图与组件文件', () => {
    expect(viewAndComponentFiles.length).toBeGreaterThan(10);
  });

  it('视图 / 组件禁止 import Mock 后端替身（营养计算只能在服务端）', () => {
    const offenders = viewAndComponentFiles
      .filter((path) => /from\s+'[^']*__mock__/.test(sourceOf(path)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('组件禁止直接调用接口层：数据一律由 props 传入，便于复用与测试', () => {
    const componentFiles = viewAndComponentFiles.filter((path) => rel(path).startsWith('components/'));
    const offenders = componentFiles
      .filter((path) => /from\s+'@\/api\//.test(sourceOf(path)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('禁止对契约营养字段做算术（展示比例只允许写在 utils/display.ts）', () => {
    const pattern = /\.(kcal|protein_g|fat_g|carbs_g|sodium_mg|day_kcal)\s*[-+*/]\s*[\w(]/;
    const offenders = viewAndComponentFiles
      .filter((path) => pattern.test(sourceOf(path)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('接口类型只能来自 shared/，禁止各自手写同名 interface（防线 1）', () => {
    const allFiles = filesUnder('.', (p) => /\.(vue|ts)$/.test(p));
    const pattern =
      /\b(?:interface|type)\s+(Dish|Profile|Combo|ComboDish|MealLogResponse|MealLogRequest|MenuResponse|ApiResult|NutritionTotals|MealTarget|RecommendationResponse|InsightsSummaryResponse)\b/;
    const offenders = allFiles
      .filter((path) => !rel(path).startsWith('tests'))
      .filter((path) => pattern.test(sourceOf(path)))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
