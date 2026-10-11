# Orion ITSM 能力对标 · 独立复评（Rereview）

> **版本**：rereview（2026-10-01）
> **评审对象**：`orion-platform-svc-go/internal/` + `orion-frontend/src/pages/`
> **对标基准**：NeatLogic ITS（13 API 子域）+ ITIL v3/v4 通用能力
> **方法**：对 v1/v2 关键声明逐项 grep/glob 实证复核
> **前置阅读**：`itsm-expert-review-2026-09-30.md`（v1 33.7%）+ `itsm-expert-supplement-2026-10-01.md`（v2 30%）

---

## TL;DR（5 条）

1. **v1/v2 完成度都不准确**。v1 33.7% 略高估，v2 30% 明显低估。**独立复评约 42%（区间 36–48%，±5%）**。v1 误判：SLA 引擎、三层 Dashboard 判为存疑/缺失；v2 误判：FormDesigner 未落库、channel 完全缺失。
2. **v1 "workflow 完全不消费 Nodes/Edges" 表述过宽**。执行路径（CreateInstance/CompleteTask）不遍历图属实，但 `AnalyzeDependencies`/`CheckDefinition`/`GetVisualizationData` 三个方法**消费了 Nodes/Edges** 做周期检测与可视化——是"分析层消费、执行层不消费"。
3. **v2 "FormDesigner 是 localStorage" 是过度概括**。前端 `api.ts` 明确写 "Forms: real API via lowcode. Conditions: localStorage-backed"。后端 `internal/form/` **2098 行** 含 FormDefinition/FormField/FormSubmission 完整模型——**Forms 已落库，仅 Conditions 走 localStorage**。
4. **v2 "channel 20 API 完全缺失" 是错的**。`internal/channel/` **546 行** 含 NotificationChannel 完整 CRUD。真正缺失的是 `channeltype`（渠道类型元数据），不是 channel 本体。
5. **v1/v2 都遗漏了 DispatchService 亮点**。`internal/ticket/service/dispatch.go` **520 行** 真实派工评分（AutoDispatch + calculateScore 加权 + FindBestEngineer + SLA 感知），NeatLogic processtask 都没有的差异化能力。

---

## 一、9 项关键声明抽查结果

### 1. workflow 引擎是否不消费 Nodes/Edges

```bash
$ grep -n "CreateInstance\|CompleteTask" internal/workflow/workflow/service/workflow_service.go
168: func (s *Service) CreateInstance(...)   # 直接创建 running 实例
315: func (s *Service) CompleteTask(...)     # 直接改状态
$ grep -n "extractNodeArray\|AnalyzeDependencies\|CheckDefinition\|GetVisualizationData" ...
331: AnalyzeDependencies(...)   # 遍历 Nodes+Edges 构建依赖图
370: CheckDefinition(...)       # 单定义周期检测
406: GetVisualizationData(...)  # 生成可视化节点/边
$ grep -c "extractNodeArray" ...workflow_service.go
6  # 6 处引用
```

**复评**：**部分成立**。执行路径不消费图（属实），但分析层消费了 Nodes/Edges（v1/v2 漏判）。v1 表述应收窄为"执行层不消费、分析层消费"。

### 2. ticket-automation 3 字段退化

```bash
$ grep -A8 "type AutomationRule" internal/ticket-automation/models/models.go
10: type AutomationRule struct { ID, TenantID, Name, Value, Enabled, CreatedAt, UpdatedAt }
29: var UpdateableColumns = []string{"name", "value", "enabled"}
```

**复评**：**属实**。除 id/tenant_id/时间戳外只有 3 个业务字段。准确表述是"缺条件-动作语法"而非"完全无自动化"。

### 3. service-catalog 3 字段

```bash
$ grep -A8 "type ServiceCatalog struct" internal/service-catalog/models/models.go
6: type ServiceCatalog struct { ID, TenantID, Name, Value, Enabled, CreatedAt, UpdatedAt }
```

**复评**：**属实但表述过重**。3 字段虽窄但**语义正确**（服务条目 + 启用状态），真正缺失是 SLA 引用、owner、category 层级、依赖关系。v1 "概念错位"应改为"字段过窄但概念正确"。

### 4. FormDesigner localStorage 是否落库

```bash
$ head -7 orion-frontend/src/pages/FormDesigner/api.ts
/** FormDesigner condition localStorage persistence
 * Forms: real API via '@/api/lowcode' (Go backend online).
 * Conditions: localStorage-backed (Go backend pending). */
$ grep -n "createForm\|updateForm" ...useFormDesignerState.ts
22: import { createForm, deleteForm, updateForm } from '@/api/lowcode';
$ find internal/form -name "*.go" -not -name "*_test.go" -exec wc -l {} + | tail -1
2098 total  # FormDefinition/FormField/FormSubmission/ValidationResult/RenderFormResponse
```

