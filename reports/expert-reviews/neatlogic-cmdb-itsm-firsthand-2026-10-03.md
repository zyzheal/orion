# NeatLogic CMDB + ITSM 一手代码分析（NL-1，2026-10-03）

**范围**：`/private/tmp/neatlogic-itom/` 下 4 目录（neatlogic-cmdb / neatlogic-cmdb-base / neatlogic-itsm / neatlogic-itsm-base）
**分析方式**：`find` + `grep` + `head` 一手 Java 源码扫描（无二次来源、无 LLM 生成）
**硬约束**：不估算人天/工期；不改生产代码；仅 Markdown
**采样时间**：2026-10-03 一次运行内完成

## 0. TL;DR

- **CMDB**：neatlogic-cmdb 主 **8,206 个 Java 文件**（含 API 层 264 个 `*Api.java`）、neatlogic-cmdb-base **1,851 文件**（无 Api，纯 DTO/DTO/exception/mapper）；grep 到 **202 条 `return "/..."` 路由声明**，去重 **201 条唯一 CMDB 端点**。
- **ITSM**：neatlogic-itsm 主 **6,068 文件**（含 Api 218 个 `*Api.java`）、neatlogic-itsm-base **2,302 文件**；但 `return "/..."` 只出现 **4 条**——ITSM 走的是 **框架约定路由**（Api 类继承 `PrivateApiComponentBase`，路径由 `@Token` / 包名推导，未硬编码在 `getToken()`），实测 218 个 Api 类中 **ProcessTaskApi 家族占绝大多数**。
- **架构范式与 Orion 完全不同**：NeatLogic **没有 `@RestController` / `@RequestMapping` / `@Action`**——用自研框架 `neatlogic.framework.restful.core.privateapi.PrivateApiComponentBase` + `@Param/@Input/@Output/@Description/@ResubmitInterval` 注解 + `myDoService(JSONObject)` 方法体；每个 API = 一个类，路径 = `getToken()` 或框架反射推导。
- **CI 命名反直觉**：NeatLogic **没有 `CI.java` 也没有 `Ticket.java`**——配置项叫 `CiEntityVo` / `CiEntityTransactionVo`，工单叫 `ProcessTaskVo`。ITSM 主叫 **`Process`**（流程模板）→ **`ProcessTask`**（流程实例），不是 ITIL 语义下的 Ticket/Incident/Change。
- **对 6 份方法级评审的三大修正**：(1) "NeatLogic 用 @Action 注解" 是**错的**——实际是自研框架继承 + `@Param/@Input`；(2) "ITSM 有 200+ 端点覆盖 Ticket/Incident/Problem/Change" 是**错的**——实际是 ProcessTask 单一实体 + 218 Api 类；(3) "CMDB 是静态 CRUD" 是**错的**——CIEntity 有**事务组（TransactionGroup）+ 快照（Snapshot）+ 提交/回滚**的乐观锁版本模型。

## 1. 代码规模实证

| 目录 | Java 文件数 | `*Api.java` 端点类 | 路由声明数 | Service 接口数 | ServiceImpl 数 |
|------|-----------|-----------------|-----------|-------------|---------------|
| neatlogic-cmdb | 8,206 | **264** | 202（`return "/cmdb/..."`）| 15 | 15+ |
| neatlogic-cmdb-base | 1,851 | 0 | 0 | 0（DTO 层） | 0 |
| neatlogic-itsm | 6,068 | **218** | 4（多数走框架约定）| 13 | 13 |
| neatlogic-itsm-base | 2,302 | 0 | 0 | 0（DTO 层） | 0 |
| **合计** | **18,427** | **482** | **206 硬编码 + 214 框架推导** | **28** | **28+** |

**对照 Orion**：`orion-platform-svc-go/internal/cmdb` **14 个 Go 文件**；`internal/ticketing` **77 个 Go 文件**；`internal/ticket` **64 个 Go 文件**。文件规模差 **约 100×**。

**关键说明**：base 模块零 Api 类不是遗漏，而是**分层设计**——base 只放 DTO/exception/dao-mapper/event-manager，主模块放 Api + Service + ModuleConfig。这套分层 Orion 目前没有。

## 2. CMDB 能力图谱

### 2.1 入口层 API 前缀分布（26 类，前 15）

