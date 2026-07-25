# 文档分析：待修复问题 vs 待实施新功能

> 基于 `docs/reports/2026-07-24-FINAL-IMPLEMENTATION-PLAN.md` v3.0 提取
> 分析日期: 2026-07-24

---

## 一、总体分类

| 类别 | 数量 | 占比 |
|------|:----:|:----:|
| **待修复问题** | 11 项 | 27% |
| **待实施新功能** | 29 项 | 73% |
| **合计** | 40 项 | 100% |

---

## 二、待修复问题（11 项）

### 2.1 编译错误（5 项）

| # | 问题 | 位置 | 严重度 | Phase |
|---|------|------|:------:|-------|
| F-01 | `go build ./internal/...` 仅 91.5% (238/260)，9 包编译失败 | 全局 261 个 Go 包 | 🔴 P0 | Phase 1 |
| F-02 | `ticket.go` 语法损坏（第 163 行 sed 注入错误语法） | `internal/import-export/handlers/ticket.go` | 🔴 P0 | Phase 1 |
| F-03 | `auth-enhanced/wechat` 缺少 model 导入 | `internal/auth-enhanced/` | 🔴 P0 | Phase 1 |
| F-04 | `keyrotation` 缺少 `JwtKeyRepository` 导入 | `internal/.../keyrotation/` | 🔴 P0 | Phase 1 |
| F-05 | `orchestration/service` 未使用的 import | `internal/orchestration/service/` | 🟡 P1 | Phase 1 |

### 2.2 功能深度不足（6 项）

| # | 问题 | 位置 | 现有状态 | 目标状态 | Phase |
|---|------|------|---------|---------|-------|
| F-06 | **通知工厂**深度不足 | `internal/notification/` | 4 层架构有，但多渠道/策略/触发点/FreeMarker 模板缺失 | 验证深度 | Phase 1 |
| F-07 | **定时任务**缺少 IJob 接口模式 | `internal/cron/` (8 文件) | 基础 cron 调度，无 `JobHandler` 接口 + `SchedulerManager` | 增强为 IJob 模式 | Phase 1 |
| F-08 | **SLA 计算**不支持 ITSM 级 | `internal/sla/` (7 文件) | 基础 SLA，无响应时效/处理时效/暂停去重/动态优先级 | ITSM 级 SLA | Phase 2b |
| F-09 | **告警**缺少管道链式执行 | `internal/alert/` (8 文件) | 完整 CRUD，无管道-过滤器模式 | 链式执行 + 插件化 | Phase 3 |
| F-10 | **告警熔断器**缺少 3 策略 | `internal/alert-breaker/` (4 文件) | 基础熔断，无触发量窗口/连续失败/邮件收件人策略 | 3 策略 + 5 状态机 | Phase 3 |
| F-11 | **自动化执行引擎**缺插件实现 | `internal/auto-exec/` (5 文件) | 有接口定义 + 工厂 + 测试，无具体插件 | 42 个作业动作 + 20 参数类型 | Phase 5 |

---

## 三、待实施新功能（29 项）

### 3.1 P0 级（8 项）

| # | 新功能 | Orion 位置 | NeatLogic 参考 | 人天 |
|---|-------|-----------|---------------|:----:|
| N-01 | **统一扩展点框架** | `extension-point/registry.ts` + `extension-point/registry.go` | `ModuleInitializedListenerBase` | 5 |
| N-02 | **管道执行器** | `extension-point/pipeline-executor.ts` | `AlertEventManager` 链式执行 | 2 |
| N-03 | **API 组件化** | `api/components/` | `IApiComponent` + `ApiDispatcher` | 5 |
| N-04 | **Crossover 跨模块调用** | `services/crossover/` | `ICrossoverService` + `CrossoverServiceFactory` | 3 |
| N-05 | **集成处理器** | `svc-go/internal/integration/` (增强) | `IIntegrationHandler` + `IntegrationHandlerFactory` | 3 |
| N-06 | **流程步骤处理器** | `services/approval/process-step-handler.ts` | `IProcessStepHandler` 20+ 生命周期 | 10 |
| N-07 | **表单引擎** | `services/forms/` | `IFormAttributeHandler` 30+ 控件 | 5 |
| N-08 | **条件引擎** | `services/conditions/` | `IConditionHandler` 3 层嵌套 | 3 |

### 3.2 P1 级（7 项）

| # | 新功能 | Orion 位置 | NeatLogic 参考 | 人天 |
|---|-------|-----------|---------------|:----:|
| N-09 | **定时任务框架** | `svc-go/internal/cron/` (增强) | `IJob` + `SchedulerManager` | 3 |
| N-10 | **方法级缓存** | `services/cache/decorators/` | `@MCache` + `MethodCacheManager` | 2 |
| N-11 | **SLA 计算引擎** | `services/sla/` + `svc-go/internal/sla/`(增强) | `ISlaCalculateHandler` | 3 |
| N-12 | **处理人分派器** | `services/approval/worker-dispatcher.ts` | `IWorkerDispatcher` + `IWorkerPolicyHandler` | 3 |
| N-13 | **告警适配器 SPI** | `svc-go/internal/alert/adapter/` | `IAdapter` + SPI 插件 | 3 |
| N-14 | **作业操作处理器** | `svc-go/internal/auto-exec/actions/` | `IAutoexecJobActionHandler` 42 动作 | 5 |
| N-15 | **参数类型** | `svc-go/internal/auto-exec/params/` | `IScriptParamType` 20 种 | 3 |

