# NeatLogic 标杆设计分析报告

> **生成日期**: 2026-07-22
> **分析对象**: NeatLogic ITOM 4.0.0（50+ 模块，2,500+ Java 文件，1,093 数据库表，280+ 自动化插件）
> **用途**: 功能开发参考 — 提取可借鉴的架构模式、数据模型和工程实践
> **分析方法**: 从 Git pack 文件还原 16 个模块源码（4,831 文件），逆向还原框架层 1,415 条类引用

---

## 目录

1. [标杆架构模式](#1-标杆架构模式)
2. [框架层设计（500+ 类）](#2-框架层设计500-类)
3. [自动化执行引擎（核心基础设施）](#3-自动化执行引擎核心基础设施)
4. [多租户数据库体系](#4-多租户数据库体系)
5. [模块数据模型（6 个核心模块，16 个模块的数据库推断）](#5-模块数据模型)
6. [AI / RAG 架构设计](#6-ai--rag-架构设计)
7. [拓扑图 / 架构图设计](#7-拓扑图--架构图设计)
8. [ITSM 流程引擎](#8-itsm-流程引擎)
9. [NeatLogic 局限性与风险](#9-neatlogic-局限性与风险)
10. [开发规范清单（后端）](#10-开发规范清单)
11. [Orion 借鉴落地建议](#11-orion-借鉴落地建议)

---

## 1. 标杆架构模式

### 1.1 核心设计原则

NeatLogic 经过多年迭代，形成了 8 个核心架构模式，每行标注 Orion 对应实现方向：

| # | 模式 | NeatLogic 核心思想 | Orion 对应实现 | 借鉴难度 |
|---|------|-------------------|---------------|---------|
| 1 | **模块化 Spring 分层** | DispatchServlet 隔离 Bean + root-context 共享 framework | Go 微服务天然隔离，每个服务独立部署 | ⭐ 无需借鉴 |
| 2 | **注解驱动 API** | `IApiComponent` + 注解替代 Controller | Handler + 装饰器 + 路由注册 | ⭐⭐ 部分借鉴 |
| 3 | **-base 模块分离** | DTO/常量跨模块共享，绕开 Maven 交叉引用 | Go module + internal 包 | ⭐⭐ 部分借鉴 |
| 4 | **三库分离多租户** | 管理库/租户库/扩展库，`@{DATA_SCHEMA}` 动态切换 | PostgreSQL Schema + RLS（更优雅） | ⭐ 无需借鉴 |
| 5 | **Java 编排 + Python/Perl 执行** | 管理逻辑与执行引擎分离 | Runner Agent + 执行插件 SPI | ⭐⭐⭐ 重点借鉴 |
| 6 | **Crossover 跨模块引用** | 工厂模式 + 接口解耦，`CrossoverServiceFactory` | Go DI + interface 注入 | ⭐⭐ 部分借鉴 |
| 7 | **Changelog 数据库迁移** | 日期目录 + version.json + sqldefine JSON | Flyway + version 追踪 | ⭐⭐⭐ 重点借鉴 |
| 8 | **全文索引 + 全局搜索** | 多模块索引 + 统一搜索入口 | ES 集成 + 索引工厂 | ⭐⭐⭐ 重点借鉴 |

### 1.2 模块依赖关系

```
neatlogic-framework (全局基础层，root-context 加载)
    │
    ├── neatlogic-xxx-base (跨模块共享 DTO/常量/注解)
    │       │
    │       └── neatlogic-xxx (业务实现，DispatchServlet 隔离)
    │               │
    │               └── neatlogic-xxx-commercial (商业版扩展)
    │
    └── neatlogic-tenant (租户管理，跨所有模块)
```

**关键跨模块依赖**:
- autoexec → cmdb-base（资源中心）
- deploy → cmdb-base（CI/CD 资源）
- alert → cmdb-base（告警关联 CMDB）
- change → itsm-base（流程引擎）
- inspect → autoexec-base（巡检使用自动化）

---

## 2. 框架层设计（500+ 类）

### 2.1 框架层包结构

NeatLogic 框架层是**最核心的基础设施抽象**，从 1,415 条类引用逆向还原了 30+ 核心包、500+ 类：

```
neatlogic.framework/
├── auth/                     # 认证框架 (AuthBase/AuthAction/AuthFactory)
├── restful/                  # REST 注解驱动 (EntityField/OperationType/IApiComponent)
├── notify/                   # 通知引擎 (NotifyPolicyHandlerFactory + 15 类)
├── scheduler/                # 调度框架 (SchedulerManager/IJob/JobBase)
├── form/                     # 表单引擎 (FormVo/FormAttributeVo/数据转换)
├── crossover/                # 跨模块引用 (CrossoverServiceFactory)
├── fulltextindex/            # 全文索引 (FullTextIndexHandlerFactory)
├── globalsearch/             # 全局搜索 (GlobalSearchManager)
├── integration/              # 系统集成 (IntegrationHandlerFactory)
├── importexport/             # 导入导出 (ImportExportHandlerFactory)
├── globallock/               # 全局锁 (GlobalLockManager)
├── sqlgenerator/             # SQL 动态生成 ($sql/ExpressionVo/JoinVo)
├── graphviz/                 # 图可视化 (Graphviz.Builder/Node/Link)
├── condition/                # 条件引擎 (IConditionHandler/ConditionGroupBaseVo)
├── asynchronization/         # 异步处理 (4 种线程池 + 4 个 ThreadLocal)
├── store/                    # 数据存储 (ES + MySQL 抽象)
├── common/                   # 通用工具 (ApiParamType/Config/PageUtil)
├── util/                     # 工具集 (SnowflakeUtil/ExcelBuilder/TableResultUtil)
├── exception/                # 异常体系 (50+ 类)
├── process/                  # 流程引擎基础 (80+ 类)
├── autoexec/                 # 自动化基础 (60+ 类)
├── cmdb/                     # CMDB 基础 (100+ 类)
├── alert/                    # 告警基础 (110+ 类)
├── datawarehouse/            # 数据仓库
├── lcs/                      # 基线/LCS 管理
└── tagent/                   # Agent 管理
```

### 2.2 注解驱动 REST 框架（核心模式）

**NeatLogic Java 实现**:
```java
@Service
@AuthAction(action = ALERT_STATUS_MODIFY.class)
@OperationType(type = OperationTypeEnum.SEARCH)
@Description(value = "查询告警状态列表")
@Output(params = { @OutputParam(name = "data", type = ApiParamType.LIST) })
public class ListAlertStatusApi extends PrivateApiComponentBase {
    @Resource
    private AlertStatusMapper alertStatusMapper;

    @Override
    public JSONObject myDoService(JSONObject param, HttpServletRequest request, HttpServletResponse response) {
        List<AlertStatusVo> list = alertStatusMapper.searchAlertStatusList(null);
        return TableResultUtil.success(list);
    }
}
```

**Orion Go 等效实现**:
```go
type ListAlertStatusHandler struct {
    Service AlertStatusService
}

func (h *ListAlertStatusHandler) List(c *gin.Context) {
    tenantID := auth.GetTenantID(c)
    if err := auth.RequirePermission(c, "alert:status:list"); err != nil {
        c.JSON(403, gin.H{"code": 403, "message": "permission denied"})
        return
    }
    list, err := h.Service.List(c, tenantID)
    if err != nil {
        c.JSON(500, gin.H{"code": 500, "message": err.Error()})
        return
    }
    c.JSON(200, gin.H{"code": 0, "message": "success", "data": list})
}
```

**映射关系**:
| NeatLogic 注解 | Orion Go 等效 |
|----------------|---------------|
| `@AuthAction(action=...)` | `auth.RequirePermission(ctx, resource, action)` |
| `@OperationType(type=...)` | 路由方法 (GET/POST/PUT/DELETE) |
| `@Description(value=...)` | 路由注释 + API 文档 |
| `@EntityField(name, type)` | struct tag + validator |
| `IApiComponent` | `gin.HandlerFunc` |

### 2.3 认证框架

**NeatLogic Java 实现**:
```java
// 1. 定义权限
public class CMDB_CI_MODIFY extends AuthBase { ... }

// 2. 声明权限
@AuthAction(action = CMDB_CI_MODIFY.class)
public class SaveCiApi extends PrivateApiComponentBase { ... }
```

**Orion Go 等效**:
```go
// 1. 定义权限常量
const PermissionCMDBCIModify = "cmdb:ci:modify"

// 2. 声明权限
func (h *Handler) SaveCi(c *gin.Context) {
    if err := auth.RequirePermission(c, PermissionCMDBCIModify); err != nil {
        c.JSON(403, gin.H{"code": 403, "message": "permission denied"})
        return
    }
    // ...
}
```

**映射关系**:
| NeatLogic | Orion |
|-----------|-------|
| `AuthBase` 类 | 权限常量 `string` |
| `AuthAction` 注解 | `auth.RequirePermission(ctx, resource, action)` |
| `AuthFactory` 自动扫描 | 启动时注册权限列表 |

### 2.4 通知引擎（重点借鉴）

**NeatLogic Java 实现**:
```java
@Component
public class AlertNotifyHandler extends NotifyPolicyHandlerBase {
    @Override
    public String getTriggerType() { return "ALERT_CREATED"; }
    @Override
    public void handle(NotifyPolicyConfig config, NotifyParam param) {
        // 实现通知逻辑
    }
}
// 框架自动扫描 NotifyPolicyHandlerBase 子类，注册到 NotifyPolicyHandlerFactory
```

**Orion Go 等效**:
```go
// 通知处理器接口
type NotifyHandler interface {
    TriggerType() string
    Handle(ctx context.Context, config NotifyPolicyConfig, param NotifyParam) error
}

// 通知处理器工厂
type NotifyHandlerFactory struct {
    handlers sync.Map  // map[string]NotifyHandler
}

func (f *NotifyHandlerFactory) Register(h NotifyHandler) {
    f.handlers.Store(h.TriggerType(), h)
}

func (f *NotifyHandlerFactory) Get(triggerType string) (NotifyHandler, bool) {
    h, ok := f.handlers.Load(triggerType)
    return h.(NotifyHandler), ok
}

// 具体处理器
type AlertNotifyHandler struct{}

func (h *AlertNotifyHandler) TriggerType() string { return "ALERT_CREATED" }
func (h *AlertNotifyHandler) Handle(ctx context.Context, config NotifyPolicyConfig, param NotifyParam) error {
    // 实现通知逻辑
    return nil
}

// 注册（启动时）
func init() {
    notifyFactory.Register(&AlertNotifyHandler{})
    notifyFactory.Register(&PipelineNotifyHandler{})
    notifyFactory.Register(&DeployNotifyHandler{})
}
```

**映射关系**:
| NeatLogic | Orion |
|-----------|-------|
| `NotifyPolicyHandlerBase` | `NotifyHandler` 接口 |
| `NotifyPolicyHandlerFactory` (自动扫描) | `NotifyHandlerFactory` + `sync.Map` + `init()` 注册 |
| `@Component` 自动注册 | `init()` 函数注册 |

### 2.5 调度框架

**NeatLogic**: `SchedulerManager` + `IJob` + `JobBase` + `JobLoadTriggerType`

**Orion 等效**:
```go
type Job interface {
    Name() string
    Run(ctx context.Context) error
    Spec() string  // CRON 表达式
}

type SchedulerManager struct {
    jobs   map[string]Job
    cron   *cron.Cron
}

func (m *SchedulerManager) Register(j Job) {
    m.jobs[j.Name()] = j
    m.cron.AddFunc(j.Spec(), func() { j.Run(context.Background()) })
}
```

### 2.6 全局锁

**NeatLogic**: `GlobalLockManager` + `GlobalLockHandlerFactory`

**Orion 等效**:
```go
type GlobalLockManager struct {
    redis *redis.Client
}

func (m *GlobalLockManager) TryLock(ctx context.Context, resourceID string, ttl time.Duration) (bool, error) {
    key := fmt.Sprintf("global_lock:%s", resourceID)
    return m.redis.SetNX(ctx, key, "1", ttl).Result()
}

func (m *GlobalLockManager) Unlock(ctx context.Context, resourceID string) error {
    key := fmt.Sprintf("global_lock:%s", resourceID)
    return m.redis.Del(ctx, key).Err()
}
```

### 2.7 图可视化（GraphViz）

**NeatLogic Java 实现**（已在 CMDB 中实际使用）:
```java
Graphviz.Builder gb = new Graphviz.Builder(LayoutType.get(layout));
Node.Builder nb = new Node.Builder("Graph_" + id);
nb.withLabel(name).withTooltip(name).withImage(icon);
gb.addNode(nb.build());
Link.Builder lb = new Link.Builder(sourceId, targetId).withLabel(relName);
gb.addLink(lb.build());
```

**Orion Go 等效**:
```go
type GraphViz struct {
    Layout string  // dot/neato/fdp/sfdp/twopi/circo
    Nodes  []*Node
    Links  []*Link
}

type Node struct {
    ID       string `json:"id"`
    Label    string `json:"label"`
    Tooltip  string `json:"tooltip"`
    Image    string `json:"image,omitempty"`
    Color    string `json:"color,omitempty"`
}

type Link struct {
    Source  string `json:"source"`
    Target  string `json:"target"`
    Label   string `json:"label,omitempty"`
    Arrow   string `json:"arrow,omitempty"`
}

func NewGraphViz(layout string) *GraphViz {
    return &GraphViz{Layout: layout, Nodes: make([]*Node, 0), Links: make([]*Link, 0)}
}
```

---

## 3. 自动化执行引擎（核心基础设施）

### 3.1 架构（三层模型）

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│  neatlogic-app  │────▶│ neatlogic-runner │────▶│ Autoexec Backend    │
│  (Java, 8282)   │     │ (Java, 8084)     │     │ (Python 3.7/Perl 5) │
│  作业编排/API    │     │ 执行调度/API      │     │ 实际执行引擎        │
└─────────────────┘     └─────────────────┘     └────────┬────────────┘
                                                          │
                     ┌────────────────────────────────────┼────────────────┐
                     ▼                                    ▼                ▼
              ┌──────────────┐                   ┌──────────────┐  ┌────────────┐
              │ SSH (Linux)  │                   │ tagent Agent │  │ Local Exec │
              └──────────────┘                   │ (Win/Linux)  │  └────────────┘
                                                  └──────────────┘
```

### 3.2 执行模型（四层）

```
Job (作业)
├── Phase 1 (阶段)
│   ├── Node A (节点)
│   │   ├── Operation 1 (操作)
│   │   ├── Operation 2
│   │   └── ...
│   ├── Node B
│   └── ...
├── Phase 2
└── ...
```

### 3.3 核心 Python 模块

| 文件 | 大小 | 职责 |
|------|------|------|
| `RunNode.py` | 104 KB | **节点执行器（最大模块）** |
| `ServerAdapter.py` | 70 KB | 服务器适配器（SSH/Agent） |
| `JobRunner.py` | 45 KB | 作业运行器 |
| `TagentClient.py` | 37 KB | Agent 客户端 |
| `Operation.py` | 35 KB | 操作处理器（参数/文件/解密） |
| `PhaseExecutor.py` | 17 KB | 阶段执行器 |
| `GlobalLock.py` | 12 KB | 全局锁 |
| `ConditionDSL.py` | 7 KB | 条件 DSL |

### 3.4 插件体系（280+ 插件）

| 类型 | 数量 | 技术 | 说明 |
|------|------|------|------|
| CMDB 采集（本地） | 44 | Perl | SNMP/SSH 采集网络设备 |
| CMDB 采集（远程） | 82 | Perl | 采集中间件/数据库/OS |
| 巡检（本地） | 3 | Perl | 本地巡检脚本 |
| 构建 | 10 | Perl | Maven/Gradle/NPM |
| 部署 | 36 | Perl | 文件传输/应用部署 |
| Web 中间件 | 20 | Perl | WebLogic/WebSphere |
| 基础操作 | — | Perl | 系统操作 |
| 云平台 | 3 | Python | vCenter/Horizon/K8s |

**CMDB 采集覆盖**: Cisco/Huawei/H3C/Juniper | Oracle/MySQL/PG/SQL Server/TiDB/达梦/金仓 | Tomcat/WebLogic/WebSphere/Nginx | Redis/Kafka/RabbitMQ | Docker/K8s

### 3.5 Orion 落地方案

```go
// 执行引擎抽象层
type Executor interface {
    Execute(ctx context.Context, job *Job) (*ExecutionResult, error)
}

type ExecutorFactory struct {
    executors sync.Map  // map[string]Executor
}

func (f *ExecutorFactory) Get(execType string) (Executor, bool) {
    e, ok := f.executors.Load(execType)
    return e.(Executor), ok
}

// 执行模型
type Job struct {
    ID      string
    Phases  []Phase
}

type Phase struct {
    Name    string
    Mode    string  // "sequential" / "parallel"
    Nodes   []Node
}

type Node struct {
    Target    string
    Operations []Operation
}

type Operation struct {
    Type      string  // "ssh" / "agent" / "local"
    Script    string
    Params    map[string]interface{}
}
```

---

## 4. 多租户数据库体系

### 4.1 三库分离

| 数据库 | 用途 | 表数 | 字符集 |
|--------|------|------|--------|
| `neatlogic` | 管理库（共享） | 23 | utf8mb4 |
| `neatlogic_{tenant}` | 租户业务库 | 727 | utf8mb4 |
| `neatlogic_{tenant}_data` | 租户扩展库 | 343 | utf8mb4 |

**Orion 对比**: PostgreSQL Schema + RLS 方案更优雅，避免了 MySQL 三库的物理隔离复杂性。

### 4.2 动态数据源切换

```xml
<!-- NeatLogic MyBatis SQL 中使用 @{DATA_SCHEMA} 占位符 -->
SELECT * FROM @{DATA_SCHEMA}.cmdb_ci WHERE id = #{id}
```

**Orion 等效** (RLS 自动隔离，无需切换):
```sql
-- RLS 策略自动按 tenant_id 过滤
SELECT * FROM cmdb_ci WHERE id = $1;
-- 无需 @{DATA_SCHEMA}，应用层只需设置 current_tenant_id session 变量
```

### 4.3 数据库迁移（重点借鉴）

```
neatlogic/{module}/changelog/
├── 2024-01-11/
│   ├── neatlogic_tenant.sql   # SQL 变更
│   └── version.json           # {"version": "1.0.1", "description": "add alert_breaker tables"}
├── 2025-03-01/
│   ├── neatlogic_tenant.sql
│   └── version.json
└── ...

neatlogic/{module}/sqldefine/
├── index.json                  # 表索引
└── tables/
    ├── alert.json              # 表定义 JSON (字段/类型/索引/注释)
    └── ...
```

**version.json 示例**:
```json
{
  "version": "1.0.1",
  "description": "add alert_breaker tables",
  "tables": ["alert_breaker", "alert_breaker_handler", "alert_breaker_policy"],
  "dependencies": ["1.0.0"]
}
```

---

## 5. 模块数据模型

### 5.1 告警管理（30+ 表）

**核心表与关键字段**:
```sql
alert (
    id          BIGINT PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,       -- 告警名称
    status      VARCHAR(32) NOT NULL,        -- open/ack/resolved/closed
    level       VARCHAR(16) NOT NULL,        -- P0/P1/P2/P3
    ci_id       BIGINT,                      -- 关联 CI
    source      VARCHAR(64),                 -- 告警来源
    message     TEXT,                        -- 告警消息
    attributes  JSONB,                       -- 动态属性
    created_at  TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
)

alert_rule (
    id          BIGINT PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    status      VARCHAR(32) NOT NULL,        -- active/inactive
    config      JSONB,                       -- 规则配置 (过滤/聚合/抑制)
    level       VARCHAR(16),                 -- 告警级别
    notify_template_id BIGINT                -- 通知模板
)

alert_catalog (
    id          BIGINT PRIMARY KEY,
    name        VARCHAR(256) NOT NULL,
    parent_id   BIGINT,                      -- 目录树
    sort        INT DEFAULT 0
)

alert_breaker (
    id          BIGINT PRIMARY KEY,
    name        VARCHAR(256) NOT NULL,
    status      VARCHAR(32) NOT NULL,        -- active/inactive
    policy      JSONB,                       -- 熔断策略
    handler     VARCHAR(256)                 -- 处理器类型
)
```

**设计亮点**: 动态属性 (JSONB) + 熔断器 + ES 全文检索 + 事件自动处理

### 5.2 CMDB（80+ 表）

**核心表与关键字段**:
```sql
cmdb_ci (
    id          BIGINT PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    type_id     BIGINT NOT NULL,             -- 关联 CI 类型
    status      VARCHAR(32) NOT NULL,        -- active/inactive
    group_id    BIGINT,                      -- 分组
    tags        JSONB,                       -- 标签数组
    attributes  JSONB,                       -- 动态属性
    created_at  TIMESTAMPTZ
)

cmdb_cientity (
    id          BIGINT PRIMARY KEY,
    ci_id       BIGINT NOT NULL,
    tenant_id   VARCHAR(64) NOT NULL,
    attributes  JSONB                        -- 实体属性
)

cmdb_citype (
    id          BIGINT PRIMARY KEY,
    name        VARCHAR(128) NOT NULL,
    description TEXT,
    parent_id   BIGINT,                      -- 类型继承
    attributes  JSONB                        -- 属性定义
)

cmdb_rel (
    id          BIGINT PRIMARY KEY,
    source_id   BIGINT NOT NULL,             -- 源 CI
    target_id   BIGINT NOT NULL,             -- 目标 CI
    type_id     BIGINT NOT NULL,             -- 关系类型
    name        VARCHAR(128)
)

cmdb_reltype (
    id          BIGINT PRIMARY KEY,
    name        VARCHAR(128) NOT NULL,
    source_type BIGINT,                      -- 源类型约束
    target_type BIGINT                       -- 目标类型约束
)
```

**设计亮点**: DSL 查询 (ANTLR4) + 属性表达式 + 全文索引 + 资源中心

### 5.3 自动化（50+ 表）

**核心表与关键字段**:
```sql
autoexec_job (
    id          BIGINT PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    content     JSONB,                       -- 作业内容 (Phase/Node/Operation)
    status      VARCHAR(32) NOT NULL,        -- active/inactive
    schedule    VARCHAR(64),                 -- CRON 表达式
    catalog_id  BIGINT                       -- 目录
)

autoexec_job_phase (
    id          BIGINT PRIMARY KEY,
    job_id      BIGINT NOT NULL,
    name        VARCHAR(128) NOT NULL,
    sort        INT DEFAULT 0,
    mode        VARCHAR(16) NOT NULL         -- sequential/parallel
)

autoexec_job_phase_node (
    id          BIGINT PRIMARY KEY,
    phase_id    BIGINT NOT NULL,
    target      VARCHAR(256) NOT NULL,       -- 目标节点
    sort        INT DEFAULT 0
)

autoexec_job_phase_operation (
    id          BIGINT PRIMARY KEY,
    node_id     BIGINT NOT NULL,
    type        VARCHAR(32) NOT NULL,        -- ssh/agent/local/http
    script      TEXT,
    params      JSONB,                       -- 操作参数
    sort        INT DEFAULT 0
)
```

### 5.4 发布管理（50+ 表）

**核心表与关键字段**:
```sql
deploy_pipeline (
    id          BIGINT PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    config      JSONB,                       -- 流水线配置
    status      VARCHAR(32) NOT NULL,        -- active/inactive
    app_id      BIGINT                       -- 关联应用
)

deploy_job (
    id          BIGINT PRIMARY KEY,
    pipeline_id BIGINT NOT NULL,
    name        VARCHAR(256) NOT NULL,
    status      VARCHAR(32) NOT NULL,        -- running/success/failed
    trigger_type VARCHAR(32),                -- manual/webhook/schedule
    config      JSONB,
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
)

deploy_version (
    id          BIGINT PRIMARY KEY,
    app_id      BIGINT NOT NULL,
    name        VARCHAR(128) NOT NULL,       -- 版本号
    status      VARCHAR(32) NOT NULL,        -- active/archived
    build_info  JSONB,                       -- 构建信息
    created_at  TIMESTAMPTZ
)

deploy_blue_green (
    id          BIGINT PRIMARY KEY,
    job_id      BIGINT NOT NULL,
    old_version BIGINT,                      -- 旧版本
    new_version BIGINT,                      -- 新版本
    switch_at   TIMESTAMPTZ                  -- 切换时间
)
```

### 5.5 变更管理（25+ 表）

**核心表与关键字段**:
```sql
change (
    id          BIGINT PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    status      VARCHAR(32) NOT NULL,        -- draft/approved/implemented/closed
    template_id BIGINT,                      -- 模板
    risk_level  VARCHAR(16),                 -- high/medium/low
    created_at  TIMESTAMPTZ,
    closed_at   TIMESTAMPTZ
)

change_sop (
    id          BIGINT PRIMARY KEY,
    name        VARCHAR(256) NOT NULL,
    description TEXT,
    steps       JSONB                        -- SOP 步骤定义
)

change_step (
    id          BIGINT PRIMARY KEY,
    change_id   BIGINT NOT NULL,
    name        VARCHAR(128) NOT NULL,
    sort        INT DEFAULT 0,
    status      VARCHAR(32) NOT NULL,        -- pending/running/done
    user_id     VARCHAR(32)                  -- 负责人
)
```

### 5.6 仪表盘（7 表）

**核心表与关键字段**:
```sql
dashboard (
    id          BIGINT PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    config      JSONB,                       -- 仪表盘布局/组件
    sort        INT DEFAULT 0
)

dashboard_widget (
    id          BIGINT PRIMARY KEY,
    dashboard_id BIGINT NOT NULL,
    type        VARCHAR(32) NOT NULL,        -- chart/table/kpi
    config      JSONB,                       -- 组件配置
    position    JSONB                        -- 位置 {x, y, w, h}
)

dashboard_visitcounter (
    id          BIGINT PRIMARY KEY,
    dashboard_id BIGINT NOT NULL,
    user_id     VARCHAR(32),
    visited_at  TIMESTAMPTZ
)
```

### 5.7 其他模块数据库推断（来自 727 张租户表 + 商业版模块）

| 模块 | 表前缀 | 表数 | 核心表 |
|------|--------|------|--------|
| 知识库 | `knowledge_*` | 15+ | knowledge_document, knowledge_document_version, knowledge_document_line |
| 报表 | `report_*` | 15+ | report, report_statement, reportinstance |
| 代码仓库 | `codehub_*` | 25+ | codehub_repository, codehub_mr, codehub_commit, codehub_issue |
| 拓扑图 | `diagram_*` | 22 | diagram_graph, diagram_template, diagram_widget |
| 灾备 | `dr_*` | 20+ | dr_scene, dr_service, dr_service_dependency_relationship |
| 事件管理 | `event_*` | 5+ | event, event_solution, event_type |
| RDM | `rdm_*` | 25+ | rdm_issue, rdm_project, rdm_iteration |
| 巡检 | `inspect_*` | 10+ | inspect_schedule, inspect_config_file |

---

## 6. AI / RAG 架构设计

### 6.1 后端架构

```
neatlogic-ai/
├── api/
│   ├── rag/SearchRagDatasetApi.java
│   ├── model/SaveAiModelApi.java
│   ├── agent/SaveAiAgentApi.java
│   └── chat/AiChatApi.java
├── dao/mapper/
│   ├── AiModelMapper.java/xml
│   ├── RagMapper.java/xml
│   └── AiAgentMapper.java/xml
├── dto/
│   ├── AiModelVo.java
│   ├── AiAgentVo.java
│   └── RagDatasetVo.java
└── service/
    └── AiAgentRunner.java  # Agent 执行器

neatlogic-ai-base/
├── rag/
│   ├── retriever/
│   │   ├── ContentRetriever      # 每个 dataset 一个检索器
│   │   ├── RetrieverFactory      # 检索器工厂
│   │   └── LanguageModelQueryRouter # 查询路由器
│   └── augmentor/
│       └── RetrievalAugmentor    # 检索增强器
└── model/agent/  # 模型/Agent 基础
```

### 6.2 RAG 接入方式（推荐）

```
基于 langchain4j 的 AiServices + RetrievalAugmentor 机制:

1. 每个已激活 RAG dataset → 一个 ContentRetriever
2. RetrieverFactory 装配所有 dataset 的 retriever
3. LanguageModelQueryRouter 自动选择最合适的 retriever

检索策略（第一阶段）:
  - 基于 embedding 字段做向量召回
  - 检索实现下沉到 AI base 层

入口层:
  AiAgentRunner.chatByAiServices()
  - 只负责挂载 retriever/augmentor
  - 不直接写 ES 检索细节
```

### 6.3 Orion 等效

```go
type Retriever interface {
    Retrieve(ctx context.Context, query string) ([]Document, error)
}

type RetrieverFactory struct {
    retrievers sync.Map
}

func (f *RetrieverFactory) Register(name string, r Retriever) {
    f.retrievers.Store(name, r)
}

// AiAgentRunner 只负责挂载
func (r *AiAgentRunner) Chat(ctx context.Context, query string) (string, error) {
    augmentor := NewRetrievalAugmentor(r.factory.LoadAll())
    ai := NewAiServices(augmentor)
    return ai.Chat(ctx, query)
}
```

### 6.4 与告警集成

```
告警模块通过 Crossover 调用 AI Embedding 服务:
  IAlertEmbeddingCrossoverService service = CrossoverServiceFactory.tryToGetApi(...)

用途: 告警文本向量化、相似性检索、智能分类
```

---

## 7. 拓扑图 / 架构图设计

### 7.1 数据模型（22 表）

**核心表与关键字段**:
```sql
diagram_template (
    id          BIGINT PRIMARY KEY,
    name        VARCHAR(256) NOT NULL,
    config      JSONB,                       -- 模板配置
    ci_id       BIGINT,                      -- 起点 CI
    is_autofill BOOLEAN DEFAULT FALSE        -- 是否自动填充
)

diagram_template_edge (
    id          BIGINT PRIMARY KEY,
    template_id BIGINT NOT NULL,
    source      VARCHAR(256),                -- 源节点
    target      VARCHAR(256)                 -- 目标节点
)

diagram_graph (
    id          BIGINT PRIMARY KEY,
    template_id BIGINT,
    active_version_id BIGINT,
    edit_version_id   BIGINT,
    cientity_id       BIGINT,                -- 关联 CI
    is_snapshot       BOOLEAN DEFAULT FALSE,
    is_private        BOOLEAN DEFAULT FALSE,
    user_id           VARCHAR(32)
)

diagram_widget (
    id          BIGINT PRIMARY KEY,
    graph_id    BIGINT NOT NULL,
    type        VARCHAR(32) NOT NULL,        -- node/edge/container
    config      JSONB                        -- 组件配置
)
```

### 7.2 模板自动填充

```
is_autofill = TRUE: 从 CMDB CI 关系自动构建图
  1. 选择起点 CI
  2. 根据 reltype 自动扩展
  3. 生成节点和边
  4. 应用模板样式

is_autofill = FALSE: 手动配置
```

### 7.3 拓扑类型

| 类型 | 说明 | NeatLogic 实现 | Orion 实现 |
|------|------|---------------|-----------|
| CMDB 拓扑 | CI 关系拓扑 | `GetCiTopoApi` | `topology` 域 (7 文件) |
| 自定义视图拓扑 | 视图数据拓扑 | `GetCustomViewDataCiEntityTopoApi` | `service-topology` 域 (7 文件) |
| 架构图 | 模板架构图 | `diagram_template` | 无（可借鉴） |
| 作业拓扑 | Pipeline 阶段图 | `AutoexecJobPhaseTopoApi` | `pipeline-graph` 域 (7 文件) |

---

## 8. ITSM 流程引擎

### 8.1 流程定义层

```
process (JSON 配置驱动)
├── config (longtext)  -- 流程图配置（SLA/步骤/处理人）
├── process_step       -- 流程步骤
│   ├── handler        -- 步骤处理器
│   ├── rel            -- 步骤关系
│   ├── sla            -- 步骤 SLA
│   ├── notify_policy  -- 步骤通知
│   └── worker_dispatcher -- 工作分发器
├── process_form       -- 流程表单
├── process_sla        -- 流程 SLA
├── process_score_template -- 评分模板
└── process_tag        -- 流程标签
```

### 8.2 流程任务执行层（80+ 表）

```
processtask              -- 任务实例
├── content/form/form_content  -- 内容/表单
├── formattribute            -- 表单属性
├── step                     -- 步骤
│   ├── content/data          -- 步骤内容/数据
│   ├── worker/user           -- 处理人/用户
│   ├── sla/sla_time          -- SLA
│   ├── notify_policy         -- 通知
│   ├── timer/remind          -- 定时/提醒
│   ├── audit/audit_detail    -- 审计
│   ├── change_create/handle  -- 变更创建/处理
│   ├── event                 -- 事件
│   └── diagram               -- 图
├── score                   -- 评分
├── action                  -- 操作
├── agent                   -- 代理人
├── converge                -- 汇聚
└── urge                    -- 催办
```

### 8.3 核心模式

**步骤处理器工厂**:
```
NeatLogic: IProcessStepHandlerCrossoverUtil + ProcessTaskConditionFactory
Orion: 可参考 `workflow` 域 + `saga` 域的步骤模式
```

**SLA 配置**:
```json
{
  "calculateHandler": "DefaultSlaCalculateHandler",
  "calculatePolicyList": [{
    "enablePriority": 1,
    "unit": "minute",
    "priorityList": [{"time": 30, "unit": "minute"}]
  }]
}
```

---

## 9. NeatLogic 局限性与风险

> 本部分补充 NeatLogic 设计的不足，避免盲目借鉴。

### 9.1 架构层面

| 局限 | 说明 | Orion 优势 |
|------|------|-----------|
| **单点瓶颈** | 所有模块打包到单一 WAR，Tomcat 单点 | Orion 微服务架构，天然分布式 |
| **MySQL 三库扩展上限** | 每个租户需要 3 个独立数据库，租户数 > 100 时管理成本高 | Orion PostgreSQL Schema + RLS，单库多 Schema |
| **MySQL 限制** | 不支持 PostgreSQL 的高级特性（JSONB/RLS/分区表） | Orion PostgreSQL 原生支持 |
| **部署复杂** | 需要 Tomcat + Nginx + MySQL + MongoDB + ES + Nacos + MQ | Orion K8s 一键部署 |

### 9.2 代码层面

| 局限 | 说明 | Orion 优势 |
|------|------|-----------|
| **Java 8/17 语法** | 大量使用注解和反射，代码冗长 | Go 简洁，编译期类型安全 |
| **MyBatis XML 分散** | 500+ XML 文件分散在各模块 | Go sqlx 内联 SQL，更集中 |
| **JSON 序列化** | FastJSON 已知安全问题 | Go encoding/json 更安全 |

### 9.3 工程层面

| 局限 | 说明 | Orion 优势 |
|------|------|-----------|
| **构建慢** | Maven 多模块编译，全量构建 30+ 分钟 | Go 编译快，单模块秒级 |
| **内存消耗** | JVM 启动需要 4G+ 内存 | Go 二进制 ~50MB，启动 < 100ms |
| **热更新** | 需要重启 Tomcat | Go 支持 hot-reload + 微服务滚动更新 |

### 9.4 不适合借鉴的部分

| 部分 | 原因 |
|------|------|
| **前端 (Vue + Nginx)** | Orion 用 React + Vite + K8s Ingress，更现代化 |
| **Maven 构建** | Go 的模块系统比 Maven 更简洁 |
| **MyBatis XML** | Go sqlx 内联 SQL 更直观 |
| **Tomcat 部署** | Orion 用 K8s，无状态部署 |
| **Java 注解** | Go 的 struct tag + 代码生成更直接 |

---

## 10. 开发规范清单（后端）

> 仅列出与 Orion Go 开发相关的 NeatLogic 规范，前端规范不适用。

### 10.1 后端

| # | 规范 | NeatLogic 做法 | Orion 等效 |
|---|------|---------------|-----------|
| 1 | API 入口 | `IApiComponent` 替代 Controller | `gin.HandlerFunc` + Handler struct |
| 2 | 实体命名 | `xxxVo`，放 `-base` 模块 `dto` | `models/{domain}.go` struct |
| 3 | 字段元数据 | `@EntityField(name, type)` | struct tag + validator |
| 4 | SQL 组织 | XML 中写 SQL | 内联 SQL + sqlx |
| 5 | 分页模式 | `searchXxx` + `searchXxxCount` | `List(ctx, opts)` + `Count(ctx, opts)` |
| 6 | 多租户 | `@{DATA_SCHEMA}` 动态切换 | RLS 自动隔离 |
| 7 | 迁移 | changelog + version.json | Flyway + 时间戳排序 |
| 8 | 权限 | `@AuthAction` + 权限类 | `auth.RequirePermission(ctx, resource, action)` |
| 9 | 事务 | `@Transactional` | `db.BeginTx(ctx, opts)` |
| 10 | 日志 | log4j 级别动态调整 | 统一 logger + 结构化日志 |

---

## 11. Orion 借鉴落地建议

### 11.1 高优先级（P0/P1）

| 借鉴点 | NeatLogic 做法 | Orion 落地方案 | 优先级 |
|--------|---------------|---------------|--------|
| **自动化执行引擎** | Java 编排 + Python/Perl 执行 + 280 插件 | 设计统一执行引擎抽象层 (`Executor` 接口) + 插件 SPI + `ExecutorFactory` | P0 |
| **统一通知引擎** | `NotifyPolicyHandlerFactory` + 工厂模式 | 提取 `notification` 域为 `NotifyHandlerFactory` + `sync.Map` + `init()` 注册 | P1 |
| **CMDB 采集适配器** | 120+ 厂商适配器 | 设计采集适配器 SPI (`Collector` 接口)，首批覆盖网络 (Cisco/Huawei/H3C) + 数据库 (MySQL/Oracle/PG) | P1 |
| **全局搜索** | `GlobalSearchManager` + 6 模块索引 | ES 集成 + `SearchIndexer` 接口 + 多模块索引统一入口 | P1 |
| **数据库迁移** | changelog + version.json | 完善 Flyway 规范：时间戳排序 + version 追踪 + 回滚支持 | P1 |
| **流程引擎执行层** | 步骤处理器工厂 + SLA | 补全 process/processtask 的执行逻辑：`StepHandler` 接口 + `StepHandlerFactory` + SLA 计算器 | P1 |

### 11.2 中优先级（P2）

| 借鉴点 | NeatLogic 做法 | Orion 落地方案 |
|--------|---------------|---------------|
| **动态表单引擎** | FormVo + FormAttributeVo + 数据转换 | 设计 `Form` struct + `FormField` + 表单渲染引擎 |
| **条件引擎** | `IConditionHandler` + ConditionGroup | 条件表达式引擎 (Aviator/Go expression) |
| **图可视化** | GraphViz.Builder + 模板系统 | 集成 graphviz Go 库 + 图模板 + 自动填充 |
| **全文索引工厂** | `FullTextIndexHandlerFactory` | 多模块索引抽象 (`Indexer` 接口) + ES 统一入口 |
| **导入导出工厂** | `ImportExportHandlerFactory` | 统一导入导出框架 (`Importer`/`Exporter` 接口) |
| **SQL 动态生成** | `$sql` + ExpressionVo | Go SQL 构建器 (参考 squirrel) |

### 11.3 低优先级（P3）

| 借鉴点 | 说明 |
|--------|------|
| **LCS 基线管理** | 基线变更追踪 |
| **数据仓库抽象** | DataSource 抽象层 |
| **Agent 管理** | tagent 注册/升级/心跳 |

### 11.4 架构差异对比

| 维度 | NeatLogic | Orion | Orion 优势 |
|------|-----------|-------|-----------|
| 语言 | Java 17 + Python/Perl | Go 1.25 + Python/TS | 编译快，内存省，并发强 |
| 框架 | Spring + MyBatis | Gin + sqlx | 轻量，启动快 |
| 模块化 | DispatchServlet + Maven | Go module + 微服务 | 天然分布式 |
| 多租户 | MySQL 三库分离 | PostgreSQL Schema + RLS | 更优雅，管理成本低 |
| 自动化 | 混合架构（Java 编排 + 脚本执行） | Node.js Agent | 更轻量 |
| 前端 | Vue + Nginx | React + K8s Ingress | 更现代化 |
| 部署 | Docker + serveradmin | K8s | 自动化程度高 |
| 测试 | JUnit | Go testing | 编译期检查 |
| 并发 | JVM 线程 | Go goroutine | 百万级并发 |

---

> *本标杆报告用于功能开发参考。问题分析请参考 `orion-problem-analysis-2026-07-22.md`，架构开发参考请参考 `orion-architecture-reference-2026-07-22.md`。*

---

## 附录 A. 16 个模块完整代码结构

### A.1 模块包结构模式

**业务模块**:
```
neatlogic.module.xxx/
├── api/                    # API 实现（按领域分包）
├── adaptor/                # 适配器
├── auditconfig/handler/    # 审计配置
├── dao/mapper/             # MyBatis Mapper
├── dto/                    # 局部 DTO
├── service/                # 业务服务
├── schedule/handler/       # 定时任务
├── startup/handler/        # 启动初始化
├── notify/handler/         # 通知处理
├── mq/                     # 消息队列
└── file/                   # 文件处理
```

**基础模块**:
```
neatlogic.framework.xxx/
├── dto/                    # 跨模块共享 DTO/Vo
├── enums/                  # 枚举
├── constvalue/             # 常量
├── exception/              # 异常
├── auth/                   # 权限定义
├── config/                 # 配置
├── crossover/              # 跨模块引用
├── dao/                    # 共享 DAO
├── utils/                  # 工具类
└── event/                  # 事件定义
```

### A.2 模块文件统计

| 模块 | Java | XML | JSON | SQL | 其他 | 总计 |
|------|------|-----|------|-----|------|------|
| neatlogic-cmdb | 477 | 42 | 115 | 34 | 29 | 699 |
| neatlogic-autoexec | 370 | 258 | 58 | 20 | 35 | 741 |
| neatlogic-autoexec-base | 375 | 11 | 0 | 0 | 14 | 400 |
| neatlogic-cmdb-base | 466 | 3 | 0 | 0 | 12 | 481 |
| neatlogic-autoexec-backend | 0 | 0 | 456 | 0 | 782 | 1238 |
| neatlogic-deploy | 249 | 18 | 64 | 17 | 25 | 373 |
| neatlogic-deploy-base | 211 | 3 | 0 | 0 | 10 | 224 |
| neatlogic-alert | 182 | 20 | 63 | 50 | 18 | 333 |
| neatlogic-alert-base | 144 | 3 | 0 | 0 | 7 | 154 |
| neatlogic-change | 62 | 4 | 25 | 0 | 26 | 117 |
| neatlogic-change-base | 48 | 1 | 0 | 0 | 12 | 61 |
| neatlogic-dashboard | 26 | 3 | 7 | 0 | 17 | 53 |
| neatlogic-dashboard-base | 25 | 1 | 0 | 0 | 12 | 38 |
| neatlogic-database | 0 | 1 | 13 | 3 | 18 | 35 |
| neatlogic-build-root | 0 | 1 | 0 | 0 | 3 | 4 |
| neatlogic-alert-plugin-base | 2 | 1 | 0 | 0 | 10 | 13 |

### A.3 CMDB 模块详细包结构

```
neatlogic.module.cmdb/
├── api/
│   ├── attr/ci/cientity/citype/ciview/customview/discovery/globalattr/globalsearch/
│   ├── graph/group/legalvalid/mongodb/mq/rel/reltype/resourcecenter/sync/tag/topo/
│   └── transaction/validator/
├── attrexpression/          # 属性表达式引擎
├── attrvaluehandler/        # 属性值处理器
├── dsl/                     # DSL 查询（ANTLR4）
│   ├── core/                # DslSearchManager, SearchExpression, SelectFragment
│   └── parser/              # CmdbDSLLexer, CmdbDSLParser (ANTLR4 生成)
├── matrix/                  # 矩阵管理
├── resourcecenter/          # 资源中心
├── service/                 # CI/实体/视图/关系/同步/事务服务
└── schedule/handler/        # 定时任务
```

### A.4 CMDB DSL 实现（ANTLR4）

```
neatlogic.module.cmdb.dsl/
├── DslSearchManager.java     # DSL 搜索入口
├── DslVisitor.java           # 继承 CmdbDSLBaseVisitor
├── core/
│   ├── CalculateExpression.java  # 计算表达式
│   ├── SearchExpression.java     # 搜索表达式
│   ├── SearchItem.java           # 搜索项
│   └── SelectFragment.java       # SELECT 片段（含 alias/select/attrCheckSet）
└── parser/
    ├── CmdbDSLLexer.java         # 词法分析器
    ├── CmdbDSLParser.java        # 语法分析器
    ├── CmdbDSLBaseVisitor.java   # 基础访问者
    ├── CmdbDSLVisitor.java       # 访问者接口
    ├── CmdbDSLBaseListener.java  # 基础监听者
    └── CmdbDSLListener.java      # 监听者接口
```

### A.5 自动化执行引擎 Python 核心模块

```
neatlogic-autoexec-backend/
├── lib/
│   ├── JobRunner.py         # 45KB - 作业运行器（核心入口）
│   ├── RunNode.py           # 104KB - 节点执行器（最大模块）
│   ├── ServerAdapter.py     # 70KB - 服务器适配器（SSH/Agent 连接）
│   ├── Operation.py         # 35KB - 操作处理器（参数解析/文件处理）
│   ├── PhaseExecutor.py     # 17KB - 阶段执行器
│   ├── TagentClient.py      # 37KB - Agent 客户端
│   ├── GlobalLock.py        # 12KB - 全局锁（并发控制）
│   ├── Context.py           # 13KB - 执行上下文
│   ├── ConditionDSL.py      # 7KB - 条件 DSL 解析器
│   ├── OutputStore.py       # 5KB - 输出存储
│   ├── PhaseNodeFactory.py  # 2KB - 阶段节点工厂
│   ├── PhaseStatus.py       # 4KB - 阶段状态
│   ├── NodeStatus.py        # 1KB - 节点状态
│   ├── RunNodeFactory.py    # 8KB - 节点执行器工厂
│   ├── VContext.py          # 8KB - 虚拟上下文
│   ├── AutoExecError.py     # 1KB - 异常定义
│   ├── Utils.py             # 2KB - 工具函数
│   └── JobPurger.py         # 2KB - 作业清理
├── bin/                     # 环境初始化脚本
├── conf/                    # 配置 (config.ini)
├── discovery/               # 自动发现模块
├── plugins/                 # 280+ 插件（local/remote）
└── tools/                   # 工具 (genautocfgkey, mysqldictexport)
```

### A.6 数据库表完整前缀分布

**管理库 (neatlogic)**:

| 表 | 用途 |
|-----|------|
| tenant, datasource, mongodb, elasticsearch | 租户配置 |
| tenant_module, tenant_modulegroup | 模块启用 |
| changelog_audit | 变更审计 |
| master_user, master_user_password, master_user_session | 用户 |

**租户库 (neatlogic_{tenant})**:

| 前缀 | 模块 | 表数 |
|------|------|------|
| `alert_*` | 告警管理 | 30+ |
| `autoexec_*` | 自动化 | 50+ |
| `cmdb_*` | CMDB | 80+ |
| `deploy_*` | 发布管理 | 50+ |
| `change_*` | 变更管理 | 25+ |
| `process_*` | 流程管理 | 50+ |
| `processtask_*` | 流程任务 | 80+ |
| `rdm_*` | 需求/缺陷 | 25+ |
| `knowledge_*` | 知识库 | 15+ |
| `report_*` | 报表 | 15+ |
| `diagram_*` | 拓扑图 | 22 |
| `dr_*` | 灾备 | 20+ |
| `codehub_*` | 代码仓库 | 25+ |
| `custom_tlcb_*` | 定制模块 | 20+ |
| 通用 | 用户/角色/权限/通知 | 50+ |
| **合计** | | **727** |

---

## 附录 B. 告警管理模块深度分析

### B.1 包结构

```
neatlogic.module.alert/
├── api/
│   ├── alert/alertaction/alertaudit/alertcatalog/alertcomment/
│   ├── alertevent/alerteventhandlertype/alertlevel/alertmark/
│   ├── alertnotifytemplate/alertrule/alertsource/alertstatus/
│   ├── alerttype/alertview/allalert/attrtype/breaker/
├── adaptor/              # 告警适配器
├── aftertransaction/     # 事务后处理
├── attr/freemarker/      # 属性 Freemarker 模板
├── auditconfig/handler/  # 审计配置
├── breaker/action/       # 熔断动作
├── dao/mapper/           # MyBatis Mapper
├── dto/                  # DTO
├── elasticsearch/        # ES 集成
├── event/                # 事件
├── file/                 # 文件
├── groupsearch/          # 分组搜索
├── mq/                   # 消息队列
├── queue/                # 队列
├── schedule/handler/     # 定时任务
├── service/              # 业务服务
└── startup/handler/      # 启动初始化
```

### B.2 告警生命周期

```
告警来源 → 告警规则 → 告警事件 → 告警处理 → 告警关闭
              ↓
         告警级别（P0/P1/P2/P3）
              ↓
         通知模板 → 消息通知
```

### B.3 设计亮点

1. **告警适配器模式**: adaptor 包支持多种告警来源接入
2. **熔断器**: breaker 包支持告警风暴防护
3. **动态属性**: alert_attr + alert_attrtype 支持动态扩展告警属性
4. **ES 集成**: elasticsearch 包支持告警全文检索
5. **事件处理器**: alerteventhandlertype 支持自动处理（自动恢复/通知/工单）

---

## 附录 C. CMDB 模块深度分析

### C.1 包结构

```
neatlogic.module.cmdb/
├── api/                  # 20+ 子域
├── attrexpression/      # 属性表达式
├── attrvaluehandler/    # 属性值处理器
├── config/              # 配置
├── constvalue/matrix/   # 矩阵常量
├── dao/mapper/          # MyBatis Mapper
├── dsl/                 # DSL 查询（ANTLR4）
├── formattribute/       # 格式化属性
├── fulltextindex/       # 全文索引
├── group/               # 分组
├── importexport/        # 导入导出
├── legalvalid/          # 合法性校验
├── matrix/              # 矩阵管理
├── mq/topic/            # 消息主题
├── plugin/              # 插件
├── process/             # 流程集成
├── publicapi/           # 公开 API
├── rebuilddatabaseview/ # 数据库视图重建
├── relativerel/         # 相对关系
├── resourcecenter/      # 资源中心
├── schedule/handler/    # 定时任务
├── service/             # 业务服务
├── startup/handler/     # 启动初始化
├── tagent/register/     # Agent 注册
└── workerdispatcher/    # 工作分发
```

### C.2 设计亮点

1. **DSL 查询**: ANTLR4 实现，支持动态 SQL 生成
2. **属性表达式**: 支持动态属性计算
3. **全文索引**: 多模块全文检索
4. **数据同步**: 15+ 同步表，支持外部系统数据同步
5. **矩阵管理**: 矩阵式数据展示
6. **Agent 注册**: 支持 Agent 自动注册 CI

---

## 附录 D. 发布管理模块深度分析

### D.1 包结构

```
neatlogic.module.deploy/
├── api/
│   ├── activeversion/appbuild/appconfig/apppipeline/bluegreen/
│   ├── ci/env/instance/job/notify/pipeline/schedule/test/type/version/webhook/
├── audit/                # 审计
├── auth/core/            # 权限核心
├── chart/                # 图表
├── dao/mapper/           # MyBatis Mapper
├── dependency/handler/   # 依赖处理
├── dto/resourcecenter/   # 资源中心 DTO
├── globallock/           # 全局锁
├── handler/              # 处理器
├── importexport/handler/ # 导入导出
├── integration/handler/  # 集成
├── job/                  # 作业
├── notify/handler/       # 通知
├── schedule/plugin/      # 调度插件
└── service/              # 业务服务
```

### D.2 设计亮点

1. **流水线编排**: 多阶段流水线定义
2. **蓝绿部署**: bluegreen 包支持蓝绿切换
3. **全局锁**: globallock 防止并发发布冲突
4. **Webhook**: 支持外部系统触发发布
5. **版本管理**: 完整版本生命周期（构建→测试→部署→回滚）

---

## 附录 E. 变更管理模块深度分析

### E.1 包结构

```
neatlogic.module.change/
├── api/
│   ├── param/            # 参数
│   ├── sop/              # SOP 标准作业程序
│   └── template/         # 模板
├── audithandler/         # 审计
├── auth/label/           # 权限标签
├── dao/mapper/           # MyBatis Mapper
├── file/                 # 文件
├── notify/               # 通知
├── operationauth/        # 操作权限
├── schedule/plugin/      # 调度插件
├── service/              # 业务服务
├── stephandler/          # 步骤处理
│   ├── component/        # 步骤组件
│   └── utilhandler/      # 工具处理器
└── test/                 # 测试
```

### E.2 设计亮点

1. **SOP 标准作业程序**: 可复用的变更执行模板
2. **步骤组件化**: stephandler/component/ 支持步骤组件化
3. **操作权限**: operationauth/ 支持细粒度操作权限

---

## 附录 F. 仪表盘模块深度分析

### F.1 包结构

```
neatlogic.module.dashboard/
├── api/           # API
├── auth/label/    # 权限标签
├── dao/mapper/    # MyBatis Mapper
├── exception/     # 异常
└── file/          # 文件
```

### F.2 核心表

| 表 | 说明 |
|----|------|
| dashboard | 仪表盘定义 |
| dashboard_widget | 仪表盘组件 |
| dashboard_authority | 权限 |
| dashboard_default | 默认仪表盘 |
| dashboard_userdefault | 用户默认 |
| dashboard_visitcounter | 访问统计 |

---

## 附录 G. Docker 部署方案

### G.1 5 镜像架构

| 镜像 | 基础 | 端口 | 说明 |
|------|------|------|------|
| neatlogic-app | jdk17-tomcat9 | 8282 | 应用服务 |
| neatlogic-db | mysql:8.0.43 | 3306 | 数据库 |
| neatlogic-collectdb | mongodb:7.x | 27017 | 采集数据库 |
| neatlogic-runner | centos:8.4.2105 | 8084/8888 | 自动化执行 |
| neatlogic-web | nginx | 8080/8090/9099 | 前端 |

### G.2 entrypoint 模式

每个 Docker 镜像使用 `entrypoint.sh` 脚本管理启动顺序：

1. 等待依赖服务启动（`nc -z` 健康检查）
2. 注入环境变量（数据库连接/配置）
3. 启动服务
4. 保持容器运行（`exec bash`）

### G.3 配置注入

```bash
# entrypoint.sh 典型模式
perl -i -pe "s/db.url\s*=.*?3306\//db.url = jdbc:mysql:\/\/$MYSQL_SERVICE_HOST:$MYSQL_SERVICE_PORT\//g" $CONFIG_FILE
sed -i "s/^db.username\s*=.*/db.username=$MYSQL_SERVICE_USER/" $CONFIG_FILE
sed -i "s/^db.password\s*=.*/db.password=$MYSQL_SERVICE_PASSWORD/" $CONFIG_FILE
```

---

## 附录 H. 开发规范与设计模式总结

### H.1 后端开发规范

| 规范 | 说明 |
|------|------|
| API 入口 | 所有接口通过 `IApiComponent` 实现，不创建传统 Controller |
| 实体命名 | 统一命名为 `xxxVo`，放在 `-base` 模块 `dto` 包 |
| 字段注解 | 使用 `@EntityField` 定义字段元数据 |
| SQL 组织 | SQL 统一写在 XML 中，不写在注解里 |
| 分页模式 | `searchXxx` + `searchXxxCount` 分页对 |
| 多租户 | 使用 `@{DATA_SCHEMA}` 动态切换数据库 |
| 数据库迁移 | changelog 日期目录 + version.json |
| 表定义 | sqldefine/tables/{table}.json JSON 定义 |
| 权限控制 | `@AuthAction(action=...)` + 权限类定义 |
| 事务控制 | `@Transactional` 注解 |

### H.2 关键设计模式

1. **模块化 Spring 分层**: DispatchServlet 隔离 + root-context 共享
2. **API 组件化**: `IApiComponent` 替代传统 Controller
3. **-base 模块分离**: 解决 Maven 交叉引用限制
4. **注解驱动**: 权限/参数/事务/描述全注解化
5. **动态数据源**: `@{DATA_SCHEMA}` 多租户切换
6. **Changelog 迁移**: 日期目录 + version.json 版本控制
7. **插件化执行**: Python/Perl 插件 + Java 调度
8. **事件驱动**: MQ + 事件处理器
9. **全文索引**: ES 集成
10. **矩阵式数据**: 支持矩阵式数据展示

---

## 附录 I. 跨模块调用工厂（CrossoverServiceFactory）

> **来源文档**: `extracted/ANALYSIS_crossover.md` (96 行) | **可移植性**: ✅ 高度

### 核心架构

```
CrossoverServiceFactory (ModuleInitializedListenerBase)
  ├── apiMap: Map<Class, ICrossoverService>  (static HashMap)
  │
  ├── 启动阶段: 各模块 Spring 上下文刷新时
  │   └── context.getBeansOfType(ICrossoverService.class) → 注册到 apiMap
  │
  └── 运行时: 调用方直接获取
      └── CrossoverServiceFactory.getApi(IAppSystemMapper.class)
```

### 关键设计

1. **非远程调用**: 同 JVM 内的模块间 Service 调用，通过全局 `static Map` 缓存
2. **无代理**: 直接返回原始 Bean 实例，`AopUtils.getTargetClass()` 仅剥离 AOP 代理
3. **接口分层**: 接口定义在 `-base` 模块，实现类在业务模块，避免循环依赖
4. **MyBatis Mapper 支持**: Crossover 接口可以是 MyBatis Mapper 接口

### Orion 移植建议

```go
// CrossoverServiceFactory 的 Go 等效
type CrossoverServiceFactory struct {
    services sync.Map  // map[reflect.Type]interface{}
}

func (f *CrossoverServiceFactory) Register(service interface{}) {
    t := reflect.TypeOf(service)
    f.services.Store(t, service)
}

func (f *CrossoverServiceFactory) GetAPI[T any]() T {
    var zero T
    t := reflect.TypeOf(zero)
    if v, ok := f.services.Load(t); ok {
        return v.(T)
    }
    return zero
}
```

---

## 附录 J. 通知引擎三层工厂

> **来源文档**: `extracted/ANALYSIS_notify.md` (231 行) | **可移植性**: ✅ 高度

### 核心架构

```
三层工厂模式:
  1. NotifyHandlerFactory  → 通知渠道 (EMAIL/MESSAGE/WECHAT)
  2. NotifyPolicyHandlerFactory → 通知策略 (各模块实现)
  3. NotifyTriggerTypeFactory → 触发点 (自动扫描 INotifyTriggerType 枚举)
```

### 执行链路

```
NotifyPolicyUtil.executeAsync()
  → AfterTransactionJob (事务提交后异步)
    → NotifyPolicyHandlerFactory.getHandler() 获取策略处理器
    → 匹配触发点 notifyTriggerType
    → 条件判断 (JavascriptUtil.runScript())
    → NotifyHandlerFactory.getHandler() 获取通知处理器
    → NotifyVo.Builder 构建通知对象 (FreeMarker 模板替换)
    → handler.execute(notifyVo) 发送通知
    → 记录审计日志
```

### Orion 移植建议

```go
// 通知数据载体
type NotifyVo struct {
    Title       string
    Content     string
    Recipients  []string   // 接收人列表
    CC          []string   // 抄送人列表
    Attachments []string   // 附件列表
    Error       error      // 模板替换错误
    TenantID    string
    TriggerType string
}

// 通知处理器接口
type NotifyHandler interface {
    Type() string
    Execute(ctx context.Context, notify *NotifyVo) error
}

// 通知处理器工厂
type NotifyHandlerFactory struct {
    handlers sync.Map  // map[string]NotifyHandler
}

func (f *NotifyHandlerFactory) Register(h NotifyHandler) {
    f.handlers.Store(h.Type(), h)
}

// 通知策略处理器
type NotifyPolicyHandler interface {
    Name() string
    TriggerTypes() []string
    ConvertData(ctx context.Context, data interface{}) map[string]interface{}
}

// 触发点接口
type NotifyTriggerType interface {
    Trigger() string
    Text() string
}
```

---

## 附录 K. 插件 SPI 扫描机制

> **来源文档**: `extracted/ANALYSIS_plugin_factory.md` (162 行) | **可移植性**: ✅ 高度

### 核心模式

所有工厂类遵循统一模式：
1. 标注 `@RootComponent` → 被 root-context 扫描
2. 继承 `ModuleInitializedListenerBase` → 监听 `ContextRefreshedEvent`
3. `onInitialized()` → `context.getBeansOfType(InterfaceClass)` 获取所有实现
4. 注册到 `static Map<String, HandlerInterface>`
5. 提供静态 `getHandler(type)` 方法

### 21 个扩展点接口

| 模块 | 扩展点 | 工厂类 | 映射键 |
|------|--------|--------|--------|
| framework | `INotifyHandler` | `NotifyHandlerFactory` | 类简单名 |
| itsm | `IProcessStepHandler` | `ProcessStepHandlerFactory` | getHandler() |
| cmdb | `IAttrValueHandler` | `AttrValueHandlerFactory` | getType() |
| autoexec | `IScriptParamType` | `ScriptParamTypeFactory` | getType() |
| alert | `IAlertEventHandler` | `AlertEventHandlerFactory` | getType() |
| deploy | `IDeployVersionChartHandler` | `DeployVersionChartHandlerFactory` | getType() |
| rdm | `IAttrHandler` | `AttrHandlerFactory` | getType() |
| inspect | `IInspectExtraHandler` | `InspectExtraHandlerFactory` | getType() |

### Orion 移植建议

```go
// 通用 SPI 扫描模式
type PluginFactory struct {
    plugins sync.Map  // map[string]interface{}
}

func (f *PluginFactory) Register(name string, plugin interface{}) {
    f.plugins.Store(name, plugin)
}

// init() 中注册（替代 Spring @Component 自动扫描）
func init() {
    PluginFactoryHolder.Register("alert:email", &EmailAlertHandler{})
    PluginFactoryHolder.Register("alert:wechat", &WechatAlertHandler{})
}
```

---

## 附录 L. API 注册与路由分发

> **来源文档**: `extracted/ANALYSIS_api_dispatcher.md` (226 行) | **可移植性**: ⚠️ 部分

### API 类型分类

| API 类型 | URL 前缀 | 说明 |
|----------|---------|------|
| OBJECT | `/api/rest/**` | 标准 JSON 对象 |
| STREAM | `/api/stream/**` | JSON 流 |
| SSE | `/api/sse/**` | 服务端推送事件 |
| BINARY | `/api/binary/**` | 二进制流 |
| RAW | `/api/raw/**` | 原始字符串 |
| METRIC | `/api/metrics/**` | 指标监控 |
| FETCH | `/api/fetch/**` | 客户端拉取 |

### 执行链路

```
HTTP 请求 → ApiDispatcher (@RequestMapping("/api/"))
  → 提取 token (从 URL 路径)
  → getApiByToken(token) 精确匹配 → 正则匹配 (路径参数)
  → 限流 (RateLimiterTokenBucket)
  → 权限校验 (validAuth)
  → 参数校验 (validInput)
  → 防重复提交 (validIsReSubmit)
  → myDoService() 业务逻辑
  → 响应封装 ({Status, Return, TimeCost, requestSqlAudit})
```

---

## 附录 M. 表单引擎与条件引擎

> **来源文档**: `extracted/ANALYSIS_form_condition.md` (224 行) | **可移植性**: ✅ 高度

### 30+ 表单控件

| 类型 | 组件 | 说明 | React 适配 |
|------|------|------|-----------|
| form | formtext | 文本框 | `<Input />` |
| form | formselect | 下拉框 | `<Select />` |
| form | formdate | 日期 | `<DatePicker />` |
| form | formcascader | 级联 | `<Cascader />` |
| form | formuserselect | 用户选择 | 自定义组件 |
| form | formupload | 附件上传 | `<Upload />` |
| form | formckeditor | 富文本 | `<Editor />` |
| control | formtab | 选项卡 | `<Tabs />` |
| control | formcollapse | 折叠面板 | `<Collapse />` |

### 条件引擎三层结构

```
ConditionConfigVo
  └── conditionGroupList: [ConditionGroupVo]
        └── conditionList: [ConditionVo]
              ├── name: 字段名
              ├── expression: "equal"|"like"|"greater"|"less"
              └── valueList: 条件值
```

---

## 附录 N. 定时任务调度框架

> **来源文档**: `extracted/ANALYSIS_job_schedule.md` (194 行) | **可移植性**: ✅ 高度

### 核心接口

```go
// Go 等效
type Job interface {
    Name() string
    GroupName() string
    Execute(ctx context.Context, job *JobObject) error
    Init(ctx context.Context, tenantID string) error
    Spec() string  // Cron 表达式
}
```

### 异步任务框架

| Go 等效 | NeatLogic 原版 | 说明 |
|---------|---------------|------|
| `goroutine` | `CachedThreadPool` | 核心线程池 (core=0, max=cpu*15) |
| `context.Context` | `NeatLogicThread` | 自动继承父线程上下文 |
| `sync.WaitGroup` | `CountDownLatch` | 主线程等待 |
| `chan` | `SynchronousQueue` | 无缓冲队列 |

---

## 附录 O. 缓存与全局锁

> **来源文档**: `extracted/ANALYSIS_cache_lock.md` (157 行) | **可移植性**: ⚠️ 部分

### 缓存层级

| 层级 | NeatLogic 实现 | Orion 现有方案 | 对比 |
|------|---------------|---------------|------|
| 请求级缓存 | `@MCache` + ThreadLocal | Go context | Orion 更优 |
| 二级缓存 | Ehcache3 + MyBatis | Redis | Orion 更优 |
| 分布式锁 | 数据库行锁 FOR UPDATE | Redis SETNX | Orion 更优 |

### 可借鉴的模式

NeatLogic 的缓存穿透防护模式（double-check + ReentrantLock）值得参考：

```go
// Go 等效 double-check 缓存穿透防护
func (c *Cache) GetObject(key string) (interface{}, error) {
    obj := c.redis.Get(key)
    if obj == nil {
        c.mu.Lock()
        obj = c.redis.Get(key)  // double-check
        if obj == nil {
            obj = c.loadFromDB(key)
            c.redis.Set(key, obj, ttl)
        }
        c.mu.Unlock()
    }
    return obj, nil
}
```

---

## 附录 P. 安全认证体系

> **来源文档**: `extracted/ANALYSIS_security.md` (179 行) | **可移植性**: ❌ 低 (Orion 已有更优方案)

### 认证过滤器链

```
JsonWebTokenValidFilter
  → 时区解析 → RequestContext 初始化
  → 租户判断 → TenantContext 初始化
  → DefaultLoginAuthHandler.auth() (JWT 解析)
  → 会话过期检查 → 插件认证
  → filterChain.doFilter()
```

### 权限检查链路

```
@AuthAction 注解
  → validAuth() 检查
  → AuthActionChecker.check() 递归权限穿透
  → getIncludeAuths() 获取包含权限
  → 超级管理员免检
  → NoAuth 标签免检
```

### 对比 Orion

| 维度 | NeatLogic | Orion | 结论 |
|------|-----------|-------|------|
| 认证 | JWT + 插件体系 | JWT + RBAC + ABAC + 设备指纹 | Orion 更完善 |
| 权限 | `@AuthAction` 注解 | `auth.RequirePermission()` | 不同风格 |
| 租户隔离 | ThreadLocal + 数据源路由 | PostgreSQL RLS | Orion 更优 |
| 限流 | 令牌桶 | 已有 | 类似 |
| 防重复提交 | `@ResubmitInterval` | 已有 | 类似 |

---

## 附录 Q. 事务管理与 MyBatis

> **来源文档**: `extracted/ANALYSIS_transaction_mybatis.md` (202 行) | **可移植性**: ❌ 低

### 可借鉴模式

1. **编程式事务管理**: `TransactionUtil.openTx()` / `commitTx()` / `rollbackTx()`
2. **多数据源路由**: `NeatLogicRoutingDataSource` + `TenantContext` 动态切换
3. **自定义分页**: `PageInterceptor` + `PageRowBounds` (非 PageHelper)
4. **8 个 MyBatis 插件拦截器**: 耗时统计、异常审计、Schema 拦截、SQL 缓存清理

### Orion 对比

| 能力 | NeatLogic | Orion | 结论 |
|------|-----------|-------|------|
| 事务管理 | 编程式 (TransactionUtil) | Go sqlx 事务 | 不同语言，不适用 |
| 数据源路由 | AbstractRoutingDataSource | PostgreSQL 连接池 | 不同架构 |
| 分页 | 自定义拦截器 | LIMIT/OFFSET | 不同模式 |
| SQL 审计 | 8 个拦截器 | 已有 logger | 已有 |

---

## 附录 R. 配置管理体系（Config）

> **来源文档**: `ANALYSIS_framework.md` §2.6 (778 行) | **可移植性**: ✅ 高度

### 核心架构

```java
// NeatLogic 的 Config 类 — 60+ 静态配置项
public class Config {
    static String JWT_SECRET;        // JWT 密钥
    static String HOME_URL;          // 前端地址
    static int DB_PORT;              // 数据库端口
    static int DATASOURCE_MAXIMUM_POOL_SIZE;  // 连接池大小
    static String FILE_HANDLER;      // 文件处理器类型
    static int USER_EXPIRETIME;      // 会话超时 (分钟)
    static String LOGIN_AUTH_TYPE;   // 登录方式
    // ... 60+ 配置项

    @PostConstruct void init() {
        // 1. 加载 Nacos 配置 (优先级高)
        // 2. 加载本地 config.properties
        // 3. 通过反射调用所有 IConfigListener
    }
}
```

### 配置热更新机制

```
Nacos 配置变更
  → Config.loadLocalOrNacosProperties()
  → 遍历所有 IConfigListener 实现类
  → 调用 listener.onConfigChanged() 通知
  → 各模块响应配置变更
```

### IConfigListener 观察者模式

```java
public interface IConfigListener {
    String getConfigName();  // 配置项名称
    void onConfigChanged(String key, String value);  // 配置变更回调
}
```

### Orion 移植建议

```go
// 配置监听器接口
type ConfigWatcher interface {
    OnConfigChanged(key, value string)
}

// 配置管理器
type ConfigManager struct {
    mu       sync.RWMutex
    store    map[string]string
    watchers []ConfigWatcher
}

var GlobalConfig = &ConfigManager{
    store:    make(map[string]string),
    watchers: make([]ConfigWatcher, 0),
}

func (c *ConfigManager) Watch(w ConfigWatcher) {
    c.watchers = append(c.watchers, w)
}

func (c *ConfigManager) Set(key, value string) {
    c.mu.Lock()
    c.store[key] = value
    c.mu.Unlock()
    for _, w := range c.watchers {
        w.OnConfigChanged(key, value)
    }
}

func (c *ConfigManager) Get(key string) string {
    c.mu.RLock()
    defer c.mu.RUnlock()
    return c.store[key]
}
```

---

## 附录 S. 4 层线程上下文体系

> **来源文档**: `ANALYSIS_framework.md` §2.2-2.4 (778 行) | **可移植性**: ✅ 高度

### 上下文分层

| 上下文 | 职责 | 关键字段 | 初始化时机 |
|--------|------|---------|-----------|
| `TenantContext` | 租户隔离 | tenantUuid, isData, useDefaultDatasource | 请求入口 |
| `UserContext` | 用户身份 | userName, userId, isSuperAdmin, token | 认证成功后 |
| `RequestContext` | 请求上下文 | url, param, remoteAddr, locale, requestSqlAuditVo | 请求入口 |
| `InputFromContext` | 输入来源 | InputFrom (CRON/API/MQ/...) | 请求入口 |

### ThreadLocal 传递模式

```java
// NeatLogic 的 ThreadLocal 上下文传递
public class TenantContext {
    private static final ThreadLocal<TenantContext> instance = new ThreadLocal<>();

    public static TenantContext init() { ... }
    public static TenantContext get() { return instance.get(); }
    public void release() { instance.remove(); }
}

// NeatLogicThread 自动继承父线程上下文
public class NeatLogicThread extends Thread {
    private TenantContext tenantContext;
    private UserContext userContext;

    public NeatLogicThread(String name) {
        // 在创建线程时捕获父线程的上下文
        this.tenantContext = TenantContext.get();
        this.userContext = UserContext.get();
    }
}
```

### Orion 移植建议

```go
// Go 等效 — 使用 context.Context 链式传递
type contextKey string

var (
    TenantKey  = contextKey("tenant")
    UserKey    = contextKey("user")
    RequestKey = contextKey("request")
)

// 中间件自动注入上下文
func TenantMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        tenantID := r.Header.Get("X-Tenant-ID")
        ctx := context.WithValue(r.Context(), TenantKey, tenantID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// 获取当前租户
func GetTenant(ctx context.Context) string {
    return ctx.Value(TenantKey).(string)
}
```

---

## 附录 T. 公开/私有 API 分离 + 6 种 API 类型

> **来源文档**: `ANALYSIS_framework.md` §3.1-3.2 (778 行) | **可移植性**: ✅ 高度

### 双层 API 架构

| Dispatcher | 路由前缀 | 认证方式 | 适用场景 |
|-----------|---------|---------|---------|
| `ApiDispatcher` | `/api/rest/**` | JWT + `@AuthAction` | 内部 API (私有) |
| `PublicApiDispatcher` | `/public/api/rest/**` | Basic Auth | 外部 API (公开) |

### 6 种 API 类型模型

| 类型 | 用途 | Orion 等效 |
|------|------|-----------|
| OBJECT (`/api/rest/**`) | 标准 JSON 请求/响应 | 主流 API |
| STREAM (`/api/stream/**`) | JSON 流式处理 | SSE |
| SSE (`/api/sse/**`) | 服务端推送事件 | 已有 SSE |
| BINARY (`/api/binary/**`) | 文件上传/下载 | 已有 |
| RAW (`/api/raw/**`) | 原始字符串处理 | 自定义 |
| METRIC (`/api/metrics/**`) | 指标监控 | Prometheus |

### 核心设计: 路径 → Token 映射

```java
// 1. 精确匹配: apiMap.get(token)
// 2. 正则匹配: regexApiMap (TreeMap 按长度排序，最长匹配)
// 3. 路径变量: {id} → ([^/]+)
// 4. 回填: api.setPathVariableObj(pathVariableObj)
```

---

## 附录 U. SLA 时效计算引擎

> **来源文档**: `ANALYSIS_framework.md` §1.8 (778 行) | **可移植性**: ✅ 高度

### 核心接口

```java
public interface ISlaRecalculateHandler {
    String getHandler();           // 处理器类名
    void execute(String worktimeUuid);  // 根据服务窗口 uuid 重新计算 SLA
}
```

### SLA 配置结构 (JSON)

```json
{
  "calculateHandler": "DefaultSlaCalculateHandler",
  "calculatePolicyList": [{
    "enablePriority": 1,           // 按优先级分级
    "unit": "minute",
    "conditionGroupList": [],
    "priorityList": [{
      "time": 30, "unit": "minute",
      "priorityUuid": "08ca6c7..."
    }]
  }]
}
```

### Orion 移植建议

```go
type SLACalculator interface {
    Calculate(ctx context.Context, sla *SLAConfig, worktime *Worktime) (*SLAResult, error)
}

type SLAConfig struct {
    CalculateHandler string          `json:"calculateHandler"`
    Policies         []SLAPolicy     `json:"calculatePolicyList"`
}

type SLAPolicy struct {
    Priority     string       `json:"priority"`
    Unit         string       `json:"unit"`
    Time         int          `json:"time"`
    Conditions   []Condition  `json:"conditionGroupList"`
}
```

---

## 附录 V. 第三方集成引擎

> **来源文档**: `ANALYSIS_framework.md` §1.9 (778 行) | **可移植性**: ✅ 高度

### 核心接口

```java
public interface IIntegrationHandler {
    String getName();                    // 集成处理器名称
    String[] getMethod();                // 支持的 HTTP 方法 (默认 get/post)
    IntegrationResultVo sendRequest(IntegrationVo, IRequestFrom);  // 发送请求
    boolean hasPattern();                // 是否包含模式匹配
    List<PatternVo> getInputPattern();   // 输入模式验证
    List<PatternVo> getOutputPattern();  // 输出模式验证
    void validate(IntegrationResultVo);  // 验证集成结果
}
```

### 数据模型

```java
IntegrationVo {
    handler: String,        // 处理器类名
    config: JSONObject,     // 请求配置 (URL/Headers/Body)
    authenticateType: enum, // 认证类型 (Basic/OAuth/HMAC)
    // ...
}
```

### Orion 移植建议

```go
type IntegrationHandler interface {
    Name() string
    Methods() []string  // 支持的 HTTP 方法
    Send(ctx context.Context, req *IntegrationRequest) (*IntegrationResponse, error)
    Validate(ctx context.Context, result *IntegrationResponse) error
}

type IntegrationRequest struct {
    URL     string
    Method  string
    Headers map[string]string
    Body    []byte
    Auth    *AuthConfig  // Basic/OAuth/HMAC
}

type AuthConfig struct {
    Type     string // "basic" | "oauth" | "hmac"
    Username string
    Password string
    Token    string
}
```

---

## 附录 W. 全文索引引擎

> **来源文档**: `ANALYSIS_framework.md` §1.10 (778 行) | **可移植性**: ✅ 高度

### 6 模块独立索引

| 模块 | 索引表 | 内容表 | 偏移量表 |
|------|--------|--------|---------|
| autoexec | `fulltextindex_target_autoexec` | `fulltextindex_content_autoexec` | `fulltextindex_offset_autoexec` |
| cmdb | `fulltextindex_target_cmdb` | `fulltextindex_content_cmdb` | `fulltextindex_offset_cmdb` |
| framework | `fulltextindex_target_framework` | `fulltextindex_content_framework` | `fulltextindex_offset_framework` |
| knowledge | `fulltextindex_target_knowledge` | `fulltextindex_content_knowledge` | `fulltextindex_offset_knowledge` |
| process | `fulltextindex_target_process` | `fulltextindex_content_process` | `fulltextindex_offset_process` |
| rdm | `fulltextindex_target_rdm` | `fulltextindex_content_rdm` | `fulltextindex_offset_rdm` |

### 核心接口

```java
public interface IFullTextIndexHandler {
    boolean needSaveContent();
    IFullTextIndexType getType();    // 索引类型
    void createIndex(Long targetId); // 创建索引
    void deleteIndex(Long targetId); // 删除索引
    void rebuildIndex(String type, Boolean isRebuildAll);  // 重建索引
    void makeupDocument(DocumentVo documentVo);  // 格式化搜索结果
}
```

---

## 附录 X. 令牌桶限流

> **来源文档**: `ANALYSIS_framework.md` §3.1 (778 行) | **可移植性**: ⚠️ 部分

### 双层限流

| 级别 | 粒度 | 实现 |
|------|------|------|
| API 级别 | 每个 API token | `RateLimiterTokenBucket` |
| 租户级别 | 每个租户 | `TenantContext.tenantRate` |

### 限流触发

```java
// 在 ApiDispatcher.doIt() 中
if (!RateLimiterTokenBucket.tryAcquire()) {
    // 超限，返回 429 或等待
}
```

### Orion 移植建议

```go
// 双层令牌桶限流
type RateLimiter struct {
    apiRate     map[string]*rate.Limiter  // 按 API token 限流
    tenantRate  map[string]*rate.Limiter  // 按租户限流
    mu          sync.RWMutex
}

func (r *RateLimiter) Allow(apiToken, tenantID string) bool {
    // API 级别限流
    if limiter := r.getAPILimiter(apiToken); !limiter.Allow() {
        return false
    }
    // 租户级别限流
    if limiter := r.getTenantLimiter(tenantID); !limiter.Allow() {
        return false
    }
    return true
}
```

---

## 附录 Y. SQL 审计聚合

> **来源文档**: `ANALYSIS_framework.md` §2.4 (778 行) | **可移植性**: ✅ 高度

### 聚合模型

```java
RequestSqlAuditVo {
    List<SqlAuditVo> sqlAuditList;  // 单次请求中所有 SQL 执行记录
    // 聚合后提供:
    // - 总执行次数
    // - 总耗时
    // - 最慢 SQL 排行
    // - 按表名分组统计
}
```

### 使用场景

- 诊断慢查询: 按请求维度聚合，找出哪些请求命中慢 SQL
- 性能优化: 统计高频 SQL，优化索引
- 审计追踪: 记录所有数据变更操作

### Orion 移植建议

```go
// 按请求维度聚合 SQL 审计
type SQLAudit struct {
    Query     string
    Duration  time.Duration
    Rows      int64
    Timestamp time.Time
}

type RequestAudit struct {
    RequestID string
    SQLs      []SQLAudit
    TotalTime time.Duration
    SlowSQLs  []SQLAudit  // 超过阈值的慢查询
}

func (a *RequestAudit) Add(sql SQLAudit) {
    a.SQLs = append(a.SQLs, sql)
    a.TotalTime += sql.Duration
    if sql.Duration > 100*time.Millisecond {
        a.SlowSQLs = append(a.SlowSQLs, sql)
    }
}
```

---

## 附录 Z. 服务器心跳与分布式协调

> **来源文档**: `ANALYSIS_framework.md` §2.6 (778 行) | **可移植性**: ⚠️ 部分

### 核心机制

| 组件 | 说明 |
|------|------|
| `ServerId` | 唯一标识 (从 serverid.conf 读取) |
| `ServerGroup` | 分组标识 (从 servergroup.conf 读取) |
| `server_run_time` 表 | 记录心跳时间 |
| `HeartbeatJob` | 定时心跳 (默认 60s) |

### 调度服务器组隔离

```
ServerGroup A
  ├── SchedulerManager 只调度 Group A 的作业
  └── JobLock 通过数据库行锁保证跨服务器互斥

ServerGroup B
  └── 独立调度，不干扰 Group A
```

---

## 附录 AA. 密码管理策略

> **来源文档**: `ANALYSIS_tenant.md` §2.1 (409 行) | **可移植性**: ✅ 高度

### 核心策略

| 策略 | 实现 |
|------|------|
| 逻辑删除 | 用户删除后标记状态，相同 userId 可复用原 UUID |
| 密码历史 | 保存最近 N 条历史密码，防止重复使用 |
| 加密方式 | RC4 对称加密 (用于 API token) |
| 密码策略 | 从配置文件读取密码复杂度规则 |

### API 端点

```
user/save              → 用户创建/更新 (权限: USER_MODIFY)
user/password/update   → 当前用户修改密码 (需验证旧密码)
user/token/get         → 获取用户 Token
user/token/reset       → 重置用户 Token
user/session/delete    → 删除用户会话
```

---

## 附录 AB. 团队 LRCode 树形编码

> **来源文档**: `ANALYSIS_tenant.md` §2.3 (409 行) | **可移植性**: ✅ 高度

### LRCode 原理

左右值编码 (Left-Right Code) 是一种树形结构编码方案：

```
左值  节点  右值
 1   根节点  10
 2     ├── 子节点A  5
 3     │     ├── 孙节点A1  4
 6     └── 子节点B  7
 8     └── 子节点C  9
```

### 优势

| 操作 | parent_id 递归 | LRCode |
|------|---------------|--------|
| 查询子树 | N 次递归查询 | 1 次范围查询 `WHERE lft > ? AND rht < ?` |
| 插入节点 | 1 次 | 需要更新左右值 (O(n)) |
| 删除节点 | 1 次 | 需要更新左右值 (O(n)) |
| 查询父节点 | 1 次 | 1 次范围查询 |

### Orion 移植建议

```go
type Team struct {
    ID       int64  `json:"id"`
    Name     string `json:"name"`
    ParentID int64  `json:"parent_id,omitempty"`  // 兼容关联
    Lft      int    `json:"lft"`                   // 左值
    Rht      int    `json:"rht"`                   // 右值
    Level    int    `json:"level"`                 // 层级
}

// 查询子树: 1 次 SQL
SELECT * FROM team WHERE lft > ? AND rht < ? ORDER BY lft

// 插入节点: 需要更新左右值
UPDATE team SET rht = rht + 2 WHERE rht >= ? ORDER BY rht DESC
UPDATE team SET lft = lft + 2 WHERE lft > ?  ORDER BY lft DESC
INSERT INTO team (name, lft, rht, level) VALUES (?, ? + 1, ? + 2, ? + 1)
```

---

## 附录 AC. 角色规则表达式引擎

> **来源文档**: `ANALYSIS_tenant.md` §2.2 (409 行) | **可移植性**: ✅ 高度

### 规则角色

```java
// 角色支持"规则表达式"——在登录时动态判断角色是否生效
RoleSaveApi {
    // 角色名称、描述
    // 规则表达式 (Header 认证规则)
    // 用户分配、团队关联
    // 权限分配
}
```

### 角色权限操作模式

| 模式 | 说明 | 场景 |
|------|------|------|
| `ADD` | 追加权限 | 增量修改 |
| `COVER` | 覆盖全部权限 | 全量替换 |
| `DELETE` | 删除指定权限 | 精确移除 |

### 角色团队关联

```
RoleTeamSaveApi:
  - checked: 选中 (团队拥有该角色)
  - unchecked: 取消 (团队移除该角色)
  - partial: 部分选中 (只有子团队拥有)
  - checkedChildren: 是否穿透到子团队
```

---

> *本标杆报告用于功能开发参考。问题分析请参考 `orion-problem-analysis-2026-07-22.md`，架构开发参考请参考 `orion-architecture-reference-2026-07-22.md`。*

---

## 12. Orion 蓝图 TS→Go 迁移对标方案（SDD-2026-001）

### 12.1 背景与目的

**对标目的**: 以 NeatLogic 的全 Java 统一技术栈为标杆，制定 Orion 蓝图从多语言 (Go/TS/Rust/Python) 到统一 Go 技术栈的迁移方案。

**NeatLogic 参照**: NeatLogic 50+ 模块全部使用 Java 17，通过 Spring DispatchServlet 隔离 + root-context 共享实现模块化。Orion 的 Go 微服务架构天然支持模块隔离，但存在多语言散落的问题。

### 12.2 现状对标分析

| 维度 | NeatLogic (Java 统一) | Orion 当前 (多语言) | Orion 目标 (Go 统一) | 差距分析 |
|------|----------------------|-------------------|--------------------|---------|
| 技术栈 | Java 17 全模块统一 | Go 28 + TS 32 + Rust 1 + Python 3 | **Go 55 + Python 3 + Rust 1** | 需迁移 32 个 TS 蓝图 |
| 模块化 | DispatchServlet 隔离 | 微服务天然隔离 | 微服务天然隔离 | ✅ 更好 |
| 共享层 | neatlogic-framework 500+ 类 | Go 公共库 18 包 | Go 公共库 18 包 | ✅ 已有 |
| 跨模块引用 | CrossoverServiceFactory | Go DI + interface | Go DI + interface | ✅ 更好 |
| 多语言维护 | 无需（纯 Java） | Go/TS 两套 CI/CD | **一套 Go CI/CD** | 🔴 成本高 |
| 数据库迁移 | changelog + version.json | 仅 2 个 SQL 文件 | 统一迁移体系 | 🔴 差距大 |

### 12.3 迁移方案（借鉴 NeatLogic 架构模式）

#### 12.3.1 借鉴点 1: 统一技术栈（等同于 NeatLogic 纯 Java 策略）

**NeatLogic 做法**: 所有模块使用 Java 17，共享框架层 `neatlogic.framework.*`。

**Orion 做法**: 所有蓝图服务使用 Go 1.25，共享 `pkg/` 公共库。

**迁移策略**:
```
TS 服务 → 按 Orion 4 层架构重写为 Go
  1. 分析 TS 路由/模型/服务 (对应 NeatLogic API/DAO/Service)
  2. 创建 Go 4 层架构 (handler/service/repository/models)
  3. 注册到主服务 wiring.go 或独立微服务
  4. 验证功能对等后归档 TS
```

#### 12.3.2 借鉴点 2: -base 模块分离（NeatLogic 解决跨模块引用）

**NeatLogic 做法**: `neatlogic-xxx-base` 模块存放 DTO/常量/接口，`neatlogic-xxx` 存放实现。

**Orion 做法**: Go module 天然支持跨包引用，通过 `internal/` 限制可见性。

**迁移策略**: 新建 Go 服务时，公共 DTO 放入 `models/`，接口放入 `*-interface` 包。

#### 12.3.3 借鉴点 3: 工厂模式 + SPI 扫描（NeatLogic 21 个扩展点）

**NeatLogic 做法**: 21 个工厂类 (`NotifyHandlerFactory`, `ProcessStepHandlerFactory` 等)，Spring 自动扫描。

**Orion 做法**: `init()` 函数注册 + `sync.Map` 存储。

**迁移策略**: 新建 Go 服务中的插件/扩展点，统一使用 `sync.Map` + `init()` 注册模式。

### 12.4 迁移优先级与 NeatLogic 功能对标

| 迁移优先级 | Orion 蓝图 | NeatLogic 对标模块 | 关键功能 | 迁移难度 |
|-----------|-----------|-------------------|---------|---------|
| **P0** | orion-pipeline-svc | autoexec + deploy | 自动化执行引擎、流水线编排 | 🔴 极高 |
| **P0** | orion-monitor-svc | alert (30+ 表) | 告警管理、熔断器、ES 集成 | 🔴 高 |
| **P1** | orion-chatops-svc | — (NeatLogic 无直接对标) | 聊天运维、命令路由 | 🟡 中 |
| **P1** | orion-code-svc | codehub (25+ 表) | 代码仓库、构建管理 | 🟡 中 |
| **P1** | orion-ai-svc | neatlogic-ai | RAG 检索、Agent 执行 | 🟡 中 |
| **P1** | orion-security-svc | — (分散在各模块) | 安全扫描、供应链安全 | 🟢 低 |
| **P2** | orion-audit-svc | — (审计日志框架层) | 审计日志、合规检查 | 🟢 低 |
| **P2** | 其他 18 个小服务 | 对应模块 | CRUD 操作 | 🟢 低 |

### 12.5 验收标准（对应 NeatLogic 质量要求）

| 验收项 | 标准 | NeatLogic 参照 |
|--------|------|---------------|
| AC-01 | Go 服务覆盖 TS 全部 API 路由 | NeatLogic 每个模块 `IApiComponent` 完整注册 |
| AC-02 | 数据库迁移脚本完整 | NeatLogic changelog 日期目录 + version.json |
| AC-03 | 统一响应格式 | NeatLogic `{Status, Return, TimeCost}` 统一信封 |
| AC-04 | 多租户隔离 (RLS) | NeatLogic `@{DATA_SCHEMA}` 动态切换 |
| AC-05 | 权限中间件集成 | NeatLogic `@AuthAction` 注解 |
| AC-06 | 测试覆盖 (核心域 50%+) | NeatLogic JUnit 测试 |

### 12.6 工作分解 (WBS)

| WBS | 任务 | 依赖 | 工作量 | 并行 Agent |
|-----|------|------|--------|-----------|
| 1.1 | 5 个 Go 已覆盖 TS 归档 | 无 | 1 天 | Agent-4 |
| 1.2 | Pipeline 差距分析 + Phase 1 | 无 | 3 天 | Agent-1 |
| 1.3 | 4 个纯 TS 新建 Go 脚手架 | 无 | 1 天 | Agent-6 |
| 2.1 | Monitor TS→Go 补全 | 1.2 | 4 天 | Agent-2 |
| 2.2 | AI TS→Go 补全 | 1.2 | 3 天 | Agent-3 |
| 2.3 | Security TS→Go 补全 | 1.2 | 2 天 | Agent-5 |
| 2.4 | 12 个纯 TS 新建 Go 服务 | 1.3 | 3 天 | Agent-7 |
| 3.1 | Pipeline Phase 2+3 | 1.2, 2.1 | 3 天 | Agent-1 |
| 3.2 | 6 个小服务新建 Go | 2.4 | 1 天 | Agent-8 |
| 4.0 | 全量验证 + 归档 | 全部 | 1 天 | 全体 |

### 12.7 跟踪与度量

| 指标 | 当前值 | 目标值 | 度量方式 |
|------|-------|-------|---------|
| Go 蓝图数量 | 28 | 55 | `blueprints/*-go/` 目录计数 |
| TS 蓝图数量 | 32 | 0 | `blueprints/*-svc/` (无 `-go` 后缀) 目录计数 |
| 多语言占比 | Go 44% / TS 50% | Go 93% / Python 5% / Rust 2% | 语言文件占比 |
| 迁移完成率 | 0% | 100% | `TRACKER.md` 状态 (🟢/🟡/🔴)
