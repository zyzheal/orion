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
│         ↕ 命令路由分发             ↕ 权限通过          │
│  ┌─────┐┌─────┐┌─────────┐┌────┐┌────────────┐     │
│  │Pipe ││Deploy││Monitoring││CMDB││SelfHealing │ ... │
│  └─────┘└─────┘└─────────┘└────┘└────────────┘     │
├─────────────────────────────────────────────────────┤
│              事件总线层 (EventBus)                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ EventBus (Phase 1: 内存 | Phase 2: NATS)    │    │
│  │ 订阅事件: alert.created, pipeline.updated,   │    │
│  │          deploy.finished, selfhealing.failed │    │
│  │ → 触发推荐面板实时更新 (替代轮询)              │    │
│  │ → 触发自愈策略 (ChatOps 推荐"确认自愈")       │    │
│  └─────────────────────────────────────────────┘    │
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

### 2.2 EventBus 集成策略

推荐面板的实时数据通过 EventBus 驱动，替代原有的 30s 轮询：

```
事件订阅 (Phase 1: 内存 EventBus, Phase 2: NATS):
  alert.created      → 推荐面板新增告警卡片 + 悬浮按钮徽标+1
  alert.acknowledged → 推荐面板移除该告警 + 徽标-1
  pipeline.updated   → 更新阻塞任务状态
  deploy.finished    → 推送部署结果卡片
  selfhealing.failed → 推荐"手动干预"卡片

推荐面板刷新:
  初始加载: HTTP GET /api/chatops/recommendations (全量)
  后续更新: EventBus 事件驱动 (增量)
  兜底: 每 60s 轮询同步 (防止事件丢失)
```

### 2.3 SelfHealing 集成

ChatOps 与自愈合系统的交互：

```
推荐面板中的自愈场景:
  1. SelfHealing 自动修复成功 → 推送"已自动修复"卡片
  2. SelfHealing 自动修复失败 → 推荐"手动干预"按钮
  3. ChatOps 用户点击"触发自愈" → 调用 SelfHealing API 执行策略

API 交互:
  POST /api/chatops/selfhealing/trigger
    Request: { policyId: string, alertId: string, context: {} }
    → 转发至 SelfHealing /api/selfhealing/execute
    → 双层权限校验后执行

  自愈执行结果通过 EventBus 推送回 ChatOps 面板
```

### 2.4 数据流

```
用户输入 (自然语言 / Slash 命令)
  → 前端命令解析引擎 (关键词匹配 → 结构化参数)
  → 前端输入安全校验 (白名单 + 特殊字符过滤)
  → POST /api/chatops/execute { command, params, context, idempotency_key }
  → 后端幂等性检查 (相同 idempotency_key 返回缓存结果)
  → 权限层:
    Step 1: 命令级校验 (用户角色 → 可执行操作类型?)
    Step 2: 资源级校验 (用户资源范围 → 可操作该资源?)
  → 路由分发 (对应业务 API)
  → 执行操作
  → 实时反馈 (WebSocket 推送 / EventBus 事件)
  → 结果返回 → Chat 侧边栏展示
  → 数据存储 (L1 → L2 → L3 异步写入)

---

## 3. 前端设计

### 3.1 悬浮按钮组件 `ChatTrigger`

**位置**：全局右下角固定，`position: fixed; right: 24px; bottom: 24px; z-index: var(--z-index-overlay)`

**z-index 策略**：使用 Orion Design Token `--z-index-overlay`，避免与 Ant Design Modal (z-index 1000) 和 Drawer 冲突。

**状态指示**：

| 状态 | 颜色 | 图标 | 动画 | 徽标 |
|------|------|------|------|------|
| 正常 | `#1890ff` 渐变 | 💬 | 无 | 无 |
| 告警 | `#ff4d4f` 渐变 | 🔔 | 脉冲光环 | 数字徽标 |
| 执行中 | `#faad14` | ⏳ | 旋转 | 无 |

**Tooltip**：hover 时显示摘要（如 "3 条待处理告警"）

**上下文感知**：从当前路由提取资源上下文（如 `/pipelines/123` → `{ type: 'pipeline', id: '123' }`）

### 3.2 侧边栏组件 `ChatPanel`

**尺寸**：响应式宽度 — 最小 360px (≤1366px 屏幕)，默认 400px，最大 480px (≥1920px 屏幕)。支持鼠标拖拽右侧边缘调整宽度。从右侧滑入动画，`box-shadow: -4px 0 16px rgba(0,0,0,0.06)`

**滚动行为**：
- 默认自动滚动到底部 (最新消息)
- 用户手动向上滚动超过 50px → 暂停自动滚动，显示底部 "↓ 新消息" 浮动按钮
- 点击浮动按钮或发送新消息 → 恢复自动滚动

**推荐面板空状态**：无告警/阻塞任务时，显示 "✅ 当前无异常" 占位卡片 + 快捷命令入口，避免空白面板。

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

### 4.1.1 输入安全校验 (防命令注入)

**白名单校验**: 所有命令参数必须通过预定义的允许值集合校验：

```typescript
// 参数白名单
const ALLOWED_VALUES: Record<string, string[]> = {
  environment: ['development', 'staging', 'production', 'testing'],
  resource: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, // 仅小写字母数字和连字符
  version: /^v?\d+\.\d+\.\d+(-[a-z0-9.]+)?$/,  // 语义化版本号
  namespace: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
  metric: ['error_rate', 'latency_p99', 'cpu_usage', 'memory_usage', 'request_count'],
};
```

**特殊字符拦截**: 拒绝包含以下字符的输入：
- Shell 元字符: `; | & $ ` ( ) { } [ ] < > \ ! # ~`
- 路径遍历: `../` `..\\`
- 引号闭合: `" '` (防止参数注入)

**JSON Schema 校验**: 结构化后的命令对象必须通过对应命令的 JSON Schema 验证，确保:
- 所有 required 字段存在
- 字段类型正确 (string/number)
- 字符串长度限制 (version ≤ 20, namespace ≤ 63)
- 枚举值在允许范围内

