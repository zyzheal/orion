# API Client Gaps Design

**Date:** 2026-04-30
**Status:** Draft
**Branch:** `feat/frontend-gap-implementation`
**Related:** `docs/superpowers/specs/2026-04-30-gap-closure-phase1-design.md`, `docs/superpowers/specs/2026-04-30-module-gap-analysis.md`

---

## Overview

Analysis and remediation plan for the frontend API client layer — identifying dead clients, missing page integration, duplicated API calls, and orphaned modules. The goal is to ensure every API client module has a clear purpose and lifecycle state: **ACTIVE**, **RESERVED**, or **DEPRECATED/DELETED**.

## Current State

### API Client Inventory

The frontend has ~48 API modules under `src/api/`. This document focuses on the 8 modules identified as having gap issues:

| # | API Module | Backend Route | Page Status | Current State | Problem |
|---|-----------|--------------|-------------|---------------|---------|
| 1 | `api/api-key.ts` | `/v1/api-keys` (exists in `api-key-routes.ts`) | No page, no route | **DEAD** — client exists but nothing uses it | Need frontend page + router entry |
| 2 | `api/bi.ts` | `/v1/efficiency/dashboard` | 3 pages exist | **DUPLICATED** — pages define own calls | Pages import mock data instead of bi.ts |
| 3 | `api/cron.ts` | `/v1/cron/jobs`, `/v1/cron/status` | No page, no route | **DEAD** — client exists but nothing uses it | Need CronManagement page |
| 4 | `api/eventbus.ts` | `/v1/eventbus/*` | Page exists (`/eventbus`) | **DISCONNECTED** — page uses mock data | EventBus page has `// Attempt to fetch from API -- no eventbus API client exists yet` comment (line 229), but `api/eventbus.ts` does exist |
| 5 | `api/knowledge.ts` | `/v1/knowledge/*` | Page exists (`/knowledge`) as wujie micro-frontend shell | **ORPHANED** — API defined but never used | Micro-frontend loads external app; native API client unused |
| 6 | `api/metrics.ts` | `/v1/metrics/query`, `/v1/metrics/query/range`, `/v1/metrics/dashboard` | Page exists (`/metrics-dashboard`) | **REDUNDANT** — MetricsDashboard uses `api/monitoring.ts` instead | Overlap with monitoring.ts; different endpoints |
| 7 | `api/session.ts` | `/v1/sessions/*` | Page exists (`/sessions`) | **DISCONNECTED** — page uses mock data | Same pattern as EventBus: `// No session API client exists yet` comment (line 235), but `api/session.ts` does exist |
| 8 | `api/webhook.ts` | `/v1/webhooks/*` | No page, no dedicated route | **DEAD** — client exists but nothing uses it | Note: `/console/code-mgmt/webhooks` route exists but loads `WebhookLog` page (log viewer), not webhook CRUD management |

### API Pattern Standard

All API modules follow this consistent pattern established by `src/api/client.ts`:

```typescript
// src/api/client.ts
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse } from './types';

const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attaches Bearer token from localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) { config.headers.Authorization = `Bearer ${token}`; }
  return config;
});

// Response interceptor: handles 401/403/404/500
export const api = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> { ... },
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> { ... },
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> { ... },
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> { ... },
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> { ... },
};
```

```typescript
// src/api/types.ts
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}
```

**Module pattern example** (`src/api/cron.ts`):

```typescript
import { api } from './client';

export interface CronJob {
  id: string; name: string; schedule: string; command: string;
  enabled: boolean; status: 'running' | 'idle' | 'error' | 'disabled';
  createdAt: string; updatedAt: string;
}

export async function getCronJobs() {
  return api.get<{ jobs: CronJob[] }>('/v1/cron/jobs');
}
```

### Detailed Module Analysis

#### 1. api/api-key.ts

**File:** `/Users/heal/orion-design/orion-frontend/src/api/api-key.ts` (45 lines)
**Test:** `/Users/heal/orion-design/orion-frontend/src/api/__tests__/api-key.test.ts`

Exports: `getApiKeys`, `createApiKey`, `revokeApiKey`, `getApiKeyStats`
Interfaces: `ApiKey`, `ApiKeyInput`, `ApiKeyStats`

**Backend:** `orion-platform-service/src/api/api-key-routes.ts` exists, routes mounted under `/v1/api-keys`.
**Frontend:** No page component, no route entry in `router/routes.ts`.

**Verdict:** KEEP + BUILD PAGE. Backend exists, client is well-structured.

#### 2. api/bi.ts

**File:** `/Users/heal/orion-design/orion-frontend/src/api/bi.ts` (54 lines)
**Test:** None (no `bi.test.ts` found)

Exports: `getExecutiveDashboard`, `getManagerDashboard`, `getEngineerDashboard`, `getEfficiencyScore`, `exportBIData`

**Backend:** Routes are `/v1/efficiency/dashboard`, `/v1/efficiency/score`, `/v1/efficiency/export`.
**Frontend:** Three dashboard pages exist but ALL use `import { mockExecutiveDashboard } from '@/pages/__mocks__/mockBIData'` instead of the bi.ts client.

The actual bi.ts implementations:
```typescript
// bi.ts
export function getExecutiveDashboard(params?: { days?: number }) {
  return api.get<ExecutiveDashboardData>('/v1/efficiency/dashboard', { params });
}
export function getManagerDashboard(params?: { teamId?: string; days?: number }) {
  return api.get<ManagerDashboardData>('/v1/efficiency/dashboard', { params });
}
export function getEngineerDashboard(engineerId: string, params?: { days?: number }) {
  return api.get<EngineerDashboardData>(`/v1/efficiency/dashboard`, {
    params: { ...params, engineerId },
  });
}
```

