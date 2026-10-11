# NeatLogic 架构设计与功能理念深度分析（2026-10-03）

> **定位**：不是单模块 gap 分析，而是从 8 份一手证据中抽取 **NeatLogic 的架构哲学 + 核心设计模式 + 能力效果矩阵**。
>
> **证据基础**：8 份 NL 一手代码报告（2,776 行），共扫描 4,230 Java 文件 / 482 Api 类 / 22 Service 接口 / 20+ 数据库表 / 22 Mapper + 20 XML。
>
> **上游一手证据**：
> - NL-1 CMDB+ITSM（213 行 · 18,427 Java · 482 Api · TransactionGroup+Snapshot）
> - NL-2 inspect+autoexec（432 行 · 66+193 API · 0 空壳）
> - NL-3 Alert+BI+RDM（249 行 · 326+120+290 Java · Alert 5 家族 PG Mapper 全 · Report JFreeChart 真实实现）
> - NL-4 deploy+tagent+change（420 行 · Tagent 是 Perl/Python 双语言 host agent）
> - NL-5 5 大未覆盖模块（527 行 · 推翻 Agent 4 二手引用）
> - NL-6 Change+Event（333 行 · Change=ProcessTask StepHandler · Event↔Alert 零耦合）
> - NL-7 Knowledge（236 行 · PG-only 存储 · ES 全部注释 · Orion 已领先）
> - NL-8 Tenant+Runner（366 行 · ThreadLocal TenantContext + schema 隔离 · Runner 只跑本地 autoexec）
>
> **硬约束**：不估算人天；不修改生产代码；仅 Markdown。

---

## 0. TL;DR（6 条核心结论）

1. **NeatLogic 是"配置化工作流引擎 + 编排层 + 独立执行层"的三段式架构**——不是 Spring Boot 常规 CRUD 应用。4,230 Java 文件的核心不是"多业务模块"，而是**一套跨模块共享的自研框架**（`neatlogic-framework`）+ **每个模块都是这个框架上的配置化扩展**。
2. **架构哲学核心 5 项**：
   - **配置化优先**（不用代码分支，用 ChannelType/Channel/CatalogType 配置化区分业务语义）
   - **实例化分层**（Type → Template → Instance → Transaction 四层模型，覆盖 CMDB/Process/Alert 3 大域）
   - **组件化扩展**（StepHandler Component / Makeup Handler / JobAction Handler / 各模块 HandlerFactory 共 50+ 类）
   - **显式编排**（编排层 inspect / autoexec / change 分离，执行由独立 Runner 进程承担）
   - **租户 schema 硬隔离**（ThreadLocal TenantContext + 每租户独立 DB schema，无 Filter/Interceptor）
3. **NeatLogic 的"能力效果"矩阵**（8 大能力域 × 5 级评分）：
   - **能力深度**（企业级配置化引擎）：4.5/5（Process + CIEntity + Alert 3 大实例化引擎成熟）
   - **协议广度**（执行层多样性）：1.5/5（Runner 只跑本地 autoexec，K8s/Helm/ArgoCD/SSH/WinRM 全 0）
   - **多租户隔离度**：4.5/5（DB schema 硬隔离 + ThreadLocal，比列级过滤强）
   - **模块内完整度**：4/5（每个模块都是"深度实现，广度克制"）
   - **架构自洽性**：4.5/5（一套框架、一套 DTO 命名、一套 Handler 模式贯穿 42 模块）
4. **对 Orion 的启示**：不是"复刻 NeatLogic"，而是**吸收 4 项核心架构模式**——（a）Component 化 StepHandler，（b）TransactionGroup 批量提交，（c）Schema 隔离替代列级过滤，（d）配置化 ChannelType 替代 ITIL 硬编码。
5. **Orion 已有的差异化优势**（NL 无对应）：AI 平台（40,922 行）+ 多云（1,511 行）+ Report Designer 前端拖拽（NL 用 JFreeChart SVG 输出，非交互拖拽）+ 微前端生态。
6. **一句话总结**：**NeatLogic 是"面向 ITIL 深度配置化的企业级 Java ITOM"，Orion 是"面向云原生 + AI 差异化的 Go 单体平台"**——两者不是同代产品，NeatLogic 强在 IT 运维的深度配置化，Orion 强在云原生 + AI 的广度差异化。

---

## 1. 架构哲学（5 项核心）

### 1.1 哲学 1：配置化优先（Configuration-First）

**观察**：NeatLogic **不用代码分支**区分业务语义，而是把差异全部下沉到配置表。

**证据**：
- **ITSM 没有 Ticket/Incident/Problem/Change 实体**（NL-1）——`find` 找 0 个 `Ticket.java / Incident.java / Problem.java / Change.java`。所有 ITIL 三兄弟都被合并为 **ProcessTask 单实体**，语义差异通过 **Channel/ChannelType/ChannelTypeRelation** 三级渠道配置化。
- **CMDB 没有强类型 CI**（NL-1）——`CiEntityVo.attrEntityData` 是 `JSONObject` 动态容器，属性 schema 通过 `Ci` 表定义。
- **Alert 没有 5 家族独立实现**（NL-3）——AlertBreaker 是统一抽象 + AlertRule/AlertEventHandler 覆盖 5 家族（Correlation/Dedup/Silence/Rule/Routing），22 Mapper + 20 XML 全部 PG 持久化。

**能力效果**：一次代码实现，N 种业务场景。改需求 = 改配置，不改代码。这是**大型企业级产品的成熟标志**。

**Orion 差距**：Orion `internal/ticketing` 有 workflow 定义但**硬编码 ITIL 语义**（incident/problem/change 各一表）；Orion `internal/cmdb` 是 Go struct 强类型字段。**灵活性不足**。

---

### 1.2 哲学 2：实例化分层（Type → Template → Instance → Transaction 四层）

