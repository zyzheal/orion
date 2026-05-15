# Database Conventions: tenant_id Standardization

**Version**: 1.0
**Created**: 2026-05-15
**Status**: Active

## 1. tenant_id Type Specification

All tenant-isolated tables MUST use:

```sql
tenant_id UUID NOT NULL
```

### Rationale

- **UUID** is the primary key type used across all Orion services
- **NOT NULL** ensures every row has a tenant association -- no orphan data
- VARCHAR(100)/VARCHAR(255) creates join complexity and prevents FK consistency

### Prohibited Types

- `tenant_id VARCHAR(100)` -- inconsistent with FK references
- `tenant_id VARCHAR(255)` -- wasteful and inconsistent
- `tenant_id UUID` (nullable) -- allows orphan rows

## 2. Index Convention

All tables with `tenant_id` MUST have a tenant index:

```sql
CREATE INDEX idx_{table_name}_tenant ON {table_name}(tenant_id);
```

Naming pattern: `idx_<table_name>_tenant`

## 3. Tables Without tenant_id

Tables that are **globally scoped** (not tenant-isolated) may omit `tenant_id`:
- System-wide configuration tables
- Cross-tenant aggregation/summary tables
- Join/relationship tables that reference parent tables already containing tenant_id

When omitting `tenant_id`, add a comment explaining why:

```sql
-- Global configuration table, no tenant isolation needed
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY,
    ...
);
```

## 4. Relationship Tables

Tables that reference a parent table (e.g., `ticket_comments` references `tickets`)
do NOT need their own `tenant_id` if tenant isolation is enforced through the parent
table via JOIN. However, for query performance and RLS compatibility, it is
RECOMMENDED to denormalize `tenant_id` onto child tables.

## 5. RLS Policy

All tables with `tenant_id` MUST enable Row Level Security:

```sql
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_{table_name} ON {table_name}
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

## 6. Migration Checklist

When creating or reviewing a migration:

- [ ] All `tenant_id` columns use `UUID NOT NULL` type
- [ ] Index `idx_{table}_tenant` exists on every tenant-isolated table
- [ ] RLS enabled and forced on tenant-isolated tables
- [ ] Seed data uses valid UUIDs (e.g., `gen_random_uuid()`) or known test UUIDs
- [ ] Global tables (no tenant_id) have explanatory comments

## 7. Service-Specific Notes

| Service | Status | Notes |
|---------|--------|-------|
| orion-chatops-svc | Fixed (001) | VARCHAR(255) -> UUID NOT NULL; 16 domains annotated with ownership |
| orion-finops-svc | Fixed (001) | Missing tenant_id added, nullable -> NOT NULL |
| orion-security-svc | Fixed (001) | Nullable UUID -> UUID NOT NULL |
| orion-ticket-svc | Fixed (001) | VARCHAR(100) -> UUID NOT NULL; RLS policies added |
| orion-platform-service | Reference | Already uses UUID NOT NULL pattern |

## 8. Migration Scope Boundaries

Each service migration should only create tables belonging to that service.
For multi-tenant onboarding scripts that need multiple services, use ownership annotations:

```sql
-- ============================================
-- [MIGRATION SCOPE NOTE]
-- This migration creates tables for multiple services.
-- Tables not belonging to ChatOps are marked with ownership comments.
-- In production, these should be split to their respective service migrations.
-- ============================================

-- ============================================
-- Deployment Tables (owned by: orion-platform-service deployment service)
-- ============================================
```

This ensures clear accountability and makes future migration splitting easier.
