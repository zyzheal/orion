# 审计列补充方案 (Audit Column Remediation)

> Phase 5.6: 为所有业务表添加 `created_by` / `updated_by` 审计列。

## 现状分析

### 审计列覆盖率

| 指标 | 数值 |
|------|------|
| 总迁移文件数 | 135 |
| 含 `created_by` 或 `updated_by` 的文件 | 41 (30.4%) |
| 不含审计列的文件 | 94 (69.6%) |
| CREATE TABLE 语句 | 675 个 |

### 已有审计列的 41 个文件

按服务分组（代表性）：

| 服务 | 有审计列的表 | 列名 |
|------|------------|------|
| orion-ci-cd-svc-go | `pipelines`, `pipeline_runs`, `deployments` | `created_by`, `updated_by` |
| orion-config-mgmt-svc | `config_items`, `config_versions` | `created_by`, `updated_by` |
| orion-selfhealing-svc | `selfhealing_rules` | `created_by`, `updated_by` |
| orion-pipeline-svc | `pipelines`, `pipeline_runs` | `created_by`, `updated_by` |
| orion-artifact-svc | `artifacts` | `created_by` |
| orion-ticket-svc-go | `tickets` | `created_by`, `updated_by` |
| orion-governance-svc-go | `compliance_policies` | `created_by`, `updated_by` |
| orion-security-svc | `security_scans` | `created_by` |

### 缺审计列的 94 个文件分类

| 分类 | 原因 | 代表文件 |
|------|------|---------|
| **无用户上下文** | 数据自动采集，无操作者 | `orion-finops-svc-go` (成本数据) |
| **系统日志表** | 审计日志本身记录审计 | `audit_logs`, `audit_events` |
| **代码遗漏** | 设计时应添加但未添加 | `orion-alert-breaker-svc-go`, `orion-governance-svc-go` |
| **TS/Py/Rust 服务** | 语言不同，模式不同 | `orion-llm-trace-svc-py`, `orion-security-svc-rust` |

## 统一方案

### 审计列规范

**所有业务表应包含：**

```sql
created_by VARCHAR(255),      -- 创建者（用户名或 UUID）
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_by VARCHAR(255),      -- 最后更新者
updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
```

### 审计列类型选择

| 数据类型 | 适用场景 | 示例 |
|---------|---------|------|
| `VARCHAR(255)` | 存储用户名/email | `created_by VARCHAR(255)` |
| `UUID` | 存储用户 ID（有 FK） | `created_by UUID REFERENCES users(id)` |

**本项目统一使用 `VARCHAR(255)`**，原因：
1. 跨服务引用 `users` 表的 FK 复杂度高
2. 用户 ID 在不同服务中可能使用不同格式
3. 审计列主要用于日志查询，无需 FK 约束

### 例外表（不需要审计列）

| 类型 | 理由 | 示例 |
|------|------|------|
| **审计日志表** | 自身是审计记录，不需要审计审计 | `audit_logs`, `permission_audit_logs` |
| **事件/消息表** | 事件生成方已记录在事件中 | `events`, `chatops_messages` |
| **级联子表** | 继承主表审计信息 | `role_permissions`, `pipeline_tasks` |
| **系统配置表** | 系统维护，无需用户审计 | `role_inheritance` |

## 修复迁移模板

### 模板 1: 添加审计列

```sql
-- Migration: 003_add_audit_columns.sql
ALTER TABLE cloud_costs ADD COLUMN created_by VARCHAR(255);
ALTER TABLE cloud_costs ADD COLUMN updated_by VARCHAR(255);

ALTER TABLE k8s_costs ADD COLUMN created_by VARCHAR(255);
ALTER TABLE k8s_costs ADD COLUMN updated_by VARCHAR(255);

ALTER TABLE saas_costs ADD COLUMN created_by VARCHAR(255);
ALTER TABLE saas_costs ADD COLUMN updated_by VARCHAR(255);
```

### 模板 2: 带默认值

```sql
ALTER TABLE alert_breaker_rules ADD COLUMN updated_by VARCHAR(255);
-- 已有 created_by，只需添加 updated_by
```

## 执行计划

| 波次 | 范围 | 文件数 | 操作 |
|------|------|--------|------|
| Wave 1 | 代码已使用但迁移缺失 | ~10 文件 | `ALTER TABLE ADD COLUMN` |
| Wave 2 | 业务表添加审计列 | ~60 文件 | 更新 CREATE TABLE |
| Wave 3 | 标注例外表理由 | ~24 文件 | 文档记录 |
