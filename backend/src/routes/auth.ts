import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { validateBody } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../schemas/auth.js';
import {
  createUser,
  findUserByEmail,
  comparePassword,
  hashPassword,
} from '../repositories/users.js';
import { signUserToken, requireAuth } from '../middleware/auth.js';

const router = Router();

// Rate limiting for login: 5 requests per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
  },
});

// Rate limiting for registration: 10 requests per 15 min per IP
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many registration requests. Please try again later.',
    },
  },
});

router.post('/register', registerLimiter, validateBody(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, displayName, password } = req.body;

    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({
        error: {
          code: 'USER_ALREADY_EXISTS',
          message: 'An account with this email address already exists',
        },
      });
      return;
    }

    const passwordHash = await hashPassword(password);
    // Registration role is always USER
    const newUser = await createUser({
      email,
      displayName,
      passwordHash,
      role: 'USER',
    });

    const token = signUserToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      displayName: newUser.display_name,
    });

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.display_name,
        role: newUser.role,
        createdAt: newUser.created_at,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, validateBody(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await findUserByEmail(email);
    // Generic failure message to prevent email enumeration
    if (!user) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
      return;
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
      return;
    }

    const token = signUserToken({
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
    });

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        createdAt: user.created_at,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.status(200).json({
    user: req.user,
  });
});

export default router;
