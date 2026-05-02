# API Client Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up dead API clients, create new management pages, and consolidate BI dashboards

**Architecture:** API client layer cleanup + new React pages following existing patterns (Table + SearchFilterBar + MetricCard + Modal form).

**Tech Stack:** React, TypeScript, Ant Design, Axios, Vitest

---

## File Map

### New Files (7)
| File | Description |
|------|-------------|
| `src/hooks/useBiDashboard.ts` | Shared BI dashboard data fetching hook |
| `src/pages/CronManagement/index.tsx` | Cron job CRUD management page |
| `src/pages/WebhookManagement/index.tsx` | Webhook CRUD management page |
| `src/pages/ApiKeyManagement/index.tsx` | API key management page |
| `src/pages/CronManagement/__tests__/index.test.tsx` | CronManagement tests |
| `src/pages/WebhookManagement/__tests__/index.test.tsx` | WebhookManagement tests |
| `src/pages/ApiKeyManagement/__tests__/index.test.tsx` | ApiKeyManagement tests |

### Modified Files (6)
| File | Change |
|------|--------|
| `src/router/routes.ts` | Add 3 new route entries |
| `src/pages/ExecutiveDashboard/index.tsx` | Use `useBiDashboard` hook, remove mock-only |
| `src/pages/ManagerDashboard/index.tsx` | Use `useBiDashboard` hook, remove mock-only |
| `src/pages/EngineerDashboard/index.tsx` | Use `useBiDashboard` hook, remove mock-only |
| `src/api/knowledge.ts` | Add `@deprecated` JSDoc |
| `src/api/metrics.ts` | Rename to `prometheus.ts`, update JSDoc |

### Deleted Files (0)
Per the design doc decision matrix: **Nothing deleted.** All 8 API modules have backend support and a defined purpose. The design doc's initial Task 1/2 (delete api-key.ts, metrics.ts) are superseded by Decision 5 (rename metrics.ts) and Decision 1 (keep api-key.ts + build page).

---

### Task 1: Rename `api/metrics.ts` to `api/prometheus.ts` + update test

**Files:**
- Rename: `src/api/metrics.ts` -> `src/api/prometheus.ts`
- Rename: `src/api/__tests__/metrics.test.ts` -> `src/api/__tests__/prometheus.test.ts`

- [ ] **Step 1: Read current metrics.ts content**

The file at `/Users/heal/orion-design/orion-frontend/src/api/metrics.ts` contains:

```typescript
/**
 * Metrics API Client
 *
 * Backend routes: orion-platform-service/src/api/metrics-routes.ts
 */

import { api } from './client';

export interface MetricResult {
  metric: string;
  values: Array<[number, string]>;
}

export interface DashboardData {
  cpu: number;
  memory: number;
  requests: number;
  errors: number;
  latency: number;
}

export async function queryMetrics(query: string, time?: number) {
  const qs = `?query=${encodeURIComponent(query)}${time ? `&time=${time}` : ''}`;
  return api.get<{ result: MetricResult[] }>(`/v1/metrics/query${qs}`);
}

export async function queryRangeMetrics(query: string, start: number, end: number, step: number) {
  return api.get<{ result: MetricResult[] }>(
    `/v1/metrics/query/range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`
  );
}

export async function getDashboardData() {
  return api.get<{ data: DashboardData }>('/v1/metrics/dashboard');
}
```

- [ ] **Step 2: Rename the file**

```bash
cd /Users/heal/orion-design/orion-frontend && mv src/api/metrics.ts src/api/prometheus.ts
```

- [ ] **Step 3: Update the JSDoc header in `src/api/prometheus.ts`**

Replace the top comment block:

```diff
-/**
- * Metrics API Client
- *
- * Backend routes: orion-platform-service/src/api/metrics-routes.ts
- */
+/**
+ * Prometheus Query API Client
+ *
+ * Provides direct Prometheus query/range-query endpoints.
+ * This is SEPARATE from api/monitoring.ts which wraps the internal
+ * monitoring subsystem.
+ *
+ * Backend routes: orion-platform-service/src/api/metrics-routes.ts
+ * (Prometheus proxy layer)
+ */
```

