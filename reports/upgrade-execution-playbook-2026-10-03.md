# Orion 升级执行手册（2026-10-03）

> **生成日期**：2026-10-03
> **上游文档**：`reports/frontend-fix-tasks-2026-10-03.md`（967 行）+ `reports/a11y-reviews/accessibility-audit-fullrepo-2026-10-03.md`（406 行）+ `reports/neatlogic-feature-comparison-upgrade-2026-09-30-v3.md`（v3 综合，9 项止损）+ `reports/expert-reviews/upgrade-design-plan-2026-10-01.md`（3558 行，17 项巡检+混沌专项）+ `reports/expert-reviews/inspection-expert-method-level-2026-10-03.md`（4 新模块 API 拆分）
> **产出目标**：把所有评审发现编排为**可执行、可回滚、有依赖 DAG、有出口门控**的任务清单
> **硬约束**：不估算人天/工期；不修改生产代码；每项任务必有前置依赖 + 验证方式

---

## 1. TL;DR（执行阶段全景）

| 阶段 | 名称 | 任务数 | 依赖 | 出口门控 |
|------|------|--------|------|---------|
| **S0** | 基础设施层 | 6 | 无 | go build ./... 0 错误 + 错误码/grep 通过 |
| **S1** | A11y 通病批量修复 | 12 | S0 | a11y 全仓指标达标（tabIndex>50 / aria-label>200 / prefers-reduced-motion>=1） |
| **S2** | 核心 Service 补齐（后端止损 P0） | 10 | S0 | 4 处假实现消失 + CMDB CI 类型服务上线 |
| **S3** | 新模块建设（巡检 4 新模块 + risk/scenario） | 14 | S2 + S0 | 66 API 端到端可用 + 5 组 Migration 跑通 |
| **S4** | 协议扩展（Runner K8s/Helm/ArgoCD + SAST） | 6 | S2 | Kind 集群 e2e + CVE 命中 |
| **S5** | 前端页面补齐（P1 UI/UX 10 项） | 12 | S1 + S2（后端 API 就绪） | TicketDetail/Console/DashboardNew e2e 通过 |
| **S6** | 跨模块集成（EventBus/Saga/Notification） | 8 | S2 + S3 + S4 | chaos↔inspection↔notification↔approval 全链 e2e |

**总任务数**：**81 项**（原 68 + ADR 落地 5 + S7 止损 3 + S8 P2 可选 5；其中 S4 的 4 项 + S8 全 5 项可选/后置，P0 阻塞实际为 72 项）
**总阶段数**：**9 个**（S0-S8，v5.4 新增 S7 RDM 止损 + S8 P2 次要项）
**总 Stage Gate 数**：**35 项**（v5.5 实测 `# 门控` 标注行 = S0×5 + S1×3 + S2×5 + S3×4 + S4×4 + S5×4 + S6×4 + S7×3 + S8×3；本手册 §1 表格仅列 S0-S6 的 29 项，S7/S8 门控详见 §6.5/§7/§8；原声明 29 项与实际标注行不符，G1 v1.1 §5.1、F6 §4.1 需同步为 35）
**总 Migration 号段**：**699-765**（AA v5.4 权威分配，含 5 ADR 新增）
  - 699/700-702：CMDB 二阶模型（ADR-013）
  - 703-729：巡检/自动化（Y 手册内既有分配）
  - 730-731：Pipeline ArtifactBus（ADR-014）
  - 732-734：BI
  - 735-744：Alert 5 家族 + AlertBreaker State（ADR-010，736）
  - 745-765：RDM/DevOps

**执行原则**：
1. **依赖优先**：S0 是硬前置，未完成禁止进入 S1/S2；S2 未完成的假实现，S3 的阈值引擎无数据源可消费
2. **可回滚**：每项任务单独 PR，PR 合并后打 tag，回滚粒度 = 单项 PR
3. **验证门控**：每阶段出口必过 grep / 单测 / e2e 三重门控
4. **降级方案**：每项任务标注降级路径（如 MongoDB 不可用时降级 PG JSONB + gojsonpath）

---

## 2. 前置条件清单（阶段启动前必须完成）

### 2.1 全仓基础检查（S0 启动前）

```bash
# 检查 1：Go 编译基线
cd orion-platform-svc-go && go build ./... && echo "OK"

# 检查 2：前端基线
cd orion-frontend && npm run type-check && echo "OK"

# 检查 3：Migration 序列连续性
ls orion-platform-svc-go/internal/*/migrations/ 2>/dev/null | head -20
find orion-platform-svc-go -name "700_*.sql" 2>/dev/null  # 应为空（本轮分配 699-713）

# 检查 4：Repository 基类存在
ls orion-platform-svc-go/internal/*/repository/ 2>/dev/null | wc -l  # 应 >=25

# 检查 5：错误码常量存在
grep -rn "OrionError\|CLIENT\.\|SERVER\." orion-platform-svc-go/internal/ 2>/dev/null | wc -l  # 应 >100
```

### 2.2 每阶段启动前置（按阶段编号）

| 阶段 | 前置条件 | 验证命令 |
|------|---------|---------|
| S0 启动 | 全仓基线检查 2.1 通过 | 见 2.1 |
| S1 启动 | S0 出口门控通过 | 见 §4.1 出口 |
| S2 启动 | S0 完成 + healthcheck SPI 接口草案 | `grep -n "HealthChecker" orion-platform-svc-go/internal/inspection/` |
| S3 启动 | S2 完成（4 处假实现修完）+ MongoDB 客户端依赖已加 | `grep "go.mongodb.org/mongo-driver" orion-platform-svc-go/go.mod` |
| S4 启动 | S2 完成 + Runner Protocol 抽象存在 | `grep -rn "type Runner interface\|RunnerProtocol" orion-platform-svc-go/internal/` |
| S5 启动 | S1 完成 + 后端 API 就绪（Ticket escalate / healthcheck） | 见每项任务的"前置依赖" |
| S6 启动 | S2 + S3 + S4 完成 + EventBus 现有订阅框架 | `grep -rn "EventBus\|EventPublisher" orion-platform-svc-go/internal/` |

---

## 3. 阶段划分与依赖 DAG

### 3.1 完整依赖图（ASCII）

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   [S0 基础设施层]  ── 独立起点，无上游依赖                                 │
│       ├── 6 项任务                                                       │
│       └── 出口：go build ./... + 错误码 grep + Repository 基类审计     │
│                                                                          │
│         │                                                                │
│         ├── 依赖 → [S1 A11y 通病批量]  ── 前端跨模块                     │
│         │       ├── 12 项任务（含 ESLint 规则建立）                     │
│         │       └── 出口：a11y 指标达标 + ESLint 规则阻塞 CI            │
│         │                                                                │
│         ├── 依赖 → [S2 核心 Service 补齐]  ── 后端 P0 止损               │
│         │       ├── 10 项任务（4 假实现 + CMDB CI + ITSM 状态机 + 其他）│
│         │       └── 出口：4 处假实现消失 + CMDB CI 类型服务上线         │
│         │                                                                │
│         │              │                                                 │
│         │              ├── 依赖 → [S3 新模块建设]  ── 4 新模块 + risk/scenario│
│         │              │       ├── 14 项任务（threshold/configfile/report/problem/risk/scenario）│
│         │              │       └── 出口：66 API 可用 + 5 Migration 跑通 │
│         │              │                                                 │
│         │              ├── 依赖 → [S4 协议扩展]  ── Runner K8s/Helm/ArgoCD + SAST │
│         │              │       ├── 6 项任务                             │
│         │              │       └── 出口：Kind e2e + CVE 命中            │
│         │              │                                                 │
│         │              └── 依赖 → [S5 前端页面补齐]                      │
│         │                      ├── 12 项任务                            │
│         │                      └── 出口：3 页 e2e 通过                  │
│         │                                                                │
│         └──────────────────────→ [S6 跨模块集成]                         │
│                                    ├── 依赖 S2 + S3 + S4               │
│                                    ├── 8 项任务                          │
│                                    └── 出口：全链 e2e + Saga 事务一致  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 依赖关系图（简化版）

```
                    ┌─────────┐
                    │   S0    │ 基础设施
                    └────┬────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
           ▼             ▼             ▼
        ┌─────┐       ┌─────┐     ┌─────┐
        │ S1  │       │ S2  │     │ (S1)│ A11y 可与 S2 并行
        │A11y │       │Svc  │     └─────┘
        └──┬──┘       └──┬──┘
           │              │
           │       ┌──────┼──────┐
           │       │      │      │
           │       ▼      ▼      ▼
           │     ┌───┐  ┌───┐  ┌───┐
           │     │S3 │  │S4 │  │(S3│  ← S3/S4 可并行
           │     │新模│  │协议│  │  S4)
           │     └─┬─┘  └─┬─┘  └─┬─┘
           │       │      │      │
           ▼       ▼      ▼      ▼
        ┌─────┐   └──────┴──────┘
        │ S5  │            │
        │前端 │            ▼
        │补齐 │      ┌─────────┐
        └─────┘      │   S6    │ 集成
                     └─────────┘
```

### 3.3 关键路径

**关键路径 1**（最长依赖链）：
```
S0 → S2 → S3 → S6   (跨模块集成需要新模块就绪)
```

**关键路径 2**（前端关键）：
```
S0 → S1 → S5        (前端 A11y 完成后才能修 P1 UI/UX)
```

**可并行执行**（无相互依赖）：
- S1 与 S2（A11y 通病与后端止损完全独立）
- S3 与 S4（4 新模块与 Runner 协议扩展无相互依赖）
- S4 与 S1（后端协议扩展与前端 A11y 通病完全独立）

---

## 4. 阶段任务表（每项任务含前置依赖 + 验证方式 + 回滚步骤）

### 4.1 阶段 S0：基础设施层（6 项）

> **目标**：先补齐"上游依赖"，让后续所有阶段可安全开发。
> **原则**：先修基础设施层（Repository 基类 / axios 拦截器 / 错误码常量），再修业务逻辑层，最后修验证层。

#### S0-T1：错误码常量统一（后端）

- **任务描述**：确认 `orion-platform-svc-go/internal/common/errors.go` 包含 OrionError + CLIENT/SERVER 命名空间；补 P0 错误码常量（INSPECTION_NOT_FOUND、INSPECTION_THRESHOLD_INVALID、CHAOSS.InjectorUnavailable、RISK_APPROVAL_REQUIRED、SCENARIO_NOT_FOUND、CONFIGFILE_VERSION_CONFLICT 等）
- **前置依赖**：无
- **涉及文件**：
  - `grep -rn "OrionError\|CLIENT\.\|SERVER\." orion-platform-svc-go/internal/common/`
  - 目标文件：`orion-platform-svc-go/internal/common/errors.go`
- **验证方式**：
  ```bash
  grep -c "CLIENT\.INSPECTION\|CLIENT\.CHAOSS\|CLIENT\.RISK\|CLIENT\.SCENARIO" \
    orion-platform-svc-go/internal/common/errors.go  # 应 >=20
  ```
- **回滚步骤**：`git revert <commit-hash>` 单文件回滚

#### S0-T2：Repository 基类审计（后端）

- **任务描述**：确认所有 25+ 模块的 repository 基类统一走 tenant_id 过滤；排查"跨租户共享桶"（Round 70 已修 25 处，本项为回归）
- **前置依赖**：无
- **涉及文件**：
  - `grep -rn "WHERE.*tenant_id\|@Inject.*Repository\|createQueryBuilder" orion-platform-svc-go/internal/*/repository/`
- **验证方式**：
  ```bash
  # 所有 repository 查询含 tenant_id
  grep -rln "SELECT\|INSERT\|UPDATE\|DELETE" orion-platform-svc-go/internal/*/repository/*.go \
    | xargs -I{} sh -c 'grep -q "tenant_id" {} && echo "OK: {}" || echo "MISSING: {}"'
  ```
- **回滚步骤**：单个 repository 文件 revert

#### S0-T3：前端 axios 拦截器统一错误处理

- **任务描述**：确认 `orion-frontend/src/utils/request.ts` 全局拦截 401/403/500 错误；错误消息走 antd `message.error`；不重复弹提示
- **前置依赖**：无
- **涉及文件**：`orion-frontend/src/utils/request.ts`
- **验证方式**：
  ```bash
  grep -n "errorHandler\|interceptors.response\|OrionError" \
    orion-frontend/src/utils/request.ts  # 应 >=3 处
  ```
- **回滚步骤**：单文件 revert

#### S0-T4：ESLint 规则建立（A11y 阻塞规则）

- **任务描述**：新增 ESLint 规则 `jsx-a11y/click-events-have-key-events` + `jsx-a11y/no-static-element-interactions` + `jsx-a11y/interactive-supports-focus`，设置为 `error`（阻塞 CI），后续所有前端改动必须先通过
- **前置依赖**：无
- **涉及文件**：`orion-frontend/.eslintrc.cjs` 或 `.eslintrc.js`
- **验证方式**：
  ```bash
  grep -n "click-events-have-key-events\|no-static-element-interactions\|interactive-supports-focus" \
    orion-frontend/.eslintrc*
  ```
- **回滚步骤**：ESLint 规则回滚为 warn 级别

#### S0-T5：Migration 序列占位（699-713 号段）

- **任务描述**：预留 699-713 migration 号段（15 张新表），确认无冲突；不实际创建 SQL 文件（各阶段按需创建）
- **前置依赖**：无
- **涉及文件**：`orion-platform-svc-go/internal/*/migrations/`（跨多个模块）
- **验证方式**：
  ```bash
  # 确认 699-713 号段未被使用
  find orion-platform-svc-go -name "69[9]*.sql" -o -name "7[0-1][0-3]*.sql" | wc -l  # 应为 0
  ```
- **回滚步骤**：无代码变更

#### S0-T6：全局 prefers-reduced-motion CSS

- **任务描述**：在 `orion-frontend/src/index.css` 追加全局媒体查询，禁用所有动画（前庭障碍用户）
- **前置依赖**：无
- **涉及文件**：`orion-frontend/src/index.css`
- **代码模板**（参考 frontend-fix-tasks P0-6）：
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
    .ant-modal-mask, .ant-modal-content, .ant-card, .ant-tabs-content-holder {
      animation: none !important;
      transition: none !important;
    }
  }
  ```
- **验证方式**：
  ```bash
  grep -rn "prefers-reduced-motion" orion-frontend/src/ | wc -l  # 应 >=1
  ```
- **回滚步骤**：单文件 revert

#### S0-ADR1：TenantAwareDB 抽象层 + Migration 720（ADR-011 落地）

- **任务描述**：实现 `TenantAwareDB` 接口（GetConn/Query/BeginTx）；Migration 720 给 `tenants` 表 ALTER 加 `isolation_mode` 列；单测 5 用例（shared/schema 双模式）
- **前置依赖**：无
- **关联 ADR**：ADR-011（多租户存储隔离）
- **涉及文件**：`orion-platform-svc-go/internal/common/db/tenant_aware_db.go` + `orion-platform-svc-go/migrations/720_alter_tenants_isolation_mode.sql`
- **验证方式**：
  ```bash
  # 接口存在
  grep -n "TenantAwareDB\|GetConn\|BeginTx" orion-platform-svc-go/internal/common/db/tenant_aware_db.go  # 应 >=3
  # Migration 存在
  ls orion-platform-svc-go/migrations/720_*.sql 2>/dev/null  # 应 >=1
  # 单测
  cd orion-platform-svc-go && go test ./internal/common/db/... -run TestTenantAware -count=1  # 5 用例通过
  ```
- **回滚步骤**：接口文件删除 + Migration down.sql

#### S0-ADR2：Factory 通用库（ADR-012 落地，非阻塞）

- **任务描述**：实现 `HandlerFactory[T]` Go 泛型抽象库；单测覆盖注册/查找/重复检测
- **前置依赖**：无
- **关联 ADR**：ADR-012（Factory+Handler 注册表模式）
- **涉及文件**：`orion-platform-svc-go/internal/common/factory/handler_factory.go`
- **验证方式**：
  ```bash
  grep -n "HandlerFactory\|Register\|Get" orion-platform-svc-go/internal/common/factory/handler_factory.go  # 应 >=3
  cd orion-platform-svc-go && go test ./internal/common/factory/... -count=1  # 应通过
  ```
- **回滚步骤**：整个 `internal/common/factory/` 目录删除
- **备注**：与 S0-ADR1 可并行；非阻塞，S4/S6 前完成即可

#### S0 出口门控（阶段完成前必过）

```bash
# 门控 1：Go 编译 0 错误
cd orion-platform-svc-go && go build ./... 2>&1 | grep -v "^$" | wc -l  # 应 =0

# 门控 2：错误码覆盖
grep -c "CLIENT\." orion-platform-svc-go/internal/common/errors.go  # 应 >=100

