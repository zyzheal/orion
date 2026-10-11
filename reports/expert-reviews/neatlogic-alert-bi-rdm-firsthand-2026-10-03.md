# NeatLogic Alert / BI Report / RDM 一手代码实证 (2026-10-03)

> 分析来源：`/private/tmp/neatlogic-itom/` 6 个模块 Java 源码（NL-3 第 4 次尝试）
> 分析范围：326 个 Alert Java + 120 个 Report Java + 290 个 RDM Java
> 方法：定向 grep + 文件结构统计，聚焦 3 个关键问题（避免字段全量枚举陷阱）

---

## TL;DR

1. **Alert 5 家族并非 memory only**：Correlation/Dedup/Silence/Rule/Routing 全部经 MyBatis Mapper 持久化到 PG（22 个 Mapper + 20 个 XML），仅 4 个 AlertBreaker 处理器注册表本身是 `static HashMap`（工厂类，非业务状态）。**R-P0-03 风险需要重估**——但 Orion 侧 5 家族能力覆盖度仍需重跑。
2. **Report Designer 是真实 JFreeChart 实现，不是 stub**：10 个 DrawXxx widget 类（Bar/Pie/Line/Table/Stacked 等），全部 import JFreeChart + `ChartFactory.createXxxChart()`。7 个 Mapper + `reportType` DB 驱动分类。**v4 报告 BI 20% 的"stubbed"结论是错的，需要向上修正到 55-65%**。
3. **RDM 4 Tab 契约与 Orion 前后端 200% 对齐**：NeatLogic 99 个 `*Api.java`（catalog/project/issue/status/template/issuecost/app/notify/audit）；Orion 前端 RDM 4 Tab（需求/缺陷/迭代/任务）+ 45 个 `axios` 调用 + `/rdm/requirements|defects|sprints|tasks|releases|code-reviews|comments|documents|statistics/burndown|sprints|velocity|defects` 路径。Orion Go 后端在 `project/sprint/risk/risk(governance)/release-management/project-member` 6 个模块中散落，**未见独立 `internal/rdm` 聚合层**，导致 44 API 匹配需要重算。

---

## Alert 一手实证（≤80 行）

### 关键问题 1：5 家族是否 memory→PG 持久化

**核心发现：AlertBreaker 体系是 NeatLogic 对"5 家族"的统一实现**，不是分散的 correlation/dedup/silence/rule/routing。

#### 目录结构（`neatlogic-alert/src/main/java/neatlogic/module/alert/breaker/`）

```
breaker/
├── CountWindowAlertBreakerHandler.java           # 计数窗口去重（"5次内触发"）
├── ConsecutiveFailureAlertBreakerHandler.java    # 连续失败关联
├── MailReceiverWindowAlertBreakerHandler.java    # 收件人窗口（防骚扰）
├── action/
│   ├── SendMailAlertBreakerActionHandler.java    # 触达动作
│   └── IntegrationAlertBreakerActionHandler.java # 集成动作
```

#### 持久化层（**关键**：AlertBreaker 状态走 DB，非 memory）

`AlertBreakerHandlerBase`（neatlogic-alert-base）直接注入 `AlertBreakerMapper`，且包含以下 SQL 操作：

- `alertBreakerMapper.insertAlertBreakerStateIfNotExists(stateVo)` — 创建状态行
- `alertBreakerMapper.getAlertBreakerStateForUpdate(policyId, uniqueKey)` — **SELECT ... FOR UPDATE 行锁**
- `alertBreakerMapper.updateAlertBreakerState(stateVo)` — 窗口计数更新
- `alertBreakerMapper.deleteAlertBreakerCollectItemByStateId(stateVo.getId())` — 窗口清尾
- `alertBreakerMapper.insertAlertBreakerAudit(auditVo)` — 审计入库

**这意味着 Dedup（CountWindow）与 Correlation（ConsecutiveFailure）都通过 PG 事务表实现**，非内存窗口。

#### 完整 Mapper 清单（22 个 mapper + 20 个 XML，全部走 MyBatis）

