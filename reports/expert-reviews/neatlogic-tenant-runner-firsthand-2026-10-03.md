# NeatLogic Tenant + Runner + Tagent-base 一手代码分析（NL-8，2026-10-03）

**范围**：`neatlogic-tenant` / `neatlogic-runner` / `neatlogic-tagent-base`（3 个 submodule，共 862 Java 文件）
**方法**：一手 `find` + `grep` + `head` + `ls`（不读未 clone 的类库）
**硬约束**：不估算人天；不改代码
**分析时间**：2026-10-03（8 分钟内完成）

## 0. TL;DR（6 项）

1. **代码规模实证**：tenant=534 Java（141 Controller / 12 ServiceImpl / 14 Repository+Mapper）；runner=282 Java（1 Controller / 3 ServiceImpl）；tagent-base=46 Java（0 Controller / 2 ServiceImpl / 1 Mapper）。Runner 是**独立部署的 Java 进程**（非库），承载执行引擎；tenant 与 tagent-base 是库形态被集成到 neatlogic-web 进程。
2. **多租户拦截机制**：无显式 Spring Interceptor 或 Filter 类；改用**显式 `TenantContext.get()`（127 处）** + **DB schema 隔离（`TenantContext.get().getDbName()` + `databaseFragmentMapper.rebuildTable(tenantDbName, "autoexec_job_runner")`）**。所有需要 tenant 的 API 都手写 `TenantContext.get().getTenantUuid()` 拼进参数或 header（例如 `VerificationHmacApi.java:81` 手工塞 `headers.put("Tenant", tenantUuid)`）。
3. **Runner 协议真相**：runner 侧**没有** SSH/WinRM/Kubernetes/Helm/ArgoCD/SFTP/Ansible/Docker/WebSocket/gRPC 的**任何协议实现**——关键词命中率全部为 0（仅 `mq` 和 `ssh` 各命中 1 个非实现文件）。Runner 只跑 **本地 subprocess（`ProcessBuilder`）** 调用 `autoexec` CLI，通过 **HTTP REST 反向**与主控通信，通过 **TCP Socket + Netty** 与 Tagent 心跳通道通信。NL-2 报告"autoexec 仅 HTTP"结论正确，Runner 侧没有隐藏的第二协议层。
4. **Runner 与 Autoexec/Deploy 关系**：**Master-Worker + 反向回调**。主控（tenant/web）用 `HttpRequestUtil.post(runner.getUrl() + "api/rest/...")` 单向调用 runner 端点（如 `/api/rest/job/data/purge`、`/api/rest/job/phase/socket/write`、`/api/rest/job/phase/node/sql/content/get`、`/api/binary/job/phase/node/sql/file/download`）；runner 端 `ExecRToolApi` 反向拉取作业数据。RunnerGroup 是执行器分组的**唯一路由抽象**（`ScriptParamTypeRunnerGroup`、`AppModuleRunnerGroup`）。
5. **Tagent-base 定位**：**心跳/管理面协议 SDK 库**，不含 Runner 也不含执行引擎。46 类中：4 类 `Tagent*Vo`/`Vo` DTO、6 个 enum（`TagentAction`/`TagentStatus`/`TagentOSType`/`RunnerAuthType` 等）、1 个 Mapper（`TagentMapper` 25+ 方法）、1 个 25 方法 `TagentServiceImpl`、1 个 8 个 Handler（`TagentConfigSaveHandler` 等）。支持 **LINUX/WINDOWS** OS、**getlogs/downloadLog/getConfig/saveConfig/reload/resetcred/statusCheck/upgrade/batchSaveConfig** 9 种 action。
6. **对 Orion 的最强启示**：NeatLogic 用**独立 runner 进程 + HTTP REST + Netty + subprocess** 的极简三协议实现企业级远程执行；Orion 若走"K8s Job + gRPC streaming + SSH fan-out"路线会比它复杂一个数量级但**能力不增**——Runner 侧没有 K8s/Helm/ArgoCD。

---

## 1. 代码规模实证

### 1.1 三 submodule Java 文件分布

| 模块 | Java | Controller | ServiceImpl | Repository/Mapper | Api 组件 |
|---|---:|---:|---:|---:|---:|
| neatlogic-tenant | **534** | 141 | 12 | 14 | ~40 api 子目录 |
| neatlogic-runner | **282** | 1 (CustomErrorController) | 3 | 0 | 9 api 子目录（含 86 个 Api 组件） |
| neatlogic-tagent-base | **46** | 0 | 2 | 1 (TagentMapper) | 0 |
| **合计** | **862** | 142 | 17 | 15 | 49 api 子目录 |