# 门控 3：Repository tenant_id 过滤覆盖率
grep -rln "SELECT\|INSERT\|UPDATE" orion-platform-svc-go/internal/*/repository/*.go \
  | xargs -I{} sh -c 'grep -q "tenant_id" {}' 2>/dev/null | wc -l  # 应 =100%

# 门控 4：ESLint 规则生效
grep -c "jsx-a11y" orion-frontend/.eslintrc*  # 应 >=3

# 门控 5：prefers-reduced-motion 已加
grep -c "prefers-reduced-motion" orion-frontend/src/index.css  # 应 =1
```

---

### 4.2 阶段 S1：A11y 通病批量修复（12 项）

> **目标**：一次性解决 90% WCAG 2.2 AA 违规（全仓通病）。
> **策略**：组件层修改（3 项）+ 存量批量替换（9 项）+ ESLint 阻塞（S0-T4 已建立）。

#### S1-T1：Layout 主导航改 `<button>`（P0-1，最优先）

- **任务描述**：把 `orion-frontend/src/components/Layout/index.tsx:140-194` 的 `<div onClick>` 替换为 `<button>`，加 `aria-label` + `aria-current`
- **前置依赖**：S0-T4（ESLint 规则已建立）
- **涉及文件**：`orion-frontend/src/components/Layout/index.tsx`
- **验证方式**：
  ```bash
  # grep 确认 8 大菜单都使用 <button>
  grep -c "<button" orion-frontend/src/components/Layout/index.tsx  # 应 >=8
  grep -c "onClick.*onNavigate" orion-frontend/src/components/Layout/index.tsx  # 应为 0（改用 button）
  ```
- **e2e 覆盖**：8 大菜单跳转全通过 + 键盘 Tab/Enter 遍历
- **回滚步骤**：单文件 revert；或临时保留 `<div>` + 加 `role="button"` + `tabIndex={0}` + `onKeyDown`

#### S1-T2：全仓 `<div onClick>` 分批替换（P0-2，101 处）

- **任务描述**：按目录分批替换 101 处 `<div onClick>` 反模式
  - 批次 A：TicketDetail（15+）
  - 批次 B：Console（8+）
  - 批次 C：DashboardNew（5+）
  - 批次 D：components/（40+）
  - 批次 E：其他 pages（30+）
- **前置依赖**：S0-T4 + S1-T1（Layout 已改）
- **涉及文件**：全仓 `orion-frontend/src/**/*.tsx`
- **修复模式**（二选一）：
  ```tsx
  // 方案 A：换 <button>（推荐）
  <button onClick={handleClick} aria-label="..." style={{ /* 重置 button 默认样式 */ }}>
    <Content />
  </button>
  // 方案 B：保持 <div>，加语义
  <div role="button" tabIndex={0} onClick={handleClick}
       onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
       style={{ /* 原样式 */ }}>
    <Content />
  </div>
  ```
- **验证方式**：
  ```bash
  # 修复前后对比
  grep -rn "<div[^>]*onClick" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 <10
  ```
- **回滚步骤**：每批次单独 PR，回滚粒度 = 批次

#### S1-T3：`<Card hoverable onClick>` 加语义（40 处）

- **任务描述**：全仓 40 处 `<Card hoverable onClick>` 外包 `<button>` 或加 `role="button"` + `tabIndex`
- **前置依赖**：S0-T4
- **涉及文件**：grep 定位 DashboardNew/ServerError/NotFound/dba/pipeline-svc 等 15 处
- **验证方式**：
  ```bash
  grep -rn "hoverable.*onClick" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 <10
  ```
- **回滚步骤**：按模块分批 PR

#### S1-T4：`<Text onClick>` 改 `<a>` 或 `<button>`（59 处）

- **任务描述**：全仓 59 处 `<Text onClick>` 改为 `<a href>` 或 `<Button type="link">`
- **前置依赖**：S0-T4
- **涉及文件**：15+ 页面 columns.tsx
- **验证方式**：
  ```bash
  grep -rn "<Text[^>]*onClick" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 <5
  ```
- **回滚步骤**：按页面分批 PR

#### S1-T5：Icon-only Button 补 aria-label（1037 处，最关键）

- **任务描述**：全仓 1037 个 `<Button icon=>` 补 `aria-label`（Delete/Close/Save/Refresh/Edit 等）
- **前置依赖**：S0-T4
- **涉及文件**：全仓 `orion-frontend/src/**/*.tsx`
- **修复模板**：
  ```tsx
  // Before
  <Button icon={<DeleteOutlined />} onClick={handleDelete} />
  // After
  <Button icon={<DeleteOutlined />} aria-label="删除" onClick={handleDelete} />
  ```
- **验证方式**：
  ```bash
  grep -rnE "<Button[^>]*icon=[^>]*$" orion-frontend/src/ --include="*.tsx" \
    | grep -v "aria-label" | wc -l  # 目标 <50（保留少数复合场景）
  ```
- **回滚步骤**：按模块分批 PR

#### S1-T6：Table 加 caption + th scope（618 处）

- **任务描述**：OrionTable 组件增加 `caption` 属性支持；`<th>` 加 `scope="col"`；对关键 Table 补 caption 文本
- **前置依赖**：S0-T4
- **涉及文件**：`orion-frontend/src/components/Table/index.tsx` + 关键 30-50 处 Table
- **验证方式**：
  ```bash
  grep -rn "<caption\|scope=\"col\"" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 >30
  ```
- **回滚步骤**：OrionTable 组件回滚 + 关键 Table 分批 revert

#### S1-T7：Form.Item 补 rules + aria-describedby（2092 处中 ~1600 缺 rules）

- **任务描述**：OrionForm 组件增加 aria-describedby 支持；对关键必填项补 `rules`（当前仅 19%）
- **前置依赖**：S0-T4
- **涉及文件**：`orion-frontend/src/components/Form/index.tsx` + 关键 100 处 Form.Item
- **验证方式**：
  ```bash
  grep -rn "<Form.Item[^>]*rules" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 >800（从 401）
  grep -rn "aria-describedby" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 >20
  ```
- **回滚步骤**：按模块分批

#### S1-T8：tabIndex 全仓建立（当前 0 处）

- **任务描述**：所有 `<div onClick>` / `<Card hoverable onClick>` / `<Text onClick>` 替换任务中同步加 `tabIndex={0}`
- **前置依赖**：S1-T2 + S1-T3 + S1-T4（联动）
- **涉及文件**：随 S1-T2/T3/T4 联动
- **验证方式**：
  ```bash
  grep -rn "tabIndex" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 >50
  ```
- **回滚步骤**：随 S1-T2/T3/T4 联动

#### S1-T9：`<img alt>` 补描述（98 处中 94 处缺失）

- **任务描述**：图表 img 补 alt 描述；装饰性 Icon 补 `alt=""`
- **前置依赖**：S0-T4
- **涉及文件**：全仓 img 位置
- **验证方式**：
  ```bash
  grep -rn "<img[^>]*alt" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 >50（从 4）
  ```
- **回滚步骤**：按模块分批

#### S1-T10：aria-live 状态消息（PipelineRunLive + 监控 + AIReview）

- **任务描述**：8 个实时页面（D6 PipelineRunLive / O1 MonitorSvc / O2 Observability / O3 SelfHealing / A2 AIReview / G1 AuditComplianceDashboard 等）加 `aria-live="polite"` 或 `aria-live="assertive"`
- **前置依赖**：S0-T4
- **涉及文件**：PipelineRunLive / MonitorSvc / Observability / SelfHealing / AIReview / AuditComplianceDashboard
- **验证方式**：
  ```bash
  grep -rn "aria-live" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 >8（从 1）
  ```
- **回滚步骤**：按模块分批

#### S1-T11：Focus Appearance CSS（`:focus-visible` 全局样式）

- **任务描述**：在全局 CSS 添加 `:focus-visible` 焦点样式（WCAG 2.4.11 AA）
- **前置依赖**：S0-T6
- **涉及文件**：`orion-frontend/src/index.css`
- **代码模板**：
  ```css
  :focus-visible {
    outline: 2px solid #3370E6;
    outline-offset: 2px;
  }
  button:focus-visible, a:focus-visible, input:focus-visible, [tabindex]:focus-visible {
    outline: 2px solid #3370E6;
    outline-offset: 2px;
  }
  ```
- **验证方式**：
  ```bash
  grep -c ":focus-visible" orion-frontend/src/index.css  # 应 >=2
  ```
- **回滚步骤**：单文件 revert

#### S1-T12：`<Card hoverable>` + `<Text onClick>` 组件封装

- **任务描述**：建立 `ClickableCard` / `ClickableText` 组件，统一封装 `<button>` + `role="button"` + `tabIndex` + `onKeyDown`；供后续存量批量替换引用
- **前置依赖**：S0-T4
- **涉及文件**：`orion-frontend/src/components/ClickableCard.tsx` + `ClickableText.tsx`
- **验证方式**：
  ```bash
  ls orion-frontend/src/components/Clickable*.tsx  # 应 >=2 文件
  ```
- **回滚步骤**：新组件文件 revert

#### S1 出口门控（阶段完成前必过）

```bash
# 门控 1：a11y 关键指标达标
echo "=== 目标值 vs 实际值 ==="
echo "div onClick: 目标 <10，实际 $(grep -rn '<div[^>]*onClick' orion-frontend/src/ --include='*.tsx' | wc -l)"
echo "tabIndex: 目标 >50，实际 $(grep -rn 'tabIndex' orion-frontend/src/ --include='*.tsx' | wc -l)"
echo "aria-label: 目标 >200，实际 $(grep -rn 'aria-label' orion-frontend/src/ --include='*.tsx' | wc -l)"
echo "aria-describedby: 目标 >20，实际 $(grep -rn 'aria-describedby' orion-frontend/src/ --include='*.tsx' | wc -l)"
echo "prefers-reduced-motion: 目标 >=1，实际 $(grep -rn 'prefers-reduced-motion' orion-frontend/src/ | wc -l)"
echo "aria-live: 目标 >8，实际 $(grep -rn 'aria-live' orion-frontend/src/ --include='*.tsx' | wc -l)"
echo "Table caption: 目标 >30，实际 $(grep -rn 'caption\|scope=.col.' orion-frontend/src/ --include='*.tsx' | wc -l)"
echo "img alt: 目标 >50，实际 $(grep -rn '<img[^>]*alt' orion-frontend/src/ --include='*.tsx' | wc -l)"

# 门控 2：ESLint 阻塞生效
cd orion-frontend && npm run lint 2>&1 | grep -c "error"  # 应为 0

# 门控 3：Layout e2e 覆盖
cd orion-frontend && npx playwright test --grep "layout-nav" 2>&1 | tail -5
```

---

### 4.3 阶段 S2：核心 Service 补齐（后端止损 P0，10 项）

> **目标**：修复 4 处 P0 假实现 + 补齐 CMDB CI 类型系统 + ITSM workflow 引擎 + Ticket 加字段 + 3 transport 解冻。
> **原则**：先修基础设施层，再修业务层，再修验证层（Repository → Service → Handler → Test）。

#### S2-T1：修 RunInspection 桩代码（4 处假实现 L49-59 / L63-69 / L72-78 / L81-83）

- **任务描述**：`internal/inspection/service/service.go` 的 4 处 `return {"status":"ok"}` 硬编码假实现替换为真实执行；接入 Collector SPI + ThresholdService + ProblemService
- **前置依赖**：S0-T1（错误码常量）+ S0-T2（Repository 基类）
- **涉及文件**：`orion-platform-svc-go/internal/inspection/service/service.go:49-83`
- **修复模板**（见 upgrade-design-plan §5.1）：
  ```go
  func (s *Service) RunInspection(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
      rec, err := s.repo.GetByID(ctx, tenantID, id)
      if err != nil {
          return nil, fmt.Errorf("inspection not found: %w", err)  // 不再 return ok
      }
      rec.Status = "running"
      if _, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "running"}); err != nil {
          return nil, err
      }
      go s.executeInspection(context.WithoutCancel(ctx), tenantID, id, rec.Config)
      return map[string]interface{}{"status": "running", "inspectionId": id}, nil
  }
  ```
- **验证方式**：
  ```bash
  # 门控 1：假实现消失
  grep -rn 'return.*"status".*"ok"' orion-platform-svc-go/internal/inspection/ | wc -l  # 应为 0
  # 门控 2：单测覆盖
  cd orion-platform-svc-go && go test ./internal/inspection/... -run TestRunInspection -count=1 -v  # 应通过
  # 门控 3：Handler 有真实执行路径
  grep -rn "executeInspection\|Collector\|ThresholdService" \
    orion-platform-svc-go/internal/inspection/service/  # 应 >=3 处
  ```
- **回滚步骤**：单文件 revert；测试回滚为原"假通过"版本

#### S2-T2：修 chaos 静默成功（L628-690）

- **任务描述**：`internal/chaos/service/service.go:686-690` 的 `Fallback: no injector available — log-only mode; return nil` 替换为强制要求 injector 可用，否则返回明确错误
- **前置依赖**：S0-T1（错误码 CLIENT.CHAOSS.InjectorUnavailable）
- **涉及文件**：`orion-platform-svc-go/internal/chaos/service/service.go:628-690`
- **修复模板**：
  ```go
  if s.injector == nil {
      return fmt.Errorf("chaos injector not configured: cannot execute %s on %s (K8s client required)", faultType, target)
  }
  ```
- **验证方式**：
  ```bash
  grep -n "log-only\|Fallback: no injector" orion-platform-svc-go/internal/chaos/  # 应为 0
  cd orion-platform-svc-go && go test ./internal/chaos/... -run TestRunExperiment_NoInjector  # 应通过（验证错误路径）
  ```
- **回滚步骤**：单文件 revert

#### S2-T3：PreReleaseVerify 4 项真实化（L931-951）

- **任务描述**：`internal/chaos/service/service.go:931-951` 的 4 项 checkExperimentCleanup / checkInjectionQuietPeriod / checkHealthEndpoint / checkSteadyState 全部返回 "skip"，改为真实检查
- **前置依赖**：S0-T1 + S2-T1（依赖 inspection 服务可用）
- **涉及文件**：`orion-platform-svc-go/internal/chaos/service/service.go:931-951`
- **修复模板**（见 upgrade-design-plan §5.3）：
  ```go
  func (s *Service) checkHealthEndpoint(ctx context.Context, serviceID, env string) (string, string) {
      target := fmt.Sprintf("http://%s.%s/healthz", serviceID, env)
      resp, err := http.Get(target)
      if err != nil { return "fail", fmt.Sprintf("health endpoint unreachable: %v", err) }
      defer resp.Body.Close()
      if resp.StatusCode != 200 { return "fail", fmt.Sprintf("health endpoint returned %d", resp.StatusCode) }
      return "pass", "health endpoint OK"
  }
  ```
- **验证方式**：
  ```bash
  grep -c 'return "skip"' orion-platform-svc-go/internal/chaos/service/service.go  # 应为 0
  grep -rn "checkHealthEndpoint\|checkSteadyState\|checkInjectionQuietPeriod" \
    orion-platform-svc-go/internal/chaos/  # 应 >=4 处（含测试）
  ```
- **回滚步骤**：单文件 revert

#### S2-T4：3 transport 解冻（snmp.go / ssh.go / sql.go）

- **任务描述**：删除 `internal/cmdb/transport/{snmp,ssh,sql}.go` 顶部的 `//go:build ignore`；补 CollectorRegistry.Register 调用；补 e2e 测试
- **前置依赖**：S0-T1 + S0-T2 + S2-T1（依赖 CMDB Collector SPI）
- **涉及文件**：`orion-platform-svc-go/internal/cmdb/transport/{snmp,ssh,sql}.go`
- **修复动作**：
  ```bash
  # 删除 build tag
  sed -i 's|//go:build ignore||' internal/cmdb/transport/snmp.go  # 类似 ssh.go / sql.go
  ```
- **验证方式**：
  ```bash
  grep -l "//go:build ignore" orion-platform-svc-go/internal/cmdb/transport/  # 应为空
  cd orion-platform-svc-go && go build ./internal/cmdb/...  # 应包含 3 transport
  go test ./internal/cmdb/transport/...  # 3 个 collector 单测应通过
  ```
- **回滚步骤**：build tag 加回

#### S2-ADR1：CMDB 二阶模型 Migration 700-702（ADR-013 落地）

- **任务描述**：Migration 700 新建 `cmdb_ci_types` 表；Migration 701 `cmdb_cis` ALTER 加 `type_id` 列 + 索引；Migration 702 CI Type 回填脚本（渐进式，非破坏性）
- **前置依赖**：S0-T5（号段预留）+ S0-ADR1（TenantAwareDB）
- **关联 ADR**：ADR-013（CMDB 二阶模型，方案 C 渐进式）
- **涉及文件**：
  - `orion-platform-svc-go/migrations/700_create_cmdb_ci_types.sql`
  - `orion-platform-svc-go/migrations/701_alter_cmdb_cis_type_id.sql`
  - `orion-platform-svc-go/migrations/702_backfill_ci_type.sql`
- **验证方式**：
  ```bash
  # 3 张 Migration 存在
  ls orion-platform-svc-go/migrations/70[0-2]_*.sql 2>/dev/null | wc -l  # 应 >=3
  # Migration 跑通
  cd orion-platform-svc-go && go test ./migrations/... -run TestCMDBMigration -count=1  # 应通过
  # 回填脚本幂等
  grep -n "ON CONFLICT\|DO NOTHING\|idempotent" orion-platform-svc-go/migrations/702_*.sql  # 应 >=1
  ```
- **回滚步骤**：每张 Migration 有对应 down.sql 或 DROP TABLE 脚本
- **备注**：非破坏性渐进式（ADR-013 方案 C），不破坏现有 cmdb_cis 读写

#### S2-T5：CMDB CI 类型系统（TS 权威 469 行移植到 Go）

- **任务描述**：从 `legacy/orion-platform-service-ts/` 的 `CITypeService`（469 行）+ 4 个 Repository 移植到 `internal/cmdb/citype/`；这是 CMDB 核心价值，28% → 40% 的关键
- **前置依赖**：S0-T1 + S0-T2 + S2-T4（依赖 Collector 就绪）
- **涉及文件**：
  - 源：`legacy/orion-platform-service-ts/src/services/CITypeService.ts`（469 行）
  - 目标：`orion-platform-svc-go/internal/cmdb/citype/{service,repository,handler,models}.go`
- **验证方式**：
  ```bash
  # 目录结构存在
  ls orion-platform-svc-go/internal/cmdb/citype/  # 应含 service/ repository/ handler/ models/
  # 4 个 Repository 存在
  find orion-platform-svc-go/internal/cmdb/citype/ -name "*.go" | wc -l  # 应 >=10
  # API 端点可用
  grep -rn "citype\|CIType" orion-platform-svc-go/internal/cmdb/routes.go  # 应 >=6 端点
  # 单测
  go test ./internal/cmdb/citype/...  # 应 >=20 tests 通过
  ```
- **回滚步骤**：整个 `internal/cmdb/citype/` 目录删除

#### S2-T6：Ticket 加字段（Migration 699-702）

- **任务描述**：Migration 699-702 给 tickets 表加 parentId / sourceIssueId / issueRelList / attrList / costList 字段（RDM 追溯能力，38% → 60-70%）
- **前置依赖**：S0-T5（Migration 号段预留）+ S0-T2
- **涉及文件**：`orion-platform-svc-go/internal/ticket/migrations/699_*.sql` 等 4 张 migration
- **验证方式**：
  ```bash
  # Migration 文件存在
  ls orion-platform-svc-go/internal/ticket/migrations/69*.sql  # 应 >=4 文件
  # Ticket 模型扩展
  grep -n "ParentID\|SourceIssueID\|IssueRelList\|AttrList\|CostList" \
    orion-platform-svc-go/internal/ticket/models/*.go  # 应 >=5
  # Migration 跑通（本地 PG）
  cd orion-platform-svc-go && go test ./internal/ticket/migrations/...  # 应通过
  ```
- **回滚步骤**：Migration 回滚 SQL + 模型字段回滚

#### S2-T7：ITSM workflow 引擎消费 Nodes/Edges

- **任务描述**：WorkflowExecutor 从 Node 遍历到 Edge 触发；补 StageExecutor 参数链（ITSM 42% → 55%）
- **前置依赖**：S0-T1 + S0-T2
- **涉及文件**：`orion-platform-svc-go/internal/itsm/workflow/{executor,stage_executor}.go`
- **验证方式**：
  ```bash
  # Executor 消费 Nodes/Edges
  grep -n "Nodes\|Edges" orion-platform-svc-go/internal/itsm/workflow/executor.go  # 应 >=10
  # e2e：4 节点流程
  cd orion-platform-svc-go && go test ./internal/itsm/workflow/... -run TestWorkflow_Execute  # 应通过
  ```
