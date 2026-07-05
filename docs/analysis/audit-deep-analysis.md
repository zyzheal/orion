# Audit 模块深度分析

**生成日期**: 2026-07-02  
**分析范围**: `orion-platform-service/src/services/audit/` + `src/api/audit-routes.ts` + `permission-audit-routes.ts` + `pipeline-audit-log-routes.ts` + `terminal-audit-routes.ts`  
**模块标签**: 审计日志, SOC2/ISO27001, 链式 Hash, 合规

---

## 一、现状概述

### 模块定位

Audit 模块是 Orion 的审计与合规核心，提供不可篡改的审计日志系统（SHA256 链式 Hash）、SOC2/ISO27001 合规检查、日志保留策略管理、完整性校验和不可变存储。覆盖 4 个审计域：通用审计、权限审计、Pipeline 审计、终端审计。

### 文件结构

| 文件 | 行数 | 职责 |
|------|------|------|
| `services/audit/AuditRepository.ts` | ~200 | 审计日志 DB 层，链式 Hash 生成和验证 |
| `services/audit/AuditService.ts` | - | 审计日志业务逻辑 |
| `services/audit/AuditLogChain.ts` | ~200 | 内存/DB 双模式的链式 Hash 管理 |
| `services/audit/AuditComplianceService.ts` | ~300 | SOC2 7 项 + ISO27001 9 项合规检查 |
| `services/audit/AuditIntegrityVerifier.ts` | ~250 | 定期完整性校验、链断裂检测、告警 |
| `services/audit/AuditRetentionService.ts` | ~150 | 保留策略管理、日志归档/清理 |
| `services/audit/ImmutableAuditStorage.ts` | - | 不可变存储（文件系统） |
| `services/audit/AuditTypes.ts` | - | 共享类型定义 |
| `services/audit/index.ts` | - | barrel 导出 |
| `api/audit-routes.ts` | ~100 | 审计日志路由（主路由） |
| `api/permission-audit-routes.ts` | - | 权限审计路由 |
| `api/pipeline-audit-log-routes.ts` | - | Pipeline 审计路由 |
| `api/terminal-audit-routes.ts` | - | 终端审计路由 |

### 核心数据模型

- **AuditLog**: id, tenantId, userId, action, resourceType, resourceId, requestMethod/Path/Body, responseCode/Body, ipAddress, userAgent, prevHash, hash
- **ChainedAuditLogEntry**: id, sequenceNumber, action, userId, details, tenantId, prevHash, hash, timestamp
- **ComplianceCheckResult**: checkId, framework (SOC2/ISO27001), controlId, status (PASS/FAIL/WARNING), severity
- **AuditComplianceReport**: overallScore (0-100), checks[], summary
- **AuditRetentionPolicy**: retentionDays (min 30), archiveBeforeDelete, enabled

### 持久化方式

✅ 全部 PostgreSQL：
- `AuditRepository`（`audit_logs` 表）
- `AuditChainEntryRepository`（`audit_chain_entries` 表）
- `AuditRetentionService` 直接 SQL（`audit_retention_policies` 表）
- `ImmutableAuditStorage` 文件系统（可选）

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 审计日志创建 | ✅ | SHA256(prevHash + content) 链式哈希 |
| 审计日志查询 | ✅ | 按 tenantId/userId/action/resourceType/resourceId 过滤 |
| 链式 Hash 验证 | ✅ | 全量链验证（5000 条/页分页），检测篡改 |
| 最新 Hash 查询 | ✅ | 快速校验最新状态 |
| SOC2 CC6.1 检查 | ✅ | 逻辑访问安全审计覆盖 |
| SOC2 CC6.2 检查 | ✅ | 审计日志防篡改 |
| SOC2 共 7 项检查 | ✅ | CC6.1~CC6.8 相关控制点 |
| ISO27001 A12.4.1 | ✅ | 事件日志记录 |
| ISO27001 共 9 项检查 | ✅ | A12.4.1~A18.1.4 相关控制点 |
| 保留策略管理 | ✅ | 最小 30 天，支持归档后删除 |
| 自动清理过期日志 | ✅ | 按策略批量删除 |
| 定期完整性校验 | ✅ | 可配置调度，链断裂告警 |
| 不可变存储 | ✅ | 文件系统写入审计快照 |
| 权限审计路由 | ✅ | 独立路由文件 |
| Pipeline 审计路由 | ✅ | 独立路由文件 |
| 终端审计路由 | ✅ | 独立路由文件 |