Note: All three dashboard functions call the **same** backend endpoint `/v1/efficiency/dashboard` with different query parameters. The backend uses params to determine the response shape.

**Verdict:** KEEP + REFACTOR. Create `useBiDashboard` hook, consolidate pages to use it.

#### 3. api/cron.ts

**File:** `/Users/heal/orion-design/orion-frontend/src/api/cron.ts` (57 lines)
**Test:** `/Users/heal/orion-design/orion-frontend/src/api/__tests__/cron.test.ts`

Exports: `getCronJobs`, `getCronJob`, `createCronJob`, `updateCronJob`, `deleteCronJob`, `executeCronJob`, `getCronStatus`

**Verdict:** KEEP + BUILD PAGE. Well-structured, backend exists.

#### 4. api/eventbus.ts

**File:** `/Users/heal/orion-design/orion-frontend/src/api/eventbus.ts` (105 lines)
**Test:** `/Users/heal/orion-design/orion-frontend/src/api/__tests__/eventbus.test.ts`

Exports: `getEventBusStatus`, `connectEventBus`, `publishEvent`, `getEvents`, `getSubscriptions`, `getStats`, `getJetStreamMetrics`, `getStreamConsumers`, `getDLQEvents`

**Page disconnect:** `src/pages/EventBus/index.tsx` line 229 says `// Attempt to fetch from API -- no eventbus API client exists yet` — this is factually incorrect; the client exists but is not imported.

The page defines its own local `EventBusEvent` interface (lines 44-54) which differs from `api/eventbus.ts`'s exported interface:

| Page local type | api/eventbus.ts type | Difference |
|----------------|---------------------|------------|
| `timestamp: string` | `publishedAt: string` | Field name |
| `payloadSize: number` | `payload: Record<string, unknown>` | Type change |
| `subscriberCount: number` | (not in API type) | Extra field |
| `topic: string` | `subject: string` | Field name |
| `traceId: string` | (not in API type) | Extra field |
| (no `tenantId`) | `tenantId: string` | Extra in API |
| (no `retryCount`) | `retryCount: number` | Extra in API |
| (no `status: 'delivered'`) | `status: string` | Less specific in API |

**Verdict:** KEEP + CONNECT. The page needs a type adapter layer to bridge the local mock types to the API types. Covered by the frontend-page-gaps spec.

#### 5. api/knowledge.ts

**File:** `/Users/heal/orion-design/orion-frontend/src/api/knowledge.ts` (45 lines)
**Test:** `/Users/heal/orion-design/orion-frontend/src/api/__tests__/knowledge.test.ts`

Exports: `searchKnowledge`, `getKnowledge`, `createKnowledge`, `updateKnowledge`, `deleteKnowledge`

**Page:** `src/pages/KnowledgeBase/index.tsx` is a 26-line wujie micro-frontend shell:
```typescript
const KnowledgeBase: React.FC = () => {
  return <SubAppRoute />;
};
```

It loads the external `orion-knowledge` application. The native API client is never called.

**Verdict:** RESERVED. Add `@deprecated` JSDoc explaining the micro-frontend architecture. The client is ready for future native integration if the micro-frontend strategy changes.

#### 6. api/metrics.ts

**File:** `/Users/heal/orion-design/orion-frontend/src/api/metrics.ts` (35 lines)
**Test:** `/Users/heal/orion-design/orion-frontend/src/api/__tests__/metrics.test.ts`

Exports: `queryMetrics`, `queryRangeMetrics`, `getDashboardData`

**Overlap with monitoring.ts:** `api/monitoring.ts` (~217 lines) provides extensive monitoring capabilities including metrics, alerts, channels, and escalation. `api/metrics.ts` provides a thin wrapper around Prometheus-style query/range-query endpoints.

The `MetricsDashboard` page at `src/pages/MetricsDashboard/index.tsx` imports from `api/monitoring.ts`:
```typescript
import { getMonitoringHealth, getMetrics, getDashboardData } from '@/api/monitoring';
```

It does NOT use `api/metrics.ts`.

**Endpoint comparison:**
- `metrics.ts`: `/v1/metrics/query`, `/v1/metrics/query/range`, `/v1/metrics/dashboard`
- `monitoring.ts`: `/v1/monitoring/metrics`, `/v1/monitoring/metrics/register`, `/v1/monitoring/metrics/{name}/series`, etc.

These hit different backend endpoints. The `metrics.ts` endpoints map to a Prometheus proxy layer, while `monitoring.ts` maps to the internal monitoring subsystem.

**Verdict:** MERGE into monitoring.ts OR KEEP AS PROMETHEUS CLIENT. Since `metrics.ts` targets a different backend subsystem (Prometheus proxy vs internal monitoring), it should be **KEPT** but clearly documented as "Prometheus query client". Rename to clarify purpose.

#### 7. api/session.ts

**File:** `/Users/heal/orion-design/orion-frontend/src/api/session.ts` (41 lines)
**Test:** `/Users/heal/orion-design/orion-frontend/src/api/__tests__/session.test.ts`

Exports: `getSessions`, `getSession`, `deleteSession`, `getSessionStats`

**Page disconnect:** `src/pages/Sessions/index.tsx` line 235 says `// No session API client exists yet — use mock data` — again, the client exists but is not imported.

Type mismatch analysis:

