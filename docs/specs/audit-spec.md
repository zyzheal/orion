# Spec: 审计 (Audit)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 审计合规
> **目标成熟度**: L1.5 → L2.5
> **关键交付**: 审计日志、哈希链、审计查询、合规报告、不可篡改

## 一、功能描述

### 1.1 现状评估 (L1.5)

Orion 当前已实现（Go 微服务 `orion-audit-svc-go`）：
- 审计日志 CRUD（AuditService + Repository）
- 哈希链实现（前后日志 hash 关联，防篡改）
- 分页查询（ListAuditLogs）
- 审计日志按租户隔离
- OpenTelemetry trace 集成

**不足**：
- 无审计日志导出（CSV/PDF）
- 无审计规则配置（哪些操作需要记录）
- 无审计告警（异常操作自动告警）
- 无审计统计（操作频次、用户行为分析）
- 无日志归档策略
- 无审计报告自动生成
- 无敏感操作标记（如删除/权限变更）

### 1.2 Phase 1 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 审计规则引擎 | 按操作类型/资源类型配置审计策略 | L2 |
| 审计导出 | CSV/PDF 导出、时间范围筛选 | L2 |
| 审计告警 | 异常操作（批量删除/权限变更）自动告警 | L2 |
| 审计统计 | 操作频次、用户行为、资源访问统计 | L2 |
| 审计报告 | 合规报告自动生成（SOC2/ISO27001） | L2.5 |
| 日志归档 | 超过 N 天的审计日志自动归档 | L2 |

## 二、验收标准

### 2.1 审计日志基础

| # | 标准 | 验证方式 |
|---|------|----------|
| AU1 | 所有写操作自动生成审计日志（操作人/时间/资源/变更） | 集成测试 |
| AU2 | 审计日志含前后值对比（before/after JSON） | API 测试 |
| AU3 | 审计日志不可修改/删除（只追加） | 单元测试 |
| AU4 | 哈希链验证：任意日志可验证链完整性 | 单元测试 |
| AU5 | 哈希链断裂检测：记录篡改尝试 | 单元测试 |
| AU6 | 多租户隔离：租户A无法查询租户B的审计日志 | 集成测试 |
| AU7 | 审计日志保留 365 天（可配置） | 单元测试 |

### 2.2 审计查询

| # | 标准 | 验证方式 |
|---|------|----------|
| AU8 | 支持按操作人/资源类型/资源ID/时间范围筛选 | API 测试 |
| AU9 | 支持模糊搜索（操作描述/资源名称） | API 测试 |
| AU10 | 分页查询，默认 20 条/页，最大 100 条/页 | API 测试 |
| AU11 | 审计详情含操作上下文（IP/User-Agent/租户/ traceId） | API 测试 |
| AU12 | 按操作类型分组统计 | API 测试 |

### 2.3 审计规则

| # | 标准 | 验证方式 |
|---|------|----------|
| AU13 | 支持配置审计规则（操作类型 + 资源类型 + 级别） | API 测试 |
| AU14 | 审计级别：info（常规）/ warning（敏感）/ critical（高危） | API 测试 |
| AU15 | 预置规则：删除操作为 critical、登录为 info、配置变更 warning | 单元测试 |
| AU16 | 规则支持按租户自定义 | API 测试 |

### 2.4 审计告警

| # | 标准 | 验证方式 |
|---|------|----------|
| AU17 | critical 级别操作自动触发告警 | 集成测试 |
| AU18 | 同一用户 5 分钟内 10 次删除操作自动告警 | 集成测试 |
| AU19 | 告警含操作详情+资源+时间+操作人 | API 测试 |
| AU20 | 告警渠道支持：邮件/钉钉/企微 | 集成测试 |

### 2.5 审计导出与归档

| # | 标准 | 验证方式 |
|---|------|----------|
| AU21 | 支持 CSV 导出（含筛选条件） | API 测试 |
| AU22 | 支持 PDF 报告导出（含统计摘要） | API 测试 |
| AU23 | 超过 90 天的审计日志自动归档到冷存储 | 单元测试 |
| AU24 | 归档日志仍可查询（冷查询模式） | API 测试 |

### 2.6 审计统计与报告

| # | 标准 | 验证方式 |
|---|------|----------|
| AU25 | 操作频次统计（按天/周/月） | API 测试 |
| AU26 | 用户行为分析：活跃用户、高频操作 | API 测试 |
| AU27 | 资源访问统计：哪些资源被频繁访问 | API 测试 |
| AU28 | 合规报告自动生成（SOC2/ISO27001 模板） | API 测试 |
| AU29 | 报告含审计日志摘要+异常操作汇总 | 前端验证 |
| AU30 | 报告支持定时生成（周报/月报） | 集成测试 |

## 三、API 设计

```
Base: /api/v1/audit
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/logs` | 写入审计日志（内部调用） |
| GET | `/logs` | 审计日志列表（筛选/分页） |
| GET | `/logs/:id` | 审计日志详情 |
| GET | `/logs/:id/verify` | 验证哈希链 |
| POST | `/logs/search` | 高级搜索 |
| GET | `/statistics` | 审计统计 |
| GET | `/statistics/users` | 用户行为统计 |
| GET | `/statistics/resources` | 资源访问统计 |
| GET | `/rules` | 审计规则列表 |
| POST | `/rules` | 创建审计规则 |
| PUT | `/rules/:id` | 更新审计规则 |
| GET | `/alerts` | 审计告警列表 |
| POST | `/export/csv` | 导出 CSV |
| POST | `/export/pdf` | 导出 PDF |
| GET | `/reports/compliance` | 合规报告 |
| POST | `/reports/schedule` | 定时报告 |

## 四、数据模型

```sql
-- 审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  operator_id     UUID REFERENCES users(id),
  operation       VARCHAR(50) NOT NULL,
  resource_type   VARCHAR(50) NOT NULL,
  resource_id     UUID,
  before_value    JSONB,
  after_value     JSONB,
  description     TEXT,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  trace_id        VARCHAR(64),
  level           VARCHAR(20) DEFAULT 'info',
  hash            VARCHAR(64) NOT NULL,
  prev_hash       VARCHAR(64),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_operator ON audit_logs(operator_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_level ON audit_logs(level);

-- 审计规则
CREATE TABLE IF NOT EXISTS audit_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  operation       VARCHAR(50),
  resource_type   VARCHAR(50),
  level           VARCHAR(20) DEFAULT 'info',
  alert_enabled   BOOLEAN DEFAULT false,
  alert_threshold INT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 审计告警
CREATE TABLE IF NOT EXISTS audit_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  rule_id         UUID REFERENCES audit_rules(id),
  level           VARCHAR(20) NOT NULL,
  description     TEXT NOT NULL,
  triggered_at    TIMESTAMPTZ DEFAULT now(),
  acknowledged    BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ
);
```

## 五、前端设计

**路由**: `/audit`

主要页面：
- 审计日志页：列表、筛选、详情
- 哈希链验证页：输入日志ID验证链完整性
- 审计规则页：创建/编辑审计规则
- 告警页：审计告警列表、确认
- 统计页：操作频次、用户行为图表
- 合规报告页：SOC2/ISO27001 报告生成

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 22 | AuditService、HashChain、RuleEngine |
| 集成测试 | 6 | 写日志→查询→验证链→告警→导出闭环 |
| 前端测试 | 4 | 日志列表、规则管理、统计图表 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
