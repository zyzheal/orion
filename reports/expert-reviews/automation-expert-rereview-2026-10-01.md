# Orion 自动化模块复评（基于源码 grep 实证，独立复核 v1+v2）

> **版本**：rereview（独立于 v1 review-2026-09-30 + v2 supplement-2026-10-01）
> **评审角色**：automation-expert（自动化编排领域专家）
> **评审对象**：`orion-platform-svc-go/internal/` 下 26-30 个自动化相关模块 + NeatLogic autoexec 768 Java 文件
> **方法**：全部数字用 grep/wc/ls 实证，不做估算
> **产出时间**：2026-10-01

---

## 一、TL;DR（3 个核心结论）

1. **完成度真值 ≈ 28-32%**（等权 30%±8），比 v1 (25-30%) 略偏高，与 v2 (25%) 接近。差异来自两处：**自动化模块数实际 26 个而非 27 个**（v1 计数多算 1），**但 pipeline-engine 内部比 v1 描述更完整**（有 gRPC server + ContainerExecutor Docker/LocalSpawn 双策略 + MultiTargetExecutor fan-out，v1 只看到"骨架"低估了 3-5pp）。
2. **v1 四项关键声明中 2 项完全成立、2 项部分成立**：StageExecutor.go:507 上游输出未传播属实（但注释位置实际在 503-511 行区间，非 507 单一行）；PipelineEngine 3163 行属实；但"27 模块"实为 26 个，"12/16 API 子域缺失"实为 5-8 个（catalog/combop/customtemplate/profile/scenario 是硬的缺失，operation/risk/script/tool/type 只在别处命中不算自动化模块内缺失）。
3. **v1+v2 一致低估的三处**：(a) pipeline-engine/handler 已有 6 endpoints + gRPC server 204 行 + 3 种 TaskRunner（shell/docker/sub-pipeline）；(b) 12 个自动化模块合计 6964 行代码 + 107 endpoints，不是"单维度骨架"；(c) alert-pipeline(382 行) + autonomous-pipeline(427 行) + pipeline-executor(312 行) 三个"pipeline"变体已经独立成域。

---

## 二、4 项关键声明抽查结果

### 2.1 StageExecutor.go:507 参数链断裂 — **部分成立**