| Page local type | api/session.ts type | Difference |
|----------------|---------------------|------------|
| `userId: string` | `userId: string` | Same |
| `sessionId: string` | `id: string` | Field name |
| `startedAt: string` | `createdAt: string` | Field name |
| `lastActive: string` | `lastAccessedAt: string` | Field name |
| `status: 'active' \| 'expired' \| 'revoked'` | (no status field in API) | Extra in page |
| `duration: number` | `expiresAt: string` | Different |
| `ipAddress: string` | `ipAddress?: string` | Optional in API |
| `userAgent: string` | `userAgent?: string` | Optional in API |
| (no `token`) | `token: string` | Extra in API |

**Verdict:** KEEP + CONNECT. The page needs a type adapter. Covered by frontend-page-gaps spec.

#### 8. api/webhook.ts

**File:** `/Users/heal/orion-design/orion-frontend/src/api/webhook.ts` (66 lines)
**Test:** `/Users/heal/orion-design/orion-frontend/src/api/__tests__/webhook.test.ts`

Exports: `getWebhooks`, `getWebhook`, `createWebhook`, `updateWebhook`, `deleteWebhook`, `testWebhook`, `getWebhookLogs`

**Existing partial page:** Route `/console/code-mgmt/webhooks` loads `CodeMgmt/WebhookLog` — this is a **log viewer** for code repo webhooks, NOT a general webhook CRUD management page.

**Verdict:** KEEP + BUILD PAGE. The backend supports full webhook CRUD; the existing WebhookLog page only shows logs. A dedicated webhook management page under `/console/webhooks` is needed.

---

## Implementation Design

### Decision Matrix

| API Module | Action | Priority | Effort | Notes |
|-----------|--------|----------|--------|-------|
| `api/api-key.ts` | KEEP + BUILD PAGE | P2 | Medium | Add page at `/console/api-keys` |
| `api/bi.ts` | KEEP + REFACTOR | P1 | Low | Create `useBiDashboard` hook, update 3 pages |
| `api/cron.ts` | KEEP + BUILD PAGE | P2 | Medium | Add page at `/console/cron` |
| `api/eventbus.ts` | KEEP + CONNECT | P1 | Low | Wire existing page to API (covered by page-gaps spec) |
| `api/knowledge.ts` | KEEP + DEPRECATE | P3 | Trivial | Add `@deprecated` JSDoc comment |
| `api/metrics.ts` | KEEP + RENAME | P2 | Low | Rename to `prometheus.ts`, add JSDoc |
| `api/session.ts` | KEEP + CONNECT | P1 | Low | Wire existing page to API (covered by page-gaps spec) |
| `api/webhook.ts` | KEEP + BUILD PAGE | P2 | Medium | Add page at `/console/webhooks` |

**Nothing deleted.** All 8 modules have backend support and a defined purpose.

### Decision 1: BI Dashboard Consolidation

Create a shared hook layer to eliminate duplication across the three dashboard pages.

#### File: `src/hooks/useBiDashboard.ts` (NEW)

```typescript
/**
 * Shared hook for BI dashboard data fetching.
 *
 * All three dashboard types (executive, manager, engineer) call the same
 * backend endpoint `/v1/efficiency/dashboard` with different query parameters.
 * This hook encapsulates the fetch logic and provides a unified interface.
 *
 * Usage:
 *   const { data, loading, error } = useBiDashboard('executive');
 *   const { data, loading, error } = useBiDashboard('manager', { teamId: 't1' });
 *   const { data, loading, error } = useBiDashboard('engineer', { engineerId: 'E001' });
 */
import { useState, useEffect } from 'react';
import {
  getExecutiveDashboard,
  getManagerDashboard,
  getEngineerDashboard,
} from '@/api/bi';
import type {
  ExecutiveDashboardData,
  ManagerDashboardData,
  EngineerDashboardData,
} from '@/types/pages';

export type BiDashboardType = 'executive' | 'manager' | 'engineer';

export type BiDashboardData =
  | ExecutiveDashboardData
  | ManagerDashboardData
  | EngineerDashboardData;

export interface UseBiDashboardResult {
  data: BiDashboardData | null;
  loading: boolean;
  error: Error | null;
}

export function useBiDashboard(
  type: BiDashboardType,
  options?: {
    engineerId?: string;
    teamId?: string;
    days?: number;
  }
): UseBiDashboardResult {
  const [data, setData] = useState<BiDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetcher =
      type === 'executive'
        ? () => getExecutiveDashboard({ days: options?.days })
        : type === 'manager'
          ? () => getManagerDashboard({ teamId: options?.teamId, days: options?.days })
          : () =>
              getEngineerDashboard(
                options?.engineerId ?? 'current',
                { days: options?.days }
              );

    fetcher()
      .then((res) => {
        if (!cancelled) {
          setData(res.data.data as BiDashboardData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [type, options?.engineerId, options?.teamId, options?.days]);

  return { data, loading, error };
}
```

#### Updated Dashboard Pages (pattern for all 3)

Each dashboard page will be modified to:
1. Import `useBiDashboard` hook
2. Remove `import { mockXxxDashboard } from '@/pages/__mocks__/mockBIData'`
3. Replace `const data = mockExecutiveDashboard` with `const { data, loading, error } = useBiDashboard('executive')`
4. Add loading state handling and error display
5. Keep mock data as fallback for when API is unavailable

**Example: ExecutiveDashboard changes**

