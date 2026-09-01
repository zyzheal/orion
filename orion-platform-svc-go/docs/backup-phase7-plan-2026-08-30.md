# Backup Service Phase 7 实施计划（企业级数据库平台能力补齐）

> 日期：2026-08-30 · 分支：`feat/wave2-parallel-execution` · 服务：`orion-platform-svc-go`
> 前置文档：`docs/dba-data-round6-enterprise-db-capabilities-2026-08-29.md`（对标基准，Bytebase/Yearning/DataWorks/RDS）

## 1. 对标结论回顾

整体评级 **B+ / 7.5 分**：已跨越"工具级"，进入"平台级骨架"，但差**自动化闭环**。

三档能力：
- **MySQL 恢复 ≈ A**（`executor/mysql.go:178-268`，mysqlbinlog --stop-datetime → io.Pipe 流式回放，唯一真 PITR 闭环）
- **PG 恢复 ≈ B**（Phase 6 已交付 `PreparePGRecoveryPlan` 编排产物，但 `PGExecutor.Restore` 未接入，差执行闭环）
- **整体 ≈ B+**（11 域：5 ✅ 完整 / 6 ⚠️ 差距）

### 11 域状态

| 域 | 状态 | 说明 |
|----|------|------|
| 归档完整性（WAL/binlog/clog） | ✅ | Phase 6 archive autoload + 独立 encryption_key |
| 校验（SHA256） | ✅ | `SHA256File` 全程覆盖备份/归档/恢复产物 |
| 调度 + 保留 | ✅ | cron scheduler + ArchiveScheduler + retention |
| 可观测性（OTel/zap） | ✅ | backupTracer/recoveryTracer/autoloadTracer/postRecoverTracer |
| 多租户 | ✅ | `ListTenantsWithPlans` 启动自动加载 |
| 引擎覆盖面 | ⚠️ | 仅 3/6（PG/MySQL/OceanBase），缺 Oracle/DB2/SQL Server |
| PITR 真实现度 | ⚠️ | PG 编排产物未接线；OceanBase clog 未实现 |
| 加密与密钥 | ⚠️ | AES-256-GCM 整文件读内存；无 KMS/轮换/版本化 |
| 存储后端 | ⚠️ | local/S3/MinIO 同后端，无断点续传/生命周期/冷热分层 |
| RTO/RPO 度量 | ⚠️ | RTO 真实耗时，RPO 为近似下限 |
| 凭证安全 | ⚠️ | PG/MySQL 用 env（正确）；OceanBase 走 argv 明文（缺陷） |

## 2. 差距清单 G1→G8（含证据行号）

| 编号 | 优先级 | 差距 | 证据（文件:行号） |
|------|--------|------|-------------------|
| **G1** | **P0** | PG PITR 编排未接入 Restore 链；`PGExecutor.Restore` 仍调占位 `replayArchives`，注释过时（"Phase 4"） | `executor/pg.go:182-184`；`executor/replay.go:20-46`；已交付产物 `executor/pg_pitr.go` |
| **G2** | **P0 安全** | OceanBase 密码经 `-p` argv 明文传递 | `executor/oceanbase.go:54-63`；对比 PG env `pg.go:58-79`、MySQL env `mysql.go:34-40` |
| **G3** | P1 | Oracle / DB2 / SQL Server Executor 缺失，注册表仅 3 引擎 | `executor/executor.go:135-141`；`executor/registry.go:25-34` |
| **G4** | P1 | OceanBase clog PITR 未实现（需 sys tenant + oblogminer） | `executor/oceanbase.go:163-165` |
| **G5** | P2 | AES-256-GCM 整文件读入内存 | `executor/crypto.go:22-24`（注释自认局限） |
| **G6** | P2 | 无 KMS / 密钥轮换 / 版本化 | `executor/crypto.go` + `service/archive_autoload.go`（密钥仅 base64 静态存储） |
| **G7** | P2 | RPO 用最后 archive WindowStart 近似下限 | `service/recovery_service.go:422-432` |
| **G8** | P3 | 存储后端无断点续传/生命周期/冷热分层 | `service/backup_service.go:419-436`（local→nil、s3/minio 同 backend） |

## 3. 排期与依赖 DAG

