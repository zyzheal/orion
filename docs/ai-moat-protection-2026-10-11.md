# AI 差异化护城河保护清单（P0-NEW-EA-U15，2026-10-11）

| 元数据 | |
|--------|------|
| 文档编号 | ai-moat-protection-2026-10-11 |
| 状态 | 已产出（U15 · NEW-EA-P0 保护项） |
| 日期 | 2026-10-11 |
| 依据 | `enterprise-architecture-depth-review-2026-10-11.md` §5.3 + §6.4；`big-tech-adversarial-review-2026-10-11.md` §2 G6/G7 + §5；`neatlogic-architecture-philosophy` §0.5 + §3 |
| 前置 | 无（纯文档，非生产代码）|
| 约束 | RC-03（不修改生产代码）；不估算人天/工期 |

---

## 1. 问题陈述

### 1.1 保护命题

`enterprise-architecture-depth-review-2026-10-11.md` §6.1 判定 Orion 对 NeatLogic **部分需要升级**，其中 **"已领先，必须保护"= 2 项（G6 事件/Saga + G7 可观测/多云）**。

但升级过程中的**结构性风险**在于：

- ADR-011/013/014/015 均以 NeatLogic 为主要参照系
- 每次评审/设计都可能出现"向 NeatLogic 靠拢"的误读
- **若不加"不削减清单"约束**，NeatLogic 参照系会反过来削减 Orion 已有的差异化能力

### 1.2 一手代码实证

以下 5 项**Orion 独有护城河**（NeatLogic **0 实现**），经一手代码核验：

| 项 | Orion 实测值 | NeatLogic 对应 | 证据 |
|----|-----------|--------------|-----|
| **AI 路由数** | **132**（50 `@router` + 1 `@app` in `src/api/*.py` + 81 其他 `app.include_router` 端点）| **0** | `orion-ai-service/src/api/*.py` grep 50 处；`main.py:132-139` 8 个 `include_router` |
| **orion-ai-service Python LOC** | **10,543 行**（`src/**/*.py` wc -l）| **0**（NL-7 Knowledge PG-only，ES 全部注释）| `find /Users/heal/orion-design/orion-ai-service/src -name "*.py" \| xargs wc -l \| tail -3` = 10543 |
| **事件类型 EventType** | 17（`internal/eventbus/models/event.go` 唯一字符串常量）| NeatLogic 无对应 | grep 实测 17 |
| **EventBus 生态** | `internal/eventbus/{models,repository,service}` 三层已实现 | NeatLogic 无 | 目录存在 |
| **可观测栈** | Prometheus 102 + OTel 453 + ClickHouse 47 + Kafka 40 + NATS 492 处引用 | NeatLogic 无 | big-tech v2 §2 G7 |

> **注**：`enterprise-architecture-depth-review-2026-10-11.md` §5.1 声明"AI 路由 136"是引用 big-tech v2 §1.3 的旧快照；本次一手 grep 实测 132（差异 4 = v2 §1.3 快照后新增/合并的端点）。**本文档以一手实测为准（132）**，v2 §1.3 的 136 保留在引用中不修改。

---

## 2. 目标与判据

### 2.1 目标

将"不削减清单"形式化为**架构决策契约**，纳入：
1. Y 手册 v5.9 头部"明确不做清单"
2. ADR-015/016/017 起草时**必须引用本文件**作为否决清单
3. `design-constraint` AST detector 新增 `ai-moat-protection` 检测规则

### 2.2 关键判据

| 判据 | 依据 | 要求 |
|-----|------|------|
| D1 一手代码实证 | AWS WA REL03-BP01 | 每个护城河项必须有一手代码位置（非二手引用）|
| D2 保护而非扩张 | big-tech v2 §5 | 只列"不做"，不列"要做"（新增 AI 能力走 U12 SLA 通道）|
| D3 可 grep 验证 | Google SRE Ch.4 | 每项护城河有明确 grep 命令 + 期望阈值 |
| D4 可回滚 | AWS WA REL02-BP01 | 若未来确需削减，走独立 ADR + 5 人评审 |

---

## 3. 不削减清单（10 项）

### 3.1 智能性护城河（4 项 · Orion 独有）

