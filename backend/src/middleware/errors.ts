import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
export function errorHandler(err: any, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) return next(err);
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
    return;
  }
  if (err.type === 'entity.parse.failed') { res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } }); return; }
  if (err.type === 'entity.too.large') { res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'Request exceeds the size limit.' } }); return; }
  if (err.code === '23505') { res.status(409).json({ error: { code: 'DUPLICATE_RECORD', message: 'This record already exists.' } }); return; }
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '28P01', '42P01', '3F000'].includes(err.code)) {
    res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection or migrations need attention.' } }); return;
  }
  console.error('Request failed', { name: err.name, code: typeof err.code === 'string' ? err.code : 'INTERNAL' });
  res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'The request could not be completed. Please retry.' } });
}
