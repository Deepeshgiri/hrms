import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { pool, closePool } from './db.js';
import { initSocket } from './socket.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/users.routes.js';
import leaveRoutes from './routes/leaves.routes.js';
import hrRoutes from './routes/hr.routes.js';
import biometricRoutes from './routes/biometric.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import logsRoutes from './routes/logs.routes.js';
import chatRoutes from './routes/chat.routes.js';
import tenantsRoutes from './routes/tenants.routes.js';
import rolesRoutes from './routes/roles.routes.js';

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3001;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_PATH = path.resolve(__dirname, '../../dist/hrms/browser');
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/chat');
const HAS_FRONTEND = fs.existsSync(path.join(DIST_PATH, 'index.html'));

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Security headers
app.use(helmet());

// CORS allowlist (configurable via CORS_ORIGINS env, comma separated)
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:4200,http://127.0.0.1:4200')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (curl, mobile, same-origin) without an Origin header
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  })
);

// Login rate limiting (brute force protection)
app.use(
  '/api/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
  })
);

// General API rate limiting (per-IP)
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static uploaded media files
app.use(
  '/uploads/chat',
  express.static(UPLOAD_DIR, {
    maxAge: '1d',
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'HRMS API is healthy', time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database unreachable', error: err.message });
  }
});

app.use('/api/login', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/hr/payroll', payrollRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/bio', biometricRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/roles', rolesRoutes);

// API 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Serve the built Angular frontend (single-port deployment)
if (HAS_FRONTEND) {
  app.use(express.static(DIST_PATH));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
  console.log(`Serving frontend from ${DIST_PATH}`);
} else {
  console.log('Frontend build not found - API only mode');
}

app.use((err, req, res, next) => {
  console.error('[API Error]', err);

  if (err.name === 'RateLimitError') {
    return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
  }
  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'Not allowed by CORS' });
  }

  const status = err.status || 500;
  // Do not leak internal error details to clients.
  res.status(status).json({
    success: false,
    message: status >= 500 ? 'Internal server error' : err.message || 'Request failed',
  });
});

// Initialize Socket.IO with WebRTC signaling and real-time chat
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`HRMS backend with Socket.IO & WebRTC running on http://localhost:${PORT}`);
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  try {
    await closePool();
    httpServer.close(() => process.exit(0));
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
