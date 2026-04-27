# ChatOps 全局运维中枢 — 设计文档

> 状态: Draft | 日期: 2026-04-27 | 分支: `feat/frontend-gap-implementation`

---

## 1. 概述

### 1.1 目标

构建全局 ChatOps 运维中枢，作为 Orion 平台的统一智能交互层。不隶属于任何单一模块，而是贯穿所有运维场景的对话式操作入口。

### 1.2 核心能力

- **悬浮按钮 + 侧边栏**：全局可用，不影响当前页面操作
- **智能推荐面板**：根据用户角色和资源权限，自动推送需要关注的告警/阻塞任务
- **自然语言 + 命令混合输入**：先实现结构化命令解析，预留 LLM 语义理解接口
- **快捷操作卡片**：对话结果中嵌入可点击操作按钮，支持一键跳转对应详情页
- **双层权限校验**：命令级 + 资源级串联验证
- **三层数据存储**：内存（当前会话）→ Redis（24h 活跃）→ PostgreSQL（永久审计 + 可配置 TTL 对话存储）

### 1.3 非目标（本期不实现）

- 外部 IM 适配器（Slack/飞书/钉钉）— Phase 3
- LLM 语义意图解析 — Phase 2 预留接口，Phase 3 实现
- 语音输入

---

## 2. 系统架构

### 2.1 整体分层

```
┌─────────────────────────────────────────────────────┐
│                   前端层 (React)                      │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────┐ │
│  │ 悬浮状态按钮  │  │ Chat 侧边栏    │  │ WebSocket │ │
│  │ 告警徽标/脉冲 │→ │ 推荐面板+对话  │↔ │   Store   │ │
│  └──────────────┘  └───────────────┘  └───────────┘ │
│         ↕ 上下文感知(自动带入当前页面资源)              │
├─────────────────────────────────────────────────────┤
│              后端服务层 (Fastify)                      │
│  ┌─────────────┐  ┌──────────────────────────────┐  │
│  │ ChatOps API  │→ │ 双层权限校验 (命令级+资源级)   │  │
│  │ /api/chatops│  └──────────────┬───────────────┘  │
│  └─────────────┘                 │                   │
│         ↕ 路由分发                 ↕ 权限通过          │
│  ┌─────┐┌─────┐┌─────────┐┌────┐┌────────────┐     │
│  │Pipe ││Deploy││Monitoring││CMDB││SelfHealing │ ... │
│  └─────┘└─────┘└─────────┘└────┘└────────────┘     │
├─────────────────────────────────────────────────────┤
│                    数据层                             │
│  L1: Zustand Store (当前会话内存)                    │
│  L2: Redis TTL 24h (活跃对话)                        │
│  L3: PostgreSQL (操作审计永久 + 对话加密可配置TTL)     │
├─────────────────────────────────────────────────────┤
│              外部 IM 转发层 (Phase 3)                  │
│  Slack Adapter │ 飞书 Adapter │ DingTalk Adapter    │
└─────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户输入 (自然语言 / Slash 命令)
  → 前端命令解析引擎 (关键词匹配 → 结构化参数)
  → POST /api/chatops/execute { command, params, context }
  → 权限层:
    Step 1: 命令级校验 (用户角色 → 可执行操作类型?)
    Step 2: 资源级校验 (用户资源范围 → 可操作该资源?)
  → 路由分发 (对应业务 API)
  → 执行操作
  → 实时反馈 (WebSocket 推送 / 轮询获取状态)
  → 结果返回 → Chat 侧边栏展示
  → 数据存储 (L1 → L2 → L3 异步写入)
```

---

## 3. 前端设计

### 3.1 悬浮按钮组件 `ChatTrigger`

**位置**：全局右下角固定，`position: fixed; right: 24px; bottom: 24px; z-index: 9999`

**状态指示**：

| 状态 | 颜色 | 图标 | 动画 | 徽标 |
|------|------|------|------|------|
| 正常 | `#1890ff` 渐变 | 💬 | 无 | 无 |
| 告警 | `#ff4d4f` 渐变 | 🔔 | 脉冲光环 | 数字徽标 |
| 执行中 | `#faad14` | ⏳ | 旋转 | 无 |

