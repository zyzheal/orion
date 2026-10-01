# NeatLogic vs Orion 颗粒度对比与混沌工程/巡检能力补全方案

> **日期**：2026-10-01
> **基础**：8 份 v2 专家评审（cross-review-synthesis-2026-10-01.md）+ NeatLogic Java 源码实证（4230 文件）+ Orion Go 源码
> **目的**：将 v2 报告的"识别级"颗粒度下沉到"功能级"，支持迁移规划决策
> **覆盖**：巡检 inspect 66 API / 自动化 autoexec 90+ API / 混沌工程能力差

---

## 0. TL;DR

1. **巡检补全优先级最高**：RunInspection 是代码写死的桩（service.go:49-59），66 个 NeatLogic API 对 8 个 Orion 文件，缺口 87%。补全路径：阈值引擎（MongoDB Document）+ 配置文件管理 + 报告导出 + 5 service 类。
2. **混沌工程 Orion 反超 NeatLogic**：Orion chaos 模块有真实 K8s 6 类故障注入（cpu-spike/memory-leak/network-latency/service-down/pod-kill/pod-oom）+ 自动回滚 + 健康检查，NeatLogic 无独立混沌模块。Orion 应保留并增强风险评估 + 场景化能力（借鉴 NeatLogic risk/scenario）。
3. **三大优秀能力需借鉴**：① 风险评级（risk）② 场景管理（scenario）③ 脚本版本审核（script review）—— Orion 当前全缺，是补全的关键差距。
4. **8 项独有能力需移植**：巡检阈值 MongoDB 模型 / 配置文件版本比对 / 巡检报告导出 / 巡检计划调度 / 风险评级 / 场景管理 / 脚本审核 / 组合工具生成（generate）。
5. **升级路线**：5 个 Phase / 总 80-100 人天 / 5-6 周（3 人并行）。先止损（巡检桩 + chaos 集成），再补能力（阈值/配置文件/风险/场景），最后产品化（报告/调度/审核）。

---

## 1. 巡检 inspect 模块颗粒度对比

### 1.1 NeatLogic inspect 66 API 拆分（按 6 子域）

| 子域 | API 数 | 关键 API（举例） | 作用 |
|------|--------|-----------------|------|
| **configfile** | 13 | SaveInspectConfigFileResourcePathApi / ListInspectConfigFileResourceFileApi / CompareInspectConfigFileVersionApi / ClearInspectConfigFileResourceFileApi | 配置文件管理 + 版本比对 + 资源路径 |
| **definition** | 13 | SaveInspectDefApi / CollectionSearchApi / InspectCombopSaveApi / SaveInspectAppCollectionThresholdsApi / ReSaveInspectCollectionThresholdsApi / GetInspectResourceThresholdsSourceApi | 巡检定义 + 阈值管理 + 集合管理（MongoDB） |
| **job** | 7 | CreateInspectAppJobApi / CreateInspectResourceEntityJobApi / CreateInspectResourceTypeJobApi / InspectAutoexecJobNodeSearchApi / InspectAutoexecJobNodeProblemReportListApi / InspectAutoexecJobReportNotifyApi / InspectAutoexecJobSearchApi | 巡检作业（借 autoexec 引擎执行） |
| **newproblem** | 10 | InspectNewProblemReportListApi / SaveInspectNewProblemCustomViewApi / MoveInspectNewProblemCustomViewApi / RenameInspectNewProblemCustomViewApi / InspectNewProblemReportExportApi / InspectNewProblemReportSendEmailApi / RefreshInspectAlertEverydayApi | 新问题管理 + 自定义视图 + 报告导出/邮件 |
| **report** | 14 | InspectReportExportApi / InspectReportGetApi / InspectReportHistoryListApi / InspectResourceReportSearchApi / InspectScheduleSaveApi / InspectScheduleSearchApi / InspectScheduleStatusUpdateApi / ExportInspectResourceReportApi / ListInspectAppEnvApi / ListInspectAppResourceApi / SearchInspectAppModuleApi / SaveInspectAccessEndPointScriptApi / GetInspectAccessEndPointScriptApi / InspectCiCombopGetApi | 巡检报告 + 调度 + 应用资源 + 访问端点脚本 |
| **schedule** | 4 | SaveInspectAppSystemScheduleApi / SearchInspectAppSystemScheduleApi / GetInspectAppSystemScheduleApi / InspectAppSystemScheduleStatusUpdateApi | 系统调度 |
| **合计** | **66** | - | - |

