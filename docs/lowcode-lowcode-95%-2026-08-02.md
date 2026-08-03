# 低代码域 95%+ 完善方案

> **编制**: 2026-08-02 | **对标**: OutSystems / Retool / n8n / Formbricks
> **范围**: lowcode/form/param-types/import-export + workflow engine + 前端可视化

---

## 一、现状实测 — 真实能力 vs 100% 差距

### 1.1 后端现状（已实现）

| 模块 | Wired | 规模 | 已实现能力 | 缺陷 |
|------|:-----:|------|-----------|------|
| **lowcode** | ✅ | 15S/14R | Flow CRUD/Publish/Execute/Version/Import/Export/Template | nodes/edges 存为 JSONB 字符串，无 Schema 校验；无真正的 DAG 执行 |
| **form engine** | ✅ | 27S/27R | **渲染引擎**：RenderJSON/HTML/React/YAML；校验引擎：EvaluateCondition/Validate；表单字段 12 种类型 | **0 测试**；缺前端渲染器组件 |
| **param-types** | ❌ | 10H/132S | 参数类型 CRUD/Validate/Template，132 种参数类型 | **未 wiring** |
| **import-export** | ❌ | 7H/20+S | CSV/JSON/JSONL 导入导出，异步进度，Factory 注册模式，3 种数据 handler | **未 wiring** |
| **workflow engine** | ❌ | 30+ 方法 | StepHandlerFactory、内置 Assignee/Action(HTTP/VariableSet/Script)、SLA Monitor | **父模块未 wired**；与 lowcode 无集成 |

### 1.2 前端现状（100% 缺失）

| 缺失项 | 当前状态 |
|--------|---------|
| lowcode 可视化设计器 | **0 页面，0 canvas 库依赖** |
| workflow designer | **0 页面** |
| form 动态渲染器 | **0 组件**（后端有 RenderReact 输出但前端未消费） |
| 组件库（画布节点/属性面板/表单组件） | **0** |

**前端 package.json 中无任何 canvas/flow/diagram 库**：reactflow ✗ / X6 ✗ / jsPlumb ✗ / LogicFlow ✗ / BPMN ✗

### 1.3 核心差距诊断

```
低代码域 74% 的原因不是 wiring，而是：

L1 wiring 缺失 (15%) — param-types + import-export 未接线
L2 前端 100% 缺失 (55%) — 可视化设计器/组件库/渲染器全部缺失
L3 后端深度不足 (30%) — lowcode 无 DAG 执行 / nodes 无 Schema / workflow 与 lowcode 未集成
```

---

## 二、完善方案 — 5 层架构设计

### 架构全景

```
┌─────────────────────────────────────────────────────────────────────┐
│                        前端层 (0 → 完整)                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │ LowcodeCanvas    │  │ WorkflowDesigner │  │ DynamicFormBuilder │  │
│  │ (ReactFlow +     │  │ (ReactFlow +     │  │ (FormEngine 前端)  │  │
│  │  自定义节点)     │  │  BPMN 语义)      │  │                    │  │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬───────────┘  │
│           │                    │                      │              │
│  ┌────────┴────────────────────┴──────────────────────┴──────────┐  │
│  │              组件库 @orion-lc-ui (新增)                        │  │
│  │  NodePalette │ PropertyPanel │ CanvasToolbar │ FormRenderer    │  │
│  └────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        后端服务层 (15S → 60S+)                        │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ lowcode      │  │ form engine      │  │ lowcode-dsl-validator│  │
│  │ (Flow CRUD)  │  │ (Render/Validate)│  │ (新增: Schema 校验)  │  │
│  └──────┬───────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│         │                   │                       │              │
│  ┌──────┴───────────────────┴───────────────────────┴──────────┐  │
│  │        Lowcode DAG Executor (新增) — 对接 workflow engine    │  │
│  └─────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        数据层                                         │
│  lowcode_workflow_definition (已有) + lowcode_executions (已有)      │
│  + lowcode_node_schema (新增) + lowcode_component_registry (新增)   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 层 1: 后端 Wiring + 深度增强

#### 1.1 Wiring 修复（P0, 1 天）

| # | 模块 | 修复方式 | 暴露能力 |
|---|------|---------|---------|
| 1 | **param-types** | wiring.go import + initWiring + router.go | 132 种参数类型 CRUD/Validate/Template |
| 2 | **import-export** | wiring.go import + initWiring + router.go | CSV/JSON 导入导出 + 异步进度 |
| 3 | **workflow** | wiring.go import + initWiring + router.go | 工作流引擎 StepHandler/SLA/Action |

#### 1.2 Nodes Schema 校验（P1, 2 天）

当前 lowcode nodes/edges 存为 `string`（JSONB），无 Schema 校验。

```go
// 新增 internal/lowcode/dsl/schema.go
type NodeSchema struct {
    Type        string                 `json:"type"`        // start/end/task/decision/approval/http/webhook
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Config      map[string]interface{} `json:"config"`      // 节点配置
    Inputs      []EdgeRef              `json:"inputs"`
    Outputs     []EdgeRef              `json:"outputs"`
    Variables   map[string]interface{} `json:"variables"`   // 节点变量
}

