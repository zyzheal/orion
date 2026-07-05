# Spec: 审批 (Approval)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 审批工作流
> **目标成熟度**: L1.5 → L2.5
> **关键交付**: 多级审批、会签/或签、委托、撤回、审批统计

## 一、功能描述

### 1.1 现状评估 (L1.5)

Orion 当前已实现（Go 微服务 `orion-approval-svc-go`）：
- 审批 CRUD（ApprovalService + ApprovalRepository）
- 多级审批（SubmitApproval 支持 levels）
- 顺序/并行审批模式（ModeSerial / ModeParallel）
- 审批步骤状态追踪（pending/approved/rejected）
- 通知集成（approval notification）
- 审计日志

**不足**：
- 无审批撤回/取消功能
- 无委托功能（approver 委托他人）
- 无审批统计报表
- 无审批超时自动处理
- 无审批模板
- 无批量审批
- 无审批流程图可视化
- 多租户隔离待完善

### 1.2 Phase 1 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 审批撤回/取消 | 撤回待审批、取消进行中审批 | L2 |
| 委托功能 | Approver 委托他人审批 | L2 |
| 审批统计 | 审批量、通过率、平均耗时 | L2 |
| 超时处理 | 审批超时自动拒绝/升级 | L2 |
| 审批模板 | 预置审批模板、自定义模板 | L2 |
| 批量审批 | 批量通过/拒绝 | L2 |
| 审批流程图 | 可视化审批进度 | L2 |

## 二、验收标准

### 2.1 审批基础流程

| # | 标准 | 验证方式 |
|---|------|----------|
| AP1 | 支持创建简单审批（单级） | API 测试 |
| AP2 | 支持创建多级审批（multi-level），每级可配置所需通过数 | API 测试 |
| AP3 | 支持顺序审批（逐级通过）和并行审批（同级同时审批） | API 测试 |
| AP4 | 审批状态流转：pending → approved/rejected/cancelled | API 测试 |
| AP5 | 审批通过需达到 RequiredApprovals 数量，否则继续 | API 测试 |
| AP6 | 多租户隔离：每个租户的审批独立 | 集成测试 |

### 2.2 审批操作

| # | 标准 | 验证方式 |
|---|------|----------|
| AP7 | 审批人可通过 Approve 接口审批通过 | API 测试 |
| AP8 | 审批人可通过 Reject 接口拒绝，需填写原因 | API 测试 |
| AP9 | 创建者可撤回待审批（撤回后状态为 cancelled） | API 测试 |
| AP10 | 撤回后不可再审批 | API 测试 |
| AP11 | 审批人可委托给其他审批人（需被委托人接受） | API 测试 |
| AP12 | 委托关系自动解除（委托人或被委托人操作后） | API 测试 |

### 2.3 超时与自动化

| # | 标准 | 验证方式 |
|---|------|----------|
| AP13 | 每个审批步骤可配置超时时间（默认 24h） | API 测试 |
| AP14 | 超时未审批自动拒绝（auto-reject），记录原因 | 集成测试 |
| AP15 | 超时可配置升级策略（通知上级/创建工单） | API 测试 |
| AP16 | 超时事件记录审计日志 | 单元测试 |

### 2.4 审批模板

| # | 标准 | 验证方式 |
|---|------|----------|
| AP17 | 支持创建审批模板（预设审批人/级别/超时） | API 测试 |
| AP18 | 从模板创建审批时自动填充配置 | API 测试 |
| AP19 | 预置 5+ 模板（部署审批/代码合并/配置变更/工单关闭/权限申请） | 前端验证 |
| AP20 | 模板支持版本管理 | API 测试 |

### 2.5 批量审批

| # | 标准 | 验证方式 |
|---|------|----------|
| AP21 | 支持批量通过多个待审批 | API 测试 |
| AP22 | 支持批量拒绝多个待审批 | API 测试 |
| AP23 | 批量操作需二次确认 | 前端验证 |
| AP24 | 批量操作结果返回成功/失败列表 | API 测试 |

### 2.6 统计与报表

| # | 标准 | 验证方式 |
|---|------|----------|
| AP25 | 审批统计：总审批数、通过数、拒绝数、待处理数 | API 测试 |
| AP26 | 平均审批耗时（创建 → 最终结果） | API 测试 |
| AP27 | 按审批人维度统计：处理量、平均响应时间 | API 测试 |
| AP28 | 按时间范围筛选统计 | API 测试 |
| AP29 | 审批通过率趋势图（日/周/月） | 前端验证 |
| AP30 | 超时审批自动标记并计入统计 | 集成测试 |

## 三、API 设计

```
Base: /api/v1/approval
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/` | 创建审批 |
| GET | `/` | 审批列表（含筛选） |
| GET | `/:id` | 审批详情 |
| PUT | `/:id/cancel` | 撤回/取消审批 |
| POST | `/:id/steps/:stepId/approve` | 审批通过 |
| POST | `/:id/steps/:stepId/reject` | 审批拒绝 |
| POST | `/:id/delegate` | 委托审批 |
| POST | `/batch/approve` | 批量通过 |
| POST | `/batch/reject` | 批量拒绝 |
| GET | `/statistics` | 审批统计 |
| GET | `/statistics/approver/:approverId` | 按审批人统计 |
| GET | `/templates` | 模板列表 |
| POST | `/templates` | 创建模板 |
| PUT | `/templates/:id` | 更新模板 |
| POST | `/templates/:id/use` | 从模板创建审批 |

## 四、数据模型

```sql
-- 审批主表
CREATE TABLE IF NOT EXISTS approvals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  resource_type    VARCHAR(50) NOT NULL,
  resource_id      UUID NOT NULL,
  title            VARCHAR(200),
  status           VARCHAR(20) DEFAULT 'pending',
  mode             VARCHAR(20) DEFAULT 'serial',
  total_steps      INT DEFAULT 1,
  required_approvals INT DEFAULT 1,
  current_step     INT DEFAULT 0,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  timeout_sec      INT DEFAULT 86400
);

-- 审批步骤
CREATE TABLE IF NOT EXISTS approval_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id     UUID NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  step_index      INT NOT NULL,
  level           INT NOT NULL,
  approver_ids    UUID[] NOT NULL,
  required_approvals INT DEFAULT 1,
  status          VARCHAR(20) DEFAULT 'pending',
  acted_by        UUID REFERENCES users(id),
  acted_at        TIMESTAMPTZ,
  reason          TEXT,
  delegated_from  UUID REFERENCES users(id),
  timeout_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(approval_id, step_index)
);

-- 审批模板
CREATE TABLE IF NOT EXISTS approval_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  resource_type   VARCHAR(50),
  levels          JSONB NOT NULL,
  timeout_sec     INT DEFAULT 86400,
  mode            VARCHAR(20) DEFAULT 'serial',
  version         INT DEFAULT 1,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_approvals_tenant ON approvals(tenant_id, created_at DESC);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approval_steps_approval ON approval_steps(approval_id);
```

## 五、前端设计

**路由**: `/approval`

主要页面：
- 审批列表页：待处理/已处理/全部，支持筛选
- 审批详情页：审批步骤进度、操作按钮
- 审批操作弹窗：审批通过/拒绝（含原因输入）
- 委托弹窗：选择被委托人
- 统计页：审批量、通过率、平均耗时图表
- 模板管理页：创建/编辑/使用模板

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | ApprovalService、StepManager、TemplateService |
| 集成测试 | 6 | 创建→多级审批→完成/拒绝/撤回/委托闭环 |
| 前端测试 | 4 | 审批列表、详情、操作、统计 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
