# AI 决策 SLA / 评测集章节（P1-U12 · NEW-EA-10，2026-10-11）

| 元数据 | |
|--------|------|
| 文档编号 | ai-decision-sla-eval-2026-10-11 |
| 状态 | 已产出（U12 · NEW-EA-10） |
| 日期 | 2026-10-11 |
| 依据 | `enterprise-architecture-depth-review-2026-10-11.md` §5.3 差距根因 2 + §5.4 U12 + §6.4 关键判据 10 |
| 前置 | 无（纯文档设计，非生产代码）|
| 约束 | RC-03（不修改生产代码）；不估算人天/工期；不削弱 132 路由（U15 保护）|

---

## 1. 问题陈述

### 1.1 一手代码实证

Orion 现有 **8 类 AI 决策**，全部有生产代码但**无决策 SLA / 评测集 / 人工确认边界 / 降级路径**：

| # | AI 决策 | 一手代码位置 | 决策产出 | 当前状态 |
|---|--------|-----------|---------|---------|
| 1 | **AI Code Review** | `orion-ai-service/src/services/code_review.py`（6 函数）| 代码建议（P0/P1/P2 缺陷、重构建议）| ✅ 已实现，无 SLA |
| 2 | **AI Decision Service** | `orion-ai-service/src/services/decision_service.py`（6 函数）| 通用决策（含 feature importance/confidence）| ✅ 已实现，无 SLA |
| 3 | **AI RCA（Root Cause Analysis）** | `orion-platform-svc-go/internal/rca/service/service.go` | 告警根因假设 | ✅ 已实现，无 SLA |
| 4 | **AI Self-Healing** | `orion-platform-svc-go/internal/self-healing/`（8 文件，含 executor/k8s_executor.go）| 自动修复动作 | ✅ 已实现，无 SLA |
| 5 | **AI Alert Correlation** | `orion-platform-svc-go/internal/alert-correlation/` | 告警聚合/关联 | ✅ 已实现，无 SLA |
| 6 | **AI Knowledge QA** | `orion-ai-service/src/services/ai_gateway.py` + `vector_store.py` | 问答回复 | ✅ 已实现，无 SLA |
| 7 | **AI LLM Trace** | `orion-ai-service/src/services/llm_trace.py` | 调用链分析 | ✅ 已实现，无 SLA |
| 8 | **AI Cost Optimizer** | `orion-ai-service/src/services/cost_optimizer.py` | 成本优化建议 | ✅ 已实现，无 SLA |

### 1.2 差距根因

`enterprise-architecture-depth-review-2026-10-11.md` §5.3 差距根因 2：

> **智能决策层"有代码无契约"**：Auto-heal / Self-healing / code_review / llm_trace / training / mlops 全部已实现，但**每类 AI 决策的"决策边界"未定义**——例如 code_review AI 的"哪些建议人工确认"、self-healing 的"哪些故障允许自动修复、哪些必须人工介入"。这与 AWS WA LLM01-BP01"人工确认门控"直接冲突。

**具体问题**：
- **准确率基线缺失**：AI Code Review 误报率、漏报率无 SLO
- **人工确认边界缺失**：所有 AI 决策都是"要么全自动、要么无自动"，无半自动分档
- **降级路径缺失**：LLM 服务不可用 / 超时 / 幻觉时，无降级到规则引擎的路径
- **评测集缺失**：无独立评测集支撑准确率基线

---

## 2. 目标与判据

### 2.1 目标

为 8 类 AI 决策各定义：**准确率基线 + 人工确认边界 + 降级路径 + 评测集要求**（4 件套）。

### 2.2 关键判据

| 判据 | 依据 | 要求 |
|-----|------|------|
| D1 人工确认门控 | AWS WA LLM01-BP01 | 每类 AI 决策明确"哪些建议人工确认" |
| D2 半自动分档 | 阿里云 AIOps 白皮书 §5.2 | 每类决策分 3 档：辅助建议 / 半自动 / 全自动 |
| D3 降级路径 | Google SRE Ch.25 | LLM 不可用/超时/幻觉 → 降级到规则引擎或人工 |
| D4 可测 SLA | Google SRE Ch.4 | 每类决策有可 grep 的准确率基线（非"感觉不错"）|
| D5 评测集独立 | AWS WA LLM01-BP04 | 评测集与生产数据隔离，禁止污染 |