type EdgeRef struct {
    FromNode  string `json:"from_node"`
    ToNode    string `json:"to_node"`
    Condition string `json:"condition,omitempty"` // 条件分支
}

// 校验函数
func ValidateNodes(nodes []NodeSchema, edges []EdgeRef) (bool, []ValidationError)
func ValidateDAG(nodes []NodeSchema, edges []EdgeRef) (bool, error) // 循环检测
```

**支持的节点类型**（10 种）：

| 类型 | 说明 | 对标 |
|------|------|------|
| start | 流程开始 | n8n Start |
| end | 流程结束 | n8n End |
| task | 人工任务 | OutSystems Task |
| approval | 审批节点 | n8n Approval |
| decision | 条件分支 | n8n IF |
| http | HTTP 请求 | n8n HTTP Request |
| webhook | Webhook 触发 | n8n Webhook |
| script | 自定义脚本 | n8n Code |
| notify | 通知发送 | n8n Slack/Email |
| wait | 等待/定时 | n8n Wait |

#### 1.3 Lowcode DAG Executor 重建（P1, 5 天）

当前 `lowcode/service/ExecuteFlow` 只存 LowcodeInstance 状态，**无真正的 DAG 执行**。

```go
// 新增 internal/lowcode/executor/dag_executor.go
type DAGExecutor struct {
    stepHandlerFactory *workflow.StepHandlerFactory
    eventBus           *event.Bus
    logger             *zap.Logger
}

func (e *DAGExecutor) Execute(ctx context.Context, tenantID, flowID string, input map[string]any) *ExecutionResult {
    flow := e.flowRepo.GetFlow(ctx, tenantID, flowID)
    
    // 1. 拓扑排序（Kahn 算法）
    nodes, edges := e.parseNodes(flow.Nodes)
    order, err := KahnTopoSort(nodes, edges)
    if err != nil { return e.fail("DAG cycle detected") }
    
    // 2. 按拓扑顺序执行
    ctxVars := map[string]any{}
    for _, nodeID := range order {
        node := nodes[nodeID]
        result := e.executeNode(ctx, node, ctxVars)
        ctxVars[node.ID] = result.Output
        
        // 条件分支处理
        if node.Type == "decision" {
            order = e.filterByCondition(order, node, result)
        }
    }
    
    return e.succeed(ctxVars)
}

func (e *DAGExecutor) executeNode(ctx context.Context, node NodeSchema, vars map[string]any) *StepResult {
    // 复用 workflow engine 的 StepHandlerFactory
    handler, ok := e.stepHandlerFactory.Get(node.Type)
    if !ok { return e.unknownHandler(node.Type) }
    
    ctx := &WorkflowTaskContext{
        Input:   node.Config,
        Vars:    vars,
        NodeID:  node.ID,
    }
    return handler.Execute(ctx)
}
```

**关键设计**：复用 workflow engine 已有的 `StepHandlerFactory`，lowcode DAG Executor 只负责拓扑排序和节点调度，具体节点执行委托给 StepHandler。

#### 1.4 组件注册中心（P2, 2 天）

```go
// 新增 internal/lowcode/component/registry.go
type ComponentRegistry struct {
    forms   map[string]FormComponent // 表单组件
    nodes   map[string]NodeComponent // 画布节点
    actions map[string]ActionComponent // 动作组件
}

