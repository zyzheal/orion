# P0 Architecture Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 critical architecture issues: NATS registry connection bug, API gateway readiness check, and API key verification.

**Architecture:** Each fix is self-contained. NATS fix in platform-service nats-registry.ts, gateway fix in api-gateway routes, API key in platform-service api-key service + new middleware.

**Tech Stack:** Fastify, NATS, TypeScript, Node.js

---

### Task 1: Fix NatsServiceRegistry `isConnected` never-true bug

**Files:**
- Modify: `orion-platform-service/src/services/nats-registry.ts:31`

`isConnected` defaults to `false` and is only set by `setConnected()`, which is never called. This means all `publishRegistration`, `publishDeregistration`, and `publishHeartbeat` calls silently no-op (line 147, 173, 225 check `if (!this.isConnected)`).

- [ ] **Step 1: Write the failing test**

In `orion-platform-service/src/services/__tests__/nats-registry.test.ts` (append or create):

```typescript
describe('NatsServiceRegistry connection state', () => {
  test('should allow publishing after connect', async () => {
    const mockConn = { publish: jest.fn() };
    const mockDb = { query: async () => ({ rows: [], rowCount: 0 }) };
    const registry = new NatsServiceRegistry(mockConn, mockDb);

    // Before connect, publish should be blocked
    registry['isConnected'] = false;
    await (registry as any).publishRegistration({} as any);
    expect(mockConn.publish).not.toHaveBeenCalled();

    // After connect, should publish
    registry['setConnected'](true);
    await (registry as any).publishRegistration({ id: 'test', name: 'test', host: 'localhost', port: 3000, status: 'healthy', registeredAt: new Date(), lastHeartbeat: new Date() });
    expect(mockConn.publish).toHaveBeenCalled();
  });

  test('should set connected on successful init', async () => {
    const mockConn = { publish: jest.fn() };
    const mockDb = { query: async () => ({ rows: [], rowCount: 0 }) };
    const registry = new NatsServiceRegistry(mockConn, mockDb);

    expect(registry['isConnected']).toBe(false);
    await registry.init();
    expect(registry['isConnected']).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-platform-service && npx jest src/services/__tests__/nats-registry.test.ts -t "set connected on successful init" -v`
Expected: FAIL — `isConnected` remains false after init

- [ ] **Step 3: Fix the connection state**

In `orion-platform-service/src/services/nats-registry.ts`, find the `init()` method and add `this.isConnected = true;` at its end. If no `init()` method exists, find where the NATS connection is established and add it there.

Looking at the file, find the startup/connection method (likely around line 240-250 where `setConnected` is defined). Add the call:

```typescript
  async init(): Promise<void> {
    // ... existing connection setup code ...
    this.isConnected = true;  // Add this line
    this.startHeartbeat();
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest src/services/__tests__/nats-registry.test.ts -v`
Expected: Both tests PASS

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/services/nats-registry.ts
git commit -m "fix(nats): set isConnected=true on successful init to enable service discovery publishing"
```

---

### Task 2: Expand API gateway readiness check to all configured services

**Files:**
- Modify: `orion-api-gateway/src/routes/api.ts` lines ~712-739 (the `/readyz` endpoint)

The `/readyz` endpoint only checks 3 services (platform, pipeline, deploy). 31 other services are invisible to readiness checks.

- [ ] **Step 1: Read the current readiness endpoint**

Find `/readyz` in `orion-api-gateway/src/routes/api.ts`. It likely looks like:

```typescript
fastify.get('/readyz', async () => {
  const services = ['platform', 'pipeline', 'deploy'];
  // ... health check logic for these 3 only
});
```

- [ ] **Step 2: Expand to check all configured services from SERVICE_ROUTES**

Replace the hardcoded list with a dynamic one:

```typescript
fastify.get('/readyz', async () => {
  // Check ALL configured services from SERVICE_ROUTES
  const checkedServices = new Set<string>();
  const results: Record<string, { status: string; latency?: number }> = {};
  let allHealthy = true;

  for (const route of SERVICE_ROUTES) {
    if (route.prefix === '/api/v1' || route.prefix === '/') continue; // skip catch-all
    const serviceName = route.prefix.split('/')[3] || route.prefix;
    if (checkedServices.has(serviceName)) continue;
    checkedServices.add(serviceName);

    try {
      const start = Date.now();
      const res = await fetch(`${route.target}/healthz`, { signal: AbortSignal.timeout(2000) });
      const latency = Date.now() - start;
      results[serviceName] = {
        status: res.ok ? 'healthy' : 'unhealthy',
        latency,
      };
      if (!res.ok) allHealthy = false;
    } catch {
      results[serviceName] = { status: 'unreachable' };
      allHealthy = false;
    }
  }

  return {
    status: allHealthy ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    services: results,
  };
});
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd orion-api-gateway && npx tsc --noEmit --skipLibCheck 2>&1 | head -10`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add orion-api-gateway/src/routes/api.ts
git commit -m "fix(gateway): expand /readyz to check all configured services instead of just 3"
```