- **回滚步骤**：executor.go revert

#### S2-T8：ITSM 状态机修复（如未修复）

- **任务描述**：5 状态转移矩阵（open/assigned/in_progress/resolved/closed）确认在 Service 层被消费；不是仅在前端
- **前置依赖**：S0-T2
- **涉及文件**：`orion-platform-svc-go/internal/itsm/ticket/service.go`
- **验证方式**：
  ```bash
  grep -n "StateTransition\|transitionMatrix\|validTransitions" \
    orion-platform-svc-go/internal/itsm/ticket/service.go  # 应 >=5
  ```
- **回滚步骤**：service.go revert

#### S2-T9：Alert 跨层租户隔离（Round 70 未覆盖）

- **任务描述**：notification / alert 服务层残留的"跨层租户隔离"补齐（MEMORY.md 记录：Round 70 修了 audit 19 处 + efficiency 21 处 + backup 3 处，但 notification/alert 服务层残留）
- **前置依赖**：S0-T2
- **涉及文件**：`orion-platform-svc-go/internal/{notification,alert}/service/*.go`
- **验证方式**：
  ```bash
  # 所有查询含 tenant_id
  grep -rln "SELECT\|INSERT\|UPDATE" orion-platform-svc-go/internal/{notification,alert}/ \
    | xargs -I{} sh -c 'grep -q "tenant_id" {}'  # 应 100%
  ```
- **回滚步骤**：单个 service 文件 revert

#### S2-T10：RDM 前端 40+ API 后端最小实现

- **任务描述**：RDM 前端 40+ API 404 止损（要么前端按钮禁用，要么后端返回 200 + 空数组）—— 建议后端最小实现，前端体验最佳
- **前置依赖**：S0-T1 + S0-T2 + S2-T6（Ticket 加字段后才能真实现）
- **涉及文件**：`orion-platform-svc-go/internal/rdm/{handler,service,routes}.go`
- **验证方式**：
  ```bash
  # 40+ 端点全部返回 200
  cd orion-platform-svc-go && go test ./internal/rdm/... -run TestAllEndpointsRespond  # 应通过
  ```
- **回滚步骤**：routes.go revert

#### S2 出口门控

```bash
# 门控 1：4 处假实现消失
grep -rn 'return.*"status".*"ok"' orion-platform-svc-go/internal/{inspection,chaos}/  | grep -v test | wc -l  # 应为 0
grep -c 'return "skip"' orion-platform-svc-go/internal/chaos/service/service.go  # 应为 0

# 门控 2：3 transport 解冻
ls orion-platform-svc-go/internal/cmdb/transport/*.go | wc -l  # 应 >=3
grep -l "//go:build ignore" orion-platform-svc-go/internal/cmdb/ 2>/dev/null | wc -l  # 应为 0

# 门控 3：CMDB CI 类型服务
find orion-platform-svc-go/internal/cmdb/citype/ -name "*.go" 2>/dev/null | wc -l  # 应 >=10

# 门控 4：Migration 699-702
ls orion-platform-svc-go/internal/ticket/migrations/69*.sql 2>/dev/null | wc -l  # 应 >=4

# 门控 5：全量测试
cd orion-platform-svc-go && go test ./... -count=1 -timeout 180s 2>&1 | grep -E "FAIL|PASS"
```

---

### 4.4 阶段 S3：新模块建设（4 新模块 + risk/scenario，14 项）

> **目标**：NeatLogic 44 API 完全映射到 Orion；引入 MongoDB 支持阈值引擎；跨域 risk/scenario 基础设施。
> **策略**：Migration 先行 → Repository → Service → Handler → 测试。

#### S3-T1：引入 MongoDB 客户端依赖 + 配置

- **任务描述**：`go.mod` 加 `go.mongodb.org/mongo-driver`；补 config.yaml 的 MongoDB URI；新增 `internal/infra/mongo/` 客户端封装
- **前置依赖**：S0-T1（错误码）
- **涉及文件**：`orion-platform-svc-go/go.mod` + `orion-platform-svc-go/config/config.yaml` + `orion-platform-svc-go/internal/infra/mongo/`
- **验证方式**：
  ```bash
  grep "go.mongodb.org/mongo-driver" orion-platform-svc-go/go.mod
  ls orion-platform-svc-go/internal/infra/mongo/*.go  # 应存在
  ```
- **降级方案**：MongoDB 不可用时，用 PG JSONB + `gojsonpath`（见 upgrade-design-plan §6.1）
- **回滚步骤**：`go mod tidy` + config.yaml 回滚

#### S3-T2：Migration 700-704（阈值 / 配置 / 风险 / 场景 / 问题）

- **任务描述**：按 upgrade-design-plan §2 定义 5 张 migration 文件
  - 700_create_inspection_configfiles.sql（3 张表）
  - 701_create_risks.sql（1 张表）
  - 702_create_scenarios.sql（2 张表）
  - 703_alter_chaos_experiments.sql（ALTER 加字段）
  - 704_create_inspection_problems.sql（3 张表）
- **前置依赖**：S0-T5（号段预留）
- **涉及文件**：`orion-platform-svc-go/internal/*/migrations/700-704_*.sql`
- **验证方式**：
  ```bash
  ls orion-platform-svc-go/internal/*/migrations/7[0-4]_*.sql 2>/dev/null | wc -l  # 应 >=5
  cd orion-platform-svc-go && go test ./internal/*/migrations/... -run TestMigration  # 应通过
  ```
- **回滚步骤**：每 migration 有对应 down.sql 或 DROP TABLE 脚本

#### S3-T3：inspection-threshold 模块（5 API）

- **任务描述**：从 inspection-expert-method-level §7.1 建 5 端点：Save / List / Get / Delete / Copy；MongoDB `_inspectdef` collection
- **前置依赖**：S3-T1（MongoDB 依赖）+ S3-T2（Migration）+ S0-T1
- **涉及文件**：`orion-platform-svc-go/internal/inspection-threshold/{service,repository,handler,models,evaluator}/`
- **API 清单**：
  ```
  POST   /api/v1/inspection/v2/thresholds              # Save
  GET    /api/v1/inspection/v2/thresholds              # List
  GET    /api/v1/inspection/v2/thresholds/:name        # Get
  DELETE /api/v1/inspection/v2/thresholds/:name        # Delete
  POST   /api/v1/inspection/v2/thresholds/copy         # Copy
  GET    /api/v1/inspection/v2/thresholds/source       # Source（第 2 层，动态计算）
  ```
- **验证方式**：
  ```bash
  # 目录结构
  find orion-platform-svc-go/internal/inspection-threshold/ -name "*.go" | wc -l  # 应 >=8
  # API 端点注册
  grep -n "thresholds" orion-platform-svc-go/internal/inspection-threshold/routes.go  # 应 >=6
  # JSONPath 求值单测
  cd orion-platform-svc-go && go test ./internal/inspection-threshold/evaluator/... -run TestJSONPath
  ```
- **回滚步骤**：整个 `internal/inspection-threshold/` 删除

#### S3-T4：inspection-configfile 模块（14 API）

- **任务描述**：从 inspection-expert-method-level §7.2 建 14 端点：版本 CRUD + 路径管理 + 资源关联 + 审计
- **前置依赖**：S3-T2（Migration 700）+ S0-T1 + S0-T2
- **涉及文件**：`orion-platform-svc-go/internal/inspection-configfile/{service,repository,handler,models,differ}/`
- **API 分类**：
  - 版本（3）：`GET /versions`, `GET /versions/:id`, `POST /versions`
  - 比对（1）：`POST /compare`
  - 路径（4）：`GET/POST /paths`, `POST /paths/batch-add`, `POST /paths/batch-delete`
  - 资源关联（2）：`POST /resources/clear`, `POST /resources/batch-clear`
  - 审计（4）：`GET /audits`, `POST /audits`, `GET /audits/:id`, `DELETE /audits/:id`
- **验证方式**：
  ```bash
  find orion-platform-svc-go/internal/inspection-configfile/ -name "*.go" | wc -l  # 应 >=10
  grep -n "configfiles" orion-platform-svc-go/internal/inspection-configfile/routes.go | wc -l  # 应 >=14
  cd orion-platform-svc-go && go test ./internal/inspection-configfile/...  # 应 >=20 tests 通过
  ```
- **回滚步骤**：整个模块目录删除

#### S3-T5：inspection-report 模块（16 API）

- **任务描述**：从 inspection-expert-method-level §7.3 建 16 端点：查询 + 导出（FreeMarker/Go template）+ 环境 + 脚本 + 计划 + 应用模块
- **前置依赖**：S3-T2（Migration）+ S3-T4（配置文件作为数据源）+ S0-T1
- **涉及文件**：`orion-platform-svc-go/internal/inspection-report/{service,repository,handler,models,scheduler,exporter}/`
- **API 分类**：
  - 查询（2）：`GET /reports/:id`, `GET /reports?resourceId=`
  - 导出（1）：`POST /reports/:id/export`
  - 环境（1）：`GET /reports/environments`
  - 脚本（2）：`GET/POST /reports/access-endpoint-script`
  - 计划（2）：`GET /reports/schedules`, `PUT /reports/schedules/:id/status`
  - 应用模块（1）：`GET /reports/app-modules`
- **验证方式**：
  ```bash
  find orion-platform-svc-go/internal/inspection-report/ -name "*.go" | wc -l  # 应 >=10
  grep -n "reports" orion-platform-svc-go/internal/inspection-report/routes.go | wc -l  # 应 >=16
  ```
- **回滚步骤**：整个模块目录删除

#### S3-T6：inspection-problem 模块（11 API）

- **任务描述**：从 inspection-expert-method-level §7.4 建 11 端点：自定义视图 + 条件更新 + 报告 + 每日告警
- **前置依赖**：S3-T2（Migration 704）+ S3-T5（复用 report 渲染引擎）
- **涉及文件**：`orion-platform-svc-go/internal/inspection-problem/{service,repository,handler,models}/`
- **API 分类**：
  - 自定义视图（7）：`GET/POST /views`, `GET/PUT/DELETE /views/:id`, `POST /views/:id/rename`, `POST /views/:id/move`
  - 条件更新（1）：`PUT /views/:id/condition`
  - 报告（3）：`GET /reports`, `POST /reports/export`, `POST /reports/send-email`
  - 每日告警（1）：`POST /alerts/refresh-everyday`
- **验证方式**：
  ```bash
  find orion-platform-svc-go/internal/inspection-problem/ -name "*.go" | wc -l  # 应 >=8
  grep -n "problems" orion-platform-svc-go/internal/inspection-problem/routes.go | wc -l  # 应 >=11
  ```
- **回滚步骤**：整个模块目录删除

#### S3-T7：risk 模块（6 API，跨域共享）

- **任务描述**：从 upgrade-design-plan §2.3 建 risk 表；6 端点 CRUD + move + search
- **前置依赖**：S3-T2（Migration 701）+ S0-T1 + S0-T2
- **涉及文件**：`orion-platform-svc-go/internal/risk/{service,repository,handler,models}/`
- **API 清单**：
  ```
  POST   /api/v1/risks            # Save
  GET    /api/v1/risks            # List
  GET    /api/v1/risks/:id        # Get
  DELETE /api/v1/risks/:id        # Delete
  PUT    /api/v1/risks/:id/move   # Move
  GET    /api/v1/risks/search     # Search
  ```
- **验证方式**：
  ```bash
  find orion-platform-svc-go/internal/risk/ -name "*.go" | wc -l  # 应 >=6
  grep -n "risks" orion-platform-svc-go/internal/risk/routes.go | wc -l  # 应 >=6
  ```
- **回滚步骤**：整个模块目录删除

#### S3-T8：scenario 模块（4 API，跨域共享）

- **任务描述**：从 upgrade-design-plan §2.4 建 scenario 表 + scenario_bindings 关联表；4 端点 CRUD
- **前置依赖**：S3-T2（Migration 702）+ S3-T7（risk 模块）
- **涉及文件**：`orion-platform-svc-go/internal/scenario/{service,repository,handler,models,presets}/`
- **API 清单**：
  ```
  POST   /api/v1/scenarios            # Save
  GET    /api/v1/scenarios            # Search
  GET    /api/v1/scenarios/:id        # Get
  DELETE /api/v1/scenarios/:id        # Delete
  ```
- **验证方式**：
  ```bash
  find orion-platform-svc-go/internal/scenario/ -name "*.go" | wc -l  # 应 >=6
  ```
- **回滚步骤**：整个模块目录删除

#### S3-T9：chaos Experiment 扩展字段（Migration 703 ALTER）

- **任务描述**：ALTER TABLE chaos_experiments 加 risk_id / scenario_id / requires_approval / approval_id 字段
- **前置依赖**：S3-T2（Migration 703）+ S3-T7 + S3-T8
- **涉及文件**：`orion-platform-svc-go/internal/chaos/models/models.go` + Migration 703
- **验证方式**：
  ```bash
  grep -n "RiskID\|ScenarioID\|RequiresApproval\|ApprovalID" \
    orion-platform-svc-go/internal/chaos/models/*.go  # 应 >=4
  ```
- **回滚步骤**：Migration down.sql + 模型字段回滚

#### S3-T10：chaos 增强端点（2 端点）

- **任务描述**：新增 2 端点：PUT /chaos/experiments/:id/risk-level + PUT /chaos/experiments/:id/scenario + POST /chaos/experiments/:id/validate
- **前置依赖**：S3-T9 + S3-T7 + S3-T8
- **涉及文件**：`orion-platform-svc-go/internal/chaos/handler/{handler,routes}.go`
- **验证方式**：
  ```bash
  grep -n "risk-level\|scenario\|validate" orion-platform-svc-go/internal/chaos/handler/routes.go  # 应 >=3
  ```
- **回滚步骤**：handler.go + routes.go revert

#### S3-T11：路由注册（inspection-v2 前缀 + 权限）

- **任务描述**：新建 `internal/inspection/routes_v2.go`，挂载 `/api/v1/inspection/v2/*` 前缀；挂 `auth.RequirePermission("inspection:v2", "read/write/delete")`
- **前置依赖**：S3-T3 + S3-T4 + S3-T5 + S3-T6
- **涉及文件**：`orion-platform-svc-go/internal/inspection/routes_v2.go` + `cmd/server/main.go` 挂载
- **验证方式**：
  ```bash
  grep -n "inspection/v2" orion-platform-svc-go/internal/inspection/routes_v2.go  # 应 >=1
  grep -n "RequirePermission" orion-platform-svc-go/internal/inspection/routes_v2.go  # 应 >=3
  ```
- **回滚步骤**：routes_v2.go revert + main.go 挂载点回滚

#### S3-T12：JSONPath + Go template 求值库集成

- **任务描述**：集成 `github.com/ohler55/ojg/jp`（JSONPath）+ `text/template`（Go 原生模板）；FreeMarker 弃用（决策见 upgrade-design-plan §6.2）
- **前置依赖**：S3-T3（threshold 模块需要）
- **涉及文件**：`orion-platform-svc-go/internal/inspection-threshold/evaluator/{jsonpath,template}.go`
- **验证方式**：
  ```bash
  grep -rn "ojg\|jsonpath" orion-platform-svc-go/internal/inspection-threshold/evaluator/  # 应 >=2
  cd orion-platform-svc-go && go test ./internal/inspection-threshold/evaluator/ -run TestJSONPathEvaluate  # 应通过
  ```
- **回滚步骤**：`go mod tidy` + 单文件 revert

#### S3-T13：cron consumer 框架对接

- **任务描述**：inspection-report scheduler 复用现有 `internal/cron/` 框架；新增 ReportScheduleConsumer
- **前置依赖**：S3-T5 + 现有 cron 框架
- **涉及文件**：`orion-platform-svc-go/internal/inspection-report/scheduler/consumer.go`
- **验证方式**：
  ```bash
  ls orion-platform-svc-go/internal/inspection-report/scheduler/*.go  # 应 >=2
  grep -rn "cron.New\|Register" orion-platform-svc-go/internal/inspection-report/scheduler/  # 应 >=1
  ```
- **回滚步骤**：整个 scheduler/ 目录 revert

#### S3-T14：inspection 主模块对接新模块

- **任务描述**：修 S2-T1 RunInspection 时，注入 ThresholdService + ProblemService + NotificationService 依赖
- **前置依赖**：S2-T1 + S3-T3 + S3-T6
- **涉及文件**：`orion-platform-svc-go/internal/inspection/service/service.go` + `cmd/server/main.go`（依赖注入）
- **验证方式**：
  ```bash
  grep -n "ThresholdService\|ProblemService\|NotificationService" \
    orion-platform-svc-go/internal/inspection/service/service.go  # 应 >=3
  ```
- **回滚步骤**：service.go + main.go revert

#### S3 出口门控

```bash
# 门控 1：4 新模块 + risk/scenario 6 个模块全部存在
for mod in inspection-threshold inspection-configfile inspection-report inspection-problem risk scenario; do
    find orion-platform-svc-go/internal/$mod/ -name "*.go" 2>/dev/null | wc -l
done  # 每个应 >=5

# 门控 2：66 API 端到端可用
cd orion-platform-svc-go && go test ./internal/*/routes...  # 应通过

# 门控 3：Migration 700-704 跑通
cd orion-platform-svc-go && go test ./internal/*/migrations/... -run TestMigration -count=1

# 门控 4：inspection-v2 权限
grep -c "RequirePermission" orion-platform-svc-go/internal/inspection/routes_v2.go  # 应 >=3
```

---

### 4.5 阶段 S4：协议扩展（Runner + SAST，6 项 · 其中 4 项可选/后置）

> **目标**：SAST 引擎从通用正则升级到 Trivy/Snyk 专业引擎；Runner Protocol 接口扩展支持多协议注册。
> **⚠️ v5 撤回声明**：S4-T1/T2/T3/T4（K8s/Helm/ArgoCD Runner）已由 NL-8 一手代码证伪——NeatLogic Runner 也 0 实现 K8s/Helm/ArgoCD，**这是 Orion 差异化优势而非 P0 缺口**（见 Y §6.5.2）。以下 4 项保留为**可选/后置**任务，非阻塞。
> **策略**：先做 SAST 引擎（S4-T5）+ Protocol 抽象（S4-T6），K8s/Helm/ArgoCD Runner 作为探索性任务后置。

