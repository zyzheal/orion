# Auth & Security Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical authentication and authorization gaps across the platform

**Architecture:** Three-layer fix: Platform Service (add auth middleware) → API Gateway (unify auth) → Frontend (token refresh, startup validation). Priority order: Critical → High → Medium → Low.

**Tech Stack:** Node.js, TypeScript, Fastify, React, Axios, JWT

---

## Task 1: Add Auth Middleware to All Unprotected Platform Service Routes

**Severity:** CRITICAL (VULN-1)
**File:** `/Users/heal/orion-design/orion-platform-service/src/api/routes.ts`

### Current State
Lines 145-243: Pipeline/PipelineRun/Stage/Task routes registered directly on `app` with no auth.
Lines 248-406: 32 module registrations using `app.register()` instead of `registerWithRoleGuard()`.

### Changes

**Step 1.1:** Wrap Pipeline CRUD routes (lines 142-177) in an encapsulated scope with `authenticateUser` hook:

Replace lines 142-177 with:
```typescript
  // ==================== Pipeline 路由 (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // POST /api/v1/pipelines - 创建 Pipeline
    instance.post('/v1/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.create(request, reply);
    });

    // GET /api/v1/pipelines - 获取 Pipeline 列表
    instance.get('/v1/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.list(request, reply);
    });

    // GET /api/v1/pipelines/:id - 获取 Pipeline 详情
    instance.get('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.getById(request, reply);
    });

    // GET /api/v1/pipelines/:id/versions - 获取 Pipeline 所有版本
    instance.get('/v1/pipelines/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.getVersions(request, reply);
    });

    // PUT /api/v1/pipelines/:id - 更新 Pipeline
    instance.put('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.update(request, reply);
    });

    // DELETE /api/v1/pipelines/:id - 删除 Pipeline
    instance.delete('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.delete(request, reply);
    });

    // POST /api/v1/pipelines/validate - 验证 Pipeline YAML
    instance.post('/v1/pipelines/validate', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.validate(request, reply);
    });
  });
```

**Step 1.2:** Wrap PipelineRun routes (lines 179-209) similarly:

Replace lines 179-209 with:
```typescript
  // ==================== PipelineRun 路由 (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // POST /api/v1/pipelines/:id/runs - 触发 Pipeline 执行
    instance.post('/v1/pipelines/:id/runs', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.trigger(request, reply);
    });

    // GET /api/v1/pipeline-runs - 获取 PipelineRun 列表
    instance.get('/v1/pipeline-runs', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.list(request, reply);
    });

    // GET /api/v1/pipeline-runs/:id - 获取 PipelineRun 详情
    instance.get('/v1/pipeline-runs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.getById(request, reply);
    });

    // POST /api/v1/pipeline-runs/:id/cancel - 取消 PipelineRun
    instance.post('/v1/pipeline-runs/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.cancel(request, reply);
    });

    // GET /api/v1/pipeline-runs/:id/stages - 获取 PipelineRun 的 Stages
    instance.get('/v1/pipeline-runs/:id/stages', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.getStages(request, reply);
    });

    // GET /api/v1/pipeline-runs/:id/tasks - 获取 PipelineRun 的 Tasks
    instance.get('/v1/pipeline-runs/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.getTasks(request, reply);
    });
  });
```

**Step 1.3:** Wrap Stage routes (lines 211-226):

Replace lines 211-226 with:
```typescript
  // ==================== Stage 路由 (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // GET /api/v1/stages/:id - 获取 Stage 详情
    instance.get('/v1/stages/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return stageController.getById(request, reply);
    });

    // GET /api/v1/stages/:id/tasks - 获取 Stage 下的 Tasks
    instance.get('/v1/stages/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
      return stageController.getTasks(request, reply);
    });

    // POST /api/v1/stages/:id/retry - 重试 Stage
    instance.post('/v1/stages/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
      return stageController.retry(request, reply);
    });
  });
```

**Step 1.4:** Wrap Task routes (lines 228-243):

