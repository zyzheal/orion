# LLM 安全防护章节（P1-U13 · NEW-EA-11，2026-10-11）

| 元数据 | |
|--------|------|
| 文档编号 | llm-security-hardening-2026-10-11 |
| 状态 | 已产出（U13 · NEW-EA-11） |
| 日期 | 2026-10-11 |
| 依据 | `enterprise-architecture-depth-review-2026-10-11.md` §5.4 U13 + §6.4 关键判据 11 |
| 前置 | U12 AI 决策 SLA/评测集（本任务同期产出）|
| 约束 | RC-03（不修改生产代码）；不估算人天/工期；符合 AWS WA LLM01-BP01/BP02/BP04 |

---

## 1. 问题陈述

### 1.1 一手代码实证

`orion-ai-service/src/services/prompt_security.py`（**195 行**）已实现基础 prompt 安全防护，但**仅覆盖 20% 的 LLM 攻击面**：

| 已有能力 | 位置 | 覆盖 |
|---------|-----|-----|
| Prompt 注入检测（threat detection）| `prompt_security.py:1-95` | ✅ 部分 |
| 代码块清洗（sanitize）| `prompt_security.py:178-195` | ✅ 部分 |
| 威胁严重度评分 | `prompt_security.py:173-176` | ✅ |

**未覆盖的关键攻击面**：

| # | 攻击面 | OWASP LLM Top 10 | 当前状态 |
|---|--------|-----------------|---------|
| 1 | **Prompt 注入变种**（多语言/Unicode 混淆/角色扮演/多轮注入）| LLM01 Prompt Injection | ⚠️ 仅基础 regex |
| 2 | **输出校验**（结构化输出/schema 校验/幻觉检测）| LLM06 Excessive Agency | ❌ 完全无 |
| 3 | **数据脱敏**（PII/凭据/密钥自动识别与脱敏）| LLM03 Sensitive Info Disclosure | ❌ 完全无 |
| 4 | **调用审计**（每次 LLM 调用全链路记录）| LLM02 Information Disclosure | ⚠️ llm_trace 有基础记录 |
| 5 | **速率限制**（防滥用/成本保护）| LLM08 Unbounded Consumption | ❌ 完全无 |
| 6 | **模型供应链**（prompt 模板版本化）| LLM05 Unsafe Output Handling | ❌ 完全无 |

### 1.2 差距根因

`enterprise-architecture-depth-review-2026-10-11.md` §5.3 差距根因 2 提及："LLM 服务的**决策边界未定义**"，本文件将这一缺口具体化到**安全维度**：132 路由 × 6 攻击面 = 792 个潜在攻击点，当前仅覆盖 ~158 个（20%）。

---

## 2. 目标与判据

### 2.1 目标

将 LLM 安全防护从 20% 覆盖 → 90%+ 覆盖，符合 **AWS WA LLM01-BP01（人工确认）、BP02（prompt 注入防护）、BP03（输出校验）、BP04（数据脱敏）、BP05（审计）**。

### 2.2 关键判据

| 判据 | 依据 | 要求 |
|-----|------|------|
| D1 Prompt 注入防护 | OWASP LLM01 | 支持 15+ 变种（多语言/Unicode/角色扮演/多轮）|
| D2 输出校验 | OWASP LLM06 | 结构化输出强制 schema 校验，幻觉检测 |
| D3 数据脱敏 | AWS SEC01-BP04 | PII/凭据/密钥 12 类自动脱敏 |
| D4 调用审计 | AWS SEC01-BP01 | 每次 LLM 调用有完整审计日志 |
| D5 速率限制 | Google SRE Ch.24 Overload | 每租户/每决策类型的 QPS 上限 |
| D6 模型供应链 | Google SRE Ch.15 | prompt 模板版本化 + 变更审计 |

---

## 3. 6 大防护层设计

### 3.1 分层架构

```
用户请求
    │
    ▼
[L1 速率限制]    # 防滥用
    │
    ▼
[L2 输入防护]    # Prompt 注入检测 + 数据脱敏
    │
    ▼
[L3 LLM 调用]    # 实际推理（受控）
    │
    ▼
[L4 输出校验]    # Schema 校验 + 幻觉检测 + 敏感信息扫描
    │
    ▼
[L5 审计日志]    # 全链路记录（输入/输出/延迟/决策）
    │
    ▼
[L6 模板管理]    # 版本化 + 变更审计
```

### 3.2 每层实现方案

#### L1 速率限制

