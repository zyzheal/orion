# Spec: 部署 (Deploy)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 部署发布
> **目标成熟度**: L2 → L3
> **关键交付**: 部署策略、灰度发布、回滚、部署历史、环境管理

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现（Go 微服务 `orion-deploy-svc-go`）：
- 部署 CRUD（DeployService + DeploymentRepository）
- 部署状态追踪（pending/running/success/failed）
- 部署策略（rolling/blue-green/canary）
- 回滚功能（Rollback + 历史版本）
- 部署事件日志（logEvent）
- OpenTelemetry 追踪
- 多租户隔离

**不足**：
- 无灰度发布精细化控制（按比例/条件）
- 无部署前检查（健康检查/兼容性）
- 无部署审批流程
- 无多环境部署编排
- 无部署指标（成功率/耗时/失败率）
- 无部署回滚自动触发
- 无部署可视化（拓扑/依赖）

### 1.2 Phase 1 目标 (L3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 灰度发布 | 按比例/条件/标签灰度 | L3 |
| 部署审批 | 部署前需审批通过 | L3 |
| 健康检查 | 部署后自动健康检查 | L3 |
| 自动回滚 | 健康检查失败自动回滚 | L3 |
| 部署指标 | 成功率/耗时/失败率统计 | L3 |
| 部署拓扑 | 应用依赖拓扑可视化 | L2.5 |

## 二、验收标准

### 2.1 部署基础流程

| # | 标准 | 验证方式 |
|---|------|----------|
| DP1 | 支持创建部署（应用/版本/环境/策略） | API 测试 |
| DP2 | 支持三种部署策略：rolling/blue-green/canary | API 测试 |
| DP3 | 部署状态流转：pending → running → success/failed | API 测试 |
| DP4 | 部署可取消（cancel） | API 测试 |
| DP5 | 多租户隔离：每个租户的部署独立 | 集成测试 |
| DP6 | 部署记录含操作人/时间/版本/策略 | API 测试 |

### 2.2 回滚

| # | 标准 | 验证方式 |
|---|------|----------|
| DP7 | 支持回滚到上一版本（Rollback） | API 测试 |
| DP8 | 回滚记录保留，可查询历史 | API 测试 |
| DP9 | 回滚不影响后续正常部署 | API 测试 |
| DP10 | 回滚自动记录审计日志 | 单元测试 |

### 2.3 灰度发布

| # | 标准 | 验证方式 |
|---|------|----------|
| DP11 | 支持按比例灰度（10%/25%/50%/100%） | API 测试 |
| DP12 | 支持按条件灰度（实例标签/版本号/区域） | API 测试 |
| DP13 | 灰度期间监控错误率，超过阈值自动暂停 | 集成测试 |
| DP14 | 灰度完成后自动全量发布 | 集成测试 |
| DP15 | 灰度状态可视化（已发布实例/错误率） | 前端验证 |

### 2.4 部署审批

| # | 标准 | 验证方式 |
|---|------|----------|
| DP16 | 生产环境部署需审批通过 | 集成测试 |
| DP17 | 审批通过后方可执行部署 | API 测试 |
| DP18 | 审批拒绝后部署状态转为 rejected | API 测试 |
| DP19 | 紧急部署可跳过审批（需特殊权限） | API 测试 |

### 2.5 健康检查与自动回滚

| # | 标准 | 验证方式 |
|---|------|----------|
| DP20 | 部署后自动执行健康检查（HTTP/health） | 集成测试 |
| DP21 | 健康检查失败自动回滚到上一版本 | 集成测试 |
| DP22 | 健康检查超时时间可配置（默认 60s） | API 测试 |
| DP23 | 健康检查重试次数可配置 | API 测试 |
| DP24 | 自动回滚记录审计日志 | 单元测试 |

### 2.6 部署指标与报告

| # | 标准 | 验证方式 |
|---|------|----------|
| DP25 | 部署成功率统计（按天/周/月） | API 测试 |
| DP26 | 平均部署耗时（创建 → success） | API 测试 |
| DP27 | 按环境统计部署量（dev/staging/prod） | API 测试 |
| DP28 | 失败部署原因分析 | API 测试 |
| DP29 | 部署趋势图（日/周/月） | 前端验证 |
| DP30 | 部署报告（周报/月报）自动生成 | 前端验证 |

## 三、API 设计

```
Base: /api/v1/deploy
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/deployments` | 创建部署 |
| GET | `/deployments` | 部署列表 |
| GET | `/deployments/:id` | 部署详情 |
| PUT | `/deployments/:id/cancel` | 取消部署 |
| POST | `/deployments/:id/rollback` | 回滚部署 |
| POST | `/deployments/:id/canary` | 发起灰度 |
| GET | `/deployments/:id/canary` | 灰度状态 |
| POST | `/deployments/:id/canary/promote` | 灰度全量 |
| POST | `/deployments/:id/approval` | 提交审批 |
| GET | `/deployments/:id/health` | 健康检查结果 |
| GET | `/environments` | 环境列表 |
| GET | `/statistics` | 部署统计 |
| GET | `/statistics/environments` | 按环境统计 |
| GET | `/reports/daily` | 日报 |
| GET | `/reports/weekly` | 周报 |

## 四、数据模型

```sql
-- 部署记录
CREATE TABLE IF NOT EXISTS deployments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  app_name        VARCHAR(200) NOT NULL,
  version         VARCHAR(100) NOT NULL,
  environment     VARCHAR(50) NOT NULL,
  strategy        VARCHAR(20) DEFAULT 'rolling',
  status          VARCHAR(20) DEFAULT 'pending',
  cluster         VARCHAR(100),
  replicas        INT DEFAULT 1,
  deployed_by     UUID REFERENCES users(id),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     INT,
  rollback_to     VARCHAR(100),
  health_status   VARCHAR(20),
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 灰度发布
CREATE TABLE IF NOT EXISTS deploy_canaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id   UUID NOT NULL REFERENCES deployments(id),
  strategy        JSONB NOT NULL,
  progress        INT DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'running',
  error_rate      DECIMAL(5,2) DEFAULT 0,
  auto_rollback   BOOLEAN DEFAULT true,
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- 部署审批
CREATE TABLE IF NOT EXISTS deploy_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id   UUID NOT NULL REFERENCES deployments(id),
  status          VARCHAR(20) DEFAULT 'pending',
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deployments_tenant ON deployments(tenant_id, created_at DESC);
CREATE INDEX idx_deployments_app ON deployments(app_name, environment);
CREATE INDEX idx_deploy_canaries_deployment ON deploy_canaries(deployment_id);
```

## 五、前端设计

**路由**: `/deploy`

主要页面：
- 部署列表页：按环境/应用筛选
- 部署详情页：状态/日志/操作按钮
- 灰度管理页：灰度进度/错误率
- 部署拓扑页：应用依赖图
- 统计页：成功率/耗时/失败率图表
- 环境管理页：环境配置

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | DeployService、CanaryService、HealthCheckService |
| 集成测试 | 6 | 创建→审批→部署→灰度→回滚闭环 |
| 前端测试 | 4 | 部署列表、详情、灰度、拓扑 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
