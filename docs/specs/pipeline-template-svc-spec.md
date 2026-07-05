# Spec: Pipeline 模板服务 (pipeline-template)

## 1. 模块概述

### 功能描述
Pipeline 模板服务提供流水线模板的 CRUD 管理、版本控制和模板参数定义。允许用户创建可复用的流水线模板，通过参数化实现模板的多场景复用。

### 架构
- **框架**：Gin HTTP
- **分层**：handler → service → repository → models
- **认证**：`RequirePermission("pipeline-template", action)`
- **多租户**：所有查询带 `tenant_id` 过滤
- **存储**：PostgreSQL

### 与 TypeScript 实现的差异
- TS 实现：`orion-platform-service/src/services/pipeline/` 中的 PipelineTemplate
- Go 实现：独立微服务，专注于模板 CRUD + 版本管理

## 2. API 端点

**Base 路径**：`/api/v1/pipeline-template`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /templates | 分页查询模板 | pipeline-template:read |
| POST | /templates | 创建模板 | pipeline-template:write |
| GET | /templates/:id | 获取模板详情 | pipeline-template:read |
| PUT | /templates/:id | 更新模板 | pipeline-template:write |
| DELETE | /templates/:id | 删除模板 | pipeline-template:delete |
| POST | /templates/:id/versions | 创建新版本 | pipeline-template:write |
| GET | /templates/:id/versions | 查询模板版本历史 | pipeline-template:read |

## 3. 数据模型

### PipelineTemplate
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| name | VARCHAR | 模板名称 |
| description | TEXT | 模板描述 |
| category | VARCHAR | 分类标签 |
| stages | JSONB | Stage 定义数组 |
| parameters | JSONB | 参数定义 |
| tags | JSONB | 标签 |
| created_by | VARCHAR | 创建人 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### TemplateParameter
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| template_id | UUID | 关联模板 ID |
| name | VARCHAR | 参数名 |
| type | VARCHAR | 参数类型 (string/number/boolean/select) |
| required | BOOLEAN | 是否必填 |
| default_value | JSONB | 默认值 |
| description | TEXT | 参数说明 |

## 4. 验收标准

| 编号 | 标准 | 验证方式 |
|------|------|---------|
| PT-01 | 创建模板后可在列表中查询到 | 单元测试 |
| PT-02 | 模板包含完整的 stages 定义 | 单元测试 |
| PT-03 | 参数定义支持 string/number/boolean/select 类型 | 单元测试 |
| PT-04 | 创建版本后版本历史正确记录 | 集成测试 |
| PT-05 | 多租户隔离：不同租户模板互不可见 | 集成测试 |
| PT-06 | 删除模板时级联删除所有版本 | 单元测试 |
| PT-07 | 模板更新后不影响已创建的 pipeline | 单元测试 |
| PT-08 | 支持按分类标签过滤模板 | 单元测试 |

## 5. 测试策略

| 类型 | 用例数 | 覆盖范围 |
|------|--------|---------|
| 单元测试 | 15+ | handler/service/repository |
| 集成测试 | 8+ | CRUD + 版本管理流程 |
| 前端测试 | 5+ | 模板列表/详情/编辑页面 |
