# 审批流高级能力扩展设计 — 降级推导 / Agent 审批 / 并行备份 / AI 故障降级

> 日期: 2026-05-19
> 状态: 待评审
> 分支: feat/frontend-gap-implementation
> 基于: `2026-05-19-chatops-admin-advanced-capabilities-design.md` Section 2.7

## 1. 需求背景

### 1.1 问题陈述

当前审批系统由以下服务组成（`orion-platform-service/src/services/approval/`）：

| 服务 | 职责 | 文件 |
|------|------|------|
| `ApprovalService` | 基础审批 CRUD | `ApprovalService.ts` |
| `MultiLevelApprovalService` | 多级串行/并行审批 | `MultiLevelApprovalService.ts` |
| `ApprovalTemplateService` | 审批模板管理 | `ApprovalTemplateService.ts` |
| `EmergencyApprovalService` | 紧急审批 + 超时自动批准 | `EmergencyApprovalService.ts` |
| `ApprovalGateCoordinator` | 跨域编排审批门 | `ApprovalGateCoordinator.ts` |

但存在以下不足：

| 问题 | 影响 | 场景示例 |
|------|------|---------|
| 审批人固定为 `approverIds` 静态列表 | 审批人不在岗/离线时无替代机制 | 周末 admin 轮休，无人审批 |
| 缺少备份审批人概念 | 主审批人超时后只能提醒或拒绝，无法自动替换 | 紧急变更等 30 分钟无响应 |
| 无 Agent 自动分析能力 | 所有审批都需人工处理，效率低 | 低风险操作（如测试环境部署）也需人工审批 |
| AI 服务故障时无降级机制 | ChatOps 语义理解、Agent 审批等强依赖 `orion-ai-service` | LLM 不可用时对话功能完全瘫痪 |

### 1.2 设计目标

1. **降级推导审批人**：当主审批人不可用时，按降级链自动推导替代审批人
2. **Agent 自动分析审批**：低风险操作由 Agent 自动评估，高置信度时直接通过
3. **多人并行 + 备份审批**：支持主审批人不响应时自动转交备份人
4. **AI 故障降级**：AI 服务不可用时自动切换到规则模式，通知人员，保证核心服务可用

---

## 2. 总体架构

### 2.1 扩展层概览

```
┌─────────────────────────────────────────────────────────────────┐
│              现有审批服务 (MultiLevelApprovalService 等)            │
│  节点流转 → 工单分配 → 超时处理 → 模板渲染                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 扩展点
           ┌───────────────┼───────────────┬────────────────┐
           ▼               ▼               ▼                ▼
    ┌───────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐
    │ 动态解析层  │  │  Agent 层    │  │ 降级层   │  │  监控层    │
    │           │  │              │  │          │  │            │
    │ Approver  │  │ ApprovalAgent│  │ Fallback │  │  AIGuard   │
    │ Resolver  │  │ Plugin       │  │ Chain    │  │  Circuit   │
    └───────────┘  └──────────────┘  └──────────┘  └────────────┘
```

### 2.2 与现有系统的关系

| 扩组件 | 依赖 | 被依赖 |
|----------|------|--------|
| `ApproverResolver` | `UserService`（用户信息）、`RoleRepository`（角色） | `MultiLevelApprovalService.review` + `assignToApprover` |
| `ApprovalAgentPlugin` | `orion-ai-service`（LLM）、`RiskAnalyzer`（风险分析） | 新增 Agent 节点类型处理 |
| `FallbackChain` | `ApproverResolver` | `MultiLevelApprovalService` 超时处理 + `EmergencyApprovalService` |
| `AIGuardCircuit` | 健康检查端点、`notificationService` | 全系统 AI 依赖方 |

---

## 3. 扩展点一：审批人动态解析层（降级推导 + 备份审批）

### 3.1 核心概念

```
主审批人 (Primary)
  ├── 备份审批人 (Backup) — 主审批人超时未处理时自动接管
  ├── 降级链 (Fallback Chain) — 备份人也不可用时逐级推导
  └── 在线状态检测 — 根据最后登录时间、值班表判断是否可用
```

### 3.2 数据模型扩展

