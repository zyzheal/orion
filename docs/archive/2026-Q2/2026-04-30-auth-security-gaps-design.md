# Auth & Security Gaps Design

**Date:** 2026-04-30
**Status:** Draft
**Branch:** `feat/frontend-gap-implementation`

## Overview

Critical authentication and authorization gaps between frontend, API Gateway, and Platform Service. The platform currently operates with dual auth systems, unprotected backend endpoints, and incomplete token lifecycle management. This document provides implementation-level fixes for all identified gaps, prioritized by severity.

## Current State

### Architecture: Dual Auth Systems

```
Frontend (React + Vite)
  -> VITE_API_BASE_URL -> API Gateway (localhost:3000) -> Platform Service (localhost:3001)
  -> Direct -> Platform Service (in dev mode, bypassing gateway)
```

**Platform Service Auth** (`orion-platform-service/src/api/routes-auth.ts`):
- Real PostgreSQL-backed auth with `users` and `refresh_tokens` tables
- scrypt password hashing (`salt:hash` format, 64-byte key)
- Refresh tokens stored as SHA-256 hashes in DB (rotated on each refresh)
- 5-minute access tokens (`ACCESS_TOKEN_EXPIRES_IN = '5m'`)
- 7-day refresh tokens (`REFRESH_TOKEN_EXPIRES_IN = '7d'`)
- JWT middleware: `authenticateUser()` in `authMiddleware.ts`, `roleGuard()` in `roleGuard.ts`
- `registerWithRoleGuard()` wrapper function available in `routes.ts` for protected routes
- JWT payload: `{ userId, username, role }`
- Returns `expiresAt` as millisecond timestamp on login and refresh

**API Gateway Auth** (`orion-api-gateway/src/routes/auth.routes.ts`):
- Mock user database (`Map<string, User>` with plaintext passwords: `admin123`, `dev123`, `test123`)
- Redis-backed refresh tokens via `TokenService`
- Device fingerprinting (`generateDeviceFingerprint` from UA + IP)
- `preHandler` auth check on `/me` endpoint using `request.authContext`
- ABAC permission system via `rbacService`
- 24-hour access tokens (configurable via `config.jwtSecret`)
- Returns `expiresIn` (seconds) instead of `expiresAt`

**Frontend Auth** (`orion-frontend/src/`):
- `src/api/client.ts` — axios instance with request/response interceptors
- `src/stores/authStore.ts` — Zustand store with `getToken()`, `refreshAuthToken()`, `isTokenExpiring()`
- `src/api/auth.ts` — login, logout, refreshToken, getCurrentUser API calls
- `src/router/index.tsx` — `ProtectedRoute` / `PublicRoute` components
- `src/api/types.ts` — `LoginResponse` expects `{ accessToken, refreshToken, expiresAt, user }`
- `src/pages/Login/index.tsx` — login form with hardcoded default credentials

### Critical Gaps Inventory

| ID | Severity | Component | Description |
|----|----------|-----------|-------------|
| VULN-1 | CRITICAL | Platform Service | ~30+ route registrations without any auth middleware. All `/v1/pipelines`, `/v1/pipeline-runs`, `/v1/stages`, `/v1/tasks`, `/v1/config`, `/v1/cost`, `/v1/finops`, etc. are publicly accessible when bypassing the gateway |
| VULN-2 | HIGH | API Gateway | `mockUsers` Map with plaintext passwords — never connected to PostgreSQL |
| VULN-3 | HIGH | Platform Service + Gateway | JWT secrets may differ: Platform uses `process.env.JWT_SECRET`, Gateway uses `config.jwtSecret` |
| GAP-1 | HIGH | Frontend | App never calls `GET /v1/auth/me` on startup. `ProtectedRoute` only checks `localStorage.getItem('access_token')` — stale/forged tokens accepted |
| GAP-2 | HIGH | Frontend | Axios 401 interceptor clears localStorage and redirects to `/login` without attempting token refresh |
| GAP-3 | MEDIUM | Gateway <-> Frontend | Gateway returns `expiresIn` (seconds), frontend `LoginResponse` expects `expiresAt` (milliseconds) |
| GAP-4 | MEDIUM | Frontend | JWT stored in `localStorage` — accessible to XSS |
| GAP-5 | MEDIUM | Frontend | Login page shows "默认账号：admin / admin123" with pre-filled credentials |

### Platform Service: Unprotected Routes (VULN-1 Detail)

In `orion-platform-service/src/api/routes.ts`, ~48 route modules are registered. Many use `registerWithRoleGuard()` (protected), but many do NOT:

