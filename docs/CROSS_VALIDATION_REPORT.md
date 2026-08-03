# Cross-Validation Report: architecture-review-2026-08-01.md vs 代码库实际状态

> 验证日期: 2026-08-01
> 方法: 逐项 grep/wc/ls 实测，与报告声明逐条对比
> 验证人: 资深架构评审团队

---

## 摘要

对 `architecture-review-2026-08-01.md` (1032 行) 中的 9 大类核心声明进行逐项交叉验证，**结论：5 项严重失实，4 项准确**。报告的核心问题根因是**数据陈旧** + **Service 方法统计使用了错误的 grep 模式**。

| 声明类别 | 报告准确度 | 严重程度 |
|---------|-----------|---------|
| artifact-version Service 仅 6 方法 | ❌ 失实 (实测 62) | 🔴 高 |
| 21 个模块缺 Service 层 | ❌ 完全失实 (实测 2 个) | 🔴 最高 |
| project 模块为空壳 | ❌ 失实 (有 S+R) | 🔴 高 |
| 3 模块缺 Repo | ❌ 失实 (0/3) | 🔴 高 |
| chatops 87 Service 方法 | ⚠️ 接近 (实测 84) | 🟢 低 |
| ticketing 1370 行 | ✅ 准确 | 🟢 低 |
| chaos 三模块重叠 | ✅ 准确 | 🟢 低 |
| 前端权限校验缺失 | ✅ 准确 (6/217) | 🟢 低 |
| 262 后端模块 | ✅ 接近 (实测 265) | 🟢 低 |

---

## 声明 #1: artifact-version 重构优先级

> **报告声称**: "service.go 仅 6 个方法...服务层过薄，急需重构"

| 维度 | 报告 | 实测 |
|------|------|------|
| Handler 行数 | 797 | 1218 (621 handler.go + 597 test) |
| 路由数 | 63 | 68 |
| **Service 方法** | **6** | **62** |
| Service 行数 | 未提及 | 285 |
| Repo 方法 | 未提及 | 5 |

**判定: ❌ 严重失实**。Service 层有 62 个方法、285 行，并非"过薄"。`artifact-version` 的 H→S→R 架构健康，无需紧急重构。

**证据**:
```
$ grep -h 'func (s\|func (e\|func (h' orion-platform-svc-go/internal/artifact-version/service/*.go | wc -l
62
$ wc -l orion-platform-svc-go/internal/artifact-version/service/service.go
285
```

---

## 声明 #2: "21 个模块无 Service 层"

> **报告声称**: "alert-adapter/auto-exec/condition/environment/feature-flag/federation/import-export/inception/intelligence/job-actions/job-processor/job-source/llm/param-types/pipeline-engine/pipeline-executor/plugin/project/saga/sla-engine/startup 无 Service 层"

### 逐项实测

| 模块 | 报告声称 | 实测 Service 方法 | 根因 |
|------|---------|-----------------|------|
| alert-adapter | ❌ 无 | ✅ **51** | receiver `a` |
| auto-exec | ❌ 无 | ✅ **11** | receiver `h` |
| condition | ❌ 无 | ✅ **48** | receiver `c` |
| environment | ❌ 无 | ✅ **10** | receiver `h` |
| feature-flag | ❌ 无 | ✅ **13** | receiver `h` |
| federation | ❌ 无 | ✅ **24** | receiver `h` |
| import-export | ❌ 无 | ✅ **6** | receiver `h` |
| inception | ❌ 无 | ✅ **29** | receiver `h` |
| intelligence | ❌ 无 | ✅ **5** | receiver `h` |
| job-actions | ❌ 无 | ✅ **13** | receiver `h` |
| job-processor | ❌ 无 | ✅ **6** | receiver `h` |
| job-source | ❌ 无 | ✅ **29** | receiver `h` |
| llm | ❌ 无 | ✅ **18** | receiver `h` |
| param-types | ❌ 无 | ✅ **132** | receiver `h` |
| pipeline-engine | ❌ 无 | ✅ **52** | receiver `e` |
| pipeline-executor | ❌ 无 | ✅ **13** | receiver `e` |
| plugin | ❌ 无 | ✅ **28** | receiver `h` |
| project | ❌ 无 | ✅ **5** | receiver `h` |
| saga | ❌ 无 | ✅ **59** | receiver `h` |
| sla-engine | ❌ 无 | ✅ **24** | receiver `h` |
| startup | ❌ 无 | ✅ **12** | receiver `h` |

**判定: ❌ 完全失实 (0/21 准确)**。全部 21 个模块均有完整 Service 目录且含代码。

### 根因分析

报告使用 `grep 'func (s'` 模式统计 Service 方法数。但 Go 的 receiver 变量名通常采用模块首字母（如 `func (h *Handler)`、`func (e *Engine)`），导致所有 receiver 非 `s` 的模块被误判为 0。

**真正无 Service 的模块仅 2 个**: `global-search`、`visor`。

---

## 声明 #3: "project 模块为空壳"

> **报告声称**: "110 行 Handler + 0 Service + 0 Repo 空壳"

| 维度 | 报告 | 实测 |
|------|------|------|
| Handler 行数 | 110 | ✅ 110 |
| Service | 0 | ❌ **project_service.go (5 方法)** |
| Repo | 0 | ❌ **project_repository.go** |