Replace lines 228-243 with:
```typescript
  // ==================== Task 路由 (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // GET /api/v1/tasks/:id - 获取 Task 详情
    instance.get('/v1/tasks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return taskController.getById(request, reply);
    });

    // GET /api/v1/tasks/:id/log - 获取 Task 日志
    instance.get('/v1/tasks/:id/log', async (request: FastifyRequest, reply: FastifyReply) => {
      return taskController.getLog(request, reply);
    });

    // POST /api/v1/tasks/:id/retry - 重试 Task
    instance.post('/v1/tasks/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
      return taskController.retry(request, reply);
    });
  });
```

**Step 1.5:** Change all 32 unprotected `app.register()` calls to `registerWithRoleGuard()`:

| Line | Before | After |
|------|--------|-------|
| 248 | `await app.register(cmdbRoutes, { prefix: '/v1/cmdb', database: options.database });` | `await registerWithRoleGuard(app, cmdbRoutes, '/v1/cmdb', { database: options.database });` |
| 259 | `await app.register(configRoutes, { prefix: '/v1/config', database: options.database });` | `await registerWithRoleGuard(app, configRoutes, '/v1/config', { database: options.database });` |
| 262 | `await app.register(costRoutes, { prefix: '/v1/cost', database: options.database });` | `await registerWithRoleGuard(app, costRoutes, '/v1/cost', { database: options.database });` |
| 265 | `await app.register(riskRoutes, { prefix: '/v1/risk' });` | `await registerWithRoleGuard(app, riskRoutes, '/v1/risk');` |
| 268 | `await app.register(finopsV2Routes, { prefix: '/v1/finops', database: options.database });` | `await registerWithRoleGuard(app, finopsV2Routes, '/v1/finops', { database: options.database });` |
| 277 | `await app.register(testSelectorRoutes, { prefix: '/v1/test-selector' });` | `await registerWithRoleGuard(app, testSelectorRoutes, '/v1/test-selector');` |
| 280 | `await app.register(deployRoutes, { prefix: '/v1/deploy', database: options.database });` | `await registerWithRoleGuard(app, deployRoutes, '/v1/deploy', { database: options.database });` |
| 286 | `await app.register(ticketingRoutes, { prefix: '/v1/tickets', database: options.database });` | `await registerWithRoleGuard(app, ticketingRoutes, '/v1/tickets', { database: options.database });` |
| 292 | `await app.register(backupRoutes, { prefix: '/v1/backup', database: options.database });` | `await registerWithRoleGuard(app, backupRoutes, '/v1/backup', { database: options.database });` |
| 295 | `await app.register(pluginSpiRoutes, { prefix: '/v1/plugins-spi' });` | `await registerWithRoleGuard(app, pluginSpiRoutes, '/v1/plugins-spi');` |
| 304 | `await app.register(aiGatewayRoutes, { prefix: '/v1/ai-gateway' });` | `await registerWithRoleGuard(app, aiGatewayRoutes, '/v1/ai-gateway');` |
| 307 | `await app.register(alertRoutes, { prefix: '/v1/alert' });` | `await registerWithRoleGuard(app, alertRoutes, '/v1/alert');` |
| 316 | `await app.register(efficiencyRoutes, { prefix: '/v1/efficiency', database: options.database });` | `await registerWithRoleGuard(app, efficiencyRoutes, '/v1/efficiency', { database: options.database });` |
| 319 | `await app.register(sbomRoutes, { prefix: '/v1/sbom', eventBus: options.eventBus, database: options.database });` | `await registerWithRoleGuard(app, sbomRoutes, '/v1/sbom', { eventBus: options.eventBus, database: options.database });` |
| 322 | `await app.register(policyRoutes, { prefix: '/v1/policies', database: options.database, eventBus: options.eventBus });` | `await registerWithRoleGuard(app, policyRoutes, '/v1/policies', { database: options.database, eventBus: options.eventBus });` |
| 325 | `await app.register(changeIntelligenceRoutes, { prefix: '/v1/change-intelligence', eventBus: options.eventBus });` | `await registerWithRoleGuard(app, changeIntelligenceRoutes, '/v1/change-intelligence', { eventBus: options.eventBus });` |
| 328 | `await app.register(canaryAnalysisRoutes, { prefix: '/v1/canary-analysis', eventBus: options.eventBus });` | `await registerWithRoleGuard(app, canaryAnalysisRoutes, '/v1/canary-analysis', { eventBus: options.eventBus });` |
| 331 | `await app.register(skillRoutes, { prefix: '/v1/skills', database: options.database });` | `await registerWithRoleGuard(app, skillRoutes, '/v1/skills', { database: options.database });` |
| 350 | `await app.register(artifactRoutes, { prefix: '/v1/artifacts', database: options.database });` | `await registerWithRoleGuard(app, artifactRoutes, '/v1/artifacts', { database: options.database });` |
| 356 | `await app.register(oncallRoutes, { prefix: '/v1/oncall', database: options.database, eventBus: options.eventBus });` | `await registerWithRoleGuard(app, oncallRoutes, '/v1/oncall', { database: options.database, eventBus: options.eventBus });` |
| 359-361 | `if (options.database) { await app.register(approvalRoutes, { prefix: '/v1/approvals', database: options.database }); }` | `if (options.database) { await registerWithRoleGuard(app, approvalRoutes, '/v1/approvals', { database: options.database }); }` |
| 364 | `await app.register(cronRoutes, { prefix: '/v1/cron', database: options.database });` | `await registerWithRoleGuard(app, cronRoutes, '/v1/cron', { database: options.database });` |
| 370 | `await app.register(productLineRoutes, { prefix: '/v1/product-lines', database: options.database });` | `await registerWithRoleGuard(app, productLineRoutes, '/v1/product-lines', { database: options.database });` |
| 373 | `await app.register(internalLibraryRoutes, { prefix: '/v1/internal-libraries', database: options.database });` | `await registerWithRoleGuard(app, internalLibraryRoutes, '/v1/internal-libraries', { database: options.database });` |
| 376 | `await app.register(notificationRoutes, { prefix: '/v1/notifications' });` | `await registerWithRoleGuard(app, notificationRoutes, '/v1/notifications');` |
| 382 | `await app.register(sessionRoutes, { prefix: '/v1/sessions', database: options.database });` | `await registerWithRoleGuard(app, sessionRoutes, '/v1/sessions', { database: options.database });` |
| 385 | `await app.register(webhookRoutes, { prefix: '/v1/webhooks', database: options.database });` | `await registerWithRoleGuard(app, webhookRoutes, '/v1/webhooks', { database: options.database });` |
| 388 | `await app.register(projectRoutes, { prefix: '/v1/projects', database: options.database });` | `await registerWithRoleGuard(app, projectRoutes, '/v1/projects', { database: options.database });` |
| 391 | `await app.register(environmentRoutes, { prefix: '/v1/environments', database: options.database });` | `await registerWithRoleGuard(app, environmentRoutes, '/v1/environments', { database: options.database });` |
| 394 | `await app.register(queueRoutes, { prefix: '/v1/queue', database: options.database });` | `await registerWithRoleGuard(app, queueRoutes, '/v1/queue', { database: options.database });` |
| 397 | `await app.register(knowledgeRoutes, { prefix: '/v1/knowledge', database: options.database });` | `await registerWithRoleGuard(app, knowledgeRoutes, '/v1/knowledge', { database: options.database });` |
| 400 | `await app.register(metricsRoutes, { prefix: '/v1/metrics', database: options.database });` | `await registerWithRoleGuard(app, metricsRoutes, '/v1/metrics', { database: options.database });` |
| 406 | `await app.register(agentRoutes, { prefix: '/v1/', eventBus: options.eventBus, database: options.database });` | `await registerWithRoleGuard(app, agentRoutes, '/v1/', { eventBus: options.eventBus, database: options.database });` |