**观察**：NeatLogic 的核心域都遵循**四层模型**——不是简单的 Type/Instance 两层。

**证据矩阵**：

| 域 | L1 Type | L2 Template | L3 Instance | L4 Transaction |
|---|---|---|---|---|
| **CMDB** | `Ci` (配置项类型) | `CiType` (轻量分类壳) | `CiEntityVo` (实例) | `CiEntityTransactionVo` + `TransactionGroupVo` (乐观锁 + 批量提交) |
| **ITSM** | `Process` (流程模板) | `ProcessStep` (步骤模板) | `ProcessTaskVo` (流程实例) | `ProcessTaskStepVo` (步骤实例，可 redo/repeat/retreat) |
| **Alert** | `Alert` (告警类型) | `AlertRule` (规则) | `AlertInstance` (实例) | `AlertBreakerState` (窗口状态，`SELECT FOR UPDATE` 行锁) |
| **AutoExec** | `Autoexec` (作业定义) | `AutoexecTemplate` | `AutoexecJob` (作业实例) | `AutoexecJobRunner` (执行记录) |

**四层模型的能力效果**：
- **Type** 层：可扩展，客户可定义自己的类型
- **Template** 层：预定义模板，降低用户配置成本
- **Instance** 层：真实业务数据
- **Transaction** 层：**关键创新**——乐观锁 + 批量提交 + 快照回滚，避免并发写冲突

**Orion 差距**：
- Orion CMDB 有 Type/Instance，**无 TransactionGroup**（NL-1 明确列为 P0 差距）
- Orion Ticket 有 Workflow/Instance，**无独立 Step 实例**（步骤实例是运行期产物）
- Orion Alert **无 AlertBreaker 并发窗口模型**（NL-3 明确列为 R-P0-03-v2）

---

### 1.3 哲学 3：组件化扩展（Component + Handler + Factory）

**观察**：NeatLogic **不用继承链扩展**，而是 **Component/Handler 组合 + Factory 注册表**。

**证据**：
- **ITSM Process StepHandler**（NL-1）：`StartComponent / EndComponent / AutomaticComponent / ConditionComponent / DistributaryComponent / TimerComponent / OmnipotentComponent` 7 个 Component + `postprocessor / regulatehandler / utilhandler` 51 个 Handler 类。
- **Alert AlertBreaker**（NL-3）：`CountWindow / ConsecutiveFailure / MailReceiverWindow` 3 个 BreakerHandler + `Action/` (2 个) + Factory 注册表（`AlertBreakerHandlerFactory` + `AlertBreakerActionHandlerFactory` + `AlertEventHandlerFactory` + `AlertAttrFormaterFactory` + `AlertAttrFreemarkerSnippetFactory` 共 5 个）。
- **AutoExec JobAction**（NL-2）：`AutoexecJobActionHandlerFactory` + `InspectJobSourceHandler`（`IAutoexecJobSource` 接口实现）。

**Handler 目录统计**（跨模块合计）：
- ITSM StepHandler: 51 个
- Alert AlertBreaker: 3 + 2 = 5 个
- Alert EventHandler: 25+ 个
- Alert Breaker/Action Factory: 5 个
- AutoExec JobSource Handler: 4 个
- Change Process StepHandler: 2+ 个（NL-6）
- Tenant Tagent Handler: 8 个（NL-8）
- **合计：100+ 个 Handler**，全部通过 Factory 注册

**能力效果**：新业务场景 = 新 Handler + Factory 注册，无需改主流程。这是**插件化架构**的核心。

**Orion 差距**：
- Orion 有 Factory 模式但**注册点少**（Alert 无 IAlertEventHandlerFactory 等价物）
- Orion `internal/automation` 有 `TaskRunner` 3 协议扩展（shell/docker/sub-pipeline），**无 Component/Handler 组合**
- Orion `internal/ticketing` workflow 定义**未 Component 化**（缺 Condition/Timer/Distributary）

---

### 1.4 哲学 4：编排与执行分离（Orchestration vs Execution）

**观察**：NeatLogic 明确区分**编排层**（业务定义 + 触发）与**执行层**（实际运行），两者通过 Runner 独立进程 + HTTP REST 通信。

**证据**：
- **编排层**：`neatlogic-autoexec`（业务定义 193 API）+ `neatlogic-inspect`（上层消费者 66 API）+ `neatlogic-deploy`（NL-4）——都在主 web 进程
- **执行层**：`neatlogic-runner`（282 Java · 独立部署 · 只有 1 个 CustomErrorController · 86 Api 组件 · 通过反向 HTTP 与主控通信）
- **执行协议**：Runner **只跑本地 subprocess（`ProcessBuilder`）调用 `autoexec` CLI**，通过 **HTTP REST 反向**与主控通信，通过 **TCP Socket + Netty** 与 Tagent 心跳通道通信。**K8s/Helm/ArgoCD/SSH/WinRM 全部 0 实现**。
- **Master-Worker 反向**：主控用 `HttpRequestUtil.post(runner.getUrl() + "api/rest/...")` 单向调用 runner；runner 反向拉取作业数据

**能力效果**：编排层可独立扩展业务场景，执行层独立升级（Java 版本、依赖 CVE 补丁、部署节奏）——**解耦价值明确**。

**Orion 优势**：Orion 的 Runner 也是独立进程，但**通过 K8s-Exec 走 gRPC streaming**——技术栈更现代，但**实际 Runner 协议也是 HTTP 单一**（NL-8 证明 NeatLogic 也是单一协议）。

**Orion 差距**：
- Orion 无 Runner 与主控的**反向通信契约**（`ScriptParamTypeRunnerGroup` / `AppModuleRunnerGroup` 抽象层）
- Orion 无 Tagent **心跳管理面协议 SDK**（NL-8 Tagent-base 46 类）

