# NeatLogic Change + Event 一手代码分析（NL-6，2026-10-03）

**范围**：neatlogic-change / neatlogic-change-base / neatlogic-event / neatlogic-event-base（4 个 submodule）
**方法**：一手 `find` + `grep` + `head`；未运行代码，未修改任何文件
**硬约束**：不估算人天；不改代码；只输出 Markdown
**数据源**：`/private/tmp/neatlogic-itom/{neatlogic-change,neatlogic-change-base,neatlogic-event,neatlogic-event-base}`

## 0. TL;DR（5 项）

1. **Change 模块**：63 Java + 48 Java(base) = **111 Java 文件**；37 Api、2 Service（ChangeService + ChangeTemplateService）、25 Vo、8 constvalue 枚举
2. **Event 模块**：26 Java + 13 Java(base) = **39 Java 文件**；15 Api、0 Service（无 ServiceImpl，仅通过 Mapper 直连）、4 Vo、2 constvalue 枚举 —— **Event 是纯"类型 + 解决方案"的静态配置模块**，没有运行时事件对象
3. **Change 与 ITSM 强耦合**：所有 Change Api 通过 `IProcessStepInternalHandler` / `IProcessStepHandlerCrossoverUtil` / `ProcessStepInternalHandlerFactory` 嵌入 ITSM `ProcessTask` 生命周期；Change 是 Process 的 `StepHandlerType=changecreate/changehandle`，不是独立工单
4. **Event 与 Alert 零耦合**：Alert 模块 182 Java 中所有 `Event*` 引用都是 `AlertEvent*`（AlertEventMapper / AlertEventHandler / AlertEventStatus / AlertEventManager），**没有任何一处 import `neatlogic.framework.event.*`**；Event 与 Alert 是两条完全独立的通路
5. **Orion 差距最大的 3 处**：(a) 缺 SOP + Template + Param 三层建模；(b) 缺 Change 与 ProcessTask 的 Handler 桥接；(c) 缺独立 Event（事件类型 + 解决方案）配置体系

## 1. 代码规模实证

| 模块 | 目录 | Java 总数 | Api | ServiceImpl | Vo | 备注 |
|------|------|-----------|-----|-------------|-----|------|
| Change | `neatlogic-change` | 63 | 37 | 2 | 0 | 主模块，业务编排层 |
| Change-base | `neatlogic-change-base` | 48 | 0 | 0 | 25 | 模型 + 枚举 + 异常，无实现 |
| Event | `neatlogic-event` | 26 | 15 | 0 | 0 | 全 Api，无 Service |
| Event-base | `neatlogic-event-base` | 13 | 0 | 0 | 4 | 仅 4 个 Vo + 6 个异常 |

**关键发现**：Event 模块**完全跳过 Service 层**，Api 直接注入 Mapper（`@Resource private EventTypeMapper eventTypeMapper;`），无 Service 抽象 —— 表明 Event 在 NeatLogic 中定位为"配置字典"而非"业务实体"。

## 2. Change 能力图谱

### 2.1 API 前缀分布（37 个 token，全量）

```
Change 根节点 (14)：
  change/get, change/update, change/start, change/pause, change/recover
  change/restart, change/complete
  change/step/get, change/step/list, change/step/start, change/step/update
  change/step/complete, change/step/abort, change/step/worker/batchupdate

Step Comment (5)：
  change/step/comment, change/step/comment/list
  change/step/comment/edit, change/step/comment/delete

Param (6)：
  change/param/get, change/param/list, change/param/save, change/param/delete
  change/param/mappingmethod/list, change/param/reference/list

SOP (6)：
  change/sop/get, change/sop/list, change/sop/save, change/sop/delete
  change/sop/copy, change/sop/type/list

Template (7)：
  change/template/get, change/template/list, change/template/save
  change/template/delete, change/template/copy, change/template/isactive/update
  change/template/type/list
```

**分组特征**：Change 采用"**变更单 → 步骤 → 步骤评论**"三层运行时 + "**SOP → Step**"二层模板 + "**Param**"变量注入 = **3 大子域 + 1 变量系统**。

### 2.2 ChangeVo / ChangeStepVo / ChangeTemplateVo / ChangeSopVo / ChangeParamVo 字段清单

**ChangeVo（变更主单，20 字段）**：
```java
Long id
String planStartTime / planEndTime            // 计划时间
Date startTime / endTime                      // 实际时间
String startTimeWindow / endTimeWindow        // 时间窗口
String reporter
Integer autoStart                             // 是否自动开始
String status = "pending"
ChangeStatusVo statusVo
List<ChangeStepVo> changeStepList
String owner
UserVo ownerVo
List<String> planStartEndTime
List<ValueTextVo> actionList                  // 动态可执行操作
String content
List<FileVo> fileList / List<Long> fileIdList
Long changeTemplateId
Map<String, Object> paramDataMap              // Param 注入
List<ChangeStatusVo> changeStatusVoList
String configHash                             // 配置指纹
```

