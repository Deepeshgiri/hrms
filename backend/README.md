# HRMS Backend API

Complete REST backend for the HRMS (Human Resource Management System) built with **Node.js**, **Express** and **MySQL** (MariaDB compatible).

It powers the Angular frontend in this repository and also serves the compiled frontend (`dist/hrms/browser`) on a single port for easy deployment.

## Tech Stack

- Node.js 18+ (ES modules)
- Express 4
- MySQL / MariaDB (via `mysql2`)
- JWT authentication (`jsonwebtoken`)
- bcrypt password hashing (`bcryptjs`)

## Features / Modules

| Module | Endpoints (prefix `/api`) |
|---|---|
| Auth | `POST /login` |
| Users & Attendance | `GET /users`, `GET /users/timings`, `PUT /users/timings`, `GET /users/attendance`, `GET /users/attendance/today`, `GET /users/attendance/monthly`, `GET /users/:id/attendance`, `GET /users/:id/monthly-attendance` |
| Leaves | `GET /leaves`, `GET /leaves/my`, `GET /leaves/my-leaves-info`, `GET /leaves/users-leaves-info`, `GET /leaves/pending-leaves-count`, `POST /leaves`, `PUT /leaves`, `PUT /leaves/update-leave`, `DELETE /leaves/:id`, leave balances (`users-leaves`, `user-leave`, `users-leaves-for-allot`, `user-leave-allot`, `default-role-leaves`, `default-leave`, `re-calculate-leaves`), institute holidays, `GET /leaves/all-users-leaves` |
| HR Dashboard / Analytics | `GET /hr/dashboard-stats`, `GET /hr/analytics/attendance`, `GET /hr/analytics/leaves`, `GET /hr/analytics/overview`, `POST /hr/attendance/manual` |
| Payroll | `GET /hr/payroll/stats`, `GET /hr/payroll/salary-structures`, `POST /hr/payroll/salary-structure`, `GET /hr/payroll/payslips`, `POST /hr/payroll/generate-all-payslips`, `PUT /hr/payroll/payslip/:id/status`, `DELETE /hr/payroll/payslip/:id`, `GET /hr/payroll/payslip/:id/download` |
| Biometric | `GET /bio/biometric/devices`, `POST /bio/biometric/device`, `PUT /bio/biometric/device/:id`, `DELETE /bio/biometric/device/:id`, `GET /bio/devices/status`, `POST /bio/biometric/approve-device`, `GET /bio/employees/mapping`, `POST /bio/punches/map-employee`, `GET /bio/punches/recent`, `POST /bio/download/:deviceSN` |

**Authentication:** All routes except `POST /api/login` require a JWT. The Angular client sends it as the `token` query parameter (also accepted as `Authorization: Bearer <token>`). Tenant is optional via the `X-Tenant-ID` header.

## Getting Started

### 1. Install MySQL

```bash
# Debian/Ubuntu (MariaDB is the drop-in default)
apt-get install -y mariadb-server
service mariadb start
```

### 2. Configure environment

Copy the default values or edit `backend/.env`:

```
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=hrms
DB_PASSWORD=hrms123
DB_NAME=hrms
JWT_SECRET=hrms-super-secret-key
JWT_EXPIRES=12h
```

Create the database and user (once):

```bash
mysql -u root -e "CREATE DATABASE IF NOT EXISTS hrms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'hrms'@'localhost' IDENTIFIED BY 'hrms123'; GRANT ALL PRIVILEGES ON hrms.* TO 'hrms'@'localhost'; FLUSH PRIVILEGES;"
```

### 3. Install dependencies and initialize the database

```bash
cd backend
npm install
npm run db:init
```

`db:init` creates the schema (`db/schema.sql`), seeds static data (`db/seed.sql`) and generates 35 days of attendance punches plus annual leave balances (`db/seed-attendance.js`).

### 4. Run the server

```bash
npm start            # or: npm run dev  (auto-restart)
```

Server listens on `http://localhost:3001`. Health check: `GET /api/health`.

If the Angular frontend has been built (`ng build` in the repo root), the compiled app at `dist/hrms/browser` is served automatically on the same port.

## Seed Login Accounts

| Email | Password | Role |
|---|---|---|
| admin@hrms.com | admin123 | Admin |
| ayesha@hrms.com | hr123 | HR Manager |
| rahul@hrms.com | emp123 | Employee |

## Project Structure

```
backend/
├── .env                      # environment configuration
├── package.json
├── db/
│   ├── schema.sql            # database schema
│   ├── seed.sql              # static seed data
│   └── seed-attendance.js    # dynamic attendance/leave-balance generator
└── src/
    ├── server.js             # express app entry point
    ├── db.js                 # mysql connection pool
    ├── auth.js               # JWT sign + auth middleware
    ├── helpers.js            # shared utility functions
    └── routes/
        ├── auth.routes.js    # login
        ├── users.routes.js   # users, attendance, timings
        ├── leaves.routes.js  # leave requests, balances, holidays
        ├── hr.routes.js      # dashboard, analytics, manual attendance
        ├── payroll.routes.js # salary structures, payslips
        └── biometric.routes.js # devices, punches, mapping
```
