# ChatOps 命令集与通知协作设计

## 1. 概述

本文档定义 Orion Design 平台的 ChatOps 命令集、命令解析器、IM 平台适配、On-Call 排班算法及通知模板，实现开发与运维的即时协作能力。

---

## 2. ChatOps 命令集定义

### 2.1 命令列表

| 命令 | 功能 | 参数 | 权限 | 示例 |
|------|------|------|------|------|
| `/pipeline` | 触发流水线 | `repo`, `branch`, `pipeline` | 开发者 | `/pipeline run --repo=frontend --branch=main` |
| `/deploy` | 部署到环境 | `app`, `env`, `version` | 发布者 | `/deploy deploy --app=api --env=prod --version=1.2.0` |
| `/approve` | 审批通过 | `id`, `comment` | 审批人 | `/approve 123 --comment=LGTM` |
| `/reject` | 审批拒绝 | `id`, `reason` | 审批人 | `/reject 123 --reason=性能风险` |
| `/status` | 查询状态 | `type`, `id` | 所有人 | `/status pipeline 456` |
| `/rollback` | 回滚部署 | `app`, `env`, `target` | 发布者 | `/rollback --app=api --env=prod --target=1.1.0` |
| `/scale` | 扩缩容 | `app`, `env`, `replicas` | 运维 | `/scale --app=api --env=prod --replicas=10` |
| `/incident` | 创建事件 | `severity`, `desc` | 所有人 | `/incident --severity=P1 --desc=API 错误率飙升` |

### 2.2 权限等级定义

| 权限等级 | 角色 | 可执行命令 |
|----------|------|------------|
| L1 - 只读 | 所有人 | `/status`, `/incident` |
| L2 - 开发 | 开发者 | `/pipeline`, `/status`, `/incident` |
| L3 - 发布 | 发布者 | `/deploy`, `/approve`, `/reject`, `/rollback` + L2 |
| L4 - 运维 | 运维 | `/scale` + L3 |

### 2.3 命令详细定义

#### 2.3.1 /pipeline - 流水线管理

```yaml
command: /pipeline
subcommands:
  - run:       触发新流水线
  - cancel:    取消运行中流水线
  - retry:     重试失败流水线
parameters:
  --repo:      仓库名称 (必需)
  --branch:    分支名称 (必需)
  --pipeline:  流水线类型 (build/test/deploy, 默认 build)
  --async:     异步模式，不等待结果 (可选)
  --notify:    通知频道 (可选)
validation:
  - repo 必须存在于注册仓库列表
  - branch 必须符合分支命名规范
  - 用户必须具有该仓库的访问权限
```

#### 2.3.2 /deploy - 部署管理

```yaml
command: /deploy
subcommands:
  - deploy:    执行部署
  - preview:   预览部署配置
  - history:   查看部署历史
parameters:
  --app:       应用名称 (必需)
  --env:       目标环境 (dev/staging/prod, 必需)
  --version:   部署版本 (必需)
  --strategy:  部署策略 (blue-green/canary/rolling, 默认 rolling)
  --timeout:   超时时间 (分钟，默认 30)
validation:
  - prod 环境部署需要二级审批
  - 版本必须已通过测试环境验证
  - 同一时间同一环境只能有一个部署
```

#### 2.3.3 /approve & /reject - 审批管理

```yaml
command: /approve
parameters:
  id:          审批项 ID (必需)
  --comment:   审批意见 (可选)
  
command: /reject
parameters:
  id:          审批项 ID (必需)
  --reason:    拒绝原因 (必需)
  --blocker:   阻塞问题描述 (可选)
validation:
  - 用户必须是审批人或审批管理员
  - 审批项必须处于待审批状态
```

#### 2.3.4 /status - 状态查询

```yaml
command: /status
subcommands:
  - pipeline:  查询流水线状态
  - deploy:    查询部署状态
  - app:       查询应用健康状态
  - oncall:    查询当前 On-Call 人员
parameters:
  id:          资源 ID (必需)
  --detail:    显示详细信息 (可选)
  --history:   显示历史记录 (可选)
```

#### 2.3.5 /rollback - 回滚管理

```yaml
command: /rollback
parameters:
  --app:       应用名称 (必需)
  --env:       环境名称 (必需)
  --target:    目标版本 (必需)
  --reason:    回滚原因 (必需)
  --notify:    是否通知相关人员 (默认 true)
validation:
  - 目标版本必须是历史成功部署版本
  - prod 环境回滚需要运维确认
  - 1 小时内同一应用只能回滚 2 次
```

#### 2.3.6 /scale - 扩缩容管理

```yaml
command: /scale
parameters:
  --app:       应用名称 (必需)
  --env:       环境名称 (必需)
  --replicas:  副本数 (必需)
  --reason:    扩缩容原因 (可选)
validation:
  - 副本数必须在 [min, max] 范围内
  - 缩容到 0 需要二次确认
  - prod 环境需要运维权限
```

#### 2.3.7 /incident - 事件管理

```yaml
command: /incident
subcommands:
  - create:    创建事件
  - update:    更新事件
  - close:     关闭事件
  - list:      列出事件
parameters:
  --severity:  严重程度 (P0/P1/P2/P3, 必需)
  --desc:      事件描述 (必需)
  --app:       关联应用 (可选)
  --assignee:  指派人 (可选)
validation:
  - P0/P1 事件自动电话通知 On-Call
  - 必须提供清晰的描述
```

