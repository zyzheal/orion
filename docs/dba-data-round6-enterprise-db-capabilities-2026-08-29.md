# 第六轮深度分析：企业级数据库管理能力（容灾 / 备份 / 性能调优 / 监控 / 优化迁移）

> 评审日期: 2026-08-29
> 评审问题: "深度分析企业中对数据库的管理**容灾备份、性能调优、数据库/Redis 的监控、优化迁移**的能力"
> 评审对象: `orion-platform-svc-go` 五大企业级数据库管理维度，对照主流平台（Bytebase/Yearning/DataWorks/云厂商 RDS 管控）
> 评审方法: 代码级实测（接线审计 + 路由/守卫审计 + 桩实现审计 + 重复实现审计）
> 评审结论: **5 维度均存在「部分具备或缺失」，且普遍存在『宣称有但实际桩/重复/未接线』的系统性落差**

---

## 一、为什么需要第六轮

前五轮已覆盖：能力缺口（GAP）、交互问题（IX）、权限接入（PERM）、接线实况（R4）、数据库能力盘点（R5）。

R5 已确认**数据库域系统性"假能力"**（备份/恢复桩、慢查询假数据、建仓缺失、GRANT 缺失）。本轮从**企业级数据库管理全生命周期**角度，深度核验 5 大核心能力维度的**真实实现状态**：

```
数据库管理全生命周期
├── 1. 容灾 DR（Disaster Recovery）—— 故障恢复、主从切换、复制
├── 2. 备份 Backup —— 全量/增量/恢复演练、保留策略、校验
├── 3. 性能调优 Performance —— 慢查询、索引、基线、回归
├── 4. 监控 Monitoring —— 数据库指标 + Redis 缓存监控
└── 5. 优化迁移 Migration —— 数据迁移、同步、校验、升级
```

---

## 二、关键发现（5 维度）

### 2.1 容灾 DR — 部分具备，但 orchestrator 孤立 + 无真实复制/切换

**已具备**：
- `internal/disaster-recovery/` **已接线**：wiring.go:399 `wiredisasterrecovery(db, logger)` + router.go:838-839 `disasterrecoveryH.RegisterRoutes(api)`
- 6 条路由**全部带守卫**（`RequirePermission("disaster-recovery", ...)`）：GET/POST/PUT /plans + POST /plans/:id/run + GET /plans/:id/runs（handler.go:26-31）
- 标准分层存在：handler + repository + service + orchestrator + handler_test.go

**真实缺口**：
- 🔴 **orchestrator 未注入 service**：`NewService(repo RepositoryInterface)` 只接收 repo，orchestrator 未接线 → **"容灾计划"只是 CRUD 元数据，无真实执行引擎**
- 🔴 **DefaultExecutor 是 exec.Command 跑 shell 的 stub**：`orchestrator.go:127-128` 注释 `// DefaultExecutor is a stub that returns an error for unimplemented commands` → **无 PG 流复制 / MySQL 主从切换 / 数据校验 / 故障转移的真实数据库级能力**
- 与 `internal/dr/`（仅 config/config.go 工具目录）存在**目录语义混淆**（disaster-recovery vs dr），但 dr 无业务实现

**结论**：DR 维度 = 计划 CRUD 完整 + 执行引擎缺失。企业级 DR（RPO/RTO、主从切换、演练、仲裁）均未实现。

---

### 2.2 备份 — 部分具备，但两套真实系统重复 + database-devops 仍为桩

**已具备**：
- **第一套 `internal/backup/`**（标准分层）：15 条路由，全部带 `RequirePermission("backup", ...)` 守卫
- **第二套 `internal/infrastructure/backup/`**：8 条路由，全部带 backup 守卫；含 **cron scheduler + verifier.go + 私有 executeBackup 真实执行路径** + recovery_service.go

**真实缺口**：
- 🔴 **两套备份系统重复**（internal/backup vs internal/infrastructure/backup），能力重叠、无统一抽象
- 🔴 **database-devops 备份/恢复仍是桩**（R5-3 重新确认）：`ExecuteBackup`（service.go:100-135）只解析 config + `UpdateStatus("running")` + 返回占位 `BackupResult{Status:"completed"}`（`// TODO: Execute actual backup based on cfg.BackupType`）；`ExecuteRestore`（:138-158）同样 `// TODO` 桩
- 🟡 **明文密码第三套表示**：`CreateDataSource`（service.go:166-187）`Password: req.Password` 明文存储 + `/data-sources` HTTP 端点（R4-3 再次确认，风险最高）