---

### Task 3: Implement API key verification middleware

**Files:**
- Modify: `orion-platform-service/src/services/api-key/ApiKeyService.ts` — add `verifyKey()` method
- Create: `orion-platform-service/src/middleware/apiKeyAuth.ts` — new middleware

API keys can be created but never verified. The `X-API-Key` header is allowed in CORS but no middleware uses it.

- [ ] **Step 1: Add verifyKey method to ApiKeyService**

In `orion-platform-service/src/services/api-key/ApiKeyService.ts`, add after the existing methods:

```typescript
import { createHash } from 'crypto';

// Add to ApiKeyService class:

/**
 * Verify a raw API key by hashing it and comparing with stored hashes.
 * Returns the key record if valid, null otherwise.
 * Also updates last_used_at timestamp.
 */
async verifyKey(rawKey: string): Promise<{ key: ApiKey; keyId: string } | null> {
  const hashedKey = createHash('sha256').update(rawKey).digest('hex');
  const record = await this.repository.findByHash(hashedKey);
  if (!record) return null;

  // Check if key is active
  if (record.status !== 'active') return null;

  // Check if key is expired
  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    await this.repository.updateStatus(record.id, 'expired');
    return null;
  }

  // Update last used
  await this.repository.updateLastUsed(record.id);

  return { key: record, keyId: record.id };
}
```

- [ ] **Step 2: Create API key auth middleware**

Create `orion-platform-service/src/middleware/apiKeyAuth.ts`:

```typescript
/**
 * API Key Authentication Middleware
 *
 * Verifies X-API-Key header against stored API key hashes.
 * On success, attaches apiKey and tenantId to request.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiKeyService } from '../services/api-key/ApiKeyService';
import { ApiKeyRepository } from '../repositories/ApiKeyRepository';

let apiKeyService: ApiKeyService | null = null;

export function initApiKeyAuth(db: { query: (text: string, params?: unknown[]) => Promise<any> }): void {
  const repo = new ApiKeyRepository(db);
  apiKeyService = new ApiKeyService(repo);
}

export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!apiKeyService) {
    throw new Error('API key auth not initialized. Call initApiKeyAuth() first.');
  }

  const apiKey = request.headers['x-api-key'] as string | undefined;
  if (!apiKey) {
    return reply.code(401).send({
      code: 401,
      error: 'UNAUTHORIZED',
      message: 'Missing X-API-Key header',
    });
  }

  try {
    const result = await apiKeyService.verifyKey(apiKey);
    if (!result) {
      return reply.code(401).send({
        code: 401,
        error: 'INVALID_API_KEY',
        message: 'Invalid or expired API key',
      });
    }

    (request as any).apiKey = result.key;
    (request as any).apiKeyTenantId = result.key.tenant_id;
  } catch {
    return reply.code(500).send({
      code: 500,
      error: 'AUTH_ERROR',
      message: 'API key verification failed',
    });
  }
}
```

- [ ] **Step 3: Wire middleware into app.ts**

In `orion-platform-service/src/app.ts`, after the database is available (around line 230+), add initialization:

```typescript
import { initApiKeyAuth } from './middleware/apiKeyAuth';

// Inside createApp, after database check:
if (options.database) {
  initApiKeyAuth(options.database);
}
```

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/services/api-key/ApiKeyService.ts orion-platform-service/src/middleware/apiKeyAuth.ts orion-platform-service/src/app.ts
git commit -m "feat(auth): implement API key verification middleware for X-API-Key header authentication"
```

---

### Task 4: TypeScript type-check verification

- [ ] **Step 1: Run full type check**

Run: `cd orion-platform-service && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`
Expected: 0 errors

- [ ] **Step 2: Fix any errors found**

If any TypeScript errors appear, fix them inline.

- [ ] **Step 3: Commit if changes needed**

```bash
git add -A
git commit -m "fix(types): resolve TypeScript compilation errors from architecture fixes"
```