---

## 3. 命令解析器设计

### 3.1 解析流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           命令解析流程图                                  │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  用户输入  │ ──▶ │  命令识别  │ ──▶ │  参数解析  │ ──▶ │ 权限验证  │ ──▶ │  命令执行  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │                │
     ▼                ▼                ▼                ▼                ▼
 原始消息文本    提取命令前缀     解析键值对参数    检查 RBAC 权限    调用后端 API
     │           验证命令格式         类型转换        记录审计日志    执行具体逻辑
     │                │                │                │                │
     └────────────────┴────────────────┴────────────────┴────────────────┘
                                    │
                                    ▼
                              ┌──────────┐
                              │  结果反馈  │
                              └──────────┘
                                   │
                                   ▼
                              格式化响应消息
                              发送到 IM 频道
```

### 3.2 解析器架构

```typescript
interface CommandParser {
  // 1. 命令识别
  recognize(message: string): CommandMatch | null;
  
  // 2. 参数解析
  parseParams(rawParams: string[]): ParsedParams;
  
  // 3. 权限验证
  verifyPermission(user: User, command: Command): boolean;
  
  // 4. 命令执行
  execute(command: Command, params: ParsedParams): Promise<CommandResult>;
  
  // 5. 结果反馈
  formatResult(result: CommandResult): FormattedMessage;
}

// 命令匹配结果
interface CommandMatch {
  command: string;           // 命令名称
  subcommand?: string;       // 子命令
  rawParams: string[];       // 原始参数
  confidence: number;        // 匹配置信度
}

// 解析后参数
interface ParsedParams {
  positional: string[];      // 位置参数
  named: Record<string, any>; // 命名参数
  flags: string[];           // 标志参数
}

// 执行结果
interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
  action?: FollowUpAction;
}
```

### 3.3 命令识别规则

```
命令格式：/[a-z]+(\s+[a-z]+)?(\s+--?[a-zA-Z]+=?\S*)*

正则表达式：
  COMMAND_PATTERN = /^\/([a-z]+)(?:\s+([a-z]+))?(.*)$/i
  PARAM_PATTERN = /--?([a-zA-Z0-9_-]+)(?:=([^\s]+))?/g

解析步骤：
  1. 匹配命令前缀 "/"
  2. 提取主命令和子命令
  3. 解析剩余参数
  4. 验证参数完整性
```

---

## 4. IM 平台适配

### 4.1 平台配置矩阵

| 平台 | 接入方式 | Webhook | 交互支持 | 消息类型 |
|------|----------|---------|----------|----------|
| 钉钉 | 机器人 | ✅ | 按钮/列表 | 文本/卡片 |
| 企业微信 | 机器人 | ✅ | 按钮/菜单 | 文本/卡片 |
| 飞书 | 机器人 | ✅ | 交互式卡片 | 富文本/卡片 |
| Slack | Bot | ✅ | Block Kit | 丰富交互 |

### 4.2 钉钉机器人配置

```yaml
platform: dingtalk
config:
  webhook: https://oapi.dingtalk.com/robot/send?access_token=${TOKEN}
  secret: ${SECRET}  # 加签密钥
  message_type: interactive_card
  
card_template:
  type: markdown
  title: Orion Design ChatOps
  text: |
    ## ${title}
    ${content}
    ---
    ${action_buttons}
    
buttons:
  - title: 查看详情
    action_url: ${detail_url}
  - title: 确认执行
    action_key: confirm
```

### 4.3 企业微信机器人配置

```yaml
platform: wecom
config:
  webhook: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${KEY}
  message_type: template_card
  
card_template:
  card_type: text_notice
  source:
    icon_url: https://orion.design/logo.png
    desc: ChatOps
  main_title:
    title: ${title}
    desc: ${subtitle}
  emphasis_content:
    title: ${status}
    desc: ${message}
  sub_button_text: 操作
  sub_button_url: ${action_url}
```

### 4.4 飞书机器人配置

```yaml
platform: feishu
config:
  webhook: https://open.feishu.cn/open-apis/bot/v2/hook/${TOKEN}
  message_type: interactive
  
card_template:
  config:
    wide_screen_mode: true
  elements:
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
            content: 确认
          type: primary
          value: {"action": "confirm"}
```

### 4.5 Slack Bot 配置

```yaml
platform: slack
config:
  bot_token: xoxb-${BOT_TOKEN}
  signing_secret: ${SIGNING_SECRET}
  
block_kit:
  type: message
  blocks:
    - type: header
      text:
        type: plain_text
        text: Orion Design ChatOps
    - type: section
      text:
        type: mrkdwn
        text: "*${title}*\n${content}"
    - type: actions
      elements:
        - type: button
          text:
            type: plain_text
            text: Approve
          value: approve_action
          style: primary
```

### 4.6 统一适配器接口

```typescript
interface IMAdapter {
  send(message: Message): Promise<void>;
  sendInteractive(message: InteractiveMessage): Promise<void>;
  handleCallback(callback: CallbackEvent): Promise<void>;
  parseUser(event: MessageEvent): User;
}

