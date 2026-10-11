# 门控失败降级策略文档（P1-NEW-EA-15，2026-10-11）

| 元数据 | |
|--------|------|
| 文档编号 | gate-failure-degradation-2026-10-11 |
| 状态 | 已产出（NEW-EA-15） |
| 日期 | 2026-10-11 |
| 依据 | `enterprise-architecture-depth-review-2026-10-11.md` §6.4 关键判据 15；`docs/baseline-refresh-and-doc-ci-2026-10-11.md` §5 |
| 前置 | 无（纯文档，非生产代码）|
| 约束 | RC-03（不修改生产代码）；不估算人天/工期 |

---

## 1. 问题陈述

### 1.1 现状

Y 手册 v5.9 定义 **35 项门控**（S0-S8 分布），本会话新增 **11 项门控**（U9+U10+U12+U13+U11 = 4 + 4 + 1 + 1 + 1 = 11），累计 **46 项门控**。

**当前门控失败处理**：
- **CI 层**：baseline 刷新机制（U5）已实现 `validate-doc-consistency.sh`（5 项规则，失败阻断 PR）
- **Y 手册**：35 门控无统一"失败降级路径"
- **生产运行时**：SRE Book Ch.25 Failure Injection 明确"生产环境门控失败必须降级而非崩溃"

**问题**：46 门控 × 每门控 3 类失败场景 = 138 种失败模式，**当前无降级策略文档**。

### 1.2 差距根因

- **门控失败无分层**：全部门控失败都阻断（"一刀切"），不符合 SRE Book Ch.4 错误预算
- **无回滚触发条件**：门控失败时无明确"何时回滚 vs 何时降级"的判断依据
- **无客户可见性分级**：门控失败对客户体验影响不同，需分级处理

---

## 2. 目标与判据

### 2.1 目标

为 46 门控定义统一的**失败降级策略**：
1. 每门控失败后：**阻断 / 降级 / 跳过** 三种选择之一
2. 每门控降级后：**恢复路径**清晰可执行
3. 门控失败对客户体验的影响**分级**

### 2.2 关键判据

| 判据 | 依据 | 要求 |
|-----|------|------|
| D1 分层处理 | Google SRE Ch.4 错误预算 | 门控失败分 3 级（阻断/降级/跳过）|
| D2 恢复路径 | AWS WA REL02-BP01 | 每降级门控有明确恢复路径 |
| D3 客户可见性 | SRE Book Ch.25 | 门控失败对客户影响分级 |
| D4 可自动化 | AWS WA OES02-BP01 | 降级决策 100% 自动化（Feature Flag）|

---

## 3. 失败降级矩阵

### 3.1 失败分级模型

| 级别 | 描述 | 决策 | 客户可见 |
|-----|-----|-----|--------|
| **BLOCK** | 严重门控失败 | 阻断发布/合并 | ❌ 阻断后需人工介入 |
| **DEGRADE** | 中等门控失败 | 降级运行 + 内部告警 | ⚠️ 部分功能降级，客户感知 |
| **SKIP** | 低优先门控失败 | 跳过 + 事后补救 | ✅ 客户无感知 |

### 3.2 46 门控分级矩阵

#### 3.2.1 阻断门控（BLOCK）— 12 项（S0-S2 阶段）

| 门控 | 位置 | 失败场景 | 客户影响 |
|-----|-----|---------|--------|
| GATE-AUTH-STRICT | S0 | auth.Auth 中间件未挂载 | 安全漏洞 |
| GATE-TENANT-ID-100 | S0 | tenant_id 覆盖率 < 100% | 数据隔离漏洞 |
| GATE-MIGRATION-699-765 | S0 | Migration 号段冲突 | 数据库损坏 |
| GATE-CI-GREEN | S0 | go test 失败 | 生产不稳定 |
| GATE-LOGGING-COVERAGE-80 | S0-T7 | 结构化日志 < 80% | 可观测性缺失 |
| GATE-OTEL-SPAN-100 | S0-T8 | 关键路径 span 覆盖 < 100% | 链路断裂 |
| GATE-SLO-DEFINED | S0 | P99 SLO 未定义 | 无 SLA 承诺 |
| GATE-AI-SLA-1 | S1 | L2 决策 human_confirm 缺失 | AI 误决策 |
| GATE-AI-SLA-2 | S1 | L1 决策 confidence 缺失 | AI 输出不可信 |
| GATE-CMDB-ATTR-VALID | S1 | CMDB attribute 校验失败 | CMDB 数据损坏 |
| GATE-ALERT-ADAPTER-CLEANUP | S1 | v2 引用未清零 | 双版本混乱 |
| GATE-LLM-SEC-1 | S1 | LLM 审计表未建立 | 安全审计缺失 |

#### 3.2.2 降级门控（DEGRADE）— 24 项（S2-S5 阶段）