#### S4-T1：引入 k8s client-go + Helm SDK ⚠️ 可选/后置（v5 撤回）

- **任务描述**：`go.mod` 加 `k8s.io/client-go` + `helm.sh/helm/v3`；补 config.yaml 的 kubeconfig 路径
- **⚠️ v5 状态**：NL-8 一手代码确认 Runner K8s/Helm/ArgoCD 全部 0 实现。此项保留为**可选探索**，非 P0 阻塞。
- **前置依赖**：S0-T1
- **涉及文件**：`orion-platform-svc-go/go.mod` + `config.yaml`
- **验证方式**：
  ```bash
  grep -E "k8s.io/client-go|helm.sh/helm" orion-platform-svc-go/go.mod  # 应 >=2
  ```
- **回滚步骤**：`go mod tidy`

#### S4-T2：K8sRunner 实现 ⚠️ 可选/后置（v5 撤回）

- **任务描述**：实现 K8sRunner 接口（Deploy / Rollback / Status / Logs），支持 Deployment / StatefulSet / Job 3 种 workload
- **⚠️ v5 状态**：非 P0 缺口。若做则为 Orion 差异化创新。
- **前置依赖**：S4-T1 + 现有 Runner Protocol 抽象
- **涉及文件**：`orion-platform-svc-go/internal/runner/k8s/runner.go`
- **验证方式**：
  ```bash
  find orion-platform-svc-go/internal/runner/k8s/ -name "*.go" | wc -l  # 应 >=3
  grep -rn "k8s.io/client-go" orion-platform-svc-go/internal/runner/  # 应 >=1
  ```
- **回滚步骤**：整个 `internal/runner/k8s/` 删除

#### S4-T3：HelmRunner 实现 ⚠️ 可选/后置（v5 撤回）

- **任务描述**：实现 HelmRunner 接口，支持 install / upgrade / rollback / uninstall
- **⚠️ v5 状态**：非 P0 缺口。若做则为 Orion 差异化创新。
- **前置依赖**：S4-T1 + S4-T2（复用 kubeconfig）
- **涉及文件**：`orion-platform-svc-go/internal/runner/helm/runner.go`
- **验证方式**：
  ```bash
  find orion-platform-svc-go/internal/runner/helm/ -name "*.go" | wc -l  # 应 >=3
  grep -rn "helm.sh" orion-platform-svc-go/internal/runner/  # 应 >=1
  ```
- **回滚步骤**：整个 `internal/runner/helm/` 删除

#### S4-T4：ArgoCDRunner 实现 ⚠️ 可选/后置（v5 撤回）

- **任务描述**：实现 ArgoCDRunner 接口，通过 ArgoCD API Server 触发 sync / rollback
- **⚠️ v5 状态**：非 P0 缺口。若做则为 Orion 差异化创新。
- **前置依赖**：S4-T1 + 现有 ArgoCD API 客户端（若已存在）
- **涉及文件**：`orion-platform-svc-go/internal/runner/argocd/runner.go`
- **验证方式**：
  ```bash
  find orion-platform-svc-go/internal/runner/argocd/ -name "*.go" | wc -l  # 应 >=2
  ```
- **回滚步骤**：整个 `internal/runner/argocd/` 删除

#### S4-T5：Trivy + Snyk SAST 引擎集成

- **任务描述**：集成 Trivy（容器 + 依赖）+ Snyk（依赖 + IaC）；scanner.go 加 SASTProvider 接口；保留原正则引擎作为降级路径
- **前置依赖**：S0-T1（错误码）
- **涉及文件**：`orion-platform-svc-go/internal/scanner/{trivy,snyk,fallback}.go`
- **验证方式**：
  ```bash
  grep -rnE "trivy|snyk" orion-platform-svc-go/internal/scanner/  # 应 >=2
  grep -n "SASTProvider" orion-platform-svc-go/internal/scanner/scanner.go  # 应存在
  ```
- **回滚步骤**：新 SAST 文件删除；scanner.go 回滚到原正则

#### S4-T6：Runner Protocol 接口扩展

- **任务描述**：扩展 Runner Protocol 抽象，支持多协议注册（shell / k8s / helm / argocd）；Pipeline 任务通过 `protocol` 字段选择 Runner
- **前置依赖**：S4-T2 + S4-T3 + S4-T4
- **涉及文件**：`orion-platform-svc-go/internal/runner/protocol.go` + `internal/runner/registry.go`
- **验证方式**：
  ```bash
  grep -n "Runner interface\|Registry\|Register" orion-platform-svc-go/internal/runner/protocol.go  # 应 >=3
  ```
- **回滚步骤**：protocol.go revert；registry.go revert

#### S4 出口门控

```bash
# 门控 1：SAST 引擎就绪（P0 阻塞）
grep -rnE "trivy|snyk" orion-platform-svc-go/internal/scanner/  # 应 >=2
grep -n "SASTProvider" orion-platform-svc-go/internal/scanner/scanner.go  # 应存在

# 门控 2：Runner Protocol 接口扩展（P0 阻塞）
grep -n "Runner interface\|Registry\|Register" orion-platform-svc-go/internal/runner/protocol.go  # 应 >=3

# 门控 3：CVE 命中测试（P0 阻塞）
cd orion-platform-svc-go && go test ./internal/scanner/... -run TestSAST_CVE  # 应通过

# 门控 4（⚠️ 可选/后置）：K8s/Helm/ArgoCD Runner（v5 撤回，非阻塞）
# find orion-platform-svc-go/internal/runner/ -name "runner.go" | wc -l  # 期望 >=4，但非阻塞
# grep -E "k8s.io/client-go|helm.sh" orion-platform-svc-go/go.mod | wc -l  # 期望 >=2，但非阻塞
```

---

### 4.6 阶段 S5：前端页面补齐（P1 UI/UX 10 项 + 次要 2 项，12 项）

> **目标**：修复 TicketDetail 5 + Console 3 + DashboardNew 2 P1 UI/UX 严重项。
> **策略**：先修交互链（Modal.confirm / 二次确认 / confirmLoading），再修空实现（Escalate API），最后修 UX 细节。

#### S5-T1：TicketDetail 关闭工单加二次确认（P1-1）

- **任务描述**：`TicketHeader.tsx:120` 的关闭按钮加 `Modal.confirm`
- **前置依赖**：S0-T4（ESLint）
- **涉及文件**：`orion-frontend/src/pages/TicketDetail/{TicketHeader.tsx,useTicketDetailState.ts}`
- **验证方式**：
  ```bash
  grep -n "Modal.confirm" orion-frontend/src/pages/TicketDetail/useTicketDetailState.ts  # 应 >=1
  ```
- **e2e**：`npx playwright test --grep "ticket-close-confirm"`
- **回滚步骤**：单文件 revert

#### S5-T2：TicketDetail handleEscalate 补 API 调用（P1-2）

- **任务描述**：`useTicketDetailState.ts:127-130` 的 handleEscalate 空实现补 API 调用；后端如未实现 escalateTicket API，S2 阶段应先补齐
- **前置依赖**：S5-T1 + 后端 escalateTicket API（依赖 S2-T6）
- **涉及文件**：`orion-frontend/src/api/ticketing.ts` + `useTicketDetailState.ts`
- **验证方式**：
  ```bash
  grep -n "escalateTicket" orion-frontend/src/api/ticketing.ts  # 应 >=1
  grep -n "escalateTicket\|escalate" orion-frontend/src/pages/TicketDetail/useTicketDetailState.ts  # 应 >=2
  ```
- **降级方案**：后端 API 未就绪时，前端按钮暂时 disabled + Tooltip "升级功能待上线"
- **回滚步骤**：单文件 revert

#### S5-T3：TicketDetail 4 个 Modal 加 confirmLoading（P1-3）

- **任务描述**：`TicketDetailModals.tsx:34-142` 的 4 个 Modal 加 `confirmLoading` + `okButtonProps.disabled`
- **前置依赖**：S5-T1
- **涉及文件**：`orion-frontend/src/pages/TicketDetail/TicketDetailModals.tsx`
- **验证方式**：
  ```bash
  grep -c "confirmLoading" orion-frontend/src/pages/TicketDetail/TicketDetailModals.tsx  # 应 >=4
  ```
- **回滚步骤**：单文件 revert

#### S5-T4：TicketDetail 评论提交 await + 保留输入（P1-4）

- **任务描述**：`TicketComments.tsx:218-220` 的 fire-and-forget 改为 await + 失败保留输入
- **前置依赖**：S0-T3（axios 拦截器）
- **涉及文件**：`orion-frontend/src/pages/TicketDetail/TicketComments.tsx`
- **验证方式**：
  ```bash
  grep -n "await submitComment\|try.*catch\|finally" \
    orion-frontend/src/pages/TicketDetail/TicketComments.tsx  # 应 >=3
  ```
- **回滚步骤**：单文件 revert

#### S5-T5：TicketDetail 加载态与 404 区分（P1-5）

- **任务描述**：`useTicketDetailState.ts:24,49` + `index.tsx` 修复 loading 状态误判为 404
- **前置依赖**：S5-T1
- **涉及文件**：`orion-frontend/src/pages/TicketDetail/{useTicketDetailState.ts,index.tsx}`
- **验证方式**：
  ```bash
  grep -n "loading\|<Spin" orion-frontend/src/pages/TicketDetail/index.tsx  # 应 >=2
  ```
- **回滚步骤**：单文件 revert

#### S5-T6：TicketDetail 附件/Mention Tag 补交互或删 cursor（P1-6 + P1-7）

- **任务描述**：`TicketComments.tsx:84-94, 399-412` 两处 `cursor: pointer` 补 onClick 或删 cursor
- **前置依赖**：S0-T4
- **涉及文件**：`orion-frontend/src/pages/TicketDetail/TicketComments.tsx`
- **验证方式**：
  ```bash
  grep -c "cursor: 'pointer'" orion-frontend/src/pages/TicketDetail/TicketComments.tsx  # 应从 2 降为 0 或配套 onClick
  grep -c "onClick\|onKeyDown" orion-frontend/src/pages/TicketDetail/TicketComments.tsx  # 应 >=2
  ```
- **回滚步骤**：单文件 revert

#### S5-T7：Console QuickNav 改 useNavigate（P1-8）

- **任务描述**：`Console/Components/QuickNav.tsx:47-49` 的 `window.location.href` 改为 `useNavigate`
- **前置依赖**：S0-T4
- **涉及文件**：`orion-frontend/src/pages/Console/Components/QuickNav.tsx`
- **验证方式**：
  ```bash
  grep -c "window.location.href" orion-frontend/src/pages/Console/Components/QuickNav.tsx  # 应为 0
  grep -c "useNavigate" orion-frontend/src/pages/Console/Components/QuickNav.tsx  # 应 >=1
  ```
- **回滚步骤**：单文件 revert

#### S5-T8：Console 删假数据回退（P1-9）

- **任务描述**：`useConsoleState.ts:24-29, 50-53` 的 `FALLBACK_STATS` 常量删除；catch 中显示真实错误
- **前置依赖**：S0-T3（axios 拦截器）
- **涉及文件**：`orion-frontend/src/pages/Console/useConsoleState.ts`
- **验证方式**：
  ```bash
  grep -c "FALLBACK_STATS\|演示数据" orion-frontend/src/pages/Console/  # 应为 0
  ```
- **回滚步骤**：单文件 revert

#### S5-T9：Console 初始错误态（P1-10）

- **任务描述**：`Console/index.tsx:18-26` 加 initialLoading 后的 error 展示
- **前置依赖**：S5-T8
- **涉及文件**：`orion-frontend/src/pages/Console/index.tsx`
- **验证方式**：
  ```bash
  grep -n "initialLoading\|<Alert\|<Spin" orion-frontend/src/pages/Console/index.tsx  # 应 >=3
  ```
- **回滚步骤**：单文件 revert

#### S5-T10：DashboardNew Alert 类型 + fallback 删除

- **任务描述**：`DashboardNew/index.tsx:65-72` Alert `type="warning"` 改 `"error"`；`useDashboardState.ts:64-75` systemHealth fallback 删
- **前置依赖**：S0-T3
- **涉及文件**：`orion-frontend/src/pages/DashboardNew/{index.tsx,useDashboardState.ts}`
- **验证方式**：
  ```bash
  grep -c 'type="warning"' orion-frontend/src/pages/DashboardNew/index.tsx  # 应为 0（改 error）
  grep -c "fallback\|演示数据" orion-frontend/src/pages/DashboardNew/useDashboardState.ts  # 应为 0
  ```
- **回滚步骤**：单文件 revert

#### S5-T11：TicketDetail 加载态 e2e（场景逆向）

- **任务描述**：手动 e2e 走一遍"慢网络 → 加载 → 打开详情 → 升级 → 关闭"完整流程
- **前置依赖**：S5-T1 + S5-T2 + S5-T3 + S5-T4 + S5-T5
- **涉及文件**：Playwright 测试
- **验证方式**：
  ```bash
  cd orion-frontend && npx playwright test --grep "ticketdetail-full-flow"  # 应通过
  ```
- **回滚步骤**：Playwright 测试文件 revert

#### S5-T12：Console/DashboardNew e2e

- **任务描述**：Console QuickNav 跳转 + DashboardNew 错误态展示 e2e
- **前置依赖**：S5-T7 + S5-T8 + S5-T9 + S5-T10
- **涉及文件**：Playwright 测试
- **验证方式**：
  ```bash
  cd orion-frontend && npx playwright test --grep "console-dashboard"  # 应通过
  ```
- **回滚步骤**：Playwright 测试文件 revert

#### S5 出口门控

```bash
# 门控 1：TicketDetail 5 P1 全部修复
grep -c "Modal.confirm" orion-frontend/src/pages/TicketDetail/useTicketDetailState.ts  # 应 >=1
grep -c "confirmLoading" orion-frontend/src/pages/TicketDetail/TicketDetailModals.tsx  # 应 >=4
grep -c "await submitComment\|await escalateTicket" orion-frontend/src/pages/TicketDetail/  # 应 >=2

# 门控 2：Console 3 P1 全部修复
grep -c "window.location.href" orion-frontend/src/pages/Console/  # 应为 0
grep -c "FALLBACK_STATS\|演示数据" orion-frontend/src/pages/Console/  # 应为 0

# 门控 3：DashboardNew 2 P1 全部修复
grep -c 'type="warning"' orion-frontend/src/pages/DashboardNew/index.tsx  # 应为 0

# 门控 4：Playwright e2e 通过
cd orion-frontend && npx playwright test --grep "ticketdetail-full-flow|console-dashboard"
```

---

### 4.7 阶段 S6：跨模块集成（8 项）

> **目标**：把 chaos / inspection / risk / scenario / notification / approval / report-designer / cron 打通；确保事件流、审批流、通知流全部可用。
> **策略**：先建 EventBus 桥接，再建业务流（审批 / 通知 / 调度）。

#### S6-T1：chaos ↔ risk 门控（高风险实验需审批）

- **任务描述**：按 upgrade-design-plan §4.1，chaos RunExperiment 检查 experiment.RiskID 时，若 risk.Color == "red" 且无 approval_id，拒绝执行
- **前置依赖**：S3-T7（risk 模块）+ S3-T9（chaos Experiment 字段扩展）
- **涉及文件**：`orion-platform-svc-go/internal/chaos/service/service.go`
- **验证方式**：
  ```bash
  grep -n "RiskID\|RequiresApproval\|approval" orion-platform-svc-go/internal/chaos/service/service.go  # 应 >=5
  ```
- **回滚步骤**：service.go revert

#### S6-T2：chaos ↔ scenario 关联日志

- **任务描述**：chaos RunExperiment 若 experiment.ScenarioID 非空，调 scenarioService.LogExecution
- **前置依赖**：S3-T8（scenario 模块）+ S3-T9
- **涉及文件**：`orion-platform-svc-go/internal/chaos/service/service.go`
- **验证方式**：
  ```bash
  grep -n "ScenarioID\|LogExecution" orion-platform-svc-go/internal/chaos/service/service.go  # 应 >=2
  ```
- **回滚步骤**：service.go revert

#### S6-T3：chaos ↔ notification（实验完成通知）

- **任务描述**：chaos RunExperiment 完成后发 `chaos_experiment_completed` 通知
- **前置依赖**：S6-T1 + 现有 notification 模块
- **涉及文件**：`orion-platform-svc-go/internal/chaos/service/service.go` + notification 模块
- **验证方式**：
  ```bash
  grep -n "NotificationService\|chaos_experiment_completed" orion-platform-svc-go/internal/chaos/  # 应 >=2
  ```
- **回滚步骤**：service.go revert

#### S6-T4：chaos ↔ approval（高风险审批门控）

- **任务描述**：chaos Create 时若 risk.Color == "red"，自动创建 approval 请求；RequiresApproval = true
- **前置依赖**：S3-T7 + 现有 approval 模块
- **涉及文件**：`orion-platform-svc-go/internal/chaos/service/service.go` + approval 模块
- **验证方式**：
  ```bash
  grep -n "ApprovalService\|Create.*Approval" orion-platform-svc-go/internal/chaos/  # 应 >=2
  ```
- **回滚步骤**：service.go revert

#### S6-T5：inspection ↔ notification（报告完成邮件）

- **任务描述**：inspection-report ExportReport 完成后发 `chaos_experiment_completed` 类型通知
- **前置依赖**：S3-T5（inspection-report 模块）+ notification 模块
- **涉及文件**：`orion-platform-svc-go/internal/inspection-report/service/service.go`
- **验证方式**：
  ```bash
  grep -n "NotificationService\|SendEmail" orion-platform-svc-go/internal/inspection-report/  # 应 >=2
  ```
- **回滚步骤**：service.go revert

#### S6-T6：inspection ↔ report-designer（复用报告执行内核）

- **任务描述**：inspection-report ExportReport 复用 report-designer 的 ExecuteReport；不重复实现渲染引擎
- **前置依赖**：S3-T5 + 现有 report-designer 模块
- **涉及文件**：`orion-platform-svc-go/internal/inspection-report/service/service.go` + report-designer 模块
- **验证方式**：
  ```bash
  grep -n "ReportService\|ExecuteReport" orion-platform-svc-go/internal/inspection-report/  # 应 >=2
  ```
- **回滚步骤**：service.go revert

#### S6-T7：PipelineEngine StageExecutor 风险前置

- **任务描述**：按 upgrade-design-plan §4.7，Pipeline 执行前查 risk 级别；red 级未审批则拒绝
- **前置依赖**：S3-T7 + 现有 PipelineEngine
- **涉及文件**：`orion-platform-svc-go/internal/pipeline-engine/service/StageExecutor.go`
- **验证方式**：
  ```bash
  grep -n "RiskID\|RequiresApproval" orion-platform-svc-go/internal/pipeline-engine/service/StageExecutor.go  # 应 >=2
  ```