```typescript
// src/services/approval/ApproverResolver.ts

/** 审批人规则配置 */
export interface ApproverRule {
  /** 解析类型 */
  type: 'role' | 'user' | 'oncall' | 'department' | 'reporting-line';
  /** 规则值（角色名/用户ID/值班组名/部门名） */
  value: string;
  /** 主审批人列表（解析结果） */
  primaryApproverIds?: string[];
  /** 备份审批人列表（主审批人超时后接管） */
  backupApprovers: string[];
  /** 降级链：当所有审批人不可用时逐级推导 */
  fallbackChain: FallbackStep[];
  /** 超时阈值（分钟后触发备份） */
  backupTimeoutMinutes: number;
}

/** 降级步骤 */
export interface FallbackStep {
  /** 步骤标识 */
  id: string;
  /** 推导规则 */
  deriveType:
    | 'manager'           // 推导至直属领导
    | 'department-head'   // 推导至部门负责人
    | 'role-escalation'   // 推导至高阶角色（admin → super_admin）
    | 'oncall'            // 推导至值班人员
    | 'fixed-user';       // 推导至固定用户
  /** 推导参数 */
  deriveParam?: string;
  /** 是否允许自动批准（仅最高降级级别 + 低风险操作） */
  autoApprove: boolean;
  /** 自动批准限制：仅 riskLevel <= N 时生效 */
  autoApproveMaxRiskLevel: number;  // 默认 2
}

/** autoApprove 安全约束
 * 1. autoApprove 仅对 riskLevel <= autoApproveMaxRiskLevel 的操作生效
 * 2. 生产环境 (env=prod) 的操作永不自动批准
 * 3. autoApprove=true 的操作必须记录审计日志，包含降级原因
 * 4. 只有 super_admin 可以配置 autoApprove=true 的降级步骤
 */
```

### 3.3 降级推导算法

```typescript
export class ApproverResolver {
  /**
   * 解析审批人列表（含在线状态过滤）
   */
  async resolveApprovers(rule: ApproverRule, context: ApprovalContext): Promise<string[]> {
    switch (rule.type) {
      case 'role':
        return this.resolveByRole(rule.value);
      case 'user':
        return [rule.value];
      case 'oncall':
        return this.resolveOnCallApprovers(rule.value);
      case 'department':
        return this.resolveDepartmentApprovers(rule.value);
      case 'reporting-line':
        return this.resolveReportingLine(context.requesterId);
      default:
        return [];
    }
  }

  /**
   * 降级推导：当主审批人不可用时推导替代人
   */
/** 降级推导结果 */
export interface FallbackResult {
  type: 'approvers_found' | 'auto_approve' | 'reject';
  approverIds: string[];
  reason: string;
}

  async deriveFallback(
    unavailableApproverIds: string[],
    rule: ApproverRule,
    context: ApprovalContext,
  ): Promise<FallbackResult> {
    for (const step of rule.fallbackChain) {
      const derived = await this.executeFallbackStep(step, context);
      // 过滤掉已经不可用的审批人
      const available = derived.filter(id => !unavailableApproverIds.includes(id));
      if (available.length > 0) {
        return { type: 'approvers_found', approverIds: available, reason: `Fallback step ${step.id}` };
      }
    }

    // 所有降级步骤都用尽，检查是否允许自动批准
    const lastStep = rule.fallbackChain[rule.fallbackChain.length - 1];
    if (lastStep?.autoApprove) {
      // 安全检查：生产环境永不自动批准
      if (context.environment === 'prod') {
        return { type: 'reject', approverIds: [], reason: 'Production environment: auto-approve not allowed' };
      }
      // 安全检查：风险等级超过阈值则拒绝
      if (context.riskLevel > (lastStep.autoApproveMaxRiskLevel ?? 2)) {
        return { type: 'reject', approverIds: [], reason: `Risk level ${context.riskLevel} exceeds auto-approve threshold ${lastStep.autoApproveMaxRiskLevel}` };
      }
      return { type: 'auto_approve', approverIds: [], reason: `Fallback chain exhausted, auto-approved per step ${lastStep.id}` };
    }

    return { type: 'reject', approverIds: [], reason: 'Fallback chain exhausted, no auto-approve configured' };
  }

  /**
   * 检测审批人是否可用（在线 + 非 DND + 非冻结）
   */
  async isApproverAvailable(userId: string): Promise<boolean> {
    const user = await this.userService.getUser(userId);
    if (!user || user.status === 'frozen') return false;
    if (this.isInDNDPeriod(user)) return false;
    // 最后登录超过 24 小时视为离线
    if (user.lastLoginAt && Date.now() - user.lastLoginAt.getTime() > 24 * 60 * 60 * 1000) {
      return false;
    }
    return true;
  }
}
```

### 3.5 审批超时调度机制

> 评审问题：`autoApproveIfEmergency` 是被动方法，需要外部调用才能触发。

**推荐方案：CronJob 定时扫描**