```typescript
// 校验流程
function validateCommand(cmd: ParsedCommand): ValidationResult {
  // 1. 命令白名单: 仅允许 §4.2 中定义的 7 种命令
  if (!VALID_COMMANDS.has(cmd.command)) return { valid: false, error: '未知命令' };

  // 2. 参数 Schema 校验
  const schema = COMMAND_SCHEMAS[cmd.command];
  const result = ajv.validate(schema, cmd.params);
  if (!result) return { valid: false, error: ajv.errorsText() };

  // 3. 敏感值检查: 拒绝包含 password/secret/token/key 的参数
  const sensitiveKeys = ['password', 'secret', 'token', 'key', 'credential'];
  for (const key of sensitiveKeys) {
    if (key in cmd.params) return { valid: false, error: `不允许使用敏感参数: ${key}` };
  }

  return { valid: true };
}
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
  content_encrypted TEXT NOT NULL,         -- PGP 加密
  encryption_key_version INT DEFAULT 1,    -- 密钥版本,支持轮换
  parsed_command JSONB,                    -- 结构化命令 (脱敏后明文)
  parsed_command_sanitized JSONB DEFAULT true, -- 是否已脱敏
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

### 7.3 TTL 自动清理

```sql
-- 定期清理任务 (pg_cron 或应用层定时任务)
-- 分批删除，避免锁表 (每批 1000 条)
DO $$
DECLARE
  batch_size INT := 1000;
  deleted INT;
BEGIN
  LOOP
    DELETE FROM chatops_messages
    WHERE session_id IN (
      SELECT id FROM chatops_sessions WHERE expires_at < NOW() LIMIT batch_size
    );
    GET DIAGNOSTICS deleted = ROW_COUNT;
    EXIT WHEN deleted = 0;
    PERFORM pg_sleep(0.1); -- 避免 IO 压力
  END LOOP;

  DELETE FROM chatops_sessions
  WHERE expires_at < NOW()
    AND id NOT IN (SELECT session_id FROM chatops_messages LIMIT 10000);
END $$;
```

### 7.5 数据库索引

```sql
-- 核心 ChatOps 表
CREATE INDEX idx_chatops_sessions_user ON chatops_sessions(user_id);
CREATE INDEX idx_chatops_sessions_expires ON chatops_sessions(expires_at);
CREATE INDEX idx_chatops_messages_session ON chatops_messages(session_id);
CREATE INDEX idx_chatops_messages_created ON chatops_messages(created_at);
CREATE INDEX idx_chatops_executions_user_time ON chatops_executions(user_id, created_at);
CREATE INDEX idx_chatops_audit_user_time ON chatops_audit_logs(user_id, created_at);

-- 通知与告警
CREATE INDEX idx_chatops_notif_pref_user ON chatops_notification_preferences(user_id, alert_level);
CREATE INDEX idx_chatops_alert_states_user ON chatops_alert_states(user_id, state);
CREATE INDEX idx_chatops_dnd_user ON chatops_dnd_settings(user_id);

-- AIOps 表
CREATE INDEX idx_aiops_topology_source ON aiops_service_topology(source_service, target_service);
CREATE INDEX idx_aiops_rca_group ON aiops_rca_results(alert_group_id);
CREATE INDEX idx_aiops_alert_groups_status ON aiops_alert_groups(status);
CREATE INDEX idx_aiops_group_members_alert ON aiops_group_members(alert_id);
CREATE INDEX idx_aiops_runbooks_alert ON aiops_runbooks(alert_type, service_pattern);
CREATE INDEX idx_aiops_baseline_metric ON aiops_baseline_snapshots(metric_name, service_name, environment);
CREATE INDEX idx_aiops_change_service ON aiops_change_impact_analyses(target_service, target_environment);
```

### 7.6 执行 API 幂等性

```
POST /api/chatops/execute
Request Headers:
  X-Idempotency-Key: <uuid>

后端:
  1. Redis 检查: GET idempotency:{key} → 存在则返回缓存结果
  2. 不存在 → 执行 → SET idempotency:{key} {result} EX 3600
  3. Redis 不可用: 降级为命令级去重 (5s 内相同命令 → 拒绝)

前端:
  1. 发送按钮 debounce 3s
  2. 生成 uuid 作为 idempotency_key
  3. 收到响应后恢复按钮
```

### 7.4 加密方案

- 使用 `pgcrypto` 扩展的 `pgp_sym_encrypt` / `pgp_sym_decrypt`
- 对称密钥存储在环境变量 `CHATOPS_ENCRYPTION_KEY`
- 解密仅限审计接口，普通对话读取不展示加密内容

**密钥轮换机制**:
1. `CHATOPS_ENCRYPTION_KEY` 包含版本号: `v1:base64key...`
2. 写入消息时，使用最新版本加密，记录 `encryption_key_version`
3. 轮换时生成新密钥 (v2)，更新环境变量
4. 后台定时任务遍历旧版本记录，用新密钥重新加密
5. 读取时根据 `encryption_key_version` 选择对应密钥解密

**parsed_command 脱敏策略**:
- `parsed_command` 中禁止存储任何包含 `password`, `secret`, `token`, `key`, `credential` 字段的值
- 如果参数值匹配敏感模式 (如 `AKIA*`, `ghp_*`)，替换为 `"***REDACTED***"`
- `parsed_command_sanitized` 标记是否已完成脱敏，未脱敏的记录拒绝读取

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

- 初始加载：打开面板时请求 `/api/chatops/recommendations` (全量)
- **事件驱动更新** (Phase 1: 内存 EventBus, Phase 2: NATS):
  - `alert.created` → 新增告警卡片
  - `alert.acknowledged` → 移除已确认告警
  - `pipeline.updated` → 更新阻塞任务状态
  - `deploy.finished` → 推送部署结果
- **兜底轮询**: 每 60s 同步一次 (防止事件丢失)
- **ChatOps 自身监控**: 通过 `/api/chatops/metrics` 暴露: 推荐面板加载次数、平均响应时间、事件丢弃率

### 8.4 推荐数据聚合来源

`/api/chatops/recommendations` 从以下内部服务接口聚合数据 (直接 DB 查询或内部 API 调用):

| 数据类型 | 数据来源 | 获取方式 | 缓存策略 |
|---------|---------|---------|---------|
| 活跃告警 | Monitoring 服务 | 内部 API: `GET /internal/monitoring/active-alerts` | 内存缓存 30s |
| 阻塞任务 | Pipeline 服务 | 内部 API: `GET /internal/pipelines/blocked` | 内存缓存 60s |
| 部署状态 | Deploy 服务 | EventBus 事件订阅 | 实时 |
| 自愈状态 | SelfHealing 服务 | 内部 API: `GET /internal/selfhealing/failed` | 内存缓存 60s |
| 成本异常 | FinOps 服务 | 内部 API: `GET /internal/finops/anomalies` | 内存缓存 5min |

聚合后按用户权限过滤 (命令级 + 资源级)，再按 DND/订阅/降噪规则筛选。

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
- 所有非 Critical 通知延迟到 DND 结束后统一推送摘要

**DND 结束后摘要格式**：
```
┌─ DND 期间摘要 (22:00 - 08:00) ───────────────┐
│ 共收到 23 条通知，按严重程度排序:              │
│                                              │
│ 🔴 Critical (2): 已自动标记为未读             │
│   • DB connection pool 使用率 98%            │
│   • api-service 502 错误率 5.2%              │
│                                              │
│ 🟡 Warning (8): 已聚合                        │
│   • staging 环境 8 条告警 (已降噪聚合)       │
│                                              │
│ ℹ️ Info (13): 已归档到历史                    │
│   • 5 次 Pipeline 完成, 3 次部署, 5 其他     │
│                                              │
│ [查看全部] [仅看 Critical] [忽略全部]         │
└──────────────────────────────────────────────┘
```

### 9.3 告警风暴降噪

当短时间内产生大量告警时，自动聚合避免信息轰炸：

**聚合规则**：

| 条件 | 静态阈值 (Phase 1) | 动态阈值 (Phase 2) |
|------|-------------------|-------------------|
| 同一资源告警 | 5 分钟内 > 3 条 | 根据该资源历史告警密度自适应 |
| 同一项目告警 | 5 分钟内 > 10 条 | 根据项目规模和活跃告警数自适应 |
| 相同告警内容 | > 5 个目标 | 根据实例总数比例 (如 > 20%) |
| Critical 告警 | 不合并，逐条推送 | 不合并 (固定规则) |

**Phase 2 动态阈值算法**:
- 滑动窗口内计算告警密度: `density = count / (window_seconds * log(entity_count + 1))`
- 当 `density > baseline_density * 2` 时触发降噪
- baseline_density 按小时/星期分组统计

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

**告警组分组策略** (触发 RCA 分析的前置条件):

| 分组条件 | 时间窗口 | 触发 RCA |
|---------|---------|---------|
| 同一服务 > 2 条不同指标告警 | 3 分钟 | 是 |
| 拓扑关联的多个服务告警 | 5 分钟 | 是 |
| 同项目 > 5 条告警 (任意服务) | 5 分钟 | 是 |
| 单条 Critical 告警 | 立即 | 是 (单节点分析) |
| 单条 Warning/Info 告警 | 不分组 | 否 (独立推送) |

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

-- 告警状态扩展 (增加升级停止标志)
ALTER TABLE chatops_alert_states ADD COLUMN escalation_stopped BOOLEAN DEFAULT false;
ALTER TABLE chatops_alert_states ADD COLUMN escalation_current_level INT DEFAULT 0;
ALTER TABLE chatops_alert_states ADD COLUMN escalation_last_checked_at TIMESTAMP;
```

