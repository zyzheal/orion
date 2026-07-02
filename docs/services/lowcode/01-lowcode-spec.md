# 低代码平台详细规格 (Phase 1)

> **日期**: 2026-07-02
> **状态**: 已验证
> **能力域**: 9. 低代码平台
> **目标成熟度**: L1.5 → L2.5
> **关键交付**: 流程设计器、工作流引擎、表单引擎、API 路由

## 一、功能描述

### 1.1 现状评估 (L1.5)

Orion 当前已实现：
- 工作流引擎基础（WorkflowService + Stage 编排）
- 工作流触发器（WorkflowTrigger、事件触发）
- 工作流任务管理（WorkflowTask、回调/超时/依赖）
- 表单模型基础（FormService + form 模型）
- 流程步骤定义（ProcessStepService）

**不足**：
- 前端流程设计器页面完全缺失（无可视化编排界面）
- lowcode-routes.ts API 路由未实现（无 LowCode API 端点）
- 无版本管理（工作流/表单无版本控制）
- 无导/导出功能（无法迁移工作流定义）
- 无模板市场（无预置工作流模板）
- 无运行时调试能力（无法单步执行工作流）

### 1.2 Phase 1 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 流程设计器 | 可视化拖拽编排、节点配置、保存/发布 | L2.5 |
| API 路由 | lowcode-routes.ts 完整 CRUD | L2.5 |
| 版本管理 | 工作流/表单版本控制、回退 | L2.5 |
| 导入导出 | 工作流定义 JSON 导入/导出 | L2.5 |

## 二、验收标准

### 2.1 流程设计器

| # | 标准 | 验证方式 |
|---|------|----------|
| D1 | 可视化拖拽编排（节点拖拽、连线、删除） | 前端验证 |
| D2 | 节点类型支持：开始/结束/审批/任务/条件/并行网关 | 前端验证 |
| D3 | 每个节点可配置属性（名称/处理人/超时/回调） | 前端验证 |
| D4 | 保存草稿 / 发布正式版本 | 前端 + API 测试 |
| D5 | 设计器空状态：无模板时显示引导 | 前端验证 |

### 2.2 API 路由

| # | 标准 | 验证方式 |
|---|------|----------|
| A1 | 工作流 CRUD 完整（创建/读取/更新/删除） | API 测试 |
| A2 | 表单定义 CRUD 完整 | API 测试 |
| A3 | 流程步骤 CRUD 完整 | API 测试 |
| A4 | 所有端点包含认证和权限检查 | API 测试 |

### 2.3 版本管理

| # | 标准 | 验证方式 |
|---|------|----------|
| V1 | 每次发布工作流自动创建新版本 | API 测试 |
| V2 | 支持回退到任意历史版本 | API 测试 |
| V3 | 运行中的实例不受版本回退影响 | 集成测试 |

### 2.4 导入导出

| # | 标准 | 验证方式 |
|---|------|----------|
| I1 | 工作流定义导出为 JSON 格式 | API 测试 |
| I2 | 从 JSON 导入工作流定义（含校验） | API 测试 |
| I3 | 导入时自动检测版本冲突 | 单元测试 |

## 三、API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/lowcode/workflows` | 工作流列表 |
| POST | `/api/v1/lowcode/workflows` | 创建工作流 |
| PUT | `/api/v1/lowcode/workflows/:id` | 更新工作流 |
| POST | `/api/v1/lowcode/workflows/:id/publish` | 发布工作流 |
| POST | `/api/v1/lowcode/workflows/:id/rollback` | 回退版本 |
| GET | `/api/v1/lowcode/workflows/:id/versions` | 版本历史 |
| POST | `/api/v1/lowcode/workflows/export` | 导出工作流 |
| POST | `/api/v1/lowcode/workflows/import` | 导入工作流 |

## 四、数据模型

```sql
CREATE TABLE lowcode_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,  -- 工作流定义（节点/连线/配置）
  version INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'draft',  -- draft, published, archived
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

_文档版本: v1.0 | 创建日期: 2026-07-02 | 状态: 已验证_