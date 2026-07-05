# Spec: 安全合规 (Security Compliance)

> **日期**: 2026-07-03
> **状态**: 已验证
> **能力域**: 安全合规
> **目标成熟度**: L2 → L3
> **关键交付**: 合规框架、评估引擎、差距追踪、持续监控、审计证据

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前安全能力：
- 安全扫描服务（SecurityScannerService）
- OPA 策略引擎
- AI 安全加固路由
- RBAC 权限控制
- 审计日志服务
- API Key 管理

**不足**：
- 无合规框架自动化检查（SOC2、ISO27001、GDPR）
- 无合规报告自动生成
- 无合规差距追踪与修复工作流
- 无持续合规监控
- 无审计证据自动采集

### 1.2 Phase 1 目标 (L3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 合规框架 | 内置 3+ 合规标准，自动检查 | L3 |
| 评估引擎 | 定期自动化合规评估 | L3 |
| 差距追踪 | 发现→分配→修复→验证闭环 | L3 |
| 报告生成 | 自动生成合规报告（PDF/JSON） | L3 |
| 持续监控 | 实时合规状态仪表盘 | L3 |

## 二、验收标准

### 2.1 合规框架

| # | 标准 | 验证方式 |
|---|------|----------|
| SC1 | 内置 3+ 合规标准：SOC2、ISO27001、GDPR | API 测试 |
| SC2 | 每个标准含 15+ 自动检查项，覆盖身份/访问/加密/日志/备份维度 | 单元测试 |
| SC3 | 检查项支持 API 自动检测和人工确认两种模式 | API 测试 |
| SC4 | 合规框架可扩展：用户可自定义检查项 | API 测试 |
| SC5 | 框架版本理：标准更新时自动同步检查项 | API 测试 |

### 2.2 评估引擎

| # | 标准 | 验证方式 |
|---|------|----------|
| SC6 | 支持按需执行单框架评估 | API 测试 |
| SC7 | 支持全局评估（所有框架） | API 测试 |
| SC8 | 评估结果含通过/失败/跳过计数和总分（0-100） | API 测试 |
| SC9 | 评估失败项自动归类为合规差距 | 集成测试 |
| SC10 | 评估历史可追溯：每次评估结果持久化，支持对比 | 前端验证 |

### 2.3 差距追踪

| # | 标准 | 验证方式 |
|---|------|----------|
| SC11 | 差距项含严重级别（critical/high/medium/low） | 单元测试 |
| SC12 | 差距可分配负责人和截止日期 | API 测试 |
| SC13 | 支持差距修复工作流：open → assigned → in_progress → resolved → verified | 集成测试 |
| SC14 | 修复完成后自动触发重新验证 | 集成测试 |
| SC15 | 差距仪表盘显示按状态/严重级别/负责人的分布 | 前端验证 |

### 2.4 报告生成

| # | 标准 | 验证方式 |
|---|------|----------|
| SC16 | 合规报告支持 PDF 和 JSON 两种输出格式 | API 测试 |
| SC17 | 报告含：总体评分、框架详情、差距列表、趋势图表 | 前端验证 |
| SC18 | 报告支持按租户/项目/时间范围筛选 | API 测试 |
| SC19 | 报告可定时自动生成并发送给合规负责人 | 集成测试 |

### 2.5 持续监控

| # | 标准 | 验证方式 |
|---|------|----------|
| SC20 | 每 24 小时自动执行全量合规检查 | 集成测试 |
| SC21 | 关键不合规项（critical/high）即时告警通知 | 集成测试 |
| SC22 | 合规状态仪表盘实时显示最新评分和趋势 | 前端验证 |
| SC23 | 审计证据自动采集：配置快照、策略执行记录、审计日志 | API 测试 |

## 三、API 设计

```
Base: /api/v1/compliance
```

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/frameworks` | 合规框架列表 |
| GET | `/frameworks/:id/checks` | 框架检查项 |
| POST | `/assessments/run` | 执行合规评估 |
| GET | `/assessments/:id` | 评估结果 |
| GET | `/assessments/:id/report` | 生成合规报告 |
| GET | `/gaps` | 差距列表 |
| POST | `/gaps/:id/remediate` | 创建修复任务 |
| PUT | `/gaps/:id/status` | 更新差距状态 |
| GET | `/evidence` | 审计证据列表 |
| POST | `/evidence/collect` | 采集审计证据 |
| GET | `/dashboard` | 合规仪表盘数据 |
| GET | `/monitoring` | 持续监控状态 |

## 四、数据模型

```sql
-- 合规框架
CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(50) NOT NULL UNIQUE,
  display_name    VARCHAR(200),
  description     TEXT,
  version         VARCHAR(20),
  check_count     INT DEFAULT 0,
  overall_score   INT DEFAULT 0,
  last_assessed_at TIMESTAMPTZ
);

-- 合规检查项
CREATE TABLE IF NOT EXISTS compliance_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id    UUID REFERENCES compliance_frameworks(id),
  control_id      VARCHAR(50) NOT NULL,
  title           VARCHAR(300),
  description     TEXT,
  category        VARCHAR(50),
  severity        VARCHAR(20),
  auto_checkable  BOOLEAN DEFAULT false,
  check_method    VARCHAR(20),
  check_config    JSONB DEFAULT '{}'
);

-- 合规差距
CREATE TABLE IF NOT EXISTS compliance_gaps (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES tenants(id),
  assessment_id       UUID REFERENCES compliance_assessments(id),
  check_id            UUID REFERENCES compliance_checks(id),
  title               VARCHAR(300),
  severity            VARCHAR(20),
  status              VARCHAR(20) DEFAULT 'open',
  assignee            UUID REFERENCES users(id),
  due_date            DATE,
  created_at          TIMESTAMPTZ DEFAULT now(),
  resolved_at         TIMESTAMPTZ
);

-- 审计证据
CREATE TABLE IF NOT EXISTS compliance_evidence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id          UUID REFERENCES compliance_gaps(id),
  evidence_type   VARCHAR(20),
  source          VARCHAR(200),
  content         TEXT,
  collected_at    TIMESTAMPTZ DEFAULT now()
);
```

## 五、前端设计

**路由**: `/compliance`

主要页面：
- 合规仪表盘：总体评分、框架状态、差距统计
- 框架详情页：每个标准的检查项列表和结果
- 差距管理页：差距列表、分配、修复跟踪
- 报告生成页：合规报告预览和导出
- 监控页：持续合规状态实时视图

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 25 | ComplianceChecker、GapTracker、EvidenceCollector、ReportGenerator |
| 集成测试 | 6 | 评估→差距→修复→验证闭环、持续监控、报告生成 |
| 前端测试 | 4 | 仪表盘、差距管理、报告预览 |

---

_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 已验证_
