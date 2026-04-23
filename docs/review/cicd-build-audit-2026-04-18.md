# CI/CD Build Management Module Audit

> **Audit Date**: 2026-04-18 | **Scope**: Backend services + Frontend pages + Design spec comparison
> **Branch**: feat/frontend-gap-implementation

---

## Executive Summary

The Build Management module is **structurally complete** -- all 5 services, 6 controllers, ~50 routes, 7 frontend pages, and a full API client exist with real business logic. However, the entire module runs on **in-memory Map storage** across all services, making it non-functional in production. The K8s executor uses an inline mock despite `@kubernetes/client-node` being installed. The frontend is the strongest area -- pages are rich with tables, forms, status badges, and a functional SSE log viewer. The build cache design spec describes a far more ambitious system (multi-language auto-detection, LFU/FIFO eviction, monitoring/alerting, GraphQL API, cache statistics dashboard) of which only the basic CRUD and LRU cleanup are implemented.

**Key numbers**: 50 backend routes, 6 controllers, 5 services, 7 frontend pages, 31 API client functions. 0 services use persistent storage. 3 frontend/backend route URL mismatches.

---

## Per-Service Audit

### 1. BuilderImageService + BuilderImageController

| Aspect | Expected | Implemented | Verdict |
|--------|----------|-------------|---------|
| Storage | Persistent (DB) | In-memory `Map<string, BuilderImage>` | MOCK |
| Preset images | Registry-based | Hardcoded 10 presets (Node, Python, Go, Java, .NET, Rust) | PARTIAL |
| CRUD | Full | Full -- create, get, update, delete, deprecate, restore | REAL |
| Query by type/status | Yes | Yes, with filtering + pagination | REAL |
| Pull policy | Registry-integrated | Static default (`IfNotPresent`) | MOCK |
| Controller validation | Input validation | Validates `name` + `image` required; 400/404/409/500 responses | REAL |

**Routes**: 10 (POST/GET/PUT/DELETE /build-images, /presets, /available, /type/:type, /:id/deprecate, /:id/restore)
**Frontend page**: `BuilderImageList.tsx` -- Full CRUD table with search, type/status filters, modal form with name/type/baseImage/version fields, edit/deprecate/restore/delete actions, Tag rendering for types, StatusBadge for states.

### 2. BuildCacheService + BuildCacheController + StageCacheController

| Aspect | Expected (Design Spec) | Implemented | Verdict |
|--------|------------------------|-------------|---------|
| Storage | Redis or persistent | In-memory `Map<string, BuildCacheConfig>` + `Map<string, CacheEntry>` | MOCK |
| Three-tier cascade | Global -> Pipeline -> Task | Fully implemented (`getEffectiveConfig`, `isCacheEnabled`) | REAL |
| Cache modes | Auto / Custom / Disabled | Only Enabled/Disabled status | GAP |
| Multi-language detection | Node.js, Python, Go, Java, Rust auto-recognize | No language detection; manual cachePaths only | GAP |
| Eviction policies | LRU / LFU / FIFO / TTL | Only LRU + TTL implemented | GAP |
| Cache key generation | Hash/timestamp/branch with variable substitution | Simple pattern replacement (`cache-{{hash}}`) | PARTIAL |
| Dependency hash | File-based hash (crypto) | Simple string concatenation hash (non-cryptographic) | PARTIAL |
| Capacity limits | maxSize, minFreeSpace | maxTotalSize field exists but never enforced | GAP |
| Cleanup schedule | Cron-based auto cleanup | Manual endpoint only | GAP |
| Cache sharing | Global/team/pipeline/private scopes | Not implemented | GAP |
| Monitoring/alerts | Hit rate, size, eviction metrics + alerts | hitCount/lastHitAt tracked; no metrics/alerts endpoint | GAP |
| GraphQL API | Spec defines full GraphQL schema | Not implemented | GAP |
| Controller validation | Full | Validates required fields; 400/404/409/500 | REAL |