**升级触发条件**:
1. 告警推送后开始计时
2. 用户标记为 `acknowledged` 或 `dismissed` → 设置 `escalation_stopped = true` → **停止所有后续升级**
3. 超过 level1 时间且 `escalation_stopped = false` → 通知直属 Leader + `escalation_current_level = 1`
4. 超过 level2 时间且 `escalation_current_level < 2` → 通知 Admin + `escalation_current_level = 2`
5. 超过 level3 时间且 `escalation_current_level < 3` → 通知 OnCall 团队 + `escalation_current_level = 3`

**定时任务**: 每 2 分钟检查一次 (与 level1 的 15min 粒度匹配，最多 7.5 次检查才触发升级，避免误判)

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

### 10.1 跳转映射

对话中的操作结果和推荐卡片，点击后跳转到对应实际页面：

| 操作 | 跳转路径 | 携带参数 |
|------|---------|---------|
| 查看日志 | `/pipelines/${id}` → Logs Tab | `?tab=logs` |
| 诊断根因 | `/diagnostic` | `?resource=${type}&id=${id}` |
| 重启 Pod | `/cmdb` → 拓扑视图 | `?pod=${name}&ns=${namespace}` |
| 查看详情 | `/pipelines/${id}` | — |
| 回滚 | `/deploy` → 历史版本 | `?action=rollback&version=${ver}` |

### 10.2 实现方式

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

## 12. 聊天历史与通知历史 — 浏览器端资源管理

> 评审补充: 长周期使用后，对话消息和通知列表可能堆积数百/数千条，直接渲染会导致浏览器内存溢出和渲染卡顿。

### 12.1 前端虚拟滚动 (Virtual Scrolling)

**实现策略**: 使用 Ant Design `VirtualList` 或 `react-window` 的 `FixedSizeList`

```typescript
// 仅渲染可视区域的 DOM 节点
const VISIBLE_COUNT = 50;   // 可视区域消息数
const BUFFER_COUNT = 10;    // 上下缓冲区
const ITEM_HEIGHT = 80;     // 每条消息预估高度

// 无论对话历史有多长，DOM 中始终只有 ~60 个节点
<FixedSizeList
  height={600}
  itemCount={messages.length}
  itemSize={ITEM_HEIGHT}
  overscanCount={BUFFER_COUNT}
>
  {({ index, style }) => (
    <ChatMessage message={messages[index]} style={style} />
  )}
</FixedSizeList>
```

**内存控制**:
- 前端 Zustand Store 最多保留最近 500 条消息
- 超过 500 条 → 最早的消息从内存中移除 (已持久化到 L3 PostgreSQL)
- 用户滚动到顶部时，按需从 API 加载历史 (分页: 每次 50 条)

### 12.2 分页加载策略

```typescript
// 对话历史 API 支持分页
GET /api/chatops/sessions/:id/messages?limit=50&cursor=<timestamp>

// 前端: 滚动到顶部时触发
function onLoadMore() {
  if (isLoadingMore || messages.length >= 500) return; // 最多 500 条
  const oldestMessage = messages[0];
  fetchMoreMessages(oldestMessage.created_at);
}
```

### 12.3 推荐面板通知历史回收

**自动清理**:
- 已确认 (acknowledged) 的通知: 保留 24h 后从面板移除
- 已忽略 (dismissed) 的通知: 保留 24h 后从面板移除
- 过期的通知: 保留 7 天后自动归档到"历史"Tab

**"历史" Tab 分页**:
- 仅保留最近 100 条归档通知
- 超过 100 条 → 最旧的通知从前端内存移除 (仍在 DB 中)
- 用户可按需查询更早历史: "查看更早的历史记录" → API 分页查询

### 12.4 浏览器内存监控

```typescript
// 监控浏览器内存使用
useEffect(() => {
  const interval = setInterval(() => {
    if (performance.memory) {
      const heapUsedMB = performance.memory.usedJSHeapSize / 1024 / 1024;
      if (heapUsedMB > 100) {
        // 内存超过 100MB → 主动清理旧消息
        chatOpsStore.getState().trimOldMessages(200); // 保留最近 200 条
      }
    }
  }, 30000); // 每 30s 检查一次
  return () => clearInterval(interval);
}, []);
```