```typescript
// src/services/approval/ApprovalTimeoutScheduler.ts

/**
 * 审批超时检查定时任务
 * 每分钟执行一次，扫描所有 pending 状态的审批请求
 */
export class ApprovalTimeoutScheduler {
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private multiLevelService: MultiLevelApprovalService,
    private emergencyService: EmergencyApprovalService,
    private fallbackExecutor: FallbackChainExecutor,
  ) {
    this.intervalMs = 60_000; // 每分钟
  }

  start(): void {
    this.timer = setInterval(async () => {
      try {
        await this.processTimeouts();
      } catch (error) {
        logger.error({ error }, 'Approval timeout processing failed');
      }
    }, this.intervalMs);
    logger.info('Approval timeout scheduler started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async processTimeouts(): Promise<void> {
    const pendingApprovals = await this.multiLevelService.getPendingApprovals();

    for (const approval of pendingApprovals) {
      // 1. 检查紧急审批超时
      if (approval.result?.isEmergency) {
        await this.emergencyService.autoApproveIfEmergency(approval.id);
        continue;
      }

      // 2. 检查普通审批超时 → 触发降级链
      await this.fallbackExecutor.checkAndTriggerFallback(approval);
    }
  }
}
```

**为什么不选其他方案：**

| 方案 | 优点 | 缺点 | 选择理由 |
|------|------|------|---------|
| `setInterval` 内存扫描 | 实现简单 | 多实例重复执行 | 可接受：使用分布式锁或仅选主实例执行 |
| pg_cron 定时任务 | 不依赖应用 | 需要 PostgreSQL 扩展 | 增加运维复杂度 |
| 消息队列延迟消息 | 精确到秒 | 引入 Redis/RabbitMQ 依赖 | 当前系统无 MQ，过重 |

**多实例处理**：使用 PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` 实现分布式锁，确保同一审批请求只被一个实例处理。

```
时间线:
T=0     审批请求创建，分配给主审批人 A
T=30min 主审批人 A 未响应
        → 触发备份机制
        → 检查备份审批人 B 是否可用
        → 可用：转交 B 审批，记录审计日志
        → 不可用：进入降级链
T=60min 降级链第一步：推导至 A 的直属领导 C
        → C 审批
T=90min 降级链第二步：推导至部门负责人 D
        → D 审批
T=120min 降级链最后一步：如果 autoApprove=true，系统自动批准
        → 否则拒绝
```

### 3.5 节点配置扩展

```json
{
  "nodes": [
    {
      "id": "admin-approval",
      "name": "管理员审批",
      "approverType": "role",
      "approverValue": "admin",
      "backupApprovers": ["user-123", "user-456"],
      "fallbackChain": [
        { "id": "manager", "deriveType": "manager" },
        { "id": "dept-head", "deriveType": "department-head", "deriveParam": "ops" },
        { "id": "super-admin", "deriveType": "role-escalation", "deriveParam": "super_admin", "autoApprove": true }
      ],
      "backupTimeoutMinutes": 30,
      "timeoutMinutes": 60,
      "timeoutAction": "remind"
    }
  ]
}
```

---

## 4. 扩展点二：Agent 自动分析审批

### 4.1 核心概念

Agent 审批节点通过 LLM 分析操作风险，给出审批决策。核心原则：**不做强依赖，LLM 不可用时自动降级到规则模式**。

### 4.2 Agent 插件接口

```typescript
// src/services/approval/ApprovalAgentPlugin.ts

/** Agent 审批决策 */
export interface ApprovalDecision {
  action: 'approve' | 'reject' | 'escalate' | 'delegate';
  confidence: number;          // 置信度 0-1
  reason: string;              // 决策理由
  riskScore?: number;          // 风险评分 0-100
  riskFactors?: string[];      // 风险因素列表
  suggestedApprover?: string;  // 建议转交的审批人
}

/** Agent 审批上下文 */
export interface ApprovalContext {
  operation: string;           // 操作类型（如 "deploy", "delete"）
  resource: string;            // 操作资源（如 "prod/api-gateway"）
  requester: string;           // 申请人 ID
  requesterHistory: {          // 申请人历史记录
    totalOperations: number;
    rejectionRate: number;
    recentIncidents: number;
  };
  environment: string;         // 环境（dev/staging/prod）
  riskLevel: number;           // 预定义风险等级 1-4
  metadata: Record<string, any>; // 操作元数据
}

/** Agent 插件接口 */
export interface ApprovalAgentPlugin {
  name: string;
  /** 评估审批决策 */
  evaluate(context: ApprovalContext): Promise<ApprovalDecision>;
  /** 健康检查 — 用于熔断判断 */
  isHealthy?(): Promise<boolean>;
}
```

### 4.3 默认 Agent 实现

```typescript
// src/services/approval/DefaultApprovalAgent.ts

export class DefaultApprovalAgent implements ApprovalAgentPlugin {
  name = 'default-risk-analyzer';