**Currently PROTECTED (using `registerWithRoleGuard`):**
```typescript
await registerWithRoleGuard(app, buildRoutes, '/v1/', { database: options.database });
await registerWithRoleGuard(app, codeRepoRoutes, '/v1/code-repo');
await registerWithRoleGuard(app, aiReviewRoutes, '/v1/ai-review');
await registerWithRoleGuard(app, diagnosticRoutes, '/v1/diagnostic', { database: options.database });
await registerWithRoleGuard(app, monitoringRoutes, '/v1/monitoring', { database: options.database });
await registerWithRoleGuard(app, selfHealingRoutes, '/v1/self-healing', { database: options.database });
await registerWithRoleGuard(app, pluginRoutes, '/v1/plugins');
await registerWithRoleGuard(app, aiSecurityRoutes, '/v1/ai-security', { database: options.database });
await registerWithRoleGuard(app, auditRoutes, '/v1/audit', { database: options.database });
await registerWithRoleGuard(app, tenantRoutes, '/v1/tenant', { database: options.database });
await registerWithRoleGuard(app, aiCostRoutes, '/v1/ai-cost', { database: options.database });
await registerWithRoleGuard(app, iacRoutes, '/v1/iac', { eventBus: options.database, database: options.database });
await registerWithRoleGuard(app, chatopsRoutes, '/v1/chatops', { ... });
await registerWithRoleGuard(app, confirmationRoutes, '/v1/confirmations', { database: options.database, eventBus: options.eventBus });
await registerWithRoleGuard(app, vectorStoreRoutes, '/v1/vector-store', { database: options.database });
await registerWithRoleGuard(app, eventbusRoutes, '/v1/eventbus', { database: options.database, eventBus: options.eventBus });
await registerWithRoleGuard(app, roleRoutes, '/v1/roles', { database: options.database });
await registerWithRoleGuard(app, userRoutes, '/v1/users', { database: options.database });
await registerWithRoleGuard(app, apiKeyRoutes, '/v1/api-keys', { database: options.database });
```

**Currently UNPROTECTED (no auth middleware):**
```typescript
// Pipeline CRUD — directly registered on app
app.post('/v1/pipelines', ...);    // CREATE
app.get('/v1/pipelines', ...);     // LIST
app.get('/v1/pipelines/:id', ...); // GET
app.get('/v1/pipelines/:id/versions', ...);
app.put('/v1/pipelines/:id', ...); // UPDATE
app.delete('/v1/pipelines/:id', ...); // DELETE
app.post('/v1/pipelines/validate', ...);

// PipelineRun CRUD
app.post('/v1/pipelines/:id/runs', ...);
app.get('/v1/pipeline-runs', ...);
app.get('/v1/pipeline-runs/:id', ...);
app.post('/v1/pipeline-runs/:id/cancel', ...);
app.get('/v1/pipeline-runs/:id/stages', ...);
app.get('/v1/pipeline-runs/:id/tasks', ...);

// Stage CRUD
app.get('/v1/stages/:id', ...);
app.get('/v1/stages/:id/tasks', ...);
app.post('/v1/stages/:id/retry', ...);

// Task CRUD
app.get('/v1/tasks/:id', ...);
app.get('/v1/tasks/:id/log', ...);
app.post('/v1/tasks/:id/retry', ...);

// Module registrations without auth
await app.register(cmdbRoutes, { prefix: '/v1/cmdb', ... });
await app.register(configRoutes, { prefix: '/v1/config', ... });
await app.register(costRoutes, { prefix: '/v1/cost', ... });
await app.register(riskRoutes, { prefix: '/v1/risk' });
await app.register(finopsV2Routes, { prefix: '/v1/finops', ... });
await app.register(testSelectorRoutes, { prefix: '/v1/test-selector' });
await app.register(deployRoutes, { prefix: '/v1/deploy', ... });
await app.register(ticketingRoutes, { prefix: '/v1/tickets', ... });
await app.register(backupRoutes, { prefix: '/v1/backup', ... });
await app.register(pluginSpiRoutes, { prefix: '/v1/plugins-spi' });
await app.register(aiGatewayRoutes, { prefix: '/v1/ai-gateway' });
await app.register(alertRoutes, { prefix: '/v1/alert' });
await app.register(efficiencyRoutes, { prefix: '/v1/efficiency', ... });
await app.register(sbomRoutes, { prefix: '/v1/sbom', ... });
await app.register(policyRoutes, { prefix: '/v1/policies', ... });
await app.register(changeIntelligenceRoutes, { prefix: '/v1/change-intelligence', ... });
await app.register(canaryAnalysisRoutes, { prefix: '/v1/canary-analysis', ... });
await app.register(skillRoutes, { prefix: '/v1/skills', ... });
await app.register(oncallRoutes, { prefix: '/v1/oncall', ... });
await app.register(approvalRoutes, { prefix: '/v1/approvals', ... });
await app.register(cronRoutes, { prefix: '/v1/cron', ... });
await app.register(productLineRoutes, { prefix: '/v1/product-lines', ... });
await app.register(internalLibraryRoutes, { prefix: '/v1/internal-libraries', ... });
await app.register(notificationRoutes, { prefix: '/v1/notifications' });
await app.register(sessionRoutes, { prefix: '/v1/sessions', ... });
await app.register(webhookRoutes, { prefix: '/v1/webhooks', ... });
await app.register(projectRoutes, { prefix: '/v1/projects', ... });
await app.register(environmentRoutes, { prefix: '/v1/environments', ... });
await app.register(queueRoutes, { prefix: '/v1/queue', ... });
await app.register(knowledgeRoutes, { prefix: '/v1/knowledge', ... });
await app.register(metricsRoutes, { prefix: '/v1/metrics', ... });
await app.register(agentRoutes, { prefix: '/v1/', ... });
```

### Current Frontend Auth Flow

```typescript
// src/api/client.ts — request interceptor (adds token)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// src/api/client.ts — response interceptor (401 handler, NO refresh)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'; // NO refresh attempt!
      }
    }
    // ...
  }
);

// src/router/index.tsx — ProtectedRoute (client-side only check)
const checkIsAuthenticated = (): boolean => {
  const token = localStorage.getItem('access_token');
  if (!token) return false;
  const expiresAt = localStorage.getItem('token_expires_at');
  if (expiresAt && new Date().getTime() > parseInt(expiresAt, 10)) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_expires_at');
    return false;
  }
  return true; // FORGED TOKENS STILL PASS!
};
```