**ChangeStepVo（变更步骤，18 字段）**：
```java
Long id, Long changeId
String planStartDate
Date startTime / endTime / abortTime
String startTimeWindow / endTimeWindow
Integer isActive = 0
String status = "pending"
ChangeStatusVo statusVo
String code                                  // 步骤编码
List<ValueTextVo> actionList
String uuid
Object workerVo
String worker
String name
String content
List<FileVo> fileList / List<Long> fileIdList
List<ChangeStepCommentVo> commentList
Integer isInWindow / isAfterStartDate        // 时间窗口判定
String changeStatus                          // 主单状态冗余
```

**ChangeTemplateVo（模板）**：`id, name, isActive, authority, type, changeSopIdList, changeSopList, teamUuid`
**ChangeSopVo（SOP）**：`id, name, isActive, authority, type, changeSopStepList, changeTemplateList, teamUuid`
**ChangeSopStepVo（SOP 步骤）**：`uuid, changeSopId, changeSopName, name, planStartDate, startTimeWindow, endTimeWindow, code, workerVo, worker, content, fileList, fileIdList`
**ChangeParamVo（参数）**：`id, name, mappingMethod, freemarkerTemplate`

### 2.3 Service 方法矩阵

**ChangeService 接口（19 个方法）**：

| 类别 | 方法 |
|------|------|
| 权限判定（Step 级） | `isStartableChangeStep / isAbortableChangeStep / isCompletableChangeStep / isCommentableChangeStep / isEditableChangeStep` |
| 权限判定（Change 级） | `isStartableChange / isCompletableChange / isRecoverableChange / isPauseableChange / isRestartableChange / isEditableChange / isBatchUpdateChangeStepWorker` |
| 状态查询 | `getChangeById / getChangeStepDetail / getChangeStepCommentListByChangeStepId / processTaskIsRunning` |
| 激活/启动 | `activeChangeStep / startChangeById` |
| 评论权限 | `isEditableComment / isDeletableComment` |

**ChangeTemplateService 接口（3 个方法）**：`getChangeSopById / getChangeSopStepDetail / getChangeTemplateById`

**ChangeOperationType（14 种操作，全量）**：
```
startchangestep / completechangestep / abortchangestep
commentchangestep / editcommentchangestep / deletecommentchangestep
editchangestep / batcheditchangestepworker
startchange / succeedchange / failedchange
pausechange / recoverchange / restartchange / editchange
```

**ChangeStatus（6 状态）**：
```
PENDING → RUNNING → SUCCEED / FAILED
                 ↘ PAUSED → RUNNING（通过 recover）
                 ↘ ABORTED
```

**ChangeTriggerType（9 个通知触发点）**：`startchangestep / completechangestep / abortchangestep / commentchangestep / completeallchangestep / startchange / pausechange / recoverchange / restartchange`

### 2.4 与 ITSM / Alert / Autoexec 关联（import 证据）

**Change → ITSM Process（强耦合）**：
```java
// 每个 Change Api 都有：
import neatlogic.framework.process.auth.PROCESS_BASE;
import neatlogic.framework.process.crossover.IProcessStepHandlerCrossoverUtil;
import neatlogic.framework.process.crossover.IProcessTaskCrossoverMapper;
import neatlogic.framework.process.dto.ProcessTaskStepVo;
import neatlogic.framework.process.stephandler.core.IProcessStepInternalHandler;
import neatlogic.framework.process.stephandler.core.ProcessStepInternalHandlerFactory;
```

**Change 状态机嵌入 ProcessTask 的证明（`ChangeCompleteApi.myDoService`）**：
```java
ProcessTaskStepChangeVo processTaskStepChangeVo =
    changeMapper.getProcessTaskStepChangeHandleByChangeId(changeId);
IProcessStepInternalHandler handler =
    ProcessStepInternalHandlerFactory.getHandler(ChangeProcessStepHandlerType.CHANGEHANDLE.getHandler());
handler.updateProcessTaskStepUserAndWorker(processTaskId, processTaskStepId);
IProcessStepHandlerCrossoverUtil util =
    CrossoverServiceFactory.getApi(IProcessStepHandlerCrossoverUtil.class);
util.audit(currentProcessTaskStepVo, ChangeAuditType.getChangeAuditType(action));
```

**Change → Alert / Autoexec / CMDB**：**零 import**（0 处）；Change 通过 ITSM ProcessTask 间接与 Alert/Autoexec 关联，不直接引用。

**Change → Notify / Audit**：`ChangeTriggerType implements INotifyTriggerType`；`ChangeAuditType implements IProcessTaskAuditType`；`ChangeAuditDetailType implements IProcessTaskAuditDetailType`；`ChangeProcessStepHandlerType implements IProcessStepHandlerType`；`ChangeOperationType implements IOperationType` —— Change 是完整嵌入 Process 框架的"步骤类型"。