**Tooltip**：hover 时显示摘要（如 "3 条待处理告警"）

**上下文感知**：从当前路由提取资源上下文（如 `/pipelines/123` → `{ type: 'pipeline', id: '123' }`）

### 3.2 侧边栏组件 `ChatPanel`

**尺寸**：宽度 400px，从右侧滑入，`box-shadow: -4px 0 16px rgba(0,0,0,0.06)`

**结构**（从上到下）：

```
┌────────────────────────────────────┐
│ Header: Logo + "ChatOps" + 关闭按钮 │
├────────────────────────────────────┤
│ 智能推荐面板 (条件显示)              │
│ 背景: #fff7e6 | 边框: #ffe58f      │
│                                    │
│ ┌─ 告警卡片 Critical ────────────┐ │
│ │ 🔴 Staging 错误率异常           │ │
│ │ 2.1% / 阈值 1.0%               │ │
│ │ [查看日志] [诊断根因] [重启Pod] │ │
│ └────────────────────────────────┘ │
│ ┌─ 阻塞卡片 Warning ─────────────┐ │
│ │ ⏸️ Pipeline #1234 等待确认     │ │
│ │ [批准] [拒绝]                   │ │
│ └────────────────────────────────┘ │
├────────────────────────────────────┤
│ 对话历史区 (flex: 1, overflow)     │
│ 背景: #fafafa                      │
│                                    │
│   [用户消息气泡 — 右侧, 蓝色渐变]   │
│ [AI回复气泡 — 左侧, 白色 + 边框]   │
│   [操作结果卡片 — 成功/失败/进行中] │
├────────────────────────────────────┤
│ 输入区                              │
│ [/] 输入框 [↑发送]                 │
│ [快捷命令标签: /deploy /logs ...]  │
└────────────────────────────────────┘
```

**主题**：浅色模式，使用 Orion Design Token（见 `orion-frontend/src/tokens/colors.ts`）

### 3.3 组件拆分

| 组件 | 文件 | 职责 |
|------|------|------|
| `ChatTrigger` | `ChatTrigger.tsx` | 悬浮按钮、状态指示、上下文获取 |
| `ChatPanel` | `ChatPanel/index.tsx` | 侧边栏容器、布局 |
| `ChatHeader` | `ChatHeader.tsx` | 标题栏、关闭按钮 |
| `SmartRecommend` | `SmartRecommend.tsx` | 智能推荐面板、告警/阻塞卡片 |
| `ChatMessage` | `ChatMessage.tsx` | 单条消息气泡（用户/AI/系统） |
| `ActionCard` | `ActionCard.tsx` | 操作结果卡片（带按钮） |
| `ChatInput` | `ChatInput.tsx` | 输入框、Slash 命令补全、快捷标签 |
| `useChatOps` | `useChatOps.ts` | Hook：命令解析、权限检查、API 调用 |
| `chatOpsStore` | `chatOpsStore.ts` | Zustand Store：对话状态、推荐数据 |

### 3.4 状态管理

```typescript
// chatOpsStore.ts
interface ChatOpsState {
  // 面板状态
  isOpen: boolean;
  unreadAlerts: number;
  alertLevel: 'normal' | 'warning' | 'critical';

  // 对话
  messages: ChatMessage[];
  isTyping: boolean;

  // 推荐
  recommendations: Recommendation[];

  // 上下文
  pageContext: PageContext | null;

  // Actions
  toggle: () => void;
  sendMessage: (text: string) => Promise<void>;
  executeAction: (command: string, params: Record<string, unknown>) => Promise<void>;
  dismissRecommendation: (id: string) => void;
  navigateToPage: (path: string) => void; // 跳转详情页
}
```

---

## 4. 命令解析引擎

### 4.1 Phase 1: 结构化命令（关键词匹配）

```
用户输入: "部署 v2.1 到 staging"
  → 匹配规则: /部署|deploy/ + 版本号正则 + /到|to/ + 环境名
  → 结构化: { command: 'deploy', version: 'v2.1', environment: 'staging' }

用户输入: "查看 staging 错误率"
  → 匹配规则: /查看|查询|get/ + 指标名 + 环境名
  → 结构化: { command: 'metrics', metric: 'error_rate', environment: 'staging' }
```

