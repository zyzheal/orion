# AI 安全监控完整功能设计

> **日期**: 2026-05-22
> **状态**: 设计中
> **能力域**: AI 安全监控
> **迁移编号**: 189
> **新建表**: `ai_security_rules`, `ai_security_events`
> **已有表**: `llm_traces` (080), `security_scans` (079)
> **前端入口**: `/ai/security` (AISecurity 页面已存在，需增强)

---

## 一、业务闭环

### 1.1 完整流程

```
安全规则定义 → AI 请求拦截 → 实时规则匹配 → 事件检测 → 告警通知 → 自动/手动处置 → 效果追踪
```

### 1.2 流程分解

| 阶段 | 触发条件 | 处理组件 | 输出 |
|------|---------|---------|------|
| **规则定义** | 管理员创建/编辑规则 | `AISecurityRuleService` | 规则入库 `ai_security_rules` |
| **请求拦截** | LLM 请求经 AI Gateway | `SecurityMiddleware` | 请求副本送规则引擎 |
| **实时扫描** | 规则引擎匹配 | `RuleMatchingEngine` | 匹配结果 + 风险分数 |
| **异步深析** | 风险分数 > 70 | `DeepAnalysisWorker` | 语义分析 + 分类标签 |
| **事件检测** | 匹配成功 / 深析确认 | `EventDetector` | 安全事件入库 `ai_security_events` |
| **关联分析** | 多个低级别事件聚合 | `EventCorrelator` | 高级别威胁事件 |
| **自动处置** | 事件严重级别 >= high | `AutoDisposalEngine` | 拦截 / 告警 / 限流 / 封禁 |
| **告警通知** | 事件产生 | `AlertNotifier` | SSE / Webhook / 邮件 |
| **效果追踪** | 处置后观察期 | `EffectTracker` | 误报率 / 漏报率统计 |

### 1.3 与现有模块集成点

| 现有模块 | 集成方式 | 说明 |
|---------|---------|------|
| `llm_traces` (080) | 事件关联 `trace_id` | 安全事件可回溯到具体 LLM 调用 |
| `security_scans` (079) | 共享 `security_findings` 模式 | 安全事件复用 findings 结构 |
| `AISecurityService` | 扩展四层防护 | 在现有 input/output/sandbox/audit 之上增加规则引擎 |
| AI Gateway | 中间件拦截 | 在 AIGateway 请求管道中插入安全检查 |
| Alert 系统 | 告警通知 | 复用现有 alert routes 发送通知 |

---

## 二、AI 安全规则类型

### 2.1 规则分类体系

```
AI Security Rules
├── prompt_injection        # Prompt 注入检测
│   ├── keyword_match       # 关键字模式匹配
│   ├── semantic_analysis   # 语义相似度分析
│   └── structure_detection # 结构化注入检测
├── data_leakage           # 数据泄露防护
│   ├── pii_detection      # PII 识别（身份证、手机号、邮箱）
│   ├── sensitive_data     # 敏感信息外发检测
│   └── api_key_leak       # API Key 泄露检测
├── token_abuse            # Token 用量异常
│   ├── quota_exceeded     # 超额调用
│   ├── off_hours_call     # 异常时间段调用
│   └── burst_detection    # 突发高频调用
├── model_abuse            # 模型滥用检测
│   ├── jailbreak_attempt  # 越狱尝试
│   ├── adversarial_attack # 对抗性攻击
│   └── prompt_leak        # 系统提示泄露
└── content_safety         # 内容安全
    ├── output_compliance  # 输出合规性检查
    ├── toxic_content      # 有毒内容检测
    └── policy_violation   # 策略违规检测
```

### 2.2 规则类型与严重级别映射

| 规则类型 | 默认严重级别 | 可升级条件 |
|---------|------------|-----------|
| `keyword_match` | medium | 匹配到高危关键词 → critical |
| `semantic_analysis` | high | 语义相似度 > 0.95 → critical |
| `structure_detection` | high | 多层嵌套注入 → critical |
| `pii_detection` | high | 身份证号码/银行卡 → critical |
| `sensitive_data` | medium | 包含密码/密钥 → critical |
| `api_key_leak` | high | 活跃 Key → critical |
| `quota_exceeded` | medium | 超过配额 200% → high |
| `off_hours_call` | low | 结合其他异常 → medium |
| `burst_detection` | medium | QPS > 阈值 10 倍 → high |
| `jailbreak_attempt` | high | 确认越狱 → critical |
| `adversarial_attack` | high | 持续攻击 → critical |
| `prompt_leak` | critical | 不可升级 |
| `output_compliance` | medium | 涉及合规红线 → high |
| `toxic_content` | medium | 仇恨/暴力内容 → high |
| `policy_violation` | medium | 多次违规 → high |

---

## 三、数据库设计

### 3.1 ai_security_rules 表

```sql
-- Migration 189: AI 安全规则表
-- 存储 AI 安全检测规则定义

CREATE TABLE IF NOT EXISTS ai_security_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- 规则标识
    rule_code       VARCHAR(50) NOT NULL,             -- 规则唯一编码，如 'PROMPT_INJECTION_001'
    name            VARCHAR(200) NOT NULL,             -- 规则名称
    description     TEXT,                              -- 规则描述
    category        VARCHAR(30) NOT NULL,              -- 分类：prompt_injection/data_leakage/token_abuse/model_abuse/content_safety
    rule_type       VARCHAR(30) NOT NULL,              -- 类型：keyword_match/semantic_analysis/...

    -- 匹配配置
    pattern         TEXT,                              -- 正则表达式/JSON 匹配配置
    threshold       DECIMAL(5,2),                      -- 阈值（用于语义分析等场景）
    config          JSONB DEFAULT '{}',                -- 规则扩展配置

    -- 严重级别与动作
    severity        VARCHAR(20) NOT NULL DEFAULT 'medium',  -- low/medium/high/critical
    action          VARCHAR(30) NOT NULL DEFAULT 'block',   -- block/warn/log/rate_limit/ban
    escalation      JSONB DEFAULT '{}',                -- 升级条件：{ trigger: 'score > 90', new_severity: 'critical' }

    -- 启用状态
    enabled         BOOLEAN NOT NULL DEFAULT true,
    priority        INT NOT NULL DEFAULT 100,           -- 优先级，数值越小越先执行

    -- 统计信息
    match_count     BIGINT NOT NULL DEFAULT 0,          -- 累计匹配次数
    false_positive_count BIGINT NOT NULL DEFAULT 0,     -- 误报次数
    last_matched_at TIMESTAMPTZ,                        -- 最后匹配时间

    -- 审计字段
    created_by      VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(100),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE(tenant_id, rule_code)
);

CREATE INDEX idx_ai_rules_tenant ON ai_security_rules(tenant_id);
CREATE INDEX idx_ai_rules_category ON ai_security_rules(tenant_id, category);
CREATE INDEX idx_ai_rules_enabled ON ai_security_rules(tenant_id, enabled);
CREATE INDEX idx_ai_rules_priority ON ai_security_rules(tenant_id, priority);

-- CHECK 约束
ALTER TABLE ai_security_rules ADD CONSTRAINT chk_ai_rules_category
    CHECK (category IN ('prompt_injection', 'data_leakage', 'token_abuse', 'model_abuse', 'content_safety'));
ALTER TABLE ai_security_rules ADD CONSTRAINT chk_ai_rules_rule_type
    CHECK (rule_type IN (
        'keyword_match', 'semantic_analysis', 'structure_detection',
        'pii_detection', 'sensitive_data', 'api_key_leak',
        'quota_exceeded', 'off_hours_call', 'burst_detection',
        'jailbreak_attempt', 'adversarial_attack', 'prompt_leak',
        'output_compliance', 'toxic_content', 'policy_violation'
    ));
ALTER TABLE ai_security_rules ADD CONSTRAINT chk_ai_rules_severity
    CHECK (severity IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE ai_security_rules ADD CONSTRAINT chk_ai_rules_action
    CHECK (action IN ('block', 'warn', 'log', 'rate_limit', 'ban'));

-- RLS
ALTER TABLE ai_security_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ai_security_rules ON ai_security_rules
    USING (tenant_id = current_setting('app.current_tenant')::UUID);

COMMENT ON TABLE ai_security_rules IS 'AI 安全检测规则定义';
```

