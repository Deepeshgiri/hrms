-- HRMS Seed Data (static data)
-- Passwords (bcrypt):
--   admin@hrms.com / admin123
--   ayesha@hrms.com / hr123
--   all other users / emp123

INSERT INTO roles (id, roleName) VALUES
(1, 'Admin'),
(2, 'HR Manager'),
(3, 'Employee'),
(4, 'Accountant');

INSERT INTO users (id, name, email, password, employeeId, designation, department, roleId, tenantId) VALUES
(1, 'System Admin', 'admin@hrms.com', '$2a$10$mkCOIPkQtHt34H1TNdfwDO0FwG41YUTzdZ7t6UaObvNzH9h9BQMWG', 'EMP-001', 'System Administrator', 'Administration', 1, 1),
(2, 'Ayesha Khan', 'ayesha@hrms.com', '$2a$10$hVZRoYdCH7WCnk5ftxo1seEs7fUeSVZtC6STOj2PIoK8q4naDJUYG', 'EMP-002', 'HR Manager', 'Human Resources', 2, 1),
(3, 'Rahul Sharma', 'rahul@hrms.com', '$2a$10$4f22kWdJsOTLDEPPTVziGeVLQNxg1vqlsJTqVX4jJY0QIJVcIGjyu', 'EMP-003', 'Software Engineer', 'Engineering', 3, 1),
(4, 'Priya Patel', 'priya@hrms.com', '$2a$10$4f22kWdJsOTLDEPPTVziGeVLQNxg1vqlsJTqVX4jJY0QIJVcIGjyu', 'EMP-004', 'Accountant', 'Finance', 4, 1),
(5, 'Mohammed Ali', 'ali@hrms.com', '$2a$10$4f22kWdJsOTLDEPPTVziGeVLQNxg1vqlsJTqVX4jJY0QIJVcIGjyu', 'EMP-005', 'QA Engineer', 'Engineering', 3, 1),
(6, 'Sara Khan', 'sara@hrms.com', '$2a$10$4f22kWdJsOTLDEPPTVziGeVLQNxg1vqlsJTqVX4jJY0QIJVcIGjyu', 'EMP-006', 'HR Executive', 'Human Resources', 3, 1),
(7, 'Vikram Singh', 'vikram@hrms.com', '$2a$10$4f22kWdJsOTLDEPPTVziGeVLQNxg1vqlsJTqVX4jJY0QIJVcIGjyu', 'EMP-007', 'DevOps Engineer', 'Engineering', 3, 1),
(8, 'Neha Gupta', 'neha@hrms.com', '$2a$10$4f22kWdJsOTLDEPPTVziGeVLQNxg1vqlsJTqVX4jJY0QIJVcIGjyu', 'EMP-008', 'UI/UX Designer', 'Design', 3, 1);

INSERT INTO timings (userId, fromTime, toTime) VALUES
(1, '09:00:00', '18:00:00'),
(2, '09:30:00', '18:30:00'),
(3, '09:00:00', '18:00:00'),
(4, '09:00:00', '18:00:00'),
(5, '10:00:00', '19:00:00'),
(6, '09:30:00', '18:30:00'),
(7, '09:00:00', '18:00:00'),
(8, '09:00:00', '18:00:00');

INSERT INTO biometric_devices (id, deviceName, deviceSN, ipAddress, location, status, lastSeenAt) VALUES
(1, 'Main Entrance Reader', 'DS-1001', '192.168.1.101', 'Office Ground Floor', 'Active', NOW()),
(2, 'Floor 2 Reader', 'DS-1002', '192.168.1.102', 'Office Second Floor', 'Active', DATE_SUB(NOW(), INTERVAL 45 MINUTE)),
(3, 'Legacy Device', 'DS-1003', NULL, 'Old Server Room', 'Inactive', DATE_SUB(NOW(), INTERVAL 40 DAY));

INSERT INTO biometric_pending_devices (id, deviceSN, rawLine, requestedAt) VALUES
(1, 'DS-2001', 'pending device:DS-2001', DATE_SUB(NOW(), INTERVAL 2 HOUR));

INSERT INTO punch_mappings (deviceSN, enrollId, userId) VALUES
('DS-1001', 'EMP-003', 3),
('DS-1001', 'EMP-004', 4),
('DS-1001', 'EMP-005', 5),
('DS-1001', 'EMP-006', 6),
('DS-1001', 'EMP-007', 7),
('DS-1001', 'EMP-008', 8),
('DS-1001', 'EMP-001', 1),
('DS-1002', 'EMP-003', 3);

