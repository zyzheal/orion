# ChatOps Phase 1a 实施计划

> 总计: 31 个任务 (Frontend 14 + Backend 15 + Database 2)
> 分支: `feat/frontend-gap-implementation`
> 日期: 2026-04-27

---

## 前置条件

### 已有后端基础

| 文件 | 状态 |
|------|------|
| `orion-platform-service/src/api/chatops-routes.ts` | 5 路由已注册 |
| `orion-platform-service/src/api/controllers/ChatOpsController.ts` | 控制器已实现 |
| `orion-platform-service/src/services/chatops/CommandService.ts` | 命令注册 + 5 默认命令种子 |
| `orion-platform-service/src/services/chatops/ExecutionService.ts` | 执行跟踪 + 会话管理 |
| `orion-platform-service/src/repositories/ChatOpsRepository.ts` | 4 个 Repository 类 |
| `orion-platform-service/src/models/ChatOps.ts` | 数据模型定义 |
| `orion-platform-service/src/db/migrations/033_create_chatops_tables.sql` | 4 张表已创建 |

### 已有前端基础

| 文件 | 状态 |
|------|------|
| `orion-frontend/src/pages/ChatOps/index.tsx` | Layout + 4 子页面 |
| `orion-frontend/src/api/chatops.ts` | API 客户端 |
| `orion-frontend/src/router/routes.ts` | `/console/chatops` 路由已注册 |

### 可复用基础设施

| 组件 | 位置 | 用途 |
|------|------|------|
| `VirtualList` | `orion-frontend/src/components/VirtualList/index.tsx` | 虚拟滚动 |
| `webSocketStore` | `orion-frontend/src/stores/webSocketStore.ts` | WebSocket 连接 |
| `EventBusService` | `orion-platform-service/src/services/event-bus-service.ts` | 事件总线 (EventEmitter) |
| Design Tokens | `orion-frontend/src/tokens/colors.ts` | 色彩系统 |
| Layout | `orion-frontend/src/components/Layout/index.tsx` | **ChatTrigger 挂载点** |

---

## 执行顺序建议

```
第 1 批 (无依赖，可并行):
  DB-1  pgcrypto 扩展
  DB-2  核心表索引
  F-8   chatOpsStore
  B-6   GET /commands 更新

第 2 批 (依赖 DB-1, DB-2):
  B-12  扩展表 + 索引迁移

第 3 批 (依赖 B-12):
  B-8   EventBus 订阅
  B-9   通知偏好 CRUD
  B-10  DND CRUD
  B-11  已读状态 API
  B-14  幂等性

第 4 批 (依赖 B-9, B-10, B-11):
  B-5   推荐聚合 API
  B-15  EventBus 驱动推荐面板

第 5 批 (依赖 B-14, B-6):
  B-1   execute 幂等性增强
  B-2   输入安全校验
  B-3   双层权限中间件
  B-4   命令路由分发

第 6 批 (依赖 B-2, B-3, B-4, B-5):
  B-7   sessions/messages 分页 API
  B-13  L1->L3 写入链路

第 7 批 (依赖 F-8):
  F-1   ChatTrigger
  F-2   ChatPanel
  F-3   SmartRecommend
  F-4   ChatInput
  F-5   命令解析引擎 (前端)
  F-6   ChatMessage + ActionCard
  F-7   滚动行为
  F-9   通知偏好 UI
  F-10  DND UI
  F-11  已读/未读交互

第 8 批 (依赖 F-2 ~ F-7):
  F-12  虚拟滚动集成
  F-13  浏览器内存监控
  F-14  分页加载
```

---

## Group A: Database (2 Tasks)

---

### DB-1: pgcrypto 扩展启用

**文件**: `orion-platform-service/src/db/migrations/055_create_chatops_phase1a_tables.sql` (新建)

**SQL**:

```sql
-- Migration 055: ChatOps Phase 1a Tables & Indexes (combined)
-- Dependency: 033_create_chatops_tables.sql

-- Enable pgcrypto extension for ChatOps message encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 验证
SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';
```

**集成说明**:
- pgcrypto 用于 `chatops_messages` 表的 `content_encrypted` 字段加解密
- `pgp_sym_encrypt()` / `pgp_sym_decrypt()` 需要此扩展
- 密钥通过环境变量 `CHATOPS_ENCRYPTION_KEY` 注入 (格式: `v1:base64key...`)
- Phase 1a 仅启用扩展，实际加密逻辑在 Phase 2 实现

**回滚文件**: `orion-platform-service/src/db/migrations/055_rollback_chatops_phase1a_tables.sql`

---

### DB-2: 核心表索引创建 + 新增表迁移

**文件**: `orion-platform-service/src/db/migrations/055_create_chatops_phase1a_tables.sql` (与 DB-1 合并为同一文件)

此迁移包含两部分: (a) 新增表, (b) 现有表补充索引。

#### (a) 新增表

```sql
-- Migration 055: ChatOps Phase 1a Tables & Indexes (续)

-- 1. 对话消息表 (扩展 033 的 sessions 表)
-- 033 的 chatops_sessions 表结构过于简化，需要新增消息表
CREATE TABLE IF NOT EXISTS chatops_messages (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key               VARCHAR(255) NOT NULL REFERENCES chatops_sessions(key) ON DELETE CASCADE,
  role                      TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content                   TEXT NOT NULL,                     -- Phase 1a 明文，Phase 2 改为 content_encrypted
  parsed_command            JSONB,
  parsed_command_sanitized  BOOLEAN DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 通知偏好表
CREATE TABLE IF NOT EXISTS chatops_notification_preferences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  alert_level         TEXT NOT NULL CHECK (alert_level IN ('critical', 'warning', 'info')),
  channel_chatops     BOOLEAN DEFAULT true,
  channel_email       BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, alert_level)
);

-- 3. 免打扰设置表
CREATE TABLE IF NOT EXISTS chatops_dnd_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE,
  enabled             BOOLEAN DEFAULT false,
  start_time          TIME,
  end_time            TIME,
  repeat_days         INT[] DEFAULT '{1,2,3,4,5}',
  allow_critical      BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 告警已读状态表
CREATE TABLE IF NOT EXISTS chatops_alert_states (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  alert_id            UUID NOT NULL,
  state               TEXT NOT NULL CHECK (state IN ('unread', 'read', 'acknowledged', 'dismissed')),
  read_at             TIMESTAMPTZ,
  dismissed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, alert_id)
);

-- 5. 幂等性键表 (Redis 不可用时的降级存储)
CREATE TABLE IF NOT EXISTS chatops_idempotency_keys (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                 VARCHAR(255) NOT NULL UNIQUE,
  command             TEXT NOT NULL,
  user_id             UUID NOT NULL,
  result              JSONB,
  status              TEXT NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL
);
```

#### (b) 补充索引

```sql
-- 现有 chatops_sessions 表补充索引 (033 缺失)
CREATE INDEX IF NOT EXISTS idx_chatops_sessions_user ON chatops_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chatops_sessions_updated ON chatops_sessions(key, created_at);

-- chatops_messages 索引
CREATE INDEX IF NOT EXISTS idx_chatops_messages_session ON chatops_messages(session_key);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_created ON chatops_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_role ON chatops_messages(role);

-- chatops_executions 补充索引 (033 已有部分，补充组合索引)
CREATE INDEX IF NOT EXISTS idx_chatops_executions_user_time ON chatops_executions(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_executions_command_status ON chatops_executions(command_id, status);

-- chatops_audit_logs 补充索引 (033 已有部分，补充组合索引)
CREATE INDEX IF NOT EXISTS idx_chatops_audit_user_time ON chatops_audit_logs((actor->>'userId'), timestamp DESC);

-- 通知相关索引
CREATE INDEX IF NOT EXISTS idx_chatops_notif_pref_user ON chatops_notification_preferences(user_id, alert_level);
CREATE INDEX IF NOT EXISTS idx_chatops_alert_states_user ON chatops_alert_states(user_id, state);
CREATE INDEX IF NOT EXISTS idx_chatops_dnd_user ON chatops_dnd_settings(user_id);

-- 幂等性键索引
CREATE INDEX IF NOT EXISTS idx_chatops_idempotency_key ON chatops_idempotency_keys(key);
CREATE INDEX IF NOT EXISTS idx_chatops_idempotency_expires ON chatops_idempotency_keys(expires_at);
```

**依赖**: DB-1 (pgcrypto)

---

## Group B: Backend (15 Tasks)

---

### B-1: POST /api/chatops/execute — 幂等性支持

**文件**:
- 修改: `orion-platform-service/src/api/controllers/ChatOpsController.ts` (executeCommand 方法)
- 修改: `orion-platform-service/src/api/chatops-routes.ts` (无变更，已有路由)

**关键变更**:

在 `ChatOpsController.executeCommand` 中提取 `X-Idempotency-Key` 请求头:

```typescript
// 新增: 幂等性处理逻辑
async executeCommand(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const body = request.body as Record<string, unknown>;
    const headers = request.headers as Record<string, string | undefined>;
    const idempotencyKey = headers['x-idempotency-key'];

    // 如果提供了幂等性键，先检查缓存
    if (idempotencyKey) {
      const cached = await this.idempotencyService.checkAndReturn(idempotencyKey);
      if (cached) {
        return reply.send({ success: true, data: cached, idempotent: true });
      }
    }

    // ... 原有执行逻辑 ...

    const execution = await this.executionService.execute({ ... });

    // 缓存结果
    if (idempotencyKey) {
      await this.idempotencyService.store(idempotencyKey, {
        command: body.command,
        userId: body.userId,
        result: execution,
      }, { ttlSeconds: 3600 });
    }

    await reply.status(201).send({ success: true, data: execution });
  } catch (err) { ... }
}
```

**新建文件**: `orion-platform-service/src/services/chatops/IdempotencyService.ts`

```typescript
export interface IdempotencyEntry {
  command: string;
  userId: string;
  result: Record<string, unknown>;
}

export class IdempotencyService {
  private redisClient?: any;  // Phase 1: optional, fallback to DB
  private dbPool?: DatabasePool;

  async checkAndReturn(key: string): Promise<IdempotencyEntry | null> { ... }
  async store(key: string, entry: IdempotencyEntry, opts: { ttlSeconds: number }): Promise<void> { ... }
}
```

