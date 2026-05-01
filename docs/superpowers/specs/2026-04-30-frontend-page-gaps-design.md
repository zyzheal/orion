# Frontend Page Gaps Design

**Date:** 2026-04-30
**Status:** Draft
**Branch:** `feat/frontend-gap-implementation`

## Overview

This document catalogs every frontend page that uses mock data instead of real API calls, categorizes them by severity, and provides implementation-level migration patterns so developers can code directly from this document without guessing.

The Orion frontend (`orion-frontend`) has 57+ pages across React + Vite + Ant Design. The majority are already API-connected, but **20 pages** still have mock data fallbacks of varying degrees. The goal is to remove all mock data, replace with proper API integration, and ensure graceful error handling.

**Key principle:** After migration, when an API fails the user sees an error message and an empty/error state -- never stale mock data.

---

## Current State

### Severity 1: Fully Mock Pages (API clients exist but not connected)

These pages never attempt API calls -- they directly set mock data on mount.

| Page | File | API Client | Issue |
|------|------|------------|-------|
| EventBus | `src/pages/EventBus/index.tsx` | `src/api/eventbus.ts` | `loadData()` calls `usingMockData(true)` and sets `MOCK_EVENTS`/`MOCK_STATS` directly. No API calls attempted. `usingMockData` state on line 224. |
| Sessions | `src/pages/Sessions/index.tsx` | `src/api/session.ts` | Comment on line 235 says "No session API client exists yet" but `session.ts` exists with `getSessions`, `getSession`, `deleteSession`, `getSessionStats` -- all functional. |

### Severity 2: API Connected but Mock Fallback (10 pages)

These pages attempt API calls but fall back to `MOCK_*` constants in catch blocks.

| Page | File | API Client | Mock Fallback |
|------|------|------------|---------------|
| Approvals | `src/pages/Approvals/index.tsx` | `src/api/approvals.ts` | Falls back to `MOCK_APPROVALS` (line 190) on API error. |
| Artifacts | `src/pages/Artifacts/index.tsx` | `src/api/artifacts.ts` | Falls back to `MOCK_ARTIFACTS` (line 301), `MOCK_STATS` (line 312), `MOCK_TAGS` (line 578), `MOCK_PROMOTION_HISTORY` (line 590). `loadDownloadHistory` is empty (line 595-597). |
| Environments | `src/pages/Environments/index.tsx` | `src/api/environments.ts` | Falls back to `MOCK_ENVIRONMENTS` (line 187) on API error. |
| InternalLibrary | `src/pages/InternalLibrary/index.tsx` | `src/api/internal-library.ts` | Falls back to `MOCK_LIBRARIES` (line 300), `MOCK_DEPENDENTS` (line 572). |
| MetricsDashboard | `src/pages/MetricsDashboard/index.tsx` | `src/api/monitoring.ts` | Uses `MOCK_METRIC_SUMMARY` (line 184-195, 224), `MOCK_SERVICE_HEALTH` (line 214, 225). Trend charts are placeholder text (line 510-515). |
| OnCall | `src/pages/OnCall/index.tsx` | `src/api/oncall.ts` | `MOCK_SCHEDULES` (line 276), `MOCK_CURRENT_ONCALL` (line 299-307), `MOCK_ASSIGNMENTS` hardcoded in `getAssignmentsForSchedule` (line 432), `MOCK_ESCALATIONS` embedded in mock schedules. Overrides state is always empty array (line 230). |
| ProductLine | `src/pages/ProductLine/index.tsx` | `src/api/product-lines.ts` | Falls back to `MOCK_PRODUCT_LINES` (line 437), `MOCK_RELEASE_TRAINS` (line 630), `MOCK_HOTFIX_CHANNELS` (line 632). |
| Projects | `src/pages/Projects/index.tsx` | `src/api/projects.ts` | Falls back to `MOCK_PROJECTS` (line 242-246), `MOCK_RESOURCES` (line 393). |
| Queue | `src/pages/Queue/index.tsx` | `src/api/queue.ts` | Falls back to `MOCK_JOBS` (line 199), `MOCK_STATS` (line 221). |
| VectorStore | `src/pages/VectorStore/index.tsx` | `src/api/vector-store.ts` | Falls back to `MOCK_COLLECTIONS` (line 81, 95), `MOCK_STATS` (line 104), `MOCK_DOCUMENTS` (line 163, 170), `MOCK_SEARCH_RESULTS` (line 202, 209). |

