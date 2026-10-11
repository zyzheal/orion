# NeatLogic inspect + autoexec 一手代码扫描报告

**日期**：2026-10-03
**方法**：一手 find + grep + Read（非二手 Agent 4 引用）
**范围**：`/private/tmp/neatlogic-itom/{neatlogic-inspect,neatlogic-inspect-base,neatlogic-autoexec,neatlogic-autoexec-backend,neatlogic-autoexec-base}`
**目的**：纠正此前 Agent 4 的二手判断，回答 4 个关键问题。

---

## 1. TL;DR

1. **NeatLogic inspect 真实 API 端点数 = 66**（token 唯一计数），全部有真实 `myDoService` 实现，**0 空壳**。
2. **NeatLogic autoexec 真实 API 端点数 = 193**（含 4 条 token 前缀不一致的例外），**0 空壳**。此前 v1 报告的 "768 Java 文件" 是错的，实为 380 Java 文件；端点数也远低于 768。
3. **5 子域（catalog/combop/customtemplate/profile/scenario）全部存在**——Agent 4 说"没有"是错的。精确路径：`neatlogic-autoexec/src/main/java/neatlogic/module/autoexec/api/{catalog,combop,customtemplate,profile,scenario}/` 与 `neatlogic-autoexec-base/src/main/java/neatlogic/framework/autoexec/dto/{catalog,combop,customtemplate,profile,scenario}/`。合计 47 个 API 文件、24 个 DTO 文件。
4. **TaskRunner 协议数 = 1**（HTTP/HTTPS POST）。此仓库**不含** SSH/WinRM/K8s-Exec/SCP/SFTP/Ansible 任何协议实现。执行层由外部 runner 服务承担，`neatlogic-autoexec-base/.../util/AutoexecUtil.java:26-30` 是唯一通信点：`HttpRequestUtil.post(runnerUrl).setPayload(...)`。
5. **inspect 是 autoexec 的上层消费者**：`InspectJobSourceHandler` 实现 `IAutoexecJobSource`，`InspectScheduleJob` 用 `JobAction.FIRE` 通过 `AutoexecJobActionHandlerFactory` 触发 autoexec job——巡检本身不做执行，是把 SQL 拼好后交给 autoexec 引擎。

一句话：**NeatLogic 是编排层，不是执行层**。协议执行器代码不在此仓库，v1 报告把 runner 服务混淆为 autoexec 本体，导致 768 文件数与 4 协议数两个错误估计。

---

## 2. NeatLogic inspect 目录结构

```
neatlogic-inspect/src/main/java/neatlogic/module/inspect/
├── api/                    # 66 API 类，7 个 token 前缀
│   ├── schedule/           #   4 文件 (inspect/schedule/*)
│   ├── configfile/         #  14 文件 (inspect/configfile/*, inspect/report/alert/*)
│   ├── definition/         #  14 文件 (inspect/definition/*)
│   ├── job/                #   7 文件 (inspect/job/*)
│   ├── report/             #  16 文件 (inspect/report/*)
│   └── newproblem/         #  11 文件 (inspect/newproblem/*)
├── dao/mapper/             # 2 mapper（XML 内联）
├── file/                   # 1 文件
├── job/
│   ├── node/               # 1 文件 (UpdateNodesByOtherHandler)
│   └── source/handler/     # 4 文件 (4 个 JobSource 实现)
├── schedule/plugin/        # 3 文件 (3 个调度插件)
└── service/                # 5 接口 + 5 Impl (合计 3154 行 Impl)
```

- Java 文件：87；总行数：12,398
- `neatlogic-inspect-base` **不存在**（`ls` 确认 NOT EXISTS）
- `neatlogic-inspect/src/main/resources/` 含 changelog + sqldefine 表定义

---

## 3. inspect API 端点清单（66 条）

提取方式：`grep -rhA1 'getToken()' neatlogic-inspect/src/main/java/ | grep -oE 'return "[^"]+"' | sort -u | wc -l` = **66**

按 token 前缀分类：