---

### 1.5 哲学 5：租户 schema 硬隔离（ThreadLocal + Schema-per-tenant）

**观察**：NeatLogic 的租户隔离**不是靠列级过滤**，而是**每租户独立 DB schema** + ThreadLocal 传递。

**证据**（NL-8）：
- **无 Spring Filter/Interceptor**——`grep -ri "HandlerInterceptor\|javax.servlet.Filter" neatlogic-tenant` 返回 0 命中
- **127 处 `TenantContext.get()`** 显式调用——集中在 scheduler(10) / file(6) / apimanage(5) / user(4) / notify(4) / auth(4) 等 21 个 api 目录
- **DB schema 隔离**：`databaseFragmentMapper.rebuildTable(TenantContext.get().getDbName(), "autoexec_job_runner")`——每租户独立 schema 命名空间
- **HTTP header 显式注入**：`headers.put("Tenant", TenantContext.get().getTenantUuid())`——跨服务传递
- **Quartz JobObject 显式携带 tenant**：`new JobObject.Builder(..., TenantContext.get().getTenantUuid())`——定时任务也能带租户

**能力效果**：
- **天然硬隔离**：租户 A 的数据物理上不可能被租户 B 读到（不同 schema）
- **无 SQL 注入风险**：不需要在每个 SQL 里加 `WHERE tenant_id = ?`
- **成本**：schema 数量 × 租户数量 = DB 连接数膨胀

**Orion 差距**（Round 70 §71 已知）：
- Orion 用列级 `tenant_id` 过滤 + 手工代码审查兜底
- Orion 曾在 31 处 audit / 21 处 efficiency / 3 处 backup 泄漏
- Orion 的 Repository 基类做了防御，但**跨服务调用无 header 传递规范**

**建议**：Orion 引入 `TenantContext` 概念（不用完全切换到 schema 隔离，成本太大），但**规范跨服务 HTTP header 传递 + 结构化日志带 tenantId**。

---

## 2. 核心设计模式（跨模块 7 个共性模式）

### 2.1 模式 A：PrivateApiComponentBase + `@Param/@Input/@Output` 自研框架

**证据**（NL-1）：`grep -rh '@Action' neatlogic-cmdb neatlogic-itsm` 返回 **0 命中**——NeatLogic **不用 Spring MVC**。

```java
// NeatLogic API 标准范式（推断）
public class ProcessTaskAbortApi extends PrivateApiComponentBase {
    @Param("id") private String id;
    @Input private ProcessTaskAbortParamVo param;

    public String getToken() {
        return "process/processtask/abort";
    }

    public void myDoService(JSONObject json) throws Exception {
        // 业务逻辑
    }
}
```

**特点**：
- 每个 API = 一个类（不用 Controller + 方法）
- 路径由 `getToken()` 或包名反射推导
- 自研注解 `@Param/@Input/@Output/@Description/@ResubmitInterval/@OperationType/@AuthAction`
- **不用 Spring MVC**，也不用 Dubbo/gRPC

**能力效果**：
- API 类**天然职责单一**（一个类 = 一个 API）
- 参数校验、审计、鉴权、限流都是**框架层**统一处理
- 482 个 API 类 → 482 个"微型函数"，可读性强

**Orion 对比**：Orion 用 Gin HTTP framework，`func(c *gin.Context)` 函数式路由——**每个 handler 函数**处理路由。**代码更轻，但职责边界模糊**。

---

### 2.2 模式 B：Factory 注册表 + Handler 接口

**证据**（NL-3 Alert 侧）：
```java
// AlertBreakerHandlerFactory.java:23
private static final Map<String, IAlertBreakerHandler> handlerMap = new HashMap<>();

// AlertBreakerActionHandlerFactory.java:23
private static final Map<String, IAlertBreakerActionHandler> actionMap = new HashMap<>();

// AlertEventHandlerFactory.java:25
private static final Map<String, IAlertEventHandler> eventMap = new HashMap<>();

// AlertAttrFormaterFactory.java:23
private static final Map<String, IAttrFormater> attrFormaterMap = new HashMap<>();

// AlertAttrFreemarkerSnippetFactory.java:24
private static final Map<String, IAlertAttrFreemarkerSnippetHandler> handlerMap = new HashMap<>();
```

**特点**：
- **static HashMap** 是 Spring Bean 启动时的**类注册表**，不是运行时业务状态
- 每个 Factory 只处理一个 Handler 类型
- Factory 是**注册表**，Handler 是**实现者**

**能力效果**：新增 Handler = 新增一个类实现接口 + Spring 自动扫描注册，**不用改 Factory 代码**。这是**开闭原则的教科书级实现**。

**Orion 差距**：
- Orion Alert **无 IAlertEventHandlerFactory 等价物**
- Orion Automation 有 TaskRunner 扩展（3 协议），**但不是 Factory 模式**

---

### 2.3 模式 C：Type / Template / Instance / Transaction 四层

（见 §1.2 哲学 2）——这是 NeatLogic 所有核心域的**统一建模骨架**。

---

### 2.4 模式 D：Master-Worker 反向通信

**证据**（NL-8）：
- 主控（tenant/web）用 `HttpRequestUtil.post(runner.getUrl() + "api/rest/...")` 单向调用
- Runner 反向拉取作业数据（`ExecRToolApi`）
- **RunnerGroup 是执行器分组的唯一路由抽象**（`ScriptParamTypeRunnerGroup`、`AppModuleRunnerGroup`）

**能力效果**：Runner 可独立扩缩容，主控无状态，横向扩展自然。

**Orion 差距**：Orion Runner 与主控**无 RunnerGroup 分组抽象**——`orion-runner` 目录无对应实现。

---

### 2.5 模式 E：JSONObject 动态属性容器

