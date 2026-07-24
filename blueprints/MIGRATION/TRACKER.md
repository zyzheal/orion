# Blueprint TS→Go 迁移追踪

> 启动日期: 2026-07-24 | 分支: feat/wave2-parallel-execution | 版本: v3.0 (2026-07-24 更新)
> **说明**: 所有 TS 文件数为源文件数（不含 `dist/` 编译产物）

## 总体进度

| Wave | 任务 | 状态 | 完成时间 |
|------|------|------|---------|
| Wave 1 | 5 个 TS 归档 (Agent-4) | ✅ 已完成 | 2026-07-24 |
| Wave 1 | Pipeline 差距分析 (Agent-1) | ✅ 已完成 | 2026-07-24 |
| Wave 1 | 4 个新 Go 服务脚手架 (Agent-6) | ✅ 已完成 | 2026-07-24 |
| **Wave 2** | **Monitor/AI/Security 补全** | ✅ 已完成 | 2026-07-24 |
| **Wave 2** | **14 个新 Go 服务脚手架** | ✅ 已完成 | 2026-07-24 |
| **Wave 2** | **4 个 Repository 补全** | ✅ 已完成 | 2026-07-24 |
| **Wave 3** | **Skill Map→Repository 修复** | ✅ 已完成 | 2026-07-24 |
| **Wave 3** | **Self-Healing wiring 注册** | ✅ 已完成 | 2026-07-24 |
| **Wave 3** | **Graph 从 TS 新建 Go** | ✅ 已完成 | 2026-07-24 |
| **Wave 3** | **Runner 从 TS 新建 Go** | ✅ 已完成 | 2026-07-24 |
| **Wave 3** | **workflow ticket 重复域删除** | ✅ 已完成 | 2026-07-24 |
| **P0 修复** | **模块路径编译修复** | ✅ 已完成 | 2026-07-24 |
| **P0 修复** | **identity RunMigrations + 测试** | 🔄 进行中 | 2026-07-24 |
| **P0 修复** | **infra-ops 架构修复** | ✅ 已完成 | 2026-07-24 |
| **P3** | **6 个 Dockerfile** | ✅ 已完成 | 2026-07-24 |
| **合并** | **blueprints → platform-svc-go** | 🔄 进行中 | 2026-07-24 |

---

## Wave 1 成果

### ✅ Agent-4: 5 个 TS 服务归档（Go 已完整覆盖）

| 归档 TS 服务 | Go 替代服务 | TS 源文件 | Go 文件 | 覆盖域 |
|-------------|-----------|----------|--------|--------|
| orion-notify-svc | orion-notification-svc-go | 21 | 108 | 8 子域, 功能完整 |
| orion-ticket-svc | orion-ticket-svc-go | 35 | 98 | 8 子域, 功能完整 |
| orion-finops-svc | orion-finops-svc-go | 25 | 71 | 8 子域, 功能完整 |
| orion-governance-svc | orion-governance-svc-go | 17 | 68 | 9 子域, 功能完整 |
| orion-config-mgmt-svc | orion-config-mgmt-svc-go | 9 | 67 | 8 子域, 功能完整 |

### ✅ Agent-1: Pipeline 差距分析（校准后）

- 差距分析文档: `blueprints/MIGRATION/pipeline-gap-analysis.md`
- **校准后**: Pipeline TS 源文件 117（非 351，原统计含 dist/）
- 30 个 TS 功能域待迁移到 Go
- 分 3 个 Phase，预计 6 天

### ✅ Agent-6: 4 个新 Go 服务脚手架

| 新 Go 服务 | TS 源 | Go 文件数 | 子域数 | Repository 实现 |
|-----------|-------|----------|--------|----------------|
| orion-chatops-svc-go | 81 TS | 8 | 5 | 🟡 stub（待 Wave 2 补全） |
| orion-code-svc-go | 52 TS | 10 | 3 | 🟡 stub（待 Wave 2 补全） |
| orion-audit-svc-go | 15 TS | 8 | 3 | 🟡 stub（待 Wave 2 补全） |
| orion-agent-svc-go | 33 TS | 12 | 6 | 🟡 stub（待 Wave 2 补全） |