```
Wave 7-A（P0 阻塞项，先交付闭环与安全）
  G1  ──>  G2
   │        │
   │        ▼
   │      [凭证安全统一门禁：新 executor 一律 env]
   ▼
  G4（依赖 G1 的 PITR 接线模式，OceanBase 复用同一消费链路）

Wave 7-B（P1 引擎覆盖）
  G3（三引擎并行：Oracle archivelog / DB2 redo / SQL Server log_backup）
   │
   ▼
  G7（RPO 精确化，依赖新引擎的 archive 提交时间戳来源）

Wave 7-C（P2 加密纵深）
  G5 ──>  G6（chunked AEAD 为 KMS 集成铺路，密钥可版本化）

Wave 7-D（P3 存储增强）
  G8（独立于其它项，可最后）
```

- **G1 与 G2 无强依赖**，可并行开工；但两者都落在 executor 层，建议同一 review 窗口。
- **G2 建立凭证安全基线**（env-only 门禁）后，G3 新引擎必须遵守，故 G2 排前。
- **G5 是 G6 前置**：chunked AEAD 把密钥引用点从"单次整文件操作"改为"可注入 KMS provider"，才具备轮换/版本化能力。

## 4. 每项验收标准

### G1（P0）— PG PITR 执行闭环接入
- [x] `PGExecutor.Restore` 在收到 `RestoreOptions.PITRMode + TargetTime` 时，走 `PreparePGRecoveryPlan` 产物（manifest + runbook）消费链路，**不再调用占位 `replayArchives`**
- [x] `pg.go:182-184` 过时注释"Real PG PITR server orchestration is Phase 4" 删除/更新为 Phase 7 状态
- [x] `replayArchives` 占位函数退役（或仅保留给无 PITR 场景并明确注释）
- [x] 单测：构造带 `ArchivePaths` 的 Restore 调用，断言 manifest/runbook 生成、`ArchReplayed`/`ArchSizes` 正确填充、`RPO` 基于真实 archive 时间戳
- [x] `ProbeTargetDB` + `VerifyRecovery` 接入 PG PITR 恢复后探活（复用 `post_recover_probe.go` 既有能力）

### G2（P0 安全）— OceanBase 凭证 env-only
- [x] `oceanbase.go:54-63` 移除 `"-p", conn.Password` argv 明文，改为 `ob_client_*` / `OB_PASSWORD` env（对齐 PG `PGPASSWORD` / MySQL `MYSQL_PWD` 模式）
- [x] 单测：mock executor 的 `buildEnv` 校验密码不进 argv、不进 `ps` 可见参数
- [x] 新增门禁：`executor` 包内 grep 断言无 `"-p",` + `Password` 组合；新引擎（G3）遵守同一基线

### G3（P1）— 三引擎 Executor
- [x] `OracleExecutor`（archivelog 归档 + `rman`/`expdp` 恢复计划）、`DB2Executor`（redo log + `db2` 恢复）、`SQLServerExecutor`（log_backup + `RESTORE DATABASE ... WITH RECOVERY` 计划）注册进 `NewRegistry`
- [x] 每引擎 `Backup`/`Restore` 至少覆盖：连接 env 化、SHA256 校验、Encrypt/Decrypt 接入、RTO/RPO 记录
- [x] `executor.go:135-141` `IsSupported` 扩展至 6 引擎；`BackupDialects` 返回完整列表
- [x] 安全默认：DB 变更命令（如 `RESTORE`）默认 `#` 注释，输出 runbook 供 DBA 审阅（对齐 PG PITR 模式）
- [x] 单测：每引擎 ≥5 个（连接串解析、env 构建、脚本生成注释断言、校验、错误路径）

### G4（P1）— OceanBase clog PITR
- [x] 设计文档：sys tenant 连接 + oblogminer 回放链路（当前 `oceanbase.go:163-165` 仅注释占位）
- [x] `OBCLogExecutor` 或扩展 `OceanBaseExecutor`：列 clog 归档、按目标时间回放、恢复后探活
- [x] 单测：clog manifest 生成 + 回放脚本注释安全断言（沿用 G1 模式）