```diff
- import { mockExecutiveDashboard } from '@/pages/__mocks__/mockBIData';
+ import { useBiDashboard } from '@/hooks/useBiDashboard';
+ import type { ExecutiveDashboardData } from '@/types/pages';

  const ExecutiveDashboard: React.FC = () => {
-   const data = mockExecutiveDashboard;
+   const { data: apiData, loading, error } = useBiDashboard('executive');
+
+   // Fallback to mock data when API is unavailable
+   const data = (apiData as ExecutiveDashboardData | undefined) ?? mockExecutiveDashboard;
+   const showMockWarning = !apiData;

    // ... existing useMemo, render logic ...

+   if (loading && !data) {
+     return <Spin tip="加载效能数据..." />;
+   }
+
    return (
      <div style={{ padding: 0 }}>
+       {showMockWarning && (
+         <Alert
+           message="API 不可用"
+           description="效能仪表盘 API 尚未部署，当前显示模拟数据。"
+           type="warning"
+           showIcon
+           closable
+           style={{ marginBottom: spacing.md }}
+         />
+       )}
+       {error && (
+         <Alert
+           message="加载失败"
+           description={error.message}
+           type="error"
+           showIcon
+           style={{ marginBottom: spacing.md }}
+         />
+       )}
        {/* ... existing content ... */}
      </div>
    );
  };
```

### Decision 2: New Page Creation

Three new pages need to be created for the unused API clients.

#### 2A. Cron Management Page

**Route:** `/console/cron` (new entry in `router/routes.ts`)
**Page:** `src/pages/CronManagement/index.tsx` (NEW)
**API:** `src/api/cron.ts` (existing, no changes needed)

```typescript
/**
 * Cron Management Page
 *
 * Admin page for scheduled job CRUD: create, edit, delete, execute cron jobs.
 * Uses api/cron.ts for all data operations.
 *
 * Route: /console/cron
 * Access: admin, platform_admin
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input,
  Switch, message, Popconfirm, Tooltip, Select, Alert,
} from 'antd';
import {
  ReloadOutlined, PlusOutlined, PlayCircleOutlined,
  EditOutlined, DeleteOutlined, ClockCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, StopOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import {
  getCronJobs, createCronJob, updateCronJob,
  deleteCronJob, executeCronJob, getCronStatus,
  type CronJob, type CronJobInput,
} from '@/api/cron';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Status helpers
const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  running:  { color: 'processing', label: '运行中', icon: <PlayCircleOutlined /> },
  idle:     { color: 'success',    label: '空闲',   icon: <CheckCircleOutlined /> },
  error:    { color: 'error',      label: '错误',   icon: <CloseCircleOutlined /> },
  disabled: { color: 'default',    label: '已禁用', icon: <StopOutlined /> },
};

const CronManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [stats, setStats] = useState<{ running: number; total: number; enabled: number } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [form] = Form.useForm();

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, statusRes] = await Promise.all([getCronJobs(), getCronStatus()]);
      setJobs(jobsRes.data.data?.jobs ?? []);
      setStats(statusRes.data.data ?? null);
    } catch (err) {
      message.error('加载定时任务失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const handleCreate = async (values: CronJobInput) => {
    try {
      await createCronJob(values);
      message.success('定时任务已创建');
      setModalVisible(false);
      form.resetFields();
      loadJobs();
    } catch (err) {
      message.error('创建失败');
    }
  };

  const handleUpdate = async (values: CronJobInput) => {
    if (!editingJob) return;
    try {
      await updateCronJob(editingJob.id, values);
      message.success('定时任务已更新');
      setModalVisible(false);
      setEditingJob(null);
      form.resetFields();
      loadJobs();
    } catch (err) {
      message.error('更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCronJob(id);
      message.success('定时任务已删除');
      loadJobs();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await executeCronJob(id);
      message.success('定时任务已触发执行');
      loadJobs();
    } catch (err) {
      message.error('执行失败');
    }
  };

  const openEdit = (job: CronJob) => {
    setEditingJob(job);
    form.setFieldsValue({
      name: job.name,
      schedule: job.schedule,
      command: job.command,
      enabled: job.enabled,
    });
    setModalVisible(true);
  };

  const openCreate = () => {
    setEditingJob(null);
    form.resetFields();
    setModalVisible(true);
  };

  // Table columns
  const columns: TableColumn<CronJob>[] = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 150,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'schedule',
      title: '调度表达式',
      dataIndex: 'schedule',
      width: 150,
      render: (v: unknown) => <Text code style={{ fontSize: 12 }}>{String(v)}</Text>,
    },
    {
      key: 'command',
      title: '命令',
      dataIndex: 'command',
      ellipsis: true,
      render: (v: unknown) => <Text code style={{ fontSize: 11 }}>{String(v)}</Text>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: unknown) => {
        const cfg = STATUS_CONFIG[String(v)] ?? { color: 'default', label: String(v), icon: null };
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      key: 'enabled',
      title: '启用',
      dataIndex: 'enabled',
      width: 70,
      render: (v: unknown) => (v ? <Tag color="success">是</Tag> : <Tag>否</Tag>),
    },
    {
      key: 'runCount',
      title: '执行次数',
      dataIndex: 'runCount',
      width: 90,
    },
    {
      key: 'lastRunAt',
      title: '上次执行',
      dataIndex: 'lastRunAt',
      width: 150,
      render: (v: unknown) => v ? dayjs(String(v)).format('MM-DD HH:mm') : '—',
    },
    {
      key: 'nextRunAt',
      title: '下次执行',
      dataIndex: 'nextRunAt',
      width: 150,
      render: (v: unknown) => v ? dayjs(String(v)).format('MM-DD HH:mm') : '—',
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, record: CronJob) => (
        <Space size="small">
          <Tooltip title="立即执行">
            <Button type="link" size="small" icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record.id)}
              disabled={record.status === 'running'}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Popconfirm title="确认删除该定时任务?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ClockCircleOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
            定时任务管理
          </Title>
          <Text type="secondary">Cron Job Management</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadJobs} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建任务</Button>
        </Space>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.md, marginBottom: spacing.lg }}>
          <MetricCard title="总任务数" value={stats.total} icon={<ClockCircleOutlined />} color={colors.primary[500]} size="medium" />
          <MetricCard title="已启用" value={stats.enabled} icon={<CheckCircleOutlined />} color={colors.success[500]} size="medium" />
          <MetricCard title="运行中" value={stats.running} icon={<PlayCircleOutlined />} color={colors.purple[500]} size="medium" />
        </div>
      )}

      {/* Job Table */}
      <Card>
        <Table columns={columns} dataSource={jobs} loading={loading} rowKey="id" size="middle" striped />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingJob ? '编辑定时任务' : '新建定时任务'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingJob(null); }}
        onOk={() => form.submit()}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={editingJob ? handleUpdate : handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="e.g. daily-cleanup" />
          </Form.Item>
          <Form.Item name="schedule" label="Cron 表达式" rules={[{ required: true }]}>
            <Input placeholder="e.g. 0 2 * * *" />
          </Form.Item>
          <Form.Item name="command" label="命令" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="e.g. npm run cleanup -- --env=production" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CronManagement;
```