- **回滚步骤**：StageExecutor.go revert

#### S6-ADR1：Pipeline ArtifactBus Migration 730-731（ADR-014 落地）

- **任务描述**：Migration 730 新建 `pipeline_artifacts` 表（id / run_id / stage_id / key / value / size / created_at / expires_at）；Migration 731 `pipeline_runs` ALTER 加 `artifact_ref` 列
- **前置依赖**：S0-ADR1（TenantAwareDB）+ S3-T2（号段预留）
- **关联 ADR**：ADR-014（Pipeline ArtifactBus，方案 B + Feature Flag 灰度）
- **涉及文件**：
  - `orion-platform-svc-go/migrations/730_create_pipeline_artifacts.sql`
  - `orion-platform-svc-go/migrations/731_alter_pipeline_runs_artifact.sql`
- **验证方式**：
  ```bash
  ls orion-platform-svc-go/migrations/73[0-1]_*.sql 2>/dev/null | wc -l  # 应 >=2
  cd orion-platform-svc-go && go test ./migrations/... -run TestArtifactBus -count=1  # 应通过
  ```
- **回滚步骤**：每张 Migration 有对应 down.sql
- **备注**：配合 Feature Flag `artifact_bus.enabled` 灰度，非破坏性

#### S6-ADR2：AlertBreaker Migration 736 + 事务单测（ADR-010 落地）

- **任务描述**：Migration 736 新建 `alert_breaker_state` 表（id / tenant_id / rule_id / window_start / window_end / count / status）；实现 `SELECT FOR UPDATE` 行锁并发模型；5 用例事务单测（正常/超时/死锁/热点/多租户）+ 4 项 Prometheus 指标
- **前置依赖**：S0-ADR1（TenantAwareDB）+ S2-T9（Alert 租户隔离）
- **关联 ADR**：ADR-010（AlertBreaker 并发模型选型，方案 A: PG 行锁）
- **涉及文件**：
  - `orion-platform-svc-go/migrations/736_create_alert_breaker_state.sql`
  - `orion-platform-svc-go/internal/alert/breaker/{state,lock}.go`
  - `orion-platform-svc-go/internal/alert/breaker/state_test.go`
- **验证方式**：
  ```bash
  # Migration 存在
  ls orion-platform-svc-go/migrations/736_*.sql 2>/dev/null  # 应 >=1
  # 行锁实现
  grep -rn "SELECT FOR UPDATE\|FOR UPDATE" orion-platform-svc-go/internal/alert/breaker/  # 应 >=1
  # 5 用例单测
  cd orion-platform-svc-go && go test ./internal/alert/breaker/... -run TestAlertBreaker -count=1 -v  # 5 用例通过
  # 4 项 Prometheus 指标
  grep -rn "lock_duration\|deadlock\|txn_timeout\|pg_connections" orion-platform-svc-go/internal/alert/breaker/  # 应 >=4
  ```
- **回滚步骤**：Migration down.sql + breaker/ 目录删除
- **备注**：5s 事务超时硬限制（ADR-010 §6.1）

#### S6-T8：EventBus 跨模块事件桥接

- **任务描述**：新建 EventBus 桥接层，把 chaos_experiments / inspection_reports / approval_decisions / notification_sent 4 类事件统一发布
- **前置依赖**：S6-T1 + S6-T2 + S6-T3 + S6-T4 + S6-T5 + S6-T6 + S6-T7
- **涉及文件**：`orion-platform-svc-go/internal/eventbus/{producer,consumer}.go`
- **验证方式**：
  ```bash
  find orion-platform-svc-go/internal/eventbus/ -name "*.go" | wc -l  # 应 >=4
  grep -rn "chaos_experiment\|inspection_report\|approval_decision" orion-platform-svc-go/internal/eventbus/  # 应 >=4
  ```
- **回滚步骤**：整个 eventbus/ 目录 revert

#### S6 出口门控

```bash
# 门控 1：全链 e2e（chaos → risk → approval → notification）
cd orion-platform-svc-go && go test ./internal/chaos/... -run TestE2E_HighRiskApproval  # 应通过

# 门控 2：EventBus 事件流
cd orion-platform-svc-go && go test ./internal/eventbus/... -run TestEventFlow  # 应通过

# 门控 3：Saga 事务一致性（chaos 失败时 approval 回滚）
cd orion-platform-svc-go && go test ./internal/saga/... -run TestSaga_ChaosRollback  # 应通过

# 门控 4：inspection → notification 桥接
cd orion-platform-svc-go && go test ./internal/inspection-report/... -run TestReportNotify  # 应通过
```

---

### 4.8 阶段 S7：RDM 止损（3 项）

> **目标**：RDM 前端 40+ API 404 止损 + 4 Tab 契约匹配 + statistics/code-review 后端补齐。
> **来源**：v5 §6.5 新增阻塞门控（R-P0-04 / R-P0-05）+ G1 §2.5 D 类待执行。
> **策略**：先止损（404→200 空数组），再补真实实现。

#### S7-T1：RDM statistics 3 端点最小实现

- **任务描述**：实现 `/rdm/statistics/burndown`、`/rdm/statistics/defects`、`/rdm/statistics/velocity` 3 个端点，最小返回 200 + 空数组；后续补真实统计逻辑
- **前置依赖**：S2-T10（RDM API 最小实现）
- **涉及文件**：`orion-platform-svc-go/internal/rdm/{handler,service}/statistics.go`
- **验证方式**：
  ```bash
  # 3 端点全部返回 200
  grep -n "burndown\|defects\|velocity" orion-platform-svc-go/internal/rdm/handler/routes.go  # 应 >=3
  cd orion-platform-svc-go && go test ./internal/rdm/... -run TestStatistics -count=1  # 应通过
  ```
- **回滚步骤**：statistics.go revert + routes.go revert
- **关联风险**：R-P0-04

#### S7-T2：RDM code-review handler 实现

- **任务描述**：实现 `/rdm/code-reviews` 端点（GET List + POST Create + GET Detail + PUT Update + DELETE），前端 Tab 可展示
- **前置依赖**：S2-T10
- **涉及文件**：`orion-platform-svc-go/internal/rdm/{handler,service,models}/code_review.go`
- **验证方式**：
  ```bash
  grep -n "code-reviews\|CodeReview" orion-platform-svc-go/internal/rdm/handler/routes.go  # 应 >=5
  cd orion-platform-svc-go && go test ./internal/rdm/... -run TestCodeReview -count=1  # 应通过
  ```
- **回滚步骤**：code_review.go 文件删除 + routes.go revert
- **关联风险**：R-P0-05

#### S7-T3：RDM 4 Tab 契约匹配验证

- **任务描述**：验证前端 4 Tab（需求/缺陷/迭代/任务）各自 ≥2 端点全部返回 200；前后端字段契约一致
- **前置依赖**：S7-T1 + S7-T2 + S2-T10
- **涉及文件**：`orion-platform-svc-go/internal/rdm/handler/routes.go` + 前端 `orion-frontend/src/pages/RDM/`
- **验证方式**：
  ```bash
  # 4 Tab 各 ≥2 端点
  grep -c "requirements\|defects\|sprints\|tasks" orion-platform-svc-go/internal/rdm/handler/routes.go  # 应 >=8
  # 前后端字段匹配
  cd orion-platform-svc-go && go test ./internal/rdm/... -run TestTabContract -count=1  # 应通过
  ```
- **回滚步骤**：无代码变更（验证任务）

#### S7 出口门控

```bash
# 门控 1：statistics 3 端点 200
grep -n "burndown\|defects\|velocity" orion-platform-svc-go/internal/rdm/handler/routes.go  # 应 >=3

# 门控 2：code-reviews 端点 200
grep -n "code-reviews" orion-platform-svc-go/internal/rdm/handler/routes.go  # 应 >=1

# 门控 3：4 Tab 契约匹配
grep -c "requirements\|defects\|sprints\|tasks" orion-platform-svc-go/internal/rdm/handler/routes.go  # 应 >=8
```

---

### 4.9 阶段 S8：P2 次要项（可选，15 项）

> **目标**：清理 P2 次要前端缺陷（假数据 / 响应式 / 色值 / 命名）
> **来源**：`frontend-fix-tasks-2026-10-03.md` §3 + G1 §8.2
> **约束**：非阻塞，S5（P1）完成后按需推进
> **依赖**：S5-T8/T9/T10（P2-8/9/10 假数据清理与 P1 联动）

#### S8-T1：假数据清理（P2-8/9/10，与 S5 联动）

- **任务描述**：`useDashboardState.ts:30` 硬编码空数组删；`:64-75` fallback 假数据删；`index.tsx:65-72` Alert `type="warning"` 改 `"error"`
- **前置依赖**：S5-T10（DashboardNew P1 修复）
- **涉及文件**：`orion-frontend/src/pages/DashboardNew/{index.tsx,useDashboardState.ts}`
- **验证方式**：
  ```bash
  grep -c "fallback\|演示数据\|hardcode.*\[\]" orion-frontend/src/pages/DashboardNew/  # 应为 0
  grep 'type="error"' orion-frontend/src/pages/DashboardNew/index.tsx  # 应存在
  ```

#### S8-T2：响应式断点补齐（P2-11）

- **任务描述**：全仓 30+ 处 `<Row gutter>` 补 `xs/sm/md/lg` 响应式断点；`<768px` 不挤压
- **前置依赖**：S5 完成
- **涉及文件**：全仓 `orion-frontend/src/**/*.tsx`
- **验证方式**：
  ```bash
  grep -rn "Row gutter" orion-frontend/src/ --include="*.tsx" | grep -v "xs\|sm\|md\|lg" | wc -l  # 目标 <5
  ```

#### S8-T3：Token 色值统一（P2-12/P2-14）

- **任务描述**：全仓 `'blue'` 语义色名 → `colors.primary[500]`；`fontSize: spacing[3]` → `fontSize: 12` 或 `fontSize: tokens.fontSize.sm`
- **前置依赖**：S5 完成
- **涉及文件**：全仓
- **验证方式**：
  ```bash
  grep -rn "'blue'\|'red'\|'green'" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 <10
  grep -rn "fontSize.*spacing\[" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 0
  ```

#### S8-T4：TicketDetail/Console 交互细节（P2-1~P2-7）

- **任务描述**：P2-1 "未分配"补 onClick；P2-2 Avatar hover 悬浮；P2-3 spacing 命名修正；P2-4 engineers 用 User 类型；P2-5/6 refresh 禁用态；P2-7 QuickNav 视觉优化
- **前置依赖**：S5-T1~T6（TicketDetail P1 全修）
- **涉及文件**：`orion-frontend/src/pages/TicketDetail/*.tsx` + `Console/*.tsx`
- **验证方式**：
  ```bash
  grep -c "onClick\|disabled" orion-frontend/src/pages/Console/useConsoleState.ts  # 应 >=2
  grep -c "User.*type\|interface User" orion-frontend/src/pages/TicketDetail/TicketDetailModals.tsx  # 应 >=1
  ```

#### S8-T5：全局 UX 细节（P2-13/P2-15）

- **任务描述**：Card `size="small"` 过多处补 `size="default"` 分层；`<Empty>` 补引导按钮
- **前置依赖**：S5 完成
- **涉及文件**：全仓
- **验证方式**：
  ```bash
  grep -rn 'size="small"' orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 <100（从 ~200）
  grep -rn "<Empty" orion-frontend/src/ --include="*.tsx" | grep -c "Button\|onClick"  # 目标 >10
  ```

#### S8 出口门控（非阻塞）

```bash
# 门控 1：假数据清理
grep -c "fallback\|演示数据" orion-frontend/src/pages/DashboardNew/  # 应为 0

# 门控 2：响应式断点
grep -rn "Row gutter" orion-frontend/src/ --include="*.tsx" | grep -v "xs\|sm\|md\|lg" | wc -l  # 目标 <5

# 门控 3：Token 统一
grep -rn "'blue'\|'red'" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 <10
```

---

## 4.10 后续批次：48 子域分批补齐（参考）

> **来源**：`upgrade-design-plan-2026-10-01.md` §12 + G1 §8.1
> **状态**：第 1 批（6 子域）已纳入 S3；第 2-9 批为后续 Phase
> **本手册不展开任务定义**，仅做批次汇总

| 批次 | 子域 | 数量 | 优先级 | Y 手册对应 |
|------|------|------|--------|-----------|
| 第 1 批 | threshold/configfile/report/problem/risk/scenario | 6 | P0 | ✅ S3 已纳入 |
| 第 2 批 | CMDB citype/attr/validator/discovery | 4 | P1 | ⏳ S2-T5 仅 citype |
| 第 3 批 | ITSM workcenter/channel/channeltype | 3 | P1 | ⏳ S2-T7/T8 部分覆盖 |
| 第 4 批 | BI widget/ReportSqlGraph/Import-Export | 3 | P1 | ⏳ v5 降为可选 |
| 第 5 批 | 告警 IAlertEventHandler/AlertEventManager/AlertAdapterLoader | 3 | P2 | ⏳ S2-T9 部分覆盖 |
| 第 6 批 | CMDB 13 子域 | 13 | P2 | ⏳ 后续 Phase |
| 第 7 批 | 自动化 9 子域 | 9 | P2 | ⏳ 后续 Phase |
| 第 8 批 | RDM sprint/report/board/template | 4 | P2 | ⏳ S7 止损先行 |
| 第 9 批 | DevOps runner-protocol/helm/argocd/canary | 4 | P3 | ⚠️ v5 撤回为可选 |

---

## 4.11 后续批次任务卡（第 2-8 批，39 子域）

> **状态**：第 1 批（6 子域）已在 S3 落地；第 9 批（4 子域）v5 撤回。本节为第 2-8 批 39 子域提供任务卡级定义。
> **约束**：本节任务为**后续 Phase**，不在 S0-S8 当前执行范围内。每张任务卡含目标路径 / API 契约 / Migration / grep 验证。
> **优先级**：P1（第 2-4 批，10 子域）/ P2（第 5-8 批，29 子域）

### 4.11.1 第 2 批：CMDB 4 子域（P1）

#### B2-T1：CMDB CI Type Registry（citype）

- **目标**：从 TS CITypeService 469 行移植 CI 类型 CRUD + 属性绑定 + 版本控制
- **涉及文件**：`internal/cmdb/citype/{service,repository,handler,models}.go` + 前端 `src/pages/CMDB/CITypes/`
- **Migration**：`700_cmdb_ci_types.sql`（ADR-013 已分配）+ `701_cmdb_cis_alter_type_id.sql`
- **API 契约**：
  - `POST /api/v1/cmdb/v2/citypes` — 创建 CI 类型
  - `GET /api/v1/cmdb/v2/citypes` — 列表（分页 + 租户过滤）
  - `GET /api/v1/cmdb/v2/citypes/:id` — 详情（含属性绑定）
  - `PUT /api/v1/cmdb/v2/citypes/:id` — 更新
  - `DELETE /api/v1/cmdb/v2/citypes/:id` — 删除（软删）
  - `POST /api/v1/cmdb/v2/citypes/:id/attrs` — 绑定属性
  - `GET /api/v1/cmdb/v2/citypes/:id/attrs` — 属性列表
- **grep 验证**：
  ```bash
  grep -rn "CIType\|citype" internal/cmdb/citype/ | wc -l  # 应 >=20
  ls migrations/700_*.sql migrations/701_*.sql 2>/dev/null  # 应 >=2
  ```
- **前置依赖**：ADR-013 已决策（方案 C：2 层渐进）+ S2-ADR1（Migration 700-702）
- **来源**：`cmdb-upgrade-design §G0-1` + `upgrade-design-plan §12` L1250-1336

#### B2-T2：CMDB Attribute 系统（attr）

- **目标**：CI 属性定义 / 类型 / 约束（unique/null/enumeration）/ EAV 存储
- **涉及文件**：`internal/cmdb/attr/{service,repository,handler,models}.go`
- **Migration**：`703_cmdb_ci_attributes.sql`（AA 原始分配）
- **API 契约**：`/api/v1/cmdb/v2/attributes` CRUD 4 端点 + 类型绑定 2 端点
- **grep 验证**：`grep -rn "Attribute\|attr" internal/cmdb/attr/ | wc -l  # 应 >=15`
- **前置依赖**：B2-T1（citype 先建，attr 绑定到 type）

#### B2-T3：CMDB Validator 服务封装（validator）

- **目标**：`internal/cmdb-validator/` 补 `service/` 目录（当前 handler 直连 repo 反模式）→ 11 引擎通过 service 暴露
- **涉及文件**：`internal/cmdb-validator/service/validator_service.go`（新建）
- **grep 验证**：
  ```bash
  ls internal/cmdb-validator/service/ 2>/dev/null  # 应存在
  grep -rn "ValidatorService" internal/cmdb-validator/ | wc -l  # 应 >=5
  ```
- **前置依赖**：B2-T2（attr 定义校验规则）
- **来源**：`cmdb-upgrade-design §G0-2` + 方法级 `cmdb-itsm-method-level` L631

#### B2-T4：CMDB Discovery 规则激活（discovery）

- **目标**：608 已建 `discovery_jobs` 表但无规则定义 → 激活为 5 端点
- **涉及文件**：`internal/cmdb/discovery/{service,handler}.go`
- **Migration**：`704_cmdb_discovery_rules.sql`（AA 原始）
- **API 契约**：`/api/v1/cmdb/v2/discovery/jobs` CRUD 5 端点 + `/trigger` 手动触发
- **grep 验证**：`grep -rn "discovery\|DiscoveryRule" internal/cmdb/discovery/ | wc -l  # 应 >=10`
- **前置依赖**：B2-T1（citype 定义 discovery 目标 CI 类型）

### 4.11.2 第 3 批：ITSM 3 子域（P1）

#### B3-T1：ITSM Workcenter 模块新建（workcenter）

- **目标**：workcenter 完全新建（24 API），工单工作台聚合视图
- **涉及文件**：`internal/workcenter/{service,repository,handler,models}.go` + 前端 `src/pages/Workcenter/`
- **Migration**：`710_itsm_workcenter_tables.sql`（AA 原始）— workitem/queue/assignment/assignment_history 4 表
- **API 契约**：`/api/v1/itsm/workcenter/*` 24 端点（views CRUD 5 + todo 列表 3 + queue 6 + assignment 6 + statistics 4）
- **grep 验证**：
  ```bash
  ls internal/workcenter/ 2>/dev/null | wc -l  # 应 >=4
  grep -rn "WorkcenterService" internal/workcenter/ | wc -l  # 应 >=5
  ```
