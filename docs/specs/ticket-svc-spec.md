# Spec: Ticket 服务 (ticket)

## 1. 模块概述

### 功能描述
Ticket 服务提供工单（Ticket）的全生命周期管理，包括工单创建、流转、SLA 管理、自动分发和关联关系。支持 ITSM 场景的工单处理流程。

### 架构
- **框架**：Gin HTTP
- **分层**：handler → service → repository → models
- **认证**：`RequirePermission("ticket", action)`
- **多租户**：所有查询带 `tenant_id` 过滤
- **存储**：PostgreSQL

### 与 TypeScript 实现的差异
- TS 实现：`orion-platform-service/src/services/ticketing/` 和 `itsm/`
- Go 实现：独立微服务，更丰富的工单分发和 SLA 管理

## 2. API 端点

**Base 路径**：`/api/v1/ticket`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /tickets | 分页查询工单 | ticket:read |
| POST | /tickets | 创建工单 | ticket:write |
| GET | /tickets/:id | 获取工单详情 | ticket:read |
| PUT | /tickets/:id | 更新工单 | ticket:write |
| PATCH | /tickets/:id/status | 更新状态 | ticket:write |
| POST | /tickets/:id/assign | 分配工单 | ticket:write |
| POST | /tickets/:id/close | 关闭工单 | ticket:write |
| POST | /tickets/:id/comments | 添加评论 | ticket:write |
| GET | /tickets/:id/comments | 查询评论 | ticket:read |
| POST | /tickets/:id/transfer | 转派工单 | ticket:write |
| POST | /tickets/batch/assign | 批量分配 | ticket:write |
| POST | /tickets/batch/close | 批量关闭 | ticket:write |
| GET | /dispatch/rules | 查询分发规则 | ticket:read |
| POST | /dispatch/rules | 创建分发规则 | ticket:write |
| PUT | /dispatch/rules/:id | 更新分发规则 | ticket:write |
| DELETE | /dispatch/rules/:id | 删除分发规则 | ticket:delete |
| POST | /dispatch/execute | 执行自动分发 | ticket:write |
| GET | /sla/targets | SLA 目标列表 | ticket:read |
| POST | /sla/targets | 创建 SLA 目标 | ticket:write |
| PUT | /sla/targets/:id | 更新 SLA 目标 | ticket:write |
| GET | /sla/breaches | 查询 SLA 违规 | ticket:read |
| GET | /relations | 工单关联关系 | ticket:read |
| POST | /relations | 创建关联 | ticket:write |
| GET | /workflows | 工单流程模板 | ticket:read |
| POST | /workflows/:id/execute | 执行流程 | ticket:write |

## 3. 数据模型

### Ticket
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| title | VARCHAR | 标题 |
| description | TEXT | 描述 |
| type | VARCHAR | 类型 (incident/request/problem) |
| priority | VARCHAR | 优先级 |
| status | VARCHAR | 状态 |
| assignee_id | VARCHAR | 处理人 |
| reporter_id | VARCHAR | 报告人 |
| category | VARCHAR | 分类 |
| tags | JSONB | 标签 |
| custom_fields | JSONB | 自定义字段 |
| sla_deadline | TIMESTAMP | SLA 截止时间 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |
| resolved_at | TIMESTAMP | 解决时间 |

### TicketComment
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| ticket_id | UUID | 关联工单 |
| content | TEXT | 评论内容 |
| author_id | VARCHAR | 作者 |
| is_internal | BOOLEAN | 是否内部评论 |

### DispatchRule
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| name | VARCHAR | 规则名称 |
| conditions | JSONB | 匹配条件 |
| assignee_strategy | VARCHAR | 分配策略 |
| target_user_id | VARCHAR | 目标用户 |
| enabled | BOOLEAN | 是否启用 |

### SLATarget
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| priority | VARCHAR | 优先级 |
| response_time_minutes | INT | 响应时间(分钟) |
| resolve_time_minutes | INT | 解决时间(分钟) |

## 4. 验收标准

| 编号 | 标准 | 验证方式 |
|------|------|---------|
| TKT-01 | 创建工单后可在列表中查询 | 单元测试 |
| TKT-02 | 工单状态流转符合预定义流程 | 集成测试 |
| TKT-03 | SLA 违规自动标记并通知 | 集成测试 |
| TKT-04 | 自动分发规则匹配正确的处理人 | 单元测试 |
| TKT-05 | 多租户隔离：不同租户工单互不可见 | 集成测试 |
| TKT-06 | 评论支持内部/外部区分 | 单元测试 |
| TKT-07 | 转派工单保留完整流转历史 | 集成测试 |
| TKT-08 | 批量操作支持最多 100 个工单 | 单元测试 |

## 5. 测试策略

| 类型 | 用例数 | 覆盖范围 |
|------|--------|---------|
| 单元测试 | 30+ | handler/service/repository |
| 集成测试 | 15+ | 工单全生命周期流程 |
| 前端测试 | 10+ | 工单列表/详情/编辑页面 |
