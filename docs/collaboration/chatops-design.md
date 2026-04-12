# ChatOps Design (ChatOps 设计)

**文档版本**: v1.0  
**创建日期**: 2026-04-10  
**优先级**: P2  
**状态**: 待评审  
**作者**: Orion Architecture Team  
**评审人**: 平台基础团队、安全与合规团队  

---

## 执行摘要 (Executive Summary)

本设计文档详细描述 Orion Design 平台的 ChatOps（聊天运维）系统架构与实现方案。ChatOps 将运维工具、流程和人员集中在即时通讯（IM）平台中，通过命令驱动的方式完成日常开发与运维任务，实现"对话即运维"的协作模式。

### 设计范围

| 设计领域 | 核心内容 | 优先级 |
|---------|---------|--------|
| ChatOps 架构 | IM 集成、命令解析、执行引擎、反馈机制 | P0 |
| IM 平台集成 | 钉钉/企微/飞书/Slack 适配器 | P1 |
| 命令语法 | 自然语言命令、结构化命令、命令别名 | P1 |
| 命令解析 | 意图识别、参数提取、上下文理解 | P1 |
| 命令执行 | 权限验证、命令路由、执行跟踪 | P0 |
| 命令分类 | 查询类、操作类、审批类、通知类 | P2 |
| 交互式命令 | 卡片消息、按钮交互、表单填写 | P2 |
| 审计日志 | 谁、何时、执行了什么、结果如何 | P1 |
| 速率限制 | 用户限流、频道限流、命令限流 | P2 |
| ChatOps 机器人 | 人格化设计、主动通知、智能推荐 | P3 |

### 预期收益量化

| 指标 | 当前状态 | ChatOps 后目标 | 改善幅度 |
|------|---------|---------------|---------|
| 运维响应时间 | 5 分钟（登录系统） | 30 秒（IM 命令） | 90% |
| 操作可追溯性 | 分散日志 | 统一审计 | 100% |
| 新人上手成本 | 2 周（学习多个系统） | 3 天（学习命令集） | 78% |
| 误操作率 | 5%（GUI 误点击） | 1%（命令确认） | 80% |
| 通知到达率 | 70%（邮件/短信） | 99%（IM 推送） | 41% |

---

## 一、ChatOps 架构设计 (ChatOps Architecture)

### 1.1 整体架构概览

ChatOps 系统采用分层架构设计，自下而上分为：IM 适配层、命令解析层、执行引擎层、业务服务层。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ChatOps Overall Architecture                        │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              User Layer (用户层)                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   钉钉       │  │   企业微信   │  │    飞书     │  │   Slack     │            │
│  │   用户       │  │   用户      │  │   用户      │  │   用户      │            │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            IM Adapter Layer (IM 适配层)                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │ DingTalkAdapter │  │  WeComAdapter   │  │ FeishuAdapter   │  SlackAdapter   │
│  │                 │  │                 │  │                 │                 │
│  │ - 消息接收      │  │ - 消息接收      │  │ - 消息接收      │  - 消息接收     │
│  │ - 消息发送      │  │ - 消息发送      │  │ - 消息发送      │  - 消息发送     │
│  │ - 卡片渲染      │  │ - 卡片渲染      │  │ - 卡片渲染      │  - Block Kit    │
│  │ - 回调处理      │  │ - 回调处理      │  │ - 回调处理      │  - 回调处理     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └───────┬───────┘
│           │                    │                    │                    │
│           └────────────────────┴─────────┬─────────┴────────────────────┘
└──────────────────────────────────────────┼─────────────────────────────────────
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Message Gateway (消息网关)                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  - 消息统一格式化 (Unified Message Format)                               │    │
│  │  - 消息去重 (Deduplication)                                              │    │
│  │  - 消息路由 (Message Routing)                                            │    │
│  │  - 速率限制 (Rate Limiting)                                              │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Command Parser Layer (命令解析层)                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │ Command Matcher │  │ Parameter Parser│  │ Context Manager │                 │
│  │                 │  │                 │  │                 │                 │
│  │ - 命令识别      │  │ - 参数提取      │  │ - 上下文存储    │                 │
│  │ - 意图识别      │  │ - 类型转换      │  │ - 会话状态      │                 │
│  │ - 命令别名      │  │ - 默认值填充    │  │ - 多轮对话      │                 │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                 │
│           │                    │                    │                          │
│           └────────────────────┴─────────┬─────────┴────────────────────┘
└──────────────────────────────────────────┼─────────────────────────────────────
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       Execution Engine Layer (执行引擎层)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │ Permission      │  │ Command Router  │  │ Execution       │                 │
│  │ Validator       │  │                 │  │ Tracker         │                 │
│  │                 │  │                 │  │                 │                 │
│  │ - RBAC 验证      │  │ - 命令分发      │  │ - 状态跟踪      │                 │
│  │ - 权限检查      │  │ - 服务调用      │  │ - 超时处理      │                 │
│  │ - 审计记录      │  │ - 结果聚合      │  │ - 重试机制      │                 │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                 │
│           │                    │                    │                          │
│           └────────────────────┴─────────┬─────────┴────────────────────┘
└──────────────────────────────────────────┼─────────────────────────────────────
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Business Service Layer (业务服务层)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Pipeline   │  │   Deploy    │  │  Approval   │  │ Monitoring  │            │
│  │  Service    │  │   Service   │  │  Service    │  │  Service    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Data Layer (数据层)                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  PostgreSQL │  │    Redis    │  │  NATS       │  │    MinIO    │            │
│  │  (审计日志)  │  │  (缓存/会话)│  │  (事件总线)  │  │  (文件存储)  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心组件职责

| 组件 | 职责 | 关键功能 | 技术选型 |
|------|------|---------|---------|
| **IM Adapter** | 平台适配 | 消息收发、卡片渲染、回调处理 | 各平台 SDK |
| **Message Gateway** | 消息网关 | 格式统一、去重、路由、限流 | Go/Node.js |
| **Command Parser** | 命令解析 | 命令识别、参数提取、上下文管理 | TypeScript |
| **Execution Engine** | 执行引擎 | 权限验证、命令路由、执行跟踪 | TypeScript |
| **Audit Logger** | 审计日志 | 操作记录、查询分析、合规报告 | PostgreSQL + ES |

### 1.3 架构设计原则

| 原则 | 说明 | 违反示例 | 正确示例 |
|------|------|---------|---------|
| **适配器模式** | IM 平台差异通过适配器屏蔽 | 业务逻辑直接调用钉钉 API | 业务逻辑调用统一接口 |
| **命令与查询分离** | 查询类与操作类命令分离处理 | 查询命令也写审计日志 | 查询命令只读不写 |
| **幂等性** | 同一命令多次执行结果一致 | /deploy 多次触发多次部署 | 幂等键防止重复执行 |
| **最小权限** | 命令执行使用最小必要权限 | 所有命令使用管理员权限 | 按命令类型动态授权 |
| **可追溯性** | 所有操作可追溯到发起人 | 审计日志只记录命令 | 记录用户、时间、参数、结果 |

---

## 二、IM 平台集成设计 (IM Platform Integration)

### 2.1 IM 适配器架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         IM Adapter Architecture                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                            IMAdapterFactory                                      │
│                                                                                  │
│  +create(platform: string): IMAdapter                                           │
│  +register(platform: string, adapter: IMAdapter): void                          │
│  +get(platform: string): IMAdapter                                              │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │                         │                         │
            ▼                         ▼                         ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│ DingTalkAdapter   │     │  WeComAdapter     │     │ FeishuAdapter     │
│                   │     │                   │     │                   │
│ - webhook       │     │ - webhook       │     │ - webhook       │
│ - secret        │     │ - corpId        │     │ - appId         │
│ - cardTemplate  │     │ - cardTemplate  │     │ - cardTemplate  │
└────────┬──────────┘     └────────┬──────────┘     └────────┬──────────┘
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              IMAdapter Interface                                 │
│                                                                                  │
│  +send(message: Message): Promise<void>                                         │
│  +sendInteractive(message: InteractiveMessage): Promise<void>                   │
│  +handleCallback(callback: CallbackEvent): Promise<void>                        │
│  +parseUser(event: MessageEvent): User                                          │
│  +parseChannel(event: MessageEvent): Channel                                    │
│  +renderCard(card: Card): PlatformMessage                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 平台特性对比

| 特性 | 钉钉 | 企业微信 | 飞书 | Slack |
|------|------|---------|------|-------|
| **接入方式** | 机器人 Webhook | 机器人 Webhook | 机器人 Webhook | Bot API |
| **消息类型** | 文本/Markdown/卡片 | 文本/模板卡片 | 富文本/交互卡片 | Block Kit |
| **交互能力** | 按钮/下拉框 | 按钮/菜单 | 按钮/表单/多选 | 丰富交互 |
| **回调机制** | HTTP 回调 | HTTP 回调 | HTTP 回调 | Events API |
| **加签验证** | HMAC-SHA256 | HMAC-SHA256 | HMAC-SHA256 | Signing Secret |
| **消息长度** | 4000 字 | 4000 字 | 10000 字 | 4000 字符 |
| **费率限制** | 20 条/秒 | 20 条/秒 | 35 条/秒 | 1 条/秒 |

### 2.3 钉钉适配器详解

```yaml
# 钉钉机器人配置
platform: dingtalk
config:
  webhook: https://oapi.dingtalk.com/robot/send?access_token=${TOKEN}
  secret: ${SECRET}  # 加签密钥，用于验证消息来源
  message_type: interactive_card
  
# 卡片模板配置
card_template:
  type: markdown
  version: "1.0"
  header:
    title: "Orion Design ChatOps"
    bgcolor: "#007BFF"
  body:
    - type: markdown
      content: |
        ## ${title}
        **状态**: ${status}
        ${content}
  footer:
    - type: button
      label: "查看详情"
      action:
        type: "link"
        url: "${detail_url}"
    - type: button
      label: "确认执行"
      action:
        type: "callback"
        key: "confirm_action"
        
# 交互组件支持
interactive_components:
  buttons: true
  dropdown: true
  date_picker: true
  input_field: true
  
# 回调处理
callback_config:
  verify_token: ${VERIFY_TOKEN}
  decrypt_key: ${DECRYPT_KEY}
```