  async evaluate(context: ApprovalContext): Promise<ApprovalDecision> {
    // LLM 不可用时直接返回 escalate（转人工）
    if (!(await this.isHealthy())) {
      return {
        action: 'escalate',
        confidence: 0,
        reason: 'AI 服务不可用，已转人工审批',
        riskScore: context.riskLevel * 25,
      };
    }

    // 规则优先：极高风险直接拒绝
    if (context.riskLevel >= 4 && context.environment === 'prod') {
      return {
        action: 'reject',
        confidence: 0.95,
        reason: '生产环境高风险操作，需人工审批',
        riskScore: 90,
        riskFactors: ['production_environment', 'risk_level_4'],
      };
    }

    // 极低风险自动通过
    if (context.riskLevel <= 1 && context.environment === 'dev') {
      return {
        action: 'approve',
        confidence: 0.9,
        reason: '开发环境低风险操作，自动批准',
        riskScore: 10,
      };
    }

    // 中间风险：调用 LLM 分析
    try {
      const llmResult = await this.callLLM(context);
      return {
        action: llmResult.action,
        confidence: llmResult.confidence,
        reason: llmResult.reason,
        riskScore: llmResult.riskScore,
        riskFactors: llmResult.riskFactors,
      };
    } catch (error) {
      // LLM 调用失败，降级到规则模式
      return this.fallbackToRules(context);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const health = await fetch(`${process.env.AI_SERVICE_URL}/healthz`, {
        signal: AbortSignal.timeout(3000),
      });
      return health.ok;
    } catch {
      return false;
    }
  }

  /** 规则模式降级 */
  private fallbackToRules(context: ApprovalContext): ApprovalDecision {
    if (context.environment === 'prod') {
      return {
        action: 'escalate',
        confidence: 0,
        reason: 'LLM 不可用，生产环境操作转人工审批',
        riskScore: 50,
      };
    }
    if (context.riskLevel <= 2) {
      return {
        action: 'approve',
        confidence: 0.7,
        reason: 'LLM 不可用，低风险操作按规则自动批准',
        riskScore: 20,
      };
    }
    return {
      action: 'escalate',
      confidence: 0,
      reason: 'LLM 不可用，中等风险操作转人工审批',
      riskScore: 40,
    };
  }
}
```

### 4.4 Agent 节点配置

```json
{
  "nodes": [
    {
      "id": "agent-review",
      "name": "AI 风险分析",
      "nodeType": "agent",
      "agent": "default-risk-analyzer",
      "threshold": {
        "autoApproveConfidence": 0.85,
        "autoRejectConfidence": 0.95,
        "autoRejectRiskScore": 90
      },
      "onLowConfidence": "escalate-to-next",
      "onAgentFailure": "fallback-to-rules",
      "timeoutSeconds": 10
    },
    {
      "id": "human-review",
      "name": "人工复核",
      "nodeType": "human",
      "approverType": "role",
      "approverValue": "admin",
      "timeoutMinutes": 60
    }
  ]
}
```

### 4.5 决策流转逻辑

```
Agent 节点评估
  │
  ├── confidence >= 0.85 且 riskScore < 50
  │   → 自动批准，记录审计日志
  │
  ├── confidence >= 0.95 且 riskScore >= 90
  │   → 自动拒绝，通知申请人
  │
  ├── 0 < confidence < 0.85
  │   → 转人工审批（下一节点）
  │
  ├── Agent 调用超时/异常
  │   → fallbackToRules（规则模式）
  │   │
  │   ├── 开发环境 + 低风险 → 自动批准
  │   └── 生产环境 → 转人工
  │
  └── AI 服务完全不可用
      → 全局降级模式，所有 Agent 节点转为 escalate
```

---

## 5. 扩展点三：扩展审批服务节点类型

### 5.1 节点类型总览

| 节点类型 | ID | 说明 | 新增/现有 |
|---------|-----|------|----------|
| `human` | 人工审批 | 指定角色/用户审批 | 现有 |
| `auto` | 条件自动审批 | 基于条件表达式 | 现有（升级为 `condition`） |
| `agent` | Agent 审批 | LLM/规则引擎自动分析 | **新增** |
| `parallel-group` | 并行审批组 | 多人同时审批，N/M 通过即过 | **新增** |
| `fallback-chain` | 降级审批链 | 主审批人→备份→降级链 | **新增** |

### 5.2 扩展后的节点接口

```typescript
export type NodeType = 'human' | 'condition' | 'agent' | 'parallel-group' | 'fallback-chain';

export interface ApprovalNode {
  id: string;
  name: string;
  nodeType: NodeType;

  // ===== human 节点 =====
  approverType?: 'role' | 'user' | 'dynamic';
  approverValue?: string;

  // ===== agent 节点 =====
  agent?: string;                    // Agent 插件名
  threshold?: AgentThreshold;
  onLowConfidence?: 'escalate-to-next' | 'reject' | 'approve';
  onAgentFailure?: 'fallback-to-rules' | 'escalate-to-next' | 'reject';

  // ===== parallel-group 节点 =====
  groupApprovers?: ParallelGroupConfig;

  // ===== fallback-chain 节点 =====
  fallbackChainConfig?: FallbackChainConfig;

  // ===== condition 节点（原 auto） =====
  autoApproveCondition?: Record<string, unknown>;