**Routes**: 15 cache routes + 4 stage-cache routes = 19 total
**Frontend page**: `BuildCachePage.tsx` -- Two tabs (Cache Configs / Cache Entries), CRUD modal with name/pipeline/stage/strategy/paths/ttlDays/enabled fields, cleanup expired button, Tag rendering for paths and strategy, delete/clear confirmations. Missing: cache statistics dashboard, hit rate visualization.

### 3. K8sBuildExecutor + K8sBuildController

| Aspect | Expected | Implemented | Verdict |
|--------|----------|-------------|---------|
| K8s client | `@kubernetes/client-node` (in package.json) | `MockK8sClient` class -- inline mock with `setTimeout` lifecycle simulation | MOCK |
| Pod creation | Real K8s API call | Mock creates in-memory status, simulates Pending->Running->Succeeded in 2s | MOCK |
| Resource limits | Real K8s resource spec | Resource spec built but never sent to K8s | MOCK |
| Cache mounts | PVC/volume mounts | Mount spec built in `buildK8sPodSpec()` but never applied | MOCK |
| Pod status watch | K8s Watch API | Mock watcher with callback notifications | MOCK |
| Pod logs | K8s log API | Mock returns pre-built strings | MOCK |
| Cancel build | K8s Pod delete | Mock deletes from in-memory map | MOCK |
| Cleanup | K8s Pod delete by age | Mock cleanup from in-memory map | MOCK |
| Controller validation | Full | Validates `containers` required; proper error handling | REAL |

**Critical finding**: Line 29-33 of `build-routes.ts` explicitly passes `undefined` as the K8s client:
```typescript
const k8sBuildExecutor = new K8sBuildExecutor(
    undefined,  // 使用 Mock K8s 客户端
    buildCacheService,
    builderImageService
);
```
The `@kubernetes/client-node` package is installed (v1.4.0) but never imported or used anywhere in the codebase.

**Routes**: 6 (POST/GET /build-pods, GET /:id, GET /:id/logs, POST /:id/cancel, POST /cleanup)
**Frontend pages**: `BuildPodList.tsx` (table with filters, cancel action, duration calculation) + `BuildPodDetail.tsx` (Descriptions panel, embedded BuildLogViewer with SSE streaming).

### 4. BuildLogService + BuildLogController

| Aspect | Expected | Implemented | Verdict |
|--------|----------|-------------|---------|
| Storage | Persistent (DB/ClickHouse) | In-memory `Map<string, BuildLog>` | MOCK |
| Log creation | API endpoint | Creates empty BuildLog record | REAL |
| Append entry | Single + batch | Both `appendEntry` and `appendEntries` implemented | REAL |
| Import from raw text | Parse and import | `importFromRawText` with regex parsing | REAL |
| SSE streaming | Server-Sent Events | Full SSE implementation with subscribe/notify pattern | REAL |
| Subscriber management | Multi-subscriber | Map-based subscriber with match filtering | REAL |
| Log completion | Mark done + notify | `completeLog` notifies subscribers | REAL |
| Cleanup completed logs | TTL-based | `cleanupCompletedLogs` implemented | REAL |
| Controller SSE endpoint | text/event-stream | Sets proper headers, sends existing + new entries | REAL |

**Routes**: 9 (POST/GET /build-logs, GET /:id, GET /:id/text, POST /:id/entries, POST /:id/entries/batch, POST /:id/import, POST /:id/complete, GET /:id/stream)
**Frontend pages**: `BuildLogList.tsx` (table with search, runId/stageId filters, StatusBadge) + `BuildLogViewer.tsx` (SSE EventSource, pause/resume, search highlight, auto-scroll, dark terminal theme, line numbers, max 10000 lines cap).

### 5. ArtifactService + ArtifactController

| Aspect | Expected | Implemented | Verdict |
|--------|----------|-------------|---------|
| Storage | S3 or object storage | In-memory `Map<string, Artifact>` | MOCK |
| Upload | File upload + metadata | Metadata-only; no actual file handling | MOCK |
| Download | Serve file bytes | Returns JSON with `downloadUrl` (path string), not actual file | MOCK |
| List | Filtered + paginated | Filtering by runId/stageId/type; expiry filter | REAL |
| Expiry cleanup | TTL-based | `cleanupExpired` implemented | REAL |
| Checksum | SHA-256 | Optional field, never computed | MOCK |
| Size calculation | Actual file size | Always 0 (set manually in input) | MOCK |
| Controller validation | Full | Validates `name` + `runId`; proper error responses | REAL |