#### 2B. Webhook Management Page

**Route:** `/console/webhooks` (new entry in `router/routes.ts`)
**Page:** `src/pages/WebhookManagement/index.tsx` (NEW)
**API:** `src/api/webhook.ts` (existing, no changes needed)

```typescript
/**
 * Webhook Management Page
 *
 * Admin page for webhook CRUD: create, edit, delete, test webhooks.
 * Uses api/webhook.ts for all data operations.
 *
 * Note: This is a GENERAL webhook management page for the platform.
 * It is separate from /console/code-mgmt/webhooks which shows code repo webhook logs only.
 *
 * Route: /console/webhooks
 * Access: admin, platform_admin
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input,
  Switch, message, Popconfirm, Tooltip, Select, Tag as AntTag,
  Descriptions, Drawer,
} from 'antd';
import {
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  SendOutlined, EyeOutlined, LinkOutlined, CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import {
  getWebhooks, createWebhook, updateWebhook,
  deleteWebhook, testWebhook, getWebhookLogs,
  type Webhook, type WebhookInput, type WebhookLog,
} from '@/api/webhook';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const EVENT_OPTIONS = [
  'pipeline.completed', 'pipeline.failed', 'deployment.success',
  'deployment.failed', 'alert.triggered', 'alert.resolved',
  'selfhealing.triggered', 'cost.anomaly',
];

const WebhookManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [logDrawerVisible, setLogDrawerVisible] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [form] = Form.useForm();

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWebhooks();
      setWebhooks(res.data.data?.webhooks ?? []);
    } catch (err) {
      message.error('加载 Webhook 列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWebhooks(); }, [loadWebhooks]);

  const handleCreate = async (values: WebhookInput) => {
    try {
      await createWebhook(values);
      message.success('Webhook 已创建');
      setModalVisible(false);
      form.resetFields();
      loadWebhooks();
    } catch (err) {
      message.error('创建失败');
    }
  };

  const handleUpdate = async (values: WebhookInput) => {
    if (!editingWebhook) return;
    try {
      await updateWebhook(editingWebhook.id, values);
      message.success('Webhook 已更新');
      setModalVisible(false);
      setEditingWebhook(null);
      form.resetFields();
      loadWebhooks();
    } catch (err) {
      message.error('更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWebhook(id);
      message.success('Webhook 已删除');
      loadWebhooks();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const handleTest = async (id: string) => {
    try {
      await testWebhook(id);
      message.success('测试请求已发送');
      loadWebhooks();
    } catch (err) {
      message.error('测试失败');
    }
  };

  const handleViewLogs = async (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setLogDrawerVisible(true);
    try {
      const res = await getWebhookLogs(webhook.id, 20);
      setLogs(res.data.data?.logs ?? []);
    } catch (err) {
      message.error('加载日志失败');
      setLogs([]);
    }
  };

  const openEdit = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    form.setFieldsValue({
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret ?? '',
      enabled: webhook.enabled,
    });
    setModalVisible(true);
  };

  const openCreate = () => {
    setEditingWebhook(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true });
    setModalVisible(true);
  };

  const columns: TableColumn<Webhook>[] = [
    {
      key: 'url',
      title: 'URL',
      dataIndex: 'url',
      ellipsis: true,
      render: (v: unknown) => <Text code style={{ fontSize: 12 }}>{String(v)}</Text>,
    },
    {
      key: 'events',
      title: '订阅事件',
      dataIndex: 'events',
      width: 250,
      render: (v: unknown) => (
        <Space wrap>
          {(v as string[]).map((e) => <AntTag key={e} color="blue" style={{ fontSize: 11 }}>{e}</AntTag>)}
        </Space>
      ),
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (v: unknown) => v ? <Tag color="success">启用</Tag> : <Tag>禁用</Tag>,
    },
    {
      key: 'failureCount',
      title: '失败次数',
      dataIndex: 'failureCount',
      width: 80,
      render: (v: unknown) => {
        const count = typeof v === 'number' ? v : 0;
        return <Text style={{ color: count > 3 ? colors.error[500] : 'inherit' }}>{count}</Text>;
      },
    },
    {
      key: 'lastStatus',
      title: '最后状态',
      dataIndex: 'lastStatus',
      width: 90,
      render: (v: unknown) => {
        if (!v) return <Text type="secondary">—</Text>;
        const status = typeof v === 'number' ? v : 0;
        return status >= 200 && status < 300
          ? <Tag color="success" icon={<CheckCircleOutlined />}>{status}</Tag>
          : <Tag color="error" icon={<CloseCircleOutlined />}>{status}</Tag>;
      },
    },
    {
      key: 'lastTriggeredAt',
      title: '最后触发',
      dataIndex: 'lastTriggeredAt',
      width: 150,
      render: (v: unknown) => v ? dayjs(String(v)).format('MM-DD HH:mm') : '—',
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      render: (_: unknown, record: Webhook) => (
        <Space size="small">
          <Tooltip title="测试">
            <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleTest(record.id)} />
          </Tooltip>
          <Tooltip title="日志">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewLogs(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="确认删除该 Webhook?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const logColumns: TableColumn<WebhookLog>[] = [
    { key: 'event', title: '事件', dataIndex: 'event', width: 180, render: (v: unknown) => <Tag color="blue">{String(v)}</Tag> },
    { key: 'status', title: 'HTTP 状态', dataIndex: 'status', width: 100, render: (v: unknown) => {
      const s = typeof v === 'number' ? v : 0;
      return <Tag color={s >= 200 && s < 300 ? 'success' : 'error'}>{s}</Tag>;
    }},
    { key: 'error', title: '错误', dataIndex: 'error', ellipsis: true, render: (v: unknown) => v ? <Text type="danger">{String(v)}</Text> : '—' },
    { key: 'createdAt', title: '时间', dataIndex: 'createdAt', width: 150, render: (v: unknown) => dayjs(String(v)).format('MM-DD HH:mm:ss') },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <LinkOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
            Webhook 管理
          </Title>
          <Text type="secondary">平台 Webhook 配置与监控</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadWebhooks} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建 Webhook</Button>
        </Space>
      </div>

      <Card>
        <Table columns={columns} dataSource={webhooks} loading={loading} rowKey="id" size="middle" striped />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingWebhook ? '编辑 Webhook' : '新建 Webhook'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingWebhook(null); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={editingWebhook ? handleUpdate : handleCreate}>
          <Form.Item name="url" label="URL" rules={[{ required: true, type: 'url' }]}>
            <Input placeholder="https://example.com/webhook" />
          </Form.Item>
          <Form.Item name="events" label="订阅事件" rules={[{ required: true }]}>
            <Select mode="multiple" options={EVENT_OPTIONS.map((e) => ({ label: e, value: e }))} />
          </Form.Item>
          <Form.Item name="secret" label="Signing Secret">
            <Input.Password placeholder="用于验证 webhook 签名的密钥" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Logs Drawer */}
      <Drawer
        title={`Webhook 日志: ${selectedWebhook?.url ?? ''}`}
        open={logDrawerVisible}
        onClose={() => setLogDrawerVisible(false)}
        width={720}
      >
        <Table columns={logColumns} dataSource={logs} rowKey="id" size="small" />
      </Drawer>
    </div>
  );
};

export default WebhookManagement;
```