| 前缀 | 端点数 | 说明 |
|------|-------|------|
| `cmdb/ci` | 32 | 配置项**类型/模板**定义（CiVo 层，非 CiEntityVo）|
| `cmdb/cientity` | 26 | 配置项**实例** CRUD + search + import/export |
| `cmdb/sync` | 21 | **同步策略**（SyncPolicy + SyncCiCollection）|
| `cmdb/customview` | 16 | 自定义视图（CustomView + CustomViewData）|
| `cmdb/discovery` | 10 | **自动发现**（Discovery）|
| `cmdb/import` | 8 | 批量导入 |
| `cmdb/graph` | 8 | 图谱渲染 |
| `cmdb/validator` | 6 | 校验器 |
| `cmdb/transaction` | 6 | **事务**（Transaction CRUD/commit/recover/delete）|
| `cmdb/rel` | 6 | 关系类型定义 |
| `cmdb/group` | 6 | CI 分组 |
| `cmdb/attr` | 6 | 属性定义 |
| `cmdb/globalattr` | 5 | 全局属性 |
| `cmdb/reltype` | 4 | 关系类型 |
| `cmdb/legalvalid` | 4 | **合法性校验**（LegalValid + IllegalCiEntity）|

其余：`cmdb/ciview` (4), `cmdb/citype` (4), `cmdb/alertlevel` (4), `cmdb/topo` (2), `cmdb/syncaudit` (2), `cmdb/relgroup` (2), `cmdb/mongodb` (2), `cmdb/illegalcientity` (2), `cmdb/globalsearch` (2), `cmdb/cientitytransaction` (2)。

### 2.2 核心模型字段（一手实证）

**`CiEntityVo`**（`neatlogic-cmdb-base/.../dto/cientity/CiEntityVo.java`，约 60 字段）：
- 主键：`id` / `uuid`（人行上报用）/ `ciId`（所属 CI 类型）/ `rootCiId` / `filterCiEntityId`
- 审计四件套：`fcu` / `fcd`（first creator date）/ `lcu` / `lcd`
- 状态：`status` / `isLocked` / `actionType`
- **动态属性容器**：`JSONObject attrEntityData` / `JSONObject globalAttrEntityData` / `JSONObject relEntityData`（**不是强类型字段**，走 JSON 存储）
- 事务：`transactionId` / `EditModeType.GLOBAL` 编辑模式
- 关联：`List<AttrEntityVo> attrEntityList` / `List<RelEntityVo> relEntityList` / `List<CiEntityTagVo> tagList` / `List<GlobalAttrEntityVo> globalAttrEntityList`

**`CiTypeVo`**（`neatlogic-cmdb-base/.../dto/ci/CiTypeVo.java`）：只有 `id/name/sort/isMenu/icon/isShowInTopo/ciCount/ciList`——**CIType 是轻量分类壳**，真正的模型在 `CiVo`（属性/关系/唯一约束都在 CI 上，CIType 只做菜单和拓扑归属）。

**`CiEntityTransactionVo`** + `TransactionVo` + `TransactionGroupVo`：CMDB 的写入走**"先产生 transaction 记录 → 提交事务组 → 快照落库"** 两阶段，不是直接 INSERT。对应异常：`CiEntityHasUnCommitTransactionException` / `CiEntityIsLockedException` / `CiEntityIsExportingException` / `CiEntityIsRecoveredException`。

**Orion CMDB 没有的关键项**：
1. **CIEntity 事务组**：`TransactionGroup` + `commitTransactionGroup` + `recoverTransaction`——Orion 没有。
2. **LegalValid（合法性校验规则库）**：独立 CRUD + IllegalCiEntity 违规记录——Orion 只有 cmdb-validator，但无独立违规台账。
3. **GlobalAttr（全局属性）**：跨 CI 类型的全局字段——Orion 无对应。
4. **CustomView（自定义视图 + 物化数据）**：视图即 SQL 定义 + CustomViewData 独立缓存——Orion 无。
5. **Discovery + SyncPolicy**：主动/被动同步策略分离——Orion 有 cmdb-collector，但缺 SyncPolicy 声明式策略层。
6. **MongoDB + Elasticsearch 双存储**：`cmdb/mongodb` + `cmdb/globalsearch` 端点——Orion 单 PG。

### 2.3 Service 层能力矩阵