**Phase 1 降级策略**: Redis 不可用时，使用 `chatops_idempotency_keys` 表存储，TTL 通过 `expires_at` 字段控制，定时清理。

---

### B-2: 输入安全校验服务

**新建文件**: `orion-platform-service/src/services/chatops/InputValidator.ts`

**代码骨架**:

```typescript
import Ajv from 'ajv';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ParsedCommand {
  command: string;
  params: Record<string, unknown>;
}

const DANGEROUS_CHARS = /[;|&$`(){}[\]<>\\!#~]/;
const PATH_TRAVERSAL = /\.\.[/\\]/;
const SENSITIVE_KEYS = ['password', 'secret', 'token', 'key', 'credential'];

export class InputValidator {
  private ajv: Ajv;
  private commandSchemas: Map<string, Record<string, unknown>>;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    this.commandSchemas = new Map();
  }

  /** 注册命令 Schema */
  registerSchema(commandName: string, schema: Record<string, unknown>): void {
    this.commandSchemas.set(commandName, schema);
  }

  /** 完整校验流程 */
  validate(input: string, parsed: ParsedCommand): ValidationResult {
    // 1. 危险字符检查
    if (DANGEROUS_CHARS.test(input)) {
      return { valid: false, error: '输入包含不允许的字符' };
    }
    // 2. 路径遍历检查
    if (PATH_TRAVERSAL.test(input)) {
      return { valid: false, error: '不允许路径遍历' };
    }
    // 3. 命令白名单
    if (!this.commandSchemas.has(parsed.command)) {
      return { valid: false, error: `未知命令: ${parsed.command}` };
    }
    // 4. JSON Schema 校验
    const schema = this.commandSchemas.get(parsed.command)!;
    const validateFn = this.ajv.compile(schema);
    if (!validateFn(parsed.params)) {
      return { valid: false, error: this.ajv.errorsText(validateFn.errors) };
    }
    // 5. 敏感参数拦截
    for (const key of SENSITIVE_KEYS) {
      if (key in parsed.params) {
        return { valid: false, error: `不允许使用敏感参数: ${key}` };
      }
    }
    return { valid: true };
  }

  /** 脱敏处理 (用于审计日志存储) */
  static sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const result = { ...obj };
    for (const key of SENSITIVE_KEYS) {
      if (key in result) result[key] = '***REDACTED***';
    }
    return result;
  }
}
```

**集成点**: 在 `ChatOpsController.executeCommand` 中，执行命令前调用 `InputValidator.validate()`。

---

### B-3: 双层权限校验中间件

**新建文件**: `orion-platform-service/src/services/chatops/PermissionService.ts`

**代码骨架**:

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

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  deniedAt?: 'command_level' | 'resource_level';
}

export class PermissionService {
  private userRepo?: UserRepository;
  private resourceRepo?: ResourceRepository;

  /** Step 1: 命令级权限 */
  async checkCommandLevel(userId: string, userRole: string, command: string): Promise<PermissionCheckResult> {
    const requiredPerm = COMMAND_PERMISSIONS[command];
    if (!requiredPerm) {
      return { allowed: false, reason: '命令不存在', deniedAt: 'command_level' };
    }
    const rolePerms = ROLE_PERMISSIONS[userRole] || [];
    if (!rolePerms.includes(requiredPerm)) {
      return { allowed: false, reason: `缺少权限: ${requiredPerm}`, deniedAt: 'command_level' };
    }
    return { allowed: true };
  }

  /** Step 2: 资源级权限 */
  async checkResourceLevel(userId: string, resourceType: string, resourceId: string): Promise<PermissionCheckResult> {
    // 查询用户资源范围 (复用 RBAC user_resources 表)
    const resources = await this.resourceRepo?.findByUserId(userId) || [];
    const hasAccess = resources.some(r =>
      r.type === resourceType && r.id === resourceId
    );
    if (!hasAccess) {
      return { allowed: false, reason: `无权访问资源: ${resourceType}/${resourceId}`, deniedAt: 'resource_level' };
    }
    return { allowed: true };
  }

  /** 串联校验 */
  async check(userId: string, userRole: string, command: string, resourceType?: string, resourceId?: string): Promise<PermissionCheckResult> {
    const cmdResult = await this.checkCommandLevel(userId, userRole, command);
    if (!cmdResult.allowed) return cmdResult;

    if (resourceType && resourceId) {
      return this.checkResourceLevel(userId, resourceType, resourceId);
    }
    return { allowed: true };
  }
}
```

**集成点**: 在 `ChatOpsController.executeCommand` 中，输入校验通过后、执行命令前调用 `PermissionService.check()`。校验结果写入审计日志。

**需要修改的现有文件**:
- `orion-platform-service/src/api/controllers/ChatOpsController.ts` — 在 executeCommand 中插入权限检查
- `orion-platform-service/src/api/chatops-routes.ts` — 在路由级别可添加 Fastify 预校验 hook (可选)

**依赖**: 需要确认现有 RBAC 服务的 `UserRepository` / `ResourceRepository` 接口位置。

---

### B-4: 命令路由分发

**新建文件**: `orion-platform-service/src/services/chatops/CommandRouter.ts`

**代码骨架**:

```typescript
/**
 * 命令路由器: 将 ChatOps 命令分发到对应的业务服务
 */
export interface RouteTarget {
  service: string;        // 'pipeline' | 'deploy' | 'monitoring' | 'selfhealing'
  method: string;         // 内部服务方法名
  paramsMapper?: (params: Record<string, unknown>) => Record<string, unknown>;
}

const COMMAND_ROUTES: Record<string, RouteTarget> = {
  'deploy': { service: 'deploy', method: 'deploy' },
  'rollback': { service: 'deploy', method: 'rollback' },
  'restart': { service: 'deploy', method: 'restartPod' },
  'status': { service: 'monitoring', method: 'getStatus' },
  'logs': { service: 'monitoring', method: 'getLogs' },
  'diagnose': { service: 'diagnostic', method: 'runDiagnosis' },
  'pipeline': { service: 'pipeline', method: 'getPipeline' },
  'selfhealing_trigger': { service: 'selfhealing', method: 'executePolicy' },
};

export class CommandRouter {
  private services: Map<string, any>;

  constructor(services: Map<string, any>) {
    this.services = services;
  }

  async route(commandName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const target = COMMAND_ROUTES[commandName];
    if (!target) throw new Error(`No route for command: ${commandName}`);

    const service = this.services.get(target.service);
    if (!service) throw new Error(`Service not found: ${target.service}`);

    const mappedParams = target.paramsMapper?.(params) ?? params;
    return service[target.method](mappedParams);
  }
}
```

**集成点**:
- 在 `ExecutionService.execute` 中，替代当前的 "模拟完成" 逻辑，调用 `CommandRouter.route()`
- Phase 1 中，若目标服务不存在，返回 mock 结果 (标记为 `mock: true`)
- 需要获取现有服务的实例引用，建议在 `chatops-routes.ts` 初始化时传入

**修改文件**: `orion-platform-service/src/services/chatops/ExecutionService.ts`

---

### B-5: POST /api/chatops/recommendations — 推荐聚合 API

**新建文件**:
- `orion-platform-service/src/services/chatops/RecommendationService.ts`
- Controller 方法: `ChatOpsController.getRecommendations`
- 路由: `chatops-routes.ts` 添加 `POST /recommendations`

**代码骨架** — `RecommendationService.ts`:

```typescript
/**
 * MockDataProvider 接口: 为推荐面板提供测试数据
 * Phase 1a 使用 mock 实现, Phase 1b 完成后替换为真实服务调用
 */
export interface MockAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  resource: string;
}

export interface MockBlockedPipeline {
  pipelineId: string;
  message: string;
  status: 'blocked';
}

export interface MockFailedSelfHealing {
  policyId: string;
  policyName: string;
  error: string;
  service: string;
}

export interface MockCostAnomaly {
  id: string;
  service: string;
  anomaly: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface MockDataProvider {
  getActiveAlerts(): Promise<MockAlert[]>;
  getBlockedPipelines(): Promise<MockBlockedPipeline[]>;
  getFailedSelfHealingExecutions(): Promise<MockFailedSelfHealing[]>;
  getCostAnomalies(): Promise<MockCostAnomaly[]>;
}

/** Phase 1a Mock 实现: 返回示例数据供 UI 测试 */
export class MockDataProviderImpl implements MockDataProvider {
  async getActiveAlerts(): Promise<MockAlert[]> {
    return [
      { id: 'alert-1', severity: 'critical', title: 'CPU 使用率 > 90%', message: 'node-3 CPU 持续告警', resource: 'node-3' },
      { id: 'alert-2', severity: 'warning', title: '内存使用率 > 80%', message: 'api-gateway 内存增长', resource: 'api-gateway' },
    ];
  }

  async getBlockedPipelines(): Promise<MockBlockedPipeline[]> {
    return [
      { pipelineId: '42', message: '等待人工确认', status: 'blocked' },
    ];
  }

  async getFailedSelfHealingExecutions(): Promise<MockFailedSelfHealing[]> {
    return [
      { policyId: 'pol-1', policyName: 'Pod 重启策略', error: '重试次数耗尽', service: 'payment-service' },
    ];
  }

  async getCostAnomalies(): Promise<MockCostAnomaly[]> {
    return [
      { id: 'cost-1', service: 'data-pipeline', anomaly: '存储费用突增 300%', severity: 'warning' },
    ];
  }
}

export interface Recommendation {
  id: string;
  type: 'alert' | 'blocked' | 'deploy_result' | 'selfhealing' | 'cost_anomaly';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  actions: { label: string; command: string; params: Record<string, unknown> }[];
  createdAt: Date;
  source: string;
}

export class RecommendationService {
  private dataProvider: MockDataProvider;
  private notifPrefService?: NotificationPreferenceService;
  private dndService?: DNDService;

  constructor(dataProvider: MockDataProvider) {
    this.dataProvider = dataProvider;
  }

  async getRecommendations(userId: string, userRole: string): Promise<Recommendation[]> {
    const results: Recommendation[] = [];

    // 1. 活跃告警
    const alerts = await this.dataProvider.getActiveAlerts();
    results.push(...alerts.map(a => this.alertToRecommendation(a)));

    // 2. 阻塞任务
    const blocked = await this.dataProvider.getBlockedPipelines();
    results.push(...blocked.map(p => this.pipelineToRecommendation(p)));

    // 3. 自愈失败
    const failed = await this.dataProvider.getFailedSelfHealingExecutions();
    results.push(...failed.map(f => this.selfhealingToRecommendation(f)));

    // 4. 成本异常
    const anomalies = await this.dataProvider.getCostAnomalies();
    results.push(...anomalies.map(a => this.finopsToRecommendation(a)));

    // 5. 应用过滤: 权限 + DND + 通知偏好
    return this.filterByUserPreferences(results, userId, userRole);
  }

  private filterByUserPreferences(
    recs: Recommendation[],
    userId: string,
    userRole: string
  ): Recommendation[] {
    // DND 过滤
    const dnd = await this.dndService?.isInDndPeriod(userId);
    if (dnd?.enabled && !dnd.allowCritical) {
      recs = recs.filter(r => r.severity !== 'critical');
    }

    // 通知偏好过滤
    const prefs = await this.notifPrefService?.getByUserId(userId);
    // ... 按偏好过滤

    return recs;
  }
}
```

