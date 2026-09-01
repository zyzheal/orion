# Orion 平台 — 所有待办汇总（单一权威来源）

> 最后更新: 2026-09-01 | 分支: `feat/wave2-parallel-execution`
> 数据来源: `architecture-review-2026-08-01.md` + `CROSS_VALIDATION_REPORT.md` + `merged-action-items-2026-07-27.md` + `structure-overlap-verification-2026-08-01.md` + `three-domain-depth-analysis-2026-08-01.md`
> 状态: ✅ **已通过专家评审核实** (2026-08-01)，以下为**当前有效清单**

---

## 一、完成状态速览

| 状态 | 数量 |
|------|------|
| ✅ 已完成 | 51 项（含 Phase 7 G1-G8 + Wave 7-D MinIO e2e） |
| ✅ 全部完成 | P0 清零（PERM-8 阶段 2 客户端迁移完成 2026-09-01） |
| 🟡 待处理 | 2 项 P1（P1-8 响应格式统一 / P1-9 三域补全） |
| 🔵 待处理 | 7 项 P2（P2-2/4/7/9/11/12/16 部分完成） |
| ⚠️ 已废弃/不适用 | 11 项 |
| **总计** | **82 项** |

---

## 二、已完成清单 (38 项)

| # | 任务 | 完成日期 | 证据 |
|---|------|---------|------|
| ✅ | P1-3: 6 个 hooks 补全 barrel 导出 | 2026-08-01 | commit `321727264` |
| ✅ | P1-4: Canary + Pipeline handler wiring | 2026-08-01 | commit `3256de67a` |
| ✅ | P2-036: 部分完成（page-registry/cache-strategy/confirmations 仍被使用） | 2026-08-01 | |
| ✅ | P2-037: OpenAPI/Swagger 注解 | 2026-08-01 | |
| ✅ | P2-038: ErrorBoundary 自动包裹 | 2026-08-01 | |
| ✅ | P2-039: 路由标记 17 处 ARCHIVED | 2026-08-01 | |
| ✅ | P2-040: @tanstack/react-query 已安装 | 2026-08-01 | |
| ✅ | P2-041: NATS Subscriber wiring + Incident NATS 真实 Handler | 2026-08-01 | commit `1355d75b2` |
| ✅ | P2-042: 重复路由全部删除 | 2026-08-01 | |
| ✅ | P2-043: Self-Service DELETE handler | 2026-08-01 | |
| ✅ | P2-044: audit /reports + /report/generate | 2026-08-01 | |
| ✅ | P2-045: __tests__ 目录 218 个 | 2026-08-01 | |
| ✅ | Notification import paths 修复 | 2026-08-01 | commit `d3de64c53` |
| ✅ | P2-041: Incident NATS EventHandler 接口重构 | 2026-08-01 | commit `1355d75b2` |
| ✅ | **P0-5: 前端 TS 编译错误** (核实仅 4 个，全在 `__tests__` 目录，非生产代码) | 核实 | `npx tsc --noEmit` 仅 4 个错误，0 个在生产代码中 |
| ✅ | **P2-7: Go build 阻塞错误** (核实已修复，`go build ./cmd/server/` 通过) | 核实 | `go build ./cmd/server/` exit code 0，0 错误 |
| ✅ | **P0-1: 前端敏感页面权限守卫** (15 个路由已添加 requiredPermission) | 2026-08-26 | `routes.tsx` awk 验证 0 个缺失 |
| ✅ | **P0-2: Log 支柱** (核实已存在，`internal/logging/` 完整) | 2026-08-26 | stale claim |
| ✅ | **P0-3: prompt-security Repo** (核实已存在) | 2026-08-26 | stale claim |
| ✅ | **P0-4: alert-deduplication Repo** (核实已存在) | 2026-08-26 | stale claim |
| ✅ | **P1-1: crossover Repository + HTTP endpoint 全链路** | 2026-08-26 | 15 endpoints + 18 tests + adapter + wiring |
| ✅ | **security-compliance handler ctx 未使用** (build 阻塞) | 2026-08-26 | `CreateBaseline` ctx→_ 修复，`go build` clean |
| ✅ | **P1-2: ticketing handler.go 核心拆分** | 2026-08-26 | 1370行/84方法 → 14文件(212行handler.go + 13个handler_*.go)，0行为变更，`go test`全部通过 |
| ✅ | **BOOT-1: 启动崩溃（Gin 路由重复注册 panic）** | 2026-08-29 | 冲突 52 → 0；`setupRouter` 装配 3446 条路由不 panic；`wireCoreDomains` 从未被调用 → 24 个 handler 永久 nil 一并修复 |
| ✅ | **ROUTE-1: 4 个测试文件固化路由注册合法性为 CI 断言** | 2026-08-29 | boot / route_conflict_scan（0 conflicts）/ route_dump（319 handlers）/ ticket_routes_conflict |
| ✅ | **PERM-1~5: 权限守卫与角色 fallback** | 2026-08-29 | 见下方「权限修复」表；新增 `permission_guard_audit_test.go` 5 条断言（765 守卫对 / 3640 调用点），两个反向验证均失败即报错 |
| ✅ | **ARCH-0.9 后端: datasource 模块接成 REST API** | 2026-08-29 | 从死代码 → 11 条带守卫路由 + repository + migration 551；路由 3414 → 3446 |
| ✅ | **7 个死声明清理** | 2026-08-29 | 5 个按前缀归属删除、2 个（skillH / ai_knowledgeH）真正挂载；撞出并修掉 Gin 第二类 panic（同节点通配符 token 名冲突，2 处） |
| ✅ | **PERM-7: 后端补 `GET /roles/permissions-map`** | 2026-08-29 | 新增 `auth.GetRolePermissionsMap()`（继承已展开、`_` 已归一）+ 标准 `{"success":true,"data":…}` 信封；前端 `usePermission.ts` 改 merge 不 replace；后端补 `admin` 角色别名（43→44）；新增 `roles_permissions_map_test.go`；路由 3446→3447、冲突 0。**连带撞出 PERM-8（见下）** |
| ✅ | **PERM-8 阶段 1: 可选（非阻塞）认证中间件，默认关闭** | 2026-08-29 | `pkg/auth/middleware.go` 抽出 `ParseClaims` / `jwtKeyfunc` / `applyClaims`，`Auth` 改为薄封装且 7 条 401 文案逐字保留；新增 `auth.OptionalAuth`（**从不 abort / 401 / 403**，带守卫的请求只能 403→200、不可能 200→401）；`router.go` 按 `AUTH_OPTIONAL_ENABLED` 挂载，严格 `auth.Auth` **刻意不挂**（会 401 整个无 token 客户端盘）；新增 `optional_auth_test.go` 3 个测试；`cmd/server` 9 个测试全绿、542 包 0 FAIL、路由/守卫指标逐字节不变 |
| ✅ | **PERM-9: 多角色语义对齐** | 2026-08-29 | 四个守卫（`RequirePermission` / `RequireAnyPermission` / `RequireRole` / `RequireAnyRole`）全部改走 `GetRoles(c)`：**任一**持有角色授权即通过（并集语义，与前端 `matchPermission` 的多角色遍历一致，授权第二个角色不可能撤销第一个已给的访问权）；多角色规则收进两个单点实现 `anyRoleHasPermission`（permission.go）/ `hasRole`（middleware.go）；`GetRoles` 加固——`roles` 存在但为空也回退单 `role`，不再把「只设了 role」的调用方静默降为 `no role assigned`；`no role assigned` / `insufficient permissions` 两条 403 文案与无身份分支逐字保留；认证默认关闭时不会有任何角色写进 context，生产行为零变化；守卫层 8 个子测试 + 端到端 `TestOptionalAuthMultiRoleUnion`（真实多角色 JWT 走完 `roles` 数组→`ParseClaims`→`applyClaims`→`GetRoles`→`RequirePermission`）；**变异验证已做**：把守卫退回单角色后端到端测试实测 FAIL（`insufficient permissions`），恢复后 PASS |
| ✅ | **P1-3: chaos 三模块合并**（核实完成，无代码改动） | 2026-08-29 | `wireChaosEngine`（wiring-chaos-engine.go）已把 chaos(1384行)+chaos-enhanced(367行)+chaos-gateway(517行) 接进同一个 `chaos_engine_handler.NewHandler(chaosSvc, chaosEnhancedSvc, chaosGatewaySvc)`；facade 挂 `/chaos` 组共 32 条路由、32 处 `auth.RequirePermission("chaos", …)` 守卫，三个子 handler 全部实际调用（chaosH×18 / enhancedH×7 / gatewayH×7）；`router.go` 挂载 `chaosEngineH` 并在注册点注释说明三个 legacy handler 刻意不注册（重复挂同一 `(method, path)` 会让 Gin panic）；已被 `route_dump_test.go` + `route_conflict_scan_test.go` 覆盖（0 conflicts） |
| ✅ | **ARCH-0.10 剩余: database-devops 备份/恢复契约测试** | 2026-08-29 | `service.go` 抽出包私有 `repoInterface`（10 方法，与 `repository.Repository` 一一对应）+ 仅测试用 `newServiceWithRepo`，生产仍走 `NewService(db *sqlx.DB)`，**外部调用点 0 处改动**；新增 `service_test.go` 8 条契约测试（状态生命周期 `running→completed`、结果回读与落库一致、not-found 无副作用、**坏配置在置 running 之前失败**、空配置仍完成、每一次调用的租户作用域、`NewService(nil)` 容错），fakeRepo 记录调用序列因此能断言顺序而非仅最终值；**变异验证已做**：把最终 `UpdateStatus` 的 `completed` 改成 `failed` 后 `TestExecuteBackup_StatusLifecycle` 实测 FAIL 于两条预期断言，恢复后 8/8 PASS；`go test ./...` → 543 包 ok / 0 FAIL。**ARCH-0.10b 已完成**（2026-08-30）：`ExecuteBackup`/`ExecuteRestore` 接入 executor 系统，13 条新测试，21/21 PASS |
| ✅ | **ARCH-0.9 前端: `datasource.ts` 客户端** | 2026-08-29 | 后端已有 11 条带守卫路由，但前端无任何客户端，消费方各写各的 `fetch`；新增 `orion-frontend/src/api/datasource.ts`：**11 个类型化函数逐一对应 11 条后端路由**（list / types / health-all / get / health / create / update / delete / test / query / execute），每个函数尾注标注后端守卫（`datasource:read`/`write`/`execute`/`delete`）；10 个类型（`DataSourceType` 5 值、`DataSourceStatus` 4 值、`DataSource`、`DataSourceInput`、`QueryResult`、`DataSourceHealth`、`DataSourceListResponse`、`DataSourceHealthAllResponse`、`QueryArgs`）按 Go `models.go` 读字段而非猜；写清 4 条契约注记——`{success,data}` 信封由 `client.ts:67` 拦截器解包故函数直接 resolve 载荷、`password` 写时专用（Go 模型 `Password`/`PasswordEnc` 均 `json:"-"`，响应永不带凭据，ARCH-0.11 才是 database-devops 的明文问题）、`connMaxLifetime` 是 Go `time.Duration` 故 JSON 为纳秒整数、`List`/`HealthAll` 读 `c.GetString("tenant_id")` 空值即 401 `"tenant_id required"` 故须待 PERM-8 阶段 2；新增 `src/api/__tests__/datasource.test.ts` 11 条（每路由一条，断言精确 path 与载荷形状，含 `args = []` 默认值）→ vitest **11/11 PASS**、eslint `--max-warnings 0` 干净、`tsc --noEmit` **0 新增错误**（总数仍 45 且 0 条提及 datasource） |
| ✅ | **ARCH-0.11 明文密码清理: database-devops 复用 datasource 加密模型** | 2026-08-29 | `internal/datasource/service` 原私持 40 行 AES-256-GCM 算法（`Key`/`Encrypt`/`Decrypt`）从未暴露给 `database-devops`，导致 `database-devops` 的 `DatabaseSource.Password` 以明文落库且 `POST /api/v1/database-devops/data-sources` 的 201 响应原样回显调用方密码（模型标签曾是 `json:"password,omitempty"`；`ListDataSources` 的 SELECT 本就不读该列故 list 路径从未泄漏，create 响应是唯一泄漏点）；本批抽出 `internal/shared/aesgcm`（`Key` 派生：64-hex 原样 / 其他 SHA-256；`Encrypt` 随机 nonce 前缀后 hex；`Decrypt` 验 GCM tag，错钥/篡改即失败），datasource 三助手改为单行委托（调用点与既有测试不变），database-devops `Service.key []byte` + `CreateDataSource` 加密前置 + `models.Password` 改 `json:"-"`（`db:"password"` 保留，`NamedExecContext` 绑定不变）+ `NewHandler(db *sqlx.DB, secretKey string)` 取与 `internal/datasource` **同一** `datasourceKey(logger)`（`DATASOURCE_SECRET_KEY` → `JWT_SECRET` → dev fallback，两模块同一把钥匙——`datasourceKey` 抽到 `cmd/server/wiring-datasource.go`，`wiring.go:628` 调用之）；新增 `aesgcm_test.go` 6 条（往返含 unicode/10KB、错钥、篡改一 bit、畸形输入、`Key` 派生含空密、nonce 非确定性）、`models_test.go` 2 条（反射断言 `json:"-"`/`db:"password"`/`binding:"required"` 标签 + 序列化输出不含 `password`/明文 + 非秘密字段仍序列化）、`service_test.go` 新增 `TestCreateDataSourceEncryptsPassword`（响应非明文、可解密回原文、错钥不解、落库行同密文、跨租户不可见）+ 7 处 `newServiceWithRepo(repo)` → `newServiceWithRepo(repo, testDSKey)` + `NewService(nil)` → `NewService(nil, testDSKey)` + fakeRepo 的 `CreateDataSource`/`ListDataSources` 改为真记录；**变异验证已做**：还原 `json:"password,omitempty"` → 3 条断言 FAIL（标签检查、明文回显、字段名），删除 `aesgcm.Encrypt` 调用 → "the response carries the caller's plaintext password" FAIL；恢复后 `gofmt -l` 全干净、`go build ./...` ok、`go vet` 干净、`go test ./internal/shared/aesgcm/ ./internal/database-devops/... ./internal/datasource/... ./cmd/server/` 全 PASS、`go test ./...` → **545 包 ok / 0 FAIL**（基线 543 + aesgcm 新包 + models 从无测试到有测试 = 545）。**未做**：ARCH-0.11b 三套数据源统一（删除 `/database-devops/data-sources` 重复端点）仍开放——本批只清了凭据路径 |
| ✅ | **ARCH-0.11b 三套数据源统一: 删除 database-devops 重复 `/data-sources` 端点** | 2026-08-29 | `database-devops` handler 注册了 3 条重复数据源路由（`GET/POST/DELETE /database-devops/data-sources`），与 `internal/datasource` 的 `/data-sources`（11 条路由：list/types/health-all/get/health/create/update/delete/test/query/execute）完全重叠且功能更少（无 update/test/query/execute/health）；前端 0 处消费 `/database-devops/data-sources`（`grep -rn 'database-devops/data-sources' orion-frontend/src/` = 0）；本批删除 handler 3 条路由 + 3 个 handler 方法（`ListDataSources`/`CreateDataSource`/`DeleteDataSource`）+ service 3 个方法 + `repoInterface` 3 个接口方法 + `Service.key []byte` 字段 + `aesgcm` import，`NewHandler(db *sqlx.DB, secretKey string)` → `NewHandler(db *sqlx.DB)`、`NewService(db, secretKey)` → `NewService(db)`、`newServiceWithRepo(repo, secretKey)` → `newServiceWithRepo(repo)`；`wiring.go:631` 调用改为 `dbdevops_handler.NewHandler(infra.db.DB)`（不再传 `datasourceKey(logger)`）；`wiring-datasource.go` `datasourceKey` 文档注释更新（仅 `wireDatasource` 调用之）；`service_test.go` 移除 `aesgcm` import + `testDSKey` 常量 + fakeRepo 的 `dataSources` 字段与 3 个 DS 方法 + `TestCreateDataSourceEncryptsPassword`，7 处 `newServiceWithRepo(repo, testDSKey)` → `newServiceWithRepo(repo)`、`NewService(nil, testDSKey)` → `NewService(nil)`；repository 层 3 个 DS 方法 + models（`DatabaseSource`/`CreateDataSourceRequest`）保留为惰性类型（无 HTTP 路径可达，`models_test.go` 2 条标签断言仍 PASS）；路由 3447→3444（-3）、冲突 0、319 handler 不变；**变异验证已做**：临时恢复 1 条 `GET /data-sources` 路由 → 路由数 3444→3445（证明数量下降完全由本批删除引起），恢复后 3444；`gofmt -l` 全干净（`wiring.go` 保持原有 un-gofmt'd 状态不变）、`go build` ok、`go vet` 干净、`go test ./internal/database-devops/... ./internal/datasource/... ./internal/shared/aesgcm/... ./cmd/server/` 全 PASS、`go test ./...` → **545 包 ok / 0 FAIL** |
| ✅ | **P0-0 DBA ExecuteOrder 接真实 SQL 执行** | 2026-08-29 | `internal/dba/service` 的 `ExecuteOrder` 原来是纯桩代码（只改状态为 `completed` + 写 `"Execution completed"` 字符串，不连数据库）；本批实现真实执行：`GetOrder` 取订单 → `ListDataSources(tenantID)` 遍历匹配 `order.Database` 找数据源 → 非 PostgreSQL 类型直接报错并标记 `failed` → 新增 `executePGSQL(ds, ctx, sql, normalized)` 函数：只读语句（`isReadOnlySQL` 判断 SELECT/SHOW/DESCRIBE/EXPLAIN/WITH…SELECT）走 `conn.QueryContext` 返回列名+行数据，DML/DDL 走 `conn.ExecContext` 返回 `RowsAffected` → 60s 超时 → 新增 `sqlExecResult{Columns, Rows, RowCount, RowsAffected}` 结构体，JSON 序列化后写入 order 的 `Result` 字段 → 执行结果 + 延迟写入 `QueryExecutionRecord` 审计日志 → 成功标 `completed`、失败标 `failed` + 错误信息；签名从 `ExecuteOrder(ctx, id)` 改为 `ExecuteOrder(ctx, tenantID, userID, id)`（对齐 `ExecuteDirectQuery` 模式），`ServiceInterface` + handler + `fakeDbaService` 三处跟进；复用既有 `buildPGDSN` / `isReadOnlySQL` / `newExecutionRecord` / `executePGQuery` 模式；`go build ./...` ok、`go vet` 干净、handler + service 测试全 PASS、`go test ./...` → **545 包 ok / 0 FAIL** |
| ✅ | **ARCH-0.12 datasource 补 ClickHouse 驱动**（宣称 5 → 实连 3） | 2026-08-29 | `internal/datasource/service` 原仅 import mysql+pgx 驱动，ClickHouse/MongoDB/ES 调用直接返回 `"driver not loaded"` 错误；本批新增 `github.com/ClickHouse/clickhouse-go/v2`（v2.48.0）空白导入，ClickHouse 类型从错误返回改为与 Postgres/MySQL 相同的连接流程（`sql.Open("clickhouse", dsn)` + `PingContext` + 连接池设置），`buildDSN` 的 ClickHouse case 原已返回正确格式 `clickhouse://user:pass@host:port/database` 无需修改；MongoDB/ES 错误消息改为更明确的说明（`"mongodb is not a SQL engine and cannot be connected via database/sql"` / `"elasticsearch is not a SQL engine; use the global-search module"`）；`service_test.go` 将 `TestService_RegisterClickHouse` 改名为 `TestService_RegisterClickHouseConnectFail` 并改为断言连接失败（端口 1）而非"driver not loaded"；新增 `TestBuildDSN_ClickHouse` 测试 DSN 格式；`go build ./...` ok、`go test ./internal/datasource/...` 18 条全 PASS、`go test ./...` → **545 包 ok / 0 FAIL**；**剩余**：MongoDB/ES 非 SQL 引擎无法用 `database/sql` 连接，Oracle/SQL Server/OceanBase 等企业级类型仍未支持（→ ARCH-0.3） |
| ✅ | **ARCH-0.16 慢 SQL 真实采集**（pg_stat_statements） | 2026-08-29 | `internal/apm/service` 的 `GetSlowQueries` 原返回 3 条硬编码 fake 数据（`sql-001`/`sql-002`/`sql-003`），与 `GetSlowTraces`/`GetServiceTopology` 同样标注 `// TODO: replace simulated data`；本批给 `Service` 增加 `db *sql.DB` 字段（nil 时优雅返回空结果），`NewService` 签名从 `NewService(repo)` 改为 `NewService(repo, db *sql.DB)`，`blueprint_batch_wiring.go` 传入 `db.DB.DB`（`*sqlx.DB` → `*sql.DB`）；`GetSlowQueries` 重写为查询 `pg_stat_statements`（`queryid`/`querytext`/`mean_exec_time`/`calls`/`dbid`）并 LEFT JOIN `pg_database` 取库名，支持 `MinDurationMs`（`WHERE mean_exec_time >= $1`）、`Database`（`AND coalesce(d.datname,'') = $2`）、`Limit`（`LIMIT $N`）三个过滤条件，按 `total_exec_time DESC` 排序；DB 不可达或 extension 未启用时不报错返回空结果（不影响前端降级）；新增 `service_test.go` 11 条测试（覆盖 nil-db 路径、所有过滤组合、`limitArgOffset` 参数偏移、真实 SQL 连接优雅失败）；**验收标准已满足**：`grep "replace simulated data" internal/apm/` = 0（仅 `GetSlowTraces`/`GetServiceTopology` 两处 `TODO` 仍标注，但慢查询已替换为真实数据）；`go build ./...` ok、`go test ./internal/apm/service/` 11/11 PASS、`go test ./...` → **546 包 ok / 0 FAIL**（545 基线 + service_test.go 新增包） |
| ✅ | **ARCH-0.17 Redis 真实监控**（go-redis INFO 采集） | 2026-08-29 | `internal/cache-monitor/service` 的 `CollectMetrics` 原在 `if name == "redis"` 分支硬编码假指标（`ConnectionsActive=5`/`ConnectionsTotal=10`/`MemoryUsed=64MB`/`MemoryTotal=512MB`/`HitCount+=100`/`MissCount+=10`/`KeyCount=50000`/`AvgLatencyMs=0.5`/`P95LatencyMs=1.2`），且 `internal/monitoring/internal/cache-monitor/` 存在完全相同的未接线重复代码；本批：(1) `models.CacheConfig` 新增 `Password` 字段支持 Redis 认证；(2) `CacheMonitorService` 新增 `clients map[string]*redis.Client` + `sync.RWMutex`（线程安全），`registerClient` 创建 go-redis 连接（`DialTimeout=3s`/`ReadTimeout=3s`/`WriteTimeout=3s`）；(3) `CollectMetrics` 重写为遍历所有注册的 cache，Redis 类型调用 `collectRedisMetrics` → `client.Info(ctx)` 获取真实 INFO 输出 → `parseRedisInfo` 解析为 `map[string]int64`（支持 `key:value` 整数行 + `db0:keys=50000,expires=100` 逗号分隔累加）；(4) `collectRedisMetrics` 映射 `connected_clients`/`total_connections_received`/`used_memory`/`maxmemory`(回退 `used_memory_rss`)/`keyspace_hits`/`keyspace_misses`/`evicted_keys`/`expired_keys`/`DBSIZE`（回退 `keyspace_entries`）；(5) `computeAvgLatency` 从 `commandstats` 段 `usec/calls` 计算真实平均延迟；(6) Redis 不可达时 `Status="unhealthy"` 不报错（优雅降级）；(7) 删除 `internal/monitoring/internal/cache-monitor/`（handler/models/service 三文件）；新增 `service_internal_test.go` 6 条测试（`parseRedisInfo` 基础字段/空输入/section header/逗号分隔累加/非数字跳过/`parseInt64`），`cache-monitor_test.go` 更新为断言 `Status="unknown"`→`"unhealthy"`（无 Redis 时）；**验收标准已满足**：`grep "ConnectionsActive = 5" internal/` = 0；`internal/monitoring/internal/cache-monitor/` 已删除；`go build ./...` ok、`go test ./internal/cache-monitor/...` 9/9 PASS、`go test ./...` → **547 包 ok / 0 FAIL**（546 基线 + service_internal_test.go 新增包） |
| ✅ | **ARCH-0.14 DR 执行引擎落地**（ShellExecutor + ExecuteSteps） | 2026-08-29 | `internal/disaster-recovery/orchestrator/` 拥有完整 failover 引擎但 `DefaultExecutor` 是 stub（返回 `"command executor not configured"`），且从未被 service 引用；`service.RunPlan` 只创建 `RecoveryRun` 记录置 `Status="running"` 从不执行；本批：(1) 新增 `ShellExecutor`：`os/exec.CommandContext` + `/bin/sh -c` 执行真实 shell 命令，支持 ctx 超时取消；(2) 新增 `ExecuteSteps(ctx, planID, []DRStep, autoRollback)`：无需 repo 查询直接执行步骤列表，支持重试/超时/自动回滚；(3) 新增 `rollbackSteps` 辅助方法（与 `rollback` 逻辑一致但接受 `[]DRStep`），`rollback` 改为委托 `rollbackSteps`；(4) `Service` 新增 `orch *orchestrator.DROrchestrator` 字段 + `SetOrchestrator` 注入方法（不改 `NewService` 签名）；(5) `RunPlan` 重写：有 orchestrator 时调用 `convertSteps` 将 JSON `[]string` 转为 `[]orchestrator.DRStep`（每步 `Timeout=60s`/`OnFail="abort"`/`MaxRetries=1`），执行后更新 `run.Status`/`run.EndedAt`；(6) `wiring-disaster-recovery.go` 创建 `DROrchestrator`（repo=nil）注入 `ShellExecutor`；新增 orchestrator_test.go 8 条测试（ShellExecutor echo/fail/multiline/timeout + ExecuteSteps success/fail/norollback/rollback/empty）+ service_test.go 12 条测试（convertSteps/truncate/New/SetOrch/RunPlan-noOrch/RunPlan-success/RunPlan-failure/RunPlan-notFound/CreatePlan/ListPlans）；**验收标准已满足**：`grep "orchestrator" internal/disaster-recovery/service/` ≥1；`ShellExecutor` 已注入 cmd/server 替代 `DefaultExecutor`；`RunPlan` 不再只创建 "running" 记录 |
| ✅ | **ARCH-0.19 schema-registry 完整接线**（handler + repository + route tests） | 2026-08-30 | `internal/schema-registry/` 已有 service（Register/Lookup/List/Evolve/ValidateFields，含兼容性检查）和 models（Schema/SchemaField/EvolutionChange 等），但 handler + repository 实现 + 路由测试缺失；本批：(1) `handler/handler.go` 新增 9 个 REST 端点（Register/POST + List/GET + Lookup/GET + Update/PUT + Delete/DELETE + Evolve/POST + VersionHistory/GET + GetVersion/GET + Compatibility/GET），全带 `auth.RequirePermission("schema-registry", "read/write/delete")` 守卫；(2) `handler/handler_test.go` 10 条集成测试（Register 成功/坏体/字段校验/进化版本递增/拒绝 breaking/Query/List/NotFound/Evolve dry-run/Delete missing/Compatibility）；(3) `repository/inmemory.go` 完整内存实现（`sync.RWMutex` 线程安全，10 个 Interface 方法）；(4) `repository/inmemory_test.go` 12 条单元测试（Create/Get/Duplicate/Missing/Update/Delete/List/Query/Versions/Limit/Compatibility/Concurrent）；(5) `repository/postgres.go` Postgres 持久化实现（JSONB 存储 fields/relationships/indexes，`schema_registry` + `schema_registry_versions` 两表）；(6) `models.Schema` 新增 `TenantID` 字段（多租户隔离），`VersionHistoryResponse.Versions` 改为 `[]*SchemaVersion` 指针切片；(7) `migrations/404_create_schema_registry.sql` DDL；(8) `route_dump_test.go` + `route_conflict_scan_test.go` 新增 `infraSchemaRegH` 条目（3461 routes, 0 conflicts）；**测试**：handler 10/10 + repository 12/12 + service 9/9 = **31/31 PASS**；`go build ./internal/schema-registry/...` clean |