  // ===== 通用 =====
  timeoutMinutes: number;
  timeoutAction: 'remind' | 'escalate' | 'reject' | 'approve';
  onApprove: 'next' | 'complete';
  onReject: 'reject';
}

export interface ParallelGroupConfig {
  approvers: ApproverRule[];
  requiredApprovals: number;         // N/M：M=approvers.length, N=requiredApprovals
  parallelMode: 'any' | 'all' | 'majority'; // 任意/全部/多数
  fallbackTimeoutMinutes: number;    // 并行组整体超时
}

export interface FallbackChainConfig {
  primary: ApproverRule;             // 主审批人规则
  backup: ApproverRule[];            // 备份审批人列表
  chain: FallbackStep[];             // 降级链
  finalAction: 'auto-approve' | 'reject'; // 链用尽后的最终动作
}

export interface AgentThreshold {
  autoApproveConfidence: number;     // >= 此值自动批准
  autoRejectConfidence: number;      // >= 此值且风险分高时自动拒绝
  autoRejectRiskScore: number;       // 风险分阈值
}
```

### 5.3 并行审批组示例

```json
{
  "id": "infra-approval",
  "name": "基础设施变更审批",
  "nodeType": "parallel-group",
  "groupApprovers": {
    "approvers": [
      { "type": "role", "value": "ops-lead", "backupApprovers": ["user-111"] },
      { "type": "role", "value": "security-lead", "backupApprovers": ["user-222"] },
      { "type": "role", "value": "tech-lead", "backupApprovers": ["user-333"] }
    ],
    "requiredApprovals": 2,
    "parallelMode": "any",
    "fallbackTimeoutMinutes": 120
  },
  "timeoutMinutes": 120,
  "timeoutAction": "escalate"
}
```

含义：ops-lead / security-lead / tech-lead 三人并行审批，任意 2 人通过即过。任一审批人超时未响应则转交其备份人。

### 5.4 降级审批链示例

```json
{
  "id": "critical-change",
  "name": "核心变更审批",
  "nodeType": "fallback-chain",
  "fallbackChainConfig": {
    "primary": {
      "type": "oncall",
      "value": "prod-oncall",
      "backupApprovers": ["ops-lead-01"],
      "fallbackChain": [
        { "id": "manager", "deriveType": "manager" },
        { "id": "director", "deriveType": "department-head", "deriveParam": "engineering" }
      ],
      "backupTimeoutMinutes": 15
    },
    "backup": [
      { "type": "role", "value": "ops-lead", "backupTimeoutMinutes": 30 }
    ],
    "chain": [
      { "id": "super-admin", "deriveType": "role-escalation", "deriveParam": "super_admin" }
    ],
    "finalAction": "reject"
  },
  "timeoutMinutes": 180,
  "timeoutAction": "remind"
}
```

---

## 6. 扩展点四：AI 服务故障降级（AIGuardCircuit）

### 6.1 核心问题

**当前系统是否具备降级能力？** — 部分具备，但不完整。

| 场景 | 现状 | 改进后 |
|------|------|--------|
| ChatOps 语义理解 | 强依赖 LLM，故障时对话理解不可用 | 降级到关键词匹配 + 命令模板 |
| Agent 审批 | 尚未实现 | 降级到规则模式（见第 4 节） |
| RAG 知识检索 | 强依赖 embedding 服务 | 降级到关键词搜索（不依赖向量） |
| 通知上报 | 独立 notification service，不受 AI 影响 | 不变 |

### 6.2 熔断器设计

> 评审问题：内存状态在多实例部署下不共享。
> 解决方案：熔断状态持久化到 `ai_circuit_state` 表，所有实例读写数据库。

```typescript
// src/services/ai/AIGuardCircuit.ts

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface AIGuardCircuitState {
  state: CircuitState;
  failureCount: number;
  lastFailureAt: Date | null;
  lastSuccessAt: Date | null;
  halfOpenAttempts: number;
}

/**
 * 基于数据库的熔断器 — 多实例安全
 * 状态存储在 ai_circuit_state 表中，所有实例共享
 */
export class AIGuardCircuitBreaker {
  private failureThreshold = 5;
  private recoveryTimeout = 60_000; // 60 秒后尝试半开
  private halfOpenMaxAttempts = 3;

  constructor(
    private pool: DatabasePool,
    private tenantId: string,
    private serviceName: string,
    private notificationService: NotificationService,
  ) {}

