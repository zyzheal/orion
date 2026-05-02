# Frontend Page Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 20+ frontend pages from mock data to real API integration

**Architecture:** React 18 + TypeScript + Ant Design + Axios API clients. Each page follows the pattern: API call → type mapping → UI render → error handling.

**Tech Stack:** React, TypeScript, Ant Design, Axios, Vitest

---

## Pre-requisites

- Working directory: `/Users/heal/orion-design/orion-frontend`
- Branch: `feat/frontend-gap-implementation`
- All tasks run from this branch

---

## Task 1: Backup download URL implementation (Severity 4 -- lowest risk)

**File:** `/Users/heal/orion-design/orion-frontend/src/api/backup.ts`

Add download URL API function.

```typescript
export async function getBackupDownloadUrl(id: string) {
  return api.post<{ url: string }>(`/v1/backups/${id}/download`);
}
```

**File:** `/Users/heal/orion-design/orion-frontend/src/pages/Backup/index.tsx` (line ~287-290)

Replace the current `handleDownload`:

```typescript
// BEFORE:
const handleDownload = (record: BackupRecord) => {
  // TODO: Replace with actual download URL generation
  message.info(`下载链接已生成: ${record.name}`);
};

// AFTER:
import { getBackupDownloadUrl } from '@/api/backup';

const handleDownload = async (record: BackupRecord) => {
  try {
    const res = await getBackupDownloadUrl(record.id);
    const url = res.data?.data?.url;
    if (url) {
      window.open(url, '_blank');
    } else {
      message.warning('未获取到下载链接');
    }
  } catch (error: unknown) {
    message.error(`下载失败: ${(error as Error).message}`);
  }
};
```

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/Backup/__tests__/index.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BackupPage from '../index';
import * as backupApi from '@/api/backup';

vi.mock('@/api/backup', () => ({
  getBackups: vi.fn().mockResolvedValue({ data: { data: [] } }),
  getBackupDownloadUrl: vi.fn(),
}));

