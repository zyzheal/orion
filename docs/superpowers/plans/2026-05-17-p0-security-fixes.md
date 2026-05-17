# P0 Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 critical security vulnerabilities that block production deployment.

**Architecture:** Each fix is self-contained in a single file. No new files needed. All fixes are middleware/route-level changes that don't affect data models or database schema.

**Tech Stack:** Fastify, jsonwebtoken, TypeScript

---

### Task 1: Fix JWT `algorithms: ['none']` vulnerability in auth middleware

**Files:**
- Modify: `orion-platform-service/src/middleware/authMiddleware.ts:42`

The `jwt.verify()` call does not specify `algorithms`, allowing attackers to forge tokens with `{"alg":"none"}`.

- [ ] **Step 1: Write the failing test**

Create test: `orion-platform-service/src/middleware/__tests__/authMiddleware.test.ts`

```typescript
import { authenticateUser } from '../authMiddleware';
import jwt from 'jsonwebtoken';

const mockRequest = (headers: Record<string, string | undefined>) =>
  ({ headers, user: undefined }) as any;
const mockReply = () => {
  const reply: any = { code: (status: number) => reply, send: jest.fn(() => reply) };
  return reply;
};

describe('authenticateUser', () => {
  test('rejects alg:none token', async () => {
    const forgedToken = jwt.sign({ userId: '1', username: 'admin', roles: ['admin'] }, '', { algorithm: 'none' });
    const req = mockRequest({ authorization: `Bearer ${forgedToken}` });
    const reply = mockReply();

    await authenticateUser(req, reply);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringMatching(/INVALID_TOKEN|UNAUTHORIZED/) })
    );
  });

  test('accepts valid HS256 token', async () => {
    const secret = process.env.JWT_SECRET || 'test-secret';
    const validToken = jwt.sign({ userId: '1', username: 'user', roles: ['user'] }, secret, { algorithm: 'HS256' });
    const req = mockRequest({ authorization: `Bearer ${validToken}` });
    const reply = mockReply();

    await authenticateUser(req, reply);

    expect((req as any).user).toEqual({
      userId: '1',
      username: 'user',
      roles: ['user'],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-platform-service && npx jest src/middleware/__tests__/authMiddleware.test.ts -t "rejects alg:none"`
Expected: FAIL — the alg:none token is accepted

- [ ] **Step 3: Fix the vulnerability**

In `orion-platform-service/src/middleware/authMiddleware.ts:42`, change:

```typescript
const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as {
  userId: string;
  username: string;
  roles?: string[];
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest src/middleware/__tests__/authMiddleware.test.ts -v`
Expected: Both tests PASS

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/middleware/authMiddleware.ts orion-platform-service/src/middleware/__tests__/authMiddleware.test.ts
git commit -m "fix(security): restrict JWT algorithm to HS256 to prevent alg:none attack"
```

---

### Task 2: Add auth to SSE publish endpoints

**Files:**
- Modify: `orion-platform-service/src/api/pipeline-sse-routes.ts:92-138`

The `POST /pipelines/sse/publish/log` and `POST /pipelines/sse/publish/status` endpoints accept arbitrary data from anyone with network access.

- [ ] **Step 1: Write the failing test**

Append to `orion-platform-service/src/api/__tests__/pipeline-sse-routes.test.ts` (create if needed):

```typescript
import { FastifyInstance } from 'fastify';
import { PipelineLogSSEService } from '../../services/pipeline/PipelineLogSSEService';

async function buildSSEApp(): Promise<FastifyInstance> {
  const fastify = require('fastify')();
  const sse = new PipelineLogSSEService(new (require('events').EventEmitter)());
  await fastify.register(require('../pipeline-sse-routes').default, { prefix: '/v1', pipelineLogSSE: sse });
  return fastify;
}

describe('SSE publish endpoints auth', () => {
  test('POST /publish/log without auth returns 401', async () => {
    const app = await buildSSEApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/pipelines/sse/publish/log',
      payload: { pipelineId: '1', runId: '1', stageId: '1', logLine: 'test' },
    });
    expect(res.statusCode).toBe(401);
  });

  test('POST /publish/status without auth returns 401', async () => {
    const app = await buildSSEApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/pipelines/sse/publish/status',
      payload: { pipelineId: '1', runId: '1', status: 'running' },
    });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-platform-service && npx jest src/api/__tests__/pipeline-sse-routes.test.ts -v`
Expected: FAIL — endpoints return 200

- [ ] **Step 3: Add shared secret auth to publish endpoints**

In `orion-platform-service/src/api/pipeline-sse-routes.ts`, add before the publish routes (line 91):

```typescript
// Shared secret for internal SSE publish endpoints
// Must match SSE_PUBLISH_SECRET env var set on the calling service (e.g., PipelineEngine)
const SSE_PUBLISH_SECRET = process.env.SSE_PUBLISH_SECRET || '';