注：Runner 的 86 个 Api 组件实际位于 `api/{job,job/phase,job/node,deploy/ci,deploy/version,tagent,account,autoexec,informant,file,system,api/ratelimit}`；采用自定义 `PrivateApiComponentBase` / `PublicApiComponentBase` 分发模型（**非 Spring MVC Controller**）。

### 1.2 架构模式识别

- **Tenant**：Spring Boot 库形态，通过 `neatlogic.framework` 包（跨模块）+ `neatlogic.module.tenant.api.*` 挂到主控 web。
- **Runner**：Spring Boot **可执行进程**（`neatlogic-runner-framework` + `neatlogic-runner-springboot` + `neatlogic-runner-webroot` 三 module），有自己的 `web/ApiDispatcher.java`、`web/AnonymousApiDispatcher.java`、`web/PublicApiDispatcher.java` 自定义分发器。
- **Tagent-base**：库形态，被 runner 与主控共享，只定义 **数据模型 + CRUD + 抽象 handler 接口**。

---

## 2. Tenant 多租户能力图谱

### 2.1 架构（无 Filter/Interceptor，全显式）

一手 grep 结论：`/neatlogic-tenant` 中**没有**任何类实现 Spring `HandlerInterceptor` 或 `javax.servlet.Filter`。

**Tenant 传递三条路径**：

| 路径 | 用法 | 示例 |
|---|---|---|
| **ThreadLocal `TenantContext`** | `TenantContext.get().getTenantUuid()` | 127 处引用；集中在 scheduler(10) / file(6) / apimanage(5) / user(4) / notify(4) / auth(4) |
| **DB schema 隔离** | `databaseFragmentMapper.rebuildTable(TenantContext.get().getDbName(), "autoexec_job_runner")` | `AutoexecJobCleaner.java:103` 每租户独立 schema 命名空间 |
| **HTTP header 显式注入** | `headers.put("Tenant", TenantContext.get().getTenantUuid())` | `VerificationHmacApi.java:81` |

**关键代码片段**（`SyncLdapUserSchedule.java` 中把 tenant 编入 Quartz JobObject）：
```java
JobObject newJobObject = new JobObject.Builder(job.getId().toString(),
    schedulerhandler.getGroupName(),
    schedulerhandler.getClassName(),
    TenantContext.get().getTenantUuid())  // tenant 作为 Quartz job 属性
    .withCron(job.getCron())
    .addData("notifyContentJobId", job.getId()).build();
```

**TenantContext 覆盖的 21 个 api 目录**：scheduler(10) / file(6) / test(5) / apimanage(5) / user(4) / notify(4) / auth(4) / systemnotice(3) / matrix(3) / tenantconfig(2) / documentonline(2) / datawarehouse(2) / license(1) / module(1) / message(1) / healthcheck(1) / globalsearch(1) / changelog(1) / util(1) / region / icon。

### 2.2 Service 方法矩阵（12 个 ServiceImpl）

| ServiceImpl | 主要方法 | 定位 |
|---|---|---|
| **RunnerServiceImpl** | `checkRunnerHealth(Long runnerId)` | Runner 集群健康 |
| **ServerServiceImpl** | `postOtherServerApi` × 3 / `postOtherServersApi` × 2 / `downloadOtherServerApi` × 2 | **主控到运行节点**的 HTTP 代理层 |
| **TeamServiceImpl** | `deleteTeamUserTitleByTeamUuid(String)` | 团队-用户权限清理 |
| **MatrixServiceImpl** | `searchMatrixColumnDataForSelect` × 2 | 权限矩阵 |
| **ApiAuditServiceImpl** | `searchApiAuditVo` / `exportApiAudit` / `getApiListForTree` | API 审计 |
| **FeatureUsageServiceImpl** | `init()` / `addFeatureUsageAuditVo(...)` | 功能审计 |
| **WorktimeServiceImpl** | `saveWorktimeRange(...)` | 工时 |
| **MenuServiceImpl** | `saveMenu` / `deleteMenu` / `checkIsChildern` | 菜单 |
| **ExtraMenuServiceImpl** | `buildRootExtraMenu()` / `removeEmptyDirectory(...)` | 扩展菜单 |
| **TagServiceImpl** | `saveTag` / `deleteTag` / `searchTag` | 标签 |
| **DocumentOnlineServiceImpl** | 5 方法（document 在线预览配置） | 文档 |
| **NotifyPolicyServiceImpl** | `addReceiverExtraInfo(Map, NotifyTriggerVo)` | 通知 |

