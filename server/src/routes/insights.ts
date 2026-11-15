import { Router } from 'express';
import type { InsightsSummaryResponse } from '@canteen/shared';
import { mealLogRepository } from '../data/repositories';
import { queryInt, queryString } from '../http/validation';

/** 本地时区的 YYYY-MM-DD（**不能用 toISOString**，那是 UTC） */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 「今天 − days」的窗口起点（本地日期）。
 *
 * 为什么单独抽出来：
 * 1. 原实现用 `toISOString().slice(0,10)`，那是 **UTC 日期**。在 UTC+8 的凌晨
 *    （本地 00:00~07:59），UTC 还停在前一天，于是 `sinceDate` 会提前一天，
 *    统计窗口在凌晨多算一整天。日志日期存的是本地日期字符串，两边口径必须一致。
 * 2. 允许注入 `now`，测试可以传固定时刻做确定性断言，不需要 `vi.setSystemTime`
 *    去影响全局定时器（服务器、HTTP 请求都依赖真实定时器）。
 */
export function windowStartDate(days: number, now: Date = new Date()): string {
  const start = new Date(now.getTime());
  start.setDate(start.getDate() - days);
  return formatLocalDate(start);
}

export const insightsRouter: Router = Router();

/**
 * GET /api/v1/insights/summary?session_id=&days=7 （API.md §2.5）
 *
 * 采纳率 = 采纳了推荐（回填时带 adopted_combo_id）的餐数 / 有记录的餐数。
 * 只统计本 session 且落在 days 窗口内的记录。
 */
insightsRouter.get('/summary', (req, res) => {
  const sessionId = queryString(req.query, 'session_id');
  const days = queryInt(req.query, 'days', 7, { min: 1, max: 90 });

  const sinceDate = windowStartDate(days);

  const logs = mealLogRepository.listBySession(sessionId).filter((log) => log.date >= sinceDate);
  const loggedMeals = logs.length;
  const adopted = logs.filter((log) => log.adopted).length;
  const average = (pick: (log: (typeof logs)[number]) => number): number =>
    loggedMeals === 0
      ? 0
      : Math.round((logs.reduce((sum, log) => sum + pick(log), 0) / loggedMeals) * 10) / 10;

  const response: InsightsSummaryResponse = {
    logged_meals: loggedMeals,
    adopted,
    adoption_rate: loggedMeals === 0 ? 0 : Math.round((adopted / loggedMeals) * 100) / 100,
    avg_kcal: average((log) => log.totals.kcal),
    avg_protein_g: average((log) => log.totals.protein_g),
  };
  res.json(response);
});