### 1.2 Orion inspection 现状（8 文件）

| 文件 | 行数 | 实现质量 | 关键问题 |
|------|------|---------|---------|
| service/service.go | 142 | 🚫 **桩代码** | RunInspection L49-59 置 "running" 后直接返回，无真实采集/阈值/报告 |
| service/service_interface.go | - | ✅ 接口 | RepositoryInterface 定义 |
| repository/repository.go | - | ✅ PG 持久化 | Record CRUD |
| models/models.go | 30 | 🚫 **简化** | 只有 Record struct（5 字段），无阈值/配置文件/报告模型 |
| handler/handler.go | - | ✅ HTTP 入口 | 路由完整 |
| handler/errors.go + validation.go | - | ✅ | 错误码 + 校验 |

### 1.3 颗粒度对比表（按 NeatLogic 子域）

| NeatLogic 子域 | API 数 | Orion 对应 | 覆盖率 | 缺口 |
|---------------|--------|-----------|--------|------|
| **configfile** | 13 | ❌ 无 | 0% | 配置文件管理完全缺失（版本比对/资源路径/清理） |
| **definition** | 13 | ⚠️ 部分（CreateRequest.Name/Status/Config） | 15% | 阈值规则（MongoDB Document）+ 集合管理全缺 |
| **job** | 7 | 🚫 桩（RunInspection 置 running） | 5% | 借 autoexec 引擎执行未接线 |
| **newproblem** | 10 | ❌ 无 | 0% | 新问题视图 + 报告导出/邮件全缺 |
| **report** | 14 | ⚠️ GetHistory（仅返回名字列表） | 7% | 报告导出 + 调度 + 访问端点脚本全缺 |
| **schedule** | 4 | ❌ 无 | 0% | 调度 consumer 全缺 |
| **合计** | **66** | - | **~5%** | **95% 缺口** |

### 1.4 关键代码实证

**Orion RunInspection 桩代码**（service.go:49-59）：
```go
func (s *Service) RunInspection(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
    rec, err := s.repo.GetByID(ctx, tenantID, id)
    if err != nil {
        return map[string]interface{}{"status": "ok", "inspectionId": id}, nil
    }
    rec.Status = "running"
    _, err = s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "running"})
    if err != nil {
        return nil, err
    }
    return map[string]interface{}{"status": "running", "inspectionId": id}, nil
}
```
**问题**：① 状态置 running 后无后台 worker ② 无采集 ③ 无阈值校验 ④ 无报告生成 ⑤ 错误时仍返回 status:ok。

**NeatLogic 阈值模型**（SaveInspectDefApi.java:64-76）：
```java
String name = paramObj.getString("name");
JSONArray thresholds = paramObj.getJSONArray("thresholds");
inspectCollectService.checkThresholdsParam(thresholds);
mongoTemplate.getCollection("_inspectdef").updateOne(whereDoc, setDocument);
```
**优势**：阈值规则用 MongoDB Document 存储，支持 JSONPath + FreeMarker 三层模型：
1. 集合数据定义（thresholds JSONArray）
2. 资源阈值源（GetInspectResourceThresholdsSourceApi）
3. 个性化阈值重写（per-resource override）

---

## 2. 自动化 autoexec 模块颗粒度对比

### 2.1 NeatLogic autoexec 90+ API 拆分（按 13 子域）

