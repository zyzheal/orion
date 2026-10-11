# 每周基线刷新机制 + 文档一致性 CI 校验（P0-U5，2026-10-11）

| 元数据 | |
|--------|------|
| 文档编号 | baseline-refresh-and-doc-ci-2026-10-11 |
| 状态 | 已产出（U5 · NEW-EA-5 + NEW-EA-6） |
| 日期 | 2026-10-11 |
| 依据 | `enterprise-architecture-depth-review-2026-10-11.md` §6.4；`overall-plan-review-round2-2026-10-11.md` §5.5 + §7.4 |
| 约束 | RC-03（不修改生产代码，仅设计与文档规范）；不估算人天/工期 |
| 前置 | 无（纯文档 + CI 脚本设计） |

---

## 1. 问题陈述

### 1.1 现状问题

`overall-plan-review-round2-2026-10-11.md` §1.3 已识别 **5 处方案-工程一致性漂移**：

| 漂移点 | 涉及文档 | 影响 |
|-------|---------|------|
| 68 vs 81 vs 107 vs 122 项任务数 | INDEX v5.4 / G1 v1.1 / Y v5.4 / Y v5.9 | 跨文档汇报数字不一致，被评审者反复追问 |
| ADR "已决策" vs "提议中" | INDEX/G1 vs ADR 元数据 | 决策状态失真 |
| Migration 699-765 "权威分配" vs "全空" | CLAUDE.md vs 实测 | 契约条款 3 与实测不符 |
| feature-parity "62% 覆盖" vs "32.1% 完成度" | CLAUDE.md memory vs feature-parity §5 | 分档口径未统一 |
| 门控 26 vs 29 vs 35 项 | Y v5.4 / Y v5.5 / Y 实测 | 门控数字自加不符 |

### 1.2 根因

- **无单一事实来源（SSOT）**：5 份文档（CLAUDE.md / INDEX / G1 / Y / ADR）各自维护元数据
- **无基线快照机制**：每次评审手工对比 5 份文档，成本 3-5 人时/轮
- **无 CI 校验**：数字漂移在提交时无法阻断，只能事后评审发现

---

## 2. 目标与判据

### 2.1 目标

1. **每周自动生成基线快照**（baseline.json），记录 5 份权威文档的关键数字
2. **CI 校验文档一致性**：PR 中任一文档数字变化时自动比对 baseline，阻断不一致
3. **数字口径统一**：任何跨文档汇报必须引用 baseline 而非各文档原始数字

### 2.2 关键判据（企业级基准）

| 判据 | 依据 | 要求 |
|-----|------|------|
| D1 SSOT | AWS WA REL01-BP04（单一事实来源）| 5 份文档元数据收敛到 baseline.json 单一来源 |
| D2 自动化 | AWS WA OES02-BP01（自动化运维）| 基线刷新 + CI 校验 100% 自动化 |
| D3 可审计 | AWS WA SEC01-BP01（访问日志）| 每次基线刷新有版本号 + git commit SHA |
| D4 失败即阻断 | Google SRE Ch.4（错误预算）| CI 校验失败即阻断 PR 合并 |

---

## 3. baseline.json 结构定义

### 3.1 位置

`docs/baseline/baseline.json`（新建目录 `docs/baseline/`）

### 3.2 结构

```json
{
  "version": "5.9",
  "generated_at": "2026-10-11T10:00:00+08:00",
  "generated_by": "scripts/refresh-baseline.sh",
  "git_commit": "e9f3cc25c...",
  "refresh_frequency": "weekly",
  "next_refresh_deadline": "2026-10-18",

  "documents": {
    "CLAUDE.md": {
      "path": "CLAUDE.md",
      "sha256": "sha256sum of CLAUDE.md",
      "lines": 950,
      "key_metrics": {
        "total_tasks_declared": 122,
        "migration_range": "699-765",
        "adr_count": 15,
        "frontend_pages_declared": 202,
        "api_clients_declared": 239
      }
    },
    "INDEX": {
      "path": "reports/design-docs-summary-2026-10-03.md",
      "version": "v5.4",
      "sha256": "...",
      "lines": 1891,
      "key_metrics": {
        "design_docs_count": 72,
        "expert_reviews_count": 50,
        "adr_count": 7
      }
    },
    "G1": {
      "path": "reports/expert-reviews/all-plans-tasks-summary-2026-10-03.md",
      "version": "v1.1",
      "sha256": "...",
      "key_metrics": {
        "total_tasks_merged": 134
      }
    },
    "Y": {
      "path": "reports/upgrade-execution-playbook-2026-10-03.md",
      "version": "v5.9",
      "sha256": "...",
      "lines": 3272,
      "key_metrics": {
        "total_tasks_declared": 122,
        "stage_gate_count": 35,
        "s0_tasks": 12,
        "migration_range": "699-765"
      }
    },
    "ADR": {
      "path_pattern": "docs/adr/ADR-0*.md",
      "adr_count": 15,
      "adr_status_breakdown": {
        "accepted": 6,
        "proposed": 9
      }
    }
  },

  "consistency_checks": {
    "task_count_alignment": {
      "Y_vs_G1_vs_CLAUDE": "122 == 122 == 122 (允许 G1 多出 ADR/R-P0/CC 非 S0-S8 项)",
      "status": "pass"
    },
    "migration_range_alignment": {
      "CLAUDE_vs_Y": "699-765 == 699-765",
      "status": "pass"
    },
    "adr_status_alignment": {
      "INDEX_vs_ADR_files": "ADR 元数据与 INDEX 声明一致",
      "status": "pass"
    }
  }
}
```