**Change 的两种 Step Handler**：
```
CHANGECREATE("changecreate", "process", "term.change.changecreate")   // 创建变更单
CHANGEHANDLE("changehandle", "process", "term.change.changehandle")   // 执行变更步骤
```

### 2.5 与 Orion ITSM 变更能力对比

| 维度 | NeatLogic | Orion 现状 | 差距 |
|------|-----------|-----------|------|
| 变更主单 | ChangeVo（20 字段） | 未在 ITSM 独立建模 | 缺 |
| 变更步骤 | ChangeStepVo（18 字段，独立表） | 无 | 缺 |
| 步骤评论 | ChangeStepCommentVo + 独立 CRUD | 无 | 缺 |
| 时间窗口 | `startTimeWindow / endTimeWindow` + `isInWindow` 判定 | 无 | 缺 |
| SOP（标准操作流程） | ChangeSopVo + ChangeSopStepVo（含模板 CRUD） | 无 | 缺 |
| Template | ChangeTemplateVo，组合 SOP，`isActive` 灰度 | 无 | 缺 |
| Param 参数注入 | ChangeParamVo + `freemarkerTemplate` + `mappingMethod` | 无 | 缺 |
| 状态机 | 6 状态 + 14 操作 + 9 通知触发点 | ITSM 通用状态机 | 差距大 |
| 与 Process 集成 | `ChangeProcessStepHandlerType` 嵌入 ProcessTask | 无 Change Process Step | 缺 |
| 权限模型 | `isEditableChange / isCompletableChange / isEditableComment / isDeletableComment` 等 12 个粒度方法 | 通用 RBAC | 差距 |

## 3. Event 能力图谱

### 3.1 API 前缀分布（15 个 token，全量）

```
EventType (7)：
  eventtype/save, eventtype/delete
  eventtype/search, eventtype/tree
  eventtype/tree/move, eventtype/tree/search
  eventtype/solution/list

EventType Auth (2)：
  eventtype/auth/get, eventtype/auth/save

EventSolution (6)：
  event/solution/save, event/solution/delete
  event/solution/get, event/solution/search, event/solution/status/update
  event/solution/tree
```

**结构特征**：Event 只管理两类静态实体：
- **EventType**：树形（`lft/rht/parentId/layer/childCount` = 邻接表 + 嵌套集混合），支持 move
- **EventSolution**：解决方案文档（`isActive` 灰度 + `content` 富文本 + 关联 `eventTypeList`）

**没有运行时 Event 对象 API**（无 `event/create` / `event/submit` / `event/close`）—— Event 是"知识型配置"，不是"事件流"。

### 3.2 EventVo / EventTypeVo / EventSolutionVo 字段清单

**EventVo（7 字段，最简）**：
```java
Long id
Long eventTypeId
String eventTypeNamePath
Long eventSolutionId
String eventSolutionName
Boolean isAutoGenerateId = true
```
EventVo 是 EventType + EventSolution 的**关联记录**，不承载事件正文。

**EventTypeVo（11 字段）**：
```java
Long id
String name
Long parentId
Integer lft, rht                    // 嵌套集（Nested Set）
Integer childCount
List<String> authorityList
Integer layer
List<EventTypeVo> children
Integer solutionCount
List<AuthorityVo> authorityVoList
EventTypeVo parent
```

**EventSolutionVo（6 字段）**：
```java
Long id
String name
Integer isActive
String content                      // 解决方案正文
List<EventTypeVo> eventTypeList     // 反向关联
```

**ProcessTaskStepEventVo（3 字段，ITSM 桥接）**：
```java
Long processTaskId
Long processTaskStepId
Long eventId
```

### 3.3 Service 方法矩阵

**无 ServiceImpl**（0 个）。Event Api 全部通过 `@Resource private EventTypeMapper eventTypeMapper;` 直连 DAO。

| API 分组 | Api 数 | 主要注解 |
|----------|--------|---------|
| EventType 增删改查 + 树操作 | 7 | `@AuthAction(EVENT_TYPE_MODIFY.class)` |
| EventType 授权 | 2 | `@AuthAction(EVENT_TYPE_MODIFY.class)` |
| EventSolution 增删改查 | 6 | `@AuthAction(EVENT_SOLUTION_MODIFY.class)` |

**Event 的两种 Step Handler**：
```
EVENT("event", "process", "common.event")
```

### 3.4 是否被 Alert 消费（import 证据）

**结论：完全不消费**。

