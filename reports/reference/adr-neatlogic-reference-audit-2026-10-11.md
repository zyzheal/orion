# ADR-010 ~ ADR-015 参照系引用审计（2026-10-11）

> **审计起因**：基线固化（`reports/reference/neatlogic-baseline-2026-10-11.md`）发现
> ADR-010 引用的 `AlertBreakerMapper` 在 NeatLogic 全仓 **0 命中**（虚构标识）。
> 既然一份 ADR 的参照系是虚构的，同类缺陷必须系统性排查，而非逐个发现。
>
> **审计范围**：`docs/adr/ADR-010` ~ `ADR-015`（6 份，2,637 行）中所有
> 「NeatLogic 一手证据」类断言，逐条对照 `~/refs/neatlogic/`（44 仓库 @ 固定 SHA）机械验证。
>
> **RC-03 硬约束**：本审计为只读核查 + 事实记录，**未修改任何 ADR 文件、未修改任何生产代码**。
> **不估算人天/工期。**

---

## 0. 结论总览

| ADR | 主题 | 判定 | 一句话 |
|---|---|---|---|
| ADR-010 | AlertBreaker 并发模型 | ❌ **虚构** | 类不存在 + 数据库技术判断反了（NL 是 MySQL，非 PG） |
| ADR-011 | 多租户存储隔离 | ✅ **真实** | `NeatLogicRoutingDataSource` + `ThreadLocal TenantContext` 均存在 |
| ADR-012 | Factory-Handler 注册表 | ⚠️ **模式真、细节假** | 模式真实（115 Factory / 810 Handler），`AlertEventHandlerFactory` 虚构、数量 12 非 25+ |
| ADR-013 | CMDB 二阶模型 | ❌ **命名全错** | 4 层名（Type→Template→Instance→Transaction）中 3 个类不存在 |
| ADR-014 | Pipeline ArtifactBus | ❌ **完全虚构** | `TaskHandlerContext` / `TaskHandlerType` / `*TaskHandler*.java` 全部 0 命中 |
| ADR-015 | Change 建模 | ✅ **真实** | `ChangeProcessStepHandlerType.CHANGECREATE/.CHANGEHANDLE` 在真实代码中被调用 |

**统计**：6 份 ADR 中 **2 份完全真实、1 份部分真实、3 份参照系失效（1 虚构 + 1 命名全错 + 1 完全虚构）**。
失效率 **50%**——这不是零散笔误，而是系统性的「先立论、后找证据、找不到就补一个听起来合理的类名」。

---

## 1. ADR-010 ❌ 双重虚构

### 1.1 主张

> 「参考对标：NeatLogic `AlertBreakerMapper.getAlertBreakerStateForUpdate()`（NL-3 一手证据）」
> 「NeatLogic 选择 PG 行锁（`SELECT ... FOR UPDATE`）作为 AlertBreaker 并发窗口模型」

### 1.2 机械验证

| 检索 | 命令 | 结果 |
|---|---|---|
| `*Breaker*.java` 文件名 | `find ~/refs/neatlogic -name '*Breaker*.java'` | **0** |
| 源码含 `Breaker` 字符串 | `grep -rl 'Breaker' --include='*.java'` | **0** |
| `alert` 模块含 `breaker` 大小写不敏感 | `grep -rli 'breaker' neatlogic-alert` | **0** |
| `alert` 模块 XML 含 `FOR UPDATE` | `grep -rl 'FOR UPDATE' neatlogic-alert --include='*.xml'` | **0** |
| 全仓 `FOR UPDATE` | `grep -rl 'FOR UPDATE' --include='*.java' --include='*.xml'` | 9（**无一在 alert**） |

### 1.3 更深一层：数据库技术判断反了

ADR-010 全篇以「对齐 NeatLogic 的 PG 语义」为最高理由（矩阵中 ⭐⭐⭐⭐⭐ 1:1）。
但 NeatLogic **根本不是 PostgreSQL**：

| 证据 | 结果 |
|---|---|
| `mysql-connector-j` 在 pom.xml | ✅ 存在 |
| `jdbc:mysql` 连接串 | ✅ 存在（2 处） |
| `ON DUPLICATE KEY UPDATE`（MySQL 专有） | **45 文件** |
| `REPLACE INTO`（MySQL 专有） | **11 文件** |
| `ON CONFLICT`（**PG 专有**） | **0 文件** |