### 2.4 企业微信适配器详解

```yaml
# 企业微信机器人配置
platform: wecom
config:
  webhook: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${KEY}
  corp_id: ${CORP_ID}
  agent_id: ${AGENT_ID}
  message_type: template_card
  
# 卡片模板配置
card_template:
  card_type: text_notice
  source:
    icon_url: "https://orion.design/logo.png"
    desc: "ChatOps"
  main_title:
    title: "${title}"
    desc: "${subtitle}"
  emphasis_content:
    title: "${status}"
    desc: "${message}"
  sub_button_text: "操作"
  sub_button_url: "${action_url}"
  
# 交互组件支持
interactive_components:
  buttons: true
  menu: true
  date_picker: false
  input_field: false
  
# 回调处理
callback_config:
  token: ${TOKEN}
  encoding_aes_key: ${ENCODING_AES_KEY}
```

### 2.5 飞书适配器详解

```yaml
# 飞书机器人配置
platform: feishu
config:
  webhook: https://open.feishu.cn/open-apis/bot/v2/hook/${TOKEN}
  app_id: ${APP_ID}
  app_secret: ${APP_SECRET}
  message_type: interactive
  
# 卡片模板配置
card_template:
  config:
    wide_screen_mode: true
    enable_forward: true
  elements:
    - tag: header
      text:
        tag: plain_text
        content: "🤖 Orion ChatOps"
    - tag: div
      text:
        tag: lark_md
        content: |
          **${title}**
          ${content}
    - tag: action
      elements:
        - tag: button
          text:
            tag: plain_text
            content: "确认"
          type: primary
          value:
            action: "confirm"
            command_id: "${command_id}"
            
# 交互组件支持
interactive_components:
  buttons: true
  select_menu: true
  date_picker: true
  input_field: true
  multi_select: true
  
# 回调处理
callback_config:
  verification_token: ${VERIFICATION_TOKEN}
  encrypt_key: ${ENCRYPT_KEY}
```

### 2.6 Slack 适配器详解

```yaml
# Slack Bot 配置
platform: slack
config:
  bot_token: xoxb-${BOT_TOKEN}
  signing_secret: ${SIGNING_SECRET}
  app_id: ${APP_ID}
  
# Block Kit 配置
block_kit:
  type: message
  blocks:
    - type: header
      text:
        type: plain_text
        text: "🤖 Orion Design ChatOps"
        emoji: true
    - type: section
      text:
        type: mrkdwn
        text: "*${title}*\n${content}"
    - type: divider
    - type: actions
      elements:
        - type: button
          text:
            type: plain_text
            text: "Approve"
            emoji: true
          value: "approve_action"
          style: primary
        - type: button
          text:
            type: plain_text
            text: "Reject"
            emoji: true
          value: "reject_action"
          style: danger
          
# 交互组件支持
interactive_components:
  buttons: true
  static_select: true
  multi_static_select: true
  datepicker: true
  plain_text_input: true
  overflow_menu: true
  
# 回调处理
callback_config:
  interactions_endpoint: "/api/chatops/slack/interactions"
  events_endpoint: "/api/chatops/slack/events"
```

### 2.7 统一消息格式

```typescript
// 统一消息接口定义
interface Message {
  id: string;                    // 消息唯一 ID
  platform: string;              // 来源平台
  channel: Channel;              // 发送频道
  user: User;                    // 发送用户
  content: string;               // 消息内容
  timestamp: number;             // 消息时间戳
  threadTs?: string;             // 线程 ID（用于回复）
  raw?: any;                     // 原始消息对象
}

// 统一用户接口
interface User {
  id: string;                    // 平台用户 ID
  name: string;                  // 显示名称
  email?: string;                // 邮箱
  avatar?: string;               // 头像 URL
  platform: string;              // 来源平台
  raw?: any;                     // 原始用户对象
}

// 统一频道接口
interface Channel {
  id: string;                    // 频道 ID
  name: string;                  // 频道名称
  type: 'public' | 'private' | 'dm';
  platform: string;              // 来源平台
}

// 交互式消息
interface InteractiveMessage {
  id: string;
  platform: string;
  channel: Channel;
  card: Card;                    // 卡片内容
  attachments?: Attachment[];    // 附件
}

// 卡片定义
interface Card {
  type: 'simple' | 'detailed' | 'form';
  header: CardHeader;
  body: CardElement[];
  footer?: CardAction[];
}

// 回调事件
interface CallbackEvent {
  id: string;
  platform: string;
  type: 'button_click' | 'menu_select' | 'form_submit';
  actionId: string;
  value: any;
  user: User;
  channel: Channel;
  timestamp: number;
}
```

---

## 三、命令语法设计 (Command Syntax Design)

### 3.1 命令语法总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Command Syntax Overview                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

命令格式 BNF 范式:

<command> ::= <prefix> <main_command> [<subcommand>] [<parameters>] [<flags>]
<prefix> ::= "/" | "!" | "@"
<main_command> ::= <identifier>
<subcommand> ::= <identifier>
<parameters> ::= <parameter> [<parameters>]
<parameter> ::= <named_param> | <positional_param>
<named_param> ::= "--" <identifier> ["=" <value>]
<positional_param> ::= <value>
<flags> ::= <flag> [<flags>]
<flag> ::= "-" <char> | "--" <identifier>
<identifier> ::= [a-z][a-z0-9_-]*
<value> ::= <string> | <number> | <boolean>

示例:
/pipeline run --repo=frontend --branch=main --async
/deploy preview --app=api --env=staging
/status pipeline 123 --detail
```

### 3.2 自然语言命令

自然语言命令允许用户以接近日常语言的方式输入命令，降低学习成本。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Natural Language Commands                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

自然语言 → 结构化命令 映射:

用户输入                          →  结构化命令
─────────────────────────────────────────────────────────────────────────
"帮我部署 api 到生产环境"          →  /deploy --app=api --env=prod
"查看流水线 123 的状态"            →  /status pipeline 123
"批准这个发布"                     →  /approve ${current_pending_id}
"回滚 api 到上一个版本"            →  /rollback --app=api --target=previous
"扩容 api 到 10 个实例"             →  /scale --app=api --replicas=10
"创建一个 P1 事件，API 报错"        →  /incident --severity=P1 --desc="API 报错"

自然语言解析规则:
├── 动词识别：部署→deploy, 查看→status, 批准→approve, 回滚→rollback
├── 实体识别：api→app_name, 生产环境→env=prod, P1→severity
├── 意图识别：根据动词和上下文确定命令类型
└── 参数填充：提取命名实体填充命令参数
```

### 3.3 结构化命令

结构化命令提供精确的参数控制，适合复杂操作。

```yaml
# 结构化命令格式
command_format:
  basic: "/{command} {subcommand} [options] [arguments]"
  
# 参数类型定义
parameter_types:
  string:
    format: "--param=value" or "--param value"
    example: "--repo=frontend"
  number:
    format: "--param=<number>"
    example: "--replicas=10"
  boolean:
    format: "--flag" (no value needed)
    example: "--async"
  positional:
    format: "<value>" (no prefix)
    example: "/status pipeline 123"
  enum:
    format: "--param=<allowed_value>"
    example: "--env=prod|staging|dev"
  array:
    format: "--param=item1,item2,item3"
    example: "--apps=api,web,worker"
```

### 3.4 命令别名设计

```yaml
# 命令别名配置
command_aliases:
  # 主命令别名
  pipeline:
    - "pipe"
    - "ci"
    - "build"
  deploy:
    - "dep"
    - "release"
    - "publish"
  status:
    - "st"
    - "check"
    - "get"
  approve:
    - "app"
    - "yes"
    - "✔️"
  reject:
    - "rej"
    - "no"
    - "❌"
  rollback:
    - "roll"
    - "revert"
    - "undo"
  scale:
    - "sc"
    - "resize"
  incident:
    - "inc"
    - "alert"
    - "emergency"
    
  # 子命令别名
  pipeline_run:
    - "pipeline start"
    - "pipe run"
  pipeline_cancel:
    - "pipeline stop"
    - "pipe abort"
  deploy_preview:
    - "deploy dry-run"
    - "dep check"
    
  # 快捷短语
  shortcuts:
    "deploy prod": "/deploy --env=prod"
    "deploy staging": "/deploy --env=staging"
    "scale up": "/scale --replicas=+1"
    "scale down": "/scale --replicas=-1"
```

### 3.5 命令语法验证

```typescript
// 命令语法验证器
class CommandSyntaxValidator {
  // 命令格式验证
  validateSyntax(input: string): ValidationResult {
    const patterns = {
      // 基本命令格式
      basic: /^\/[a-z]+(\s+[a-z]+)?(\s+.*)?$/i,
      
      // 命名参数格式
      namedParam: /--([a-z0-9_-]+)(?:=([^\s]+))?/gi,
      
      // 位置参数
      positional: /\s+([^\s-]+)(?!\s+--)/g,
      
      // 标志参数
      flag: /--[a-z0-9-]+(?!=\S+)/gi,
    };
    
    // 验证命令前缀
    if (!input.startsWith('/')) {
      return { valid: false, error: '命令必须以 / 开头' };
    }
    
    // 验证命令格式
    if (!patterns.basic.test(input)) {
      return { valid: false, error: '命令格式不正确' };
    }
    
    return { valid: true };
  }
  
  // 参数完整性验证
  validateParams(command: string, params: ParsedParams): ValidationResult {
    const schema = COMMAND_SCHEMAS[command];
    if (!schema) {
      return { valid: false, error: `未知命令：${command}` };
    }
    
    // 检查必需参数
    for (const required of schema.requiredParams || []) {
      if (!(required in params.named)) {
        return { 
          valid: false, 
          error: `缺少必需参数：--${required}`,
          suggestion: `完整格式：${schema.usage}`
        };
      }
    }
    
    // 检查参数类型
    for (const [key, value] of Object.entries(params.named)) {
      const paramSchema = schema.params?.[key];
      if (paramSchema && !this.validateType(value, paramSchema.type)) {
        return {
          valid: false,
          error: `参数 --${key} 类型错误，期望：${paramSchema.type}`
        };
      }
    }
    
    return { valid: true };
  }
}
```

