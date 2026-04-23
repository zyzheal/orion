# Orion Platform - Database & Migration Audit Report

**Date**: 2026-04-18
**Auditor**: Automated Database Audit (Agent 3 of 8)
**Scope**: Schema definitions, migrations, models, indexes, relationships, security

---

## Executive Summary

| Metric | Value | Assessment |
|--------|-------|------------|
| Design-Specified Tables | ~81 | |
| Tables Implemented (migrations 024-033) | ~33 | 41% |
| Migration Completeness | 024-033 only (001-023 missing) | Severely incomplete |
| Index Coverage | Partial | Missing critical indexes |
| Security Compliance | Poor | 5 critical vulnerabilities |
| **Overall Database Completion** | **~58%** | **Significant gaps and critical risks** |

### Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| P0 (Critical) | 5 | Mock database, missing migrations, SQL injection, plaintext credentials, no TLS |
| P1 (High) | 9 | Missing tenant isolation, RLS policies, ~48 tables not implemented, engine mismatch |
| P2 (Medium) | 10 | Missing updated_at, JSONB indexes, connection pool monitoring, audit chain-hash |

---

## P0: Critical Issues

### P0-1: DatabasePool is Entirely Mocked
**Location**: `orion-platform-service/src/services/database.ts`

The `DatabasePool` class uses `setTimeout` to simulate PostgreSQL connection. The `pg` driver is commented out. All queries return empty arrays or mock objects.

```typescript
// Lines 52-66: Mock connection
await new Promise<void>((resolve) => {
  setTimeout(() => resolve(), 100); // Fake initialization
});
// import pg from 'pg';  // <-- Commented out
```

**Impact**: Zero data persistence. All API operations return mock/empty data.
**Fix**: Add `pg` dependency, implement real connection pool with proper credentials.

---

### P0-2: Migrations 001-023 Are Missing
**Location**: `orion-platform-service/src/db/migrations/`

Migration files start at `024_create_users.sql`. The first 23 migrations (core tables: projects, pipelines, builds, deployments, environments, etc.) are completely absent.

**Impact**: Core tables cannot be created. The system cannot bootstrap from scratch.
**Fix**: Create migrations 001-023 for all tables specified in design docs.

---

### P0-3: SQL Injection in `orion-db/src/index.js`
**Location**: `orion-db/src/index.js`, `setTenantContext()` and `setUserContext()`

```javascript
// String interpolation in SQL:
const query = `SET SESSION "app.tenant_id" = '${tenantId}'`;
const query = `SET SESSION "app.user_id" = '${userId}'`;
```

No parameterized queries, no escaping. If `tenantId` or `userId` contains SQL, injection is possible.

**Impact**: Any authenticated user can execute arbitrary SQL via tenant/user context setting.
**Fix**: Use parameterized queries: `SET SESSION "app.tenant_id" = $1`

---

### P0-4: SSH Credentials Stored in Plaintext
**Location**: Migration `029_create_cmdb_tables.sql`, table `host_ssh_configs`

Columns `password`, `private_key`, `passphrase` are stored as plain text `VARCHAR` with no encryption.

**Impact**: Database breach = full SSH access to all managed hosts.
**Fix**: Encrypt sensitive columns using `pgcrypto` or application-level encryption (AES-256-GCM).

---

### P0-5: No TLS/SSL on Database Connections
**Location**: `orion-platform-service/src/services/database.ts`, connection configuration

Connection string does not include `sslmode=require` or `ssl` configuration. No certificate validation.

**Impact**: Database traffic is transmitted in plaintext. MITM attacks possible.
**Fix**: Add `ssl: { rejectUnauthorized: true }` to connection config. Require `PGSSLMODE=require` env var.

---

## P1: High Severity Issues

### P1-1: Missing tenant_id on 31 of 33 Advanced Tables
Migrations 024-033 create 33 tables. Only 2 tables (`tenants`, `tenant_users`) have `tenant_id`. The remaining 31 tables lack multi-tenant isolation at the database level.

**Fix**: Add `tenant_id UUID REFERENCES tenants(id)` to all tenant-scoped tables.

---

### P1-2: No Row-Level Security (RLS) Policies
None of the 33 tables created in migrations 024-033 have PostgreSQL RLS policies enabled.

**Fix**: Enable `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and create policies for each tenant-scoped table.

---

### P1-3: ~48 Tables from Design Spec Not Implemented
Design documents specify ~81 tables. Only 33 are implemented in migrations. Missing tables include:

| Design Table | Module | Purpose |
|-------------|--------|---------|
| `approval_definitions` | M23 | Approval workflow definitions |
| `approvals` | M23 | Approval instances |
| `deployments` | M8 | Deployment records |
| `build_images` | M8 | Build image metadata |
| `pipeline_stages` | M7 | Pipeline stage configs |
| `agent_runs` | M40 | Agent execution history |
| `ephemeral_envs` | M41 | Ephemeral environment records |
| `feature_values` | M33 | Feature store data |
| `model_versions` | M34 | ML model versioning |
| `training_runs` | M35 | Training job records |
| `artifact_versions` | M27 | Artifact promotion history |
| `backup_jobs` | M28 | Backup execution records |
| `distributed_locks` | Core | Distributed transaction coordination |
| `external_system_connections` | Integration | External system connection configs |

---

### P1-4: Database Engine Mismatch
Design documents (ADR-005) specify MySQL for primary data store. Implementation uses PostgreSQL.

**Impact**: Migration syntax incompatible, `pg`-specific features (JSONB, RLS) not portable to MySQL without changes.
**Fix**: Either update design docs to reflect PostgreSQL decision, or migrate to MySQL.

---

### P1-5: No Migration Tooling or Tracking Table
No `schema_migrations` or `flyway_schema_history` table exists. No migration runner is configured.

**Fix**: Add `node-pg-migrate` or `knex` for migration management. Create tracking table.

---

### P1-6: No Indexes on Foreign Key Columns
Migrations 024-033 define foreign keys but no corresponding indexes on FK columns.

**Fix**: Add `CREATE INDEX idx_<table>_<fk_column> ON <table>(<fk_column>)` for each FK.

---

### P1-7: No Unique Constraints on Business Keys
Tables like `users` lack UNIQUE constraint on `email`. `tenants` lacks UNIQUE on `name`.

**Fix**: Add unique constraints for all business keys.

---

### P1-8: No Default Values for audit columns
Tables with `created_by`, `updated_by` columns don't set defaults from session context.

**Fix**: Use `DEFAULT current_setting('app.user_id', true)` for audit columns.

---

### P1-9: No Soft Delete Implementation
Design docs specify soft delete pattern (`deleted_at` column) for key tables. Only 3 of 33 tables have `deleted_at`.

**Fix**: Add `deleted_at TIMESTAMPTZ` to all tenant-scoped tables. Create application-level filter.

---

## P2: Medium Severity Issues

1. No `updated_at` triggers on migrations 024-033 tables (should auto-update via trigger)
2. Missing JSONB GIN indexes on `configs`, `metadata`, `labels` columns
3. No `pg_cron` extension for table partition management
4. No connection pool monitoring or query timeout configuration
5. No `pg_stat_statements` for query performance analysis
6. Audit log chain-hash not implemented (integrity verification)
7. No table partitioning for high-volume tables (`audit_logs`, `pipeline_runs`)
8. No `CHECK` constraints for data validation (e.g., `budget_amount > 0`)
9. No `ENUM` types for status columns (using VARCHAR instead)
10. No database-level cascading rules for soft deletes