### Gateway Mock User Database

```typescript
// orion-api-gateway/src/routes/auth.routes.ts lines 47-87
const mockUsers: Map<string, User> = new Map([
  ['admin', {
    id: '1', username: 'admin', email: 'admin@orion.com',
    passwordHash: 'admin123', // PLAINTEXT!
    roles: ['admin'], status: 'active', createdAt: new Date(),
  }],
  ['developer', {
    id: '2', username: 'developer', email: 'dev@orion.com',
    passwordHash: 'dev123', // PLAINTEXT!
    roles: ['developer'], status: 'active', createdAt: new Date(),
  }],
  ['tester', {
    id: '3', username: 'tester', email: 'tester@orion.com',
    passwordHash: 'test123', // PLAINTEXT!
    roles: ['tester'], status: 'active', createdAt: new Date(),
  }],
]);
```

---

## Implementation Design

### Priority 1: CRITICAL — Add Auth Middleware to All Unprotected Platform Service Routes

**File:** `orion-platform-service/src/api/routes.ts`

**Strategy:** Wrap every unprotected route registration with `registerWithRoleGuard()` or wrap individual route handlers with `preHandler: [authenticateUser]`.

For Pipeline CRUD routes (currently inline handlers on `app`), wrap them in a Fastify encapsulated scope with `onRequest` hooks:

```typescript
// orion-platform-service/src/api/routes.ts

// Wrap Pipeline CRUD routes with auth
await app.register(async (instance: FastifyInstance) => {
  instance.addHook('onRequest', authenticateUser);

  // POST /api/v1/pipelines - Create Pipeline
  instance.post('/v1/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.create(request, reply);
  });

  // GET /api/v1/pipelines - List Pipelines
  instance.get('/v1/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.list(request, reply);
  });

  // GET /api/v1/pipelines/:id - Get Pipeline
  instance.get('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.getById(request, reply);
  });

  // GET /api/v1/pipelines/:id/versions - Get all versions
  instance.get('/v1/pipelines/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.getVersions(request, reply);
  });

  // PUT /api/v1/pipelines/:id - Update Pipeline
  instance.put('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.update(request, reply);
  });

  // DELETE /api/v1/pipelines/:id - Delete Pipeline
  instance.delete('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.delete(request, reply);
  });

  // POST /api/v1/pipelines/validate - Validate YAML (auth required)
  instance.post('/v1/pipelines/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.validate(request, reply);
  });
});

// Wrap PipelineRun routes
await app.register(async (instance: FastifyInstance) => {
  instance.addHook('onRequest', authenticateUser);

  instance.post('/v1/pipelines/:id/runs', async (request, reply) => {
    return pipelineRunController.trigger(request, reply);
  });
  instance.get('/v1/pipeline-runs', async (request, reply) => {
    return pipelineRunController.list(request, reply);
  });
  instance.get('/v1/pipeline-runs/:id', async (request, reply) => {
    return pipelineRunController.getById(request, reply);
  });
  instance.post('/v1/pipeline-runs/:id/cancel', async (request, reply) => {
    return pipelineRunController.cancel(request, reply);
  });
  instance.get('/v1/pipeline-runs/:id/stages', async (request, reply) => {
    return pipelineRunController.getStages(request, reply);
  });
  instance.get('/v1/pipeline-runs/:id/tasks', async (request, reply) => {
    return pipelineRunController.getTasks(request, reply);
  });
});

// Wrap Stage routes
await app.register(async (instance: FastifyInstance) => {
  instance.addHook('onRequest', authenticateUser);

  instance.get('/v1/stages/:id', async (request, reply) => {
    return stageController.getById(request, reply);
  });
  instance.get('/v1/stages/:id/tasks', async (request, reply) => {
    return stageController.getTasks(request, reply);
  });
  instance.post('/v1/stages/:id/retry', async (request, reply) => {
    return stageController.retry(request, reply);
  });
});

// Wrap Task routes
await app.register(async (instance: FastifyInstance) => {
  instance.addHook('onRequest', authenticateUser);

  instance.get('/v1/tasks/:id', async (request, reply) => {
    return taskController.getById(request, reply);
  });
  instance.get('/v1/tasks/:id/log', async (request, reply) => {
    return taskController.getLog(request, reply);
  });
  instance.post('/v1/tasks/:id/retry', async (request, reply) => {
    return taskController.retry(request, reply);
  });
});
```

For module registrations, change from `app.register()` to `registerWithRoleGuard()`:

```typescript
// BEFORE (unprotected):
await app.register(cmdbRoutes, { prefix: '/v1/cmdb', database: options.database });
await app.register(configRoutes, { prefix: '/v1/config', database: options.database });
await app.register(costRoutes, { prefix: '/v1/cost', database: options.database });
await app.register(riskRoutes, { prefix: '/v1/risk' });
await app.register(finopsV2Routes, { prefix: '/v1/finops', database: options.database });
await app.register(testSelectorRoutes, { prefix: '/v1/test-selector' });
await app.register(deployRoutes, { prefix: '/v1/deploy', database: options.database });
await app.register(ticketingRoutes, { prefix: '/v1/tickets', database: options.database });
await app.register(backupRoutes, { prefix: '/v1/backup', database: options.database });
await app.register(pluginSpiRoutes, { prefix: '/v1/plugins-spi' });
await app.register(aiGatewayRoutes, { prefix: '/v1/ai-gateway' });
await app.register(alertRoutes, { prefix: '/v1/alert' });
await app.register(efficiencyRoutes, { prefix: '/v1/efficiency', database: options.database });
await app.register(sbomRoutes, { prefix: '/v1/sbom', eventBus: options.eventBus, database: options.database });
await app.register(policyRoutes, { prefix: '/v1/policies', database: options.database, eventBus: options.eventBus });
await app.register(changeIntelligenceRoutes, { prefix: '/v1/change-intelligence', eventBus: options.eventBus });
await app.register(canaryAnalysisRoutes, { prefix: '/v1/canary-analysis', eventBus: options.eventBus });
await app.register(skillRoutes, { prefix: '/v1/skills', database: options.database });
await app.register(oncallRoutes, { prefix: '/v1/oncall', database: options.database, eventBus: options.eventBus });
await app.register(approvalRoutes, { prefix: '/v1/approvals', database: options.database });
await app.register(cronRoutes, { prefix: '/v1/cron', database: options.database });
await app.register(productLineRoutes, { prefix: '/v1/product-lines', database: options.database });
await app.register(internalLibraryRoutes, { prefix: '/v1/internal-libraries', database: options.database });
await app.register(notificationRoutes, { prefix: '/v1/notifications' });
await app.register(sessionRoutes, { prefix: '/v1/sessions', database: options.database });
await app.register(webhookRoutes, { prefix: '/v1/webhooks', database: options.database });
await app.register(projectRoutes, { prefix: '/v1/projects', database: options.database });
await app.register(environmentRoutes, { prefix: '/v1/environments', database: options.database });
await app.register(queueRoutes, { prefix: '/v1/queue', database: options.database });
await app.register(knowledgeRoutes, { prefix: '/v1/knowledge', database: options.database });
await app.register(metricsRoutes, { prefix: '/v1/metrics', database: options.database });
await app.register(agentRoutes, { prefix: '/v1/', eventBus: options.eventBus, database: options.database });

// AFTER (protected with authenticateUser):
await registerWithRoleGuard(app, cmdbRoutes, '/v1/cmdb', { database: options.database });
await registerWithRoleGuard(app, configRoutes, '/v1/config', { database: options.database });
await registerWithRoleGuard(app, costRoutes, '/v1/cost', { database: options.database });
await registerWithRoleGuard(app, riskRoutes, '/v1/risk');
await registerWithRoleGuard(app, finopsV2Routes, '/v1/finops', { database: options.database });
await registerWithRoleGuard(app, testSelectorRoutes, '/v1/test-selector');
await registerWithRoleGuard(app, deployRoutes, '/v1/deploy', { database: options.database });
await registerWithRoleGuard(app, ticketingRoutes, '/v1/tickets', { database: options.database });
await registerWithRoleGuard(app, backupRoutes, '/v1/backup', { database: options.database });
await registerWithRoleGuard(app, pluginSpiRoutes, '/v1/plugins-spi');
await registerWithRoleGuard(app, aiGatewayRoutes, '/v1/ai-gateway');
await registerWithRoleGuard(app, alertRoutes, '/v1/alert');
await registerWithRoleGuard(app, efficiencyRoutes, '/v1/efficiency', { database: options.database });
await registerWithRoleGuard(app, sbomRoutes, '/v1/sbom', { eventBus: options.eventBus, database: options.database });
await registerWithRoleGuard(app, policyRoutes, '/v1/policies', { database: options.database, eventBus: options.eventBus });
await registerWithRoleGuard(app, changeIntelligenceRoutes, '/v1/change-intelligence', { eventBus: options.eventBus });
await registerWithRoleGuard(app, canaryAnalysisRoutes, '/v1/canary-analysis', { eventBus: options.eventBus });
await registerWithRoleGuard(app, skillRoutes, '/v1/skills', { database: options.database });
await registerWithRoleGuard(app, oncallRoutes, '/v1/oncall', { database: options.database, eventBus: options.eventBus });
await registerWithRoleGuard(app, approvalRoutes, '/v1/approvals', { database: options.database });
await registerWithRoleGuard(app, cronRoutes, '/v1/cron', { database: options.database });
await registerWithRoleGuard(app, productLineRoutes, '/v1/product-lines', { database: options.database });
await registerWithRoleGuard(app, internalLibraryRoutes, '/v1/internal-libraries', { database: options.database });
await registerWithRoleGuard(app, notificationRoutes, '/v1/notifications');
await registerWithRoleGuard(app, sessionRoutes, '/v1/sessions', { database: options.database });
await registerWithRoleGuard(app, webhookRoutes, '/v1/webhooks', { database: options.database });
await registerWithRoleGuard(app, projectRoutes, '/v1/projects', { database: options.database });
await registerWithRoleGuard(app, environmentRoutes, '/v1/environments', { database: options.database });
await registerWithRoleGuard(app, queueRoutes, '/v1/queue', { database: options.database });
await registerWithRoleGuard(app, knowledgeRoutes, '/v1/knowledge', { database: options.database });
await registerWithRoleGuard(app, metricsRoutes, '/v1/metrics', { database: options.database });
await registerWithRoleGuard(app, agentRoutes, '/v1/', { eventBus: options.eventBus, database: options.database });
```

**Routes that remain public (no auth):**
- Auth routes themselves: `/v1/auth/login`, `/v1/auth/register`, `/v1/auth/refresh`
- Health checks: `/healthz`, `/ready`
- These are registered separately in `index.ts` before `apiRoutes()` is called

---

### Priority 2: HIGH — Fix Token Refresh Flow in Axios Interceptor

**File:** `orion-frontend/src/api/client.ts`

