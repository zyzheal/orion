# Orion Frontend Architecture Review

**Date**: 2026-04-26
**Branch**: `feat/frontend-gap-implementation`
**Reviewer Role**: System Architect + Frontend Architect + Visual Design Expert
**Scope**: `/Users/heal/orion-design/orion-frontend/`

---

## Executive Summary

The Orion frontend is a React + Vite + Ant Design application with 57+ page directories, 49 API client files, and a well-structured design token system. The overall coverage of backend routes is approximately 85%, with good adoption of the custom component library and consistent API client patterns. However, significant concerns exist around `any` type proliferation (400+ instances), inline style abuse over CSS-in-JS or utility classes, missing backend route coverage for 9 service modules, and navigation inconsistency between the top menu and router table.

---

## 1. Route & Page Coverage Matrix

### 1.1 Backend API Routes vs Frontend Pages

| Backend Route Prefix | Frontend Page | Menu Exposed | Gap Notes |
|---|---|---|---|
| `/api/v1/pipelines` | PipelineList, PipelineDetail, PipelineEditor | /ops > 流水线 | Covered |
| `/api/v1/pipeline-runs` | PipelineDetail, PipelineList | (implicit) | Covered |
| `/api/v1/stages` | PipelineDetail | (implicit) | Covered |
| `/api/v1/tasks` | PipelineDetail | (implicit) | Covered |
| `/api/v1/cmdb` | CMDB | /治理 > CMDB | Covered |
| `/api/v1/build` | BuildEnv (7 sub-pages) | /环境 > 构建环境 | Covered |
| `/api/v1/code-repo` | CodeMgmt (5 sub-pages) | /环境 > 代码管理 | Covered |
| `/api/v1/config` | ConfigManagement | /治理 > 配置管理 | Covered |
| `/api/v1/cost` | (no dedicated page) | None | **Missing** - Cost management has no frontend page |
| `/api/v1/risk` | RiskDashboard | /效能看板 > 风险看板 | Covered |
| `/api/v1/finops` | FinOpsDashboard | /ops > 成本分析 | Covered |
| `/api/v1/ai-review` | AIReview (5 sub-pages) | /AI 能力 > AI Review | Covered |
| `/api/v1/diagnostic` | Diagnostic (5 sub-pages) | /ops > 诊断中心 | Covered |
| `/api/v1/test-selector` | (no dedicated page) | None | **Missing** - No frontend for intelligent test selector |
| `/api/v1/deploy` | DeploymentList, DeploymentDetail | /ops > 部署 | Covered |
| `/api/v1/monitoring` | Monitoring (5 sub-pages) | /ops > 监控中心 | Covered |
| `/api/v1/tickets` | TicketList, TicketDetail | /工单 | Covered |
| `/api/v1/self-healing` | SelfHealing (6 sub-pages) | /ops > 自愈系统 | Covered |
| `/api/v1/backup` | (no dedicated page) | None | **Missing** - Backup/restore has no frontend |
| `/api/v1/plugins-spi` | (no dedicated page) | None | **Missing** - Plugin SPI management page absent |
| `/api/v1/plugins` | PluginManagement | Console > 插件管理 | Covered |
| `/api/v1/ai-security` | (no dedicated page) | None | **Missing** - AI security hardening page absent |
| `/api/v1/ai-gateway` | AIGateway | /AI 能力 > AI 网关 | Covered |
| `/api/v1/alert` | AlertList | /ops > 告警 | Covered |
| `/api/v1/audit` | AuditLog | /治理 > 审计日志 | Covered |
| `/api/v1/tenant` | TenantManagement | /治理 > 租户管理 | Covered |
| `/api/v1/efficiency` | EfficiencyDashboard | /效能看板 > 效能分析 | Covered |
| `/api/v1/sbom` | SbomDashboard, SbomDetail | (not in menu) | Covered, but missing menu entry |
| `/api/v1/policies` | PolicyManagement | /治理 > 策略管理 | Covered |
| `/api/v1/change-intelligence` | ChangeIntelligence | /ops > 变更智能 | Covered |
| `/api/v1/canary-analysis` | CanaryAnalysis | /ops > 灰度分析 | Covered |
| `/api/v1/skills` | SkillManagement (4 sub-pages) | /治理 > Skill 市场 | Covered |
| `/api/v1/ai-cost` | AICostDashboard (5 sub-pages) | Console > AI 成本 | Covered |
| `/api/v1/iac` | IacManagement (4 sub-pages) | /环境 > IaC 管理 | Covered |
| `/api/v1/chatops` | ChatOps (4 sub-pages) | /AI 能力 > ChatOps | Covered |
| `/api/v1/confirmations` | ConfirmationWorkbench (5 sub-pages) | Console > 人工确认 | Covered |
| `/api/v1/artifacts` | Artifacts | /制品管理 | Covered |
| `/api/v1/vector-store` | VectorStore | (not in menu) | Covered, but missing menu entry |
| `/api/v1/oncall` | OnCall | (not in menu) | Covered, but missing menu entry |
| `/api/v1/approvals` | Approvals | (not in menu) | Covered, but missing menu entry |
| `/api/v1/eventbus` | (no dedicated page) | None | **Missing** - EventBus monitoring page absent |
| `/api/v1/product-lines` | ProductLine | /产品线 | Covered |
| `/api/v1/internal-libraries` | InternalLibrary | /二方库 | Covered |
| `/api/v1/notifications` | NotificationCenter | (bell icon) | Covered |
| `/api/v1/roles` | RoleManagement | (not in menu) | Covered, but missing menu entry |
| `/api/v1/sessions` | (no dedicated page) | None | Acceptable - session management is admin-only |
| `/api/v1/webhooks` | (no dedicated page) | None | **Missing** - Webhook management page absent |
| `/api/v1/projects` | Projects | /项目 | Covered |
| `/api/v1/environments` | Environments | (not in menu) | Covered, but missing menu entry |
| `/api/v1/queue` | Queue | (not in menu) | Covered, but missing menu entry |
| `/api/v1/knowledge` | KnowledgeBase | /子系统 > 知识库 | Covered |
| `/api/v1/metrics` | (no dedicated page) | None | **Missing** - Metrics browser page absent |
| `/api/v1/users` | UserManagement | Console > 用户管理 | Covered |
| `/` (agent routes) | AgentDashboard, AgentRunDetail | /AI 能力 > Agent 调度 | Covered |
| `/api/v1/auth` | Login | /login | Covered |
| `/api/v1/cron` | (no dedicated page) | None | **Missing** - Cron job management page absent |
| `/api/v1/ephemeral-envs` | EphemeralEnvList, EphemeralEnvDetail | /环境 > 临时环境 | Covered |

