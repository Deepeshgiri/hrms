-- Migration 001: add title, description, type to institute_holidays
-- Run this against your existing database if you already ran schema.sql

ALTER TABLE institute_holidays
  ADD COLUMN IF NOT EXISTS title VARCHAR(200) NOT NULL DEFAULT 'Official Holiday',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'Company';
