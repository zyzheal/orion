# OceanBase clog PITR 设计（G4）

> 状态：设计文档（Phase 7 / G4，2026-08-31）
> 关联：`docs/backup-phase7-plan-2026-08-30.md` G4 条目、`internal/infrastructure/backup/executor/oceanbase.go`
> 风险缓解：`backup-phase7-plan` 第 137 行 —— *"G4 oblogminer 依赖 sys tenant 权限 | 中 | 设计文档先行，权限不足时降级为 runbook 输出"*

## 1. 目标

为 OceanBase 数据库补齐 **clog（提交日志）时间点恢复（PITR）** 能力：

1. **clog 归档**：触发 OceanBase 归档日志（`ALTER SYSTEM ARCHIVELOG`），将 clog 段归档到 `ob_archive_log` 路径，供后续回放。
2. **按目标时间回放**：通过 `oblogminer` 在 **sys tenant** 读取 clog 增量，把目标 tenant 的数据回放到指定 `TargetTime`。
3. **恢复后探活**：回放完成后对目标 tenant 执行幂等探活（`SHOW TENANT` / 只读 `SELECT`），确认租户可读。
4. **RPO/RTO 记录**：与 PG PITR 一致，产出 `ArchReplayed` / `ArchSizes`，并在 runbook 中记录 RPO（目标时间距最近归档提交时间）与 RTO（恢复执行时长）。

**非目标**（本阶段不做，避免范围蔓延）：
- 不实现物理块级备份（`obd`/快照）——保持 ob-loader-dumper 逻辑备份为唯一基备份路径。
- 不自动执行回放/归档等 DB 变更命令——**runbook-first**：state-changing 命令默认 `#` 注释，仅幂等验证步骤默认运行，由 DBA 审阅后执行（对齐 G1 PG PITR / G3 Oracle/DB2/SQLServer 模式）。
- 不实现 Oracle-mode tenant 的 PITR（Phase 2 范围）。

## 2. 背景与现状

### 2.1 当前 OceanBase 执行器（`oceanbase.go`）

- `OceanBaseExecutor` 仅支持 **MySQL-mode** 逻辑备份/恢复，通过 `ob-loader-dumper`（CSV）。
- `Restore` 末尾（`oceanbase.go:175-177`）存在 PITR 占位：
  ```go
  // Validate + account for clog archive segments. OceanBase PITR
  // requires sys tenant + oblogminer; Phase 4.
  if err := replayArchives(ctx, opts.ArchivePaths, result); err != nil {
      return result, err
  }
  ```
  该占位仅对 `ArchivePaths` 做存在性校验与尺寸统计（`replay.go` 的 `replayArchives`），**未做任何实际 clog 回放**。

### 2.2 关键技术链路

| 环节 | 机制 | 说明 |
|------|------|------|
| clog 产生 | OceanBase 内部 | 每个分区主副本在事务提交时写 clog（Commit Log） |
| 归档开启 | `ALTER SYSTEM ARCHIVELOG` | 需 sys tenant 权限；开启后 clog 归档到 `ob_archive_log` 目录 |
| 归档路径 | `ob_archive_log` | 目标端共享存储/本地路径，本执行器负责 stat/指纹归档段 |
| 增量回放 | `oblogminer` | 官方增量日志拉取工具；**必须连接 sys tenant**，按 `--start-time/--stop-time`（或 scn）读取 clog |
| 数据落地 | oblogminer 产物 | 产出增量 SQL / CSV，供回放到目标 tenant |
| 探活 | `SHOW TENANT` / 只读 `SELECT` | 恢复完成后幂等验证 |

### 2.3 关键约束（G2 基线延续）

- **密码只进 env**：`OB_PASSWORD`（MySQL-mode 逻辑路径已遵守，`oceanbase.go:45-51`）。clog/oblogminer 路径同样遵守——sys tenant 密码只进 `OB_PASSWORD`，**绝不出现在 argv**（`ps` 可见）。

## 3. 设计决策

### 3.1 决策 D1：扩展 `OceanBaseExecutor` vs 新建 `OBCLogExecutor`

**结论：新建 `OBCLogExecutor`（独立执行器），并在 `OceanBaseExecutor.Restore` 中按 PITR 条件路由。**

理由：

