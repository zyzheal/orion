# Spec: 自愈 (Self Healing)

> **日期**: 2026-07-03
> **状态**: 已验证
> **能力域**: 自愈引擎
> **目标成熟度**: L2 → L3
> **关键交付**: 故障检测、自愈流程、预案管理、SLA 保障、自愈报告

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- 自愈引擎基础框架（SelfHealingService）
- 自愈流程定义（SelfHealingSaga + healing 模型）
- 故障检测基础（结合 Prometheus 告警）
- 自愈操作记录持久化
- 前端自愈管理页面

**不足**：
- 多租户隔离缺失（降级模式无 tenant_id 过滤）
- 自愈流程仅支持顺序执行，无并行/条件分支
- 无自愈预案管理（预案硬编码）
- 无自愈效果验证机制
- 无 SLA 保障（超时/回退策略缺失）
- 知识库未集成到自愈决策流程

### 1.2 Phase 1 目标 (L3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 自愈流程引擎 | 支持并行/条件/循环执行、超时控制 | L3 |
| 预案管理 | 可配置自愈预案、版本管理、灰度验证 | L3 |
| 故障检测 | 多信号源融合、根因推荐 | L3 |
| 效果验证 | 自愈后自动验证、失败自动回退 | L3 |
| SLA 保障 | 超时策略、自动升级、人工介入 | L3 |

## 二、验收标准

### 2.1 自愈流程引擎

| # | 标准 | 验证方式 |
|---|------|----------|
| SH1 | 自愈流程支持顺序执行、并行执行、条件分支三种编排模式 | 集成测试 |
| SH2 | 每个自愈步骤可配置超时时间（默认 300 秒） | 单元测试 |
| SH3 | 超时未完成的步骤标记为失败，执行降级策略 | 集成测试 |
| SH4 | 自愈流程执行状态实时可查（pending/running/success/failed） | 前端验证 |
| SH5 | 自愈流程支持手动终止（cancel） | API 测试 |
| SH6 | 多租户隔离：每个租户的自愈会话独立，互不干扰 | 集成测试 |

### 2.2 预案管理

| # | 标准 | 验证方式 |
|---|------|----------|
| SH7 | 持创建/编辑/删除自愈预案 | API 测试 |
| SH8 | 预案含触发条件（告警规则）、执行步骤、回退策略 | API 测试 |
| SH9 | 预案支持版本管理，更新不影响正在执行的流程 | API 测试 |
| SH10 | 预案可按故障类型分类（Pod 故障/节点故障/网络故障/存储故障） | 前端验证 |
| SH11 | 预置 5+ 基线预案（Pod 重启、节点迁移、存储扩容、网络恢复、配置回滚） | 单元测试 |

### 2.3 故障检测

| # | 标准 | 验证方式 |
|---|------|----------|
| SH12 | 故障检测支持 Prometheus 告警和健康检查两种信号源 | 集成测试 |
| SH13 | 同一故障类型可配置多条告警规则（AND/OR 逻辑） | API 测试 |
| SH14 | 故障检测延迟 < 30 秒（从告警到触发自愈） | 性能测试 |
| SH15 | 故障发生时自动匹配最合适的自愈预案 | 集成测试 |

### 2.4 效果验证

| # | 标准 | 验证方式 |
|---|------|----------|
| SH16 | 自愈执行后自动验证：检查故障信号是否已恢复 | 集成测试 |
| SH17 | 验证失败后自动执行回退步骤（undo 操作） | 集成测试 |
| SH18 | 回退也失败时自动升级到人工处理（创建工单 + 通知 OnCall） | 集成测试 |
| SH19 | 自愈效果报告含执行步骤、耗时、验证结果 | 前端验证 |

### 2.5 SLA 保障

| # | 标准 | 验证方式 |
|---|------|----------|
| SH20 | 自愈总耗时超过 SLA 阈值（默认 10 分钟）时自动升级 | 集成测试 |
| SH21 | 升级后自动通知 OnCall 责任人（电话/短信/钉钉） | 集成测试 |
| SH22 | 自愈操作记录含完整审计日志（操作人/时间/结果/影响范围） | 单元测试 |
| SH23 | 月度自愈 SLA 报告（总故障数、自愈成功数、平均修复时长 MTTR） | 前端验证 |

## 三、API 设计

```
Base: /api/v1/self-healing
```

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/plans` | 自愈预案列表 |
| POST | `/plans` | 创建预案 |
| PUT | `/plans/:id` | 更新预案 |
| DELETE | `/plans/:id` | 删除预案 |
| GET | `/plans/:id/versions` | 预案版本历史 |
| POST | `/executions` | 手动触发自愈执行 |
| GET | `/executions` | 自愈执行历史 |
| GET | `/executions/:id` | 执行详情 |
| POST | `/executions/:id/cancel` | 终止执行 |
| GET | `/executions/:id/verification` | 效果验证结果 |
| GET | `/dashboard` | 自愈仪表盘 |
| GET | `/sla-report` | SLA 报告 |

## 四、数据模型

```sql
-- 自愈预案
CREATE TABLE IF NOT EXISTS self_healing_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  fault_type      VARCHAR(50) NOT NULL,
  trigger_rules   JSONB NOT NULL,
  steps           JSONB NOT NULL,
  rollback_steps  JSONB DEFAULT '[]',
  version         INT DEFAULT 1,
  enabled         BOOLEAN DEFAULT true,
  sla_timeout_sec INT DEFAULT 600,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 自愈执行记录
CREATE TABLE IF NOT EXISTS self_healing_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  plan_id         UUID REFERENCES self_healing_plans(id),
  trigger_type    VARCHAR(20),
  fault_source    JSONB,
  status          VARCHAR(20) DEFAULT 'pending',
  current_step    INT DEFAULT 0,
  total_steps     INT DEFAULT 0,
  verification    JSONB,
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  sla_breached    BOOLEAN DEFAULT false
);
```

## 五、前端设计

**路由**: `/self-healing`

主要页面：
- 自愈仪表盘：总览自愈成功率、MTTR、活跃故障
- 预案管理页：创建/编辑/版本管理自愈预案
- 执行历史页：自愈执行记录、详情、效果验证
- SLA 报告页：月度/季度自愈 SLA 报告

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | SelfHealingEngine、PlanManager、VerificationService |
| 集成测试 | 6 | 故障检测→预案匹配→执行→验证→回退闭环 |
| 性能测试 | 3 | 故障检测延迟、预案匹配性能、并发执行 |

---

_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 已验证_
