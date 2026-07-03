# Escalation 模块深度分析

**生成日期**: 2026-07-03  
**分析范围**: `orion-platform-service/src/services/escalation/` + `src/api/escalation-routes.ts`  
**路由前缀**: `/api/v1/escalation`  

---

## 一、现状概述

### 模块定位

统一升级管理中心（Escalation Management），支持告警（Alert）、工单（Ticket）、事件（Incident）三种实体类型的自动升级。根据预定义策略，在超时或条件满足时自动逐级通知相关人员，支持集成钉钉、微信、邮件、短信、Slack 五种通知渠道。

### 文件结构

```
services/escalation/
├── __tests__/
│   ├── EscalationConfigService.extended.test.ts
│   ├── EscalationConfigService.test.ts
│   ├── EscalationScheduler.extended.test.ts
│   ├── EscalationScheduler.test.ts
│   └── index.test.ts
├── index.ts                              # 导出所有服务
├── EscalationConfigService.ts             # 升级策略配置管理 (~270 行)
└── EscalationScheduler.ts                 # 升级调度器 (~340 行)

api/escalation-routes.ts                  # 路由定义 (~240 行)
```

### 核心数据模型

| 实体 | 关键字段 | 说明 |
|------|---------|------|
| EscalationPolicy | id, entityType, severity, level, timeoutMinutes, notifyUsers[], notifyChannels[], autoAction, isActive | 升级策略 |
| GlobalEscalationConfig | defaults.alertTimeoutMinutes, defaults.ticketSlaTimeoutMinutes, defaults.incidentTimeoutMinutes, autoEscalationEnabled, checkIntervalSeconds | 全局配置 |

策略通过唯一约束 `UNIQUE(entity_type, severity, level)` 确保每个实体类型+严重级别+升级级别的组合唯一。

### 持久化方式

- **PostgreSQL**：使用 `EscalationPolicyRepository` 封装，带 `escalation_policies` 表（含 JSONB 字段 `notify_users` 和 `notify_channels`）
- **内存缓存**：`cache: Map<string, EscalationPolicy[]>` 作为读缓存
- **降级模式**：无 DB 时使用纯内存配置

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 升级策略 CRUD（创建） | ✅ 完整 | upsert 模式，支持 entity_type/severity/level 唯一约束 |
| 升级策略列表 | ✅ 完整 | 支持按 entityType + severity 过滤 |
| 升级策略详情（getById） | ❌ 缺失 | 路由注册但返回 "Not implemented" |
| 升级策略删除 | ❌ 缺失 | 路由注册但返回 "Not implemented" |
| 全局配置获取/更新 | ✅ 完整 | 内存配置，支持部分更新 |
| 调度器启动/停止 | ✅ 完整 | 基于 setInterval 的轮询调度 |
| 调度器状态查询 | ✅ 完整 | 运行状态 + 全局配置 |
| 手动触发升级 | ✅ 完整 | 支持指定目标级别 |
| 工单自动升级（SLA 检测） | ⚠️ 部分实现 | 已实现 `checkTicketsForEscalation`，但依赖 `TicketingRepository` |
| 告警自动升级 | ❌ 缺失 | 方法体为空，标注 "TODO: AlertRepository" |
| 事件自动升级 | ❌ 缺失 | 方法体为空（`logger.debug` 占位） |
| 通知发送 | ❌ 缺失 | 5 种渠道均为空实现，只有 `logger.info` 占位 |
| 默认策略初始化 | ✅ 完整 | 21 条默认策略覆盖 alert/ticket/incident 各类场景 |
| 自动启动调度器 | ✅ 完整 | 应用启动时在 `routes.ts` 中自动调用 `escalationScheduler.start()` |

---

## 三、API 端点

| 方法 | 路径 | 控制器 | 说明 | ACL |
|------|------|--------|------|-----|
| POST | `/api/v1/escalation/policies` | `createPolicy` | 创建升级策略 | escalation:write |
| GET | `/api/v1/escalation/policies` | `getPolicies/getAllPolicies` | 策略列表 | escalation:read |
| GET | `/api/v1/escalation/policies/:id` | 未实现 | 策略详情（TODO） | escalation:read |
| DELETE | `/api/v1/escalation/policies/:id` | 未实现 | 删除策略（TODO） | escalation:delete |
| GET | `/api/v1/escalation/config` | `getGlobalConfig` | 全局配置 | escalation:read |
| PUT | `/api/v1/escalation/config` | `updateGlobalConfig` | 更新全局配置 | escalation:write |
| POST | `/api/v1/escalation/scheduler/start` | `start` | 启动调度器 | escalation:execute |
| POST | `/api/v1/escalation/scheduler/stop` | `stop` | 停止调度器 | escalation:execute |
| GET | `/api/v1/escalation/scheduler/status` | 状态查询 | 调度器状态 | escalation:read |
| POST | `/api/v1/escalation/manual` | `manualEscalate` | 手动升级 | escalation:execute |
| POST | `/api/v1/escalation/init-defaults` | 初始化策略 | 初始化默认升级策略 | escalation:manage |

---

## 四、依赖关系

| 依赖 | 类型 | 说明 |
|------|------|------|
| `EscalationPolicyRepository` | 内部依赖 | 策略数据持久化 |
| `TicketingRepository` | 外部依赖 | 工单数据访问（从 `ticketing` 模块） |
| `EventBusService` | 外部依赖 | 事件发布（告警/工单升级事件） |
| `DatabasePool` | 基础设施 | 数据库连接池 |

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **告警、事件自动升级为空实现**，仅工单升级有部分代码 | **P0** | 实现 `AlertRepository` 和 Incident 查询逻辑，完成自动升级循环 |
| **5 种通知渠道均为空实现** | **P0** | 集成实际的通知服务（钉钉/微信/邮件/短信/Slack API） |
| **`getById` 和 `delete` 路由标记 TODO** | P1 | 实现策略详情查询和删除功能 |
| **全局配置仅存内存**，无持久化 | P1 | 将 `GlobalEscalationConfig` 持久化到数据库或配置中心 |
| **调度器采用 `setInterval`**，无分布式锁 | P1 | 多实例部署时会重复执行，需引入分布式锁 |
| **策略缓存未实现失效机制**，从 DB 加载后永不刷新 | P1 | 添加定时刷新或用数据库监听（LISTEN/NOTIFY） |
| **`manualEscalate` 中 severity 和 currentLevel 均为 hardcode** | P2 | 从实体表中动态获取当前级别和严重度 |
| **`createPolicy` 处 `upsert` 有拼写错误**（应为 upsert） | P2 | 修复拼写，不影响功能 |

---

## 六、总结

Escalation 模块的架构设计合理，支持三种实体类型的多级升级策略，策略模型采用 `(entity_type, severity, level)` 唯一约束设计得当。测试覆盖较好（5 个测试文件）。API 路由完整注册，ACL 权限控制到位。

**核心问题**：功能性代码处于"骨架"状态——自动升级中的告警/事件检查为空，所有通知渠道为 log 占位。当前只有"工单 SLA 超时 → 通知"这一条链路是半可用的。如果没有实际的通知集成，整个模块在生产环境中无法产生实际价值。

**评分**: 4/10 — 架构设计良好（8分），但核心功能未完成（2分）。需要完成通知渠道集成和告警/事件自动升级逻辑才能真正可用。