### 12.5 数据生命周期总览

```
消息状态         │ 存储位置    │ 前端保留  │ 后端保留
─────────────────┼────────────┼───────────┼──────────
当前会话 (活跃)  │ L1 + L2/L3 │ 最多 500 条│ TTL 策略
已加载的历史     │ L1 (分页)  │ 按需加载  │ TTL 策略
已过期 (TTL)     │ —         │ 已清除    │ 已删除
已归档通知       │ L3         │ 最多 100 条│ 7 天 (可配置)
审计记录         │ L3         │ 不加载到前端│ 永久
```

---

## 13. AIOps 智能运维引擎

> 评审发现：当前设计在交互流程、权限控制、信息接收方面完善，但 AI 智能能力几乎空白。
> 以下 4 个模块是 ChatOps 从"通知系统"升级为"运维中枢"的核心。

### 12.1 根因分析引擎 (RCA Engine)

#### 12.1.1 问题定义

当系统发生故障时，通常会触发多条连锁告警。当前降噪策略仅按时间/数量聚合，无法回答：
- 哪条告警是根因？
- 哪些是连锁反应？
- 解决根因后，其他告警是否会自动消失？

#### 12.1.2 分析流程

```
输入: 一组时间相关的告警 (同窗口内)
  ↓
Step 1: 从 CMDB 获取服务依赖拓扑
  ↓
Step 2: 构建时间-拓扑关联图
  - 节点: 告警服务/资源
  - 边: 服务间依赖关系 (HTTP/gRPC/DB/Queue)
  - 权重: 告警到达时间差 (传播延迟)
  ↓
Step 3: 计算因果权重
  - 上游服务先告警 + 下游服务后告警 = 高因果权重
  - 多个下游服务同时告警 → 共同上游 = 候选根因
  ↓
Step 4: 输出有向因果链
  {
    rootCause: { service, alert, time },
    impactChain: [{ service, alert, time, delay }],
    confidence: 0.87
  }
```

#### 12.1.3 数据表

```sql
-- 服务依赖拓扑 (从 CMDB 同步)
CREATE TABLE aiops_service_topology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_service TEXT NOT NULL,
  source_namespace TEXT,
  target_service TEXT NOT NULL,
  target_namespace TEXT,
  dependency_type TEXT NOT NULL CHECK (dependency_type IN ('http', 'grpc', 'database', 'queue', 'dns')),
  is_critical BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source_service, target_service, dependency_type)
);

-- RCA 分析结果
CREATE TABLE aiops_rca_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_group_id UUID NOT NULL REFERENCES aiops_alert_groups(id),
  root_cause_alert_id UUID,
  root_cause_service TEXT,
  root_cause_alert_type TEXT,           -- 原始告警类型
  impact_chain JSONB,                   -- [{service, alert, delay_ms, causal_weight}]
  topology_snapshot JSONB,              -- 分析时的拓扑快照
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  analysis_time_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 告警组 (用于 RCA 分组)
CREATE TABLE aiops_alert_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_alert_id UUID NOT NULL,       -- 触发分组的第一个告警
  time_window_start TIMESTAMP NOT NULL,
  time_window_end TIMESTAMP,
  status TEXT NOT NULL CHECK (status IN ('open', 'analyzing', 'resolved', 'false_positive')),
  rca_result_id UUID REFERENCES aiops_rca_results(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 告警组成员 (替代 UUID[] 数组)
CREATE TABLE aiops_group_members (
  group_id UUID NOT NULL REFERENCES aiops_alert_groups(id) ON DELETE CASCADE,
  alert_id UUID NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (group_id, alert_id)
);

CREATE INDEX idx_aiops_group_members_alert ON aiops_group_members(alert_id);
```

#### 12.1.4 前端展示

推荐面板中告警卡片的 RCA 增强版：

```
┌─ 根因分析完成 ──────────────────────────┐
│ 🔴 根因: DB 连接池耗尽 (15:00:12)       │
│                                          │
│ 影响链:                                  │
│   DB (根因, 15:00) ───── 置信度 87%     │
│     ↓ 延迟 48s                          │
│   → api-service 响应超时 (15:01)        │
│     ↓ 延迟 32s                          │
│   → api-service 错误率上升 (15:01:32)   │
│     ↓ 延迟 96s                          │
│   → frontend 502 错误 (15:03:08)        │
│                                          │
│ 推荐操作 (基于历史修复记录):             │
│ [扩容连接池 (82%成功率)]                 │
│ [回滚最近 DB 变更 (76%)]                 │
│ [重启 api-service (45%)]                 │
│                                          │
│ 影响范围: 12 个服务, 3 个用户           │
└──────────────────────────────────────────┘
```

#### 12.1.5 后端 API

```
POST /api/chatops/rca/analyze
Request: { alertIds: string[], timeWindowSeconds?: number }
Response: {
  groupId: string,
  rootCause: { service, alert, time },
  impactChain: AlertNode[],
  confidence: number,
  recommendedActions: RunbookAction[]
}

GET /api/chatops/rca/groups
Response: AlertGroup[]  -- 当前未处理的告警组

GET /api/chatops/rca/groups/:id
Response: AlertGroup + RCA result
```

#### 12.1.6 实现策略 (Phase 1: 轻量版，无 ML)

**拓扑关联**: 直接使用 CMDB 已有服务依赖数据。同步机制：
- 初始化: 全量从 CMDB `GET /api/cmdb/dependencies` 拉取
- 增量更新: 订阅 CMDB `cmdb.topology_changed` EventBus 事件
- 本地缓存: 内存中维护邻接表，查询 < 1ms
- 兜底: 每 5 分钟全量同步一次 (防止事件丢失)

**因果权重计算公式**:

```typescript
function calculateCausalWeight(upstream: AlertNode, downstream: AlertNode, topology: TopologyEdge): number {
  // 时间一致性分数: 上游先告警且传播延迟合理
  const delay = downstream.time - upstream.time;
  const timeScore = delay > 0 && delay < MAX_PROPAGATION_DELAY_MS
    ? 1 - (delay / MAX_PROPAGAGION_DELAY_MS)  // 延迟越短分数越高
    : 0;

  // 拓扑匹配分数
  const topologyScore = topology
    ? (topology.is_critical ? 1.0 : 0.7)  // 关键依赖分数更高
    : 0;

  // 历史相关性 (Phase 2 加入)
  const historicalScore = getHistoricalCorrelation(upstream.service, downstream.service);

  // 加权组合
  return 0.4 * timeScore + 0.4 * topologyScore + 0.2 * historicalScore;
}
```

