# Sub-project D: Code Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 code quality issues in ConfigService, approval routes, artifact routes, and EventBus metrics.

**Architecture:** Direct code modifications, each self-contained. Follow existing patterns.

**Tech Stack:** TypeScript, Fastify, zod (for validation)

---

### Task 1: Remove ConfigService Duplicate Methods

**Files:**
- Modify: `src/services/config-mgmt/ConfigService.ts:151-407`

- [ ] **Step 1: Remove getConfigVersions2 (L207-217)**

The `getConfigVersions` (L196-205) already calls `getConfigVersions2` internally. Replace getConfigVersions2 with getConfigVersions implementation and remove the `*2` call chain. Delete `getConfigVersions2` entirely, move its implementation into `getConfigVersions`:

```typescript
async getConfigVersions(tenantIdOrId: string, key?: string): Promise<ConfigHistory[]> {
  if (!this.repository) return [];
  // If called with configId directly
  if (!key) {
    return this.repository.getHistoryByConfigId(tenantIdOrId);
  }
  // If called with tenantId and key
  const entry = await this.repository.findByKey(tenantIdOrId, key);
  if (!entry) return [];
  return this.repository.getHistoryByConfigId(entry.id);
}
```

- [ ] **Step 2: Remove deleteConfig2 (L304-306)**

Delete lines 304-306. The `delete(tenantId, key)` method at L300-302 already provides this functionality.

- [ ] **Step 3: Remove listConfigs2 (L326-337)**

Delete `listConfigs2`. Update `listConfigs` (L179-195) to include the filtering logic that was in `listConfigs2`:

```typescript
async listConfigs(filter?: ListConfigsFilter): Promise<ConfigItem[]> {
  if (!this.repository) return [];
  const { environment, status, keyPrefix, tags, limit, offset } = filter || {};
  const all = await this.getAll('default');
  let filtered = all;
  if (environment) filtered = filtered.filter(c => c.environment === environment);
  if (status) filtered = filtered.filter(c => c.status === status);
  if (keyPrefix) filtered = filtered.filter(c => c.key.startsWith(keyPrefix));
  if (tags && tags.length > 0) filtered = filtered.filter(c => c.tags?.some(tag => tags.includes(tag)));
  if (offset) filtered = filtered.slice(offset);
  if (limit) filtered = filtered.slice(0, limit);
  return filtered;
}
```

- [ ] **Step 4: Remove getConfig2 (L339-341)**

Delete `getConfig2`. The `get(tenantId, key)` at L290-293 provides this functionality.

- [ ] **Step 5: Remove getConfigById2 (L347-349)**

Delete `getConfigById2`. The `getConfigById` at L343-345 provides the same functionality.

- [ ] **Step 6: Remove rollbackConfig2 (L355-364)**

Delete `rollbackConfig2`. The `rollbackConfig` at L219-239 provides this functionality with proper version handling.

- [ ] **Step 7: Remove cloneConfig2 (L366-372)**

Delete `cloneConfig2`. The `cloneConfig` at L241-255 provides this functionality.

- [ ] **Step 8: Verify no callers reference *2 methods**

Grep for `getConfigVersions2|deleteConfig2|listConfigs2|getConfig2|getConfigById2|rollbackConfig2|cloneConfig2` in the entire codebase. Update any callers to use the non-`*2` versions.

- [ ] **Step 9: Commit**

```bash
git add src/services/config-mgmt/ConfigService.ts
git commit -m "refactor(config): remove 7 duplicate *2 methods, consolidate implementations"
```

---

### Task 2: Add Zod Validation to Approval Routes

**Files:**
- Modify: `src/api/approval-routes.ts`

- [ ] **Step 1: Add zod import and schemas**

At the top of `approval-routes.ts`, after L10, add:

```typescript
import { z } from 'zod';

const createApprovalSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  requesterId: z.string().min(1, 'Requester ID is required'),
  approverIds: z.array(z.string()).min(1, 'At least one approver is required'),
  requiredApprovals: z.number().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const approveRejectSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});
```

- [ ] **Step 2: Add validation to POST / route**

Replace L21-23:

```typescript
app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
  const parseResult = createApprovalSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      details: parseResult.error.errors,
    });
  }
  const { title, description, requesterId, approverIds, requiredApprovals, metadata } = parseResult.data;
  const req = await approvalService.createApproval(title, requesterId, approverIds, requiredApprovals || 1, description, metadata);
  return reply.send(req);
});
```