### G5（P2）— chunked AEAD
- [x] `EncryptFile`/`DecryptFile` 改造为分块 AEAD（nonce per chunk / 或流式 GCM），消除"整文件读内存"局限（`crypto.go:22-24`）
- [x] 兼容：既有单文件格式仍可解密（版本头 + 格式版本字段）
- [x] 单测：>内存大小的文件往返加密解密一致；篡改任一 chunk 校验失败

### G6（P2）— KMS / 密钥轮换 / 版本化
- [x] 定义 `KeyProvider` 接口（本地 base64 实现 + KMS 实现 stub），`EncryptFile` 通过注入 provider 取密钥
- [x] 密钥元数据携带 `version`，解密时按版本取对应密钥 → 支持轮换
- [x] 单测：版本化解密（旧版本密钥仍可解旧文件）；provider 失败走 fail-closed

### G7（P2）— RPO 精确化
- [x] RPO 不再用最后 archive WindowStart 近似（`recovery_service.go:422-432`），改为目标时间点前最近 archive 的**真实提交时间戳**
- [x] 新引擎（G3）归档时记录提交时间；无提交时间戳时保留近似并打 warn 日志
- [x] 单测：构造时间序列 archive，断言 RPO 计算精确

### G8（P3）— 存储后端增强
- [x] 设计评审：S3/MinIO 断点续传（multipart）、生命周期策略（归档→冷存储）、冷热分层
- [x] `storageBackendFor`（`backup_service.go:419-436`）区分 local / S3 / MinIO 能力差异（当前同 backend）
- [x] 本轮仅产出设计 + 接口定义 + 单测，不要求生产级实现（P3 排期）

## 5. 与 ALL_TODOS.md 现有条目的衔接

**避免重复**（以下已由 ARCH 条目覆盖，Phase 7 不做）：
- ARCH-0.10b 备份域接真实执行（13 条新测试 21/21 PASS）— 已完成
- ARCH-0.15 备份系统统一单一域 — 已完成
- ARCH-0.11 明文密码清理（545 包 0 FAIL）— 已完成，**但仅覆盖非 OceanBase 路径**；OceanBase argv 明文是 ARCH-0.11 遗漏的残余，归 G2

**需同步修正**：
- G1 完成时删除 `pg.go:184` 过时注释，避免与 Phase 6 已交付的 `pg_pitr.go` 脱节

**落表建议**：将 G1/G2 记为 P0、G3/G4 记为 P1、G5/G6/G7 记为 P2、G8 记为 P3，同步进 ALL_TODOS.md 顶部状态栏（"✅ 43 / 🔴 P0 3 / 🟡 P1 6 / 🔵 P2 11"）。

## 6. 风险与回退

| 风险 | 等级 | 缓解 |
|------|------|------|
| G1 接入引入 PG 恢复行为变更 | 中 | 默认保持"runbook 审阅 + 探活"，DB 变更命令仍注释，DBA 显式确认后执行 |
| G2 env 改造影响已有 OB 备份调用 | 低 | env 与 argv 双通道兼容一版，下版移除 argv |
| G3 三引擎脚本生成无真库验证 | 高 | 脚本默认注释 + 语法级单测；MinIO container 接入 CI 做真 e2e（Phase 7 收尾） |
| G4 oblogminer 依赖 sys tenant 权限 | 中 | 设计文档先行，权限不足时降级为 runbook 输出 |
| G5/G6 加密格式变更 | 中 | 版本头 + 向后兼容解密路径 |

## 7. 交付顺序建议

1. **Wave 7-A**：G1（PG PITR 闭环）→ G2（OB 凭证安全）→ G4（OB clog PITR 设计）
2. **Wave 7-B**：G3（三引擎）→ G7（RPO 精确化）
3. **Wave 7-C**：G5（chunked AEAD）→ G6（KMS 抽象）
4. **Wave 7-D**：G8（存储设计）→ MinIO e2e 接入 —— 🎉 **已完成 2026-08-31**：`minio_e2e_test.go`（3 用例：单对象往返/大载荷 multipart/生命周期规则，env 门控 skip）+ CI `go-integration` job 新增 minio service（`MINIO_E2E_*` env），本地容器 3/3 PASS，全量 `go build` + `go test` 0 FAIL