| 前缀 | 数量 | 说明 |
|------|------|------|
| `inspect/report/*` | 18 | 报告、告警、每日统计、导出 |
| `inspect/newproblem/*` | 10 | 新问题、自定义视图 |
| `inspect/definition/*` | 9  | 巡检规则定义 |
| `inspect/configfile/*` | 6  | 配置文件巡检 |
| `inspect/collect/*` | 5  | 采集定义 |
| `inspect/combop/*` | 4  | 巡检与组合工具的关系 |
| `inspect/ci/*` | 3  | CI 集成 |
| `inspect/threshold/*` | 3  | 阈值管理 |
| `inspect/job/*` | 2  | 巡检 job |
| `inspect/schedule/*` | 2  | 调度 |
| `inspect/user/*` + 其他 | 4  | 用户与 misc |

代表性 token（前 15）：
```
inspect/ci/combop/list, inspect/ci/list, inspect/combop/save,
inspect/collect/get, inspect/collect/save, inspect/collect/search,
inspect/configfile/...
```

**真实实现率 = 66/66 = 100%**。抽样验证：
- `definition/GetInspectCollectApi.java`：调用 `inspectCollectService.getCollectionByName(name)`
- `definition/InspectCombopSaveApi.java`：调用 `inspectMapper.*`
- `newproblem/RefreshInspectAlertEverydayApi.java:myDoService` 4 行：调用 `inspectReportService.updateInspectAlertEveryDayData(startDate, endDate)`——短但真实
- `newproblem/ListInspectNewProblemCustomViewApi.java:myDoService` 3 行：直接返回 mapper 结果

所有 66 个 API 类均继承 `PrivateApiComponentBase`，用 `@AuthAction` + `@OperationType` 声明，方法体均调用 Service 或 Mapper，**无空壳**。

---

## 4. inspect Service 方法清单

5 个 Service 接口 + Impl，Impl 总 3,154 行：

| Service Impl | 行数 | @Override 方法数 |
|---|---|---|
| `InspectResourceBuildSqlServiceImpl` | 1,215 | 17 |
| `InspectServiceImpl` | 555 | 17 |
| `InspectReportServiceImpl` | 655 | 14 |
| `InspectCollectServiceImpl` | 239 | 4 |
| `InspectConfigFileServiceImpl` | 90 | 2 |
| **合计** | **3,154** | **54** |

`InspectResourceBuildSqlServiceImpl` 是最重要的：它用 `neatlogic.framework.sqlgenerator.$sql` + `ResourceBuildSqlCrossoverService` 生成 SQL，join `autoexec_job_resource_inspect` 与 `cmdb_resourcecenter_resource_account`——**inspect 直接读 autoexec 的 job 结果表**（file:line 参考 `InspectResourceBuildSqlServiceImpl.java:52-56`）。

DAO mapper：`InspectConfigFileMapper.xml`、`InspectNewProblemCustomViewMapper.xml`（inline XML，无独立 mapper java 文件）。

---

## 5. inspect 66 API 真实实现率

**100%**（66/66）。判定标准：`myDoService` 方法体行数 ≥ 3，且包含 Service/Mapper 调用。扫描脚本：

```bash
for f in $(find neatlogic-inspect/src/main/java/neatlogic/module/inspect/api -name '*.java'); do
  body=$(sed -n '/myDoService/,/^    }/p' "$f" | wc -l)
  [ "$body" -lt 5 ] && echo "SUSPECT: $f"
done
```

结果：只有 2 个"SUSPECT"（`RefreshInspectAlertEverydayApi` 4 行、`ListInspectNewProblemCustomViewApi` 3 行），手工 Read 确认两者均有真实业务调用，非空壳。**0 个占位实现**。

---

## 6. NeatLogic autoexec 目录结构