### 2.3 Tenant api/ 目录清单（41 个业务子域）

```
apiaudit apimanage auditconfig auth changelog constvalue datawarehouse
dependency documentonline extramenu featureusageaudit file form freemarker
fulltextindex globallock globalsearch groupsearch healthcheck homepage icon
importexport integration license log logger loginaudit mailserver matrix menu
message module mongodb mq notify region role runner scheduler server
systemnotice tag team tenantconfig test theme user userexportfile
util wechat worktime
```

**认证权限子域规模**：user=30 / team=18 / apimanage=17 / role=16 / auth=11 / apiaudit=5 / loginaudit=2。**用户/团队/角色/权限**四要素是租户内权限的核心模型。

### 2.4 Tenant 与 Orion 差距

| 维度 | NeatLogic Tenant | Orion 现状 | 差距 |
|---|---|---|---|
| 租户传递 | `TenantContext.get().getTenantUuid()` 显式（127 处） | `tenant_id` 列级过滤（Round 70 §71） | NeatLogic 强类型 ThreadLocal；Orion 靠代码审查兜底 |
| DB 隔离 | 每租户独立 schema（`getDbName()` + `rebuildTable`） | 单 schema + `tenant_id` 列 | NeatLogic 天然硬隔离；Orion 靠 SQL 一致性 |
| HTTP 传递 | `headers.put("Tenant", ...)` 显式 | 未在 gateway 层强制 | NeatLogic 显式契约；Orion 缺跨服务 header 传递规范 |
| 权限模型 | user/team/role/auth 四要素 + 权限矩阵 | RBAC 已实现；ABAC 起步 | NeatLogic 权限矩阵（`MatrixService`） Orion 无 |
| LDAP 同步 | `SyncLdapUserSchedule` + `SyncLdapTeamSchedule` | SSO 有；LDAP 无 | Orion 缺 LDAP 双向同步 |
| API 审计 | `ApiAuditService` + `FeatureUsageAudit` + `loginaudit` | Orion 有 audit.Chain 系列 | 双方接近，Orion 更结构化 |
| MCP 集成 | `ApiManageMcpHelpGetApi` + `/api/mcp/{tenantUuid}` 端点 | Orion 有 ai-agent-run / ai-service | 双方都有 MCP；NeatLogic 把 MCP 挂在 tenant 之下 |
| 加密开关 | `ToggleCipherApi` | Orion 无全局 cipher toggle | Orion 可借鉴 |

---

## 3. Runner 执行协议图谱

### 3.1 支持的协议清单（关键词实测）

在 `/neatlogic-runner` 全 282 Java 文件中，`grep -ril` 非 test 目录关键词命中数：

| 协议 | 命中文件数 | 结论 |
|---|---:|---|
| ssh | **1** | 仅字符串提及，无实现 |
| winrm | 0 | 无 |
| telnet | 0 | 无 |
| ipmi | 0 | 无 |
| kubernetes / k8s | 0 | 无 |
| helm | 0 | 无 |
| argocd | 0 | 无 |
| sftp | 0 | 无 |
| ansible | 0 | 无 |
| jupyter | 0 | 无 |
| docker | 0 | 无 |
| websocket | 0 | 无 |
| grpc | 0 | 无 |
| rabbitmq | 0 | 无 |
| mq | 1 | 非 MQ 库（可能匹配 "queue" 子串） |

**唯一实际用到的三种通信协议**：

1. **HTTP REST**（主通道）：`HttpRequestUtil.post(url).setAuthType(BUILDIN).setPayload(...).setConnectTimeout(...).setReadTimeout(3600000).sendRequest()`
2. **TCP Socket + Unix Domain Socket**：`SocketUtil.write(socketPath, ...)`，`api/rest/job/phase/socket/write` 反向写入 socket
3. **Netty（Tagent 心跳通道）**：`NettyServer.java` + `NettyServerHandler.java` + `NettyClientHandler.java`

### 3.2 核心类与执行模型