---

## 四、命令解析引擎设计 (Command Parser Engine)

### 4.1 命令解析流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Command Parsing Flowchart                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  用户输入消息  │
│  "帮我部署 api │
│   到生产环境"  │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  预处理阶段   │────▶│  消息清洗    │
│              │     │  - 去除空格   │
│              │     │  - 标准化格式 │
│              │     │  - 提取上下文 │
└──────┬───────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  命令识别阶段 │────▶│  前缀匹配    │
│              │     │  - "/"识别   │
│              │     │  - 命令提取   │
└──────┬───────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  意图识别阶段 │────▶│  NLP 处理     │
│              │     │  - 动词识别   │
│              │     │  - 实体识别   │
│              │     │  - 意图分类   │
└──────┬───────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  参数解析阶段 │────▶│  参数提取    │
│              │     │  - 命名参数   │
│              │     │  - 位置参数   │
│              │     │  - 标志参数   │
└──────┬───────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  上下文增强   │────▶│  默认值填充  │
│              │     │  - 用户偏好   │
│              │     │  - 频道配置   │
│              │     │  - 历史记录   │
└──────┬───────┘     └──────────────┘
       │
       ▼
┌──────────────┐
│  解析结果输出 │
│ {            │
│   command:   │
│   "deploy",  │
│   params: {  │
│     app:     │
│     "api",   │
│     env:     │
│     "prod"   │
│   },         │
│   confidence:│
│   0.95       │
│ }            │
└──────────────┘
```

### 4.2 意图识别模块

```typescript
// 意图识别器
class IntentRecognizer {
  // 意图分类模型
  private intentModel: IntentClassificationModel;
  
  // 预定义意图
  private intents: IntentDefinition[] = [
    {
      name: 'deploy_application',
      patterns: [
        '部署.*到.*',
        '发布.*',
        '上线.*',
        'deploy.*',
        'release.*'
      ],
      command: '/deploy',
      slots: ['app', 'env', 'version']
    },
    {
      name: 'check_status',
      patterns: [
        '查看.*状态',
        '查询.*',
        '检查.*',
        'status.*',
        'check.*'
      ],
      command: '/status',
      slots: ['type', 'id']
    },
    {
      name: 'approve_request',
      patterns: [
        '批准.*',
        '通过.*',
        '同意.*',
        'approve.*',
        'yes'
      ],
      command: '/approve',
      slots: ['id', 'comment']
    },
    {
      name: 'rollback_application',
      patterns: [
        '回滚.*',
        '撤销.*',
        '恢复.*',
        'rollback.*',
        'revert.*'
      ],
      command: '/rollback',
      slots: ['app', 'env', 'target']
    }
  ];
  
  // 识别意图
  recognize(input: string): IntentResult {
    // 1. 尝试命令前缀匹配（高优先级）
    if (input.startsWith('/')) {
      return this.parseStructuredCommand(input);
    }
    
    // 2. NLP 意图识别
    const nlpResult = this.intentModel.classify(input);
    
    // 3. 槽位填充
    const slots = this.extractSlots(input, nlpResult.intent);
    
    // 4. 置信度计算
    const confidence = this.calculateConfidence(nlpResult, slots);
    
    return {
      intent: nlpResult.intent,
      command: nlpResult.command,
      slots,
      confidence,
      alternatives: nlpResult.alternatives
    };
  }
  
  // 提取槽位（实体）
  extractSlots(input: string, intent: string): Record<string, any> {
    const slots: Record<string, any> = {};
    
    // 应用名称提取
    const appMatch = input.match(/(api|web|worker|frontend|backend)/i);
    if (appMatch) {
      slots.app = appMatch[1].toLowerCase();
    }
    
    // 环境提取
    const envMatch = input.match(/(生产 |prod|线上 |staging|测试 |dev|开发)/i);
    if (envMatch) {
      slots.env = this.normalizeEnv(envMatch[1]);
    }
    
    // 版本号提取
    const versionMatch = input.match(/v?(\d+\.\d+\.\d+)/i);
    if (versionMatch) {
      slots.version = versionMatch[1];
    }
    
    return slots;
  }
}
```

### 4.3 参数提取模块

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Parameter Extraction                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

输入: "/pipeline run --repo=frontend --branch=main --async"

解析步骤:

Step 1: 命令分割
┌─────────────────────────────────────────────────────────────────┐
│  tokens: ["/pipeline", "run", "--repo=frontend", "--branch=main", "--async"] │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
Step 2: 命令识别
┌─────────────────────────────────────────────────────────────────┐
│  command: "pipeline"                                            │
│  subcommand: "run"                                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
Step 3: 参数解析
┌─────────────────────────────────────────────────────────────────┐
│  named_params: {                                                │
│    repo: "frontend",                                            │
│    branch: "main"                                               │
│  }                                                              │
│  flags: ["async"]                                               │
│  positional: []                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
Step 4: 类型转换
┌─────────────────────────────────────────────────────────────────┐
│  typed_params: {                                                │
│    repo: "frontend" (string),                                   │
│    branch: "main" (string),                                     │
│    async: true (boolean)                                        │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 上下文理解模块

```typescript
// 上下文管理器
class ContextManager {
  // 会话上下文存储
  private sessions: Map<string, SessionContext>;
  
  // 获取或创建会话
  getSession(userId: string, channelId: string): SessionContext {
    const key = `${userId}:${channelId}`;
    if (!this.sessions.has(key)) {
      this.sessions.set(key, {
        userId,
        channelId,
        history: [],
        state: 'idle',
        pendingCommand: null,
        variables: {}
      });
    }
    return this.sessions.get(key)!;
  }
  
  // 多轮对话支持
  handleMultiTurn(input: string, session: SessionContext): MultiTurnResult {
    // 1. 检查是否有待完成的命令
    if (session.pendingCommand) {
      return this.continuePendingCommand(input, session);
    }
    
    // 2. 检查上下文引用
    if (this.containsContextReference(input)) {
      return this.resolveContextReference(input, session);
    }
    
    // 3. 新命令
    return { type: 'new_command', input };
  }
  
  // 继续待处理的命令
  continuePendingCommand(input: string, session: SessionContext): MultiTurnResult {
    const pending = session.pendingCommand!;
    
    // 检查是否提供缺失的参数
    const missingParams = pending.missingParams;
    const nextParam = missingParams[0];
    
    // 将输入作为参数值
    pending.params[nextParam] = input;
    
    // 检查是否还有缺失参数
    const remainingMissing = this.checkMissingParams(pending);
    if (remainingMissing.length === 0) {
      // 所有参数已收集，准备执行
      session.pendingCommand = null;
      return { type: 'ready_to_execute', command: pending };
    }
    
    // 继续收集下一个参数
    return {
      type: 'collecting_params',
      nextParam: remainingMissing[0],
      prompt: `请输入${remainingMissing[0]}：`
    };
  }
  
  // 解析上下文引用
  resolveContextReference(input: string, session: SessionContext): MultiTurnResult {
    // 处理"这个"、"上一个"、"它"等引用
    const resolved = this.resolveReferences(input, session.history);
    return { type: 'new_command', input: resolved };
  }
}
```

### 4.5 解析结果数据结构

```typescript
// 命令解析结果
interface ParseResult {
  // 原始输入
  rawInput: string;
  
  // 识别的命令
  command: string;
  subcommand?: string;
  
  // 解析的参数
  params: {
    named: Record<string, any>;
    positional: string[];
    flags: string[];
  };
  
  // 意图识别结果
  intent?: {
    name: string;
    confidence: number;
    alternatives: Array<{ name: string; confidence: number }>;
  };
  
  // 上下文信息
  context: {
    userId: string;
    channelId: string;
    platform: string;
    timestamp: number;
    threadId?: string;
  };
  
  // 解析状态
  status: {
    success: boolean;
    errors: string[];
    warnings: string[];
  };
}

// 命令 Schema 定义
interface CommandSchema {
  name: string;
  description: string;
  usage: string;
  examples: string[];
  
  // 参数定义
  params: {
    [key: string]: ParamDefinition;
  };
  
  // 必需参数
  requiredParams: string[];
  
  // 子命令
  subcommands?: CommandSchema[];
  
  // 权限要求
  permission: {
    level: number;
    roles: string[];
  };
}
```

---

## 五、命令执行引擎设计 (Command Execution Engine)

### 5.1 命令执行时序图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Command Execution Sequence Diagram                        │
└─────────────────────────────────────────────────────────────────────────────────┘

用户        IM 平台      Message Gateway   Command Parser   Execution Engine   Business Service   Audit Logger
 │            │                │                │                 │                  │                │
 │─命令消息──▶│                │                │                 │                  │                │
 │            │─转发消息──────▶│                │                 │                  │                │
 │            │                │─路由请求──────▶│                 │                  │                │
 │            │                │                │─解析命令        │                  │                │
 │            │                │                │(识别/参数提取)  │                  │                │
 │            │                │                │─解析结果────────▶│                 │                  │                │
 │            │                │                │                 │─权限验证        │                  │                │
 │            │                │                │                 │─────────────────▶│                  │                │
 │            │                │                │                 │◀─验证结果────────│                  │                │
 │            │                │                │                 │                 │                  │                │
 │            │                │                │                 │─执行请求────────▶│─命令处理        │                │
 │            │                │                │                 │                 │(业务逻辑)        │                │
 │            │                │                │                 │                 │─────────────────▶│                │
 │            │                │                │                 │                 │◀─执行结果────────│                │
 │            │                │                │                 │◀─执行响应────────│                 │                │
 │            │                │                │                 │─记录审计─────────────────────────────────▶│
 │            │                │                │                 │                 │                  │◀─审计确认──────│
 │            │                │                │                 │─格式化结果      │                  │                │
 │            │◀─发送响应──────│◀─响应结果──────│◀─执行完成────────│                 │                  │                │
 │◀─执行结果──│                │                │                 │                 │                  │                │
 │            │                │                │                 │                 │                  │                │

时间轴 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────▶
```

### 5.2 权限验证模块