---

## 3. 8 类 AI 决策 SLA 矩阵

### 3.1 决策分档模型

按阿里云 AIOps 白皮书 §5.2，每类决策分 3 档：

| 档 | 描述 | 人工介入 | 决策权 |
|----|-----|---------|-------|
| **L1 辅助建议** | AI 给出建议，人工决策 | ✅ 必须 | 人工 |
| **L2 半自动** | AI 决策，人工确认后执行 | ✅ 事后 | AI 建议 + 人工执行 |
| **L3 全自动** | AI 决策并执行，人工事后审计 | ❌（事后审计）| AI 决策 + AI 执行 |

### 3.2 8 类决策 SLA 矩阵

| # | 决策 | 分档 | 准确率基线（SLA）| 人工确认边界 | 降级路径 | 评测集要求 |
|---|-----|-----|-------------|-----------|---------|---------|
| **1** | AI Code Review | **L1** | 建议命中率 ≥ 60%，误报率 ≤ 40% | ✅ 所有建议必须人工确认 | LLM 超时 → 降级到 `sonarqube` 静态分析（已有）| 100 PR × 5000 行生产代码样本 |
| **2** | AI Decision Service | **L1** | Confidence ≥ 0.7 才展示 | ✅ 所有决策建议人工确认 | Confidence < 0.7 → 隐藏建议 | 500 决策样本，覆盖 10 业务域 |
| **3** | AI RCA | **L2** | Top-3 根因命中率 ≥ 50% | ⚠️ 高严重度（P0/P1）告警必须人工确认 | LLM 超时 → 降级到 `alert-correlation` 规则引擎 | 500 告警 × 已确认根因对 |
| **4** | AI Self-Healing | **L2** | 修复成功率 ≥ 70%，误修复率 ≤ 5% | ⚠️ **P0 事件必须人工确认**；其他自动 | 修复失败 2 次 → 停止，升级到人工 | 200 故障场景（含成功/失败/边界）|
| **5** | AI Alert Correlation | **L1** | 聚合准确率 ≥ 80% | ✅ 聚合规则变更必须人工确认 | LLM 不可用 → 用 `alert-deduplication` 规则 | 300 天告警历史聚合样本 |
| **6** | AI Knowledge QA | **L2** | QA 准确率 ≥ 70%（人工评分）| ⚠️ 答案 confidence < 0.6 → 显示"不确定" | Vector store 超时 → 返回"离线模式" | 1000 Q&A 对（含边界问题）|
| **7** | AI LLM Trace | **L1** | 调用链分析完整率 ≥ 95% | ✅ 分析报告必须人工审核 | Trace 丢失 → 从 log 重建 | 100 次调用链样本 |
| **8** | AI Cost Optimizer | **L1** | 优化建议采纳率 ≥ 50% | ✅ 所有成本变更必须人工确认 | LLM 不可用 → 用 `finops` 规则引擎 | 200 资源 × 30 天账单样本 |

**统计**：L1 辅助建议 5 项 + L2 半自动 3 项 + L3 全自动 0 项（Orion 当前不做全自动 AI 决策，符合 SRE Book Ch.25 保守策略）。

---

## 4. 每类决策详细设计

### 4.1 AI Code Review（L1 · 辅助建议）

**决策边界**：
- ✅ 允许：代码风格建议、重构建议、明显 bug 提示（空指针/越界/注入）
- ❌ 禁止：自动修改代码、自动合并 PR、决策合并/驳回
- ⚠️ 边界：**"P0 安全漏洞"** → L2（自动创建 Ticket，人工确认）

**降级路径**：
```
LLM 调用失败 → 降级到 sonarqube CLI → 输出规则引擎结果
LLM 超时（>30s）→ 输出"AI 分析暂不可用，建议人工 review"
LLM 幻觉（重复输出/无根据）→ 触发 prompt_security.py 拦截
```