### 1.2 Coverage Summary

| Category | Count |
|---|---|
| Total backend route prefixes | 52 |
| Frontend pages with full CRUD | ~38 |
| Frontend pages with partial coverage | ~10 |
| Backend routes with NO frontend page | 9 |
| Frontend pages without menu entry | 6 |
| **Overall Coverage** | **~85%** |

### 1.3 Missing Frontend Pages (Priority Order)

1. **`/api/v1/cost`** - Cost management has no dedicated page (FinOps is separate)
2. **`/api/v1/test-selector`** - Intelligent test selector (used by pipeline, but no management UI)
3. **`/api/v1/backup`** - Backup/restore management
4. **`/api/v1/plugins-spi`** - Plugin SPI configuration
5. **`/api/v1/ai-security`** - AI security hardening dashboard
6. **`/api/v1/eventbus`** - EventBus monitoring
7. **`/api/v1/webhooks`** - Webhook management
8. **`/api/v1/metrics`** - Metrics browser
9. **`/api/v1/cron`** - Cron job scheduler management

### 1.4 Pages Without Menu Entries

1. SBOM Dashboard/Detail - Critical for security compliance
2. Vector Store - Admin function but no navigation path
3. OnCall - SRE critical, no top-level menu
4. Approvals - Workflow critical, no top-level menu
5. Role Management - RBAC critical, accessible only via `/roles` direct URL
6. Environments, Queue - Environment/queue management hidden

---

## 2. Architecture & Code Quality

### 2.1 Strengths

1. **Design Token System**: Excellent implementation with 5 token files (`colors.ts`, `radius.ts`, `shadows.ts`, `typography.ts`, `spacing.ts`) plus `injectTokens.ts` for CSS variable injection. The token hierarchy (50-900 scale for colors, 4px grid for spacing) follows industry best practices (Tailwind/Material Design patterns).

2. **API Client Pattern Consistency**: All 49 API client files follow a consistent pattern: import `api` from `./client`, define TypeScript interfaces, export named functions. The artifacts.ts file (262 lines) demonstrates excellent type coverage with 15+ interfaces.