**结论**：备份维度 = 两套真实系统已有骨架（含 cron 调度 + 校验器）+ 第三套桩系统（database-devops）并存，**需统一为单一备份系统**，并把 database-devops 桩接到真实执行。

---

### 2.3 性能调优 — 部分具备，模块完整但慢查询采集缺失

**已具备**：
- `internal/performance/` **已接线**：router.go:407-408 `if perfH != nil { perfH.RegisterRoutes(api) }`（wire 变量名 **perfH**）
- 11 条路由**全部带守卫**（`RequirePermission("performance", ...)`）：baseline CRUD + /evaluate + /profile/:serviceName + /bottlenecks + /suggestions + /regression + /test-results（handler.go）
- 目录完整：handler + models + repository + service + handler_test.go

**真实缺口**：
- 🔴 **慢查询采集缺失**（R5-2 重新确认）：`internal/apm/service/business.go` GetSlowQueries 返回 3 条硬编码 fake（`// TODO: replace simulated data with real DatabaseProfiler queries`）；dba 无 slowquery 采集 → **performance 模块能做"调优分析"但喂给它的是假数据**
- 🟡 AI 调优建议（SQLAdvisor/IndexAdvisor，DBA-02/DBA-03）未接入 performance 模块

**结论**：Performance 维度 = 调优框架完整（基线/画像/瓶颈/建议/回归）+ 数据采集断裂（慢查询假数据）。

---

### 2.4 监控（数据库/Redis）— 部分具备，Redis 监控是硬编码假指标

**已具备**：
- 监控体系丰富：`internal/monitoring/`（指标采集）+ APM（应用性能）+ 可观测三支柱
- **顶层 `internal/cache-monitor/` 已接线**：handler 7 条路由**全部带守卫**（`RequirePermission("monitor", ...)`，handler.go:24-30，receiver 变量名 `cache`）：/metrics + /metrics/:name + /health + /register + /enable/:name + /disable/:name + /:name

**真实缺口**：
- 🔴 **`internal/monitoring/internal/cache-monitor/` 生成硬编码假 Redis 指标**：`CollectMetrics` 在 `if name == "redis"` 分支硬编码 `ConnectionsActive=5`、`MemoryUsed=64MB`、`HitCount+=100`、`MissCount+=10`、`KeyCount=50000`、`AvgLatencyMs=0.5`、`P95LatencyMs=1.2` → **无真实 Redis INFO 命令采集**
- 🔴 **Redis 无真实监控**：全项目 redis INFO / hit-rate / memory_used 命中均为配置/模型文件，**无真实采集路径**
- 🟡 **cache-monitor 重复**：顶层 internal/cache-monitor（已接线）与 internal/monitoring/internal/cache-monitor（未接线、无 repository、假数据）并存

**结论**：监控维度 = 通用监控体系完整 + Redis 专项监控是**硬编码假指标** + cache-monitor 存在未接线的嵌套重复。

---

### 2.5 优化迁移 — 缺失，仅工具文件未接线

**已具备**：
- `internal/migration/` 含工具文件：interfaces.go / models_json.go / utils.go / tenant_filter.go / version.go / watchdog.go / README.md

**真实缺口**：
- 🔴 **`internal/migration/` 未接线**：无 handler / repository / service 目录；`cmd/server/` 对 migration 的引用仅在 config.go:83-108（`migrations` 目录 = **schema 迁移工具配置**，非 internal/migration HTTP 模块）
- 🔴 **无数据迁移/同步/校验能力**：无 schema diff、数据搬移、增量同步、一致性校验、回滚
- 🟡 数据源统一（ARCH-0.11 三套数据源统一 + 明文密码清理）未做，迁移的前提（统一数据源访问层）不成立

**结论**：Migration 维度 = **完全缺失**（工具文件未接线 + 无任何 HTTP/服务能力），是 5 维度中唯一"缺失"级。

---

## 三、五维度能力矩阵总结

```
维度          已具备                    缺口                        等级
容灾 DR       计划 CRUD+守卫+接线        执行引擎缺失(orchestrator孤立)  🟡 部分具备
                                        + DefaultExecutor 跑 shell
备份 Backup   两套真实系统(cron+verifier) 两套重复 + database-devops桩   🟡 部分具备(+重复)
性能调优      调优框架完整(perfH 11路由)  慢查询采集假数据(APM fake)     🟡 部分具备
监控          monitoring 完整+cache-monitor接线  Redis 硬编码假指标     🟡 部分具备(+假数据)
                                           + cache-monitor 嵌套重复
优化迁移      internal/migration 工具文件  无 handler/service/接线      🔴 缺失
                                           + 无数据迁移/同步/校验
```