#### 2C. API Key Management Page

**Route:** `/console/api-keys` (new entry in `router/routes.ts`)
**Page:** `src/pages/ApiKeyManagement/index.tsx` (NEW)
**API:** `src/api/api-key.ts` (existing, no changes needed)

```typescript
/**
 * API Key Management Page
 *
 * Admin page for API key CRUD: create, revoke, view stats.
 * Uses api/api-key.ts for all data operations.
 *
 * Route: /console/api-keys
 * Access: admin, platform_admin
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input,
  message, Popconfirm, Tooltip, DatePicker,
} from 'antd';
import {
  ReloadOutlined, PlusOutlined, DeleteOutlined, KeyOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import {
  getApiKeys, createApiKey, revokeApiKey, getApiKeyStats,
  type ApiKey, type ApiKeyInput,
} from '@/api/api-key';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ApiKeyManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; expired: number } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, statsRes] = await Promise.all([getApiKeys(), getApiKeyStats()]);
      setKeys(keysRes.data.data?.keys ?? []);
      setStats(statsRes.data.data?.stats ?? null);
    } catch (err) {
      message.error('加载 API Key 列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (values: ApiKeyInput) => {
    try {
      const res = await createApiKey(values);
      const newKey = res.data.data?.key?.key ?? '';
      setCreatedKey(newKey);
      message.success('API Key 已创建，请妥善保存');
      form.resetFields();
      loadData();
    } catch (err) {
      message.error('创建失败');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeApiKey(id);
      message.success('API Key 已撤销');
      loadData();
    } catch (err) {
      message.error('撤销失败');
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    message.success('已复制到剪贴板');
  };

  const columns: TableColumn<ApiKey>[] = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 160,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'key',
      title: 'Key',
      dataIndex: 'key',
      width: 280,
      render: (v: unknown) => {
        const keyStr = String(v);
        const display = keyStr.length > 20 ? `${keyStr.slice(0, 8)}...${keyStr.slice(-4)}` : keyStr;
        return (
          <Space>
            <Text code style={{ fontSize: 12 }}>{display}</Text>
            <Tooltip title="复制"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyKey(keyStr)} /></Tooltip>
          </Space>
        );
      },
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 70,
      render: (v: unknown) => v ? <Tag color="success">活跃</Tag> : <Tag color="default">已撤销</Tag>,
    },
    {
      key: 'expiresAt',
      title: '过期时间',
      dataIndex: 'expiresAt',
      width: 150,
      render: (v: unknown) => {
        if (!v) return <Tag>永不过期</Tag>;
        const expired = dayjs(String(v)).isBefore(dayjs());
        return <Tag color={expired ? 'error' : 'processing'}>{dayjs(String(v)).format('YYYY-MM-DD')}</Tag>;
      },
    },
    {
      key: 'lastUsedAt',
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      width: 150,
      render: (v: unknown) => v ? dayjs(String(v)).format('MM-DD HH:mm') : '从未使用',
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (v: unknown) => dayjs(String(v)).format('YYYY-MM-DD'),
    },
    {
      key: 'actions',
      title: '操作',
      width: 80,
      render: (_: unknown, record: ApiKey) =>
        record.enabled ? (
          <Popconfirm title="确认撤销该 API Key?" onConfirm={() => handleRevoke(record.id)}>
            <Tooltip title="撤销"><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        ) : '—',
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <KeyOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
            API Key 管理
          </Title>
          <Text type="secondary">API Key Management</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreatedKey(null); setModalVisible(true); }}>新建 Key</Button>
        </Space>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.md, marginBottom: spacing.lg }}>
          <MetricCard title="总数" value={stats.total} icon={<KeyOutlined />} color={colors.primary[500]} size="medium" />
          <MetricCard title="活跃" value={stats.active} icon={<KeyOutlined />} color={colors.success[500]} size="medium" />
          <MetricCard title="已过期" value={stats.expired} icon={<KeyOutlined />} color={colors.error[500]} size="medium" />
        </div>
      )}

      <Card>
        <Table columns={columns} dataSource={keys} loading={loading} rowKey="id" size="middle" striped />
      </Card>

      <Modal
        title="新建 API Key"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={createdKey ? [<Button key="close" type="primary" onClick={() => setModalVisible(false)}>完成</Button>] : undefined}
        width={480}
      >
        {createdKey ? (
          <div>
            <Alert message="请妥善保存此 API Key，关闭后将无法再次查看" type="warning" showIcon style={{ marginBottom: spacing.md }} />
            <Input value={createdKey} readOnly addonAfter={<Button type="link" onClick={() => copyKey(createdKey)}><CopyOutlined /> 复制</Button>} />
          </div>
        ) : (
          <Form form={form} layout="vertical" onFinish={handleCreate}>
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input placeholder="e.g. ci-pipeline-key" />
            </Form.Item>
            <Form.Item name="expiresAt" label="过期时间">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">创建</Button>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default ApiKeyManagement;
```