INSERT INTO institute_holidays (leaveDate) VALUES
(STR_TO_DATE(CONCAT(YEAR(CURDATE()), '-01-26'), '%Y-%m-%d')),
(STR_TO_DATE(CONCAT(YEAR(CURDATE()), '-08-15'), '%Y-%m-%d')),
(STR_TO_DATE(CONCAT(YEAR(CURDATE()), '-10-02'), '%Y-%m-%d'));

INSERT INTO default_leave (roleId, month, leaves) VALUES
(1, 1, 2), (1, 2, 2), (1, 3, 2), (1, 4, 2), (1, 5, 2), (1, 6, 2),
(1, 7, 2), (1, 8, 2), (1, 9, 2), (1, 10, 2), (1, 11, 2), (1, 12, 2),
(2, 1, 2), (2, 2, 2), (2, 3, 2), (2, 4, 2), (2, 5, 2), (2, 6, 2),
(2, 7, 2), (2, 8, 2), (2, 9, 2), (2, 10, 2), (2, 11, 2), (2, 12, 2),
(3, 1, 1.5), (3, 2, 1.5), (3, 3, 1.5), (3, 4, 1.5), (3, 5, 1.5), (3, 6, 1.5),
(3, 7, 1.5), (3, 8, 1.5), (3, 9, 1.5), (3, 10, 1.5), (3, 11, 1.5), (3, 12, 1.5),
(4, 1, 2), (4, 2, 2), (4, 3, 2), (4, 4, 2), (4, 5, 2), (4, 6, 2),
(4, 7, 2), (4, 8, 2), (4, 9, 2), (4, 10, 2), (4, 11, 2), (4, 12, 2);

INSERT INTO salary_structures (id, userId, basicSalary, hra, da) VALUES
(1, 3, 30000, 12000, 5000),
(2, 4, 28000, 10000, 4000),
(3, 5, 26000, 9000, 3500),
(4, 6, 22000, 8000, 3000),
(5, 7, 32000, 13000, 6000),
(6, 8, 24000, 9000, 3000),
(7, 2, 45000, 18000, 8000);

INSERT INTO salary_allowances (salaryStructureId, name, amount) VALUES
(1, 'Travel Allowance', 2000),
(1, 'Phone Allowance', 1500),
(2, 'Travel Allowance', 2000),
(3, 'Travel Allowance', 1500),
(4, 'Travel Allowance', 1200),
(5, 'Travel Allowance', 2500),
(6, 'Travel Allowance', 1500),
(7, 'Travel Allowance', 3000),
(7, 'Medical Allowance', 2500);

INSERT INTO salary_deductions (salaryStructureId, name, amount) VALUES
(1, 'Provident Fund', 3600),
(1, 'Professional Tax', 1500),
(2, 'Provident Fund', 3300),
(2, 'Professional Tax', 1200),
(3, 'Provident Fund', 3100),
(3, 'Professional Tax', 1000),
(4, 'Provident Fund', 2600),
(4, 'Professional Tax', 800),
(5, 'Provident Fund', 3800),
(5, 'Professional Tax', 1600),
(6, 'Provident Fund', 2800),
(6, 'Professional Tax', 900),
(7, 'Provident Fund', 5400),
(7, 'Professional Tax', 2000);

INSERT INTO leaves (userId, leaveContent, fromDate, toDate, date, duration, half, reason, status, response, timestamp) VALUES
(3, 'Medical leave due to fever', NULL, NULL, DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'F', NULL, 'Sick', 'Accepted', 'Get well soon', DATE_SUB(NOW(), INTERVAL 6 DAY)),
(5, 'Family function', DATE_SUB(CURDATE(), INTERVAL 3 DAY), DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL, 'R', NULL, 'Wedding', 'Accepted', 'Approved', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(6, 'Personal work', NULL, NULL, DATE_ADD(CURDATE(), INTERVAL 1 DAY), 'H', 1, 'Personal', 'Pending', NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),
(7, 'Vacation trip', DATE_ADD(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 12 DAY), NULL, 'R', NULL, 'Vacation', 'Pending', NULL, NOW()),
(8, 'Home relocation', NULL, NULL, DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'F', NULL, 'Relocation', 'Rejected', 'Need more staff that week', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(4, 'Medical checkup', NULL, NULL, DATE_SUB(CURDATE(), INTERVAL 8 DAY), 'H', 2, 'Medical', 'Accepted', 'OK', DATE_SUB(NOW(), INTERVAL 9 DAY)),
(3, 'Half day - personal', NULL, NULL, DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'H', 2, 'Personal', 'Pending', NULL, NOW());