```typescript
// 权限验证器
class PermissionValidator {
  // 权限等级定义
  private readonly PERMISSION_LEVELS = {
    L1_READ: 1,      // 只读权限
    L2_DEV: 2,       // 开发权限
    L3_DEPLOY: 3,    // 发布权限
    L4_OPS: 4,       // 运维权限
    L5_ADMIN: 5      // 管理员权限
  };
  
  // 命令权限要求映射
  private readonly COMMAND_PERMISSIONS = {
    '/status': { level: 1, roles: ['all'] },
    '/incident': { level: 1, roles: ['all'] },
    '/pipeline': { level: 2, roles: ['developer', 'admin'] },
    '/deploy': { level: 3, roles: ['release-manager', 'admin'] },
    '/approve': { level: 3, roles: ['approver', 'admin'] },
    '/reject': { level: 3, roles: ['approver', 'admin'] },
    '/rollback': { level: 3, roles: ['release-manager', 'admin'] },
    '/scale': { level: 4, roles: ['ops', 'admin'] }
  };
  
  // 验证权限
  async verifyPermission(user: User, command: string, params?: any): 
    Promise<PermissionResult> {
    
    // 1. 获取命令权限要求
    const requiredPerm = this.COMMAND_PERMISSIONS[command];
    if (!requiredPerm) {
      return { 
        allowed: false, 
        reason: `未知命令：${command}` 
      };
    }
    
    // 2. 获取用户权限信息
    const userPerm = await this.getUserPermission(user.id);
    
    // 3. 等级检查
    if (userPerm.level < requiredPerm.level) {
      return {
        allowed: false,
        reason: `权限不足，需要等级${requiredPerm.level}，当前等级${userPerm.level}`
      };
    }
    
    // 4. 角色检查
    const hasRole = requiredPerm.roles.some(role => 
      role === 'all' || userPerm.roles.includes(role)
    );
    if (!hasRole) {
      return {
        allowed: false,
        reason: `需要角色：${requiredPerm.roles.join('或')}`
      };
    }
    
    // 5. 资源级权限检查（如适用）
    if (params?.app || params?.repo) {
      const resourcePerm = await this.checkResourcePermission(
        user.id, 
        params.app || params.repo
      );
      if (!resourcePerm) {
        return {
          allowed: false,
          reason: `无资源访问权限`
        };
      }
    }
    
    // 6. 环境级权限检查（如适用）
    if (params?.env === 'prod') {
      const prodPerm = await this.checkProdPermission(user.id);
      if (!prodPerm) {
        return {
          allowed: false,
          reason: `无生产环境操作权限`
        };
      }
    }
    
    return { allowed: true };
  }
}
```

### 5.3 命令路由模块

```typescript
// 命令路由器
class CommandRouter {
  // 命令处理器注册表
  private handlers: Map<string, CommandHandler>;
  
  // 注册处理器
  register(command: string, handler: CommandHandler): void {
    this.handlers.set(command, handler);
  }
  
  // 路由命令
  async route(context: CommandContext): Promise<CommandResult> {
    const { command, params } = context;
    
    // 1. 查找处理器
    const handler = this.handlers.get(command);
    if (!handler) {
      throw new CommandNotFoundError(command);
    }
    
    // 2. 预处理（钩子）
    await this.executePreHooks(context);
    
    // 3. 执行命令
    let result: CommandResult;
    try {
      result = await handler.execute(params, context);
    } catch (error) {
      // 4. 错误处理
      result = await this.handleError(error, context);
    }
    
    // 5. 后处理（钩子）
    await this.executePostHooks(context, result);
    
    return result;
  }
  
  // 命令处理器示例
  private createDeployHandler(): CommandHandler {
    return {
      async execute(params: DeployParams, ctx: CommandContext) {
        // 1. 参数验证
        await this.validateParams(params);
        
        // 2. 检查部署窗口
        await this.checkDeployWindow(params.env);
        
        // 3. 检查审批状态（生产环境）
        if (params.env === 'prod') {
          await this.checkApproval(params.app);
        }
        
        // 4. 调用部署服务
        const deployResult = await pipelineService.deploy({
          app: params.app,
          env: params.env,
          version: params.version,
          strategy: params.strategy
        });
        
        // 5. 返回结果
        return {
          success: true,
          message: `部署 ${params.app} 到 ${params.env} 已启动`,
          data: { deployId: deployResult.id }
        };
      }
    };
  }
}
```

### 5.4 执行跟踪模块

```typescript
// 执行跟踪器
class ExecutionTracker {
  // 进行中的命令跟踪
  private tracking: Map<string, ExecutionState>;
  
  // 开始跟踪
  startTracking(commandId: string, context: CommandContext): void {
    this.tracking.set(commandId, {
      id: commandId,
      command: context.command,
      user: context.user,
      status: 'running',
      startTime: Date.now(),
      milestones: [
        { name: 'received', time: Date.now() }
      ]
    });
  }
  
  // 更新状态
  updateStatus(commandId: string, status: ExecutionStatus, milestone?: string): void {
    const state = this.tracking.get(commandId);
    if (!state) return;
    
    state.status = status;
    if (milestone) {
      state.milestones.push({ name: milestone, time: Date.now() });
    }
  }
  
  // 完成跟踪
  completeTracking(commandId: string, result: CommandResult): void {
    const state = this.tracking.get(commandId);
    if (!state) return;
    
    state.status = result.success ? 'completed' : 'failed';
    state.result = result;
    state.endTime = Date.now();
    state.duration = state.endTime - state.startTime;
    
    // 保留历史记录 24 小时
    setTimeout(() => this.tracking.delete(commandId), 24 * 60 * 60 * 1000);
  }
  
  // 获取执行状态
  getExecutionStatus(commandId: string): ExecutionState | undefined {
    return this.tracking.get(commandId);
  }
}

// 执行状态
interface ExecutionState {
  id: string;
  command: string;
  user: User;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  duration?: number;
  milestones: Array<{ name: string; time: number }>;
  result?: CommandResult;
}
```

---

## 六、命令分类设计 (Command Classification)

### 6.1 命令分类矩阵

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Command Classification Matrix                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┬──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│                 │    查询类         │    操作类         │    审批类         │    通知类         │
│   命令类别       │   (Query)        │   (Operation)    │   (Approval)     │   (Notification) │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│                 │                  │                  │                  │                  │
│  特点            │  只读、无副作用   │  写操作、有副作用  │  需要审批权限     │  被动触发、推送    │
│                 │                  │                  │                  │                  │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│                 │                  │                  │                  │                  │
│  权限要求        │  L1 (只读)        │  L2-L4           │  L3 (审批人)      │  系统自动         │
│                 │                  │                  │                  │                  │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│                 │                  │                  │                  │                  │
│  审计要求        │  记录查询         │  详细记录         │  详细记录 + 审批链  │  记录发送         │
│                 │                  │                  │                  │                  │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│                 │                  │                  │                  │                  │
│  执行速度        │  快 (<1s)         │  中 -慢 (1s-5min) │  中 (<30s)        │  快 (<100ms)     │
│                 │                  │                  │                  │                  │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│                 │                  │                  │                  │                  │
│  示例命令        │  /status         │  /pipeline       │  /approve        │  部署完成通知     │
│                 │  /status deploy  │  /deploy         │  /reject         │  流水线失败告警   │
│                 │  /status oncall  │  /rollback       │                  │  审批待办提醒     │
│                 │                  │  /scale          │                  │                  │
│                 │                  │                  │                  │                  │
└─────────────────┴──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

### 6.2 查询类命令

```yaml
# 查询类命令定义
query_commands:
  - name: /status
    description: 查询资源状态
    subcommands:
      - name: pipeline
        description: 查询流水线状态
        params:
          - name: id
            type: string
            required: true
            description: 流水线 ID
      - name: deploy
        description: 查询部署状态
        params:
          - name: app
            type: string
            required: true
          - name: env
            type: enum
            values: [dev, staging, prod]
      - name: oncall
        description: 查询当前 On-Call 人员
        params: []
    response_format: |
      **${type} 状态**
      ID: ${id}
      状态：${status}
      开始时间：${startTime}
      持续时间：${duration}
      
  - name: /list
    description: 列出资源
    subcommands:
      - name: pipelines
        description: 列出流水线
      - name: deploys
        description: 列出部署历史
      - name: incidents
        description: 列出事件
```

### 6.3 操作类命令

```yaml
# 操作类命令定义
operation_commands:
  - name: /pipeline
    description: 流水线管理
    subcommands:
      - name: run
        description: 触发流水线
        params:
          - name: repo
            type: string
            required: true
          - name: branch
            type: string
            required: true
          - name: pipeline
            type: enum
            values: [build, test, deploy]
            default: build
        side_effects:
          - 触发 CI/CD 流水线
          - 消耗构建资源
          - 可能触发部署
          
      - name: cancel
        description: 取消流水线
        params:
          - name: id
            type: string
            required: true
        side_effects:
          - 终止运行中的任务
          - 释放构建资源
          
  - name: /deploy
    description: 部署管理
    params:
      - name: app
        type: string
        required: true
      - name: env
        type: enum
        values: [dev, staging, prod]
        required: true
      - name: version
        type: string
        required: true
      - name: strategy
        type: enum
        values: [blue-green, canary, rolling]
        default: rolling
    side_effects:
      - 部署应用
      - 可能触发服务重启
      - 影响线上流量
      
  - name: /scale
    description: 扩缩容管理
    params:
      - name: app
        type: string
        required: true
      - name: env
        type: enum
        values: [dev, staging, prod]
        required: true
      - name: replicas
        type: number
        required: true
    side_effects:
      - 调整实例数量
      - 消耗/释放资源
```

### 6.4 审批类命令

```yaml
# 审批类命令定义
approval_commands:
  - name: /approve
    description: 审批通过
    params:
      - name: id
        type: string
        required: true
        description: 审批项 ID
      - name: comment
        type: string
        required: false
        description: 审批意见
    workflow:
      - 验证审批人身份
      - 检查审批项状态
      - 更新审批状态为通过
      - 触发后续流程
      - 通知相关人员
      
  - name: /reject
    description: 审批拒绝
    params:
      - name: id
        type: string
        required: true
      - name: reason
        type: string
        required: true
        description: 拒绝原因
      - name: blocker
        type: string
        required: false
        description: 阻塞问题
    workflow:
      - 验证审批人身份
      - 检查审批项状态
      - 更新审批状态为拒绝
      - 通知申请人
```