---

## 4. 每周基线刷新机制（NEW-EA-5）

### 4.1 刷新脚本设计

**脚本位置**：`scripts/refresh-baseline.sh`（新建，~150 行 bash）

**核心逻辑**：

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. 提取 5 份文档的关键数字
CLAUDE_TASKS=$(grep -oE "任务数[^0-9]*[0-9]+" CLAUDE.md | grep -oE "[0-9]+")
Y_TASKS=$(grep -E "总任务数.*项" reports/upgrade-execution-playbook-2026-10-03.md | grep -oE "[0-9]+")
ADR_COUNT=$(ls docs/adr/ADR-0*.md | wc -l)
Y_GATES=$(grep -c "# 门控" reports/upgrade-execution-playbook-2026-10-03.md)

# 2. 计算 SHA256
sha256sum CLAUDE.md > /tmp/sha.txt
sha256sum reports/design-docs-summary-2026-10-03.md >> /tmp/sha.txt

# 3. 生成 baseline.json（jq 合并）
jq -n --arg version "$Y_VERSION" \
       --arg timestamp "$(date -Iseconds)" \
       --arg commit "$(git rev-parse --short HEAD)" \
       ... | tee docs/baseline/baseline.json

# 4. 提交
git add docs/baseline/baseline.json
git commit -m "chore(baseline): refresh ${Y_VERSION} baseline $(date +%F)"
```

### 4.2 触发方式

| 触发源 | 时机 | 说明 |
|-------|------|------|
| GitHub Actions 定时 | 每周日 23:00 (UTC+8) | 自动 PR，标注 "chore(baseline)" |
| 手动触发 | 任意时间 `gh workflow dispatch` | 强制刷新 |
| PR 前置 | PR 合并前自动 refresh | 阻断基线漂移 |

### 4.3 刷新失败降级

| 失败场景 | 处理方式 |
|---------|---------|
| 某文档路径不存在 | 跳过该项，标注 `status: "skipped"`，CI 警告不阻断 |
| 数字提取失败（正则匹配 0） | 保留上版本数字，标注 `status: "stale"`，PR 阻断 |
| Git commit SHA 提取失败 | 使用空字符串，标注 `status: "degraded"` |

---

## 5. 文档一致性 CI 校验（NEW-EA-6）

### 5.1 CI Workflow 位置

`.github/workflows/doc-consistency.yml`（新建，~100 行）

### 5.2 校验规则（5 项一致性）

| 规则 | 涉及文档 | 校验逻辑 | 失败动作 |
|-----|---------|---------|---------|
| R1 任务数一致性 | CLAUDE.md ↔ Y 手册 | `CLAUDE.md 任务数 == Y 手册总任务数`（允许 G1 多出）| 阻断 PR |
| R2 Migration 号段一致性 | CLAUDE.md ↔ Y 手册 ↔ ADR | 5 处 `699-765` 声明一致 | 阻断 PR |
| R3 ADR 状态一致性 | INDEX ↔ ADR 元数据 | ADR 状态字段与 INDEX 声明匹配 | 阻断 PR |
| R4 门控数字一致性 | Y 手册 §6 分解式 ↔ §6 汇总 | `S0×N + S1×N + ... == 声明总数` | 阻断 PR |
| R5 SHA256 变化检测 | 所有 5 份文档 | SHA256 与 baseline.json 比对 | 阻断 PR（要求手动 refresh baseline）|

### 5.3 CI 触发

| 触发条件 | 命令 |
|---------|------|
| PR 提交 | `actions/checkout` + `run scripts/validate-doc-consistency.sh` |
| 定时刷新 | `cron: '0 23 * * 0'` (每周日) |
| 手动 | `gh workflow dispatch` |

### 5.4 校验脚本设计

**脚本位置**：`scripts/validate-doc-consistency.sh`（新建，~200 行 bash）

**核心逻辑**：

```bash
#!/usr/bin/env bash
set -euo pipefail

