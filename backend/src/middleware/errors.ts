import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Prevent double headers
  if (res.headersSent) {
    return next(err);
  }

  // Never leak database credentials or internal stack traces in client response
  console.error('Unhandled Server Error:', err.message || err);

  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message =
    status === 500
      ? 'An unexpected error occurred while processing your request'
      : err.message || 'Operation failed';

  res.status(status).json({
    error: {
      code,
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