### Severity 3: Sub-page Mock Fallback (8 sub-pages)

Sub-pages within dashboard containers that use `Math.random()` or hardcoded mock data on API failure.

**AICostDashboard (5 sub-pages):**

| Sub-page | File | Mock Pattern |
|----------|------|-------------|
| CostOverview | `src/pages/AICostDashboard/CostOverview.tsx` | catch block sets mock data with `Math.random()` for `dailyTrend` (line 47), hardcoded `topTenants`/`topUsers`/`modelDistribution` (lines 54-68). |
| CostDetail | `src/pages/AICostDashboard/CostDetail.tsx` | API client exists (`src/api/ai-cost.ts`), catch fallback not verified -- check for mock patterns. |
| BudgetManagement | `src/pages/AICostDashboard/BudgetManagement.tsx` | catch block sets hardcoded mock budgets (lines 78-115). Delete action shows `message.info('删除功能待后端支持')` (line 302). |
| ROIReport | `src/pages/AICostDashboard/ROIReport.tsx` | catch block sets hardcoded `roiData` (lines 56-62) and `suggestions` (lines 63-85). |
| AlertConfig | `src/pages/AICostDashboard/AlertConfig.tsx` | catch block sets hardcoded mock `alerts` (lines 93-112). Alert rules stored in local state (line 50-81) -- no API for CRUD. |

**AIDocManagement (3 sub-pages):**

| Sub-page | File | Mock Pattern |
|----------|------|-------------|
| SpaceList | `src/pages/AIDocManagement/SpaceList.tsx` | catch block sets hardcoded mock spaces (lines 69-101). |
| DocumentList | `src/pages/AIDocManagement/DocumentList.tsx` | Check for mock fallback patterns. |
| RAGQuery | `src/pages/AIDocManagement/RAGQuery.tsx` | Check for mock fallback patterns. |

### Severity 4: TODO Items

| Page | File | Line | Issue |
|------|------|------|-------|
| Backup | `src/pages/Backup/index.tsx` | 288 | `handleDownload` only shows `message.info`, no real URL generation or blob download |

---

## Implementation Design

### Pattern: Mock-to-API Migration

Every page follows this unified migration pattern:

```
BEFORE (mock fallback):
  catch (error) {
    setUsingMockData(true);
    setData(MOCK_DATA);
    message.error(...);
  }

AFTER (no mock fallback):
  catch (error: unknown) {
    setData([]);  // or appropriate empty state
    message.error(`Failed to load ...: ${error.message}`);
  }
```

**Steps for every page:**

1. Remove `MOCK_*` constant imports and definitions (delete the entire mock data block)
2. Remove `usingMockData` state and its setter (if present)
3. Remove the warning `<Alert>` banner that displays when `usingMockData` is true
4. Replace mock fallback in catch blocks with `setData([])` or appropriate empty/error state
5. Add `message.error(...)` with user-friendly error messages
6. Ensure loading states work correctly during API calls
7. Ensure empty states display when data is `[]`

---

### Per-Page Implementation: Severity 1

#### 1. EventBus (`src/pages/EventBus/index.tsx`)

**Current state (lines 226-245):**
```typescript
const loadData = async () => {
  setLoading(true);
  try {
    // Attempt to fetch from API -- no eventbus API client exists yet
    setUsingMockData(true);
    setEvents(MOCK_EVENTS);
    setStats(MOCK_STATS);
  } catch (error: unknown) {
    setUsingMockData(true);
    // ...
    setEvents(MOCK_EVENTS);
    setStats(MOCK_STATS);
  } finally {
    setLoading(false);
  }
};
```

**API client available (`src/api/eventbus.ts`):**
- `getEvents(options?)` -- returns `{ events: EventBusEvent[] }`
- `getStats()` -- returns `{ stats: Record<string, number> }`

**Migration:**

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
  subscriberCount: 0, // API does not return subscriber count per event; use 0 or fetch from subscriptions
  topic: apiEvent.subject,
  traceId: apiEvent.id.substring(0, 12), // No traceId in API; derive from id
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