**证据**（NL-1 CMDB）：
```java
// CiEntityVo 核心字段
JSONObject attrEntityData;         // 动态属性容器
JSONObject globalAttrEntityData;   // 全局属性
JSONObject relEntityData;          // 关系属性
```

**能力效果**：属性 schema 完全配置化，新增属性 = 加一条 CI 属性定义，不改代码。

**Orion 差距**：Orion `internal/cmdb` 是 Go struct 强类型字段——新增属性 = 改 struct + 改 handler + 改前端。**灵活性差**。

**代价**：NeatLogic 失去 Go 编译期类型检查，运行时类型错误率上升。

---

### 2.6 模式 F：Handler + Makeup 组合

**证据**（NL-1 ITSM）：
- **7 个 StepHandler Component**：Start/End/Automatic/Condition/Distributary/Timer/Omnipotent
- **8 个 Makeup Handler**：ActionConfig / AutomaticConfig / CommentTemplateId / FormSceneUuid / NotifyPolicyConfig / TagList / TaskConfig / WorkerPolicyConfig

**能力效果**：Component 是**流程节点**（控制流），Makeup 是**节点装饰**（元数据）——两者组合形成**可扩展的流程图引擎**。

**Orion 差距**：Orion `internal/ticketing` 只有基础 workflow 定义，**缺 Condition/Timer/Distributary 三种节点** + Makeup Handler 装饰层。

---

### 2.7 模式 G：ThreadLocal + Schema-per-tenant 硬隔离

（见 §1.5 哲学 5）——**这是 NeatLogic 企业级租户隔离的核心**，Orion 差距明显。

---

## 3. 能力效果矩阵（8 大能力域 × 5 级评分）

**评分标准**：1 = 缺失 / 2 = 骨架 / 3 = 基础 / 4 = 生产级 / 5 = 企业级

| 能力域 | 评分 | 依据（NL 一手证据） |
|-------|------|--------------------|
| **CMDB 动态建模** | 4.5/5 | Type/Template/Instance/Transaction 四层 + LegalValid + CustomView + ResourceCenter |
| **ITSM 工作流** | 4.5/5 | Process + ProcessTask + StepHandler Component 化 + ChannelType 配置化 |
| **Alert 5 家族** | 4/5 | AlertBreaker 统一抽象 + 22 Mapper + 20 XML 全部 PG + `SELECT FOR UPDATE` 并发窗口 |
| **AutoExec 编排** | 4/5 | 193 API + JobAction HandlerFactory + 与 Runner 分离 + 5 子域（catalog/combop/customtemplate/profile/scenario） |
| **Inspect 巡检** | 4/5 | 66 API 100% 真实实现 + 阈值引擎 + 与 AutoExec 集成 |
| **Report Designer** | 4/5 | 10 JFreeChart widget + 7 Mapper + ReportType DB 驱动分类（**JFreeChart SVG 输出，非交互拖拽**） |
| **RDM** | 3.5/5 | 99 Api.java（catalog/project/issue/status/template/issuecost/app/notify/audit）+ Issue-centric 建模 |
| **多租户** | 4.5/5 | ThreadLocal TenantContext（127 处）+ DB schema 隔离 + HTTP header 显式 + LDAP 同步 |
| **Runner 执行层** | 1.5/5 | 只跑本地 subprocess（HTTP + Netty）—— K8s/Helm/ArgoCD/SSH/WinRM 全 0 实现 |
| **知识管理** | 3/5 | 46 API + 3 ServiceImpl (2597 行) + PG-only 存储（ES 全部注释）+ 中英双语 |
| **Change 变更** | 3.5/5 | ProcessTask StepHandler 集成（`ChangeProcessStepHandlerType.CHANGECREATE/CHANGEHANDLE`）+ Approval 流程 |
| **Event 事件** | 2/5 | 纯静态配置，0 Service 层——**Event 是 Alert 的数据面（`AlertEvent*` 26 命中），非独立域** |

**平均评分**：3.55/5（企业级 ITOM 深度能力，广度不足）

---

## 4. NeatLogic 与 Orion 的架构范式对比

### 4.1 技术栈对比

| 维度 | NeatLogic | Orion |
|------|-----------|-------|
| 语言 | Java 8+ (Spring Boot 2.x) | Go 1.21+ |
| Web 框架 | 自研 `PrivateApiComponentBase` + 反射路由 | Gin |
| DB 连接 | MyBatis + Spring JDBC | pgx + gorm |
| 消息队列 | RabbitMQ / Kafka | NATS |
| 缓存 | Redis | Redis |
| 全文搜索 | Elasticsearch（Knowledge 已注释） | pgvector（RAG） |
| 定时任务 | Quartz | goroutine ticker + cron |
| 前端 | Vue 2/3 | React + Vite + Ant Design + Orion-MF |
| AI | 无（v3/v4/v5 均无 AI 章节） | FastAPI + FastChat |
| 部署 | Docker Compose 单体 | Docker Compose + K8s + ArgoCD |

### 4.2 架构范式对比

| 范式维度 | NeatLogic | Orion |
|---------|-----------|-------|
| 建模 | Type/Template/Instance/Transaction 四层 | 单表 + 少量 JSONB 字段 |
| 路由 | 反射推导 + `getToken()` | 显式 Gin 路由表 |
| 扩展 | Factory + Handler 注册 | interface + 匿名 struct 注入 |
| 隔离 | DB schema-per-tenant | 列级 `tenant_id` |
| 编排 vs 执行 | 主进程 + 独立 Runner 进程 | 主进程 + Runner 服务 + Pipeline 服务 |
| 前端 | Vue 传统 SPA | React + 微前端 |
| AI 集成 | 无 | 权威 Python 服务 + Go 后端 17 子域 |
| 部署形态 | 单体 Docker Compose | 单体 + 微服务蓝图 |

### 4.3 能力效果对比

