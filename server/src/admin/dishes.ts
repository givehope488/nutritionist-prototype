import type { Dish, DishRevisionListResponse, DishStatus } from '@canteen/shared';
import { getDb } from '../data/db';
import { getAllDishes } from '../data/dishes';
import { HttpError } from '../http/errors';

/**
 * 管理端菜品服务（ARCHITECTURE §2 的「菜品管理」）。
 *
 * 约束（API.md §3 + §5.5）：
 *   - **不改营养口径**：这里只写库，不计算任何营养值；数值来自 PD 的反推或称重结果。
 *   - **改营养必须带 reason**，并写 `dish_revisions` 留痕（谁、什么时候、从什么改成什么）。
 *   - 生产数据只经此通道变更，禁止直接改 `menu-seed.json`（那是首次初始化用的种子）。
 *
 * CLI 见 `server/scripts/admin.ts`；HTTP 路由（`X-Admin-Token`）在 W2 后半接。
 */

/** 可修订的字段：营养值 + 份量文案 + 标签 + 餐段 + 可信度（不含 id / category） */
export interface DishPatch {
  portion_label?: string;
  kcal?: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
  sodium_mg?: number;
  tags?: string[];
  meals?: string[];
  reliability?: 'A' | 'B' | 'C';
}

const NUMERIC_FIELDS = ['kcal', 'protein_g', 'fat_g', 'carbs_g', 'sodium_mg'] as const;

export interface DishFilters {
  category?: string;
  status?: string;
  q?: string;
}

export function listDishes(filters: DishFilters = {}): Dish[] {
  return getAllDishes().filter((dish) => {
    if (filters.category !== undefined && dish.category !== filters.category) return false;
    if (filters.status !== undefined && dish.status !== filters.status) return false;
    if (filters.q !== undefined && filters.q.length > 0) {
      const needle = filters.q.toLowerCase();
      if (!dish.name.toLowerCase().includes(needle) && !dish.id.toLowerCase().includes(needle)) {
        return false;
      }
    }
    return true;
  });
}

export function findDish(id: string): Dish {
  const dish = getAllDishes().find((item) => item.id === id);
  if (dish === undefined) throw new HttpError('NOT_FOUND', `菜品不存在: ${id}`);
  return dish;
}

/** 校验补丁；返回规范化后的补丁（未知字段直接丢弃，避免静默写入垃圾列） */
function normalizePatch(patch: DishPatch): DishPatch {
  const clean: DishPatch = {};
  for (const field of NUMERIC_FIELDS) {
    const value = patch[field];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new HttpError('VALIDATION_ERROR', `${field} 必须是非负数字`, [
        { path: field, issue: '必须是非负数字' },
      ]);
    }
    clean[field] = value;
  }
  if (patch.portion_label !== undefined) clean.portion_label = patch.portion_label;
  if (patch.tags !== undefined) clean.tags = patch.tags;
  if (patch.meals !== undefined) clean.meals = patch.meals;
  if (patch.reliability !== undefined) clean.reliability = patch.reliability;
  if (Object.keys(clean).length === 0) {
    throw new HttpError('VALIDATION_ERROR', '没有任何可修订的字段', [
      { path: '(body)', issue: '至少提供一个可修订字段' },
    ]);
  }
  return clean;
}

function writeRevision(
  dishId: string,
  changed: Record<string, { from: unknown; to: unknown }>,
  operator: string,
  reason: string,
): void {
  getDb()
    .prepare(
      `INSERT INTO dish_revisions (dish_id, changed_fields, operator, reason)
       VALUES (?, ?, ?, ?)`,
    )
    .run(dishId, JSON.stringify(changed), operator, reason);
}

function requireReason(reason: string | undefined): string {
  if (reason === undefined || reason.trim().length < 2) {
    throw new HttpError('VALIDATION_ERROR', '修订必须填写 reason（用于留痕）', [
      { path: 'reason', issue: '必填，说明改的依据（如「10 月抽检称重」）' },
    ]);
  }
  return reason.trim();
}

/**
 * 修订营养数据。只写入实际变化的字段，并把 from→to 记进修订历史。
 */