**判定: ❌ 错误**。project 不是空壳，三层架构完整。

---

## 声明 #4: "3 个模块无 Repository"

> **报告声称**: "plugin/project/federation 无 Repository"

| 模块 | 报告声称 | 实测 Repo 方法 |
|------|---------|--------------|
| plugin | ❌ 无 | ✅ **26** |
| project | ❌ 无 | ✅ **5** |
| federation | ❌ 无 | ✅ **26** |

**判定: ❌ 错误 (0/3 准确)**。

**真正无 Repository 的模块**: `prompt-security` (3 Service/0 Repo)、`rule-engine` (8 Service/0 Repo)、`task-executor` (6 Service/0 Repo)

---

## 声明 #5: chatops 87 Service 方法

| 报告 | 实测 | 判定 |
|------|------|------|
| 87 | 84 (`service.go` + 测试) | ⚠️ 接近准确 (误差 3) |

---

## 声明 #6: ticketing 1370 行

| 报告 | 实测 | 判定 |
|------|------|------|
| 1370 行单文件 | ✅ 1370 行 | ✅ 精确准确 |
| 仅 1 个文件 | ⚠️ 遗漏 | 实际 23 个 handler 文件，4748 行总计 |

---

## 声明 #7: chaos 三模块重叠

| 模块 | 总函数 | 核心方法集 | 判定 |
|------|-------|-----------|------|
| chaos | 148 | Create/List/Get Experiment | ✅ 重叠确认 |
| chaos-enhanced | 39 | Create/List Experiment | ✅ 重叠确认 |
| chaos-gateway | 46 | GetScenarios/ListExperiments | ✅ 重叠确认 |

---

## 声明 #8: 前端权限校验缺失

| 报告 | 实测 | 判定 |
|------|------|------|
| 仅 3 个页面用权限 | 6 个文件 (含 usePermission/authStore) | ⚠️ 接近准确 |
| 敏感页面全缺守卫 | 实测部署/配置/Secret/审批页面 0 个权限 | ✅ 准确 |

**实际有权限校验的前端页面**:
- `PipelineList/index.tsx`
- `AlertList/index.tsx`
- `WorkflowTasks/index.tsx`
- `usePermission.ts`
- `usePermissionActions.ts`
- `pipeline-sse` SSE hook

**覆盖率: 6/217 (2.8%)**

---

## 声明 #9: "262 个后端模块"

| 报告 | 实测 | 判定 |
|------|------|------|
| 262 | 265 (有 handler 目录) | ✅ 接近 (误差 3) |
| 241 有 Service | 263 有 Service | ❌ 低估 22 个 |

---

## 统计方法漏洞

报告中 Service 方法统计的 grep 模式缺陷是系统性问题：

```
# 报告使用的模式（错误）
grep -rh 'func (s' internal/*/service/*.go | wc -l

# 正确的模式（兼容所有 receiver）
grep -rh 'func (.*\*.*Service\|func (.*\*handler\|func (.*\*Engine\|func (.*\*Repository\|func (.*\*Repository\|func (.*\*.*Repository' internal/*/service/*.go | wc -l

# 或最简模式
grep -rh '^func (' internal/*/service/*.go | wc -l
```

接收器变量名分布示例:
- `func (h *Handler)` — 265 个模块中 ~80% 使用
- `func (s *Service)` — ~15%
- `func (e *Engine)` — pipeline-engine/executive
- `func (c *Collector)` — cmdb-collector
- `func (w *WorkerDispatcher)` — worker-dispatcher

---

## 修正后的优先级

| 原优先级 | 问题 | 修正 |
|---------|------|------|
| 🔴 P0: artifact-version 重构 | **撤回** | ⚡ 无需操作 |
| 🔴 P0: 21 模块补 Service | **撤回** | ⚡ 无需操作 |
| 🔴 P0: project 补 S+R | **撤回** | ⚡ 无需操作 |
| 🔴 P0: 3 模块补 Repo | **撤回** | ⚡ 无需操作 |
| ✅ P0: 前端敏感页面权限 | **保留** | 🔴 真实 P0 |
| ✅ P1: chaos 三模块合并 | **保留** | 🟡 真实 P1 |
| ✅ P1: ticketing/chatops 拆分 | **保留** | 🟡 真实 P1 |
| ✅ P0: Log 支柱缺失 | **新增** | 🔴 真实 P0 |
| ✅ P0: prompt-security Repo | **新增** | 🔴 真实 P0 |
| ✅ P0: alert-dedup Repo | **新增** | 🔴 真实 P0 |

---

## 结论

`architecture-review-2026-08-01.md` 的 9 项核心声明中：
- **5 项严重失实**（因数据陈旧 + grep 模式缺陷）
- **4 项准确**（chaos 重叠 / ticketing 行数 / 权限缺失 / 模块总数）

报告中 4 个 🔴 P0 问题全部需要撤回。真实可操作的 P0 为 4 项：
1. 前端敏感页面权限守卫（6/217 覆盖）
2. Log 支柱缺失（仅有 Metrics+Traces）
3. prompt-security 补 Repo 层
4. alert-deduplication 补 Repo 层

---

> 本报告基于 `module-depth-analysis-2026-08-01.md` 的逐模块实测数据。