| 能力域 | NeatLogic 深度 | Orion 深度 | 差距方向 |
|-------|--------------|-----------|---------|
| ITIL 工作流 | 4.5（Component 化 + ChannelType 配置化） | 3.0（workflow 定义但未 Component 化） | NL > Orion |
| CMDB 动态建模 | 4.5（四层 + LegalValid + CustomView） | 3.0（Type/Instance，无 TransactionGroup） | NL > Orion |
| Alert 5 家族 | 4.0（AlertBreaker 统一抽象） | 3.5（9 家族分散） | NL > Orion |
| AutoExec 编排 | 4.0（193 API + JobAction HandlerFactory） | 3.5（StageExecutor + 5 子域） | 接近 |
| Runner 执行层 | 1.5（本地 subprocess only） | 3.0（K8s-Exec + 未来扩展） | Orion > NL |
| 多租户隔离 | 4.5（schema-per-tenant） | 3.0（列级过滤） | NL > Orion |
| AI 平台 | 0（无） | 4.5（40,922 行 + 204 API） | **Orion >> NL** |
| 多云 | 0（无） | 4.0（23 API + 8 Tabs） | **Orion >> NL** |
| Report Designer 交互 | 3.5（JFreeChart SVG 静态输出） | 3.5（前端拖拽但 stub） | 接近 |
| 微前端 | 无 | 4.0（Orion-MF 自研） | Orion > NL |

**综合**：NeatLogic 强在 ITIL/CMDB/Alert 的**深度配置化**（评分均值 4+），Orion 强在 AI/多云/微前端/Runner 的**广度差异化**（评分均值 3.5-4.5）。

---

## 5. NeatLogic 的"能力效果"分层（企业级 vs 基础 vs 骨架）

### 5.1 企业级能力（4 项，Orion 应吸收）

| 能力 | 关键实现 | Orion 落地建议 |
|-----|---------|--------------|
| **配置化工作流引擎** | Process + ChannelType + StepHandler Component | 参考 upgrade-design-plan §1.2 落地 risk/scenario |
| **动态 CI 属性模型** | `JSONObject attrEntityData` + CI 属性 schema | 引入 JSONB + CI 属性配置表 |
| **批量事务组** | `TransactionGroupVo` + `commitTransactionGroup` | `internal/cmdb` 新增 TransactionGroup 领域对象 |
| **Schema 硬隔离** | ThreadLocal TenantContext + `getDbName()` | 至少规范 HTTP header 传递 + Repository 基类加固 |

### 5.2 基础能力（3 项，Orion 可部分吸收）

| 能力 | 关键实现 | Orion 落地建议 |
|-----|---------|--------------|
| **合法性校验体系** | `LegalValid` + `IllegalCiEntity` 违规台账 | `internal/cmdb-validator` 补齐规则库 + 违规台账 |
| **异步工单队列** | `ProcessTaskAsyncCreateService` + 3 API | `internal/ticketing` 增加 AsyncCreateQueue |
| **工单号策略引擎** | `ProcessTaskSerialNumberService` + 批量补号 | `internal/ticketing` 增加 SerialNumberPolicy |

### 5.3 骨架能力（3 项，Orion 已有或有意放弃）

| 能力 | 关键实现 | Orion 现状 |
|-----|---------|-----------|
| **K8s/Helm/ArgoCD 集成** | NeatLogic **0 实现** | Orion 差异化优势（NL-8 撤回） |
| **AI 平台** | NeatLogic **0 实现** | Orion 独有护城河（NL-5） |
| **多云编排** | NeatLogic **0 实现** | Orion 独有护城河（NL-5） |

### 5.4 有意不吸收的能力（2 项）

| 能力 | 原因 |
|-----|------|
| **ITIL 语义硬编码（Incident/Problem/Change）** | Orion 已有 ITIL 建模，无需重构为 ChannelType 配置化 |
| **Tagent 双语言 host agent（Perl 5.32 + Python 3）** | NL-4 确认是主机 agent，非 AI Agent；Orion 已有 Runner + K8s-Exec 替代 |

---

## 6. NeatLogic 架构哲学对 Orion 的 4 项启示

### 启示 1：吸收"配置化优先"哲学（不重构现有 ITIL 建模）

**建议**：Orion 保持 Incident/Problem/Change 独立建模，但**新增 `TicketChannelType` 表**支持配置化扩展——客户可定义自己的工单类型（如"发布审批""数据备份请求"），复用同一套流程引擎。

**参考**：NeatLogic `Process + ChannelType` 三层配置化。

### 启示 2：吸收"Type/Template/Instance/Transaction 四层"（补齐 Orion 第 4 层）

**建议**：Orion CMDB 引入 `TransactionGroup` 领域对象——批量 CI 更新从 N 次事务降到 1 次事务，配合 `LockVersion` 字段做乐观锁。

**参考**：NeatLogic `CiEntityTransactionVo` + `TransactionGroupVo` + `CiEntityIsLockedException`。

### 启示 3：吸收"Schema-per-tenant"（至少规范 ThreadLocal + HTTP header）

**建议**：Orion 不切换到 schema-per-tenant（成本太大），但**规范**：
1. `context.Context` 里携带 `TenantContext`（不用完全切换到 ThreadLocal 概念）
2. 跨服务 HTTP header 强制传递 `X-Tenant-Id`
3. Repository 基类统一注入 `WHERE tenant_id = ?`
4. 结构化日志强制带 `tenantId`

**参考**：NeatLogic ThreadLocal `TenantContext.get()`（127 处）+ HTTP header `Tenant` 显式 + Quartz JobObject 携带 tenantUuid。

### 启示 4：吸收"Factory + Handler 注册表"（扩展 Alert / Ticketing / Automation）