**多根因支持**: 当存在多个独立故障源时（如 DB 问题 + 网络问题同时发生），输出多个根因：
```typescript
interface RCAResult {
  rootCauses: RootCause[];  // 支持多根因
  isMultiRoot: boolean;
  impactChains: AlertNode[][];  // 每条因果链
  overallConfidence: number;
}

interface RootCause {
  service: string;
  alert: string;
  time: Date;
  weight: number;        // 该根因在总因果中的权重
  affectedServices: string[];
  confidence: number;
}
```

**置信度**: `confidence = 0.4 * timeConsistency + 0.4 * topologyMatch + 0.2 * historicalCorrelation`
- timeConsistency: 告警时间顺序与拓扑方向的一致性 (0-1)
- topologyMatch: 根因服务是否为其他告警服务的上游依赖 (0/0.7/1.0)
- historicalCorrelation: 历史相同/相似因果链出现频率 (Phase 2: 0-1, Phase 1: 0)

**性能**: 单次分析 < 2 秒 (内存图计算，邻接表 BFS)

---

### 12.2 智能 Runbook 推荐引擎

#### 12.2.1 问题定义

当前设计中的操作按钮是硬编码的 (`[查看日志] [诊断] [重启]`)，不同告警类型需要的操作完全不同。

#### 12.2.2 分层架构

```
Phase 1: 手动 Runbook 库
  Admin 预定义: 告警类型 → 操作步骤列表
  匹配规则: 精确匹配 (告警类型 + 服务名)

Phase 2: Vector DB 检索 (RAG)
  历史告警 + 修复记录 → 向量化存储
  新告警 → 向量相似度检索 → 推荐历史最成功的操作

Phase 3: LLM 生成
  结合 Runbook 库 + 历史数据 + 当前上下文
  LLM 生成个性化操作建议
```

#### 12.2.3 Phase 1 数据表

```sql
-- Runbook 库
CREATE TABLE aiops_runbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  alert_type TEXT NOT NULL,              -- 关联的告警类型
  service_pattern TEXT,                  -- 服务名匹配模式 (支持 *)
  severity TEXT,                         -- 适用的告警级别
  -- 操作步骤
  steps JSONB NOT NULL,                  -- [{order, action, command, description, expected_result}]
  -- 版本管理
  version INT DEFAULT 1,
  previous_version_id UUID REFERENCES aiops_runbooks(id),
  is_active BOOLEAN DEFAULT true,        -- 当前版本是否启用
  -- 统计
  total_executions INT DEFAULT 0,
  success_count INT DEFAULT 0,
  wilson_lower_bound FLOAT DEFAULT 0,    -- Wilson 置信区间下界
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Wilson Score 计算 (PostgreSQL)
-- wilson_lower_bound = (p + z²/(2n) - z × sqrt((p(1-p)+z²/(4n))/n)) / (1+z²/n)
-- z = 1.96 (95% 置信度), p = success_rate, n = total_executions
-- 样本量不足时 (n < 10), wilson_lower_bound 会显著低于简单比率，自动降低排名

-- Runbook 执行记录
CREATE TABLE aiops_runbook_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runbook_id UUID REFERENCES aiops_runbooks(id),
  alert_id UUID,
  user_id UUID NOT NULL,                 -- 执行者 (或 'system' 用于自愈)
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial', 'timeout')),
  output TEXT,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 12.2.4 推荐逻辑

```typescript
// Phase 1: 匹配逻辑
function recommendRunbooks(alert: Alert): Runbook[] {
  return aiops_runbooks
    .where({ alert_type: alert.type })
    .filter(r => matchServicePattern(r.service_pattern, alert.service))
    .filter(r => !r.severity || r.severity === alert.severity)
    .orderBy('success_rate', 'DESC')
    .limit(5);
}

// 推荐结果格式
interface RunbookAction {
  action: string;        // "扩容 DB 连接池"
  runbookId: string;
  successRate: number;   // 0.82
  totalExecutions: number;
  estimatedDurationMs: number;
  riskLevel: 'low' | 'medium' | 'high';
}
```

#### 12.2.5 前端展示

操作按钮区域动态生成：

```
[当前 - 硬编码]
[查看日志] [诊断根因] [重启 Pod]

[加入 Runbook 引擎后]
推荐操作:
  🔧 扩容 DB 连接池     成功率 82% (98 次)  低风险  [执行]
  🔧 回滚最近 DB 变更   成功率 76% (45 次)  中风险  [执行]
  🔧 重启 api-service   成功率 45% (22 次)  低风险  [执行]

其他操作:
  [查看日志] [诊断根因] [查看详情] [自定义命令]
```

#### 12.2.6 后端 API

```
GET /api/chatops/runbooks/recommend?alertType=xxx&service=xxx
Response: RunbookAction[]

POST /api/chatops/runbooks/:id/execute
Request: { alertId: string, context: {} }
Response: { executionId: string, status: string }

GET /api/chatops/runbooks/executions/:id
Response: { status, output, duration_ms }

-- Admin 管理 (Phase 1)
POST /api/chatops/runbooks       -- 创建 Runbook
PUT  /api/chatops/runbooks/:id   -- 更新 Runbook
DELETE /api/chatops/runbooks/:id -- 删除 Runbook
GET  /api/chatops/runbooks       -- Runbook 列表
```

---

### 12.3 动态基线引擎 (Baseline Engine)

#### 12.3.1 问题定义

固定阈值告警存在两个问题：
1. 正常流量波动（如晚高峰）触发误报
2. 真正的异常在低流量时段可能被忽略（如凌晨 3 点的 0.5% 错误率）

#### 12.3.2 算法 (Phase 1: 轻量统计，无 ML)

```
EWMA (指数加权移动平均):
  baseline(t) = α × value(t) + (1 - α) × baseline(t-1)
  α = 0.3 (默认, 可配置)

动态阈值:
  upper = baseline + 3 × stdDev
  lower = baseline - 3 × stdDev

季节性修正 (Phase 2):
  按 hour_of_day × day_of_week 分组计算基线
  例: 周一 14:00 的基线 ≠ 周日 03:00 的基线