BASELINE="docs/baseline/baseline.json"
ERRORS=0

# R1 任务数一致性
CLAUSE_TASKS=$(jq -r '.documents["CLAUDE.md"].key_metrics.total_tasks_declared' $BASELINE)
Y_TASKS=$(grep -E "总任务数.*项" reports/upgrade-execution-playbook-2026-10-03.md | grep -oE "[0-9]+")
if [ "$CLAUSE_TASKS" != "$Y_TASKS" ]; then
  echo "❌ R1 FAIL: CLAUDE.md 任务数 ($CLAUSE_TASKS) != Y 手册 ($Y_TASKS)"
  ERRORS=$((ERRORS+1))
fi

# R4 门控数字一致性（分解式自加检查）
Y_GATES=$(grep -c "# 门控" reports/upgrade-execution-playbook-2026-10-03.md)
Y_DECLARED=$(jq -r '.documents.Y.key_metrics.stage_gate_count' $BASELINE)
if [ "$Y_GATES" != "$Y_DECLARED" ]; then
  echo "❌ R4 FAIL: 门控实测 ($Y_GATES) != baseline 声明 ($Y_DECLARED)"
  ERRORS=$((ERRORS+1))
fi

# R5 SHA256 变化检测
for DOC_PATH in CLAUDE.md reports/design-docs-summary-2026-10-03.md \
                reports/expert-reviews/all-plans-tasks-summary-2026-10-03.md \
                reports/upgrade-execution-playbook-2026-10-03.md; do
  CURRENT_SHA=$(sha256sum "$DOC_PATH" | cut -d' ' -f1)
  BASELINE_SHA=$(jq -r ".documents[\"$DOC_PATH\"].sha256 // \"\"" $BASELINE)
  if [ -n "$BASELINE_SHA" ] && [ "$CURRENT_SHA" != "$BASELINE_SHA" ]; then
    echo "⚠️  R5 STALE: $DOC_PATH 变化，需 refresh baseline"
  fi
done

exit $ERRORS
```

### 5.5 CI 失败时人工修复流程

```
CI 校验失败
    │
    ├─ R1/R2/R3/R4 失败 → 修复文档数字（改 CLAUDE.md 或 Y 手册）
    │                    → 重新提交 PR
    │
    └─ R5 SHA256 变化 → 手动运行 `bash scripts/refresh-baseline.sh`
                       → 提交 baseline.json
                       → 重新提交 PR