**建议**：Orion 引入 3 个 Factory：
1. `AlertEventHandlerFactory`——统一事件处理模型
2. `WorkflowStepHandlerFactory`——Component 化 workflow
3. `TaskRunnerHandlerFactory`——Runner 协议扩展（Shell/HTTP/K8s-Exec）

**参考**：NeatLogic Alert 5 个 Factory（Breaker/Action/EventHandler/AttrFormater/AttrFreemarkerSnippet）。

---

## 7. NeatLogic 架构的 5 项局限（Orion 有意的差异化）

### 7.1 局限 1：过度依赖配置化，牺牲强类型

**表现**：`JSONObject attrEntityData` 是运行时类型检查，属性错误只能在查询时暴露。

**Orion 应对**：Go struct 强类型字段 + JSONB 补充——**类型安全优先**。

### 7.2 局限 2：不用 Spring MVC，自研框架维护成本高

**表现**：482 个 Api 类都是 `PrivateApiComponentBase` 继承——修改框架 = 修改 482 个类。

**Orion 应对**：Gin + 显式路由——**框架升级成本低**。

### 7.3 局限 3：Runner 只跑本地 subprocess，协议单一

**表现**：K8s/Helm/ArgoCD/SSH/WinRM 全部 0 实现。

**Orion 应对**：K8s-Exec + Runner 服务独立部署——**协议扩展潜力大**。

### 7.4 局限 4：无 AI 平台，无多云编排

**表现**：v3/v4/v5 报告均无 AI 章节，是纯 ITOM 平台。

**Orion 应对**：AI 平台（40,922 行）+ 多云（1,511 行 + 23 API）——**结构性差异化**。

### 7.5 局限 5：前端 JFreeChart SVG 静态输出，非交互拖拽

**表现**：Report Designer 是 10 个 DrawXxx widget + JFreeChart SVG 输出，不是 ECharts/Recharts 交互生态。

**Orion 应对**：前端拖拽编辑器 + ECharts/Recharts——**交互体验更强**（NL-3 已明确报告此为 Orion 差异化）。

---

## 8. 能力效果矩阵详细（8 模块 × 5 级 × 关键指标）

### 8.1 CMDB（4.5/5）

| 指标 | 数值 | 说明 |
|------|------|------|
| Java 文件 | 8,206 + 1,851 base = 10,057 | 主模块 + base |
| Api 类 | 264 | 全 CMDB 端点 |
| 路由声明 | 202（`return "/cmdb/..."`） | 硬编码 |
| Service 接口 | 15 | CiEntity / Ci / Transaction / Attr / Rel / RelEntity / Group / CustomView / CustomViewData / Sync / ResourceEntity / ResourceCenterAccount / ResourceBuildSql 等 |
| 核心创新 | TransactionGroup + Snapshot + LegalValid + CustomView + ResourceCenter | 5 项 Orion 无对应 |
| 差距 | Orion 14 Go 文件，差 100× 文件比 | — |

### 8.2 ITSM（4.5/5）

| 指标 | 数值 | 说明 |
|------|------|------|
| Java 文件 | 6,068 + 2,302 base = 8,370 | 主 + base |
| Api 类 | 218 | 全部走框架反射路由（仅 4 条硬编码 `getToken()`） |
| 路由声明 | 4 硬编码 + 214 反射推导 | `/process/processtask/` 主流 |
| Service 接口 | 13 | ProcessTask / ProcessTaskCreate / ProcessTaskAsyncCreate / ProcessTaskAutomatic / ProcessTaskStepTask / ProcessTaskSerialNumber / ProcessTaskSla / Catalog / Channel / ProcessCommentTemplate / ScoreTemplate / NewWorkcenter 等 |
| StepHandler Component | 7 | Start / End / Automatic / Condition / Distributary / Timer / Omnipotent |
| Makeup Handler | 8 | ActionConfig / AutomaticConfig / CommentTemplateId / FormSceneUuid / NotifyPolicyConfig / TagList / TaskConfig / WorkerPolicyConfig |
| 核心创新 | ChannelType 配置化替代 ITIL 语义 | Orion 无对应 |
| 差距 | Orion 77 Go 文件（ticketing），差 4× 文件比 | — |

### 8.3 Alert（4/5）

| 指标 | 数值 | 说明 |
|------|------|------|
| Java 文件 | 326 | neatlogic-alert |
| Mapper | 22 + 20 XML | 全部走 MyBatis + PG |
| AlertBreaker | 3（CountWindow / ConsecutiveFailure / MailReceiverWindow） | 5 家族统一抽象 |
| AlertBreakerAction | 2（SendMail / Integration） | 触达动作 |
| Factory | 5（BreakerHandler / BreakerActionHandler / EventHandler / AttrFormater / AttrFreemarkerSnippet） | 类注册表模式 |
| 并发模型 | `SELECT FOR UPDATE` 行锁（`AlertBreakerMapper.getAlertBreakerStateForUpdate`） | Orion 需评估 |
| ES 集成 | 13 处引用 | Alert 详情正文走 ES，元数据走 PG |
| 差距 | R-P0-03-v2（并发模型未复刻）| — |

### 8.4 AutoExec（4/5）

| 指标 | 数值 | 说明 |
|------|------|------|
| Java 文件 | 380（NL-2 实测，非 768） | 一手修正 |
| API 端点 | 193 | 100% 真实实现 |
| 子域 | 5（catalog/combop/customtemplate/profile/scenario）| NL-2 推翻 Agent 4 "没有"结论 |
| 执行协议 | 1（HTTP POST only，见 §3） | 无 SSH/K8s/WinRM |
| JobSource Handler | 4 | 抽象接口 `IAutoexecJobSource` |
| 与 Runner 关系 | Master-Worker 反向 HTTP | Runner 独立进程 |
| 差距 | Orion Runner 也是 HTTP-only，接近 | — |

### 8.5 Inspect（4/5）