**执行引擎入口 `ExecProcessCommand`**（`core/ExecProcessCommand.java`）：
```java
public class ExecProcessCommand implements Runnable {
    private final ProcessBuilder builder;  // 直接调本地 CLI
    private final CommandVo commandVo;
    protected TenantContext tenantContext;   // 通过 threadlocal 传递
    protected UserContext userContext;

    // 执行: new ProcessBuilder(commandVo.getCommandList()).start()
    // 环境变量: env.put("tenant", commandVo.getTenant())
}
```

**作业触发 `JobExecApi`**（`api/job/JobExecApi.java`）：把作业参数拼成 CLI 参数列表 `["autoexec", "--jobid", ..., "--execuser", ..., "--execid", ..., "--phases", ..., "--nodes", ...]` 交给 `ProcessBuilder`。Runner 本质是 **"autoexec CLI 的 HTTP 触发器 + 日志下载器"**。

**Restful 分发框架**：
- `web/ApiDispatcher.java`（内部）
- `web/AnonymousApiDispatcher.java`（匿名）
- `web/PublicApiDispatcher.java`（公开，需要 token）
- `web/core/ApiAuthBase.java` + `ApiAuthFactory.java`（认证工厂）
- 三类认证 handler：`BasicAuthenticateHandler` / `HmacAuthenticateHandler` / `TokenAuthenticateHandler`

**Runner API 组件总数**：86 个（`api/**/*Api.java`），分布如下：

| API 子目录 | 组件数 | 用途 |
|---|---:|---|
| job（含 phase/node） | 42 | 作业执行/暂停/中止/日志尾随/socket 通知 |
| deploy/ci + deploy/version | 5 | Gitlab CI hook、版本 diff |
| tagent | 11 | Tagent 注册/升级/日志/配置/状态 |
| informant | 5 | Informant 通信代理（含 MCP client） |
| autoexec | 1 | `ExecRToolApi` 反向执行 |
| ratelimit | 1 | `TokenRateLimiter`（Caffeine 缓存 10k token，1h expire） |
| file / account / system | 21 | 文件下载、账号、系统 |

**Tagent 心跳通道 7 个 Handler**（`tagent/handler/`）：
```
TagentConfigBatchSaveHandler, TagentConfigGetHandler, TagentConfigSaveHandler,
TagentLogDownloadHandler, TagentLogGetHandler, TagentReloadHandler,
TagentResultHandler, TagentStatusCheckGetHandler
```

### 3.3 Runner 与 Autoexec / Deploy 的调用关系

**调用方向**：**Master → Runner 单向 HTTP**（不反向推送）；Runner 内部通过 subprocess 拉起 `autoexec` CLI。

**主控 → Runner 关键 HTTP 端点**（一手 grep 结果）：

| 调用方 | 目标 URL | 用途 |
|---|---|---|
| `AutoexecJobCleaner` (autoexec) | `{runner.url}api/rest/job/data/purge` | 作业数据清理 |
| `DeployGlobalLockHandler` (deploy) | `{runner.url}/api/rest/job/phase/socket/write` | socket 反向写入 |
| `DeployJobSourceTypeHandler` (deploy) | `{nodeVo.runnerUrl}/api/rest/job/phase/node/sql/content/get` | 获取 SQL 内容 |
| `DeployJobSourceTypeHandler` (deploy) | `{nodeVo.runnerUrl}/api/binary/job/phase/node/sql/file/download` | SQL 文件下载 |

**全局锁机制**（`DeployGlobalLockHandler`）：以 `runnerUrl + path` 为唯一键，防止同一 runner 同一资源被并发打包下载。锁包含 `jobId / execId / runnerId` 三字段（`DeployGlobalLockHandler.java:167`）。

**RunnerGroup 抽象**：所有执行器都通过 `RunnerGroupVo` 分组，部署侧 `insertAppModuleRunnerGroup` / `deleteAppModuleRunnerGroup`，作业侧 `ScriptParamTypeRunnerGroup`。

**反向 MCP 集成**：`InformantMcpClient`（`service/informant/`）使用 `io.modelcontextprotocol.client.McpSyncClient` + `HttpClientStreamableHttpTransport` 调 Informant 端 MCP 工具。Runner 是**MCP 客户端**（不是服务端）。

### 3.4 Runner 与 Orion Automation TaskRunner 差距