**含义**：即使 `AlertBreakerMapper` 存在，「与 NeatLogic SQL 1:1 对齐」也不可能——
两个系统的 SQL 方言不同。ADR-010 的对齐论据在本体论层面就不成立。

### 1.4 NeatLogic Alert 的真实并发/抑制机制

`neatlogic-alert` 中真实存在的间隔窗口实现是 **调度器任务**，不是行锁状态表：

```java
// neatlogic-alert/.../event/AlertIntervalEventHandler.java（182 行，真实存在）
JSONArray intervalList = alertEventHandlerVo.getConfig().getJSONArray("intervalList");
Integer intervalMinute = config.getInteger("intervalMinute");
IJob jobHandler = SchedulerManager.getHandler(AlertEventIntervalScheduleJob.class.getName());
builder.withIntervalInSeconds(intervalMinute * 60);
alertMapper.insertAlertIntervalJob(alertIntervalJobVo);   // 落 job 行，由调度器触发
```

| 维度 | NeatLogic 真实做法 | ADR-010 描述 |
|---|---|---|
| 抑制载体 | 配置 JSON（`intervalList` / `intervalMinute`） | 独立 `alert_breaker_state` 表 |
| 触发方式 | `SchedulerManager` 定时任务 | `SELECT ... FOR UPDATE` 事务内 |
| 去重 idiom | `ON DUPLICATE KEY UPDATE`（见 `saveAlertAttr`） | 未提及 |
| 锁 | 无显式锁 | PG Serializable + 5s 超时 |

**修正建议（待用户确认）**：ADR-010 的**技术决策本身可以保留**（PG 行锁对 Orion 的 PG 架构是合理选择），
但必须删除全部「对齐 NeatLogic」论据，改为独立论证。第 1.1、1.3、5.1、5.2 节与矩阵中
「与 NeatLogic 对齐」整行需重写；`alert_breaker_state` 表设计可保留。

---

## 2. ADR-011 ✅ 真实（命名不精确）

### 2.1 主张

> 「NeatLogic Schema-per-tenant（NL-8 一手：ThreadLocal TenantContext + 独立 DB schema）」

### 2.2 机械验证

| 检索 | 结果 |
|---|---|
| `TenantContext.java` | ✅ **2 个**：`neatlogic-framework/.../asynchronization/threadlocal/TenantContext.java`、`neatlogic-runner/.../TenantContext.java` |
| `private static final ThreadLocal<TenantContext> instance` | ✅ 两文件均有 |
| `extends AbstractRoutingDataSource` | ✅ **1 个**：`store/mysql/NeatLogicRoutingDataSource.java`（38 行） |

核心代码（真实）：

```java
public class NeatLogicRoutingDataSource extends AbstractRoutingDataSource {
    protected Object determineCurrentLookupKey() {
        if (TenantContext.get() != null && StringUtils.isNotBlank(TenantContext.get().getTenantUuid())) {
            String key = TenantContext.get().getTenantUuid();
```

### 2.3 命名修正：是 DB-per-tenant，不是 schema-per-tenant

ADR-011 说「独立 DB **schema**」。实测：全仓 **213 个 Mapper XML 中 `tenant_id` 出现 0 次**，
schema 切换相关代码仅 3 个文件且均为 CMDB「CI schema」（数据模型结构，非租户库）。
`AbstractRoutingDataSource` 的 key 是 `tenantUuid`，路由目标是**整个 DataSource（独立库）**，
不是同库内的不同 schema。

| 表述 | 判定 |
|---|---|
| ThreadLocal TenantContext | ✅ 精确 |
| 独立数据库（每租户一个库） | ✅ 正确 |
| 独立 schema（同库多 schema） | ❌ 应为 **独立 DataSource / DB-per-tenant** |

**含义**：ADR-011 的技术结论成立，但「schema-per-tenant」这个术语会让实现者误做
同库多 schema（PostgreSQL 可行、MySQL 不可行）。术语需改为 DB-per-tenant。
这直接决定 §2.2 方案 B 的实现形态，属于需要修正的实质错误，不是文字问题。

---

## 3. ADR-012 ⚠️ 模式真实、引用细节虚构

### 3.1 主张