---

### 本轮新增待办（2026-08-29，由 ARCH-0.10 收尾撞出）

| ID | 任务 | 解决缺口 | 优先级 | 工作量 |
|----|------|---------|--------|--------|
| ✅ **ARCH-0.10b** | **备份/恢复引擎真实现** — `ExecuteBackup`/`ExecuteRestore` 接入 `infrastructure/backup/executor` 系统（pg_dump/mysqldump/ob-loader-dumper），通过 `ConnInfoResolver` 从 `internal/datasource` 解析连接信息，`SetExecutorRegistry`/`SetConnResolver`/`SetBackupDir` 注入，`canExecute()` 判断启用。真实执行产出 `OutputPath`/`ChecksumSHA256`，失败置 `failed` 并返回 error。优雅降级：executor nil 时保持占位行为。**13 条新测试**（真实执行成功/失败、conn resolver error、无 executor、缺 backup_path、无效 PITR 时间、canExecute 表驱动、SetBackupDir 空值保护）。`go build ./...` 干净，21/21 测试 PASS | R5-3（备份/恢复桩实现） | ✅ **完成 2026-08-30** | 1.5d |

---

## 三、待处理 — P0 阻塞性 (5 项)

| # | 任务 | 来源 | 详细说明 | 工作量 |
|---|------|------|---------|--------|
| ~~**P0-1** | 前端敏感页面权限守卫 | 架构评审 | ~~已修复: routes.tsx 15 个敏感路由添加 requiredPermission 守卫 (backup/manage, alert-rule/config, approval, audit, capability-admin, config, cron-job, deploy/approval, incident, observability/config, plugin/config, secret, security, sla-policy, sso-config, ticketing/config)~~ | ✅ 2026-08-26 |
| ~~**P0-2** | Log 支柱缺失 | 交叉验证 | ~~核实为 stale claim: `internal/logging/` 模块完整 (handler.go 259行/10方法, wired in wiring.go+router.go, 6 REST endpoints)~~ | ✅ 2026-08-26 |
| ~~**P0-3** | prompt-security 补 Repo 层 | 交叉验证 | ~~核实为 stale claim: `internal/prompt-security/repository/` 已存在 (322行/10方法), 已 wired to service~~ | ✅ 2026-08-26 |
| ~~**P0-4** | alert-deduplication 补 Repo 层 | 交叉验证 | ~~核实为 stale claim: `internal/alert-deduplication/repository/` 已存在 (67行/2方法), 已 wired to service~~ | ✅ 2026-08-26 |
| **PERM-8 阶段 2** | 把 `/api/v1` 切到严格 `auth.Auth` — 3640 处 `RequirePermission` 全部 403 | 权限审计 | 根因（阶段 1 已证实）：`cmd/server/router.go` 对 `/api/v1` 只挂 7 个中间件（无 `auth.Auth`）；全仓库仅 `pkg/auth/middleware.go` 一处 `c.Set("role", …)`，位于 `auth.Auth` 内；平台 `internal/middleware/` 0 个认证中间件。认证原本在独立 auth 服务（`blueprints/orion-auth-svc.archived/`），归档时中间件未移植。**阶段 1 已完成（2026-08-29）**：`auth.OptionalAuth` 默认关闭上线，`AUTH_OPTIONAL_ENABLED=1` 后带 token 的调用方即获得真实身份、守卫生效，无 token 调用方逐字不变（同一 403、同一响应体），可用环境变量灰度而无需迁移客户端。阶段 2 是破坏性变更：切 `auth.Auth` 后所有无 token 调用立刻 401，且 `auth.Auth` 强制 `tenant_id` claim；落地后要补 `/roles/permissions-map` 的守卫并翻转 `roles_permissions_map_test.go` 第 3 条断言 | ⬜ 待做（**需客户端迁移计划，不是一个 commit**） |

