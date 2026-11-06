import { Router } from 'express';
import type { InsightsSummaryResponse } from '@canteen/shared';
import { mealLogStore } from '../data/stores';
import { queryInt, queryString } from '../http/validation';

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

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceDate = since.toISOString().slice(0, 10);

  const logs = mealLogStore.listBySession(sessionId).filter((log) => log.date >= sinceDate);
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