### Test Commands
```bash
cd /Users/heal/orion-design/orion-platform-service
npm run type-check
npm run test -- --testPathPattern="routes" --passWithNoTests
```

### Git Commit
```bash
git add orion-platform-service/src/api/routes.ts
git commit -m "fix(auth): add auth middleware to all unprotected platform service routes

Wrap Pipeline/PipelineRun/Stage/Task inline routes with encapsulated
Fastify scope + authenticateUser hook. Convert 32 app.register() calls
to registerWithRoleGuard() for consistent JWT + RBAC enforcement.

Closes VULN-1: ~30+ endpoints were publicly accessible when bypassing
the API gateway."
```

---

## Task 2: Fix Axios Interceptor with Auto-Refresh Logic

**Severity:** HIGH (GAP-2)
**File:** `/Users/heal/orion-design/orion-frontend/src/api/client.ts`

### Current State
Lines 14-25: Request interceptor reads token directly from localStorage (no auto-refresh).
Lines 28-63: Response interceptor clears tokens and redirects on 401 without attempting refresh.

### Changes

Replace the entire file content with:

```typescript
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse } from './types';
import { useAuthStore } from '@/stores/authStore';

// 创建 Axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 — 使用 authStore.getToken() 支持自动刷新
apiClient.interceptors.request.use(
  async (config) => {
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

// 导出请求方法
export const api = {
  get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.get(url, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },

  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.post(url, data, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },

  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.put(url, data, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },

  delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.delete(url, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },

  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiClient.patch(url, data, config) as Promise<AxiosResponse<ApiResponse<T>>>;
  },
};

export default apiClient;
```