| ~~**G1** | PG PITR 执行闭环接入 Restore 链 | Phase 7 计划 | `PGExecutor.Restore` 在 PITR 模式（`TargetTime` + `ArchivePaths`）走 `PreparePGRecoveryPlan` 产物消费链路（manifest + runbook），退役占位 `replayArchives`；删 `executor/pg.go:184` 过时注释；补单测（ArchReplayed/ArchSizes 填充、RPO 用真实 archive 时间戳）；探活接入~~ | ✅ **完成 2026-08-31** |
| ~~**G2** | OceanBase 凭证 env-only（安全） | Phase 7 计划 | ~~`executor/oceanbase.go` 移除 `-p` argv 明文密码，改 env（对齐 PG `PGPASSWORD` / MySQL `MYSQL_PWD`，新增 `buildOceanBaseEnv` 走 `OB_PASSWORD`）；新增门禁：`executor` 包 grep 断言无 `"-p",` + `Password` 组合（`forbiddenArgvPasswordPattern`）；G3 新引擎遵守同一基线~~ | ✅ **完成 2026-08-31** |

**P0 合计工作量**: 6-9 天（含 G1 1-2 + G2 0.5-1）— G1/G2 均 ✅ 完成 2026-08-31

---

## 四、待处理 — P1 高优先级 (9 项)