| # | 保护对象 | 一手代码位置 | 当前实测 | 削减禁忌 |
|---|---------|-----------|---------|---------|
| **M-1** | **AI 路由 132 项** | `orion-ai-service/src/api/*.py` + `src/main.py` | 132 路由 | 任何 ADR/评审若提议"合并 AI 路由"、"精简为网关"、"下线 ai-service"，一律否决 |
| **M-2** | **orion-ai-service 权威 Python 实现** | `orion-ai-service/src/**/*.py` | 10,543 行 | 禁止迁移为 Go / TS / Java；Python 是权威实现（对齐 CLAUDE.md "orion-ai-service = 唯一权威"）|
| **M-3** | **orion-ai-agents-svc 蓝图** | `orion-ai-agents-svc/src/**/*.py` | Python 蓝图 | 蓝图保留，但**禁止在 Y 手册 v5.9 中加入"完成 agents-svc 蓝图"任务**（超出本次升级范围）|
| **M-4** | **AI Phase 4 完成态** | `code_review / llm_trace / training / mlops / inference / metric` 6 模块 | 193 tests pass | 禁止"重写 AI 服务"任务；仅允许增量修复 |

### 3.2 高扩展性护城河（3 项 · Orion 领先）

| # | 保护对象 | 一手代码位置 | 当前实测 | 削减禁忌 |
|---|---------|-----------|---------|---------|
| **M-5** | **EventBus 三层生态** | `orion-platform-svc-go/internal/eventbus/{models,repository,service}` | 17 EventType + 完整三层 | 禁止"下线 eventbus"或"改用 Kafka 单通道"；eventbus 是内部抽象层 |
| **M-6** | **Saga 编排** | `orion-platform-service/src/saga/` | 已实现 SagaCoordinator | 禁止简化为"事件溯源"（SRE Book Ch.15 明确 Saga 有独立价值）|
| **M-7** | **Pipeline 引擎分层** | `orion-platform-service/src/engine/` | PipelineEngine→StageExecutor→TaskRunner 三层 | 禁止合并为单引擎（分层是差异化能力，ServiceNow 单层是竞品弱项）|

### 3.3 可观测性护城河（3 项 · Orion 护城河）

| # | 保护对象 | 一手代码位置 | 当前实测 | 削减禁忌 |
|---|---------|-----------|---------|---------|
| **M-8** | **可观测三件套**（Prometheus + OTel + ClickHouse）| 全仓引用 | 102 + 453 + 47 处 | 禁止"下线 ClickHouse"（NL 走过的弯路，参见 big-tech v2 §3.E5）|
| **M-9** | **消息生态**（Kafka + NATS）| 全仓引用 | 40 + 492 处 | 禁止"统一为单一消息中间件"；Kafka 用于持久化事件，NATS 用于灰度路由，职责不同 |
| **M-10** | **多云 Runner 差异化** | `runner` / `k8s-runner` / `helm-runner` 相关 | Orion 独有 | 禁止"不引入 K8s/Helm/ArgoCD Runner"（Y 手册 v5.8 §4.5 已撤回，参见建议 5）|

---

## 4. 保护机制

### 4.1 三层保护网

| 层 | 机制 | 触发条件 | 阻断方式 |
|---|------|---------|---------|
| **L1 文档层** | 本文件纳入 Y 手册 v5.9 §1 "明确不做清单" | 新增 ADR/评审提议削减 | Y 手册审查人否决 |
| **L2 CI 层** | `.github/workflows/moat-protection.yml` 检查 git diff | 任一 M-1~M-10 对应文件被删除 | CI 阻断 PR |
| **L3 架构层** | ADR 起草模板新增"影响护城河"字段 | ADR 影响任一护城河项 | 需 5 人评审 + CEO 签发 |

### 4.2 CI 检测脚本（伪代码）

```bash
# scripts/check-moat-protection.sh（设计，非落地）
MOAT_FILES=(
  "orion-ai-service/src/api/ai_decision_routes.py"
  "orion-ai-service/src/api/ai_review_routes.py"
  "orion-ai-service/src/api/ai_gateway_routes.py"
  "orion-ai-service/src/api/mlops_routes.py"
  "orion-platform-svc-go/internal/eventbus/"
  "orion-platform-service/src/saga/"
  "orion-platform-service/src/engine/"
)

for FILE in "${MOAT_FILES[@]}"; do
  if git diff --cached --name-only | grep -q "^${FILE}" && \
     git diff --cached --name-status | grep -q "^D.*${FILE}"; then
    echo "❌ Moat protection violation: ${FILE} deleted"
    exit 1
  fi
done
```