```

#### 12.3.3 数据表

```sql
-- 基线配置
CREATE TABLE aiops_baseline_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,           -- 指标名 (如 'error_rate', 'latency_p99')
  service_name TEXT,                   -- 服务名 (NULL = 全局)
  environment TEXT,                    -- 环境名
  alpha FLOAT DEFAULT 0.3,             -- EWMA 平滑系数
  sigma_multiplier FLOAT DEFAULT 3.0,  -- 标准差倍数
  seasonality_enabled BOOLEAN DEFAULT false, -- Phase 2
  min_data_points INT DEFAULT 100,     -- 最少数据点数
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 基线快照 (定期更新)
CREATE TABLE aiops_baseline_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  service_name TEXT,
  environment TEXT,
  baseline_value FLOAT,
  std_dev FLOAT,
  upper_threshold FLOAT,
  lower_threshold FLOAT,
  data_points_count INT,
  computed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(metric_name, COALESCE(service_name, ''), COALESCE(environment, ''), DATE(computed_at))
);

-- EWMA 数据质量检查:
-- 1. 异常值过滤: 使用 IQR 方法过滤极端值后再计算 EWMA
--    Q1 = 25th percentile, Q3 = 75th percentile
--    IQR = Q3 - Q1
--    有效范围: [Q1 - 1.5*IQR, Q3 + 1.5*IQR]
--    超出范围的数据点不参与 EWMA 计算
-- 2. 数据点不足: min_data_points < 100 时，降级为固定阈值
-- 3. 冷启动: 新服务/新指标前 24h 使用固定阈值，积累足够数据后自动切换

-- 异常检测记录
CREATE TABLE aiops_anomaly_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  service_name TEXT,
  actual_value FLOAT NOT NULL,
  baseline_value FLOAT,
  deviation FLOAT,                     -- 偏离标准差倍数
  is_anomaly BOOLEAN NOT NULL,
  alert_generated BOOLEAN DEFAULT false, -- 是否触发了告警
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 12.3.4 使用方式

```
推荐面板的告警生成逻辑变更:

[当前]  monitoring.alerts WHERE error_rate > 1.0  → 推送
[加入基线后]
  1. 获取当前 error_rate = 0.8%
  2. 查询基线: baseline = 0.3%, stdDev = 0.1%, upper = 0.6%
  3. 判断: 0.8% > 0.6% → 偏离 5σ → 异常!
  4. 推送告警，附带基线对比:
     "当前错误率 0.8%，基线 0.3% ± 0.1%，偏离 5σ"
```

#### 12.3.5 后端 API

```
POST /api/chatops/baseline/check
Request: { metric: string, service: string, value: number }
Response: {
  isAnomaly: boolean,
  actualValue: number,
  baseline: number,
  deviation: number,
  upperThreshold: number,
  lowerThreshold: number
}

GET /api/chatops/baseline/:metric?service=xxx&env=xxx
Response: { baseline, stdDev, thresholds, history: [{time, value}] }
```

---

### 12.4 变更影响分析引擎 (Change Impact Analyzer)

#### 12.4.1 问题定义

80% 的生产故障由变更引起。当前设计在部署前/后没有影响分析能力。

#### 12.4.2 分析维度

```
输入: 即将部署的版本 + 目标环境
  ↓
Step 1: 查询 CMDB 拓扑 → 该环境的所有下游依赖服务
  ↓
Step 2: 对比变更范围
  - API 变更: 从 Git diff 获取 OpenAPI spec 差异
    * 数据源: Git repo 中 OpenAPI spec 文件的版本对比
    * 工具: openapi-diff 库或 GitLab/GitHub API 的 commit diff
    * 输出: 新增/修改/废弃的 API 端点列表
  - 配置变更: 从 Pipeline artifact 获取 ConfigMap 差异
    * 数据源: Pipeline 构建产物中的 config diff
    * 输出: 环境变量/ConfigMap 的 key 变更 (值脱敏)
  - 资源变更: 从部署清单获取资源差异
    * 数据源: Kubernetes Deployment spec diff
    * 输出: CPU/内存/副本数/镜像版本变更
  ↓
Step 3: 评估影响面
  - 直接依赖: 调用此服务的上游服务
  - 间接依赖: 上游服务的上游 (传递闭包)
  - 数据层: 涉及的数据库/缓存变更
  ↓
Step 4: 结合历史变更后果 (aiops_change_history)
  - 该服务上次部署是否导致故障?
  - 类似变更 (同服务/同环境) 的成功率?
  ↓
Step 5: 输出影响报告
```

#### 12.4.3 数据表

```sql
-- 变更影响分析记录
CREATE TABLE aiops_change_impact_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_type TEXT NOT NULL CHECK (change_type IN ('deployment', 'config_change', 'infra_change')),
  source_version TEXT,                 -- 变更前的版本
  target_version TEXT,                 -- 变更后的版本
  target_environment TEXT NOT NULL,
  target_service TEXT NOT NULL,
  -- 分析结果
  affected_services JSONB,             -- [{name, dependency_depth, impact_level}]
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_factors TEXT[],                 -- 风险因素列表
  rollback_available BOOLEAN,
  rollback_point TEXT,                 -- 可回滚的版本/快照
  analysis_summary TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 历史变更后果记录 (用于预测)
CREATE TABLE aiops_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_type TEXT NOT NULL,
  service_name TEXT NOT NULL,
  version_from TEXT,
  version_to TEXT,
  environment TEXT,
  -- 后果
  caused_incident BOOLEAN DEFAULT false,
  incident_severity TEXT,              -- 如果导致了故障
  incident_description TEXT,
  recovery_time_minutes INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 12.4.4 前端展示

部署前的 ChatOps 智能提示：

```
┌─ 变更影响分析 ──────────────────────────────┐
│ 📋 部署 v2.2.0 → production (api-service)   │
│                                               │
│ 风险等级: 🟡 中等                            │
│                                               │
│ 影响服务 (8 个):                             │
│   🔴 直接影响 (3):                           │
│     • frontend-web (调用 /api/users)         │
│     • mobile-backend (调用 /api/auth)        │
│     • notification-service (调用 /api/events) │
│   🟡 间接影响 (5):                           │
│     • email-worker, push-service, ...        │
│                                               │
│ 变更对比:                                     │
│   • API: 2 个新接口, 1 个废弃接口 ⚠️         │
│   • 配置: DB_POOL_SIZE 50 → 100              │
│   • 资源: CPU 2 → 4, Memory 4G → 8G          │
│                                               │
│ 历史参考: 该服务上次部署导致了 1 次 P1 故障  │
│                                               │
│ 回滚点: v2.1.0 (稳定运行 14 天)              │
│                                               │
│ [确认部署] [查看详情] [取消]                  │
└───────────────────────────────────────────────┘
```

#### 12.4.5 后端 API

```
POST /api/chatops/change/analyze
Request: {
  changeType: 'deployment',
  service: string,
  fromVersion: string,
  toVersion: string,
  environment: string
}
Response: ChangeImpactReport