---

## Wave 2 完成状态 (2026-07-24)

| Agent | 任务 | 状态 | 说明 |
|-------|------|------|------|
| Agent-2 | orion-monitor-svc-go | ✅ 完成 | 9 域, 50 Go 文件, 95 路由, 5 migrations |
| Agent-3 | orion-ai-svc-go | ✅ 完成 | 14 域, 95 Go 文件, 56 路由, 5 migrations |
| Agent-5 | orion-security-svc 归档 | ✅ 完成 | ARCHIVED.md, 62 Go 文件 |
| Agent-7 | 14 个新建服务脚手架 | ✅ 完成 | 14 个服务目录 + go.mod/config |
| Agent-8 | 4 个 Repository 补全 | ✅ 完成 | 4 个服务 + migrations |

---

## Wave 3 — 小服务（2026-07-24 更新）

| # | 服务 | TS 源文件 | Go 状态 | 完成度 | 备注 |
|---|------|----------|--------|--------|------|
| 1 | **skill** | 11 | ✅ 已修复 | 🟢 | Map→Repository 注入完成，27 handler 测试 + 7 service 测试 |
| 2 | **graph** | 10 | ✅ 已新建 | 🟢 | 从 TS 翻译为 Go 四层架构 |
| 3 | **inception** | 9 | ✅ 已就绪 | 🟢 | 5 Go 文件，PostgreSQL，已注册，3 层测试 |
| 4 | **runner** | 9 | ✅ 已新建 | 🟢 | 从 TS 翻译为 Go，含 Job CRUD + 执行状态 |
| 5 | **cmdb** | 8 | ✅ 已就绪 | 🟢 | 5 Go 文件，PostgreSQL，已注册 |
| 6 | **selfhealing** | 7 | ✅ 已修复 | 🟢 | wiring 注册完成，10 个端点挂载到 /api/v1/self-healing/* |
| 7 | orion-platform-core | 23 | 🔴 未开始 | 🔴 | 待启动 |

---

## P0 修复完成情况 (2026-07-24)

| # | 问题 | 严重程度 | 状态 | Commit |
|---|------|---------|------|--------|
| 1 | **Skill 双重实现**（Map→Repository）| 🔴 隐蔽 bug | ✅ 已完成 | 4 文件，service.go 重写，27+7 测试 |
| 2 | **Self-Healing wiring 未注册** | 🟡 易修复 | ✅ 已完成 | wiring.go + core_infra_wiring.go + router.go 三处添加 |
| 3 | **模块路径编译失败**（community/pandawiki/visor/monitor）| 🔴 P0 | ✅ 已完成 | commit `61a27f231`，4 文件 +51/-3 |
| 4 | **identity 无 RunMigrations + 0 测试** | 🔴 P0 | 🔄 进行中 | 编写测试中 |
| 5 | **infra-ops 无迁移 + 直连 postgres** | 🟠 P1 | ✅ 已完成 | 改用 go-common database/middleware |
| 6 | **workflow ticket 域与 ticket-svc 100% 重复** | 🔴 P0 | ✅ 已完成 | 删除 56 个 .go + 1 migration，workflow-svc-go 从 113→57 文件 |
| 7 | **6 个服务缺 Dockerfile** | 🟢 P3 | ✅ 已完成 | commit `7f2b4fdfa`，多阶段构建 + migrations |

---

## 合并计划：blueprints → platform-svc-go (2026-07-24 更新)

> **策略**：13 个完整 Go 服务（>40 文件）在 blueprints 中比 platform-svc-go 更完整，全部用 blueprints 版本替换。

| # | 域 | blueprints | platform-svc-go | 合并方式 | Agent |
|---|----|-----------|----------------|---------|-------|
| 1 | CI-CD | 122 Go | 55 Go | 替换 | `a898c7c0` 🔄 |
| 2 | Notification | 115 Go | 46 Go | 替换 | `ae522bd2` 🔄 |
| 3 | Workflow | 57 Go（已删 ticket）| 43 Go | 替换 | `a8c28458` 🔄 |
| 4 | Ticket | 98 Go | 43 Go | 合并 | `a8c28458` 🔄 |
| 5 | InfraOps | 97 Go | 61 Go | 替换 | `acc8cb36` 🔄 |
| 6 | AI | 95 Go | 76 Go | 替换 | `a347d9cd` 🔄 |
| 7 | Identity | 73 Go | 58 Go | 替换 | `a8c28458` 🔄 |
| 8 | FinOps | 71 Go | 44 Go | 替换 | `adda8f3f` 🔄 |
| 9 | Governance | 68 Go | 41 Go | 替换 | `adda8f3f` 🔄 |
| 10 | ConfigMgmt | 67 Go | 43 Go | 替换 | `acc8cb36` 🔄 |
| 11 | Security | 62 Go | 35 Go | 替换 | `adda8f3f` 🔄 |
| 12 | Monitor | 50 Go | 23 Go | 替换 | `acc8cb36` 🔄 |
| 13 | EventBus | 46 Go | 40 Go | 替换 | `a8c28458` 🔄 |

---

## 待启动（11 个空壳服务）

| # | 服务 | TS 源文件 | Go 文件 | 工作量 | 优先级 |
|---|------|----------|---------|-------|--------|
| 1 | approval | 20 | 2 | 5-7 天 | P2 |
| 2 | artifact | 24 | 2 | 8-10 天 | P2 |
| 3 | dba | 11 | 2 | 3-5 天 | P2 |
| 4 | deploy | 27 | 2 | 8-10 天 | P2 |
| 5 | digital-twin | 8 | 2 | 10-12 天 | P2 |
| 6 | dr | 24 | 2 | 7-9 天 | P2 |
| 7 | efficiency | 22 | 2 | 5-7 天 | P2 |
| 8 | federation | 22 | 2 | 10-12 天 | P2 |
| 9 | knowledge | 15 | 2 | 3-5 天 | P2 |
| 10 | plugin | 27 | 2 | 7-9 天 | P2 |
| 11 | risk | 10 | 2 | 10-12 天 | P2 |

> **前置条件**：需 `go-common` 库构建完成后才能启动。当前 11 个空壳仅 `config.go` + `response_writer.go`，业务逻辑为零。

---

## ⚪ 跳过

| 服务 | 类型 | 说明 |
|------|------|------|
| orion-db | 基础设施 | SQL schema + Docker Compose，非微服务 |
| orion-llm-svc | Python | AI 推理，保留 |
| orion-llm-trace-svc-py | Python | LLM 追踪，保留 |
| orion-knowledge-svc-py | Python | 知识库 Python 版，保留 |
| orion-security-svc-rust | Rust | 安全，保留 |

---

## 状态说明

```
🟢 已完成 (TS 已归档，Go 功能完整覆盖)
🟡 进行中 (Go 脚手架已创建，需补全实现)
🔴 未开始 (待启动)
⚪ 跳过 (基础设施或独立技术栈)
```

---

## 依赖关系

```
Wave 1 (已完成)
├── Agent-4: 5 个 TS 归档 → 无依赖
├── Agent-1: Pipeline 差距分析 → 无依赖
└── Agent-6: 4 个 Go 脚手架 → 无依赖

Wave 2 (已完成)
├── Agent-2: Monitor TS→Go → 依赖 Agent-1 的 pipeline 模式
├── Agent-3: AI TS→Go → 依赖 Agent-1 的 pipeline 模式
├── Agent-1 续: Pipeline Phase 1 → 依赖差距分析完成
├── Agent-7: 14 个纯 TS 新建 Go → 依赖 Agent-6 的脚手架模板
└── Agent-8: 4 个新建 Go 补全实现 → 依赖脚手架完成

Wave 3 (大部分完成)
├── Agent-9: Graph/Runner/Skill/Self-Healing → ✅ 已完成
├── Wave 3: CMDB/Inception → ✅ 已就绪
└── Wave 3: platform-core → 🔴 未开始

P0 修复 (2026-07-24)
├── Skill Map→Repository → ✅
├── Self-Healing wiring → ✅
├── 模块路径编译修复 → ✅
├── identity 迁移+测试 → 🔄
├── infra-ops 架构修复 → ✅
├── workflow ticket 删除 → ✅
└── 6 个 Dockerfile → ✅

合并 (2026-07-24 进行中)
├── 13 个完整域 → platform-svc-go → 🔄 6 个 Agent 并行
└── 11 个空壳服务 → 等 go-common 完成后启动
```

---

## 附录 A. Agent 任务卡（机器可读）

### Agent-2: Monitor TS→Go 补全

```
AGENT_ID:      Agent-2
TASK:          orion-monitor-svc → orion-monitor-svc-go
TYPE:          supplement (补全)
TS_SOURCE:     blueprints/orion-monitor-svc (39 TS 源文件)
GO_TARGET:     blueprints/orion-monitor-svc-go (50 Go 文件)
GAP:           19 域缺失 (告警规则, 告警级别, 告警来源, 告警事件, 告警通知...)
DAYS:          4
DEPENDS_ON:    none
STATUS:        ✅ 已完成
COMPLETION:    go build 通过 + 路由数 ≥ TS 路由数 + TRACKER.md 更新
```

### Agent-3: AI TS→Go 补全

```
AGENT_ID:      Agent-3
TASK:          orion-ai-svc → orion-ai-svc-go
TYPE:          supplement (补全)
TS_SOURCE:     blueprints/orion-ai-svc (76 TS 源文件)
GO_TARGET:     blueprints/orion-ai-svc-go (95 Go 文件)
GAP:           20 域缺失 (RAG 检索, Agent 执行, 模型管理, 成本追踪...)
DAYS:          3
DEPENDS_ON:    none
STATUS:        ✅ 已完成
```

### Agent-5: Security TS 归档

```
AGENT_ID:      Agent-5
TASK:          orion-security-svc → orion-security-svc-go
TYPE:          archive (归档)
TS_SOURCE:     blueprints/orion-security-svc (43 TS 源文件)
GO_TARGET:     blueprints/orion-security-svc-go (62 Go 文件)
GAP:           功能对等 (Go 覆盖 TS 全部功能)
DAYS:          1
DEPENDS_ON:    none
STATUS:        ✅ 已完成
COMPLETION:    Go 路由数 ≥ 43 TS 路由 + ARCHIVED.md + TRACKER.md 更新
```

### Agent-7: 14 个纯 TS 新建 Go 服务

```
AGENT_ID:      Agent-7
TASK:          14 个纯 TS 服务 → 新建 Go 服务
TYPE:          new (新建)
SERVICES:
  ├── orion-risk-svc (10 TS)        → orion-risk-svc-go
  ├── orion-deploy-svc (27 TS)      → orion-deploy-svc-go
  ├── orion-plugin-svc (27 TS)      → orion-plugin-svc-go
  ├── orion-dr-svc (24 TS)          → orion-dr-svc-go
  ├── orion-artifact-svc (24 TS)    → orion-artifact-svc-go
  ├── orion-digital-twin-svc (8 TS) → orion-digital-twin-svc-go
  ├── orion-federation-svc (22 TS)  → orion-federation-svc-go
  ├── orion-efficiency-svc (22 TS)  → orion-efficiency-svc-go
  ├── orion-approval-svc (20 TS)    → orion-approval-svc-go
  ├── orion-dba-svc (11 TS)         → orion-dba-svc-go
  ├── orion-knowledge-svc (15 TS)   → orion-knowledge-svc-go
  ├── orion-community-svc (17 TS)   → orion-community-svc-go (补全)
  ├── orion-visor-svc (11 TS)       → orion-visor-svc-go (补全)
  └── orion-pandawiki-svc (10 TS)   → orion-pandawiki-svc-go (补全)
DAYS:          3
DEPENDS_ON:    Agent-6 脚手架模板 (已完成)
TEMPLATE:      reports/orion-architecture-reference-2026-07-22.md §11.3
STATUS:        ✅ 已完成 (脚手架)
```

### Agent-8: 4 个新建 Go Repository 补全

```
AGENT_ID:      Agent-8
TASK:          4 个新建 Go 服务 Repository 从 stub 补全为完整实现
TYPE:          supplement (补全)
SERVICES:
  ├── blueprints/orion-chatops-svc-go (8 Go, 6 stub) → 完整实现
  ├── blueprints/orion-code-svc-go (10 Go, 5 stub)   → 完整实现
  ├── blueprints/orion-audit-svc-go (8 Go, 6 stub)   → 完整实现
  └── blueprints/orion-agent-svc-go (12 Go, 7 stub)  → 完整实现
DAYS:          1
DEPENDS_ON:    Agent-6 脚手架 (已完成)
STATUS:        ✅ 已完成
COMPLETION:    所有 repository 返回真实 SQL 查询 + go build 通过
```

### Wave 3 — 小服务修复

```
AGENT_ID:      Wave-3-Fix
TASK:          6 个小服务修复 + 2 个新建
TYPE:          fix + new
SERVICES:
  ├── Skill: Map→Repository 注入 → ✅ 已完成
  ├── Self-Healing: wiring 注册 → ✅ 已完成
  ├── Graph: 从 TS 新建 Go → ✅ 已完成
  ├── Runner: 从 TS 新建 Go → ✅ 已完成
  ├── CMDB: 已就绪（0 工作量）→ ✅
  └── Inception: 已就绪（0 工作量）→ ✅
STATUS:        ✅ 大部分完成
```

### P0 修复

```
AGENT_ID:      P0-Fix
TASK:          模块路径编译修复 + identity 迁移 + infra-ops 架构 + workflow ticket 删除 + Dockerfile
TYPE:          fix
COMPLETED:
  ├── 模块路径编译修复 (community/pandawiki/visor/monitor) → ✅ commit 61a27f231
  ├── workflow ticket 重复域删除 → ✅ 56 .go + 1 migration
  ├── 6 个 Dockerfile → ✅ commit 7f2b4fdfa
  └── infra-ops 架构修复 → ✅
PENDING:
  └── identity RunMigrations + 测试 → 🔄
STATUS:        🔄 进行中
```

### 合并 Agent — blueprints → platform-svc-go

```
AGENT_ID:      Merge-13-Domains
TASK:          13 个完整 Go 域从 blueprints 合并到 orion-platform-svc-go
TYPE:          merge
SERVICES:
  ├── CI-CD (122→55 Go) → 替换
  ├── Notification (115→46 Go) → 替换
  ├── Workflow (57→43 Go) → 替换
  ├── Ticket (98→43 Go) → 合并
  ├── InfraOps (97→61 Go) → 替换
  ├── AI (95→76 Go) → 替换
  ├── Identity (73→58 Go) → 替换
  ├── FinOps (71→44 Go) → 替换
  ├── Governance (68→41 Go) → 替换
  ├── ConfigMgmt (67→43 Go) → 替换
  ├── Security (62→35 Go) → 替换
  ├── Monitor (50→23 Go) → 替换
  └── EventBus (46→40 Go) → 替换
STATUS:        🔄 6 个 Agent 并行分析中
```
