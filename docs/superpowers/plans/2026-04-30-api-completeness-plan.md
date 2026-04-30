# Sub-project A: API Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 missing API endpoints across role, project, session, and api-key services.

**Architecture:** Follow existing route patterns: Repository → Service → Controller → Route. Each addition is independent.

**Tech Stack:** TypeScript, Fastify, PostgreSQL Repository pattern

---

### Task 1: Role Update Endpoint

**Files:**
- Modify: `src/services/role/RoleRepository.ts:34-37`
- Modify: `src/services/role/RoleService.ts:29-31`
- Modify: `src/api/role-routes.ts:55-68`

- [ ] **Step 1: Add `update` to RoleRepository**

```typescript
// In RoleRepository.ts, after delete() method (after L37):

async update(id: string, input: { name?: string; description?: string; permissions?: string[] }): Promise<Role | null> {
  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (input.name !== undefined) { updates.push(`name = $${idx++}`); params.push(input.name); }
  if (input.description !== undefined) { updates.push(`description = $${idx++}`); params.push(input.description); }
  if (input.permissions !== undefined) { updates.push(`permissions = $${idx++}`); params.push(input.permissions); }
  if (updates.length === 0) return this.findById(id);
  updates.push(`updated_at = NOW()`);
  params.push(id);
  const result = await this.pool.query(
    `UPDATE roles SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return result.rows[0] || null;
}
```

- [ ] **Step 2: Run type check to verify new method compiles**

Run: `cd /Users/heal/orion-design/orion-platform-service && npx tsc --noEmit`
Expected: No errors related to RoleRepository

- [ ] **Step 3: Add `updateRole` to RoleService**

```typescript
// In RoleService.ts, after deleteRole() method (after L31):

async updateRole(id: string, input: { name?: string; description?: string; permissions?: string[] }): Promise<Role> {
  const existing = await this.repository.findById(id);
  if (!existing) throw new RoleServiceError(`Role not found: ${id}`, 'NOT_FOUND');
  const updated = await this.repository.update(id, input);
  if (!updated) throw new RoleServiceError(`Failed to update role: ${id}`, 'UPDATE_FAILED');
  return updated;
}
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Add PUT route to role-routes.ts**

In `role-routes.ts`, after the DELETE route (L68), add:

```typescript
const updateHandler = controller
  ? (request: FastifyRequest, reply: FastifyReply) => controller!.update(request, reply)
  : unavailableHandler;

// PUT /api/v1/roles/:id — update role
app.put('/:id', updateHandler);
```

- [ ] **Step 6: Add `update` handler to RoleController**

```typescript
// In RoleController, after delete() method:

async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const params = request.params as Record<string, string>;
  const body = request.body as Record<string, unknown>;
  try {
    const input: { name?: string; description?: string; permissions?: string[] } = {};
    if (body.name !== undefined) input.name = body.name as string;
    if (body.description !== undefined) input.description = body.description as string;
    if (Array.isArray(body.permissions)) input.permissions = body.permissions as string[];
    const role = await this.service.updateRole(params.id, input);
    return reply.send(role);
  } catch (error: any) {
    return reply.status(500).send({ error: 'UPDATE_ERROR', message: error.message });
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/services/role/RoleRepository.ts src/services/role/RoleService.ts src/api/role-routes.ts src/api/controllers/RoleController.ts
git commit -m "feat(role): add updateRole endpoint PUT /api/v1/roles/:id"
```

---

### Task 2: Project Update Endpoint

**Files:**
- Modify: `src/services/project/ProjectService.ts`
- Modify: `src/api/project-routes.ts`

Note: `ProjectRepository` already has `update` method inherited from the DB schema. Check if it exists; if not, add it similar to RoleRepository.update.

- [ ] **Step 1: Check if ProjectRepository has update method**

Grep for `async update` in `ProjectRepository.ts`. If it exists, skip to Step 2. If not, add:

```typescript
// In ProjectRepository.ts, after delete() method:

async update(id: string, input: { name?: string; description?: string }): Promise<Project | null> {
  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (input.name !== undefined) {
    updates.push(`name = $${idx++}`);
    params.push(input.name);
    const slug = (input.name as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    updates.push(`slug = $${idx++}`);
    params.push(slug);
  }
  if (input.description !== undefined) { updates.push(`description = $${idx++}`); params.push(input.description); }
  if (updates.length === 0) return this.findById(id);
  params.push(id);
  const result = await this.pool.query(
    `UPDATE projects SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return result.rows[0] || null;
}
```

- [ ] **Step 2: Add `updateProject` to ProjectService**

```typescript
// In ProjectService.ts, after deleteProject() method:

async updateProject(id: string, input: { name?: string; description?: string }): Promise<Project> {
  const existing = await this.repository.findById(id);
  if (!existing) throw new ProjectServiceError(`Project not found: ${id}`, 'NOT_FOUND');
  const updated = await this.repository.update(id, input);
  if (!updated) throw new ProjectServiceError(`Failed to update project: ${id}`, 'UPDATE_FAILED');
  return updated;
}
```

- [ ] **Step 3: Add PUT route to project-routes.ts**

In `project-routes.ts`, after the DELETE route (L131), add:

```typescript
interface UpdateProjectBody {
  name?: string;
  description?: string;
}

// PUT /api/v1/projects/:id — update project
app.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id: string };
  const body = request.body as UpdateProjectBody;

  try {
    const project = await service.updateProject(id, body);
    return reply.send(project);
  } catch (error: any) {
    if (error instanceof ProjectServiceError && error.code === 'NOT_FOUND') {
      return reply.status(404).send({
        error: 'PROJECT_NOT_FOUND',
        message: error.message,
      });
    }
    return reply.status(500).send({
      error: 'UPDATE_ERROR',
      message: error.message,
    });
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add src/services/project/ProjectService.ts src/services/project/ProjectRepository.ts src/api/project-routes.ts
git commit -m "feat(project): add updateProject endpoint PUT /api/v1/projects/:id"
```

---

### Task 3: Session List User Sessions + Refresh Token

**Files:**
- Modify: `src/services/session/SessionRepository.ts`
- Modify: `src/services/session/SessionService.ts`
- Modify: `src/api/controllers/SessionController.ts`
- Modify: `src/api/session-routes.ts`

- [ ] **Step 1: Add `findByUser` and `refresh` to SessionRepository**

```typescript
// In SessionRepository.ts, after cleanup() method:

async findByUser(userId: string, tenantId?: string): Promise<Session[]> {
  if (tenantId) {
    const result = await this.pool.query(
      'SELECT * FROM sessions WHERE user_id = $1 AND tenant_id = $2 AND expires_at > NOW() ORDER BY created_at DESC',
      [userId, tenantId]
    );
    return result.rows;
  }
  const result = await this.pool.query(
    'SELECT * FROM sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

async refresh(token: string, extendHours: number = 24): Promise<Session | null> {
  const expiresAt = new Date(Date.now() + extendHours * 60 * 60 * 1000);
  const result = await this.pool.query(
    'UPDATE sessions SET expires_at = $2 WHERE token = $1 AND expires_at > NOW() RETURNING *',
    [token, expiresAt]
  );
  return result.rows[0] || null;
}
```

- [ ] **Step 2: Add `listByUser` and `refreshToken` to SessionService**

```typescript
// In SessionService.ts, after cleanup() method:

async listByUser(userId: string, tenantId?: string): Promise<Session[]> {
  return this.repository.findByUser(userId, tenantId);
}

async refreshToken(token: string, extendHours: number = 24): Promise<Session | null> {
  const session = await this.repository.findByToken(token);
  if (!session) throw new SessionServiceError('Session not found or expired', 'NOT_FOUND');
  return this.repository.refresh(token, extendHours);
}
```

- [ ] **Step 3: Add handlers to SessionController**

```typescript
// In SessionController.ts, after cleanup() method:

async listByUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const sessions = await this.service.listByUser(params.userId, query.tenantId);
    return reply.send({
      success: true,
      data: sessions.map(s => ({
        sessionId: s.id,
        userId: s.user_id,
        tenantId: s.tenant_id,
        expiresAt: s.expires_at,
        createdAt: s.created_at,
      })),
    });
  } catch (err) {
    return reply.status(500).send({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list sessions',
    });
  }
}

async refreshToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const params = request.params as Record<string, string>;
    const body = request.body as Record<string, unknown>;
    const extendHours = body.extendHours ? parseInt(body.extendHours as string, 10) : 24;
    const session = await this.service.refreshToken(params.token, extendHours);
    if (!session) {
      return reply.status(404).send({ success: false, error: 'Session not found' });
    }
    return reply.send({
      success: true,
      data: { sessionId: session.id, expiresAt: session.expires_at },
    });
  } catch (err) {
    return reply.status(500).send({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to refresh session',
    });
  }
}
```

- [ ] **Step 4: Add routes to session-routes.ts**

In `session-routes.ts`, after the cleanup route (L62), add:

```typescript
// GET /api/v1/sessions/user/:userId — list user sessions
app.get('/user/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
  return controller.listByUser(request, reply);
});