| 维度 | 扩展 `OceanBaseExecutor` | 新建 `OBCLogExecutor` ✅ |
|------|--------------------------|--------------------------|
| 职责单一 | 逻辑备份/恢复 与 clog PITR 混合 | 逻辑路径（ob-loader-dumper）与 PITR 路径（oblogminer）解耦 |
| 连接语义 | MySQL-mode tenant（普通租户） | sys tenant（特权）——两者凭据/权限域不同 |
| 测试隔离 | 单测需同时 mock 两套工具 | 各自独立单测，互不干扰 |
| 演进 | 后续 Oracle-mode/物理备份继续膨胀该类型 | 每个执行器聚焦单一引擎能力 |

接线方式（与 PG 一致）：在 `OceanBaseExecutor.Restore` 的 PITR 分支（`TargetTime != nil && len(ArchivePaths) > 0`）**委托**给 `OBCLogExecutor`，其余路径维持现状。这避免破坏 `BackupDialects()` 计数（仍 6 方言）与 `IsSupported`。

**注册**：`OBCLogExecutor` 不单独注册进 `NewRegistry`（它服务同一 `DialectOceanBase`，注册会造成重复/覆盖）。它作为 `OceanBaseExecutor` 内部的 PITR 能力被路由调用。

### 3.2 决策 D2：sys tenant 凭据传递

`ConnInfo` 只有单一 `Password` 字段（`executor.go:49`）。clog 回放需要 **sys tenant** 的连接（用户名常为 `root@sys`，密码与业务租户不同）。

**结论**：利用现有的 `WALExtra []string` 通道 + `TenantName` 约定，不新增共享结构字段：

- 调用方在 `RestoreOptions.TargetConn` 中提供 sys tenant 连接：
  - `TenantName = "sys"` → PITR 分支据此识别 sys 模式。
  - `User` = sys 用户名（`root`），`Password` = sys 密码，`Host/Port/DB` = 目标集群。
- `WALExtra` 承载 oblogminer 附加参数（如 `--start-time` 之外的选项），沿用现有「尾部透传」通道（`oceanbase.go:164` 已使用）。
- 文档明确：**PITR 调用的 `TargetConn.Password` 必须是 sys tenant 密码**（runbook 头部注释强调）。

> 备选（未选）：为 `ConnInfo` 新增 `SysPassword` 字段。会污染公共 API 且仅 OB 使用；`WALExtra` + `TenantName=sys` 约定已足够且向后兼容。

### 3.3 决策 D3：oblogminer 二进制路径

`DefaultBinPath`（`common.go`）尚未注册 oblogminer。**新增 `case "oblogminer": return "/usr/bin/oblogminer"`**（与 `ob-loader-dumper` 同目录约定）。`OBCLogExecutor` 提供 `OblogminerBin` 字段（可注入测试，默认走 `DefaultBinPath`），与 `OceanBaseExecutor.ToolBin` 模式一致。

### 3.4 决策 D4：runbook-first 安全默认（沿用 G1/G3 模式）

| 命令类别 | 默认行为 |
|---------|---------|
| `ALTER SYSTEM ARCHIVELOG` | `#` 注释（DB 状态变更） |
| `oblogminer` 实际回放（写目标库） | `#` 注释 |
| `ALTER SYSTEM RESTORE` / tenant 切换 | `#` 注释 |
| clog 段清单/校验（`list`、`validate`、`stat`/`sha256`） | **默认运行**（幂等、只读） |
| 探活（`SHOW TENANT`、只读 `SELECT 1`） | **默认运行**（幂等、只读） |

运行书中给出「REVIEW SECTION：uncomment to apply the recovery」——与 PG PITR `buildPGRecoveryScript`、Oracle `buildOracleRmanScript`、DB2、SQLServer 完全一致的注释安全模式。

### 3.5 决策 D5：clog manifest 产物

镜像 PG PITR 的 manifest 模式（`pg_pitr.go`）：

```
<ScratchDir>/
├── obclog-<BackupID>-manifest.json     # 0o600，机器可读清单
└── obclog-restore-<BackupID>.sh        # 0o700，runbook（DBA 审阅执行）
```

manifest JSON 字段（`OBCLogRecoveryPlan`）：

