import type { NextFunction, Request, Response } from 'express';
import { ERROR_STATUS } from '@canteen/shared';
import type { ApiError, ApiErrorField, ErrorCode } from '@canteen/shared';

/**
 * 唯一的业务异常出口（COLLAB.md 防线 F3：禁止各模块自创错误格式）。
 * 业务代码 throw new HttpError(...)，由 errorHandler 统一转成 API.md §1 的包络。
 */
export class HttpError extends Error {
  readonly code: ErrorCode;
  readonly fields: ApiErrorField[] | undefined;

  constructor(code: ErrorCode, message: string, fields?: ApiErrorField[]) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
    this.fields = fields;
  }
}

export function sendError(res: Response, error: ApiError): void {
  res.status(ERROR_STATUS[error.code]).json({ error });
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, { code: 'NOT_FOUND', message: `未找到 ${req.method} ${req.path}` });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    const body: ApiError = { code: err.code, message: err.message };
    if (err.fields) body.fields = err.fields;
    sendError(res, body);
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, { code: 'VALIDATION_ERROR', message: '请求体不是合法 JSON' });
    return;
  }

  console.error('[unhandled]', err);
  sendError(res, { code: 'INTERNAL', message: '服务端异常' });
}