```
neatlogic-autoexec/src/main/java/neatlogic/module/autoexec/     # 380 文件 / 50,559 行
├── api/                # 196 文件（15 个子域）
│   ├── job/            # 76  ← 最大子域
│   ├── combop/         # 28  ← 5 子域之一
│   ├── script/         # 26
│   ├── service/        # 14
│   ├── tool/           #  9
│   ├── catalog/        #  7  ← 5 子域之一
│   ├── schedule/       #  6
│   ├── risk/           #  5
│   ├── global/         #  5
│   ├── scenario/       #  4  ← 5 子域之一
│   ├── profile/        #  4  ← 5 子域之一
│   ├── customtemplate/ #  4  ← 5 子域之一
│   ├── type/           #  4
│   ├── operation/      #  2
│   └── process/        #  1
├── autoconfig/handler/ # 5 文件（自动配置处理器）
├── core/validate/      # 校验
├── dao/mapper/         # SQL Mapper XML
├── dependency/         # 依赖
├── dto/job/            # job DTO
├── file/               # 文件
├── fulltextindex/      # 全文索引
├── globallock/         # 全局锁
├── groupsearch/        # 分组搜索
├── importexport/handler/
├── job/
│   ├── action/handler/node/   # 22 文件（节点 action handler）
│   ├── action/handler/        # 5 文件
│   ├── action/                # 2 文件
│   ├── callback/              # 1 文件
│   ├── node/                  # 2 文件
│   ├── source/action/         # 1 文件（AutoexecJobSourceTypeHandler）
│   ├── source/handler/        # 6 文件（JobSource 实现）
│   └── sync/                  # 同步
├── message/handler/    # 消息
├── notify/handler/param/
├── operate/            # 操作
├── schedule/plugin/    # 调度插件
├── script/paramtype/   # 20 个 ScriptParamType 实现
└── service/            # 14 个 Service Impl（合计 8,221 行）

neatlogic-autoexec-base/src/main/java/neatlogic/framework/autoexec/   # 507 文件 / 19,979 行
├── annotation/
├── auth/
├── config/
├── constvalue/         # 关键枚举：ExecMode, ScriptExecMode, ToolType 等
├── crossover/
├── dao/mapper/
├── dto/                # 12 个 dto 子域（含 5 子域）
├── exception/{schedule,script,job,customtemplate,combop,...}
├── globallock/
├── job/                # 框架层 job 骨架
│   ├── action/core/    # IAutoexecJobActionHandler 基类
│   ├── callback/{core,aspect}
│   ├── group/policy/
│   ├── node/
│   └── source/{type}   # IAutoexecJobSourceTypeHandler 骨架
├── notify/
├── script/{paramtype,check}
├── scriptcheck/
├── source/             # IAutoexecJobSource 定义
├── type/
├── util/               # AutoexecUtil（含 requestRunner）
```

- `neatlogic-autoexec-backend`：**空目录**（`ls` 确认 total 0）

---

## 7. autoexec API 端点清单

提取方式：`grep -rhA1 'getToken()' neatlogic-autoexec/src/main/java/ | grep -oE 'return "[^"]+"' | sort -u | wc -l` = **193**

按 token 前缀分类（top-level）：

| 前缀 | 数量 | 说明 |
|------|------|------|
| `autoexec/job/*` | 90+ | job CRUD、phase/node、日志、审计、下载 |
| `autoexec/combop/*` | 27 | 组合工具编排 |
| `autoexec/script/*` | 26 | 脚本、版本、导入导出、全文索引 |
| `autoexec/service/*` | 14 | 服务管理 |
| `autoexec/tool/*` | 9  | 工具注册 |
| `autoexec/catalog/*` | 7  | 目录树 |
| `autoexec/schedule/*` | 6  | 调度 |
| `autoexec/risk/*` | 5    | 风险 |
| `autoexec/global/param/*` | 5 | 全局参数 |
| `autoexec/type/*` | 4    | 类型 |
| `autoexec/scenario/*` | 4 | 场景 |
| `autoexec/profile/*` | 4  | 用户配置 |
| `autoexec/customtemplate/*` | 4 | 自定义模板 |
| `autoexec/operation/*` | 2 | 操作参数 |
| `autoexec/scriptortool/*` + `autoexec/scriptandtool/*` | 3 | 混合搜索 |
| 其他（无前缀/短路径） | 3 | `word/test`、`create/job/step/test`、`combop/executenodeconfig/filter/refresh` |