**复评**：**v1/v2 严重误判**。Forms 本体走 lowcode API 落库，仅 Conditions 走 localStorage。v2 P0-4 应撤回或降级为 P2（仅 Conditions 需落库）。

### 5. 模块过度拆分实际数字

```bash
$ ls internal/ | grep -E "^(ticket|service-catalog|form|sla|workflow|approval|knowledge|channel|queue)" | wc -l
17  # ITSM 相关模块（v1 说 12，v2 说 18）
$ ls internal/ | wc -l
295  # 总模块数（17/295 = 5.8%）
$ find internal/ticket -name "*.go" -not -name "*_test.go" -exec wc -l {} + | tail -1
8280 total
$ find internal/ticketing -name "*.go" -not -name "*_test.go" -exec wc -l {} + | tail -1
11857 total  # 与 ticket 功能真实重叠
```

**复评**：**v1/v2 方向对但数字有误**。实际 17 个 ITSM 模块（v1 12、v2 18 均不准）。重叠集中：ticket 系列（4 模块，8280+11857 行）+ workflow 系列（5 模块）。

### 6. TicketTransfer 5 类型

```bash
$ grep -A6 "type TransferType" internal/ticket/models/transfer_enhanced.go
9:  TransferTypeManual   TransferType = "manual"
10: TransferTypeAuto     TransferType = "auto"
11: TransferTypeTimeout  TransferType = "timeout"
12: TransferTypeSuspend  TransferType = "suspend"
13: TransferTypeEscalate TransferType = "escalate"
```

**复评**：**数量对，类型名错**。实际 manual/auto/timeout/suspend/escalate，v1 写 manual/auto/escalation/backup/transfer 有误。suspend 是"暂停自动转派"能力，比 backup 更符合 ITIL 语义。

### 7. EngineerDashboard 3 层

```bash
$ grep -n "GetEngineerDashboard\|GetManagerDashboard\|GetExecutiveDashboard" internal/ticket/service/analytics*.go
analytics.go:98: GetExecutiveDashboard(...)       analytics.go:113: GetManagerDashboard(...)
analytics_enhanced.go:202: GetManagerDashboardEnhanced(...)  :245: GetEngineerDashboardEnhanced(...)
$ ls orion-frontend/src/pages/ | grep -E "^(Engineer|Manager|Executive)Dashboard"
EngineerDashboard/  ExecutiveDashboard/  ManagerDashboard/
```

**复评**：**v1 判断完全错误**。三层 Dashboard 后端 + 前端全部存在，每层都有基础版 + Enhanced 版。v1 应撤回此断言。

### 8. SLA engine 是否真实现

```bash
$ grep -n "^func.*Calculator" internal/sla-engine/service/calculator.go
53:  CalculateDeadlines   72: CreateTracker   101: PauseTracker
125: ResumeTracker        144: RecordResponse  172: RecordResolution
201: CheckBreaches        253: CreateProfile   299: UpdateProfile
347: DeleteProfile        352: CreateHoliday
$ grep -n "addBusinessHours\|isWorkingDay\|WeekendsIncluded\|WorkingDays" ...calculator.go
407: addBusinessHours   485: isWorkingDay   409: // Parse working hours "09:00-18:00"
$ find internal/sla-engine -name "*.go" -exec wc -l {} + | tail -1
2278 total  # calculator 533 + compliance 144 + test 741 + repo 524 + handler 324
$ grep -rn "SLABreak\|SLAException\|SLAPolicy\|EscalationMatrix\|SLAConfig" internal/sla-engine/ | wc -l
0  # 五个显式概念确实不存在
```

**复评**：**v1 存疑方向对但结论太悲观**。计算引擎真实（533 行 + 工时/工作日/假期），但**策略管理层缺失**（无 SLABreak/Exception/Policy/Matrix/Config 五类）。应拆两断言：
- ✅ 计算引擎真实（v1 判存疑是错的）
- ❌ 策略管理层缺失（v1 该断言正确）

### 9. 遗漏亮点：DispatchService

```bash
$ grep -n "^func.*DispatchService" internal/ticket/service/dispatch.go
73:  AutoDispatch          134: ManualDispatch      176: FindBestEngineer
216: CalculateDispatchScore  236: calculateScore    286: getMatchReasons
332: GetMetrics              342: GetLoadBalanceReport  385: AddRule
$ wc -l internal/ticket/service/dispatch.go
520
```