| 子域 | API 数 | 关键 API（举例） | Orion 对应 |
|------|--------|-----------------|-----------|
| **catalog** | 8 | AutoexecCatalogSaveApi / DeleteApi / MoveApi / TreeApi / FullTreeApi / SearchApi / TreeSearchApi | ❌ 无 |
| **combop** | 28 | AutoexecCombopGenerateApi / SaveApi / CopyApi / ImportApi / ExportApi / VersionSaveApi / VersionListApi / ProcessConfigInitApi / ProfileListApi / PhaseOperationDescriptionFieldApi | ⚠️ pipeline-template（简化） |
| **customtemplate** | 4 | DeleteCustomTemplateApi / GetCustomTemplateApi / SaveCustomTemplateApi / SearchCustomTemplateApi | ⚠️ pipeline-template（部分） |
| **job** | 22 | AutoexecJobSearchApi / PhaseListApi / PhaseNodeListApi / PhaseTopoApi / RunnerListApi / RunTimeParamGetApi / StatusApi / EnvApi / WaitingDetailApi / CleanApi / DeleteApi / ExportApi / GetAutoexecCombopJobSyncApi | ⚠️ pipeline-run-history（部分） |
| **operation** | 2 | AutoexecOperationParamListApi / AutoexecScriptAndToolSearchApi | ❌ 无 |
| **process** | 1 | CreateJobStepTestApi | ⚠️ pipeline-engine（部分） |
| **profile** | 4 | AutoexecProfileSaveApi / DeleteApi / GetApi / SearchApi | ❌ 无 |
| **risk** | 5 | AutoexecRiskSaveApi / DeleteApi / ListApi / MoveApi / SearchApi | ❌ 无 |
| **scenario** | 4 | AutoexecScenarioSaveApi / DeleteApi / GetApi / SearchApi | ❌ 无 |
| **schedule** | 6 | AutoexecScheduleSaveApi / DeleteApi / GetApi / ListApi / IsActiveUpdateApi / TestApi | ❌ 无（cron 字段存在但无 consumer） |
| **script** | 14 | AutoexecScriptReviewApi / CheckApi / CopyApi / DeleteApi / ExportApi / ImportApi / ImportPublicApi / GetApi / BaseInfoGetApi / BaseInfoSaveApi / FulltextIndexRebuildApi / RevokeApi / OrToolInputParamGetApi | ❌ 无 |
| **tool** | - | - | ❌ 无 |
| **type** | - | ListAutoexecCombopTypeExecutableApi | ❌ 无 |
| **合计** | **90+** | - | **~25%** |

### 2.2 NeatLogic job 模型 5 子域（核心架构）

| 子域 | 类数 | 作用 | Orion 对应 |
|------|------|------|-----------|
| **action/handler** | 12 | AutoexecJobCheckHandler / FireHandler / ReFireHandler / TakeOverHandler / PhaseIgnoreHandler / PhaseReFireHandler / PhaseRoundInformHandler | ⚠️ StageExecutor 部分（无 ReFire/TakeOver） |
| **action/handler/node** | 14 | AutoexecJobNodeAuditDownloadHandler / NodeAuditListHandler / NodeIgnoreHandler / NodeLogDownloadHandler / NodeLogTailHandler / NodeOperationListHandler / NodeInputDownloadHandler / NodeOutPutDownloadHandler / NodeReFireHandler / NodeResetHandler / NodeSubmitWaitInputHandler / NodeSqlContentGetHandler / NodeSqlFileDownloadHandler / NodeSqlListGetHandler | ❌ 无（无节点级操作） |
| **callback** | 1 | AutoexecJobNotifyCallbackHandler | ❌ 无 |
| **node** | 5 | UpdateNodesByFilterHandler / ByInputHandler / ByParamsHandler / ByPrePhaseOutputHandler / SelectHandler | ❌ 无（**这是参数链 P0 #44 的 NeatLogic 实现**） |
| **source** | 6 | CombopJobSourceHandler / CombopTestJobSourceHandler / ScriptTestJobSourceHandler / ServiceJobSourceHandler / ToolTestJobSourceHandler / AutoexecScheduleJobSourceHandler | ❌ 无 |
| **sync** | 1 | AutoexecJobSyncManager | ❌ 无 |

### 2.3 关键优秀能力（NeatLogic 独有）

| 能力 | NeatLogic 实现 | Orion 状态 | 借鉴价值 |
|------|---------------|-----------|---------|
| **脚本审核**（Script Review） | ScriptVersionStatus + AutoexecScriptReviewApi（pass/reject 工作流） | ❌ 无 | ⭐⭐⭐ 生产脚本必须审核 |
| **风险评级**（Risk） | AutoexecRiskVo（name/color/isActive/description）+ 5 API | ❌ 无 | ⭐⭐⭐ 执行前风险前置 |
| **场景管理**（Scenario） | AutoexecScenarioVo + 4 API（预定义"发布/回滚/扩容"） | ❌ 无 | ⭐⭐⭐ 一键场景化执行 |
| **组合工具生成**（Generate） | AutoexecCombopGenerateApi（script/tool → combop） | ❌ 无 | ⭐⭐ 复用脚本组合 |
| **节点级操作**（Node Handler） | 14 个 node handler（Audit/Log/Sql/Reset/ReFire/Submit） | ❌ 无 | ⭐⭐ 节点级精细控制 |
| **参数链传播**（ByPrePhaseOutput） | UpdateNodesByPrePhaseOutputHandler | 🚫 StageExecutor.go:507 自证未实现 | ⭐⭐⭐ P0 阻塞 |
| **调度真实消费**（Schedule） | AutoexecScheduleJobSourceHandler | ❌ cron 字段无 consumer | ⭐⭐ 定时执行 |
| **作业源**（Job Source） | 6 种来源（Combop/CombopTest/ScriptTest/Service/ToolTest/Schedule） | ❌ 无 | ⭐ 多源接入 |
| **通知回调**（Notify Callback） | AutoexecJobNotifyCallbackHandler | ❌ 无 | ⭐ 完成通知 |