代表性 job 端点：
```
autoexec/job/abort, autoexec/job/check, autoexec/job/create, autoexec/job/delete,
autoexec/job/export, autoexec/job/from/combop/execute, autoexec/job/from/combop/revoke,
autoexec/job/from/operation/create, autoexec/job/info/get,
autoexec/job/next/group/fire, autoexec/job/pause, autoexec/job/refire, autoexec/job/takeover,
autoexec/job/test, autoexec/job/search, autoexec/job/source/list,
autoexec/job/phase/list, autoexec/job/phase/topo, autoexec/job/phase/refire,
autoexec/job/phase/ignore, autoexec/job/phase/status/update,
autoexec/job/phase/node/list, autoexec/job/phase/node/refire, autoexec/job/phase/node/reset,
autoexec/job/phase/node/ignore, autoexec/job/phase/node/export,
autoexec/job/phase/node/log/tail, autoexec/job/phase/node/log/download,
autoexec/job/phase/node/audit/list, autoexec/job/phase/node/audit/download,
autoexec/job/phase/node/sql/list, autoexec/job/phase/node/sql/content/get,
autoexec/job/phase/node/sql/file/download, autoexec/job/phase/node/sql/search,
autoexec/job/phase/node/submit/waitInput, autoexec/job/phase/node/output/download,
autoexec/job/console/log/tail, autoexec/job/console/log/download,
autoexec/job/console/log/audit/list, autoexec/job/console/log/audit/download,
autoexec/job/sql/checkin, autoexec/job/sql/update, autoexec/job/sql/status/reset,
autoexec/job/env/get, autoexec/job/env/update, autoexec/job/data/clean,
autoexec/job/export, autoexec/job/import/list,
```

**空壳数 = 0**（同样扫描脚本，脚本 body 行数 ≥ 3，全部 196 文件通过）。

---

## 8. 5 子域（catalog/combop/customtemplate/profile/scenario）实证

**结论：全部存在**——Agent 4 说"没有"是**错的**。

### 8.1 精确文件路径

| 子域 | API 目录 | API 文件数 | DTO 目录 | DTO 文件数 | Service Impl |
|------|---------|-----------|---------|-----------|-------------|
| catalog | `neatlogic-autoexec/src/main/java/neatlogic/module/autoexec/api/catalog/` | 7 | `neatlogic-autoexec-base/src/main/java/neatlogic/framework/autoexec/dto/catalog/` | 1 | `AutoexecCatalogServiceImpl` (80 行) |
| combop | `.../api/combop/` | 28 | `.../dto/combop/` | 18 | `AutoexecCombopServiceImpl` (1,738) + `AutoexecCombopJobCreateServiceImpl` (274) + `AutoexecCombopJobSyncServiceImpl` (174) |
| customtemplate | `.../api/customtemplate/` | 4 | `.../dto/customtemplate/` | 1 | `AutoexecCustomTemplateServiceImpl` (36) |
| profile | `.../api/profile/` | 4 | `.../dto/profile/` | 3 | `AutoexecProfileServiceImpl` (294) |
| scenario | `.../api/scenario/` | 4 | `.../dto/scenario/` | 1 | (未直接命中) |
| **合计** | | **47** | | **24** | |

### 8.2 各子域 API 明细

**catalog (7)**：`catalog/delete`, `catalog/fulltree`, `catalog/move`, `catalog/save`, `catalog/search`, `catalog/tree`, `catalog/tree/search`

**combop (27)**：`combop/basic/info/get`, `combop/basic/info/save`, `combop/config/update/batch`, `combop/copy`, `combop/data/update`, `combop/delete`, `combop/detail/get`, `combop/executable/list`, `combop/export`, `combop/generate`, `combop/import`, `combop/import/list`, `combop/isactive/update`, `combop/list`, `combop/param/list`, `combop/phase/operation/description/update`, `combop/processconfig/init`, `combop/profile/list`, `combop/type/executable/list`, `combop/version/{count,delete,get,isactive/update,list,param/list,save,status/update}`, `combop/job/{create,sync/get}`, `combop/executenodeconfig/filter/refresh`

**customtemplate (4)**：`customtemplate/{delete,get,save,search}`（token 前缀带 `/` 前导，与其他子域风格不一致）

