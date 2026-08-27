import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'hrms',
  password: process.env.DB_PASSWORD || 'hrms123',
  database: process.env.DB_NAME || 'hrms',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  dateStrings: true,
});

export const query = (sql, params = []) => pool.query(sql, params);

export const closePool = () => pool.end();