export function updateDish(
  id: string,
  patch: DishPatch,
  context: { reason?: string; operator?: string },
): { dish: Dish; changed: Record<string, { from: unknown; to: unknown }> } {
  const reason = requireReason(context.reason);
  const operator = context.operator?.trim() || 'unknown';
  const current = findDish(id);
  const clean = normalizePatch(patch);

  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const [field, value] of Object.entries(clean)) {
    const before = (current as unknown as Record<string, unknown>)[field];
    const same = Array.isArray(before) && Array.isArray(value)
      ? JSON.stringify(before) === JSON.stringify(value)
      : before === value;
    if (!same) changed[field] = { from: before, to: value };
  }
  if (Object.keys(changed).length === 0) {
    return { dish: current, changed }; // 幂等：没有实际变化就不写修订
  }

  const assignments = Object.keys(clean).map((field) => `${field} = ?`);
  const values = Object.keys(clean).map((field) => {
    const value = clean[field as keyof DishPatch];
    return Array.isArray(value) ? JSON.stringify(value) : (value as string | number);
  });
  getDb()
    .prepare(`UPDATE dishes SET ${assignments.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .run(...values, id);

  writeRevision(id, changed, operator, reason);
  return { dish: findDish(id), changed };
}

/** 上架 / 下架（不写修订历史：状态不是营养数据，但同样要求操作人） */
export function setDishStatus(
  id: string,
  status: DishStatus,
  operator = 'unknown',
): { dish: Dish; from: DishStatus } {
  const current = findDish(id);
  if (current.status === status) return { dish: current, from: current.status };
  getDb()
    .prepare(`UPDATE dishes SET status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(status, id);
  writeRevision(id, { status: { from: current.status, to: status } }, operator, `状态变更：${status}`);
  return { dish: findDish(id), from: current.status };
}

export function listRevisions(dishId: string): DishRevisionListResponse {
  findDish(dishId); // 不存在直接 404
  const rows = getDb()
    .prepare(
      `SELECT id, dish_id, changed_fields, operator, reason, created_at
       FROM dish_revisions WHERE dish_id = ? ORDER BY id DESC`,
    )
    .all(dishId) as unknown as Array<{
    id: number;
    dish_id: string;
    changed_fields: string;
    operator: string;
    reason: string;
    created_at: string;
  }>;

  return {
    revisions: rows.map((row) => ({
      id: String(row.id),
      dish_id: row.dish_id,
      changed_fields: JSON.parse(row.changed_fields) as Record<string, unknown>,
      operator: row.operator,
      reason: row.reason,
      created_at: row.created_at,
    })),
  };
}

export interface BulkImportResult {
  succeeded: number;
  failed: number;
  rows: Array<{ index: number; ok: boolean; message?: string }>;
}

/**
 * 批量导入（PD 反推 Excel 转 JSON 后灌入）。
 *
 * 逐行独立事务：一行失败不影响其他行；返回逐行成败，便于定位。
 * 只允许**已存在的菜品**（按 id 匹配）——新增菜品走单独流程，避免一次导入造出一堆脏数据。
 */
export function bulkImport(rows: unknown[], operator = 'unknown'): BulkImportResult {
  const result: BulkImportResult = { succeeded: 0, failed: 0, rows: [] };

  rows.forEach((raw, index) => {
    try {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new HttpError('VALIDATION_ERROR', '每行必须是对象');
      }
      const record = raw as Record<string, unknown>;
      const id = record.id;
      if (typeof id !== 'string' || id.length === 0) {
        throw new HttpError('VALIDATION_ERROR', '缺少 id');
      }
      const { id: _id, reason, ...patch } = record;
      updateDish(id, patch as DishPatch, {
        reason: typeof reason === 'string' ? reason : '批量导入',
        operator,
      });
      result.succeeded += 1;
      result.rows.push({ index, ok: true });
    } catch (error) {
      result.failed += 1;
      result.rows.push({
        index,
        ok: false,
        message: error instanceof HttpError ? error.message : String(error),
      });
    }
  });

  return result;
}