### 4.2 支持的命令集（Phase 1）

| Slash 命令 | 自然语言关键词 | 后端 API | 所需权限 |
|------------|--------------|----------|---------|
| `/deploy <ver> <env>` | 部署、发布 | POST /deploy/:env | deploy + 环境资源 |
| `/logs <resource> <env>` | 日志、查看日志 | GET /monitoring/logs | read + 资源范围 |
| `/restart <pod> <ns>` | 重启、重启 Pod | POST /deploy/restart | restart + namespace |
| `/status <env>` | 状态、健康检查 | GET /monitoring/status | read + 环境范围 |
| `/rollback <ver> <env>` | 回滚、回退 | POST /deploy/rollback | deploy + 环境资源 |
| `/diagnose <resource>` | 诊断、根因 | POST /diagnostic/run | diagnose + 资源 |
| `/pipeline <id>` | 流水线、pipeline | GET /pipelines/:id | read + pipeline |

### 4.3 预留 LLM 接口（Phase 2/3）

```typescript
interface IntentParser {
  // Phase 1: 正则/关键词
  parseRuleBased(input: string): ParsedCommand | null;

  // Phase 2: 预留 LLM
  parseWithLLM(input: string): Promise<ParsedCommand | null>;

  // 策略: 先 rule-based，失败后可选 fallback 到 LLM
  parse(input: string, useLLM: boolean): Promise<ParsedCommand>;
}
```

---

## 5. 双层权限校验

### 5.1 流程

```
用户发送命令 → 前端预检查 (快速失败) → 后端严格校验

  后端校验:
  Step 1: 命令级权限
    - 获取用户角色 (JWT token)
    - 查角色-权限映射表
    - 判断: 该角色是否允许执行此命令类型?
    - 否 → 403 "权限不足: 缺少 <权限名> 权限"

  Step 2: 资源级权限
    - 获取用户资源范围 (project / namespace / environment)
    - 判断: 目标资源是否在用户范围内?
    - 否 → 403 "权限不足: 无权访问资源 <resource>"
    - 是 → 继续执行
```

### 5.2 权限映射表

```typescript
// 命令 → 权限点映射
const COMMAND_PERMISSIONS: Record<string, string> = {
  'deploy': 'chatops:deploy',
  'rollback': 'chatops:deploy',
  'restart': 'chatops:restart',
  'logs': 'chatops:read',
  'status': 'chatops:read',
  'diagnose': 'chatops:diagnose',
  'pipeline': 'chatops:read',
};

// 角色 → 命令级权限
const ROLE_PERMISSIONS: Record<string, string[]> = {
  'admin': ['chatops:deploy', 'chatops:restart', 'chatops:read', 'chatops:diagnose'],
  'platform_admin': ['chatops:deploy', 'chatops:restart', 'chatops:read', 'chatops:diagnose'],
  'developer': ['chatops:read', 'chatops:deploy'],
  'sre': ['chatops:read', 'chatops:restart', 'chatops:diagnose'],
  'viewer': ['chatops:read'],
};

// 资源范围: 通过 RBAC 的 user_resources 表查询
```

### 5.3 后端 API

```
POST /api/chatops/permission/check
Request: { command: string, resourceType: string, resourceId: string }
Response: { allowed: boolean, reason?: string }

POST /api/chatops/execute
Request: { command: string, params: {}, context: {} }
Response: { success: boolean, data: any, executionId: string }

GET /api/chatops/commands
Response: [{ command: string, description: string, requiresAuth: string }]
```

---

## 6. 实时反馈机制

### 6.1 策略：轮询 + WebSocket 混合

| 场景 | 机制 | 频率/方式 |
|------|------|----------|
| 短操作（状态查询、日志查看） | HTTP 轮询 | 单次请求，即时返回 |
| 长操作（部署、构建） | WebSocket | 实时推送阶段进度 |
| 推荐面板数据 | HTTP 轮询 | 每 30s 刷新 |

### 6.2 WebSocket 事件