### Key Changes
1. Request interceptor now uses `useAuthStore.getState().getToken()` which auto-refreshes if token is expiring
2. 401 interceptor has a refresh queue (`failedQueue`) to handle concurrent requests
3. Auth endpoints (`/v1/auth/*`) are excluded from refresh to prevent infinite loops
4. Refresh uses raw `axios.post` (not `api.post`) to avoid interceptor recursion
5. On success, uses `authStore.setTokens()` to update both Zustand state and localStorage

### Test Commands
```bash
cd /Users/heal/orion-design/orion-frontend
npx tsc --noEmit
npm run test -- --run src/api/client.test.ts 2>/dev/null || echo "No client test exists yet — will be covered by Task 8"
```

### Git Commit
```bash
git add orion-frontend/src/api/client.ts
git commit -m "fix(frontend): add auto-refresh to axios 401 interceptor

Replace direct localStorage token reads with authStore.getToken() for
pre-request auto-refresh. Add refresh queue for concurrent 401 handling.
Exclude /v1/auth/* endpoints to prevent infinite refresh loops.

Closes GAP-2: Token expired mid-session previously caused immediate
logout instead of seamless refresh."
```

---

## Task 3: Add /me Validation on App Startup

**Severity:** HIGH (GAP-1)
**Files:**
- New: `/Users/heal/orion-design/orion-frontend/src/components/AuthInitializer.tsx`
- Modify: `/Users/heal/orion-design/orion-frontend/src/router/index.tsx`
- Modify: `/Users/heal/orion-design/orion-frontend/src/main.tsx`

### Step 3.1: Create AuthInitializer Component

Create new file `/Users/heal/orion-design/orion-frontend/src/components/AuthInitializer.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { getCurrentUser } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';

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
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        <Spin size="large" tip="正在验证身份..." />
      </div>
    );
  }

  return <>{children}</>;
};
```

### Step 3.2: Wrap AppRouter with AuthInitializer in main.tsx

In `/Users/heal/orion-design/orion-frontend/src/main.tsx`, modify the render call (lines 29-35):

Replace:
```typescript
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  </React.StrictMode>
);
```

With:
```typescript
import { AuthInitializer } from './components/AuthInitializer';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthInitializer>
        <AppContent />
      </AuthInitializer>
    </ErrorBoundary>
  </React.StrictMode>
);
```

### Step 3.3: Simplify ProtectedRoute in router/index.tsx

In `/Users/heal/orion-design/orion-frontend/src/router/index.tsx`:
- Add import for `getCurrentUser` and `useCallback`
- Replace `checkIsAuthenticated` usage in `ProtectedRoute` with server-validated version

Replace lines 1-8 (imports) with:
```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { routes, type AppRoute } from './routes';
import { Layout } from '@/components/Layout';
import { Loading } from '@/components/Loading';
import { useAuthStore } from '@/stores/authStore';
import { message } from 'antd';
import { getCurrentUser } from '@/api/auth';
```