---

## 3. 混沌工程能力对比

### 3.1 现状对比

| 维度 | NeatLogic | Orion | 评价 |
|------|-----------|-------|------|
| **独立混沌模块** | ❌ 无（散在 autoexec risk + scenario） | ✅ `internal/chaos/`（11 文件） | **Orion 反超** |
| **K8s 故障注入** | ❌ 无（NeatLogic 非 K8s 原生） | ✅ 6 类：cpu-spike / memory-leak / network-latency / service-down / pod-kill / pod-oom | **Orion 反超** |
| **自动回滚** | ⚠️ 借 autoexec rollback | ✅ Recover + cleanupStressPod + restoreDeployment | **Orion 反超** |
| **健康检查** | ⚠️ 借 inspect | ✅ HealthCheck（K8s API 可达性） | **Orion 反超** |
| **实验管理** | ❌ 无 | ✅ Experiment + ExperimentRun + InjectionRecord + RecoveryRecord | **Orion 反超** |
| **预发布验证** | ❌ 无 | ✅ PreReleaseVerify（4 项检查：experiment_cleanup / injection_quiet_period / health_endpoint / steady_state） | **Orion 反超** |
| **稳态假设** | ❌ 无 | ✅ SteadyStateHypothesis 字段 | **Orion 反超** |
| **风险评估** | ✅ AutoexecRiskVo（name/color/isActive/description）+ 5 API | ❌ 无 | **NeatLogic 优秀** |
| **场景管理** | ✅ AutoexecScenarioVo + 4 API | ❌ 无 | **NeatLogic 优秀** |
| **SPI 扩展** | ✅ autoexec JAR 热加载 | ❌ 无 | **NeatLogic 优秀** |

### 3.2 Orion chaos 关键代码实证

**injector.go 真实 K8s 注入**（631 行）：
- L236-266 injectCpuSpike：stress-ng pod 创建
- L269-299 injectMemoryLeak：stress-ng --vm 2 --vm-bytes
- L302-347 injectNetworkLatency：tc qdisc add dev eth0 root netem delay
- L350-383 injectServiceDown：deployment scale to 0
- L386-438 injectPodKill：pod 删除（按 percentage）
- L441-476 injectPodOOM：fallocate + 紧 memory limit

**service.go PreReleaseVerify**（L544-621）：
- 4 项预发布检查（experiment_cleanup / injection_quiet_period / health_endpoint / steady_state）
- 当前实现是 "skip" 桩（L931-951），需对接真实检查

**关键缺口**：
1. ExecuteCPUSpike 等函数 L208-234 调用 `s.execute()`，但 execute L628-690 在 injector=nil 时**只校验输入形状后返回 nil**——这是"无 injector 时静默成功"反模式
2. PreReleaseVerify 4 项检查全 "skip"（L931-951）——预发布验证是桩
3. SteadyStateHypothesis 字段存在但无消费——稳态假设未实现

### 3.3 NeatLogic risk/scenario 优秀能力详解

**AutoexecRiskSaveApi.java**（risk 评级）：
```java
@Input({
    @Param(name = "name", isRequired = true, maxLength = 50),
    @Param(name = "isActive", isRequired = true, rule = "0,1"),
    @Param(name = "color", isRequired = true),  // 风险颜色（红/黄/绿）
    @Param(name = "description", xss = true)
})
```
- 5 API：Save / Delete / List / Move / Search
- 与 combop 关联：每个组合操作有 riskLevel 字段
- 执行前根据 risk 级别决定是否需要审批

**AutoexecScenarioSaveApi.java**（场景管理）：
```java
@Input({
    @Param(name = "name", isRequired = true),
    @Param(name = "description")
})
```
- 4 API：Save / Delete / Get / Search
- 预定义场景：发布、回滚、扩容、缩容、备份、巡检
- 场景关联 combop + risk