---

## 三、API 端点

### 通用审计路由 (audit-routes.ts)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/logs` | 审计日志列表 |
| GET | `/logs/:id` | 日志详情 |
| POST | `/logs` | 创建审计日志 |
| POST | `/logs/:id/verify` | 验证单条日志 |
| POST | `/verify` | 验证整个链 |
| GET | `/actions` | 不同 action 列表 |
| GET | `/resource-types` | 不同资源类型 |
| GET | `/chain/info` | 链信息 |
| GET | `/storage/stats` | 存储统计 |
| GET | `/compliance/check` | 合规检查 |
| POST | `/compliance/report` | 生成合规报告 |
| GET | `/retention/policy` | 保留策略 |
| PUT | `/retention/policy` | 更新保留策略 |
| POST | `/retention/cleanup` | 执行清理 |
| POST | `/verify/chain` | 验证链完整性 |

### 权限审计路由 (permission-audit-routes.ts)
独立路由用于权限变更审计。

### Pipeline 审计路由 (pipeline-audit-log-routes.ts)
独立路由用于 Pipeline 执行审计。

### 终端审计路由 (terminal-audit-routes.ts)
独立路由用于终端操作审计。

---

## 四、依赖关系

### 内部依赖

- `AuditService` → `AuditRepository`
- `AuditComplianceService` → `AuditRepository`, `AuditService`, `AuditRetentionService`
- `AuditIntegrityVerifier` → `AuditLogChain`, `ImmutableAuditStorage`
- `AuditLogChain` → `AuditChainEntryRepository`

### 外部依赖

- `DatabasePool`（所有 Service）
- `crypto`（SHA256 Hash）
- `uuid`（ID 生成）
- `utils/logger.ts`
- `errors.ts`
- `EventEmitter`（IntegrityVerifier 事件：chain-break, tampering, verification-failed）

### 测试覆盖

✅ 8 个测试文件:
- `__tests__/AuditRepository.test.ts`
- `__tests__/AuditService.test.ts`
- `__tests__/AuditLogChain.test.ts`
- `__tests__/AuditIntegrityVerifier.test.ts`
- `__tests__/AuditTypes.test.ts`
- `__tests__/ImmutableAuditStorage.test.ts`
- `__tests__/index.test.ts`

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **AuditLogChain 与 AuditRepository 双链**：两个系统各自维护链式 Hash，数据可能不一致 | **P1** | 统一审计日志的链式 Hash 实现，消除双链 |
| **ImmutableAuditStorage 可选**：未配置时默认不做文件存储，影响不可篡改性 | **P1** | 增加配置检查，缺失时发出警告 |
| **合规检查数据依赖 Mock 评估**：`AuditComplianceService` 使用 `AuditRepository` 数据，但 Policy 评估是 Mock | **P1** | 确保审计日志足够详细后再依赖 Policy 真实数据 |
| **大量日志的链验证性能**：5000 条/页分页但全量验证仍可能耗时 | **P2** | 增加增量验证（只验证上次检查后的新条目） |
| **保留策略最小 30 天硬编码**：有些合规标准要求 1 年或更长 | **P2** | 改为可配置最小值，根据合规框架自动调整 |
| **无审计日志导出功能**：无法导出为 CSV/JSON 供外部审计使用 | **P2** | 增加审计日志导出端点 |
| **Terminal Audit 集成深度不足**：有独立路由但不清楚是否真正捕获终端操作 | **P2** | 确认是否对接了 WebSSH/终端代理 |

---

## 六、总结

Audit 模块是 Orion **最成熟、最完整的模块之一**：9 个 Service 文件、4 个路由文件、完整的合规检查框架（SOC2 7 项 + ISO27001 9 项）、链式 Hash 防篡改、保留策略管理、完整性校验器和不可变存储。测试覆盖全面（8 个测试文件）。

**存在的主要问题是"双链"架构**：`AuditRepository.create()` 直接生成 SHA256 hash 写入 `audit_logs` 表，同时 `AuditLogChain` 维护独立的链式结构写入 `audit_chain_entries` 表。这两者通过不同的 Repository 管理，可能导致数据不一致。建议统一为单一链式结构。整体而言，Audit 模块已具备 SOC2 Type II 合规审计的基本能力。