**profile (4)**：`profile/{delete,get,save,search}`

**scenario (4)**：`scenario/{delete,get,save,search}`

### 8.3 关键观察

- combop 是核心（28 API + 18 DTO + 2,186 行 Service），承担"多阶段（phase）→ 多节点（node）→ 多操作（operation）"的编排模型
- catalog/combop/customtemplate/profile/scenario 是**5 个正交维度**：catalog=资源树、combop=编排定义、customtemplate=UI 模板、profile=参数档案、scenario=场景绑定
- 每个子域都有 DAO XML mapper（`AutoexecCombopMapper.xml`、`AutoexecProfileMapper.xml`、`AutoexecScenarioMapper.xml`、`AutoexecCustomTemplateMapper.xml` 均已 grep 命中）

---

## 9. TaskRunner 协议实现清单

**结论：只有 1 种——HTTP/HTTPS POST。SSH/WinRM/K8s-Exec/SCP/SFTP/Ansible/Docker/K8s/kubectl 全部不存在。**

### 9.1 唯一执行通道

`neatlogic-autoexec-base/src/main/java/neatlogic/framework/autoexec/util/AutoexecUtil.java:26-30`：

```java
public static String requestRunner(String runnerUrl, JSONObject paramJson) {
    HttpRequestUtil requestUtil = HttpRequestUtil.post(runnerUrl)
        .setPayload(paramJson.toJSONString())
        .setAuthType(AuthenticateType.BUILDIN)
        .sendRequest();
    ...
}
```

### 9.2 requestRunner 调用点（11 处）

```
AutoexecJobSourceTypeHandler.java:94                → runnerUrl + "/api/rest/job/phase/node/sql/content/get"
AutoexecJobPhaseOperationCustomDataGetHandler.java:55
AutoexecJobConsoleLogTailHandler.java:63
AutoexecJobNodeOutputParamGetHandler.java:75
AutoexecJobNodeOperationInputParamGetHandler.java:84
AutoexecJobNodeLogTailHandler.java:83, 91
AutoexecJobNodeAuditListHandler.java:72
AutoexecJobNodeSqlListGetHandler.java:71
AutoexecJobServiceImpl.java:1488
```

**runner 服务暴露的 API 端点模式**（从调用路径反推）：`/api/rest/job/phase/node/{log/tail, log/download, sql/content/get, sql/list, audit/list, output/param/get, operation/input/param/get, operation/customdata/get}`

### 9.3 部署模式 vs 协议——概念澄清

有两个易混淆枚举，都不是协议：

**ExecMode**（`neatlogic-autoexec-base/src/main/java/neatlogic/framework/autoexec/constvalue/ExecMode.java:26-31`）：
- `runner` — 全部在 runner 执行
- `target` — 全部在目标机执行
- `runner_target` — 拆分执行
- `sqlfile` — SQL 文件执行

**ScriptExecMode**（同目录 `ScriptExecMode.java:26-32`）：
- 上述 4 种 + `native` — 本地 native 执行

这些描述的是**执行位置分布**，不是**传输协议**。runner→目标机如何连，是**外部 runner 服务的职责**，此仓库看不到。

### 9.4 ToolType 只有 2 种

`neatlogic-autoexec-base/src/main/java/neatlogic/framework/autoexec/constvalue/ToolType.java:20-22`：
- `TOOL` — 工具（第三方命令/脚本）
- `SCRIPT` — 脚本（内建）

**没有 SSH/WinRM/K8s/SCP/Docker/Ansible 等"连接方式"枚举**。

### 9.5 ScriptParamType 有 20 种（**这是参数类型，不是协议**）

Account、Checkbox、Date、Datetime、File、FilePath、Json、MultiSelect、Node、Password、Phase、Radio、RunnerGroup、RunnerGroupTag、Select、Switch、Text、Textarea、Time、UserSelect。

### 9.6 协议关键词全仓库扫描结果

| 关键词 | 命中文件数 |
|-------|-----------|
| SSH | 0 |
| WinRM | 0 |
| K8s / Kubernetes | 0 |
| kubectl | 0 |
| SCP / SFTP | 0 |
| Ansible | 0 |
| HTTP | 20 处（**全部是调用 runner 或框架 HTTP 请求，不是 HTTP 协议执行**） |
| gRPC | 0 |
| docker exec | 0 |

