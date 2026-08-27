import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { pool } from './db.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/users.routes.js';
import leaveRoutes from './routes/leaves.routes.js';
import hrRoutes from './routes/hr.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import biometricRoutes from './routes/biometric.routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_PATH = path.resolve(__dirname, '../../dist/hrms/browser');
const HAS_FRONTEND = fs.existsSync(path.join(DIST_PATH, 'index.html'));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/hr', hrRoutes);
app.use('/api/bio', biometricRoutes);

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
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error', error: err.message });
});

app.listen(PORT, () => {
  console.log(`HRMS backend running on http://localhost:${PORT}`);
});