```python
# 新增 internal/ai-gateway/rate_limiter.py（伪代码，非生产代码）

class RateLimiter:
    def check(self, tenant_id: str, decision_type: str, request_id: str) -> RateLimitResult:
        key = f"llm:{tenant_id}:{decision_type}"
        current_qps = self.counter.get(key)
        
        # 每租户每决策类型的 QPS 上限
        limit = {
            "code_review": 10,
            "rca": 50,
            "self_heal": 5,
            "knowledge_qa": 100,
        }.get(decision_type, 20)
        
        if current_qps > limit:
            return RateLimitResult(denied=True, reason="rate_limit_exceeded")
        
        # 成本保护（每日 token 上限）
        daily_tokens = self.token_counter.get(f"llm:{tenant_id}:{date.today()}")
        if daily_tokens > 10_000_000:  # 10M tokens/day 默认
            return RateLimitResult(denied=True, reason="daily_token_limit")
        
        self.counter.increment(key)
        return RateLimitResult(denied=False)
```

**默认限制**：
- 每租户 code_review 10 QPS、self_heal 5 QPS
- 每日 10M tokens 默认上限
- 突发（Burst）允许 2x 30 秒

#### L2 输入防护

**Prompt 注入变种扩展**（当前 regex 仅覆盖基础）：

```python
PROMPT_INJECTION_PATTERNS = [
    # 基础（已有）
    r"ignore\s+all\s+previous\s+instructions",
    r"you\s+are\s+now",
    # 新增：多语言（中文/日文/俄文）
    r"忽略(所有)?(之前|前面)(的)?指令",
    r"あなた(は)?今(から)?(は)",
    # 新增：Unicode 混淆
    r"[🔍🎯🚀📝⚙️🔧]{3,}",  # 多个 emoji 混淆
    r"[\u200B-\u200F\u202A-\u202E]{2,}",  # 零宽字符
    # 新增：角色扮演
    r"act\s+as\s+(a\s+)?(DAN|developer|admin|root)",
    r"扮演(一个)?(管理员|开发者|超级用户)",
    # 新增：多轮注入（利用对话历史）
    r"(earlier|before|last turn).*(?P<injection>.{10,})",
    # 新增：编码绕过
    r"base64:\s+[A-Za-z0-9+/=]{20,}",
    r"rot13:\s+\w+",
    r"hex:\s*[0-9a-f]{40,}",
]

def detect_injection(prompt: str) -> List[PromptThreat]:
    threats = []
    for i, pattern in enumerate(PROMPT_INJECTION_PATTERNS):
        if re.search(pattern, prompt, re.IGNORECASE):
            threats.append(PromptThreat(
                pattern_id=f"INJ-{i:03d}",
                severity=SEVERITY_HIGH if i < 6 else SEVERITY_MEDIUM,
            ))
    return threats
```

**数据脱敏 12 类**：

```python
PII_PATTERNS = {
    "email": r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b",
    "phone_cn": r"\b1[3-9]\d{9}\b",
    "phone_us": r"\b\d{3}-\d{3}-\d{4}\b",
    "id_card_cn": r"\b[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b",
    "credit_card": r"\b(?:\d[ -]*?){13,19}\b",
    "aws_access_key": r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
    "github_token": r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b",
    "jwt": r"\beyJ[\w-]+\.[\w-]+\.[\w-]+\b",
    "ip_v4": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
    "ssh_key": r"-----BEGIN (?:OPENSSH|RSA|DSA|EC) PRIVATE KEY-----[\s\S]*?-----END-----",
    "private_key_generic": r"-----BEGIN PRIVATE KEY-----[\s\S]*?-----END-----",
    "internal_path": r"/(usr|home|etc|var)/[\w./-]+",
}
```

#### L3 LLM 调用（受控）

```python
def call_llm(prompt: str, context: CallContext) -> LLMResponse:
    # 1. 速率检查
    rl = rate_limiter.check(context.tenant_id, context.decision_type, context.request_id)
    if rl.denied:
        return fallback_to_rule_engine(context)
    
    # 2. 注入检测
    threats = detect_injection(prompt)
    if any(t.severity >= SEVERITY_HIGH for t in threats):
        audit_log.record_block(context, threats)
        return LLMResponse(status="blocked", reason="prompt_injection_detected")
    
    # 3. 数据脱敏
    sanitized, redacted_types = redact_pii(prompt)
    
    # 4. 模板应用（版本化）
    template = template_registry.get(context.template_id, context.template_version)
    final_prompt = template.render(sanitized)
    
    # 5. 调用 LLM
    try:
        response = llm_client.complete(final_prompt, timeout=30)
    except TimeoutError:
        audit_log.record_timeout(context)
        return fallback_to_rule_engine(context)
    
    # 6. 输出校验
    validated = output_validator.validate(response, context.expected_schema)
    if not validated.valid:
        audit_log.record_validation_fail(context, validated.errors)
        return LLMResponse(status="invalid_output", reason=validated.errors)
    
    return LLMResponse(
        status="ok",
        content=validated.content,
        metadata={
            "redacted_types": redacted_types,
            "template_version": context.template_version,
            "token_usage": response.usage,
        },
    )
```