**Filter dropdown update:** The `EVENT_TYPES` constant is currently derived from `MOCK_EVENTS`. After migration, derive it from loaded data:

```typescript
// Replace:
const EVENT_TYPES = Array.from(new Set(MOCK_EVENTS.map((e) => e.eventType))).sort();

// With (computed inside component):
const eventTypes = useMemo(() =>
  Array.from(new Set(events.map((e) => e.eventType))).sort(),
  [events]
);
// Then use eventTypes in the Select options.
```

**Cleanup:**
- Remove lines 88-208 (MOCK_STATS, MOCK_EVENTS definitions)
- Remove line 211 (EVENT_TYPES derived from mock)
- Remove line 224 (`usingMockData` state)
- Remove lines 230, 234 (`setUsingMockData(true)`)
- Remove lines 398-409 (mock warning Alert banner)

#### 2. Sessions (`src/pages/Sessions/index.tsx`)

**Current state (lines 232-246):**
```typescript
const loadData = async () => {
  setLoading(true);
  try {
    // No session API client exists yet -- use mock data
    setUsingMockData(true);
    setSessions(MOCK_SESSIONS);
    setStats(MOCK_STATS);
  } catch (error: unknown) {
    setUsingMockData(true);
    setSessions(MOCK_SESSIONS);
    setStats(MOCK_STATS);
  } finally {
    setLoading(false);
  }
};
```

**API client available (`src/api/session.ts`):**
- `getSessions(tenantId?)` -- returns `{ sessions: Session[] }`
- `getSessionStats()` -- returns `{ stats: SessionStats }`
- `deleteSession(id)` -- returns `void` (for revoke)

**Note on type mismatch:** The API `Session` type has fields `{ id, userId, token, expiresAt, createdAt, lastAccessedAt, userAgent?, ipAddress? }` but the UI type expects `{ id, userId, sessionId, ipAddress, userAgent, startedAt, lastActive, status, duration }`. A mapping function is needed.

```typescript
import { getSessions, getSessionStats, deleteSession as apiDeleteSession } from '@/api/session';
import type { Session as ApiSession, SessionStats as ApiSessionStats } from '@/api/session';

// Derive session status from API data
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
  avgDuration: 0, // API does not return avgDuration; calculate from sessions or omit
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
```

**Revoke handler update (line 273-290):**
```typescript
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

**Cleanup:**
- Remove lines 88-208 (MOCK_STATS, MOCK_SESSIONS)
- Remove line 230 (`usingMockData` state)
- Remove lines 236-238, 240-242 (`setUsingMockData`, mock data assignments)
- Remove lines 428-438 (mock warning Alert)

---

### Per-Page Implementation: Severity 2

#### 3. Approvals (`src/pages/Approvals/index.tsx`)

**Change (lines 182-199):**
```typescript
// BEFORE:
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getApprovals();
    const list = res.data?.data?.approvals;
    setApprovals(Array.isArray(list) ? list : []);
  } catch (error: unknown) {
    setUsingMockData(true);
    setApprovals(MOCK_APPROVALS);
    message.error(...);
  } finally { setLoading(false); }
};

// AFTER:
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getApprovals();
    const list = res.data?.data?.approvals;
    setApprovals(Array.isArray(list) ? list : []);
  } catch (error: unknown) {
    setApprovals([]);
    message.error(`加载审批数据失败: ${(error as Error).message}`);
  } finally { setLoading(false); }
};
```

**Cleanup:**
- Remove lines 75-158 (`MOCK_APPROVALS`)
- Remove line 173 (`usingMockData` state)
- Remove lines 704-715 (mock warning Alert)

#### 4. Artifacts (`src/pages/Artifacts/index.tsx`)

**Changes:**

```typescript
// loadData (lines 269-306):
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
  } finally { setLoading(false); }
};

// loadStats (lines 308-316):
const loadStats = async () => {
  try {
    const res = await getArtifactStats();
    setStats(res.data?.data || null);
  } catch (error: unknown) {
    setStats(null);
  }
};

// loadNamespaces (lines 318-326):
const loadNamespaces = async () => {
  try {
    const res = await getNamespaces();
    setNamespaces(res.data?.data || []);
  } catch (error: unknown) {
    setNamespaces([]);
  }
};