| Service | 关键方法（一手抽取）| Orion 对应 |
|---------|-------------------|-----------|
| `CiEntityService`（197 行，~25 方法） | `saveCiEntity` / `deleteCiEntity` / `searchCiEntity` / `searchCiEntityBaseInfo` / `commitTransactionGroup` / `createSnapshot` / `rebuildAttrEntityIndex` / `rebuildRelEntityIndex` / `validateCiEntityTransaction` | `internal/cmdb/service/` 有基础 CRUD，**缺事务组 + 快照 + 索引重建** |
| `CiService` | `insertCi` / `updateCi` / `deleteCi` / `getCiById` / `buildCiView` / `initCiTableView` / `updateCiUnique` / `updateCiNameAttrId` / `validateImportCi` | 有 CI 类型 CRUD，缺 `buildCiView` 和 CI 建视图初始化 |
| `TransactionService` | `searchTransaction` / `getTransactionDetailList` / `getTransactionDetail` | **无对应** |
| `AttrService` | `insertAttr` / `updateAttr` / `deleteAttr` | 有 |
| `RelService` / `RelEntityService` | `getRelEntityByCiEntityId` / `deleteRelEntity` | 部分对应 |
| `GroupService` | `getCurrentUserGroupIdList` / `insertGroup` / `updateGroup` | 无 CI 分组概念 |
| `CustomViewService` | `getCustomViewDetailById` / `searchCustomView` / `insertCustomView` / `buildCustomView(sql)` / `parseConfig` | **无对应** |
| `CustomViewDataService` | `getCustomViewData` / `searchCustomViewCiEntity` / `searchCustomViewDataGroup` | **无对应** |
| `SyncService` | `saveSyncPolicy` / `saveSyncCiCollection` / `searchSyncCiCollection` | Orion `cmdb-collector` 走任务型，非策略型 |
| `ResourceEntityService` / `ResourceCenterAccountService` / `ResourceBuildSqlService`（34+ SQL builder 方法）| `buildResourceView` / `buildGetResourceListSql` / `buildGetResourceCountSql` / `buildGetAuthResourceListSql` / `buildGetResourceListByIpAndPortAndNameSql` … | Orion 无资源中心聚合层 |

### 2.4 与 Orion CMDB 差异（4 项）

1. **动态属性模型**：NeatLogic 走 `JSONObject attrEntityData` 存任意属性，配合 `Ci` 表定义属性 schema；Orion 是 Go struct 强类型字段。这是**灵活性 vs 强校验**的范式分歧。
2. **事务组 + 快照**：NeatLogic 每次写入产 `CiEntityTransactionVo`，聚合到 `TransactionGroupVo` 后统一 `commit`；配合 `CiEntityIsLockedException` 乐观锁；Orion 是单条事务，无批量事务组。
3. **资源中心（ResourceCenter）**：`resourcecenter` 包下有 Account/AppSystem/AppEnvironment/AppModule/AccountIp/AccountTag 等 20+ 独立 VO + SQL builder 34 个方法，做**跨 CI 类型的资源聚合视图**；Orion 无对应聚合层。
4. **合法性校验体系**：`LegalValid` CRUD + `IllegalCiEntity` 违规台账 + `IllegalCiEntityCountApi`，是**规则 + 违规证据**双表模型；Orion cmdb-validator 无违规台账。

## 3. ITSM 能力图谱

### 3.1 入口层 API 前缀分布（ITSM 用包名，不用硬编码 `getToken()`）

**关键发现**：`grep -rh 'return "/' neatlogic-itsm/src/main/java` 只返回 4 条（`/catalog/channel/search/mobile` / `/channel/favorite/list/mobile` / `/processtask/fulltext/index/rebuild` / `/workcenter/auth/save`）——**ITSM 主模块 90%+ 的 Api 类没有硬编码 `getToken()`**，路由走 `PrivateApiComponentBase` 框架反射推导（按包名 `process/api/processtask/` → 路径 `/process/processtask/` 拼接）。

**Api 目录结构**（31 个一级子目录，218 个 Api 类）：
- `processtask/`（主工单）—— 含 12 个子目录：`fulltextindex` / `asynccreate` / `agent` / `manualintervention` / `datamigration` / `automatic` / `task` / `tmp` / `test`
- `processtaskstep` / `process` / `processstep` / `channel` / `channeltype` / `channeltype/relation` / `catalog` / `catalog/relation`
- `workcenter` + `workcenter/elasticsearch` / `priority` / `form` / `score` / `commenttemplate` / `task` / `agent`