3. **Custom Component Library**: 14 reusable components including `Table`, `Form`, `Modal`, `SearchFilterBar`, `StatusBadge`, `MetricCard`, `PageLayout`, `DashboardLayout`, `CardPanel`, `SplitPane`, `VirtualList`, `Timeline`, `Loading`, `ErrorBoundary`. Each has corresponding test files.

4. **State Management**: Clean Zustand-based stores (`appStore.ts`, `authStore.ts`, `webSocketStore.ts`) with well-defined interfaces.

5. **Route Organization**: 52 route entries with lazy loading via `React.lazy()`, proper protected/public route guards, and nested child routes for complex modules.

6. **Notification API**: The `notifications.ts` file demonstrates a well-thought-out backend-to-frontend mapping layer with graceful mock fallbacks.

### 2.2 Concerns

#### Critical (Must Fix)

1. **`any` Type Proliferation (400+ instances in pages, 20+ in API clients)**: This is the most significant TypeScript strictness issue. Examples:
   - `SbomDashboard/index.tsx`: `useState<any[]>([])` for 3 state variables
   - `Artifacts/index.tsx`: Table columns typed as `TableColumn<any>[]`
   - `AIReview/*.tsx`: Multiple `as any[]` column type assertions
   - `notifications.ts`: 6 instances of `(response.data?.data as any)`
   - `config.ts`: `value: any` used for config values (partially justified for generic config)

2. **Inline Style Abuse**: The `Layout/index.tsx` (591 lines) uses 30+ inline style objects. Pages like `Console/index.tsx` (733 lines) and `Dashboard.tsx` use inline styles exclusively. This makes theme switching harder, prevents CSS optimization, and violates the design token injection strategy.

3. **Duplicate Dashboard Pages**: Three dashboard entries exist simultaneously: `Dashboard.tsx` (legacy, 95 lines), `DashboardNew/`, and `DashboardCore/`. The routes file maps `/dashboard` to `DashboardNew`, `/dashboard-core` to `DashboardCore`, and `/settings` to the old `Dashboard`. This creates confusion and technical debt.

#### Important (Should Fix)

4. **`FC<any>` in Route Type Definition**: The `AppRoute` interface in `routes.ts` line 6 uses `React.LazyExoticComponent<FC<any>>`. This should be `React.ComponentType` or at minimum `React.LazyExoticComponent<FC<Record<string, unknown>>>`.

5. **No React Query / SWR / TanStack Query**: All pages manage async state manually with `useState` + `useEffect` patterns. This leads to:
   - No automatic caching
   - No stale-while-revalidate
   - No background refetch
   - Manual loading/error state management on every page

6. **Inconsistent API Client Export Styles**: Some files use `export function` (artifacts.ts), others use `export const` (cmdb.ts). Some use `async/await`, others return promises directly. The `data` wrapper unwrapping pattern varies (`response.data.data` vs `response.data`).

7. **No Error Boundary at Route Level**: While `ErrorBoundary` component exists, it is not used as a wrapper in the router. Each page is responsible for its own error handling.

8. **Hardcoded Chinese Text**: All UI text is hardcoded in Chinese with no i18n framework (react-i18next). Given the `zhCN` locale import in `App.tsx`, this appears intentional but limits future internationalization.

#### Suggestions (Nice to Have)

9. **Large Page Components**: `VectorStore/index.tsx` (796 lines), `InternalLibrary/index.tsx` (832 lines), `AgentDashboard/index.tsx` (932 lines), and `PluginManagement/index.tsx` (981 lines) should be broken into smaller sub-components.

10. **No API Version Management**: All API calls use `/v1/` prefix hardcoded in client files. No mechanism for graceful API version migration.

11. **Missing Request Deduplication**: No mechanism to prevent duplicate API calls when users click buttons rapidly or navigate back/forth.

---

## 3. Navigation & UX Assessment

### 3.1 Menu Structure Analysis

The top navigation uses a flat menu bar with dropdown sub-menus (max 3 levels deep). Current structure:

```
工作台
运维中心: 流水线, 部署, 告警, 成本分析, 监控中心, 诊断中心, 自愈系统, 灰度分析, 变更智能
工单
效能看板: 总览看板, 经理看板, 个人看板, 效能分析, 风险看板
子系统: 数据库管理, 知识库, 监控中心
产品线
制品管理
二方库
项目
AI 能力: AI 网关, Agent 调度, AI Review, 知识库, AI 文档, ChatOps
治理: 策略管理, 审计日志, 租户管理, 配置管理, CMDB, Skill 市场
环境: 临时环境, 构建环境, IaC 管理, 代码管理
```

### 3.2 Navigation Issues

1. **Duplicate "监控中心"**: Appears in both `/ops` dropdown (`/monitoring` with Eye icon) and `/子系统` dropdown (`/visor` with Eye icon). Same label, different targets.

2. **Duplicate "知识库"**: Appears in `/子系统` and `/AI 能力` menus with the same path `/knowledge`.

3. **Missing Menu Items**: 6 pages (SBOM, Vector Store, OnCall, Approvals, Role Management, Environments, Queue) have no menu entry and are only accessible via direct URL.

4. **Console Menu Inconsistency**: The admin console dropdown has 5 items (`/console/plugins`, `/console/settings`, `/console/users`, `/console/confirmations`, `/console/ai-cost`) but uses a separate `handleConsoleMenuClick` that does NOT update breadcrumbs, unlike the main nav's `handleMenuClick`.

5. **Breadcrumb Logic is Fragile**: The `handleMenuClick` function iterates through `navMenuItems` at 3 levels of nesting to find labels. It reads breadcrumbs directly from Zustand via `useAppStore.getState().breadcrumbs` (imperative access pattern) rather than using a selector. This bypasses React reactivity.

6. **No Active State Sync**: The `selectedKeys={['/dashboard']}` is hardcoded in the Menu component. It does not reflect the current route, so the active menu highlight is always on "工作台" regardless of which page the user is on.

### 3.3 Positive Aspects

- Sub-menu depth is reasonable (max 3 levels)
- Icon usage is consistent with Ant Design icon library
- Admin-only console menu is a good RBAC pattern
- Notification bell in header provides global access

---

## 4. Design Token & Visual Consistency

### 4.1 Token System Quality

| Token File | Quality | Notes |
|---|---|---|
| `colors.ts` | Excellent | 6 color scales (50-900), dark/light semantic mapping, WCAG 2.1 AA compliant |
| `spacing.ts` | Excellent | 4px base grid, semantic xs-xxl scale, component-specific spacing |
| `radius.ts` | Excellent | Named + numeric scales, component-specific radius |
| `shadows.ts` | Excellent | xs-xxl scale, semantic (card/dropdown/modal), dark mode variants |
| `typography.ts` | Excellent | Complete font stack, 9-level scale, heading styles, text style presets |

### 4.2 Token Adoption Issues

1. **Token Injection Only Happens Once at App Mount**: `injectDesignTokens()` runs in a side-effect at module scope (App.tsx lines 13-21). The generated CSS variables are hardcoded to light mode values. There is no mechanism to update CSS variables when the user toggles themes. The Ant Design `ConfigProvider` handles component tokens, but raw CSS variables (`--bg-primary`, `--text-primary`, etc.) remain static.

2. **Inconsistent Token Usage in Pages**:
   - 96 out of ~57 page directories import from `@/tokens` (good adoption rate)
   - However, many pages still use hardcoded hex values (`#001529`, `#f0f2f5`, `#667eea`) instead of token references
   - `Layout/index.tsx` uses `theme === 'dark' ? '#001529' : '#fff'` instead of `colors.light.bg.primary`

3. **Ant Design Theme Token Mismatch**: The `antdToken` object in `App.tsx` only maps 14 tokens to Ant Design. The `theme.darkAlgorithm` handles most dark mode conversions, but the hardcoded `colorText: colors.light.text.primary` and `colorBgContainer: colors.light.bg.primary` will NOT switch in dark mode.

4. **Missing Token Categories**: No tokens for:
   - Animation/duration values
   - Z-index scale
   - Breakpoint values (responsive design)
   - Opacity scale

---

## 5. TypeScript Strictness Analysis

### 5.1 `any` Type Distribution

| Location | Count | Severity |
|---|---|---|
| `/src/pages/` | 400+ | High |
| `/src/api/` | 20+ | Medium |
| `/src/router/routes.ts` | 1 (`FC<any>`) | High |
| `/src/components/` | <10 | Low |

### 5.2 Problematic Patterns