> 「NeatLogic 100+ Handler + Factory 注册表（NL-3 一手：AlertEventHandlerFactory 25+ handler）」

### 3.2 机械验证

| 检索 | 结果 | 判定 |
|---|---|---|
| `*Factory*.java` 全仓总数 | **115** | ✅ 「100+」成立 |
| `*Handler*.java` 全仓总数 | **810** | ✅ 远超 100+ |
| `AlertEventHandlerFactory.java` | **0** | ❌ **虚构** |
| `extends AlertEventHandlerBase`（alert 仓） | **12** | ❌ 「25+」高估 2 倍以上 |

**含义**：ADR-012 的**核心论点（Factory+Handler 是 NeatLogic 的主力扩展模式）完全正确且有规模证据**，
这是 6 份 ADR 中唯一「论据方向对、引用对象错」的一份。
只需删除 `AlertEventHandlerFactory 25+` 这个具体锚点，或替换为真实存在的锚点
（如 `DataSourceServiceHandlerFactory` / `TreeSelectDataSourceFactory` / `MatrixDataSourceHandlerFactory`），
ADR-012 即可完全成立。

---

## 4. ADR-013 ❌ 4 层模型命名全部失效

### 4.1 主张

> 「NeatLogic 4 层模型（NL-1 一手：Type → Template → Instance → Transaction）」

### 4.2 机械验证

| ADR 所述层名 | 类文件数 | 判定 |
|---|---:|---|
| `CiType` | **0** | ❌（真实是 `CiTypeVo`） |
| `CiTemplate` | **0** | ❌ **该层不存在** |
| `CiInstance` | **0** | ❌ |
| `CiTransaction` | **0** | ❌（真实是 `TransactionVo` + 8 个 transaction DTO） |

### 4.3 真实结构

`neatlogic-cmdb-base/.../cmdb/dto/` 下 **18 个真实子域目录**：

```
ci/        attrexpression/   cientity/     globalattr/   transaction/
view/      customview/       diagram/      graph/        discovery/
group/     tag/              sync/         batchimport/  resourcecenter/
validator/ legalvalid/       （等）
```

| 层 | 真实类 | 存在 |
|---|---|---|
| 类型 | `CiTypeVo`（9 字段）、`CiViewVo` | ✅ |
| 属性类型 | `AttrTypeVo`（8 字段） | ✅ |
| 属性 | `AttrVo`（**45** 字段） | ✅ |
| 实例 | `CiEntityVo` | ✅（非 `CiInstance`） |
| 事务 | `TransactionVo` + 8 个 `*TransactionVo` | ✅ |
| **模板** | 仅 `CiTopoTemplateVo` / `CustomViewTemplateVo` | ❌ **无独立模板层** |

**含义**：ADR-013 的「4 层」应改为「**类型层（CiTypeVo/AttrTypeVo）→ 属性层（AttrVo）
→ 实体层（CiEntityVo/AttrEntityVo）→ 事务层（TransactionVo）**」，且**不存在独立的 Template 层**。
这与基线文件 §2 的字段级真值一致（`AttrVo` 45 字段是二阶模型的核心）。
`reports/module-upgrade-designs/reference-verification-and-refined-plan-2026-10-11.md` 中
按 §2 重写的 P0-1 spec 已经用对了字段；但 ADR-013 正文的层名仍须同步修正。

---

## 5. ADR-014 ❌ 完全虚构

### 5.1 主张

> 「NeatLogic TaskHandler 生态（NL-2 一手：TaskHandlerType 10+ 类型）」
> 「NeatLogic TaskHandler 生态通过 `TaskHandlerContext` 传递产物」

### 5.2 机械验证

| 检索 | 结果 |
|---|---|
| `TaskHandlerContext.java` | **0** |
| `TaskHandlerType` 类/枚举 | **0** |
| `*TaskHandler*.java` 全仓 | **0** |

**三个锚点全部 0 命中。这是 6 份 ADR 中唯一「参照系从零开始就是虚构的」一份。**

### 5.3 真实存在的相关概念

NeatLogic 的任务/流程概念叫 **ProcessStepHandler**，不是 TaskHandler：

