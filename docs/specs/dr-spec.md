# Spec: 灾备 (Disaster Recovery)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 灾备恢复
> **目标成熟度**: L1 → L2
> **关键交付**: 灾备计划、备份策略、恢复演练、RTO/RPO 追踪

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现（Go 微服务 `orion-dr-svc-go`）：
- 灾备计划 CRUD（DRService + DRRepository）
- 灾备计划基础字段（name/description/rto/rpo）
- 备份策略关联
- 多租户隔离
- OpenTelemetry 追踪

**不足**：
- 无灾备演练管理
- 无恢复流程定义
- 无 RTO/RPO 实际追踪
- 无灾备状态监控
- 无灾备报告
- 无备份验证
- 无灾备演练评分

### 1.2 Phase 1 目标 (L2)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 灾备演练 | 演练计划、执行、评分 | L2 |
| 恢复流程 | 恢复步骤定义、执行追踪 | L2 |
| RTO/RPO 追踪 | 实际恢复时间/数据丢失量记录 | L2 |
| 备份验证 | 备份完整性检查、恢复验证 | L2 |
| 灾备报告 | 演练报告、合规报告 | L2 |

## 二、验收标准

### 2.1 灾备计划

| # | 标准 | 验证方式 |
|---|------|----------|
| DR1 | 支持创建灾备计划（name/description/rto/rpo/scope） | API 测试 |
| DR2 | 灾备计划关联应用/环境/数据源 | API 测试 |
| DR3 | 支持备份策略配置（频率/保留期/存储位置） | API 测试 |
| DR4 | 灾备计划可启用/禁用 | API 测试 |
| DR5 | 多租户隔离 | 集成测试 |
| DR6 | 灾备计划含联系人（负责人/执行人） | API 测试 |

### 2.2 灾备演练

| # | 标准 | 验证方式 |
|---|------|----------|
| DR7 | 支持创建演练（关联灾备计划/类型/时间） | API 测试 |
| DR8 | 演练类型：桌面演练/部分恢复/全量恢复 | API 测试 |
| DR9 | 演练可执行步骤追踪（开始/每个步骤/完成） | API 测试 |
| DR10 | 演练评分：RTO 达标/RPO 达标/成功率 | API 测试 |
| DR11 | 演练失败自动记录原因 | API 测试 |
| DR12 | 演练历史可查询 | API 测试 |

### 2.3 RTO/RPO 追踪

| # | 标准 | 验证方式 |
|---|------|----------|
| DR13 | 实际 RTO = 故障发现时间 + 恢复完成时间 | API 测试 |
| DR14 | 实际 RPO = 最后备份时间 + 恢复验证时间 | API 测试 |
| DR15 | RTO/RPO 与目标对比（达标/未达标） | API 测试 |
| DR16 | 演练历史含 RTO/RPO 实际值 | API 测试 |
| DR17 | RTO/RPO 趋势图（按演练） | 前端验证 |

### 2.4 备份验证

| # | 标准 | 验证方式 |
|---|------|----------|
| DR18 | 定期自动验证备份完整性 | 集成测试 |
| DR19 | 备份恢复验证（测试恢复流程） | 集成测试 |
| DR20 | 备份验证结果记录（通过/失败/原因） | API 测试 |
| DR21 | 备份验证失败告警 | 集成测试 |

### 2.5 灾备报告

| # | 标准 | 验证方式 |
|---|------|----------|
| DR22 | 演练报告：步骤记录/评分/改进建议 | API 测试 |
| DR23 | 月度灾备报告（演练次数/RTO达标率/备份状态） | API 测试 |
| DR24 | 合规报告（SOC2/ISO22301） | API 测试 |
| DR25 | 报告支持导出 PDF | API 测试 |

### 2.6 灾备监控

| # | 标准 | 验证方式 |
|---|------|----------|
| DR26 | 灾备计划状态实时追踪（就绪/演练中/恢复中） | API 测试 |
| DR27 | 备份任务状态追踪 | API 测试 |
| DR28 | 备份成功率统计 | API 测试 |
| DR29 | 灾备仪表盘（计划数/演练次数/达标率） | 前端验证 |
| DR30 | 灾备告警：演练超期/备份失败 | 集成测试 |

## 三、API 设计

```
Base: /api/v1/dr
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/plans` | 创建灾备计划 |
| GET | `/plans` | 灾备计划列表 |
| GET | `/plans/:id` | 计划详情 |
| PUT | `/plans/:id` | 更新计划 |
| DELETE | `/plans/:id` | 删除计划 |
| POST | `/plans/:id/drills` | 创建演练 |
| POST | `/drills/:id/start` | 开始演练 |
| POST | `/drills/:id/steps/:stepId/complete` | 完成演练步骤 |
| POST | `/drills/:id/complete` | 完成演练 |
| GET | `/drills` | 演练列表 |
| GET | `/drills/:id` | 演练详情 |
| POST | `/plans/:id/verify-backup` | 验证备份 |
| GET | `/reports/monthly` | 月度报告 |
| GET | `/reports/compliance` | 合规报告 |
| GET | `/statistics` | 统计 |
| GET | `/dashboard` | 仪表盘 |

## 四、数据模型

```sql
-- 灾备计划
CREATE TABLE IF NOT EXISTS dr_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  scope           JSONB DEFAULT '{}',
  backup_strategy JSONB DEFAULT '{}',
  rto_target_sec  INT NOT NULL,
  rpo_target_sec  INT NOT NULL,
  status          VARCHAR(20) DEFAULT 'active',
  contact_ids     UUID[] DEFAULT '{}',
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 灾备演练
CREATE TABLE IF NOT EXISTS dr_drills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES dr_plans(id),
  drill_type      VARCHAR(20) NOT NULL,
  status          VARCHAR(20) DEFAULT 'planned',
  actual_rto_sec  INT,
  actual_rpo_sec  INT,
  rto_met         BOOLEAN,
  rpo_met         BOOLEAN,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  score           INT,
  findings        TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 演练步骤
CREATE TABLE IF NOT EXISTS drill_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id        UUID NOT NULL REFERENCES dr_drills(id) ON DELETE CASCADE,
  step_index      INT NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  estimated_min   INT,
  actual_sec      INT,
  status          VARCHAR(20) DEFAULT 'pending',
  notes           TEXT,
  completed_at    TIMESTAMPTZ,
  UNIQUE(drill_id, step_index)
);

-- 备份验证
CREATE TABLE IF NOT EXISTS backup_verifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES dr_plans(id),
  backup_id       UUID,
  status          VARCHAR(20) DEFAULT 'pending',
  verified_at     TIMESTAMPTZ,
  result          JSONB,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dr_plans_tenant ON dr_plans(tenant_id);
CREATE INDEX idx_dr_drills_plan ON dr_drills(plan_id, started_at DESC);
CREATE INDEX idx_dr_drills_status ON dr_drills(status);
```

## 五、前端设计

**路由**: `/disaster-recovery`

主要页面：
- 灾备计划页：计划列表、创建/编辑
- 计划详情页：备份策略、联系人、演练历史
- 演练管理页：创建演练、执行追踪
- 演练详情页：步骤进度、RTO/RPO 对比
- 统计页：达标率趋势图
- 报告页：月度报告、合规报告

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 18 | DRService、DrillService、RtoRpoService |
| 集成测试 | 5 | 创建计划→备份→演练→验证→报告 |
| 前端测试 | 3 | 计划列表、演练追踪、统计图表 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