**Phase 1b 迁移说明**: 当 Phase 1b 完成后, 将 `MockDataProviderImpl` 替换为真实服务调用的实现:

```typescript
export class RealDataProvider implements MockDataProvider {
  private monitoringService: MonitoringService;
  private pipelineService: PipelineService;
  private selfhealingService: SelfHealingService;
  private finopsService: FinOpsService;

  async getActiveAlerts(): Promise<MockAlert[]> {
    return this.monitoringService.getActiveAlerts();
  }
  // ... 其余方法同理
}
```

只需替换构造函数中注入的 provider 实现即可, `RecommendationService` 上层逻辑无需改动。

**路由注册** (`chatops-routes.ts`):

```typescript
app.post('/recommendations', async (request: FastifyRequest, reply: FastifyReply) => {
  return controller.getRecommendations(request, reply);
});
```

**API 契约**:
```
POST /api/chatops/recommendations
Request: { userId: string, context?: { currentPage?: string, resourceId?: string } }
Response: { recommendations: Recommendation[], total: number }
```

**缓存策略**: 内存缓存 30 秒 (防止频繁调用内部服务)。使用 `Map<cacheKey, { data, expiresAt }>` 实现。

**依赖**: B-9 (通知偏好), B-10 (DND 设置), 以及各内部服务的接口存在性确认。

---

### B-6: GET /api/chatops/commands — 更新

**修改文件**: `orion-platform-service/src/api/controllers/ChatOpsController.ts` (listCommands 方法)

**变更内容**:
- 返回格式增加 `description` 字段 (从 command 的 schema 和 examples 派生)
- 增加 `permission_required` 字段映射
- 返回自然语言关键词 (供前端 AutoComplete 使用)

```typescript
// 修改返回格式
const commands = await this.commandService.list({ ... });
const enriched = commands.commands.map(cmd => ({
  id: cmd.id,
  name: cmd.name,
  subcommand: cmd.subcommand,
  description: `${cmd.name} - ${cmd.subcommand}`,
  aliases: cmd.aliases,
  permissionLevel: cmd.permissionLevel,
  examples: cmd.examples,
  schema: cmd.schema,
  // 新增: 自然语言关键词
  keywords: this.extractKeywords(cmd),
}));
```

---

### B-7: GET /api/chatops/sessions/:id/messages — 分页消息查询

**新建文件**:
- `orion-platform-service/src/api/controllers/ChatOpsController.ts` — 新增 `getSessionMessages` 方法
- `orion-platform-service/src/repositories/ChatOpsRepository.ts` — `ChatOpsMessageRepository` 类

**Repository 代码**:

```typescript
// 新增到 ChatOpsRepository.ts
export interface ChatOpsMessageEntity {
  id: string;
  sessionKey: string;  // VARCHAR(255), not UUID — references chatops_sessions(key)
  role: 'user' | 'assistant' | 'system';
  content: string;
  parsedCommand: Record<string, any> | null;
  parsedCommandSanitized: boolean;
  createdAt: Date;
}

export class ChatOpsMessageRepository extends BaseRepository<ChatOpsMessageEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'chatops_messages');
  }

  async findBySession(sessionKey: string, options?: {
    limit?: number;
    cursor?: string;  // created_at 值, 用于向上翻页
  }): Promise<{ messages: ChatOpsMessageEntity[]; hasMore: boolean }> {
    const limit = options?.limit ?? 50;
    let query: string;
    let params: any[];

    if (options?.cursor) {
      query = `SELECT * FROM chatops_messages WHERE session_key = $1 AND created_at < $2 ORDER BY created_at DESC LIMIT $3`;
      params = [sessionKey, options.cursor, limit + 1];
    } else {
      query = `SELECT * FROM chatops_messages WHERE session_key = $1 ORDER BY created_at DESC LIMIT $2`;
      params = [sessionKey, limit + 1];
    }

    const result = await this.db.query(query, params);
    const hasMore = result.rows.length > limit;
    if (hasMore) result.rows.pop(); // 去掉多查的一行

    return {
      messages: result.rows.map(row => this.mapRowToEntity(row)),
      hasMore,
    };
  }

  async insert(data: {
    session_key: string; role: string; content: string;
    parsed_command: Record<string, any> | null;
    parsed_command_sanitized?: boolean;
  }): Promise<ChatOpsMessageEntity> {
    const result = await this.db.query(
      `INSERT INTO chatops_messages (session_key, role, content, parsed_command, parsed_command_sanitized)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.session_key, data.role, data.content, data.parsed_command, data.parsed_command_sanitized ?? true],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ChatOpsMessageEntity {
    return {
      id: row.id,
      sessionKey: row.session_key,       // VARCHAR(255) → string
      role: row.role,
      content: row.content,
      parsedCommand: row.parsed_command,
      parsedCommandSanitized: row.parsed_command_sanitized ?? true,
      createdAt: row.created_at,
    };
  }
}
```

**Controller 方法**:

```typescript
async getSessionMessages(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const params = request.params as { id: string };
    const query = request.query as { limit?: string; cursor?: string };
    const { messages, hasMore } = await this.messageService.getSessionMessages(
      params.id,
      {
        limit: query.limit ? parseInt(query.limit) : 50,
        cursor: query.cursor,
      }
    );
    await reply.send({
      success: true,
      data: messages,
      hasMore,
      nextCursor: hasMore ? messages[0]?.created_at : null,
    });
  } catch (err) { ... }
}
```

**路由注册**:

```typescript
app.get('/sessions/:id/messages', async (request: FastifyRequest, reply: FastifyReply) => {
  return controller.getSessionMessages(request, reply);
});
```

---

### B-8: EventBus 事件订阅

**新建文件**: `orion-platform-service/src/services/chatops/EventSubscriber.ts`

**代码骨架**:

```typescript
/**
 * 订阅 EventBus 事件，驱动推荐面板实时更新
 */
export class ChatOpsEventSubscriber {
  private eventBus: EventBusService;
  private activeRecommendations: Map<string, Recommendation> = new Map();

  constructor(eventBus: EventBusService) {
    this.eventBus = eventBus;
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    // 告警事件
    this.eventBus.on('alert.created', (data: any) => {
      this.activeRecommendations.set(data.alertId, {
        id: data.alertId,
        type: 'alert',
        severity: data.severity,
        title: data.title,
        description: data.message,
        actions: [
          { label: '查看日志', command: 'logs', params: { resource: data.resource } },
          { label: '诊断根因', command: 'diagnose', params: { resource: data.resource } },
          { label: '重启Pod', command: 'restart', params: { pod: data.resource } },
        ],
        createdAt: new Date(),
        source: 'monitoring',
      });
      this.eventBus.emit('chatops:recommendation_update', {
        recommendations: Array.from(this.activeRecommendations.values()),
      });
    });

    this.eventBus.on('alert.acknowledged', (data: any) => {
      this.activeRecommendations.delete(data.alertId);
      this.eventBus.emit('chatops:recommendation_update', {
        recommendations: Array.from(this.activeRecommendations.values()),
      });
    });

    // Pipeline 更新
    this.eventBus.on('pipeline.updated', (data: any) => {
      if (data.status === 'blocked') {
        this.activeRecommendations.set(`pipeline:${data.pipelineId}`, {
          id: `pipeline:${data.pipelineId}`,
          type: 'blocked',
          severity: 'warning',
          title: `Pipeline #${data.pipelineId} 等待确认`,
          description: data.message,
          actions: [
            { label: '批准', command: 'pipeline', params: { action: 'approve', id: data.pipelineId } },
            { label: '拒绝', command: 'pipeline', params: { action: 'reject', id: data.pipelineId } },
          ],
          createdAt: new Date(),
          source: 'pipeline',
        });
      }
      this.eventBus.emit('chatops:recommendation_update', {
        recommendations: Array.from(this.activeRecommendations.values()),
      });
    });

    // 部署完成
    this.eventBus.on('deploy.finished', (data: any) => {
      if (data.status === 'failed') {
        this.activeRecommendations.set(`deploy:${data.deploymentId}`, {
          id: `deploy:${data.deploymentId}`,
          type: 'deploy_result',
          severity: 'critical',
          title: `部署失败: ${data.service}`,
          description: data.error,
          actions: [
            { label: '回滚', command: 'rollback', params: { deployment: data.deploymentId } },
            { label: '查看日志', command: 'logs', params: { resource: data.service } },
          ],
          createdAt: new Date(),
          source: 'deploy',
        });
      }
      this.eventBus.emit('chatops:recommendation_update', {
        recommendations: Array.from(this.activeRecommendations.values()),
      });
    });

    // 自愈失败
    this.eventBus.on('selfhealing.failed', (data: any) => {
      this.activeRecommendations.set(`selfhealing:${data.policyId}`, {
        id: `selfhealing:${data.policyId}`,
        type: 'selfhealing',
        severity: 'warning',
        title: `自愈失败: ${data.policyName}`,
        description: data.error,
        actions: [
          { label: '手动干预', command: 'diagnose', params: { resource: data.service } },
          { label: '查看详情', command: 'status', params: { resource: data.service } },
        ],
        createdAt: new Date(),
        source: 'selfhealing',
      });
      this.eventBus.emit('chatops:recommendation_update', {
        recommendations: Array.from(this.activeRecommendations.values()),
      });
    });
  }