| 真实类 | 数量 |
|---|---:|
| `ProcessStepHandlerVo` | 1 |
| `ProcessStepHandlerType`（枚举） | 7 值：`START` / `OMNIPOTENT` / `END` / `CONDITION` / `DISTRIBUTARY` / `AUTOMATIC` / `TIMER` |
| `AutoexecProcessStepHandlerType` | 1 |
| `EventProcessStepHandlerType` | 1 |
| `*StepHandler*.java` 总数 | **20** |
| `*ProcessTask*.java` 总数 | **503** |

ADR-014 中「10+ 类型」实际对应 `ProcessStepHandlerType` 的 **7 值**，
且「传递产物」的真实载体是 `ProcessTaskStepVo` / `ProcessTaskStepConfigVo`，不是 `TaskHandlerContext`。

---

## 6. ADR-015 ✅ 真实

### 6.1 主张

> 「NeatLogic 的 Change 模块**不是独立工单**，而是 ProcessTask 的 StepHandler」

### 6.2 机械验证

真实代码 `neatlogic-itsm/.../ProcessTaskServiceImpl.java`：

```java
// line 23
import neatlogic.framework.change.constvalue.ChangeProcessStepHandlerType;
// line 3029-3030
if (EventProcessStepHandlerType.EVENT.getHandler().equals(currentStep.getHandler())
    || ChangeProcessStepHandlerType.CHANGECREATE.getHandler().equals(currentStep.getHandler())
    || ChangeProcessStepHandlerType.CHANGEHANDLE.getHandler().equals(currentStep.getHandler())) {
```

| 检索 | 结果 | 判定 |
|---|---|---|
| `ChangeProcessStepHandlerType.CHANGECREATE` | ✅ 真实代码中调用 | ✅ |
| `ChangeProcessStepHandlerType.CHANGEHANDLE` | ✅ 真实代码中调用 | ✅ |
| `currentStep.getHandler()`（Step 持有 handler 名） | ✅ | ✅ |
| `*ProcessTask*.java` | **503 文件** | ✅ 规模佐证 |

**注**：`ChangeProcessStepHandlerType` 的**定义文件**不在公开 44 仓库中（仅在
`neatlogic-itsm` 的 import 与调用处可见），推测位于未公开模块。但**使用证据是机械可验证的**，
且足以支撑 ADR-015 的建模结论。这是 6 份中唯一无需修正的 ADR。

---

## 7. 缺陷模式分析

3 份失效 ADR 呈现**完全一致的生成模式**：

| 步骤 | 表现 |
|---|---|
| ① 先确定要做的技术决策 | ADR-010 已定「PG 行锁」；ADR-014 已定「TaskHandler 传递产物」 |
| ② 需要「对标依据」增强说服力 | 引入「NL-x 一手证据」 |
| ③ 找不到确切类名时**补一个结构合理的名字** | `AlertBreakerMapper.getAlertBreakerStateForUpdate()`、`TaskHandlerContext` |
| ④ 名字听起来像 MyBatis Mapper / Spring Handler，无法直觉证伪 | 于是被后续 73 份报告继承 |
| ⑤ 有时连技术栈前提都写反 | ADR-010 把 MySQL 系统当成 PG 系统 |

**唯一能系统性防住这个模式的办法就是本次做的**：把参照系固化为可机械复现的 commit SHA，
然后对每一个引用的标识符跑 `find` / `grep`。§6 基线文件的验收标准第 4 条（`Breaker` 全仓 0 命中）
就是这条防线。

---

## 8. 待用户确认的处置清单

> 按 RC-03，**本报告未修改任何 ADR**。以下为建议处置，需显式确认。

| # | ADR | 建议处置 | 是否影响技术决策 |
|---|---|---|---|
| 1 | ADR-010 | **重写 §1.1 / §1.3 / §5.1 / §5.2 + 矩阵「与 NeatLogic 对齐」行**：删除全部 NL 论据，改为独立论证 PG 行锁；`alert_breaker_state` 表设计保留 | ❌ 决策不变，仅论据更换 |
| 2 | ADR-011 | 术语「Schema-per-tenant」→「DB-per-tenant」，全篇同步（含 §2.2 方案 B 标题） | ⚠️ **影响实现形态**：同库多 schema vs 独立库，不可混用 |
| 3 | ADR-012 | 删除 `AlertEventHandlerFactory 25+`，替换为真实锚点 `DataSourceServiceHandlerFactory` | ❌ 决策不变 |
| 4 | ADR-013 | 4 层名改为 `CiTypeVo/AttrTypeVo` → `AttrVo` → `CiEntityVo` → `TransactionVo`；**删除不存在的 Template 层** | ⚠️ 影响 P0-1 Migration 设计（少一层） |
| 5 | ADR-014 | **整份重写参照系**：`TaskHandler*` → `ProcessStepHandler*`（7 类型，非 10+） | ⚠️ 影响 ArtifactBus 接口命名与产物载体 |
| 6 | ADR-015 | 无需修改 | — |