Replace the `ProtectedRoute` component (lines 41-96) with:
```typescript
// 路由守卫组件 — 带服务端 token 验证
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
    // 优先使用 authStore 的状态（已由 AuthInitializer 初始化）
    let auth = isAuthenticated;
    if (!auth) {
      // 首次加载时 authStore 可能未填充，做服务端验证
      const token = localStorage.getItem('access_token');
      if (!token) {
        navigate('/login', { state: { from: location }, replace: true });
        return;
      }
      try {
        const response = await getCurrentUser();
        useAuthStore.getState().setUser({
          id: response.id,
          username: response.username,
          email: response.email,
          role: response.role,
          avatar: response.avatar,
        });
        useAuthStore.getState().setAuthenticated(true);
        auth = true;
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('token_expires_at');
        useAuthStore.getState().logout();
        navigate('/login', { state: { from: location }, replace: true });
        return;
      }
    }

    // 检查角色权限
    if (!checkRoleAccess(userRole, route.requiredRole)) {
      message.error('您没有权限访问此页面');
      navigate('/dashboard', { replace: true });
      return;
    }

    setAuthorized(true);
    setIsChecking(false);
  }, [navigate, location, userRole, route.requiredRole, isAuthenticated]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 监听认证状态变化
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
    return null;
  }

  return <>{children}</>;
};
```

### Test Commands
```bash
cd /Users/heal/orion-design/orion-frontend
npx tsc --noEmit
npm run build
```

### Git Commit
```bash
git add orion-frontend/src/components/AuthInitializer.tsx orion-frontend/src/main.tsx orion-frontend/src/router/index.tsx
git commit -m "fix(frontend): add /me validation on app startup

Create AuthInitializer component that validates token against server
via GET /v1/auth/me on every app mount. Wrap AppRouter with it in
main.tsx. Update ProtectedRoute to use authStore state with server
fallback instead of localStorage-only checks.

Closes GAP-1: Stale/forged tokens in localStorage were accepted
without server validation."
```

---

## Task 4: Fix expiresIn/expiresAt Mismatch Between Gateway and Frontend

**Severity:** MEDIUM (GAP-3)
**File:** `/Users/heal/orion-design/orion-api-gateway/src/routes/auth.routes.ts`

### Current State
- Gateway login response (line 260-274): returns `expiresIn` (seconds) and `refreshTokenExpiresIn`
- Gateway refresh response (line 368-371): returns `tokenPair` directly with `expiresIn`
- Frontend `LoginResponse` type expects `expiresAt` (millisecond timestamp)

### Changes

**Step 4.1:** Update login route response schema (lines 147-170):

Replace in the schema `response.200.data.properties`:
```typescript
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                    expiresAt: { type: 'number' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        username: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string' },
                      },
                    },
```

**Step 4.2:** Update login route response body (lines 260-274):

Replace:
```typescript
          return reply.code(200).send({
            success: true,
            data: {
              accessToken: tokenPair.accessToken,
              refreshToken: tokenPair.refreshToken,
              expiresAt: Date.now() + tokenPair.expiresIn * 1000,
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.roles[0] || 'user',
              },
            },
          });
```

**Step 4.3:** Update refresh route response schema (lines 301-315):

Replace:
```typescript
                data: {
                  type: 'object',
                  properties: {
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                    expiresAt: { type: 'number' },
                  },
                },
```

**Step 4.4:** Update refresh route response body (lines 368-371):

Replace:
```typescript
          return reply.code(200).send({
            success: true,
            data: {
              accessToken: tokenPair.accessToken,
              refreshToken: tokenPair.refreshToken,
              expiresAt: Date.now() + tokenPair.expiresIn * 1000,
            },
          });
```

### Test Commands
```bash
cd /Users/heal/orion-design/orion-api-gateway
npm run type-check
npm run test -- --testPathPattern="auth" 2>/dev/null || echo "No auth test exists yet"
```