- [ ] **Step 4: Rename the test file**

```bash
cd /Users/heal/orion-design/orion-frontend && mv src/api/__tests__/metrics.test.ts src/api/__tests__/prometheus.test.ts
```

- [ ] **Step 5: Update import in the test file**

Read `src/api/__tests__/prometheus.test.ts` and replace any `import ... from '../metrics'` with `import ... from '../prometheus'`.

- [ ] **Step 6: Run tests to verify**

```bash
cd /Users/heal/orion-design/orion-frontend && npx vitest run src/api/__tests__/prometheus.test.ts
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/heal/orion-design/orion-frontend
git add src/api/prometheus.ts src/api/__tests__/prometheus.test.ts
git rm src/api/metrics.ts src/api/__tests__/metrics.test.ts
git commit -m "refactor(api): rename metrics.ts to prometheus.ts to clarify Prometheus proxy purpose"
```

---

### Task 2: Add `@deprecated` JSDoc to `api/knowledge.ts`

**Files:**
- Modify: `src/api/knowledge.ts:1-5`

- [ ] **Step 1: Update JSDoc header in `src/api/knowledge.ts`**

Replace the existing header:

```diff
-/**
- * Knowledge API Client
- *
- * Backend routes: orion-platform-service/src/api/knowledge-routes.ts
- */
+/**
+ * Knowledge API Client
+ *
+ * @deprecated This client is reserved for future native integration.
+ * The current /knowledge route loads the orion-knowledge micro-frontend
+ * application via wujie. If the team decides to replace the micro-frontend
+ * with a native React page, this API client is ready to use.
+ *
+ * Backend routes: orion-platform-service/src/api/knowledge-routes.ts
+ */
```

- [ ] **Step 2: Verify no other files import from knowledge.ts that would break**

```bash
cd /Users/heal/orion-design/orion-frontend && grep -r "from.*knowledge" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__" | grep -v "node_modules"
```

Expected: Only the test file imports it. No runtime imports to break.

- [ ] **Step 3: Run type-check to verify**

```bash
cd /Users/heal/orion-design/orion-frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /Users/heal/orion-design/orion-frontend
git add src/api/knowledge.ts
git commit -m "docs(api): mark knowledge.ts as @deprecated (micro-frontend architecture)"
```

---

### Task 3: Create `useBiDashboard` hook