GET /api/chatops/change/history?service=xxx
Response: ChangeHistoryEntry[]  -- 历史变更及后果
```

---

### 12.5 AIOps 模块间协作关系

```
                    ┌─────────────────────┐
                    │   告警/事件到达       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  动态基线引擎        │ ← 判断是否为真正异常
                    │  (是否偏离基线?)     │
                    └──────────┬──────────┘
                               │ 是异常
                    ┌──────────▼──────────┐
                    │  根因分析引擎        │ ← 找到根因 + 影响链
                    │  (谁是根因?)         │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Runbook 推荐引擎   │ ← 推荐修复操作
                    │  (怎么修?)          │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  ChatOps 面板展示    │
                    │  (告警 + 根因 + 操作) │
                    └─────────────────────┘

部署/变更前:
  变更影响分析引擎 → 评估影响 → ChatOps 展示影响报告 → 用户确认 → 执行部署
```

---

## 14. ChatOps 统一配置面板

> 评审补充: 当前设计涉及 8+ 类配置 (通知偏好、DND、降噪、升级、订阅、基线、Runbook、TTL)，需要统一的配置入口和 UI。

### 13.1 配置入口

**入口 1: Chat 面板设置按钮**
- Chat 面板 Header → 齿轮图标 → 弹出配置 Drawer
- 适用于: 用户级配置 (通知偏好、DND、订阅)

**入口 2: 独立管理页面**
- `/settings/chatops` → 全量配置管理 (Admin)
- 适用于: 系统级配置 (降噪规则、升级策略、Runbook 库、基线配置、TTL 策略)

### 13.2 配置面板结构

```
┌─ ChatOps 设置 ──────────────────────────────────┐
│ [← 返回]                                        │
│                                                 │
│ ┌─ 侧边导航 ─┐  ┌─ 配置内容区 ──────────────────┐│
│ │ 通知偏好    │  │ 通知渠道设置                   ││
│ │ 免打扰      │  │                                ││
│ │ 我的订阅    │  │ ┌─────────────────────────┐   ││
│ │             │  │ │ 告警级别 │ Chat │ 邮件 │   ││
│ │ ── Admin 区 ─│  │ ├─────────────────────────┤   ││
│ │ 降噪规则    │  │ │ Critical  │ ☑  │ ☐  │   ││
│ │ 升级策略    │  │ │ Warning   │ ☑  │ ☐  │   ││
│ │ Runbook 库  │  │ │ Info      │ ☐  │ ☐  │   ││
│ │ 基线配置    │  │ └─────────────────────────┘   ││
│ │ TTL 策略    │  │                                ││
│ │             │  │ [保存] [重置默认]              ││
│ └────────────┘  └────────────────────────────────┘│
└────────────────────────────────────────────────────┘
```

### 13.3 配置项清单

| Tab | 配置项 | 范围 | 默认值 | 权限 |
|-----|-------|------|-------|------|
| 通知偏好 | 各告警级别的通知渠道 | 用户级 | ChatOps 开启, 其余关闭 | 所有用户 |
| 免打扰 | DND 时段 + 重复 + Critical 例外 | 用户级 | 关闭 | 所有用户 |
| 我的订阅 | 资源订阅列表 | 用户级 | 空 | 所有用户 |
| 降噪规则 | 聚合阈值 + 规则启用/禁用 | 系统级 | 静态阈值 | Admin |
| 升级策略 | 升级阶梯 (时间 + 目标) | 系统级 | 15/30/60min | Admin |
| Runbook 库 | 告警类型 → 操作步骤 CRUD | 系统级 | 空 | Admin |
| 基线配置 | 指标 EWMA 参数 + 冷启动策略 | 系统级 | α=0.3, σ=3.0 | Admin + SRE |
| TTL 策略 | 全局/角色/项目/告警级别 TTL | 系统级 | 90 天 | Admin |

### 13.4 配置持久化

所有配置变更后：
1. 写入对应数据库表
2. 发布 EventBus 事件 `chatops.config_changed`
3. 前端 Zustand Store 订阅事件，热更新配置 (无需刷新页面)
4. 操作审计: 写入 `chatops_audit_logs` (谁、何时、改了什么)

---

## 15. 实现阶段

### Phase 1a（优先）— ChatOps 核心交互

**前端 (14 项)**:
- [ ] ChatTrigger 悬浮按钮（状态指示 + 上下文感知 + 徽标 + z-index token）
- [ ] ChatPanel 侧边栏容器 + 浅色主题 + 响应式宽度 (360-480px)
- [ ] SmartRecommend 推荐面板（告警/阻塞卡片 + 空状态处理）
- [ ] ChatInput 输入框 + Slash 快捷命令 + AutoComplete 交互
- [ ] 命令解析引擎（关键词匹配 + 白名单 + JSON Schema 校验 + 特殊字符拦截）
- [ ] ChatMessage + ActionCard 组件（动态操作按钮）
- [ ] 滚动行为管理（自动滚动到底部 + 暂停 + "新消息"按钮）
- [ ] chatOpsStore Zustand Store
- [ ] 通知偏好设置 UI（渠道选择）
- [ ] DND 设置 UI（时段 + 快捷开关）
- [ ] 已读/未读状态交互（徽标 + 状态流转）
- [ ] 虚拟滚动集成（react-window / VirtualList）
- [ ] 浏览器内存监控（超过 100MB 主动清理）
- [ ] 分页加载（按需拉取历史，最多 500 条内存保留）

**后端 (15 项)**:
- [ ] POST /api/chatops/execute API（命令执行 + 幂等性 + idempotency_key）
- [ ] 命令输入安全校验（白名单 + 特殊字符过滤 + JSON Schema + 敏感参数拦截）
- [ ] 双层权限校验中间件
- [ ] 命令路由分发（对接现有 API + SelfHealing 集成）
- [ ] POST /api/chatops/recommendations API（推荐面板数据聚合）
- [ ] GET /api/chatops/commands API（可用命令列表）
- [ ] GET /api/chatops/sessions/:id/messages API（分页查询）
- [ ] EventBus 事件订阅（alert.created, pipeline.updated, deploy.finished, selfhealing.failed）
- [ ] 通知偏好 CRUD API
- [ ] DND 设置 CRUD API
- [ ] 已读状态管理 API
- [ ] chatops_sessions / messages / executions / audit_logs 表创建 + 索引
- [ ] L1 → L3 数据写入链路
- [ ] 执行 API 幂等性 (Redis idempotency_key + 降级策略)
- [ ] EventBus 驱动推荐面板实时更新 (替代轮询)

**数据库 (2 项)**:
- [ ] pgcrypto 扩展启用
- [ ] 核心表索引创建

**Phase 1a 总计: 31 个任务**

### Phase 1b — 信息控制 + 轻量 AIOps

**信息控制 (10 项)**:
- [ ] 订阅管理 CRUD API + 前端 UI
- [ ] 告警风暴降噪引擎（聚合规则 + 动态阈值）
- [ ] 升级策略引擎（定时检查 + 已确认停止 + 2min 间隔）
- [ ] DND 结束后摘要推送
- [ ] 通知历史归档 + 分页（最多 100 条前端保留）

**AIOps 引擎 (15 项)**:
- [ ] RCA 引擎基础版（时间 + 拓扑关联 + 多根因 + 因果权重公式）
- [ ] POST /api/chatops/rca/analyze API
- [ ] GET /api/chatops/rca/groups API
- [ ] aiops_service_topology / aiops_rca_results / aiops_alert_groups / aiops_group_members 表
- [ ] CMDB 拓扑数据同步（全量初始化 + EventBus 增量 + 5min 兜底）
- [ ] RCA 影响链可视化组件（垂直时间线 + 折叠）
- [ ] Runbook 推荐引擎（手动库 + 匹配逻辑 + Wilson Score）
- [ ] GET /api/chatops/runbooks/recommend API
- [ ] POST /api/chatops/runbooks/:id/execute API
- [ ] Runbook CRUD API（Admin 管理）
- [ ] aiops_runbooks (含版本管理) / aiops_runbook_executions 表
- [ ] 动态基线引擎（EWMA + IQR 异常值过滤 + 冷启动降级）
- [ ] POST /api/chatops/baseline/check API
- [ ] aiops_baseline_configs / aiops_baseline_snapshots / aiops_anomaly_records 表
- [ ] 变更影响分析引擎（拓扑依赖 + Git diff + Pipeline artifact）
- [ ] POST /api/chatops/change/analyze API
- [ ] aiops_change_impact_analyses / aiops_change_history 表

**配置面板 (8 项)**:
- [ ] 统一配置面板前端（侧边导航 + 配置内容区）
- [ ] 通知偏好 + DND + 订阅 Tab
- [ ] Admin 配置面板（降噪规则 + 升级策略 + Runbook + 基线 + TTL）
- [ ] 配置热更新（EventBus config_changed → Zustand 订阅）
- [ ] 配置变更审计
- [ ] POST /api/chatops/metrics API（ChatOps 自身可观测性）

**数据库 (2 项)**:
- [ ] AIOps 表迁移脚本 + 索引
- [ ] TTL 自动清理定时任务（分批删除）

**Phase 1b 总计: 35 个任务**

**Phase 1 总计: 66 个任务 (1a: 31 + 1b: 35)**

### Phase 2 — 数据驱动
- [ ] 后端：Redis 缓存层 (L2)
- [ ] 前端：WebSocket 实时进度推送
- [ ] 后端：对话原文加密存储 (pgcrypto)
- [ ] 前端：跳转详情页高亮
- [ ] 后端：降噪规则管理 API
- [ ] 后端：升级策略管理 API
- [ ] 后端：Vector DB 集成（接入 vector-store-routes）
- [ ] 后端：历史事件知识库（RAG 检索）
- [ ] 后端：动态基线增强（季节性分解）
- [ ] 后端：RCA 引擎增强（时间序列相关性分析）
- [ ] 后端：Runbook 自动学习（从执行记录更新成功率）

### Phase 3 — AI 驱动
- [ ] 后端：LLM 意图解析接口
- [ ] 外部 IM 适配器（Slack/飞书/钉钉）
- [ ] 前端：语音输入
- [ ] 后端：对话分析（操作模式识别）
- [ ] 后端：LLM 生成个性化 Runbook
- [ ] 后端：变更影响预测（基于历史变更后果）
- [ ] 后端：容量预测引擎
- [ ] 后端：自动 Postmortem 生成

---

## 16. 风险与依赖

| 风险 | 影响 | 缓解 |
|------|------|------|
| pgcrypto 扩展未启用 | 对话加密失效 | 数据库迁移脚本中检查并启用 |
| Redis 不可用 | L2 缓存 + 幂等性降级 | Phase 1a 跳过 L2，幂等性降级为命令去重 |
| EventBus 不稳定 | 推荐面板实时推送失效 | 降级为 60s 兜底轮询 |
| 命令解析覆盖率不足 | 用户自然语言无法识别 | 白名单快速失败 + 预留 LLM fallback |
| 权限模型与现有 RBAC 不一致 | 权限校验失效 | 复用现有 role/user_resources 表 |
| 告警风暴导致数据库写入压力 | 数据库性能下降 | 降噪聚合后再写入 + 分批删除 |
| 升级策略与 OnCall 系统冲突 | 重复通知 | 升级策略读取 OnCall 排班表，避免重复 |
| CMDB 拓扑数据不完整 | RCA 因果链分析准确率下降 | Phase 1 使用已知依赖 + 手动补充 |
| 历史数据不足 | 基线引擎初期误报 | 冷启动期使用固定阈值，积累数据后切换 |
| AIOps 推荐操作被误执行 | 生产事故 | 所有操作仍需用户确认 + 双层权限校验 |
| 浏览器内存溢出 | 页面卡顿/崩溃 | 虚拟滚动 + 500 条内存上限 + 自动清理 |
| 虚拟滚动与变高消息不兼容 | 消息重叠/空白 | 使用 DynamicSizeList + ResizeObserver 测量实际高度 |

## 17. AIOps 能力成熟度路线图

```
Phase 1 (当前): 规则驱动 AIOps
  根因分析: 拓扑关联 + 时间差 → 因果链 (无 ML)
  Runbook: 手动库 + 精确匹配
  基线: EWMA 统计算法 (无 ML)
  变更影响: 拓扑依赖分析 (无 ML)
  → 目标: 告警卡片从"发生了什么"变为"为什么发生 + 怎么修"

Phase 2: 数据驱动 AIOps
  根因分析: 加入时间序列相关性 (Pearson/DTW)
  Runbook: Vector DB RAG 检索 (历史修复记录)
  基线: 季节性分解 (按小时/星期分组)
  变更影响: 基于历史后果预测
  → 目标: 推荐准确率 > 70%，减少人工 Runbook 维护

Phase 3: AI 驱动 AIOps
  根因分析: LLM 辅助解释复杂因果链
  Runbook: LLM 生成个性化操作建议
  基线: 异常检测 ML 模型 (Isolation Forest)
  容量预测: 趋势预测 + 预警
  → 目标: 运维人员从"排查问题"变为"确认 AI 建议"
```