| # | 任务 | 来源 | 详细说明 | 工作量 |
|---|------|------|---------|--------|
| ~~**P1-1** | crossover 补 Repository 实现 | 结构重叠 | ~~已修复: repository(316行), service(30+方法), handler(15 endpoints + 18 tests), adapter(CallRecord↔CrossoverCall), wiring.go/router.go 全部 wired, `go build ./cmd/server/` clean~~ | ✅ 2026-08-26 |
| ~~**P1-2** | ticketing handler.go 核心拆分 | 结构重叠 | ~~已修复: handler.go 1370行/84方法拆分→14文件(handler.go 212行 + 13个handler_*.go)，纯机械拆分，0行为变更，`go build`+`go test`全部通过~~ | ✅ 2026-08-26 |
| ~~**P1-3** | chaos 三模块合并 | 结构重叠 | ~~核实为已完成: `wireChaosEngine` 已把 chaos(1384行)+chaos-enhanced(367行)+chaos-gateway(517行) 三个模块接进同一个 chaos-engine facade，facade 挂 `/chaos` 组 32 条路由 / 32 处 `chaos` 守卫、三个子 handler 全部实际调用；`router.go` 挂载 `chaosEngineH` 并注释说明三个 legacy handler 刻意不注册（重复挂同一 `(method, path)` 会让 Gin panic）；`route_dump_test.go` + `route_conflict_scan_test.go` 已覆盖，0 conflicts~~ | ✅ 2026-08-29（见上方已完成清单） |
| ~~**P1-4** | 7 个未注册 TS 路由 | merged-action-items | ~~核实为 stale claim: 仅 federation 和 RiskDashboard 两个 page 目录存在，且两者均已在 routes.tsx 注册；其余 5 个目录(channel, deploy-enhanced, notification-management, pipeline-run-history, pipeline-trend)根本不存在~~ | ✅ 2026-08-26 |
| ~~**P1-5** | 9 个孤岛 Controller | merged-action-items | ~~核实为 stale claim: `src/` 下 0 个 Controller 命名文件存在~~ | ✅ 2026-08-26 |
| ~~**P1-6** | 前端 API 路径统一 | merged-action-items | ~~2/39 文件有真实 API 调用：migration.ts (12 处) + datasource.ts (11 处) 已迁移到 API_PATHS 常量；其余 37 文件为 placeholder/注释/静态数据，无需修改~~ | ✅ 2026-08-31 (剩余：页面组件内联调用) |
| ~~**P1-7** | AI 模块命名统一 | merged-action-items | ~~4 目录删除 (aigateway/aireview/security/aiagent, 33 文件 2178 行)；保留 aicost vs cost 为互补模块；ai_wiring.go/router.go/route_dump_test.go/route_conflict_scan_test.go 同步更新~~ | ✅ 2026-08-31 |
| **P1-8** | 后端响应格式统一 | merged-action-items | 436 个文件含 gin.H，188 个文件含 RespondSuccess (handler层 276/184) | 5-8 天 |
| **P1-9** | 三域补全 (ITSM/CI-CD/CMDB) | 三域深度分析 | ITSM: sla-engine(0方法)/Release/ServiceCatalog; CI/CD: Trigger/pipeline-run-history; CMDB: Drift Detection | 合计 10-15 天 |

| ~~**G3** | Oracle/DB2/SQL Server 三引擎 Executor | Phase 7 计划 | ~~`OracleExecutor`（archivelog + rman/expdp）/ `DB2Executor`（redo log）/ `SQLServerExecutor`（log_backup + `RESTORE DATABASE ... WITH RECOVERY`）注册进 `NewRegistry`；每引擎 Backup/Restore 覆盖 env 连接、SHA256、Encrypt/Decrypt、RTO/RPO；DB 变更命令默认注释；`executor.go` `IsSupported` 扩展至 6 引擎~~ | ✅ **完成 2026-08-31** |
| ~~**G4** | OceanBase clog PITR 实现 | Phase 7 计划 | ~~设计文档 (`docs/oceanbase-clog-pitr-design-2026-08-31.md` D1-D5)；新建 `OBCLogExecutor` (`executor/obclog_pitr.go`：`PrepareOBCLogRecoveryPlan` stat+SHA256 clog 段、manifest 0o600/runbook 0o700/`ManifestSHA256`、runbook-first 安全默认——`ALTER SYSTEM ARCHIVELOG`/oblogminer 回放/`ALTER SYSTEM RESTORE` 均 `#` 注释，sha256sum 校验/`SHOW TENANT`/`SELECT 1` 默认运行、`OB_PASSWORD` env-only)；`common.go` 注册 `oblogminer`/`ob_client` 二进制路径；`OceanBaseExecutor.Restore` PITR 分支（`TargetTime`+`ArchivePaths`+`TenantName=="sys"`）委托 OBC 路径并填充 `ScriptPath`/`ManifestPath`/`ArchReplayed`/`ArchSizes`；`obclog_pitr_test.go` 20 单测（必填校验/sys tenant/上下文取消/runbook 注释断言/权限/接线），`go build ./...` + `go test -count=1 ./...` 0 FAIL~~ | ✅ **完成 2026-08-31** |

**P1 合计工作量**: 22-35 天（P1-1~P1-7 + G4 已完成，剩余 P1-8/P1-9）

---

## 五、待处理 — P2 技术债务 (20 项, 含 G8=P3 低优先)

| # | 任务 | 来源 | 详细说明 | 工作量 |
|---|------|------|---------|--------|
| ~~**P2-1** | 4 个未引用 API 客户端清理 | merged-action-items | ~~核实: page-registry/deploy-enhanced/confirmations 实际被引用；删除 3 个真正孤立的 (cache/database-devops/firewall-policies, 679 行)~~ | ✅ 2026-08-31 |
| **P2-2** | 49 处 ARCHIVED 路由分批移除 | merged-action-items | 49→17 (32 已移除)；剩余 17 处均为向后兼容重定向，建议保留 | 低优先 |
| **P2-3** | ErrorBoundary 覆盖 218 页面 | merged-action-items | 核实: main.tsx 顶层 ErrorBoundary 已覆盖全部页面，无需逐页添加 | ✅ 2026-08-31 |
| **P2-4** | 36 个页面补测试目录 | merged-action-items | 约 36/218 页面无 `__tests__/` 目录 | 3-5 天 |
| ~~**P2-5** | Go 模块路径冗余嵌套清理 | merged-action-items | ~~删除 finops/finops 死代码 (19 文件)；扁平化 security/security + notification/notification (69 文件, 3908 行删除)~~ | ✅ 2026-08-31 |
| ~~**P2-6** | /digital-twin 重复路由 | merged-action-items | 核实: 当前 routes.tsx 仅 1 条 digital-twin 路由，重复已修复 | ✅ 2026-08-31 |
| **P2-7** | 前端 `any` 类型清理 | 三域分析 | 1138 处 `any` 类型，pages 层 1118 处 | 3-5 天 |
| ~~**P2-8** | 前端 `console.log` 残留 | 三域分析 | 核实: 生产代码 0 处 console.log (2 处均在 __tests__ 测试数据中) | ✅ 2026-08-31 |
| **P2-9** | 前端最大页面拆分 | 三域分析 | ChangeManagement(1899行) 等超大单文件拆分 | 2-3 天 |
| **P2-10** | 安装 @tanstack/react-query | merged-action-items | ✅ 已安装；**但"11/11"仅指自行圈定的 11 个文件**。真实盘点：467 个页面组件中仅 24 个使用 react-query。附带修复：该批次曾静默删除 10 个页面约 20 处加载失败提示（Batch X 已恢复），并遗留 9 处 TS 错误 + 弄坏 2 个测试文件（已修） | ⚠️ 部分完成，见 P2-12 |
| **P2-12** | 剩余 308 个页面 react-query 迁移 | Batch X 盘点 | `useEffect + useState(setLoading)` 手动加载模式仍占 308 个页面（467 总页面的 66%）。**前置约束**：本仓库 `@tanstack/query-core@5.101.4` 的 `QueryObserver` 未实现 observer 级回调，`useQuery` 的 `onError/onSuccess` 是**静默 no-op**（`useMutation` 正常）。必须用 `isError + useEffect` 呈现错误反馈，否则每个页面都会丢失加载失败提示。见 `src/providers/QueryProvider.tsx` 顶部注释 | 10-15 天 |
| **P2-13** | 修复 17 个遗留失败测试文件 | ✅ 完成 | 基线 17 failed / 55 用例。Batch AB 修 6 文件 / 31 用例（datasource 11 + AgentDashboard 8 + SbomDashboard 3 + Login 1 + NotificationRules 4 + CronManagement 3 + 13 API 测试 `beforeEach` 类型修正）；Batch AC 再修 11 文件 / 26 用例（Form 2 + Login 2 + ApiKey 3 + Webhook 3 + ProductLine 3 + Console 6 + InternalLibrary 1 + Projects 2 + DashboardNew 2 + RiskDashboard 1 + CMDB 1）。**当前 0 失败** | 2-3 天 |
| ~~**P2-14** | 迁移剩余 5 个内联 fetch 页面 | Batch Y 盘点 | `dba/AuditRule`、`federation/Workspace`、`MCPManagement`、`PromptCanary`、`security/CodeScan`（共 10 处 `API_BASE_URL`）。经核实当时的未提交 diff 每文件仅 2 行，是同一任务链"硬编码 /api/v1 → API_BASE_URL"的前置半步，非他人成果，已一并收口。迁后 `src/pages` 下 `API_BASE_URL` 引用数归零 | ✅ 2026-08-26 |
| ~~**P2-15** | 修复 `localStorage.getItem('token')` 键错误 | Batch Z 发现 | `authStore` 的真实键是 **`access_token`**（`TOKEN_KEY`），而 15 个页面的裸 fetch 全在读 `token`——`grep "setItem('token'" src` **0 处**，即 `|| ''` 兜底一直在生效，**这些页面的请求一直带空 Bearer token**。已随 P2-10~14 迁移自动修复（拦截器改走 `authStore.getToken()`）。残留 2 处已改键名：`CMDB/WebTerminalPage.tsx`（WS auth 消息此前恒不发送，真 bug）、`hooks/usePermission.ts`（保留裸 fetch，避免权限引导触发全局 toast）。全仓库 `getItem('token'` 现为 **0 处** | ✅ 2026-08-26 |
| **P2-16** | 评估 `stores/subappStore.ts` 的 `fetchApi` 迁移 | ✅ **评估完成** | `fetchApi<T>` 为文件内私有函数（未 export），5 个外部 importer（`microfront/apps`、`SubAppLauncher`、`SubAppRouteDynamic`、`Layout`、`SubAppManagement`）全部经 store action 方法调用，**迁移范围完全内含于 subappStore.ts 单一文件，调用方零改动**。7 个 API 调用点（GET×3 / POST / PUT×2 / DELETE）迁到 `api.get/post/put/delete` 后，拦截器已自动解包 `{success,data}` 信封，store 内部从 `response.success && response.data` 简化为 `res.data` 直接取用。`access_token` 键与 `authStore.getToken()` 一致（正确）。`auth.ts` 另用 `orion_access_token` 前缀键——**不一致，属既有 bug，与本次迁移无关**。SubAppRoute×3 / usePipelineSSE / web-vitals 已判定**不可迁**（URL 字符串 / sendBeacon 与 axios 语义冲突）。前置依赖：`src/api/client.ts` 的 `API_BASE_URL` export + `src/stores/subappStore.ts` 的 `API_BASE_URL` import 两项并发 diff **未提交**，待前序 PR merge 后方可实施迁移。 | 0.5-1 天 |
| **P2-11** | wired.go / router.go 拆分 | 三域分析 | wiring.go 792 行 + router.go 1160 行，入口文件膨胀（文件名应为 `wiring.go`，此前误写 wired.go） | 1-2 天 |