// loadTags (lines 571-580):
const loadTags = async (id: string) => {
  try {
    const res = await getArtifactTags(id);
    setTags(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setTags([]);
  }
};

// loadPromotionHistory (lines 582-593):
const loadPromotionHistory = async (id: string) => {
  try {
    const res = await getPromotionHistory(id);
    setPromotionHistory(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setPromotionHistory([]);
  }
};

// loadDownloadHistory (lines 595-597) -- IMPLEMENT:
const loadDownloadHistory = async () => {
  // If backend has a download history endpoint, call it here.
  // For now, leave as empty but remove the comment.
  // Future: const res = await getDownloadHistory(artifactId); setDownloadHistory(res.data?.data || []);
};
```

**Cleanup:**
- Remove lines 56-227 (`MOCK_ARTIFACTS`, `MOCK_PROMOTION_HISTORY`, `MOCK_TAGS`, `MOCK_STATS`)
- Remove line 247 (`usingMockData` state)
- Remove lines 687-698 (mock warning Alert)

#### 5. Environments (`src/pages/Environments/index.tsx`)

**Change (lines 180-196):**
```typescript
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getEnvironments();
    setEnvironments(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setEnvironments([]);
    message.error(`加载环境列表失败: ${(error as Error).message}`);
  } finally { setLoading(false); }
};
```

**Cleanup:**
- Remove lines 88-161 (`MOCK_ENVIRONMENTS`)
- Remove line 178 (`usingMockData` state)
- Remove lines 538-548 (mock warning Alert)

#### 6. InternalLibrary (`src/pages/InternalLibrary/index.tsx`)

**Changes:**

```typescript
// loadData (lines 282-304):
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getInternalLibraries();
    setLibraries(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setLibraries([]);
    message.error(`加载二方库数据失败: ${(error as Error).message}`);
  } finally { setLoading(false); }
};

// openDetail (lines 557-577):
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
- Remove lines 79-255 (`MOCK_LIBRARIES`, `MOCK_DEPENDENTS`)
- Remove line 280 (`usingMockData` state)
- Remove lines 656-667 (mock warning Alert)

#### 7. MetricsDashboard (`src/pages/MetricsDashboard/index.tsx`)

This page has partial API integration but falls back to mock data. The trend charts area is a placeholder.

**Change (lines 168-231):**
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

**Trend charts placeholder (lines 508-516):** Replace with a note indicating ECharts integration is a future enhancement:
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
- Remove lines 59-117 (`MOCK_METRIC_SUMMARY`, `MOCK_SERVICE_HEALTH`)
- Remove line 162 (`usingMockData` state) -- keep the variable but set to `false` always, or remove if no longer needed
- Remove lines 371-380 (mock warning Alert)

#### 8. OnCall (`src/pages/OnCall/index.tsx`)

**Changes:**

```typescript
// loadData (lines 271-288):
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getSchedules();
    const data = res.data?.data?.schedules;
    setSchedules(Array.isArray(data) && data.length > 0 ? data : []);
  } catch (error: unknown) {
    setSchedules([]);
    message.error(`加载值班排班失败: ${(error as Error).message}`);
  } finally { setLoading(false); }
};

// loadCurrentOnCall (lines 290-309):
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
```

**`getAssignmentsForSchedule` (line 431-433):** Currently returns from `MOCK_ASSIGNMENTS`. Remove or replace:
```typescript
// BEFORE:
const getAssignmentsForSchedule = (scheduleId: string): OnCallAssignment[] => {
  return MOCK_ASSIGNMENTS.filter((a) => a.scheduleId === scheduleId);
};

// AFTER: If no assignment API exists, return empty array:
const getAssignmentsForSchedule = (_scheduleId: string): OnCallAssignment[] => {
  return [];
};
```

**Cleanup:**
- Remove lines 107-204 (`MOCK_ESCALATIONS`, `MOCK_SCHEDULES`, `MOCK_ASSIGNMENTS`, `MOCK_CURRENT_ONCALL`)
- Remove line 235 (`usingMockData` state)
- Remove lines 774-784 (mock warning Alert)