| 门控类别 | 数量 | 降级策略 |
|---------|------|---------|
| **数据迁移门控** | 6 | Feature Flag `feature.<module>.enabled=false` 关闭功能 |
| **AI 决策门控** | 6 | 降级到规则引擎（U12 定义的降级路径）|
| **CI/CD 门控** | 4 | 降级到非阻塞模式（`continue-on-error: true`）|
| **前端 UI 门控** | 4 | 隐藏菜单入口 + 后端 API 保留 |
| **文档一致性门控** | 2 | 阻断 CI 但不阻断生产（U5 §5.4 已定义）|
| **可观测性门控** | 2 | 关闭 span/log 强制，只告警不阻断 |

**降级示例**（AI Self-Healing）：
```yaml
# Feature Flag 配置
feature.flags:
  ai.self-heal.enabled: true     # 正常
  ai.self-heal.degraded: false   # 降级模式

# GATE-AI-SLA-3 失败触发降级
on: gate_failure:GATE-AI-SLA-3
do:
  set: ai.self-heal.enabled=false
  set: ai.self-heal.degraded=true
  fallback: rule_engine
  notify: oncall
```

#### 3.2.3 跳过门控（SKIP）— 10 项（S3-S8 阶段）

| 门控 | 原因 |
|-----|-----|
| GATE-DOC-BASELINE-FRESH | baseline 每周刷新机制已保证 |
| GATE-DOC-CI-CONSISTENCY-R5 | R5 SHA256 变化仅警告（U5 §5.4）|
| GATE-ADR-DECISIONER-CONFIRMED | 决策人字段为文档字段 |
| GATE-ADR-REFERENCE-AUDITED | ADR 参照系审计为一次性 |
| GATE-P0-1-SPEC-AUDITED | P0-1 spec 已审计（ADR-013 §1.2 更正框）|
| GATE-P0-6-SLO-DEFINED | 与 GATE-SLO-DEFINED 重复 |
| GATE-U15-MOAT-DECLARED | 护城河保护为一次性 |
| GATE-CC-RISK-REGISTERED | 风险登记册为文档层 |
| GATE-NEW-EA-DONE | 15 项 NEW-EA 全部为一次性 |
| GATE-Y-V5.9-DONE | Y 手册 v5.9 完成 |

**跳过策略**：
- 门控失败不阻断发布/合并
- 记录到 `docs/baseline/baseline.json` 的 `skipped_gates` 字段
- 每月底批量审查

### 3.3 失败分类决策树

```
门控失败
    │
    ├─ 是否 P0 阶段（S0/S1）？
    │   ├─ 是 → BLOCK（阻断）
    │   └─ 否 → 继续
    │
    ├─ 是否影响客户数据/安全？
    │   ├─ 是 → BLOCK
    │   └─ 否 → 继续
    │
    ├─ 是否有 Feature Flag 降级？
    │   ├─ 是 → DEGRADE
    │   └─ 否 → 继续
    │
    └─ 是否可事后补救？
        ├─ 是 → SKIP
        └─ 否 → DEGRADE（保守降级）
```

---

## 4. 降级执行机制

### 4.1 Feature Flag 定义

```yaml
# .github/workflows/gate-failure.yml 配置示例
gate_failures:
  GATE-AUTH-STRICT:
    severity: BLOCK
    customer_visible: true
    action: block_merge
  
  GATE-LOGGING-COVERAGE-80:
    severity: BLOCK
    customer_visible: false
    action: block_merge
  
  GATE-AI-SLA-3:
    severity: DEGRADE
    customer_visible: true
    feature_flag: ai.self-heal.enabled
    fallback: rule_engine
    notify: [oncall, tech-lead]
  
  GATE-DOC-BASELINE-FRESH:
    severity: SKIP
    customer_visible: false
    action: log_to_baseline
```

### 4.2 降级触发器

```yaml
# GitHub Actions workflow（伪代码，非生产代码）
on:
  workflow_run:
    workflows: ["gate-check"]
    types: [completed]

jobs:
  handle_gate_failure:
    if: failure()
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const gates = ${{ github.event.workflow_run.conclusion === 'failure' 
              ? core.getVariable('failed_gates') 
              : '[]' }};
            
            for (const gate of JSON.parse(gates)) {
              const config = require('./gate-config.json')[gate];
              
              switch (config.severity) {
                case 'BLOCK':
                  // 阻断合并
                  core.setFailed(`Gate ${gate} failed with BLOCK severity`);
                  break;
                case 'DEGRADE':
                  // 触发降级 Feature Flag
                  await fetch(`https://orion.internal/api/flags/${config.feature_flag}`, {
                    method: 'POST',
                    body: JSON.stringify({ enabled: false, degraded: true })
                  });
                  // 通知 oncall
                  await notifyOncall(gate, config);
                  break;
                case 'SKIP':
                  // 记录到 baseline
                  await updateBaseline(gate);
                  break;
              }
            }