### 6.5 通知类消息

```yaml
# 通知类消息定义
notification_messages:
  # 流水线通知
  - type: pipeline_notification
    triggers:
      - pipeline_started
      - pipeline_completed
      - pipeline_failed
      - pipeline_cancelled
    template: |
      🔄 **流水线通知**
      
      **应用**: ${appName}
      **流水线**: ${pipelineType}
      **状态**: ${status}
      
      **详情**:
      - 触发人：${triggeredBy}
      - 耗时：${duration}
      
  # 部署通知
  - type: deploy_notification
    triggers:
      - deploy_started
      - deploy_completed
      - deploy_failed
      - deploy_rollback
    template: |
      🚀 **部署通知**
      
      **应用**: ${appName}
      **环境**: ${envName}
      **版本**: ${version}
      **状态**: ${status}
      
  # 告警通知
  - type: alert_notification
    triggers:
      - metric_threshold_exceeded
      - service_error_rate_high
      - latency_spike
    severity_levels:
      - P0: 电话 +IM
      - P1: IM+ 短信
      - P2: IM
      - P3: IM(批量)
```

---

## 七、交互式命令设计 (Interactive Commands)

### 6.1 交互式命令状态图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      Interactive Command State Diagram                           │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   IDLE      │
                              │  (空闲态)    │
                              └──────┬──────┘
                                     │
                                     │ 用户输入命令
                                     ▼
                              ┌─────────────┐
                         ┌────│  PARSING    │
                         │    │  (解析态)    │
                         │    └──────┬──────┘
                         │           │
                         │           │ 参数完整？
                         │     ┌─────┴─────┐
                         │     │           │
                         │    YES         NO
                         │     │           │
                         │     │           ▼
                         │     │    ┌─────────────┐
                         │     │    │ COLLECTING  │
                         │     │    │  (收集中)    │
                         │     │    └──────┬──────┘
                         │     │           │
                         │     │           │ 用户提供参数
                         │     │           ▼
                         │     │    ┌─────────────┐
                         │     └────│  VALIDATING │◀──┐
                         │          │  (验证态)    │   │
                         │          └──────┬──────┘   │
                         │                 │          │ 验证失败
                         │           ┌─────┴─────┐    │
                         │           │           │    │
                         │          YES         NO    │
                         │           │           │    │
                         │           │           └────┘
                         │           │
                         │           ▼
                         │    ┌─────────────┐
                         │    │ CONFIRMING  │
                         │    │  (确认态)    │
                         │    └──────┬──────┘
                         │           │
                         │     ┌─────┴─────┐
                         │     │           │
                         │   确认         取消
                         │     │           │
                         │     ▼           │
                         │    ┌────────────┴────────┐
                         │    │                     │
                         ▼    ▼                     │
┌─────────────┐     ┌─────────────┐                │
│  COMPLETED  │     │  EXECUTING  │                │
│  (完成态)    │     │  (执行中)    │                │
└──────┬──────┘     └──────┬──────┘                │
       │                   │                        │
       │ 显示结果          │ 执行完成               │
       │                   ▼                        │
       │           ┌─────────────┐                 │
       └──────────▶│  COMPLETED  │◀────────────────┘
                   │  (完成态)    │
                   └─────────────┘
```

### 7.2 卡片消息设计

```yaml
# 交互式卡片模板
interactive_card_templates:
  # 部署确认卡片
  deploy_confirmation:
    header:
      title: "🚀 部署确认"
      bgcolor: "#1890FF"
    body:
      - type: section
        content: |
          **应用**: ${app}
          **环境**: ${env}
          **版本**: ${version}
          **部署策略**: ${strategy}
      - type: divider
      - type: section
        title: "变更摘要"
        content: ${changeSummary}
      - type: section
        title: "风险评估"
        content: ${riskLevel}
        color: "${riskColor}"
    footer:
      - type: button
        label: "✅ 确认部署"
        style: primary
        action:
          type: callback
          key: confirm_deploy
          value: { deployId: "${id}" }
      - type: button
        label: "❌ 取消"
        style: danger
        action:
          type: callback
          key: cancel_deploy
          
  # 审批卡片
  approval_card:
    header:
      title: "✅ 审批请求"
      bgcolor: "#52C41A"
    body:
      - type: section
        content: |
          **类型**: ${approvalType}
          **申请人**: ${requester}
          **申请时间**: ${requestTime}
      - type: divider
      - type: section
        title: "详情"
        content: ${description}
      - type: section
        title: "变更内容"
        content: ${changeSummary}
    footer:
      - type: button
        label: "通过"
        style: primary
        action:
          type: callback
          key: approve
          value: { approvalId: "${id}" }
      - type: button
        label: "拒绝"
        style: danger
        action:
          type: callback
          key: reject
          value: { approvalId: "${id}" }
          
  # 表单输入卡片
  form_input_card:
    header:
      title: "📝 ${formTitle}"
    body:
      - type: input
        label: "仓库"
        placeholder: "选择或输入仓库名称"
        action:
          key: repo_input
      - type: input
        label: "分支"
        placeholder: "选择或输入分支"
        action:
          key: branch_input
      - type: select
        label: "流水线类型"
        options:
          - label: "构建"
            value: build
          - label: "测试"
            value: test
          - label: "部署"
            value: deploy
        action:
          key: pipeline_type
    footer:
      - type: button
        label: "提交"
        style: primary
        action:
          type: callback
          key: submit_form
```

### 7.3 按钮交互设计

```typescript
// 按钮交互处理器
class ButtonInteractionHandler {
  // 按钮动作注册
  private actions: Map<string, ButtonAction>;
  
  // 注册按钮动作
  register(actionKey: string, handler: ButtonHandler): void {
    this.actions.set(actionKey, {
      key: actionKey,
      handler,
      cooldown: 1000,  // 冷却时间 1 秒
      lastTriggered: 0
    });
  }
  
  // 处理按钮点击
  async handleCallback(callback: CallbackEvent): Promise<InteractionResult> {
    const action = this.actions.get(callback.actionId);
    if (!action) {
      throw new Error(`未知动作：${callback.actionId}`);
    }
    
    // 冷却检查
    const now = Date.now();
    if (now - action.lastTriggered < action.cooldown) {
      return {
        success: false,
        message: '操作过于频繁，请稍后再试'
      };
    }
    
    // 权限验证
    const hasPermission = await this.verifyPermission(
      callback.user,
      callback.value
    );
    if (!hasPermission) {
      return {
        success: false,
        message: '权限不足'
      };
    }
    
    // 执行动作
    action.lastTriggered = now;
    return await action.handler(callback);
  }
}

// 预定义按钮动作
const DEFAULT_BUTTON_ACTIONS = {
  'confirm_deploy': async (callback: CallbackEvent) => {
    // 确认部署逻辑
    return deploymentService.confirm(callback.value.deployId);
  },
  'cancel_deploy': async (callback: CallbackEvent) => {
    // 取消部署逻辑
    return deploymentService.cancel(callback.value.deployId);
  },
  'approve': async (callback: CallbackEvent) => {
    // 审批通过逻辑
    return approvalService.approve(callback.value.approvalId);
  },
  'reject': async (callback: CallbackEvent) => {
    // 审批拒绝逻辑
    return approvalService.reject(callback.value.approvalId);
  },
  'retry_pipeline': async (callback: CallbackEvent) => {
    // 重试流水线逻辑
    return pipelineService.retry(callback.value.pipelineId);
  }
};
```

### 7.4 表单填写设计

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Form Filling Flow                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

分步表单流程示例（部署命令）:

步骤 1/4: 选择应用
┌─────────────────────────────────────────────────────────────────┐
│  📝 部署向导                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  步骤 1/4: 选择应用                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ▼ 选择应用                                          ▼  │   │
│  │    ├─ 📁 api-service                                   │   │
│  │    ├─ 📁 web-frontend                                  │   │
│  │    ├─ 📁 worker-service                                │   │
│  │    └─ 📁 data-processor                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                    [上一步]           [下一步 >]                │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ 用户选择
                            ▼
步骤 2/4: 选择环境
┌─────────────────────────────────────────────────────────────────┐
│  📝 部署向导                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  步骤 2/4: 选择环境                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ○ 开发环境 (dev)                                       │   │
│  │  ○ 预发环境 (staging)                                   │   │
│  │  ● 生产环境 (prod) ⚠️ 需要审批                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ⚠️ 生产环境部署需要二级审批，预计耗时 5-10 分钟                   │
│                                                                 │
│  [上一步]                    [取消]        [下一步 >]           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ 用户选择
                            ▼
步骤 3/4: 选择版本
┌─────────────────────────────────────────────────────────────────┐
│  📝 部署向导                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  步骤 3/4: 选择版本                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ▼ 可用版本                                          ▼  │   │
│  │    ├─ v1.2.3 (最新，2026-04-10 10:30) ✅                  │   │
│  │    ├─ v1.2.2 (2026-04-09 15:20)                         │   │
│  │    └─ v1.2.1 (2026-04-08 09:15)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  版本 v1.2.3 变更:                                               │
│  - 新增用户登录功能                                              │
│  - 修复支付页面 Bug                                              │
│                                                                 │
│  [上一步]                    [取消]        [下一步 >]           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ 用户选择
                            ▼
步骤 4/4: 确认部署
┌─────────────────────────────────────────────────────────────────┐
│  📝 部署向导                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  步骤 4/4: 确认部署                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  部署配置预览：                                           │   │
│  │  ───────────────────────────────────────────────────    │   │
│  │  应用：api-service                                       │   │
│  │  环境：prod (生产环境)                                    │   │
│  │  版本：v1.2.3                                            │   │
│  │  策略：滚动更新 (rolling)                                 │   │
│  │  ───────────────────────────────────────────────────    │   │
│  │  预计影响：无停机时间                                      │   │
│  │  预计耗时：5-10 分钟                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [上一步]                    [取消]    [✅ 确认部署]             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 八、命令审计日志设计 (Command Audit Logging)

### 8.1 审计日志数据流图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Audit Log Data Flow Diagram                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   用户操作    │
│  (命令执行)   │
└──────┬───────┘
       │
       │ 1. 命令执行请求
       ▼
┌──────────────┐     ┌──────────────┐
│  执行引擎     │────▶│  审计采集器   │
│              │     │  (Collector)  │
└──────────────┘     └──────┬───────┘
                             │
                             │ 2. 审计事件
                             │ {
                             │   who: userId,
                             │   when: timestamp,
                             │   what: command,
                             │   params: {...},
                             │   result: {...}
                             │ }
                             ▼
                      ┌──────────────┐
                      │  消息队列     │
                      │  (NATS/Kafka)│
                      │  Topic:      │
                      │  audit.*     │
                      └──────┬───────┘
                             │
                             │ 3. 异步消费
               ┌─────────────┼─────────────┐
               │             │             │
               ▼             ▼             ▼
      ┌────────────┐ ┌────────────┐ ┌────────────┐
      │  实时处理   │ │  批量写入   │ │  告警检测   │
      │  (Flink)   │ │  (Writer)  │ │  (Alert)   │
      └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
            │              │              │
            │              │              │
            ▼              ▼              ▼
      ┌────────────┐ ┌────────────┐ ┌────────────┐
      │  实时大屏   │ │ PostgreSQL │ │  告警通知   │
      │  (Dashboard)│ │ (审计存储)  │ │             │
      └────────────┘ └─────┬──────┘ └────────────┘
                           │
                           │ 4. 定期归档
                           ▼
                    ┌────────────┐
                    │   Elasticsearch │
                    │   (查询分析)  │
                    └────────────┘
```