#### 9. ProductLine (`src/pages/ProductLine/index.tsx`)

**Changes:**

```typescript
// loadData (lines 430-446):
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getProductLines();
    setProductLines(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setProductLines([]);
    message.error(`加载产品线数据失败: ${(error as Error).message}`);
  } finally { setLoading(false); }
};

// openDetail (lines 620-638):
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
- Remove lines 113-280 (`MOCK_PRODUCT_LINES`, `MOCK_RELEASE_TRAINS`, `MOCK_HOTFIX_CHANNELS`)
- Remove line 428 (`usingMockData` state)
- Remove lines 1122-1133 (mock warning Alert)

#### 10. Projects (`src/pages/Projects/index.tsx`)

**Changes:**

```typescript
// loadData (lines 231-255):
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
  } finally { setLoading(false); }
};

// loadResources (lines 387-395):
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
- Remove lines 83-211 (`MOCK_PROJECTS`, `MOCK_RESOURCES`)
- Remove line 229 (`usingMockData` state)
- Remove lines 620-631 (mock warning Alert)

#### 11. Queue (`src/pages/Queue/index.tsx`)

**Changes:**

```typescript
// loadData (lines 185-215):
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
  } finally { setLoading(false); }
};

// loadStats (lines 217-225):
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
- Remove lines 82-162 (`MOCK_STATS`, `MOCK_JOBS`)
- Remove line 183 (`usingMockData` state)
- Remove lines 485-495 (mock warning Alert)

#### 12. VectorStore (`src/pages/VectorStore/index.tsx`)

**Changes:**

```typescript
import type { VectorCollection, VectorDocument, SearchHit, VectorStats } from '@/api/vector-store';
import {
  getCollections, deleteCollection, getCollectionDocuments,
  addDocument, deleteDocument, searchVectors, getVectorStats,
} from '@/api/vector-store';
// Remove import of MOCK_* from './constants'

const loadData = async () => {
  setLoading(true);
  try {
    const res = await getCollections();
    setCollections(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setCollections([]);
    message.error(`加载集合数据失败: ${(error as Error).message}`);
  } finally { setLoading(false); }
};

const loadStats = async () => {
  try {
    const res = await getVectorStats();
    setStats(res.data?.data || null);
  } catch (error: unknown) {
    setStats(null);
  }
};

const loadCollectionDocs = async (name: string) => {
  setDocsLoading(true);
  try {
    const res = await getCollectionDocuments(name);
    setCollectionDocs(Array.isArray(res.data?.data) ? res.data.data : []);
  } catch (error: unknown) {
    setCollectionDocs([]);
    message.error(`加载文档列表失败: ${(error as Error).message}`);
  } finally { setDocsLoading(false); }
};

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
  } finally { setSearchLoading(false); }
};
```

**Cleanup:**
- Remove line 42 (MOCK_* imports)
- Remove line 62 (`usingMockData` state)
- Remove lines 291-302 (mock warning Alert)

**Delete `src/pages/VectorStore/constants.ts`** -- This file only contains mock data (`MOCK_COLLECTIONS`, `MOCK_DOCUMENTS`, `MOCK_SEARCH_RESULTS`, `MOCK_STATS`) and status color maps. The color maps (`statusColorMap`, `indexTypeLabelMap`, `metricLabelMap`) should be moved inline into the sub-components that use them, or kept in a reduced `constants.ts` without mock data.

---

### Per-Page Implementation: Severity 3

#### 13. CostOverview (`src/pages/AICostDashboard/CostOverview.tsx`)

**Change (lines 34-78):**
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
  } finally { setLoading(false); }
};
```

**Cleanup:** Remove the entire mock data block in the catch (lines 42-74).

#### 14. BudgetManagement (`src/pages/AICostDashboard/BudgetManagement.tsx`)

**Change (lines 71-122):**
```typescript
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getBudgets();
    setBudgets(Array.isArray(res.data.data) ? res.data.data : []);
  } catch (error: unknown) {
    setBudgets([]);
    message.error(`加载预算数据失败: ${(error as Error).message}`);
  } finally { setLoading(false); }
};
```

**Delete button (line 302):** Replace `message.info('删除功能待后端支持')` with a real `deleteBudget` API call. If no delete API exists in `src/api/ai-cost.ts`, add it:

```typescript
// In src/api/ai-cost.ts, add:
export async function deleteBudget(id: string) {
  return api.delete<void>(`/v1/ai-cost/budgets/${id}`);
}
```

Then in BudgetManagement:
```typescript
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

#### 15. ROIReport (`src/pages/AICostDashboard/ROIReport.tsx`)

**Change (lines 47-92):**
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
  } finally { setLoading(false); }
};
```

**Cleanup:** Remove lines 56-88 (mock data in catch).

#### 16. AlertConfig (`src/pages/AICostDashboard/AlertConfig.tsx`)

**Change (lines 86-119):**
```typescript
const loadAlerts = async () => {
  setLoading(true);
  try {
    const res = await getAlerts();
    setAlerts(Array.isArray(res.data.data) ? res.data.data : []);
  } catch (error: unknown) {
    setAlerts([]);
    message.error(`加载告警数据失败: ${(error as Error).message}`);
  } finally { setLoading(false); }
};
```

**Alert rules CRUD:** The `rules` state (line 50-81) is purely local. Two options:
- **Option A (recommended):** If the backend has alert rule CRUD APIs, add them to `src/api/ai-cost.ts` and wire up `handleCreateRule`, delete to call real APIs.
- **Option B:** If no backend support yet, keep rules in local state but remove the mock-initialized alerts. Add a comment `// TODO: Alert rule CRUD requires backend API support`.

**Cleanup:** Remove lines 93-112 (mock alerts in catch).

#### 17. SpaceList (`src/pages/AIDocManagement/SpaceList.tsx`)

**Change (lines 62-105):**
```typescript
const loadData = async () => {
  setLoading(true);
  try {
    const res = await getSpaces();
    setSpaces(Array.isArray(res.data.data) ? res.data.data : []);
  } catch (error: unknown) {
    setSpaces([]);
    message.error(`加载知识库数据失败: ${(error as Error).message}`);
  } finally { setLoading(false); }
};
```

**Cleanup:** Remove lines 69-101 (mock spaces in catch).

#### 18. DocumentList (`src/pages/AIDocManagement/DocumentList.tsx`)

Read the file to confirm the pattern, then apply the same migration:
- Replace catch block mock fallback with `setDocuments([])` + `message.error(...)`

#### 19. RAGQuery (`src/pages/AIDocManagement/RAGQuery.tsx`)

Read the file to confirm the pattern, then apply the same migration:
- Replace catch block mock fallback with appropriate empty state + `message.error(...)`

---

### Per-Page Implementation: Severity 4

#### 20. Backup Download (`src/pages/Backup/index.tsx`, line 287-290)

**Current:**
```typescript
const handleDownload = (record: BackupRecord) => {
  // TODO: Replace with actual download URL generation
  message.info(`下载链接已生成: ${record.name}`);
};
```

**Migration:**
```typescript
const handleDownload = async (record: BackupRecord) => {
  try {
    // Option A: If backend returns a download URL:
    const res = await getBackupDownloadUrl(record.id);
    const url = res.data?.data?.url;
    if (url) {
      window.open(url, '_blank');
    } else {
      message.warning('未获取到下载链接');
    }

    // Option B: If backend returns the file as a blob:
    // const res = await downloadBackup(record.id);
    // const blob = new Blob([res.data]);
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = record.name;
    // a.click();
    // URL.revokeObjectURL(url);
  } catch (error: unknown) {
    message.error(`下载失败: ${(error as Error).message}`);
  }
};
```

If no download URL API exists, add to `src/api/backup.ts`:
```typescript
export async function getBackupDownloadUrl(id: string) {
  return api.post<{ url: string }>(`/v1/backups/${id}/download`);
}
```

---

## File Changes Summary

### Files to Modify (12 main page files)