**Files:**
- Create: `src/hooks/useBiDashboard.ts`
- Test: `src/hooks/__tests__/useBiDashboard.test.ts` (create if directory doesn't exist)

- [ ] **Step 1: Create `src/hooks/useBiDashboard.ts`**

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

- [ ] **Step 2: Create `src/hooks/__tests__/` directory if it doesn't exist**

```bash
mkdir -p /Users/heal/orion-design/orion-frontend/src/hooks/__tests__
```

- [ ] **Step 3: Write hook tests `src/hooks/__tests__/useBiDashboard.test.ts`**

```typescript
/**
 * Tests for useBiDashboard hook
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useBiDashboard } from '../useBiDashboard';
import * as biApi from '@/api/bi';

// Mock the BI API module
vi.mock('@/api/bi', () => ({
  getExecutiveDashboard: vi.fn(),
  getManagerDashboard: vi.fn(),
  getEngineerDashboard: vi.fn(),
}));

const mockExecutiveData = {
  data: {
    data: {
      overview: {
        totalTickets: 100,
        resolvedTickets: 80,
        openTickets: 20,
        overallResolutionRate: 80,
        avgResolutionTimeHours: 4.5,
        slaComplianceRate: 95,
        totalEngineers: 10,
        activeEngineers: 8,
      },
      trends: {
        ticketVolumeTrend: [],
        resolutionTimeTrend: [],
        slaComplianceTrend: [],
      },
      teamRanking: { topPerformers: [], bottomPerformers: [] },
      alerts: { slaBreachedCount: 0, overdueTicketsCount: 0, overloadedEngineers: 0, unassignedOlderThan24h: 0 },
      distribution: { byCategory: {}, byPriority: {} },
    },
  },
};

const mockManagerData = {
  data: {
    data: {
      teamOverview: { totalTickets: 50, resolvedCount: 40, avgResolutionTimeHours: 3.2, slaComplianceRate: 92, teamLoadPercentage: 75 },
      memberMetrics: [],
      weekOverWeek: { ticketsCreatedChange: 5, resolvedChange: 3, avgResolutionTimeChange: -2, slaComplianceChange: 1 },
      transferAnalysis: { totalTransfers: 10, avgTransfersPerTicket: 0.2, topTransferReasons: [] },
    },
  },
};

describe('useBiDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches executive dashboard data correctly', async () => {
    vi.mocked(biApi.getExecutiveDashboard).mockResolvedValue(mockExecutiveData as any);

    const { result } = renderHook(() => useBiDashboard('executive'));

    // Initial state
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(biApi.getExecutiveDashboard).toHaveBeenCalledWith({ days: undefined });
    expect(result.current.data).toBeTruthy();
    expect(result.current.error).toBeNull();
  });

  it('fetches manager dashboard data with teamId param', async () => {
    vi.mocked(biApi.getManagerDashboard).mockResolvedValue(mockManagerData as any);

    const { result } = renderHook(() =>
      useBiDashboard('manager', { teamId: 'team-1', days: 7 })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(biApi.getManagerDashboard).toHaveBeenCalledWith({ teamId: 'team-1', days: 7 });
    expect(result.current.data).toBeTruthy();
  });

  it('handles API error gracefully, returns error state', async () => {
    vi.mocked(biApi.getExecutiveDashboard).mockRejectedValue(new Error('API unavailable'));

    const { result } = renderHook(() => useBiDashboard('executive'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('API unavailable');
    expect(result.current.data).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/heal/orion-design/orion-frontend && npx vitest run src/hooks/__tests__/useBiDashboard.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/heal/orion-design/orion-frontend
git add src/hooks/useBiDashboard.ts src/hooks/__tests__/useBiDashboard.test.ts
git commit -m "feat(hooks): add useBiDashboard shared hook for BI dashboard data fetching"
```

---

### Task 4: Refactor ExecutiveDashboard to use `useBiDashboard` hook

**Files:**
- Modify: `src/pages/ExecutiveDashboard/index.tsx`

- [ ] **Step 1: Update imports at the top of `src/pages/ExecutiveDashboard/index.tsx`**

Replace:
```typescript
import { mockExecutiveDashboard } from '@/pages/__mocks__/mockBIData';
```

With:
```typescript
import { useBiDashboard } from '@/hooks/useBiDashboard';
import type { ExecutiveDashboardData } from '@/types/pages';
import { mockExecutiveDashboard } from '@/pages/__mocks__/mockBIData';
import { Spin, Alert } from 'antd';
```

- [ ] **Step 2: Replace mock-only data with hook result**

Inside the `ExecutiveDashboard` component, replace:
```typescript
const data = mockExecutiveDashboard;
```

With:
```typescript
const { data: apiData, loading, error } = useBiDashboard('executive');

// Fallback to mock data when API is unavailable
const data = (apiData as ExecutiveDashboardData | undefined) ?? mockExecutiveDashboard;
const showMockWarning = !apiData;
```

- [ ] **Step 3: Add loading and error UI in the render**

Replace the opening of the return JSX:
```diff
   return (
     <div style={{ padding: 0 }}>
+      {/* Page header */}
+      {loading && !data && (
+        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
+          <Spin tip="加载效能数据..." size="large" />
+        </div>
+      )}
+      {showMockWarning && (
+        <Alert
+          message="API 不可用"
+          description="效能仪表盘 API 尚未部署，当前显示模拟数据。"
+          type="warning"
+          showIcon
+          closable
+          style={{ marginBottom: 16 }}
+        />
+      )}
+      {error && (
+        <Alert
+          message="加载失败"
+          description={error.message}
+          type="error"
+          showIcon
+          style={{ marginBottom: 16 }}
+        />
+      )}
       {/* Page header */}
```

- [ ] **Step 4: Run type-check**

```bash
cd /Users/heal/orion-design/orion-frontend && npx tsc --noEmit 2>&1 | grep -i "ExecutiveDashboard" | head -10
```

- [ ] **Step 5: Commit**

```bash
cd /Users/heal/orion-design/orion-frontend
git add src/pages/ExecutiveDashboard/index.tsx
git commit -m "refactor(ExecutiveDashboard): integrate useBiDashboard hook with mock fallback"
```

---

### Task 5: Refactor ManagerDashboard to use `useBiDashboard` hook

**Files:**
- Modify: `src/pages/ManagerDashboard/index.tsx`

- [ ] **Step 1: Update imports at the top**

Replace:
```typescript
import { mockManagerDashboard } from '@/pages/__mocks__/mockBIData';
```

With:
```typescript
import { useBiDashboard } from '@/hooks/useBiDashboard';
import type { ManagerDashboardData } from '@/types/pages';
import { mockManagerDashboard } from '@/pages/__mocks__/mockBIData';
import { Spin, Alert } from 'antd';
```

- [ ] **Step 2: Replace mock-only data with hook result**

Inside the `ManagerDashboard` component, replace:
```typescript
const data = mockManagerDashboard;
```

With:
```typescript
const { data: apiData, loading, error } = useBiDashboard('manager');

// Fallback to mock data when API is unavailable
const data = (apiData as ManagerDashboardData | undefined) ?? mockManagerDashboard;
const showMockWarning = !apiData;
```

- [ ] **Step 3: Add loading and error UI in the render**

Replace the opening of the return JSX:
```diff
   return (
     <div style={{ padding: 0 }}>
+      {loading && !data && (
+        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
+          <Spin tip="加载效能数据..." size="large" />
+        </div>
+      )}
+      {showMockWarning && (
+        <Alert
+          message="API 不可用"
+          description="经理效能仪表盘 API 尚未部署，当前显示模拟数据。"
+          type="warning"
+          showIcon
+          closable
+          style={{ marginBottom: 16 }}
+        />
+      )}
+      {error && (
+        <Alert
+          message="加载失败"
+          description={error.message}
+          type="error"
+          showIcon
+          style={{ marginBottom: 16 }}
+        />
+      )}
       {/* Page header */}
```

- [ ] **Step 4: Run type-check**

```bash
cd /Users/heal/orion-design/orion-frontend && npx tsc --noEmit 2>&1 | grep -i "ManagerDashboard" | head -10
```

- [ ] **Step 5: Commit**

```bash
cd /Users/heal/orion-design/orion-frontend
git add src/pages/ManagerDashboard/index.tsx
git commit -m "refactor(ManagerDashboard): integrate useBiDashboard hook with mock fallback"
```

---

### Task 6: Refactor EngineerDashboard to use `useBiDashboard` hook

**Files:**
- Modify: `src/pages/EngineerDashboard/index.tsx`

- [ ] **Step 1: Update imports at the top**

Replace:
```typescript
import { mockEngineerDashboard } from '@/pages/__mocks__/mockBIData';
```

With:
```typescript
import { useBiDashboard } from '@/hooks/useBiDashboard';
import type { EngineerDashboardData } from '@/types/pages';
import { mockEngineerDashboard } from '@/pages/__mocks__/mockBIData';
import { Spin, Alert } from 'antd';
```

- [ ] **Step 2: Replace mock-only data with hook result**

Inside the `EngineerDashboard` component, replace:
```typescript
const data = mockEngineerDashboard;
```

With:
```typescript
const { data: apiData, loading, error } = useBiDashboard('engineer');

// Fallback to mock data when API is unavailable
const data = (apiData as EngineerDashboardData | undefined) ?? mockEngineerDashboard;
const showMockWarning = !apiData;
```

- [ ] **Step 3: Add loading and error UI in the render**

Replace the opening of the return JSX:
```diff
   return (
     <div style={{ padding: 0 }}>
+      {loading && !data && (
+        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
+          <Spin tip="加载效能数据..." size="large" />
+        </div>
+      )}
+      {showMockWarning && (
+        <Alert
+          message="API 不可用"
+          description="个人效能仪表盘 API 尚未部署，当前显示模拟数据。"
+          type="warning"
+          showIcon
+          closable
+          style={{ marginBottom: 16 }}
+        />
+      )}
+      {error && (
+        <Alert
+          message="加载失败"
+          description={error.message}
+          type="error"
+          showIcon
+          style={{ marginBottom: 16 }}
+        />
+      )}
       {/* Page header */}
```

- [ ] **Step 4: Run type-check**

```bash
cd /Users/heal/orion-design/orion-frontend && npx tsc --noEmit 2>&1 | grep -i "EngineerDashboard" | head -10
```

- [ ] **Step 5: Commit**

```bash
cd /Users/heal/orion-design/orion-frontend
git add src/pages/EngineerDashboard/index.tsx
git commit -m "refactor(EngineerDashboard): integrate useBiDashboard hook with mock fallback"
```

---

### Task 7: Create CronManagement page + tests

**Files:**
- Create: `src/pages/CronManagement/index.tsx`
- Create: `src/pages/CronManagement/__tests__/index.test.tsx`

- [ ] **Step 1: Create `src/pages/CronManagement/index.tsx`**

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
  Switch, message, Popconfirm, Tooltip, Alert, Spin,
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

  if (loading && jobs.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin tip="加载定时任务..." size="large" />
      </div>
    );
  }

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