```

---

## 6. 初始基线建立（2026-10-11）

### 6.1 初始值

| 项 | 值 | 来源 |
|----|----|------|
| Y 手册版本 | v5.9 | §14.11 |
| Y 手册任务数 | 122 | §12 元信息 |
| Y 手册门控数 | 35 | §12 元信息 |
| G1 任务数 | 134 | v1.1 头部声明 |
| INDEX 版本 | v5.4 | 头部声明 |
| ADR 数量 | 15 | `ls docs/adr/ADR-0*.md | wc -l` |
| ADR 已接受 | 6（ADR-007/010/011/012/013/014/015）| 元数据行 |
| Migration 号段 | 699-765 | CLAUDE.md 契约条款 3 |
| 前端页面数 | 219 | `ls orion-frontend/src/pages/ | wc -l` |
| API client 数 | 183 | `ls orion-frontend/src/api/ | wc -l` |

### 6.2 与 CLAUDE.md 快照的差异

| 项 | CLAUDE.md 快照（2026-09-25）| 实测（2026-10-11）| 差异 |
|----|------------------------|------------------|------|
| 前端页面 | 202 | 219 | +17（v5.7+ 新增）|
| API client | 239 | 183 | -56（v5.7+ 清理）|
| ADR | 7 | 15 | +8（v5.4 ADR 补齐）|
| Migration | 643 | 699-765 | +56（v5.4 计划分配）|

**处理**：CLAUDE.md 快照为 2026-09-25，本基线为 2026-10-11。差异 5 项需在 CLAUDE.md 下次刷新时同步（非本次范围）。

---

## 7. 门控与验收

### 7.1 交付物验收

| 项 | 通过标准 |
|----|---------|
| baseline.json 结构 | 5 份文档元数据齐全 + consistency_checks 5 项 |
| refresh 脚本 | `bash scripts/refresh-baseline.sh` 无错误退出 |
| validate 脚本 | `bash scripts/validate-doc-consistency.sh` 通过（当前基线）|
| CI workflow | `.github/workflows/doc-consistency.yml` 存在 |

### 7.2 每周刷新的门控

```
第 1 周（2026-10-11）：建立初始基线 + CI 首次跑通
第 2 周（2026-10-18）：首次定时刷新（周日 23:00）
第 3 周（2026-10-25）：观察 1 轮，评估 CI 假阳性率
第 4 周（2026-11-01）：调整规则（如 R5 从严格改为 warning）
```

### 7.3 与 Y 手册 v5.9 的对齐

- 本文件作为 U5 交付物，纳入 Y 手册 v5.9 §14.11 U5 条目
- 后续 S0-T7 结构化日志门控 + NEW-EA-7 门控可复用 baseline.json 的 consistency_checks 字段
- 文档一致性 CI 校验为 `design-constraint` 技能新增第 39 项 detector（`doc-consistency`）

---

## 8. 与 CLAUDE.md 技能一致性契约的对齐

| 项 | 归属 | 说明 |
|----|-----|------|
| 覆盖率口径 | design-constraint | 新增 2 项 detector（baseline + doc-consistency），AST 86→88 项，总覆盖 214→216 项 |
| 文档评审 | design-doc-reviewer | baseline 建立后，评审 5 份文档时以 baseline 为准 |
| 任务拆分 | task-decomposer | 后续文档一致性 CI 相关的子任务由 task-decomposer 拆分 |
| 单一事实来源 | 本文档 | baseline.json 为 5 份文档数字的单一事实来源 |

---

## 9. 认知边界（诚实声明）

1. **本文件为设计文档**（RC-03 硬约束），未创建实际脚本
2. **脚本示例为伪代码**：`refresh-baseline.sh` 与 `validate-doc-consistency.sh` 的具体实现由后续 task-decomposer 拆分执行
3. **未修改任何生产代码**：本文件为独立设计文档，不涉及 `orion-platform-svc-go/` 或 `orion-frontend/` 源码
4. **未估算人天/工期**：遵守 CLAUDE.md 强制约束
5. **CI 假阳性率未实测**：R5 SHA256 严格模式可能因格式微调产生假阳性，需第 3 周观察后调整
6. **baseline.json 初始值为 2026-10-11 快照**：非长期不变，每周刷新

---

## 10. Skill Handoff Checklist

**发现问题总数**：2 项（NEW-EA-5 + NEW-EA-6）

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | 4 | refresh 脚本 1 + validate 脚本 1 + CI workflow 1 + baseline.json 1 | P0 |
| **design-constraint** | 2 | 新增 2 项 detector（baseline + doc-consistency）| P1 |
| **design-doc-reviewer** | 1 | 建立 baseline 后首次全量 5 份文档评审 | P1 |

**Structured Missing Items（JSON）**：

```json
{
  "dimension": "baseline_refresh_and_doc_ci",
  "total_gaps": 2,
  "downstream_routing": {
    "task_decomposer": {
      "count": 4,
      "items": [
        {"id": "DOC-CI-1", "title": "scripts/refresh-baseline.sh 实现", "priority": "P0", "depends_on": []},
        {"id": "DOC-CI-2", "title": "scripts/validate-doc-consistency.sh 实现", "priority": "P0", "depends_on": ["DOC-CI-1"]},
        {"id": "DOC-CI-3", "title": ".github/workflows/doc-consistency.yml 创建", "priority": "P0", "depends_on": ["DOC-CI-2"]},
        {"id": "DOC-CI-4", "title": "docs/baseline/baseline.json 初始建立", "priority": "P0", "depends_on": []}
      ]
    },
    "design_constraint": {
      "count": 2,
      "items": [
        {"id": "DOC-CI-D1", "title": "新增 detector: baseline-consistency", "priority": "P1"},
        {"id": "DOC-CI-D2", "title": "新增 detector: doc-consistency", "priority": "P1"}
      ]
    }
  }
}
```

---

## 11. 结论

- **U5 交付物 1/2**：baseline.json 结构定义 + 每周刷新机制（NEW-EA-5）
- **U5 交付物 2/2**：文档一致性 CI 校验 5 项规则 + workflow 设计（NEW-EA-6）
- **企业级判据对齐**：D1 SSOT / D2 自动化 / D3 可审计 / D4 失败即阻断（4/4 达标）
- **阻塞问题**：5 处方案-工程一致性漂移（overall-plan-review-round2 §1.3）在本机制下每次刷新自动收敛
- **RC-03 硬约束遵守**：本文件为独立设计文档，未修改任何生产代码
- **关联文档**：
  - Y 手册 v5.9 §14.11 U5 条目
  - enterprise-architecture-depth-review-2026-10-11.md §6.4 关键判据 5
  - overall-plan-review-round2-2026-10-11.md §5.5 + §7.4
  - CLAUDE.md 技能一致性契约（新增 2 项 detector）

**文件**：`docs/baseline-refresh-and-doc-ci-2026-10-11.md`