### Decision 3: Router Updates

Add three new route entries to `src/router/routes.ts`:

```typescript
// Cron Management (P2)
{
  path: '/console/cron',
  element: React.lazy(() => import('@/pages/CronManagement')),
  protected: true,
  requiredRole: ['admin', 'platform_admin'],
},
// Webhook Management (P2)
{
  path: '/console/webhooks',
  element: React.lazy(() => import('@/pages/WebhookManagement')),
  protected: true,
  requiredRole: ['admin', 'platform_admin'],
},
// API Key Management (P2)
{
  path: '/console/api-keys',
  element: React.lazy(() => import('@/pages/ApiKeyManagement')),
  protected: true,
  requiredRole: ['admin', 'platform_admin'],
},
```

### Decision 4: Knowledge API Deprecation

Add `@deprecated` JSDoc to `src/api/knowledge.ts`:

```typescript
/**
 * Knowledge API Client
 *
 * @deprecated This client is reserved for future native integration.
 * The current /knowledge route loads the orion-knowledge micro-frontend
 * application via wujie. If the team decides to replace the micro-frontend
 * with a native React page, this API client is ready to use.
 *
 * Backend routes: orion-platform-service/src/api/knowledge-routes.ts
 */
```

### Decision 5: Metrics API Rename

Rename `src/api/metrics.ts` to `src/api/prometheus.ts` to clarify its purpose as a Prometheus query client (distinct from the internal monitoring subsystem in `api/monitoring.ts`).

Update the JSDoc header:

```typescript
/**
 * Prometheus Query API Client
 *
 * Provides direct Prometheus query/range-query endpoints.
 * This is SEPARATE from api/monitoring.ts which wraps the internal
 * monitoring subsystem.
 *
 * Backend routes: orion-platform-service/src/api/metrics-routes.ts
 * (Prometheus proxy layer)
 */
```

No test file rename needed since tests can be updated in-place.

### Decision 6: EventBus & Session Page Type Adapters

Both the EventBus and Sessions pages define local types that differ from the API client types. Create adapter functions in the page files to map API responses to the page's local type expectations.

**EventBus adapter** (in `src/pages/EventBus/index.tsx`):

```typescript
/**
 * Map API EventBusEvent to page-local EventBusEvent format.
 */
function mapApiEventToPage(evt: import('@/api/eventbus').EventBusEvent): EventBusEvent {
  return {
    id: evt.id,
    eventType: evt.subject,        // API uses 'subject', page uses 'eventType'
    source: evt.source,
    timestamp: evt.publishedAt,    // API uses 'publishedAt', page uses 'timestamp'
    status: evt.status as EventBusEvent['status'],
    payloadSize: JSON.stringify(evt.payload ?? {}).length,
    subscriberCount: evt.retryCount,  // Approximation — real value needs backend field
    topic: evt.subject,
    traceId: evt.id,              // Approximation — real trace ID needs backend field
  };
}
```

**Session adapter** (in `src/pages/Sessions/index.tsx`):

```typescript
/**
 * Map API Session to page-local UserSession format.
 */
function mapApiSessionToPage(sess: import('@/api/session').Session): UserSession {
  const startedAt = dayjs(sess.createdAt);
  const lastActive = dayjs(sess.lastAccessedAt);
  return {
    id: sess.id,
    userId: sess.userId,
    sessionId: sess.id,           // API 'id' maps to page 'sessionId'
    ipAddress: sess.ipAddress ?? 'unknown',
    userAgent: sess.userAgent ?? 'unknown',
    startedAt: sess.createdAt,
    lastActive: sess.lastAccessedAt,
    status: dayjs(sess.expiresAt).isAfter(dayjs()) ? 'active' : 'expired',
    duration: Math.round(lastActive.diff(startedAt, 'second')),
  };
}
```

---

