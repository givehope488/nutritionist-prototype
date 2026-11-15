import { Router, type NextFunction, type Request, type Response } from 'express';
import type { DishStatus } from '@canteen/shared';
import {
  bulkImport,
  createDish,
  listDishes,
  listRevisions,
  setDishStatus,
  updateDish,
  type DishCreateInput,
  type DishPatch,
} from '../admin/dishes';
import { config } from '../config';
import { HttpError } from '../http/errors';

/**
 * 管理端 HTTP 路由（API.md §3）。
 *
 * 鉴权：`X-Admin-Token` 必须等于 `ADMIN_TOKEN`（config 或环境变量）。
 * **未配置 token 时一律 401**——宁可管理端打不开，也不能在没有口令的情况下开放写接口。
 *
 * 与 CLI（`server/scripts/admin.ts`）共用同一套 service，行为一致：
 * 改营养必须带 reason、写 dish_revisions、无实际变化不写修订。
 */
export const adminRouter: Router = Router();

function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_TOKEN ?? config.adminToken;
  if (expected.length === 0) {
    throw new HttpError('UNAUTHORIZED', '管理端未配置 ADMIN_TOKEN，已拒绝访问');
  }
  const provided = req.header('x-admin-token') ?? '';
  if (provided.length === 0 || provided !== expected) {
    throw new HttpError('UNAUTHORIZED', 'X-Admin-Token 缺失或无效');
  }
  next();
}

adminRouter.use(requireAdmin);

/** GET /admin/dishes?category=&status= —— 全量菜品（含下架） */
adminRouter.get('/dishes', (req: Request, res: Response) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json(listDishes({ ...(category ? { category } : {}), ...(status ? { status } : {}) }));
});

/** POST /admin/dishes —— 新增菜品 */
adminRouter.post('/dishes', (req: Request, res: Response) => {
  const body = req.body as DishCreateInput;
  const operator = (req.header('x-admin-operator') ?? 'admin').trim();
  res.status(201).json(createDish(body, operator));
});

/** PUT /admin/dishes/:id —— 修订（body 必须含 reason） */
adminRouter.put('/dishes/:id', (req: Request, res: Response) => {
  const body = req.body as DishPatch & { reason?: string };
  const { reason, ...patch } = body;
  const operator = (req.header('x-admin-operator') ?? 'admin').trim();
  const { dish, changed } = updateDish(String(req.params.id ?? ''), patch, { reason, operator });
  res.json({ dish, changed });
});

/** POST /admin/dishes/:id/status —— 上架 / 下架 */
adminRouter.post('/dishes/:id/status', (req: Request, res: Response) => {
  const status = (req.body as { status?: string }).status;
  if (status !== 'active' && status !== 'hidden') {
    throw new HttpError('VALIDATION_ERROR', 'status 取值须为 active / hidden', [
      { path: 'status', issue: '取值须为 active / hidden' },
    ]);
  }
  const operator = (req.header('x-admin-operator') ?? 'admin').trim();
  res.json(setDishStatus(String(req.params.id ?? ''), status as DishStatus, operator));
});

/** GET /admin/dishes/:id/revisions —— 修订历史 */
adminRouter.get('/dishes/:id/revisions', (req: Request, res: Response) => {
  res.json(listRevisions(String(req.params.id ?? '')));
});

/** POST /admin/dishes/bulk-import —— 批量导入（逐行独立） */
adminRouter.post('/dishes/bulk-import', (req: Request, res: Response) => {
  const rows: unknown = req.body;
  if (!Array.isArray(rows)) {
    throw new HttpError('VALIDATION_ERROR', '请求体必须是数组', [
      { path: '(body)', issue: '必须是 JSON 数组' },
    ]);
  }
  const operator = (req.header('x-admin-operator') ?? 'admin').trim();
  res.json(bulkImport(rows, operator));
});