| File | Action | Lines Affected |
|------|--------|---------------|
| `src/pages/EventBus/index.tsx` | Full mock-to-API migration | ~200 lines changed |
| `src/pages/Sessions/index.tsx` | Full mock-to-API migration | ~180 lines changed |
| `src/pages/Approvals/index.tsx` | Remove mock fallback | ~90 lines changed |
| `src/pages/Artifacts/index.tsx` | Remove mock fallbacks, fix download history | ~200 lines changed |
| `src/pages/Environments/index.tsx` | Remove mock fallback | ~80 lines changed |
| `src/pages/InternalLibrary/index.tsx` | Remove mock fallbacks | ~200 lines changed |
| `src/pages/MetricsDashboard/index.tsx` | Remove mock fallbacks | ~60 lines changed |
| `src/pages/OnCall/index.tsx` | Remove mock data, fix assignments | ~200 lines changed |
| `src/pages/ProductLine/index.tsx` | Remove mock fallbacks | ~170 lines changed |
| `src/pages/Projects/index.tsx` | Remove mock fallbacks | ~130 lines changed |
| `src/pages/Queue/index.tsx` | Remove mock fallbacks | ~100 lines changed |
| `src/pages/VectorStore/index.tsx` | Remove mock fallbacks | ~60 lines changed |

### Files to Delete

| File | Reason |
|------|--------|
| `src/pages/VectorStore/constants.ts` | Contains only mock data and status maps that can be inlined |

### Files to Modify (AICostDashboard sub-pages -- 5 files)

| File | Action |
|------|--------|
| `src/pages/AICostDashboard/CostOverview.tsx` | Remove Math.random() mock fallback |
| `src/pages/AICostDashboard/CostDetail.tsx` | Verify and remove mock fallback if present |
| `src/pages/AICostDashboard/BudgetManagement.tsx` | Remove mock fallback, implement deleteBudget API |
| `src/pages/AICostDashboard/ROIReport.tsx` | Remove mock fallback |
| `src/pages/AICostDashboard/AlertConfig.tsx` | Remove mock fallback |

### Files to Modify (AIDocManagement sub-pages -- 3 files)

| File | Action |
|------|--------|
| `src/pages/AIDocManagement/SpaceList.tsx` | Remove mock fallback |
| `src/pages/AIDocManagement/DocumentList.tsx` | Verify and remove mock fallback if present |
| `src/pages/AIDocManagement/RAGQuery.tsx` | Verify and remove mock fallback if present |

### Files to Potentially Modify (API layer)

| File | Action |
|------|--------|
| `src/api/ai-cost.ts` | Add `deleteBudget(id)` if missing |
| `src/api/backup.ts` | Add `getBackupDownloadUrl(id)` or `downloadBackup(id)` |

---

## Testing Requirements

### Unit Tests

Each migrated page must have at least 1 unit test verifying API integration. Place tests in `src/pages/<PageName>/__tests__/index.test.tsx` or the existing test file.

**Test pattern for each page:**

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import PageComponent from '../index';
import * as apiModule from '@/api/<api-name>';

vi.mock('@/api/<api-name>', () => ({
  getItems: vi.fn(),
}));

describe('<PageComponent>', () => {
  it('loads data from API on mount', async () => {
    const mockData = { data: { items: [{ id: '1', name: 'test' }] } };
    vi.mocked(apiModule.getItems).mockResolvedValue(mockData);

    render(<PageComponent />);

    await waitFor(() => {
      expect(apiModule.getItems).toHaveBeenCalled();
    });
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('shows error message on API failure', async () => {
    vi.mocked(apiModule.getItems).mockRejectedValue(new Error('Network error'));

    render(<PageComponent />);

    await waitFor(() => {
      expect(screen.queryByText('mock-data-text')).not.toBeInTheDocument();
    });
  });
});
```

### Required Test Coverage

For each migrated page, verify:

1. **API integration test:** Page calls the correct API function on mount
2. **Error handling test:** API failure results in error message, not mock data
3. **Loading state test:** Page shows loading spinner/skeleton during API call
4. **Empty state test:** API returns empty array, page shows empty state (not an error)

---

## Migration Order

Recommended execution order (least risk to highest risk):

1. **Severity 4** (1 item): Backup download -- trivial change
2. **Severity 1** (2 pages): EventBus, Sessions -- currently doing nothing, hard to break
3. **Severity 3** (8 sub-pages): AICostDashboard + AIDocManagement sub-pages -- isolated components
4. **Severity 2** (10 pages): Main pages with mock fallbacks -- some have complex detail views

Total estimated effort: 1-2 days for a developer familiar with the codebase.