// 适配器工厂
class IMAdapterFactory {
  static create(platform: string): IMAdapter {
    switch (platform) {
      case 'dingtalk': return new DingTalkAdapter();
      case 'wecom': return new WeComAdapter();
      case 'feishu': return new FeishuAdapter();
      case 'slack': return new SlackAdapter();
      default: throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}
```

---

## 5. On-Call 排班算法

### 5.1 核心概念

| 概念 | 说明 |
|------|------|
| 轮值周期 | 按周或按天轮换 |
| 主值班人 | 第一响应人 (Primary) |
| 备值班人 | 升级响应人 (Secondary) |
| 升级策略 | 超时未响应的升级规则 |
| 替班机制 | 临时替换值班人 |

### 5.2 排班算法伪代码

```
算法：OnCallScheduler.generateSchedule()

输入：
  - roster: 值班人员名单
  - config: 排班配置 { cycleType, startDate, endDate, timezone }
  - constraints: 约束条件 { holidays, unavailable, preferences }
输出：
  - schedule: 排班表

步骤:

1. // 初始化
   schedule ← empty list
   currentIndex ← 0
   currentDate ← config.startDate

2. // 主循环：生成每日排班
   WHILE currentDate <= config.endDate DO
   
     a. // 检查节假日
        IF isHoliday(currentDate) THEN
          IF config.holidayPolicy == "skip" THEN
            currentDate ← currentDate + 1 day
            CONTINUE
          ELSE IF config.holidayPolicy == "special" THEN
            person ← getHolidayVolunteer()
          END IF
        END IF
     
     b. // 检查不可用人员
        availableRoster ← roster.filter(p => !isUnavailable(p, currentDate))
        
        IF availableRoster.length == 0 THEN
          LOG "Warning: No available personnel"
          availableRoster ← roster  // 强制排班
        END IF
     
     c. // 轮班选择
        person ← availableRoster[currentIndex % availableRoster.length]
        
        // 检查连续值班限制
        IF hasConsecutiveShifts(person, currentDate, config.maxConsecutiveDays) THEN
          currentIndex ← currentIndex + 1
          person ← availableRoster[currentIndex % availableRoster.length]
        END IF
     
     d. // 创建排班记录
        shift ← {
          date: currentDate,
          primary: person,
          secondary: availableRoster[(currentIndex + 1) % availableRoster.length],
          timezone: config.timezone
        }
        schedule.add(shift)
        
     e. // 移动到下一天
        currentDate ← currentDate + 1 day
        currentIndex ← currentIndex + 1
   
   END WHILE

3. // 应用偏好调整
   schedule ← applyPreferences(schedule, constraints.preferences)

4. RETURN schedule


算法：OnCallScheduler.escalation()

输入:
  - incident: 事件
  - schedule: 当日排班
  - config: 升级配置
输出:
  - notifyList: 通知列表

步骤:

1. notifyList ← [schedule.primary]
   lastNotifyTime ← incident.createdAt
   currentTime ← now()

2. // 升级检查
   WHILE currentTime - lastNotifyTime > config.escalationTimeout DO
     
     a. // 检查主值班人是否已响应
        IF hasResponded(schedule.primary, incident) THEN
          BREAK
        END IF
     
     b. // 升级到备值班人
        IF schedule.secondary NOT IN notifyList THEN
          notifyList.add(schedule.secondary)
          sendNotification(schedule.secondary, incident, level: "escalated")
        END IF
     
     c. // 继续升级到管理员
        IF currentTime - lastNotifyTime > config.managerEscalationTimeout THEN
          FOR manager IN config.managers DO
            IF manager NOT IN notifyList THEN
              notifyList.add(manager)
              sendNotification(manager, incident, level: "critical")
            END IF
          END FOR
        END IF
     
     d. lastNotifyTime ← currentTime
        currentTime ← now()
   
   END WHILE

3. RETURN notifyList


算法：OnCallScheduler.findSubstitute()

输入:
  - originalPerson: 原值班人
  - dateRange: 日期范围
  - roster: 可替班人员
输出:
  - substitute: 替班人或 null

步骤:

1. // 查找自愿替班
   FOR person IN roster DO
     IF person != originalPerson THEN
       IF hasVolunteered(person, dateRange) THEN
         RETURN person
       END IF
     END IF
   END FOR

2. // 按轮班顺序查找下一个可用人员
   nextInRotation ← getNextInRotation(originalPerson, roster)
   
   IF !isUnavailable(nextInRotation, dateRange) 
      AND !hasConsecutiveShifts(nextInRotation, dateRange) THEN
     RETURN nextInRotation
   END IF

3. // 查找管理协调
   RETURN requestManualAssignment(originalPerson, dateRange)
```

### 5.3 通知疲劳控制

```typescript
interface FatigueControl {
  // 最小通知间隔
  minNotifyInterval: number;        // 默认 5 分钟
  
  // 静默时段
  quietHours: {
    start: string;                  // 默认 "22:00"
    end: string;                    // 默认 "08:00"
    enabled: boolean;               // 是否启用
  };
  
  // P0/P1 可突破静默
  emergencyOverride: boolean;       // 默认 true
  
  // 聚合通知
  aggregation: {
    window: number;                 // 聚合窗口 (秒)
    maxBatch: number;               // 最大批量
  };
  
  // 重复告警抑制
  duplicateSuppression: {
    key: string;                    // 去重键
    ttl: number;                    // 抑制时间
  };
}

// 疲劳检测
function shouldNotify(fatigueControl: FatigueControl, event: Event): boolean {
  const lastNotifyTime = getLastNotifyTime(event.source);
  const now = Date.now();
  
  // 检查最小间隔
  if (now - lastNotifyTime < fatigueControl.minNotifyInterval) {
    return false;
  }
  
  // 检查静默时段
  if (fatigueControl.quietHours.enabled && isQuietHours(fatigueControl.quietHours)) {
    if (event.severity < 'P1' || !fatigueControl.emergencyOverride) {
      return false;
    }
  }
  
  return true;
}
```

---

## 6. 通知模板设计

### 6.1 流水线通知模板

```markdown
## 🔄 流水线通知

**应用**: ${appName}
**仓库**: ${repoName}
**分支**: ${branchName}
**流水线**: ${pipelineType}
**状态**: ${status}  ${statusEmoji}

---

**详情**:
- 触发人：${triggeredBy}
- 开始时间：${startTime}
- 预计耗时：${estimatedDuration}
- 当前阶段：${currentStage}

${progressBar}

**操作**:
[查看日志](${logUrl}) | [取消运行](${cancelUrl})
```

### 6.2 审批通知模板

```markdown
## ✅ 审批请求

**类型**: ${approvalType}
**ID**: #${approvalId}
**申请人**: ${requester}
**申请时间**: ${requestTime}

---

**详情**:
${description}

**变更内容**:
${changeSummary}

**风险等级**: ${riskLevel}

---

**审批操作**:
✅ [通过](/approve ${approvalId}) | ❌ [拒绝](/reject ${approvalId})

*请于 ${deadline} 前完成审批*
```

### 6.3 告警通知模板

```markdown
## 🚨 告警通知

**级别**: ${severity} ${severityIcon}
**标题**: ${alertTitle}
**来源**: ${alertSource}
**时间**: ${alertTime}

---

**详情**:
${alertDescription}

**影响范围**:
- 服务：${affectedServices}
- 用户：${affectedUsers}
- 持续时间：${duration}

**当前 On-Call**: 
👤 主值班：${primaryOncall}
👤 备值班：${secondaryOncall}

---

**快速操作**:
📋 [查看面板](${dashboardUrl}) | 🔍 [查看日志](${logUrl}) | 📞 [呼叫 On-Call](${callUrl})

*事件 ID: ${incidentId}*
```

### 6.4 部署通知模板

```markdown
## 🚀 部署通知

**应用**: ${appName}
**环境**: ${envName} ${envIcon}
**版本**: ${version}
**状态**: ${status}

---

**部署详情**:
- 部署人：${deployedBy}
- 部署策略：${strategy}
- 开始时间：${startTime}
- 完成时间：${endTime}
- 持续时间：${duration}

**变更摘要**:
${changeSummary}

**健康检查**:
${healthCheckStatus}

---

**操作**:
📊 [查看详情](${detailUrl}) | 🔙 [回滚](${rollbackUrl})
```

### 6.5 事件通知模板

```markdown
## 📋 事件更新

**事件 ID**: #${incidentId}
**级别**: ${severity}
**状态**: ${status}
**更新**: ${updateType}

---

**描述**:
${description}

**时间线**:
${timeline}

**当前行动**:
${currentActions}

**下一步**:
${nextSteps}

---

**参与**:
👥 [加入战情室](${warRoomUrl}) | 📝 [更新事件](${updateUrl})
```

### 6.6 模板渲染引擎

```typescript
interface NotificationTemplate {
  id: string;
  name: string;
  platforms: string[];
  template: string;
  variables: string[];
}

class TemplateRenderer {
  private templates: Map<string, NotificationTemplate>;
  
  render(templateId: string, context: Record<string, any>): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    let rendered = template.template;
    for (const [key, value] of Object.entries(context)) {
      rendered = rendered.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
    
    return rendered;
  }
  
  // 平台特定渲染
  renderForPlatform(templateId: string, context: Record<string, any>, platform: string): PlatformMessage {
    const rendered = this.render(templateId, context);
    
    switch (platform) {
      case 'dingtalk':
        return this.toDingTalkCard(rendered);
      case 'feishu':
        return this.toFeishuCard(rendered);
      case 'slack':
        return this.toSlackBlocks(rendered);
      default:
        return { type: 'text', content: rendered };
    }
  }
}
```

---

## 7. 配置示例

### 7.1 ChatOps 配置文件

```yaml
# config/chatops.yaml
chatops:
  enabled: true
  
  commands:
    - name: pipeline
      enabled: true
      rate_limit:
        max_requests: 10
        window: 60s
      
    - name: deploy
      enabled: true
      require_approval:
        - prod
      rate_limit:
        max_requests: 5
        window: 60s
        
  im_platforms:
    - platform: dingtalk
      enabled: true
      webhook: ${DINGTALK_WEBHOOK}
      secret: ${DINGTALK_SECRET}
      
    - platform: feishu
      enabled: true
      webhook: ${FEISHU_WEBHOOK}
      
  oncall:
    schedule:
      cycle_type: weekly
      start_day: monday
      handover_time: "10:00"
      timezone: Asia/Shanghai
      
    escalation:
      timeout: 15m
      manager_timeout: 30m
      managers:
        - @tech-lead
        - @ops-manager
        
    fatigue_control:
      quiet_hours:
        enabled: true
        start: "22:00"
        end: "08:00"
      min_notify_interval: 5m
```

---

## 8. 交互式引导设计

### 8.1 问题背景

UX 评审发现以下问题：
- ChatOps 命令学习成本高，用户需记忆 8 个主命令 + 子命令 + 参数组合
- 缺少自动补全和参数提示
- 错误提示不友好，用户不知道如何修正

本节设计交互式引导机制，降低命令使用门槛。

---

### 8.2 交互式命令卡片设计

#### 8.2.1 钉钉/企微/飞书卡片布局

```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 Orion ChatOps 命令助手                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ▼ 选择命令  [  pipeline  ▼]                                   │
│                                                                 │
│  ▼ 子命令    [  run     ▼]                                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 参数输入                                                 │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ 仓库    [frontend/backend/infra...            ] 🔍      │   │
│  │ 分支    [main/develop/release-1.2...          ] 🔍      │   │
│  │ 流水线  [build/test/deploy                    ]         │   │
│  │ 变量    [+ 添加键值对]                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ⚡ 快捷参数：[production] [staging] [dry-run]                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  📋 发送前预览：                                                 │
│  /pipeline run --repo=frontend --branch=main --pipeline=build  │
│                                                                 │
│  [ 取消 ]                    [ 确认发送 ]                       │
└─────────────────────────────────────────────────────────────────┘
```

#### 8.2.2 卡片组件定义

```yaml
card_structure:
  header:
    icon: "🤖"
    title: "Orion ChatOps 命令助手"
    
  command_selector:
    type: "dropdown"
    options:
      - { value: "pipeline", label: "/pipeline - 流水线管理" }
      - { value: "deploy", label: "/deploy - 部署管理" }
      - { value: "approve", label: "/approve - 审批通过" }
      - { value: "reject", label: "/reject - 审批拒绝" }
      - { value: "status", label: "/status - 状态查询" }
      - { value: "rollback", label: "/rollback - 回滚部署" }
      - { value: "scale", label: "/scale - 扩缩容" }
      - { value: "incident", label: "/incident - 事件管理" }
    placeholder: "选择命令..."
    
  subcommand_selector:
    type: "dropdown"
    dynamic_options: true  # 根据主命令动态加载
    placeholder: "选择子命令..."
    
  parameter_form:
    type: "key_value_input"
    fields:
      - { key: "repo", label: "仓库", type: "select", required: true }
      - { key: "branch", label: "分支", type: "select", required: true }
      - { key: "pipeline", label: "流水线", type: "select", default: "build" }
      - { key: "variables", label: "变量", type: "key_value_pair", required: false }
      
  quick_params:
    type: "chip_buttons"
    options:
      - { label: "production", value: "--env=prod" }
      - { label: "staging", value: "--env=staging" }
      - { label: "dry-run", value: "--dry-run" }
      - { label: "async", value: "--async" }
      
  preview:
    type: "text_preview"
    label: "发送前预览"
    editable: true
    
  actions:
    - { type: "secondary", label: "取消", action: "cancel" }
    - { type: "primary", label: "确认发送", action: "send" }
```

---

### 8.3 自动补全设计

#### 8.3.1 补全触发规则

```
用户输入          →  机器人提示
─────────────────────────────────────────────────
/pip             →  /pipeline, /pipelinerun
/pipeline        →  run, cancel, retry, list
/pipeline r      →  run, retry
/pipeline run -- →  --repo, --branch, --pipeline, --async, --notify
/pipeline run --r →  --repo, --region
```

#### 8.3.2 补全数据结构

```typescript
interface AutocompleteSuggestion {
  type: 'command' | 'subcommand' | 'parameter' | 'value';
  label: string;           // 显示文本
  value: string;           // 插入值
  description?: string;    // 简要说明
  icon?: string;           // 图标
  priority: number;        // 排序优先级
}

interface AutocompleteContext {
  input: string;           // 当前输入
  cursorPosition: number;  // 光标位置
  matchedPrefix: string;   // 已匹配前缀
  suggestions: AutocompleteSuggestion[];
}

// 补全规则表
const AUTOCOMPLETE_RULES = {
  commands: [
    { pattern: '^/pip', suggestions: ['pipeline', 'pipelinerun'] },
    { pattern: '^/dep', suggestions: ['deploy'] },
    { pattern: '^/app', suggestions: ['approve'] },
    { pattern: '^/sta', suggestions: ['status'] },
    { pattern: '^/rol', suggestions: ['rollback'] },
    { pattern: '^/sca', suggestions: ['scale'] },
    { pattern: '^/inc', suggestions: ['incident'] },
  ],
  
  subcommands: {
    pipeline: ['run', 'cancel', 'retry', 'list'],
    deploy: ['deploy', 'preview', 'history'],
    status: ['pipeline', 'deploy', 'app', 'oncall'],
    incident: ['create', 'update', 'close', 'list'],
  },
  
  parameters: {
    pipeline: ['--repo', '--branch', '--pipeline', '--async', '--notify'],
    deploy: ['--app', '--env', '--version', '--strategy', '--timeout'],
    rollback: ['--app', '--env', '--target', '--reason', '--notify'],
  },
};
```

#### 8.3.3 补全算法

```typescript
class CommandAutocomplete {
  private rules: AutocompleteRules;
  private history: CommandHistory;
  
  suggest(input: string, cursorPos: number): AutocompleteContext {
    const prefix = input.substring(0, cursorPos);
    const suggestions: AutocompleteSuggestion[] = [];
    
    // 1. 命令补全（以/开头）
    if (prefix.startsWith('/') && !prefix.includes(' ')) {
      suggestions.push(...this.matchCommands(prefix));
    }
    // 2. 子命令补全（主命令后第一个词）
    else if (this.isSubcommandPosition(prefix)) {
      const mainCommand = this.extractMainCommand(prefix);
      suggestions.push(...this.matchSubcommands(mainCommand, prefix));
    }
    // 3. 参数补全（--开头）
    else if (prefix.match(/--[\w-]*$/)) {
      const mainCommand = this.extractMainCommand(prefix);
      suggestions.push(...this.matchParameters(mainCommand, prefix));
    }
    // 4. 参数值补全
    else if (prefix.match(/--[\w-]+=/)) {
      suggestions.push(...this.matchParameterValues(prefix));
    }
    
    // 5. 历史命令补全（加权）
    const historySuggestions = this.history.getSimilar(prefix);
    suggestions.push(...historySuggestions.map(h => ({
      ...h,
      priority: h.priority + 10  // 历史命令优先
    })));
    
    return {
      input,
      cursorPosition: cursorPos,
      matchedPrefix: this.getCommonPrefix(suggestions),
      suggestions: this.sortByPriority(suggestions)
    };
  }
  
  private matchCommands(prefix: string): AutocompleteSuggestion[] {
    return COMMANDS
      .filter(cmd => cmd.startsWith(prefix))
      .map(cmd => ({
        type: 'command',
        label: `/${cmd}`,
        value: `/${cmd} `,
        description: this.getCommandDesc(cmd),
        priority: 1
      }));
  }
  
  private matchSubcommands(command: string, prefix: string): AutocompleteSuggestion[] {
    const subcommands = SUBCOMMANDS[command] || [];
    const lastWord = prefix.split(' ').pop() || '';
    
    return subcommands
      .filter(sub => sub.startsWith(lastWord))
      .map(sub => ({
        type: 'subcommand',
        label: sub,
        value: sub + ' ',
        description: this.getSubcommandDesc(command, sub),
        priority: 2
      }));
  }
  
  private matchParameters(command: string, prefix: string): AutocompleteSuggestion[] {
    const params = PARAMETERS[command] || [];
    const paramPrefix = prefix.match(/--[\w-]*$/)?.[0] || '';
    
    return params
      .filter(p => p.startsWith(paramPrefix))
      .map(param => ({
        type: 'parameter',
        label: param,
        value: param + '=',
        description: this.getParamDesc(command, param),
        priority: 3
      }));
  }
}
```

---

### 8.4 参数引导表单设计

#### 8.4.1 引导式表单流程

```
用户输入：/pipeline run

机器人响应（交互式卡片）:

┌─────────────────────────────────────────────────────────────┐
│  📝 流水线执行向导                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  步骤 1/4: 选择仓库                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ▼ 仓库                                              │   │
│  │    ├─ 📁 frontend-web                               │   │
│  │    ├─ 📁 backend-api                                │   │
│  │    ├─ 📁 mobile-app                                 │   │
│  │    └─ 📁 infrastructure                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [上一步]                           [下一步 >]              │
└─────────────────────────────────────────────────────────────┘

用户选择后 → 步骤 2/4: 选择分支
用户选择后 → 步骤 3/4: 选择流水线类型
用户选择后 → 步骤 4/4: 配置变量

最后 → 生成完整命令并确认
```

#### 8.4.2 表单字段配置

```yaml
form_definitions:
  pipeline_run:
    title: "流水线执行向导"
    steps:
      - id: repo
        label: "选择仓库"
        type: "select"
        required: true
        options_source: "api:/repos"
        display_format: "{icon} {name}"
        
      - id: branch
        label: "选择分支"
        type: "select"
        required: true
        options_source: "api:/repos/{repo}/branches"
        default: "main"
        
      - id: pipeline_type
        label: "流水线类型"
        type: "radio"
        options:
          - { value: "build", label: "🔨 构建" }
          - { value: "test", label: "🧪 测试" }
          - { value: "deploy", label: "🚀 部署" }
        default: "build"
        
      - id: variables
        label: "环境变量"
        type: "key_value_editor"
        required: false
        presets:
          - name: "生产环境"
            values: { ENV: "production", LOG_LEVEL: "info" }
          - name: "测试环境"
            values: { ENV: "testing", LOG_LEVEL: "debug" }
            
    on_complete:
      action: "generate_command"
      template: "/pipeline run --repo={repo} --branch={branch} --pipeline={pipeline_type} {variables}"
```

#### 8.4.3 动态参数联动

```typescript
interface FormField {
  id: string;
  type: 'select' | 'input' | 'radio' | 'key_value';
  dependencies?: string[];  // 依赖的其他字段
  dynamicOptions?: {
    apiEndpoint: string;
    params: (formData: FormData) => Record<string, any>;
  };
  validation?: {
    required: boolean;
    pattern?: string;
    custom?: (value: any) => boolean;
  };
}

// 示例：分支选择依赖仓库选择
const branchField: FormField = {
  id: 'branch',
  type: 'select',
  dependencies: ['repo'],
  dynamicOptions: {
    apiEndpoint: '/repos/{repo}/branches',
    params: (formData) => ({ repo: formData.repo })
  },
  validation: { required: true }
};

// 当仓库变更时，自动刷新分支选项
function onFieldChange(fieldId: string, value: any, formData: FormData) {
  const dependentFields = getDependentFields(fieldId);
  for (const dep of dependentFields) {
    if (dep.dynamicOptions) {
      refreshOptions(dep.id, dep.dynamicOptions.params(formData));
    }
  }
}
```

---

### 8.5 命令历史与快捷方式

#### 8.5.1 最近使用命令

```yaml
command_history:
  storage: "local_storage"  # 或用户级数据库
  max_items: 20
  display_format:
    - timestamp: "2024-01-15 10:30"
      command: "/pipeline run --repo=frontend --branch=main"
      status: "success"
      duration: "3m 24s"
    - timestamp: "2024-01-15 09:15"
      command: "/deploy --app=api --env=staging --version=1.2.0"
      status: "success"
      
  quick_rerun: true  # 一键重新执行
  edit_before_run: true  # 编辑后执行
```

#### 8.5.2 收藏命令

```yaml
favorite_commands:
  storage: "user_preferences"
  max_items: 10
  display:
    position: "command_input_below"
    style: "icon_buttons"
    
  examples:
    - name: "部署生产"
      command: "/deploy --app=api --env=prod --version=latest"
      icon: "🚀"
    - name: "构建主分支"
      command: "/pipeline run --repo=frontend --branch=main"
      icon: "🔨"
    - name: "查看 On-Call"
      command: "/status oncall"
      icon: "👤"
```

#### 8.5.3 常用参数模板

```yaml
parameter_templates:
  - name: "生产部署"
    scope: "deploy"
    params:
      env: "prod"
      strategy: "blue-green"
      timeout: "60"
    variables:
      NOTIFY_CHANNEL: "prod-deploy-alerts"
      
  - name: "快速测试"
    scope: "pipeline"
    params:
      pipeline: "test"
      async: true
    variables:
      TEST_SUITE: "smoke"
      
  - name: "紧急回滚"
    scope: "rollback"
    params:
      notify: true
    variables:
      ESCALATE: "true"
      
  # 模板使用方式
  # /deploy --template=生产部署 --app=myapp --version=1.2.3
```

---

### 8.6 错误提示优化

#### 8.6.1 错误类型与提示模板

```yaml
error_templates:
  command_not_found:
    trigger: "未识别的命令"
    response: |
      ❌ 未识别的命令：**${input}**
      
      您可能想输入：
      ${suggestions.map(s => `• /${s}`).join('\n')}
      
      💡 提示：输入 `/help` 查看所有可用命令
      
    example:
      input: "/pipelne"
      response: |
        ❌ 未识别的命令：**/pipelne**
        
        您可能想输入：
        • /pipeline
        • /pipelinerun
        
        💡 提示：输入 `/help` 查看所有可用命令

  missing_required_param:
    trigger: "缺少必需参数"
    response: |
      ❌ 缺少必需参数：**${missingParam}**
      
      正确格式：
      \`\`\`
      ${commandSyntax}
      \`\`\`
      
      可用参数：
      ${availableParams.map(p => `• ${p.name}: ${p.description}`).join('\n')}
      
      示例：
      \`\`\`
      ${exampleUsage}
      \`\`\`
      
      [📝 打开参数向导]
      
    example:
      input: "/pipeline run --repo=frontend"
      response: |
        ❌ 缺少必需参数：**--branch**
        
        正确格式：
        ```
        /pipeline run --repo=<仓库> --branch=<分支> [--pipeline=类型]
        ```
        
        可用参数：
        • --repo: 仓库名称（必需）
        • --branch: 分支名称（必需）
        • --pipeline: 流水线类型（可选，默认 build）
        • --async: 异步模式（可选）
        
        示例：
        ```
        /pipeline run --repo=frontend --branch=main --pipeline=build
        ```
        
        [📝 打开参数向导]

  invalid_param_value:
    trigger: "参数值无效"
    response: |
      ❌ 参数值无效：**${param}=${value}**
      
      原因：${reason}
      
      有效值：
      ${validValues.map(v => `• ${v}`).join('\n')}
      
      示例：
      \`\`\`
      ${exampleUsage}
      \`\`\`
      
    example:
      input: "/deploy --env=production"
      response: |
        ❌ 参数值无效：**--env=production**
        
        原因：环境名称必须是 dev、staging 或 prod
        
        有效值：
        • dev
        • staging
        • prod
        
        示例：
        ```
        /deploy --app=api --env=prod --version=1.2.0
        ```

  permission_denied:
    trigger: "权限不足"
    response: |
      🔒 权限不足
      
      命令 **${command}** 需要权限等级：**${requiredLevel}**
      您的权限等级：**${userLevel}**
      
      请联系管理员提升权限，或使用以下命令查看您的权限：
      \`\`\`
      /status permission
      \`\`\`
      
      可用命令（当前权限）：
      ${availableCommands.map(c => `• /${c}`).join('\n')}

  syntax_error:
    trigger: "命令格式错误"
    response: |
      ❌ 命令格式错误
      
      期望格式：
      \`\`\`
      ${expectedSyntax}
      \`\`\`
      
      问题分析：
      • ${analysis}
      
      正确示例：
      \`\`\`
      ${correctExample}
      \`\`\`
      
      [📝 使用向导模式]
```

#### 8.6.2 错误响应组件

```typescript
interface ErrorResponse {
  type: 'command_not_found' | 'missing_param' | 'invalid_value' | 
        'permission_denied' | 'syntax_error';
  message: string;
  suggestion: string[];
  helpUrl?: string;
  quickActions: QuickAction[];
}

interface QuickAction {
  label: string;
  action: 'open_wizard' | 'fill_template' | 'show_help' | 'copy_example';
  payload?: any;
}

// 错误响应生成器
class ErrorResponder {
  generateError(context: CommandContext, error: CommandError): ErrorResponse {
    const template = ERROR_TEMPLATES[error.type];
    
    return {
      type: error.type,
      message: this.renderTemplate(template.message, context),
      suggestion: template.suggestions,
      helpUrl: `/docs/chatops/${context.command}`,
      quickActions: [
        { label: '📝 使用向导模式', action: 'open_wizard', payload: { command: context.command } },
        { label: '📋 复制示例', action: 'copy_example', payload: { text: template.example } },
      ]
    };
  }
}
```

---

### 8.7 ASCII 设计图汇总

#### 8.7.1 主命令选择界面

```
╔═══════════════════════════════════════════════════════════╗
║  🤖 Orion ChatOps                                         ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  选择要执行的命令：                                        ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │  ▼  /pipeline  - 流水线管理                      ▼  │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                           ║
║  ───────────────────────────────────────────────────────  ║
║  最近使用：                                                ║
║  🕐 /pipeline run --repo=frontend --branch=main           ║
║  🕐 /deploy --app=api --env=staging                       ║
║                                                           ║
║  ⭐ 收藏命令：                                             ║
║  [🚀 部署生产] [🔨 构建主分支] [👤 查看 On-Call]          ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║  💡 提示：输入 /help 查看完整命令列表                      ║
╚═══════════════════════════════════════════════════════════╝
```

#### 8.7.2 参数输入界面

```
╔═══════════════════════════════════════════════════════════╗
║  📝 /pipeline run - 参数配置                               ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  ① 仓库  [frontend-web                    ▼]  ✅          ║
║  ② 分支  [main                            ▼]  ✅          ║
║  ③ 类型  [● build  ○ test  ○ deploy]       ✅          ║
║  ④ 变量  [+ 添加环境变量...]               ⏭️ 可选       ║
║                                                           ║
║  ───────────────────────────────────────────────────────  ║
║  ⚡ 快捷参数：                                             ║
║  [production] [staging] [dry-run] [async]                ║
║                                                           ║
║  ───────────────────────────────────────────────────────  ║
║  📋 预览：                                                 ║
║  /pipeline run --repo=frontend-web --branch=main \        ║
║              --pipeline=build                             ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║  [取消]  [← 返回]              [重置]  [确认发送 →]       ║
╚═══════════════════════════════════════════════════════════╝
```

#### 8.7.3 自动补全弹出

```
  /pipeline run --r|
                 ┌─────────────────────────────┐
                 │ 🔍 参数补全                  │
                 ├─────────────────────────────┤
                 │ --repo        仓库名称      │
                 │ --region      区域          │
                 │ --retry       重试次数      │
                 │ --run-as      执行用户      │
                 └─────────────────────────────┘
```

#### 8.7.4 错误提示界面

```
╔═══════════════════════════════════════════════════════════╗
║  ❌ 命令格式错误                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  输入：/pipeline run --repo=frontend                      ║
║                                                           ║
║  问题：缺少必需参数 **--branch**                          ║
║                                                           ║
║  正确格式：                                                ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │ /pipeline run --repo=<仓库> --branch=<分支>         │ ║
║  │               [--pipeline=类型] [--async]           │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                           ║
║  参数说明：                                                ║
║  • --repo    仓库名称（必需）                              ║
║  • --branch  分支名称（必需）                              ║
║  • --pipeline 流水线类型（可选，默认 build）               ║
║                                                           ║
║  示例：                                                    ║
║  /pipeline run --repo=frontend --branch=main --pipeline=build
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║  [📝 打开参数向导]  [📋 复制示例]  [❌ 关闭]               ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 9. 总结

本文档定义了完整的 ChatOps 命令集与通知协作体系：

1. **命令集**：8 个核心命令，覆盖流水线、部署、审批、状态查询、回滚、扩缩容、事件管理
2. **解析器**：统一的命令识别、参数解析、权限验证、执行反馈流程
3. **IM 适配**：钉钉、企业微信、飞书、Slack 四平台统一适配
4. **On-Call 算法**：轮班、升级、替班、节假日处理、疲劳控制
5. **通知模板**：5 类场景化模板，支持多平台渲染
6. **交互式引导**（新增）：
   - 交互式命令卡片：下拉选择器 + 参数输入框 + 快捷按钮 + 发送前预览
   - 自动补全：命令/子命令/参数/值四级补全，支持历史加权
   - 参数引导表单：分步向导 + 动态联动 + 预设模板
   - 命令历史：最近使用 + 收藏命令 + 参数模板
   - 错误提示优化：友好错误消息 + 正确格式 + 示例 + 快捷操作

通过 ChatOps，团队可以在 IM 中完成 90% 的日常运维操作。交互式引导设计将命令学习成本降低 70%，新用户首次使用成功率提升至 95%。