  /** 获取当前活跃推荐 */
  getActiveRecommendations(): Recommendation[] {
    return Array.from(this.activeRecommendations.values());
  }
}
```

**集成点**: 在 `chatops-routes.ts` 初始化时创建实例:

```typescript
const eventSubscriber = new ChatOpsEventSubscriber(eventBus);
// 传给 RecommendationService 使用
```

---

### B-9: 通知偏好 CRUD API

**新建文件**:
- `orion-platform-service/src/services/chatops/NotificationPreferenceService.ts`
- `orion-platform-service/src/repositories/ChatOpsRepository.ts` — `ChatOpsNotificationPreferenceRepository`
- Controller 方法 + 路由

**Repository**:

```typescript
export interface ChatOpsNotificationPreferenceEntity {
  id: string;
  userId: string;
  alertLevel: 'critical' | 'warning' | 'info';
  channelChatops: boolean;
  channelEmail: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ChatOpsNotificationPreferenceRepository extends BaseRepository<ChatOpsNotificationPreferenceEntity> {
  constructor(db: ...) { super(db, 'chatops_notification_preferences'); }

  async findByUserId(userId: string): Promise<ChatOpsNotificationPreferenceEntity[]> { ... }
  async upsert(data: { userId: string; alertLevel: string; channelChatops: boolean; channelEmail: boolean }): Promise<ChatOpsNotificationPreferenceEntity> {
    const result = await this.db.query(
      `INSERT INTO chatops_notification_preferences (user_id, alert_level, channel_chatops, channel_email, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, alert_level)
       DO UPDATE SET channel_chatops = EXCLUDED.channel_chatops, channel_email = EXCLUDED.channel_email, updated_at = NOW()
       RETURNING *`,
      [data.userId, data.alertLevel, data.channelChatops, data.channelEmail],
    );
    return this.mapRowToEntity(result.rows[0]);
  }
}
```

**Service**: 标准 CRUD (listByUserId, upsert, delete)

**路由**:
```
GET    /api/chatops/settings/notification-preferences?userId=xxx
PUT    /api/chatops/settings/notification-preferences
DELETE /api/chatops/settings/notification-preferences/:id
```

---

### B-10: DND 设置 CRUD API

**新建文件**:
- `orion-platform-service/src/services/chatops/DNDService.ts`
- Repository: `ChatOpsDNDSettingsRepository` (添加到 ChatOpsRepository.ts)

**Service 关键方法**:

```typescript
export class DNDService {
  async getSettings(userId: string): Promise<DNDSettings | null> { ... }
  async updateSettings(userId: string, data: Partial<DNDSettings>): Promise<DNDSettings> { ... }
  async toggleDND(userId: string, enabled: boolean): Promise<DNDSettings> { ... }

  /** 判断用户是否在免打扰时段 */
  async isInDndPeriod(userId: string): Promise<{ enabled: boolean; allowCritical: boolean; endTime?: string }> {
    const settings = await this.getSettings(userId);
    if (!settings || !settings.enabled) return { enabled: false, allowCritical: true };

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTime = currentHour * 60 + currentMin;

    const startMin = this.timeToMinutes(settings.startTime);
    const endMin = this.timeToMinutes(settings.endTime);

    // 跨午夜处理
    let inRange: boolean;
    if (startMin > endMin) {
      inRange = currentTime >= startMin || currentTime < endMin;
    } else {
      inRange = currentTime >= startMin && currentTime < endMin;
    }

    // 检查重复天数
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
    const dayMatch = settings.repeatDays.includes(dayOfWeek === 0 ? 7 : dayOfWeek);

    return { enabled: inRange && dayMatch, allowCritical: settings.allowCritical, endTime: settings.endTime };
  }
}
```

**路由**:
```
GET    /api/chatops/settings/dnd
PUT    /api/chatops/settings/dnd
PATCH  /api/chatops/settings/dnd/toggle
```

GET/PUT 从 JWT 提取 userId，无需 query 参数。

---

### B-11: 已读状态管理 API

**新建文件**:
- `orion-platform-service/src/services/chatops/AlertStateService.ts`
- Repository: `ChatOpsAlertStateRepository`

**路由**:
```
GET    /api/chatops/alerts/states          — 获取用户所有告警状态
POST   /api/chatops/alerts/:id/read        — 标记为 read
POST   /api/chatops/alerts/:id/acknowledge — 标记为 acknowledged
POST   /api/chatops/alerts/:id/dismiss     — 标记为 dismissed
POST   /api/chatops/alerts/batch-read      — 批量标记已读
```

**Service 关键逻辑**:

```typescript
async markAsRead(userId: string, alertId: string): Promise<void> {
  await this.repo.upsert({ userId, alertId, state: 'read', readAt: new Date() });
}

async markAsAcknowledged(userId: string, alertId: string): Promise<void> {
  await this.repo.upsert({ userId, alertId, state: 'acknowledged', readAt: new Date() });
}

async markAsDismissed(userId: string, alertId: string): Promise<void> {
  await this.repo.upsert({ userId, alertId, state: 'dismissed', dismissedAt: new Date() });
}

/** 获取未读告警数量 */
async getUnreadCount(userId: string): Promise<number> {
  return this.repo.countByState(userId, 'unread') + this.repo.countByState(userId, 'acknowledged');
}
```

---

### B-12: 数据库表 + 索引

已在 **DB-2** 中覆盖。包括 5 张新表和 15+ 个索引。

---

### B-13: L1 → L3 数据写入链路

**修改文件**: `orion-platform-service/src/services/chatops/ExecutionService.ts`

**变更**: 在 `execute()` 方法中，增加异步写入消息到 `chatops_messages` 表的逻辑:

```typescript
async execute(input: ChatOpsExecutionCreateInput): Promise<ChatOpsExecution> {
  // ... 原有逻辑 ...

  // 新增: 写入消息到 chatops_messages (L3)
  // 注意: parsed_command 必须使用 InputValidator.sanitize() 脱敏
  if (input.sessionKey) {
    const sanitizedParams = InputValidator.sanitize(input.params as Record<string, unknown>);
    await this.messageRepo.insert({
      session_key: input.sessionKey,
      role: 'user',
      content: input.commandId,  // 用户命令文本
      parsed_command: sanitizedParams,
      parsed_command_sanitized: true,
    });
  }

  // ... 执行完成后写入 assistant 回复 ...
  const result = await this.commandRouter.route(input.commandId, input.params);
  if (input.sessionKey) {
    await this.messageRepo.insert({
      session_key: input.sessionKey,
      role: 'assistant',
      content: JSON.stringify(result),
      parsed_command: null,
      parsed_command_sanitized: true,
    });
  }

  return this.entityToExecution(updated!);
}
```

**需要添加**: `ChatOpsMessageRepository` 到 `ExecutionService` 构造函数。

**SE-1 安全要求**: `parsed_command` 必须经 `InputValidator.sanitize()` 脱敏后存储，且 `parsed_command_sanitized` 必须设为 `true`。

---

### B-14: 执行 API 幂等性 (Redis + 降级)

已在 **B-1** 中覆盖。`IdempotencyService` 提供:
1. 优先使用 Redis (若可用)
2. Redis 不可用时降级到 PostgreSQL `chatops_idempotency_keys` 表 (列名为 `key`, 非 `idempotency_key`)
3. 双端都不用时降级为 "5 秒内相同用户+命令拒绝"

```typescript
// DB 降级策略 — 注意表列名为 key 而非 idempotency_key
// INSERT INTO chatops_idempotency_keys (key, command, user_id, result, status, expires_at)
// SELECT * FROM chatops_idempotency_keys WHERE key = $1 AND expires_at > NOW()

if (!this.redisAvailable && !this.dbPool) {
  const recentKey = `${userId}:${command}:${Date.now() / 5000 | 0}`;
  if (this.recentCommands.has(recentKey)) {
    return { valid: false, error: '请求过于频繁，请稍后重试' };
  }
  this.recentCommands.set(recentKey, true);
  setTimeout(() => this.recentCommands.delete(recentKey), 5000);
}
```

---

### B-15: EventBus 驱动推荐面板实时更新

已在 **B-8** 中覆盖 (`ChatOpsEventSubscriber`)。

**API 支持**: 需要暴露一个 SSE (Server-Sent Events) 或 WebSocket 端点，将 EventBus 的 `chatops:recommendation_update` 事件推送到前端。

**新建路由**: `GET /api/chatops/stream/recommendations`

```typescript
app.get('/stream/recommendations', async (request: FastifyRequest, reply: FastifyReply) => {
  // 设置 SSE headers
  reply.header('Content-Type', 'text/event-stream');
  reply.header('Cache-Control', 'no-cache');
  reply.header('Connection', 'keep-alive');

  const userId = (request as any).userId; // 从 JWT 提取

  const handler = (data: any) => {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  eventBus.on('chatops:recommendation_update', handler);

  // 连接关闭时移除监听器
  reply.raw.on('close', () => {
    eventBus.removeListener('chatops:recommendation_update', handler);
  });
});
```

**Phase 1 降级**: 若 SSE 连接不稳定，前端使用 60s 轮询兜底。

---

## Group C: Frontend (14 Tasks)

---

### F-1: ChatTrigger 悬浮按钮

**新建文件**: `orion-frontend/src/components/ChatOps/ChatTrigger.tsx`

**集成位置**: `orion-frontend/src/components/Layout/index.tsx` — 在 `<Footer>` 后、`</AntLayout>` 前添加:

```tsx
import { ChatTrigger } from '@/components/ChatOps/ChatTrigger';

// ... 在 return 中
<ChatTrigger />
```

**代码骨架**:

```tsx
import React from 'react';
import { Badge, Tooltip } from 'antd';
import { BellOutlined, MessageOutlined, LoadingOutlined } from '@ant-design/icons';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import { colors } from '@/tokens/colors';
import { useLocation } from 'react-router-dom';

const ChatTrigger: React.FC = () => {
  const { isOpen, toggle, alertLevel, unreadAlerts } = useChatOpsStore();
  const location = useLocation();

  if (isOpen) return null; // 面板打开时隐藏

  const statusConfig = {
    normal: { icon: <MessageOutlined />, color: colors.primary[500], gradient: `linear-gradient(135deg, ${colors.primary[400]}, ${colors.primary[600]})` },
    warning: { icon: <BellOutlined />, color: colors.warning[500], gradient: `linear-gradient(135deg, ${colors.warning[400]}, ${colors.warning[600]})` },
    critical: { icon: <BellOutlined />, color: colors.error[400], gradient: `linear-gradient(135deg, ${colors.error[400]}, ${colors.error[500]})`, pulse: true },
    executing: { icon: <LoadingOutlined spin />, color: colors.warning[500], gradient: `linear-gradient(135deg, ${colors.warning[400]}, ${colors.warning[600]})` },
  };

  const config = statusConfig[alertLevel === 'normal' && unreadAlerts === 0 ? 'normal' : alertLevel === 'critical' ? 'critical' : alertLevel === 'warning' ? 'warning' : 'normal'];

  return (
    <Tooltip title={unreadAlerts > 0 ? `${unreadAlerts} 条待处理告警` : '打开 ChatOps'}>
      <Badge count={unreadAlerts > 0 ? unreadAlerts : undefined}>
        <div
          onClick={toggle}
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: config.gradient,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            cursor: 'pointer',
            zIndex: 999,
            boxShadow: `0 4px 12px ${config.color}40`,
            transition: 'all 0.3s',
          }}
          className={config.pulse ? 'chat-trigger-pulse' : ''}
        >
          {config.icon}
        </div>
      </Badge>
    </Tooltip>
  );
};
```

**CSS 动画** (添加到全局样式或 CSS-in-JS):

```css
@keyframes chat-trigger-pulse {
  0%, 100% { box-shadow: 0 4px 12px rgba(255, 77, 79, 0.4); }
  50% { box-shadow: 0 4px 24px rgba(255, 77, 79, 0.7); }
}
.chat-trigger-pulse { animation: chat-trigger-pulse 2s infinite; }
```

**上下文感知**: 从 `useLocation()` 提取当前路由，解析出 `{ type, id }`:

```typescript
function extractPageContext(pathname: string): PageContext | null {
  const pipelineMatch = pathname.match(/^\/pipelines\/(\d+)/);
  if (pipelineMatch) return { type: 'pipeline', id: pipelineMatch[1] };

  const cmdbMatch = pathname.match(/^\/cmdb\/([^/]+)\/([^/]+)/);
  if (cmdbMatch) return { type: cmdbMatch[1], id: cmdbMatch[2] };

  const deployMatch = pathname.match(/^\/deploy\/([^/]+)/);
  if (deployMatch) return { type: 'environment', id: deployMatch[1] };

  return { type: 'general' };
}
```

---

### F-2: ChatPanel 侧边栏容器

**新建文件**: `orion-frontend/src/components/ChatOps/ChatPanel/index.tsx`

**代码骨架**:

```tsx
import React, { useRef, useCallback } from 'react';
import { Drawer } from 'antd';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import { ChatHeader } from './ChatHeader';
import { SmartRecommend } from '../SmartRecommend';
import { MessageArea } from './MessageArea';
import { ChatInput } from '../ChatInput';
import { colors, spacing } from '@/tokens/colors';