- **前置依赖**：S2-T7（ITSM workflow 引擎就绪）
- **来源**：`itsm-upgrade-design §P1-1` + `upgrade-design-plan §12` L1350-1397

#### B3-T2：ITSM Channel Type 元数据（channeltype）

- **目标**：channel 本体已有 546 行，补 channeltype 元数据模型
- **涉及文件**：`internal/channel/channeltype/{models,repository}.go`
- **Migration**：`711_itsm_channel_types.sql`（AA 原始）
- **API 契约**：`/api/v1/itsm/channel-types` CRUD 4 端点
- **grep 验证**：`grep -rn "ChannelType\|channeltype" internal/channel/ | wc -l  # 应 >=8`

#### B3-T3：ITSM Channel 服务层完善（channel）

- **目标**：channel 546 行 CRUD 完善通知渠道元数据管理
- **涉及文件**：`internal/channel/service/channel_service.go`
- **grep 验证**：`grep -rn "ChannelService" internal/channel/service/ | wc -l  # 应 >=5`
- **前置依赖**：B3-T2（channeltype 先定义元数据）

### 4.11.3 第 4 批：BI 3 子域（P1，v5 降级后可选）

#### B4-T1：BI Widget 组件（widget）

- **目标**：补齐 JFreeChart 对标的 10 种 widget（Bar/Pie/Line/Table/Stacked/Gauge/Map/Heatmap/Treemap/Sankey）
- **涉及文件**：`internal/bi/widget/{service,renderer,handler}.go` + 前端 `src/pages/BI/Widgets/`
- **Migration**：`732_bi_widgets.sql`（AA 原始）— widget 配置 + 数据源绑定
- **API 契约**：`/api/v1/bi/widgets` CRUD 5 端点 + `/preview` 数据预览
- **grep 验证**：`grep -rn "Widget\|widget" internal/bi/widget/ | wc -l  # 应 >=15`
- **前置依赖**：S2（后端 API 就绪）
- **NL 依据**：NL-3 证实 NeatLogic 10 个 `DrawXxx` widget 是真实 JFreeChart 实现

#### B4-T2：BI ReportSqlGraph 血缘（ReportSqlGraph）

- **目标**：字段级血缘图存储 + 可视化查询
- **涉及文件**：`internal/bi/lineage/{service,repository}.go`
- **Migration**：`733_bi_sql_graph.sql`（AA 原始）
- **grep 验证**：`grep -rn "SqlGraph\|lineage" internal/bi/lineage/ | wc -l  # 应 >=10`

#### B4-T3：BI Import/Export（Import-Export）

- **目标**：报表模板 JSON 导入导出 + 跨环境迁移
- **涉及文件**：`internal/bi/io/{importer,exporter}.go`
- **grep 验证**：`grep -rn "Import\|Export" internal/bi/io/ | wc -l  # 应 >=8`

### 4.11.4 第 5 批：告警 3 子域（P2）

#### B5-T1：IAlertEventHandler 接口（IAlertEventHandler）

- **目标**：Go interface 替代 Java SPI，统一事件处理器注册（ADR-012 Factory 模式落地）
- **涉及文件**：`internal/alert/handler/handler_factory.go`（注册到 ADR-012 Factory）
- **API 契约**：`/api/v1/alerts/handlers` — 列表已注册 handler + `/test` 手动触发
- **grep 验证**：`grep -rn "AlertEventHandler\|EventHandlerFactory" internal/alert/ | wc -l  # 应 >=10`
- **前置依赖**：ADR-T14/T15（ADR-012 Factory 落地）+ S2-T9（Alert 租户隔离）
- **NL 依据**：NL-3 证实 NL `AlertEventHandlerFactory` 有 25+ event handlers

#### B5-T2：AlertEventManager 事件分发（AlertEventManager）

- **目标**：事件分发引擎 — 接收 Alert 触发 → 匹配 EventHandler → 执行
- **涉及文件**：`internal/alert/manager/event_manager.go`
- **grep 验证**：`grep -rn "AlertEventManager\|EventManager" internal/alert/manager/ | wc -l  # 应 >=8`
- **前置依赖**：B5-T1（handler 注册就绪）

#### B5-T3：AlertAdapterLoader 适配器加载（AlertAdapterLoader）

- **目标**：动态加载 Alert 适配器（v1/v2 兼容期）
- **涉及文件**：`internal/alert/adapter/loader.go`
- **grep 验证**：`grep -rn "AdapterLoader\|adapter" internal/alert/adapter/ | wc -l  # 应 >=6`
- **前置依赖**：B5-T1 + B5-T2

### 4.11.5 第 6 批：CMDB 13 子域（P2，后续 Phase）

| 子域 | 目标 | Migration | API 端点数 | grep 验证关键词 |
|------|------|-----------|-----------|---------------|
| transaction | TransactionGroup 事务组 + Commit/Recover | 740 | 6 | `TransactionGroup\|CiTransaction` |
| legalvalid | CI 合法性校验规则 | 741 | 4 | `LegalValid\|legalvalid` |
| customview | 自定义 CI 视图 | 742 | 5 | `CustomView\|customview` |
| globalattr | 全局属性定义 | 743 | 4 | `GlobalAttr\|globalattr` |
| group | CI 分组 | 744 | 4 | `CiGroup\|cigroup` |
| graph | CI 关系图查询 | 745 | 3 | `CiGraph\|graph` |
| mongodb | MongoDB CI 存储扩展 | 746 | 0（配置） | `mongo.*ci\|CiMongo` |
| globalsearch | 全局 CI 搜索 | 747 | 2 | `GlobalSearch\|globalsearch` |
| tag | CI 标签 | 748 | 4 | `CiTag\|citag` |
| mq | CI 变更消息队列 | 749 | 0（消费者） | `CiMq\|ci_mq` |
| sync | CI 跨源同步 | 750 | 3 | `CiSync\|cisync` |
| reltype | CI 关系类型定义 | 751 | 4 | `RelType\|reltype` |
| ciview | CI 视图渲染引擎 | 752 | 3 | `CiView\|ciview` |

> **说明**：13 子域均为 P2 后续 Phase，Migration 号段 740-752 与 AA 原始分配一致。每子域约 2-4 个 Go 文件 + 3-6 API 端点。NL-1 证实 NL 有 TransactionGroup + Snapshot + Commit/Recover 两阶段提交，Orion 完全无。

### 4.11.6 第 7 批：自动化 9 子域（P2，后续 Phase）

| 子域 | 目标 | Migration | API 端点数 | grep 验证关键词 |
|------|------|-----------|-----------|---------------|
| catalog | 自动化服务目录 | 722 | 6 | `Catalog\|catalog` |
| customtemplate | 用户自定义模板 | 723 | 4 | `CustomTemplate\|customtemplate` |
| job | 自动化作业 | 724 | 5 | `Job\|automation_job` |
| operation | 操作历史 | 725 | 3 | `Operation\|automation_op` |
| process | 流程编排 | 726 | 4 | `Process\|automation_process` |
| profile | 配置模板 | 727 | 4 | `Profile\|automation_profile` |
| schedule | 定时调度 | 728 | 3 | `Schedule\|automation_schedule` |
| tool | 工具注册 | 729 | 4 | `Tool\|automation_tool` |
| type | 作业类型 | 730 | 0（枚举） | `Type\|automation_type` |

> **说明**：9 子域均为 P2 后续 Phase。NL-2 证实 NL autoexec 5 子域（catalog/combop/customtemplate/profile/scenario）全部存在，Orion 硬缺失 5 个已在 S3-T7/T8 补齐。本批 9 子域是 NL 已有但 Orion 弱覆盖/完全缺失的补充。

### 4.11.7 第 8 批：RDM 4 子域（P2，S7 止损先行）

| 子域 | 目标 | Migration | API 端点数 | grep 验证关键词 | 与 S7 关系 |
|------|------|-----------|-----------|---------------|-----------|
| sprint | Sprint 管理 CRUD | 753 | 6 | `Sprint\|sprint` | S7-T1 止损 statistics，本批补 CRUD |
| report | RDM 报表 | 754 | 4 | `RdmReport\|rdm_report` | S7-T3 合约验证，本批补实现 |
| board | 看板视图 | 755 | 4 | `Board\|rdm_board` | — |
| report-template | 报表模板 | 756 | 4 | `ReportTemplate\|rdm_template` | — |

> **说明**：4 子域均为 P2。S7 阶段（S7-T1/T2/T3）已止损 statistics + code-review + 合约验证。本批补齐 Sprint CRUD + 报表 + 看板 + 模板的完整实现。NL-3 证实 NL RDM 99 Api.java，Orion 前后端 59-85% 匹配，缺口主要在统计与报表。

### 4.11.8 任务卡汇总统计

| 批次 | 子域数 | 任务数 | Migration 范围 | 优先级 | 预计 API 端点 |
|------|--------|--------|---------------|--------|-------------|
| 第 2 批 | 4 | B2-T1~T4 | 700-704（部分 ADR 已分配） | P1 | ~25 |
| 第 3 批 | 3 | B3-T1~T3 | 710-711 | P1 | ~32 |
| 第 4 批 | 3 | B4-T1~T3 | 732-733 | P1（v5 降级可选） | ~14 |
| 第 5 批 | 3 | B5-T1~T3 | —（代码层，无新表） | P2 | ~6 |
| 第 6 批 | 13 | 表格行 | 740-752 | P2 | ~46 |
| 第 7 批 | 9 | 表格行 | 722-730 | P2 | ~33 |
| 第 8 批 | 4 | 表格行 | 753-756 | P2 | ~18 |
| **合计** | **39** | **16 详细卡 + 23 表格行** | **700-756** | | **~174 API** |

> **与 G1 §8.1 对齐**：39 子域 + 第 1 批 6 子域（S3 已落地）+ 第 9 批 4 子域（v5 撤回）= 49 总子域。去重后 48 原始 + 1 discovery（B2-T4 新增）= 49。与 G1 一致。

---

## 5. 依赖 DAG 详细图

### 5.1 完整任务依赖图

```
[无前置]
  S0-T1 错误码常量 ─┐
  S0-T2 Repository ─┤
  S0-T3 axios ──────┤
  S0-T4 ESLint ─────┤
  S0-T5 Migration ──┤
  S0-T6 motion CSS ─┘

[S0 出口门控通过]
  │
  ├─→ S1-T1 Layout 导航  ←── S0-T4
  ├─→ S1-T2 div onClick   ←── S0-T4, S1-T1
  ├─→ S1-T3 Card hover    ←── S0-T4
  ├─→ S1-T4 Text onClick  ←── S0-T4
  ├─→ S1-T5 Button aria   ←── S0-T4
  ├─→ S1-T6 Table caption ←── S0-T4
  ├─→ S1-T7 Form rules    ←── S0-T4
  ├─→ S1-T8 tabIndex      ←── S1-T2, S1-T3, S1-T4
  ├─→ S1-T9 img alt       ←── S0-T4
  ├─→ S1-T10 aria-live    ←── S0-T4
  ├─→ S1-T11 focus CSS    ←── S0-T6
  └─→ S1-T12 Clickable    ←── S0-T4

  ├─→ S2-T1 RunInspect    ←── S0-T1, S0-T2
  ├─→ S2-T2 chaos 静默    ←── S0-T1
  ├─→ S2-T3 PreRelease    ←── S0-T1, S2-T1
  ├─→ S2-T4 transport 解冻 ←── S0-T1, S0-T2, S2-T1
  ├─→ S2-T5 CMDB CI 类型  ←── S0-T1, S0-T2, S2-T4
  ├─→ S2-T6 Ticket 加字段 ←── S0-T5, S0-T2
  ├─→ S2-T7 workflow      ←── S0-T1, S0-T2
  ├─→ S2-T8 状态机        ←── S0-T2
  ├─→ S2-T9 Alert 隔离    ←── S0-T2
  └─→ S2-T10 RDM API      ←── S0-T1, S0-T2, S2-T6

[S2 出口门控通过]
  │
  ├─→ S3-T1 MongoDB       ←── S0-T1
  ├─→ S3-T2 Migration     ←── S0-T5
  ├─→ S3-T3 threshold     ←── S3-T1, S3-T2, S0-T1
  ├─→ S3-T4 configfile    ←── S3-T2, S0-T1, S0-T2
  ├─→ S3-T5 report        ←── S3-T2, S3-T4, S0-T1
  ├─→ S3-T6 problem       ←── S3-T2, S3-T5
  ├─→ S3-T7 risk          ←── S3-T2, S0-T1, S0-T2
  ├─→ S3-T8 scenario      ←── S3-T2, S3-T7
  ├─→ S3-T9 chaos ALTER   ←── S3-T2, S3-T7, S3-T8
  ├─→ S3-T10 chaos 端点   ←── S3-T9, S3-T7, S3-T8
  ├─→ S3-T11 routes_v2    ←── S3-T3, S3-T4, S3-T5, S3-T6
  ├─→ S3-T12 JSONPath     ←── S3-T3
  ├─→ S3-T13 cron         ←── S3-T5
  └─→ S3-T14 inspection接 ←── S2-T1, S3-T3, S3-T6

[S3 出口门控通过]
  │
  ├─→ S6-T1 chaos↔risk    ←── S3-T7, S3-T9
  ├─→ S6-T2 chaos↔scenario←── S3-T8, S3-T9
  ├─→ S6-T3 chaos↔notif   ←── S6-T1
  ├─→ S6-T4 chaos↔approval←── S3-T7
  ├─→ S6-T5 inspection↔notif←── S3-T5
  ├─→ S6-T6 inspection↔report-designer←── S3-T5
  ├─→ S6-T7 Pipeline risk ←── S3-T7
  └─→ S6-T8 EventBus      ←── S6-T1..S6-T7

[并行分支]
  S4-T1 k8s 依赖  ←── S0-T1
  S4-T2 K8sRunner ←── S4-T1
  S4-T3 HelmRunner←── S4-T1, S4-T2
  S4-T4 ArgoCDRunner←── S4-T1
  S4-T5 SAST      ←── S0-T1
  S4-T6 Protocol  ←── S4-T2, S4-T3, S4-T4

[S1 出口 + S2 出口通过]
  S5-T1..S5-T10 前端 P1  ←── S0-T4, S0-T3, S2-T6
  S5-T11..S5-T12 e2e     ←── S5-T1..S5-T10
```

### 5.2 关键路径（Critical Path）

```
路径 1（后端主链）：
  S0-T1 → S2-T1 → S2-T4 → S2-T5 → S3-T1 → S3-T3 → S3-T11 → S6-T8
  （错误码 → RunInspection → transport → CI 类型 → MongoDB → threshold → routes_v2 → EventBus）

路径 2（前端主链）：
  S0-T4 → S1-T1 → S1-T2 → S5-T1 → S5-T2 → S5-T11
  （ESLint → Layout → div onClick → TicketDetail 关闭 → 升级 API → e2e）

路径 3（协议扩展）：
  S0-T1 → S4-T1 → S4-T2 → S4-T3 → S4-T4 → S4-T6
  （错误码 → k8s SDK → K8sRunner → HelmRunner → ArgoCDRunner → Protocol）

路径 4（跨模块集成）：
  S3-T7 → S3-T9 → S6-T1 → S6-T2 → S6-T3 → S6-T8
  （risk → chaos ALTER → risk 门控 → scenario → notification → EventBus）
```

---

## 6. 阶段出口门控汇总

### 6.1 每阶段出口检查项

| 阶段 | 出口检查项 | 命令/标准 | 阻塞级别 |
|------|-----------|-----------|---------|
| S0 | go build 通过 | `go build ./...` 0 错误 | 阻塞 |
| S0 | 错误码覆盖 | `grep CLIENT.` ≥100 | 阻塞 |
| S0 | Repository tenant_id | 100% 覆盖 | 阻塞 |
| S0 | ESLint 规则 | `grep jsx-a11y` ≥3 | 阻塞 |
| S0 | motion CSS | `grep prefers-reduced-motion` =1 | 阻塞 |
| S1 | a11y 指标 | tabIndex>50, aria-label>200 等 | 阻塞 |
| S1 | ESLint 阻塞生效 | `npm run lint` 0 error | 阻塞 |
| S1 | Layout e2e | 8 大菜单 Playwright 通过 | 阻塞 |
| S2 | 4 假实现消失 | grep 应为 0 | 阻塞 |
| S2 | 3 transport 解冻 | build tag 移除 | 阻塞 |
| S2 | CMDB CI 类型 | 目录存在 ≥10 文件 | 阻塞 |
| S2 | Migration 699-702 | 4 张表跑通 | 阻塞 |
| S3 | 6 新模块 | 每个 ≥5 Go 文件 | 阻塞 |
| S3 | 66 API | 端到端可用 | 阻塞 |
| S3 | Migration 700-704 | 全部跑通 | 阻塞 |
| S4 | 4 协议 | Runner registry 有 4 | 阻塞 |
| S4 | CVE 命中 | SAST e2e 通过 | 阻塞 |
| S5 | TicketDetail 5 P1 | 5 项 grep 全通过 | 阻塞 |
| S5 | Console 3 P1 | 3 项 grep 全通过 | 阻塞 |
| S5 | DashboardNew 2 P1 | 2 项 grep 全通过 | 阻塞 |
| S5 | e2e | Playwright 通过 | 阻塞 |
| S6 | 全链 e2e | chaos → risk → approval → notification | 阻塞 |
| S6 | Saga 一致性 | chaos 失败时 approval 回滚 | 阻塞 |

### 6.2 每阶段"完成"定义（DoD）

- **S0 完成**：全仓编译 + 错误码统一 + ESLint 规则生效
- **S1 完成**：a11y 全仓指标达标 + ESLint 阻塞 + Layout e2e
- **S2 完成**：4 处假实现消失 + CMDB CI 类型服务可用 + Ticket 加字段
- **S3 完成**：4 新模块 + risk/scenario 66 API 端到端 + 5 张 Migration
- **S4 完成**：Runner 4 协议 + SAST 引擎（Trivy/Snyk）+ Kind e2e
- **S5 完成**：TicketDetail/Console/DashboardNew 3 页 P1 UI/UX 全修 + e2e
- **S6 完成**：chaos↔risk↔approval↔notification↔inspection↔report-designer 全链 + Saga 一致性

---

## 6.5 v5 门控更新（8 份 NL 一手代码实证反向同步，2026-10-03）

> **来源**：`cross-review-synthesis-2026-10-03-v5.md` + `risk-fallback-design-2026-10-03.md` §1.5
> **说明**：v5 综合报告证伪了 3 项"专家口吻幻觉"，本手册的 Stage Gate 指标需相应调整。

### 6.5.1 v5 新增门控（3 项阻塞级）