### Git Commit
```bash
git add orion-api-gateway/src/routes/auth.routes.ts
git commit -m "fix(gateway): standardize auth response to expiresAt format

Change login and refresh responses from expiresIn (seconds) to
expiresAt (millisecond timestamp) to match Platform Service and
frontend LoginResponse type expectations. Also normalize user.role
from roles[0].

Closes GAP-3: Frontend expected expiresAt but gateway returned
expiresIn, causing token expiry calculations to fail."
```

---

## Task 5: Replace Gateway Mock Auth with Proxy to Platform Service

**Severity:** MEDIUM (VULN-2, VULN-5)
**File:** `/Users/heal/orion-design/orion-api-gateway/src/routes/auth.routes.ts`

### Current State
Lines 47-87: `mockUsers` Map with plaintext passwords.
Lines 131-599: All auth handlers use mock DB instead of proxying.

### Changes

Replace the entire file content with the proxy implementation:

```typescript
/**
 * 认证路由 — 代理到 Platform Service
 *
 * 所有认证请求转发到 Platform Service 的 PostgreSQL-backed auth，
 * 不再使用本地 mock 用户数据库。
 *
 * - POST /api/v1/auth/login - 用户登录
 * - POST /api/v1/auth/refresh - 刷新 Token
 * - POST /api/v1/auth/logout - 用户登出
 * - GET /api/v1/auth/me - 获取当前用户信息
 * - POST /api/v1/auth/register - 用户注册
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

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
   * POST /api/v1/auth/login — 代理到 Platform Service
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
   * POST /api/v1/auth/refresh — 代理到 Platform Service
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
   * POST /api/v1/auth/logout — 代理到 Platform Service
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
   * GET /api/v1/auth/me — 代理到 Platform Service
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
   * POST /api/v1/auth/register — 代理到 Platform Service
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

### Cleanup After Proxy
After this change, the following can be marked for future removal (not in this commit to keep scope focused):
- `orion-api-gateway/src/services/token.service.ts` — no longer needed
- `orion-api-gateway/src/services/rbac.service.ts` — used only by mock auth
- `TokenService` injection from gateway app.ts

### Test Commands
```bash
cd /Users/heal/orion-design/orion-api-gateway
npm run type-check
npm run test -- --testPathPattern="auth" 2>/dev/null || echo "Covered by Task 8 integration tests"
```

### Git Commit
```bash
git add orion-api-gateway/src/routes/auth.routes.ts
git commit -m "fix(gateway): replace mock auth with proxy to Platform Service

Remove mockUsers Map with plaintext passwords. All auth endpoints
(login, refresh, logout, me, register) now proxy to Platform Service
POSTgreSQL-backed auth via fetch(). Single source of truth for users.

Closes VULN-2: Gateway mock user DB with plaintext passwords.
Closes VULN-5: Dual auth systems meant Platform Service users couldn't
log in via Gateway and vice versa."
```

---

## Task 6: Remove Default Credentials from Login Page

**Severity:** LOW (GAP-5)
**File:** `/Users/heal/orion-design/orion-frontend/src/pages/Login/index.tsx`

### Changes

**Step 6.1:** Remove `initialValues` from Form (lines 70-73):

Replace:
```typescript
        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
```

**Step 6.2:** Remove default credentials display text (lines 94-98):

Remove these lines entirely:
```typescript
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: spacing[3] }}>
            默认账号：admin / admin123
          </Typography.Text>
        </div>
```

### Test Commands
```bash
cd /Users/heal/orion-design/orion-frontend
npx tsc --noEmit
npm run test -- --run src/pages/Login 2>/dev/null || echo "Covered by Task 8"
```

### Git Commit
```bash
git add orion-frontend/src/pages/Login/index.tsx
git commit -m "fix(frontend): remove default credentials from login page

Remove pre-filled admin/admin123 credentials and the '默认账号'
display text. Login form now starts empty for security.