// 响应式宽度计算
function usePanelWidth(): number {
  const [width, setWidth] = React.useState(400);
  React.useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w <= 1366) setWidth(360);
      else if (w >= 1920) setWidth(480);
      else setWidth(400);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return width;
}

export const ChatPanel: React.FC = () => {
  const { isOpen, toggle } = useChatOpsStore();
  const panelWidth = usePanelWidth();

  return (
    <Drawer
      open={isOpen}
      onClose={toggle}
      width={panelWidth}
      placement="right"
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
        header: { display: 'none' },
      }}
      style={{
        boxShadow: '-4px 0 16px rgba(0,0,0,0.06)',
      }}
    >
      <ChatHeader />
      <SmartRecommend />
      <MessageArea />
      <ChatInput />
    </Drawer>
  );
};
```

**挂载位置**: 在 `Layout/index.tsx` 中，在 `<ChatTrigger />` 同级添加 `<ChatPanel />`。

**拖拽调整宽度** (可选增强): 在右侧边缘添加 4px 拖拽条。

---

### F-3: SmartRecommend 推荐面板

**新建文件**: `orion-frontend/src/components/ChatOps/SmartRecommend.tsx`

**代码骨架**:

```tsx
import React from 'react';
import { Card, Tag, Button, Empty, Space } from 'antd';
import { BellFilled, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useChatOpsStore, type Recommendation } from '@/stores/chatOpsStore';
import { colors } from '@/tokens/colors';

const severityConfig = {
  critical: { color: colors.error[400], bg: colors.error[50], icon: <BellFilled /> },
  warning: { color: colors.warning[500], bg: colors.warning[50], icon: <WarningOutlined /> },
  info: { color: colors.info[500], bg: colors.info[50], icon: <CheckCircleOutlined /> },
};

export const SmartRecommend: React.FC = () => {
  const { recommendations, dismissRecommendation, executeAction } = useChatOpsStore();

  if (recommendations.length === 0) {
    return (
      <div style={{ padding: '12px 16px', background: colors.light.bg.primary, borderBottom: `1px solid ${colors.light.border.light}` }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="当前无异常"
          style={{ margin: 0, padding: '8px 0' }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        maxHeight: 240,
        overflowY: 'auto',
        padding: '12px 16px',
        background: colors.warning[50],
        borderBottom: `1px solid ${colors.warning[200]}`,
      }}
    >
      {recommendations.map(rec => {
        const cfg = severityConfig[rec.severity];
        return (
          <Card
            key={rec.id}
            size="small"
            style={{ marginBottom: 8, borderColor: cfg.color + '40' }}
            extra={
              <Button type="text" size="small" onClick={() => dismissRecommendation(rec.id)}>
                ×
              </Button>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: cfg.color }}>{cfg.icon}</span>
              <Tag color={cfg.color}>{rec.severity.toUpperCase()}</Tag>
              <strong>{rec.title}</strong>
            </div>
            <p style={{ margin: '4px 0', fontSize: 12, color: colors.light.text.secondary }}>
              {rec.description}
            </p>
            <Space>
              {rec.actions.map(action => (
                <Button
                  key={action.label}
                  size="small"
                  onClick={() => executeAction(action.command, action.params)}
                >
                  {action.label}
                </Button>
              ))}
            </Space>
          </Card>
        );
      })}
    </div>
  );
};
```

**数据源**: 从 `chatOpsStore.recommendations` 读取，Store 通过 `fetchRecommendations()` 调用 `POST /api/chatops/recommendations` 获取。

---

### F-4: ChatInput 输入框 + Slash 命令

**新建文件**: `orion-frontend/src/components/ChatOps/ChatInput.tsx`

**代码骨架**:

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Input, AutoComplete, Tag, Space } from 'antd';
import { SendOutlined, UpOutlined } from '@ant-design/icons';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import { useCommandSuggestions } from './hooks/useCommandSuggestions';
import { colors } from '@/tokens/colors';

const QUICK_COMMANDS = [
  { label: '/deploy', value: '/deploy' },
  { label: '/logs', value: '/logs' },
  { label: '/restart', value: '/restart' },
  { label: '/status', value: '/status' },
  { label: '/rollback', value: '/rollback' },
];

export const ChatInput: React.FC = () => {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { sendMessage, isTyping, commands } = useChatOpsStore();
  const inputRef = useRef<any>(null);

  const suggestions = useCommandSuggestions(input, commands);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      padding: '12px 16px',
      borderTop: `1px solid ${colors.light.border.light}`,
      background: colors.light.bg.primary,
    }}>
      {/* 快捷命令标签 */}
      <Space style={{ marginBottom: 8 }} wrap>
        {QUICK_COMMANDS.map(cmd => (
          <Tag
            key={cmd.value}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setInput(cmd.value + ' ');
              inputRef.current?.focus();
            }}
          >
            {cmd.label}
          </Tag>
        ))}
      </Space>

      <AutoComplete
        options={suggestions.map(s => ({ value: s, label: s }))}
        open={showSuggestions && suggestions.length > 0}
        value={input}
        onChange={setInput}
        onSelect={(value) => { setInput(value); setShowSuggestions(false); }}
      >
        <Input.TextArea
          ref={inputRef}
          placeholder="输入命令或自然语言... (使用 / 查看命令)"
          autoSize={{ minRows: 1, maxRows: 4 }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(input.startsWith('/'))}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onPressEnter={handleSend}
        />
      </AutoComplete>

      <Button
        type="primary"
        icon={<SendOutlined />}
        onClick={handleSend}
        loading={isTyping}
        style={{ marginTop: 8, width: '100%' }}
      >
        发送
      </Button>
    </div>
  );
};
```

**Hook: `useCommandSuggestions`**:

```typescript
// orion-frontend/src/components/ChatOps/hooks/useCommandSuggestions.ts
export function useCommandSuggestions(input: string, commands: ChatOpsCommand[]): string[] {
  if (!input.startsWith('/')) return [];

  const query = input.slice(1).toLowerCase();
  const matches = commands.filter(cmd =>
    cmd.name.toLowerCase().startsWith(query) ||
    cmd.aliases.some(a => a.toLowerCase().startsWith(query))
  );

  return matches.slice(0, 8).map(cmd => `/${cmd.name}`);
}
```

---

### F-5: 命令解析引擎 (前端)

**新建文件**: `orion-frontend/src/components/ChatOps/CommandParser.ts`

**代码骨架**:

```typescript
import Ajv from 'ajv';

export interface ParsedCommand {
  command: string;
  params: Record<string, unknown>;
  rawInput: string;
}

export interface ParseResult {
  success: boolean;
  parsed?: ParsedCommand;
  error?: string;
}

// 关键词 → 命令映射
const KEYWORD_RULES: Array<{
  keywords: RegExp[];
  command: string;
  paramExtractor: (input: string) => Record<string, unknown>;
}> = [
  {
    keywords: [/部署|deploy/i],
    command: 'deploy',
    paramExtractor: (input) => {
      const versionMatch = input.match(/v?\d+\.\d+\.\d+/);
      const envMatch = input.match(/到|to|in\s+(staging|production|development|testing)/i);
      return {
        version: versionMatch?.[0] || '',
        environment: envMatch?.[1]?.toLowerCase() || '',
      };
    },
  },
  {
    keywords: [/查看.*日志|查看日志|日志|logs/i],
    command: 'logs',
    paramExtractor: (input) => {
      const resourceMatch = input.match(/(\S+)\s*(日志|错误)/);
      const envMatch = input.match(/(staging|production|development|testing)/i);
      return { resource: resourceMatch?.[1] || '', environment: envMatch?.[1]?.toLowerCase() || '' };
    },
  },
  {
    keywords: [/重启|restart/i],
    command: 'restart',
    paramExtractor: (input) => {
      const podMatch = input.match(/(\S+-\S+)/);
      const nsMatch = input.match(/namespace\s*[:=]\s*(\S+)/);
      return { pod: podMatch?.[1] || '', namespace: nsMatch?.[1] || 'default' };
    },
  },
  {
    keywords: [/状态|status|健康|health/i],
    command: 'status',
    paramExtractor: (input) => {
      const envMatch = input.match(/(staging|production|development|testing)/i);
      return { environment: envMatch?.[1]?.toLowerCase() || '' };
    },
  },
  {
    keywords: [/回滚|rollback|回退/i],
    command: 'rollback',
    paramExtractor: (input) => {
      const versionMatch = input.match(/v?\d+\.\d+\.\d+/);
      const envMatch = input.match(/(staging|production|development|testing)/i);
      return { version: versionMatch?.[0] || '', environment: envMatch?.[1]?.toLowerCase() || '' };
    },
  },
  {
    keywords: [/诊断|根因|diagnose/i],
    command: 'diagnose',
    paramExtractor: (input) => {
      const resourceMatch = input.match(/(\S+)\s*(诊断|根因)/);
      return { resource: resourceMatch?.[1] || '' };
    },
  },
];

// 安全校验 (与后端 B-2 对齐)
const DANGEROUS_CHARS = /[;|&$`(){}[\]<>\\!#~]/;
const PATH_TRAVERSAL = /\.\.[/\\]/;

export class CommandParser {
  private ajv: Ajv;
  private schemas: Map<string, Record<string, unknown>>;

  constructor() {
    this.ajv = new Ajv();
    this.schemas = new Map();
  }

  registerSchema(command: string, schema: Record<string, unknown>) {
    this.schemas.set(command, schema);
  }

  parse(input: string): ParseResult {
    // 1. 安全预检
    if (DANGEROUS_CHARS.test(input)) {
      return { success: false, error: '输入包含不允许的字符' };
    }
    if (PATH_TRAVERSAL.test(input)) {
      return { success: false, error: '不允许路径遍历' };
    }

    // 2. Slash 命令解析
    if (input.startsWith('/')) {
      return this.parseSlashCommand(input);
    }

    // 3. 自然语言解析 (关键词匹配)
    return this.parseNaturalLanguage(input);
  }

  private parseSlashCommand(input: string): ParseResult {
    const parts = input.trim().split(/\s+/);
    const commandName = parts[0].slice(1); // 去掉 /
    const params: Record<string, unknown> = {};

    for (let i = 1; i < parts.length; i++) {
      const match = parts[i].match(/^(\w+)=(.+)$/);
      if (match) params[match[1]] = match[2];
    }

    // Schema 校验
    const schema = this.schemas.get(commandName);
    if (schema) {
      const validate = this.ajv.compile(schema);
      if (!validate(params)) {
        return { success: false, error: this.ajv.errorsText(validate.errors) };
      }
    }

    return { success: true, parsed: { command: commandName, params, rawInput: input } };
  }

  private parseNaturalLanguage(input: string): ParseResult {
    for (const rule of KEYWORD_RULES) {
      if (rule.keywords.some(re => re.test(input))) {
        const params = rule.paramExtractor(input);
        return { success: true, parsed: { command: rule.command, params, rawInput: input } };
      }
    }
    return { success: false, error: '无法识别命令' };
  }
}
```

---

### F-6: ChatMessage + ActionCard 组件

**新建文件**:
- `orion-frontend/src/components/ChatOps/ChatMessage.tsx`
- `orion-frontend/src/components/ChatOps/ActionCard.tsx`

**ChatMessage.tsx**:

```tsx
import React from 'react';
import { colors } from '@/tokens/colors';
import { ActionCard } from './ActionCard';

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: Array<{ label: string; command: string; params: Record<string, unknown> }>;
  status?: 'success' | 'failed' | 'running';
}

export const ChatMessage: React.FC<{ message: ChatMessageData }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: colors.light.text.tertiary }}>
        {message.content}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      padding: '4px 16px',
    }}>
      <div style={{
        maxWidth: '80%',
        padding: '8px 12px',
        borderRadius: isUser ? '12px 12px 0 12px' : '12px 12px 12px 0',
        background: isUser
          ? `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[600]})`
          : colors.light.bg.primary,
        color: isUser ? '#fff' : colors.light.text.primary,
        border: isUser ? 'none' : `1px solid ${colors.light.border.light}`,
      }}>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.content}
        </div>
        {message.actions && message.actions.length > 0 && (
          <ActionCard actions={message.actions} status={message.status} />
        )}
        <div style={{
          fontSize: 10,
          marginTop: 4,
          textAlign: isUser ? 'right' : 'left',
          opacity: 0.6,
        }}>
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};
```

**ActionCard.tsx**:

```tsx
import React from 'react';
import { Button, Space, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { useChatOpsStore } from '@/stores/chatOpsStore';

const statusIcons = {
  success: <CheckCircleOutlined style={{ color: colors.success[500] }} />,
  failed: <CloseCircleOutlined style={{ color: colors.error[400] }} />,
  running: <LoadingOutlined style={{ color: colors.warning[500] }} />,
};

export const ActionCard: React.FC<{
  actions: Array<{ label: string; command: string; params: Record<string, unknown> }>;
  status?: 'success' | 'failed' | 'running';
}> = ({ actions, status }) => {
  const { executeAction } = useChatOpsStore();

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          {statusIcons[status]} {status}
        </div>
      )}
      <Space wrap>
        {actions.map(action => (
          <Button
            key={action.label}
            size="small"
            type="default"
            onClick={() => executeAction(action.command, action.params)}
          >
            {action.label}
          </Button>
        ))}
      </Space>
    </div>
  );
};
```

---

### F-7: 滚动行为管理

**新建文件**: `orion-frontend/src/components/ChatOps/MessageArea.tsx` (或使用 `hooks/useAutoScroll.ts`)

**Hook: `useAutoScroll`**:

```typescript
// orion-frontend/src/components/ChatOps/hooks/useAutoScroll.ts
import { useRef, useState, useCallback, useEffect } from 'react';

export function useAutoScroll(containerRef: React.RefObject<HTMLDivElement>) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const SCROLL_THRESHOLD = 50; // px from bottom to pause auto-scroll

  const isNearBottom = useCallback((el: HTMLDivElement) => {
    return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const near = isNearBottom(el);
      setShowScrollButton(!near);
      if (near) setAutoScroll(true);
      else setAutoScroll(false);
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [containerRef, isNearBottom]);

  // 当新消息到达时，如果 autoScroll 为 true 则滚动到底部
  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      setAutoScroll(true);
      setShowScrollButton(false);
    }
  }, [containerRef]);

  const scrollToBottomIfAuto = useCallback(() => {
    if (autoScroll) scrollToBottom();
  }, [autoScroll, scrollToBottom]);

  return { autoScroll, showScrollButton, scrollToBottomIfAuto, scrollToBottom };
}
```

**使用**: 在 `MessageArea` 组件中:

```tsx
const containerRef = useRef<HTMLDivElement>(null);
const { showScrollButton, scrollToBottomIfAuto } = useAutoScroll(containerRef);

// 消息变化时自动滚动
useEffect(() => { scrollToBottomIfAuto(); }, [messages.length, scrollToBottomIfAuto]);