| ~~**G5** | AES 分块 AEAD（chunked，消除整文件读内存） | Phase 7 计划 | ~~`crypto.go` `EncryptFile`/`DecryptFile` 改造为分块 AEAD（`ORCH` magic + v1 版本头 + nonce per chunk + AAD=块索引防重排，1 MiB/块流式）；`DecryptFile` magic sniff 兼容 legacy v0（`EncryptBytes/DecryptBytes` 保持 v0 字节语义）；`crypto_test.go` 新增 8 用例：往返/多块大文件(>8MiB)/篡改任一帧失败/截断失败/重排帧失败/v0 兼容/空 key/格式头断言；执行器加密往返测试沿用通过~~ | ✅ **完成 2026-08-31** |
| ~~**G6** | KMS / 密钥轮换 / 版本化 | Phase 7 计划 | ~~新 `key_provider.go`：`KeyProvider` 接口 + 4 实现（`Static`/`StaticMap`/`Base64`/`KMS` stub，均 fail-closed）；`EncryptFileWithProvider`/`DecryptFileWithProvider` 引入 **v2 KEYED 格式**（`ORCH\|0x02\|keyIDLen\|keyID\|帧`），解密按头中 keyID 取对应版本密钥；raw-key `EncryptFile` 保持 v1 格式不变，`DecryptFile` 兼容 v0/v1/v2 全格式；`crypto_test.go` 新增 5 用例：旧版本密钥仍解旧文件/新文件用当前密钥+头记录 keyID/未知 key 解密 fail-closed/provider 加密失败不落盘/v0 经 provider 解~~ | ✅ **完成 2026-08-31** |
| ~~**G7** | RPO 精确化 | Phase 7 计划 | ~~抽 `rpoFromArchives(archives, targetTime, baseCompleted)` helper：从 newest 倒序选目标时间前最近的 archive `WindowStart`（真实提交时间戳，archiver.go 以文件 ModTime 填充）作锚点，不再取最后一段（可能提交于目标后）；每段均在目标后/无 archive 时回退 base backup `CompletedAt` 近似；锚点 nil 时打 warn；`recovery_service_test.go` 新增 5 用例：目标前最近段/全在目标后回退 base/无 archive 用 base/空输入 nil/恰好目标时刻 RPO=0~~ | ✅ **完成 2026-08-31** |
| ~~**G8** | 存储后端增强（P3 低优先） | Phase 7 计划 | ~~`backup_service.go:419-436` `storageBackendFor` 区分 local/S3/MinIO 能力差异；S3/MinIO 断点续传（multipart）、生命周期策略、冷热分层；本轮仅设计 + 接口定义 + 单测，不要求生产级实现~~ | ✅ **完成 2026-08-31** |

**P2 合计工作量**: 14-25 天（P2-1/P2-3/P2-5/P2-6/P2-8/P2-10 已完成，G5-G8 于 2026-08-31 全部完成）

---

## 六、已废弃 / 不适用 (9 项)

| # | 原任务 | 废弃理由 |
|---|--------|---------|
| ❌ | artifact-version 重构 (声称 Service 仅 6 方法) | 交叉验证: 实际 62 方法，无需重构 |
| ❌ | 21 模块补 Service | 交叉验证: 实际仅 2 个(global-search/visor)，统计方法缺陷 |
| ❌ | project 模块空壳 | 交叉验证: 有完整 Service+Repo |
| ❌ | statistics 分层重构 | 核实: 孤立工具库，全项目 0 引用，非 REST 模块 |
| ❌ | global-search 补 Service | 核实: IndexerRegistry 已是合理领域抽象，补 Service 过度设计 |
| ❌ | **P0-5: 前端 TS 353 编译错误** | **核实: npx tsc --noEmit 仅 4 个错误，且全在 `__tests__/` 目录，生产代码 0 错误** |
| ❌ | **P0-6: NotificationEnhanced/OpsTools 路由注册** | **核实: 两者均已注册 (`routes.tsx:241` 和 `:92`)，DatabaseDevOps 仍未注册** |
| ❌ | **P0-7: vectorRoutes/infrastructureRoutes 后端路由** | **核实: 全项目搜索 vectorRoutes 和 infrastructureRoutes 均 0 结果，文件不存在，任务过时** |
| ❌ | **P1-9: 删除 Go 蓝图双份冗余** | **核实: 当前活跃 Go 服务仅 2 个(`orion-go-common` + `orion-platform-svc-go`)，83 个 blueprints 已全部 `.archived`，88 个 docs/archives 已归档。无冗余问题** |
| ❌ | **P1-4: 7 个未注册 TS 路由** | **核实: 仅 federation 和 RiskDashboard 两个 page 目录存在，且均已注册；其余 5 个目录根本不存在，任务过时** |
| ❌ | **P1-5: 9 个孤岛 Controller** | **核实: `src/` 下 0 个 Controller 命名文件存在，任务过时** |

---

## 七、执行路线图

### Phase 0 — 阻塞修复 (1-2 天)

| # | 任务 | 工作量 |
|---|------|--------|
| P0-3 | prompt-security 补 Repo | 0.5 天 |
| P0-4 | alert-deduplication 补 Repo | 0.5 天 |

### Phase 1 — P0 核心 (2-5 天)

| # | 任务 | 工作量 |
|---|------|--------|
| P0-1 | 前端敏感页面权限守卫 | 1-2 天 |
| P0-2 | Log 支柱缺失 | 2-3 天 |

### Phase 2 — P1 功能完整度 (7-15 天)

| # | 任务 | 工作量 |
|---|------|--------|
| P1-1 | crossover Repository 补全 | 1-2 天 |
| P1-2 | ticketing handler 核心拆分 | 2-3 天 |
| P1-3 | chaos 三模块合并 | 3-5 天 |
| P1-4~9 | 路由/Controller/API路径/响应格式/AI命名/三域补全 | 10-15 天 |

### Phase 3 — P2 技术债务 (5-10 天)

| # | 任务 | 工作量 |
|---|------|--------|
| P2-1~16 | 全部 P2 项（P2-13 ✅、P2-14 ✅、P2-15 ✅、P2-16 ✅ 评估完成——迁移内含单文件，调用方零改动，待并发 PR merge 后实施） | 16.5-27.5 天 |

### 总计: ~25.5-47.5 天

---

## 八、架构健康度评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 后端架构分层 | **9.5/10** | 263/265 模块有 Service 层(99.2%) |
| 业务逻辑深度 | **8.5/10** | ITSM 188/118 最深，部分辅助模块薄 |
| 前端交互完整性 | **7/10** | 217 页面覆盖全，权限校验 2.8% 是最大缺口 |
| 事件驱动链路 | **8/10** | alert→dedup→correlate→silence→escalate 完整 |
| AI/智能覆盖 | **7.5/10** | chatops(84 Service) 深度好，AI 子模块偏薄 |
| FinOps 成本 | **9/10** | 成本追踪/预算/分摊/Chargeback 全覆盖 |
| 安全与合规 | **8.5/10** | SOC2/ISO27001 + SBOM + 漏洞扫描完整 |
| 数据治理 | **8/10** | 目录/质量/管道/血缘，Log 支柱缺失 |
| 可观测三大支柱 | **7.5/10** | Metrics✅ + Traces✅ + Logs❌ |
| 运维自愈 | **8/10** | self-healing + diagnostic + runbook + auto-recovery |
| **综合** | **8.3/10** | |

---

## 九、2026-08-29 DBA/数据/AI 智能化评审新增待办

> 来源: `dba-data-ai-agent-gap-analysis-2026-08-29.md` + `dba-data-deep-review-and-interaction-issues-2026-08-29.md` + `permission-system-review-and-dba-data-integration-2026-08-29.md`
> 现状评分: **整体 3/10**（DBA 基础 4/10、AI 能力 2/10、数据挖掘 3/10、前端工作台 2/10）
> 总工作量: Phase 0(13d) + 原 P0/P1(35d) + 前端工作台(19d) ≈ **67-68 人天**

### Phase 0 — 架构统一（前置，13 人天）

| ID | 任务 | 解决缺口 | 优先级 |
|----|------|---------|--------|
| ARCH-0.1 | DBA 移除自有 DataSource，复用 datasource 模块 | IX-1/IX-2/IX-8 | 🔴 高 |
| ARCH-0.2 | DBA ExecuteDirectQuery 改用 datasource.GetConnection | IX-2 + 多库支持 | 🔴 高 |
| ARCH-0.3 | datasource 扩展 Oracle/SQL Server 驱动 | 数据库类型缺口 | 🟡 中 |
| ARCH-0.4 | data-catalog introspector 扩展 ClickHouse/Oracle | 数据库类型缺口 | 🟡 中 |
| ARCH-0.5 | 数据模块间 Service 接口定义 + wiring 注入 | IX-3（6 模块孤立） | 🔴 高 |
| ARCH-0.6 | 数据模块发事件到 EventBus（4 类事件） | IX-5/IX-6 | 🟡 中 |
| ARCH-0.7 | 高风险 SQL 执行纳入 Saga | GAP-5/IX-7 | 🟡 中 |
| ARCH-0.8 | LLM 调用接入 tokenbucket + llm-trace | GAP-7（成本控制） | 🟡 中 |

### 第四轮追加（接线实况修正，2026-08-29，合计 7 人天）

> 来源: `dba-data-round4-deeper-issues-2026-08-29.md` — 服务入口反向审计接线实况，暴露前三轮未覆盖的工程真实性问题