| 阶段 | 新增门控 | 命令/标准 | 阻塞级别 | 依据 |
|------|---------|-----------|---------|------|
| ~~**S4 前置**~~ | ~~AlertBreaker 并发模型选型决策~~ | ✅ **已决策**（ADR-010）：PG `SELECT FOR UPDATE` 行锁方案 A | ✅ **已关闭** | R-P0-03-v2 → ADR-010 |
| **S7** | **RDM statistics/burndown/velocity 3 后端** | `/rdm/statistics/burndown` `/defects` `/velocity` 三端点 200 | 阻塞 | R-P0-04：Orion 前端 4 个 statistics 调用目前全部 404 |
| **S7** | **RDM code-review handler** | `/rdm/code-reviews` 端点 200 | 阻塞 | R-P0-05：前端调 `/rdm/code-reviews`，Go 无 handler |

### 6.5.2 v5 撤回门控（1 项）

| 阶段 | 撤回门控 | 原因 | 依据 |
|------|---------|------|------|
| S4 | ~~Runner K8s/Helm/ArgoCD 集成~~ | v5 撤回——NL 一手也 0 实现，Orion 差异化优势而非 P0 缺口 | NL-8：K8s/Helm/ArgoCD/SSH/WinRM 全 0 命中 |

### 6.5.3 v5 数据修正门控（1 项）

| 阶段 | 修正项 | v4 门控 | v5 门控 | 依据 |
|------|-------|---------|---------|------|
| S5 | BI ExecuteReport 真实化 | 强制阻塞（BI 20% 判定） | **降级为 P1**（NL-3 证伪：10 JFreeChart widget + 7 Mapper 是真实实现，BI 实际 55-65%） | R-P1-01 |

### 6.5.4 v5 阶段出口门控汇总（新增/调整）

在 §6.1 表基础上追加：

| 阶段 | 新增/调整出口检查项 | 命令/标准 | 阻塞级别 |
|------|-------------------|-----------|---------|
| ~~**S4 前置**~~ | ~~AlertBreaker 并发模型选型 ADR 已产出~~ | ✅ **已产出**：`docs/adr/ADR-010-AlertBreaker-并发模型选型.md` | ✅ **已关闭** |
| **S4 前置** | AlertBreaker 事务边界单测通过 | 5 用例：正常/超时/死锁/热点/多租户 | 阻塞（ADR-010 §6.1）|
| **S4 前置** | `alert_breaker_state` 表 CRUD 测试通过 | Migration 736 应用 + Upsert 5 用例 | 阻塞（ADR-010 §6.1）|
| **S4 前置** | AlertBreaker Prometheus 指标就绪 | 4 项新指标：`lock_duration` / `deadlock` / `txn_timeout` / `pg_connections` | 阻塞（ADR-010 §4.2）|
| **S5** | BI ExecuteReport（**P1 非阻塞**） | 可选，若做则 e2e 通过 | 非阻塞 |
| **S7** | RDM 前端 404 止损 | `/rdm/statistics/*` + `/rdm/code-reviews` 全 200 | 阻塞 |
| **S7** | RDM 4 Tab 契约匹配 | 前端 4 Tab（需求/缺陷/迭代/任务）后端各 ≥2 端点 | 阻塞 |
| **全局** | NL 一手证伪 3 项幻觉不再作为决策依据 | 文档口径同步 | 非阻塞 |

### 6.5.5 v5 阶段"完成"定义（DoD 调整）

- **S4 前置完成**（新增，ADR-010 已定案）：AlertBreaker 并发模型 = **PG `SELECT FOR UPDATE` 行锁**（方案 A），5 用例事务单测 + state 表 CRUD + 4 项 Prometheus 指标全部就绪
- **S5 完成**（调整）：TicketDetail/Console/DashboardNew 3 页 P1 UI/UX 全修 + e2e + **BI 真实化从阻塞降为 P1**
- **S7 完成**（新增要求）：RDM 前端 404 全止损 + RDM 4 Tab 契约匹配
- **S4 完成**（调整）：**撤回 Runner K8s/Helm/ArgoCD 门控**；S4 只做 SSH/WinRM/K8s-Exec 3 协议 + SAST 引擎

---

## 6.6 v5.4 ADR 决策门控更新（5 ADR 落地同步，2026-10-03）

> **来源**：ADR-010~014 决策完成（合计 2279 行）
> **说明**：5 份 ADR 决策完成后，本手册的 Stage Gate 需按 ADR 决策同步。ADR-010 已同步在 §6.5，本节同步 ADR-011~014。

### 6.6.1 新增阻塞门控（3 项）

| 阶段 | 新增门控 | 命令/标准 | 阻塞级别 | 依据 |
|------|---------|-----------|---------|------|
| **S0 前置** | **TenantAwareDB 抽象层落地** | `internal/common/db/tenant_aware_db.go` 接口 + 单测 5 用例（shared/schema 双模式）| 阻塞 | ADR-011 §3.2 |
| **S1 前置** | **CMDB 2 层模型 Migration 落地** | Migration 700-702 应用 + `cmdb_ci_types` CRUD + 数据回填脚本 | 阻塞 | ADR-013 §3.2 |
| **S4 前置** | **ArtifactBus Feature Flag 落地** | Feature Flag `artifact_bus.enabled` + 灰度策略 + 降级剧本 | 阻塞 | ADR-014 §3.2.4 |

### 6.6.2 新增非阻塞门控（2 项）

| 阶段 | 新增门控 | 命令/标准 | 阻塞级别 | 依据 |
|------|---------|-----------|---------|------|
| **S0 基础设施** | Factory 通用库落地 | `internal/common/factory/handler_factory.go` 泛型接口 + 单测 | 非阻塞（S4/S6 前完成）| ADR-012 §3.2.1 |
| **S4 Automation** | TaskRunner Factory 注册 | 通过 Factory 注册 shell/docker/ssh/k8s-exec 4 handler | 非阻塞 | ADR-012 §3.2.2 |

### 6.6.3 v5.4 阶段出口门控汇总

在 §6.1 表基础上追加：

| 阶段 | 新增/调整出口检查项 | 命令/标准 | 阻塞级别 |
|------|-------------------|-----------|---------|
| **S0 前置** | TenantAwareDB 抽象层（ADR-011）| 接口 + 5 用例单测 | 阻塞 |
| **S0 基础设施** | Factory 通用库（ADR-012）| 泛型接口 + 单测 | 非阻塞 |
| **S1 前置** | CMDB Migration 700-702（ADR-013）| 3 号位应用 + CRUD | 阻塞 |
| **S1 CMDB** | CITypeRepository 落地 | Create/Get/List/Update/Delete | 阻塞 |
| **S1 CMDB** | cmdb_cis 兼容读取 | ci_type + type_id 双字段读 | 非阻塞 |
| **S4 前置** | ArtifactBus Feature Flag（ADR-014）| Flag + 灰度 + 降级 | 阻塞 |
| **S4 Automation** | Migration 730-731 落地（ADR-014）| pipeline_artifacts + ALTER | 阻塞 |
| **S4 Automation** | TaskRunner Factory 注册（ADR-012）| 4 handler 注册 | 非阻塞 |
| **S4 Automation** | ArtifactBus 集成 StageExecutor | Publish 失败不阻断 stage | 阻塞 |
| **S6 Alert** | AlertBreaker 事务边界（ADR-010）| 5 用例 + Prometheus 指标 | 阻塞 |
| **S6 Alert** | Migration 736 alert_breaker_state（ADR-010）| 表应用 + Upsert 单测 | 阻塞 |

### 6.6.4 v5.4 阶段"完成"定义（DoD 更新）

- **S0 完成**（新增要求）：TenantAwareDB 抽象层 + Factory 通用库 + AlertBreaker 事务单测框架
- **S1 完成**（新增要求）：Migration 700-702 应用 + CITypeRepository + cmdb_cis 兼容读取
- **S4 完成**（新增要求）：Migration 730-731 应用 + ArtifactBus Feature Flag + TaskRunner Factory 注册
- **S6 完成**（新增要求）：Migration 736 应用 + AlertBreaker 事务边界单测 + 4 项 Prometheus 指标

### 6.6.5 v5.4 执行顺序更新

**5 ADR 决策的落地顺序**（依 ADR 依赖）：

```
Step 1 (S0): ADR-011 TenantAwareDB 抽象层
    ↓
Step 2 (S0): ADR-012 Factory 通用库（可与 Step 1 并行）
    ↓
Step 3 (S1): ADR-013 CMDB 二阶模型 Migration 700-702
    ↓
Step 4 (S4): ADR-014 ArtifactBus Migration 730-731 + Feature Flag
    ↓
Step 5 (S6): ADR-010 AlertBreaker Migration 736 + 事务单测
    ↓
Step 6 (S7): R-P0-04/05 RDM statistics + code-review handler
```

**关键路径**：S0（TenantAwareDB）是基础，阻塞后续所有 ADR 落地。

---

### 6.5.6 v5 新增阻塞项对执行顺序的影响

原 §8 执行顺序建议中，S4 → S5 → S6 → S7 的并行顺序需调整：

```
原顺序：S4 (Automation) → S5 (ITSM) → S6 (Alert) → S7 (RDM)

v5 调整后：
  S4 前置（AlertBreaker 选型 ADR）    ── 阻塞 S6
  S4 (Automation: SSH/WinRM/K8s-Exec + SAST)  ── 撤回 Runner 多协议
  S5 (ITSM: 3 页 P1 修复)              ── BI 从阻塞降为 P1
  S6 (Alert: 5 家族 + AlertBreaker 落地)     ── 依赖 S4 前置 ADR
  S7 (RDM: 4 Tab 前端 404 止损 + statistics + code-review)  ── 新增阻塞
```

**关键路径**：S4 前置 → S6 Alert；S7 RDM 与 S4/S5/S6 可并行（无跨阶段依赖）。

---

## 7. 风险与降级策略

### 7.1 高风险项（需重点保护）

| 风险 | 位置 | 缓解策略 |
|------|------|---------|
| **Layout 主导航替换影响全站** | S1-T1 | 单独 PR + feature flag 隔离；e2e 覆盖 8 大菜单 |
| **MongoDB 引入运维成本** | S3-T1 | 备选方案：PG JSONB + gojsonpath（见 upgrade-design-plan §6.1） |
| **chaos 静默成功修复破坏测试** | S2-T2 | 提前更新测试用例注入 mock injector |
| **RunInspection 真实执行需 Collector SPI** | S2-T1 | 复用 cmdb-collector 现有 SPI 注册 |
| **阈值 3 层模型复杂度高** | S3-T3 | 分阶段：先第 1 层（MongoDB），再第 2/3 层 |
| **跨域 risk/scenario 过度抽象** | S3-T7/T8 | 首版只服务 chaos + inspect，不接 autoexec |
| **审批工作流依赖 approval 成熟度** | S6-T4 | 评估 approval 现状，必要时简化 |
| **P0-2 101 div onClick 分批** | S1-T2 | 每批次单独 PR，回滚粒度 = 批次 |
| **P1-2 Escalate 依赖后端 API** | S5-T2 | 后端未就绪时前端按钮 disabled + Tooltip |
| **P2-10 依赖后端 severity 字段** | 待补 | 需与后端 S2-T6 协商 |

### 7.2 降级策略

| 场景 | 降级方案 |
|------|---------|
| MongoDB 不可用 | PG JSONB + gojsonpath 库（S3-T1 → 降级路径） |
| Trivy/Snyk SDK 不可用 | 保留原 scanner.go 正则引擎（S4-T5 → fallback.go） |
| approval 模块不成熟 | 简化为"高风险实验需人工确认" checkbox（S6-T4 → 降级路径） |
| K8s 集群不可用 | Runner Protocol 支持 shell 降级（S4-T2 → fallback to shell） |
| 后端 escalateTicket API 未就绪 | 前端按钮 disabled + Tooltip（S5-T2 → 降级路径） |
| Layout 替换影响过大 | 临时用 `<div role="button" tabIndex={0} onKeyDown>` 过渡（S1-T1 → 方案 B） |

### 7.3 关键路径失效兜底

- **S0 完成但 S1/S2 都无法推进**：不阻塞；S1 与 S2 可完全并行
- **S2 完成但 S3 阻塞（MongoDB 引入失败）**：S3 走 PG JSONB 降级路径
- **S4 完成但 S6 阻塞（EventBus 集成问题）**：S4 结果独立可用；S6 后置
- **S5 完成但 S2 后端 API 未就绪**：S5-T2 走降级路径（按钮 disabled）

---

## 8. 执行顺序建议（并行优先）

### 8.1 推荐并行批次

**批次 A（完全独立，可并行）**：
- S0 全部（6 项）
- S1-T1 / S1-T3 / S1-T4 / S1-T5 / S1-T6 / S1-T9 / S1-T10 / S1-T12（8 项独立 a11y）

**批次 B（S0 完成后）**：
- S1-T2（依赖 S1-T1）
- S1-T8（依赖 S1-T2/T3/T4）
- S1-T11（依赖 S0-T6）
- S2-T1 / S2-T2 / S2-T7 / S2-T8 / S2-T9（5 项独立后端止损）

**批次 C（S2 完成后）**：
- S2-T3 / S2-T4 / S2-T5 / S2-T6 / S2-T10
- S3-T1 / S3-T2（并行 MongoDB 引入 + Migration）
- S4-T1 / S4-T5（并行 k8s SDK 引入 + SAST）

**批次 D（S3 部分完成后）**：
- S3-T3 / S3-T4 / S3-T7（并行 threshold / configfile / risk）
- S3-T5 / S3-T6 / S3-T8（依赖前一批）
- S3-T9 / S3-T10（依赖 S3-T7/T8）
- S3-T11 / S3-T12 / S3-T13 / S3-T14（依赖 S3-T3/T4/T5/T6）
- S4-T2 / S4-T3 / S4-T4 / S4-T6（依赖 S4-T1）

**批次 E（S3 + S4 完成后）**：
- S6-T1..S6-T7（并行跨模块集成）
- S6-T8（EventBus 依赖前 7 项）
- S5-T1..S5-T10（前端 P1 补齐，依赖 S1 + S2 后端 API）
- S5-T11 / S5-T12（e2e）

### 8.2 优先级最高的 3 项（Day 1 必做）

1. **S0-T4**：ESLint 规则建立（阻塞所有前端改动）
2. **S1-T1**：Layout 主导航修复（影响全站 40+ 入口）
3. **S0-T1**：错误码常量统一（阻塞所有后端改动）

### 8.3 优先级最低的任务（可后置）

- S1-T9（img alt）：装饰性图影响小
- S1-T11（focus CSS）：WCAG 2.4.11 AA 但非阻塞
- S5-T12（Console e2e）：可后置

---

## 9. 附录 A：完整 grep 命令集合

### 9.1 S0 验证命令

```bash
# S0-T1 错误码
grep -c "CLIENT\." orion-platform-svc-go/internal/common/errors.go

# S0-T2 Repository tenant_id
grep -rln "SELECT\|INSERT\|UPDATE" orion-platform-svc-go/internal/*/repository/*.go \
  | xargs -I{} sh -c 'grep -q "tenant_id" {}' 2>/dev/null | wc -l

# S0-T3 axios 拦截器
grep -n "interceptors.response\|errorHandler" orion-frontend/src/utils/request.ts

# S0-T4 ESLint
grep -n "jsx-a11y" orion-frontend/.eslintrc*

# S0-T5 Migration 号段
find orion-platform-svc-go -name "69[9]*.sql" -o -name "7[0-1][0-3]*.sql" | wc -l

# S0-T6 motion CSS
grep -c "prefers-reduced-motion" orion-frontend/src/index.css
```

### 9.2 S1 验证命令

```bash
# S1-T1 Layout
grep -c "<button" orion-frontend/src/components/Layout/index.tsx
grep -c "onClick.*onNavigate" orion-frontend/src/components/Layout/index.tsx  # 应 =0

# S1-T2 div onClick
grep -rn "<div[^>]*onClick" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 <10

# S1-T3 Card hover
grep -rn "hoverable.*onClick" orion-frontend/src/ --include="*.tsx" | wc -l

# S1-T4 Text onClick
grep -rn "<Text[^>]*onClick" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 <5

# S1-T5 Button aria
grep -rnE "<Button[^>]*icon=[^>]*$" orion-frontend/src/ --include="*.tsx" | grep -v "aria-label" | wc -l

# S1-T6 Table caption
grep -rn "caption\|scope=\"col\"" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 >30

# S1-T7 Form rules
grep -rn "<Form.Item[^>]*rules" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 >800
grep -rn "aria-describedby" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 >20

# S1-T8 tabIndex
grep -rn "tabIndex" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 >50

# S1-T9 img alt
grep -rn "<img[^>]*alt" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 >50

# S1-T10 aria-live
grep -rn "aria-live" orion-frontend/src/ --include="*.tsx" | wc -l  # 目标 >8

# S1-T11 focus CSS
grep -c ":focus-visible" orion-frontend/src/index.css

# S1-T12 Clickable
ls orion-frontend/src/components/Clickable*.tsx
```

### 9.3 S2 验证命令

```bash
# S2-T1 RunInspection
grep -rn 'return.*"status".*"ok"' orion-platform-svc-go/internal/inspection/ | wc -l  # 应 =0

# S2-T2 chaos 静默
grep -rn "log-only\|Fallback: no injector" orion-platform-svc-go/internal/chaos/ | wc -l  # 应 =0

# S2-T3 PreRelease
grep -c 'return "skip"' orion-platform-svc-go/internal/chaos/service/service.go  # 应 =0

# S2-T4 transport 解冻
grep -l "//go:build ignore" orion-platform-svc-go/internal/cmdb/ 2>/dev/null | wc -l  # 应 =0

# S2-T5 CMDB CI 类型
find orion-platform-svc-go/internal/cmdb/citype/ -name "*.go" 2>/dev/null | wc -l  # 应 >=10

# S2-T6 Ticket 加字段
ls orion-platform-svc-go/internal/ticket/migrations/69*.sql 2>/dev/null | wc -l  # 应 >=4

# S2-T7 workflow
grep -n "Nodes\|Edges" orion-platform-svc-go/internal/itsm/workflow/executor.go | wc -l  # 应 >=10

# S2-T8 状态机
grep -n "StateTransition\|transitionMatrix" orion-platform-svc-go/internal/itsm/ticket/service.go

# S2-T9 Alert 隔离
grep -rln "SELECT\|INSERT\|UPDATE" orion-platform-svc-go/internal/{notification,alert}/ \
  | xargs -I{} sh -c 'grep -q "tenant_id" {}' 2>/dev/null | wc -l

# S2-T10 RDM API
cd orion-platform-svc-go && go test ./internal/rdm/... -run TestAllEndpointsRespond
```