- [ ] **Step 2: Create `src/pages/CronManagement/__tests__/index.test.tsx`**

```typescript
/**
 * Tests for CronManagement page
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CronManagement from '../index';
import * as cronApi from '@/api/cron';

vi.mock('@/api/cron', () => ({
  getCronJobs: vi.fn(),
  getCronStatus: vi.fn(),
  createCronJob: vi.fn(),
  updateCronJob: vi.fn(),
  deleteCronJob: vi.fn(),
  executeCronJob: vi.fn(),
}));

vi.mock('@/components/Table', () => ({
  default: ({ dataSource, columns, loading, rowKey }: any) => (
    <div data-testid="orion-table" data-loading={loading}>
      {dataSource?.map((item: any) => (
        <div key={item[rowKey]} data-testid={`row-${item[rowKey]}`}>
          {item.name}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/MetricCard', () => ({
  default: ({ title, value }: any) => (
    <div data-testid="metric-card">{title}: {value}</div>
  ),
}));

const mockJobs = [
  { id: '1', name: 'daily-cleanup', schedule: '0 2 * * *', command: 'npm run cleanup', enabled: true, status: 'idle', runCount: 42, lastRunAt: '2026-04-29T02:00:00Z', nextRunAt: '2026-04-30T02:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-29T02:00:00Z' },
];

const mockStats = { running: 1, total: 5, enabled: 4 };

describe('CronManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state then displays data', async () => {
    vi.mocked(cronApi.getCronJobs).mockResolvedValue({ data: { data: { jobs: mockJobs } } } as any);
    vi.mocked(cronApi.getCronStatus).mockResolvedValue({ data: { data: mockStats } } as any);

    render(<CronManagement />);

    // Loading state
    await waitFor(() => {
      expect(screen.getByTestId('orion-table')).toBeTruthy();
    });

    expect(screen.getByText('daily-cleanup')).toBeTruthy();
    expect(screen.getByText('定时任务管理')).toBeTruthy();
  });

  it('opens create modal and submits form', async () => {
    vi.mocked(cronApi.getCronJobs).mockResolvedValue({ data: { data: { jobs: [] } } } as any);
    vi.mocked(cronApi.getCronStatus).mockResolvedValue({ data: { data: mockStats } } as any);
    vi.mocked(cronApi.createCronJob).mockResolvedValue({ data: { data: {} } } as any);

    render(<CronManagement />);

    await waitFor(() => {
      expect(screen.getByText('新建任务')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('新建任务'));

    await waitFor(() => {
      expect(screen.getByText('新建定时任务')).toBeTruthy();
    });
  });

  it('shows error message when API fails', async () => {
    vi.mocked(cronApi.getCronJobs).mockRejectedValue(new Error('Network error'));
    vi.mocked(cronApi.getCronStatus).mockRejectedValue(new Error('Network error'));

    render(<CronManagement />);

    await waitFor(() => {
      expect(screen.getByText('加载定时任务失败')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/heal/orion-design/orion-frontend && npx vitest run src/pages/CronManagement/__tests__/index.test.tsx
```

