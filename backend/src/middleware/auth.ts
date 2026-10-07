import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { findUserById } from '../repositories/users.js';

export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'MODERATOR';
  displayName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signUserToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
    },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: '2h',
    }
  );
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is missing or malformed',
      },
    });
    return;
  }

  const token = authHeader.substring(7);

  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }) as jwt.JwtPayload;
    if (typeof decoded.sub !== 'string' || !/^[0-9a-f-]{36}$/i.test(decoded.sub)) throw new Error('Invalid subject');
  } catch {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
    return;
  }
  try {

    // Load fresh user data from database
    const user = await findUserById(decoded.sub);
    if (!user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User account no longer exists',
        },
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
    };

    next();
  } catch (err) { next(err); }
}

export function requireModerator(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'MODERATOR') {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Moderator permissions are required for this action',
      },
    });
    return;
  }
  next();
}