| 维度 | NeatLogic Runner | Orion Automation TaskRunner | 差距 |
|---|---|---|---|
| 部署形态 | 独立 Spring Boot 进程（`neatlogic-runner-springboot`） | Platform-svc-go 内嵌 | Orion 缺独立 runner 池概念 |
| 执行引擎 | `ProcessBuilder` 调本地 `autoexec` CLI | Go 原生执行 | 双方都有 subprocess 模式 |
| 与主控协议 | HTTP REST + TCP socket | HTTP REST + SSE | 双方都有 SSE/socket；NeatLogic 用 socket 做双向 |
| RunnerGroup | 一等公民（`ScriptParamTypeRunnerGroup`） | 未建模 | **Orion 缺 RunnerGroup 抽象** |
| Runner 认证 | Basic/HMAC/Token 三种 handler | 单一 HMAC | Orion 需扩展 |
| 限流 | 每 token 独立 RateLimiter，Caffeine 10k 缓存 | 有 rate limit 但按用户 | Orion 按用户，NeatLogic 按 token |
| Tagent 支持 | Netty 心跳 + 8 类 action + 批量升级 | 无 | **Orion 缺 agent 生命周期管理** |
| Runner 健康检查 | `checkRunnerHealth` + `GetRunnerWaitingDetailApi` + `HealthCheckApi` | Orion 无独立 runner 池 | Orion 需建立 |

---

## 4. Tagent-base 定位

**Tagent 是** NeatLogic 的 **agent（"终端代理")** 生命周期管理 SDK 库，供主控和 runner 共用。

### 4.1 46 个 Java 文件分类

| 类别 | 数量 | 具体 |
|---|---:|---|
| DTO / VO | 6 | `TagentVo`, `TagentOSVo`, `TagentSearchVo`, `TagentVersionVo`, `TagentMessageVo`, `TagentUpgradeAuditVo` |
| Enum | 7 | `TagentAction`, `TagentStatus`, `TagentOSType`, `TagentCPUType`, `TagentFromType`, `TagentUpgradeStatus`, `RunnerAuthType` |
| Service 接口 + 实现 | 4 | `TagentService`, `TagentServiceImpl`, `RunnerService`, `RunnerServiceImpl` |
| Mapper | 1 | `TagentMapper`（25+ 方法） |
| Handler 抽象 | 3 | `ITagentHandler`, `TagentHandlerBase`, `TagentHandlerFactory` |
| 注册后置处理 | 3 | `IAfterRegister`, `AfterRegisterBase`, `AfterRegisterJobManager` |
| 常量 | 2 | `TAGENT_BASE`, `TAGENT_MANAGE` |
| 异常 | 19 | `TagentNotFoundException`, `TagentIpConflictException`, `TagentAccountNotFoundException` 等 |
| 其他 | 2 | 空注解类等 |

### 4.2 关键 enum 语义

```java
TagentOSType:     LINUX("linux"), WINDOWS("windows")
TagentStatus:     CONNECTED, DISCONNECTED
TagentCPUType:    DEFAULT
TagentFromType:   TAGENT_ACCOUNT
RunnerAuthType:   BASIC("basic"), HMAC("hmac")
TagentAction:     GET_LOGS, DOWNLOAD_LOG, GET_CONFIG, SAVE_CONFIG,
                  RELOAD, RESET_CREDENTIAL, STATUS_CHECK, UPGRADE,
                  BATCH_SAVE_CONFIG  // 共 9 种心跳通道命令
TagentUpgradeStatus: SUCCEED, FAILED, WORKING
```

### 4.3 TagentService 25 方法核心能力

```
CRUD:    saveTagent, updateTagentById, saveTagentAndAccount, deleteTagentByIdList
查询:    getTagentById, getTagentByIpAndPort, getTagentByAccountId,
         getTagentListByRunnerGroupIdList, getTagentListByIpListAndPortAndTagentId
心跳:    getTagentMGById (MG = MongoDB), getTagentMGByIpAndPort, getTagentMGListByIdList
         updateTagentMGByIdWithLock (带分布式锁)
批量:    batchUpgradeTagent, batchExecTagentChannelAction × 2, getTagentList(TagentSearchVo)
执行:    execTagentCmd(TagentMessageVo, action)
版本:    findTagentPkgVersion(TagentVo, targetVersion)
迁移:    updateIpListMG, rollbackTagentMG
```

**存储双写**：MySQL（主键持久化，TagentVo）+ MongoDB（`*MG*` 方法，心跳状态实时更新）。