```typescript
// 复用现有 webSocketStore
interface ChatOpsWebSocketEvents {
  'chatops:progress': {
    executionId: string;
    stage: string;
    status: 'running' | 'success' | 'failed';
    message: string;
  };
  'chatops:alert': {
    alertId: string;
    level: 'critical' | 'warning' | 'info';
    message: string;
    resource: string;
  };
  'chatops:recommendation_update': {
    recommendations: Recommendation[];
  };
}
```

---

## 7. 三层数据存储策略

### 7.1 分层架构

```
┌──────────────────────────────────────────────────────┐
│ L1: Zustand Store (内存)                              │
│ - 当前会话对话内容                                     │
│ - 页面刷新丢失                                        │
│ - 用途: 实时渲染对话 UI                               │
├──────────────────────────────────────────────────────┤
│ L2: Redis (TTL 24h)                                   │
│ - 活跃对话缓存                                         │
│ - 支持多标签页共享                                     │
│ - 自动过期，无需手动清理                               │
├──────────────────────────────────────────────────────┤
│ L3: PostgreSQL (永久 / 可配置TTL)                      │
│ - 操作执行记录: 永久保存 (审计合规)                    │
│ - 权限审计日志: 永久保存                              │
│ - 对话原文: 加密存储 + 可配置 TTL 自动清理              │
│   - 默认: 90 天                                       │
│   - 按角色配置: Admin 180 天, Developer 30 天          │
│   - 按项目配置: 关键项目 365 天                        │
│   - 按告警级别: Critical 相关对话 365 天               │
└──────────────────────────────────────────────────────┘
```

### 7.2 数据表设计

```sql
-- 对话会话表
CREATE TABLE chatops_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  context JSONB DEFAULT '{}',
  expires_at TIMESTAMP -- 根据 TTL 策略计算
);

-- 对话消息表 (加密存储)
CREATE TABLE chatops_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chatops_sessions(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content_encrypted TEXT NOT NULL, -- PGP 加密
  parsed_command JSONB,            -- 结构化命令 (明文，用于分析)
  created_at TIMESTAMP DEFAULT NOW()
);

-- 操作执行记录 (永久存储)
CREATE TABLE chatops_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chatops_sessions(id),
  user_id UUID NOT NULL,
  command TEXT NOT NULL,
  params JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'cancelled')),
  result_summary TEXT,
  execution_time_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 权限审计日志 (永久存储)
CREATE TABLE chatops_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  command TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  permission_check TEXT NOT NULL, -- 'command_level', 'resource_level'
  result TEXT NOT NULL CHECK (result IN ('allowed', 'denied')),
  denial_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- TTL 配置表
CREATE TABLE chatops_ttl_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_type TEXT NOT NULL CHECK (policy_type IN ('global', 'role', 'project', 'alert_level')),
  policy_key TEXT NOT NULL,       -- role name / project id / alert level
  ttl_days INT NOT NULL DEFAULT 90,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 7.3 TTL 自动清理

```sql
-- 定期清理任务 (pg_cron 或应用层定时任务)
DELETE FROM chatops_messages
WHERE session_id IN (
  SELECT id FROM chatops_sessions
  WHERE expires_at < NOW()
);

DELETE FROM chatops_sessions
WHERE expires_at < NOW();
```

**TTL 计算逻辑**：
1. 会话创建时，查询 `chatops_ttl_policies` 获取 TTL
2. 优先级：项目策略 > 角色策略 > 全局策略
3. `expires_at = NOW() + ttl_days`

### 7.4 加密方案

- 使用 `pgcrypto` 扩展的 `pgp_sym_encrypt` / `pgp_sym_decrypt`
- 对称密钥存储在环境变量 `CHATOPS_ENCRYPTION_KEY`
- 解密仅限审计接口，普通对话读取不展示加密内容

---

## 8. 智能推荐面板

### 8.1 数据来源

```
推荐数据 = 过滤(告警 + 阻塞任务 + 系统事件)

过滤条件:
  1. 用户角色权限 (命令级)
  2. 用户资源范围 (资源级)
  3. OnCall 值班状态 (如果启用)
  4. 告警级别阈值 (Critical 必推 / Warning 仅负责人)
  5. 免打扰状态 (DND 期间仅 Critical)
  6. 个人订阅偏好 (仅推送用户关注的资源)