### 9.4 S3 验证命令

```bash
# S3-T1 MongoDB
grep "go.mongodb.org/mongo-driver" orion-platform-svc-go/go.mod

# S3-T2 Migration
ls orion-platform-svc-go/internal/*/migrations/7[0-4]_*.sql 2>/dev/null | wc -l  # 应 >=5

# S3-T3..S3-T8 6 新模块
for mod in inspection-threshold inspection-configfile inspection-report inspection-problem risk scenario; do
    echo "$mod:"
    find orion-platform-svc-go/internal/$mod/ -name "*.go" 2>/dev/null | wc -l
done

# S3-T9 chaos ALTER
grep -n "RiskID\|ScenarioID\|RequiresApproval" orion-platform-svc-go/internal/chaos/models/*.go

# S3-T10 chaos 端点
grep -n "risk-level\|scenario\|validate" orion-platform-svc-go/internal/chaos/handler/routes.go

# S3-T11 routes_v2
grep -c "RequirePermission" orion-platform-svc-go/internal/inspection/routes_v2.go  # 应 >=3

# S3-T12 JSONPath
grep -rn "ojg\|jsonpath" orion-platform-svc-go/internal/inspection-threshold/evaluator/

# S3-T13 cron
find orion-platform-svc-go/internal/inspection-report/scheduler/ -name "*.go" | wc -l  # 应 >=2

# S3-T14 inspection 对接
grep -n "ThresholdService\|ProblemService" orion-platform-svc-go/internal/inspection/service/service.go
```

### 9.5 S4 验证命令

```bash
# S4-T1 k8s 依赖
grep -E "k8s.io/client-go|helm.sh/helm" orion-platform-svc-go/go.mod

# S4-T2..S4-T4 Runner
find orion-platform-svc-go/internal/runner/ -name "runner.go" | wc -l  # 应 >=4

# S4-T5 SAST
grep -rnE "trivy|snyk" orion-platform-svc-go/internal/scanner/
grep -n "SASTProvider" orion-platform-svc-go/internal/scanner/scanner.go

# S4-T6 Protocol
grep -n "Runner interface\|Registry\|Register" orion-platform-svc-go/internal/runner/protocol.go
```

### 9.6 S5 验证命令

```bash
# S5-T1 Modal.confirm
grep -c "Modal.confirm" orion-frontend/src/pages/TicketDetail/useTicketDetailState.ts  # 应 >=1

# S5-T2 escalateTicket
grep -n "escalateTicket" orion-frontend/src/api/ticketing.ts
grep -n "escalateTicket" orion-frontend/src/pages/TicketDetail/useTicketDetailState.ts

# S5-T3 confirmLoading
grep -c "confirmLoading" orion-frontend/src/pages/TicketDetail/TicketDetailModals.tsx  # 应 >=4

# S5-T4 await
grep -c "await submitComment" orion-frontend/src/pages/TicketDetail/TicketComments.tsx

# S5-T5 loading
grep -n "loading\|<Spin" orion-frontend/src/pages/TicketDetail/index.tsx

# S5-T6 cursor
grep -c "cursor: 'pointer'" orion-frontend/src/pages/TicketDetail/TicketComments.tsx  # 应 =0

# S5-T7 QuickNav
grep -c "window.location.href" orion-frontend/src/pages/Console/Components/QuickNav.tsx  # 应 =0
grep -c "useNavigate" orion-frontend/src/pages/Console/Components/QuickNav.tsx  # 应 >=1

# S5-T8 FALLBACK_STATS
grep -c "FALLBACK_STATS\|演示数据" orion-frontend/src/pages/Console/  # 应 =0

# S5-T9 错误态
grep -n "initialLoading\|<Alert" orion-frontend/src/pages/Console/index.tsx

# S5-T10 DashboardNew
grep -c 'type="warning"' orion-frontend/src/pages/DashboardNew/index.tsx  # 应 =0
grep -c "fallback\|演示数据" orion-frontend/src/pages/DashboardNew/useDashboardState.ts  # 应 =0

# S5-T11/T12 e2e
cd orion-frontend && npx playwright test --grep "ticketdetail-full-flow|console-dashboard"
```

### 9.7 S6 验证命令

```bash
# S6-T1..S6-T7 跨模块集成
grep -n "RiskID\|RequiresApproval\|approval" orion-platform-svc-go/internal/chaos/service/service.go
grep -n "NotificationService\|chaos_experiment_completed" orion-platform-svc-go/internal/chaos/
grep -n "ReportService\|ExecuteReport" orion-platform-svc-go/internal/inspection-report/

# S6-T8 EventBus
find orion-platform-svc-go/internal/eventbus/ -name "*.go" | wc -l  # 应 >=4
grep -rn "chaos_experiment\|inspection_report" orion-platform-svc-go/internal/eventbus/

# 全链 e2e
cd orion-platform-svc-go && go test ./internal/chaos/... -run TestE2E_HighRiskApproval
cd orion-platform-svc-go && go test ./internal/saga/... -run TestSaga_ChaosRollback
```

---

## 10. 附录 B：任务总表

| 阶段 | 任务 ID | 任务名 | 前置 | 类型 |
|------|--------|--------|------|------|
| S0 | S0-T1 | 错误码常量 | — | 后端基础设施 |
| S0 | S0-T2 | Repository 基类审计 | — | 后端基础设施 |
| S0 | S0-T3 | axios 拦截器 | — | 前端基础设施 |
| S0 | S0-T4 | ESLint 规则 | — | 前端基础设施 |
| S0 | S0-T5 | Migration 号段预留 | — | 数据库 |
| S0 | S0-T6 | motion CSS | — | 前端基础设施 |
| S1 | S1-T1 | Layout 导航 | S0-T4 | A11y 组件 |
| S1 | S1-T2 | div onClick 分批 | S0-T4, S1-T1 | A11y 存量 |
| S1 | S1-T3 | Card hover | S0-T4 | A11y 存量 |
| S1 | S1-T4 | Text onClick | S0-T4 | A11y 存量 |
| S1 | S1-T5 | Button aria-label | S0-T4 | A11y 存量 |
| S1 | S1-T6 | Table caption | S0-T4 | A11y 组件 |
| S1 | S1-T7 | Form rules | S0-T4 | A11y 组件 |
| S1 | S1-T8 | tabIndex | S1-T2/T3/T4 | A11y 存量 |
| S1 | S1-T9 | img alt | S0-T4 | A11y 存量 |
| S1 | S1-T10 | aria-live | S0-T4 | A11y 存量 |
| S1 | S1-T11 | focus CSS | S0-T6 | A11y 基础设施 |
| S1 | S1-T12 | Clickable 组件 | S0-T4 | A11y 组件 |
| S2 | S2-T1 | RunInspection 修空壳 | S0-T1/T2 | 后端止损 |
| S2 | S2-T2 | chaos 静默成功 | S0-T1 | 后端止损 |
| S2 | S2-T3 | PreReleaseVerify | S0-T1, S2-T1 | 后端止损 |
| S2 | S2-T4 | transport 解冻 | S0-T1/T2, S2-T1 | 后端止损 |
| S2 | S2-T5 | CMDB CI 类型 | S0-T1/T2, S2-T4 | 后端新模块 |
| S2 | S2-T6 | Ticket 加字段 | S0-T5/T2 | 数据库 |
| S2 | S2-T7 | workflow 引擎 | S0-T1/T2 | 后端止损 |
| S2 | S2-T8 | ITSM 状态机 | S0-T2 | 后端止损 |
| S2 | S2-T9 | Alert 租户隔离 | S0-T2 | 后端止损 |
| S2 | S2-T10 | RDM API 最小实现 | S0-T1/T2, S2-T6 | 后端止损 |
| S3 | S3-T1 | MongoDB 依赖 | S0-T1 | 后端基础设施 |
| S3 | S3-T2 | Migration 700-704 | S0-T5 | 数据库 |
| S3 | S3-T3 | threshold 模块 | S3-T1/T2, S0-T1 | 新模块 |
| S3 | S3-T4 | configfile 模块 | S3-T2, S0-T1/T2 | 新模块 |
| S3 | S3-T5 | report 模块 | S3-T2/T4, S0-T1 | 新模块 |
| S3 | S3-T6 | problem 模块 | S3-T2/T5 | 新模块 |
| S3 | S3-T7 | risk 模块 | S3-T2, S0-T1/T2 | 新模块 |
| S3 | S3-T8 | scenario 模块 | S3-T2/T7 | 新模块 |
| S3 | S3-T9 | chaos ALTER | S3-T2/T7/T8 | 数据库 |
| S3 | S3-T10 | chaos 端点 | S3-T9/T7/T8 | 后端新模块 |
| S3 | S3-T11 | routes_v2 | S3-T3/T4/T5/T6 | 路由 |
| S3 | S3-T12 | JSONPath 集成 | S3-T3 | 后端基础设施 |
| S3 | S3-T13 | cron 对接 | S3-T5 | 后端新模块 |
| S3 | S3-T14 | inspection 对接 | S2-T1, S3-T3/T6 | 后端集成 |
| S4 | S4-T1 | k8s 依赖 | S0-T1 | 后端基础设施 |
| S4 | S4-T2 | K8sRunner | S4-T1 | 新模块 |
| S4 | S4-T3 | HelmRunner | S4-T1/T2 | 新模块 |
| S4 | S4-T4 | ArgoCDRunner | S4-T1 | 新模块 |
| S4 | S4-T5 | SAST 集成 | S0-T1 | 后端新模块 |
| S4 | S4-T6 | Protocol 扩展 | S4-T2/T3/T4 | 后端基础设施 |
| S5 | S5-T1 | TicketDetail 二次确认 | S0-T4 | 前端 P1 |
| S5 | S5-T2 | Escalate API | S5-T1, S2-T6 | 前端 P1 |
| S5 | S5-T3 | Modal confirmLoading | S5-T1 | 前端 P1 |
| S5 | S5-T4 | 评论 await | S0-T3 | 前端 P1 |
| S5 | S5-T5 | loading/404 区分 | S5-T1 | 前端 P1 |
| S5 | S5-T6 | 附件/Mention 交互 | S0-T4 | 前端 P1 |
| S5 | S5-T7 | QuickNav useNavigate | S0-T4 | 前端 P1 |
| S5 | S5-T8 | 删假数据回退 | S0-T3 | 前端 P1 |
| S5 | S5-T9 | Console 错误态 | S5-T8 | 前端 P1 |
| S5 | S5-T10 | DashboardNew Alert | S0-T3 | 前端 P1 |
| S5 | S5-T11 | TicketDetail e2e | S5-T1..T5 | 测试 |
| S5 | S5-T12 | Console e2e | S5-T7..T10 | 测试 |
| S6 | S6-T1 | chaos↔risk | S3-T7/T9 | 集成 |
| S6 | S6-T2 | chaos↔scenario | S3-T8/T9 | 集成 |
| S6 | S6-T3 | chaos↔notification | S6-T1 | 集成 |
| S6 | S6-T4 | chaos↔approval | S3-T7 | 集成 |
| S6 | S6-T5 | inspection↔notification | S3-T5 | 集成 |
| S6 | S6-T6 | inspection↔report-designer | S3-T5 | 集成 |
| S6 | S6-T7 | Pipeline risk 前置 | S3-T7 | 集成 |
| S6 | S6-T8 | EventBus 桥接 | S6-T1..T7 | 集成 |
| S0 | S0-ADR1 | TenantAwareDB 抽象层 + Migration 720 | — | ADR 落地 |
| S0 | S0-ADR2 | Factory 通用库（非阻塞） | — | ADR 落地 |
| S2 | S2-ADR1 | CMDB 二阶模型 Migration 700-702 | S0-ADR1, S0-T5 | ADR 落地 |
| S6 | S6-ADR1 | Pipeline ArtifactBus Migration 730-731 | S0-ADR1, S3-T2 | ADR 落地 |
| S6 | S6-ADR2 | AlertBreaker Migration 736 + 事务单测 | S0-ADR1, S2-T9 | ADR 落地 |
| S7 | S7-T1 | RDM statistics 3 端点 | S2-T10 | 后端止损 |
| S7 | S7-T2 | RDM code-review handler | S2-T10 | 后端止损 |
| S7 | S7-T3 | RDM 4 Tab 契约匹配 | S7-T1, S7-T2, S2-T10 | 验证 |
| S8 | S8-T1 | 假数据清理（P2-8/9/10） | S5-T10 | 前端 P2 |
| S8 | S8-T2 | 响应式断点（P2-11） | S5 | 前端 P2 |
| S8 | S8-T3 | Token 色值统一（P2-12/14） | S5 | 前端 P2 |
| S8 | S8-T4 | TicketDetail/Console 交互细节（P2-1~7） | S5-T1~T6 | 前端 P2 |
| S8 | S8-T5 | 全局 UX 细节（P2-13/15） | S5 | 前端 P2 |

**任务总数**：**76 + 5 = 81 项**（原 68 + ADR 落地 5 + S7 止损 3 + S8 P2 可选 5；其中 S4 的 4 项 + S8 全 5 项可选/后置，P0 阻塞实际为 72 项）
- 前端相关：**32 项**（S1 全 12 + S5 全 12 + S0-T3/T4/T6 = 3 项前端基础设施）
- 后端相关：**36 项**（S2 全 10 + S2-ADR1 + S3 全 14 + S4 全 6 + S0-T1/T2/T5 + S0-ADR1/ADR2 + S6-ADR1/ADR2 + S7 全 3 = 36 项）
- 跨模块：**8 项**（S6 全 8）

**修正**：v5.4 更新——原 68 项 + ADR 落地 5 项（S0-ADR1/ADR2 + S2-ADR1 + S6-ADR1/ADR2）+ S7 止损 3 项 = 76 项。其中 S4 的 T1-T4 为可选/后置（v5 撤回），P0 阻塞任务实际为 72 项。

---

## 11. 认知边界（本手册的诚实声明）

### 11.1 已做到

1. **所有任务标注前置依赖**（81 项无遗漏，含 ADR 落地 5 项 + S7 止损 3 项 + S8 P2 可选 5 项）
2. **所有任务标注验证方式**（每项含 grep / 单测 / e2e 至少一种）
3. **所有任务标注回滚步骤**（每项含 revert / 目录删除 / 单文件回滚）
4. **依赖 DAG 完整**（含 ASCII 图 + 关键路径）
5. **每阶段出口门控**（35 项检查项，含 v5/v5.4 新增 6 项；v5.5 由 29 修正为实测值）
6. **风险与降级策略**（10 项风险 + 6 项降级方案）
7. **并行批次建议**（5 批，按依赖链）
8. **ADR 决策落地**（5 份 ADR Migration 任务已编入 S0/S2/S6 阶段）

### 11.2 未做到（诚实边界）

1. **不估算人天/工期**（用户强制约束）
2. **不修改生产代码**（Direction A）
3. **不覆盖 P2 全 15 项**（本手册 S8 含 P2 主要 5 批次，P2-1~P2-7 细节见 frontend-fix-tasks §3）
4. **不覆盖 48 子域后续批次**（第 1 批 6 子域已纳入 S3；第 2-9 批见 §4.10 汇总表）
5. **不覆盖反向重构 11 对重复模块**（upgrade-design-plan §11.2，v3 明确"止损阶段不做"）
6. **不覆盖 TS → Go 完整迁移**（v3 §11.1 已归档 TS，仅保留 CITypeService 469 行作为移植源）
7. **不估算 Council 4 视角对抗**（v3 §11.2 未跑通，本手册不含 Council 相关）

### 11.3 与上游文档的关系

| 上游文档 | 本手册消费方式 |
|---------|--------------|
| `frontend-fix-tasks-2026-10-03.md`（967 行） | 直接映射为 S1（12 项）+ S5（12 项） |
| `a11y-reviews/accessibility-audit-fullrepo-2026-10-03.md`（406 行） | 通病指标作为 S1 出口门控 |
| `neatlogic-feature-comparison-upgrade-2026-09-30-v3.md` | 9 项止损映射为 S2（10 项）+ S4（6 项）+ S5 部分 |
| `expert-reviews/upgrade-design-plan-2026-10-01.md`（3558 行） | 4 新模块 + risk/scenario 映射为 S3（14 项）+ S6（8 项） |
| `expert-reviews/inspection-expert-method-level-2026-10-03.md` | 4 新模块 API 拆分参考 |

### 11.4 后续动作

1. **S0 完成后**：立即执行 S1 + S2 并行批次
2. **每阶段出口门控失败时**：暂停下一批次，先修复出口问题
3. **依赖链调整**：如果 S3-T1（MongoDB 引入）失败，切 PG JSONB 降级路径
4. **回滚触发条件**：单个 PR 破坏 e2e 时立即回滚，不合并

---

## 12. 报告元信息

| 项 | 值 |
|----|----|
| 生成日期 | 2026-10-03 |
| 生成方式 | 手工整合 6 份上游评审报告 |
| 报告长度 | 约 2100 行（v5.4 更新） |
| 阶段数量 | 9 个（S0-S8，v5.4 新增 S7 RDM 止损 + S8 P2 次要项） |
| 总任务数 | 81 项（原 68 + ADR 落地 5 + S7 止损 3 + S8 P2 可选 5；其中 S4 的 4 项 + S8 全 5 项可选/后置） |
| 前端任务数 | 32 项（S0-T3/T4/T6 + S1 全 12 + S5 全 12 + S1-T11 前端 focus CSS） |
| 后端任务数 | 31 项（S0-T1/T2/T5 + S2 全 10 + S3 全 14 + S4 全 6） |
| 跨模块任务数 | 8 项（S6 全 8） |
| Migration 号段 | 699-765（含 ADR 新增 700-702/720/730-731/736） |
| 阻塞门控数 | 35 项（v5.5 实测 `# 门控` 标注行；原声明 29 项不符） |
| 风险项 | 10 项 |
| 降级方案 | 6 项 |
| 依赖 DAG | 完整（含 ASCII 图 + 关键路径 4 条） |

**上游报告引用**：
- `reports/frontend-fix-tasks-2026-10-03.md`（967 行）
- `reports/a11y-reviews/accessibility-audit-fullrepo-2026-10-03.md`（406 行）
- `reports/neatlogic-feature-comparison-upgrade-2026-09-30-v3.md`
- `reports/expert-reviews/upgrade-design-plan-2026-10-01.md`（3558 行）
- `reports/expert-reviews/inspection-expert-method-level-2026-10-03.md`
- `reports/expert-reviews/cross-review-synthesis-2026-10-03-v5.md`（当前权威；v4 保留审计基线）