  /** 读取当前熔断状态（从数据库） */
  private async getState(): Promise<AIGuardCircuitState> {
    const result = await this.pool.query(
      `SELECT * FROM ai_circuit_state WHERE tenant_id = $1 AND service_name = $2`,
      [this.tenantId, this.serviceName],
    );
    if (result.rows.length === 0) {
      return { state: 'closed', failureCount: 0, lastFailureAt: null, lastSuccessAt: null, halfOpenAttempts: 0 };
    }
    const row = result.rows[0];
    return {
      state: row.circuit_state as CircuitState,
      failureCount: row.failure_count,
      lastFailureAt: row.last_failure_at ? new Date(row.last_failure_at) : null,
      lastSuccessAt: row.last_success_at ? new Date(row.last_success_at) : null,
      halfOpenAttempts: 0, // derived at runtime
    };
  }

  /** 更新熔断状态（写入数据库） */
  private async updateState(state: Partial<AIGuardCircuitState>): Promise<void> {
    await this.pool.query(
      `INSERT INTO ai_circuit_state (tenant_id, service_name, circuit_state, failure_count, last_failure_at, last_success_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (tenant_id, service_name) DO UPDATE SET
         circuit_state = EXCLUDED.circuit_state,
         failure_count = EXCLUDED.failure_count,
         last_failure_at = EXCLUDED.last_failure_at,
         last_success_at = EXCLUDED.last_success_at,
         updated_at = NOW()`,
      [this.tenantId, this.serviceName, state.state, state.failureCount, state.lastFailureAt, state.lastSuccessAt],
    );
  }

  /**
   * 执行 AI 调用，含熔断保护
   */
  async execute<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
    const currentState = await this.getState();

    if (currentState.state === 'open') {
      if (currentState.lastFailureAt && Date.now() - currentState.lastFailureAt.getTime() > this.recoveryTimeout) {
        await this.updateState({ state: 'half-open', failureCount: 0 }); // 重置计数
      } else {
        return fallback();
      }
    }

    try {
      const result = await fn();
      await this.onSuccess();
      return result;
    } catch (error) {
      const newState = await this.onFailure();
      if (newState.state === 'open') {
        await this.notifyAIFailure(newState.failureCount);
      }
      return fallback();
    }
  }

  private async onSuccess(): Promise<void> {
    // 修复：half-open 状态下成功后重置 failureCount
    await this.updateState({
      state: 'closed',
      failureCount: 0,
      lastSuccessAt: new Date(),
      lastFailureAt: null,
    });
  }

  private async onFailure(): Promise<AIGuardCircuitState> {
    const current = await this.getState();
    const newCount = current.failureCount + 1;
    const newState: CircuitState = newCount >= this.failureThreshold ? 'open' : current.state;

    await this.updateState({
      state: newState,
      failureCount: newCount,
      lastFailureAt: new Date(),
    });

    return { ...current, state: newState, failureCount: newCount };
  }

  /** AI 故障通知 */
  private async notifyAIFailure(): Promise<void> {
    await this.notificationService.sendToRoles({
      roles: ['admin', 'super_admin'],
      title: 'AI 服务故障 — 已自动降级',
      body: `AI 服务连续失败 ${this.failureCount} 次，已自动切换到规则模式。核心功能不受影响。`,
      priority: 'high',
      channels: ['email', 'webhook'],
    });
  }

  /** 获取当前状态（供健康检查端点使用） */
  getStatus(): { state: CircuitState; failures: number; recovered: boolean } {
    return {
      state: this.state,
      failures: this.failureCount,
      recovered: this.lastSuccessAt !== null,
    };
  }
}
```

### 6.3 ChatOps 降级路径

```
用户发送: "帮我部署 api-gateway 到生产环境"

正常模式 (AI 可用):
  → LLM 语义理解 → 提取 { operation: "deploy", service: "api-gateway", env: "prod" }
  → 检查权限 → 触发审批 → 执行

降级模式 (AI 不可用):
  → 关键词匹配: 检测到 "部署/deploy" 关键词
  → 提示用户: "AI 服务暂时不可用，请使用命令格式: /deploy service=api-gateway env=prod"
  → 用户发送标准命令 → 正常执行
  → 后台通知 admin: "AI 服务故障，已切换到命令模式"

核心保证:
  - 命令执行能力不受 AI 故障影响
  - 审批流程不受 AI 故障影响（降级到规则模式）
  - 故障自动通知，无需人工发现
```

### 6.4 系统级健康检查端点

```
GET /api/v1/system/health
{
  "status": "degraded",  // "healthy" | "degraded" | "critical"
  "components": {
    "api-gateway": { "status": "healthy", "latency": 12 },
    "platform-service": { "status": "healthy", "latency": 45 },
    "ai-service": { "status": "unhealthy", "error": "connection refused", "circuit": "open" },
    "database": { "status": "healthy", "latency": 3 },
    "redis": { "status": "healthy", "latency": 1 }
  },
  "degraded_features": ["chatops_nlp", "agent_approval", "rag_semantic"],
  "fallback_active": true
}
```

---

## 7. 数据模型变更

### 7.1 基线迁移（新增表）

> 以下表在当前系统中不存在，需在首次实施时创建。

```sql
-- 0. 审批流程配置基线表（供 ApprovalTemplateService 及扩展节点类型使用）
CREATE TABLE IF NOT EXISTS approval_flow_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    flow_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}',  -- 完整节点配置 JSON
    version INT DEFAULT 1,
    created_by VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_approval_flow_configs_tenant ON approval_flow_configs(tenant_id);