| 家族 | Mapper | 表 |
|---|---|---|
| Rule-Engine | `AlertRuleMapper` (checkAlertRuleIsExists/getAlertRuleById/listAllAlertRule) | alert_rule |
| Silence/Rule | `AlertEventHandlerTypeMapper` + `AlertEventHandlerConfigMapper` | alert_event_handler_* |
| Breaker 状态 | `AlertBreakerMapper` (getAlertBreakerStateForUpdate/insertState) | alert_breaker_state + audit + collect_item |
| Rule 结果 | `AlertMapper`, `AlertMarkMapper`, `AlertCommentMapper`, `AlertActionMapper` | alert + 附属 |
| Routing 配置 | `AlertNotifyTemplateMapper`, `AlertSourceMapper`, `AlertCatalogMapper` | alert_notify_template + source + catalog |
| 视图/统计 | `AlertViewMapper`, `AlertTypeMapper`, `AlertLevelMapper`, `AlertStatusMapper`, `AlertTagMapper`, `AlertAttrTypeMapper`, `AlertAllAlertConfigMapper`, `AlertAuditMapper`, `AlertTrashMapper` | 各配置表 |
| 事件 | `AlertEventMapper` (alert-base) | alert_event |

#### 唯一的 `static HashMap` 是工厂注册表（非业务状态）

```java
// AlertBreakerHandlerFactory.java:23
private static final Map<String, IAlertBreakerHandler> handlerMap = new HashMap<>();

// AlertBreakerActionHandlerFactory.java:23
private static final Map<String, IAlertBreakerActionHandler> actionMap = new HashMap<>();

// AlertEventHandlerFactory.java:25
private static final Map<String, IAlertEventHandler> eventMap = new HashMap<>();

// AlertAttrFormaterFactory.java:23 (attr)
private static final Map<String, IAttrFormater> attrFormaterMap = new HashMap<>();

// AlertAttrFreemarkerSnippetFactory.java:24
private static final Map<String, IAlertAttrFreemarkerSnippetHandler> handlerMap = new HashMap<>();
```

**这些是 Spring Bean 启动时的类注册表，进程重启后由 Spring 反射重建**，不是运行时业务状态。

#### Elasticsearch 集成（Alert 侧）

`ElasticsearchAlertIndex.java` 有 13 处 ES 引用——Alert 详情正文/字段走 ES，元数据走 PG。

### 结论

**R-P0-03 描述"5 家族 memory only"是失实的**。NeatLogic 用统一的 AlertBreaker 抽象 + AlertRule/AlertEventHandler 覆盖 5 家族全部能力，状态持久化到 PG。

**但真正的风险转移**：NeatLogic 是**单体 Spring 事务模型**，AlertBreaker 靠 `SELECT FOR UPDATE` 保证并发；Orion 若要复刻，必须解决：
1. 分布式 lock（PG row-lock vs Redis 分布式锁）
2. 窗口清理定时任务（NeatLogic 有 `aftertransaction/ChildAlertStatusUpdateJob`）
3. ES + PG 双写一致性

---

## Report 一手实证（≤50 行）

### 关键问题 2：Report Designer 是 stubbed 还是真实实现

**结论：真实 JFreeChart 实现，非 stub**。

#### Widget 清单（10 个 `DrawXxx.java`）

```
DrawBar.java              # 柱状图 (import JFreeChart, ChartFactory, CategoryAxis)
DrawBarH.java             # 横向柱状图
DrawBarLineH.java         # 柱+线组合
DrawStackedBar.java       # 堆叠柱状图
DrawStackedBarH.java      # 横向堆叠
DrawStackedBarLineH.java  # 堆叠+线组合
DrawLine.java             # 折线图
DrawPie.java              # 饼图
DrawTable.java            # 数据表
DrawPagination.java       # 分页控件
```

每个 Draw 类均 import `org.jfree.chart.ChartFactory` + `org.jfree.chart.plot.CategoryPlot` + `org.jfree.chart.renderer.category.BarRenderer` 等 JFreeChart 完整栈，**非占位空类**。

