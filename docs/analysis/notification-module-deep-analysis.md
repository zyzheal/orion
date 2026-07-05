# 通知（Notification）模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/notification/` 及相关路由

---

## 模块概览

Notification 模块实现 Orion 平台的通知基础设施，包含 In-app 通知 CRUD、通知策略引擎、工作流管理。采用 PostgreSQL Repository 持久化，通过 EventBus 解耦多渠道投递。

| 子模块 | 路径 | 职责 |
|--------|------|------|
| 通知核心 | `services/notification/NotificationService.ts` | In-app 通知 CRUD、事件发射 |
| 通知策略 | `services/notification-policy/NotificationPolicyService.ts` | 策略引擎、工作流管理、条件评估 |
| API 路由 | `api/notification-routes.ts`、`api/notification-policy-routes.ts` | 22 个 REST 端点 |

---

## 架构设计

### 分层架构

```
Routes Layer (22 endpoints)
    ↓
Service Layer
    ├── NotificationService (send/get/markAsRead/broadcast)
    ├── NotificationSettingsService (用户设置)
    └── NotificationPolicyService (策略引擎 + 工作流)
    ↓
Repository Layer
    ├── NotificationRepository (notifications 表)
    ├── NotificationSettingsRepository (notification_settings 表)
    ├── NotificationPolicyRepository (notification_policies 表)
    └── NotificationWorkflowRepository (notification_workflows 表)
```

### 多渠道投递机制

```
NotificationService.send()
    │
    ├── 1. 写入 notifications 表 (status='pending')
    │
    └── 2. 发布 EventBus 事件
            ├── 'notification.created' (单发)
            └── 'notification.broadcast' (广播)
                 │
                 ▼
          orion-notify-svc (外部服务)
            ├── 邮件
            ├── 短信
            ├── Slack
            ├── 钉钉
            ├── 企业微信
            └── Webhook
```

**设计决策**：NotificationService 仅负责持久化和事件发射，实际多渠道投递由外部 orion-notify-svc 消费事件完成。这种解耦避免了循环依赖。

---

## 功能完整性评估

| 功能 | 状态 | 说明 |
|------|------|------|
| In-app 通知创建 | ✅ | 支持自定义 channel |
| 通知列表查询 | ✅ | 支持分页 |
| 单条通知详情 | ✅ | RESTful 详情 |
| 标记已读 | ✅ | 兼容新旧两种风格 |
| 未读计数 | ✅ | 两个端点 |
| 广播通知 | ⚠️ | 路由有但未实现 |
| 通知设置 CRUD | ⚠️ | 使用内存 Map |
| 策略评估引擎 | ✅ | 支持 9 种操作符 |
| 策略/工作流 CRUD | ✅ | 完整生命周期 |
| 多渠道实际投递 | ❌ | 仅 emit 事件，无邮件/短信/Slack 发送器 |
| 前端页面 | ❌ | 无对应前端实现 |
| 模板管理 | ❌ | 无 template 表 |
| 定时通知 | ❌ | 有 digest_frequency 字段但无调度器 |
| 免打扰逻辑 | ❌ | 有字段但未在发送时检查 |
| 节流控制 | ⚠️ | throttleMinutes 字段存在但未实现 |
| 升级策略 | ❌ | workflow step type 有 escalate 但无执行引擎 |

---

## API 端点清单

### notification-routes.ts（11 个端点）

| 方法 | 路径 | 权限 | 功能 | 状态 |
|------|------|------|------|------|
| GET | `/` | authenticateUser | 列表通知 (分页) | ✅ |
| GET | `/:userId` | authenticateUser | 指定用户通知列表 | ✅ |
| GET | `/:userId/unread-count` | authenticateUser | 未读计数 | ✅ |
| GET | `/stats` | authenticateUser | 统计（仅 unread） | ⚠️ 简化 |
| GET | `/:id` | authenticateUser | 详情 | ✅ |
| POST | `/mark-read/:id` | authenticateUser | 标记已读（旧） | ✅ |
| PUT | `/:id/read` | authenticateUser | 标记已读（新） | ✅ |
| GET | `/settings/:userId` | authenticateUser | 获取设置 | ⚠️ 内存 |
| PUT | `/settings/:userId` | authenticateUser | 更新设置 | ⚠️ 内存 |
| POST | `/broadcast` | authenticateUser | 广播 | ⚠️ 未实现 |

### notification-policy-routes.ts（11 个端点）

| 方法 | 路径 | 权限 | 功能 |
|------|------|------|------|
| POST | `/` | create | 创建策略 |
| GET | `/` | read | 列表策略 |
| GET | `/:id` | read | 策略详情 |
| PUT | `/:id` | update | 更新策略 |
| DELETE | `/:id` | delete | 删除策略 |
| POST | `/evaluate` | read | 评估策略 |
| POST | `/workflows` | create | 创建工作流 |
| GET | `/workflows` | read | 列表工作流 |
| GET | `/workflows/:id` | read | 工作流详情 |
| PUT | `/workflows/:id` | update | 更新工作流 |
| DELETE | `/workflows/:id` | delete | 删除工作流 |

