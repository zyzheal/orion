# 第四轮深度分析：接线状态 + 数据库类型实况 + 测试与安全缺口

> 评审日期: 2026-08-29
> 评审问题: "进行深度分析还存在哪些问题" + "当前具备本管理哪些数据库类型"
> 评审对象: 前三轮评审结论（GAP-1~8 / IX-1~9 / PERM-1~6）未覆盖的**代码级接线实况**
> 评审方法: 代码级实测（wiring/router 接线审计 + 驱动 import 审计 + 测试文件审计 + 权限守卫审计）
> 评审结论: **发现 5 组此前未暴露的问题维度** — 其中 3 项 🔴 高危（模块未接线 / 数据库宣称与实连不符 / 第三套数据源表示）

---

## 一、为什么需要第四轮

前三轮评审回答了三类问题：

| 轮次 | 文档 | 覆盖维度 |
|------|------|---------|
| 第 1 轮 | `dba-data-ai-agent-gap-analysis-2026-08-29.md` | 能力缺口 + AI 集成设计（12/17 模块零 AI） |
| 第 2 轮 | `dba-data-deep-review-and-interaction-issues-2026-08-29.md` | 方案遗漏（GAP-1~8）+ 交互问题（IX-1~9） |
| 第 3 轮 | `permission-system-review-and-dba-data-integration-2026-08-29.md` | 权限接入（PERM-1~6）+ 权限矩阵 |

前三轮聚焦"**能力缺什么、交互断在哪、权限差什么**"，但**未验证"模块是否真正接线到服务入口"**。第四轮从服务入口反向审计接线实况，发现前几轮基于模块目录存在性的推断存在失真。

---

## 二、第四轮关键发现（5 组问题维度）

### 🔴 R4-1: datasource 模块完全未接线 — 数据源管理实际无可用 HTTP API

**代码级证据**（`orion-platform-svc-go`）：

```
internal/datasource/  → 仅 4 文件：
  repository/repository.go
  models/models.go
  service/service.go
  service/service_test.go
  （无 handler 目录）

grep -rn "datasource" cmd/server/ → 0 匹配
（wiring.go / router.go 零引用）
```

**结论**：datasource 模块虽然实现了 Service 层（连接池 + AES 加密），但：
- **没有 HTTP handler 层**（无法暴露 REST 端点）
- **服务入口零引用**（即使有 handler 也不会被挂载）
- 前端 `orion-frontend/src/api/` **无 datasource.ts**（无 API 客户端）

→ **"统一数据源管理"在运行时是空中楼阁**：数据源管理的 CRUD、连接测试、健康检查实际无任何可用 API。这与文档/权限矩阵中"datasource 模块 7 个守卫目标"形成落差——连路由都没有，何谈守卫。

**影响**：任何"复用 datasource 模块"的设计（ARCH-0.1/0.2、IX-1/IX-2 修正方案）目前都无法落地，因为该模块没有可调用的入口。

---

### 🔴 R4-2: datasource 宣称支持 5 种数据库，实际仅可连 2 种

**代码级证据**（`internal/datasource/service/service.go`）：

```
line 17:  _ "github.com/go-sql-driver/mysql"          ← 仅 import MySQL 驱动
line 18:  _ "github.com/jackc/pgx/v5/stdlib"          ← 仅 import PG 驱动
line 194: driverName := string(ds.Type)
line 195: db, err := sql.Open(driverName, dsn)
line 210: return fmt.Errorf("clickhouse driver not loaded (not in go.mod)")   ← 直接报错
line 213: return fmt.Errorf("elasticsearch not supported as managed datasource (use global-search module)")  ← 直接报错
line 216: return fmt.Errorf("mongodb driver not loaded (not in go.mod)")      ← 直接报错
```

**结论**：`models.go` 枚举声明 5 种类型（PG/MySQL/ClickHouse/ES/MongoDB），但 `connect()` 仅注册 mysql + pgx 两个驱动。ClickHouse/ES/MongoDB 一旦被选择，连接调用直接返回错误。**宣称 5 种，实连 2 种（PG + MySQL）**。

**这是第四轮最严重的"名义 vs 实际"落差**：前三轮文档中"datasource 支持 5 种数据库（最全）"的表述需要修正。

---

### 🔴 R4-3: 三套数据源表示并存，其中两套明文密码

**代码级证据**：

| 表示 | 位置 | 密码处理 | 状态 |
|------|------|---------|------|
| dba.DataSource | `internal/dba/models/models.go` | `Password *string` **明文** | 自有模型 |
| datasource.DataSource | `internal/datasource/models/models.go` | `PasswordEnc string` AES-256-GCM | 加密 ✅ |
| database-devops.DatabaseSource | `internal/database-devops/models/models.go` | `Password string db:"password"` **明文** | 自有模型 |