```

### 8.2 推荐类型

| 类型 | 数据来源 | 展示条件 | 操作按钮 |
|------|---------|---------|---------|
| 告警 | Monitoring | 错误率 > SLO 阈值 | 查看日志 / 诊断 / 重启 |
| 阻塞 | Pipeline | 等待手动确认 > 5min | 批准 / 拒绝 / 查看 |
| 部署结果 | Deploy | 部署失败 | 回滚 / 查看日志 |
| 自愈合 | SelfHealing | 自动修复失败 | 手动干预 / 查看详情 |
| 成本异常 | FinOps | 预算超支 | 查看详情 / 优化建议 |

### 8.3 刷新策略

- 初始加载：打开面板时请求 `/api/chatops/recommendations`
- 定时刷新：每 30s 轮询
- 实时推送：WebSocket `chatops:alert` 事件立即更新

---

## 9. 信息接收控制

### 9.1 通知渠道偏好

用户可为每种告警级别设置不同的通知渠道组合：

```sql
-- 通知偏好表
CREATE TABLE chatops_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('critical', 'warning', 'info')),
  channel_chatops BOOLEAN DEFAULT true,      -- ChatOps 面板内推送
  channel_email BOOLEAN DEFAULT false,        -- 邮件通知
  channel_slack BOOLEAN DEFAULT false,        -- Slack (Phase 3)
  channel_feishu BOOLEAN DEFAULT false,       -- 飞书 (Phase 3)
  channel_dingtalk BOOLEAN DEFAULT false,     -- 钉钉 (Phase 3)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 默认策略
INSERT INTO chatops_notification_preferences (user_id, alert_level, channel_chatops)
SELECT id, 'critical', true FROM users;
```

**默认行为**：
- Critical: ChatOps 必推 + 邮件可选
- Warning: 仅 ChatOps 面板
- Info: 不推送，仅在面板"历史"标签中可见

### 9.2 免打扰时段 (DND)

```sql
-- 免打扰设置表
CREATE TABLE chatops_dnd_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT false,
  -- 固定时段模式
  start_time TIME,          -- 如 '22:00:00'
  end_time TIME,            -- 如 '08:00:00'
  -- 重复模式
  repeat_days INT[] DEFAULT '{1,2,3,4,5}',  -- 1=周一, 7=周日
  -- 例外规则
  allow_critical BOOLEAN DEFAULT true,      -- DND 期间是否允许 Critical
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**前端交互**：
- 设置入口：Chat 面板 Header → 齿轮图标 → "免打扰设置"
- 快捷切换：面板内 "免打扰" 开关（临时开启/关闭）
- 状态提示：开启后按钮显示月亮图标，悬浮提示 "免打扰中 (08:00 结束)"

**DND 期间行为**：
- 推荐面板仅显示 Critical（如果 `allow_critical = true`）
- 悬浮按钮徽标不增加，但仍显示总数（打开后可见）
- 所有通知延迟到 DND 结束后统一推送摘要

### 9.3 告警风暴降噪

当短时间内产生大量告警时，自动聚合避免信息轰炸：

**聚合规则**：

| 条件 | 策略 |
|------|------|
| 同一资源 5 分钟内 > 3 条告警 | 合并为一条 "X 资源在 5 分钟内产生 N 条告警" |
| 同一项目 5 分钟内 > 10 条告警 | 合并为一条 "X 项目告警风暴 (N 条)" |
| 相同告警内容 > 5 个目标 | 合并为一条 "N 个实例触发相同告警" |
| Critical 告警 | 不合并，逐条推送 |

```sql
-- 降噪规则表 (Admin 可配置)
CREATE TABLE chatops_noise_reduction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('resource', 'project', 'duplicate')),
  time_window_seconds INT NOT NULL DEFAULT 300,
  threshold_count INT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('aggregate', 'suppress', 'escalate')),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 降噪期间静默记录
CREATE TABLE chatops_suppressed_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  original_alert_id UUID,
  aggregated_into UUID,  -- 聚合后的告警 ID
  created_at TIMESTAMP DEFAULT NOW()
);
```