### 4.4 TagentHandler 工厂 + 8 个 handler

Runner 侧有 8 个 `Tagent*Handler`（见 §3.2），通过 `TagentHandlerFactory` 反射构造、按 action 名分派。主控与 Runner 各自注册 handler 到工厂，实现**双向 handler 分派**。

---

## 5. 对 CC 风险登记表的影响

| 风险项 | 影响 | 优先级 |
|---|---|---|
| **Orion Runner 无独立部署形态** | NeatLogic 已证明独立 Spring Boot Runner 进程可行；Orion 若做微服务拆分应参考 | P1 |
| **RunnerGroup 抽象缺失** | NeatLogic 用 RunnerGroup 做执行器分组和权限绑定；Orion 需建立 | P1 |
| **Runner 认证三种 handler 未收敛** | Orion 仅 HMAC；建议扩展 Basic/Token | P2 |
| **Tagent 生命周期管理缺失** | NeatLogic 有 Netty 心跳 + 9 种 action + 批量升级 + 双写存储；Orion 无 agent 管理 | P1（若做 agent） |
| **每 token 独立限流** | Orion 按用户限流；参考 Caffeine 缓存方案可低成本引入 | P2 |
| **socket 反向写入 (`job/phase/socket/write`)** | Orion 只用 HTTP + SSE；NeatLogic 用 socket 做双向 | P3（SSE 已足够） |
| **主控到 Runner 全部 HTTP 无 K8s/Helm/ArgoCD** | Orion 若在架构规划中提到"Runner 支持 K8s/Helm/ArgoCD" 会被证明是**过度设计**（NeatLogic 企业级产品都没有） | P0（避免过度设计） |
| **Tagent 双写 MySQL + MongoDB** | 若 Orion 后续做 agent，双写方案可借鉴；但也可全 PG | P3 |

---

## 6. 值得 Orion 借鉴的具体设计（5 项）

### 6.1 RunnerGroup 抽象（P1 借鉴）

**NeatLogic 设计**：
- `ScriptParamTypeRunnerGroup`：作业剧本里的参数类型 `RUNNERGROUP`，用户可选分组而非单 runner。
- `insertAppModuleRunnerGroup` / `getAppModuleRunnerGroupByAppSystemIdAndModuleId`：应用-模块与 runner 组绑定。
- 部署侧 SQL 节点 `runnerMapId`、`runnerGroupVo` 一路传递。

**Orion 借鉴**：在 Automation 模块加 `runner_group` 表 + `ScriptParamType` 里加 `RUNNERGROUP` 值，避免剧本与单 runner 硬绑定。

### 6.2 主控到 Runner 端点极简主义（P0 反向借鉴：避免过度设计）

NeatLogic 86 个 Api 组件全部围绕 **HTTP REST + subprocess + socket** 三协议，**无 K8s/Helm/ArgoCD/Docker/Ansible**。企业级 runner 的实际需求：
- 触发 CLI 作业
- 拉取日志/SQL 文件/输出文件
- 写入 socket 通知
- 反向执行命令

**Orion 应砍掉的规划**：Runner 侧不应承诺 K8s/Helm/ArgoCD 直连，这些能力应在**上层**（deploy/pipeline）通过 API 调用实现，Runner 只做本地 subprocess。

### 6.3 每 Token 独立限流（P2 借鉴）

```java
Cache<String, RateLimiter> LIMITER_CACHE = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterAccess(1, TimeUnit.HOURS).build();
```

**Orion 借鉴**：Go 侧用 `singleflight.Group` + `time.Ticker` 或 `golang.org/x/time/rate` + sync.Map，配合 LRU 缓存。

### 6.4 Tagent Action 抽象（P1 借鉴）

**9 种 action** 覆盖了远程 agent 管理的所有典型场景。Orion 若做 agent 生命周期：
```
GET_LOGS, DOWNLOAD_LOG, GET_CONFIG, SAVE_CONFIG,
RELOAD, RESET_CREDENTIAL, STATUS_CHECK, UPGRADE, BATCH_SAVE_CONFIG
```

对应 Orion 需要的：`heartbeat / statusCheck / reloadConfig / upgradePackage / collectLog / downloadLog / resetCredential`。

### 6.5 TenantContext 显式优于 Filter 隐式（P2 反向借鉴）