**database-devops 还暴露了 `/data-sources` REST 端点**（GET/POST/DELETE），这意味着**明文密码会通过 HTTP API 往返传输和持久化**。

**结论**：IX-8（密码加密不一致）此前仅指出 dba 一处明文；实际是**三套表示、两处明文**。`database-devops` 是新发现的第三套数据源表示，且带明文密码 + HTTP 端点，风险高于 dba（dba 至少无 REST 端点暴露密码结构）。

---

### 🟡 R4-4: database-devops 已接线已实例化，但 0 权限守卫 + 0 测试文件

**代码级证据**：

```
wiring.go:264:  dbdevopsH *dbdevops_handler.Handler            ← 已声明
wiring.go:646:  dbdevopsH = dbdevops_handler.NewHandler(infra.db.DB)   ← 真实实例化
router.go P1 组: if dbdevopsH != nil { dbdevopsH.RegisterRoutes(api) }  ← 条件注册

grep "RequirePermission" internal/database-devops/handler/ → 0 匹配（10 条路由 0 守卫）
find internal/database-devops -name "*_test.go" → 0 个测试文件
```

**结论**：
- **接线状态修正**：database-devops 是"**已 wiring + 真实实例化 + 已挂载**"（此前第三轮误判为"待验证"）；真正未接线的是 datasource。
- 10 条路由（Operation CRUD + backup/restore + data-sources）**全部无权限守卫** — 即 PERM-2 实测成立，且是**已上线的无守卫端点**（比 datasource 的"无端点"更危险）。
- **0 个测试文件** — 备份/恢复这种高危操作零测试保护。

---

### 🟡 R4-5: 前端数据域页面覆盖仅 3/17 模块

**代码级证据**（`orion-frontend`）：

```
src/pages/ grep database|datasource|dba|data- →
  仅: data-lineage / data-quality / dba  三个目录

src/api/ → database-devops.ts 存在 + dba.ts 存在；datasource.ts 不存在
```

**结论**：17 个数据相关模块中前端仅有 3 个页面 + 2 个 API 客户端。UI-1/UI-2 工作台的 21 个子页几乎全部需新建，且 datasource 无 API 客户端（与 R4-1 呼应）。

---

## 三、数据库类型支持现状（完整回答）

### 3.1 实测矩阵（修正版）

```
                  PG    MySQL   ClickHouse   ES   MongoDB   SQLite   Oracle   SQLServer
datasource       ✅实连  ✅实连   ❌驱动未加载  ❌不支持   ❌驱动未加载   -       -        -
  （宣称 5 种，实连 2 种：仅 import mysql + pgx，service.go:17-18）
data-catalog     ✅     ✅        -          -     -        ✅        -        -
  （introspector drivers map 3 种）
DBA 执行         ✅     ❌        ❌          ❌    ❌        ❌        ❌        ❌
  （service.go:246 硬编码 postgresql）
DBA 测试         ✅     ❌        ❌          ❌    ❌        ❌        ❌        ❌
  （testPGConnection 硬编码 postgres）
```

### 3.2 逐模块回答

| 模块 | 宣称 | 实连 | 证据 |
|------|------|------|------|
| **datasource**（统一数据源管理） | PostgreSQL/MySQL/ClickHouse/Elasticsearch/MongoDB（5 种） | **仅 PG + MySQL（2 种）** | 仅 import mysql + pgx 驱动；ClickHouse/ES/MongoDB 调用返回错误 |
| **data-catalog introspector**（schema 发现） | PG/MySQL/SQLite（3 种） | 3 种 | introspector.go drivers map |
| **DBA ExecuteDirectQuery**（SQL 执行） | 仅 PostgreSQL | 仅 PG | service.go:246 硬编码 |
| **DBA TestConnection** | 仅 PostgreSQL | 仅 PG | testPGConnection 硬编码 |
| **database-devops**（备份恢复） | 未明确 | 依赖 driver 注册，实际仅 PG/MySQL 可用 | 复用 database/sql，无独立驱动注册 |

### 3.3 缺失类型

- **企业级必需且完全缺失**：Oracle / SQL Server / OceanBase / openGauss / TiDB
- **宣称有但实际不可用**：ClickHouse（无驱动）/ Elasticsearch（引导到 global-search 模块）/ MongoDB（无驱动）
- **orion-dba 插件**（Yearning fork）以 MySQL 为主，与主服务 PG 优先相反

### 3.4 修正建议（分层实现）