**评测集**：
- 数据源：`orion-platform-svc-go/internal/*/` 2000 个 Go 文件
- 标注：人工标注 200 PR 的真实 bug 与 false-positive
- SLA 度量：`tp / (tp + fp)` ≥ 0.6

**验证命令**：
```bash
# 检查 code_review 服务有 confidence 字段
grep -n "confidence\|score" orion-ai-service/src/services/code_review.py
# 期望：>=2 处

# 检查 code_review API 有"人工确认"字段
grep -n "require_approval\|human_review\|approval" orion-ai-service/src/api/ai_review_routes.py
# 期望：>=1 处
```

### 4.2 AI RCA（L2 · 半自动）

**决策边界**：
- ✅ 允许：P2/P3 告警自动关联根因假设
- ⚠️ 边界：**P0/P1 告警根因必须人工确认**（避免误静默）
- ❌ 禁止：AI 自动静默告警、AI 自动关闭 Incident

**降级路径**：
```
LLM 调用失败 → 降级到 alert-correlation 规则引擎（已有）
LLM 输出非结构化 → 拒绝 + 记录到 llm_trace
Top-3 根因 confidence 均 < 0.4 → 输出"根因不明确，需人工介入"
```

**评测集**：
- 数据源：`orion-platform-svc-go/migrations/` 500 告警样本（含已确认根因）
- SLA 度量：`top3_accuracy / total` ≥ 0.5

**验证命令**：
```bash
# 检查 RCA 有严重度分级
grep -n "severity\|priority\|critical" orion-platform-svc-go/internal/rca/service/service.go
# 期望：>=3 处
```

### 4.3 AI Self-Healing（L2 · 半自动，高风险）

**决策边界**（重点）：
- ✅ 允许自动：容器重启、Pod 重建（幂等操作）
- ⚠️ 边界：**数据修改 / 网络策略变更 / 权限变更** → 强制人工确认
- ❌ 禁止：**P0 事件自动修复**（必须先人工确认为"确认故障"再触发）

**降级路径**：
```
修复失败 2 次 → 停止自动重试 → 升级到人工
LLM 建议含非幂等操作 → 强制人工确认
executor 超时（>60s）→ 取消修复 → 生成 Incident
```

**评测集**：
- 数据源：200 故障场景（100 成功 / 50 失败 / 50 边界）
- SLA 度量：`success_count / total_count` ≥ 0.7

**验证命令**：
```bash
# 检查 self-healing 有 P0 门控
grep -n "priority.*P0\|isCritical\|severity.*critical" \
  orion-platform-svc-go/internal/self-healing/service/service.go
# 期望：>=2 处
```

---

## 5. 迁移与实施

### 5.1 分阶段落地

| 阶段 | 决策范围 | 内容 |
|-----|--------|------|
| 阶段 1 | L2 半自动（3 项）| RCA / Self-Healing / Knowledge QA 加人工确认门控 |
| 阶段 2 | L1 辅助建议（5 项）| Code Review / Decision Service / Alert Correlation / LLM Trace / Cost Optimizer 加 confidence 阈值 |
| 阶段 3 | 评测集独立 | 5 类评测集从生产数据隔离 |
| 阶段 4 | CI 门控 | 每类决策 SLA 加入 Y 手册门控 |

### 5.2 Migration 号段申请

| 号段 | 用途 |
|-----|------|
| **770** | 新增 `ai_decision_audit` 表（决策审计日志，人工确认记录）|
| **771** | 新增 `ai_decision_sla_config` 表（每类决策 SLA 配置，含准确率基线、降级开关）|
| **772** | 新增 `ai_evaluation_dataset` 表（评测集元数据，与生产数据隔离）|

**前置**：769 已申请（cmdb K8s/Script），770-772 为本任务申请，与 ADR-011/013/014/015 分配的 699-765 无冲突。

### 5.3 表结构（Migration 770 示例）