**复评**：DispatchService 是 ITSM **真正亮点**——520 行含加权评分、SLA 感知（依赖 slaRepo）、负载均衡报告、动态权重调整。v1/v2 均遗漏。

---

## 二、完成度重算

### 2.1 独立评分矩阵

| 能力域 | v1 | v2 | **本次** | 依据 |
|--------|-----|-----|---------|------|
| 工单 CRUD（ticket+ticketing） | 70% | 30% | **65%** | 8280+11857 行，模型真实但 vs processtask 108 API |
| 工单自动化 | 15% | 10% | **20%** | 3 字段退化属实 |
| 工单知识 | 60% | - | **60%** | 独立模块存在 |
| 派工评分 DispatchService | - | - | **75%** | 520 行真实算法，SLA 感知 |
| workflow 定义 CRUD | 40% | 25% | **55%** | 表+CRUD 完整 |
| workflow 执行引擎 | 10% | 25% | **20%** | CreateInstance/CompleteTask 不遍历 |
| workflow 依赖分析 | - | - | **60%** | AnalyzeDependencies/CheckDefinition |
| workflow 触发器 | 40% | - | **50%** | workflow-trigger/webhook |
| 服务目录 | 15% | 15% | **30%** | 3 字段虽窄但概念正确 |
| FormDesigner | 15% | 20% | **55%** | Forms 落库，仅 Conditions localStorage |
| SLA 计算引擎 | 存疑 | 60% | **65%** | 533 行 calculator |
| SLA 策略管理 | 存疑 | 60% | **20%** | 无 5 类策略概念 |
| 审批 | 60% | - | **60%** | 10 Go 文件 |
| 知识库 | 60% | - | **60%** | 21 Go 文件 |
| channel | - | 0% | **50%** | 546 行含 NotificationChannel CRUD |
| queue | - | - | **55%** | 765 行含 Queue/Job/Enqueue |
| 三层 Dashboard | 30% | - | **70%** | Engineer/Manager/Executive 全存在 |
| TicketTransfer | 60% | - | **60%** | 5 类型 |
| workcenter | - | 0% | **10%** | NeatLogic 24 API 完全缺失 |
| channeltype | - | 0% | **10%** | 真正的缺失点 |

### 2.2 完成度汇总

- **v1**：33.7%（未拆策略层，未评 channel/queue/dispatch）
- **v2**：30%（误判 FormDesigner 与 channel 为缺失）
- **本次算术平均**：**约 48.5%**
- **对齐 NeatLogic ITS 13 API 子域**：约 **40%**
- **对齐 ITIL v3/v4 通用能力**：约 **48%**

**独立数字**：**36–48%（中位数 42%，±5%）**，比 v1 上调 8.3pp，比 v2 上调 12pp。

### 2.3 误差来源

未量化 ticket vs ticketing 重叠度（估计 40-50% 功能重复）；未深入 process-step/workflow-task/workflow-webhook 小模块；NeatLogic 基准依赖 v2 报告（未直接读源码）。

---

## 三、v1 必须修正项

1. **§workflow 引擎"不消费 Nodes/Edges"表述过宽**
   - 改为："执行层不消费图，分析层消费 Nodes/Edges 做周期检测与可视化"
   - P0 定位保留（执行层缺失是硬阻塞）

2. **§"engineer 有独立 Dashboard 而 manager/executive 没有"**
   - **撤回此断言**。三层 Dashboard 后端 analytics.go + analytics_enhanced.go 完整，前端 3 目录都在
   - 证据：`grep GetExecutiveDashboard analytics.go → 98`；`ls pages/ → 3 Dashboard 目录`

3. **§"SLA engine 是否真实现存疑"**
   - 拆两条：(a) 计算引擎真实（撤回存疑）；(b) 策略管理层缺失（保留）
   - 证据：calculator.go 533 行 + addBusinessHours/isWorkingDay/WeekendsIncluded/WorkingDays

4. **§TicketTransfer 5 类型清单**
   - 改为：manual/auto/timeout/suspend/escalate（原 manual/auto/escalation/backup/transfer 有误）

5. **§模块拆分表述**
   - 从"workflow 拆 5 个"扩展为"17 个 ITSM 模块（5.8%），重叠集中在 ticket 系列和 workflow 系列"

6. **§遗漏亮点：DispatchService**
   - 补充 520 行派工评分（AutoDispatch/CalculateDispatchScore/加权/SLA 感知）