- [ ] **Step 3: Add validation to POST /:id/approve**

Replace L43:

```typescript
const parseResult = approveRejectSchema.safeParse(request.body);
if (!parseResult.success) {
  return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parseResult.error.errors });
}
const { userId } = parseResult.data;
```

- [ ] **Step 4: Add validation to POST /:id/reject**

Replace L55:

```typescript
const parseResult = approveRejectSchema.safeParse(request.body);
if (!parseResult.success) {
  return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parseResult.error.errors });
}
const { userId } = parseResult.data;
```

- [ ] **Step 5: Commit**

```bash
git add src/api/approval-routes.ts
git commit -m "feat(approval): add zod input validation to all routes"
```

---

### Task 3: Fix Artifact Routes (app as any).db

**Files:**
- Modify: `src/api/artifact-routes.ts`

- [ ] **Step 1: Update route function signature**

Change L13 from:
```typescript
export default async function artifactRoutes(app: FastifyInstance): Promise<void> {
```

To:
```typescript
interface ArtifactRoutesOptions {
  database?: import('../services/database').DatabasePool;
}

export default async function artifactRoutes(
  app: FastifyInstance,
  options: ArtifactRoutesOptions
): Promise<void> {
```

- [ ] **Step 2: Replace (app as any).db with typed repository**

Change L15 from:
```typescript
const artifactRepository = new PostgresArtifactRepository((app as any).db);
```

To:
```typescript
const artifactRepository = options.database
  ? new PostgresArtifactRepository(options.database)
  : null;

if (!artifactRepository) {
  console.warn('[ArtifactRoutes] No database pool provided, artifact routes will return 503');
}
```

- [ ] **Step 3: Add DB availability guard for all routes**

After L19, add:
```typescript
const dbUnavailable = async (request: FastifyRequest, reply: FastifyReply) => {
  return reply.status(503).send({
    error: 'SERVICE_UNAVAILABLE',
    message: 'Artifact management requires database connection',
  });
};
```

For each route handler, add a check:
```typescript
app.post('/artifacts', async (request: FastifyRequest, reply: FastifyReply) => {
  if (!artifactRepository) return dbUnavailable(request, reply);
  return artifactController.create(request, reply);
});
```

Apply the same pattern to all routes that use `artifactRepository` or `artifactService`.

- [ ] **Step 4: Update routes.ts registration**

In `src/api/routes.ts`, find the artifactRoutes registration (L349) and add database option:
```typescript
await app.register(artifactRoutes, { prefix: '/v1/artifacts', database: options.database });
```

- [ ] **Step 5: Commit**

```bash
git add src/api/artifact-routes.ts src/api/routes.ts
git commit -m "fix(artifact): replace (app as any).db with typed Repository pattern"
```

---

### Task 4: Remove EventBus mockCalls Metric

**Files:**
- Modify: `src/services/event-bus-service.ts`

- [ ] **Step 1: Remove mockCalls from metrics object (L104)**

Change L99-105 from:
```typescript
private metrics = {
  publishSuccess: 0,
  publishFailed: 0,
  subscribeSuccess: 0,
  subscribeFailed: 0,
  mockCalls: 0,
};
```

To:
```typescript
private metrics = {
  publishSuccess: 0,
  publishFailed: 0,
  subscribeSuccess: 0,
  subscribeFailed: 0,
};
```

- [ ] **Step 2: Remove mockCalls from resetMetrics (L164)**

Change L159-165 from:
```typescript
this.metrics = {
  publishSuccess: 0,
  publishFailed: 0,
  subscribeSuccess: 0,
  subscribeFailed: 0,
  mockCalls: 0,
};
```

To:
```typescript
this.metrics = {
  publishSuccess: 0,
  publishFailed: 0,
  subscribeSuccess: 0,
  subscribeFailed: 0,
};
```

- [ ] **Step 3: Verify no other references exist**

Grep for `mockCalls` in the codebase. If there are references elsewhere, remove them.

- [ ] **Step 4: Commit**

```bash
git add src/services/event-bus-service.ts
git commit -m "fix(eventbus): remove unused mockCalls metric"
```