**Routes**: 6 (POST/GET /artifacts, GET /:id, GET /:id/download, DELETE /:id, POST /cleanup/expired)
**Frontend page**: `ArtifactList.tsx` (table with search, type/runId filters, size formatting B/KB/MB/GB, expiry highlighting with danger styling, download button with blob creation, delete confirmation, cleanup expired button).

---

## Frontend Richness Analysis

| Page | Components Used | Interactivity | Richness |
|------|-----------------|---------------|----------|
| **Layout (index.tsx)** | Sider, Menu with 5 items | Navigation via Outlet | Adequate |
| **BuilderImageList** | Table, SearchFilterBar, Modal, Form, Tag, StatusBadge, Popconfirm | CRUD, search, filter, edit modal | High |
| **BuildCachePage** | Table, Tabs, Modal, Form, Switch, Select(mode="tags"), Tag, StatusBadge, Popconfirm | CRUD, two-tab layout, cleanup actions | High |
| **BuildPodList** | Table, SearchFilterBar, StatusBadge, Popconfirm | Filter, cancel confirm, navigate to detail, duration calc | High |
| **BuildPodDetail** | Descriptions, StatusBadge, BuildLogViewer (embedded), Spin | Refresh, cancel build, multiple log viewers | High |
| **BuildLogList** | Table, SearchFilterBar, StatusBadge | Search, filter, navigate to viewer | Medium |
| **BuildLogViewer** | Card, Input(search), Button, EventSource | SSE streaming, pause/resume, search highlight, auto-scroll, reconnect, line cap | High |
| **ArtifactList** | Table, SearchFilterBar, Tag, Popconfirm | Download (blob), delete, cleanup, expiry highlighting | High |

**Assessment**: The frontend is well-built. All pages use the custom Table component with sortable columns, SearchFilterBar, StatusBadge, and proper error handling with antd message. The BuildLogViewer is particularly notable -- it implements real SSE (EventSource) with pause/resume, search highlighting with term coloring, auto-scroll, and a dark terminal theme. No pages are skeleton/placeholder.

---

## Missing Features from Design Spec

The design document `构建缓存配置设计.md` specifies capabilities far beyond current implementation:

### Cache System Gaps

| # | Feature | Design Spec | Implementation | Priority |
|---|---------|-------------|----------------|----------|
| 1 | Persistent storage | Redis / DB | In-memory Map everywhere | P0 |
| 2 | Auto mode (language detection) | Auto-recognize Node.js/Python/Go/Java/Rust deps | Manual cachePaths only | P1 |
| 3 | LFU eviction | Frequency-based with decay factor | LRU only | P1 |
| 4 | FIFO eviction | Queue-based | Not implemented | P2 |
| 5 | Cache sharing | Global/team/pipeline/private scopes | Not implemented | P2 |
| 6 | Monitoring metrics | Hit rate, size, age, eviction count, alerts | hitCount tracked; no API | P1 |
| 7 | Alert system | Configurable thresholds with severity | Not implemented | P2 |
| 8 | Cache statistics dashboard | Charts for hit rate trend, language breakdown, recent evictions | Not in frontend | P1 |
| 9 | Layer cache | Max layers, compression (zstd/gzip), storage class | Not implemented | P2 |
| 10 | Cache warmup | Scheduled pre-warming of caches | Not implemented | P2 |
| 11 | Cron-based cleanup | Scheduled auto-cleanup | Manual endpoints only | P2 |
| 12 | Archive support | Archive after N days, delete after M days | Not implemented | P2 |
| 13 | GraphQL API | Full schema defined in spec | Not implemented | P2 |
| 14 | Compression config | zstd/gzip/lz4 with levels | Not implemented | P2 |
| 15 | Concurrency control | Max concurrent reads/writes | Not implemented | P2 |
| 16 | Retry strategy | Configurable retries with backoff | Not implemented | P2 |
| 17 | Conditional caching | Branch-based cache rules | Not implemented | P2 |