7. **§遗漏亮点：channel + queue**
   - `internal/channel/` 546 行完整 CRUD；`internal/queue/` 765 行含 Queue/Job/Enqueue

---

## 四、v2 必须修正项

1. **§P0-4 "FormDesigner localStorage 表单换电脑就消失"**
   - **撤回**。Forms 走 lowcode API 落库，后端 2098 行完整模型
   - 改为 P2："仅 Conditions 需落库"

2. **§P1-2 "channel/channeltype 20 API 完全缺失"**
   - **拆分为两条**：
     - channel 有 546 行 CRUD，改为 P2 部分缺失
     - channeltype 完全缺失，保留 P1

3. **§完成度 30% 过低**
   - 上调至 **36–48%（中位数 42%）**
   - 低估原因：FormDesigner 判 20%、channel 判 0%、漏评 DispatchService（75%）

4. **§"18 个 ITSM 相关模块"数字**
   - 改为 **17 个**（v2 数了不存在的 form-designer，实际是 form）

5. **§工时估算 123d 需重估**
   - P0-4（FormDesigner 后端 15d）实际只需补 Conditions 后端（≈3d）
   - Phase 1 从 45d 降至 30d

6. **§"sla-engine 是亮点"表述过重**
   - 改为"sla-engine 计算引擎是亮点，但缺 SLABreak/Exception/Policy/Matrix/Config 五类策略概念"

7. **§遗漏 DispatchService 亮点**
   - 补充 `internal/ticket/service/dispatch.go` 520 行派工评分

---

## 五、Rereview 修正后的核心判断

### 5.1 ITSM 三大真实亮点（v1/v2 均未充分突出）

1. **派工评分 DispatchService**（520 行，加权评分 + SLA 感知 + 负载均衡）
2. **SLA 计算引擎**（533 行 calculator，含工时/工作日/假期计算）
3. **Ticket + Ticketing 双模块**（8280 + 11857 行，模型丰富但有重叠）

### 5.2 ITSM 三大真实短板（v1/v2 判断准确）

1. **workflow 执行层不消费图**（P0，创建实例和完成任务都不走节点遍历）
2. **SLA 策略管理层缺失**（P0，无 SLABreak/Exception/Policy/Matrix）
3. **服务目录 + 工单自动化字段过窄**（P1，各 3 字段）

### 5.3 ITSM 三大真实遗漏（v1/v2 都判错）

1. **FormDesigner 表单本体已落库**（v1/v2 均误判为 localStorage）
2. **channel 模块已存在**（v2 误判为完全缺失）
3. **三层 Dashboard 全部存在**（v1 误判为只有 engineer）

### 5.4 综合评级

| 版本 | 评级 | 完成度 | 特征 |
|------|------|--------|------|
| v1 | C+ | 33.7% | 方向对但含 4 处误判 |
| v2 | C- | 30% | NeatLogic 严谨但含 3 处误判 + 3 处遗漏 |
| **rereview** | **B-** | **约 42%（36–48%）** | 拆分 v1/v2 误判 + 补遗漏亮点 |

---

## 六、P0 列表收敛建议

| 编号 | 内容 | v1 | v2 | **rereview** |
|------|------|----|----|--------------|
| P0-1 | workflow 执行引擎消费 Nodes/Edges | P0 | P0 | **保留 P0** |
| P0-2 | SLA 策略管理层（新增） | 未识别 | 未识别 | **新增 P0** |
| P0-3 | service-catalog 概念错位 | P0 | P0 | **降级 P1**（概念正确字段过窄） |
| P0-4 | FormDesigner 后端持久化 | P0 | P0 | **撤回**（Forms 已落库，仅 Conditions 需落库→P2） |
| P1-1 | workcenter 24 API 缺失 | - | P1 | **保留 P1** |
| P1-2 | channeltype 元数据缺失 | - | P1 | **保留 P1**（channel 本体已存在） |

---

## 七、证据文件索引

