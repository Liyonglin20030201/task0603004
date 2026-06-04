import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../app';
import { authenticate, generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { ApiResponse, AuthResponse, User } from '@study-platform/shared';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nickname: z.string().min(1).max(50),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, nickname } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, nickname },
    });

    const payload = { userId: user.id, role: user.role };
    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const response: ApiResponse<AuthResponse> = {
      success: true,
      data: {
        token,
        refreshToken,
        user: mapUser(user),
      },
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError('Invalid email or password', 401);
    }

    const payload = { userId: user.id, role: user.role };
    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const response: ApiResponse<AuthResponse> = {
      success: true,
      data: {
        token,
        refreshToken,
        user: mapUser(user),
      },
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError('Refresh token required', 400);
    }

    const payload = verifyRefreshToken(refreshToken);
    const newToken = generateToken({ userId: payload.userId, role: payload.role });
    const newRefreshToken = generateRefreshToken({ userId: payload.userId, role: payload.role });

    res.json({
      success: true,
      data: { token: newToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const response: ApiResponse<User> = {
      success: true,
      data: mapUser(user),
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

function mapUser(user: any): User {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone || null,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    role: user.role,
    timezone: user.timezone,
    createdAt: user.createdAt.toISOString(),
  };
}