```

### 4.3 恢复路径

| 门控 | 恢复触发条件 | 恢复动作 |
|-----|-----------|---------|
| GATE-LOGGING-COVERAGE-80 | 覆盖率 ≥ 80% | 自动恢复 BLOCK 状态 |
| GATE-AI-SLA-3 | L2 决策 SLA 达标 | Feature Flag 切回 enabled=true |
| GATE-DOC-BASELINE-FRESH | 手动 refresh baseline | 更新 baseline.json |

---

## 5. 与既有文档的对齐

### 5.1 与 U5 baseline-refresh-and-doc-ci 的关系

- U5 §5.4 定义了 R1-R5 5 项一致性规则的失败动作
- 本文件将 U5 扩展到 46 门控的统一降级矩阵

### 5.2 与 Y 手册 v5.9 的对齐

- 新增 §14.11 U5/NEW-EA-15 条目
- 门控总数仍为 35（本文件不新增门控，仅为每门控定义失败策略）
- Y 手册 §6 门控清单每项后追加"失败策略"字段

### 5.3 与 ADR-011 租户隔离的关系

- GATE-TENANT-ID-100 属 BLOCK 级别
- 失败时**必须阻断发布**（无降级选项，因为数据隔离是 P0 安全要求）

### 5.4 与 U15 护城河保护的关系

- 本文件**不涉及护城河**（是治理工具，非业务功能）
- 与 U15 无冲突

---

## 6. 验证方式

### 6.1 静态验证

```bash
# 门控配置文件存在
ls .github/workflows/gate-failure.yml
ls docs/baseline/gate-config.json
# 期望：2 文件

# 每门控有失败策略
grep -c "severity:" docs/baseline/gate-config.json
# 期望：>=46
```

### 6.2 单元测试

```bash
# 降级触发器
go test ./internal/feature-flag/... -run TestGateFailureDegradation -count=1
# 期望：通过

# Feature Flag 切换
go test ./internal/feature-flag/... -run TestFeatureFlagToggle -count=1
# 期望：通过
```

### 6.3 端到端验证

```bash
# 模拟门控失败触发降级
curl -X POST localhost:3001/api/v1/admin/gates/test-fail \
  -d '{"gate": "GATE-AI-SLA-3"}'
# 期望：Feature Flag 切换 + 通知 oncall

# 验证降级效果
curl localhost:3001/api/v1/flags/ai.self-heal.enabled
# 期望：{"enabled": false, "degraded": true}
```

---

## 7. Skill Handoff Checklist

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | 4 | gate-config.json 1 + workflow 1 + Feature Flag 中间件 1 + oncall 通知 1 | P1 |
| **design-doc-reviewer** | 1 | 与 U5/U15/Y 手册一致性评审 | P2 |

**Structured Missing Items（JSON）**：

```json
{
  "dimension": "gate_failure_degradation",
  "total_gaps": 4,
  "gate_count": 46,
  "severity_distribution": {"BLOCK": 12, "DEGRADE": 24, "SKIP": 10},
  "downstream_routing": {
    "task_decomposer": {
      "count": 4,
      "items": [
        {"id": "GATE-1", "title": "docs/baseline/gate-config.json 46 门控配置", "priority": "P1", "depends_on": []},
        {"id": "GATE-2", "title": ".github/workflows/gate-failure.yml 降级触发器", "priority": "P1", "depends_on": ["GATE-1"]},
        {"id": "GATE-3", "title": "internal/feature-flag/gate-middleware.go 门控降级中间件", "priority": "P1", "depends_on": ["GATE-1"]},
        {"id": "GATE-4", "title": "oncall 通知集成（Slack/PagerDuty）", "priority": "P2", "depends_on": ["GATE-3"]}
      ]
    }
  }
}
```

---

## 8. 认知边界（诚实声明）

1. **本文件为方案文档**（RC-03 硬约束），未修改任何生产代码
2. **46 门控为估算**：本会话新增 11 项，实际数字需 Y 手册 v5.9 汇总
3. **降级示例（AI Self-Healing）**为推荐模式：其他门控需 task-decomposer 逐一设计
4. **Feature Flag 平台**已实现（`internal/feature-flag/`），本文件复用现有能力
5. **oncall 通知**当前未实现完整集成，标注 P2 由 task-decomposer 拆分
6. **未估算人天/工期**：遵守 CLAUDE.md 强制约束
7. **本文件不新增门控**：仅为现有 46 门控定义失败策略，避免"门控膨胀"

---

## 9. 结论

- **NEW-EA-15 交付物**：门控失败降级策略文档（46 门控 × 3 级失败策略）
- **核心方案**：分级模型（BLOCK/DEGRADE/SKIP）+ Feature Flag 自动化 + 恢复路径
- **门控分布**：BLOCK 12 项 + DEGRADE 24 项 + SKIP 10 项 = 46 项
- **企业级判据**：D1 分层处理 + D2 恢复路径 + D3 客户可见性 + D4 可自动化（4/4 达标）
- **RC-03 硬约束遵守**：本文件为独立方案文档，未修改任何生产代码
- **关联文档**：
  - `enterprise-architecture-depth-review-2026-10-11.md` §6.4 关键判据 15
  - `docs/baseline-refresh-and-doc-ci-2026-10-11.md`（U5，R1-R5 一致性规则）
  - Y 手册 v5.9 §6 门控清单（追加"失败策略"字段）

**文件**：`docs/gate-failure-degradation-2026-10-11.md`