### 8.2 审计日志数据结构

```typescript
// 审计日志记录
interface AuditLog {
  // 基础信息
  id: string;                    // 日志 ID
  traceId: string;               // 追踪 ID
  
  // 谁 (Who)
  actor: {
    userId: string;              // 用户 ID
    userName: string;            // 用户名称
    email?: string;              // 邮箱
    roles: string[];             // 角色列表
    ip?: string;                 // IP 地址
    userAgent?: string;          // 用户代理
  };
  
  // 何时 (When)
  timestamp: {
    createdAt: number;           // 创建时间
    startedAt?: number;          // 开始时间
    completedAt?: number;        // 完成时间
  };
  
  // 什么 (What)
  action: {
    type: 'command_execute';     // 操作类型
    command: string;             // 命令名称
    subcommand?: string;         // 子命令
    params: Record<string, any>; // 命令参数
    source: {
      platform: string;          // IM 平台
      channelId: string;         // 频道 ID
      channelName: string;       // 频道名称
      messageId: string;         // 消息 ID
    };
  };
  
  // 结果如何 (Result)
  result: {
    success: boolean;            // 是否成功
    statusCode?: number;         // 状态码
    message?: string;            // 结果消息
    data?: any;                  // 返回数据
    error?: {
      code: string;              // 错误码
      message: string;           // 错误消息
      stack?: string;            // 堆栈跟踪
    };
  };
  
  // 上下文
  context: {
    requestId: string;           // 请求 ID
    sessionId?: string;          // 会话 ID
    relatedLogs?: string[];      // 关联日志
    metadata?: Record<string, any>;
  };
  
  // 合规标记
  compliance: {
    sensitive: boolean;          // 是否敏感操作
    category: string;            // 操作分类
    retention: number;           // 保留天数
  };
}
```

### 8.3 审计日志存储方案

```sql
-- 审计日志表结构
CREATE TABLE audit_logs (
    id              VARCHAR(64) PRIMARY KEY,
    trace_id        VARCHAR(64) NOT NULL,
    
    -- 操作者信息
    actor_user_id   VARCHAR(64) NOT NULL,
    actor_user_name VARCHAR(128) NOT NULL,
    actor_email     VARCHAR(255),
    actor_roles     JSONB,
    actor_ip        INET,
    
    -- 时间信息
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    
    -- 操作信息
    command         VARCHAR(64) NOT NULL,
    subcommand      VARCHAR(64),
    params          JSONB NOT NULL,
    source_platform VARCHAR(32) NOT NULL,
    source_channel  VARCHAR(64) NOT NULL,
    
    -- 结果信息
    success         BOOLEAN NOT NULL,
    status_code     INTEGER,
    result_message  TEXT,
    error_code      VARCHAR(64),
    error_message   TEXT,
    
    -- 上下文
    request_id      VARCHAR(64) NOT NULL,
    session_id      VARCHAR(64),
    metadata        JSONB,
    
    -- 合规标记
    is_sensitive    BOOLEAN DEFAULT FALSE,
    category        VARCHAR(32),
    
    -- 分区键
    log_date        DATE NOT NULL DEFAULT CURRENT_DATE
) PARTITION BY RANGE (log_date);

-- 索引设计
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id, created_at);
CREATE INDEX idx_audit_command ON audit_logs(command, created_at);
CREATE INDEX idx_audit_trace ON audit_logs(trace_id);
CREATE INDEX idx_audit_request ON audit_logs(request_id);
CREATE INDEX idx_audit_category ON audit_logs(category, log_date);

-- 按月分区
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```

### 8.4 审计日志查询 API

```yaml
# 审计日志查询 API
audit_log_apis:
  # 查询日志列表
  - endpoint: GET /api/v1/audit/logs
    description: 查询审计日志
    parameters:
      - name: command
        type: string
        description: 命令名称过滤
      - name: userId
        type: string
        description: 用户 ID 过滤
      - name: success
        type: boolean
        description: 执行结果过滤
      - name: startDate
        type: string
        description: 开始时间
      - name: endDate
        type: string
        description: 结束时间
      - name: page
        type: number
        default: 1
      - name: pageSize
        type: number
        default: 20
    response:
      items: AuditLog[]
      total: number
      page: number
      
  # 获取日志详情
  - endpoint: GET /api/v1/audit/logs/:id
    description: 获取单条日志详情
    response: AuditLog
    
  # 导出日志
  - endpoint: POST /api/v1/audit/export
    description: 导出审计日志
    parameters:
      - name: format
        type: enum
        values: [csv, json]
      - name: filter
        type: object
        description: 过滤条件
    response:
      downloadUrl: string
      expiresAt: string
      
  # 统计信息
  - endpoint: GET /api/v1/audit/stats
    description: 获取审计统计
    parameters:
      - name: groupBy
        type: enum
        values: [command, user, day]
      - name: startDate
        type: string
      - name: endDate
        type: string
    response:
      stats: Array<{
        key: string,
        count: number,
        successRate: number
      }>
```

---

## 九、命令速率限制设计 (Command Rate Limiting)

### 9.1 速率限制算法图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Rate Limiting Algorithm                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

多层速率限制架构:

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Layer 1: 用户级限流 (User-level Rate Limiting)                                  │
│                                                                                  │
│  用户 A: ━━━━━━━━━━●━━━━━━━━━━━━━━━  5/10 请求/分钟                              │
│  用户 B: ━━━━━━━━━━━━━━━━●━━━━━━━  8/10 请求/分钟                              │
│  用户 C: ━━━━━━━━●━━━━━━━━━━━━━━━  3/10 请求/分钟                              │
│                                                                                  │
│  算法：滑动窗口计数器                                                            │
│  配置：每用户每分钟最多 10 个命令请求                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Layer 2: 频道级限流 (Channel-level Rate Limiting)                               │
│                                                                                  │
│  频道 #general: ━━━━━━━━━━━━━━━━●━━━━  15/20 请求/分钟                         │
│  频道 #alerts:  ━━━━━━━━●━━━━━━━━━━━━━  8/20 请求/分钟                          │
│  频道 #deploy:  ━━━━━━━━━━━━━━━━━━━━●  20/20 请求/分钟 ⚠️                        │
│                                                                                  │
│  算法：令牌桶 (Token Bucket)                                                     │
│  配置：每频道每分钟最多 20 个命令请求                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Layer 3: 命令级限流 (Command-level Rate Limiting)                               │
│                                                                                  │
│  /deploy:       ━━━━●━━━━━━━━━━━━━━  4/5 请求/分钟 (高风险命令限流更严格)        │
│  /scale:        ━━━━━━━━●━━━━━━━━━━  8/10 请求/分钟                              │
│  /status:       ━━━━━━━━━━━━━━━━●━━  18/30 请求/分钟 (查询类限流较宽松)          │
│  /pipeline:     ━━━━━━━━━━●━━━━━━━━  10/15 请求/分钟                             │
│                                                                                  │
│  算法：固定窗口 + 突发限制                                                        │
│  配置：按命令风险等级设置不同限制                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Layer 4: 全局限流 (Global Rate Limiting)                                        │
│                                                                                  │
│  全系统：━━━━━━━━━━━━━━━━━━━●━  95/100 请求/秒 ⚠️                               │
│                                                                                  │
│  算法：漏桶 (Leaky Bucket)                                                       │
│  配置：全系统每秒最多 100 个命令请求                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 限流算法实现

```typescript
// 滑动窗口计数器实现
class SlidingWindowCounter {
  private windowSize: number;      // 窗口大小 (毫秒)
  private maxRequests: number;     // 最大请求数
  private requests: Map<string, number[]>;  // 用户请求时间戳
  
  constructor(windowSize: number, maxRequests: number) {
    this.windowSize = windowSize;
    this.maxRequests = maxRequests;
    this.requests = new Map();
  }
  
  // 检查是否允许请求
  allow(userId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowSize;
    
    // 获取用户请求历史
    const userRequests = this.requests.get(userId) || [];
    
    // 移除窗口外的请求
    const validRequests = userRequests.filter(ts => ts > windowStart);
    
    // 检查是否超过限制
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // 添加新请求
    validRequests.push(now);
    this.requests.set(userId, validRequests);
    
    return true;
  }
}

// 令牌桶实现
class TokenBucket {
  private capacity: number;        // 桶容量
  private refillRate: number;      // 补充速率 (令牌/秒)
  private tokens: number;          // 当前令牌数
  private lastRefill: number;      // 上次补充时间
  private buckets: Map<string, TokenBucketState>;
  
  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.buckets = new Map();
  }
  
  // 检查是否允许请求
  allow(key: string): boolean {
    const now = Date.now();
    
    // 获取或创建桶
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }
    
    // 补充令牌
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.refillRate;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    // 消耗令牌
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    
    return false;
  }
  
  // 获取剩余令牌数
  getRemaining(key: string): number {
    const bucket = this.buckets.get(key);
    return bucket ? Math.floor(bucket.tokens) : this.capacity;
  }
}

// 组合限流器
class CompositeRateLimiter {
  private limiters: RateLimiter[];
  
  constructor(limiters: RateLimiter[]) {
    this.limiters = limiters;
  }
  
  // 所有限流器都通过才允许
  async allow(context: RateLimitContext): Promise<RateLimitResult> {
    for (const limiter of this.limiters) {
      const result = await limiter.allow(context);
      if (!result.allowed) {
        return result;  // 第一个不通过的就返回
      }
    }
    return { allowed: true };
  }
}
```