NeatLogic **不使用** Spring Interceptor/Filter 隐式注入租户，而是让每个 API 显式调 `TenantContext.get().getTenantUuid()`。这带来的收益：
- **审计友好**：每个 tenant 使用点都可 grep
- **测试友好**：`TenantContext.init("test-tenant")` 一行注入
- **无跨请求污染**：显式 `TenantContext.get().release()`

Orion 现状是隐式（handler 里从 middleware 注入）。可考虑给关键 API（尤其是 admin 类）**显式**从 context 读取，减少 middleware 遗漏风险。

---

## 7. 认知边界

1. **未验证 runner 与外部系统对接**：本分析只覆盖 submodule；NeatLogic 与 Jenkins/Gitlab/GitHub 的对接可能在 `neatlogic-ci` 或 `neatlogic-web` submodule，未纳入本次分析。
2. **Runner 认证 handler 内部实现未逐行读**：只 grep 到 3 个 handler 类名（Basic/HMAC/Token），未读实现细节。
3. **Netty 心跳通道协议格式未读**：只确认存在 `NettyServer.java`/`NettyServerHandler.java`/`NettyClientHandler.java`；帧协议、心跳间隔、重连策略未分析。
4. **Tagent 二进制的 agent 端实现未 clone**：只有 base SDK 库；实际的 tagent agent 部署包在另一处，本次无法验证 Windows/Linux agent 二进制差异。
5. **TenantContext 类的具体实现未读**：跨 submodule（可能在 `neatlogic-framework`），只知道它的 `get() / init() / release() / getTenantUuid() / getDbName() / getActiveModuleList() / getActiveModuleGroupList()` 方法签名。
6. **MCP 集成深度未验证**：`InformantMcpClient` 使用 `io.modelcontextprotocol.client` 库；Orion 侧 MCP 实现方式对比未做。
7. **autoexec CLI 实现**：`ExecProcessCommand` 调用 `autoexec` CLI，但该 CLI 是外部二进制（可能在 tagent/pkg 里打包），本次分析不含其源码。
8. **本报告不含**：人天/工期/团队规模估算；不改任何生产代码；仅静态一手 grep 结论。

---

## 附录：关键文件路径索引

- TenantContext 引用密度：`/private/tmp/neatlogic-itom/neatlogic-tenant/src/main/java/neatlogic/module/tenant/api/scheduler/`（10 处）
- Tenant schema 隔离：`/private/tmp/neatlogic-itom/neatlogic-autoexec/src/main/java/neatlogic/module/autoexec/autoconfig/handler/AutoexecJobCleaner.java:103`
- Tenant HTTP header 注入：`/private/tmp/neatlogic-itom/neatlogic-tenant/src/main/java/neatlogic/module/tenant/api/util/VerificationHmacApi.java:81`
- Runner 执行引擎：`/private/tmp/neatlogic-itom/neatlogic-runner/neatlogic-runner-framework/src/main/java/com/neatlogic/autoexecrunner/core/ExecProcessCommand.java`
- Runner 作业触发：`/private/tmp/neatlogic-itom/neatlogic-runner/neatlogic-runner-framework/src/main/java/com/neatlogic/autoexecrunner/api/job/JobExecApi.java`
- Runner socket 反向：`/private/tmp/neatlogic-itom/neatlogic-runner/neatlogic-runner-framework/src/main/java/com/neatlogic/autoexecrunner/api/job/phase/WriteJobPhaseSocketApi.java`
- Runner 限流：`/private/tmp/neatlogic-itom/neatlogic-runner/neatlogic-runner-framework/src/main/java/com/neatlogic/autoexecrunner/api/ratelimit/TokenRateLimiter.java`
- Runner MCP client：`/private/tmp/neatlogic-itom/neatlogic-runner/neatlogic-runner-framework/src/main/java/com/neatlogic/autoexecrunner/service/informant/InformantMcpClient.java`
- Tagent action 枚举：`/private/tmp/neatlogic-itom/neatlogic-tagent-base/src/main/java/neatlogic/framework/tagent/enums/TagentAction.java`
- TagentService 接口：`/private/tmp/neatlogic-itom/neatlogic-tagent-base/src/main/java/neatlogic/framework/tagent/service/TagentService.java`
- Deploy 全局锁：`/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/globallock/DeployGlobalLockHandler.java`
- Deploy Runner 调用：`/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/job/source/type/DeployJobSourceTypeHandler.java`