async function verifyPublishAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = request.body as Record<string, unknown> | undefined;
  const headerSecret = request.headers['x-sse-secret'] as string | undefined;

  if (!SSE_PUBLISH_SECRET || headerSecret !== SSE_PUBLISH_SECRET) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing SSE publish secret',
    });
  }
}
```

Then wrap both publish routes:

```typescript
  // POST /api/v1/pipelines/sse/publish/log — requires shared secret
  app.post('/pipelines/sse/publish/log', { onRequest: [verifyPublishAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // ... existing body unchanged ...
```

```typescript
  // POST /api/v1/pipelines/sse/publish/status — requires shared secret
  app.post('/pipelines/sse/publish/status', { onRequest: [verifyPublishAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // ... existing body unchanged ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest src/api/__tests__/pipeline-sse-routes.test.ts -v`
Expected: Both auth tests PASS (401 without secret)

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/api/pipeline-sse-routes.ts
git commit -m "fix(security): add shared secret auth to SSE publish endpoints to prevent log injection"
```

---

### Task 3: Fix SSE `Access-Control-Allow-Origin: *` CORS override

**Files:**
- Modify: `orion-platform-service/src/api/pipeline-sse-routes.ts:41`

The SSE log endpoint overrides CORS to `*`, allowing any website to read pipeline logs via cross-origin requests.

- [ ] **Step 1: Read the current route**

At line 37-41, the GET `/pipelines/sse/logs` route sets:
```typescript
reply.raw.setHeader('Access-Control-Allow-Origin', '*');
```

- [ ] **Step 2: Replace `*` with the configured allowed origin**

Change line 41 from:
```typescript
reply.raw.setHeader('Access-Control-Allow-Origin', '*');
```

To:
```typescript
const allowedOrigin = process.env.ALLOWED_ORIGINS?.split(',')[0]?.trim() || 'http://localhost:5173';
reply.raw.setHeader('Access-Control-Allow-Origin', allowedOrigin);
reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
```

Do the same for the status SSE route at line 76 (add after the existing headers):
```typescript
const allowedOrigin = process.env.ALLOWED_ORIGINS?.split(',')[0]?.trim() || 'http://localhost:5173';
reply.raw.setHeader('Access-Control-Allow-Origin', allowedOrigin);
reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd orion-platform-service && npx tsc --noEmit --skipLibCheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/api/pipeline-sse-routes.ts
git commit -m "fix(security): replace wildcard CORS with configured origin on SSE endpoints"
```

---

### Task 4: Block SecretsService fallback encryption key in production

**Files:**
- Modify: `orion-platform-service/src/services/pipeline/SecretsService.ts:485-491`

In production, if `ORION_SECRET_ENCRYPTION_KEY` is unset, the service falls back to a hardcoded known key, making all "encrypted" secrets readable.

- [ ] **Step 1: Write the failing test**

Append to `orion-platform-service/src/services/pipeline/__tests__/SecretsService.test.ts` (or create):

```typescript
import { SecretsService } from '../SecretsService';

describe('SecretsService encryption key', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('throws in production without encryption key', () => {
    process.env.NODE_ENV = 'production';
    expect(() => {
      (SecretsService as any).prototype['deriveEncryptionKey'](undefined);
    }).toThrow('ORION_SECRET_ENCRYPTION_KEY is required in production');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-platform-service && npx jest src/services/pipeline/__tests__/SecretsService.test.ts -t "throws in production" -v`
Expected: FAIL — no throw

- [ ] **Step 3: Fix deriveEncryptionKey**

In `orion-platform-service/src/services/pipeline/SecretsService.ts:485-491`, change:

```typescript
private deriveEncryptionKey(key?: string): Buffer {
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ORION_SECRET_ENCRYPTION_KEY is required in production');
    }
    logger.warn('No encryption key provided, using fallback (development only)');
    return crypto.createHash('sha256').update('orion-dev-fallback-key-do-not-use-in-production').digest();
  }
  // ... rest unchanged ...
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest src/services/pipeline/__tests__/SecretsService.test.ts -t "throws in production" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/services/pipeline/SecretsService.ts
git commit -m "fix(security): throw error in production if ORION_SECRET_ENCRYPTION_KEY is not set"
```

---

### Task 5: Add authentication to workbench route

**Files:**
- Modify: `orion-platform-service/src/api/routes.ts:429`

The workbench route is registered without `registerWithRoleGuard`, meaning anyone can access a user's aggregated dashboard data.

- [ ] **Step 1: Verify the current registration**

At line 429:
```typescript
app.register(workbenchRoutes, { prefix: '/v1/workbench', database: options.database });
```

- [ ] **Step 2: Wrap with role guard**

Change to:
```typescript
await registerWithRoleGuard(app, workbenchRoutes, '/v1/workbench', { database: options.database });
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd orion-platform-service && npx tsc --noEmit --skipLibCheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/api/routes.ts
git commit -m "fix(security): add auth guard to workbench endpoint to prevent unauthenticated data access"
```

---

### Task 6: Enable Content Security Policy in Helmet

**Files:**
- Modify: `orion-platform-service/src/app.ts:75-78`

CSP is fully disabled (`contentSecurityPolicy: false`), leaving the platform vulnerable to XSS attacks on user-generated content.

- [ ] **Step 1: Read current Helmet config**

At line 75-78:
```typescript
await app.register(fastifyHelmet, {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});
```

- [ ] **Step 2: Enable a permissive CSP for development**

Change to:
```typescript
await app.register(fastifyHelmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd orion-platform-service && npx tsc --noEmit --skipLibCheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/app.ts
git commit -m "fix(security): enable Content Security Policy in Helmet with permissive directives"
```