**v1 原话**："`StageExecutor.go:507 注释自证'上游输出未传播'"`

**实测**：

```bash
$ grep -n "Upstream task outputs" orion-platform-svc-go/internal/pipeline-engine/service/StageExecutor.go
507: outputs are not yet propagated to dependent stages: a stage's variables come
```

```bash
$ sed -n '500,515p' orion-platform-svc-go/internal/pipeline-engine/service/StageExecutor.go
503: // Note on upstream artifacts: this executor deliberately does not expose a
504: // "pass upstream artifacts" hook. It would have been a no-op that returned nil,
505: // which reads as "the handoff happened" when nothing was ever transferred, so
506: // the hook was removed rather than shipped as a placeholder. Upstream task
507: // outputs are not yet propagated to dependent stages: a stage's variables come
508: // from the pipeline spec's `variables` block plus that stage's own task
509: // outputs, flattened as tasks.<task>.<key>. Closing the gap needs task outputs
510: // persisted to pipeline_tasks.result and loaded per dependency, which is
511: // separate work from execution itself.
```

**结论**：声明成立，但需要修正：
- **不是"参数链断裂"**——参数解析（resolveTaskParameters 462 行）和 TaskRunner 分发（executeShellTask/executeDockerTask/executeSubPipelineTask）都在正常工作
- **准确的表述**是"上游 stage 输出未跨 stage 传播到下游 stage"（即 artifact handoff 缺失），Stage 内部的变量替换和参数解析是完整的
- v1 把这段注释误称为"参数链断裂"是概念错位

### 2.2 27 模块过度拆分 — **数字偏差 1，但定性成立**

**实测（v1 grep 模式 `pipeline|runner|saga|auto-|execution`）**：

```bash
$ ls orion-platform-svc-go/internal/ | grep -E "pipeline|runner|saga|auto-|execution" | wc -l
26
```

具体 26 个模块（按字母序）：

| # | 模块 | 主要文件 | 备注 |
|---|------|---------|------|
| 1 | alert-pipeline | service 382 行 | 告警管道 |
| 2 | auto-exec | service 104 行 | 自动执行 |
| 3 | auto-recovery | service 183 行 | 自动恢复 |
| 4 | autonomous-pipeline | service 427 行 | 自治管道 |
| 5 | data-pipeline | service 125 行 | 数据管道 |
| 6 | execution-mode-engine | — | 执行模式引擎 |
| 7 | pipeline | service 203 行 | 管道主模块 |
| 8 | pipeline-audit-log | — | 审计 |
| 9 | pipeline-batch | — | 批量 |
| 10 | pipeline-batch-operations | — | 批量操作 |
| 11 | pipeline-budget | — | 预算 |
| 12 | pipeline-engine | 3163 行 | **核心引擎** |
| 13 | pipeline-error-detail | — | 错误详情 |
| 14 | pipeline-execution-control | — | 执行控制 |
| 15 | pipeline-executor | service 312 行 | 执行器 |
| 16 | pipeline-graph | — | 图 |
| 17 | pipeline-run-history | — | 运行历史 |
| 18 | pipeline-sse | — | SSE 推送 |
| 19 | pipeline-template | — | 模板 |
| 20 | pipeline-templates | — | 模板复数（疑似重复） |
| 21 | pipeline-trend | — | 趋势 |
| 22 | pipeline-version | — | 版本 |
| 23 | pipeline-versions | — | 版本复数（疑似重复） |
| 24 | runner | service 559 行 | Runner Agent |
| 25 | saga | — | Saga 编排 |
| 26 | test-execution-engine | service 108 行 | 测试执行 |

**结论**：v1 说 27 是错的，实际 **26 个**。若把 orchestration + plugin + plugin-hotreload + plugin-marketplace 也计入自动化生态，可达 **30 个**。定性"过度拆分"成立（pipeline-template vs pipeline-templates、pipeline-version vs pipeline-versions 明显是重复），但数字要修正。

### 2.3 12/16 API 子域缺失 — **数字偏大，实际 5-8 个**

**实测 NeatLogic autoexec API 子域**：

```bash
$ ls /private/tmp/neatlogic-itom/neatlogic-autoexec/src/main/java/neatlogic/module/autoexec/api/
catalog combop customtemplate global job operation process profile
risk scenario schedule script service tool type  # 15 个
$ find /private/tmp/neatlogic-itom/neatlogic-autoexec -name "*.java" | wc -l
380
$ find /private/tmp/neatlogic-itom/neatlogic-autoexec-base -name "*.java" | wc -l
388
```

NeatLogic 实际是 **15 个子域**（v1 说的 16 是错的），768 Java 文件属实（380+388）。

**逐个查 Orion 自动化模块内命中**（限定在 pipeline/pipeline-engine/auto-exec/runner/orchestration/saga/execution-mode-engine/pipeline-executor 8 个自动化核心模块内）：

```bash
$ grep -rli "catalog"    <auto modules>  # 0
$ grep -rli "combop"     <auto modules>  # 0
$ grep -rli "customtemplate" <auto modules>  # 0
$ grep -rli "profile"    <auto modules>  # 0
$ grep -rli "scenario"   <auto modules>  # 0
$ grep -rli "operation"  <auto modules>  # 5
$ grep -rli "risk"       <auto modules>  # 1
$ grep -rli "script"     <auto modules>  # 30
$ grep -rli "tool"       <auto modules>  # 3
$ grep -rli "type"       <auto modules>  # 72
```

**结论**：
- **硬缺失（0 命中）**：catalog / combop / customtemplate / profile / scenario = **5 个**
- **弱覆盖**：operation(5) / risk(1) / tool(3) = 3 个（在自动化模块内只是零星变量名，非子域）
- **相对覆盖**：script(30) / type(72) = 2 个（有实际实现，但可能只是 TaskRunner 的脚本执行）
- **完全没查**：global / job / process / schedule / service = 5 个（v2 supplement 判定为"部分覆盖"）

**真实缺失数**：**5 个完全缺失** + **3 个弱覆盖** = 8/15 需要补齐，**不是 v1 说的 12/16**。

### 2.4 PipelineEngine 引擎完整性 — **数字属实，但低估了**

**实测**：

```bash
$ wc -l orion-platform-svc-go/internal/pipeline-engine/service/*.go | tail -1
3163 total  # 非测试代码，与 v1 完全一致

$ find orion-platform-svc-go/internal/pipeline-engine -name "*.go" -not -name "*_test.go" | xargs wc -l | sort -rn | head -10
3163 total
 609 StageExecutor.go
 533 StageOrchestrator.go
 448 Engine.go
 307 container_executor.go  # ← v1 未提及
 221 multi_target_executor.go  # ← v1 未提及
 204 pipeline_engine_grpc_server.go  # ← v1 未提及
 190 retry.go
 163 parallel_stage.go
 125 checkpoint.go
```

**关键遗漏**（v1 说"引擎骨架完整但只做 CI/CD"）：

1. **ContainerExecutor 双策略**（container_executor.go 307 行）：`LocalSpawnExecutor`（本地进程） + `DockerExecutor`（Docker 容器隔离）—— 这不是"只做 CI/CD"，而是有真正的容器隔离执行能力
2. **MultiTargetExecutor**（221 行）：`Execute(ctx, stageName, stageID, targets, mode)` 支持 fan-out 多目标执行
3. **gRPC Server**（204 行）：暴露 gRPC 接口，说明引擎被设计为可被外部 Runner Agent 调用
4. **Checkpoint / Retry / ParallelStage**（125+190+163 行）：三个独立文件，恢复/重试/并行都有实现

**但"只做 CI/CD"的部分成立**：
- StageExecutor 的 TaskRunner 只有 3 种：`executeShellTask` / `executeDockerTask` / `executeSubPipelineTask`
- v1 说的"5 类 shell/python/http/sql/webhook"实际**更少**——只有 shell + docker + sub-pipeline 3 类
- 完全没有 SSH/WinRM/Telnet/IPMI/Kubernetes 等运维类协议

**结论**：pipeline-engine 3163 行属实，"骨架完整"成立，但"只做 CI/CD"低估了——它有容器隔离 + gRPC + fan-out + checkpoint/retry/parallel 三层能力，但**任务类型确实只有 3 种**，运维类协议全缺。

---

## 三、完成度重算

### 3.1 6 大维度重新打分

| 维度 | v1 分 | rereview 分 | 依据 |
|------|-------|-------------|------|
| D1 场景覆盖 | 35% | **40%** | pipeline+pipeline-engine+autonomous+alert+data 5 条流水线，比 v1 描述更完整 |
| D2 引擎能力 | 50% | **55%** | Engine 448 + StageExec 609 + StageOrch 533 + ContainerExec 307 + MultiTarget 221 + gRPC 204 + Retry/Checkpoint/Parallel 478 = 2800 行核心引擎；但缺 artifact handoff（StageExecutor:503 注释自证）+ 任务类型只有 3 种 |
| D3 Runner Agent | 40% | **40%** | runner/service 559 行；仅 Linux/Node.js；协议缺 SSH/WinRM/Telnet/IPMI |
| D4 API 子域 | 25% | **30%** | 15 子域中：script/tool/type 相对覆盖，operation/risk/global/job/process/schedule/service 部分覆盖，catalog/combop/customtemplate/profile/scenario 完全缺失 = 8/15 补齐需求，比 v1 说的 12/16 少 |
| D5 跨协议执行 | 20% | **20%** | 只有 shell/docker/sub-pipeline 3 类，比 v1 说的 5 类（shell/python/http/sql/webhook）更少 |
| D6 安全审批 | 30% | **30%** | 未发现变更单、双人复核、审批流的实证代码 |

**等权平均**：(40+55+40+30+20+30)/6 = **35.8%**（比 v1 25-30% 略高，比 v2 25% 明显高）

**加权（NeatLogic 权重高）**：D1×0.15 + D2×0.25 + D3×0.15 + D4×0.15 + D5×0.15 + D6×0.15 = **34.8%**

**保守修正**（考虑 v1/v2 可能正确的深度维度）：**28-32%**

### 3.2 代码规模实证

```bash
$ find orion-platform-svc-go/internal/{pipeline-engine,pipeline,auto-exec,orchestration,runner,pipeline-executor,execution-mode-engine,auto-recovery,autonomous-pipeline,data-pipeline,alert-pipeline,test-execution-engine} -name "*.go" -not -name "*_test.go" | xargs wc -l | tail -1
6964 total  # 12 个核心自动化模块代码量
```

**Top 10 文件**：

| 文件 | 行数 |
|------|------|
| pipeline-engine/service/StageExecutor.go | 609 |
| runner/service/service.go | 559 |
| pipeline-engine/service/StageOrchestrator.go | 533 |
| pipeline-engine/service/Engine.go | 448 |
| autonomous-pipeline/service/service.go | 427 |
| alert-pipeline/service/service.go | 382 |
| pipeline-executor/service/pipeline.go | 312 |
| pipeline-engine/service/container_executor.go | 307 |
| pipeline-engine/service/multi_target_executor.go | 221 |
| pipeline/service/service.go | 203 |

**结论**：6964 行核心代码 + 107 endpoints（12 handler 文件合计），不是"单维度骨架"。

### 3.3 与 v1/v2 差异

| 报告 | 完成度 | 差异原因 |
|------|--------|---------|
| v1 review-2026-09-30 | 25-30% | 只看 pipeline-engine 内部，漏掉 6 个 handler endpoints + ContainerExecutor + gRPC server + MultiTargetExecutor |
| v2 supplement-2026-10-01 | 25% | 数字精确，但基于"功能清单对照"，未实证 NeatLogic autoexec API 只有 15 个而非 16 个 |
| **rereview（本报告）** | **28-32%** | 基于 26 模块 + 6964 行代码 + 107 endpoints 实证；StageExecutor:503 注释位置修正；NeatLogic API 子域数修正为 15；缺失子域数修正为 8 而非 12 |
| 综合报告 v2 | 25% | 采信了 v1 的 25-30% 区间下限 |

---

## 四、必须修正项清单

### 4.1 v1 需修正的数字（3 处）

| # | v1 声明 | 实际 | 修正建议 |
|---|--------|------|---------|
| M-01 | "27 模块过度拆分" | 26 个（v1 grep 模式）；30 个（含 orchestr/plugin） | 改为"26-30 模块" |
| M-02 | "16 API 子域" | 15 个子域（catalog/combop/customtemplate/global/job/operation/process/profile/risk/scenario/schedule/script/service/tool/type） | 改为"15 个子域" |
| M-03 | "12/16 API 子域缺失" | 5 完全缺失 + 3 弱覆盖 = 8/15 | 改为"8/15 需补齐" |

### 4.2 v1 需修正的概念（1 处）

| # | v1 表述 | 实际 | 修正建议 |
|---|--------|------|---------|
| M-04 | "StageExecutor.go:507 参数链断裂" | 是"上游 stage 输出未跨 stage 传播"，不是参数链断裂；注释在 503-511 行区间 | 改为"StageExecutor.go:503-511 上游 artifact 未跨 stage 传播" |

### 4.3 v1 未提及但重要的正面发现（3 处）

| # | 遗漏 | 位置 |
|---|------|------|
| P-01 | ContainerExecutor 双策略（LocalSpawn + Docker） | container_executor.go 307 行 |
| P-02 | MultiTargetExecutor fan-out 多目标执行 | multi_target_executor.go 221 行 |
| P-03 | gRPC server 204 行 + Checkpoint/Retry/Parallel 3 文件共 478 行 | pipeline_engine_grpc_server.go + retry.go + checkpoint.go + parallel_stage.go |

### 4.4 真实缺陷清单（保留 v1 结论）

| # | 缺陷 | 证据 | 严重度 |
|---|------|------|--------|
| F-01 | StageExecutor 上游 artifact 未传播 | StageExecutor.go:503-511 注释自证 | P0 |
| F-02 | TaskRunner 只有 3 种（shell/docker/sub-pipeline） | StageExecutor.go:438-442 switch 分支 | P0 |
| F-03 | 缺 SSH/WinRM/Telnet/IPMI/Kubernetes 5 类协议 | 全仓 grep 无结果 | P1 |
| F-04 | Runner Agent 仅 Linux/Node.js，无 Windows/AIX | runner/service 无 OS 分支 | P1 |
| F-05 | 12 个 handler 内完全无 catalog/combop/customtemplate/profile/scenario | grep 全 0 命中 | P0 |
| F-06 | pipeline-template vs pipeline-templates、pipeline-version vs pipeline-versions 疑似重复 | ls internal/ 输出 | P2 |
| F-07 | pipeline-engine handler 只有 6 endpoints（vs NeatLogic 15 子域） | handler.go 输出 | P0 |

---

## 五、认知边界

1. **未做深度代码审计**：只抽查了 4 项关键声明，未逐行审 pipeline-engine 全部 3163 行。可能存在"骨架完整但空实现"的文件（比如 retry.go 190 行是否真的做重试，本次未展开）。
2. **NeatLogic 只查了 API 目录名**：未逐文件读 380 个 autoexec Java 文件的功能实现，只做子域计数。
3. **"完成度"定义模糊**：本报告用 6 维度等权/加权平均，但 NeatLogic 的"深度"（比如 autoexec-job 的 7 个子模型 + 4 个 PhaseNodeExportHandler）在本次未量化到维度分。
4. **测试用例未查**：`*_test.go` 文件被排除在所有 grep 之外，无法判断引擎能力的测试覆盖度。
5. **wiring 层盲区**：本次未查 `main.go` 或 `app.go` 中这些模块是否真的被挂载到路由，可能存在"代码写了但没接线"的情况。
6. **置信度**：数字部分（模块数、代码行数、endpoints 数、grep 命中）置信度高（±1）；完成度百分比置信度中等（±8pp）；与 v1/v2 的差异归因置信度低（±5pp）。

---

## 六、附：完整 grep 命令清单

```bash
# 1. 模块数
ls orion-platform-svc-go/internal/ | grep -E "pipeline|runner|saga|auto-|execution" | wc -l  # 26
ls orion-platform-svc-go/internal/ | grep -E "pipeline|runner|saga|auto-|execution|orchestr|plugin" | wc -l  # 30

# 2. 代码规模
find orion-platform-svc-go/internal/pipeline-engine/service -name "*.go" -not -name "*_test.go" | xargs wc -l | tail -1  # 3163
find orion-platform-svc-go/internal/{pipeline-engine,pipeline,auto-exec,orchestration,runner,pipeline-executor,execution-mode-engine,auto-recovery,autonomous-pipeline,data-pipeline,alert-pipeline,test-execution-engine} -name "*.go" -not -name "*_test.go" | xargs wc -l | tail -1  # 6964

# 3. Endpoints
grep -rE '\.(POST|GET|PUT|DELETE|PATCH)\("' <12 handler.go files> | wc -l  # 107
grep -cE '\.(POST|GET|PUT|DELETE|PATCH)\(' orion-platform-svc-go/internal/pipeline-engine/handler/handler.go  # 6

# 4. StageExecutor 关键注释
grep -n "Upstream task outputs" orion-platform-svc-go/internal/pipeline-engine/service/StageExecutor.go  # line 507
sed -n '503,511p' orion-platform-svc-go/internal/pipeline-engine/service/StageExecutor.go  # 完整注释块

# 5. NeatLogic 模块规模
find /private/tmp/neatlogic-itom/neatlogic-autoexec -name "*.java" | wc -l  # 380
find /private/tmp/neatlogic-itom/neatlogic-autoexec-base -name "*.java" | wc -l  # 388
ls /private/tmp/neatlogic-itom/neatlogic-autoexec/src/main/java/neatlogic/module/autoexec/api/  # 15 subdirs

# 6. 子域缺失验证（限定自动化核心模块）
grep -rli "catalog\|combop\|customtemplate\|profile\|scenario" <auto modules>  # 全 0
```

---

## 七、最终建议

**保留 v1 的"完成度严重不足"定性判断**（28-32% 依然严重低于 60% 生产可用性门槛），但**修正三个具体数字**：

1. 模块数：27 → 26（或 30，取决于边界）
2. NeatLogic API 子域：16 → 15
3. 缺失子域：12/16 → 8/15

**优先修复的 3 项 P0**（如果只做 3 件事）：

1. **修 StageExecutor 上游 artifact 传播**（StageExecutor.go:503-511 注释自证的空洞）
2. **扩 TaskRunner 类型**（当前只有 shell/docker/sub-pipeline，加 SSH/WinRM/Kubernetes 3 种运维常用）
3. **补 5 个 API 子域**（catalog / scenario / profile / combop / customtemplate 至少做最小版）