- [ ] **Step 4: Run type-check**

```bash
cd /Users/heal/orion-design/orion-frontend && npx tsc --noEmit 2>&1 | grep -i "CronManagement" | head -10
```

- [ ] **Step 5: Commit**

```bash
cd /Users/heal/orion-design/orion-frontend
git add src/pages/CronManagement/index.tsx src/pages/CronManagement/__tests__/index.test.tsx
git commit -m "feat(pages): add CronManagement page for scheduled job CRUD"
```

---

### Task 8: Create WebhookManagement page + tests

**Files:**
- Create: `src/pages/WebhookManagement/index.tsx`
- Create: `src/pages/WebhookManagement/__tests__/index.test.tsx`

- [ ] **Step 1: Create `src/pages/WebhookManagement/index.tsx`**

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
  Switch, message, Popconfirm, Tooltip, Select, Drawer, Spin,
} from 'antd';
import {
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  SendOutlined, EyeOutlined, LinkOutlined, CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
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
          {(v as string[]).map((e) => <Tag key={e} color="blue" style={{ fontSize: 11 }}>{e}</Tag>)}
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

  if (loading && webhooks.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin tip="加载 Webhook..." size="large" />
      </div>
    );
  }

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

- [ ] **Step 2: Create `src/pages/WebhookManagement/__tests__/index.test.tsx`**

