import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Authentication required', 401);
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }
  next();
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function generateRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET + '-refresh', { expiresIn: '30d' });
}

export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET + '-refresh') as AuthPayload;
}