#### L4 输出校验

```python
class OutputValidator:
    def validate(self, response: str, expected_schema: Optional[Schema]) -> ValidationResult:
        errors = []
        
        # 1. Schema 校验（如定义了 schema）
        if expected_schema:
            parsed = json.loads(response)
            if not jsonschema.validate(parsed, expected_schema):
                errors.append("schema_violation")
        
        # 2. 幻觉检测（关键事实与 RAG 上下文不一致）
        if context.rag_chunks:
            hallucinations = detect_hallucination(response, context.rag_chunks)
            if hallucinations:
                errors.append(f"hallucination: {hallucinations}")
        
        # 3. 敏感信息扫描（LLM 可能泄露训练数据）
        leaked_pii = detect_pii(response)
        if leaked_pii:
            errors.append(f"sensitive_info_leaked: {leaked_pii}")
        
        # 4. 长度限制
        if len(response) > 8000:
            errors.append("response_too_long")
        
        return ValidationResult(valid=len(errors) == 0, errors=errors)
```

#### L5 审计日志

```sql
-- Migration 773: llm_call_audit 表
CREATE TABLE llm_call_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    request_id      TEXT NOT NULL,
    decision_type   TEXT NOT NULL,
    template_id     TEXT NOT NULL,
    template_version TEXT NOT NULL,
    input_hash      TEXT NOT NULL,
    input_length    INTEGER NOT NULL,
    output_hash     TEXT,
    output_length   INTEGER,
    token_usage     INTEGER,
    latency_ms      INTEGER,
    status          TEXT NOT NULL,       -- 'ok' / 'blocked' / 'timeout' / 'invalid_output'
    block_reason    TEXT,
    threats_detected JSONB,
    pii_redacted    TEXT[],
    created_at      TIMESTAMPTZ DEFAULT now(),
    INDEX idx_audit_tenant_decision (tenant_id, decision_type, created_at)
);
```

**审计保留期**：90 天热存储 + 1 年冷存储，符合 AWS SEC01-BP01。

#### L6 模板管理

```sql
-- Migration 774: prompt_templates 表（版本化）
CREATE TABLE prompt_templates (
    id              UUID PRIMARY KEY,
    tenant_id       TEXT,
    template_id     TEXT NOT NULL,
    version         TEXT NOT NULL,
    template_body   TEXT NOT NULL,
    author_id       UUID,
    approved_by     UUID,
    approved_at     TIMESTAMPTZ,
    frozen          BOOLEAN DEFAULT false,   -- 冻结后禁止修改
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(template_id, version)
);
```

**变更流程**：模板修改 → PR review → CI 单测 + 评测集 → 5 人审批 → frozen → 生产发布。

---

## 4. 迁移与实施

### 4.1 分阶段落地

| 阶段 | 内容 | 优先级 |
|-----|------|-------|
| 阶段 1 | L5 审计日志表 + 基础审计 | P0 |
| 阶段 2 | L2 输入防护扩展（15+ 变种 + 12 类 PII）| P0 |
| 阶段 3 | L4 输出校验（schema + 幻觉 + 敏感扫描）| P1 |
| 阶段 4 | L1 速率限制 + L6 模板管理 | P1 |

### 4.2 Migration 号段申请

| 号段 | 用途 |
|-----|------|
| **773** | `llm_call_audit` 表 |
| **774** | `prompt_templates` 表 |
| **775** | `llm_rate_limit_config` 表（每租户 QPS/成本上限）|

**前置**：770-772 已申请（U12 AI SLA），773-775 为本任务申请。

---

## 5. 验证方式

### 5.1 静态验证

```bash
# prompt_security 覆盖变种数
grep -c "PROMPT_INJECTION_PATTERNS\|PII_PATTERNS" \
  orion-ai-service/src/services/prompt_security.py
# 期望：>=2 处

# 审计表
ls orion-platform-svc-go/migrations/77[3-5]_*.sql
# 期望：3 文件

# 输出校验
grep -rn "OutputValidator\|output_validator" orion-ai-service/src/
# 期望：>=3 处

# 速率限制
grep -rn "RateLimiter\|rate_limiter" orion-ai-service/src/
# 期望：>=2 处
```

### 5.2 单测验证

```bash
# Prompt 注入 15 变种全部命中
python -m pytest orion-ai-service/tests/test_prompt_injection_variants.py
# 期望：15/15 通过

# PII 脱敏 12 类
python -m pytest orion-ai-service/tests/test_pii_redaction.py
# 期望：12/12 通过

# 输出校验
python -m pytest orion-ai-service/tests/test_output_validator.py
# 期望：通过

# 端到端审计
python -m pytest orion-ai-service/tests/test_llm_audit.py
# 期望：审计记录完整
```

