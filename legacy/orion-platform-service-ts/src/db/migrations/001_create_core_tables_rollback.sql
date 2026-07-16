-- Rollback Migration 001: Drop core tables (users, tenants, tenant_users)
-- WARNING: This will delete all data in these tables and dependent tables

-- Drop in reverse dependency order
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS tenant_users CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