The current 401 interceptor immediately clears localStorage and redirects to `/login`. It must attempt token refresh first. The `authStore` already has `getToken()` with refresh logic and `refreshAuthToken()`, but they are not used by the axios interceptor.

```typescript
// orion-frontend/src/api/client.ts
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse } from './types';

// 创建 Axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 — 使用 authStore.getToken() 支持自动刷新
import { useAuthStore } from '@/stores/authStore';

apiClient.interceptors.request.use(
  async (config) => {
    // 优先使用 authStore 的 token（支持过期自动刷新）
    const authStore = useAuthStore.getState();
    const token = await authStore.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 401 响应时的刷新队列 — 防止并发请求同时触发多次刷新
let isRefreshing = false;
type PendingRequest = {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
};
let failedQueue: PendingRequest[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// 响应拦截器 — 带自动 Token 刷新
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      // 排除 auth 相关请求，防止无限循环
      const url = originalRequest.url || '';
      if (url.includes('/v1/auth/')) {
        // Token 刷新本身也 401，说明 refresh token 也失效了
        useAuthStore.getState().logout();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // 已有请求在刷新 token，将当前请求加入队列
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = {
              ...originalRequest.headers,
              Authorization: `Bearer ${token}`,
            };
            return apiClient(originalRequest);
          })
          .catch((refreshError) => {
            return Promise.reject(refreshError);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // 直接调用刷新端点（绕过当前 axios 实例的拦截器，避免递归）
        const response = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || '/api'}/v1/auth/refresh`,
          { refreshToken },
          { timeout: 10000 }
        );

        const { accessToken, refreshToken: newRefreshToken, expiresAt } = response.data.data;

        // 更新 authStore
        useAuthStore.getState().setTokens(
          accessToken,
          newRefreshToken || refreshToken,
          expiresAt
        );

        // 处理队列中的等待请求
        processQueue(null, accessToken);

        // 重试原始请求
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${accessToken}`,
        };
        return apiClient(originalRequest);
      } catch (refreshError) {
        // 刷新失败 — 清除所有状态，跳转到登录页
        processQueue(refreshError as Error, null);
        useAuthStore.getState().logout();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 其他错误处理保持不变
    if (error.response) {
      const { status } = error.response;
      if (status === 403) {
        console.error('403 Forbidden: 没有权限访问该资源');
      }
      if (status === 404) {
        console.error('404 Not Found: 资源不存在');
      }
      if (status >= 500) {
        console.error('500 Server Error: 服务器错误');
      }
    }

    return Promise.reject(error);
  }
);

// 导出请求方法（保持不变）
export const api = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.get(url, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.post(url, data, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.put(url, data, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.delete(url, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.patch(url, data, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },
};

export default apiClient;
```

**Key changes:**
1. Request interceptor now uses `useAuthStore.getState().getToken()` which auto-refreshes if token is expiring
2. 401 interceptor has a refresh queue (`failedQueue`) to handle concurrent requests
3. Auth endpoints (`/v1/auth/*`) are excluded from refresh to prevent infinite loops
4. Refresh uses raw `axios.post` (not `api.post`) to avoid interceptor recursion
5. On success, uses `authStore.setTokens()` to update both Zustand state and localStorage

---

### Priority 3: HIGH — Add `/me` Validation on App Startup

**File:** `orion-frontend/src/router/index.tsx`

The current `ProtectedRoute` only checks localStorage. It must validate the token against the server using `GET /v1/auth/me`.

```typescript
// orion-frontend/src/router/index.tsx

// Add initialization effect to AppRoutes or a top-level component
import { getCurrentUser } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';

// Replace checkIsAuthenticated with server-validated version
const validateAuthToken = async (): Promise<boolean> => {
  const token = localStorage.getItem('access_token');
  if (!token) return false;

  try {
    const response = await getCurrentUser();
    // Server validated — update authStore with real user data
    useAuthStore.getState().setUser({
      id: response.id,
      username: response.username,
      email: response.email,
      role: response.role,
      avatar: response.avatar,
    });
    useAuthStore.getState().setAuthenticated(true);
    return true;
  } catch {
    // Token invalid or expired on server side
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expires_at');
    useAuthStore.getState().logout();
    return false;
  }
};

// Update ProtectedRoute to use server validation
const ProtectedRoute: React.FC<{ children: React.ReactNode; route: AppRoute }> = ({
  children,
  route,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = useAuthStore((state) => state.user?.role);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isChecking, setIsChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const checkAuth = useCallback(async () => {
    // Server-side validation (Priority 3 fix)
    let auth = isAuthenticated;
    if (!auth) {
      // Only validate on first load — authStore should be populated after that
      const token = localStorage.getItem('access_token');
      if (!token) {
        navigate('/login', { state: { from: location }, replace: true });
        return;
      }
      auth = await validateAuthToken();
      if (!auth) {
        navigate('/login', { state: { from: location }, replace: true });
        return;
      }
    }

    // Check role permissions
    if (!checkRoleAccess(userRole, route.requiredRole)) {
      message.error('您没有权限访问此页面');
      navigate('/dashboard', { replace: true });
      return;
    }

    setAuthorized(true);
    setIsChecking(false);
  }, [navigate, location.pathname, userRole, route.requiredRole, isAuthenticated]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Subscribe to authStore changes
  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe(
      (state) => state.isAuthenticated,
      (isAuth) => {
        if (isAuth && !authorized) {
          setAuthorized(true);
          setIsChecking(false);
        }
      }
    );
    return unsubscribe;
  }, [authorized]);

  if (isChecking) {
    return <Loading fullscreen />;
  }

  if (!authorized) {
    return null; // Will redirect to login or dashboard
  }

  return <>{children}</>;
};
```