```typescript
/**
 * Tests for WebhookManagement page
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WebhookManagement from '../index';
import * as webhookApi from '@/api/webhook';

vi.mock('@/api/webhook', () => ({
  getWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  updateWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  testWebhook: vi.fn(),
  getWebhookLogs: vi.fn(),
}));

vi.mock('@/components/Table', () => ({
  default: ({ dataSource, columns, loading, rowKey }: any) => (
    <div data-testid="orion-table" data-loading={loading}>
      {dataSource?.map((item: any) => (
        <div key={item[rowKey]} data-testid={`row-${item[rowKey]}`}>
          {item.url}
        </div>
      ))}
    </div>
  ),
}));

const mockWebhooks = [
  { id: '1', url: 'https://example.com/hook', events: ['pipeline.completed'], enabled: true, failureCount: 0, lastStatus: 200, lastTriggeredAt: '2026-04-29T10:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-29T10:00:00Z' },
];

describe('WebhookManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state then displays data', async () => {
    vi.mocked(webhookApi.getWebhooks).mockResolvedValue({ data: { data: { webhooks: mockWebhooks } } } as any);

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByTestId('orion-table')).toBeTruthy();
    });

    expect(screen.getByText('https://example.com/hook')).toBeTruthy();
    expect(screen.getByText('Webhook 管理')).toBeTruthy();
  });

  it('opens create modal on button click', async () => {
    vi.mocked(webhookApi.getWebhooks).mockResolvedValue({ data: { data: { webhooks: [] } } } as any);

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByText('新建 Webhook')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('新建 Webhook'));

    await waitFor(() => {
      expect(screen.getByText('新建 Webhook')).toBeTruthy();
    });
  });

  it('shows error message when API fails', async () => {
    vi.mocked(webhookApi.getWebhooks).mockRejectedValue(new Error('Network error'));

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByText('加载 Webhook 列表失败')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/heal/orion-design/orion-frontend && npx vitest run src/pages/WebhookManagement/__tests__/index.test.tsx
```