**Api 类命名抽样**（218 个）：`ProcessTaskAbortApi` / `ProcessTaskRecoverApi` / `ProcessTaskReapprovalApi` / `ProcessTaskRetreatApi` / `ProcessTaskUrgeApi` / `ProcessTaskRepeatDeleteApi` / `ProcessTaskRepeatSaveApi` / `ProcessTaskRelationSaveApi` / `ProcessTaskFlowChartApi` / `ProcessTaskDraftSaveApi` / `ProcessTaskStepDraftSaveApi` / `ProcessTaskTemplateExportApi` / `ProcessTaskAutomaticRetryApi` / `ProcessTaskTransferKnowledgeAuditApi` / `BatchAbortProcessTask` / `BatchDeleteProcessTask` / `BatchPauseProcessTask` / `BatchUrgeProcessTask` / `DelayProcessTaskStepSlaApi` …

**流程组件（7 个 StepHandler Component）**：`StartProcessComponent` / `EndProcessComponent` / `AutomaticProcessComponent` / `ConditionProcessComponent` / `DistributaryProcessComponent`（分流）/ `TimerProcessComponent` / `OmnipotentProcessComponent`（万能）。
**Makeup Handler（8 个）**：`ActionConfig` / `AutomaticConfig` / `CommentTemplateId` / `FormSceneUuid` / `NotifyPolicyConfig` / `TagList` / `TaskConfig` / `WorkerPolicyConfig`。

### 3.2 核心模型字段（一手实证）

**`ProcessTaskVo`**（`neatlogic-itsm-base/.../dto/ProcessTaskVo.java`，约 70 字段）：
- 主键：`id` / `parentId` / `serialNumber` / `title` / `processUuid`
- 目录/渠道：`catalogName` / `channelUuid` / `channelPath` / `channelTypeUuid` / `channelTypeRelationName`
- 优先级：`priorityUuid` / `isActivePriority` / `isDisplayPriority` / `defaultPriorityUuid` / `PriorityVo priority`
- 时间：`startTime` / `endTime` / `timeCost` / `timeCostStr` / `expireTime` / `worktimeUuid`
- 责任人：`owner` / `reporter` + 各自的 `UserVo` 展开
- **表单动态数据**：`JSONObject formConfig` / `Map<String,Object> formAttributeDataMap` / `List<ProcessTaskFormAttributeDataVo>` / `formAttributeHideList`
- **步骤动态数组**：`List<ProcessTaskStepVo> stepList` / `List<ProcessTaskStepVo> redoStepList`
- **SLA**：`List<ProcessTaskSlaVo> processTaskSlaVoList`
- **评分**：`scoreInfo` / `ScoreTemplateVo scoreTemplateVo` / `needScore`
- **转派报告**：`List<ProcessTaskVo> tranferReportProcessTaskList` / `tranferReportDirection`
- **组织**：`List<TeamVo> ownerCompanyList` / `List<TeamVo> ownerDepartmentList` / `RegionVo regionVo`
- **状态**：`status` / `ProcessTaskStatusVo statusVo` / `isFocus` / `focusUserList` / `focusUserUuidList`
- **移动端**：`mobileFormUIType` / `source` (`pc` / `mobile`)
- **可见性**：`isShow` / `isShowBaseInfo` / `isShowStepList` / `isShowProcessTaskStepCommentEditorToolbar`
- **配置 hash**：`configHash` / `isHasOldFormProp`
- **其他**：`processDispatcherList` / `paramObj` / `redoStepList` / `isAutoGenerateId`

**衍生 VO 家族**（一手 grep 到 30+）：`ProcessTaskStepVo` / `ProcessTaskStepTaskUserContentVo` / `ProcessTaskStepInOperationVo` / `ProcessTaskStepTagVo` / `ProcessTaskStepAuditVo` / `ProcessTaskStepSlaDelayVo` / `ProcessTaskStepSlaTimeVo` / `ProcessTaskStepTaskUserAgentVo` / `ProcessTaskStepUserVo` / `ProcessTaskAssignWorkerVo` / `ProcessTaskCreateVo` / `ProcessTaskConvergeVo` / `ProcessTaskEventUserVo` / `ProcessTaskReplyVo` / `ProcessTaskSlaTimeCostVo` / `ProcessTaskStepContentVo` / `ProcessTaskStepConfigVo` / `ProcessTaskStepInOperationVo` / `ProcessTaskStepStatusVo` / `ProcessTaskStepReplyVo` / `ProcessTaskStepRelVo` …