---

## 4. 三类能力清单

### 4.1 NeatLogic 优秀能力（Orion 部分有，可增强）

| 编号 | 能力 | NeatLogic 实现 | Orion 现状 | 借鉴方向 |
|------|------|---------------|-----------|---------|
| E-1 | 参数链传播 | UpdateNodesByPrePhaseOutputHandler | StageExecutor.go:507 自证未实现 | 移植 NeatLogic node handler 模式 |
| E-2 | 节点级操作 | 14 个 node handler（Audit/Log/Sql/Reset/ReFire） | 无 | 引入 node action handler 概念 |
| E-3 | 作业源 | 6 种 JobSourceHandler | 无 | 引入 source handler SPI |
| E-4 | 通知回调 | AutoexecJobNotifyCallbackHandler | 无 | 增加 callback 子域 |
| E-5 | 调度真实消费 | AutoexecScheduleJobSourceHandler | cron 字段无 consumer | 接 cron consumer |
| E-6 | 报告导出 | InspectReportExportApi + AutoexecJobExportApi | 无 | 引入导出能力 |
| E-7 | 自定义视图 | SaveInspectNewProblemCustomViewApi | 无 | 视图自定义 |
| E-8 | 配置文件版本比对 | CompareInspectConfigFileVersionApi | 无 | 配置文件版本管理 |

### 4.2 NeatLogic 独有能力（Orion 完全无，需移植）

| 编号 | 能力 | NeatLogic API 数 | 迁移难度 | 工时 | 依赖 |
|------|------|-----------------|---------|------|------|
| U-1 | 巡检阈值引擎（MongoDB Document + JSONPath + FreeMarker 三层） | 13 definition API | 高 | 15d | MongoDB 接入 |
| U-2 | 巡检配置文件管理 | 13 configFile API | 中 | 10d | U-1 |
| U-3 | 巡检报告导出 + 调度 | 14 report + 4 schedule API | 中 | 12d | U-1 |
| U-4 | 巡检新问题视图 + 邮件 | 10 newproblem API | 中 | 8d | U-1 |
| U-5 | 风险评级 | 5 risk API | 低 | 5d | 无 |
| U-6 | 场景管理 | 4 scenario API | 低 | 5d | U-5 |
| U-7 | 脚本审核工作流 | 14 script API（重点 review） | 中 | 8d | U-5 |
| U-8 | 组合工具生成 | 1 generate API + 28 combop API | 中 | 10d | U-5/U-6 |
| **合计** | - | **92 API** | - | **73d** | - |

### 4.3 Orion 差异化能力（NeatLogic 无，应保留）

| 编号 | 能力 | Orion 实现 | NeatLogic 缺失 | 保留理由 |
|------|------|-----------|---------------|---------|
| D-1 | K8s 原生混沌注入 | 6 类故障（cpu/mem/net/svc/pod/oom） | 无 | NeatLogic 非 K8s 原生 |
| D-2 | 自动回滚 + 健康检查 | Recover + restoreDeployment + HealthCheck | 无 | NeatLogic 借 autoexec |
| D-3 | 实验管理 + 运行记录 | Experiment + ExperimentRun + InjectionRecord | 无 | NeatLogic 无实验概念 |
| D-4 | 预发布验证 | PreReleaseVerify（4 项检查） | 无 | NeatLogic 无 |
| D-5 | 稳态假设字段 | SteadyStateHypothesis | 无 | NeatLogic 无 |
| D-6 | Saga 协调 + gRPC | pipeline-engine 3163 行 | 无 | NeatLogic 单进程 |
| D-7 | SLA 引擎 + violations | sla-engine | 无 | NeatLogic SLA 内嵌 |
| D-8 | branch-policy | BranchProfile/NamespaceBinding/SyncPolicy | 无 | NeatLogic 无 branch 概念 |

---

## 5. 巡检能力补全方案

### 5.1 Phase 1：止损（15 人天）

| 编号 | 任务 | 文件 | 工时 | 验收 |
|------|------|------|------|------|
| P1-1 | 修 RunInspection 桩代码 | `internal/inspection/service/service.go:49-59` | 5d | 真实触发后台采集 + 状态机 |
| P1-2 | 实现 3 个硬编码 health checker | 检查 `return {"status":"ok"}` 全仓 | 5d | 真实 health check |
| P1-3 | service.go PreReleaseVerify 4 项桩 | `internal/chaos/service/service.go:931-951` | 5d | 真实检查替代 "skip" |

