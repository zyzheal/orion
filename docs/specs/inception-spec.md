# Spec: 项目启动 (Inception)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 项目管理
> **目标成熟度**: L1 → L2
> **关键交付**: 项目初始化、需求收集、可行性分析、立项审批

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现（Go 微服务 `orion-inception-svc-go`）：
- 项目启动 CRUD（InceptionService + Repository）
- 项目基础信息（name/description/priority/status）
- 需求收集（requirements JSONB）
- 可行性分析（feasibility JSONB）
- 审计历史（SQLAuditHistory）
- 多租户隔离
- OpenTelemetry 追踪

**不足**：
- 无立项审批流程
- 无可行性评分自动化
- 无项目模板
- 无项目关联（CMDB/工单/交付）
- 无项目阶段管理
- 无决策记录
- 无项目评审

### 1.2 Phase 1 目标 (L2)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 立项审批 | 项目启动需审批通过 | L2 |
| 可行性评分 | 自动计算可行性分数 | L2 |
| 项目模板 | 预置项目模板（快速启动） | L2 |
| 项目关联 | 关联 CMDB CI/工单/交付计划 | L2 |
| 阶段管理 | 项目阶段定义+状态追踪 | L2 |
| 决策记录 | 关键决策记录+追溯 | L2 |

## 二、验收标准

### 2.1 项目启动

| # | 标准 | 验证方式 |
|---|------|----------|
| IN1 | 支持创建项目启动（name/description/priority/scope） | API 测试 |
| IN2 | 项目优先级：P0/P1/P2/P3 | API 测试 |
| IN3 | 项目状态：draft/submitted/approved/rejected/active/archived | API 测试 |
| IN4 | 项目含需求收集（requirements JSONB） | API 测试 |
| IN5 | 项目含可行性分析（feasibility JSONB） | API 测试 |
| IN6 | 多租户隔离 | 集成测试 |
| IN7 | 项目创建者自动记录 | API 测试 |

### 2.2 立项审批

| # | 标准 | 验证方式 |
|---|------|----------|
| IN8 | 项目启动需提交审批（submit） | API 测试 |
| IN9 | 审批通过后状态变为 approved | API 测试 |
| IN10 | 审批拒绝需填写原因 | API 测试 |
| IN11 | 审批后不可修改核心字段 | API 测试 |
| IN12 | 审批流程记录审计日志 | 单元测试 |

### 2.3 可行性评分

| # | 标准 | 验证方式 |
|---|------|----------|
| IN13 | 自动计算可行性分数（0-100） | API 测试 |
| IN14 | 评分维度：技术可行性/商业价值/资源评估/风险评估 | API 测试 |
| IN15 | 评分低于 60 分标记为高风险 | API 测试 |
| IN16 | 评分历史记录（每次修改重新计算） | API 测试 |
| IN17 | 可行性报告导出 | API 测试 |

### 2.4 项目模板

| # | 标准 | 验证方式 |
|---|------|----------|
| IN18 | 预置 5+ 项目模板（SaaS平台/移动应用/基础设施/数据平台/AI应用） | 前端验证 |
| IN19 | 从模板创建项目自动填充字段 | API 测试 |
| IN20 | 模板含默认需求清单+可行性模板 | API 测试 |
| IN21 | 模板支持自定义创建 | API 测试 |

### 2.5 项目关联

| # | 标准 | 验证方式 |
|---|------|----------|
| IN22 | 项目可关联 CMDB CI（相关基础设施） | API 测试 |
| IN23 | 项目可关联工单（相关变更/问题） | API 测试 |
| IN24 | 项目可关联交付计划 | API 测试 |
| IN25 | 关联关系可查看/删除 | API 测试 |

### 2.6 决策记录与阶段

| # | 标准 | 验证方式 |
|---|------|----------|
| IN26 | 项目分阶段：initiation/planning/execution/closure | API 测试 |
| IN27 | 阶段状态可更新 | API 测试 |
| IN28 | 关键决策记录（decision + rationale + decider） | API 测试 |
| IN29 | 决策历史可追溯 | API 测试 |
| IN30 | 项目评审记录（日期/参与者/结论） | API 测试 |

## 三、API 设计

```
Base: /api/v1/inception
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/projects` | 创建项目 |
| GET | `/projects` | 项目列表 |
| GET | `/projects/:id` | 项目详情 |
| PUT | `/projects/:id` | 更新项目 |
| POST | `/projects/:id/submit` | 提交审批 |
| POST | `/projects/:id/approve` | 审批通过 |
| POST | `/projects/:id/reject` | 审批拒绝 |
| GET | `/projects/:id/score` | 可行性评分 |
| GET | `/projects/:id/relations` | 关联资源 |
| POST | `/projects/:id/relations` | 添加关联 |
| DELETE | `/projects/:id/relations/:rid` | 删除关联 |
| POST | `/projects/:id/decisions` | 创建决策记录 |
| GET | `/projects/:id/decisions` | 决策历史 |
| GET | `/projects/:id/audit` | 审计历史 |
| GET | `/templates` | 模板列表 |
| POST | `/templates/:id/use` | 从模板创建 |

## 四、数据模型

```sql
-- 项目启动
CREATE TABLE IF NOT EXISTS inception_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  priority        VARCHAR(10) DEFAULT 'P2',
  status          VARCHAR(20) DEFAULT 'draft',
  requirements    JSONB DEFAULT '[]',
  feasibility     JSONB DEFAULT '{}',
  feasibility_score DECIMAL(5,2),
  submitted_at    TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  approved_by     UUID REFERENCES users(id),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 项目阶段
CREATE TABLE IF NOT EXISTS inception_phases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES inception_projects(id) ON DELETE CASCADE,
  phase           VARCHAR(50) NOT NULL,
  status          VARCHAR(20) DEFAULT 'not_started',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  UNIQUE(project_id, phase)
);

-- 项目关联
CREATE TABLE IF NOT EXISTS inception_relations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES inception_projects(id) ON DELETE CASCADE,
  relation_type   VARCHAR(50) NOT NULL,
  target_id       UUID NOT NULL,
  target_type     VARCHAR(50) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 决策记录
CREATE TABLE IF NOT EXISTS inception_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES inception_projects(id) ON DELETE CASCADE,
  decision        TEXT NOT NULL,
  rationale       TEXT,
  decider_id      UUID REFERENCES users(id),
  decided_at      TIMESTAMPTZ DEFAULT now()
);

-- 审计历史
CREATE TABLE IF NOT EXISTS inception_audit_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES inception_projects(id) ON DELETE CASCADE,
  changed_by      UUID REFERENCES users(id),
  change_type     VARCHAR(50) NOT NULL,
  old_value       JSONB,
  new_value       JSONB,
  changed_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inception_projects_tenant ON inception_projects(tenant_id, status);
CREATE INDEX idx_inception_relations_project ON inception_relations(project_id);
```

## 五、前端设计

**路由**: `/inception`

主要页面：
- 项目列表页：草稿/审批中/进行中
- 项目详情页：基本信息/可行性/关联
- 项目创建页：表单（含模板选择）
- 审批页：审批操作
- 可行性分析页：评分详情
- 决策记录页：决策历史

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 18 | InceptionService、ScoreCalculator、TemplateService |
| 集成测试 | 5 | 创建→提交→审批→关联→决策闭环 |
| 前端测试 | 3 | 项目列表、详情、审批 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
