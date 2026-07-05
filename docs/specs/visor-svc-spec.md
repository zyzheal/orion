# Spec: Visor 服务 (visor)

## 1. 模块概述

### 功能描述
Visor 服务是可视化运维平台，提供自定义 Dashboard 管理、主机监控、告警规则配置、指标可视化和通知渠道管理。

### 架构
- **框架**：Gin HTTP
- **分层**：handler → service → repository → models
- **认证**：`RequirePermission("visor", action)`
- **多租户**：所有查询带 `tenant_id` 过滤
- **存储**：PostgreSQL (Dashboard 配置 + 指标数据)

### 与 TypeScript 实现的差异
- TS 实现：`orion-visor/` (Java/Spring Boot)
- Go 实现：Go 语言重写版本，API 兼容

## 2. API 端点

**Base 路径**：`/api/v1/visor`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /dashboards | 查询 Dashboard 列表 | visor:read |
| POST | /dashboards | 创建 Dashboard | visor:write |
| GET | /dashboards/:id | 获取 Dashboard 详情 | visor:read |
| PUT | /dashboards/:id | 更新 Dashboard | visor:write |
| DELETE | /dashboards/:id | 删除 Dashboard | visor:delete |
| GET | /hosts | 查询监控主机列表 | visor:read |
| POST | /hosts | 注册监控主机 | visor:write |
| GET | /hosts/:id/metrics | 查询主机指标 | visor:read |
| GET | /rules | 告警规则列表 | visor:read |
| POST | /rules | 创建告警规则 | visor:write |
| PUT | /rules/:id | 更新告警规则 | visor:write |
| DELETE | /rules/:id | 删除告警规则 | visor:delete |
| GET | /alerts | 告警列表 | visor:read |
| PATCH | /alerts/:id/ack | 确认告警 | visor:write |
| GET | /metrics | 查询指标数据 | visor:read |
| POST | /metrics | 上报指标 | visor:write |
| GET | /channels | 通知渠道列表 | visor:read |
| POST | /channels | 创建通知渠道 | visor:write |
| PUT | /channels/:id | 更新通知渠道 | visor:write |
| DELETE | /channels/:id | 删除通知渠道 | visor:delete |

## 3. 数据模型

### Dashboard
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| name | VARCHAR | Dashboard 名称 |
| config | JSONB | 面板配置 (panels, layout) |
| is_public | BOOLEAN | 是否公开 |
| created_by | VARCHAR | 创建人 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### MonitorHost
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| name | VARCHAR | 主机名 |
| ip_address | VARCHAR | IP 地址 |
| host_type | VARCHAR | 主机类型 |
| status | VARCHAR | 状态 |
| labels | JSONB | 标签 |
| last_check | TIMESTAMP | 最后检查时间 |

### AlertRule
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| name | VARCHAR | 规则名称 |
| metric | VARCHAR | 监控指标 |
| condition | VARCHAR | 触发条件 |
| threshold | DECIMAL | 阈值 |
| severity | VARCHAR | 严重级别 |
| channels | JSONB | 通知渠道 |
| enabled | BOOLEAN | 是否启用 |

### AlertInstance
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| rule_id | UUID | 关联规则 |
| status | VARCHAR | 状态 |
| message | TEXT | 告警消息 |
| triggered_at | TIMESTAMP | 触发时间 |
| resolved_at | TIMESTAMP | 解决时间 |

### MetricDataPoint
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| host_id | UUID | 关联主机 |
| metric_name | VARCHAR | 指标名 |
| value | DECIMAL | 指标值 |
| timestamp | TIMESTAMP | 采集时间 |

### NotificationChannel
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| name | VARCHAR | 渠道名称 |
| type | VARCHAR | 类型 (email/webhook/slack/dingtalk) |
| config | JSONB | 配置 (url/token 等) |
| enabled | BOOLEAN | 是否启用 |

## 4. 验收标准

| 编号 | 标准 | 验证方式 |
|------|------|---------|
| VIS-01 | 创建 Dashboard 后可查询和展示 | 单元测试 |
| VIS-02 | Dashboard 配置支持多面板布局 | 集成测试 |
| VIS-03 | 注册主机后可采集指标数据 | 单元测试 |
| VIS-04 | 告警规则触发后生成告警并推送通知 | 集成测试 |
| VIS-05 | 多租户隔离：不同租户 Dashboard 互不可见 | 集成测试 |
| VIS-06 | 通知渠道配置支持 email/webhook/slack | 单元测试 |
| VIS-07 | 指标查询支持时间范围聚合 | 集成测试 |
| VIS-08 | Dashboard 公开分享链接有效 | 单元测试 |

## 5. 测试策略

| 类型 | 用例数 | 覆盖范围 |
|------|--------|---------|
| 单元测试 | 30+ | handler/service/repository |
| 集成测试 | 15+ | Dashboard 创建/告警触发/通知流程 |
| 前端测试 | 8+ | Dashboard 编辑/监控页面 |