## File Changes Summary

### New Files (7):
| File | Description |
|------|-------------|
| `src/hooks/useBiDashboard.ts` | Shared BI dashboard data fetching hook |
| `src/pages/CronManagement/index.tsx` | Cron job CRUD management page |
| `src/pages/WebhookManagement/index.tsx` | Webhook CRUD management page |
| `src/pages/ApiKeyManagement/index.tsx` | API key management page |
| `src/pages/CronManagement/__tests__/index.test.tsx` | CronManagement tests |
| `src/pages/WebhookManagement/__tests__/index.test.tsx` | WebhookManagement tests |
| `src/pages/ApiKeyManagement/__tests__/index.test.tsx` | ApiKeyManagement tests |

### Modified Files (6):
| File | Change |
|------|--------|
| `src/router/routes.ts` | Add 3 new route entries |
| `src/pages/ExecutiveDashboard/index.tsx` | Use `useBiDashboard` hook, remove mock-only |
| `src/pages/ManagerDashboard/index.tsx` | Use `useBiDashboard` hook, remove mock-only |
| `src/pages/EngineerDashboard/index.tsx` | Use `useBiDashboard` hook, remove mock-only |
| `src/api/knowledge.ts` | Add `@deprecated` JSDoc |
| `src/api/metrics.ts` | Rename to `prometheus.ts`, update JSDoc |

### Unchanged (kept as-is):
| File | Reason |
|------|--------|
| `src/api/eventbus.ts` | Covered by frontend-page-gaps spec (connect existing page) |
| `src/api/session.ts` | Covered by frontend-page-gaps spec (connect existing page) |
| `src/api/cron.ts` | Used by new CronManagement page |
| `src/api/webhook.ts` | Used by new WebhookManagement page |
| `src/api/api-key.ts` | Used by new ApiKeyManagement page |
| `src/api/bi.ts` | Used by `useBiDashboard` hook |

### Test File Status:
| Test File | Action |
|----------|--------|
| `src/api/__tests__/api-key.test.ts` | KEEP (client retained) |
| `src/api/__tests__/metrics.test.ts` | KEEP (rename to `prometheus.test.ts` when module renamed) |
| `src/api/__tests__/cron.test.ts` | KEEP (client retained) |
| `src/api/__tests__/eventbus.test.ts` | KEEP (client retained) |
| `src/api/__tests__/session.test.ts` | KEEP (client retained) |
| `src/api/__tests__/webhook.test.ts` | KEEP (client retained) |
| `src/api/__tests__/knowledge.test.ts` | KEEP (client retained, deprecated) |

---

## Testing Requirements

### New Pages (3 pages, 9 tests minimum)

Each new page (CronManagement, WebhookManagement, ApiKeyManagement):

1. **Load test**: Renders without crashing, shows loading state, then displays data
2. **Create test**: Opens create modal, fills form, submits, shows success message
3. **Error handling test**: Simulates API failure, shows error message, does not crash

### BI Dashboard Hook (3 tests)

`src/hooks/__tests__/useBiDashboard.test.ts`:

1. Fetches executive dashboard data correctly
2. Fetches manager dashboard data with teamId param
3. Handles API error gracefully, returns error state

### Modified Dashboard Pages (3 pages, 3 tests minimum)

1. Each dashboard page renders with API data
2. Each dashboard page falls back gracefully when API is unavailable
3. Each dashboard page shows error alert on API failure

---

## Implementation Order

| Phase | Action | Files | Effort |
|-------|--------|-------|--------|
| 1 | Create `useBiDashboard` hook | `src/hooks/useBiDashboard.ts` | 1h |
| 2 | Update 3 BI dashboard pages | Executive/Manager/EngineerDashboard | 2h |
| 3 | Add `@deprecated` to knowledge.ts | `src/api/knowledge.ts` | 5min |
| 4 | Rename metrics.ts to prometheus.ts | `src/api/metrics.ts` -> `prometheus.ts` | 15min |
| 5 | Create CronManagement page | `src/pages/CronManagement/` | 2h |
| 6 | Create WebhookManagement page | `src/pages/WebhookManagement/` | 2h |
| 7 | Create ApiKeyManagement page | `src/pages/ApiKeyManagement/` | 2h |
| 8 | Add router entries | `src/router/routes.ts` | 10min |
| 9 | Write tests | `__tests__/` for 3 pages + hook | 3h |
| 10 | EventBus/Session page connect | Covered by page-gaps spec | (separate) |

**Total estimated effort: ~13 hours**

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backend `/v1/efficiency/dashboard` returns different shape for different dashboard types | Medium | Use type assertion in hook; add runtime validation |
| Prometheus endpoints (`api/metrics.ts`) may not exist in all deployments | Low | Page already has mock fallback; keep as optional |
| Micro-frontend knowledge app may conflict with native page | N/A | Decision is to keep micro-frontend; API client marked deprecated |
| EventBus API response field names differ from page expectations | Low | Type adapter layer maps field names |
| Session API `status` field missing from backend response | Low | Derive status from `expiresAt` timestamp in adapter |

---

## Future Considerations

1. **API Client Code Generation**: Consider OpenAPI/Swcodegen to auto-generate API clients from backend specs, eliminating manual sync issues.
2. **Unified Error Handling**: Centralize API error handling in `api/client.ts` response interceptor — currently each page handles errors independently.
3. **Caching Layer**: Add React Query or SWR for automatic caching, deduplication, and background refetching. The `useBiDashboard` hook would benefit from this.
4. **Mock Data Strategy**: The `__mocks__/mockBIData.ts` file is used by 3 dashboard pages. Consider moving mock data to a `__mocks__/` directory within each API module for closer coupling.