### 3.2 ai_security_events 表

```sql
-- Migration 189: AI 安全事件表
-- 存储 AI 安全检测产生的事件

CREATE TABLE IF NOT EXISTS ai_security_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- 事件关联
    trace_id        VARCHAR(64),                       -- 关联 llm_traces.trace_id
    scan_id         VARCHAR(64),                       -- 关联 security_scans.id
    rule_id         UUID REFERENCES ai_security_rules(id) ON DELETE SET NULL,
    rule_code       VARCHAR(50),                       -- 规则编码快照

    -- 事件内容
    event_type      VARCHAR(50) NOT NULL,              -- prompt_injection/data_leakage/token_abuse/model_abuse/content_safety
    severity        VARCHAR(20) NOT NULL,              -- low/medium/high/critical
    status          VARCHAR(20) NOT NULL DEFAULT 'open', -- open/acknowledged/resolved/false_positive/escalated

    -- 检测详情
    risk_score      DECIMAL(5,2) NOT NULL DEFAULT 0,   -- 风险分数 0-100
    matched_content TEXT,                              -- 匹配到的内容片段
    input_sample    TEXT,                              -- 输入样本（脱敏后）
    output_sample   TEXT,                              -- 输出样本（脱敏后）

    -- 上下文
    user_id         VARCHAR(100),                      -- 触发用户
    model_id        VARCHAR(100),                      -- 使用的模型
    scenario_id     VARCHAR(100),                      -- 业务场景
    source_ip       VARCHAR(45),                       -- 来源 IP
    request_id      VARCHAR(64),                       -- 请求唯一 ID

    -- 处置信息
    action_taken    VARCHAR(30),                       -- block/warn/log/rate_limit/ban
    auto_disposed   BOOLEAN NOT NULL DEFAULT false,    -- 是否自动处置
    disposed_by     VARCHAR(100),                      -- 处置人
    disposed_at     TIMESTAMPTZ,                       -- 处置时间
    disposal_note   TEXT,                              -- 处置备注

    -- 关联分析
    correlation_id  UUID,                              -- 关联事件组 ID
    correlated_event_count INT DEFAULT 0,              -- 关联事件数
    threat_level    VARCHAR(20),                       -- 综合威胁级别：low/medium/high/critical

    -- 统计
    occurrence_count INT NOT NULL DEFAULT 1,            -- 同类事件出现次数

    -- 审计字段
    created_by      VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(100),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE(tenant_id, request_id, rule_id)
);

CREATE INDEX idx_ai_events_tenant ON ai_security_events(tenant_id);
CREATE INDEX idx_ai_events_trace ON ai_security_events(tenant_id, trace_id);
CREATE INDEX idx_ai_events_rule ON ai_security_events(tenant_id, rule_id);
CREATE INDEX idx_ai_events_severity ON ai_security_events(tenant_id, severity);
CREATE INDEX idx_ai_events_status ON ai_security_events(tenant_id, status);
CREATE INDEX idx_ai_events_created ON ai_security_events(tenant_id, created_at DESC);
CREATE INDEX idx_ai_events_correlation ON ai_security_events(tenant_id, correlation_id);
CREATE INDEX idx_ai_events_user ON ai_security_events(tenant_id, user_id);
CREATE INDEX idx_ai_events_type_severity ON ai_security_events(tenant_id, event_type, severity);

-- CHECK 约束
ALTER TABLE ai_security_events ADD CONSTRAINT chk_ai_events_event_type
    CHECK (event_type IN ('prompt_injection', 'data_leakage', 'token_abuse', 'model_abuse', 'content_safety'));
ALTER TABLE ai_security_events ADD CONSTRAINT chk_ai_events_severity
    CHECK (severity IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE ai_security_events ADD CONSTRAINT chk_ai_events_status
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'false_positive', 'escalated'));
ALTER TABLE ai_security_events ADD CONSTRAINT chk_ai_events_action
    CHECK (action_taken IN ('block', 'warn', 'log', 'rate_limit', 'ban', NULL));
ALTER TABLE ai_security_events ADD CONSTRAINT chk_ai_events_threat_level
    CHECK (threat_level IN ('low', 'medium', 'high', 'critical', NULL));

-- RLS
ALTER TABLE ai_security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ai_security_events ON ai_security_events
    USING (tenant_id = current_setting('app.current_tenant')::UUID);

COMMENT ON TABLE ai_security_events IS 'AI 安全检测事件记录';
```

---

## 四、实时扫描架构

### 4.1 请求拦截中间件

```typescript
// orion-platform-service/src/api/middleware/ai-security-middleware.ts

/**
 * AI 安全请求拦截中间件
 * 挂载位置：AI Gateway 请求管道，在 LLM 调用之前
 */
export async function aiSecurityMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  next: FastifyNext
): Promise<void> {
  // 1. 提取请求信息
  const payload = extractPayload(request);
  const userId = request.headers['x-user-id'] as string;
  const requestId = request.id;

  // 2. 加载租户生效的规则（按优先级排序）
  const rules = await ruleService.getActiveRules(tenantId);

  // 3. 同步快速匹配（正则/关键字，< 50ms）
  const quickResult = await quickMatchEngine.execute(payload, rules);
  if (quickResult.blocked) {
    // 立即拦截，写入事件
    await eventService.createEvent({ ...quickResult, requestId, userId });
    reply.code(403).send({ error: 'Request blocked by AI security policy' });
    return;
  }

  // 4. 异步深度分析（语义分析，不阻塞请求）
  if (quickResult.riskScore > 30) {
    await deepAnalysisWorker.enqueue({ payload, rules, requestId, userId, tenantId });
  }

  // 5. 记录 trace 关联
  request.headers['x-ai-security-check'] = 'passed';

  next();
}
```

### 4.2 规则匹配引擎

```typescript
// orion-platform-service/src/services/ai-security/RuleMatchingEngine.ts

/**
 * 规则匹配引擎
 * 按优先级顺序执行规则，支持短路
 */
export class RuleMatchingEngine {
  async execute(
    payload: { prompt: string; output?: string; metadata: Record<string, any> },
    rules: AISecurityRule[]
  ): Promise<{ blocked: boolean; riskScore: number; matchedRules: RuleMatch[] }> {
    let riskScore = 0;
    const matchedRules: RuleMatch[] = [];

    for (const rule of rules.sort((a, b) => a.priority - b.priority)) {
      const result = await this.matchRule(rule, payload);
      if (result.matched) {
        matchedRules.push(result);
        riskScore += result.score;

        // 阻断级别立即返回
        if (rule.action === 'block' && result.score >= rule.threshold!) {
          return { blocked: true, riskScore, matchedRules };
        }
      }
    }

    return { blocked: false, riskScore, matchedRules };
  }

  private async matchRule(
    rule: AISecurityRule,
    payload: { prompt: string; output?: string }
  ): Promise<RuleMatch> {
    switch (rule.rule_type) {
      case 'keyword_match':
        return this.keywordMatch(rule, payload);
      case 'semantic_analysis':
        return this.semanticAnalysis(rule, payload);
      case 'pii_detection':
        return this.piiDetection(rule, payload);
      case 'jailbreak_attempt':
        return this.jailbreakDetection(rule, payload);
      // ... 其他规则类型
      default:
        return { matched: false, score: 0 };
    }
  }
}
```

### 4.3 异步深度分析