```
Layer 1: datasource（连接管理）—— 当前实连 2 种 → 补 ClickHouse/MongoDB 驱动 + 扩展 Oracle/SQL Server/OceanBase（目标 7 种）
Layer 2: DBA 执行层 —— 删除硬编码 postgres，复用 datasource.GetConnection(id)（随 Layer 1 自动获得全部类型）
Layer 3: data-catalog introspector —— 扩展 ClickHouse/Oracle/SQL Server
Layer 4: AI Advisor —— 按方言（PG/MySQL/Oracle/ClickHouse）分发 Prompt + 语法校验
```

---

## 四、与前几轮结论的落差修正

| 前几轮表述 | 第四轮实测修正 |
|-----------|---------------|
| "datasource 支持 5 种数据库（最全）" | 宣称 5 种，**实连仅 2 种**（PG + MySQL） |
| "database-devops 待验证" | **已 wiring + wiring.go:646 真实实例化 + 已挂载**，但 0 守卫 + 0 测试 + 明文密码 |
| "IX-8 密码明文 vs AES（dba vs datasource）" | 实为**三套数据源表示**：dba 明文 / datasource AES / database-devops 明文（且带 HTTP 端点） |
| "datasource 0 守卫（PERM-1）" | 更严重：**无 handler 层 + cmd/server 零引用**，连路由都不存在 |
| "PERM-2 database-devops 0 守卫" | 实测成立，且是**已上线**的无守卫端点（备份/恢复/data-sources） |

---

## 五、新增待办（追加到 ALL_TODOS.md 第九章）

| ID | 任务 | 解决缺口 | 优先级 | 工作量 |
|----|------|---------|--------|--------|
| ARCH-0.9 | **datasource 补 handler 层 + 路由接线**（暴露 REST + wiring/router 挂载 + 前端 datasource.ts 客户端） | R4-1 | 🔴 高 | 2d |
| ARCH-0.10 | **database-devops 补 5 个权限守卫 + 0 测试补测试**（10 条已上线路由先补守卫，再补备份/恢复测试） | R4-4 + PERM-2 | 🔴 高 | 1.5d |
| ARCH-0.11 | **三套数据源统一 + 明文密码清理**（database-devops 复用 datasource 加密模型，删除 `/data-sources` 明文端点） | R4-3 + IX-8 | 🔴 高 | 2d |
| ARCH-0.12 | **datasource 补 ClickHouse/MongoDB 驱动**（宣称 5 → 实连 5） | R4-2 | 🟡 中 | 1.5d |

**第四轮新增 4 项，合计 7 人天**，全部为 Phase 0 架构统一的前置补充。

---

## 六、验收标准补充

| 维度 | 标准 | 验证方法 |
|------|------|---------|
| 接线完整 | datasource 在 cmd/server 有引用 + 有 handler 目录 | `grep -rn "datasource" cmd/server/` ≥1 匹配 |
| 驱动真实 | datasource 实连 ≥3 种（补 ClickHouse/MongoDB） | `grep "driver" internal/datasource/service/service.go` |
| 密码安全 | 全项目 0 处明文 `db:"password"` | `grep 'Password string' internal/*/models/` = 0 |
| 测试覆盖 | database-devops ≥5 个测试文件 | `find internal/database-devops -name "*_test.go"` ≥5 |
| 前端客户端 | src/api/datasource.ts 存在 | `ls src/api/datasource.ts` |

---

## 七、总结

第四轮从**服务入口反向审计接线实况**，暴露前三轮未覆盖的 5 组问题：

1. 🔴 **datasource 完全未接线**（无 handler + cmd/server 零引用）→ 统一数据源管理运行时不可用
2. 🔴 **宣称 5 种数据库、实连 2 种**（仅 import mysql+pgx，ClickHouse/ES/MongoDB 直接报错）
3. 🔴 **三套数据源表示、两处明文密码**（database-devops 明文 + HTTP 端点，风险最高）
4. 🟡 **database-devops 已上线但 0 守卫 + 0 测试**（比"无端点"更危险）
5. 🟡 **前端数据域覆盖 3/17 模块**（工作台 21 子页几乎全需新建）

**核心洞察**：数据域问题不仅是"缺 AI 能力"（第 1 轮）或"缺交互/权限"（第 2/3 轮），还有 **"宣称与实现脱节 + 模块未接线 + 已上线无防护"** 的工程真实性问题。修复顺序：先接线（ARCH-0.9）→ 再补防护（ARCH-0.10）→ 统一表示（ARCH-0.11）→ 补驱动（ARCH-0.12），然后才能开始 AI 能力建设。

---

> 文档结束。第四轮（接线实况）与前三轮（能力/交互/权限）配套使用，构成 DBA/数据/AI 域的完整问题全景：能力设计 → 交互修复 → 权限接入 → **接线落地**。