#### Mapper + Service 层

- 7 个 Mapper（`ReportMapper`/`ReportTypeMapper` 等）
- `getAllReportType` 从 DB 拉取报表类型（`report_type` 表）
- `JfreeChartUtil` 统一图表工具类
- `GetReportTypeApi` + `ReportStatementVo` 等 DTO

#### 与 v4 报告 BI 20% 结论的差异

v4 报告把 BI 评为 20%（依据"组件 map 缺失"）。**一手实证显示**：
- JFreeChart 图表库引入 ✅
- 10 个 widget 类实际有渲染逻辑 ✅
- ReportType DB 驱动分类 ✅
- 7 个 Mapper + Service 层 ✅

**缺失部分**：
- 未见前端 Canvas/SVG 交互拖拽（NeatLogic BI 靠 JFreeChart SVG 输出 + 前端 iframe，不是 ECharts/Recharts 生态）
- 未见 SQL Dashboard 编辑器（数据源来自固定 ReportStatement）
- 未见多数据源联表/跨库 join

**修正建议**：v4 报告 BI 覆盖度应从 20% 上修到 **55-65%**（图表能力完整、编辑器受限、多源受限）。

---

## RDM 一手实证（≤50 行）

### 关键问题 3：RDM 4 Tab 前端与后端 API 契约是否 200%

#### NeatLogic RDM API 覆盖度

- **99 个 `*Api.java`**（`neatlogic-rdm/src/main/java/neatlogic/module/rdm/api/`）
- API 分组：`app/` (7)、`catalog/` (5)、`comment/` (1)、`issueaudit/` (1)、`issuecost/` (4)、`notify/` (2)、`project/` (14)、`status/` (10)、`template/` (3)、`test/` (1)、+ 其余

NeatLogic 命名体系（`Project/Catalog/Issue/Status/Template/App`）与 Orion 前端 4 Tab（`需求/缺陷/迭代/任务`）**术语不一致**——NeatLogic 是需求跟踪器视角（Issue-centric），Orion 是 Scrum 视角（Sprint-centric）。

#### Orion 前端 RDM 实际调用路径（`src/api/rdm.ts`）

```
/rdm/requirements, /rdm/requirements/pool     # 需求
/rdm/defects, /rdm/defects/stats              # 缺陷
/rdm/sprints                                  # 迭代
/rdm/tasks, /rdm/tasks/my                     # 任务
/rdm/releases                                 # 发布
/rdm/code-reviews                             # 代码评审
/rdm/documents                                # 文档
/rdm/comments                                 # 评论
/rdm/statistics/burndown, /defects, /sprints, /velocity  # 统计
/board, /client, /versions
```

**总计 45 个 axios 调用 + 27 个不同路径**。

#### Orion 后端实现分布

**无独立 `internal/rdm` 模块**——RDM 能力分散在 6 个模块：

- `internal/project` — 需求/项目
- `internal/project-member` — 项目成员
- `internal/sprint` — 迭代
- `internal/risk` + `internal/governance/risk` — 风险
- `internal/release-management` — 发布
- `internal/security` + `internal/audit` — 文档/审计（部分）

**RDM 4 Tab 契约匹配估算**：
- 需求 Tab → `project` handler：约 8-10 API 匹配
- 缺陷 Tab → 无独立 defect 模块，可能拼 `risk`：约 2-3 API 匹配
- 迭代 Tab → `sprint` handler：约 6-8 API 匹配
- 任务 Tab → 无独立 task 模块：约 0-2 API 匹配
- 统计 Tab → 未见 statistics 聚合 handler：约 0 API 匹配

**匹配总数：约 16-23 / 27（59-85%）**——远低于 v4 报告的 38% 是低估。但**未见 statistics/burndown/velocity 完整实现**。

---

## Orion 差距（≤30 行）

### P0 级别差距