**总端点：22 个**

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 多渠道实际投递缺失 | 用户声称的邮件/短信/Slack 能力实际上不可用 | 实现 orion-notify-svc 或集成现有服务 |
| 通知设置内存 Map | 重启丢失、多实例不一致 | 替换为 NotificationSettingsService |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 前端页面缺失 | 功能不可见 | 创建通知列表、设置、策略页面 |
| 数据库迁移文件缺失 | 无版本化 schema | 创建 notification tables migration |
| 权限控制不一致 | 通知数据可能泄露 | 添加 requirePermission |
| 租户提取不一致 | 可被伪造 | 统一使用 getCurrentTenantId() |
| 缺少输入验证 | 脏数据 | 添加 zod schema |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| traceId 硬编码 | 可观测性差 | 从 request context 传递 |
| 缺少模板管理 | 通知内容硬编码 | 引入 template table + 渲染器 |
| 缺少定时通知 | 需手动触发 | 实现调度器 |
| 缺少免打扰逻辑 | 有字段但未检查 | 在发送时检查 quiet_hours |

---

## 技术债务

| 债务项 | 位置 | 风险 | 建议 |
|--------|------|------|------|
| notificationSettingsStore 内存 Map | notification-routes.ts:27 | 数据丢失 | 替换为 Repository 调用 |
| broadcast 端点未实现 | notification-routes.ts:401 | 功能不可用 | 调用 service.broadcast + event emit |
| traceId 硬编码 | NotificationService.ts:52 | 可观测性差 | 从 context 传递 |
| 缺少 Migration 文件 | db/migrations/ | 无法版本化 | 创建 050+ notification tables |
| 缺少前端实现 | orion-frontend/ | 功能不可见 | 创建 3 个页面 |
| 缺少事件消费者 | 全局 | 多渠道投递无效 | 实现 orion-notify-svc |
| 权限不统一 | notification-routes.ts | 安全风险 | 添加 requirePermission |
| 租户提取不一致 | notification-routes.ts | 越权访问 | 统一使用 getCurrentTenantId() |

---

## 与其他模块集成点

| 模块 | 集成方式 | 说明 |
|------|----------|------|
| Approval | 直接调用 NotificationService.send() | 审批超时提醒 |
| Monitoring | 间接引用 AlertNotificationService | 监控服务内部独立实现 |
| Pipeline | 事件驱动 | 通过 EventBus 发送 notification.created |
| EventBus | 发布/订阅 | NotificationService 依赖 NotificationEventPublisher |
| Auth | authenticateUser middleware | 所有端点需登录 |
| Database | DatabasePool | 直接 SQL 查询 |

**关键发现**：MonitoringService 内有独立的 AlertNotificationService 和内存 channel 管理，与核心 NotificationService 是**两套独立实现**，存在功能重叠和架构不一致。

---

## 建议优先级

### Phase 1：修复阻塞问题（1-2 天）

1. 替换 notificationSettingsStore 为 Repository 调用
2. 实现 broadcast 端点实际逻辑
3. 统一权限控制

### Phase 2：补全基础设施（2-3 天）

4. 创建数据库迁移文件
5. 修复 traceId 和租户隔离
6. 添加输入验证

### Phase 3：功能完善（3-5 天）

7. 实现前端页面
8. 实现多渠道发送器
9. 模板管理

---

## 关键文件索引

| 文件 | 角色 | 重要性 |
|------|------|--------|
| `services/notification/NotificationService.ts` | 核心业务逻辑 | ⭐⭐⭐ |
| `services/notification/NotificationRepository.ts` | 数据访问层 | ⭐⭐⭐ |
| `services/notification-policy/NotificationPolicyService.ts` | 策略引擎 | ⭐⭐⭐ |
| `api/notification-routes.ts` | 核心通知 API | ⭐⭐⭐ |
| `api/notification-policy-routes.ts` | 策略管理 API | ⭐⭐⭐ |

---

## 结论

Orion Notification 模块**基础架构良好**（Repository 模式、事件驱动、策略引擎），但存在**严重的 P0 级功能缺口**：

1. **多渠道投递**仅停留在事件发射层面，无实际发送器
2. **通知设置**使用内存 Map，违反持久化原则
3. **前端完全缺失**，功能不可见
4. **无数据库迁移**，无法追踪 schema 变更
5. **权限控制不一致**，存在安全风险

建议按 **Phase 1 → Phase 2 → Phase 3** 顺序修复。
