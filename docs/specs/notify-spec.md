# Spec: 通知 (Notify)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 通知服务
> **目标成熟度**: L2 → L3
> **关键交付**: 多渠道通知、模板管理、发送策略、送达追踪、通知中心

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现（Go 微服务 `orion-notify-svc-go`）：
- 通知模板 CRUD（NotifyService + Repository）
- 通知发送（Notification 模型）
- 通知列表查询
- 模板变量替换
- 多租户隔离
- OpenTelemetry 追踪

**不足**：
- 无多渠道发送（仅基础模板）
- 无发送策略（时机/频率/聚合）
- 无送达追踪
- 无通知中心（用户通知收件箱）
- 无通知分类（告警/审批/系统）
- 无批量发送
- 无通知偏好设置
- 无送达回执

### 1.2 Phase 1 目标 (L3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 多渠道发送 | 邮件/钉钉/企微/飞书/短信/WebSocket | L3 |
| 发送策略 | 时机/频率限制/聚合/去重 | L3 |
| 送达追踪 | 发送/投递/阅读状态追踪 | L3 |
| 通知中心 | 用户通知收件箱 | L3 |
| 通知偏好 | 用户通知渠道/类型偏好 | L2.5 |

## 二、验收标准

### 2.1 模板管理

| # | 标准 | 验证方式 |
|---|------|----------|
| NT1 | 支持创建通知模板（name/channel/subject/template/variables） | API 测试 |
| NT2 | 模板变量支持 Mustache 语法（{{name}}） | API 测试 |
| NT3 | 预置 10+ 模板（部署成功/失败/审批通知/告警/工单更新） | 前端验证 |
| NT4 | 模板支持版本管理 | API 测试 |
| NT5 | 模板可按渠道分类 | API 测试 |
| NT6 | 模板启用/禁用 | API 测试 |

### 2.2 多渠道发送

| # | 标准 | 验证方式 |
|---|------|----------|
| NT7 | 支持邮件渠道（SMTP + HTML 模板） | 集成测试 |
| NT8 | 支持钉钉渠道（Webhook + Markdown） | 集成测试 |
| NT9 | 支持企微渠道（Webhook + Markdown） | 集成测试 |
| NT10 | 支持飞书渠道（Webhook + Post） | 集成测试 |
| NT11 | 支持短信渠道（第三方 SMS） | API 测试 |
| NT12 | 支持 WebSocket（实时推送） | 集成测试 |
| NT13 | 多渠道失败自动降级（邮件 → 短信） | 集成测试 |
| NT14 | 发送结果记录（成功/失败/错误原因） | API 测试 |

### 2.3 发送策略

| # | 标准 | 验证方式 |
|---|------|----------|
| NT15 | 频率限制：同一用户 5 分钟内最多 10 条 | 集成测试 |
| NT16 | 通知聚合：同一事件多条通知合并为 1 条 | API 测试 |
| NT17 | 通知去重：相同内容 N 分钟内不重复发送 | API 测试 |
| NT18 | 维护窗口静默：指定时段不发送非紧急通知 | API 测试 |
| NT19 | 紧急通知可突破频率限制 | API 测试 |
| NT20 | 发送优先级：critical > high > normal > low | API 测试 |

### 2.4 送达追踪

| # | 标准 | 验证方式 |
|---|------|----------|
| NT21 | 通知状态：pending/sent/delivered/read/failed | API 测试 |
| NT22 | 发送时间戳记录 | API 测试 |
| NT23 | 投递时间戳记录（渠道回调） | 集成测试 |
| NT24 | 阅读时间戳记录（邮件/WebSocket 点击） | API 测试 |
| NT25 | 送达率统计 | API 测试 |
| NT26 | 送达失败自动重试（最多 3 次） | 集成测试 |

### 2.5 通知中心

| # | 标准 | 验证方式 |
|---|------|----------|
| NT27 | 用户通知收件箱（分页查询） | API 测试 |
| NT28 | 通知标记已读/未读 | API 测试 |
| NT29 | 通知批量标记已读 | API 测试 |
| NT30 | 未读通知数量统计 | API 测试 |
| NT31 | 通知可删除/归档 | API 测试 |
| NT32 | WebSocket 实时推送新通知 | 集成测试 |
| NT33 | 通知分类标签（alert/approval/system/task） | API 测试 |

### 2.6 通知偏好

| # | 标准 | 验证方式 |
|---|------|----------|
| NT34 | 用户可设置通知渠道偏好（email/dingtalk/wechat/websocket） | API 测试 |
| NT35 | 用户可设置通知类型偏好（alert/approval/system） | API 测试 |
| NT36 | 安静时段设置（勿扰模式） | API 测试 |
| NT37 | 偏好变更即时生效 | API 测试 |
| NT38 | 通知设置审计日志 | 单元测试 |

## 三、API 设计

```
Base: /api/v1/notify
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/send` | 发送通知 |
| POST | `/send/batch` | 批量发送 |
| GET | `/notifications` | 通知列表 |
| GET | `/notifications/:id` | 通知详情 |
| PUT | `/notifications/:id/read` | 标记已读 |
| POST | `/notifications/read-all` | 全部已读 |
| DELETE | `/notifications/:id` | 删除通知 |
| GET | `/notifications/unread-count` | 未读数量 |
| GET | `/templates` | 模板列表 |
| POST | `/templates` | 创建模板 |
| PUT | `/templates/:id` | 更新模板 |
| GET | `/preferences/me` | 我的偏好 |
| PUT | `/preferences/me` | 更新偏好 |
| GET | `/statistics` | 发送统计 |
| GET | `/statistics/delivery` | 送达率统计 |

## 四、数据模型

```sql
-- 通知模板
CREATE TABLE IF NOT EXISTS notify_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  channel         VARCHAR(20) NOT NULL,
  subject         VARCHAR(500),
  body_template   TEXT NOT NULL,
  variables       TEXT[] DEFAULT '{}',
  category        VARCHAR(50) DEFAULT 'system',
  version         INT DEFAULT 1,
  enabled         BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 通知记录
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  recipient_id    UUID REFERENCES users(id),
  recipient       VARCHAR(200) NOT NULL,
  channel         VARCHAR(20) NOT NULL,
  template_id     UUID REFERENCES notify_templates(id),
  subject         VARCHAR(500),
  body            TEXT NOT NULL,
  category        VARCHAR(50) DEFAULT 'system',
  priority        VARCHAR(20) DEFAULT 'normal',
  status          VARCHAR(20) DEFAULT 'pending',
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 通知偏好
CREATE TABLE IF NOT EXISTS notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  channels        TEXT[] DEFAULT '{email,websocket}',
  categories      TEXT[] DEFAULT '{alert,approval,system,task}',
  quiet_hours_start TIME,
  quiet_hours_end   TIME,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id, created_at DESC);
```

## 五、前端设计

**路由**: `/notification`

主要页面：
- 通知中心页：收件箱、未读标记、批量操作
- 模板管理页：创建/编辑/预览模板
- 发送记录页：发送历史、状态追踪
- 偏好设置页：渠道/类型/安静时段
- 统计页：发送量/送达率/渠道分布

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 22 | NotifyService、TemplateService、DeliveryService |
| 集成测试 | 6 | 模板→发送→多渠道→送达→通知中心→偏好闭环 |
| 前端测试 | 4 | 通知列表、模板编辑、偏好设置 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