### 9.3 限流配置

```yaml
# 速率限制配置
rate_limiting:
  # 用户级限流
  user_level:
    enabled: true
    algorithm: sliding_window
    window_size: 60s
    max_requests: 10
    exceed_action: reject  # reject: 拒绝，queue: 排队
    
  # 频道级限流
  channel_level:
    enabled: true
    algorithm: token_bucket
    capacity: 20
    refill_rate: 20/min
    exceed_action: reject
    
  # 命令级限流
  command_level:
    enabled: true
    algorithm: fixed_window
    commands:
      # 高风险命令
      /deploy:
        max_requests: 5
        window: 60s
      /scale:
        max_requests: 10
        window: 60s
      /rollback:
        max_requests: 3
        window: 60s
      # 中风险命令
      /pipeline:
        max_requests: 15
        window: 60s
      /approve:
        max_requests: 20
        window: 60s
      # 低风险命令
      /status:
        max_requests: 30
        window: 60s
      /list:
        max_requests: 30
        window: 60s
        
  # 全局限流
  global_level:
    enabled: true
    algorithm: leaky_bucket
    capacity: 100
    leak_rate: 100/s
    exceed_action: queue
    queue_size: 1000
    
  # 白名单 (不受限流)
  whitelist:
    users:
      - system_bot
      - admin_user
    commands:
      - /status
      - /help
```

### 9.4 限流响应

```yaml
# 限流响应配置
rate_limit_responses:
  # 拒绝响应
  rejected:
    message: |
      ⚠️ 请求频率过高
      
      您的请求已被拒绝，请稍后再试。
      
      限制信息:
      - 限制类型：${limitType}
      - 限制值：${limitValue}
      - 重置时间：${resetTime}
      
      如有紧急需求，请联系管理员。
    retry_after_header: true
    
  # 排队响应
  queued:
    message: |
      ⏳ 请求已加入队列
      
      当前队列位置：${queuePosition}
      预计等待时间：${estimatedWait}
    status_polling: true
    
  # 警告响应 (接近限制)
  warned:
    message: |
      ⚠️ 接近速率限制
      
      您已使用 ${used}/${limit} 的请求配额。
      剩余配额将在 ${resetTime} 后恢复。
    threshold: 80%  # 使用率达到 80% 时警告
```

---

## 十、ChatOps 机器人设计 (ChatOps Bot Design)

### 10.1 机器人人格化设计

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          ChatOps Bot Persona                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

机器人基本信息:
├── 名称：Orion Assistant (奥瑞安助手)
├── 角色：专业、友好、高效的运维助手
├── 头像：🤖 (机器人 emoji)
└── 语气：专业但不生硬，友好但不随意

人格特质:
├── 专业性：准确执行命令，提供清晰反馈
├── 友好性：使用礼貌用语，适当使用 emoji
├── 主动性：主动提供帮助建议，预警风险
├── 一致性：响应风格保持一致，不突兀
└── 透明度：不清楚时承认，提供替代方案

响应风格示例:
├── 成功响应:
│   "✅ 部署已成功！api-service v1.2.3 已上线到生产环境。"
│   
├── 失败响应:
│   "❌ 部署失败。原因：版本 v1.2.3 不存在。您是指 v1.2.0 吗？"
│   
├── 警告响应:
│   "⚠️ 请注意：生产环境部署需要审批。已为您创建审批请求 #123。"
│   
├── 帮助响应:
│   "💡 提示：您可以使用 `/deploy --help` 查看部署命令的详细用法。"
│   
└── 闲聊响应:
│   "👋 您好！我是 Orion Assistant，随时为您处理运维任务。有什么可以帮您的？"

特殊场景处理:
├── 紧急事件 (P0/P1):
│   语气：严肃、简洁
│   示例："🚨 P0 事件已创建！On-Call 团队已通知。事件 ID: #INC-001"
│   
├── 重复错误:
│   语气：关切、提供帮助
│   示例："我注意到这个命令最近失败了 3 次。需要我帮您检查一下配置吗？"
│   
├── 新手用户:
│   语气：耐心、引导式
│   示例："看起来您第一次使用部署命令。让我一步步引导您完成部署流程。"
│   
└── 高级用户:
│   语气：简洁、直接
│   示例："✅ 部署已启动。ID: #DEP-456，预计耗时 5 分钟。"
```

### 10.2 主动通知设计

```yaml
# 主动通知配置
proactive_notifications:
  # 启用状态
  enabled: true
  
  # 通知类型
  types:
    # 部署相关
    - name: deployment_reminder
      description: 部署待办提醒
      trigger: 
        type: scheduled
        schedule: "0 9 * * 1-5"  # 工作日 9:00
      condition: "hasPendingDeploys(user)"
      template: |
        👋 早上好！您有以下待处理的部署:
        ${pendingDeploys.map(d => `- ${d.app} → ${d.env}`).join('\n')}
        需要我帮您执行吗？
        
    # 流水线相关
    - name: pipeline_failure
      description: 流水线失败通知
      trigger:
        type: event
        event: pipeline_failed
      template: |
        ❌ 流水线失败
        
        **应用**: ${appName}
        **分支**: ${branchName}
        **错误**: ${errorMessage}
        
        需要我帮您重新运行吗？
        [重新运行] [查看详情] [忽略]
        
    # 审批相关
    - name: approval_pending
      description: 待审批提醒
      trigger:
        type: scheduled
        schedule: "0 10 * * *"  # 每天 10:00
      condition: "hasPendingApprovals(user)"
      template: |
        📋 您有待处理的审批请求:
        ${pendingApprovals.map(a => `- #${a.id}: ${a.type} (${a.requester})`).join('\n')}
        使用 `/approve ${id}` 或 `/reject ${id}` 进行审批。
        
    # 成本相关
    - name: cost_alert
      description: 成本异常提醒
      trigger:
        type: threshold
        metric: daily_cost
        threshold: 1.2  # 超过昨日 20%
      template: |
        💰 成本异常提醒
        
        今日预计成本：$${todayCost}
        昨日成本：$${yesterdayCost}
        增长：+${increase}%
        
        主要原因：${reason}
        
    # 性能相关
    - name: performance_degradation
      description: 性能下降提醒
      trigger:
        type: threshold
        metric: p99_latency
        threshold: 1.5  # 超过基线 50%
      template: |
        ⚠️ 性能下降检测
        
        **服务**: ${serviceName}
        **当前 P99**: ${currentP99}ms
        **基线 P99**: ${baselineP99}ms
        **增长**: +${increase}%
        
        可能原因：${possibleCauses}

  # 免打扰设置
  quiet_hours:
    enabled: true
    start: "22:00"
    end: "08:00"
    exceptions:
      - severity: P0
      - severity: P1
      
  # 用户偏好
  user_preferences:
    # 可按频道配置
    per_channel: true
    # 可按通知类型配置
    per_type: true
    # 默认订阅状态
    default_opt_in: false
```

### 10.3 智能推荐设计

```typescript
// 智能推荐引擎
class RecommendationEngine {
  // 命令推荐
  recommendCommands(context: RecommendationContext): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // 1. 基于历史行为的推荐
    const historyRecs = this.recommendBasedOnHistory(context.user);
    recommendations.push(...historyRecs);
    
    // 2. 基于当前上下文的推荐
    const contextRecs = this.recommendBasedOnContext(context);
    recommendations.push(...contextRecs);
    
    // 3. 基于角色的推荐
    const roleRecs = this.recommendBasedOnRole(context.user.roles);
    recommendations.push(...roleRecs);
    
    // 4. 基于团队的推荐
    const teamRecs = this.recommendBasedOnTeam(context.user.team);
    recommendations.push(...teamRecs);
    
    // 排序并返回 Top N
    return this.rankRecommendations(recommendations).slice(0, 5);
  }
  
  // 基于历史行为推荐
  private recommendBasedOnHistory(user: User): Recommendation[] {
    const commandHistory = this.getUserCommandHistory(user.id);
    const frequentCommands = this.getFrequentCommands(commandHistory);
    
    return frequentCommands.map(cmd => ({
      type: 'frequent_command',
      command: cmd.name,
      reason: `您经常使用${cmd.name}`,
      confidence: cmd.frequency / commandHistory.length
    }));
  }
  
  // 基于上下文推荐
  private recommendBasedOnContext(context: RecommendationContext): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // 检测当前对话上下文
    if (context.recentMessages.some(m => m.includes('部署') || m.includes('deploy'))) {
      recommendations.push({
        type: 'contextual',
        command: '/deploy',
        reason: '检测到您在讨论部署相关话题',
        confidence: 0.8
      });
    }
    
    // 检测错误消息
    if (context.recentMessages.some(m => m.includes('失败') || m.includes('error'))) {
      recommendations.push({
        type: 'contextual',
        command: '/status',
        reason: '检测到可能有失败的操作，查看状态',
        confidence: 0.7
      });
    }
    
    return recommendations;
  }
  
  // 基于角色推荐
  private recommendBasedOnRole(roles: string[]): Recommendation[] {
    const roleCommands: Record<string, string[]> = {
      'developer': ['/pipeline', '/status', '/deploy --env=dev'],
      'release-manager': ['/deploy', '/approve', '/rollback'],
      'ops': ['/scale', '/status', '/incident'],
      'approver': ['/approve', '/reject', '/status']
    };
    
    const recommendations: Recommendation[] = [];
    for (const role of roles) {
      const commands = roleCommands[role] || [];
      for (const cmd of commands) {
        recommendations.push({
          type: 'role_based',
          command: cmd,
          reason: `基于您的${role}角色推荐`,
          confidence: 0.6
        });
      }
    }
    return recommendations;
  }
}