1. **Table Column Typing**: Nearly every page with a data table uses `TableColumn<any>[]` or `as any[]` for column definitions. This defeats the purpose of typed columns.

2. **Form Submit Handlers**: Multiple pages use `async (values: any) => { ... }` for Ant Design form `onFinish` callbacks instead of typing the form values interface.

3. **API Response Unwrapping**: `(response.data?.data as any)` pattern in notifications.ts and other files indicates the `ApiResponse<T>` generic is not being properly utilized.

4. **Config Value Types**: `config.ts` uses `value: any` which, while partially justified for dynamic configuration, should use `unknown` at minimum with proper type guards.

---

## 6. Priority Action Items

| Priority | Severity | Item | Impact |
|---|---|---|---|
| P0 | High | Fix active menu state: `selectedKeys` should reflect current route, not hardcoded `/dashboard` | UX - navigation confusion |
| P0 | High | Fix Ant Design dark mode tokens: `colorText` and `colorBgContainer` are hardcoded to light mode | UX - dark mode broken |
| P1 | High | Reduce `any` types in page components: start with Table columns and form handlers | Type safety, maintainability |
| P1 | High | Add menu entries for: SBOM, Vector Store, OnCall, Approvals, Role Management | Discoverability |
| P1 | High | Fix duplicate menu labels: "监控中心" and "知识库" appear in multiple dropdowns | UX confusion |
| P2 | Medium | Extract CSS variables for dark mode in `injectTokens.ts` and make them theme-aware | Theme consistency |
| P2 | Medium | Remove duplicate Dashboard files (Dashboard.tsx legacy) | Code cleanliness |
| P2 | Medium | Add React Query / SWR for data fetching | Performance, developer experience |
| P3 | Low | Split large page components (>800 lines) into sub-components | Maintainability |
| P3 | Low | Add missing frontend pages: backup, cron, webhook, metrics, eventbus, test-selector | Feature completeness |
| P3 | Low | Add z-index, animation, and breakpoint tokens | Design system completeness |
| P3 | Low | Standardize API client export style across all 49 files | Code consistency |

---

## 7. Overall Readiness Score: **7/10**

### Justification

**Strengths contributing to score:**
- Design token system is excellent (9/10 quality)
- API client architecture is consistent and well-typed in newer files (8/10)
- Component library has good coverage with tests (8/10)
- Route organization is comprehensive with lazy loading (8/10)
- ~85% backend route coverage is solid for the current milestone

**Factors reducing score:**
- 400+ `any` type instances significantly reduce TypeScript value (-1.5)
- Broken dark mode in Ant Design token mapping (-0.5)
- Navigation bugs (hardcoded active state, duplicate labels, breadcrumb imperative access) (-0.5)
- 9 backend routes have no frontend pages (-0.5)
- No React Query / SWR data fetching layer (-0.5)
- Missing menu entries for 6+ functional pages

### Readiness by Dimension

| Dimension | Score | Notes |
|---|---|---|
| Route Coverage | 7.5/10 | 85% covered, 9 gaps |
| TypeScript Strictness | 5/10 | 400+ `any` instances |
| Design Token Quality | 9/10 | Excellent system, adoption needs work |
| Visual Consistency | 6/10 | Dark mode issues, hardcoded colors |
| Navigation UX | 5/10 | Active state broken, duplicate labels |
| Code Organization | 7/10 | Good patterns, some oversized files |
| Test Coverage | 7/10 | Component tests exist, page tests sparse |
| Performance | 7/10 | Lazy loading good, no data caching |

**Recommendation**: The frontend is production-ready for core workflows (pipelines, deployments, tickets, monitoring) but should address P0/P1 items before the next major release. The design token system is the strongest asset and should be leveraged more aggressively across all pages.

---

*Report generated from analysis of 57 page directories, 49 API client files, 52 backend route prefixes, 14 components, 4 stores, and 7 hooks.*

---

## 8. 架构师评审意见 (2026-04-27 更新)

### 8.1 文档状态同步

本文档编写于 2026-04-26，截至 2026-04-27 的 `feat/frontend-gap-implementation` 分支，以下条目**已完成**：

