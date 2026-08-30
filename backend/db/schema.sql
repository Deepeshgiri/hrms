-- HRMS Database Schema
-- MySQL / MariaDB

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS timings;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS biometric_devices;
DROP TABLE IF EXISTS punch_mappings;
DROP TABLE IF EXISTS institute_holidays;
DROP TABLE IF EXISTS leaves;
DROP TABLE IF EXISTS leave_balances;
DROP TABLE IF EXISTS default_leave;
DROP TABLE IF EXISTS salary_structures;
DROP TABLE IF EXISTS salary_allowances;
DROP TABLE IF EXISTS salary_deductions;
DROP TABLE IF EXISTS payslips;
DROP TABLE IF EXISTS biometric_pending_devices;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roleName VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  employeeId VARCHAR(50),
  designation VARCHAR(150),
  department VARCHAR(150),
  roleId INT,
  tenantId INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (roleId) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE timings (
  userId INT PRIMARY KEY,
  fromTime TIME,
  toTime TIME,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE attendance (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  userId INT,
  datetime DATETIME NOT NULL,
  entryType VARCHAR(20) DEFAULT 'machine',
  deviceSN VARCHAR(100),
  enrollId VARCHAR(100),
  rawLine VARCHAR(500),
  status VARCHAR(20),
  KEY idx_user_datetime (userId, datetime),
  KEY idx_datetime (datetime)
) ENGINE=InnoDB;

CREATE TABLE biometric_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deviceName VARCHAR(150),
  deviceSN VARCHAR(100) NOT NULL UNIQUE,
  ipAddress VARCHAR(50),
  location VARCHAR(150),
  status VARCHAR(20) DEFAULT 'Active',
  lastSeenAt DATETIME
) ENGINE=InnoDB;

CREATE TABLE biometric_pending_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deviceSN VARCHAR(100) NOT NULL,
  requestedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  rawLine VARCHAR(500)
) ENGINE=InnoDB;

CREATE TABLE punch_mappings (
  deviceSN VARCHAR(100) NOT NULL,
  enrollId VARCHAR(100) NOT NULL,
  userId INT NOT NULL,
  PRIMARY KEY (deviceSN, enrollId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE institute_holidays (
  leaveDate DATE PRIMARY KEY,
  title VARCHAR(200) NOT NULL DEFAULT 'Official Holiday',
  description TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'Company'
) ENGINE=InnoDB;

CREATE TABLE leaves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  leaveContent TEXT,
  fromDate DATE,
  toDate DATE,
  date DATE,
  duration VARCHAR(5) DEFAULT 'F',
  half TINYINT,
  reason VARCHAR(255),
  status VARCHAR(20) DEFAULT 'Pending',
  response VARCHAR(255),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (userId),
  KEY idx_status (status),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE leave_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  leaves DECIMAL(6,1) DEFAULT 0,
  alloted DECIMAL(6,1) DEFAULT 0,
  carried DECIMAL(6,1) DEFAULT 0,
  used DECIMAL(6,1) DEFAULT 0,
  UNIQUE KEY uq_user_month_year (userId, month, year),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE default_leave (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roleId INT NOT NULL,
  month INT NOT NULL,
  leaves DECIMAL(6,1) DEFAULT 0,
  UNIQUE KEY uq_role_month (roleId, month),
  FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE salary_structures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL UNIQUE,
  basicSalary DECIMAL(12,2) DEFAULT 0,
  hra DECIMAL(12,2) DEFAULT 0,
  da DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE salary_allowances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salaryStructureId INT NOT NULL,
  name VARCHAR(100),
  amount DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (salaryStructureId) REFERENCES salary_structures(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE salary_deductions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salaryStructureId INT NOT NULL,
  name VARCHAR(100),
  amount DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (salaryStructureId) REFERENCES salary_structures(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE payslips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  basicSalary DECIMAL(12,2) DEFAULT 0,
  grossSalary DECIMAL(12,2) DEFAULT 0,
  netSalary DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Draft',
  paidDate DATE,
  UNIQUE KEY uq_user_period (userId, month, year),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