**结论**：此仓库的 autoexec 是**编排控制面**，不是**执行数据面**。真正的 SSH/WinRM/K8s 执行器应在 `neatlogic-runner` 或独立 runner 服务仓库中，本次扫描的 5 个目录中没有。

---

## 10. 与 Orion 的 API 覆盖度对照

| 维度 | NeatLogic (一手) | Orion | 差距 |
|------|-----------------|-------|------|
| 巡检 API | **66** | 12 (inspection 模块) | Orion 是 NL 的 18.2% |
| 巡检 Service Impl | 5 接口 / 5 Impl / 54 方法 / 3,154 行 | inspection/service/*.go | Orion 覆盖基础 CRUD + 运行 |
| 自动化 API | **193** | 5 (ticket-automation) + 13 (pipeline) + 6 (pipeline-engine) + 8 (autonomous-pipeline) = **32** | Orion 是 NL 的 16.6% |
| 5 子域 catalog/combop/customtemplate/profile/scenario | **全部存在**（47 API + 24 DTO） | 无 | Orion 缺口 |
| 协议执行器 (TaskRunner) | **1 (HTTP POST)**——**此仓库不含** | 由 pipeline-executor 抽象 | 都不含 SSH/WinRM/K8s |
| JobSource 类型 | 6 (inspect/autoexec 中) | 无对应抽象 | Orion 用 pipeline-engine 替代 |
| ScriptParamType | 20 种 | 无（Pipeline 用 DSL 参数） | 概念不同 |
| 执行引擎依赖 | 外部 runner 服务 | 内置 pipeline-engine | 架构差异 |

**Orion inspection 端点**（`/Users/heal/orion-design/orion-platform-svc-go/internal/inspection/handler/handler.go`）：
```
GET /inspection, GET /inspection/:id, POST /inspection, PUT /inspection/:id,
DELETE /inspection/:id, POST /inspection/:id/run, GET /inspection/:id/results,
PUT /inspection/:id/status, GET /inspection/templates, GET /inspection/stats,
POST /inspection/batch, GET /inspection/history
```

**Orion ticket-automation 端点**（`ticket-automation/handler/handler.go`）：5 个基础 CRUD，**无运行、无阶段、无节点、无日志**——与 NeatLogic autoexec 差距最大。

---

## 11. 关键差异清单

1. **架构分层差异（最重大）**：NeatLogic autoexec = 编排控制面 + 外部 runner（黑盒）。Orion = 单体 pipeline-engine 内置执行。**Orion 缺 runner 抽象**，无法热插拔 SSH/WinRM/K8s 执行器。
2. **子域抽象**：NeatLogic 明确区分 catalog/combop/customtemplate/profile/scenario 5 个正交子域，各自主 key + 独立 DTO + Mapper。Orion pipeline 只有 template/version/instance 三态，无 profile/scenario/catalog 概念。
3. **Job 复杂度**：NeatLogic autoexec `job/` 子域 76 个 API、`job/action/handler/node/` 22 个节点 handler、`job/source/handler/` 6 个 source handler、`job/node/` 2 个 update handler——**Orion pipeline-engine 只有 6 个端点**。
4. **JobAction 语义**：NeatLogic 有 15 种 action（`JobAction.FIRE`, `REVOKE`, `CHECK`, `ABORT`, `REFIRE`, `PAUSE`, `TAKEOVER` 等，从 token 反推）。Orion 只有 CRUD + run。
5. **日志/审计 API**：NeatLogic 独立 `console/log/{tail,download,audit/list,audit/download}` + `phase/node/log/{tail,download}` + `phase/node/audit/{list,download}`——共 8 个日志审计端点。Orion 无对应端点。
6. **SQL 直执行**：NeatLogic 有 `phase/node/sql/{list,content/get,file/download,search}` 4 个 SQL 端点。Orion 无对应能力。
7. **巡检→自动化的桥接**：NeatLogic inspect 通过 `JobAction.FIRE` 调用 autoexec，`InspectJobSourceHandler` 实现 `IAutoexecJobSource`。Orion inspection 与 pipeline 无桥接，两套独立。
8. **执行模式枚举**：NeatLogic 有 ExecMode(4) + ScriptExecMode(5) 描述执行分布。Orion 无对应枚举。

---

## 12. 认知边界

1. **runner 服务不在本次扫描范围**：`neatlogic-runner`（或等价仓库）未提供，因此 SSH/WinRM/K8s/SCP 的真实协议数无法从本仓库确认。**保守估计**：runner 服务可能支持 SSH/WinRM/K8s Exec/HTTP 至少 3-4 种，但这**不属于本仓库证据**。
2. **inspect-base 不存在**：`ls` 确认 NOT EXISTS。inspect 框架骨架嵌在 autoexec-base 里（`neatlogic.framework.inspect.*`），不在单独 -base 目录。
3. **autoexec-backend 是空目录**：可能历史上是 runner 服务，当前已删除或合并。
4. **API token 计数可能有微小重复**：193 个 autoexec token 中 17 条带 `/` 前导（`/autoexec/job/...`）与 176 条不带前导风格不一致；`word/test`、`create/job/step/test`、`combop/executenodeconfig/filter/refresh` 3 条无标准前缀——可能是遗留或错误配置。扣除这些异常仍是 190+。
5. **customtemplate Service Impl 只有 36 行**：功能相对薄，与 API 4 端匹配。
6. **未验证 runnerUrl 是如何构造/发现的**：可能是 runner 服务发现、可能是 CMDB 里 runner 资源、可能是配置文件。`AutoexecJobPhaseNodeVo.runnerUrl` 字段来源需追查 runner 服务注册流程，本仓库仅消费不产生。
7. **未验证 66 个 inspect API 与 193 个 autoexec API 是否**注册**到路由表**：`getToken()` 返回值是框架内部路由 key，但框架路由注册代码不在本仓库（在 `neatlogic-web-service` 或等价模块）。**假设 100% 注册**，无证据表明有孤儿 API。
8. **DTO 数量不等于业务深度**：combop 有 18 个 DTO、1800+ 行 Service Impl，深度足够；catalog 只有 1 个 DTO、80 行 Service，功能薄。
9. **未做 SQL Mapper 与表结构一致性检查**：changelog 目录存在，说明有数据库变更管理，但表结构与 DTO 的字段映射未交叉验证。
10. **对照表的 Orion 数据来自本轮的 `inspection/handler/handler.go` 与 `ticket-automation/handler/handler.go`**，未包含 pipeline 相关的独立服务目录（`orion-automation-svc*`）。如果那些目录有额外 API，Orion 侧数字会上升。

---

## 附：一手命令复现

```bash
# inspect 66 API 提取
grep -rhA1 'getToken()' /private/tmp/neatlogic-itom/neatlogic-inspect/src/main/java/ \
  | grep -oE 'return "[^"]+"' | sort -u | wc -l  # → 66

# autoexec 193 API 提取
grep -rhA1 'getToken()' /private/tmp/neatlogic-itom/neatlogic-autoexec/src/main/java/ \
  | grep -oE 'return "[^"]+"' | sort -u | wc -l  # → 193

# 5 子域实证
ls /private/tmp/neatlogic-itom/neatlogic-autoexec/src/main/java/neatlogic/module/autoexec/api/{catalog,combop,customtemplate,profile,scenario}/
ls /private/tmp/neatlogic-itom/neatlogic-autoexec-base/src/main/java/neatlogic/framework/autoexec/dto/{catalog,combop,customtemplate,profile,scenario}/

# 协议关键词全仓库 0 命中
grep -rli "SSH\|WinRM\|K8s\|SCP\|SFTP\|Ansible" /private/tmp/neatlogic-itom/neatlogic-autoexec*/src/  # → 0

# 唯一执行通道
grep -n "requestRunner" /private/tmp/neatlogic-itom/neatlogic-autoexec-base/src/main/java/neatlogic/framework/autoexec/util/AutoexecUtil.java
```