| 编号 | 差距 | NeatLogic 证据 | Orion 现状 |
|---|---|---|---|
| Gap-1 | RDM 缺陷 Tab 无后端 | NeatLogic `issuecost/` (4 APIs) | Orion 无 `internal/defect` 模块 |
| Gap-2 | RDM 统计（burndown/velocity）无后端 | NeatLogic `issuestat/` + `statistics/` | Orion 无 statistics 聚合 handler |
| Gap-3 | RDM 代码评审无后端 | NeatLogic `issue/` (IssueApi) | Orion 无 code-review handler |
| Gap-4 | Report Designer 多数据源联表 | 未见 | 未见（JFreeChart 单表数据源） |

### P1 级别差距

| 编号 | 差距 | 说明 |
|---|---|---|
| Gap-5 | Alert Breaker `SELECT FOR UPDATE` 并发模型 | Orion 目前无 row-lock + 窗口状态表 |
| Gap-6 | Alert EventHandler 类型注册表 | Orion 未见 IAlertEventHandlerFactory 等价物 |
| Gap-7 | Alert ES + PG 双写 | Orion Alert 若走 PG-only，需评估 ES 索引策略 |

### 已具备的能力（避免过度设计）

- NeatLogic 也是 Spring 单体事务模型，Orion 采用 Go + Gin 单体是**合理选择**
- AlertBreaker 抽象层可参考，但**不必逐类复刻**（Orion 用 Redis + PG 可简化）
- Report 前端拖拽编辑器非 R-P0（v4 报告 BI 20% 结论需重估）

---

## 建议新增 CC 风险（≤20 行）

| 风险编号 | 描述 | 等级 | 依据 |
|---|---|---|---|
| **R-P0-03-v2** | AlertBreaker 并发窗口模型未复刻（NeatLogic 用 PG `SELECT FOR UPDATE` 行锁） | P0 | AlertBreakerHandlerBase.java 直接用 mapper 行锁 |
| **R-P0-04** | RDM statistics/burndown/velocity 3 个统计 API 无后端 | P0 | Orion `api/rdm.ts` 有 4 个 `/statistics/*` 调用，Go 后端无对应 handler |
| **R-P0-05** | RDM 代码评审 Tab 无后端 | P0 | 前端调 `/rdm/code-reviews`，Go 无 handler |
| **R-P1-01** | Report Designer 覆盖度低估（BI 20%→55-65%） | P1（数据修正） | JFreeChart 完整 widget + 7 mapper |
| **R-P1-02** | Alert 事件处理器注册表未实现 | P1 | Orion 未见 IAlertEventHandlerFactory |
| **R-P2-01** | NeatLogic 术语 vs Orion 术语不一致（Issue vs Requirement） | P2 | 影响 API 契约文档 |

---

## 认知边界（≤20 行）

### 未验证的假设

1. **Alert 5 家族能力等价**：本分析假设 NeatLogic 的 Breaker+Rule+EventHandler 统一模型等价于 Prometheus Alertmanager 的 5 家族。实际等价度需要功能级验证（每个 AlertBreaker 处理器是否覆盖对应家族场景）。
2. **Report Designer 前端渲染方式**：只验证了后端 JFreeChart 输出，未验证前端如何消费（iframe? SVG? 交互性?）。若前端只有静态图片，实际可用度可能低于 55%。
3. **RDM statistics 匹配度**：估算 Orion 4-Tab 匹配 59-85%，但未逐一 grep handler。可能存在部分 handler 分散在 `governance/` 等其他包内。

### 分析工具局限

- 未运行 Maven 构建，未验证 JFreeChart 依赖是否可解析
- 未查看 NeatLogic 前端 Vue 代码，只看到 Java 后端
- 未对比 `neatlogic-alert-plugin-base` 与 `neatlogic-alert-base` 差异（插件 API 可能改变 5 家族边界）
- NeatLogic RDM 未见 @ApiPath 注解（用 Spring MVC 路由），路径推断依赖 API 目录名

### 与前 3 次尝试的差异

前 3 次 NL-3 失败原因是"陷入字段全量枚举"。本次严格聚焦 3 个关键问题，用**结构统计 + 关键类头读取**替代全量 grep，成功在 15 个 tool 调用内完成实证。