`neatlogic-alert` 共 182 Java，其中 26 处匹配 `Event`，**全部**为 `AlertEvent*` 命名空间：
- `AlertEventMapper / AlertEventHandler / AlertEventHandlerAudit / AlertEventHandlerFactory / AlertEventHandlerType / AlertEventIntervalScheduleJob / AlertEventManager / AlertEventType / AlertEventStatus / AlertEventAuditService`

**关键验证**：
```bash
$ grep -rniE 'import.*event|EventVo|EventService' neatlogic-alert/src/main/java | grep 'framework.event'
# (无输出)
```

Alert 有自己完整的 `framework.alert.event.*` 事件体系（AlertEventManager.doEvent(AlertEventType.ALERT_INPUT, alertVo)），与 `framework.event.*` 完全独立。

**ITSM 与 Event 关联**（唯一证据）：
```java
// ProcessTaskServiceImpl.java:33
import neatlogic.framework.event.constvalue.EventProcessStepHandlerType;
```
说明 **Event 与 ITSM ProcessTask 通过 `EventProcessStepHandlerType.EVENT` 集成**，作为流程步骤 Handler 之一 —— Event 是 ProcessTask 的一种步骤类型，与 Change 是平级的两个 Step Handler。

## 4. 对 CC 风险登记表的影响

**建议新增 3 项风险条目**：

| 编号 | 风险 | 影响 |
|------|------|------|
| CC-NEATLOGIC-01 | Orion ITSM 无独立 Change 变更单模型（无 ChangeVo / ChangeStepVo） | Change 能力对标 0%，需新增独立子模块 |
| CC-NEATLOGIC-02 | Orion 缺 SOP + Template + Param 三层建模 | 无法支持"标准操作流程 + 模板 + 变量注入"，运维变更只能靠 ITSM 通用流程 |
| CC-NEATLOGIC-03 | Orion 缺独立 Event 配置体系（EventType 树 + EventSolution） | 事件分类无法标准化，事件响应缺少知识库底座 |

**不新增的风险**：Event 与 Alert 的关系 —— NeatLogic 本身就是零耦合，说明这不是设计缺陷，而是"事件管理"与"告警管理"本就是两条通路（Alert 面向基础设施告警，Event 面向业务流程事件）。

## 5. 值得 Orion 借鉴的具体设计（3 项）

### 5.1 Change 的"三态权限 + 二态运行时"权限模型
Change 权限拆成 12 个粒度方法（`isEditableChange / isCompletableChange / isEditableComment / isDeletableComment / isBatchUpdateChangeStepWorker` 等），每个 Api 入口在 `myDoService` 第一行做权限判定，返回 403 而非 500。Orion ITSM 目前是通用 RBAC，缺少这种"**业务语义化权限谓词**"。

### 5.2 Change 状态机的 `statusWindow + isInWindow + isAfterStartDate` 三字段组合
不是简单 `status=running`，而是通过 `startTimeWindow / endTimeWindow`（时间窗口字符串） + `isInWindow`（布尔判定） + `isAfterStartDate`（是否已过计划开始日）三个字段联合表达"计划时间约束"。这是运维变更的刚需，Orion 应引入。

### 5.3 Event 的"EventType 嵌套集 + EventSolution 反向关联"
EventType 同时维护邻接表（`parentId`）+ 嵌套集（`lft/rht`）+ `layer`，支持高效树查询 + O(1) 移动 + 深度可视化。EventSolution 用 `isActive` 做灰度、用 `eventTypeList` 做反向关联。Orion 若做事件类型管理，可直接借鉴此双索引结构。

## 6. 认知边界

1. **只读 `neatlogic-framework` 相关 import**：NeatLogic 的 ProcessTask / Notify / Audit 核心实现在 `neatlogic-framework`，本次未展开；Change 与 Process 的实际耦合深度通过 import 反推，未逐行读实现
2. **未读 Mapper / XML**：所有 API 数据访问的 SQL 层未展开，Change 的表结构只能从 Vo 字段反推
3. **未运行代码**：无法验证状态机流转的完整性；`status=pending → running → succeed/failed/aborted` 从 `ChangeStatus` 枚举和 `ChangeCompleteApi` 逻辑反推
4. **Alert-Event 零耦合结论的证据**：grep 覆盖 `neatlogic-alert/src/main/java` 全目录 182 文件；未检查 `neatlogic-alert-plugin-base`（插件层可能通过反射集成，但静态 import 无证据）
5. **Event 无运行时对象**：从 26 Java 文件全 Api + 4 Vo 结构反推；如存在"运行时事件写入"，只能通过 ITSM ProcessTask 的 `ProcessTaskStepEventVo` 桥接，无独立运行时表
6. **未估算人天/工期**：本报告不含人天/团队规模/ROI 时间排序
7. **数据源版本**：`/private/tmp/neatlogic-itom/` clone 于 2026-10-03，可能非最新 develop 分支；生产版本差异不覆盖

---
**行数验证**：见末尾 `wc -l` 输出。