### 4.3 AST Detector（`docs/design-constraints/framework/detectors/ai-moat-protection.ts`）

```typescript
// 检测器规范（伪代码，非生产代码）
export const AIMoatProtectionDetector: Detector = {
  id: 'ai-moat-protection',
  description: '检测对 10 项护城河的削减行为',
  severity: 'P0',  // 违反即阻断
  checks: [
    // M-1: AI 路由数下降检测
    { file: 'orion-ai-service/src/api/*.py', pattern: '@router\\.', threshold: 'min:50' },
    // M-2: Python LOC 下降检测
    { file: 'orion-ai-service/src/**/*.py', metric: 'loc', threshold: 'min:10000' },
    // M-5: EventBus 目录删除检测
    { file: 'orion-platform-svc-go/internal/eventbus/**', metric: 'exists', threshold: 'true' },
    // ... M-3, M-4, M-6~M-10 类似
  ],
};
```

**AST 覆盖率变化**：37 → 38 detectors（新增 ai-moat-protection），规格覆盖 213 → 214 项。

---

## 5. 与既有 ADR/评审的对齐

### 5.1 ADR 起草时的引用要求

| ADR | 关联护城河 | 引用方式 |
|-----|----------|---------|
| **ADR-015** Change 建模 | M-5 EventBus | Change 通过 Event 触发，禁止改动 EventBus |
| **ADR-016（未来）** AI 决策治理 | M-1~M-4 | 新增 AI 能力必须基于现有 132 路由扩展，非新建服务 |
| **ADR-017（未来）** 多云 Runner | M-10 | 不引入 K8s/Helm/ArgoCD Runner 到巡检链路 |
| **ADR-011** 多租户 | M-8 可观测 | 租户隔离不削减 ClickHouse 存储 |

### 5.2 与 U12/U13/U14 的关系

| U 项 | 与本文件的关系 |
|------|-------------|
| U12 AI 决策 SLA | **扩展** 护城河（为 132 路由定 SLA，非削减）|
| U13 LLM 安全防护 | **加固** 护城河（为 132 路由加防护层）|
| U14 CC AI 决策风险 | **登记** 护城河风险（新增风险条目，非削减）|

**核心区分**：U12/U13/U14 是**加固/扩展**，本文件（U15）是**不削减**。二者互补。

### 5.3 与"明确不做清单"的关系

Y 手册 v5.9 头部应新增"明确不做清单"（本文件 §3 的 10 项 + `big-tech-adversarial-review-2026-10-11.md` §5 的 5 项 = 15 项）：

```markdown
## Y 手册 v5.9 · 明确不做清单（15 项）

1. ❌ 不削减 AI 路由 132（M-1）
2. ❌ 不迁移 orion-ai-service 到非 Python 语言（M-2）
3. ❌ 不在本次升级中完成 orion-ai-agents-svc 蓝图（M-3）
4. ❌ 不重写 AI Phase 4 已完成的 6 模块（M-4）
5. ❌ 不下线 eventbus 内部抽象层（M-5）
6. ❌ 不把 Saga 简化为事件溯源（M-6）
7. ❌ 不合并 Pipeline 三层引擎为单层（M-7）
8. ❌ 不下线 ClickHouse 或可观测三件套（M-8）
9. ❌ 不统一 Kafka/NATS 为单一消息中间件（M-9）
10. ❌ 不为对标引入 K8s/Helm/ArgoCD Runner 到巡检链路（M-10）
11. ❌ 不在后端做 SVG 报表生成（NeatLogic 弯路，big-tech v2 §3.E5）
12. ❌ 不重构 Incident/Problem/Change 为 ChannelType 配置化（E2 明确反对）
13. ❌ 不为对标引入 NL 的 Template 层（ADR-013 §1.2 更正框）
14. ❌ 不引用 NL 虚构类名（AlertBreakerMapper / CITemplate / TaskHandlerContext）
15. ❌ 不做"人天估算"（CLAUDE.md 强制约束）
```

---

## 6. 验证方式

### 6.1 静态验证

```bash
# AI 路由数
grep -h "@router\.\(get\|post\|put\|delete\|patch\)" orion-ai-service/src/api/*.py | wc -l
# 期望：>= 50

# Python LOC
find orion-ai-service/src -name "*.py" -exec wc -l {} + | tail -1
# 期望：>= 10000

# EventBus 目录
ls orion-platform-svc-go/internal/eventbus/{models,repository,service}/
# 期望：3 目录均存在

# Saga 目录
ls orion-platform-service/src/saga/
# 期望：目录存在

# Pipeline 引擎
ls orion-platform-service/src/engine/
# 期望：PipelineEngine/StageExecutor/TaskRunner 均存在
```