### 3.3 P2 级（14 项）

| # | 新功能 | Orion 位置 | NeatLogic 参考 | 人天 |
|---|-------|-----------|---------------|:----:|
| N-16 | **启动初始化** | `services/startup/` + `svc-go/internal/startup/` | `IStartup` + `StartupManager` | 2 |
| N-17 | **文件类型/存储** | `svc-go/internal/` (增强) | `IFileTypeHandler` + `IFileStorageMedium` | 2 |
| N-18 | **执行模式** | `svc-go/internal/runner/` (增强) | `ExecMode` 4 种模式 | 3 |
| N-19 | **CMDB 属性值处理器** | `svc-go/internal/cmdb/attr-handler/` | `IAttrValueHandler` 30+ 类型 | 8 |
| N-20 | **CMDB 验证器** | `svc-go/internal/cmdb/validator/` | `IValidator` + `ValidatorBase` | 3 |
| N-21 | **告警事件管道** | `svc-go/internal/alert/` (增强) | 13+ 处理器链式执行 | 5 |
| N-22 | **告警熔断器** | `svc-go/internal/alert-breaker/` (增强) | 3 策略 + 5 状态机 | 5 |
| N-23 | **作业来源** | `svc-go/internal/deploy/` (增强) | `IAutoexecJobSource` | 2 |
| N-24 | **版本图表** | `svc-go/internal/deploy/` (增强) | `IDeployVersionChartHandler` | 2 |
| N-25 | **统计处理器** | `services/statistics/` | `IIssueStatHandler` 15 个 | 3 |
| N-26 | **行编辑器** | `services/editor/line-handler.ts` | `ILineHandler` | 2 |
| N-27 | **仪表板组件** | `svc-go/internal/bi-dashboard/` (增强) | `IDashboardWidgetShowConfig` | 2 |
| N-28 | **报表数据源** | `svc-go/internal/report-designer/` (增强) | `IDataSourceServiceHandler` | 2 |
| N-29 | **巡检报告扩展** | `svc-go/internal/inspection/` (增强) | `IInspectExtraHandler` | 1 |

---

## 四、按 Phase 分布

| Phase | 修复问题 | 新功能 | 小计 | 说明 |
|-------|:--------:|:------:|:----:|------|
| **Phase 0** | 0 | 4 | 4 | 扩展点框架 + 管道执行器 + API 组件化 + Crossover |
| **Phase 1** | 5 | 4 | 9 | 编译修复 + 定时任务增强 + 启动初始化 + 缓存 + 集成处理器 |
| **Phase 2a** | 0 | 2 | 2 | 流程步骤处理器 + 处理人分派器 |
| **Phase 2b** | 1 | 3 | 4 | 表单引擎 + 条件引擎 + SLA 计算 |
| **Phase 3** | 2 | 3 | 5 | 告警管道 + 熔断器 + 适配器 |
| **Phase 4** | 0 | 2 | 2 | CMDB 属性值处理器 + 验证器 |
| **Phase 5** | 1 | 2 | 3 | 作业操作处理器 + 参数类型 + 执行模式 |
| **Phase 6** | 0 | 5 | 5 | 统计 + 编辑器 + 仪表板 + 报表 + 巡检 |
| **Phase 7** | 2 | 0 | 2 | 全量验证 + 回归测试 + 性能基准 |
| **总计** | **11** | **25** | **36** | |

---

## 五、按语言分布

| 语言 | 修复问题 | 新功能 | 小计 |
|------|:--------:|:------:|:----:|
| **Go** | 9 | 15 | 24 |
| **TS** | 2 | 12 | 14 |
| **双语言** | 0 | 2 | 2 |
| **总计** | **11** | **29** | **40** |

---

## 六、关键路径

```
Phase 0 (1.5 周) ─── 扩展点框架 ← 所有新功能的前置依赖
    │
    ├── Phase 1 (2 周) ─── 编译修复 + 基础设施增强
    │
    ├── Phase 2a (2 周) ─── ITSM 核心流程（步骤处理器 + 分派器）
    │       │
    │       └── Phase 2b (1.5 周) ─── ITSM 辅助（表单 + 条件 + SLA）
    │
    ├── Phase 3 (2 周) ─── 告警管道（可并行 Phase 2a）
    │
    ├── Phase 4 (2 周) ─── CMDB 动态模型（可并行 Phase 2a）
    │
    ├── Phase 5 (2 周) ─── 自动化编排（可并行 Phase 2a）
    │
    ├── Phase 6 (2 周) ─── 补充扩展点
    │
    └── Phase 7 (1 周) ─── 全量验证 ← 所有 Phase 的前置完成
```

---

## 七、总结

| 维度 | 数值 |
|------|:----:|
| **待修复问题** | 11 项（5 编译错误 + 6 功能深度不足） |
| **待实施新功能** | 29 项（8 P0 + 7 P1 + 14 P2） |
| **总工作量** | 16 周 / 95 人天 |
| **最大阻塞项** | `go build` 91.5% → 100%（Phase 1 第 1 周必须完成） |
| **最长前置链** | 扩展点框架 → ITSM 核心流程 → ITSM 辅助能力（5 周） |
| **可并行组** | Phase 2a / Phase 3 / Phase 4 / Phase 5（4 路并行，节省 6 周） |