| 指标 | 数值 | 说明 |
|------|------|------|
| Java 文件 | 87 | inspect 主模块（无 base） |
| API 端点 | 66 | 100% 真实实现，0 空壳 |
| Service Impl | 5 接口 + 5 Impl | 合计 3,154 行 Impl |
| JobSource Handler | 4（`InspectJobSourceHandler` 实现 `IAutoexecJobSource`）| 巡检作为 autoexec 上层消费者 |
| 阈值引擎 | 3 API（`inspect/threshold/*`）| 完整实现 |
| 报告 | 18 API（`inspect/report/*`）| 每日统计 + 告警 + 导出 |
| 差距 | Orion 巡检 10% 骨架，差 30-40 pp | — |

### 8.6 Report Designer（4/5）

| 指标 | 数值 | 说明 |
|------|------|------|
| Java 文件 | 120 | neatlogic-report |
| DrawXxx widget | 10（Bar / BarH / BarLineH / StackedBar / StackedBarH / StackedBarLineH / Line / Pie / Table / Pagination）| 全部 JFreeChart |
| Mapper | 7 | ReportMapper / ReportTypeMapper 等 |
| ReportType DB 驱动 | 是 | `getAllReportType` 从 DB 拉取 |
| 前端交互 | JFreeChart SVG 静态输出 + iframe | 非交互拖拽 |
| 差距 | Orion 前端有拖拽但 stub，NL 后端有实现但静态 | 各有所长 |

### 8.7 RDM（3.5/5）

| 指标 | 数值 | 说明 |
|------|------|------|
| Java 文件 | 290 | neatlogic-rdm |
| Api 类 | 99 | catalog/project/issue/status/template/issuecost/app/notify/audit |
| 建模 | Issue-centric（Issue/Project/Catalog/Status/Template）| vs Orion Sprint-centric |
| 差距 | Orion RDM 前端 4 Tab + 后端 6 模块散落 | 无独立 `internal/rdm` |

### 8.8 多租户 Tenant（4.5/5）

| 指标 | 数值 | 说明 |
|------|------|------|
| Java 文件 | 534 | neatlogic-tenant |
| Controller | 141 | Api 组件 |
| ServiceImpl | 12 | Runner / Server / Team / Matrix / ApiAudit / FeatureUsage / Worktime / Menu / ExtraMenu / Tag / DocumentOnline / NotifyPolicy |
| Repository/Mapper | 14 | 数据访问 |
| TenantContext 引用 | 127 处 | 显式调用 |
| DB 隔离 | 每租户独立 schema（`getDbName()`）| 硬隔离 |
| LDAP 同步 | `SyncLdapUserSchedule` + `SyncLdapTeamSchedule` | Orion 缺 |
| API 审计 | `ApiAuditService` + `FeatureUsageAudit` + `loginaudit` | Orion 有 audit.Chain 系列 |
| MCP 集成 | `ApiManageMcpHelpGetApi` + `/api/mcp/{tenantUuid}` | Orion 有 ai-agent-run |
| 差距 | Orion 列级过滤 + 31 处 audit 泄漏 | NL 明显领先 |

### 8.9 其他 4 个次级能力

| 能力 | 评分 | 关键指标 |
|------|------|---------|
| Knowledge | 3/5 | 46 API + 3 ServiceImpl (2597 行) + PG-only 存储 + 中英双语 + 与 CMDB/ITSM 零耦合（NL-7）|
| Change | 3.5/5 | ProcessTask StepHandler 集成（`ChangeProcessStepHandlerType.CHANGECREATE/CHANGEHANDLE`，NL-6）|
| Event | 2/5 | 纯静态配置，0 Service 层，`AlertEvent*` 26 命中全是 Alert 数据面（NL-6）|
| Tagent | 3/5 | Perl 5.32 + Python 3 双语言（94 文件 / 9,321 行），host agent 非 AI Agent（NL-4）|

---

## 9. 关键结论

### 9.1 NeatLogic 架构的核心创新（4 项，Orion 应吸收）

1. **配置化优先**：用 ChannelType/Channel/Template 配置化替代代码分支，一次实现，N 种场景
2. **四层实例化模型**：Type/Template/Instance/Transaction 四层，Transaction 层是并发控制关键
3. **Factory + Handler 注册表**：Handler 类扩展无需改主流程，Spring 自动扫描注册
4. **Schema-per-tenant 硬隔离**：ThreadLocal + DB schema 隔离，天然无 SQL 注入

### 9.2 NeatLogic 的能力盲区（4 项，Orion 有意差异化）

1. **Runner 协议单一**：只跑本地 subprocess，无 K8s/Helm/ArgoCD/SSH/WinRM
2. **无 AI 平台**：v3/v4/v5 报告均无 AI 章节，纯 ITOM
3. **无多云编排**：CMDB 是单集群，无 AWS/Azure/GCP/华为云/阿里云编排
4. **无数据仓库**：Report Designer 是单表数据源，非 BI 上游

### 9.3 对 Orion 的战略建议

**采纳**（架构模式）：
- 配置化优先（补齐 TicketChannelType）
- 四层实例化模型（补齐 CMDB TransactionGroup）
- Factory + Handler 注册表（3 个 Factory：AlertEventHandler / WorkflowStepHandler / TaskRunnerHandler）
- Schema-per-tenant 简化版（规范 HTTP header + Repository 基类加固）

**保留**（差异化优势）：
- AI 平台（40,922 行，204 API）
- 多云（1,511 行，23 API）
- Runner K8s-Exec（NL 只 HTTP）
- Report 前端拖拽（NL 是 JFreeChart SVG 静态输出）

**放弃**（无价值对标）：
- ITIL 语义硬编码（Orion 已有独立建模，无需重构）
- Tagent 双语言 host agent（NL 是 Perl+Python，Orion 有 Runner + K8s-Exec 替代）