**Alternative approach (simpler, recommended):** Add a top-level `AuthInitializer` component in `App.tsx` or `main.tsx` that runs once on app mount:

```typescript
// orion-frontend/src/components/AuthInitializer.tsx
import React, { useEffect, useState } from 'react';
import { getCurrentUser } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import { Loading } from '@/components/Loading';

interface AuthInitializerProps {
  children: React.ReactNode;
}

export const AuthInitializer: React.FC<AuthInitializerProps> = ({ children }) => {
  const [initialized, setInitialized] = useState(false);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem('access_token');
      if (!token) {
        useAuthStore.getState().logout();
        setInitialized(true);
        return;
      }

      try {
        const response = await getCurrentUser();
        setUser({
          id: response.id,
          username: response.username,
          email: response.email,
          role: response.role,
          avatar: response.avatar,
        });
        setAuthenticated(true);
      } catch {
        // Token invalid — clear and let ProtectedRoute redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('token_expires_at');
        useAuthStore.getState().logout();
      } finally {
        setInitialized(true);
      }
    }
    init();
  }, [setUser, setAuthenticated]);

  if (!initialized) {
    return <Loading fullscreen />;
  }

  return <>{children}</>;
};
```

Then wrap `AppRoutes` with `AuthInitializer`:

```typescript
// orion-frontend/src/router/index.tsx
const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthInitializer>
        <AppRoutes />
      </AuthInitializer>
    </BrowserRouter>
  );
};
```

---

### Priority 4: MEDIUM — Fix expiresIn / expiresAt Mismatch

**Problem:** The API Gateway login response returns `expiresIn` (seconds, number) but the frontend `LoginResponse` type expects `expiresAt` (millisecond timestamp, number). The Platform Service already returns `expiresAt` correctly, so this gap only affects Gateway traffic.

**Option A (Recommended): Standardize on `expiresAt` — Update Gateway to match Platform Service**

**File:** `orion-api-gateway/src/routes/auth.routes.ts`

In `registerLoginRoute()`, change the response:

```typescript
// BEFORE (line ~260):
return reply.code(200).send({
  success: true,
  data: {
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    expiresIn: tokenPair.expiresIn,          // seconds — WRONG FORMAT
    refreshTokenExpiresIn: tokenPair.refreshTokenExpiresIn,
    user: { ... },
  },
});

// AFTER:
return reply.code(200).send({
  success: true,
  data: {
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    expiresAt: Date.now() + tokenPair.expiresIn * 1000,  // milliseconds timestamp
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.roles[0] || 'user',  // Map first role to single role string
    },
  },
});
```

In `registerRefreshRoute()`, apply the same change:

```typescript
// BEFORE (line ~368):
return reply.code(200).send({
  success: true,
  data: tokenPair,  // returns { accessToken, refreshToken, expiresIn, refreshTokenExpiresIn }
});

// AFTER:
return reply.code(200).send({
  success: true,
  data: {
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    expiresAt: Date.now() + tokenPair.expiresIn * 1000,
  },
});
```

Also update the response schema in both routes:

```typescript
// In the schema response definition, change:
expiresIn: { type: 'number' },
refreshTokenExpiresIn: { type: 'number' },
// To:
expiresAt: { type: 'number' },
```

**Option B (Fallback): Update Frontend Type to Handle Both**

If Gateway changes are blocked, add a normalization layer in the frontend:

```typescript
// orion-frontend/src/api/auth.ts
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/v1/auth/login', data);
  const loginData = response.data.data as LoginResponse;

  // Normalize expiresAt: if expiresIn (seconds) is returned, convert to expiresAt (ms)
  const normalized = loginData as any;
  if (normalized.expiresIn && !loginData.expiresAt) {
    loginData.expiresAt = Date.now() + normalized.expiresIn * 1000;
  }

  // Normalize user.role from user.roles array
  if (!loginData.user?.role && normalized.user?.roles?.length) {
    loginData.user.role = normalized.user.roles[0];
  }

  return loginData;
};
```

---

### Priority 5: MEDIUM — Unify Auth Systems (Gateway Proxy to Platform Service)

**Problem:** The API Gateway has its own mock user database (`mockUsers` Map) that is completely disconnected from the Platform Service's PostgreSQL-backed auth. Users who register via Platform Service cannot log in via Gateway, and vice versa.

**Solution:** Replace Gateway's mock auth with a proxy to Platform Service.

**File:** `orion-api-gateway/src/routes/auth.routes.ts`