**前端交互**：
- 聚合后的卡片显示 "收起 12 条类似告警" 可展开
- 降噪摘要卡片显示 "过去 5 分钟降噪 47 条告警"
- 用户可手动调整降噪阈值

### 9.4 已读/未读状态管理

```sql
-- 告警已读状态表
CREATE TABLE chatops_alert_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  alert_id UUID NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('unread', 'read', 'acknowledged', 'dismissed')),
  read_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**状态流转**：

```
unread → read          (打开面板自动标记)
read → acknowledged    (点击 "知道了" / 点击操作按钮)
any → dismissed        (手动关闭)

已确认 (acknowledged) 的告警:
  - 从推荐面板移除
  - 保留在历史标签中
  - 不再计入悬浮按钮徽标

已忽略 (dismissed) 的告警:
  - 从推荐面板移除
  - 24 小时内相同告警不重复推送
  - 保留在历史标签中标记为 "已忽略"
```

**前端交互**：
- 打开面板 → 当前可见告警自动标记为 `read`
- 点击操作按钮（查看日志/重启等）→ 自动标记为 `acknowledged`
- 卡片右上角 "×" 按钮 → 标记为 `dismissed`
- 悬浮按钮徽标数字 = `unread` + `acknowledged` 总数

### 9.5 升级策略

Critical 告警超过设定时限未处理时，自动升级通知：

```sql
-- 升级策略表
CREATE TABLE chatops_escalation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('critical', 'warning')),
  -- 升级阶梯
  level1_minutes INT DEFAULT 15,       -- 15 分钟未处理
  level1_target TEXT DEFAULT 'lead',   -- 通知直属 Leader
  level2_minutes INT DEFAULT 30,       -- 30 分钟未处理
  level2_target TEXT DEFAULT 'admin',  -- 通知 Admin
  level3_minutes INT DEFAULT 60,       -- 60 分钟未处理
  level3_target TEXT DEFAULT 'oncall', -- 通知 OnCall 团队
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 升级记录
CREATE TABLE chatops_escalation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL,
  original_user_id UUID NOT NULL,
  escalated_to TEXT NOT NULL,
  level INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**升级触发条件**：
1. 告警推送后开始计时
2. 用户标记为 `acknowledged` 或 `dismissed` → 停止计时
3. 超过 level1 时间 → 通知直属 Leader（ChatOps + 邮件）
4. 超过 level2 时间 → 通知 Admin（ChatOps + 邮件）
5. 超过 level3 时间 → 通知 OnCall 团队（ChatOps + 邮件 + IM）

**Admin 管理入口**：`/settings/chatops/escalation` 配置升级策略

### 9.6 个人订阅配置

用户可手动订阅特定资源的实时状态：

```sql
-- 订阅表
CREATE TABLE chatops_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  resource_type TEXT NOT NULL,       -- 'pipeline', 'environment', 'service', 'pod'
  resource_id TEXT NOT NULL,         -- 资源标识
  event_types TEXT[] DEFAULT '{all}', -- 关注的事件类型
  -- 通知设置
  notify_chatops BOOLEAN DEFAULT true,
  notify_email BOOLEAN DEFAULT false,
  -- 过滤
  only_errors BOOLEAN DEFAULT true,  -- 仅错误事件
  created_at TIMESTAMP DEFAULT NOW()
);
```

**前端交互**：
- 订阅入口：任意资源详情页 → "订阅" 按钮
- Chat 面板设置：齿轮图标 → "我的订阅" 标签页
- 支持快速订阅：当前页面资源一键订阅

**订阅推送示例**：
- 用户订阅了 "Pipeline #123" → 该 pipeline 每次运行完成时推送通知
- 用户订阅了 "staging 环境" 且 `only_errors = true` → 仅 staging 部署失败时推送
- 用户订阅了 "api-service" → 该服务的 Pod 状态变化时推送

---

## 10. 跳转详情页

### 9.1 跳转映射

对话中的操作结果和推荐卡片，点击后跳转到对应实际页面：