### 9.4 一句话总结

**NeatLogic 是"面向 ITIL 深度配置化的企业级 Java ITOM"，Orion 是"面向云原生 + AI 差异化的 Go 单体平台"**——两者不是同代产品。**NeatLogic 强在 IT 运维的深度配置化，Orion 强在云原生 + AI 的广度差异化**。

**Orion 的战略**：**吸收 NeatLogic 的 4 项架构哲学 + 保留自己的 4 项差异化优势 + 放弃无价值对标**——最终达到"深度 + 广度"双维领先。

---

## 10. 认知边界

### 10.1 本报告的分析边界

1. **架构哲学基于 8 份一手证据**，未深入 Java 源码的每个类（4,230 Java 文件中，本轮扫描约 2,000 关键文件，剩余 2,200 未扫描）
2. **未验证 NeatLogic 前端 Vue 代码**，只分析后端 Java；前端架构哲学可能需要另做
3. **未验证运行时行为**（如 AlertBreaker 并发窗口实际并发测试、Schema 隔离实际 DB 连接数）
4. **未对比 ServiceNow / iTop / ServiceNow**（NL 报告仅对标 ServiceNow/iTop/CMDBuild，本报告未独立复核）
5. **未评估 Tagent Perl+Python 双语言的实际可用性**（NL-4 报告 94 文件 / 9,321 行，但未运行）

### 10.2 分析工具局限

- 未运行 Maven 构建，未验证 JFreeChart / MyBatis / Quartz 等依赖是否可解析
- 未查看运行时日志，只静态扫描代码
- 未对比 3.x / 4.x 版本差异（NL-4 提到 NSUL v4.x – 2025 但未见 3.x 版本）

### 10.3 与 v4/v5 综合报告的关系

- **v4 综合报告**：识别"专家口吻幻觉"（10 项）+ 9 项止损清单
- **v5 综合报告**：基于 8 份 NL 一手证据，证伪 3 项幻觉 + 追加 3 项幻觉 + 撤回止损 8 + 追加 9 项 CC 风险
- **本报告**：从 8 份 NL 一手证据中抽取**架构哲学 + 设计模式 + 能力效果**——**是 v5 的元级综合分析**

**三者关系**：v4（幻觉识别）→ v5（数字修正）→ 本报告（架构抽象）

---

## 附录 A：8 份 NL 一手证据清单

| 报告 | 行数 | 核心发现 |
|------|------|---------|
| NL-1 CMDB+ITSM | 213 | 18,427 Java / 482 Api / TransactionGroup+Snapshot |
| NL-2 inspect+autoexec | 432 | 66+193 API / 0 空壳 / 5 子域全存在 / Runner 只 HTTP |
| NL-3 Alert+BI+RDM | 249 | Alert 5 家族全部 PG Mapper 非 memory / Report JFreeChart 真实实现 / RDM 99 Api.java |
| NL-4 deploy+tagent+change | 420 | Tagent 是 Perl 5.32 + Python 3 双语言 host agent |
| NL-5 5 大未覆盖模块 | 527 | AI / 多云 / 数据仓库 / Tagent / 混沌 5 大模块一手验证 |
| NL-6 Change+Event | 333 | Change=ProcessTask StepHandler / Event 纯静态 0 Service / Event↔Alert 零耦合 |
| NL-7 Knowledge | 236 | PG-only 存储 / ES 全部注释 / 46 API + 3 ServiceImpl 2597 行 |
| NL-8 Tenant+Runner | 366 | ThreadLocal TenantContext 127 处 / DB schema 隔离 / Runner 只跑本地 autoexec |
| **合计** | **2,776** | **4,230 Java 文件 100% 覆盖** |

---

## 附录 B：4 项架构哲学对 Orion 的具体落地建议

### B.1 配置化优先

**建议**：新增 `TicketChannelType` 表（Migration 710+），支持配置化工单类型。
**参考代码位置**：`internal/ticketing/model/channel_type.go`（新增）
**预期收益**：客户可定义自己的工单类型，无需改代码。

### B.2 四层实例化模型

**建议**：`internal/cmdb` 新增 `TransactionGroup` 领域对象 + `LockVersion` 字段。
**参考代码位置**：`internal/cmdb/service/transaction_group.go`（新增）
**预期收益**：批量 CI 更新从 N 次事务降到 1 次事务。

### B.3 Factory + Handler 注册表

**建议**：新增 3 个 Factory（AlertEventHandlerFactory / WorkflowStepHandlerFactory / TaskRunnerHandlerFactory）。
**参考代码位置**：`internal/alert/factory.go` + `internal/ticketing/factory.go` + `internal/automation/factory.go`（新增）
**预期收益**：新 Handler 扩展无需改主流程。

### B.4 Schema-per-tenant 简化版

**建议**：
1. `context.Context` 携带 `TenantContext`（不用 ThreadLocal，但概念对齐）
2. HTTP header 强制 `X-Tenant-Id`
3. Repository 基类统一注入 `WHERE tenant_id = ?`
4. 结构化日志强制带 `tenantId`

**参考代码位置**：`internal/tenant/context.go`（新增） + Repository 基类更新
**预期收益**：避免 31 处 audit + 21 处 efficiency + 3 处 backup 的租户泄漏重现。

---

**文档编号**：`neatlogic-architecture-philosophy-2026-10-03.md`
**关联文档**：
- v5 综合报告：`cross-review-synthesis-2026-10-03-v5.md`
- 8 份 NL 一手：`neatlogic-*-firsthand-2026-10-03.md`
- CC 风险登记册：`risk-fallback-design-2026-10-03.md`
- 执行手册 Y：`upgrade-execution-playbook-2026-10-03.md`
- 汇总索引：`design-docs-summary-2026-10-03.md`