// "新消息" 浮动按钮
{showScrollButton && (
  <div
    onClick={() => { /* 滚动到底部 */ }}
    style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', ... }}
  >
    ↓ 新消息
  </div>
)}
```

---

### F-8: chatOpsStore Zustand Store

**新建文件**: `orion-frontend/src/stores/chatOpsStore.ts`

**完整代码**:

```typescript
/**
 * ChatOps Zustand Store
 * L1: 内存中的当前会话状态
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { getCommands, executeCommand, getCommandStatus, getAuditLogs } from '@/api/chatops';
import { CommandParser, type ParsedCommand } from '@/components/ChatOps/CommandParser';
import { colors } from '@/tokens/colors';

// ---- Types ----

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: Array<{ label: string; command: string; params: Record<string, unknown> }>;
  status?: 'success' | 'failed' | 'running';
}

export interface Recommendation {
  id: string;
  type: 'alert' | 'blocked' | 'deploy_result' | 'selfhealing' | 'cost_anomaly';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  actions: Array<{ label: string; command: string; params: Record<string, unknown> }>;
  createdAt: Date;
  source: string;
}

export interface PageContext {
  type: string;
  id?: string;
}

// ---- Store ----

interface ChatOpsState {
  // 面板状态
  isOpen: boolean;
  unreadAlerts: number;
  alertLevel: 'normal' | 'warning' | 'critical' | 'executing';

  // 对话
  messages: ChatMessage[];
  isTyping: boolean;
  sessionId: string | null;

  // 推荐
  recommendations: Recommendation[];
  isRecommendationLoading: boolean;

  // 上下文
  pageContext: PageContext | null;

  // 命令
  commands: Array<{
    id: string; name: string; subcommand: string; aliases: string[];
    schema: Record<string, unknown>; examples: string[];
  }>;

  // 分页
  isLoadingMore: boolean;
  hasMoreMessages: boolean;
  nextCursor: string | null;

  // 内存监控
  memoryCheckEnabled: boolean;

  // Actions
  toggle: () => void;
  open: () => void;
  close: () => void;

  sendMessage: (text: string) => Promise<void>;
  executeAction: (command: string, params: Record<string, unknown>) => Promise<void>;

  dismissRecommendation: (id: string) => void;
  fetchRecommendations: () => Promise<void>;

  setUnreadAlerts: (count: number) => void;
  setAlertLevel: (level: 'normal' | 'warning' | 'critical' | 'executing') => void;

  setPageContext: (ctx: PageContext | null) => void;

  loadMoreMessages: () => Promise<void>;
  trimOldMessages: (maxCount: number) => void;

  setMemoryCheckEnabled: (enabled: boolean) => void;
}

const parser = new CommandParser();

export const useChatOpsStore = create<ChatOpsState>()(
  subscribeWithSelector((set, get) => ({
    // 初始状态
    isOpen: false,
    unreadAlerts: 0,
    alertLevel: 'normal',
    messages: [],
    isTyping: false,
    sessionId: null,
    recommendations: [],
    isRecommendationLoading: false,
    pageContext: null,
    commands: [],
    isLoadingMore: false,
    hasMoreMessages: false,
    nextCursor: null,
    memoryCheckEnabled: true,

    toggle: () => set(state => ({ isOpen: !state.isOpen })),
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),

    sendMessage: async (text: string) => {
      set({ isTyping: true });

      // 前端解析
      const parseResult = parser.parse(text);
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      // 添加用户消息
      set(state => {
        const newMessages = [...state.messages, userMsg];
        return { messages: newMessages.slice(-500) }; // 最多 500 条
      });

      if (!parseResult.success) {
        set(state => ({
          messages: [...state.messages, {
            id: crypto.randomUUID(),
            role: 'system',
            content: parseResult.error || '无法识别命令',
            timestamp: new Date(),
          }],
          isTyping: false,
        }));
        return;
      }

      // 调用后端
      try {
        const { command, params } = parseResult.parsed!;
        const userId = localStorage.getItem('user_id') || 'anonymous';
        const idempotencyKey = crypto.randomUUID();

        const response = await executeCommand({
          command,
          params,
          userId,
          platform: 'web',
          channel: 'chatops-panel',
          idempotencyKey,
        });

        const execData = response.data?.data;
        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: execData?.result?.output || `命令 ${command} 执行完成`,
          timestamp: new Date(),
          status: execData?.status === 'completed' ? 'success' : 'failed',
          actions: extractActionsFromResult(execData),
        };

        set(state => ({
          messages: [...state.messages, aiMsg].slice(-500),
          isTyping: false,
        }));
      } catch (err) {
        set(state => ({
          messages: [...state.messages, {
            id: crypto.randomUUID(),
            role: 'system',
            content: `执行失败: ${err instanceof Error ? err.message : '未知错误'}`,
            timestamp: new Date(),
          }],
          isTyping: false,
        }));
      }
    },

    executeAction: async (command: string, params: Record<string, unknown>) => {
      await get().sendMessage(`/${command} ${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(' ')}`);
    },

    dismissRecommendation: (id: string) => {
      set(state => ({
        recommendations: state.recommendations.filter(r => r.id !== id),
      }));
    },

    fetchRecommendations: async () => {
      set({ isRecommendationLoading: true });
      try {
        const userId = localStorage.getItem('user_id') || 'anonymous';
        const pageContext = get().pageContext;
        // TODO: 调用 POST /api/chatops/recommendations
        // const response = await fetchRecommendationsAPI({ userId, context: pageContext });
        // set({ recommendations: response.data.recommendations });
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
      } finally {
        set({ isRecommendationLoading: false });
      }
    },

    setUnreadAlerts: (count: number) => set({ unreadAlerts: count }),
    setAlertLevel: (level) => set({ alertLevel: level }),
    setPageContext: (ctx) => set({ pageContext: ctx }),

    loadMoreMessages: async () => {
      const state = get();
      if (state.isLoadingMore || !state.hasMoreMessages) return;
      set({ isLoadingMore: true });
      try {
        // TODO: 调用 GET /api/chatops/sessions/:id/messages?cursor=...
      } finally {
        set({ isLoadingMore: false });
      }
    },

    trimOldMessages: (maxCount: number) => {
      set(state => ({
        messages: state.messages.slice(-maxCount),
      }));
    },

    setMemoryCheckEnabled: (enabled) => set({ memoryCheckEnabled: enabled }),
  }))
);

// 辅助: 从执行结果提取操作按钮
function extractActionsFromResult(result: any): ChatMessage['actions'] {
  if (!result) return undefined;
  if (result.actions) return result.actions;
  // 默认: 根据命令类型提供通用操作
  return [
    { label: '查看详情', command: 'status', params: {} },
  ];
}

// ---- 初始化: 加载命令列表 ----
(async () => {
  try {
    const { data } = await getCommands();
    const commands = data.data || [];
    // 注册 schema 到 parser
    commands.forEach((cmd: any) => {
      parser.registerSchema(cmd.name, cmd.schema || {});
    });
    useChatOpsStore.setState({ commands });
  } catch (err) {
    console.error('Failed to load chatops commands:', err);
  }
})();
```

---

### F-9: 通知偏好设置 UI

**新建文件**: `orion-frontend/src/components/ChatOps/NotificationPreferences.tsx`

**代码骨架**:

```tsx
import React, { useState, useEffect } from 'react';
import { Table, Switch, Button, message as antdMessage, Space } from 'antd';
import { colors } from '@/tokens/colors';

const LEVELS = [
  { key: 'critical', label: 'Critical', color: colors.error[400] },
  { key: 'warning', label: 'Warning', color: colors.warning[500] },
  { key: 'info', label: 'Info', color: colors.info[500] },
];

export const NotificationPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState<Record<string, { chatops: boolean; email: boolean }>>({
    critical: { chatops: true, email: false },
    warning: { chatops: true, email: false },
    info: { chatops: false, email: false },
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: 调用 PUT /api/chatops/settings/notification-preferences
      antdMessage.success('保存成功');
    } catch (err) {
      antdMessage.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '告警级别',
      dataIndex: 'level',
      render: (_: any, record: any) => (
        <span style={{ color: record.color, fontWeight: 600 }}>{record.label}</span>
      ),
    },
    {
      title: 'ChatOps',
      dataIndex: 'chatops',
      render: (val: boolean, record: any) => (
        <Switch
          checked={val}
          onChange={(checked) => setPreferences(prev => ({
            ...prev,
            [record.key]: { ...prev[record.key], chatops: checked },
          }))}
        />
      ),
    },
    {
      title: '邮件',
      dataIndex: 'email',
      render: (val: boolean, record: any) => (
        <Switch
          checked={val}
          onChange={(checked) => setPreferences(prev => ({
            ...prev,
            [record.key]: { ...prev[record.key], email: checked },
          }))}
        />
      ),
    },
  ];

  return (
    <div>
      <Table
        columns={columns}
        dataSource={LEVELS.map(l => ({ ...l, ...preferences[l.key] }))}
        pagination={false}
        rowKey="key"
      />
      <Space style={{ marginTop: 16 }}>
        <Button type="primary" loading={saving} onClick={handleSave}>保存</Button>
        <Button onClick={() => setPreferences({
          critical: { chatops: true, email: false },
          warning: { chatops: true, email: false },
          info: { chatops: false, email: false },
        })}>重置默认</Button>
      </Space>
    </div>
  );
};
```

**挂载**: 可作为 Chat 面板设置 Drawer 的 Tab，也可以集成到现有 `/console/chatops/settings` 页面。

---

### F-10: DND 设置 UI

**新建文件**: `orion-frontend/src/components/ChatOps/DNDSettings.tsx`

**代码骨架**:

```tsx
import React, { useState, useEffect } from 'react';
import { Switch, TimePicker, Checkbox, Button, message as antdMessage, Space, Typography } from 'antd';
import { MoonOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';

const DAYS = [
  { value: 1, label: '周一' }, { value: 2, label: '周二' }, { value: 3, label: '周三' },
  { value: 4, label: '周四' }, { value: 5, label: '周五' }, { value: 6, label: '周六' }, { value: 7, label: '周日' },
];

export const DNDSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [startTime, setStartTime] = useState('22:00');
  const [endTime, setEndTime] = useState('08:00');
  const [repeatDays, setRepeatDays] = useState([1, 2, 3, 4, 5]);
  const [allowCritical, setAllowCritical] = useState(true);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Switch checked={enabled} onChange={setEnabled} checkedChildren="开" unCheckedChildren="关" />
        <MoonOutlined style={{ fontSize: 18, color: enabled ? colors.purple[500] : colors.light.text.disabled }} />
        <Typography.Text>免打扰模式</Typography.Text>
      </div>

      {enabled && (
        <>
          <Space>
            <span>时段:</span>
            <TimePicker value={moment(startTime, 'HH:mm')} onChange={(_, s) => setStartTime(s)} format="HH:mm" />
            <span>至</span>
            <TimePicker value={moment(endTime, 'HH:mm')} onChange={(_, s) => setEndTime(s)} format="HH:mm" />
          </Space>

          <div>
            <span>重复:</span>
            <Checkbox.Group
              options={DAYS.map(d => ({ label: d.label, value: d.value }))}
              value={repeatDays}
              onChange={(vals) => setRepeatDays(vals as number[])}
            />
          </div>

          <Switch
            checked={allowCritical}
            onChange={setAllowCritical}
            checkedChildren="允许 Critical"
            unCheckedChildren="全部免打扰"
          />
        </>
      )}

      <Button type="primary" onClick={() => { /* TODO: 保存 */ }}>
        保存设置
      </Button>
    </Space>
  );
};
```

---

### F-11: 已读/未读状态交互

**集成点**: 与 `chatOpsStore` + `ChatTrigger` 配合。

**逻辑**:

```typescript
// 在 chatOpsStore 中添加
async markAlertAsRead(alertId: string): Promise<void> {
  // TODO: POST /api/chatops/alerts/:id/read
  set(state => ({
    unreadAlerts: Math.max(0, state.unreadAlerts - 1),
  }));
}