// 表单组件 (12 种)
func (r *ComponentRegistry) RegisterForm(name string, comp FormComponent)

// 画布节点
func (r *ComponentRegistry) RegisterNode(name string, comp NodeComponent)
```

表单组件 12 种：Text/Number/Select/MultiSelect/Radio/Checkbox/Date/DateTime/TextArea/Upload/Image/ColorPicker
画布节点：见上方 10 种
动作组件：HTTP/API/Script/Email/Slack/Approval

#### 1.5 form engine 测试（P0, 1 天）

form engine 有 27 Service 方法 + 完整渲染引擎但 **0 测试**：

```go
func TestFormEngine_CreateForm(t *testing.T)
func TestFormEngine_RenderForm(t *testing.T)
func TestFormEngine_ValidateSubmission(t *testing.T)
func TestFormEngine_EvaluateCondition(t *testing.T)
func TestFormEngine_SubmitForm(t *testing.T)
func TestFormEngine_RenderReact(t *testing.T)
func TestFormEngine_ResolveVisibility(t *testing.T)
```

---

### 层 2: 前端可视化设计器（核心缺口）

#### 2.1 前端基础设施（P1, 1 天）

```json
// package.json 新增
{
  "dependencies": {
    "@xyflow/react": "^12.0.0",     // ReactFlow (画布引擎)
    "zod": "^3.23.0",                // Schema 校验
    "react-hook-form": "^7.51.0",    // 表单管理
    "@dnd-kit/core": "^6.1.0",       // 拖拽
    "@dnd-kit/sortable": "^8.0.0"
  }
}
```

#### 2.2 LowcodeCanvas — 流程图设计器（P1, 5 天）

```
┌─────────────────────────────────────────────────────────────────┐
│  组件面板              │          画布 (ReactFlow)               │
│  ┌─────────────┐       │  ┌──────────────────────────────────┐  │
│  │ 🟢 Start    │       │  │  ● Start                          │  │
│  │ 🔵 Task     │  ──→  │  │     │                             │  │
│  │ 🟡 Decision │       │  │     ▼                             │  │
│  │ 🟣 Approval │       │  │  ◆ Task ──→ ● Approval ──→ ● End │  │
│  │ ⚡ HTTP     │       │  │     │                             │  │
│  │ 📧 Notify   │       │  └──────────────────────────────────┘  │
│  │ ...         │       │                                        │
│  └─────────────┘       │  ┌──────────────────────────────────┐  │
│                         │  │  属性面板 (PropertyPanel)          │  │
│                         │  │  节点: Task-1                     │  │
│                         │  │  ┌────────────────────────────┐  │  │
│                         │  │  │ 名称: [审批节点       ]      │  │  │
│                         │  │  │ 配置:                      │  │  │
│                         │  │  │   审批人: [张三        ]     │  │  │
│                         │  │  │   超时时间: [24h       ]     │  │  │
│                         │  │  │   [ 保存 ]                  │  │  │
│                         │  │  └────────────────────────────┘  │  │
│                         │  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**核心组件**：

| 组件 | 路径 | 说明 |
|------|------|------|
| `LowcodeCanvas` | `pages/lowcode/LowcodeCanvas.tsx` | 主容器，ReactFlow + 组件面板 + 属性面板 |
| `NodePalette` | `pages/lowcode/NodePalette.tsx` | 左侧组件面板，10 种节点拖拽 |
| `FlowNode` | `pages/lowcode/FlowNode.tsx` | 自定义 ReactFlow 节点组件 |
| `PropertyPanel` | `pages/lowcode/PropertyPanel.tsx` | 右侧属性面板 |
| `CanvasToolbar` | `pages/lowcode/CanvasToolbar.tsx` | 工具栏（保存/运行/导入/导出/撤销/重做） |

#### 2.3 WorkflowDesigner — BPMN 语义设计器（P2, 3 天）

lowcode 负责流程设计，workflow designer 负责工作流语义：
- 节点类型：StartEvent / EndEvent / Task / UserTask / Gateway / ServiceTask
- 与 lowcode 共享 ReactFlow 引擎，但使用 BPMN 2.0 语义
- 支持：SLA 配置、审批流、条件网关

#### 2.4 DynamicFormBuilder — 表单设计器（P2, 3 天）