```sql
CREATE TABLE ai_decision_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    decision_type   TEXT NOT NULL,      -- 'code_review' / 'rca' / 'self_heal' / ...
    input_hash      TEXT NOT NULL,      -- 输入 hash（防重放）
    output          JSONB NOT NULL,     -- AI 输出
    confidence      NUMERIC(3,2),       -- 0.00-1.00
    decision_tier   TEXT NOT NULL,      -- 'L1' / 'L2' / 'L3'
    human_confirmed BOOLEAN,            -- 人工确认标记
    confirmed_by    UUID,               -- 人工确认人
    confirmed_at    TIMESTAMPTZ,
    fallback_used   BOOLEAN DEFAULT false,  -- 是否走了降级路径
    fallback_type   TEXT,               -- 'rule_engine' / 'manual' / ...
    created_at      TIMESTAMPTZ DEFAULT now(),
    INDEX idx_audit_tenant_type (tenant_id, decision_type),
    INDEX idx_audit_confidence (confidence)
);

CREATE TABLE ai_decision_sla_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT,               -- NULL = 全局配置
    decision_type   TEXT NOT NULL,
    tier            TEXT NOT NULL,      -- 'L1' / 'L2' / 'L3'
    accuracy_sla    NUMERIC(4,2) NOT NULL,  -- 0.60 = 60%
    fallback_enabled BOOLEAN DEFAULT true,
    human_confirm_required BOOLEAN DEFAULT false,
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, decision_type)
);

CREATE TABLE ai_evaluation_dataset (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    decision_type   TEXT NOT NULL,
    dataset_url     TEXT NOT NULL,      -- S3/对象存储 URL
    record_count    INTEGER NOT NULL,
    labeler_id      UUID,               -- 标注人
    version         TEXT NOT NULL,      -- 版本号
    frozen_at       TIMESTAMPTZ NOT NULL,  -- 冻结时间（禁止污染）
    UNIQUE(tenant_id, decision_type, version)
);
```

---

## 6. 与既有文档的对齐

### 6.1 与 U13 LLM 安全防护的关系

| 项 | U12（本文件）| U13 |
|----|-----------|-----|
| 范围 | AI 决策**业务边界** | LLM **安全防护** |
| 关注 | 准确率/降级/人工确认 | prompt 注入/输出校验/数据脱敏 |
| 互补 | U12 定"什么时候用 AI"，U13 定"用 AI 时怎么防注入" | 反之 |

### 6.2 与 U14 CC 风险登记的关系

U14 会将 8 类决策的准确率未达 SLA 登记为风险条目（R-P1-20~23），本文件定义 SLA 值。

### 6.3 与 U15 护城河保护的关系

- 本文件**扩展**护城河（为 132 路由加 SLA），**非削减**
- 与 U15 M-1/M-2/M-3/M-4 完全对齐

### 6.4 与 Y 手册 v5.9 的对齐

- 新增 §14.11 U12 条目
- 新增 4 项门控（阶段 1-4 每阶段 1 项）
- 门控总数从 35 → 39

---

## 7. 验证方式

### 7.1 静态验证

```bash
# 检查 confidence 字段
grep -rn "confidence" orion-ai-service/src/services/*.py | wc -l
# 期望：>=8（8 类服务各至少 1 处）

# 检查人工确认字段
grep -rn "human_confirm\|require_approval\|approval" orion-ai-service/src/services/*.py
grep -rn "human_confirm\|approval" orion-platform-svc-go/internal/{rca,self-healing}/service/*.go
# 期望：>=3 处

# Migration
ls orion-platform-svc-go/migrations/77[0-2]_*.sql
# 期望：3 文件
```

### 7.2 单测验证

```bash
# AI 决策审计表
go test ./internal/ai-audit/... -run TestAIDecisionAudit -count=1
# 期望：通过

# SLA 配置读取
go test ./internal/ai-audit/... -run TestSLAConfig -count=1
# 期望：读取 8 类配置成功

# 降级路径
go test ./internal/ai-audit/... -run TestFallbackPath -count=1
# 期望：LLM 失败降级到 rule_engine
```

### 7.3 CI 门控（新增 4 项）