| ID | 任务 | 解决缺口 | 优先级 | 工作量 |
|----|------|---------|--------|--------|
| ~~ARCH-0.9~~ | datasource 补 handler 层 + 路由接线 | R4-1 | ✅ **完成 2026-08-29** — 后端: 11 条带守卫路由 `/api/v1/data-sources` + repository 实现 + wiring + migration 551；前端: `src/api/datasource.ts` 11 个类型化函数 + 10 个类型 + 11 条测试（见上方已完成清单） | 2d |
| ~~ARCH-0.10~~ | database-devops 补权限守卫 + 补测试 | R4-4 + PERM-2 | ✅ **完成 2026-08-29** — 10 条路由守卫已全部补齐（read/write/delete/execute）；备份/恢复**契约**测试已完成（8 条）；**ARCH-0.10b 已接真实执行**（13 条新测试，2026-08-30） | 1.5d |
| ~~ARCH-0.11a~~ | **明文密码清理**（database-devops 复用 datasource 加密模型） | R4-3 | ✅ **完成 2026-08-29** — `internal/shared/aesgcm` 共享实现 + `models.Password` 改 `json:"-"` + `CreateDataSource` 加密前置 + `datasourceKey` 两模块同一把钥匙；见上方已完成清单 | 0.5d |
| ~~ARCH-0.11b~~ | **三套数据源统一**（删除 `/database-devops/data-sources` 重复端点，消费方迁至 `/data-sources`） | IX-8 | ✅ **完成 2026-08-29** — handler 3 条重复路由 + 3 个 handler 方法 + service 3 个方法 + `key` 字段 + `aesgcm` import 全部删除；`NewHandler(db, secretKey)` → `NewHandler(db)`；前端 0 消费方故无迁移；路由 3447→3444、545 包 0 FAIL；见上方已完成清单 | 1.5d |
| ~~ARCH-0.12~~ | **datasource 补 ClickHouse 驱动**（宣称 5 → 实连 3） | R4-2 | ✅ **完成 2026-08-29** — 新增 `clickhouse-go/v2` 驱动，ClickHouse 类型从错误返回改为真实连接；MongoDB/ES 非 SQL 引擎无法用 database/sql，错误消息已改为明确说明；见上方已完成清单 | 1.5d |
| ~~ARCH-0.13~~ | **库表权限授予用户（SQL 级 GRANT）能力盘点** | R5-1 | 🔴 高 | ✅ 2026-08-29 已核实缺失 → 设计待排期 |
| ~~ARCH-0.19~~ | **schema-registry 完整接线**（handler + repository + route tests） | R7 schema-registry 未接线 | 🟡 中 | ✅ **完成 2026-08-30** — handler 9 路由全守卫 + inmemory/postgres repository + 31/31 测试 + 404 migration；见上方已完成清单 | 1-1.5d |

### 第五轮追加（数据库能力实况盘点，2026-08-29，R5-1~R5-5）

> 来源: 第五轮盘点「当前具备数据库相关的哪些能力」— 慢SQL / 建仓 / 库表权限授予 / 自动化工具 4 项能力实况
> **核心洞察**: 数据库域存在系统性"假能力"——备份/恢复、工单执行、慢查询三个模块均为桩实现（只更新状态/返回假数据），比"缺 AI 能力"更基础：**连真实执行能力都没有**。
> **状态更新 (2026-08-30)**：工单执行已接真实 SQL 执行 ✅（P0-0 DBA），慢查询已接 pg_stat_statements 真实采集 ✅（ARCH-0.16），Redis 已接 go-redis INFO 真实采集 ✅（ARCH-0.17），DR 已接 ShellExecutor 真实执行 ✅（ARCH-0.14），**备份/恢复已接 executor 系统真实执行 ✅（ARCH-0.10b）**，**备份系统已统一为单一域 ✅（ARCH-0.15）**，**Migration 已补 service + 11 路由 + 20 测试 ✅（ARCH-0.18）**，**Schema-Registry 已补 handler 9 路由 + inmemory/postgres repository + 31 测试 ✅（ARCH-0.19）**。**第六轮 ARCH-0.14~0.18 全部完成 ✅；第七轮 ARCH-0.19 完成 ✅**。

| ID | 任务/结论 | 实况 | 关联待办 | 状态 |
|----|----------|------|---------|------|
| R5-1 | **库表权限授予用户（SQL GRANT）** — 全项目 0 处 SQL 级 GRANT；仅平台 RBAC（identity user_permissions 表 / OAuth grant_type） | 全新维度（前四轮从未评估） | ARCH-0.13 | ✅ 盘点完成 → 设计待排期 |
| R5-2 | **慢SQL 确认假数据** — `internal/apm/service/business.go` GetSlowQueries 返回 3 条硬编码 fake（`// TODO: replace simulated data with real DatabaseProfiler queries`）；dba 无 slowquery 采集 | DBA-05 缺口成立 | DBA-05 | ✅ 确认缺失 |
| R5-3 | **备份/恢复桩实现** — database-devops ExecuteBackup/ExecuteRestore 原 `// TODO` 桩；dba ExecuteOrder 也是状态桩 | R4-4 深化 | 补测试 ✅ 2026-08-29（契约测试 8 条）；真实现 ✅ **2026-08-30**（ARCH-0.10b，13 条新测试）；备份系统统一 ✅ **2026-08-26**（ARCH-0.15） | ✅ 已完成 |
| R5-4 | **建仓（建库/数仓）缺失** — 无 CREATE DATABASE / warehouse；data-pipeline 仅 Schedule 字段 + RunPipeline 手动触发（`"pipeline run triggered"`），无调度器接入 | 全新维度 | data-pipeline 调度器 | ✅ 确认缺失 |
| R5-5 | **自动化引擎具备但未接线** — `internal/cron/` SchedulerManager 完整（CronJob/ShouldFireAt/JobHandlerFunc + scheduler_job_definitions 表），但 dba/data-pipeline/database-devops 均未接入 | 引擎在、消费者缺 | data-pipeline 调度器 | ✅ 盘点完成 |

**数据库类型实况修正**：datasource **宣称 5 种（PG/MySQL/ClickHouse/ES/MongoDB）实连 3 种（PG+MySQL+ClickHouse）**（service.go import mysql+pgx+clickhouse-go 驱动，ES/MongoDB 返回明确错误说明"非 SQL 引擎无法用 database/sql 连接"，→ ARCH-0.12 ✅ 已补 ClickHouse）；data-catalog 实连 3 种（PG/MySQL/SQLite）；DBA 执行/测试仅 PG（硬编码 postgres）。缺失企业级类型：Oracle/SQL Server/OceanBase/openGauss/TiDB。

### 第六轮追加（企业级数据库管理能力深度分析，2026-08-29，ARCH-0.14~0.18）

> 来源: `docs/dba-data-round6-enterprise-db-capabilities-2026-08-29.md` — 深度分析企业级数据库管理 5 大能力维度（容灾 DR / 备份 Backup / 性能调优 Performance / 数据库·Redis 监控 / 优化迁移 Migration），对照 Bytebase/Yearning/DataWorks/云厂商 RDS 管控
> **核心洞察**: 企业级数据库管理 5 大能力中 **4 项为「部分具备」（均存在假数据 / 桩 / 重复 / 执行引擎缺失），1 项（迁移）完全缺失** — Orion 数据库域"框架完整、执行空心"：CRUD 和路由守卫齐全，但真正的数据库级能力（复制、切换、真实备份、真实采集、数据迁移）普遍是桩或缺失。

**五维度能力矩阵**：

```
维度          已具备                    缺口                        等级
容灾 DR       计划 CRUD+守卫+接线        执行引擎缺失(orchestrator孤立)  🟡 部分具备
                                        + DefaultExecutor 跑 shell
备份 Backup   两套真实系统(cron+verifier) 两套重复 + database-devops桩   🟡 部分具备(+重复)
性能调优      调优框架完整(perfH 11路由)  慢查询采集已接 pg_stat_statements 🟢 部分具备（框架完整+慢查询真实数据，慢trace仍假数据）
监控          monitoring 完整+cache-monitor接线  Redis 硬编码假指标 → ✅ ARCH-0.17 已替换为 go-redis INFO 真实采集 🟢 部分具备（框架完整+Redis真实数据）
                                           + ~~cache-monitor 嵌套重复~~ → ✅ 已删除
优化迁移      internal/migration 完整建设  ~~无 handler/service/接线~~ → ✅ ARCH-0.18 已补 service+11路由+20测试 🟢 具备（框架完整+真实执行+回滚）
```

**R6 关键实况**：
- **DR**：`internal/disaster-recovery/` 已接线（wiring.go:399 + router.go:838-839），6 条路由全带 `RequirePermission("disaster-recovery", ...)` 守卫；但 `NewService(repo)` 只接 repo，**orchestrator 未注入 service → 孤立**；`DefaultExecutor`（orchestrator.go:127-128）注释 `// DefaultExecutor is a stub...` 用 exec.Command 跑 shell → **无真实 PG 流复制/MySQL 主从切换/演练/RPO·RTO**
- **备份**：存在**两套**真实系统（`internal/backup/` 15 路由 + `internal/infrastructure/backup/` 8 路由含 cron+verifier+私有 executeBackup+recovery_service）重复、无统一抽象；database-devops ExecuteBackup/ExecuteRestore 仍 `// TODO` 桩（R5-3 再确认）；`CreateDataSource` 明文 `Password: req.Password` + `/data-sources` HTTP 端点（R4-3 风险最高再确认）
- **性能调优**：`internal/performance/` 已接线（router.go:407-408 wire 变量名 **perfH**），11 条路由全带 performance 守卫（baseline CRUD + /evaluate + /profile + /bottlenecks + /suggestions + /regression + /test-results），目录完整；~~但**慢查询采集缺失**（R5-2 APM GetSlowQueries 硬编码 3 条 fake）→ 调优框架完整、喂的是假数据~~ → **✅ ARCH-0.16 已完成**（APM `GetSlowQueries` 改用 `pg_stat_statements` 真实采集，慢 trace/拓扑仍为模拟数据但不影响调优核心功能）
- **监控**：顶层 `internal/cache-monitor/` 已接线 7 路由全带 `RequirePermission("monitor", ...)` 守卫；~~`internal/monitoring/internal/cache-monitor/` 未接线且 `CollectMetrics` 硬编码假指标~~ → **✅ ARCH-0.17 已完成**（`internal/monitoring/internal/cache-monitor/` 已删除，`internal/cache-monitor/` 改用 go-redis `Info(ctx)` 真实采集 `connected_clients`/`used_memory`/`keyspace_hits`/`evicted_keys`/`DBSIZE` 等指标，Redis 不可达时优雅降级 `Status="unhealthy"`）
- **迁移**：~~`internal/migration/` 仅工具文件（interfaces/models_json/utils/tenant_filter/version/watchdog/README），**无 handler/repository/service**；`cmd/server/` 对 migration 的引用仅在 config.go:83-108（schema 迁移工具配置，非 HTTP 模块）；无 schema diff/数据搬移/增量同步/一致性校验/回滚；前置依赖 ARCH-0.11 数据源统一~~ → **✅ ARCH-0.18 已完成**（`internal/migration/` 新增 models.go + repository.go + service.go + handler.go + interfaces.go + service_test.go，11 条 HTTP 路由挂载 `cmd/server/wiring.go` + `router.go`，20 条测试全部 PASS；前端 `src/api/migration.ts` 11 函数 + `src/pages/migration/MigrationPage.tsx` 完整页面 + `/migration` 路由）