```
┌─────────────────────────────────────────────────────────────────┐
│  字段面板              │          表单画布                        │
│  ┌─────────────┐       │  ┌──────────────────────────────────┐  │
│  │ Text        │  ──→  │  │  [ Text: 姓名 _______ ]          │  │
│  │ Number      │       │  │  [ Select: 部门 ▼        ]       │  │
│  │ Select      │       │  │  [ Date: 日期 _______ ]          │  │
│  │ ...         │       │  │                                  │  │
│  └─────────────┘       │  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

- 拖拽字段 → 生成 JSON Schema
- 前端 `FormRenderer.tsx` 消费 `form engine RenderReact()` 输出
- 12 种字段类型：Text/Number/Select/MultiSelect/Radio/Checkbox/Date/DateTime/TextArea/Upload/Image/ColorPicker

#### 2.5 前端组件库 @orion-lc-ui（P2, 2 天）

```
src/components/orion-lc-ui/
├── canvas/
│   ├── Canvas.tsx          — ReactFlow 封装
│   ├── NodePalette.tsx     — 节点面板
│   ├── FlowNode.tsx        — 自定义节点
│   └── MiniMap.tsx         — 缩略图
├── forms/
│   ├── FormRenderer.tsx    — 动态表单渲染器
│   ├── FormDesigner.tsx    — 表单设计器
│   └── fields/             — 12 种字段组件
│       ├── TextField.tsx
│       ├── SelectField.tsx
│       ├── DatePickerField.tsx
│       └── ...
├── panels/
│   ├── PropertyPanel.tsx   — 属性面板
│   └── Toolbar.tsx         — 工具栏
└── index.tsx               — 统一导出
```

---

### 层 3: lowcode + workflow engine 集成

当前 lowcode 和 workflow engine 是两个独立模块。

#### 3.1 集成架构（P1, 2 天）

```
lowcode/service/ExecuteFlow()
    │
    ▼
lowcode/executor/DAGExecutor
    │
    ├── Kahn 拓扑排序 (节点排序)
    ├── 条件分支过滤 (decision 节点)
    │
    ▼
workflow/engine/StepHandlerFactory.Get(node.type)
    │
    ├── AssigneeStepHandler (task/approval)
    ├── ActionStepHandler (http/script/variableSet)
    ├── NotifyStepHandler (notify)
    └── WaitStepHandler (wait)
    │
    ▼
workflow/engine/SLAMonitor (SLA 计时)
```

#### 3.2 步骤 handler 注册

```go
// 在 lowcode executor 初始化时注册扩展节点
func (e *DAGExecutor) initNodeHandlers() {
    // 复用 workflow engine 已有 handler
    e.stepHandlerFactory.Register(&httpHandler{})
    e.stepHandlerFactory.Register(&scriptHandler{})
    e.stepHandlerFactory.Register(&notifyHandler{})
    e.stepHandlerFactory.Register(&waitHandler{})
    
    // 新增低代码专用 handler
    e.stepHandlerFactory.Register(&decisionHandler{})
}
```

---

## 三、时间线

```
P0 — wiring + 测试                     ████                           → 2 天
P1 — Nodes Schema + DAG Executor       ████████████                   → 7 天
P1 — 前端 ReactFlow 设计器              ████████████                   → 6 天
P2 — 组件库 + 表单设计器                ████████████                   → 5 天
P2 — Workflow Designer + BPMN          ████████                       → 3 天
P2 — 组件注册中心                       ████                           → 2 天
                                             合计: 25 天
                                             4 Agent 并行: 7-8 天
```

---

## 四、预期收益

| 指标 | 当前 | 完善后 |
|------|------|--------|
| 低代码域成熟度 | 74% | **95%+** |
| lowcode 节点类型 | 0 (JSONB 字符串) | **10 种 Schema 定义节点** |
| DAG 执行 | 无 | **Kahn 拓扑排序 + StepHandler 复用** |
| 前端可视化 | 0 | **ReactFlow 设计器 + 12 种表单组件** |
| form 测试 | 0 | **20+ 测试** |
| param-types | 未 wired | **已 wired + 132 类型可用** |
| import-export | 未 wired | **已 wired + CSV/JSON 可用** |
| workflow engine | 未 wired | **已 wired + lowcode 集成** |
| 组件库 | 0 | **@orion-lc-ui 统一组件库** |