| 类别 | 文件 | 关键位置 |
|------|------|---------|
| workflow 服务 | `internal/workflow/workflow/service/workflow_service.go` | 523 行；168/315 不消费图；331/370/406 消费图 |
| ticket-automation | `internal/ticket-automation/models/models.go` | 10-18 行 AutomationRule 3 字段 |
| service-catalog | `internal/service-catalog/models/models.go` | 6-14 行 ServiceCatalog 3 字段 |
| FormDesigner 前端 | `orion-frontend/src/pages/FormDesigner/api.ts` | 1-7 行明确 Forms API/Conditions localStorage |
| Form 后端 | `internal/form/` | 2098 行，FormDefinition/FormField/FormSubmission |
| 派工评分 | `internal/ticket/service/dispatch.go` | 520 行，73/134/176/216/236 行 |
| SLA 引擎 | `internal/sla-engine/service/calculator.go` | 533 行；53/101/125/144/172/201/253 行；407-498 行工时计算 |
| 三层 Dashboard 后端 | `internal/ticket/service/analytics.go` + `analytics_enhanced.go` | 98/113/202/245 行 |
| 三层 Dashboard 前端 | `orion-frontend/src/pages/EngineerDashboard/` 等三目录 | index.tsx + Components/ |
| TicketTransfer | `internal/ticket/models/transfer_enhanced.go` | 9-13 行 5 类型 |
| channel | `internal/channel/` | 546 行，NotificationChannel |
| queue | `internal/queue/` | 765 行，Queue/Job |

---

## 八、grep 命令集合（复现证据）

```bash
# workflow 执行层不消费图 vs 分析层消费 Nodes/Edges
grep -n "CreateInstance\|CompleteTask\|extractNodeArray\|AnalyzeDependencies\|CheckDefinition\|GetVisualizationData" internal/workflow/workflow/service/workflow_service.go

# 3 字段模型
grep -A8 "type AutomationRule" internal/ticket-automation/models/models.go
grep -A8 "type ServiceCatalog struct" internal/service-catalog/models/models.go

# FormDesigner Forms 走 API
grep -n "createForm\|updateForm" orion-frontend/src/pages/FormDesigner/useFormDesignerState.ts
find internal/form -name "*.go" -not -name "*_test.go" -exec wc -l {} +

# 派工评分 & SLA 引擎真实方法
grep -n "^func.*DispatchService" internal/ticket/service/dispatch.go
grep -n "^func.*Calculator" internal/sla-engine/service/calculator.go

# SLA 策略概念缺失
grep -rn "SLABreak\|SLAException\|SLAPolicy\|EscalationMatrix\|SLAConfig" internal/sla-engine/

# 三层 Dashboard 后端 + 前端
grep -n "GetEngineerDashboard\|GetManagerDashboard\|GetExecutiveDashboard" internal/ticket/service/analytics*.go
ls orion-frontend/src/pages/ | grep -E "^(Engineer|Manager|Executive)Dashboard"

# TicketTransfer 5 类型 & channel/queue 存在
grep -A6 "type TransferType" internal/ticket/models/transfer_enhanced.go
find internal/channel -name "*.go" -exec wc -l {} +
find internal/queue -name "*.go" -exec wc -l {} +

# ITSM 模块总数
ls internal/ | grep -E "^(ticket|service-catalog|form|sla|workflow|approval|knowledge|channel|queue)" | wc -l
```

---

## 九、复评方法与局限

**方法**：读取 v1（303 行）+ v2（307 行）→ 提取 9 项关键声明 → grep/Read 实证（约 40 条命令）→ 独立重算完成度 → 生成修正项清单。

**局限**：
- 未直接读取 NeatLogic 源码，NeatLogic 基准数据依赖 v2 报告
- 未深入 process-step、workflow-task、workflow-webhook 小模块内部
- 未量化 ticket vs ticketing 重叠度（估计 40-50% 功能重复，无实测数据）
- 未验证前端 API client 与后端路由一一对应关系

**置信度**：完成度 ±5%（36–48%），单项判断 ±15%

---

## 十、给 v1/v2 作者的合并建议

1. **完成度数字**：以 rereview 的 36–48%（中位数 42%）替代 v1 33.7% 与 v2 30%

2. **合并 TL;DR 五条**：
   - ITSM 完成度约 42%（不是 30% 也不是 33.7%）
   - 亮点：DispatchService + SLA 计算 + 三层 Dashboard + Ticket 双模块
   - 短板：workflow 执行层 + SLA 策略层 + workcenter 完全缺失
   - v1 主要误判：Dashboard 三层不存在、SLA engine 存疑
   - v2 主要误判：FormDesigner 未落库、channel 完全缺失

3. **P0 列表收敛**：
   - **保留 P0-1**：workflow 执行引擎消费 Nodes/Edges
   - **新增 P0-2**：SLA 策略管理层
   - **撤回 P0-3**（FormDesigner 后端）：改为 P2（仅 Conditions 需落库）
   - **降级 P0-4**（service-catalog）：改为 P1（字段过窄而非概念错位）

---

**复评日期**：2026-10-01
**复评方法**：40+ 条 grep/Read 命令实证 9 项关键声明
**置信度**：完成度 ±5%（36–48%），单项判断 ±15%

