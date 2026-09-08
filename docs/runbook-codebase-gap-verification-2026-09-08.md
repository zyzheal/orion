# Runbook：如何系统性核实代码库"缺口" (2026-09-08)

> **背景**：本次 session 的 TOP5 平台级架构评审连续误判 4 次，根因是"只看顶层目录"，未做全库递归搜索。本 runbook 沉淀方法论，避免下次重复犯错。

## 1. 误判案例回顾

| 误判轮次 | 错误结论 | 正确结论 | 错误根因 |
|---------|---------|---------|---------|
| 第 1 次 | "TOP5 新增 5 项任务 24d" | — | `ls internal/` 看顶层，没看到 `audit/quota/postmortem/spi` 就叫"缺口" |
| 第 2 次 | "新增 1 项 11-14d"（修正 T-AUDIT/T-QUOTA/T-CONFIG/T-SPI 已存在，T-POSTMORTEM 缺） | — | 修正了 4 项，但 T-POSTMORTEM 只查 `internal/*postmortem*` 顶层，没到 `incident/service/` 子模块 |
| 第 3 次 | "0 项新任务"（修正 T-POSTMORTEM 已在 `incident/service/postmortem_draft.go`） | ✅ | 用 `find -name "*postmortem*"` 全库搜索才发现 |
| 第 4 次 | "v3.5 Wave 1 8 项也大多已实现" | ✅ | 用 `find` 全库搜索才发现 `data-quality`、`efficiency`、`code-repo` 等已存在 |

**关键教训**：第 3 次才用了正确方法（`find` 全库递归搜索），前 2 次都偷懒只看顶层。

## 2. 核实流程（必须按顺序执行）

### Step 1：用 `find` 全库递归搜索关键词

```bash
# ❌ 错误做法（只看顶层）
ls internal/*audit* internal/*quota* internal/*postmortem*

# ✅ 正确做法（全库递归搜索）
find internal/ -type d -iname "*audit*" 2>/dev/null
find internal/ -type d -iname "*quota*" 2>/dev/null
find internal/ -type d -iname "*postmortem*" 2>/dev/null
find internal/ -type d -iname "*retro*" 2>/dev/null  # 复盘的同义词
```

**关键词策略**：
- 用 `iname` 不区分大小写
- 列出所有可能的同义词（postmortem/retro/review/lessons）
- 同时搜目录和文件名

### Step 2：搜到的文件必须读内容

```bash
# 不能只看到文件名就下结论，必须读代码确认是否真实实现
cat internal/incident/service/postmortem_draft.go
wc -l internal/incident/service/postmortem_draft.go
```

**判定标准**：
- 文件 > 100 行 = 真实实现（不是占位）
- 文件 < 50 行 = 可能是 stub，需读内容确认

### Step 3：核实路由注册

```bash
# 搜 handler 里的路由注册
grep -n "POST\|GET\|PUT\|DELETE" internal/incident/handler/handler.go | grep -i postmortem

# 搜 wiring 接线
grep -rn "incidentH\|postmortem" cmd/server/wiring-*.go cmd/server/router.go
```

**判定标准**：
- 路由有 `RegisterRoutes` 调用 = 已接线
- 路由在 `router.go` 的 `registerRoutes` 列表里 = 已挂主路径
- 只在测试里调用 = 未接线

### Step 4：核实测试覆盖

```bash
find internal/incident -name "*_test.go" -path "*postmortem*"
wc -l internal/incident/service/postmortem_draft_test.go
```

**判定标准**：
- 有测试文件 + > 50 行 = 已测试
- 无测试 = 未验证

## 3. 核实脚本模板（可复用）