### Other Gaps

| # | Feature | Gap | Priority |
|---|---------|-----|----------|
| 18 | Real K8s integration | `@kubernetes/client-node` installed but never used; MockK8sClient always active | P0 |
| 19 | Real artifact storage | No file upload/download; metadata-only; download returns JSON path not bytes | P0 |
| 20 | Persistent log storage | In-memory only; logs lost on restart; no ClickHouse integration despite package | P0 |
| 21 | Persistent image storage | In-memory only; no registry API integration | P1 |

---

## Route Mismatch: Frontend vs Backend

| # | Frontend API Call | Backend Route | Issue | Priority |
|---|-------------------|---------------|-------|----------|
| 1 | `POST /v1/build-cache/cleanup/lru/${configId}` | `POST /build-cache/cleanup/lru` (body: `{configId, maxEntries}`) | Frontend uses path param; backend expects body param | P1 |
| 2 | `POST /v1/build-cache/cleanup/clear/${configId}` | `POST /build-cache/clear/:configId` | Path mismatch: `cleanup/clear/` vs `clear/` | P1 |
| 3 | `POST /v1/build-pods/${id}/cleanup` | `POST /build-pods/cleanup` (body: `{olderThanMs}`) | Frontend has per-pod cleanup; backend has bulk cleanup only | P1 |

---

## Prioritized Gap List

### P0 -- Blocks production use

1. **Replace all in-memory Map storage with persistent storage** -- All 5 services (BuilderImage, BuildCache, K8sBuild, BuildLog, Artifact) use in-memory Maps. Data is lost on every restart. Needs PostgreSQL (already a dependency) or Redis (already a dependency).
2. **Integrate real @kubernetes/client-node** -- The K8s executor is entirely mocked. The package is installed. Need to replace MockK8sClient with real K8s API calls for Pod creation, status watching, log streaming, and deletion.
3. **Implement real artifact file storage** -- ArtifactService stores metadata only. Download endpoint returns a JSON path string, not actual file bytes. Need S3 or local filesystem integration.

### P1 -- Significant functionality gaps

4. **Fix 3 frontend/backend route URL mismatches** -- Cleanup LRU, clear cache, and pod cleanup endpoints have different URL patterns between frontend and backend.
5. **Implement cache monitoring and metrics API** -- Design spec requires hit rate, cache size, eviction count metrics. Currently only hitCount is tracked in-memory with no external API.
6. **Add Auto mode with language detection** -- Design spec calls for automatic detection of Node.js/Python/Go/Java/Rust dependency files and cache path configuration. Currently manual only.
7. **Implement LFU eviction strategy** -- Design spec requires LRU/LFU/FIFO. Only LRU is implemented.
8. **Add cache statistics dashboard to frontend** -- Design spec defines a full statistics panel with hit rate trend chart, language breakdown table, and recent evictions table. Currently missing.

### P2 -- Enhancement opportunities

9. **Add cache sharing (scope control)** -- Global/team/pipeline/private sharing scopes.
10. **Implement layer cache with compression** -- Max layers, zstd/gzip compression, storage class.
11. **Add cron-based scheduled cleanup** -- Currently manual only.
12. **Implement cache warmup** -- Scheduled pre-warming of caches.
13. **Add GraphQL API** -- Design spec defines full GraphQL schema.
14. **Implement alert system** -- Configurable thresholds for hit rate, free space, eviction rate.
15. **Add archive support** -- Archive after N days, permanent delete after M days.
16. **Add conditional caching** -- Branch-based cache rules.
17. **Implement retry strategy and concurrency control** -- For cache operations.
18. **Implement FIFO eviction** -- Third eviction strategy from spec.

---

## File Inventory

