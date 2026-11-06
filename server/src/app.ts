import express from 'express';
import type { Express } from 'express';
import { API_PREFIX } from '@canteen/shared';
import { config } from './config';
import { errorHandler, notFoundHandler } from './http/errors';
import { menuRouter } from './routes/menu';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  /**
   * 基础设施探针，故意放在 /api/v1 之外：
   * 它不属于 API.md 的业务契约，不参与包络断言（部署与监控用）。
   */
  app.get('/healthz', (_req, res) => {
    res.json({
      status: 'ok',
      text_engine: config.textEngine,
      uptime_s: Math.round(process.uptime()),
    });
  });

  app.use(`${API_PREFIX}/menu`, menuRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