// POST /api/v1/sessions/:token/refresh — refresh session token
app.post('/:token/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
  return controller.refreshToken(request, reply);
});
```

- [ ] **Step 5: Commit**

```bash
git add src/services/session/SessionRepository.ts src/services/session/SessionService.ts src/api/controllers/SessionController.ts src/api/session-routes.ts
git commit -m "feat(session): add listByUser and refreshToken endpoints"
```

---

### Task 4: API Key Routes

**Files:**
- Create: `src/api/api-key-routes.ts`
- Modify: `src/api/routes.ts`

- [ ] **Step 1: Find ApiKeyService structure**

Read `src/services/api-key/ApiKeyService.ts` to identify available methods.

- [ ] **Step 2: Create api-key-routes.ts**

Create `src/api/api-key-routes.ts`:

```typescript
/**
 * API Key Management API Routes
 *
 * Routes under /api/v1/api-keys
 * Uses PostgreSQL Repository pattern
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ApiKeyRepository } from '../services/api-key/ApiKeyRepository';
import { ApiKeyService } from '../services/api-key/ApiKeyService';

interface ApiKeyRoutesOptions {
  database?: DatabasePool;
}

export default async function apiKeyRoutes(
  app: FastifyInstance,
  options: ApiKeyRoutesOptions
): Promise<void> {
  const repository = options.database
    ? new ApiKeyRepository(options.database)
    : undefined;

  let service: ApiKeyService | null = null;
  if (repository) {
    service = new ApiKeyService(repository);
  }

  const unavailableHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(503).send({
      error: 'SERVICE_UNAVAILABLE',
      message: 'API Key management requires database connection',
    });
  };

  // GET /api/v1/api-keys?tenantId=xxx — list API keys
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return unavailableHandler(request, reply);
    const { tenantId } = request.query as { tenantId: string };
    if (!tenantId) return reply.status(400).send({ error: 'MISSING_TENANT_ID', message: 'tenantId query parameter is required' });
    try {
      const keys = await service.listKeys(tenantId);
      return reply.send({ data: keys, total: keys.length });
    } catch (error: any) {
      return reply.status(500).send({ error: 'LIST_ERROR', message: error.message });
    }
  });

  // POST /api/v1/api-keys — create API key
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return unavailableHandler(request, reply);
    const body = request.body as Record<string, unknown>;
    if (!body.tenantId || !body.name) return reply.status(400).send({ error: 'INVALID_INPUT', message: 'tenantId and name are required' });
    try {
      const key = await service.createKey(body.tenantId as string, body.name as string, body.permissions as string[]);
      return reply.status(201).send(key);
    } catch (error: any) {
      return reply.status(500).send({ error: 'CREATE_ERROR', message: error.message });
    }
  });

  // DELETE /api/v1/api-keys/:id — delete API key
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return unavailableHandler(request, reply);
    const { id } = request.params as { id: string };
    try {
      const deleted = await service.deleteKey(id);
      if (!deleted) return reply.status(404).send({ error: 'NOT_FOUND', message: 'API key not found' });
      return reply.status(204).send();
    } catch (error: any) {
      return reply.status(500).send({ error: 'DELETE_ERROR', message: error.message });
    }
  });
}
```

- [ ] **Step 3: Register api-key-routes in routes.ts**

In `src/api/routes.ts`, add import (after L73):

```typescript
import apiKeyRoutes from './api-key-routes';
```

In `apiRoutes()`, add registration (after L387):

```typescript
// Register API Key Management API routes
await app.register(apiKeyRoutes, { prefix: '/v1/api-keys', database: options.database });
```

- [ ] **Step 4: Commit**

```bash
git add src/api/api-key-routes.ts src/api/routes.ts
git commit -m "feat(api-key): add API key routes GET/POST/DELETE /api/v1/api-keys"
```