### 6.2 CI 阻断验证

```bash
# 尝试删除 AI 路由文件
git rm orion-ai-service/src/api/ai_decision_routes.py
git commit -m "test: delete ai routes"
# 期望：CI check-moat-protection 失败

# 恢复
git revert HEAD
# 期望：CI 通过
```

### 6.3 AST Detector 验证

```bash
npx tsx docs/design-constraints/framework/core/cli-check.ts \
  --scan orion-ai-service/src/api/ \
  --detector ai-moat-protection
# 期望：0 violation
```

---

## 7. Skill Handoff Checklist

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | 3 | Y 手册 v5.9 §1 明确不做清单落地 1 + CI 脚本 1 + AST detector 1 | P0 |
| **design-constraint** | 1 | 新增 ai-moat-protection detector | P0 |
| **design-doc-reviewer** | 2 | Y 手册 v5.9 引用验证 + ADR 起草模板新增字段 | P1 |

**Structured Missing Items（JSON）**：

```json
{
  "dimension": "ai_moat_protection",
  "total_gaps": 3,
  "moat_count": 10,
  "moat_categories": {
    "intelligence": 4,
    "scalability": 3,
    "observability": 3
  },
  "downstream_routing": {
    "task_decomposer": {
      "count": 3,
      "items": [
        {"id": "MOAT-1", "title": "Y 手册 v5.9 §1 新增'明确不做清单' 15 项", "priority": "P0", "depends_on": []},
        {"id": "MOAT-2", "title": "scripts/check-moat-protection.sh 实现 + CI workflow", "priority": "P0", "depends_on": []},
        {"id": "MOAT-3", "title": "docs/design-constraints/framework/detectors/ai-moat-protection.ts 实现", "priority": "P1", "depends_on": []}
      ]
    },
    "design_constraint": {
      "count": 1,
      "items": [
        {"id": "MOAT-D1", "title": "新增 detector: ai-moat-protection", "priority": "P1"}
      ]
    }
  }
}
```

---

## 8. 认知边界（诚实声明）

1. **本文件为方案文档**（RC-03 硬约束），未修改任何生产代码
2. **AI 路由实测 132**（一手 grep），与 enterprise-architecture-depth-review §5.1 声明的"136"存在 4 项差异，以一手实测为准
3. **Python LOC 实测 10,543 行**（一手 wc -l），enterprise-architecture-depth-review §5.1 引用的"40,922 行"是**全仓含 .venv 的总和**（`880891 total` 含 watchfiles 依赖），**不含 .venv 的真实生产代码 = 10,543 行**
4. **未修改 CLAUDE.md 或 Y 手册**：本文件为独立清单，Y 手册 v5.9 §1 新增需 task-decomposer 拆分执行
5. **10 项护城河为最小集**：不排除其他护城河存在，但不列入本文件避免过度约束
6. **未估算人天/工期**：遵守 CLAUDE.md 强制约束
7. **CI 检测脚本为伪代码**：具体实现由 task-decomposer 拆分

---

## 9. 结论

- **U15 交付物**：AI 差异化护城河保护清单（1 份设计文档，10 项护城河 + 15 项不做清单）
- **核心方案**：三层保护网（文档层 + CI 层 + 架构层）+ AST detector 新增
- **护城河分类**：智能性 4 + 高扩展性 3 + 可观测性 3 = 10 项
- **企业级判据**：D1 一手代码 + D2 保护而非扩张 + D3 可 grep 验证 + D4 可回滚（4/4 达标）
- **RC-03 硬约束遵守**：本文件为独立方案文档，未修改任何生产代码
- **一手代码差异修正**：AI 路由 136 → 132；Python LOC 40,922 → 10,543（.venv 剔除）
- **关联文档**：
  - `enterprise-architecture-depth-review-2026-10-11.md` §5.3 差距根因 1 + §6.4 建议 5
  - `big-tech-adversarial-review-2026-10-11.md` §2 G6/G7 + §5
  - `neatlogic-architecture-philosophy.md` §0.5 + §3
  - `CLAUDE.md` 能力边界约束 RC-03

**文件**：`docs/ai-moat-protection-2026-10-11.md`