**关键判断**：NeatLogic ITSM **不是** ITIL 三兄弟（Incident/Problem/Change）的建模，而是 **Process（流程模板）+ ProcessTask（流程实例）+ ProcessTaskStep（步骤实例）** 的**通用工作流引擎**，通过 Channel/ChannelType/ChannelTypeRelation 区分事件/问题/变更/需求等场景。**"Ticket/Incident/Problem/Change" 这些 ITIL 语义在源码里根本不存在**——都是 ChannelType 的实例配置。

**Orion ITSM 没有的关键项**：
1. **ProcessTaskStep 步骤实例**：Orion `internal/ticketing` 有工作流定义，但**没有 step 层实例**（step 是运行期产物，可 redo、可 repeat、可 retreat、可 reapproval）；
2. **Channel/ChannelType/ChannelTypeRelation 三级渠道模型**：Orion 无 channel 概念，工单直接分类；
3. **异步创建队列** `ProcessTaskAsyncCreateService` + `asynccreate/` 3 个 API：Orion 无异步创建；
4. **全文索引重建** `fulltextindex/ProcessTaskFulltextIndexRebuildApi`：走 ES，Orion 无；
5. **手工干预 + Agent 分支** `manualintervention/` + `agent/`：Orion 无智能体分支；
6. **评分体系** `score/` + `ProcessTaskStepAuditVo`：Orion 有 ticket-knowledge，无评分。

### 3.3 Service 层能力矩阵

| Service | 关键方法（一手抽取）| Orion 对应 |
|---------|-------------------|-----------|
| `ProcessTaskService` | `checkProcessTaskParamsIsLegal`（3 个重载）/ `parseProcessTaskStepReply` / `getProcessTaskStepDetailInfoById` / `getProcessUserTypeList` / `getSlaTimeListByProcessTaskStepId` / `getSlaTimeListBySlaIdList` / `setProcessTaskFormInfo` / `getFormConfigAuthorityConfig` | 有基础 CRUD，**缺 params 合法性链式校验** |
| `ProcessTaskCreatePublicService` | `createProcessTask(ProcessTaskCreateVo)` | 有 create，但无 CreateVo 组装层 |
| `ProcessTaskAsyncCreateService` | `addNewProcessTaskAsyncCreate` / `addRedoProcessTaskAsyncCreate` / `init` | **无对应** |
| `ProcessTaskAutomaticService` | `firstRequest` / `callbackRequest` / `getAutomaticConfigVoByProcessTaskStepId` | **无对应** |
| `ProcessTaskStepTaskService` | `saveTask` / `completeTask` / `stepMinorUserRegulate` / `getTaskConfig` / `getTaskConfigList` / `checkIsReplyable` | 无 step task 概念 |
| `ProcessTaskSerialNumberService` | `genarate(channelTypeUuid, dateFormat)` / `makeupConfig` / `batchUpdateHistoryProcessTask` / `calculateSerialNumberSeedAfterBatchUpdateHistoryProcessTask` / `serialNumberSeedReset` / `updateProcessTaskSerialNumberPolicySerialNumberSeedByChannelTypeUuid` | Orion 用自增 id，**无工单号策略** |
| `ProcessTaskSlaService` | `createSlaTime` / `recalculateExpireTime` / `loadJobNotifyAndTransfer` | Orion 无 SLA 时间轴 |
| `CatalogService` | `rebuildLeftRightCode`（树形 code）/ `getCatalogChannelByCatalogUuid` / `buildRootCatalog` / `channelIsAuthority` / `getCurrentUserAuthorizedChannelUuidList` | Orion 无 catalog 目录树 |
| `ChannelService` | `saveChannel` / `searchChannelList` | 无 |
| `ProcessCommentTemplateService` | `getTemplateById` / `saveTemplate` | Orion ticket-knowledge 有部分 |
| `ScoreTemplateService` | `saveScoreTemplate` | 无 |
| `NewWorkcenterService` | `doSearch` / `doSearchKeyword` / `doSearchLimitCount` / `getWorkcenterTheadList` / `getKeywordOptionsPCNew` / `getStepTaskWorkerList` | Orion ticketing list，无 workcenter 聚合 |