- [ ] **Step 4: Commit**

```bash
cd /Users/heal/orion-design/orion-frontend
git add src/pages/WebhookManagement/index.tsx src/pages/WebhookManagement/__tests__/index.test.tsx
git commit -m "feat(pages): add WebhookManagement page for platform webhook CRUD"
```

---

### Task 9: Create ApiKeyManagement page + tests

**Files:**
- Create: `src/pages/ApiKeyManagement/index.tsx`
- Create: `src/pages/ApiKeyManagement/__tests__/index.test.tsx`

- [ ] **Step 1: Create `src/pages/ApiKeyManagement/index.tsx`**

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
  message, Popconfirm, Tooltip, DatePicker, Alert, Spin,
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

  if (loading && keys.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin tip="加载 API Key..." size="large" />
      </div>
    );
  }

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

- [ ] **Step 2: Create `src/pages/ApiKeyManagement/__tests__/index.test.tsx`**

```typescript
/**
 * Tests for ApiKeyManagement page
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ApiKeyManagement from '../index';
import * as apiKeyApi from '@/api/api-key';

vi.mock('@/api/api-key', () => ({
  getApiKeys: vi.fn(),
  getApiKeyStats: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
}));

vi.mock('@/components/Table', () => ({
  default: ({ dataSource, columns, loading, rowKey }: any) => (
    <div data-testid="orion-table" data-loading={loading}>
      {dataSource?.map((item: any) => (
        <div key={item[rowKey]} data-testid={`row-${item[rowKey]}`}>
          {item.name}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/MetricCard', () => ({
  default: ({ title, value }: any) => (
    <div data-testid="metric-card">{title}: {value}</div>
  ),
}));

const mockKeys = [
  { id: '1', name: 'ci-pipeline-key', key: 'sk_live_abc123def456', userId: 'u1', enabled: true, createdAt: '2026-01-01T00:00:00Z' },
];

const mockStats = { total: 5, active: 4, expired: 1 };

describe('ApiKeyManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state then displays data', async () => {
    vi.mocked(apiKeyApi.getApiKeys).mockResolvedValue({ data: { data: { keys: mockKeys } } } as any);
    vi.mocked(apiKeyApi.getApiKeyStats).mockResolvedValue({ data: { data: { stats: mockStats } } } as any);

    render(<ApiKeyManagement />);

    await waitFor(() => {
      expect(screen.getByTestId('orion-table')).toBeTruthy();
    });

    expect(screen.getByText('ci-pipeline-key')).toBeTruthy();
    expect(screen.getByText('API Key 管理')).toBeTruthy();
  });

  it('opens create modal on button click', async () => {
    vi.mocked(apiKeyApi.getApiKeys).mockResolvedValue({ data: { data: { keys: [] } } } as any);
    vi.mocked(apiKeyApi.getApiKeyStats).mockResolvedValue({ data: { data: { stats: mockStats } } } as any);

    render(<ApiKeyManagement />);

    await waitFor(() => {
      expect(screen.getByText('新建 Key')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('新建 Key'));

    await waitFor(() => {
      expect(screen.getByText('新建 API Key')).toBeTruthy();
    });
  });

  it('shows error message when API fails', async () => {
    vi.mocked(apiKeyApi.getApiKeys).mockRejectedValue(new Error('Network error'));
    vi.mocked(apiKeyApi.getApiKeyStats).mockRejectedValue(new Error('Network error'));

    render(<ApiKeyManagement />);

    await waitFor(() => {
      expect(screen.getByText('加载 API Key 列表失败')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/heal/orion-design/orion-frontend && npx vitest run src/pages/ApiKeyManagement/__tests__/index.test.tsx
```

- [ ] **Step 4: Commit**