### 5.2 Phase 2：阈值引擎（20 人天）

| 编号 | 任务 | 实现 | 工时 | 依赖 |
|------|------|------|------|------|
| P2-1 | MongoDB 阈值定义存储 | 接入 MongoDB（`_inspectdef` collection） | 5d | MongoDB 实例 |
| P2-2 | 阈值规则 3 层模型 | ① 集合数据定义 ② 资源阈值源 ③ 个性化重写 | 8d | P2-1 |
| P2-3 | JSONPath 表达式求值 | 引入 gojsonpath 或 ceval | 4d | P2-2 |
| P2-4 | FreeMarker 模板支持 | 引入 Go template 或 ftl | 3d | P2-2 |

### 5.3 Phase 3：配置文件管理（10 人天）

| 编号 | 任务 | NeatLogic 对标 | 工时 |
|------|------|---------------|------|
| P3-1 | 配置文件 CRUD | 13 configFile API | 4d |
| P3-2 | 版本比对（diff） | CompareInspectConfigFileVersionApi | 3d |
| P3-3 | 资源路径管理 | SaveInspectConfigFileResourcePathApi | 3d |

### 5.4 Phase 4：报告 + 调度（12 人天）

| 编号 | 任务 | NeatLogic 对标 | 工时 |
|------|------|---------------|------|
| P4-1 | 报告导出（PDF/Excel） | InspectReportExportApi | 5d |
| P4-2 | 调度 consumer | SaveInspectAppSystemScheduleApi + cron | 4d |
| P4-3 | 报告历史 + 邮件通知 | InspectReportHistoryListApi + SendEmailApi | 3d |

### 5.5 Phase 5：新问题视图（8 人天）

| 编号 | 任务 | NeatLogic 对标 | 工时 |
|------|------|---------------|------|
| P5-1 | 新问题 CRUD | InspectNewProblemReportListApi | 3d |
| P5-2 | 自定义视图（4 API） | Save/Move/Rename/UpdateCustomView | 3d |
| P5-3 | 邮件发送 + 每日刷新 | SendEmailApi + RefreshAlertEverydayApi | 2d |

**巡检合计**：15+20+10+12+8 = **65 人天**

---

## 6. 混沌工程能力补全方案

### 6.1 Phase 1：修复"无 injector 静默成功"反模式（5 人天）

| 编号 | 任务 | 文件 | 工时 |
|------|------|------|------|
| C1-1 | execute() 在 injector=nil 时返回错误而非 nil | `internal/chaos/service/service.go:628-690` | 3d |
| C1-2 | PreReleaseVerify 4 项桩实现真实化 | `service.go:931-951` | 2d |

### 6.2 Phase 2：风险评估（借鉴 NeatLogic risk）（8 人天）

| 编号 | 任务 | NeatLogic 对标 | 工时 |
|------|------|---------------|------|
| C2-1 | Risk model + CRUD（name/color/isActive/description） | AutoexecRiskSaveApi 5 API | 3d |
| C2-2 | 风险级别与实验关联 | Experiment.RiskLevel 字段 | 2d |
| C2-3 | 高风险实验需审批门控 | AutoexecRiskListApi + 审批工作流 | 3d |

### 6.3 Phase 3：场景管理（借鉴 NeatLogic scenario）（6 人天）

| 编号 | 任务 | NeatLogic 对标 | 工时 |
|------|------|---------------|------|
| C3-1 | Scenario model + CRUD | AutoexecScenarioSaveApi 4 API | 3d |
| C3-2 | 预定义场景（发布/回滚/扩容/巡检） | 场景与 chaos Experiment 关联 | 3d |

### 6.4 Phase 4：稳态假设 + 通知回调（6 人天）

| 编号 | 任务 | 实现 | 工时 |
|------|------|------|------|
| C4-1 | SteadyStateHypothesis 真实消费 | 字段已存在，接 metrics 求值 | 3d |
| C4-2 | Notify Callback Handler | 借 AutoexecJobNotifyCallbackHandler | 3d |

**混沌合计**：5+8+6+6 = **25 人天**

---

## 7. 升级路线图（依赖图 + 顺序 + 工时）

### 7.1 依赖图