// 推荐结果
interface Recommendation {
  type: 'frequent_command' | 'contextual' | 'role_based' | 'team_based';
  command: string;
  reason: string;
  confidence: number;
  metadata?: {
    frequency?: number;
    lastUsed?: number;
    successRate?: number;
  };
}
```

### 10.4 机器人响应模板

```yaml
# 机器人响应模板
bot_response_templates:
  # 命令执行成功
  success:
    template: |
      ✅ **${action}** 成功
      
      ${details}
      
      ${optionalTips}
    variables:
      - action
      - details
      - optionalTips
      
  # 命令执行失败
  failure:
    template: |
      ❌ **${action}** 失败
      
      **原因**: ${reason}
      
      **建议**:
      ${suggestions.map(s => `• ${s}`).join('\n')}
      
      [重试] [查看详情] [寻求帮助]
    variables:
      - action
      - reason
      - suggestions
      
  # 等待中
  pending:
    template: |
      ⏳ **${action}** 执行中...
      
      预计耗时：${estimatedTime}
      任务 ID: `${taskId}`
      
      我会持续更新进度。
    variables:
      - action
      - estimatedTime
      - taskId
      
  # 进度更新
  progress:
    template: |
      📊 **${action}** 进度更新
      
      ${progressBar}
      
      **当前阶段**: ${currentStage}
      **完成度**: ${percentage}%
      **剩余时间**: ${remainingTime}
    variables:
      - action
      - progressBar
      - currentStage
      - percentage
      - remainingTime
      
  # 需要确认
  confirmation:
    template: |
      ⚠️ 请确认以下操作:
      
      **命令**: ${command}
      **参数**:
      ${params.map(p => `• ${p.name}: ${p.value}`).join('\n')}
      
      **影响**: ${impact}
      
      [✅ 确认执行] [❌ 取消]
    variables:
      - command
      - params
      - impact
      
  # 帮助信息
  help:
    template: |
      💡 **${command}** 使用帮助
      
      **描述**: ${description}
      
      **用法**:
      \`\`\`
      ${usage}
      \`\`\`
      
      **示例**:
      ${examples.map(e => `• \`${e}\``).join('\n')}
      
      **参数**:
      ${params.map(p => `• \`${p.name}\`: ${p.description}`).join('\n')}
      
      [查看完整文档]
    variables:
      - command
      - description
      - usage
      - examples
      - params
```

---

## 十一、部署与运维 (Deployment and Operations)

### 11.1 部署架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          ChatOps Deployment Architecture                         │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Production Environment                              │
│                                                                                  │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐            │
│  │  API Gateway    │     │  API Gateway    │     │  API Gateway    │            │
│  │  (Kong/ALB)     │     │  (Kong/ALB)     │     │  (Kong/ALB)     │            │
│  │  AZ: us-east-1a │     │  AZ: us-east-1b │     │  AZ: us-east-1c │            │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘            │
│           │                       │                       │                     │
│           └───────────────────────┼───────────────────────┘                     │
│                                   │                                             │
│                                   ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    ChatOps Service Cluster                               │    │
│  │                                                                          │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │    │
│  │  │  Instance 1 │  │  Instance 2 │  │  Instance 3 │                      │    │
│  │  │  (us-east-1a)│  │  (us-east-1b)│  │  (us-east-1c)│                      │    │
│  │  │  4vCPU/8GB  │  │  4vCPU/8GB  │  │  4vCPU/8GB  │                      │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                      │    │
│  │                                                                          │    │
│  │  Auto Scaling: min=3, max=10, target_cpu=70%                            │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                   │                                             │
│           ┌───────────────────────┼───────────────────────┐                     │
│           │                       │                       │                     │
│           ▼                       ▼                       ▼                     │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐            │
│  │   PostgreSQL    │     │     Redis       │     │  Elasticsearch  │            │
│  │   (RDS)         │     │   (ElastiCache) │     │   (Service)     │            │
│  │   Multi-AZ      │     │   Cluster       │     │   3 Nodes       │            │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘            │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                      Event Bus (NATS JetStream)                          │    │
│  │  Nodes: 3 | Replication: 3 | Retention: 7 days                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 监控指标

```yaml
# ChatOps 监控指标
monitoring_metrics:
  # 业务指标
  business:
    - name: chatops_commands_total
      type: counter
      description: 命令执行总数
      labels: [command, status, platform]
      
    - name: chatops_command_duration_seconds
      type: histogram
      description: 命令执行耗时
      labels: [command]
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60]
      
    - name: chatops_commands_success_rate
      type: gauge
      description: 命令成功率
      labels: [command]
      
    - name: chatops_active_sessions
      type: gauge
      description: 活跃会话数
      labels: [platform]
      
  # 系统指标
  system:
    - name: chatops_service_cpu_usage
      type: gauge
      description: 服务 CPU 使用率
      
    - name: chatops_service_memory_usage
      type: gauge
      description: 服务内存使用率
      
    - name: chatops_request_queue_size
      type: gauge
      description: 请求队列大小
      
    - name: chatops_database_connections
      type: gauge
      description: 数据库连接数
      
  # IM 平台指标
  im_platform:
    - name: chatops_im_messages_sent
      type: counter
      description: 发送消息数
      labels: [platform]
      
    - name: chatops_im_messages_received
      type: counter
      description: 接收消息数
      labels: [platform]
      
    - name: chatops_im_api_errors
      type: counter
      description: IM API 错误数
      labels: [platform, error_type]
      
    - name: chatops_im_rate_limit_hits
      type: counter
      description: IM 速率限制触发次数
      labels: [platform]
```

### 11.3 告警规则

```yaml
# ChatOps 告警配置
alerting_rules:
  # P0 告警 (电话通知)
  p0:
    - name: ChatOpsServiceDown
      expr: up{job="chatops"} == 0
      for: 1m
      severity: P0
      message: "ChatOps 服务不可用"
      
    - name: ChatOpsDatabaseDown
      expr: pg_up{database="chatops"} == 0
      for: 1m
      severity: P0
      message: "ChatOps 数据库不可用"
      
  # P1 告警 (IM+ 短信)
  p1:
    - name: ChatOpsHighErrorRate
      expr: |
        sum(rate(chatops_commands_total{status="failed"}[5m])) 
        / sum(rate(chatops_commands_total[5m])) > 0.1
      for: 5m
      severity: P1
      message: "ChatOps 错误率超过 10%"
      
    - name: ChatOpsHighLatency
      expr: |
        histogram_quantile(0.99, 
          rate(chatops_command_duration_seconds_bucket[5m])) > 10
      for: 5m
      severity: P1
      message: "ChatOps P99 延迟超过 10 秒"
      
    - name: ChatOpsQueueBuildup
      expr: chatops_request_queue_size > 100
      for: 5m
      severity: P1
      message: "ChatOps 请求队列堆积"
      
  # P2 告警 (IM 通知)
  p2:
    - name: ChatOpsIMApiErrors
      expr: rate(chatops_im_api_errors[5m]) > 0.1
      for: 10m
      severity: P2
      message: "IM API 错误率升高"
      
    - name: ChatOpsRateLimitTriggered
      expr: rate(chatops_im_rate_limit_hits[5m]) > 1
      for: 10m
      severity: P2
      message: "速率限制频繁触发"
      
    - name: ChatOpsLowSuccessRate
      expr: chatops_commands_success_rate < 0.95
      for: 10m
      severity: P2
      message: "命令成功率低于 95%"
```

---

## 十二、总结 (Summary)

### 12.1 设计要点回顾

本设计文档完整定义了 Orion Design 平台的 ChatOps 系统，涵盖以下核心模块：

| 模块 | 核心内容 | 关键设计 |
|------|---------|---------|
| **整体架构** | 分层架构设计 | IM 适配层、命令解析层、执行引擎层、业务服务层 |
| **IM 集成** | 四平台适配 | 钉钉、企业微信、飞书、Slack 统一接口 |
| **命令语法** | 多样化输入 | 自然语言、结构化命令、命令别名 |
| **命令解析** | 智能识别 | 意图识别、参数提取、上下文理解 |
| **命令执行** | 安全可控 | 权限验证、命令路由、执行跟踪 |
| **命令分类** | 差异处理 | 查询类、操作类、审批类、通知类 |
| **交互设计** | 友好体验 | 卡片消息、按钮交互、表单填写 |
| **审计日志** | 完整追溯 | 谁、何时、什么、结果四要素 |
| **速率限制** | 多层防护 | 用户、频道、命令、全局四级限流 |
| **机器人** | 人格化设计 | 主动通知、智能推荐、响应模板 |

### 12.2 实施建议

| 阶段 | 时间 | 任务 | 产出 |
|------|------|------|------|
| **Phase 1** | Week 1-4 | 核心架构开发 | 可运行的 ChatOps 服务 |
| **Phase 2** | Week 5-8 | IM 平台集成 | 钉钉/企微机器人可用 |
| **Phase 3** | Week 9-12 | 命令集实现 | 8 个核心命令可用 |
| **Phase 4** | Week 13-16 | 交互功能 | 卡片消息、按钮交互 |
| **Phase 5** | Week 17-20 | 审计与限流 | 完整审计日志、速率限制 |
| **Phase 6** | Week 21-24 | 优化与上线 | 性能优化、灰度发布 |

### 12.3 预期效果

通过 ChatOps 系统的实施，Orion Design 平台将实现：

- **效率提升**: 运维响应时间从 5 分钟降至 30 秒 (90% 改善)
- **可追溯性**: 所有操作 100% 记录审计日志
- **降低门槛**: 新人上手成本从 2 周降至 3 天
- **减少错误**: 误操作率从 5% 降至 1%
- **提升体验**: 在 IM 中完成 90% 的日常运维操作

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 优先级：P2 | 维护团队：Orion Platform Team_