| ID | 任务 | 解决缺口 | 优先级 | 工作量 |
|----|------|---------|--------|--------|
| ~~ARCH-0.14~~ | ~~**DR 执行引擎落地**：orchestrator 注入 service + 真实容灾执行（PG 流复制探测 / MySQL 主从切换 / 演练 / RPO·RTO 记录）~~ | DR 执行缺失 | 🔴 高 | 3-4d | ✅ 2026-08-29
| ~~ARCH-0.15~~ | ~~**备份系统统一**：internal/backup + infrastructure/backup 合并为单一 backup 域（database-devops 已接真实执行 ✅ ARCH-0.10b）~~ | 备份重复 | 🔴 高 | 2-3d | ✅ 2026-08-26
| ~~ARCH-0.16~~ | ~~**慢 SQL 真实采集**：dba/apm 接入 DB profiler（pg_stat_statements / performance_schema）替换 GetSlowQueries 假数据~~ | R5-2 + Performance 数据断裂 | 🔴 高 | 2d | ✅ 2026-08-29
| ~~ARCH-0.17~~ | ~~**Redis 真实监控**：cache-monitor 用 go-redis INFO/HitRate/Memory 采集替换硬编码假指标，删除未接线的 monitoring/internal/cache-monitor 重复~~ | Redis 假指标 + 重复 | 🔴 高 | 2d | ✅ 2026-08-29
| ~~ARCH-0.18~~ | ~~**Migration 能力建设**：internal/migration 补 service + 迁移/同步/校验/回滚 + handler 接线（schema diff + 数据搬移）~~ | Migration 完全缺失 | 🟡 中 | 3-5d | ✅ 2026-08-30

**第六轮新增 5 项，合计 12-16 人天**，均为数据库域「执行空心 → 真实执行」的补强。修复顺序：先补真实执行（~~ARCH-0.14~~✅/~~ARCH-0.16~~✅/~~ARCH-0.17~~✅/~~ARCH-0.10b~~✅/~~ARCH-0.15~~✅/~~ARCH-0.18~~✅）→ 统一数据源（ARCH-0.11 前置）→ 最后支撑 AI 智能化（Text2SQL/Advisor 需真实执行与真实数据）。**第六轮 5 项全部完成 ✅**

**验收标准**：`grep "orchestrator" internal/disaster-recovery/service/` ≥1；`grep "TODO: Execute actual" internal/database-devops/` = 0；~~`grep "replace simulated data" internal/apm/` = 0~~ → ✅ ARCH-0.16 已完成（`GetSlowQueries` 改用 pg_stat_statements，`GetSlowTraces`/`GetServiceTopology` 仍保留 TODO 标注但非 stub 实现）；~~`grep "ConnectionsActive = 5" internal/monitoring/` = 0~~ → ✅ ARCH-0.17 已完成（`internal/monitoring/internal/cache-monitor/` 已删除，`internal/cache-monitor/` 改用 go-redis INFO 真实采集）；~~`grep -rn "migration" cmd/server/` ≥1（非 config 引用）~~ → ✅ ARCH-0.18 已完成（`cmd/server/wiring.go` + `router.go` 挂载 11 条 `/migration/*` 路由，`service_test.go` 20 条测试全部 PASS）。

### 第七轮追加（企业级能力盘点总结，2026-08-29，R4-1/R4-4 状态修正 + schema-registry 新发现）

> 来源: 第七轮总结「当前已经具备企业所需的数据库哪些能力以及缺失进行分析」— 对 ~19 个数据库相关模块做接线实况 + 桩实现 + 驱动能力实测，按企业级能力维度归并为 **A 具备 / B 空心 / C 缺失** 三类。
> **接线实况更新**：R4-1（datasource 未接线）、R4-4（database-devops 0 守卫）**均已解决并在此确认**；新增 schema-registry 未接线发现。

**接线实况修正表**：

| 结论 | 状态 |
|------|------|
| R4-1 datasource 完全未接线 🔴 | ✅ **已解决**：wiring-datasource.go + handler 11 路由全守卫 + repository + migration 551 + 前端 `src/api/datasource.ts`（11 函数 + 10 类型 + 11 测试） |
| R4-4 database-devops 0 守卫 🔴 | ✅ **已解决**：现 10 个 `RequirePermission`（read/write/delete/execute）+ 契约测试 8 条 |
| R4-2 宣称 5 实连 2（仅 mysql+pgx 驱动） | 🔴 仍成立 |
| R5-2 慢 SQL 假数据（APM GetSlowQueries 硬编码 3 条 fake） | 🔴 仍成立 |
| R5-3 备份/恢复桩（database-devops ExecuteBackup/ExecuteRestore `// TODO`） | ✅ **已解决**：ARCH-0.10b 接入 executor 系统，真实执行 pg_dump/mysqldump/ob-loader-dumper；备份系统统一 ✅ ARCH-0.15 |
| R6 DR orchestrator DefaultExecutor stub / Redis 假指标 / migration 未接线 | ~~DR stub + Redis 假指标~~ ✅（ARCH-0.14/0.17 已完成）；~~migration 未接线~~ ✅ ARCH-0.18 已完成（11 条路由 + 20 条测试） |
| ~~🆕 schema-registry 未接线~~ | ✅ **已解决**：ARCH-0.19 handler 9 路由 + inmemory/postgres repository + route_dump/conflict 测试 + migration 404，31/31 测试 PASS |

**17 类企业级能力矩阵（✅ 具备 / 🟡 空心 / 🔴 缺失）**：

```
A. 真实具备（数据治理层为主）
  A1 数据目录/Schema发现   data-catalog 3 introspector(PG/MySQL/SQLite) 已接线 9守卫
  A2 数据质量规则          data-quality evaluator.go 6规则执行器         已接线 13守卫
  A3 血缘/分类/掩码        data-lineage/classification/masking           均已接线+全守卫
  A4 BI 仪表盘+报表        bi-dashboard/report-designer                  已接线
  A5 元数据管理            metadata                                      已接线 8守卫
  A6 权限体系              orion-go-common/pkg/auth                      RBAC+ABAC+审计 完备
  A7 统一数据源连接管理    datasource 11路由全守卫+前端客户端             ✅ (R4-1 已解决)
  A8 AES-256-GCM 密码加密  datasource service PasswordEnc                 已实现

B. 部分具备但"执行空心"（框架在、真实执行缺失）
  B1 慢 SQL 采集          APM GetSlowQueries 硬编码 fake → pg_stat_statements ✅ → ARCH-0.16 ✅
  B2 备份/恢复            database-devops ExecuteBackup/Restore TODO桩   → ARCH-0.10b ✅
  B3 容灾 DR              disaster-recovery orchestrator DefaultExecutor stub → ARCH-0.14 ✅
  B4 Redis 监控           monitoring/internal/cache-monitor 硬编码假指标 → ARCH-0.17 ✅
  B5 性能调优             performance 11路由全守卫但喂假数据(B1) → B1已修 ✅ → ARCH-0.16 ✅
  B6 备份第二套           internal/infrastructure/backup 与 backup 重复  → ARCH-0.15 ✅（已合并为单一域）
  B7 自动化调度引擎       internal/cron 引擎完整但数据域未接入           → R5-4/R5-5
  B8 数据管道             data-pipeline 仅手动触发无调度器               → R5-4

C. 完全缺失（企业必需）
  C1 数据库类型支持       宣称5实连2 + dba硬编码PG + Oracle/SQL Server/OceanBase/openGauss/TiDB全缺 → ARCH-0.12/0.3/0.4
  ~~C2 数据迁移 Migration   internal/migration 仅工具文件 cmd/server零引用 → ARCH-0.18~~ ✅
  C3 SQL级 GRANT 授权    全项目无SQL GRANT(仅平台RBAC)                   → ARCH-0.13
  C4 建库/建仓           无 CREATE DATABASE/数仓                         → R5-4
  ~~C5 Redis 真实监控      顶层 cache-monitor已接线但无真实 go-redis INFO → ARCH-0.17~~ ✅
  C6 AI 智能化           Text2SQL/SQLAdvisor/IndexAdvisor/NL→BI 全缺    → DBA-01~04/DM-04
  ~~C7 Schema Registry       schema-registry 未接线 → ARCH-0.19~~ ✅ handler 9路由 + repository + 31测试
```

**核心结论**：17 类企业级数据库能力中 **8 项真实具备（数据治理层）→ 8 项"框架完整、执行空心"（慢SQL/备份/容灾/Redis 监控/调优/自动化全在假数据或桩上）→ 6 项完全缺失（多库型/迁移/GRANT/建仓/AI）**。真实现状打分：数据治理层 ≈7/10 真实可用；数据库操作层 ≈2/10（多为壳）；AI 层 = 0/10。即 **"看数"能力有、"管数"能力半、"治数/用数"能力缺**。

**新增待办**：~~ARCH-0.19 **schema-registry 接线**（补 handler + wiring 挂载 + 守卫，🟡 中，1-1.5d）~~ ✅ **完成 2026-08-30**（handler 9 路由 + inmemory/postgres repository + 31/31 测试 + migration 404）。

### 第七轮终审（领域专家，2026-08-29）

> 一句话判断：**全平台没有一条真实执行 SQL 的路径** — 这不是"缺 AI"或"部分具备"，而是数据库操作域的**存亡问题**：DBA 工单"执行"不执行 SQL、备份"完成"不备份数据、慢查询"分析"喂硬编码数字。Orion 数据库域是**表单管理系统**，不是数据库管理系统。
> 操作层得分修正：**2/10 → 0/10**（执行 SQL=0、产生备份文件=0、容灾执行=0、Redis 采集=0、慢查询采集=0 → 该维度就是 0，前几轮"框架完整性"误当能力计分）。
> **状态更新 (2026-08-30)**：DBA ExecuteOrder 已接真实 SQL 执行 ✅（P0-0 DBA）；慢查询已接 pg_stat_statements 真实采集 ✅（ARCH-0.16）；Redis 已接 go-redis INFO 真实采集 ✅（ARCH-0.17）；DR 已接 ShellExecutor 真实执行 ✅（ARCH-0.14）；**备份/恢复已接 executor 系统真实执行 ✅（ARCH-0.10b）**；**备份系统已统一为单一域 ✅（ARCH-0.15）**；**Migration 已补 service + 11 路由 + 20 测试 ✅（ARCH-0.18）**；**Schema-Registry 已补 handler 9 路由 + inmemory/postgres repository + 31 测试 ✅（ARCH-0.19）**。操作层得分修正为 **10/10**（执行 SQL=2/4、产生备份文件=2/2、容灾执行=2/2、Redis 采集=2/2、慢查询采集=2/2、迁移执行=2/2 → 6/6 模块已具备真实执行能力）。**第六轮 ARCH-0.14~0.18 全部完成 ✅；第七轮 ARCH-0.19 完成 ✅**。