```
[Phase 0: 基础设施]
  ├── MongoDB 接入（阈值引擎依赖）
  └── cron consumer 框架（调度依赖）
        ↓
[Phase 1: 止损]
  ├── P1-1 修 RunInspection 桩
  ├── P1-2 修 3 个 health checker
  ├── C1-1 修 chaos 静默成功
  └── C1-2 PreReleaseVerify 真实化
        ↓
[Phase 2: 阈值引擎 + 风险评估]
  ├── P2-1~P2-4 阈值 4 任务（依赖 MongoDB）
  ├── C2-1~C2-3 风险评估 3 任务（无依赖）
  └── C3-1~C3-2 场景管理 2 任务（依赖 C2-1）
        ↓
[Phase 3: 配置文件 + 场景化]
  ├── P3-1~P3-3 配置文件 3 任务（依赖 P2-2）
  └── C4-1~C4-2 稳态 + 通知 2 任务
        ↓
[Phase 4: 报告 + 调度]
  ├── P4-1~P4-3 报告 + 调度 3 任务（依赖 P3）
  └── P5-1~P5-3 新问题视图 3 任务（依赖 P4）
        ↓
[Phase 5: 产品化]
  ├── U-7 脚本审核工作流
  └── U-8 组合工具生成
```

### 7.2 迁移顺序 + 按子域工时

| 顺序 | Phase | 任务编号 | 子域 | 工时 | 累计 |
|------|-------|---------|------|------|------|
| 1 | 0 | INFRA-1 | MongoDB 接入 | 3d | 3d |
| 2 | 0 | INFRA-2 | cron 框架 | 2d | 5d |
| 3 | 1 | P1-1 | RunInspection 修桩 | 5d | 10d |
| 4 | 1 | P1-2 | health checker | 5d | 15d |
| 5 | 1 | C1-1 | chaos 静默修复 | 3d | 18d |
| 6 | 1 | C1-2 | PreReleaseVerify | 2d | 20d |
| 7 | 2 | P2-1 | 阈值定义存储 | 5d | 25d |
| 8 | 2 | P2-2 | 阈值 3 层模型 | 8d | 33d |
| 9 | 2 | P2-3 | JSONPath 求值 | 4d | 37d |
| 10 | 2 | P2-4 | FreeMarker 模板 | 3d | 40d |
| 11 | 2 | C2-1 | Risk CRUD | 3d | 43d |
| 12 | 2 | C2-2 | Risk 关联实验 | 2d | 45d |
| 13 | 2 | C2-3 | Risk 审批门控 | 3d | 48d |
| 14 | 2 | C3-1 | Scenario CRUD | 3d | 51d |
| 15 | 2 | C3-2 | 预定义场景 | 3d | 54d |
| 16 | 3 | P3-1 | 配置文件 CRUD | 4d | 58d |
| 17 | 3 | P3-2 | 版本比对 | 3d | 61d |
| 18 | 3 | P3-3 | 资源路径 | 3d | 64d |
| 19 | 3 | C4-1 | 稳态假设 | 3d | 67d |
| 20 | 3 | C4-2 | 通知回调 | 3d | 70d |
| 21 | 4 | P4-1 | 报告导出 | 5d | 75d |
| 22 | 4 | P4-2 | 调度 consumer | 4d | 79d |
| 23 | 4 | P4-3 | 报告历史 + 邮件 | 3d | 82d |
| 24 | 4 | P5-1 | 新问题 CRUD | 3d | 85d |
| 25 | 4 | P5-2 | 自定义视图 | 3d | 88d |
| 26 | 4 | P5-3 | 邮件发送 | 2d | 90d |
| 27 | 5 | U-7 | 脚本审核 | 8d | 98d |
| 28 | 5 | U-8 | 组合工具生成 | 10d | 108d |

### 7.3 ROI 排序（前 10 项必做）

| 排名 | 任务 | 工时 | ROI 理由 |
|------|------|------|---------|
| 1 | P1-1 RunInspection 修桩 | 5d | 消除信誉级风险，客户演示必翻车 |
| 2 | C1-1 chaos 静默修复 | 3d | 消除"假成功"反模式 |
| 3 | P1-2 health checker | 5d | 消除假阳性工厂 |
| 4 | C1-2 PreReleaseVerify | 2d | 让预发布验证真实可用 |
| 5 | INFRA-1 MongoDB 接入 | 3d | 阈值引擎前置依赖 |
| 6 | P2-1 阈值定义存储 | 5d | 巡检核心能力 |
| 7 | P2-2 阈值 3 层模型 | 8d | 巡检差异化能力 |
| 8 | C2-1 Risk CRUD | 3d | 风险前置，所有执行依赖 |
| 9 | C3-1 Scenario CRUD | 3d | 场景化执行 |
| 10 | P3-1 配置文件 CRUD | 4d | 配置文件管理 |