```typescript
// orion-api-gateway/src/routes/auth.routes.ts
// Replace the mockUsers Map and all auth handlers with proxy

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getConfig } from '../config';

const PLATFORM_SERVICE_URL = process.env.PLATFORM_SERVICE_URL || 'http://localhost:3001';

export class AuthRoutes {
  constructor(private app: FastifyInstance) {
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.registerLoginRoute();
    this.registerRefreshRoute();
    this.registerLogoutRoute();
    this.registerMeRoute();
    this.registerRegisterRoute();
  }

  /**
   * POST /api/v1/auth/login — Proxy to Platform Service
   */
  private registerLoginRoute(): void {
    this.app.post('/api/v1/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const response = await fetch(`${PLATFORM_SERVICE_URL}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        });

        const data = await response.json();
        return reply.code(response.status).send(data);
      } catch (error) {
        this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Auth proxy: login failed');
        return reply.code(502).send({
          error: 'UPSTREAM_ERROR',
          message: 'Authentication service unavailable',
        });
      }
    });
  }

  /**
   * POST /api/v1/auth/refresh — Proxy to Platform Service
   */
  private registerRefreshRoute(): void {
    this.app.post('/api/v1/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const response = await fetch(`${PLATFORM_SERVICE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        });

        const data = await response.json();
        return reply.code(response.status).send(data);
      } catch (error) {
        this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Auth proxy: refresh failed');
        return reply.code(502).send({
          error: 'UPSTREAM_ERROR',
          message: 'Authentication service unavailable',
        });
      }
    });
  }

  /**
   * POST /api/v1/auth/logout — Proxy to Platform Service
   */
  private registerLogoutRoute(): void {
    this.app.post('/api/v1/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const response = await fetch(`${PLATFORM_SERVICE_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        });

        const data = await response.json();
        return reply.code(response.status).send(data);
      } catch (error) {
        this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Auth proxy: logout failed');
        return reply.code(502).send({
          error: 'UPSTREAM_ERROR',
          message: 'Authentication service unavailable',
        });
      }
    });
  }

  /**
   * GET /api/v1/auth/me — Proxy to Platform Service (with JWT validation)
   */
  private registerMeRoute(): void {
    this.app.get('/api/v1/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const response = await fetch(`${PLATFORM_SERVICE_URL}/api/v1/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': request.headers.authorization as string,
          },
        });

        const data = await response.json();
        return reply.code(response.status).send(data);
      } catch (error) {
        this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Auth proxy: me failed');
        return reply.code(502).send({
          error: 'UPSTREAM_ERROR',
          message: 'Authentication service unavailable',
        });
      }
    });
  }

  /**
   * POST /api/v1/auth/register — Proxy to Platform Service
   */
  private registerRegisterRoute(): void {
    this.app.post('/api/v1/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const response = await fetch(`${PLATFORM_SERVICE_URL}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        });

        const data = await response.json();
        return reply.code(response.status).send(data);
      } catch (error) {
        this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Auth proxy: register failed');
        return reply.code(502).send({
          error: 'UPSTREAM_ERROR',
          message: 'Authentication service unavailable',
        });
      }
    });
  }
}
```

**Benefits of this approach:**
- Single source of truth for user data (PostgreSQL in Platform Service)
- No duplicate password storage
- Gateway can still add device fingerprinting as a side-effect if needed
- Gateway's `TokenService` for Redis-backed refresh tokens can be removed (Platform Service handles refresh tokens in PostgreSQL)

**Items to remove from Gateway after proxy implementation:**
- `mockUsers` Map (lines 47-87)
- `rbacService` dependency (or keep for Gateway-level ABAC, but not for login)
- `TokenService` injection in `AuthRoutes` constructor
- All local JWT generation logic

---

### Priority 6: LOW — Remove Default Credentials from Login Page

**File:** `orion-frontend/src/pages/Login/index.tsx`

```typescript
// BEFORE:
<Form
  form={form}
  name="login"
  onFinish={handleSubmit}
  autoComplete="off"
  size="large"
  initialValues={{
    username: 'admin',
    password: 'admin123',
  }}
>

// AFTER:
<Form
  form={form}
  name="login"
  onFinish={handleSubmit}
  autoComplete="off"
  size="large"
>
```

Remove the default credentials display:

```typescript
// REMOVE these lines (lines 94-98):
<div style={{ textAlign: 'center', marginTop: 16 }}>
  <Typography.Text type="secondary" style={{ fontSize: spacing[3] }}>
    默认账号：admin / admin123
  </Typography.Text>
</div>
```

---

### Priority 7: LOW — JWT Secret Alignment (VULN-3)

**Files:**
- `orion-platform-service/.env` (or docker-compose)
- `orion-api-gateway/.env` (or docker-compose)
- `orion-api-gateway/src/config.ts`

**Issue:** Platform Service reads `process.env.JWT_SECRET` directly. Gateway may read `config.jwtSecret` which may come from a different source.

**Fix:** Ensure both services read from the same environment variable:

```yaml
# docker-compose.yml (or equivalent)
services:
  platform-service:
    environment:
      JWT_SECRET: ${JWT_SECRET}  # Same value for both services

  api-gateway:
    environment:
      JWT_SECRET: ${JWT_SECRET}  # Identical to platform-service