| 字段 | 说明 |
|------|------|
| `BackupID` | 关联的基备份 ID |
| `BackupPath` | 基备份 artifact 路径 |
| `TargetTime` | 目标时间点（RFC3339） |
| `ArchiveDir` | `ob_archive_log` 目录 |
| `ArchiveFiles` | `[]OBCLogArchiveInfo{Path, Size, SHA256, ModTime}`（指纹归档段） |
| `ManifestSHA256` | 清单自校验 |
| `ScriptPath` | runbook 路径 |
| `GeneratedAt` | 生成时间 |

归档段 SHA256 与 PG 的 `ArchiveFileInfo` 一致（`SHA256File` 流式，`common.go`），供 DBA 验证回放源完整性。

## 4. 模块设计

### 4.1 新文件 `obclog_pitr.go`（executor 包）

```go
// OBCLogExecutor implements the OceanBase clog PITR recovery path.
// It connects to the sys tenant to read archived clog via oblogminer and
// replays to TargetTime. State-changing commands are emitted as runbook
// comments; only idempotent verification runs by default (G1 pattern).
type OBCLogExecutor struct {
    OblogminerBin string
}

func NewOBCLogExecutor() *OBCLogExecutor { ... }       // OblogminerBin = DefaultBinPath("oblogminer")
func (e *OBCLogExecutor) Dialect() Dialect              // DialectOceanBase

// OBCLogRecoveryOptions mirrors PGRecoveryOptions for the OB path.
type OBCLogRecoveryOptions struct {
    BackupID     string
    BackupPath   string
    ArchivePaths []string
    TargetTime   *time.Time
    ScratchDir   string
    TargetConn   ConnInfo // sys tenant connection (TenantName == "sys")
}

// OBCLogRecoveryPlan mirrors PGRecoveryPlan.
type OBCLogRecoveryPlan struct { ... }                  // JSON tags, see D5

func PrepareOBCLogRecoveryPlan(ctx, opts, log) (*OBCLogRecoveryPlan, error)
//  - validate BackupID/BackupPath/ArchivePaths/TargetTime/TenantName=="sys"
//  - ScratchDir default /var/lib/orion-pitr (0o750), MkdirAll
//  - stat + SHA256 each archive segment (SHA256File, fail-closed on missing)
//  - render runbook (0o700) + manifest JSON (0o600)
//  - ManifestSHA256 = hashString(script|len(files)) (mirror PG)

func buildOBCLogRunbook(plan *OBCLogRecoveryPlan) string
//  - header: #!/usr/bin/env bash, set -euo pipefail, backup/artifact/target
//  - verify steps default-run: clog list, archive sha256, SHOW TENANT, SELECT 1
//  - REVIEW SECTION (#-commented): ALTER SYSTEM ARCHIVELOG, oblogminer replay,
//    ALTER SYSTEM RESTORE / tenant switch
//  - RPO/RTO echo lines
```

### 4.2 `oceanbase.go` 接线（修改）

在 `OceanBaseExecutor.Restore` 中，把占位（`replayArchives`）替换为 PITR 路由：

```go
// PITR mode: delegate clog replay to the sys-tenant oblogminer executor.
if opts.TargetTime != nil && len(opts.ArchivePaths) > 0 {
    if opts.BackupID == "" {
        return result, fmt.Errorf("oceanbase PITR restore requires BackupID (found empty)")
    }
    if opts.TargetConn.TenantName != "sys" {
        return result, fmt.Errorf("oceanbase PITR restore requires sys tenant connection (got tenant %q)", opts.TargetConn.TenantName)
    }
    plan, err := PrepareOBCLogRecoveryPlan(ctx, OBCLogRecoveryOptions{...}, nil)
    if err != nil {
        return result, err
    }
    result.ScriptPath = plan.ScriptPath
    result.ManifestPath = OBCLogManifestPath(filepath.Dir(plan.ScriptPath), opts.BackupID)
    result.ArchReplayed = len(plan.ArchiveFiles)
    // ArchSizes from plan
    return result, nil
}
// Non-PITR: keep existing accounting (replayArchives).
if err := replayArchives(ctx, opts.ArchivePaths, result); err != nil { return result, err }
```

**条件与 PG 完全一致**（AND：`TargetTime != nil && len(ArchivePaths) > 0`，PG `pg.go:188`）。`replayArchives` 保留给非 PITR 统计路径。

### 4.3 `common.go`（修改）

`DefaultBinPath` 新增 `case "oblogminer": return "/usr/bin/oblogminer"`。

## 5. 探活设计

恢复后探活（runbook 默认运行部分）：