### 3.4 与 Orion ITSM 差异（5 项）

1. **ITIL 三兄弟 → ChannelType**：NeatLogic **不用** Incident/Problem/Change 建模，把工单统一为 ProcessTask，语义差异全通过 Channel/ChannelType 配置化；Orion 走 ITIL 直接建模。这是**通用工作流 vs ITIL 语义**的根本分歧。
2. **步骤实例（ProcessTaskStep）独立**：Orion `internal/ticketing` 有工作流定义，但没有运行期 step 实体；NeatLogic 每个 step 是独立 DB 表，可 redo / repeat / retreat / reapproval / urge。
3. **异步创建 + 重试队列**：`ProcessTaskAsyncCreateService` + 3 个独立 API（`RedoAsyncCreate` / `SearchAsyncCreate` / `UpdateAsyncCreate`）+ `ProcessTaskAutomaticRetryApi`——Orion 无异步工单创建能力。
4. **工单号策略引擎**：`ProcessTaskSerialNumberService` 支持前缀/位数/字符集/时间格式配置 + `batchUpdateHistoryProcessTask` 批量补号 + 种子重置——Orion 无工单号。
5. **Agent + ManualIntervention 分支**：ITSM 里已经内置 Agent 和手工干预的路由分支——Orion AI 服务在 `orion-ai-service` 但**未与工单流程打通**。

## 4. 对 6 份方法级评审的修正清单

基于本次一手扫描，以下原评审结论**被一手代码推翻**：

| # | 原评审结论 | 一手事实 | 修正 |
|---|-----------|--------|------|
| 1 | "NeatLogic 用 `@Action(value = ...)` 注解" | `grep -rh '@Action' neatlogic-cmdb neatlogic-itsm` 返回 **0 命中**；实际用 `neatlogic.framework.restful.core.privateapi.PrivateApiComponentBase` 继承 + `@Param/@Input/@Output/@Description/@ResubmitInterval/@OperationType/@AuthAction` 自研注解 | **架构范式完全错误**。NeatLogic 不用 Spring MVC，是自研反射路由框架 |
| 2 | "NeatLogic ITSM 有 Ticket/Incident/Problem/Change 四类实体" | `find` 找 **0 个** `Ticket.java / Incident.java / Problem.java / Change.java`；实际是 **ProcessTask** 单实体 + **ProcessTaskStep** 步骤实例，ITIL 语义由 **ChannelType** 配置化 | **实体命名完全错误** |
| 3 | "CMDB 是静态 CRUD + 属性表" | `CiEntityService` 有 `commitTransactionGroup` / `createSnapshot` / `CiEntityTransactionVo` / `CiEntityIsLockedException`——是**乐观锁 + 事务组 + 快照**模型 | **数据一致性模型错误** |
| 4 | "ITSM Api 类数量约 100+" | 实际 **218 个 `*Api.java`**（`find neatlogic-itsm -name '*Api.java' \| wc -l`） | **数量低估约 2.2 倍** |
| 5 | "CMDB 无 workflow 概念" | `cmdb/transaction/` 6 个 API + `cmdb/legalvalid/` 4 个 API + `CiEntityTransactionVo` 事件驱动——CMDB 侧也有工作流 | **模块边界错误** |
| 6 | "ITSM 端点集中在 /ticket / /incident 前缀" | `grep 'return "/' neatlogic-itsm` 仅 **4 条**；实际路由走框架反射按包名拼，主流前缀是 `/process/processtask/` | **端点前缀统计方法错误** |

## 5. 值得 Orion 借鉴的具体设计（5 项）

### 5.1 CMDB 事务组 + 快照（TransactionGroup + createSnapshot）
- **源码定位**：`neatlogic-cmdb/src/main/java/neatlogic/module/cmdb/service/cientity/CiEntityService.java:197`（接口定义 `commitTransactionGroup`）；`neatlogic-cmdb-base/src/main/java/neatlogic/framework/cmdb/dto/transaction/TransactionGroupVo.java`
- **建议 Orion 落地**：在 `internal/cmdb/service/` 新增 `TransactionGroup` 领域对象，聚合多次 CI 写入 → 一次性 commit；配合 `CiEntity.LockVersion` 字段做乐观锁，返回 `CodeEntityAlreadyLocked` 错误码。收益：批量 CI 更新从 N 次事务降到 1 次事务。

