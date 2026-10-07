import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import networkRoutes from './routes/network.js';
import reportRoutes from './routes/reports.js';
import incidentRoutes from './routes/incidents.js';
import routeRoutes from './routes/routes.js';

export const app = express();

// Secure HTTP headers
app.use(helmet());

// CORS configuration allowing localhost in development and exact FRONTEND_URL
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];
if (env.FRONTEND_URL && !allowedOrigins.includes(env.FRONTEND_URL)) {
  allowedOrigins.push(env.FRONTEND_URL);
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Not allowed by Access-Control-Allow-Origin'));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Liveness & health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'RouteShield AI API',
    network: 'Fictional demonstration network — not live navigation',
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routers
app.use('/api/auth', authRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/routes', routeRoutes);

// Centralized error handling
app.use(errorHandler);