```

In `orion-api-gateway/src/config.ts`:

```typescript
// Add JWT_SECRET to config, read from same env var as Platform Service
jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
```

In `orion-platform-service/src/middleware/authMiddleware.ts` and `orion-platform-service/src/api/routes-auth.ts`, the JWT secret is already read from `process.env.JWT_SECRET` — no changes needed.

If the Gateway proxies auth to Platform Service (Priority 5), this becomes a non-issue since the Gateway no longer generates JWTs.

---

### Priority 8: LOW — localStorage to HTTP-only Cookie Migration (Future)

**Current state:** JWT tokens stored in `localStorage`, accessible to XSS attacks. Acceptable for internal platform but should migrate for production.

**Target architecture:**
```
Browser ← Set-Cookie (HttpOnly, Secure, SameSite=Strict) → Gateway/Platform Service
Browser does NOT store tokens — cookies sent automatically with requests
CSRF protection via SameSite + CSRF token for non-GET requests
```

**Migration steps (future):**
1. Add `/v1/auth/login` cookie-based response option (set `Set-Cookie` header)
2. Update axios `withCredentials: true`
3. Remove localStorage token storage from `authStore`
4. Update ProtectedRoute to validate via `/me` endpoint (cookie-based)
5. Deploy with feature flag for gradual rollout

**Not part of current scope.** Document here as technical debt item.

---

## File Changes Summary

### Platform Service (Backend)

| # | File | Change |
|---|------|--------|
| 1 | `orion-platform-service/src/api/routes.ts` | Wrap all unprotected route registrations with `registerWithRoleGuard()` or encapsulated `instance.addHook('onRequest', authenticateUser)` |
| 2 | `orion-platform-service/src/middleware/authMiddleware.ts` | No changes needed — already correct |
| 3 | `orion-platform-service/src/middleware/roleGuard.ts` | No changes needed — already correct |
| 4 | `orion-platform-service/src/api/routes-auth.ts` | No changes needed — already returns `expiresAt` correctly |

### API Gateway (Backend)

| # | File | Change |
|---|------|--------|
| 1 | `orion-api-gateway/src/routes/auth.routes.ts` | Replace mock user DB with proxy to Platform Service (Priority 5). Or at minimum, change response from `expiresIn` to `expiresAt` (Priority 4) |
| 2 | `orion-api-gateway/src/config.ts` | Ensure `jwtSecret` reads from `process.env.JWT_SECRET` (Priority 7) |

### Frontend

| # | File | Change |
|---|------|--------|
| 1 | `orion-frontend/src/api/client.ts` | Update axios interceptor with auto-refresh logic (Priority 2) |
| 2 | `orion-frontend/src/router/index.tsx` | Add `AuthInitializer` component for `/me` validation on startup (Priority 3) |
| 3 | `orion-frontend/src/components/AuthInitializer.tsx` | New file — startup auth validation component |
| 4 | `orion-frontend/src/pages/Login/index.tsx` | Remove default credentials from `initialValues` and UI text (Priority 6) |
| 5 | `orion-frontend/src/api/auth.ts` | Add normalization layer for `expiresIn`/`expiresAt` and `role`/`roles` if Gateway changes are blocked (Priority 4 Option B) |

### Shared / Infrastructure

| # | File | Change |
|---|------|--------|
| 1 | `docker-compose.yml` or `.env.example` | Document shared `JWT_SECRET` requirement |
| 2 | `orion-api-gateway/src/services/token.service.ts` | Can be removed/deprecated after Priority 5 |

---

## Testing Requirements

### 1. Auth Middleware Test — Unprotected Endpoint Returns 401

```bash
# Test that previously-public endpoint now requires auth
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/pipelines
# Expected: 401

# Test with valid token
curl -s -H "Authorization: Bearer $(echo -n '{"userId":"1","username":"admin","role":"admin","iat":'$(date +%s)'}' | base64 | tr -d '\n')" \
  http://localhost:3001/api/v1/pipelines
# Expected: 200 (or appropriate response)
```

### 2. Token Refresh Test

**Scenario:** Access token expires during active session → auto-refresh → original request succeeds.

1. Login to get tokens
2. Wait 5 minutes (or manually expire the token in DB)
3. Make an API request
4. Verify: request succeeds without user intervention
5. Verify: new access token stored in localStorage
6. Verify: no redirect to /login occurred

### 3. Startup Validation Test

**Scenario:** Stale/forged token in localStorage → app startup → `/me` fails → redirect to login.

1. Manually insert a forged token into localStorage
2. Reload the app
3. Verify: `AuthInitializer` calls `/v1/auth/me`
4. Verify: `/me` returns 401
5. Verify: user redirected to `/login`
6. Verify: localStorage cleared

### 4. Role-Based Access Test

**Scenario:** Non-admin user attempts to access admin-only route.

1. Login as non-admin user
2. Navigate to `/v1/roles` or `/v1/users` (admin-only routes)
3. Verify: 403 Forbidden response
4. Verify: error message displayed in UI

### 5. Gateway Auth Proxy Test

**Scenario:** Login via Gateway → credentials validated against Platform Service DB.

1. Create a user via Platform Service `/v1/auth/register`
2. Login via Gateway `/api/v1/auth/login` with same credentials
3. Verify: login succeeds (proves Gateway uses Platform Service, not mock DB)

### 6. Concurrent Request Refresh Test

**Scenario:** Multiple concurrent API requests → single refresh → all requests retried.

1. Login to get tokens
2. Expire the access token
3. Fire 5 concurrent API requests
4. Verify: only 1 refresh request sent to `/v1/auth/refresh`
5. Verify: all 5 original requests succeed with new token

---

## Migration Rollout Plan

### Phase 1: Critical Security (Week 1)
- [ ] Priority 1: Add auth middleware to all unprotected Platform Service routes
- [ ] Priority 7: Align JWT_SECRET across services

### Phase 2: Token Lifecycle (Week 2)
- [ ] Priority 2: Fix axios interceptor with auto-refresh
- [ ] Priority 3: Add `/me` validation on app startup
- [ ] Priority 4: Fix `expiresIn`/`expiresAt` mismatch

### Phase 3: Auth Unification (Week 3)
- [ ] Priority 5: Replace Gateway mock auth with Platform Service proxy
- [ ] Priority 6: Remove default credentials from login page

### Phase 4: Hardening (Future)
- [ ] Priority 8: Migrate from localStorage to HTTP-only cookies
- [ ] Add rate limiting to auth endpoints
- [ ] Add account lockout after failed login attempts
- [ ] Add audit logging for auth events
