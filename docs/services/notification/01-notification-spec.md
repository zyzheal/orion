# 通知服务详细规格 (Phase 1)

> **日期**: 2026-07-02
> **状态**: 已验证
> **能力域**: 3. 通知服务
> **目标成熟度**: L2 → L3
> **关键交付**: 多渠道投递、通知策略、模板管理

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- In-app 通知（WebSocket 实时推送 + 通知中心列表）
- 邮件通知框架（SMTP 配置，但真实投递未完整实现）
- Webhook 通知框架（HTTP POST 回调，但未接入真实服务）
- 通知策略引擎（基于事件类型的通知规则）
- 通知设置管理（PostgreSQL 持久化）
- 通知模板基础（HTML 邮件模板骨架）

**不足**：
- 多渠道实际投递缺失（邮件/短信/Webhook 均为框架，无真实集成）
- 通知设置仍存在内存 Map 降级路径（重启丢失）
- 缺少前端通知管理页面
- 缺少钉钉/企业微信集成
- 缺少定时通知和免打扰逻辑
- 租户隔离不完整

### 1.2 Phase 1 目标 (L3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 多渠道投递 | 邮件/Webhook/钉钉/企业微信真实投递 | L3 |
| 通知策略 | 事件类型→渠道映射、优先级、频率控制 | L3 |
| 模板管理 | 邮件/Webhook 模板、变量替换 | L3 |
| 前端页面 | 通知中心、设置管理、历史查询 | L3 |
| 租户隔离 | 通知数据按租户隔离 | L3 |

## 二、验收标准

### 2.1 多渠道投递

| # | 标准 | 验证方式 |
|---|------|----------|
| N1 | 邮件投递：通过 SMTP 真实发送 HTML 邮件 | 集成测试 |
| N2 | Webhook 投递：HTTP POST 到目标 URL，支持签名验证 | 集成测试 |
| N3 | 钉机器人：Webhook 消息卡片（Markdown 格式） | 集成测试 |
| N4 | 企业微信机器人：Webhook 消息卡片 | 集成测试 |
| N5 | 短信投递：对接阿里云/腾讯云 SMS API | 集成测试 |
| N6 | 投递失败自动重试（最多 3 次，间隔递增） | 单元测试 |
| N7 | 投递状态追踪（成功/失败/重试中） | API 测试 |

### 2.2 通知策略

| # | 标准 | 验证方式 |
|---|------|----------|
| P1 | 支持按事件类型配置通知渠道（如 Pipeline 完成→邮件+钉钉） | API 测试 |
| P2 | 支持通知优先级（P0 即时/P1 5 分钟内/P2 汇总） | API 测试 |
| P3 | 支持频率控制（同一事件 5 分钟内不重复通知） | 单元测试 |
| P4 | 支持免打扰时段（如 22:00-08:00 不推送） | API 测试 |
| P5 | 支持按用户/角色/租户级别配置通知策略 | API 测试 |

### 2.3 模板管理

| # | 标准 | 验证方式 |
|---|------|----------|
| T1 | 邮件模板支持变量替换（`{{pipeline.name}}`、`{{status}}`） | 单元测试 |
| T2 | Webhook 模板支持 JSON 结构化消息 | 单元测试 |
| T3 | 预置 5+ 模板：Pipeline 完成/失败、审批待办、告警触发、部署完成 | 前端验证 |
| T4 | 用户可自定义通知模板 | API 测试 |

### 2.4 前端页面

| # | 标准 | 验证方式 |
|---|------|----------|
| F1 | 通知中心：列表展示、已读/未读标记、批量操作 | 前端验证 |
| F2 | 通知设置：渠道偏好、免打扰时段、事件订阅 | 前端验证 |
| F3 | 通知历史：按时间/类型/状态筛选 | 前端验证 |
| F4 | 空状态：无通知时显示 Empty + 引导 | 前端验证 |

## 三、API 设计

### 3.1 通知发送端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/notifications/send` | 发送通知 |
| GET | `/api/v1/notifications` | 获取通知列表 |
| GET | `/api/v1/notifications/:id` | 获取通知详情 |
| PUT | `/api/v1/notifications/:id/read` | 标记已读 |
| PUT | `/api/v1/notifications/read-all` | 全部标记已读 |

### 3.2 通知设置端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/notification-settings` | 获取通知设置 |
| PUT | `/api/v1/notification-settings` | 更新通知设置 |
| GET | `/api/v1/notification-templates` | 获取模板列表 |
| POST | `/api/v1/notification-templates` | 创建模板 |

## 四、数据模型

### 4.1 notifications 表

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,  -- pipeline_run, approval, alert, deploy
  title VARCHAR(255) NOT NULL,
  body TEXT,
  channel VARCHAR(20) NOT NULL,  -- in_app, email, webhook, dingtalk, wecom
  status VARCHAR(20) DEFAULT 'pending',  -- pending, sent, failed, retrying
  priority VARCHAR(10) DEFAULT 'P2',  -- P0, P1, P2
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4.2 notification_settings 表

```sql
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  channels JSONB NOT NULL,  -- ["email", "dingtalk", "wecom"]
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  frequency_limit INTEGER DEFAULT 5,  -- 分钟
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 五、依赖关系

| 依赖 | 类型 | 说明 |
|------|------|------|
| EventBus | 内部 | 消费事件触发通知 |
| UserService | 内部 | 用户查询 |
| TenantService | 内部 | 租户隔离 |

---

_文档版本: v1.0 | 创建日期: 2026-07-02 | 状态: 已验证_