| 原文档条目 | 状态 | 完成说明 |
|---|---|---|
| P0: Fix active menu state | ✅ 已修复 | `2169850` - 菜单激活状态已绑定当前路由 |
| P0: Fix Ant Design dark mode tokens | ✅ 已修复 | `2169850` - 暗黑模式 Token 已正确映射 |
| P1: Reduce any types in page components | ⚠️ 部分完成 | `dd3034f`, `d0e312c`, `7ae728e` - 11 个页面已修复，但仍有 ~30 处 `TableColumn<any>` 和 API 层 6 处 `as any` |
| P1: Add menu entries for SBOM/OnCall/etc | ⚠️ 部分完成 | 7 个新页面已创建并集成菜单，但 SBOM/VectorStore/RoleManagement/Environments/Queue 仍缺菜单入口 |
| P1: Fix duplicate menu labels | ✅ 已修复 | 重复标签已清理 |
| P3: Add missing frontend pages (7) | ✅ 已完成 | `98905d4`, `d092b9b`, `8faba4e` - EventBus/Sessions/MetricsDashboard/TestSelector/Backup/PluginSPI/AISecurity 全部创建 |
| P3: Remove console.log | ✅ 已修复 | `2f49223` - 5 处 console.log 已移除 |
| P3: Fix silent error swallow | ✅ 已修复 | `2f49223` - InternalLibrary create 错误已显示 |
| P3: Fix useEffect cleanup in OnCall | ✅ 已修复 | `2f49223` - OnCall useEffect 已添加 cleanup |
| P3: Fix Download button onClick | ✅ 已修复 | `2f49223` - Artifacts 下载按钮已绑定 handler |
| P3: Replace as any[] column types | ⚠️ 部分完成 | `2f49223`, `7ae728e` - 5 个关键页面已修复，仍有 25+ 处 `TableColumn<any>` |
| 硬编码颜色替换 | ⚠️ 部分完成 | `3bb8e65`, `9d66d85`, `0be3a40` - 页面级颜色大部分已替换，Layout 渐变仍硬编码 |

### 8.2 仍需处理的问题

| 优先级 | 问题 | 影响范围 | 建议方案 |
|---|---|---|---|
| P1 | ~30 处 `TableColumn<any>` 剩余 | CodeMgmt, AIDocManagement, ChatOps, Diagnostic, BuildEnv 等 | 按模块批量定义类型接口 |
| P1 | API 层 6 处 `as any` | `notifications.ts` | 定义 `BackendNotification` 响应类型，消除 cast |
| P1 | 3 个 Dashboard 文件共存 | `Dashboard.tsx`, `Dashboard/`, `DashboardNew/`, `DashboardCore/` | 保留 `DashboardNew/`（路由指向），删除其余 |
| P2 | Layout 渐变颜色硬编码 | `Layout/index.tsx:519` | 新增 `gradient` Token 或使用 `colors.primary` 组合 |
| P2 | Mock data 静默回退 | 11 个页面 | 已添加 Warning Banner（`cbcad23`, `2101481`, `60af89a`）— 已完成 |
| P2 | React Query/SWR 缺失 | 全局 | 架构级改动，单独规划 |
| P3 | 缺少 z-index/animation/breakpoint tokens | `tokens/` 目录 | 新增 3 个 Token 文件 |
| P3 | 大组件拆分 (>800 行) | VectorStore, InternalLibrary, AgentDashboard, PluginManagement | 按功能拆分为子组件 |

### 8.3 文档优化建议

1. **本文档已过时**：第 5 节 TypeScript Strictness Analysis 中 `any` 分布数据需要更新 — pages/ 从 400+ 降至约 172 处
2. **第 1.3 Missing Frontend Pages** 需要标记 7 个页面为已完成
3. **第 1.4 Pages Without Menu Entries** 需要更新 — 部分页面已有菜单
4. **建议增加"已完成项追踪"章节**：记录哪些评审项已在后续 commit 中解决
5. **分数更新**：Overall Readiness 建议从 7/10 提升至 **7.5/10**（考虑已完成的修复）

### 8.4 新增架构级发现

1. **API 响应类型不统一**：`notifications.ts` 是唯一仍大量使用 `as any` 的 API 文件，其他 48 个 API 文件已规范化
2. **Test 覆盖率不足**：仅 6 个页面有测试文件（`__tests__/`），大部分新页面无测试
3. **缺少全局 Loading 状态管理**：每个页面独立管理 loading state，建议在 appStore 中增加全局 loading 队列
4. **路由守卫粒度不足**：`routes.ts` 仅有 authenticated/unauthenticated 两级，缺少角色权限路由（admin-only 页面如 `/console/*` 无前端守卫）