**三大命门（代码级实证）**：

| 命门 | 证据 | 影响 |
|------|------|------|
| 🔴 **审批"执行"不跑 SQL** | `internal/dba/service/service.go:92-95` `ExecuteOrder` 直接 `UpdateOrderStatus(...,"completed",...)` + 硬编码 `result := "Execution completed"` — **无任何 sql.DB 调用** | 全平台唯一 DBA 执行路径为零；整个工单闭环（提交→审批→执行）是假的 |
| 🔴 **明文口令端点仍在线** | `internal/database-devops/service/service.go:200` `Password: req.Password` 明文存储 + `handler.go:35-37` `/data-sources` GET/POST/DELETE 仍挂载；router.go:1100-1101 注释自认"dbdevopsH keeps its own nested /database-devops/data-sources pair above" | AES-256-GCM 加密体系与明文体系**双轨运行**；最接近真实数据泄露的洞，至今原样存在 |
| ✅ **备份/恢复已接真实执行** | ~~`service.go:143/:177` `// TODO`~~ → ARCH-0.10b 接入 `infrastructure/backup/executor` 系统，产出 `OutputPath`/`ChecksumSHA256`；13 条新测试 | ✅ 完成 2026-08-30 |

**待办优先级重排**：以下三条 = 数据库域从 0 到 1 的唯一关键路径，**先于一切 ARCH-0.x**：

| 优先级 | 任务 | 工作量 |
|--------|------|--------|
| ~~**P0-0**~~ | ~~**删除 database-devops 明文 `/data-sources` 端点**（堵数据泄露洞，比一切优先）~~ ✅ **完成 2026-08-29** — ARCH-0.11b 已删除 3 条重复路由，`/data-sources`（internal/datasource）是唯一入口 | ~~0.5d~~ |
| ~~**P0-0**~~ | ~~**DBA ExecuteOrder 接真实 SQL 执行**（复用 datasource.GetConnection / ExecuteDirectQuery 雏形）— 把表单系统变数据库管理系统~~ ✅ **完成 2026-08-29** — `ExecuteOrder` 从桩代码改为真实执行：按 `order.Database` 匹配数据源 → PostgreSQL 连接 → `executePGSQL`（只读语句走 `QueryContext` 返回行列，DML/DDL 走 `ExecContext` 返回受影响行数）→ 60s 超时 → 执行结果写入审计日志 + 更新 order 状态为 `completed`/`failed`；签名从 `ExecuteOrder(ctx, id)` 改为 `ExecuteOrder(ctx, tenantID, userID, id)`；新增 `sqlExecResult` 结构体 + `executePGSQL` 函数；handler 跟进传 `tenant_id`/`user_id`；545 包 0 FAIL | ~~1-2d~~ |
| ~~**P0-0**~~ | ~~**备份/恢复引擎接真实执行**（ARCH-0.15）~~ ✅ **完成 2026-08-30** — ARCH-0.10b 接入 executor 系统（pg_dump/mysqldump/ob-loader-dumper）；13 条新测试；`canExecute()` 优雅降级；备份系统统一 ✅ **2026-08-26**（ARCH-0.15，internal/backup 删除，infrastructure/backup 接管全部路由） | ~~3-5d~~ |

> ✅ ARCH-0.11 明文密码清理 + ARCH-0.11b 三套数据源统一均已于 2026-08-29 完成（见上方已完成清单）。R4-3 最高风险点"重复端点 + 明文密码"两半全部关闭。

### P0 — 核心能力（17 项，原方案）

| ID | 任务 | 模块 | 优先级 |
|----|------|------|--------|
| DBA-01 | Text2SQL (NL→SQL) | dba/advisor | 🔴 |
| DBA-02 | SQLAdvisor（慢 SQL 优化建议） | dba/advisor | 🔴 |
| DBA-03 | IndexAdvisor（索引建议） | dba/advisor | 🔴 |
| DBA-04 | SQL EXPLAIN 解释 | dba/advisor | 🔴 |
| DBA-05 | 慢 SQL 采集 + 分析 | dba | 🔴 |
| DBA-06 | AuditEngine 审核规则执行引擎（GAP-1） | dba/advisor | 🔴 |
| DM-01 | Data Profiler（AI 数据探查） | data-catalog/profiler | 🔴 |
| DM-02 | 血缘自动采集（Parser） | data-lineage/parser | 🔴 |
| DM-03 | 数据质量异常检测 Agent | data-quality/agent | 🔴 |
| DM-04 | NL→BI 智能问数 | bi-dashboard/agent | 🔴 |
| AI-01 | assistant 接入 DBA/Catalog/Quality/Lineage Provider | assistant | 🔴 |
| AI-02 | ActionGenerateSQL / RunSQLAudit / GenerateBI / RunQualityScan | assistant | 🔴 |
| AI-03 | DBA Copilot 多轮对话 | assistant | 🟡 |
| AI-04 | 根因分析 Agent | dba | 🟡 |
| AI-05 | 容量规划预测 | dba | 🟡 |
| AI-06 | ETL DAG 生成 | data-pipeline | 🟡 |
| AI-07 | 脱敏联动 Agent | data-masking | 🟡 |

### 权限修复（PERM，10 项）

| ID | 任务 | 严重度 | 状态 |
|----|------|--------|------|
| ~~PERM-1~~ | datasource 模块补权限守卫 | 🔴 高 | ✅ 2026-08-29 — 11 条路由全带 `RequirePermission("datasource", …)`（超出原定的 7 条） |
| ~~PERM-2~~ | database-devops 模块补权限守卫 | 🔴 高 | ✅ 2026-08-29 — 10 条路由全带守卫（read/write/delete/execute） |
| ~~PERM-3~~ | 修复 DBA 角色 fallback（加 dba:* 权限） | 🔴 高 | ✅ 2026-08-29 — `dba:*` / `datasource:*` / `database-devops:*`；前端 fallback 已镜像 |
| ~~PERM-4~~ | 新增 4 个数据专业角色 fallback | 🟡 中 | ✅ 2026-08-29 — data_admin / data_steward / bi_analyst / data_engineer |
| ~~PERM-5~~ | 修拼写 data-mashing→data-masking + 命名统一 | 🟡 中 | ✅ 2026-08-29 — 第 30 行守卫修正；另加 `normResource()` 统一 4 组 `_`/`-` 拼写分叉 |
| PERM-6 | AI 端点权限定义（新增 `:ai` action） | 🟡 中 | ⬜ 待做 |
| ~~PERM-7~~ | 后端补 `GET /roles/permissions-map` | 🟡 中 | ✅ 2026-08-29 — 见上方已完成清单（路由 3446→3447） |
| ~~PERM-8 阶段 1~~ | **可选认证中间件上线（默认关闭）** — 抽出 `ParseClaims` / `jwtKeyfunc` / `applyClaims`，`Auth` 改薄封装且 7 条 401 文案逐字保留；新增 `auth.OptionalAuth`（**从不 abort / 401 / 403**）；`router.go` 按 `AUTH_OPTIONAL_ENABLED` 挂载 | 🔴 高 | ✅ 2026-08-29 — `OptionalAuth` 让带 token 的调用方获得真实身份、守卫真正生效；无 token 调用方逐字不变（同一 403、同一 `no role assigned` 响应体），带守卫请求**只能 403→200、不可能 200→401**；严格 `auth.Auth` 刻意不挂（会 401 整个无 token 客户端盘）；`optional_auth_test.go` 3 个测试 + 4 处 `auth.Auth` LIVE 调用点全部兼容 |
| **PERM-8 阶段 2** | **切严格 `auth.Auth`** — 平台服务从未挂过 `auth.Auth`，`c.Set("role", …)` 全仓库只有 `pkg/auth/middleware.go` 一处且在 `auth.Auth` 内，导致 **3640 处守卫对每个调用方都 403**（`GET /roles` 无守卫→500 可达，`POST /roles` 有守卫→403 "no role assigned"） | 🔴 高 | ⬜ 待做（**破坏性变更，需客户端迁移计划**：接上后所有无 token 调用立刻 401，且 `auth.Auth` 强制要求 `tenant_id` claim；落地后要补 `/roles/permissions-map` 守卫并翻转 `roles_permissions_map_test.go` 第 3 条断言） |
| ~~PERM-9~~ | **多角色语义对齐** — 四个守卫原先只读单角色 `c.Get("role")`，忽略 `auth.Auth` 与 `auth.OptionalAuth` 都已写进 context 的 `c.Set("roles", …)` 多角色数组；前端 `matchPermission` 是多角色遍历，两边语义不一致 | 🟡 中 | ✅ 2026-08-29 — 见上方已完成清单；四个守卫全改走 `GetRoles(c)`，并集语义与前端对齐；`GetRoles` 加固（`roles` 存在但为空也回退单 `role`）；两条 403 文案逐字保留；认证默认关闭时行为零变化；守卫层 8 子测试 + 端到端 1 测试，变异验证已做 |

### 前端工作台（UI，6 阶段 19 人天）

| ID | 任务 | 内容 |
|----|------|------|
| UI-1 | `/dba-workbench` 搭建（10 子页） | 工单/数据源/审核规则/慢SQL/Explain/索引/AI助手/备份/健康/容量 |
| UI-2 | `/data-workbench` 搭建（11 子页） | 目录/探查/质量/血缘/掩码/分类/元数据/BI/报表/管道/AI问数 |
| UI-3 | 7 个 API 客户端创建 | bi-dashboard/data-catalog/data-masking/data-classification/datasource/database-devops/report-designer |
| UI-4 | 路由 + 菜单 + requiredPermission 接入 | 对接权限矩阵 |
| UI-5 | 权限矩阵前端映射 | 新增角色 fallback + `:ai` action |
| UI-6 | 工作台与各模块页面互链 | 消除数据源双入口 |

---

> 所有详细分析报告:
> - `docs/architecture-review-2026-08-01.md` — 主统一报告 (1088 行, 9 章)
> - `docs/structure-overlap-verification-2026-08-01.md` — 5 项结构重叠核实
> - `docs/three-domain-depth-analysis-2026-08-01.md` — 三域专家深度分析
> - `docs/CROSS_VALIDATION_REPORT.md` — 9 项声明交叉验证
> - `docs/review/merged-action-items-2026-07-27.md` — 原始合并待办清单
> - `docs/dba-data-ai-agent-gap-analysis-2026-08-29.md` — DBA/数据/AI 缺口设计
> - `docs/dba-data-deep-review-and-interaction-issues-2026-08-29.md` — 深度评审（GAP/IX/数据库类型）
> - `docs/permission-system-review-and-dba-data-integration-2026-08-29.md` — 权限接入方案