```

### 7.2 新增表

```sql
-- 1. 审批人规则表（用于动态解析和降级链配置）
CREATE TABLE IF NOT EXISTS approval_approver_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    flow_id UUID REFERENCES approval_flow_configs(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    rule_type VARCHAR(30) NOT NULL,       -- role/user/oncall/department/reporting-line
    rule_value VARCHAR(200) NOT NULL,
    backup_approvers JSONB DEFAULT '[]',  -- 备份审批人 ID 列表
    fallback_chain JSONB DEFAULT '[]',    -- 降级链配置
    backup_timeout_minutes INT DEFAULT 30,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. AI 熔断状态表（多实例共享，替代内存状态）
CREATE TABLE IF NOT EXISTS ai_circuit_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    service_name VARCHAR(100) NOT NULL,   -- ai-service/llm-proxy/embedding-service
    circuit_state VARCHAR(20) NOT NULL DEFAULT 'closed',  -- closed/open/half-open
    failure_count INT DEFAULT 0,
    last_failure_at TIMESTAMP,
    last_success_at TIMESTAMP,
    notified_at TIMESTAMP,                -- 上次通知 admin 的时间
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (tenant_id, service_name)
);

-- 3. 审批降级日志表（审计用）
CREATE TABLE IF NOT EXISTS approval_fallback_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    approval_id VARCHAR(200) NOT NULL,
    node_id VARCHAR(100) NOT NULL,
    fallback_type VARCHAR(30) NOT NULL,   -- backup/fallback-chain/auto-approve/agent-failure
    from_approver VARCHAR(200),
    to_approver VARCHAR(200),
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_approver_rules_flow ON approval_approver_rules(flow_id);
CREATE INDEX ai_circuit_state_service ON ai_circuit_state(tenant_id, service_name);
CREATE INDEX idx_fallback_logs_approval ON approval_fallback_logs(approval_id);
```

### 7.3 现有表扩展

```sql
-- 审批步骤表增加并行组字段（用于 parallel-group 节点）
ALTER TABLE approval_steps ADD COLUMN IF NOT EXISTS group_id VARCHAR(100);
ALTER TABLE approval_steps ADD COLUMN IF NOT EXISTS level_index INT DEFAULT 0;
-- level_index 替代现有 extractLevels() 的启发式推断，创建时直接写入