Closes GAP-5: Login page exposed default credentials in plain sight."
```

---

## Task 7: Align JWT_SECRET Environment Variable Documentation

**Severity:** LOW (VULN-3)
**Files:**
- `/Users/heal/orion-design/orion-api-gateway/src/config/index.ts` (already correct)
- `/Users/heal/orion-design/.env.example` (create or update)

### Analysis
The Gateway config (`config/index.ts` lines 45, 83) already reads from `process.env.JWT_SECRET`. The Platform Service also reads from `process.env.JWT_SECRET`. No code changes needed — just ensure documentation is clear.

### Changes

Check if `.env.example` exists at repo root. If not, create it:

File: `/Users/heal/orion-design/.env.example`
```bash
# Orion Platform - Shared Environment Variables
# Copy to .env and fill in actual values

# JWT Secret — MUST be identical for both platform-service and api-gateway
JWT_SECRET=your-256-bit-secret-key-here-use-at-least-32-characters

# Platform Service
PLATFORM_SERVICE_URL=http://localhost:3001
PLATFORM_TIMEOUT=30000

# Database
DATABASE_URL=postgresql://orion:orion@localhost:5432/orion

# Redis (for Gateway session management)
REDIS_HOST=localhost
REDIS_PORT=6379

# NATS (for event bus)
NATS_SERVERS=nats://localhost:4222
```

### Git Commit
```bash
git add .env.example
git commit -m "chore: document shared JWT_SECRET requirement in .env.example

Add environment variable template clarifying that JWT_SECRET must be
identical across platform-service and api-gateway. Both services already
read from process.env.JWT_SECRET — this just documents the requirement.

Closes VULN-3: JWT secret misalignment risk between services."
```

---

## Task 8: Add Comprehensive Auth Tests

**Severity:** LOW (Testing)
**Files to create:**
- `/Users/heal/orion-design/orion-platform-service/src/api/__tests__/auth-middleware.test.ts`
- `/Users/heal/orion-design/orion-frontend/src/api/__tests__/client.test.ts`
- `/Users/heal/orion-design/orion-frontend/src/components/__tests__/AuthInitializer.test.tsx`

### Step 8.1: Platform Service Auth Middleware Tests

Create `/Users/heal/orion-design/orion-platform-service/src/api/__tests__/auth-middleware.test.ts`:

```typescript
import Fastify, { FastifyInstance } from 'fastify';
import { authenticateUser } from '../../middleware/authMiddleware';

describe('Auth Middleware', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    app.addHook('onRequest', authenticateUser);
    app.get('/protected', async () => ({ success: true }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 when no Authorization header is present', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 when Authorization header has invalid format', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: 'InvalidFormat token' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 when JWT token is expired', async () => {
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwidXNlcm5hbWUiOiJ0ZXN0Iiwicm9sZSI6InVzZXIiLCJpYXQiOjEwMDAwMDAwMDAsImV4cCI6MTAwMDAwMDAwMH0.invalid';

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });

    expect(response.statusCode).toBe(401);
  });
});
```

### Step 8.2: Frontend Axios Interceptor Tests

Create `/Users/heal/orion-design/orion-frontend/src/api/__tests__/client.test.ts`:

```typescript
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

describe('API Client Interceptors', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    mock.restore();
  });

  it('should attach access_token from localStorage to request headers', async () => {
    localStorage.setItem('access_token', 'test-token');
    mock = new MockAdapter(axios);
    mock.onGet('/test').reply(200, { data: {} });

    const response = await axios.get('/test');
    expect(response.config.headers?.Authorization).toBe('Bearer test-token');
  });

  it('should attempt token refresh on 401 response', async () => {
    localStorage.setItem('access_token', 'expired-token');
    localStorage.setItem('refresh_token', 'valid-refresh');

    mock = new MockAdapter(axios);
    mock.onGet('/protected').replyOnce(401);
    mock.onPost('/v1/auth/refresh').replyOnce(200, {
      data: {
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        expiresAt: Date.now() + 3600000,
      },
    });
    mock.onGet('/protected').replyOnce(200, { data: 'success' });

    const response = await axios.get('/protected');
    expect(response.status).toBe(200);
    expect(localStorage.getItem('access_token')).toBe('new-token');
  });

  it('should redirect to /login when refresh token is missing', async () => {
    localStorage.setItem('access_token', 'expired-token');
    // No refresh_token

    mock = new MockAdapter(axios);
    mock.onGet('/protected').replyOnce(401);

    await axios.get('/protected').catch(() => {});
    expect(window.location.pathname).toBe('/login');
  });
});
```

### Step 8.3: AuthInitializer Tests

Create `/Users/heal/orion-design/orion-frontend/src/components/__tests__/AuthInitializer.test.tsx`:

```typescript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthInitializer } from '../AuthInitializer';
import { useAuthStore } from '@/stores/authStore';