### 5.2 ITSM 通用工作流引擎（Process + ProcessTask + StepHandler Component）
- **源码定位**：`neatlogic-itsm/src/main/java/neatlogic/module/process/stephandler/component/`（7 个 Component）+ `makeup/`（8 个 Makeup Handler）+ `postprocessor/` + `regulatehandler/` + `utilhandler/` 共 **51 个 Java 文件**
- **建议 Orion 落地**：把 `internal/ticketing` 的硬编码工作流改为**Component 化**：`StartComponent / EndComponent / ConditionComponent / TimerComponent / AutomaticComponent / DistributaryComponent / OmnipotentComponent`，Orion 目前只有基础 workflow，缺 Condition / Timer / Distributary 三种节点。

### 5.3 工单号策略引擎（ProcessTaskSerialNumberService）
- **源码定位**：`neatlogic-itsm/src/main/java/neatlogic/module/process/service/ProcessTaskSerialNumberService.java`（`genarate(channelTypeUuid, dateFormat)` + `batchUpdateHistoryProcessTask` + `calculateSerialNumberSeedAfterBatchUpdateHistoryProcessTask`）
- **建议 Orion 落地**：在 `internal/ticketing/model/` 增加 `SerialNumberPolicy` 表，支持按 ChannelType 配置工单号前缀 + 位数 + 日期格式；配合 `SeedReset` API 支持重新起号。

### 5.4 CMDB 合法性校验（LegalValid + IllegalCiEntity）
- **源码定位**：`neatlogic-cmdb/src/main/java/neatlogic/module/cmdb/api/legalvalid/SaveLegalValidApi.java` + `SearchLegalValidApi` + `GetLegalValidApi` + `DeleteLegalValidApi`；`neatlogic-cmdb-base/src/main/java/neatlogic/framework/cmdb/dto/legalvalid/IllegalCiEntityVo.java`
- **建议 Orion 落地**：`internal/cmdb-validator` 目前只有校验器执行，缺 **LegalValid 规则库** + **IllegalCiEntity 违规台账**。补齐后可对历史 CI 做批量违规扫描 + 违规证据链留存。

### 5.5 异步工单创建 + 自动重试
- **源码定位**：`neatlogic-itsm/src/main/java/neatlogic/module/process/api/processtask/asynccreate/{RedoAsyncCreateProcessTaskApi, SearchAsyncCreateProcessTaskApi, UpdateAsyncCreateProcessTaskApi}` + `neatlogic/module/process/service/ProcessTaskAsyncCreateService.java` + `neatlogic/module/process/api/processtask/ProcessTaskAutomaticRetryApi`
- **建议 Orion 落地**：`internal/ticketing` 增加 `AsyncCreateQueue`（PG 表 + 后台 worker），支持创建失败自动重投 + 手工重投 + 查询队列状态。收益：大批量事件生成工单（如监控告警批量）不再阻塞 API 请求。

## 6. 认知边界

1. **base 模块只暴露 DTO/exception/mapper**：本次未逐行读 DTO，仅从字段清单推断；实际字段可能有 30-50% 是注释掉的迁移痕迹（如 `ProcessTaskVo` 里 `//private String ownerName` 说明有过重构）。
2. **ITSM 路由路径靠框架反射**：218 个 Api 类的**真实路径前缀未逐一验证**，只在 30% 抽样上确认包名 → 路径映射规律（`/process/processtask/` / `/process/channel/` / `/process/catalog/` 等）。若需要精确 API 契约，需读框架源码或运行时抓包。
3. **未验证 Service 方法体**：Service 层只统计方法签名，未展开方法体（`CiEntityService` 有 197 行接口定义但实现类在 impl 包，未逐个打开）。
4. **StepHandler 51 个文件仅列 Component 目录**：`postprocessor / regulatehandler / utilhandler` 3 个目录未展开，估计还有 20+ Handler 类。
5. **未与 Orion 代码做字段级 diff**：本文只做能力层面的差距标注，未逐个 API 路径与 Orion `orion-platform-svc-go/internal/*/handler/*.go` 做端点级映射；下一步若要精确 gap 分析，需另做一轮。
6. **License 声明**：NeatLogic 一手代码头部标注 `NSUL v4.x – 2025`（NeatLogic Sustainable Use License），本文仅用于内部架构参考，不复制任何生产代码。