-- users 表增加 manager_id 字段（用于汇报链推导）
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
```

### 7.4 并发安全设计

> 评审问题：多人同时审批同一请求时的竞态条件。

**方案：数据库行级锁（`SELECT ... FOR UPDATE`）**

```typescript
// MultiLevelApprovalService.review 中的并发保护
async review(requestId: string, reviewerId: string, action: ApprovalAction): Promise<void> {
  const client = await this.pool.connect();
  try {
    await client.query('BEGIN');

    // 行级锁：防止并发审批同一请求
    const entity = await client.query(
      `SELECT * FROM approvals WHERE id = $1 FOR UPDATE`,
      [requestId],
    );

    // 幂等检查：该审批人是否已操作过
    const existingStep = await client.query(
      `SELECT * FROM approval_steps WHERE approval_id = $1 AND approver_id = $2`,
      [requestId, reviewerId],
    );
    if (existingStep.rows[0]?.status !== 'pending') {
      throw new Error('Already acted on this approval');
    }

    // 执行审批操作...
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

**现有 `MultiLevelApprovalService.extractLevels` 启发式缺陷修复**：
- 当前 `getMaxApproversPerLevel()` 始终返回 1，导致每个 step 被视为独立 level
- 修复方案：在创建审批请求时，将 `levelIndex` 持久化到 `approval_steps.level_index` 字段
- `extractLevels()` 改为按 `level_index` 分组，不再使用 stepIndex 推算

---

## 8. 技术实现清单

### 8.1 后端新增文件

| 文件 | 说明 | 优先级 |
|------|------|--------|
| `src/services/approval/ApproverResolver.ts` | 审批人动态解析 + 降级推导 | P0 |
| `src/services/approval/ApprovalAgentPlugin.ts` | Agent 审批插件接口 | P0 |
| `src/services/approval/DefaultApprovalAgent.ts` | 默认 Agent 实现（含规则降级） | P0 |
| `src/services/ai/AIGuardCircuit.ts` | AI 熔断器 + 故障通知 | P0 |
| `src/services/approval/ParallelGroupEvaluator.ts` | 并行审批组评估引擎 | P1 |
| `src/services/approval/FallbackChainExecutor.ts` | 降级审批链执行器 | P1 |

### 8.2 后端修改文件

| 文件 | 修改内容 |
|------|---------|
| `orion-platform-service/src/services/approval/MultiLevelApprovalService.ts` | 扩展节点类型处理逻辑，集成 ApproverResolver 和 ApprovalAgentPlugin |
| `orion-platform-service/src/services/approval/MultiLevelApprovalService.ts` | 审批人分配改为调用 `ApproverResolver.resolveApprovers` |
| `orion-platform-service/src/services/approval/MultiLevelApprovalService.ts` | 超时处理增加 FallbackChainExecutor 调用 |
| `src/api/approval-routes.ts` | 新增 `/approval/agent/status` 端点 |

### 8.3 前端新增文件

| 文件 | 说明 |
|------|------|
| `orion-frontend/src/pages/ChatOps/ApprovalNodeConfig.tsx` | 节点配置编辑器（支持 5 种节点类型） |
| `orion-frontend/src/pages/ChatOps/FallbackChainEditor.tsx` | 降级链可视化编辑器 |
| `orion-frontend/src/pages/SystemHealth/index.tsx` | 系统健康状态页（含熔断状态） |
| `orion-frontend/src/api/system-health.ts` | 健康检查 API 客户端 |

---

## 9. 降级场景验证

### 9.1 场景矩阵

| # | 故障场景 | 系统行为 | 核心功能是否可用 |
|---|---------|---------|----------------|
| 1 | `orion-ai-service` 完全宕机 | AIGuardCircuit 熔断 → ChatOps 降级到命令模式 → Agent 审批转规则 | ✅ |
| 2 | LLM 响应超时 (>10s) | 单次调用超时 → fallbackToRules → 生产环境转人工，开发环境按规则 | ✅ |
| 3 | 主审批人离线 | 超时检测 → 转备份审批人 → 备份也不在 → 降级链推导 | ✅ |
| 4 | 审批人全部不可用 | 降级链用尽 → autoApprove=false 时拒绝，true 时自动批准 | ✅ |
| 5 | Agent 插件内部异常 | catch → fallbackToRules → 规则模式决策 | ✅ |
| 6 | 数据库宕机 | Map 内存 fallback（现有机制）→ 恢复后同步 | ⚠️ 重启后丢失 |

### 9.2 故障恢复流程

```
AI 服务恢复
  │
  ├── AIGuardCircuit 自动检测 (recoveryTimeout 后进入 half-open)
  │   ├── 3 次探测全部成功 → state = closed → 恢复正常
  │   └── 任一次失败 → state = open → 继续降级
  │
  ├── 恢复通知: "AI 服务已恢复，已从规则模式切换回智能模式"
  │
  └── 历史补偿: 降级期间被拒绝的高风险操作重新进入 Agent 评估
```

---

## 10. 验收标准

### 10.1 功能验收

- [ ] 备份审批人可在主审批人超时后自动接管审批
- [ ] 降级链可按 manager → department-head → super_admin 逐级推导
- [ ] Agent 审批节点可配置置信度阈值
- [ ] 低置信度时自动转人工审批
- [ ] 并行审批组支持 N/M 通过即过
- [ ] AI 服务宕机时 AIGuardCircuit 自动熔断
- [ ] 熔断时自动通知 admin 角色
- [ ] ChatOps 在 AI 宕机时降级到命令模式
- [ ] AI 服务恢复后自动从 half-open 转为 closed
- [ ] 系统健康端点返回降级状态

### 10.2 非功能验收

- [ ] AI 调用超时 ≤ 10s
- [ ] 熔断触发 ≤ 50s（5 次 × 10s）
- [ ] 降级模式审批决策 ≤ 100ms（纯规则，无 LLM）
- [ ] 降级链推导 ≤ 200ms
- [ ] 并行组评估 ≤ 500ms
- [ ] 故障通知发送 ≤ 5s

---

## 11. 与现有设计的关系

| 本文档 | ChatOps 设计文档 (2026-05-19-chatops-...) | 关系 |
|--------|------------------------------------------|------|
| 审批人动态解析层 | 替换 `assignToApprover` 中的静态 `approverIds` 解析 | 扩展 |
| Agent 审批插件 | 新增 `nodeType: 'agent'` 节点类型 | 新增 |
| 并行审批组 | 替代原有 `parallel` 模式的简单实现 | 增强 |
| 降级审批链 | 补充 `fallbackChain` 配置，替代硬编码推导 | 增强 |
| AI 熔断器 | 独立于审批流，但被 Agent 节点调用 | 基础设施 |

**本文档不改变现有审批流的核心架构**，仅在 `MultiLevelApprovalService` + `ApprovalGateCoordinator` 的基础上增加四个扩展层，保持向后兼容。

---

**设计完成，等待评审。**