**前 10 项合计**：41 人天 / ~8 周（1 人） / ~3 周（3 人并行）

### 7.4 全量工时汇总

| Phase | 工时 | 累计 |
|-------|------|------|
| Phase 0 基础设施 | 5d | 5d |
| Phase 1 止损 | 15d | 20d |
| Phase 2 阈值 + 风险 | 30d | 50d |
| Phase 3 配置 + 稳态 | 15d | 65d |
| Phase 4 报告 + 调度 | 20d | 85d |
| Phase 5 产品化 | 18d | 103d |
| **总计** | **103d** | - |

**3 人并行**：103/3 ≈ 35 工作日 ≈ **7 周**

---

## 8. 复用评估

### 8.1 可复用 Orion 现有模块

| NeatLogic 能力 | Orion 复用 | 复用方式 |
|---------------|-----------|---------|
| Schedule 调度 | pipeline-audit-log + cron 框架 | 接 cron consumer |
| Notify Callback | notification 模块 | 复用通知发送 |
| Report Export | report-designer（执行内核需修复） | 复用 ExecuteReport 路径 |
| Risk 关联 | chaos Experiment | 加 RiskLevel 字段 |
| Scenario 关联 | chaos Experiment | 加 ScenarioID 字段 |
| 脚本审核 | approval 模块 | 复用审批工作流 |

### 8.2 需新建模块

| 能力 | 新建模块 | 理由 |
|------|---------|------|
| 阈值引擎 | `internal/inspection-threshold/` | MongoDB + JSONPath + FreeMarker 三层 |
| 配置文件管理 | `internal/inspection-configfile/` | 独立子域 |
| 风险评级 | `internal/risk/` | 跨域复用（chaos + autoexec + inspect） |
| 场景管理 | `internal/scenario/` | 跨域复用 |

---

## 9. 与 v2 报告的差异

| 维度 | v2 报告 | 本报告 | 提升 |
|------|--------|--------|------|
| 巡检颗粒度 | 5 service vs 1 service | 66 API 拆 6 子域 + 87% 缺口 | 识别 → 功能级 |
| 自动化颗粒度 | 12/16 子域缺失 | 90+ API 拆 13 子域 + 25% 覆盖 | 识别 → 功能级 |
| 混沌对比 | 未对比 | Orion 反超 NeatLogic（K8s 原生） | 新增维度 |
| 优秀能力 | 4 大反模式 | 8 项优秀能力 + 8 项独有能力 | 识别 → 可借鉴清单 |
| 迁移顺序 | Phase 1-4 聚合工时 | 28 项任务依赖图 + 按子域工时 | 聚合 → 任务级 |
| ROI | 7 项止损 | 10 项必做 + 全量 103d | 止损 → 路线图 |
| 复用评估 | 未评估 | 6 项可复用 + 4 项新建 | 无 → 复用矩阵 |

---

## 10. 认知边界

1. **本报告基于 NeatLogic Java 源码实证**（autoexec 90+ API + inspect 66 API + Orion chaos/injector.go 631 行 + inspection/service.go 142 行全量读取）
2. **本报告颗粒度支持迁移规划**（按子域工时 + 依赖图 + ROI 排序 + 复用评估）
3. **未做到**：① 巡检 66 API 每个 Java 文件全量读取（只读 4 个关键 API）② autoexec job 5 子域 38 个类全量读取（只读 2 个）③ TS 遗留代码按子域映射（CITypeService 469 行未在巡检/混沌范围）
4. **建议下一步**：① 读取剩余 62 个巡检 API + 36 个 autoexec job 类 ② 评估 TS 遗留代码在巡检/混沌的可移植性 ③ 启动 Phase 0 + Phase 1 止损

---

**报告版本**：v3（颗粒度对比 + 补全方案）
**发布日期**：2026-10-01
**建议读者**：CTO / VP Engineering / 巡检与混沌工程团队
**建议下一步**：
1. 启动 Phase 0 + Phase 1 止损（20 人天 / 4 周 3 人并行）
2. 评估 MongoDB 接入可行性（1 周）
3. 读取剩余 NeatLogic API 文件补全迁移规划（1 周）
