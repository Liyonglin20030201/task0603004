import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from './errorHandler';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new AppError(message, 400);
    }
    req.body = result.data;
    next();
  };
}