| 门控 | 阶段 | 通过标准 |
|-----|------|---------|
| GATE-AI-SLA-1 | 阶段 1 | L2 三项决策 human_confirm_required = true |
| GATE-AI-SLA-2 | 阶段 2 | L1 五项决策 confidence 字段存在 |
| GATE-AI-SLA-3 | 阶段 3 | 8 类评测集均存在且冻结 |
| GATE-AI-SLA-4 | 阶段 4 | 生产 SLA 达标（准确率 >= SLA 值）|

---

## 8. Skill Handoff Checklist

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | 6 | Migration 3 + 8 类决策加 confidence/human_confirm 3 | P0 |
| **design-constraint** | 2 | 新增 detector: ai-decision-boundary + ai-decision-sla | P1 |
| **design-doc-reviewer** | 1 | 与 U13/U14/U15 一致性评审 | P2 |

**Structured Missing Items（JSON）**：

```json
{
  "dimension": "ai_decision_sla_eval",
  "total_gaps": 6,
  "ai_decision_count": 8,
  "tier_distribution": {"L1": 5, "L2": 3, "L3": 0},
  "downstream_routing": {
    "task_decomposer": {
      "count": 6,
      "items": [
        {"id": "AI-SLA-1", "title": "Migration 770: ai_decision_audit 表", "priority": "P0", "depends_on": []},
        {"id": "AI-SLA-2", "title": "Migration 771: ai_decision_sla_config 表", "priority": "P0", "depends_on": []},
        {"id": "AI-SLA-3", "title": "Migration 772: ai_evaluation_dataset 表", "priority": "P1", "depends_on": []},
        {"id": "AI-SLA-4", "title": "L2 三项（RCA/Self-Heal/Knowledge QA）加 human_confirm 字段", "priority": "P0", "depends_on": ["AI-SLA-1"]},
        {"id": "AI-SLA-5", "title": "L1 五项加 confidence 阈值逻辑", "priority": "P1", "depends_on": ["AI-SLA-2"]},
        {"id": "AI-SLA-6", "title": "8 类评测集独立存储", "priority": "P1", "depends_on": ["AI-SLA-3"]}
      ]
    }
  }
}
```

---

## 9. 认知边界（诚实声明）

1. **本文件为方案文档**（RC-03 硬约束），未修改任何生产代码
2. **SLA 值（60% / 50% / 70% 等）为初始推荐**：实际值需根据生产数据微调
3. **迁移号段 770-772 为申请**：需与 766-769（Ticket 污染 + K8s 桩）确认无冲突
4. **未修改 132 路由**：本文件扩展 SLA，不改动路由本身（符合 U15 护城河保护）
5. **未估算人天/工期**：遵守 CLAUDE.md 强制约束
6. **评测集规模（100/200/500 等）为推荐值**：实际规模需根据标注成本调整
7. **本文件不覆盖"AI 决策自动执行"**：Orion 当前全为 L1/L2，无 L3 全自动（符合 Google SRE Ch.25 保守策略）

---

## 10. 结论

- **U12 交付物**：AI 决策 SLA/评测集章节（8 类决策 × 4 件套 = 32 项契约）
- **核心方案**：3 档分级（L1/L2/L3，Orion 只用 L1/L2）+ 8 类决策各自 SLA/边界/降级/评测集
- **Migration 号段**：770-772（申请）
- **企业级判据**：D1 人工确认 + D2 半自动分档 + D3 降级路径 + D4 可测 SLA + D5 评测集独立（5/5 达标）
- **RC-03 硬约束遵守**：本文件为独立方案文档，未修改任何生产代码
- **关联文档**：
  - `enterprise-architecture-depth-review-2026-10-11.md` §5.3 差距根因 2 + §5.4 U12
  - `docs/ai-moat-protection-2026-10-11.md`（U15，护城河保护）
  - `docs/llm-security-hardening-2026-10-11.md`（U13，LLM 防护，本任务同步产出）
  - `reports/module-upgrade-designs/risk-fallback-design-2026-10-03.md`（U14 修改目标）

**文件**：`docs/ai-decision-sla-eval-2026-10-11.md`