**核心洞察**：企业级数据库管理 5 大能力中，**4 项为「部分具备」（均存在假数据 / 桩 / 重复 / 执行引擎缺失）**，1 项（迁移）完全缺失。与前五轮结论一致——**Orion 数据库域是"框架完整、执行空心"**：CRUD 和路由守卫齐全，但真正的数据库级能力（复制、切换、真实备份、真实采集、数据迁移）普遍是桩或缺失。

---

## 四、新增待办（追加到 ALL_TODOS.md 第九章）

| ID | 任务 | 解决缺口 | 优先级 | 工作量 |
|----|------|---------|--------|--------|
| ARCH-0.14 | **DR 执行引擎落地**：orchestrator 注入 service + 真实容灾执行（PG 流复制探测 / MySQL 主从切换 / 演练 / RPO·RTO 记录） | DR 执行缺失 | 🔴 高 | 3-4d |
| ARCH-0.15 | **备份系统统一**：internal/backup + infrastructure/backup 合并为单一 backup 域，database-devops ExecuteBackup/ExecuteRestore 改接真实执行路径 | 备份重复 + R5-3 桩 | 🔴 高 | 2-3d |
| ARCH-0.16 | **慢 SQL 真实采集**：dba/apm 接入 DB profiler（pg_stat_statements / performance_schema）替换 GetSlowQueries 假数据 | R5-2 + Performance 数据断裂 | 🔴 高 | 2d |
| ARCH-0.17 | **Redis 真实监控**：cache-monitor 用 go-redis INFO/HitRate/Memory 采集替换硬编码假指标，删除未接线的 monitoring/internal/cache-monitor 重复 | Redis 假指标 + 重复 | 🔴 高 | 2d |
| ARCH-0.18 | **Migration 能力建设**：internal/migration 补 service + 迁移/同步/校验/回滚 + handler 接线（schema diff + 数据搬移） | Migration 完全缺失 | 🟡 中 | 3-5d |

**第六轮新增 5 项，合计 12-16 人天**，均为数据库域「执行空心 → 真实执行」的补强。

---

## 五、与前几轮的关系

| 前几轮 | 第六轮补充 |
|--------|-----------|
| R5-3 database-devops 备份桩 | 确认备份系统**两套重复**（internal/backup + infrastructure/backup），统一方向明确 |
| R5-2 慢查询假数据 | 关联 performance 模块：调优框架完整但**喂假数据**，采集断裂是调优无用的根因 |
| R4-3 三套数据源表示 | 备份维度再次出现明文密码（database-devops CreateDataSource） |
| IX-1/IX-2 数据源分裂 | Migration 缺失使数据源统一（ARCH-0.11）成为迁移能力的前置 |
| PERM 守卫 | 本轮 5 维度路由**全部带守卫**（DR/backup/performance/monitor），权限问题不在 CRUD 层而在**执行层** |

**修复顺序**：先补真实执行（ARCH-0.14~0.17）→ 统一数据源（ARCH-0.11 前置）→ 再建迁移能力（ARCH-0.18），最后才能支撑 AI 智能化（Text2SQL/Advisor 需要真实执行与真实数据）。

---

## 六、验收标准补充

| 维度 | 标准 | 验证方法 |
|------|------|---------|
| DR 真实执行 | orchestrator 注入 service + 非 stub executor | `grep "orchestrator" internal/disaster-recovery/service/` ≥1 |
| 备份统一 | 单一 backup 域，database-devops 桩删除 | `grep "TODO: Execute actual" internal/database-devops/` = 0 |
| 慢查询真实 | GetSlowQueries 不再返回硬编码 fake | `grep "replace simulated data" internal/apm/` = 0 |
| Redis 真实 | cache-monitor 调 go-redis INFO，无硬编码指标 | `grep "ConnectionsActive = 5" internal/monitoring/` = 0 |
| 迁移能力 | internal/migration 有 handler + cmd/server 引用 | `grep -rn "migration" cmd/server/` ≥1（非 config 引用） |

---

> 文档结束。第六轮（企业级数据库管理 5 能力）与前五轮配套，构成 Orion 数据库域完整问题全景：能力设计 → 交互修复 → 权限接入 → 接线落地 → **执行空心补强**。
