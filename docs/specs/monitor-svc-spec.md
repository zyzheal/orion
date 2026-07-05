# Spec: 监控服务 (monitor)

## 1. 模块概述

### 功能描述
监控服务提供指标采集、链路追踪、告警管理和告警规则引擎。支持自定义指标采集、告警触发、通知分发等完整监控能力。

### 架构
- **框架**：Gin HTTP
- **分层**：handler → service → repository → models
- **认证**：`RequirePermission("monitor", action)`
- **多租户**：所有查询带 `tenant_id` 过滤
- **存储**：PostgreSQL (指标时序数据 + 告警状态)

### 与 TypeScript 实现的差异
- TS 实现：`orion-platform-service/src/services/monitoring/` 和 `observability/`
- Go 实现：独立微服务，指标存储使用 PostgreSQL 而非 InfluxDB

## 2. API 端点

**Base 路径**：`/api/v1/monitor`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /metrics | 查询监控指标（支持时间范围） | monitor:read |
| POST | /metrics | 上报指标数据 | monitor:write |
| GET | /metrics/:serviceName | 服务维度指标查询 | monitor:read |
| GET | /traces | 查询链路追踪 | monitor:read |
| POST | /traces | 上报 trace 数据 | monitor:write |
| GET | /alerts | 查询告警列表 | monitor:read |
| POST | /alerts | 创建告警 | monitor:write |
| PATCH | /alerts/:id/ack | 确认告警 | monitor:write |
| PATCH | /alerts/:id/resolve | 解决告警 | monitor:write |
| GET | /rules | 告警规则列表 | monitor:read |
| POST | /rules | 创建告警规则 | monitor:write |
| PUT | /rules/:id | 更新告警规则 | monitor:write |
| DELETE | /rules/:id | 删除告警规则 | monitor:delete |
| GET | /system | 系统指标汇总 | monitor:read |

## 3. 数据模型

### Metric
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| service_name | VARCHAR | 服务名称 |
| metric_name | VARCHAR | 指标名称 |
| value | DECIMAL | 指标值 |
| tags | JSONB | 标签 (env, region 等) |
| timestamp | TIMESTAMP | 采集时间 |

### Alert
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| rule_id | UUID | 关联规则 ID |
| service_name | VARCHAR | 服务名称 |
| severity | VARCHAR | 严重级别 (critical/warning/info) |
| message | TEXT | 告警消息 |
| status | VARCHAR | 状态 (active/acknowledged/resolved) |
| triggered_at | TIMESTAMP | 触发时间 |
| resolved_at | TIMESTAMP | 解决时间 |

### AlertRule
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| name | VARCHAR | 规则名称 |
| metric | VARCHAR | 监控指标 |
| condition | VARCHAR | 触发条件 |
| threshold | DECIMAL | 阈值 |
| severity | VARCHAR | 告警级别 |
| enabled | BOOLEAN | 是否启用 |
| channels | JSONB | 通知渠道配置 |

## 4. 验收标准

| 编号 | 标准 | 验证方式 |
|------|------|---------|
| MON-01 | 指标上报后可在查询接口获取 | 单元测试 |
| MON-02 | 告警规则触发后生成告警记录 | 集成测试 |
| MON-03 | 告警确认/解决状态流转正确 | 单元测试 |
| MON-04 | 多租户隔离：不同租户指标互不可见 | 集成测试 |
| MON-05 | 时间范围查询支持 start_time/end_time | 单元测试 |
| MON-06 | 告警规则启用/禁用即时生效 | 单元测试 |
| MON-07 | 系统指标汇总返回 CPU/内存/磁盘/网络 | 集成测试 |
| MON-08 | 链路 trace 支持服务间调用链追踪 | 集成测试 |

## 5. 测试策略

| 类型 | 用例数 | 覆盖范围 |
|------|--------|---------|
| 单元测试 | 30+ | handler/service/repository |
| 集成测试 | 15+ | 告警触发全流程 |
| 前端测试 | 8+ | Dashboard/Alerts/Rules 页面 |