```bash
#!/bin/bash
# 核实某模块是否已存在
KEYWORD=$1  # e.g. "audit" 或 "postmortem"

echo "=== 1. 全库搜索目录 ==="
find internal/ -type d -iname "*${KEYWORD}*" 2>/dev/null

echo "=== 2. 全库搜索文件名 ==="
find internal/ -type f -iname "*${KEYWORD}*.go" 2>/dev/null | head -20

echo "=== 3. 文件行数（前 10 个）==="
find internal/ -type f -iname "*${KEYWORD}*.go" 2>/dev/null | head -10 | xargs wc -l 2>/dev/null

echo "=== 4. 路由注册 ==="
grep -rn "${KEYWORD}" internal/*/handler/*.go 2>/dev/null | head -10

echo "=== 5. Wiring 接线 ==="
grep -rn "${KEYWORD}" cmd/server/wiring-*.go cmd/server/router.go 2>/dev/null | head -10

echo "=== 6. 测试文件 ==="
find internal/ -type f -iname "*${KEYWORD}*test*" 2>/dev/null | head -5
```

## 4. 判定矩阵

| 发现 | 判定 |
|------|------|
| 有目录 + 文件 > 100 行 + 路由注册 + wiring 接线 + 测试 | ✅ 已实现 |
| 有目录 + 文件 > 100 行 + 路由注册，无 wiring | ⚠️ 未接线（需接线） |
| 有目录 + 文件 < 50 行 | ⚠️ 可能是 stub，需读内容 |
| 有目录 + 无路由注册 | ⚠️ 未挂路由（需加路由） |
| 有文件 + 无测试 | ⚠️ 未验证（需补测试） |
| 搜不到任何文件 | ❌ 真缺口（需新建） |

## 5. 评审文档的正确写法

**❌ 错误写法**（只看顶层目录就下结论）：
```markdown
### 缺口 1：缺少统一审计日志中心
- 当前各模块分散审计
- 工作量：3d
```

**✅ 正确写法**（全库搜索后下结论）：
```markdown
### 审计日志中心
- 核实结果：`internal/audit/` 已存在 2829 行 + 20 路由 + 区块链哈希链 + SOC2/ISO27001 合规报告，`router.go:85` 已接线
- 现状：✅ 已实现
- 建议：差距扩展（对标 CloudTrail 补充审计事件订阅 webhook），不是新建
```

## 6. TOP5 视角评审的特殊注意事项

TOP5 视角（NeatLogic/ServiceNow/Datadog/GitLab/AWS）容易把"平台视角的缺口"误判为"代码缺失"。正确做法：

1. **平台视角的"缺口"是分层的**：
   - 顶层能力（如"统一审计日志"）→ 可能已有，需核实
   - 子能力（如"审计事件 webhook 订阅"）→ 可能缺，需核实子能力

2. **核实每个子能力**：
   ```bash
   # 例：核实 audit 模块是否有 webhook 订阅
   grep -rn "webhook\|subscription\|subscribe" internal/audit/ 2>/dev/null
   ```

3. **评审文档标注核实方法**：
   - 每个"缺口"必须标注核实命令
   - 每个"已实现"必须标注代码位置和行数

## 7. 本次 session 的修正历史（教训记录）

| Commit | 修正内容 |
|--------|---------|
| `0207e4956` | 初版：TOP5 5 项新任务详细设计（24d） |
| `b9b6c1f27` | 第 1 次修正：4 项已存在，1 项新建（11-14d） |
| `165875450` | 最终修正：5 项全部已存在，0 项新建 |

**根因**：第 1、2 次都只看顶层目录，第 3 次才用 `find` 全库搜索。

## 8. 下次评审的检查清单

- [ ] 每个"缺口"都用 `find -iname` 全库递归搜索
- [ ] 每个搜到的文件都读内容确认行数 > 100
- [ ] 每个模块都核实路由注册（grep handler）
- [ ] 每个模块都核实 wiring 接线（grep cmd/server）
- [ ] 每个模块都核实测试覆盖（find *_test.go）
- [ ] 评审文档每个结论都标注核实命令和代码位置
- [ ] 平台视角的"缺口"拆成顶层能力 + 子能力分别核实
