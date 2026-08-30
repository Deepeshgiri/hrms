import express from 'express';
import http from 'http';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { pool } from './db.js';
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

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static uploaded media files
app.use('/uploads/chat', express.static(UPLOAD_DIR));

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
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error', error: err.message });
});

// Initialize Socket.IO with WebRTC signaling and real-time chat
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`HRMS backend with Socket.IO & WebRTC running on http://localhost:${PORT}`);
});