describe('BackupPage', () => {
  it('calls download URL API and opens window on success', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.mocked(backupApi.getBackupDownloadUrl).mockResolvedValue({
      data: { data: { url: 'https://example.com/backup.tar.gz' } },
    } as any);

    render(<BackupPage />);

    // Trigger download on a row button
    const downloadBtn = await screen.findByRole('button', { name: /下载/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(backupApi.getBackupDownloadUrl).toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledWith('https://example.com/backup.tar.gz', '_blank');
    });

    openSpy.mockRestore();
  });

  it('shows error message when download API fails', async () => {
    vi.mocked(backupApi.getBackupDownloadUrl).mockRejectedValue(new Error('Network error'));

    render(<BackupPage />);

    const downloadBtn = await screen.findByRole('button', { name: /下载/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(screen.getByText(/下载失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/Backup/__tests__/index.test.tsx
git add src/api/backup.ts src/pages/Backup/index.tsx src/pages/Backup/__tests__/index.test.tsx
git commit -m "fix(backup): implement real download URL API instead of mock message"
```

---

## Task 2: EventBus page mock → API migration

**File:** `/Users/heal/orion-design/orion-frontend/src/pages/EventBus/index.tsx`

Remove lines 88-208 (MOCK_STATS, MOCK_EVENTS), line 211 (EVENT_TYPES), line 224 (usingMockData), and lines 398-409 (mock warning Alert).

Replace `loadData` and add mapping functions:

```typescript
import { getEvents, getStats } from '@/api/eventbus';
import type { EventBusEvent as ApiEventBusEvent } from '@/api/eventbus';

// Type mapping: API event type -> UI event type
const mapApiEvent = (apiEvent: ApiEventBusEvent): EventBusEvent => ({
  id: apiEvent.id,
  eventType: apiEvent.subject,
  source: apiEvent.source || apiEvent.publishedBy || 'unknown',
  timestamp: apiEvent.publishedAt || apiEvent.createdAt,
  status: (apiEvent.status as EventBusEvent['status']) || 'pending',
  payloadSize: JSON.stringify(apiEvent.payload || {}).length,
  subscriberCount: 0,
  topic: apiEvent.subject,
  traceId: apiEvent.id.substring(0, 12),
});

const mapApiStats = (rawStats: Record<string, number>): EventBusStats => ({
  totalEvents: rawStats.total || 0,
  activeSubscribers: rawStats.activeSubscribers || 0,
  failedEvents: rawStats.failed || rawStats.failedEvents || 0,
  eventRate: rawStats.eventRate || 0,
});

const loadData = async () => {
  setLoading(true);
  try {
    const [eventsRes, statsRes] = await Promise.all([
      getEvents({ limit: 100 }),
      getStats(),
    ]);
    const eventsData = eventsRes.data?.data?.events || [];
    const statsData = statsRes.data?.data?.stats || {};
    setEvents(eventsData.map(mapApiEvent));
    setStats(mapApiStats(statsData));
  } catch (error: unknown) {
    message.error(`加载 EventBus 数据失败: ${(error as Error).message}`);
    setEvents([]);
    setStats(null);
  } finally {
    setLoading(false);
  }
};
```

Replace the `EVENT_TYPES` constant with a computed value inside the component:

```typescript
const eventTypes = useMemo(() =>
  Array.from(new Set(events.map((e) => e.eventType))).sort(),
  [events]
);
// Use `eventTypes` in the Select dropdown options instead of `EVENT_TYPES`.
```

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/EventBus/__tests__/index.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import EventBusPage from '../index';
import * as eventbusApi from '@/api/eventbus';

vi.mock('@/api/eventbus', () => ({
  getEvents: vi.fn(),
  getStats: vi.fn(),
}));

describe('EventBusPage', () => {
  it('loads events and stats from API on mount', async () => {
    const mockEvents = [{ id: 'evt-1', subject: 'test-topic', source: 'api', publishedAt: '2026-01-01', status: 'success', payload: {} }];
    vi.mocked(eventbusApi.getEvents).mockResolvedValue({ data: { data: { events: mockEvents } } } as any);
    vi.mocked(eventbusApi.getStats).mockResolvedValue({ data: { data: { stats: { total: 1, failed: 0 } } } } as any);

    render(<EventBusPage />);

    await waitFor(() => {
      expect(eventbusApi.getEvents).toHaveBeenCalledWith({ limit: 100 });
      expect(eventbusApi.getStats).toHaveBeenCalled();
    });
  });

  it('shows error on API failure, no mock data', async () => {
    vi.mocked(eventbusApi.getEvents).mockRejectedValue(new Error('Connection refused'));
    vi.mocked(eventbusApi.getStats).mockRejectedValue(new Error('Connection refused'));

    render(<EventBusPage />);

    await waitFor(() => {
      expect(screen.getByText(/加载 EventBus 数据失败/)).toBeInTheDocument();
    });
  });

  it('shows empty state when API returns empty array', async () => {
    vi.mocked(eventbusApi.getEvents).mockResolvedValue({ data: { data: { events: [] } } } as any);
    vi.mocked(eventbusApi.getStats).mockResolvedValue({ data: { data: { stats: {} } } } as any);

    render(<EventBusPage />);

    await waitFor(() => {
      expect(eventbusApi.getEvents).toHaveBeenCalled();
    });
    // Should show empty table, not mock data
    expect(screen.queryByText(/mock/i)).not.toBeInTheDocument();
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/EventBus/__tests__/index.test.tsx
git add src/pages/EventBus/index.tsx src/pages/EventBus/__tests__/index.test.tsx
git commit -m "fix(eventbus): migrate from mock data to real API integration"
```

---

## Task 3: Sessions page mock → API migration

**File:** `/Users/heal/orion-design/orion-frontend/src/pages/Sessions/index.tsx`

Remove lines 88-208 (MOCK_SESSIONS, MOCK_STATS), line 230 (usingMockData), and lines 428-438 (mock warning Alert).

Add `dayjs` import if not present:

```typescript
import dayjs from 'dayjs';
import { getSessions, getSessionStats, deleteSession as apiDeleteSession } from '@/api/session';
import type { Session as ApiSession, SessionStats as ApiSessionStats } from '@/api/session';

const deriveStatus = (session: ApiSession): 'active' | 'expired' | 'revoked' => {
  if (session.expiresAt && dayjs(session.expiresAt).isBefore(dayjs())) {
    return 'expired';
  }
  return 'active';
};

const mapApiSession = (apiSession: ApiSession): UserSession => ({
  id: apiSession.id,
  userId: apiSession.userId,
  sessionId: apiSession.token?.substring(0, 12) || apiSession.id,
  ipAddress: apiSession.ipAddress || 'unknown',
  userAgent: apiSession.userAgent || 'unknown',
  startedAt: apiSession.createdAt,
  lastActive: apiSession.lastAccessedAt,
  status: deriveStatus(apiSession),
  duration: dayjs(apiSession.lastAccessedAt).diff(dayjs(apiSession.createdAt), 'second'),
});

const mapApiStats = (apiStats: ApiSessionStats): SessionStats => ({
  activeSessions: apiStats.active || 0,
  totalUsers: apiStats.total || 0,
  expiredSessions: apiStats.expired || 0,
  avgDuration: 0,
});

const loadData = async () => {
  setLoading(true);
  try {
    const [sessionsRes, statsRes] = await Promise.all([
      getSessions(),
      getSessionStats(),
    ]);
    const sessionsData = sessionsRes.data?.data?.sessions || sessionsRes.data?.data || [];
    const statsData = statsRes.data?.data?.stats || statsRes.data?.data || {};
    setSessions(Array.isArray(sessionsData) ? sessionsData.map(mapApiSession) : []);
    setStats(mapApiStats(statsData as ApiSessionStats));
  } catch (error: unknown) {
    message.error(`加载 Session 数据失败: ${(error as Error).message}`);
    setSessions([]);
    setStats(null);
  } finally {
    setLoading(false);
  }
};

const handleRevoke = async (id: string) => {
  try {
    await apiDeleteSession(id);
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'revoked' as const } : s))
    );
    message.success('会话已撤销');
  } catch (error: unknown) {
    message.error(`撤销失败: ${(error as Error).message}`);
  }
};
```

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/Sessions/__tests__/index.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SessionsPage from '../index';
import * as sessionApi from '@/api/session';

vi.mock('@/api/session', () => ({
  getSessions: vi.fn(),
  getSessionStats: vi.fn(),
  deleteSession: vi.fn(),
}));

describe('SessionsPage', () => {
  it('loads sessions and stats from API on mount', async () => {
    vi.mocked(sessionApi.getSessions).mockResolvedValue({ data: { data: { sessions: [] } } } as any);
    vi.mocked(sessionApi.getSessionStats).mockResolvedValue({ data: { data: { stats: {} } } } as any);

    render(<SessionsPage />);

    await waitFor(() => {
      expect(sessionApi.getSessions).toHaveBeenCalled();
      expect(sessionApi.getSessionStats).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(sessionApi.getSessions).mockRejectedValue(new Error('Network error'));

    render(<SessionsPage />);

    await waitFor(() => {
      expect(screen.getByText(/加载 Session 数据失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/Sessions/__tests__/index.test.tsx
git add src/pages/Sessions/index.tsx src/pages/Sessions/__tests__/index.test.tsx
git commit -m "fix(sessions): migrate from mock data to real session API with type mapping"
```

---

## Task 4: Approvals page remove mock fallback

**File:** `/Users/heal/orion-design/orion-frontend/src/pages/Approvals/index.tsx`

Replace `loadData` (lines 182-199):

```typescript
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getApprovals();
    const list = res.data?.data?.approvals;
    setApprovals(Array.isArray(list) ? list : []);
  } catch (error: unknown) {
    setApprovals([]);
    message.error(`加载审批数据失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};
```

**Cleanup:**
- Remove lines 75-158 (MOCK_APPROVALS constants)
- Remove line 173 (usingMockData state)
- Remove lines 704-715 (mock warning Alert)

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/Approvals/__tests__/index.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import ApprovalsPage from '../index';
import * as approvalsApi from '@/api/approvals';

vi.mock('@/api/approvals', () => ({
  getApprovals: vi.fn(),
}));

describe('ApprovalsPage', () => {
  it('loads approvals from API on mount', async () => {
    const mockApprovals = [{ id: '1', title: 'Test approval', status: 'pending' }];
    vi.mocked(approvalsApi.getApprovals).mockResolvedValue({ data: { data: { approvals: mockApprovals } } } as any);

    render(<ApprovalsPage />);

    await waitFor(() => {
      expect(approvalsApi.getApprovals).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(approvalsApi.getApprovals).mockRejectedValue(new Error('Network error'));

    render(<ApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText(/加载审批数据失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/Approvals/__tests__/index.test.tsx
git add src/pages/Approvals/index.tsx src/pages/Approvals/__tests__/index.test.tsx
git commit -m "fix(approvals): remove mock fallback, show error on API failure"
```

---

## Task 5: Artifacts page remove mock fallback + download history

**File:** `/Users/heal/orion-design/orion-frontend/src/pages/Artifacts/index.tsx`

Replace the following functions:

```typescript
// loadData:
const loadData = async (page?: number, size?: number) => {
  const p = page ?? currentPage;
  const s = size ?? pageSize;
  setLoading(true);
  try {
    const res = await getArtifacts({ page: p, perPage: s });
    const raw = res.data?.data;
    if (Array.isArray(raw)) {
      setArtifacts(raw);
      const respTotal = (res.data as any)?.total ?? raw.length;
      setTotal(respTotal);
    } else {
      setArtifacts([]);
      setTotal(0);
    }
  } catch (error: unknown) {
    setArtifacts([]);
    setTotal(0);
    message.error(`加载制品数据失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};

// loadStats:
const loadStats = async () => {
  try {
    const res = await getArtifactStats();
    setStats(res.data?.data || null);
  } catch (error: unknown) {
    setStats(null);
  }
};

// loadNamespaces:
const loadNamespaces = async () => {
  try {
    const res = await getNamespaces();
    setNamespaces(res.data?.data || []);
  } catch (error: unknown) {
    setNamespaces([]);
  }
};

// loadTags:
const loadTags = async (id: string) => {
  try {
    const res = await getArtifactTags(id);
    setTags(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setTags([]);
  }
};

// loadPromotionHistory:
const loadPromotionHistory = async (id: string) => {
  try {
    const res = await getPromotionHistory(id);
    setPromotionHistory(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setPromotionHistory([]);
  }
};

// loadDownloadHistory (was empty):
const loadDownloadHistory = async () => {
  // Placeholder for future download history API integration
};
```

**Cleanup:**
- Remove lines 56-227 (MOCK_ARTIFACTS, MOCK_PROMOTION_HISTORY, MOCK_TAGS, MOCK_STATS)
- Remove line 247 (usingMockData state)
- Remove lines 687-698 (mock warning Alert)

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/Artifacts/__tests__/index.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import ArtifactsPage from '../index';
import * as artifactsApi from '@/api/artifacts';

vi.mock('@/api/artifacts', () => ({
  getArtifacts: vi.fn(),
  getArtifactStats: vi.fn(),
  getNamespaces: vi.fn(),
}));

describe('ArtifactsPage', () => {
  it('loads artifacts from API on mount', async () => {
    vi.mocked(artifactsApi.getArtifacts).mockResolvedValue({ data: { data: [] } } as any);
    vi.mocked(artifactsApi.getArtifactStats).mockResolvedValue({ data: { data: {} } } as any);
    vi.mocked(artifactsApi.getNamespaces).mockResolvedValue({ data: { data: [] } } as any);

    render(<ArtifactsPage />);

    await waitFor(() => {
      expect(artifactsApi.getArtifacts).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(artifactsApi.getArtifacts).mockRejectedValue(new Error('Network error'));

    render(<ArtifactsPage />);

    await waitFor(() => {
      expect(screen.getByText(/加载制品数据失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/Artifacts/__tests__/index.test.tsx
git add src/pages/Artifacts/index.tsx src/pages/Artifacts/__tests__/index.test.tsx
git commit -m "fix(artifacts): remove all mock fallbacks, implement download history stub"
```

---

## Task 6: Environments page remove mock fallback

**File:** `/Users/heal/orion-design/orion-frontend/src/pages/Environments/index.tsx`

Replace `loadData` (lines 180-196):

```typescript
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getEnvironments();
    setEnvironments(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setEnvironments([]);
    message.error(`加载环境列表失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};
```

**Cleanup:**
- Remove lines 88-161 (MOCK_ENVIRONMENTS)
- Remove line 178 (usingMockData state)
- Remove lines 538-548 (mock warning Alert)

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/Environments/__tests__/index.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import EnvironmentsPage from '../index';
import * as envApi from '@/api/environments';

vi.mock('@/api/environments', () => ({
  getEnvironments: vi.fn(),
}));

describe('EnvironmentsPage', () => {
  it('loads environments from API on mount', async () => {
    vi.mocked(envApi.getEnvironments).mockResolvedValue({ data: { data: [] } } as any);

    render(<EnvironmentsPage />);

    await waitFor(() => {
      expect(envApi.getEnvironments).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(envApi.getEnvironments).mockRejectedValue(new Error('Network error'));

    render(<EnvironmentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/加载环境列表失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/Environments/__tests__/index.test.tsx
git add src/pages/Environments/index.tsx src/pages/Environments/__tests__/index.test.tsx
git commit -m "fix(environments): remove mock fallback, use real API with error handling"
```

---

## Task 7: InternalLibrary page remove mock fallback

**File:** `/Users/heal/orion-design/orion-frontend/src/pages/InternalLibrary/index.tsx`

Replace `loadData` and `openDetail`:

```typescript
// loadData:
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getInternalLibraries();
    setLibraries(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setLibraries([]);
    message.error(`加载二方库数据失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};

// openDetail:
const openDetail = async (lib: InternalLibrary) => {
  setSelectedLib(lib);
  setDetailDrawerVisible(true);
  setActiveTab('info');
  try {
    const [verRes, depRes] = await Promise.all([
      getVersions(lib.id),
      getDependents(lib.id),
    ]);
    setVersions(verRes?.data?.data || []);
    setDependents(depRes?.data?.data || []);
  } catch (error: unknown) {
    setVersions([]);
    setDependents([]);
  }
};
```

**Cleanup:**
- Remove lines 79-255 (MOCK_LIBRARIES, MOCK_DEPENDENTS)
- Remove line 280 (usingMockData state)
- Remove lines 656-667 (mock warning Alert)

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/InternalLibrary/__tests__/index.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import InternalLibraryPage from '../index';
import * as libApi from '@/api/internal-library';

vi.mock('@/api/internal-library', () => ({
  getInternalLibraries: vi.fn(),
  getVersions: vi.fn(),
  getDependents: vi.fn(),
}));

describe('InternalLibraryPage', () => {
  it('loads libraries from API on mount', async () => {
    vi.mocked(libApi.getInternalLibraries).mockResolvedValue({ data: { data: [] } } as any);

    render(<InternalLibraryPage />);

    await waitFor(() => {
      expect(libApi.getInternalLibraries).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(libApi.getInternalLibraries).mockRejectedValue(new Error('Network error'));

    render(<InternalLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText(/加载二方库数据失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/InternalLibrary/__tests__/index.test.tsx
git add src/pages/InternalLibrary/index.tsx src/pages/InternalLibrary/__tests__/index.test.tsx
git commit -m "fix(internal-library): remove mock fallbacks from library list and detail view"
```

---

## Task 8: MetricsDashboard page complete API integration

**File:** `/Users/heal/orion-design/orion-frontend/src/pages/MetricsDashboard/index.tsx`

Replace `loadData` (lines 168-231):

```typescript
const loadData = useCallback(async () => {
  setLoading(true);
  try {
    const [_healthRes, metricsRes, dashboardRes] = await Promise.all([
      getMonitoringHealth(),
      getMetrics(),
      getDashboardData(),
    ]);

    const metricsData = metricsRes.data.data || [];
    const dashboardData = dashboardRes.data.data;

    if (dashboardData) {
      setMetricSummary({
        requestRate: dashboardData.metrics?.rate ?? 0,
        errorRate: dashboardData.alerts?.total
          ? (dashboardData.alerts.active / dashboardData.alerts.total) * 100
          : 0,
        latencyP50: dashboardData.metrics?.latencyP50 ?? 0,
        latencyP95: dashboardData.metrics?.latencyP95 ?? 0,
        latencyP99: dashboardData.metrics?.latencyP99 ?? 0,
        throughput: dashboardData.metrics?.throughput ?? 0,
      });
    } else {
      setMetricSummary(null);
    }

    const healthRows: ServiceHealthRow[] = metricsData.map(
      (m: { name?: string; value?: number; unit?: string; lastUpdated?: string }, i: number) => ({
        key: `metric-${i}`,
        serviceName: m.name || `Service ${i + 1}`,
        status:
          m.value !== undefined && m.value > 0.9
            ? 'unhealthy'
            : m.value !== undefined && m.value > 0.5
              ? 'degraded'
              : 'healthy',
        requestRate: `${Math.round((m.value || 0) * 1000)}/min`,
        errorRate: `${(m.value || 0).toFixed(2)}%`,
        latency: `${Math.round((m.value || 0) * 100)}ms`,
      })
    );
    setServiceHealth(healthRows);
    setUsingMockData(false);
  } catch (error: unknown) {
    setMetricSummary(null);
    setServiceHealth([]);
    message.error(`加载指标数据失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
}, []);
```

Replace trend charts placeholder (lines 508-516):

```typescript
<Card title="Metric Trends" size="small" style={{ marginTop: spacing[4] }}>
  <div style={{ textAlign: 'center', padding: spacing[6] }}>
    <Text type="secondary">
      趋势图表区域 -- 待集成 ECharts 后展示历史趋势曲线
    </Text>
  </div>
</Card>
```

**Cleanup:**
- Remove lines 59-117 (MOCK_METRIC_SUMMARY, MOCK_SERVICE_HEALTH)
- Remove line 162 (usingMockData state) -- or keep but always set to false
- Remove lines 371-380 (mock warning Alert)

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/MetricsDashboard/__tests__/index.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import MetricsDashboard from '../index';
import * as monitoringApi from '@/api/monitoring';

vi.mock('@/api/monitoring', () => ({
  getMonitoringHealth: vi.fn(),
  getMetrics: vi.fn(),
  getDashboardData: vi.fn(),
}));

describe('MetricsDashboard', () => {
  it('loads metrics from API on mount', async () => {
    vi.mocked(monitoringApi.getMonitoringHealth).mockResolvedValue({ data: {} } as any);
    vi.mocked(monitoringApi.getMetrics).mockResolvedValue({ data: { data: [] } } as any);
    vi.mocked(monitoringApi.getDashboardData).mockResolvedValue({ data: { data: null } } as any);

    render(<MetricsDashboard />);

    await waitFor(() => {
      expect(monitoringApi.getDashboardData).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(monitoringApi.getDashboardData).mockRejectedValue(new Error('Network error'));

    render(<MetricsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/加载指标数据失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/MetricsDashboard/__tests__/index.test.tsx
git add src/pages/MetricsDashboard/index.tsx src/pages/MetricsDashboard/__tests__/index.test.tsx
git commit -m "fix(metrics-dashboard): remove mock fallbacks, add API integration for all metric sources"
```

---

## Task 9: OnCall page remove mock + wire overrides

**File:** `/Users/heal/orion-design/orion-frontend/src/pages/OnCall/index.tsx`

Replace `loadData`, `loadCurrentOnCall`, and `getAssignmentsForSchedule`:

```typescript
// loadData:
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getSchedules();
    const data = res.data?.data?.schedules;
    setSchedules(Array.isArray(data) && data.length > 0 ? data : []);
  } catch (error: unknown) {
    setSchedules([]);
    message.error(`加载值班排班失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};

// loadCurrentOnCall:
const loadCurrentOnCall = async (scheduleId: string) => {
  try {
    const res = await getCurrentOnCall(scheduleId);
    const result = res.data?.data;
    if (result) {
      setCurrentOnCall((prev) => ({ ...prev, [scheduleId]: result }));
    } else {
      setCurrentOnCall((prev) => ({
        ...prev,
        [scheduleId]: { isOnCall: false },
      }));
    }
  } catch (error: unknown) {
    setCurrentOnCall((prev) => ({
      ...prev,
      [scheduleId]: { isOnCall: false },
    }));
  }
};

// getAssignmentsForSchedule:
const getAssignmentsForSchedule = (_scheduleId: string): OnCallAssignment[] => {
  return [];
};
```

**Cleanup:**
- Remove lines 107-204 (MOCK_ESCALATIONS, MOCK_SCHEDULES, MOCK_ASSIGNMENTS, MOCK_CURRENT_ONCALL)
- Remove line 235 (usingMockData state)
- Remove lines 774-784 (mock warning Alert)

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/OnCall/__tests__/index.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import OnCallPage from '../index';
import * as oncallApi from '@/api/oncall';

vi.mock('@/api/oncall', () => ({
  getSchedules: vi.fn(),
  getCurrentOnCall: vi.fn(),
}));

describe('OnCallPage', () => {
  it('loads schedules from API on mount', async () => {
    vi.mocked(oncallApi.getSchedules).mockResolvedValue({ data: { data: { schedules: [] } } } as any);
    vi.mocked(oncallApi.getCurrentOnCall).mockResolvedValue({ data: { data: null } } as any);

    render(<OnCallPage />);

    await waitFor(() => {
      expect(oncallApi.getSchedules).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(oncallApi.getSchedules).mockRejectedValue(new Error('Network error'));

    render(<OnCallPage />);

    await waitFor(() => {
      expect(screen.getByText(/加载值班排班失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/OnCall/__tests__/index.test.tsx
git add src/pages/OnCall/index.tsx src/pages/OnCall/__tests__/index.test.tsx
git commit -m "fix(oncall): remove mock schedules, wire real API with error handling"
```

---

## Task 10: ProductLine page remove mock fallback

**File:** `/Users/heal/orion-design/orion-frontend/src/pages/ProductLine/index.tsx`

Replace `loadData` and `openDetail`:

```typescript
// loadData:
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getProductLines();
    setProductLines(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setProductLines([]);
    message.error(`加载产品线数据失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};

// openDetail:
const openDetail = async (pl: ProductLine) => {
  setSelectedPL(pl);
  setDetailDrawerVisible(true);
  try {
    const [rtRes, hfRes] = await Promise.all([
      getReleaseTrains(pl.id),
      getHotfixChannels(pl.id),
    ]);
    setReleaseTrains(rtRes?.data?.data || []);
    setHotfixChannels(hfRes?.data?.data || []);
  } catch (error: unknown) {
    setReleaseTrains([]);
    setHotfixChannels([]);
  }
};
```

**Cleanup:**
- Remove lines 113-280 (MOCK_PRODUCT_LINES, MOCK_RELEASE_TRAINS, MOCK_HOTFIX_CHANNELS)
- Remove line 428 (usingMockData state)
- Remove lines 1122-1133 (mock warning Alert)

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/ProductLine/__tests__/index.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import ProductLinePage from '../index';
import * as plApi from '@/api/product-lines';

vi.mock('@/api/product-lines', () => ({
  getProductLines: vi.fn(),
  getReleaseTrains: vi.fn(),
  getHotfixChannels: vi.fn(),
}));

describe('ProductLinePage', () => {
  it('loads product lines from API on mount', async () => {
    vi.mocked(plApi.getProductLines).mockResolvedValue({ data: { data: [] } } as any);

    render(<ProductLinePage />);

    await waitFor(() => {
      expect(plApi.getProductLines).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(plApi.getProductLines).mockRejectedValue(new Error('Network error'));

    render(<ProductLinePage />);

    await waitFor(() => {
      expect(screen.getByText(/加载产品线数据失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/ProductLine/__tests__/index.test.tsx
git add src/pages/ProductLine/index.tsx src/pages/ProductLine/__tests__/index.test.tsx
git commit -m "fix(product-line): remove mock fallback from list and detail views"
```

---

## Task 11: Projects page remove mock fallback

**File:** `/Users/heal/orion-design/orion-frontend/src/pages/Projects/index.tsx`

Replace `loadData` and `loadResources`:

```typescript
// loadData:
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getProjects({ tenantId: 'tenant-1' });
    const data = res.data?.data;
    if (Array.isArray(data)) {
      setProjects(data);
    } else if (Array.isArray(data?.data)) {
      setProjects(data.data);
    } else {
      setProjects([]);
    }
  } catch (error: unknown) {
    setProjects([]);
    message.error(`加载项目数据失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};

// loadResources:
const loadResources = async (projectId: string) => {
  try {
    const res = await getProjectResources(projectId);
    setProjectResources(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setProjectResources([]);
  }
};
```

**Cleanup:**
- Remove lines 83-211 (MOCK_PROJECTS, MOCK_RESOURCES)
- Remove line 229 (usingMockData state)
- Remove lines 620-631 (mock warning Alert)

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/Projects/__tests__/index.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import ProjectsPage from '../index';
import * as projectsApi from '@/api/projects';

vi.mock('@/api/projects', () => ({
  getProjects: vi.fn(),
  getProjectResources: vi.fn(),
}));

describe('ProjectsPage', () => {
  it('loads projects from API on mount', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue({ data: { data: [] } } as any);

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(projectsApi.getProjects).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(projectsApi.getProjects).mockRejectedValue(new Error('Network error'));

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText(/加载项目数据失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/Projects/__tests__/index.test.tsx
git add src/pages/Projects/index.tsx src/pages/Projects/__tests__/index.test.tsx
git commit -m "fix(projects): remove mock fallback, connect real project API"
```

---

## Task 12: Queue page remove mock fallback

**File:** `/Users/heal/orion-design/orion-frontend/src/pages/Queue/index.tsx`

Replace `loadData` and `loadStats`:

```typescript
// loadData:
const loadData = async () => {
  setLoading(true);
  try {
    const params: { status?: JobStatus; queue?: string } = {};
    if (statusFilter !== 'all') params.status = statusFilter as JobStatus;
    if (queueFilter !== 'all') params.queue = queueFilter;
    const res = await listJobs(params);
    const jobsData = res.data?.data?.jobs;
    setJobs(Array.isArray(jobsData) ? jobsData : []);
  } catch (error: unknown) {
    setJobs([]);
    message.error(`加载任务数据失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};

// loadStats:
const loadStats = async () => {
  try {
    const res = await getQueueStats();
    setStats(res.data?.data || null);
  } catch (error: unknown) {
    setStats(null);
  }
};
```

**Cleanup:**
- Remove lines 82-162 (MOCK_STATS, MOCK_JOBS)
- Remove line 183 (usingMockData state)
- Remove lines 485-495 (mock warning Alert)

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/Queue/__tests__/index.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import QueuePage from '../index';
import * as queueApi from '@/api/queue';

vi.mock('@/api/queue', () => ({
  listJobs: vi.fn(),
  getQueueStats: vi.fn(),
}));

describe('QueuePage', () => {
  it('loads jobs from API on mount', async () => {
    vi.mocked(queueApi.listJobs).mockResolvedValue({ data: { data: { jobs: [] } } } as any);
    vi.mocked(queueApi.getQueueStats).mockResolvedValue({ data: { data: {} } } as any);

    render(<QueuePage />);

    await waitFor(() => {
      expect(queueApi.listJobs).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(queueApi.listJobs).mockRejectedValue(new Error('Network error'));

    render(<QueuePage />);

    await waitFor(() => {
      expect(screen.getByText(/加载任务数据失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/Queue/__tests__/index.test.tsx
git add src/pages/Queue/index.tsx src/pages/Queue/__tests__/index.test.tsx
git commit -m "fix(queue): remove mock fallback, wire real job listing API"
```

---

## Task 13: VectorStore page remove mock fallback + delete constants.ts

**File:** `/Users/heal/orion-design/orion-frontend/src/pages/VectorStore/index.tsx`

Replace imports and functions:

```typescript
// Remove: import { MOCK_COLLECTIONS, MOCK_DOCUMENTS, MOCK_SEARCH_RESULTS, MOCK_STATS } from './constants';
// Keep only utility maps from constants.ts (or inline them).

import type { VectorCollection, VectorDocument, SearchHit, VectorStats } from '@/api/vector-store';
import {
  getCollections, deleteCollection, getCollectionDocuments,
  addDocument, deleteDocument, searchVectors, getVectorStats,
} from '@/api/vector-store';

// loadData:
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getCollections();
    setCollections(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setCollections([]);
    message.error(`加载集合数据失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};

// loadStats:
const loadStats = async () => {
  try {
    const res = await getVectorStats();
    setStats(res.data?.data || null);
  } catch (error: unknown) {
    setStats(null);
  }
};

// loadCollectionDocs:
const loadCollectionDocs = async (name: string) => {
  setDocsLoading(true);
  try {
    const res = await getCollectionDocuments(name);
    setCollectionDocs(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setCollectionDocs([]);
    message.error(`加载文档列表失败: ${(error as Error).message}`);
  } finally {
    setDocsLoading(false);
  }
};

// handleSearch:
const handleSearch = async () => {
  if (!searchText.trim()) { message.warning('请输入搜索内容'); return; }
  setSearchLoading(true);
  try {
    const res = await searchVectors({
      query: searchText, collection: searchCollection, topK: searchTopK,
    });
    setSearchResults(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setSearchResults([]);
    message.error(`语义搜索失败: ${(error as Error).message}`);
  } finally {
    setSearchLoading(false);
  }
};
```

**Cleanup:**
- Remove line 42 (MOCK_* imports)
- Remove line 62 (usingMockData state)
- Remove lines 291-302 (mock warning Alert)

**Delete:** `/Users/heal/orion-design/orion-frontend/src/pages/VectorStore/constants.ts`

Before deleting, check if other files import from it. If only the mock data is in constants.ts and the color/status maps are also there, extract only the utility maps into the components that need them, then delete the file.

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/VectorStore/__tests__/index.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import VectorStorePage from '../index';
import * as vsApi from '@/api/vector-store';

vi.mock('@/api/vector-store', () => ({
  getCollections: vi.fn(),
  getVectorStats: vi.fn(),
  getCollectionDocuments: vi.fn(),
  searchVectors: vi.fn(),
}));

describe('VectorStorePage', () => {
  it('loads collections from API on mount', async () => {
    vi.mocked(vsApi.getCollections).mockResolvedValue({ data: { data: [] } } as any);
    vi.mocked(vsApi.getVectorStats).mockResolvedValue({ data: { data: {} } } as any);

    render(<VectorStorePage />);

    await waitFor(() => {
      expect(vsApi.getCollections).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(vsApi.getCollections).mockRejectedValue(new Error('Network error'));

    render(<VectorStorePage />);

    await waitFor(() => {
      expect(screen.getByText(/加载集合数据失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/VectorStore/__tests__/index.test.tsx
git add src/pages/VectorStore/index.tsx src/pages/VectorStore/__tests__/index.test.tsx
git rm src/pages/VectorStore/constants.ts
git commit -m "fix(vector-store): remove mock fallbacks and delete constants.ts mock file"
```

---

## Task 14: AICostDashboard sub-pages mock fallback removal (5 files)

### 14a. CostOverview (`src/pages/AICostDashboard/CostOverview.tsx`)

Replace `loadData` (lines 34-78):

```typescript
const loadData = async () => {
  setLoading(true);
  try {
    const [dashRes, pricingRes] = await Promise.all([getDashboardData(), getModelPricing()]);
    setDashboard(dashRes.data.data as DashboardData | null);
    setPricing(Array.isArray(pricingRes.data.data) ? pricingRes.data.data : []);
  } catch (error: unknown) {
    setDashboard(null);
    setPricing([]);
    message.error(`加载成本数据失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};
```

**Cleanup:** Remove entire mock data block in catch (lines 42-74).

### 14b. CostDetail (`src/pages/AICostDashboard/CostDetail.tsx`)

Read file to confirm mock pattern, then apply same migration:
- Replace catch block mock fallback with `setDashboard(null)` + `message.error(...)`
- Ensure all data-fetching functions follow the pattern

### 14c. BudgetManagement (`src/pages/AICostDashboard/BudgetManagement.tsx`)

Replace `loadData` (lines 71-122):

```typescript
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getBudgets();
    setBudgets(Array.isArray(res.data.data) ? res.data.data : []);
  } catch (error: unknown) {
    setBudgets([]);
    message.error(`加载预算数据失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};
```

Add `deleteBudget` to `/Users/heal/orion-design/orion-frontend/src/api/ai-cost.ts`:

```typescript
export async function deleteBudget(id: string) {
  return api.delete<void>(`/v1/ai-cost/budgets/${id}`);
}
```

Replace delete handler (line 302):

```typescript
import { deleteBudget } from '@/api/ai-cost';

const handleDelete = async (id: string) => {
  try {
    await deleteBudget(id);
    message.success('预算已删除');
    loadData();
  } catch (error: unknown) {
    message.error(`删除失败: ${(error as Error).message}`);
  }
};
```

**Cleanup:** Remove lines 78-115 (mock budget data in catch).

### 14d. ROIReport (`src/pages/AICostDashboard/ROIReport.tsx`)

Replace `loadData` (lines 47-92):

```typescript
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getROIReport({ period });
    const data = res.data.data as { features?: ROIFeatureData[]; suggestions?: ROISuggestion[] };
    setRoiData(Array.isArray(data?.features) ? data.features : []);
    setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
  } catch (error: unknown) {
    setRoiData([]);
    setSuggestions([]);
    message.error(`加载ROI数据失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};
```

**Cleanup:** Remove lines 56-88 (mock data in catch).

### 14e. AlertConfig (`src/pages/AICostDashboard/AlertConfig.tsx`)

Replace `loadAlerts` (lines 86-119):

```typescript
const loadAlerts = async () => {
  setLoading(true);
  try {
    const res = await getAlerts();
    setAlerts(Array.isArray(res.data.data) ? res.data.data : []);
  } catch (error: unknown) {
    setAlerts([]);
    message.error(`加载告警数据失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};
```

For alert rule CRUD (`rules` state, lines 50-81): Keep rules in local state with comment:
```typescript
// TODO: Alert rule CRUD requires backend API support
```

**Cleanup:** Remove lines 93-112 (mock alerts in catch).

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/AICostDashboard/__tests__/CostOverview.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import CostOverview from '../CostOverview';
import * as aiCostApi from '@/api/ai-cost';

vi.mock('@/api/ai-cost', () => ({
  getDashboardData: vi.fn(),
  getModelPricing: vi.fn(),
  getBudgets: vi.fn(),
  getROIReport: vi.fn(),
  getAlerts: vi.fn(),
}));

describe('CostOverview', () => {
  it('loads dashboard data from API on mount', async () => {
    vi.mocked(aiCostApi.getDashboardData).mockResolvedValue({ data: { data: null } } as any);
    vi.mocked(aiCostApi.getModelPricing).mockResolvedValue({ data: { data: [] } } as any);

    render(<CostOverview />);

    await waitFor(() => {
      expect(aiCostApi.getDashboardData).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(aiCostApi.getDashboardData).mockRejectedValue(new Error('Network error'));

    render(<CostOverview />);

    await waitFor(() => {
      expect(screen.getByText(/加载成本数据失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/AICostDashboard/__tests__/CostOverview.test.tsx
git add src/api/ai-cost.ts src/pages/AICostDashboard/CostOverview.tsx src/pages/AICostDashboard/CostDetail.tsx src/pages/AICostDashboard/BudgetManagement.tsx src/pages/AICostDashboard/ROIReport.tsx src/pages/AICostDashboard/AlertConfig.tsx src/pages/AICostDashboard/__tests__/CostOverview.test.tsx
git commit -m "fix(ai-cost-dashboard): remove mock fallbacks from all 5 sub-pages, add deleteBudget API"
```

---

## Task 15: AIDocManagement sub-pages mock fallback removal (3 files)

### 15a. SpaceList (`src/pages/AIDocManagement/SpaceList.tsx`)

Replace `loadData` (lines 62-105):

```typescript
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getSpaces();
    setSpaces(Array.isArray(res.data.data) ? res.data.data : []);
  } catch (error: unknown) {
    setSpaces([]);
    message.error(`加载知识库数据失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};
```

**Cleanup:** Remove lines 69-101 (mock spaces in catch).

### 15b. DocumentList (`src/pages/AIDocManagement/DocumentList.tsx`)

Read file to confirm mock pattern, then apply:
- Replace catch block mock fallback with `setDocuments([])` + `message.error(...)`
- Verify no MOCK_* constants remain

### 15c. RAGQuery (`src/pages/AIDocManagement/RAGQuery.tsx`)

Read file to confirm mock pattern, then apply:
- Replace catch block mock fallback with appropriate empty state + `message.error(...)`
- Verify no MOCK_* constants remain

**Test:** `/Users/heal/orion-design/orion-frontend/src/pages/AIDocManagement/__tests__/SpaceList.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import SpaceList from '../SpaceList';
import * as docApi from '@/api/ai-doc-management';

vi.mock('@/api/ai-doc-management', () => ({
  getSpaces: vi.fn(),
}));

describe('SpaceList', () => {
  it('loads spaces from API on mount', async () => {
    vi.mocked(docApi.getSpaces).mockResolvedValue({ data: { data: [] } } as any);

    render(<SpaceList />);

    await waitFor(() => {
      expect(docApi.getSpaces).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(docApi.getSpaces).mockRejectedValue(new Error('Network error'));

    render(<SpaceList />);

    await waitFor(() => {
      expect(screen.getByText(/加载知识库数据失败/)).toBeInTheDocument();
    });
  });
});
```

**Commands:**
```bash
cd /Users/heal/orion-design/orion-frontend
npx vitest run src/pages/AIDocManagement/__tests__/SpaceList.test.tsx
git add src/pages/AIDocManagement/SpaceList.tsx src/pages/AIDocManagement/DocumentList.tsx src/pages/AIDocManagement/RAGQuery.tsx src/pages/AIDocManagement/__tests__/SpaceList.test.tsx
git commit -m "fix(ai-doc-management): remove mock fallbacks from SpaceList, DocumentList, and RAGQuery"
```

---

## Final Verification

After all tasks are complete, run:

```bash
cd /Users/heal/orion-design/orion-frontend
# Full test suite
npx vitest run --coverage

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Grep to confirm no MOCK_ patterns remain in page files
grep -rn "MOCK_" src/pages/ --include="*.tsx" || echo "No mock data remaining"
grep -rn "usingMockData" src/pages/ --include="*.tsx" || echo "No usingMockData remaining"
```

Create a PR commit:

```bash
git log --oneline -20
git push origin feat/frontend-gap-implementation
```

---

## Task Summary

| # | Task | Files | Commit Message |
|---|------|-------|---------------|
| 1 | Backup download URL | `src/api/backup.ts`, `src/pages/Backup/index.tsx` | fix(backup): implement real download URL API |
| 2 | EventBus mock → API | `src/pages/EventBus/index.tsx` | fix(eventbus): migrate from mock data to real API |
| 3 | Sessions mock → API | `src/pages/Sessions/index.tsx` | fix(sessions): migrate to session API with type mapping |
| 4 | Approvals remove mock | `src/pages/Approvals/index.tsx` | fix(approvals): remove mock fallback |
| 5 | Artifacts remove mock | `src/pages/Artifacts/index.tsx` | fix(artifacts): remove mock fallbacks |
| 6 | Environments remove mock | `src/pages/Environments/index.tsx` | fix(environments): remove mock fallback |
| 7 | InternalLibrary remove mock | `src/pages/InternalLibrary/index.tsx` | fix(internal-library): remove mock fallbacks |
| 8 | MetricsDashboard API | `src/pages/MetricsDashboard/index.tsx` | fix(metrics-dashboard): remove mock fallbacks |
| 9 | OnCall remove mock | `src/pages/OnCall/index.tsx` | fix(oncall): remove mock schedules |
| 10 | ProductLine remove mock | `src/pages/ProductLine/index.tsx` | fix(product-line): remove mock fallback |
| 11 | Projects remove mock | `src/pages/Projects/index.tsx` | fix(projects): remove mock fallback |
| 12 | Queue remove mock | `src/pages/Queue/index.tsx` | fix(queue): remove mock fallback |
| 13 | VectorStore remove mock + delete constants | `src/pages/VectorStore/index.tsx`, delete `constants.ts` | fix(vector-store): remove mock fallbacks |
| 14 | AICostDashboard 5 sub-pages | 5 files + `src/api/ai-cost.ts` | fix(ai-cost-dashboard): remove mock fallbacks |
| 15 | AIDocManagement 3 sub-pages | 3 files | fix(ai-doc-management): remove mock fallbacks |