---

## 9. 复现命令

```bash
cd ~/refs/neatlogic

# ADR-010：AlertBreaker 不存在 + DB 技术是 MySQL
find . -name '*Breaker*.java'                                          # → 空
grep -rli 'breaker' neatlogic-alert                                    # → 空
grep -rl 'ON CONFLICT' --include='*.xml' --include='*.java' .          # → 0（PG 专有，不存在）
grep -rl 'ON DUPLICATE KEY UPDATE' --include='*.xml' . | wc -l         # → 45（MySQL 专有）
grep -rh 'mysql-connector-j' --include='pom.xml' .                     # → 存在
grep -rl 'FOR UPDATE' neatlogic-alert --include='*.xml'                # → 空
cat neatlogic-alert/src/main/java/neatlogic/module/alert/event/AlertIntervalEventHandler.java

# ADR-011：真实隔离机制
grep -rl 'extends AbstractRoutingDataSource' --include='*.java' .      # → 1
cat neatlogic-framework/src/main/java/neatlogic/framework/store/mysql/NeatLogicRoutingDataSource.java
grep -rl 'private static final ThreadLocal<TenantContext>' --include='*.java' .   # → 2
find . -name '*.xml' -path '*mapper*' -exec grep -l 'tenant_id' {} + | wc -l  # → 0（无列过滤）

# ADR-012：模式真、锚点假
find . -name 'AlertEventHandlerFactory.java'                           # → 空
find . -name '*Factory*.java' | wc -l                                  # → 115
find . -name '*Handler*.java' | wc -l                                  # → 810
grep -rl 'extends AlertEventHandlerBase' neatlogic-alert | wc -l       # → 12

# ADR-013：4 层命名全错
for k in CiType CiTemplate CiInstance CiTransaction; do
  find . -name "${k}.java" | wc -l                                     # → 全 0
done
find neatlogic-cmdb-base/src/main/java/neatlogic/framework/cmdb/dto -maxdepth 1 -type d | wc -l  # → 18 个真实子域
find neatlogic-cmdb-base -path '*dto/transaction*' -name '*.java' | wc -l                        # → 8

# ADR-014：完全虚构
find . -name 'TaskHandlerContext.java' -o -name 'TaskHandlerType.java'  # → 空
find . -name '*TaskHandler*.java' | wc -l                               # → 0
find . -name '*StepHandler*.java' | wc -l                               # → 20（真实概念）

# ADR-015：真实
grep -rn 'ChangeProcessStepHandlerType' neatlogic-itsm --include='*.java' | head
grep -n 'getHandler()' neatlogic-itsm/src/main/java/neatlogic/module/process/service/ProcessTaskServiceImpl.java | head -3
find . -name '*ProcessTask*.java' | wc -l                               # → 503
```

---

## 10. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | 6 份 ADR 逐条审计，无遗漏 | §0 总览覆盖 ADR-010~015 全部 |
| 2 | 每项判定附机械命令与命中数 | §1~§6 各含检索表 |
| 3 | 未修改任何 ADR 文件 | `git diff -- docs/adr/` 为空 |
| 4 | 未修改任何生产代码 | `git diff -- '*.go' '*.ts' '*.tsx'` 为空 |
| 5 | 全部命令可复现 | §9 |
| 6 | 本文不含人天/工期估算 | 全文检索 `人天`/`工期`/`人日` 为空（仅标题性否定句除外） |

---

**核心结论**：ADR-010 / 014 的参照系不存在，ADR-013 的层名不存在，ADR-012 的锚点不存在。
**只有 ADR-011 与 ADR-015 的参照系经得起机械验证。**
任何以 ADR-010/013/014 为前提的下游设计（含 Stage Gate S4 pre 门控、Migration 编号分配）
都建立在虚构引用之上，须在实施前修正。
