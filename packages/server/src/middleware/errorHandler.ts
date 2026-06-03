import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@study-platform/shared';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}