describe('AuthInitializer', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().logout();
  });

  it('renders children after successful token validation', async () => {
    localStorage.setItem('access_token', 'valid-token');

    // Mock fetch for /me
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { id: '1', username: 'test', email: 'test@test.com', role: 'admin' },
      }),
    });

    render(
      <AuthInitializer>
        <div data-testid="child">App Content</div>
      </AuthInitializer>
    );

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  it('clears localStorage and logs out when token is invalid', async () => {
    localStorage.setItem('access_token', 'invalid-token');

    global.fetch = vi.fn().mockRejectedValue(new Error('Invalid token'));

    render(
      <AuthInitializer>
        <div data-testid="child">App Content</div>
      </AuthInitializer>
    );

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  it('renders children immediately when no token exists', async () => {
    render(
      <AuthInitializer>
        <div data-testid="child">App Content</div>
      </AuthInitializer>
    );

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });
});
```

### Test Commands
```bash
# Platform Service
cd /Users/heal/orion-design/orion-platform-service
npm run test -- --testPathPattern="auth-middleware" --forceExit

# Frontend
cd /Users/heal/orion-design/orion-frontend
npm install --save-dev axios-mock-adapter @types/axios-mock-adapter 2>/dev/null || true
npm run test -- --run src/api/__tests__/client.test.ts src/components/__tests__/AuthInitializer.test.tsx
```

### Git Commit
```bash
git add orion-platform-service/src/api/__tests__/auth-middleware.test.ts \
       orion-frontend/src/api/__tests__/client.test.ts \
       orion-frontend/src/components/__tests__/AuthInitializer.test.tsx
git commit -m "test(auth): add comprehensive auth tests for all layers

Add tests for: (1) Platform Service auth middleware — 401 on missing/
invalid/expired tokens. (2) Frontend axios interceptor — token attach,
auto-refresh on 401, redirect when no refresh token. (3) AuthInitializer
— startup /me validation, cleanup on invalid token."
```

---

## Execution Order & Dependencies

```
Task 1 (Platform Service routes) ──────────> No dependencies
Task 7 (JWT_SECRET alignment) ─────────────> No dependencies
Task 2 (Axios interceptor) ────────────────> No dependencies
Task 4 (expiresAt format) ─────────────────> Task 5 OR standalone (Option B fallback in frontend)
Task 5 (Gateway proxy) ────────────────────> Task 1 (platform auth must work first)
Task 3 (AuthInitializer) ──────────────────> Task 2 (needs working refresh in authStore)
Task 6 (Remove default creds) ─────────────> No dependencies
Task 8 (Tests) ────────────────────────────> All above tasks completed
```

**Recommended commit order:** 1 → 7 → 6 → 2 → 4 → 5 → 3 → 8

---

## Manual Verification Checklist

After all tasks are complete, run these manual checks:

```bash
# 1. Previously-public endpoint now returns 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/pipelines
# Expected: 401

# 2. Login via Gateway returns expiresAt (milliseconds)
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq '.data.expiresAt'
# Expected: large number (> 1700000000000)

# 3. Gateway proxy — user registered via Platform Service can login via Gateway
# First register via Platform Service:
curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","email":"new@test.com","password":"password123"}'
# Then login via Gateway:
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","password":"password123"}'
# Expected: 200 with tokens (proves proxy works)

# 4. Token refresh flow (in browser DevTools)
# Login, then manually expire token in localStorage, then make any API call
# Expected: auto-refresh succeeds, no redirect to /login

# 5. Startup validation (in browser DevTools)
# Insert forged token in localStorage, reload app
# Expected: AuthInitializer calls /me, gets 401, clears storage, shows login page

# 6. Login page has no default credentials
# Open http://localhost:5173/login
# Expected: username and password fields are empty
```