### Backend
| File | Lines | Purpose |
|------|-------|---------|
| `/Users/heal/orion-design/orion-platform-service/src/api/build-routes.ts` | 297 | Route registration (50 routes) |
| `/Users/heal/orion-design/orion-platform-service/src/api/controllers/build/BuilderImageController.ts` | 262 | Builder image CRUD controller |
| `/Users/heal/orion-design/orion-platform-service/src/api/controllers/build/BuildCacheController.ts` | 355 | Cache config/entry/cleanup controller |
| `/Users/heal/orion-design/orion-platform-service/src/api/controllers/build/K8sBuildController.ts` | 169 | K8s pod CRUD controller |
| `/Users/heal/orion-design/orion-platform-service/src/api/controllers/build/BuildLogController.ts` | 342 | Log CRUD + SSE streaming controller |
| `/Users/heal/orion-design/orion-platform-service/src/api/controllers/build/ArtifactController.ts` | 187 | Artifact CRUD controller |
| `/Users/heal/orion-design/orion-platform-service/src/api/controllers/build/StageCacheController.ts` | 225 | Stage-level cache/artifact controller |
| `/Users/heal/orion-design/orion-platform-service/src/services/build/BuilderImageService.ts` | 340 | Builder image service (10 presets, Map storage) |
| `/Users/heal/orion-design/orion-platform-service/src/services/build/BuildCacheService.ts` | 369 | Cache service (3-tier cascade, LRU, Map storage) |
| `/Users/heal/orion-design/orion-platform-service/src/services/build/K8sBuildExecutor.ts` | 455 | K8s executor (MockK8sClient, pod lifecycle simulation) |
| `/Users/heal/orion-design/orion-platform-service/src/services/build/BuildLogService.ts` | 296 | Log service (SSE subscriber pattern, Map storage) |
| `/Users/heal/orion-design/orion-platform-service/src/services/build/ArtifactService.ts` | 224 | Artifact service (metadata-only, Map storage) |
| `/Users/heal/orion-design/orion-platform-service/src/models/BuilderImage.ts` | 148 | Builder image data model |
| `/Users/heal/orion-design/orion-platform-service/src/models/BuildCache.ts` | 203 | Cache config/entry data model |
| `/Users/heal/orion-design/orion-platform-service/src/models/BuildPod.ts` | 206 | Build pod data model |
| `/Users/heal/orion-design/orion-platform-service/src/models/BuildLog.ts` | 201 | Build log data model |

### Frontend
| File | Lines | Purpose |
|------|-------|---------|
| `/Users/heal/orion-design/orion-frontend/src/pages/BuildEnv/index.tsx` | 30 | Layout with 5-item sidebar menu |
| `/Users/heal/orion-design/orion-frontend/src/pages/BuildEnv/BuilderImageList.tsx` | 326 | Full CRUD table with modal form |
| `/Users/heal/orion-design/orion-frontend/src/pages/BuildEnv/BuildCachePage.tsx` | 427 | Two-tab cache config/entry management |
| `/Users/heal/orion-design/orion-frontend/src/pages/BuildEnv/BuildPodList.tsx` | 245 | Pod table with cancel action |
| `/Users/heal/orion-design/orion-frontend/src/pages/BuildEnv/BuildPodDetail.tsx` | 140 | Pod detail with embedded log viewer |
| `/Users/heal/orion-design/orion-frontend/src/pages/BuildEnv/BuildLogList.tsx` | 193 | Log table with filters |
| `/Users/heal/orion-design/orion-frontend/src/pages/BuildEnv/BuildLogViewer.tsx` | 258 | SSE streaming log viewer |
| `/Users/heal/orion-design/orion-frontend/src/pages/BuildEnv/ArtifactList.tsx` | 259 | Artifact table with download |
| `/Users/heal/orion-design/orion-frontend/src/api/build-env.ts` | 321 | API client (31 functions) |

### Design Docs
| File | Purpose |
|------|---------|
| `/Users/heal/orion-design/docs/cicd/构建缓存配置设计.md` | Comprehensive cache configuration design (YAML schema, REST + GraphQL API, UI mockups, monitoring specs) |