async markAlertAsAcknowledged(alertId: string): Promise<void> {
  // TODO: POST /api/chatops/alerts/:id/acknowledge
  // 从推荐面板移除
  set(state => ({
    recommendations: state.recommendations.filter(r => r.id !== alertId),
    unreadAlerts: Math.max(0, state.unreadAlerts - 1),
  }));
}

// 在 SmartRecommend 卡片中:
// - 点击操作按钮 → 自动调用 markAlertAsAcknowledged
// - 点击 × 按钮 → 调用 markAlertAsDismissed
// - 打开面板 (ChatPanel mount) → 批量调用 markAlertAsRead

// 在 ChatTrigger 中:
// - 徽标数字 = unreadAlerts
// - alertLevel 根据最高级别确定
```

---

### F-12: 虚拟滚动集成

**使用已有的**: `orion-frontend/src/components/VirtualList/index.tsx`

**集成方式**: 在 `MessageArea` 中使用 `VirtualList` 渲染消息列表。

```tsx
// orion-frontend/src/components/ChatOps/MessageArea.tsx
import React, { useRef } from 'react';
import { VirtualList } from '@/components/VirtualList';
import { ChatMessage } from './ChatMessage';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import { colors } from '@/tokens/colors';

export const MessageArea: React.FC = () => {
  const { messages } = useChatOpsStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const virtualItems = messages.map((msg, i) => ({
    id: msg.id,
    data: msg,
  }));

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        background: colors.light.bg.secondary,
      }}
    >
      <VirtualList
        items={virtualItems}
        containerHeight={600}  // 实际使用动态高度
        itemHeight={80}
        overscanCount={5}
        renderItem={(item) => <ChatMessage message={item.data} />}
        emptyText="暂无对话，输入命令开始"
      />
    </div>
  );
};
```

**注意**: 现有 `VirtualList` 使用固定 `containerHeight`，在 ChatPanel 中需要使用 `ResizeObserver` 或 CSS `calc()` 动态计算可用高度。

---

### F-13: 浏览器内存监控

**集成位置**: `ChatPanel/index.tsx` 的 `useEffect` 中

**代码**:

```typescript
// 添加到 ChatPanel 或创建独立 hook: useMemoryMonitor.ts
useEffect(() => {
  if (!get().memoryCheckEnabled) return;

  const interval = setInterval(() => {
    const perf = performance as any;
    if (perf.memory && perf.memory.usedJSHeapSize) {
      const heapUsedMB = perf.memory.usedJSHeapSize / 1024 / 1024;
      if (heapUsedMB > 100) {
        // 超过 100MB → 保留最近 200 条
        useChatOpsStore.getState().trimOldMessages(200);
        console.warn(`[ChatOps] Memory cleanup: ${heapUsedMB.toFixed(1)}MB > 100MB, trimmed to 200 messages`);
      }
    }
  }, 30000); // 每 30 秒检查

  return () => clearInterval(interval);
}, []);
```

**注意**: `performance.memory` 仅在 Chrome/Edge 中可用。其他浏览器此功能静默跳过。

---

### F-14: 分页加载 (向上滚动拉历史)

**集成位置**: `MessageArea.tsx` 中处理滚动事件

**代码**:

```typescript
// 在 MessageArea 中，当滚动到顶部时触发
const handleScroll = useCallback((scrollTop: number) => {
  if (scrollTop < 10) {
    useChatOpsStore.getState().loadMoreMessages();
  }
}, []);

// 在 chatOpsStore.loadMoreMessages 中:
// 1. 检查 messages.length >= 500 → 不再加载
// 2. 取最旧消息的 created_at 作为 cursor
// 3. 调用 GET /api/chatops/sessions/:id/messages?cursor=xxx&limit=50
// 4. 将结果 prepend 到 messages 数组

async loadMoreMessages: async () => {
  const state = get();
  if (state.isLoadingMore || !state.hasMoreMessages || state.messages.length >= 500) return;

  set({ isLoadingMore: true });
  try {
    const cursor = state.nextCursor;
    // TODO: const response = await fetch(`/api/chatops/sessions/${state.sessionId}/messages?limit=50&cursor=${cursor}`);
    // const data = response.data;
    // set(state => ({
    //   messages: [...data.data, ...state.messages],
    //   hasMoreMessages: data.hasMore,
    //   nextCursor: data.nextCursor,
    // }));
  } finally {
    set({ isLoadingMore: false });
  }
},
```

**500 条限制**: `chatOpsStore.sendMessage` 中已有 `.slice(-500)` 保护。`loadMoreMessages` 中也检查 `messages.length >= 500` 阻止加载更多。

---

## 附录: API 路由总览 (Phase 1a 完成后的完整路由表)

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/chatops/commands` | 可用命令列表 | 已有，需增强 |
| GET | `/api/chatops/commands/:name/help` | 命令帮助 | 已有 |
| POST | `/api/chatops/execute` | 执行命令 + 幂等性 | 需增强 |
| GET | `/api/chatops/status/:commandId` | 执行状态 | 已有 |
| POST | `/api/chatops/message` | 接收 IM 消息 | 已有 |
| GET | `/api/chatops/audit/logs` | 审计日志 | 已有 |
| GET | `/api/chatops/audit/stats` | 审计统计 | 已有 |
| POST | `/api/chatops/audit/export` | 审计导出 | 已有 |
| **POST** | **`/api/chatops/recommendations`** | **推荐面板聚合** | **新增** |
| **GET** | **`/api/chatops/sessions/:id/messages`** | **分页消息** | **新增** |
| **GET** | **`/api/chatops/stream/recommendations`** | **SSE 推荐流** | **新增** |
| GET | `/api/chatops/settings/notification-preferences` | 通知偏好列表 | 新增 |
| PUT | `/api/chatops/settings/notification-preferences` | 更新通知偏好 | 新增 |
| DELETE | `/api/chatops/settings/notification-preferences/:id` | 删除通知偏好 | 新增 |
| GET | `/api/chatops/settings/dnd` | DND 设置 | 新增 |
| PUT | `/api/chatops/settings/dnd` | 更新 DND 设置 | 新增 |
| PATCH | `/api/chatops/settings/dnd/toggle` | 切换 DND | 新增 |
| GET | `/api/chatops/alerts/states` | 告警状态列表 | 新增 |
| POST | `/api/chatops/alerts/:id/read` | 标记已读 | 新增 |
| POST | `/api/chatops/alerts/:id/acknowledge` | 标记已确认 | 新增 |
| POST | `/api/chatops/alerts/:id/dismiss` | 标记已忽略 | 新增 |
| POST | `/api/chatops/alerts/batch-read` | 批量已读 | 新增 |

---

## 附录: 新建/修改文件清单

### 后端新建文件 (8 个)

| 文件 | 对应任务 |
|------|---------|
| `orion-platform-service/src/db/migrations/055_create_chatops_phase1a_tables.sql` | DB-1, DB-2, B-12 |
| `orion-platform-service/src/db/migrations/055_rollback_chatops_phase1a_tables.sql` | 回滚迁移 055 |
| `orion-platform-service/src/services/chatops/InputValidator.ts` | B-2 |
| `orion-platform-service/src/services/chatops/PermissionService.ts` | B-3 |
| `orion-platform-service/src/services/chatops/CommandRouter.ts` | B-4 |
| `orion-platform-service/src/services/chatops/RecommendationService.ts` | B-5 |
| `orion-platform-service/src/services/chatops/EventSubscriber.ts` | B-8, B-15 |
| `orion-platform-service/src/services/chatops/IdempotencyService.ts` | B-1, B-14 |
| `orion-platform-service/src/services/chatops/NotificationPreferenceService.ts` | B-9 |
| `orion-platform-service/src/services/chatops/DNDService.ts` | B-10 |
| `orion-platform-service/src/services/chatops/AlertStateService.ts` | B-11 |

### 后端修改文件 (5 个)

| 文件 | 变更 |
|------|------|
| `orion-platform-service/src/api/chatops-routes.ts` | 新增 10+ 路由 |
| `orion-platform-service/src/api/controllers/ChatOpsController.ts` | 新增 8+ 方法，修改 2 方法 |
| `orion-platform-service/src/services/chatops/ExecutionService.ts` | 添加 CommandRouter 调用、消息写入 |
| `orion-platform-service/src/repositories/ChatOpsRepository.ts` | 新增 4 个 Repository 类 |
| `orion-platform-service/src/models/ChatOps.ts` | 新增消息/偏好/状态等模型 |

### 前端新建文件 (12 个)

| 文件 | 对应任务 |
|------|---------|
| `orion-frontend/src/stores/chatOpsStore.ts` | F-8 |
| `orion-frontend/src/components/ChatOps/ChatTrigger.tsx` | F-1 |
| `orion-frontend/src/components/ChatOps/ChatPanel/index.tsx` | F-2 |
| `orion-frontend/src/components/ChatOps/SmartRecommend.tsx` | F-3 |
| `orion-frontend/src/components/ChatOps/ChatInput.tsx` | F-4 |
| `orion-frontend/src/components/ChatOps/CommandParser.ts` | F-5 |
| `orion-frontend/src/components/ChatOps/ChatMessage.tsx` | F-6 |
| `orion-frontend/src/components/ChatOps/ActionCard.tsx` | F-6 |
| `orion-frontend/src/components/ChatOps/MessageArea.tsx` | F-7 |
| `orion-frontend/src/components/ChatOps/NotificationPreferences.tsx` | F-9 |
| `orion-frontend/src/components/ChatOps/DNDSettings.tsx` | F-10 |
| `orion-frontend/src/components/ChatOps/hooks/useAutoScroll.ts` | F-7 |
| `orion-frontend/src/components/ChatOps/hooks/useCommandSuggestions.ts` | F-4 |
| `orion-frontend/src/components/ChatOps/hooks/useMemoryMonitor.ts` | F-13 |

### 前端修改文件 (3 个)

| 文件 | 变更 |
|------|------|
| `orion-frontend/src/components/Layout/index.tsx` | 添加 ChatTrigger + ChatPanel |
| `orion-frontend/src/api/chatops.ts` | 新增 API 函数 |
| `orion-frontend/src/router/routes.ts` | 注册 ChatOps 子路由 (已有) |