```bash
cd /Users/heal/orion-design/orion-frontend
git add src/pages/ApiKeyManagement/index.tsx src/pages/ApiKeyManagement/__tests__/index.test.tsx
git commit -m "feat(pages): add ApiKeyManagement page for API key CRUD"
```

---

### Task 10: Register new pages in router

**Files:**
- Modify: `src/router/routes.ts`

- [ ] **Step 1: Add three new route entries to `src/router/routes.ts`**

Insert after the `// 404 页面` comment and before the `// Backup Management` section (around line 811, after the `/test-selector` route and before the `*` catch-all):

```diff
   // Test Selector (P1 - Missing Page)
   {
     path: '/test-selector',
     element: React.lazy(() => import('@/pages/TestSelector')),
     protected: true,
   },
+  // Cron Management
+  {
+    path: '/console/cron',
+    element: React.lazy(() => import('@/pages/CronManagement')),
+    protected: true,
+    requiredRole: ['admin', 'platform_admin'],
+  },
+  // Webhook Management
+  {
+    path: '/console/webhooks',
+    element: React.lazy(() => import('@/pages/WebhookManagement')),
+    protected: true,
+    requiredRole: ['admin', 'platform_admin'],
+  },
+  // API Key Management
+  {
+    path: '/console/api-keys',
+    element: React.lazy(() => import('@/pages/ApiKeyManagement')),
+    protected: true,
+    requiredRole: ['admin', 'platform_admin'],
+  },
   // 404 页面
   // Backup Management (P1)
```

- [ ] **Step 2: Run type-check**

```bash
cd /Users/heal/orion-design/orion-frontend && npx tsc --noEmit 2>&1 | grep -i "routes" | head -10
```

Expected: No errors related to the new routes.

- [ ] **Step 3: Run full test suite to verify nothing broke**

```bash
cd /Users/heal/orion-design/orion-frontend && npx vitest run 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
cd /Users/heal/orion-design/orion-frontend
git add src/router/routes.ts
git commit -m "feat(router): register CronManagement, WebhookManagement, ApiKeyManagement routes"
```

---

## Verification Checklist

After all tasks are complete, run:

```bash
cd /Users/heal/orion-design/orion-frontend

# 1. Type check
npx tsc --noEmit

# 2. Full test suite
npx vitest run

# 3. Verify new files exist
ls -la src/hooks/useBiDashboard.ts
ls -la src/pages/CronManagement/index.tsx
ls -la src/pages/WebhookManagement/index.tsx
ls -la src/pages/ApiKeyManagement/index.tsx

# 4. Verify renamed file
ls -la src/api/prometheus.ts
# Verify old file gone
test ! -f src/api/metrics.ts && echo "OK: metrics.ts removed"

# 5. Verify router entries
grep -n "console/cron\|console/webhooks\|console/api-keys" src/router/routes.ts

# 6. Verify deprecation notice
head -10 src/api/knowledge.ts | grep -i deprecated
```

## Git History Summary (10 commits total)

| # | Commit Message |
|---|---------------|
| 1 | `refactor(api): rename metrics.ts to prometheus.ts to clarify Prometheus proxy purpose` |
| 2 | `docs(api): mark knowledge.ts as @deprecated (micro-frontend architecture)` |
| 3 | `feat(hooks): add useBiDashboard shared hook for BI dashboard data fetching` |
| 4 | `refactor(ExecutiveDashboard): integrate useBiDashboard hook with mock fallback` |
| 5 | `refactor(ManagerDashboard): integrate useBiDashboard hook with mock fallback` |
| 6 | `refactor(EngineerDashboard): integrate useBiDashboard hook with mock fallback` |
| 7 | `feat(pages): add CronManagement page for scheduled job CRUD` |
| 8 | `feat(pages): add WebhookManagement page for platform webhook CRUD` |
| 9 | `feat(pages): add ApiKeyManagement page for API key CRUD` |
| 10 | `feat(router): register CronManagement, WebhookManagement, ApiKeyManagement routes` |
