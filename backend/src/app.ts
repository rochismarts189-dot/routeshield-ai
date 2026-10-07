import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { query } from './config/db.js';
import { verifyPrivateEvidenceBucket } from './config/storage.js';
import { AppError } from './lib/errors.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import networkRoutes from './routes/network.js';
import reportRoutes from './routes/reports.js';
import incidentRoutes from './routes/incidents.js';
import routeRoutes from './routes/routes.js';

export const app = express();

// Secure HTTP headers
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.use(helmet());

// CORS configuration allowing localhost in development and exact FRONTEND_URL
// A backend-first deployment can leave FRONTEND_URL blank. That permits health
// checks without an Origin header while denying every cross-origin browser.
const allowedOrigins = [env.FRONTEND_URL, ...(env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173'])].filter((origin): origin is string => Boolean(origin));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'This frontend origin is not configured on the backend.'));
    },
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'OPTIONS'],
  })
);

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// Liveness & health check
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'RouteShield AI API',
    network: 'Fictional demonstration network — not live navigation',
    timestamp: new Date().toISOString(),
  });
});

// Readiness validates database migrations and private evidence storage; it does not claim a live AI inference succeeded.
app.get('/api/ready', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT (SELECT count(*) FROM routeshield.nodes) AS nodes, (SELECT count(*) FROM routeshield.edges) AS edges');
    if (Number(result.rows[0].nodes) !== 8 || Number(result.rows[0].edges) !== 10) throw new AppError(503, 'NETWORK_NOT_SEEDED', 'Apply the Maple Ward migrations.');
    await verifyPrivateEvidenceBucket();
    if (!env.GEMINI_API_KEY) throw new AppError(503, 'AI_NOT_CONFIGURED', 'Configure the backend Gemini API key.');
    res.json({ status: 'ready', database: 'connected', evidenceBucket: 'private', ai: 'configured', liveInferenceVerified: false });
  } catch (err) { next(err); }
});

// Mount modular API routers
app.use('/api/auth', authRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/routes', routeRoutes);

app.use((_req: Request, res: Response) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found' } }));

// Centralized error handling
app.use(errorHandler);