| 操作 | 跳转路径 | 携带参数 |
|------|---------|---------|
| 查看日志 | `/pipelines/${id}` → Logs Tab | `?tab=logs` |
| 诊断根因 | `/diagnostic` | `?resource=${type}&id=${id}` |
| 重启 Pod | `/cmdb` → 拓扑视图 | `?pod=${name}&ns=${namespace}` |
| 查看详情 | `/pipelines/${id}` | — |
| 回滚 | `/deploy` → 历史版本 | `?action=rollback&version=${ver}` |

### 9.2 实现方式

- 使用 `react-router-dom` 的 `useNavigate`
- 跳转前标记面板为折叠状态
- 可选：跳转后在目标页面自动高亮相关资源

---

## 11. 上下文感知

### 11.1 路由上下文提取

```typescript
// 根据当前路由自动提取资源上下文
function extractPageContext(pathname: string): PageContext | null {
  // /pipelines/:id → { type: 'pipeline', id: string }
  // /cmdb/:type/:id → { type: string, id: string }
  // /deploy/:env → { type: 'environment', id: string }
  // /monitoring → { type: 'monitoring' }
}
```

### 11.2 上下文应用

- 打开 Chat 时自动附带上下文："你正在查看 Pipeline #123，需要我做什么？"
- Slash 命令自动补全参数：输入 `/deploy` 时推荐当前 pipeline 的版本
- 推荐面板优先显示当前页面相关告警

---

## 12. 实现阶段

### Phase 1（本期）
- [ ] 前端：ChatTrigger 悬浮按钮（状态指示 + 上下文感知）
- [ ] 前端：ChatPanel 侧边栏容器 + 浅色主题
- [ ] 前端：SmartRecommend 推荐面板（告警/阻塞卡片）
- [ ] 前端：ChatInput 输入框 + Slash 快捷命令
- [ ] 前端：命令解析引擎（关键词匹配 + 自然语言）
- [ ] 前端：ChatMessage + ActionCard 组件
- [ ] 前端：chatOpsStore Zustand Store
- [ ] 前端：通知偏好设置 UI（渠道选择 + DND + 订阅管理）
- [ ] 前端：已读/未读状态交互（徽标 + 状态流转）
- [ ] 后端：POST /api/chatops/execute API
- [ ] 后端：双层权限校验中间件
- [ ] 后端：命令路由分发（对接现有 API）
- [ ] 后端：POST /api/chatops/recommendations API（推荐面板数据）
- [ ] 后端：GET /api/chatops/commands API（可用命令列表）
- [ ] 后端：chatops_sessions / messages / executions / audit_logs 表创建
- [ ] 后端：L1 → L3 数据写入链路
- [ ] 后端：通知偏好 CRUD API
- [ ] 后端：DND 设置 CRUD API
- [ ] 后端：已读状态管理 API
- [ ] 后端：订阅管理 CRUD API
- [ ] 后端：告警风暴降噪引擎（聚合规则）
- [ ] 后端：升级策略引擎（定时检查未处理告警）
- [ ] 数据库：pgcrypto 扩展启用
- [ ] 数据库：TTL 自动清理定时任务

### Phase 2
- [ ] 后端：Redis 缓存层 (L2)
- [ ] 前端：WebSocket 实时进度推送
- [ ] 后端：对话原文加密存储 (pgcrypto)
- [ ] 前端：跳转详情页高亮
- [ ] 后端：降噪规则管理 API
- [ ] 后端：升级策略管理 API

### Phase 3
- [ ] 后端：LLM 意图解析接口
- [ ] 外部 IM 适配器（Slack/飞书/钉钉）
- [ ] 前端：语音输入
- [ ] 后端：对话分析（操作模式识别）

---

## 13. 风险与依赖

| 风险 | 缓解 |
|------|------|
| pgcrypto 扩展未启用 | 数据库迁移脚本中检查并启用 |
| Redis 未部署 | Phase 1 可跳过 L2，直接 L1 → L3 |
| WebSocket 连接不稳定 | 降级为纯轮询模式 |
| 命令解析覆盖率不足 | 预留 LLM fallback 接口 |
| 权限模型与现有 RBAC 不一致 | 复用现有 role/user_resources 表 |
| 告警风暴导致数据库写入压力 | 降噪聚合后再写入，减少 80%+ 写入量 |
| 升级策略与 OnCall 系统冲突 | 升级策略读取 OnCall 排班表，避免重复通知 |