```typescript
// orion-platform-service/src/services/ai-security/DeepAnalysisWorker.ts

/**
 * 异步深度分析 Worker
 * 处理复杂语义分析，不阻塞主请求
 */
export class DeepAnalysisWorker {
  private queue: AnalysisTask[] = [];
  private processing = false;

  async enqueue(task: AnalysisTask): Promise<void> {
    this.queue.push(task);
    if (!this.processing) {
      this.processing = true;
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;

      // 1. 语义相似度分析（与已知攻击模式对比）
      const semanticResult = await this.semanticCompare(task.payload);

      // 2. 越狱模式检测
      const jailbreakResult = await this.detectJailbreak(task.payload);

      // 3. 对抗性攻击检测
      const adversarialResult = await this.detectAdversarial(task.payload);

      // 4. 综合评分
      const finalScore = this.aggregateScores([semanticResult, jailbreakResult, adversarialResult]);

      // 5. 超过阈值则产生事件
      if (finalScore >= 70) {
        await this.eventService.createEvent({
          ...task,
          riskScore: finalScore,
          autoDisposal: finalScore >= 90,  // >= 90 自动处置
        });
      }

      // 更新 llm_traces 安全标记
      await this.updateTraceSecurityFlag(task.traceId, {
        securityChecked: true,
        riskScore: finalScore,
      });
    }
    this.processing = false;
  }
}
```

---

## 五、安全事件管理

### 5.1 事件分类与严重级别

| 严重级别 | 响应时间 | 处置方式 | 通知渠道 |
|---------|---------|---------|---------|
| **critical** | < 1 分钟 | 自动拦截 + 封禁 + 告警 | SSE + Webhook + 邮件 + 短信 |
| **high** | < 5 分钟 | 自动拦截 + 告警 | SSE + Webhook + 邮件 |
| **medium** | < 30 分钟 | 记录 + 告警 | SSE + 邮件 |
| **low** | 24 小时内 | 记录 | 仪表盘统计 |

### 5.2 事件关联分析

```typescript
// orion-platform-service/src/services/ai-security/EventCorrelator.ts

/**
 * 事件关联分析器
 * 将多个低级别事件组合成高级别威胁
 */
export class EventCorrelator {
  // 关联规则
  private correlationRules: CorrelationRule[] = [
    {
      name: '持续注入攻击',
      condition: { event_type: 'prompt_injection', count: 5, window: '5m', same_user: true },
      upgrade_to: 'high',
    },
    {
      name: '多类型组合攻击',
      condition: { event_types: ['prompt_injection', 'data_leakage'], count: 2, window: '10m', same_user: true },
      upgrade_to: 'critical',
    },
    {
      name: '异常 Token 消耗',
      condition: { event_type: 'token_abuse', count: 3, window: '1h', same_user: true },
      upgrade_to: 'high',
    },
    {
      name: '越狱 + 数据泄露',
      condition: { event_types: ['model_abuse', 'data_leakage'], count: 1, window: '5m', same_user: true },
      upgrade_to: 'critical',
    },
  ];

  async correlate(event: AISecurityEvent): Promise<CorrelationResult> {
    for (const rule of this.correlationRules) {
      const relatedEvents = await this.findRelatedEvents(event, rule.condition);
      if (relatedEvents.length >= rule.condition.count) {
        return {
          correlated: true,
          correlationId: this.createCorrelationGroup(relatedEvents),
          threatLevel: rule.upgrade_to,
          relatedCount: relatedEvents.length,
        };
      }
    }
    return { correlated: false };
  }
}
```

### 5.3 自动处置引擎

| 处置动作 | 触发条件 | 具体行为 |
|---------|---------|---------|
| **block** | 单规则匹配且 severity >= high | 返回 403，拒绝 LLM 请求 |
| **warn** | 单规则匹配且 severity = medium | 请求放行，添加警告标记 |
| **log** | severity = low | 仅记录事件，不干预 |
| **rate_limit** | 1 小时内同一用户触发 3+ 次 medium 事件 | 限制该用户 AI 调用频率为 1 次/分钟 |
| **ban** | severity = critical 或 关联升级为 critical | 封禁用户 AI 调用权限 24 小时 |

---

## 六、外部依赖

| 依赖 | 类型 | 用途 | 是否强依赖 |
|------|------|------|-----------|
| `llm_traces` 表 | 内部数据库 | 安全事件关联 LLM 调用链 | 否（trace_id 可为空） |
| `security_scans` 表 | 内部数据库 | 安全扫描结果关联 | 否 |
| AI Gateway | 内部服务 | 请求拦截点 | 是 |
| Alert 系统 | 内部服务 | 告警通知 | 否（降级为日志） |
| Redis | 外部中间件 | 限流计数器 + 封禁缓存 | 否（降级为内存） |
| 攻击模式库 | 外部数据源 | 已知攻击签名库（定期更新） | 否 |

---

## 七、权限模型

| 角色 | 规则管理 | 事件查看 | 事件处置 | 仪表盘 | 导出 |
|------|---------|---------|---------|-------|------|
| **admin** | 创建/编辑/删除 | 全部租户 | 全部操作 | 完整 | 全部格式 |
| **security_admin** | 创建/编辑 | 全部租户 | 确认/解决/标记误报 | 完整 | 全部格式 |
| **member** | 查看 | 本租户 | 无 | 受限 | 无 |
| **viewer** | 查看 | 本租户 | 无 | 只读 | 无 |

**权限资源**: `ai-security-rules`, `ai-security-events`, `ai-security-dashboard`
**权限动作**: `read`, `create`, `update`, `delete`, `disposal`, `export`

---

## 八、API 设计

### 8.1 安全规则 API