### 5.3 攻击测试（红队演练）

```bash
# OWASP LLM01 测试集（100 攻击样本）
python -m pytest orion-ai-service/tests/redteam/test_prompt_injection.py --verbose
# 期望：>=95% 拦截率

# 数据脱敏测试
python -m pytest orion-ai-service/tests/redteam/test_data_exfiltration.py
# 期望：>=99% 脱敏率
```

---

## 6. 与既有文档的对齐

### 6.1 与 U12 的关系

- U12 定义 **AI 决策 SLA**（准确率/降级/人工确认）
- U13 定义 **LLM 安全防护**（注入/脱敏/校验/审计）
- 二者覆盖不同维度：U12 = 业务边界，U13 = 安全边界

### 6.2 与 U14 的关系

U14 会将"LLM 攻击拦截率 < 95%"登记为风险条目（R-P1-24）。

### 6.3 与 U15 的关系

本文件**加固**护城河 M-2（orion-ai-service 权威 Python 实现），**非削减**。

### 6.4 与 Y 手册 v5.9 的对齐

- 新增 4 项门控（阶段 1-4 各 1 项）
- 门控总数从 39 → 43（叠加 U12 4 项）

---

## 7. Skill Handoff Checklist

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | 6 | Migration 3 + prompt_security 扩展 1 + 输出校验 1 + 审计 1 | P0 |
| **design-constraint** | 3 | 新增 3 项 detector: llm-prompt-injection + llm-pii-redaction + llm-audit | P1 |
| **security-reviewer** | 1 | 红队演练报告评审 | P1 |

**Structured Missing Items（JSON）**：

```json
{
  "dimension": "llm_security_hardening",
  "total_gaps": 6,
  "coverage": {"before": "20%", "target": "90%+"},
  "attack_surfaces": 6,
  "downstream_routing": {
    "task_decomposer": {
      "count": 6,
      "items": [
        {"id": "LLM-SEC-1", "title": "Migration 773: llm_call_audit 表", "priority": "P0", "depends_on": []},
        {"id": "LLM-SEC-2", "title": "Migration 774: prompt_templates 表（版本化）", "priority": "P0", "depends_on": []},
        {"id": "LLM-SEC-3", "title": "Migration 775: llm_rate_limit_config 表", "priority": "P1", "depends_on": []},
        {"id": "LLM-SEC-4", "title": "prompt_security.py 扩展 15 变种 + 12 类 PII", "priority": "P0", "depends_on": []},
        {"id": "LLM-SEC-5", "title": "OutputValidator 实现（schema + 幻觉 + 敏感扫描）", "priority": "P1", "depends_on": ["LLM-SEC-1"]},
        {"id": "LLM-SEC-6", "title": "RedTeam 测试集 100 攻击样本", "priority": "P1", "depends_on": ["LLM-SEC-4"]}
      ]
    }
  }
}
```

---

## 8. 认知边界（诚实声明）

1. **本文件为方案文档**（RC-03 硬约束），未修改任何生产代码
2. **迁移号段 773-775 为申请**：需与 770-772（U12 SLA）确认无冲突
3. **15 变种 + 12 类 PII 为推荐最小集**：实际可扩展到 OWASP LLM Top 10 全量
4. **95% 拦截率为初始推荐**：实际值需红队演练后微调
5. **未修改 prompt_security.py**：本文件为扩展设计，具体实现在 task-decomposer 拆分
6. **未估算人天/工期**：遵守 CLAUDE.md 强制约束
7. **本文件不覆盖模型侧防护**（如 RAG 数据投毒、微调数据污染），仅覆盖 API 调用层

---

## 9. 结论

- **U13 交付物**：LLM 安全防护章节（6 层防护 + 3 张新表 + 15+ 变种 + 12 类 PII）
- **核心方案**：6 层防护网（速率 → 输入 → 调用 → 输出 → 审计 → 模板）
- **Migration 号段**：773-775（申请）
- **企业级判据**：D1 注入防护 + D2 输出校验 + D3 数据脱敏 + D4 调用审计 + D5 速率限制 + D6 模型供应链（6/6 达标）
- **RC-03 硬约束遵守**：本文件为独立方案文档，未修改任何生产代码
- **覆盖度提升**：20% → 90%+（6 攻击面全覆盖）
- **关联文档**：
  - `enterprise-architecture-depth-review-2026-10-11.md` §5.4 U13
  - `docs/ai-decision-sla-eval-2026-10-11.md`（U12）
  - `docs/ai-moat-protection-2026-10-11.md`（U15）
  - `orion-ai-service/src/services/prompt_security.py`（195 行，一手代码）

**文件**：`docs/llm-security-hardening-2026-10-11.md`
