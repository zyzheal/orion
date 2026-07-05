# Spec: Skill 配置服务 (skill-config)

## 1. 模块概述

### 功能描述
Skill 配置服务管理 AI Skill 包的生命周期（上传、版本、启用/禁用）和运行时实例管理。支持 Skill 包注册、实例化配置和执行审计。

### 架构
- **框架**：Gin HTTP
- **分层**：handler → service → repository → models
- **认证**：`RequirePermission("skill-config", action)`
- **多租户**：所有查询带 `tenant_id` 过滤
- **存储**：PostgreSQL

### 与 TypeScript 实现的差异
- TS 实现：`orion-platform-service/src/services/skill/` 和 `plugin/`
- Go 实现：独立微服务，专注于 Skill 包管理和实例化

## 2. API 端点

**Base 路径**：`/api/v1/skill-config`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /skills | 查询 Skill 包列表 | skill-config:read |
| POST | /skills | 注册 Skill 包 | skill-config:write |
| GET | /skills/:id | 获取 Skill 详情 | skill-config:read |
| PUT | /skills/:id | 更新 Skill 配置 | skill-config:write |
| DELETE | /skills/:id | 删除 Skill 包 | skill-config:delete |
| POST | /skills/:id/enable | 启用 Skill | skill-config:write |
| POST | /skills/:id/disable | 禁用 Skill | skill-config:write |
| GET | /instances | 查询 Skill 实例 | skill-config:read |
| POST | /instances | 创建 Skill 实例 | skill-config:write |
| GET | /instances/:id | 获取实例详情 | skill-config:read |
| PUT | /instances/:id | 更新实例配置 | skill-config:write |
| DELETE | /instances/:id | 删除实例 | skill-config:delete |
| GET | /executions | 查询执行记录 | skill-config:read |
| GET | /audit | 查询审计日志 | skill-config:read |

## 3. 数据模型

### SkillPackage
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| name | VARCHAR | Skill 名称 |
| version | VARCHAR | 版本号 |
| description | TEXT | 描述 |
| config_schema | JSONB | 配置 Schema |
| entrypoint | VARCHAR | 入口文件 |
| enabled | BOOLEAN | 是否启用 |
| created_by | VARCHAR | 创建人 |
| created_at | TIMESTAMP | 创建时间 |

### SkillInstance
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| skill_id | UUID | 关联 Skill 包 |
| name | VARCHAR | 实例名称 |
| config | JSONB | 实例配置 |
| status | VARCHAR | 状态 (active/disabled/error) |
| last_executed | TIMESTAMP | 最后执行时间 |

### SkillExecution
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| instance_id | UUID | 关联实例 |
| status | VARCHAR | 状态 |
| input | JSONB | 输入参数 |
| output | JSONB | 输出结果 |
| error | TEXT | 错误信息 |
| duration_ms | INT | 耗时 |
| executed_at | TIMESTAMP | 执行时间 |

### SkillAuditLog
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| skill_id | UUID | 关联 Skill |
| instance_id | UUID | 关联实例 |
| action | VARCHAR | 操作 (register/enable/disable/execute) |
| user_id | VARCHAR | 操作用户 |
| details | JSONB | 详情 |

## 4. 验收标准

| 编号 | 标准 | 验证方式 |
|------|------|---------|
| SK-01 | 注册 Skill 包后可在列表中查询 | 单元测试 |
| SK-02 | Skill 禁用后实例无法执行 | 集成测试 |
| SK-03 | Skill 实例配置支持运行时热更新 | 单元测试 |
| SK-04 | 执行记录保留完整的 input/output | 单元测试 |
| SK-05 | 多租户隔离：不同租户 Skill 互不可见 | 集成测试 |
| SK-06 | 审计日志记录所有配置变更 | 集成测试 |
| SK-07 | Skill 包版本号唯一约束 | 单元测试 |
| SK-08 | 删除 Skill 包时级联删除实例 | 单元测试 |

## 5. 测试策略

| 类型 | 用例数 | 覆盖范围 |
|------|--------|---------|
| 单元测试 | 20+ | handler/service/repository |
| 集成测试 | 10+ | 注册/实例化/执行流程 |
| 前端测试 | 5+ | Skill 管理页面 |
