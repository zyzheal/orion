# Project Management Design (S17)

## Overview

| Field | Value |
|-------|-------|
| Module ID | S17 |
| Name | Project Management |
| Status | Implemented |
| Owner | Platform Team |
| Repository | `services/project/` |

## 功能描述

项目管理系统，提供多租户环境下的项目创建、查询、更新和删除能力。

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  API Routes     │ ──▶ │  ProjectService  │ ──▶ │  Database   │
│  (project)      │     │  (Business Logic)│     │  (projects) │
└─────────────────┘     └──────────────────┘     └─────────────┘
```

## Data Model

### Project Entity

```typescript
interface Project {
  id: string;           // UUID
  tenant_id: string;    // Multi-tenant isolation
  name: string;         // Project name
  description: string | null;  // Optional description
  slug: string;         // URL-friendly identifier
  status: string;       // 'active' | 'archived'
  created_at: Date;
  updated_at: Date;
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/projects | Create new project |
| GET | /api/projects | List all projects for tenant |
| GET | /api/projects/:id | Get project details |
| PUT | /api/projects/:id | Update project |
| DELETE | /api/projects/:id | Delete project |

## Service Layer

### ProjectService

| Method | Description |
|--------|-------------|
| `createProject(tenantId, name, description?)` | Create a new project |
| `listProjects(tenantId)` | List all projects for a tenant |
| `getProject(id)` | Get project by ID, throws if not found |
| `updateProject(id, input)` | Update project name/description |
| `deleteProject(id)` | Delete project by ID |

### ProjectRepository

| Method | Description |
|--------|-------------|
| `findById(id)` | Query project by ID |
| `findAll(tenantId)` | Query all projects for tenant |
| `create(tenantId, name, description)` | Insert new project |
| `update(id, input)` | Update project fields |
| `delete(id)` | Delete project |

## Business Rules

1. **Tenant Isolation**: All queries are scoped to tenant_id
2. **Slug Generation**: Auto-generate URL-friendly slug from project name
3. **Default Status**: New projects default to 'active' status
4. **Cascading**: Project deletion does not cascade to related entities (caller responsible)

## Database Schema

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX idx_projects_slug ON projects(slug);
```

## Acceptance Criteria

- [x] Tenant-scoped project listing
- [x] Auto-generate slug from name
- [x] Project CRUD operations
- [x] PostgreSQL Repository pattern
- [x] Unit tests in `__tests__/ProjectService.test.ts`

## Dependencies

- `services/database` - DatabasePool connection
- `src/models/` - Project entity types

## Related Documentation

- [Identity Management Design](identity-management-design.md) - Tenant management
- [Approval Management Design](approval-management-design.md) - Project-level approvals