```bash
# 1. Tenant exists and is readable (idempotent, read-only).
ob_client -h <host> -P <port> -u root@sys -p"$OB_PASSWORD" -e "SHOW TENANT;"
# 2. Minimal read probe on the restored tenant.
ob_client -h <host> -P <port> -u root@<tenant> -p"$OB_PASSWORD" -e "SELECT 1;"
```

- 密码通过 `OB_PASSWORD` env（G2 基线），argv 只出现 `-u`/`-h`/`-P`。
- 探活命令均为只读/幂等，因此**默认运行**；若探活失败，runbook 以非零退出（`set -euo pipefail`）提示 DBA。

## 6. RPO/RTO 记录

| 指标 | 来源 | 落地 |
|------|------|------|
| RPO | 目标时间点与最近归档段 `ModTime` 的差 | manifest `RPO` 字段 + runbook echo |
| RTO | 回放计划生成耗时（非回放执行——执行由 DBA 完成） | `RestoreResult.Duration`（与现有路径一致） |
| 归档段统计 | `ArchReplayed` / `ArchSizes` | `RestoreResult`（与 PG 一致） |

无归档段提交时间戳时保留近似（计划 G7 RPO 精确化再收敛），并打 warn。

## 7. 安全与合规（G2 延续）

1. **凭据只进 env**：sys 密码经 `OB_PASSWORD` 传递；runbook 中 `-p"$OB_PASSWORD"` 引用 env，不写明文。
2. **runbook 默认只读**：所有 DB 变更命令 `#` 注释；仅幂等校验/探活默认执行。
3. **manifest 0o600 / script 0o700 / scratch 0o750**：与 PG PITR 文件权限一致。
4. **fail-closed**：归档段缺失/stat 失败 → 硬错误；`BackupID` 缺失 → 硬错误；`TenantName != "sys"` → 硬错误。
5. **无明文落盘**：密码不写入 manifest/runbook/日志。

## 8. 测试计划

| 路径 | 用例 | 参考 |
|------|------|------|
| env 构建 | sys 密码只进 `OB_PASSWORD`、不进 argv | `buildOceanBaseEnv` 既有测试模式 |
| runbook 注释断言 | `ALTER SYSTEM ARCHIVELOG`/回放/`ALTER SYSTEM RESTORE` 为 `#`；探活默认运行 | PG `buildPGRecoveryScript` 断言模式 |
| manifest 生成 | JSON 字段、SHA256、权限 0o600/0o700/0o750 | `pg_pitr_test.go` |
| 校验/错误路径 | BackupID 空、TenantName≠sys、归档段缺失、ArchivePaths 空 | `mysql_pitr_test.go` / `pg_pitr_restore_test.go` |
| 接线 | `OceanBaseExecutor.Restore` PITR 分支委托 `OBCLogExecutor` | `oceanbase_test.go` |

每路径 ≥5 单测。执行门禁：`go build ./...`（BUILD_EXIT=0）+ `go test -count=1 ./...`（0 FAIL）。

## 9. 交付清单（任务 #81/#83/#82 映射）

- [ ] 设计文档：本文档 ✅
- [ ] `common.go`：`DefaultBinPath("oblogminer")`
- [ ] `obclog_pitr.go`：`OBCLogExecutor` + `PrepareOBCLogRecoveryPlan` + `buildOBCLogRunbook` + manifest 结构
- [ ] `oceanbase.go`：Restore PITR 分支接线（委托 + 校验）
- [ ] 单测：`obclog_pitr_test.go`（≥5 路径）
- [ ] 验证：`go build ./...` + `go test -count=1 ./...` 0 FAIL
- [ ] `ALL_TODOS.md`：G4 标记完成，P1 合计更新（剩余 P1-8/P1-9）

## 10. 风险与回退

| 风险 | 等级 | 缓解 |
|------|------|------|
| oblogminer 依赖 sys tenant 权限 | 中 | runbook-first：无权限时 DBA 审阅执行；探活/校验仍由执行器完成 |
| clog 归档路径 `ob_archive_log` 不可达 | 中 | stat 前置校验 fail-closed；runbook 头部注明目标端路径 |
| 无真库 e2e | 高 | 脚本注释安全 + 语法级单测；MinIO container e2e 归 Phase 7 收尾（G8 排期） |
| sys 密码被误用于业务连接 | 中 | `TenantName=="sys"` 显式校验 + 文档强调 |