```
Base: /api/v1/ai-security/rules
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| `GET` | `/` | 获取规则列表 | query: category, enabled, page, limit | `{ data: SecurityRule[], total }` |
| `GET` | `/categories` | 获取规则分类列表 | - | `{ data: CategoryInfo[] }` |
| `GET` | `/:id` | 获取规则详情 | - | `{ ...SecurityRule, matchHistory }` |
| `POST` | `/` | 创建规则 | `RuleInput` | `{ id, rule_code, name }` |
| `PUT` | `/:id` | 更新规则 | `RuleInput` | `{ ...SecurityRule }` |
| `DELETE` | `/:id` | 软删除规则 | - | `{ success: true }` |
| `PATCH` | `/:id/toggle` | 启用/禁用规则 | `{ enabled: boolean }` | `{ id, enabled }` |
| `POST` | `/batch-toggle` | 批量启用/禁用 | `{ ids: string[], enabled: boolean }` | `{ updated: number }` |
| `GET` | `/stats` | 规则统计 | - | `{ total, enabled, byCategory, topMatched }` |
| `POST` | `/import` | 导入规则 | `RuleInput[]` | `{ imported, failed }` |
| `GET` | `/export` | 导出规则 | query: format | JSON/CSV |

**SecurityRule 结构**:

```typescript
interface SecurityRule {
  id: string;
  tenant_id: string;
  rule_code: string;
  name: string;
  description: string;
  category: RuleCategory;
  rule_type: RuleType;
  pattern: string | null;
  threshold: number | null;
  config: Record<string, unknown>;
  severity: Severity;
  action: RuleAction;
  escalation: Record<string, unknown>;
  enabled: boolean;
  priority: number;
  match_count: number;
  false_positive_count: number;
  last_matched_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

type RuleCategory = 'prompt_injection' | 'data_leakage' | 'token_abuse' | 'model_abuse' | 'content_safety';
type RuleType = 'keyword_match' | 'semantic_analysis' | 'structure_detection'
  | 'pii_detection' | 'sensitive_data' | 'api_key_leak'
  | 'quota_exceeded' | 'off_hours_call' | 'burst_detection'
  | 'jailbreak_attempt' | 'adversarial_attack' | 'prompt_leak'
  | 'output_compliance' | 'toxic_content' | 'policy_violation';
type Severity = 'low' | 'medium' | 'high' | 'critical';
type RuleAction = 'block' | 'warn' | 'log' | 'rate_limit' | 'ban';
```

### 8.2 安全事件 API

```
Base: /api/v1/ai-security/events
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| `GET` | `/` | 获取事件列表 | query 见下方 | `{ data: SecurityEvent[], total }` |
| `GET` | `/stats` | 事件统计 | query: days | `{ total, bySeverity, byType, trend }` |
| `GET` | `/stats/trend` | 事件趋势 | query: days, groupBy | `{ data: TrendPoint[] }` |
| `GET` | `/:id` | 事件详情 | - | `{ ...SecurityEvent, rule, trace }` |
| `PATCH` | `/:id/status` | 更新事件状态 | `{ status, note? }` | `{ id, status }` |
| `POST` | `/:id/dispose` | 处置事件 | `{ action, note }` | `{ id, action_taken, disposed_at }` |
| `POST` | `/batch-dispose` | 批量处置 | `{ ids, action, note }` | `{ processed: number }` |
| `POST` | `/:id/false-positive` | 标记误报 | `{ note? }` | `{ id, status: 'false_positive' }` |
| `GET` | `/correlations` | 关联事件组 | query: correlation_id | `{ group_id, events, threat_level }` |
| `GET` | `/export` | 导出事件 | query: format, filters | JSON/CSV |

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `event_type` | string | 事件类型过滤 |
| `severity` | string | 严重级别过滤 |
| `status` | string | 状态过滤 |
| `user_id` | string | 触发用户过滤 |
| `rule_id` | string | 关联规则过滤 |
| `from` | string | 起始时间 ISO |
| `to` | string | 结束时间 ISO |
| `page` | number | 页码 |
| `limit` | number | 每页条数 |

### 8.3 仪表盘 API

```
Base: /api/v1/ai-security/dashboard
```

| 方法 | 路径 | 描述 | 响应 |
|------|------|------|------|
| `GET` | `/overview` | 总览数据 | `{ rules, events, score, topTypes }` |
| `GET` | `/attack-trend` | 攻击趋势 | `{ data: TrendPoint[], byType }` |
| `GET` | `/user-risk` | 用户风险排行 | `{ data: UserRisk[] }` |
| `GET` | `/model-usage` | 模型安全评分 | `{ data: ModelScore[] }` |

### 8.4 路由注册

```typescript
// orion-platform-service/src/api/ai-security-routes.ts (新建)

import { FastifyInstance } from 'fastify';

export default async function aiSecurityRoutes(app: FastifyInstance) {
  // 规则管理
  app.get('/rules', getRulesHandler);
  app.get('/rules/categories', getRuleCategoriesHandler);
  app.get('/rules/:id', getRuleDetailHandler);
  app.post('/rules', createRuleHandler);
  app.put('/rules/:id', updateRuleHandler);
  app.delete('/rules/:id', deleteRuleHandler);
  app.patch('/rules/:id/toggle', toggleRuleHandler);
  app.post('/rules/batch-toggle', batchToggleRulesHandler);
  app.get('/rules/stats', getRuleStatsHandler);
  app.post('/rules/import', importRulesHandler);
  app.get('/rules/export', exportRulesHandler);

  // 事件管理
  app.get('/events', getEventsHandler);
  app.get('/events/stats', getEventStatsHandler);
  app.get('/events/stats/trend', getEventTrendHandler);
  app.get('/events/:id', getEventDetailHandler);
  app.patch('/events/:id/status', updateEventStatusHandler);
  app.post('/events/:id/dispose', disposeEventHandler);
  app.post('/events/batch-dispose', batchDisposeEventsHandler);
  app.post('/events/:id/false-positive', markFalsePositiveHandler);
  app.get('/events/correlations', getCorrelatedEventsHandler);
  app.get('/events/export', exportEventsHandler);

  // 仪表盘
  app.get('/dashboard/overview', getDashboardOverviewHandler);
  app.get('/dashboard/attack-trend', getAttackTrendHandler);
  app.get('/dashboard/user-risk', getUserRiskHandler);
  app.get('/dashboard/model-usage', getModelSecurityScoreHandler);
}
```

---

## 九、页面交互设计

### 9.1 页面清单

| 页面 | 路由 | 描述 |
|------|------|------|
| 安全仪表盘 | `/ai/security` | 总览、关键指标、攻击趋势 |
| 安全规则管理 | `/ai/security/rules` | 规则 CRUD、分类筛选、批量操作 |
| 安全事件列表 | `/ai/security/events` | 事件列表、筛选、批量处置 |
| 事件详情 | `/ai/security/events/:id` | 事件完整信息、处置操作、关联分析 |
| 攻击趋势分析 | `/ai/security/trends` | 趋势图表、类型分布、用户风险排行 |

> **注意**：现有 `/ai/security` 路由指向 `AISecurity/index.tsx`（策略管理页），需重构为仪表盘页，原策略管理功能迁移至 `/ai/security/rules`。

### 9.2 安全仪表盘 (`/ai/security`)

**功能**: 总览 AI 安全态势，展示关键指标与趋势。

**页面结构**:

```tsx
// orion-frontend/src/pages/AISecurity/Dashboard/index.tsx

const AISecurityDashboard: React.FC = () => {
  // === 数据加载 ===
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewRes, trendRes, userRiskRes] = await Promise.all([
        getDashboardOverview(),
        getAttackTrend({ days: 7 }),
        getUserRisk({ limit: 10 }),
      ]);
      setOverview(overviewRes.data.data);
    } catch (error: unknown) {
      message.error(`加载仪表盘失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <Title level={2} style={{ marginBottom: 8 }}>
        <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        AI 安全监控
      </Title>
      <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14, marginBottom: 16, display: 'block' }}>
        实时检测 AI 请求中的安全风险，提供规则管理与事件处置能力
      </Text>

      {/* 关键指标卡片 */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <MetricCard title="生效规则" value={overview?.rules.enabled} icon={<SafetyOutlined />} color={colors.success[500]} />
        </Col>
        <Col span={6}>
          <MetricCard title="今日事件" value={overview?.events.today} icon={<WarningOutlined />} color={colors.warning[500]} />
        </Col>
        <Col span={6}>
          <MetricCard title="安全评分" value={`${overview?.securityScore ?? 0}/100`} icon={<CheckCircleOutlined />} color={getScoreColor(overview?.securityScore ?? 0)} />
        </Col>
        <Col span={6}>
          <MetricCard title="已拦截请求" value={overview?.blockedCount} icon={<StopOutlined />} color={colors.error[500]} />
        </Col>
      </Row>

      {/* 事件分布 + 趋势图 */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={12}>
          <Card title="事件类型分布" style={{ borderRadius: componentRadius.card }}>
            {/* ECharts 饼图：按 event_type 统计 */}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="攻击趋势（7 天）" style={{ borderRadius: componentRadius.card }}>
            {/* ECharts 折线图：每日事件数趋势 */}
          </Card>
        </Col>
      </Row>

      {/* 高危事件速览 + 用户风险排行 */}
      <Row gutter={spacing.md}>
        <Col span={14}>
          <Card title="最新高危事件" extra={<Link to="/ai/security/events">查看全部</Link>} style={{ borderRadius: componentRadius.card }}>
            {/* 表格：显示 severity=high/critical 的最新 5 条事件 */}
          </Card>
        </Col>
        <Col span={10}>
          <Card title="用户风险排行 TOP 10" style={{ borderRadius: componentRadius.card }}>
            {/* 列表：user_id + 事件数 + 最高严重级别 */}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
```

### 9.3 安全规则管理 (`/ai/security/rules`)

**功能**: 规则的增删改查、分类筛选、批量启用/禁用、导入/导出。

**交互设计**:

```tsx
// orion-frontend/src/pages/AISecurity/RuleManagement/index.tsx

const RuleManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<SecurityRule[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<RuleFilters>({ page: 1, limit: 20 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<SecurityRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // === 数据加载 ===
  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await getRules(filters);
      setRules(res.data.data);
      setTotal(res.data.total);
    } catch (error: unknown) {
      message.error(`加载规则失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // === 创建规则 ===
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await createRule({
        ...values,
        config: parseConfig(values.configJson),
        escalation: parseEscalation(values.escalationJson),
      });
      message.success('规则创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadRules();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // === 编辑规则 ===
  const handleEdit = async () => {
    if (!editingRule) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await updateRule(editingRule.id, {
        ...values,
        config: parseConfig(values.configJson),
        escalation: parseEscalation(values.escalationJson),
      });
      message.success('规则更新成功');
      setEditModalVisible(false);
      setEditingRule(null);
      loadRules();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`更新失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // === 删除规则 ===
  const handleDelete = async (id: string) => {
    try {
      await deleteRule(id);
      message.success('规则已删除');
      loadRules();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  // === 批量启用/禁用 ===
  const handleBatchToggle = async (enabled: boolean) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择规则');
      return;
    }
    try {
      await batchToggleRules({ ids: selectedRowKeys as string[], enabled });
      message.success(`已${enabled ? '启用' : '禁用'} ${selectedRowKeys.length} 条规则`);
      setSelectedRowKeys([]);
      loadRules();
    } catch (error: unknown) {
      message.error(`操作失败: ${(error as Error).message}`);
    }
  };

  // === 表格列定义 ===
  const columns: TableColumn<SecurityRule>[] = [
    {
      key: 'name',
      title: '规则名称',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (value: unknown, record: SecurityRule) => (
        <Space direction="vertical" size={0}>
          <Text strong>{String(value)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.rule_code}</Text>
        </Space>
      ),
    },
    {
      key: 'category',
      title: '分类',
      width: 120,
      render: (_: unknown, record: SecurityRule) => (
        <Tag color={categoryColorMap[record.category]}>{categoryLabelMap[record.category]}</Tag>
      ),
    },
    {
      key: 'severity',
      title: '严重级别',
      width: 90,
      render: (_: unknown, record: SecurityRule) => (
        <Tag color={severityColorMap[record.severity]}>{severityLabelMap[record.severity]}</Tag>
      ),
    },
    {
      key: 'action',
      title: '处置动作',
      width: 90,
      render: (_: unknown, record: SecurityRule) => (
        <Tag color={actionColorMap[record.action]}>{actionLabelMap[record.action]}</Tag>
      ),
    },
    {
      key: 'match_count',
      title: '匹配次数',
      dataIndex: 'match_count',
      width: 100,
      sortable: true,
    },
    {
      key: 'enabled',
      title: '状态',
      width: 80,
      render: (_: unknown, record: SecurityRule) => (
        <Tag color={record.enabled ? 'green' : 'default'}>{record.enabled ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, record: SecurityRule) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除该规则？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <Title level={2} style={{ marginBottom: 8 }}>
        <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        安全规则管理
      </Title>
      <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14, marginBottom: 16, display: 'block' }}>
        管理 AI 安全检测规则，支持 Prompt 注入、数据泄露、Token 异常等 5 大类 15 种规则类型
      </Text>

      {/* 操作栏 */}
      <Card style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)} style={{ borderRadius: componentRadius.button.md }}>
            创建规则
          </Button>
          <Button disabled={selectedRowKeys.length === 0} onClick={() => handleBatchToggle(true)}>批量启用</Button>
          <Button disabled={selectedRowKeys.length === 0} onClick={() => handleBatchToggle(false)}>批量禁用</Button>
          <Button icon={<ImportOutlined />} onClick={handleImport}>导入</Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
        </Space>
      </Card>

      {/* 规则列表 */}
      <Card style={{ borderRadius: componentRadius.card }}>
        <Table
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          columns={columns}
          dataSource={rules}
          loading={loading}
          rowKey="id"
          pagination={{ total, current: filters.page, pageSize: filters.limit, onChange: (p) => setFilters(f => ({ ...f, page: p })) }}
          striped
        />
      </Card>

      {/* 创建规则 Modal */}
      <Modal title="创建安全规则" open={createModalVisible} onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate} confirmLoading={submitting} width={700} destroyOnClose>
        <Form form={createForm} layout="vertical" style={{ maxWidth: 700 }}>
          <Form.Item name="rule_code" label="规则编码" rules={[{ required: true, message: '请输入规则编码' }, { pattern: /^[A-Z_0-9]+$/, message: '仅支持大写字母、数字和下划线' }]}>
            <Input placeholder="如: PROMPT_INJECTION_001" />
          </Form.Item>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="如: SQL 注入模式检测" />
          </Form.Item>
          <Row gutter={spacing.sm}>
            <Col span={12}>
              <Form.Item name="category" label="规则分类" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="prompt_injection">Prompt 注入</Select.Option>
                  <Select.Option value="data_leakage">数据泄露</Select.Option>
                  <Select.Option value="token_abuse">Token 异常</Select.Option>
                  <Select.Option value="model_abuse">模型滥用</Select.Option>
                  <Select.Option value="content_safety">内容安全</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rule_type" label="规则类型" rules={[{ required: true }]}>
                <Select>{/* 根据分类动态加载选项 */}</Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={spacing.sm}>
            <Col span={8}>
              <Form.Item name="severity" label="严重级别" initialValue="medium" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="low">低</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="critical">严重</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="action" label="处置动作" initialValue="block" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="block">拦截</Select.Option>
                  <Select.Option value="warn">警告</Select.Option>
                  <Select.Option value="log">记录</Select.Option>
                  <Select.Option value="rate_limit">限流</Select.Option>
                  <Select.Option value="ban">封禁</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="优先级" initialValue={100} rules={[{ required: true }]}>
                <Input type="number" placeholder="数值越小越优先" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="pattern" label="匹配模式">
            <Input.TextArea rows={3} placeholder="正则表达式或 JSON 匹配配置" />
          </Form.Item>
          <Form.Item name="description" label="规则描述">
            <Input.TextArea rows={2} placeholder="规则描述..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑规则 Modal（结构同创建，预填数据） */}
      <Modal title="编辑安全规则" open={editModalVisible} onCancel={() => { setEditModalVisible(false); setEditingRule(null); }}
        onOk={handleEdit} confirmLoading={submitting} width={700} destroyOnClose>
        <Form form={editForm} layout="vertical" style={{ maxWidth: 700 }}>
          {/* 同创建表单 */}
        </Form>
      </Modal>
    </div>
  );
};
```

### 9.4 安全事件列表 (`/ai/security/events`)

**功能**: 事件列表、多条件筛选、批量处置、导出。

**交互设计**:

```tsx
// orion-frontend/src/pages/AISecurity/EventList/index.tsx

const EventListPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<EventFilters>({ page: 1, limit: 20, days: 7 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [disposeModalVisible, setDisposeModalVisible] = useState(false);
  const [disposeAction, setDisposeAction] = useState<string>('');
  const [disposeNote, setDisposeNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // === 加载事件列表 ===
  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await getEvents(filters);
      setEvents(res.data.data);
      setTotal(res.data.total);
    } catch (error: unknown) {
      message.error(`加载事件失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // === 更新状态 ===
  const handleUpdateStatus = async (id: string, status: EventStatus) => {
    try {
      await updateEventStatus(id, { status });
      message.success('状态已更新');
      loadEvents();
    } catch (error: unknown) {
      message.error(`更新失败: ${(error as Error).message}`);
    }
  };

  // === 标记误报 ===
  const handleFalsePositive = async (id: string) => {
    try {
      await markFalsePositive(id);
      message.success('已标记为误报');
      loadEvents();
    } catch (error: unknown) {
      message.error(`操作失败: ${(error as Error).message}`);
    }
  };

  // === 批量处置 ===
  const handleBatchDispose = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择事件');
      return;
    }
    try {
      setSubmitting(true);
      await batchDisposeEvents({ ids: selectedRowKeys as string[], action: disposeAction, note: disposeNote });
      message.success(`已处置 ${selectedRowKeys.length} 条事件`);
      setDisposeModalVisible(false);
      setSelectedRowKeys([]);
      loadEvents();
    } catch (error: unknown) {
      message.error(`处置失败: ${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // === 筛选栏 ===
  const filterDefs: FilterDefinition[] = [
    { key: 'event_type', label: '事件类型', options: eventTypes },
    { key: 'severity', label: '严重级别', options: severities },
    { key: 'status', label: '状态', options: statuses },
  ];

  // === 表格列 ===
  const columns: TableColumn<SecurityEvent>[] = [
    {
      key: 'severity',
      title: '级别',
      width: 80,
      render: (_: unknown, record: SecurityEvent) => (
        <Tag color={severityColorMap[record.severity]}>{severityLabelMap[record.severity]}</Tag>
      ),
    },
    {
      key: 'event_type',
      title: '事件类型',
      width: 130,
      render: (_: unknown, record: SecurityEvent) => (
        <Tag color={eventTypeColorMap[record.event_type]}>{eventTypeLabelMap[record.event_type]}</Tag>
      ),
    },
    {
      key: 'rule_code',
      title: '触发规则',
      dataIndex: 'rule_code',
      width: 160,
      render: (value: unknown) => <Text style={{ fontSize: 12 }}>{String(value)}</Text>,
    },
    {
      key: 'matched_content',
      title: '匹配内容',
      width: 200,
      ellipsis: true,
      render: (value: unknown) => <Text type="secondary" style={{ fontSize: 12 }}>{String(value)}</Text>,
    },
    {
      key: 'risk_score',
      title: '风险分数',
      dataIndex: 'risk_score',
      width: 90,
      sortable: true,
      render: (value: unknown) => (
        <Progress percent={Number(value)} size="small" strokeColor={getScoreColor(Number(value))} format={() => String(value)} />
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: SecurityEvent) => (
        <Tag color={statusColorMap[record.status]}>{statusLabelMap[record.status]}</Tag>
      ),
    },
    {
      key: 'user_id',
      title: '触发用户',
      dataIndex: 'user_id',
      width: 120,
    },
    {
      key: 'created_at',
      title: '发生时间',
      dataIndex: 'created_at',
      width: 150,
      sortable: true,
      render: (value: unknown) => dayjs(String(value)).format('YYYY-MM-DD HH:mm'),
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, record: SecurityEvent) => (
        <Space size="small" wrap>
          <Link to={`/ai/security/events/${record.id}`}>
            <Button type="link" size="small" icon={<EyeOutlined />}>详情</Button>
          </Link>
          {record.status === 'open' && (
            <>
              <Popconfirm title="确认处置？" onConfirm={() => handleUpdateStatus(record.id, 'acknowledged')}>
                <Button type="link" size="small">确认</Button>
              </Popconfirm>
              <Popconfirm title="标记为误报？" onConfirm={() => handleFalsePositive(record.id)}>
                <Button type="link" size="small">误报</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <Title level={2} style={{ marginBottom: 8 }}>
        <WarningOutlined style={{ marginRight: 12, color: colors.warning[500] }} />
        安全事件
      </Title>
      <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14, marginBottom: 16, display: 'block' }}>
        查看和处置 AI 安全检测产生的安全事件
      </Text>

      {/* 操作栏 + 筛选 */}
      <Card style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadEvents} loading={loading}>刷新</Button>
          <Button disabled={selectedRowKeys.length === 0} onClick={() => { setDisposeAction('resolved'); setDisposeModalVisible(true); }}>
            批量处置 ({selectedRowKeys.length})
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
        </Space>
        <div style={{ marginTop: spacing.sm }}>
          <SearchFilterBar onFilter={(f) => setFilters(prev => ({ ...prev, ...f, page: 1 }))} filters={filterDefs} />
        </div>
      </Card>

      {/* 事件列表 */}
      <Card style={{ borderRadius: componentRadius.card }}>
        <Table
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          columns={columns}
          dataSource={events}
          loading={loading}
          rowKey="id"
          pagination={{ total, current: filters.page, pageSize: filters.limit }}
          striped
          rowClassName={(record) => record.severity === 'critical' ? 'critical-row' : ''}
        />
      </Card>

      {/* 批量处置 Modal */}
      <Modal title="批量处置" open={disposeModalVisible} onCancel={() => setDisposeModalVisible(false)}
        onOk={handleBatchDispose} confirmLoading={submitting} width={500}>
        <Form layout="vertical">
          <Form.Item label="处置动作" required>
            <Select value={disposeAction} onChange={setDisposeAction}>
              <Select.Option value="resolved">标记已解决</Select.Option>
              <Select.Option value="false_positive">标记误报</Select.Option>
              <Select.Option value="escalated">升级处理</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="备注">
            <Input.TextArea rows={3} value={disposeNote} onChange={e => setDisposeNote(e.target.value)} placeholder="处置备注..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
```

### 9.5 事件详情 (`/ai/security/events/:id`)

**功能**: 查看事件完整信息、执行处置操作、查看关联事件。

**交互设计**:

```tsx
// orion-frontend/src/pages/AISecurity/EventDetail/index.tsx

const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<SecurityEventDetail | null>(null);
  const [correlatedEvents, setCorrelatedEvents] = useState<SecurityEvent[]>([]);
  const [disposalLoading, setDisposalLoading] = useState(false);

  // === 加载数据 ===
  const loadData = async () => {
    setLoading(true);
    try {
      const [detailRes, correlatedRes] = await Promise.all([
        getEventDetail(id!),
        event?.correlation_id ? getCorrelatedEvents(event.correlation_id) : Promise.resolve({ data: [] }),
      ]);
      setEvent(detailRes.data.data);
      setCorrelatedEvents(correlatedRes.data.data);
    } catch (error: unknown) {
      message.error(`加载事件详情失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // === 处置操作 ===
  const handleDispose = async (action: string) => {
    setDisposalLoading(true);
    try {
      await disposeEvent(id!, { action, note: '手动处置' });
      message.success('处置成功');
      loadData();
    } catch (error: unknown) {
      message.error(`处置失败: ${(error as Error).message}`);
    } finally {
      setDisposalLoading(false);
    }
  };

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 + 返回 */}
      <Space style={{ marginBottom: spacing.md }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => history.back()}>返回</Button>
        <Title level={2} style={{ marginBottom: 0 }}>事件详情</Title>
      </Space>

      {/* 处置操作栏（仅 open 状态可见） */}
      {event?.status === 'open' && (
        <Card style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}>
          <Space>
            <Text strong>处置操作：</Text>
            <Button type="primary" loading={disposalLoading} onClick={() => handleDispose('acknowledged')} style={{ borderRadius: componentRadius.button.md }}>确认</Button>
            <Button danger loading={disposalLoading} onClick={() => handleDispose('resolved')}>标记已解决</Button>
            <Button onClick={() => handleDispose('false_positive')}>标记误报</Button>
            <Button onClick={() => handleDispose('escalated')}>升级处理</Button>
          </Space>
        </Card>
      )}

      <Row gutter={spacing.md}>
        {/* 左侧：事件基本信息 */}
        <Col span={16}>
          <Card title="基本信息" style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="事件ID">{event?.id}</Descriptions.Item>
              <Descriptions.Item label="风险分数">
                <Progress percent={event?.risk_score} size="small" strokeColor={getScoreColor(event?.risk_score ?? 0)} />
              </Descriptions.Item>
              <Descriptions.Item label="事件类型">
                <Tag color={eventTypeColorMap[event?.event_type ?? '']}>{eventTypeLabelMap[event?.event_type ?? '']}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="严重级别">
                <Tag color={severityColorMap[event?.severity ?? '']}>{severityLabelMap[event?.severity ?? '']}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="触发规则">{event?.rule_code}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[event?.status ?? '']}>{statusLabelMap[event?.status ?? '']}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="触发用户">{event?.user_id ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="模型">{event?.model_id ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="来源 IP">{event?.source_ip ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="发生时间">{event?.created_at ? dayjs(event.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
              <Descriptions.Item label="自动处置">{event?.auto_disposed ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="处置动作">{event?.action_taken ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="匹配内容" span={2}>
                <pre style={{ background: colors.light.bg.secondary, padding: spacing.sm, borderRadius: componentRadius.input, whiteSpace: 'pre-wrap' }}>
                  {event?.matched_content}
                </pre>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 关联的 LLM Trace */}
          {event?.trace_id && (
            <Card title="关联 LLM 调用" style={{ borderRadius: componentRadius.card }}>
              <Button type="link" onClick={() => navigate(`/llm-traces/${event.trace_id}`)}>查看调用详情 →</Button>
            </Card>
          )}
        </Col>

        {/* 右侧：关联事件组 */}
        <Col span={8}>
          <Card title="关联事件" style={{ borderRadius: componentRadius.card }}>
            {event?.correlation_id ? (
              <>
                <Tag color="orange">关联事件组</Tag>
                <Text> 共 {event.correlated_event_count} 条事件</Text>
                <div style={{ marginTop: spacing.sm }}>
                  {correlatedEvents.map(e => (
                    <Card size="small" style={{ marginBottom: spacing.xs, borderRadius: componentRadius.input }} key={e.id}>
                      <Space>
                        <Tag color={severityColorMap[e.severity]}>{severityLabelMap[e.severity]}</Tag>
                        <Text style={{ fontSize: 12 }}>{e.event_type}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(e.created_at).fromNow()}</Text>
                      </Space>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <Empty description="无关联事件" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
```

### 9.6 攻击趋势分析 (`/ai/security/trends`)

**功能**: 攻击趋势图表、类型分布、用户风险排行、模型安全评分。

**交互设计**:

```tsx
// orion-frontend/src/pages/AISecurity/AttackTrends/index.tsx

const AttackTrendsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [typeDistribution, setTypeDistribution] = useState<TypeDistribution[]>([]);
  const [userRisk, setUserRisk] = useState<UserRiskItem[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const loadData = async () => {
    setLoading(true);
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const [trendRes, distRes, riskRes] = await Promise.all([
        getAttackTrend({ days, groupBy: 'day' }),
        getEventStats({ days }),
        getUserRisk({ limit: 20 }),
      ]);
      setTrendData(trendRes.data.data);
      setTypeDistribution(distRes.data.byType);
      setUserRisk(riskRes.data.data);
    } catch (error: unknown) {
      message.error(`加载趋势数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [timeRange]);

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <Title level={2} style={{ marginBottom: 8 }}>
        <RadarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        攻击趋势分析
      </Title>
      <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14, marginBottom: 16, display: 'block' }}>
        分析 AI 安全事件的时间趋势、类型分布和用户风险特征
      </Text>

      {/* 时间范围选择 */}
      <Card style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}>
        <Space>
          <Text strong>时间范围：</Text>
          <Radio.Group value={timeRange} onChange={e => setTimeRange(e.target.value)} buttonStyle="solid">
            <Radio.Button value="7d">7 天</Radio.Button>
            <Radio.Button value="30d">30 天</Radio.Button>
            <Radio.Button value="90d">90 天</Radio.Button>
          </Radio.Group>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </Space>
      </Card>

      {/* 趋势图 + 类型分布 */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={16}>
          <Card title="事件趋势" loading={loading} style={{ borderRadius: componentRadius.card }}>
            {/* ECharts 折线图: 横轴日期，纵轴事件数，按 severity 分线 */}
          </Card>
        </Col>
        <Col span={8}>
          <Card title="类型分布" loading={loading} style={{ borderRadius: componentRadius.card }}>
            {/* ECharts 饼图: 按 event_type 占比 */}
          </Card>
        </Col>
      </Row>

      {/* 用户风险排行 + 模型安全评分 */}
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Card title="用户风险排行 TOP 20" loading={loading} style={{ borderRadius: componentRadius.card }}>
            {/* 列表: user_id | 事件数 | 最高严重级别 | 最近触发时间 */}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="模型安全评分" loading={loading} style={{ borderRadius: componentRadius.card }}>
            {/* 列表: model_id | 安全评分 | 调用次数 | 拦截次数 */}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
```

### 9.7 路由配置

```tsx
// orion-frontend/src/router/routes.tsx (修改)

// 替换现有 /ai/security 路由
{
  path: '/ai/security',
  element: React.lazy(() => import('@/pages/AISecurity/Dashboard')),  // 仪表盘
  meta: { title: 'AI 安全监控', icon: 'SafetyCertificateOutlined' },
},
{
  path: '/ai/security/rules',
  element: React.lazy(() => import('@/pages/AISecurity/RuleManagement')),  // 规则管理
  meta: { title: '安全规则管理' },
},
{
  path: '/ai/security/events',
  element: React.lazy(() => import('@/pages/AISecurity/EventList')),  // 事件列表
  meta: { title: '安全事件' },
},
{
  path: '/ai/security/events/:id',
  element: React.lazy(() => import('@/pages/AISecurity/EventDetail')),  // 事件详情
  meta: { title: '事件详情' },
},
{
  path: '/ai/security/trends',
  element: React.lazy(() => import('@/pages/AISecurity/AttackTrends')),  // 攻击趋势
  meta: { title: '攻击趋势分析' },
},
```

---

## 十、Design Token 使用规范

所有页面必须遵循 Design Token 体系，禁止硬编码色值/间距/圆角。

### 10.1 色彩使用

| 用途 | Token | 场景 |
|------|-------|------|
| 主色 | `colors.primary[500]` (#3370E6) | 主按钮、图标 |
| 成功 | `colors.success[500]` (#52c41a) | 低危标签、启用状态 |
| 警告 | `colors.warning[500]` (#faad14) | 中危标签、警告图标 |
| 错误 | `colors.error[500]` (#f5222d) | 严重/高危标签、危险操作 |
| 信息 | `colors.info[500]` (#3a98f4) | 信息提示 |
| 紫色 | `colors.purple[500]` (#7C5CFC) | 审批中、特殊标记 |
| 灰文字 | `colors.neutral[500]` (#8c8c8c) | 副标题、描述文字 |
| 深文字 | `colors.neutral[900]` (#1f1f1f) | 页面主标题 |
| 次要背景 | `colors.light.bg.secondary` (#F5F5F7) | 代码块背景 |
| 表格悬停 | `colors.primary[50]` (#EBF0FB) | 表格行悬停 |

### 10.2 事件严重级别颜色

| 级别 | 颜色 | 实现方式 |
|------|------|---------|
| low | `colors.success[500]` | Tag color="green" |
| medium | `colors.warning[500]` | Tag color="orange" |
| high | `#fa541c` (volcano) | Tag color="volcano" |
| critical | `colors.error[500]` | Tag color="red" |

### 10.3 组件规范

- **Card 圆角**: `componentRadius.card` (12px)
- **Button 圆角**: `componentRadius.button.md` (6px)
- **Input 圆角**: `componentRadius.input` (6px)
- **Card 阴影**: `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`
- **Section 间距**: `spacing.md` (16px)
- **Card 间距**: `spacing.md` (16px)
- **按钮组间距**: `spacing.sm` (8px)
- **表单最大宽度**: 700px
- **按钮高度**: 36px

---

## 十一、后端服务设计

### 11.1 服务模块结构

```
orion-platform-service/src/services/ai-security/
├── AISecurityRuleService.ts       # 规则 CRUD + 统计
├── AISecurityEventService.ts      # 事件 CRUD + 统计 + 趋势
├── RuleMatchingEngine.ts          # 规则匹配引擎
├── DeepAnalysisWorker.ts          # 异步深度分析
├── EventCorrelator.ts             # 事件关联分析
├── AutoDisposalEngine.ts          # 自动处置引擎
├── SecurityMiddleware.ts          # 请求拦截中间件
├── AlertNotifier.ts               # 告警通知
└── EffectTracker.ts               # 效果追踪（误报率/漏报率）
```

### 11.2 Repository 层

```
orion-platform-service/src/repositories/
├── AISecurityRuleRepository.ts    # ai_security_rules 数据访问
└── AISecurityEventRepository.ts   # ai_security_events 数据访问
```

### 11.3 Model 层

```
orion-platform-service/src/models/
├── AISecurityRule.ts              # 规则数据模型
└── AISecurityEvent.ts             # 事件数据模型
```

---

## 十二、前端文件变更清单

| 文件 | 操作 | 描述 |
|------|------|------|
| `orion-frontend/src/pages/AISecurity/Dashboard/index.tsx` | 新建 | 安全仪表盘 |
| `orion-frontend/src/pages/AISecurity/RuleManagement/index.tsx` | 新建 | 安全规则管理 |
| `orion-frontend/src/pages/AISecurity/EventList/index.tsx` | 新建 | 安全事件列表 |
| `orion-frontend/src/pages/AISecurity/EventDetail/index.tsx` | 新建 | 事件详情 |
| `orion-frontend/src/pages/AISecurity/AttackTrends/index.tsx` | 新建 | 攻击趋势分析 |
| `orion-frontend/src/pages/AISecurity/index.tsx` | 重构 | 从策略管理页改为仪表盘入口 |
| `orion-frontend/src/api/ai-security.ts` | 增强 | 新增规则/事件/仪表盘 API 客户端 |
| `orion-frontend/src/router/routes.tsx` | 修改 | 注册 5 个新路由 |
| `orion-platform-service/src/api/ai-security-routes.ts` | 新建 | 后端路由注册 |
| `orion-platform-service/src/api/routes.ts` | 修改 | 注册 ai-security-routes |
| `orion-platform-service/src/db/migrations/189_create_ai_security_tables.sql` | 新建 | DDL 迁移 |
| `orion-platform-service/src/db/migrations/189_create_ai_security_tables-rollback.sql` | 新建 | 回滚迁移 |
| `orion-platform-service/src/services/ai-security/*.ts` | 新建 | 7 个服务模块 |
| `orion-platform-service/src/repositories/AISecurityRuleRepository.ts` | 新建 | 规则 Repository |
| `orion-platform-service/src/repositories/AISecurityEventRepository.ts` | 新建 | 事件 Repository |
| `orion-platform-service/src/models/AISecurityRule.ts` | 新建 | 规则 Model |
| `orion-platform-service/src/models/AISecurityEvent.ts` | 新建 | 事件 Model |

---

## 十三、验收标准

### 13.1 数据库

| # | 标准 | 验证方式 |
|---|------|---------|
| DB1 | `ai_security_rules` 表包含 DDL 规范（UUID PK, tenant_id UUID, TIMESTAMPTZ, RLS, CHECK 约束） | 迁移审查 |
| DB2 | `ai_security_events` 表遵循 DDL 规范，含 soft delete | 迁移审查 |
| DB3 | 两张表均有对应的 rollback.sql 文件 | 文件检查 |
| DB4 | CHECK 约束覆盖 category, rule_type, severity, action, status, event_type, threat_level | 迁移审查 |
| DB5 | 索引覆盖查询模式（tenant + category, tenant + status, tenant + created_at DESC 等） | EXPLAIN 分析 |

### 13.2 后端 API

| # | 标准 | 验证方式 |
|---|------|---------|
| API1 | 规则 CRUD 全部端点可用（11 个） | 集成测试 |
| API2 | 事件 CRUD + 处置 + 批量操作全部端点可用（10 个） | 集成测试 |
| API3 | 仪表盘 4 个端点可用 | 集成测试 |
| API4 | 所有端点按 tenant_id 隔离（RLS 生效） | API 测试 |
| API5 | 分页端点返回 `data` 数组 + `total` 计数 | API 测试 |
| API6 | 错误响应统一格式 `{ error, message, code }` | API 测试 |

### 13.3 前端页面

| # | 标准 | 验证方式 |
|---|------|---------|
| FE1 | 仪表盘 4 个指标卡片 + 趋势图 + 高危事件列表正常渲染 | 手动验证 |
| FE2 | 规则管理页支持 CRUD、筛选、批量操作、导入/导出 | 手动验证 |
| FE3 | 事件列表页支持多条件筛选、分页、批量处置 | 手动验证 |
| FE4 | 事件详情页展示完整信息，支持处置操作 | 手动验证 |
| FE5 | 攻击趋势页支持 7d/30d/90d 时间切换 | 手动验证 |
| FE6 | 所有异步操作有 loading + success/error 提示 | 代码审查 |
| FE7 | 按钮有 loading/disabled 防止重复提交 | 代码审查 |
| FE8 | 空数据展示 Empty + 引导操作按钮 | 代码审查 |
| FE9 | 全部使用 Design Token，无硬编码色值/间距 | 代码审查 |
| FE10 | 5 个路由全部注册并可访问 | 路由审查 |

### 13.4 安全规则

| # | 标准 | 验证方式 |
|---|------|---------|
| SR1 | 5 大类 15 种规则类型全部可在前端创建 | 手动验证 |
| SR2 | 创建规则后，规则立即生效于后续请求 | 集成测试 |
| SR3 | 规则支持启用/禁用切换 | 手动验证 |
| SR4 | 规则支持优先级排序（priority 小的先执行） | 单元测试 |

### 13.5 安全事件

| # | 标准 | 验证方式 |
|---|------|---------|
| SE1 | 事件产生时正确关联 trace_id（如有） | 集成测试 |
| SE2 | 事件严重级别与规则定义一致 | 单元测试 |
| SE3 | 自动处置在 severity >= high 时触发 | 集成测试 |
| SE4 | 关联分析将多个 low 事件升级为 high | 单元测试 |
| SE5 | 标记误报后事件状态变为 false_positive | 手动验证 |

### 13.6 实时扫描

| # | 标准 | 验证方式 |
|---|------|---------|
| RS1 | 同步快速匹配 < 50ms | 性能测试 |
| RS2 | 异步深度分析不阻塞主请求 | 性能测试 |
| RS3 | 高风险请求被正确拦截返回 403 | 集成测试 |
| RS4 | 规则按优先级顺序执行 | 单元测试 |

---

## 十四、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) | 合计 |
|------|:---------:|:---------:|:---------:|:----:|
| 迁移 189 (DDL + RLS) | 0.5 | - | - | 0.5 |
| Model + Repository 层 | 1 | - | 0.5 | 1.5 |
| 规则管理服务 | 1.5 | - | 0.5 | 2 |
| 事件管理 + 关联分析 | 2 | - | 1 | 3 |
| 实时扫描中间件 | 1.5 | - | 1 | 2.5 |
| 后端路由注册 | 0.5 | - | 0.5 | 1 |
| 仪表盘页面 | - | 2 | 0.5 | 2.5 |
| 规则管理页面 | - | 2 | 0.5 | 2.5 |
| 事件列表 + 详情页面 | - | 2.5 | 1 | 3.5 |
| 攻击趋势页面 | - | 1.5 | 0.5 | 2 |
| API 客户端 + 路由配置 | - | 0.5 | - | 0.5 |
| **合计** | **7.5** | **8.5** | **4.5** | **20.5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-22 | 状态: 设计中_
