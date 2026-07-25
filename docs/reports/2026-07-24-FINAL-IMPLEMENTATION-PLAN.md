# Orion × NeatLogic 扩展点对标 — 最终待实施计划

> 生成日期: 2026-07-24 | 版本: v3.0（评审后二次修正）
> 数据源: COMBINED-ANALYSIS + 扩展点指南 + 实施完成度 + 45 份 NeatLogic 文档 + Orion 统一规范 + ADR-015
> 分支: feat/wave2-parallel-execution

---

## 执行摘要

本计划基于 45 份 NeatLogic 文档 + 扩展点指南，识别出 **30 个扩展点**，其中 **11 个已落地**（Go 层已有 4 层架构），**3 个开发中**，**16 个未启动**。经启动领域资深专家团队评审，10 项 blocking 问题已全部修正。

**核心路线**: 统一扩展点框架(Phase 0) → 基础设施(Phase 1) → ITSM 流程引擎(Phase 2a/2b) → 告警(Phase 3) → CMDB(Phase 4) → 自动化(Phase 5) → 补充(Phase 6) → 验证(Phase 7) = **15 周 / 95 人天**

---

## 评审修正清单

| 编号 | 问题 | 修正 |
|------|------|------|
| ERR-01 | `startup` 标记为[增强]但 Go 目录不存在 | 改为 **[新建]** |
| ERR-02 | 落地状态表只列 5 个，实际 11 个 Go 包有完整 4 层架构 | 扩展为 **11 个** |
| ERR-03 | `auto-exec` 描述为"蓝图"但实际有 5 个 Go 文件(接口/工厂/测试) | 改为"有接口定义+工厂+测试" |
| ARC-01 | 缺少新旧代码集成策略 | 新增 **§5 集成策略** |
| ARC-02 | 缺少扩展点生命周期管理 | 增加 priority/version/enabled/回调 |
| PRI-01 | 集成处理器(#9)为 P1 实为 P0 | 改为 **P0** |
| PRI-03 | 全局锁(#10)不应作为扩展点 | **移除**，改为框架内部能力 |
| NAM-01 | NeatLogic 原始命名 vs Orion 映射名混用 | 映射表新增"NeatLogic 原始接口"列 |
| PLAN-01 | Phase 2 粒度太粗(5 扩展点强依赖) | 拆为 **2a(核心流程)+2b(辅助能力)** |
| PLAN-04 | 缺少验证阶段 | 新增 **Phase 7 全量验证** |

---

## 一、分析总览

### 1.1 评估修正

| 维度 | COMBINED 评估 | 扩展点视角修正 | 评审后修正(v3.0) |
|------|-------------|--------------|-----------------|
| 已识别模式 | 12 个 | 30+ 个 | **29 个**（移除全局锁） |
| 已落地 | 5/12 (42%) | 5/30+ (17%) | **11/29 (38%)**（Go 已存在 11 个包） |
| 进行中 | 5/12 (42%) | 5/30+ (17%) | **3/29 (10%)**（auto-exec/cmdb/alert 非纯蓝图） |
| 未启动 | 2/12 (17%) | 20+/30+ (66%) | **15/29 (52%)** |
| 最大差距 | 自动化执行引擎 | 统一扩展点框架 + ITSM 5 扩展点 + CMDB 2 扩展点 | 同左，ITSM 在 TS 实现，CMDB 在 Go 实现 |

### 1.2 当前落地状态 (11/29)

| # | 扩展点 | 落地位置 | 语言 | 4 层架构 | 需验证 |
|---|-------|---------|------|:--------:|--------|
| 1 | 通知工厂 | `internal/notification/` + 4 子包 | Go | ✅ | 多渠道 + 策略 + 触发点 + 模板深度 |
| 2 | 流程编排 | `internal/workflow/` + 4 子包 | Go | ✅ | 跨模块调用 vs 业务流程引擎不同 |
| 3 | 全局搜索 | `internal/global-search/` | Go | ✅ | 多模块索引覆盖度 |
| 4 | 定时任务 | `internal/cron/` (8 文件) | Go | ✅ | 是否支持 IJob 接口模式 |
| 5 | 缓存 | `internal/cache/` + `cache-cleanup/` + `cache-monitor/` | Go | ✅ | 请求级缓存 vs 分布式缓存 |
| 6 | SLA 计算 | `internal/sla/` (7 文件) | Go | ✅ | 是否支持 ITSM 级 SLA |
| 7 | Runner 执行器 | `internal/runner/` (4 文件) | Go | ✅ | 独立执行器 vs 内嵌 |
| 8 | 脚本管理 | `internal/script/` + `script-library/` + `script-version/` | Go | ✅ | 多语言脚本支持 |
| 9 | 部署管理 | `internal/deploy/` + `deploy-enhanced/` + `deployment-trigger/` | Go | ✅ | 发布流水线深度 |
| 10 | 仪表板 | `internal/bi-dashboard/` (7 文件) | Go | ✅ | 图表组件扩展性 |
| 11 | 报表引擎 | `internal/report-designer/` (7 文件) | Go | ✅ | 数据源扩展性 |

### 1.3 开发中 (3/29)

| # | 扩展点 | 位置 | 语言 | 实际状态 |
|---|-------|------|------|---------|
| 12 | 自动化执行引擎 | `internal/auto-exec/` (5 文件) | Go | 有 `interfaces.go` 插件接口定义 + `factory.go` 工厂模式 + 单元测试，**缺具体插件实现** |
| 13 | CMDB 采集 | `internal/cmdb/` + `cmdb-collector/` | Go | 有基础模型，缺属性值处理器 + 动态模型 |
| 14 | 告警平台 | `internal/alert/` + `alert-breaker/` + `alert-deduplication/` | Go | 有完整 CRUD，缺管道链式执行 + 熔断器 3 策略 + 适配器 SPI |

---

## 二、29 个扩展点完整映射（评审后修正）

### 2.1 修正说明

- **移除 #10 全局锁**：改为框架内部能力，不作为扩展点暴露
- **新增"NeatLogic 原始接口"列**：标注 NeatLogic 的 Java 命名，与 Orion 映射名区分
- **标注前端/DB 标签**：涉及前端渲染或数据库变更的扩展点

### 2.2 Framework 层 (9 个) — 5 新建 + 4 增强

| # | 扩展点 | 类型 | NeatLogic 原始接口 | Orion 映射名 | 前端 | DB | 优先级 |
|---|-------|------|-------------------|-------------|:----:|:--:|--------|
| 1 | **统一扩展点工厂** | **[新建]** | `ModuleInitializedListenerBase` | `ExtensionPointRegistry` | — | — | **P0** |
| 2 | **API 组件化** | **[新建]** | `IApiComponent` + `ApiDispatcher` | `ApiComponent` + `ApiDispatcher` | — | — | **P0** |
| 3 | **Crossover 跨模块调用** | **[新建]** | `ICrossoverService` + `CrossoverServiceFactory` | `CrossoverService` + `CrossoverFactory` | — | — | **P0** |
| 4 | **定时任务框架** | **[增强]** | `IJob` + `SchedulerManager` | `JobHandler` + `SchedulerManager` | — | — | **P1** |
| 5 | **通知渠道** | **[增强]** | `INotifyHandler` + `NotifyHandlerFactory` | `NotifyHandler` + `NotifyHandlerFactory` | — | — | — |
| 6 | **启动初始化** | **[新建]** | `IStartup` + `StartupManager` | `StartupHandler` + `StartupManager` | — | — | **P2** |
| 7 | **方法级缓存** | **[新建]** | `@MCache` + `MethodCacheManager` | `@CacheResult` + `CacheManager` | — | — | **P1** |
| 8 | **文件类型/存储** | **[增强]** | `IFileTypeHandler` + `IFileStorageMedium` | `FileTypeHandler` + `FileStorage` | — | ✅ | **P2** |
| 9 | **集成处理器** | **[新建]** | `IIntegrationHandler` + `IntegrationHandlerFactory` | `IntegrationHandler` + `IntegrationHandlerFactory` | — | ✅ | **P0** |

### 2.3 ITSM 层 (5 个) — 全部新建，TS 实现

| # | 扩展点 | 类型 | NeatLogic 原始接口 | Orion 映射名 | 前端 | DB | 优先级 |
|---|-------|------|-------------------|-------------|:----:|:--:|--------|
| 10 | **流程步骤处理器** | **[新建]** | `IProcessStepHandler` (20+ 生命周期) | `ProcessStepHandler` | ✅ | ✅ | **P0** |
| 11 | **表单引擎** | **[新建]** | `IFormAttributeHandler` (30+ 控件) | `FormAttributeHandler` | ✅ | ✅ | **P0** |
| 12 | **条件引擎** | **[新建]** | `IConditionHandler` (3 层嵌套) | `ConditionHandler` | — | — | **P0** |
| 13 | **SLA 计算** | **[新建]** | `ISlaCalculateHandler` | `SlaCalculateHandler` | — | ✅ | **P0** |
| 14 | **处理人分派器** | **[新建]** | `IWorkerDispatcher` + `IWorkerPolicyHandler` | `WorkerDispatcher` + `WorkerPolicyHandler` | — | — | **P1** |

### 2.4 CMDB 层 (2 个) — Go 实现

| # | 扩展点 | 类型 | NeatLogic 原始接口 | Orion 映射名 | 前端 | DB | 优先级 |
|---|-------|------|-------------------|-------------|:----:|:--:|--------|
| 15 | **属性值处理器** | **[新建]** | `IAttrValueHandler` (30+ 类型, 12 能力标记) | `AttrValueHandler` | ✅ | ✅ | **P0** |
| 16 | **验证器** | **[新建]** | `IValidator` + `ValidatorBase` | `Validator` + `ValidatorBase` | — | — | **P1** |

### 2.5 AutoExec 层 (3 个) — Go 实现

| # | 扩展点 | 类型 | NeatLogic 原始接口 | Orion 映射名 | 前端 | DB | 优先级 |
|---|-------|------|-------------------|-------------|:----:|:--:|--------|
| 17 | **作业操作处理器** | **[新建]** | `IAutoexecJobActionHandler` (42 动作) | `JobActionHandler` | ✅ | — | **P1** |
| 18 | **参数类型** | **[新建]** | `IScriptParamType` (20 种) | `ScriptParamType` | ✅ | — | **P1** |
| 19 | **执行模式** | **[增强]** | `ExecMode` (4 种: RUNNER/TARGET/RUNNER_TARGET/SQL) | `ExecMode` | — | — | **P1** |

### 2.6 Alert 层 (3 个) — Go 实现

| # | 扩展点 | 类型 | NeatLogic 原始接口 | Orion 映射名 | 前端 | DB | 优先级 |
|---|-------|------|-------------------|-------------|:----:|:--:|--------|
| 20 | **告警事件管道** | **[增强]** | `IAlertEventHandler` + `AlertEventPipeline` | `AlertEventHandler` + `AlertEventPipeline` | — | ✅ | **P0** |
| 21 | **告警熔断器** | **[增强]** | `IAlertBreakerHandler` (3 策略, 5 状态机) | `AlertBreakerHandler` | — | ✅ | **P0** |
| 22 | **告警适配器** | **[新建]** | `IAdapter` (SPI 插件) | `AlertAdapter` | — | — | **P1** |

### 2.7 Deploy 层 (2 个) — Go 增强

| # | 扩展点 | 类型 | NeatLogic 原始接口 | Orion 映射名 | 前端 | DB | 优先级 |
|---|-------|------|-------------------|-------------|:----:|:--:|--------|
| 23 | **作业来源** | **[增强]** | `IAutoexecJobSource` | `JobSourceHandler` | — | — | **P2** |
| 24 | **版本图表** | **[增强]** | `IDeployVersionChartHandler` | `VersionChartHandler` | ✅ | — | **P2** |

### 2.8 其他 (5 个) — 3 新建 + 2 增强

| # | 扩展点 | 类型 | NeatLogic 原始接口 | Orion 映射名 | 前端 | DB | 优先级 |
|---|-------|------|-------------------|-------------|:----:|:--:|--------|
| 25 | **统计处理器** | **[新建]** | `IIssueStatHandler` (15 个) | `StatHandler` | ✅ | — | **P2** |
| 26 | **行编辑器** | **[新建]** | `ILineHandler` | `LineHandler` | ✅ | — | **P2** |
| 27 | **仪表板组件** | **[增强]** | `IDashboardWidgetShowConfig` | `WidgetConfig` | ✅ | — | **P2** |
| 28 | **报表数据源** | **[增强]** | `IDataSourceServiceHandler` | `DataSourceHandler` | ✅ | ✅ | **P2** |
| 29 | **巡检报告扩展** | **[增强]** | `IInspectExtraHandler` | `InspectExtraHandler` | — | ✅ | **P2** |

---

## 三、NeatLogic 源码路径映射（实施时参考）

> 所有路径相对于 `/tmp/neatlogic-itom-all/`。NeatLogic 使用 Java `I*` 命名风格，Orion 落地时使用映射名（见 §2）。

### 3.1 Framework 层

| # | 扩展点 | NeatLogic 源码路径 | 关键文件 |
|---|-------|-------------------|---------|
| 1 | 统一扩展点工厂 | `neatlogic-framework/src/main/java/neatlogic/module/framework/` | `ModuleInitializedListenerBase.java`（通用基类模式） |
| 2 | API 组件化 | `neatlogic-framework/src/main/java/neatlogic/framework/restful/` | `IApiComponent.java` + `ApiDispatcher.java` + `PrivateApiComponentFactory.java` |
| 3 | Crossover | `neatlogic-framework/src/main/java/neatlogic/framework/crossover/` | `ICrossoverService.java` + `CrossoverServiceFactory.java` |
| 4 | 定时任务 | `neatlogic-framework/src/main/java/neatlogic/framework/scheduler/` | `IJob.java` + `SchedulerManager.java` + `JobBase.java` |
| 5 | 通知渠道 | `neatlogic-framework/src/main/java/neatlogic/framework/notify/` | `INotifyHandler.java` + `NotifyHandlerFactory.java` + `FreeMarkerUtil.java` |
| 6 | 启动初始化 | `neatlogic-framework/src/main/java/neatlogic/framework/startup/` | `IStartup.java` + `StartupManager.java` + `StartupBase.java` |
| 7 | 方法级缓存 | `neatlogic-framework/src/main/java/neatlogic/framework/cache/` | `@MCache.java` + `MethodCacheManager.java` + `CacheContext.java` |
| 8 | 文件类型/存储 | `neatlogic-framework/src/main/java/neatlogic/framework/file/` | `IFileTypeHandler.java` + `FileTypeHandlerFactory.java` + `IFileStorageMedium.java` |
| 9 | 集成处理器 | `neatlogic-framework/src/main/java/neatlogic/framework/integration/` | `IIntegrationHandler.java` + `IntegrationHandlerFactory.java` + `IIntegrationInvoker.java` |

### 3.2 ITSM 层

| # | 扩展点 | NeatLogic 源码路径 | 关键文件 |
|---|-------|-------------------|---------|
| 10 | 流程步骤处理器 | `neatlogic-itsm-base/src/main/java/neatlogic/framework/process/stephandler/` | `IProcessStepHandler.java` + `ProcessStepHandlerBase.java` + `ProcessStepHandlerFactory.java` |
| 11 | 表单引擎 | `neatlogic-framework/src/main/java/neatlogic/framework/form/attribute/` | `IFormAttributeHandler.java` + `FormHandlerBase.java` + `ControlHandlerBase.java` + `FormAttributeHandlerFactory.java` |
| 12 | 条件引擎 | `neatlogic-framework/src/main/java/neatlogic/framework/condition/` | `IConditionHandler.java` + `ConditionHandlerFactory.java` + `ConditionVo.java` |
| 13 | SLA 计算 | `neatlogic-itsm-base/src/main/java/neatlogic/framework/process/sla/` | `ISlaCalculateHandler.java` + `SlaCalculateHandlerBase.java` + `SlaCalculateHandlerFactory.java` |
| 14 | 处理人分派器 | `neatlogic-itsm-base/src/main/java/neatlogic/framework/process/worker/` | `IWorkerDispatcher.java` + `WorkerDispatcherFactory.java` + `IWorkerPolicyHandler.java` |

### 3.3 CMDB 层

| # | 扩展点 | NeatLogic 源码路径 | 关键文件 |
|---|-------|-------------------|---------|
| 15 | 属性值处理器 | `neatlogic-cmdb-base/src/main/java/neatlogic/framework/cmdb/attrvaluehandler/` | `IAttrValueHandler.java` + `AttrValueHandlerFactory.java` + `TextValueHandler.java`(参考) |
| 16 | 验证器 | `neatlogic-cmdb-base/src/main/java/neatlogic/framework/cmdb/validator/` | `IValidator.java` + `ValidatorBase.java` + `ValidatorFactory.java` + `RegexValidator.java`(参考) |

### 3.4 AutoExec 层

| # | 扩展点 | NeatLogic 源码路径 | 关键文件 |
|---|-------|-------------------|---------|
| 17 | 作业操作处理器 | `neatlogic-autoexec-base/src/main/java/neatlogic/framework/autoexec/job/action/` | `IAutoexecJobActionHandler.java` + `AutoexecJobActionHandlerBase.java` + `AutoexecJobActionHandlerFactory.java` + `AutoexecJobFireHandler.java`(参考) |
| 18 | 参数类型 | `neatlogic-autoexec-base/src/main/java/neatlogic/framework/autoexec/script/paramtype/` | `IScriptParamType.java` + `ScriptParamTypeFactory.java` |
| 19 | 执行模式 | `neatlogic-autoexec-base/src/main/java/neatlogic/framework/autoexec/constvalue/` | `ExecMode.java` 枚举 + `JobStatus.java`(13 状态) + `JobPhaseStatus.java`(11 状态) + `JobNodeStatus.java`(10 状态) |

### 3.5 Alert 层

| # | 扩展点 | NeatLogic 源码路径 | 关键文件 |
|---|-------|-------------------|---------|
| 20 | 告警事件管道 | `neatlogic-alert-base/src/main/java/neatlogic/framework/alert/event/` | `AlertEventHandlerFactory.java` + `AlertEventManager.java`(管道链式) + `AlertEventHandlerBase.java`(模板方法) |
| 21 | 告警熔断器 | `neatlogic-alert-base/src/main/java/neatlogic/framework/alert/breaker/` | `IAlertBreakerHandler.java` + `AlertBreakerHandlerBase.java` + `AlertBreakerHandlerFactory.java` |
| 22 | 告警适配器 | `neatlogic-alert-plugin-base/src/main/java/neatlogic/framework/alert/plugin/adapter/` | `IAdapter.java` + `AdapterFactory.java` |

### 3.6 Deploy 层 + 其他

| # | 扩展点 | NeatLogic 源码路径 | 关键文件 |
|---|-------|-------------------|---------|
| 23 | 作业来源 | `neatlogic-autoexec-base/src/main/java/neatlogic/framework/autoexec/source/` | `IAutoexecJobSource.java` + `AutoexecJobSourceFactory.java` |
| 24 | 版本图表 | `neatlogic-framework/src/main/java/neatlogic/framework/deploy/chart/` | `IDeployVersionChartHandler.java` + `DeployVersionChartHandlerFactory.java` |
| 25 | 统计处理器 | `neatlogic-rdm/src/main/java/neatlogic/module/rdm/issuestat/` | `IIssueStatHandler.java` + `IssueStatHandlerFactory.java` + `IssueStatHandlerBase.java` |
| 26 | 行编辑器 | `neatlogic-framework/src/main/java/neatlogic/framework/lcs/linehandler/` | `ILineHandler.java` + `LineHandlerFactory.java` |
| 27 | 仪表板组件 | `neatlogic-dashboard-base/src/main/java/neatlogic/framework/dashboard/config/` | `IDashboardWidgetShowConfig.java` + `DashboardWidgetShowConfigFactory.java` |
| 28 | 报表数据源 | `neatlogic-framework/src/main/java/neatlogic/framework/datawarehouse/` | `IDataSourceServiceHandler.java` + `DataSourceServiceHandlerFactory.java` + `DataSourceServiceHandlerBase.java` |
| 29 | 巡检报告扩展 | `neatlogic-inspect/src/main/java/neatlogic/module/inspect/service/` | `InspectReportServiceImpl.java` + `IInspectExtraHandler.java` + `InspectScheduleJob.java` |

### 3.7 核心工厂参考（通用模式）

```
所有 30+ 工厂遵循统一模式:
  neatlogic-framework/src/main/java/neatlogic/module/framework/ModuleInitializedListenerBase.java

参考实现:
  neatic-alert-base/src/main/java/neatlogic/framework/alert/event/AlertEventHandlerFactory.java
  → 包含: 1. extends ModuleInitializedListenerBase
          2. static Map<String, IAlertEventHandler> eventMap
          3. getHandler(type) 静态方法
          4. onInitialized() 中 context.getBeansOfType(IAlertEventHandler.class)
```

---

## 四、TS 与 Go 分工策略（ADR-015 对齐）

### 4.1 分工原则

```
┌─────────────────────────────────────────────────────────┐
│  TS 层 (orion-platform-service/src/services/)            │
│  职责: ITSM 流程引擎、条件引擎、表单引擎、前端交互        │
│  原因: 当前 TS 已有 ApprovalFlowEngine 等基础设施        │
│  扩展点: #1, #2, #3, #7, #10, #11, #12, #14, #25, #26  │
├─────────────────────────────────────────────────────────┤
│  Go 层 (orion-platform-svc-go/internal/)                 │
│  职责: 告警管道、CMDB、自动化执行、基础设施              │
│  原因: 261 个包中已有 11 个相关实现，ADR-015 模块化单体  │
│  扩展点: #4, #5, #8, #9, #13, #15, #16, #17, #18, #19, │
│           #20, #21, #22, #23, #24, #27, #28, #29         │
├─────────────────────────────────────────────────────────┤
│  双语言层                                                │
│  职责: 统一扩展点框架、启动初始化、SLA 计算              │
│  原因: 需跨 TS/Go 共享模式，SLA 需 ITSM(TS)↔计算(Go)    │
│  扩展点: #1(框架), #6(启动), #13(SLA)                   │
└─────────────────────────────────────────────────────────┘
```

### 4.2 跨语言扩展点框架设计

```typescript
// TS 版 (platform-service/src/services/extension-point/registry.ts)
// Orion 命名规范: 无 I 前缀，动词/名词+er 后缀

export interface ExtensionHandler {
  type: string;
  name: string;
  priority: number;        // 排序优先级，越小越先执行
  version: string;         // 语义版本号，支持热替换
  enabled: boolean;        // 动态启用/禁用
  onRegister?(): void;     // 注册回调
  onUnregister?(): void;   // 卸载回调
}

export class ExtensionRegistry {
  private static domains = new Map<string, Map<string, ExtensionHandler>>();

  static register(domain: string, handler: ExtensionHandler): void {
    if (!this.domains.has(domain)) {
      this.domains.set(domain, new Map());
    }
    const existing = this.domains.get(domain)!.get(handler.type);
    if (existing) {
      console.warn(`[ExtensionPoint] ${domain}:${handler.type} 被 ${handler.version} 替换`);
      existing.onUnregister?.();
    }
    this.domains.get(domain)!.set(handler.type, handler);
    handler.onRegister?.();
  }

  static getHandler<T extends ExtensionHandler>(domain: string, type: string): T {
    const handler = this.domains.get(domain)?.get(type) as T | undefined;
    if (!handler || !handler.enabled) {
      throw new Error(`Extension not found or disabled: ${domain}:${type}`);
    }
    return handler;
  }

  static getAllHandlers<T extends ExtensionHandler>(domain: string): T[] {
    return Array.from((this.domains.get(domain) || new Map()).values())
      .filter(h => h.enabled)
      .sort((a, b) => a.priority - b.priority) as T[];
  }

  static unregister(domain: string, type: string): void {
    const handler = this.domains.get(domain)?.get(type);
    handler?.onUnregister?.();
    this.domains.get(domain)?.delete(type);
  }
}

// 装饰器
export function registerExtension(domain: string, config?: Partial<ExtensionHandler>) {
  return function (constructor: { new (...args: any[]): ExtensionHandler }) {
    const instance = new constructor();
    if (config) Object.assign(instance, config);
    ExtensionRegistry.register(domain, instance);
  };
}
```

```go
// Go 版 (svc-go/internal/extension-point/registry.go)
package extensionpoint

import "sync"

type Handler interface {
    Type() string
    Name() string
    Priority() int
    Version() string
    Enabled() bool
}

type Registry struct {
    mu       sync.RWMutex
    handlers map[string]map[string]Handler
}

var global = &Registry{handlers: make(map[string]map[string]Handler)}

func Register(domain string, h Handler) {
    global.mu.Lock()
    defer global.mu.Unlock()
    if global.handlers[domain] == nil {
        global.handlers[domain] = make(map[string]Handler)
    }
    global.handlers[domain][h.Type()] = h
}

func Get[T Handler](domain, typ string) (T, bool) {
    global.mu.RLock()
    defer global.mu.RUnlock()
    h, ok := global.handlers[domain][typ]
    if !ok || !h.Enabled() { var zero T; return zero, false }
    return h.(T), ok
}

func GetAll[T Handler](domain string) []T {
    global.mu.RLock()
    defer global.mu.RUnlock()
    var result []T
    for _, h := range global.handlers[domain] {
        if h.Enabled() {
            result = append(result, h.(T))
        }
    }
    return result
}
```

### 4.3 管道执行器（PipelineExecutor）

Phase 0 新增任务：实现管道链式执行器，用于告警事件管道等场景。

```typescript
// platform-service/src/services/extension-point/pipeline-executor.ts
export class PipelineExecutor<T> {
  async execute(domain: string, context: T): Promise<void> {
    const handlers = ExtensionRegistry.getAllHandlers<ExtensionHandler>(domain);
    for (const handler of handlers) {
      try {
        await (handler as any).execute(context);
      } catch (err) {
        console.error(`[Pipeline] handler ${handler.type} 失败:`, err);
        // 熔断检查: 连续失败次数超阈值则跳过
        if (await this.isCircuitBroken(domain, handler.type)) {
          break;
        }
      }
    }
  }
}
```

---

## 五、新旧代码集成策略（新增）

### 5.1 三阶段集成模式

```
阶段 1: 新建扩展点强制使用框架 (Phase 0 完成后立即生效)
  → 所有 Phase 1-7 新建的扩展点必须通过 ExtensionRegistry 注册
  → 新建扩展点不得直接 import 其他模块

阶段 2: 现有代码适配器模式 (Phase 1-3 并行)
  → 现有 11 个 Go 已有包通过 wrapper 适配器接入框架
  → 示例: svc-go/internal/notification/ 已有实现 → 创建 NotifyHandlerAdapter
     class NotifyHandlerAdapter implements ExtensionHandler {
       type = 'notify.email';
       execute(vo) { return existingEmailService.send(vo); }
     }

阶段 3: 灰度迁移 (Phase 4-6)
  → 旧调用路径保留，新功能优先走扩展点框架
  → 新旧路径通过 feature flag 切换
  → 验证通过后逐步下线旧路径
```

### 5.2 冲突检测规则

```bash
# 规则 1: 检查 Go 是否已有同名包
for pkg in cron lock cache notification workflow global-search alert-breaker sla runner script deploy bi-dashboard report-designer inspection; do
  if [ -d "orion-platform-svc-go/internal/$pkg" ]; then
    echo "⚠️ 已有包: $pkg → 标记为[增强]而非[新建]"
  fi
done

# 规则 2: 检查 TS 是否已有同名服务
for svc in extension-point forms conditions sla statistics editor crossover startup; do
  if [ -d "orion-platform-service/src/services/$svc" ]; then
    echo "⚠️ 已有服务: $svc → 标记为[增强]而非[新建]"
  fi
done

# 规则 3: 新建扩展点必须注册到 ExtensionRegistry，禁止直接 import
# 规则 4: 所有新建包必须遵循 ADR-015 4 层架构（models→repository→service→handler）
```

---

## 六、核心实施路线图（评审后修正）

### Phase 0: 统一扩展点框架 (1.5 周) — [新建] TS + Go

```
目标: 建立 Orion 版统一扩展点模式 + 生命周期管理 + 管道执行器
依赖: 无
ADR: ADR-002 Plugin-SPI 接口设计（扩展点框架是 SPI 的补充）

输出:
  TS 版:
    - platform-service/src/services/extension-point/registry.ts
    - platform-service/src/services/extension-point/pipeline-executor.ts
    - platform-service/src/services/extension-point/decorators.ts
    - 验证: 3 个扩展点注册/获取/调用/卸载测试通过

  Go 版:
    - svc-go/internal/extension-point/registry.go
    - svc-go/internal/extension-point/registry_test.go
    - 验证: `go test ./internal/extension-point/...` 通过

  生命周期特性:
    - priority: 排序优先级
    - version: 语义版本号，支持热替换
    - enabled: 动态启用/禁用
    - onRegister/onUnregister: 注册/卸载回调

  管道执行器:
    - PipelineExecutor: 按 priority 排序链式执行
    - 异常隔离: 单个 handler 失败不影响后续
    - 熔断集成: 连续失败超阈值自动跳过
```

### Phase 1: 基础设施层 (2 周) — 4 新建 + 3 增强

```
目标: 编译 100% 通过 + 增强基础设施
依赖: Phase 0
ADR: ADR-015（模块化单体 + 4 层架构）

任务 1.1: 修复编译错误 (3 天) [增强]
  - 实际检查 261 个 Go 包，确认编译失败列表
  - 需修复的已知问题:
    * ticket.go 语法损坏
    * auth-enhanced/wechat model 导入
    * keyrotation JwtKeyRepository 导入
    * orchestration/service 未使用 import
  - 验证: go build ./internal/... 0 错误

任务 1.2: 定时任务框架 IJob 增强 (3 天) [增强]
  - 位置: svc-go/internal/cron/（已有 8 文件）
  - 增强: JobHandler 接口 + SchedulerManager + Cron 表达式
  - 验证: 3 个示例 Job 调度测试

任务 1.3: 启动初始化 IStartup (2 天) [新建] ← 修正: 从[增强]改为[新建]
  - TS: platform-service/src/services/startup/
  - Go: svc-go/internal/startup/（目录不存在，需新建）
  - 两阶段执行: 全局初始化 → 租户级初始化
  - 验证: 数据字典初始化 + 全局配置创建

任务 1.4: 方法级缓存 @CacheResult (2 天) [新建] ← 优先级: P2→P1
  - TS: platform-service/src/services/cache/decorators/
  - 使用 TypeScript 装饰器，Orion 命名 @CacheResult
  - Key: MD5(tenantId + className + methodName + params)
  - 验证: 同一请求重复调用只执行一次

任务 1.5: 集成处理器 (3 天) [新建] ← 优先级: P1→P0
  - Go: svc-go/internal/integration/（已有 6 文件）
  - 增强为插件式: IntegrationHandler 接口 + 注册工厂
  - 验证: 2 个集成 + 回调测试
```

### Phase 2a: ITSM 核心流程 (2 周) — 2 新建 TS

```
目标: 流程步骤处理器 + 处理人分派器
依赖: Phase 0
位置: 全部在 platform-service/src/services/ 下

任务 2a.1: 流程步骤处理器 (10 天) [新建]
  - 位置: platform-service/src/services/approval/process-step-handler.ts
  - 接口: ProcessStepHandler（Orion 命名规范: 无 I 前缀）
  - 20+ 生命周期方法:
    active / assign / start / handle / complete / back / hang
    abort / transfer / saveDraft / recover / redo / getNext / fail
  - 基类: ProcessStepHandlerBase（模板方法模式）
  - 状态机: DRAFT→PENDING→RUNNING→SUCCEED/FAILED/HANG/ABORTED
  - 已有 ApprovalFlowEngine 扩展为完整步骤处理器
  - 验证: 5 个步骤处理器 + 完整流程流转测试

任务 2a.2: 处理人分派器 (3 天) [新建]
  - 位置: platform-service/src/services/approval/worker-dispatcher.ts
  - WorkerDispatcher 接口: 可插拔分派策略
  - 默认实现: 按用户/角色/团队/上级
  - 验证: 4 种分派策略 + 兜底处理人测试
```

### Phase 2b: ITSM 辅助能力 (1.5 周) — 3 新建 TS

```
目标: 表单引擎 + 条件引擎 + SLA 计算
依赖: Phase 2a（流程步骤处理器是前置）

任务 2b.1: 表单引擎 (5 天) [新建]
  - 位置: platform-service/src/services/forms/（目录不存在，需新建）
  - 30+ 控件: 文本/下拉/级联/树/附件/表格/子表单/矩阵
  - 13 种能力标记
  - 场景系统: 主场景 + 默认场景 + 自定义场景
  - 数据联动: reaction.hide / reaction.readonly / reaction.setvalue
  - 验证: 10+ 控件 + 场景切换 + 数据联动测试

任务 2b.2: 条件引擎 (3 天) [新建]
  - 位置: platform-service/src/services/conditions/（目录不存在，需新建）
  - 3 层嵌套: 条件组→条件→表达式
  - 表单字段作为条件参数联动
  - 验证: 3 层嵌套 + 表单字段联动测试

任务 2b.3: SLA 计算引擎 (3 天) [新建 TS + 增强 Go]
  - TS: platform-service/src/services/sla/（目录不存在，需新建）
  - Go: svc-go/internal/sla/（已有 7 文件）增强计算能力
  - 响应时效 / 处理时效 / 暂停去重 / 动态优先级
  - 超时通知 / 转派
  - 验证: 3 种 SLA 策略 + 超时处理测试
```

### Phase 3: 告警平台增强 (2 周) — 1 新建 + 2 增强 Go

```
目标: 3 个告警扩展点
依赖: Phase 0（管道执行器）
位置: 全部在 svc-go/internal/alert*/ 下

任务 3.1: 告警事件管道 (5 天) [增强]
  - 位置: svc-go/internal/alert/（已有 8 文件）
  - 增强: 管道-过滤器模式，使用 Phase 0 PipelineExecutor
  - 处理器链: SAVE→CONDITION→INTERVAL→INTEGRATION→EMAIL→CLOSE→OPEN→MARK→UNMARK
  - 验证: 5 个处理器链式执行测试

任务 3.2: 告警熔断器 (5 天) [增强]
  - 位置: svc-go/internal/alert-breaker/（已有 4 文件）
  - 增强 3 种策略:
    ① 触发量窗口熔断
    ② 连续失败熔断
    ③ 邮件收件人熔断
  - 5 状态机: CLOSED→OPEN→COLLECTING→FLUSHING→CLOSED
  - 对齐 Orion 统一规范中的 opossum 熔断器模式
  - 验证: 3 种熔断策略 + 状态流转测试

任务 3.3: 告警适配器 SPI (3 天) [新建]
  - 位置: svc-go/internal/alert/adapter/（目录不存在，需新建）
  - AlertAdapter 接口: Convert(input) → 统一 Alert 格式
  - SPI 插件加载机制（复用 plugin/spi/spi.go 模式）
  - 验证: 2 个适配器 + 格式转换测试
```

### Phase 4: CMDB 动态模型 (2 周) — 2 新建 Go

```
目标: 2 个 CMDB 扩展点
依赖: Phase 0
位置: 全部在 svc-go/internal/cmdb/ 下

任务 4.1: 属性值处理器 (8 天) [新建]
  - 位置: svc-go/internal/cmdb/attr-handler/
  - 30+ 属性类型，12 种能力标记
  - 值转换: TransferToSave → TransferToDisplay → TransferToExport
  - 生命周期回调: AfterInsert / AfterUpdate / AfterDelete
  - 验证: 10 个属性处理器 + 转换 + 校验测试

任务 4.2: 验证器体系 (3 天) [新建]
  - 位置: svc-go/internal/cmdb/validator/
  - Validator 接口: Validate(attr, value) → error
  - 正则验证器 / 长度验证器 / 范围验证器
  - 验证: 3 种验证器 + 自定义验证器测试
```

### Phase 5: 自动化编排完善 (2 周) — 2 新建 + 1 增强 Go

```
目标: 3 个 AutoExec 扩展点
依赖: Phase 0 + 已有 auto-exec（5 文件，有接口/工厂/测试）
位置: 全部在 svc-go/internal/auto-exec/ 下

任务 5.1: 作业操作处理器 (5 天) [新建]
  - 位置: svc-go/internal/auto-exec/actions/
  - 42 个动作: FIRE / PAUSE / ABORT / CHECK / REFIRE / TAKE_OVER 等
  - 三级状态机: Job(13 状态) → Phase(11 状态) → Node(10 状态)
  - 验证: 10 个核心操作 + 状态流转测试

任务 5.2: 参数类型扩展 (3 天) [新建]
  - 位置: svc-go/internal/auto-exec/params/
  - 20 种参数: text/password/file/date/select/multiselect 等
  - 验证: 10 种参数类型 + 值转换测试

任务 5.3: 执行模式增强 (3 天) [增强]
  - 位置: svc-go/internal/runner/（已有 4 文件）
  - 4 种模式: RUNNER(本地) / TARGET(远程) / RUNNER_TARGET(代理) / SQL(数据库)
  - 验证: 4 种模式 + 执行器映射测试
```

### Phase 6: 补充扩展点 (2 周) — 3 新建 + 2 增强

```
目标: 完成剩余 5 个扩展点
依赖: Phase 0

任务 6.1: 统计处理器 (3 天) [新建]
  - TS: platform-service/src/services/statistics/（目录不存在，需新建）
  - 缺陷/需求/任务 三类统计处理器
  - 验证: 5 个统计处理器 + 聚合计算测试

任务 6.2: 行编辑器 (2 天) [新建]
  - TS: platform-service/src/services/editor/line-handler.ts（目录不存在，需新建）
  - 段落/标题/表格/代码/图片/列表 行类型
  - 验证: 3 种行类型 + 渲染测试

任务 6.3: 仪表板组件增强 (2 天) [增强]
  - Go: svc-go/internal/bi-dashboard/（已有 7 文件）
  - 5 种图表组件，网格布局，导入/导出
  - 验证: 3 种组件 + 布局测试

任务 6.4: 报表数据源增强 (2 天) [增强]
  - Go: svc-go/internal/report-designer/（已有 7 文件）
  - 数据源配置，定时发送，图表，导出
  - 验证: 2 种数据源 + 导出测试

任务 6.5: 巡检报告扩展增强 (1 天) [增强]
  - Go: svc-go/internal/inspection/（已有 6 文件）
  - 巡检报告扩展点
  - 验证: 1 个扩展 + 报告生成测试
```

### Phase 7: 全量验证 (1 周) — 新增

```
目标: 确保 29 个扩展点全部正确注册 + 跨语言调用正常 + 性能达标
依赖: Phase 0-6 全部完成

任务 7.1: 注册验证 (1 天)
  - 验证所有 29 个扩展点注册成功
  - 验证所有 29 个扩展点可正常获取/调用
  - 验证类型错误的扩展点被正确拒绝

任务 7.2: 集成测试 (2 天)
  - TS 扩展点框架 + Go 扩展点框架 跨语言调用测试
  - 管道执行器链式执行测试
  - 新旧代码适配器集成测试

任务 7.3: 回归测试 (1 天)
  - 全量单元测试: 现有 + 新增
  - 确保未引入回归问题

任务 7.4: 性能基准 (1 天)
  - 扩展点注册性能: 100 个扩展点注册时间 < 1s
  - 扩展点获取性能: 10,000 QPS 下 P99 < 5ms
  - 管道执行器性能: 10 个处理器链式执行 < 100ms

任务 7.5: 文档产出 (1 天)
  - ExtensionPoint Development Guide
  - 扩展点 API 文档
  - 最佳实践与常见问题
```

---

## 七、按功能域汇总（评审后修正）

| 域 | 扩展点数 | 已落地 | 开发中 | 未启动 | 新建 | 增强 | Phase |
|----|:--------:|:------:|:------:|:------:|:----:|:----:|-------|
| **Framework** | 9 | 4 | 0 | 5 | 5 | 4 | Phase 0 + 1 |
| **ITSM** | 5 | 0 | 0 | 5 | 5 | 0 | Phase 2a + 2b |
| **CMDB** | 2 | 0 | 1 | 1 | 2 | 0 | Phase 4 |
| **AutoExec** | 3 | 0 | 1 | 2 | 2 | 1 | Phase 5 |
| **Alert** | 3 | 0 | 1 | 2 | 1 | 2 | Phase 3 |
| **Deploy** | 2 | 0 | 0 | 2 | 0 | 2 | Phase 6 |
| **其他** | 5 | 0 | 0 | 5 | 3 | 2 | Phase 6 |
| **总计** | **29** | **4** | **3** | **22** | **18** | **11** | — |

> 注: 移除全局锁(#10)后 Framework 从 10→9，已落地调整为 4(通知/流程/搜索/定时)
> 开发中调整为 3(auto-exec/cmdb/alert 非纯蓝图)

---

## 八、时间线与工作量估算（评审后修正）

| Phase | 内容 | 新建 | 增强 | 时间 | 人天 | 前置依赖 |
|-------|------|:----:|:----:|------|:----:|---------|
| **Phase 0** | 统一扩展点框架 + 管道执行器 | 1 | 0 | 1.5 周 | 7 | 无 |
| **Phase 1** | 基础设施(编译修复+定时+启动+缓存+集成) | 4 | 3 | 2 周 | 13 | Phase 0 |
| **Phase 2a** | ITSM 核心流程(步骤处理器+分派器) | 2 | 0 | 2 周 | 13 | Phase 0 |
| **Phase 2b** | ITSM 辅助能力(表单+条件+SLA) | 3 | 0 | 1.5 周 | 11 | Phase 2a |
| **Phase 3** | 告警增强(管道+熔断器+适配器) | 1 | 2 | 2 周 | 13 | Phase 0 |
| **Phase 4** | CMDB 动态模型(属性处理器+验证器) | 2 | 0 | 2 周 | 11 | Phase 0 |
| **Phase 5** | 自动化编排(作业操作+参数+执行模式) | 2 | 1 | 2 周 | 11 | Phase 0 + auto-exec |
| **Phase 6** | 补充扩展点(统计+编辑器+仪表板+报表+巡检) | 3 | 2 | 2 周 | 10 | Phase 0 |
| **Phase 7** | 全量验证(注册+集成+回归+性能+文档) | 0 | 0 | 1 周 | 6 | Phase 0-6 |
| **总计** | **29 扩展点** | **18** | **8** | **16 周** | **95 人天** | — |

---

## 九、关键里程碑

| 里程碑 | 时间 | 验收标准 |
|--------|------|---------|
| M1: 扩展点框架就绪 | Phase 0 结束 | TS + Go 双版注册/获取/调用/卸载/管道执行测试通过 |
| M2: 编译 100% 通过 | Phase 1 第 1 周 | `go build ./internal/...` 0 错误 |
| M3: ITSM 核心流程可用 | Phase 2a 结束 | 流程步骤处理器 + 分派器集成测试通过 |
| M4: ITSM 辅助能力可用 | Phase 2b 结束 | 表单 + 条件 + SLA 集成测试通过 |
| M5: 告警管道可用 | Phase 3 结束 | 5 个处理器链式执行 + 3 种熔断器测试通过 |
| M6: CMDB 动态属性 | Phase 4 结束 | 10 个属性处理器 + 3 种验证器测试通过 |
| M7: 自动化编排完整 | Phase 5 结束 | 10 个核心操作 + 4 种执行模式测试通过 |
| M8: 全部扩展点完成 | Phase 6 结束 | 29 个扩展点全部注册 + 核心测试通过 |
| M9: 全量验证通过 | Phase 7 结束 | 注册/集成/回归/性能/文档全部达标 |

---

## 十、与评审前版本的差异说明

| 差异项 | v2.0 | v3.0（评审后修正） |
|--------|------|-------------------|
| 扩展点数 | 30 | **29**（移除全局锁） |
| 已落地 | 5 | **11**（发现 11 个 Go 有包） |
| 开发中 | 5 | **3**（auto-exec/cmdb/alert 非纯蓝图） |
| 未启动 | 20+ | **15** |
| 新建/增强 | 16 新建 + 14 增强 | **18 新建 + 8 增强 + 3 移除** |
| startup 标记 | [增强] | **[新建]**（目录不存在） |
| 集成处理器优先级 | P1 | **P0** |
| 缓存优先级 | P2 | **P1** |
| Phase 2 | 1 个 Phase (3 周) | **Phase 2a(2 周) + Phase 2b(1.5 周)** |
| 验证阶段 | 无 | **Phase 7(1 周)** |
| 生命周期管理 | 无 | priority/version/enabled/onRegister/onUnregister |
| 管道执行器 | 无 | Phase 0 新增 |
| 集成策略 | 无 | §5 三阶段模式 |
| NeatLogic 原始名 | 无 | §2 新增列 |
| 前端/DB 标注 | 无 | §2 新增列 |
| 总周期 | 14 周 / 87 人天 | **16 周 / 95 人天** |

---

## 十一、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 扩展点框架与现有 261 个 Go 包集成冲突 | 中 | 高 | 冲突检测规则强制执行 + wrapper 适配器模式 |
| ITSM 扩展点工作量被低估 | 中 | 高 | Phase 2a/2b 拆分，核心流程优先 |
| 与现有 ADR-015 4 层架构不兼容 | 低 | 高 | 新建包必须遵循 4 层架构 |
| 跨语言扩展点框架不一致 | 中 | 中 | TS/Go 双版保持接口语义一致 |
| 命名规范冲突 | 低 | 中 | 禁止 Java 风格 `I*` 前缀，§2 映射表明确标注 |
| 新扩展点引入性能问题 | 中 | 中 | Phase 7 性能基准门控 |

---

## 十二、总结

1. **评审修正 10 项 blocking 问题**：移除全局锁、修正 startup 类型、扩展落地状态表、新增集成策略/生命周期管理/管道执行器/验证阶段
2. **实际未启动 15/29 (52%)**：比评审前 66% 进一步优化
3. **TS/Go 分工明确**：ITSM 在 TS，告警/CMDB/自动化在 Go，扩展点框架双语言
4. **统一扩展点框架是 Phase 0 前置条件**：无此框架则所有扩展点都是紧耦合的临时方案
5. **ITSM 和 CMDB 是最大功能差距**：7 个扩展点全部 P0 级，完全未启动
6. **总实施周期 16 周 / 95 人天**：Phase 2a/3/4 可并行

---

_维护者: Orion 架构团队 | 生成日期: 2026-07-24 | 版本: v3.0（评审后二次修正）_
_基于 45 份 NeatLogic 文档 + 扩展点指南 + COMBINED-ANALYSIS + Orion 统一规范 + ADR-015 + 启动领域专家评审_