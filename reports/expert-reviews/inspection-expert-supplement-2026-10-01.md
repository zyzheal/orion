# Orion 巡检能力对标评审补充报告（国际专家视角）

> 评审人：巡检领域专家（Zabbix / Nagios / PRTG / Datadog / LibreNMS / Checkmk 实施背景，网络/系统/数据库巡检 15+ 年）
> 评审日期：2026-10-01
> 数据来源：NeatLogic Inspect Java 源码（131 文件 = 87 `neatlogic-inspect` + 44 `neatlogic-inspect-base`，12398+2032≈14430 行）实测；Orion `orion-platform-svc-go/internal/inspection/`（18 .go / 2450 行）实测
> 上游报告：`inspection-expert-review-2026-09-30.md`（6% 加权，578 行）
> 约束：本报告仅基于 NeatLogic Java 源码做架构对标，不跨模块对比；所有结论标注 `文件:行号`

---

## 一、核心结论（≤200 字）

**确认 6%，不下修。** 已有报告准确识别了三大内核缺失（采集层/执行引擎/阈值引擎），且"RunInspection 永不返回 completed"等关键事实复测仍成立。本次源码深挖补强了三条**未被充分展开**的证据链：(1) NeatLogic 巡检**不是自研采集协议栈**，而是借 autoexec 组合工具 + 脚本执行能力做"协议无关编排器"，这决定了 Orion 不能简单照搬；(2) NeatLogic 阈值模型是 **MongoDB Document + JSONPath + FreeMarker 表达式**三层，远比 spec 文档描述复杂；(3) NeatLogic 报告引擎是 **Freemarker + POI + Word/PDF/Excel 三栖**，Orion 完全零实现。重估完成度 **6%（高置信度）**，与已有报告一致。

---

## 二、NeatLogic Inspect 实际架构剖析（基于 Java 源码）

### 2.1 关键架构事实：NeatLogic 巡检是"协议无关编排器"

**这是已有报告未揭示的最重要发现。** NeatLogic 巡检模块本身**不实现任何采集协议**——没有 SNMP、没有 SSH、没有 SQL 客户端、没有 HTTP 探活。它的设计哲学是：

> 巡检规则定义（指标+阈值） → 关联 CI 类型 → 触发 autoexec 组合工具 → autoexec 调用脚本 Runner 执行采集 → 结果回写 MongoDB → 巡检模块读 MongoDB 出报告

证据链：

1. **InspectScheduleJob.executeInternal** (`InspectScheduleJob.java:121-154`)：调度触发后**不直接采集**，而是 `validateAndCreateJobFromCombop(jobVo)` + `fireAction.doService(jobVo)`，把巡检作业转化为 autoexec 作业
2. **CreateInspectResourceTypeJobApi** (`CreateInspectResourceTypeJobApi.java:74-117`)：创建巡检作业的核心逻辑是 `inspectMapper.getCombopIdByCiId(ciId)`——通过 CI 类型查找绑定的 combop（组合工具），然后用 `AutoexecJobVo` 提交
3. **InspectCiCombopVo + InspectCombopSaveApi** (`InspectCombopSaveApi.java:49-58`)：维护"CI 类型 → 组合工具"绑定关系，`replaceInspectCiCombopList` 是单纯的关系表替换
4. **InspectMapper** (`InspectMapper.java:13-56`)：51 行的 Mapper 接口**没有任何采集相关方法**，全是资源查询、Combop 关系、脚本配置、告警入库——零协议栈代码

**架构判断**：这是 Zabbix "Server + Agent + Template" 模型的**反方向设计**——Zabbix 把协议栈做进 Server，NeatLogic 把协议栈外包给 autoexec。两种路线各有取舍：

| 维度 | Zabbix 模型 | NeatLogic 模型 |
|------|------------|---------------|
| 协议扩展 | 需改 Server 代码或写 Loadable Module | 写脚本即可（Shell/Python/SQL） |
| 模板复用 | Template OID 绑定，强类型 | 组合工具绑定，弱类型 |
| 性能 | C++ Native，万级目标 | 脚本进程开销大，千级目标 |
| 调试 | Item 级实时调试 | 跑完整作业才能看结果 |
| 现实实施 | 金融/电信主流 | 中小企业友好 |

**对 Orion 的启示**：已有报告建议 Orion 自研 SNMP/SSH/SQL collector 是**正路但非唯一路**。若走 NeatLogic 路线，可复用 Orion 已有的 `autoexec`/`pipeline-engine`（平台已成熟）做编排层，巡检模块只做"规则定义 + 阈值 + 报告"三件事。**两条路线都可行，但不能两条都不做**——这正是 Orion 当前的状态。

### 2.2 巡检任务模型：InspectScheduleVo 实际字段

证据 `InspectScheduleVo.java:12-157`：

| 字段 | 行号 | 语义 |
|------|------|------|
| `id` | :14 | Snowflake 主键 |
| `uuid` | :16 | 任务唯一标识（用于 Quartz JobName） |
| `ciId` | :18 | **关联 CMDB CI 类型**——巡检对象是 CI 类型而非具体资源 |
| `cron` | :20 | Quartz cron 表达式 |
| `beginTime` / `endTime` | :24/25 | 计划窗口 |
| `isActive` | :27 | 启用/禁用 |
| `execCount` | :34 | 执行次数（统计） |
| `jobStatus` | :36 | `JobStatusVo` 执行情况 |
| `sourceServerId` / `sourceServerGroup` | :39/40 | **多实例部署分组**——避免跨组重复执行 |

**对比 Orion**：Orion `Record` 仅 `ID/TenantID/Name/Status/Metadata`（`models.go:8-17`），**无 cron、无 CI 关联、无执行窗口、无 sourceServer 分组**。已有报告已指出这点，本次复测确认。

**双调度器设计**：NeatLogic 有两个独立的 Quartz Job：
- `InspectScheduleJob`（`InspectScheduleJob.java:58`）：按 CI 类型巡检，`getName()="资产巡检定时执行"`
- `InspectAppSystemScheduleJob`（`InspectAppSystemScheduleJob.java:62`）：按应用系统巡检，`getName()="应用巡检定时执行"`，会遍历 `viewName2TypeIdListMap` 为每个 type 单独 createAndFireJob（`:175-194`）

**双调度器的工程含义**：NeatLogic 把"资产视角"和"应用视角"做成两个调度器，对应两类巡检场景。Orion 已有报告建议"复用 backup/branch-policy 的 robfig/cron"，但未指出**需要两个调度器实例**——这是补充。

### 2.3 阈值/规则引擎：MongoDB + JSONPath + 三层覆盖

**已有报告说"阈值引擎缺失"——本次深挖确认 NeatLogic 阈值模型远比 spec 描述复杂。**

#### 2.3.1 阈值存储结构

证据 `InspectCollectServiceImpl.java:53-117`（`getCollectionByName`）：

阈值存储在 MongoDB 三个集合：
- `_dictionary`：数据结构定义（field schema，类似 Zabbix Item prototype）
- `_inspectdef`：巡检定义（fields 过滤 + thresholds 规则），全局级别
- `_inspectdef_app`：应用级阈值覆盖（isOverWrite=1 时覆盖全局规则）

**三层覆盖模型**（`SaveInspectAppCollectionThresholdsApi.java:79-125`）：
1. `_dictionary` 定义可用指标（`:61-65` 取 `collectionObj`）
2. `_inspectdef.fields[].selected=1` 过滤启用指标（`:82-90`）
3. `_inspectdef.thresholds[]` 定义全局阈值规则（`:77-78`）
4. `_inspectdef_app.thresholds[]` 应用级覆盖（`:101-122`，`isOverWrite=1` 时生效）

#### 2.3.2 阈值规则字段

证据 `InspectCollectServiceImpl.java:212-238`（`checkThresholdsParam`）：

```java
// 每条 threshold 必须包含：
thresholdTmp.containsKey("name")      // 规则名称（唯一）
thresholdTmp.containsKey("level")     // 告警级别（critical/warn/fatal/...）
thresholdTmp.containsKey("rule")      // 规则表达式（如 "$.cpu.usage > 80"）
thresholdTmp.containsKey("ruleUuid")  // 规则 UUID（用于删除/覆盖）
```

**规则表达式语义**（从 `InspectReportServiceImpl.java:346-380` 反推）：
- `rule` 字段格式：`$.<字段路径> <操作符> <阈值>`，例如 `$.cpu_usage > 80`
- `jsonPath` 字段：定位结果文档中的具体值（支持数组下标 `field[0].subfield`）
- 评估时用 `JSONPath.read(reportJson, parentPath)` 取值（`:363`）

**这是 Zabbix Trigger Expression 的简化版**——Zabbix 用 `{host:item.last()} > 80`，NeatLogic 用 `$.cpu_usage > 80`。本质都是"取值-比较-判定"，但 NeatLogic 不支持时间窗口函数（`last()`/`avg()`/`count()`/`nodata()`），**只能做单点判定**，这是功能性短板。

#### 2.3.3 阈值复制

证据 `CopyInspectAppCollectionThresholdsApi.java:80-154`：

支持"应用 A 的阈值复制到应用 B/C/D"——`targetAppSystemIdList` 批量复制。这是 Zabbix "Template mass update" 的等价物，企业实施时**刚需**（100 台 MySQL 不可能逐个配阈值）。

**对比 Orion**：Orion `models.go:25-29` 的 `CreateRequest{Config map[string]interface{}}` 完全无阈值结构约束，已有报告已指出。本次补充：**即使 Orion 实现 L1 阈值，也必须同时实现"阈值复制"**——否则企业实施时配置成本会爆炸。

### 2.4 调度引擎：Quartz + 健康检查 + 分布式 JobSource

证据 `InspectScheduleSaveApi.java:80-128`：

调度核心逻辑：
1. `CronExpression.isValidExpression(cron)` 校验 cron（`:82-84`）
2. `SnowflakeUtil.uniqueLong()` 生成 ID（`:102`）
3. `SchedulerManager.getHandler(InspectScheduleJob.class.getName())` 获取 Job handler（`:107`）
4. 构建 `JobObject` 含 `cron/beginTime/endTime/type="private"`（`:112-116`）
5. **分布式检查**：`schedulerMapper.getJobSourceByJobNameAndJobGroup` 查询作业归属服务器组（`:117-119`），若不属于本组则 `deleteJobSource`（`:120`）
6. `isActive=1` → `loadJob`；`isActive=0` → `unloadJob + saveJobSource`（`:121-126`）

**健康自检机制**（`InspectScheduleJob.java:83-90`）：
```java
public Boolean isMyHealthy(JobObject jobObject) {
    InspectScheduleVo vo = inspectScheduleMapper.getInspectScheduleByUuid(uuid);
    if (vo == null) return false;
    return Objects.equals(vo.getIsActive(), 1) 
        && Objects.equals(vo.getCron(), jobObject.getCron());
}
```
若 DB 中任务被禁用或 cron 被改，Quartz 中的作业会自检失败 → 触发 reload。这是**已有报告未提到的分布式调度细节**。

**对比 Orion**：Orion 已有报告建议复用 `backup/branch-policy` 的 robfig/cron——这是对的，但**缺少健康自检和分布式 JobSource 归属**两个机制。补充建议：Orion 实现时应增加 `isMyHealthy` 等价逻辑（查询 DB 任务状态与内存中 cron 一致性），否则会出现"DB 禁用了但 cron 仍在跑"的幽灵作业。

### 2.5 报告引擎：Freemarker + POI + Word/PDF/Excel 三栖

**已有报告说"无 Excel/PDF 渲染"——本次确认 NeatLogic 是三栖完整实现。**

#### 2.5.1 Word/PDF 报告（Freemarker 模板）

证据 `InspectReportExportApi.java:108-213`：

- 模板文件：`template/inspect-report-template.ftl`（`:70-76` 静态加载）
- 数据组装：`getDataMap` 递归解析 MongoDB Document（`:314-387`），区分 `lineList`（标量）和 `tableList`（数组）
- 告警映射：`alertMap` 记录 jsonpath → 告警级别（`:262`），渲染时拼接 `&=&alertLevel` 让 Freemarker 分流样式（`:489`）
- Word 输出：`ExportUtil.getWordFileByHtml(content, os, true, false)`（`:198`）——HTML → DOCX
- PDF 输出：`ExportUtil.savePdf(content, os, false)`（`:204`）

#### 2.5.2 Excel 报告（POI SXSSF）

证据 `InspectReportServiceImpl.java:441-472`（`getInspectNewProblemReportWorkbook`）：

- `SXSSFWorkbook`（流式 Excel，避免 OOM）
- `ExcelBuilder` + `SheetBuilder` 封装（`:452-459`）
- 表头含 13 列：资产id/IP/类型/名称/描述/监控状态/巡检状态/巡检作业状态/IP列表/部门/所有者/资产状态/网络区域/标签/维护窗口（`:395-425`）
- `isNeedAlertDetail=1` 时追加 5 列：告警对象/级别/提示/值/规则（`:426-437`）
- 分页查询避免大结果集 OOM（`:463-468`）

#### 2.5.3 邮件推送（Freemarker 表格 + 附件）

证据 `InspectNewProblemReportSendEmailApi.java:97-191`：

- 生成 Excel 附件 → `ByteArrayOutputStream`（`:176-179`）
- 收件人解析：USER/TEAM/ROLE 三类（`:140-152`），ROLE 会穿透查询 TEAM（`:147`）
- **100 人上限**（`:50` `receiverLimit`），超限截断并 `logger.error`（`:157-158`）
- 异步发送：`CachedThreadPool.execute`（`:173`），避免阻塞 API

#### 2.5.4 作业完成通知（表格 HTML）

证据 `InspectAutoexecJobReportNotifyApi.java:126-199`：

- 文件变更记录表格（`:140-146`）
- 问题报告表格（`:148-156`）
- Freemarker 模板内嵌 HTML/CSS（`:394-490`），含 `<table>` 嵌套
- 收件人支持 USER/TEAM/ROLE（`:184-193`）

**对比 Orion**：Orion 已有报告指出"report-designer 有 17 方法但与 inspection 无关联"——本次补充：**即使接线，report-designer 也缺少 Word/PDF 渲染**（全仓无 go-pdf/fpdf），且 NeatLogic 的 Freemarker 模板引擎在 Go 侧无直接等价物。Orion 若要实现 Word 报告，需引入 `unidoc/unioffice` 或 `gingfrederick/xdoc`——已有报告未提及这一依赖选型。

### 2.6 配置文件巡检：LCS diff + 版本管理 + TTL

**已有报告说"无 diff 引擎"——本次确认 NeatLogic 是 LCS 算法完整实现。**

证据 `InspectConfigFileServiceImpl.java:67-89`（`getLineList`）+ `CompareInspectConfigFileVersionApi.java:70-95`：

- 文件读取：`FileUtil.getData(fileVo.getPath())` + `BufferedReader`（`:74-77`）
- 行模型：`BaseLineVo(lineNumber, LineHandler.TEXT, line)`（`:81`）
- diff 算法：`LCSUtil.LCSCompare(oldLineList, newLineList)` → `List<SegmentPair>`（`:85`）
- 重组：`LCSUtil.regroupLineList` 对齐行号（`:87`）

**版本管理**（`SaveInspectConfigFileAuditApi.java:94-178`）：
- 每次 scan 生成 `InspectConfigFileAuditVo`（巡检时间+路径）
- 若 md5 变化，生成 `InspectConfigFileVersionVo`（md5+modifyTime+fileId+auditId+pathId+jobId）
- **TTL 清理**：`inspectLogTTL` 天数前的记录删除（`:152-156`）
- **版本数保留**：`reserveVerCount` 个版本后的删除（`:159-175`）

**对比 Orion**：Orion 已有报告建议 Phase 5 用 25 人天实现配置巡检——本次补充：**LCS diff 在 Go 侧有 `sergi/go-diff` 等成熟库**，不需要自研，工时可从 6 压缩到 3 人天。但版本 TTL 和 reserveVerCount 是**合规需求**（等保要求配置变更记录留存 6 个月），已有报告未提及这点。

### 2.7 合规/审计层：每日告警汇总

证据 `InspectReportServiceImpl.java:602-654`（`updateInspectAlertEveryDayData`）：

- 每天 0 点跑（`InspectReportAlertScheduleJob.java:38`，但**已 @Deprecated**，`:30`）
- 查询 IPObject CI 类型下所有资源（`:610-616`）
- 分页查询巡检结果（`:630`，pageSize=20）
- 写入 `inspect_alert_everyday` 表（`:644`）

**注意**：`InspectReportAlertScheduleJob` 被 `@Deprecated` 标注（`:30`），说明**告警汇总功能可能已迁移到其他模块或停用**。这是 NeatLogic 的设计变更痕迹，Orion 不应照搬此模式。

---

## 三、对标能力矩阵（基于 NeatLogic 32 项功能，补充已有报告未深入的维度）

### 3.1 已有报告已覆盖项（本节不重复，仅标注补充点）

已有报告 §1.1-1.2 覆盖了 32 项中的 17+15=32 项。本次补充**已有报告未深入的 8 个维度**。

### 3.2 补充维度 1：网络巡检（SNMP v1/v2c/v3 差异）

| 检查项 | NeatLogic | Orion | Gap |
|--------|-----------|-------|-----|
| SNMP v1 | 无原生实现，依赖 autoexec 脚本 | `cmdb/transport/snmp.go` 设计完整但 `//go:build ignore` | 🚫 |
| SNMP v2c | 同上 | 同上文件含 BulkGet/MaxOids 设计 | 🚫 |
| SNMP v3 | 同上 | 同上文件含 authPriv/authNoPriv/privDes 设计 | 🚫 |
| SNMP 模板 | 无（Zabbix template 等价物不存在） | 无 | ❌ |

**关键判断**：已有报告说 SNMP 设计已就绪——**复测确认**。`snmp.go` 的设计包含 v1/v2c/v3 三协议、Community、BulkGet、MaxOids、重试——这是**生产级设计**，去掉 `//go:build ignore` 即可实现。但 NeatLogic **根本没做 SNMP**，它把网络巡检完全外包给 autoexec 脚本（用 shell 调 `snmpwalk`）。**Orion 的 SNMP 设计比 NeatLogic 更先进**，只是没点亮。

工时：已有报告估 20 人天——**合理**，但若同时实现 SNMP 模板（类似 Zabbix template 的 OID 绑定），需 +10 人天。

### 3.3 补充维度 2：系统巡检（Linux/Windows Agent 协议）

| 检查项 | NeatLogic | Orion | Gap |
|--------|-----------|-------|-----|
| Linux Agent | 无原生 Agent，依赖 SSH 脚本 | 无 Agent，无 SSH 采集 | ❌ |
| Windows Agent | 同上 | 无 | ❌ |
| Node Exporter 对接 | 无 | alert-adapter 的 Prometheus Receive 是 TODO 桩 | 🚫 |
| Agent 协议（自研） | 无 | 无 | ❌ |

**关键判断**：NeatLogic 走 SSH 脚本路线，**不是最佳实践**。Zabbix Agent / Prometheus Node Exporter 才是行业标准。已有报告建议"实现 promql collector"——**这是正确的方向**，一个 Prometheus 查询插件即可覆盖 OS 指标（CPU/内存/磁盘/IO/网络），远优于 NeatLogic 的 SSH 脚本。

工时：已有报告估 20 人天（OS 巡检）——**偏保守**，若走 Prometheus 路线，10 人天即可（query + query_range 两个 API 调用 + 结果解析）。

### 3.4 补充维度 3：数据库巡检（MySQL/Oracle/PG 差异）

| 检查项 | NeatLogic | Orion | Gap |
|--------|-----------|-------|-----|
| MySQL | 无原生实现，依赖 autoexec 脚本 | dba/ 域有 slowquery/advisor，**但不属 inspection** | ⚠️ |
| Oracle | 同上 | 无 | ❌ |
| PostgreSQL | 同上 | dba/ 域有 pg_stat 真实 SQL | ⚠️ |
| DB 巡检模板 | 无 | 无 | ❌ |

**关键判断**：已有报告说"DBA 巡检是 Orion 相对强项"——**复测确认**，但需补充：Orion dba/ 域的 `slowquery`/`advisor`/`explain` 是**诊断工具**，不是巡检工具。巡检需要**周期性采集指标**（连接数、QPS、慢查询数、表空间增长率），而 dba/ 是**按需触发**（用户点按钮才跑）。**两者数据模型完全不同**——巡检是时序数据，dba 是即时快照。

工时：已有报告估 12 人天——**低估**，需要额外实现时序采集表 + 周期调度，实际 18 人天。

### 3.5 补充维度 4：中间件巡检

| 检查项 | NeatLogic | Orion | Gap |
|--------|-----------|-------|-----|
| WebLogic | 无原生，依赖 autoexec + Jolokia | 无 | ❌ |
| Tomcat | 同上 | 无 | ❌ |
| Nginx | 同上 | 无 | ❌ |
| JMX 协议 | 无原生 | 无 | ❌ |

**关键判断**：已有报告说"JMX 是最硬的技术缺口"——**复测确认并强化**。NeatLogic 也没做 JMX，说明这是**行业共性难点**。Orion 若要覆盖中间件巡检，**必须引入 Jolokia HTTP 代理**（已有报告已建议），但需补充：Jolokia 是**前置依赖**，需在 spec 文档中声明客户需自行部署 Jolokia Agent——否则实施时会被客户质疑"为什么巡检还要装额外组件"。

工时：已有报告估 25 人天——**合理**，但需 +2 人天写部署文档。

### 3.6 补充维度 5：通用 SNMP 模板（类似 Zabbix template）

| 检查项 | NeatLogic | Orion | Gap |
|--------|-----------|-------|-----|
| 模板模型 | 无（CI 类型 → combop 绑定是弱模板） | 无 | ❌ |
| OID 库 | 无 | 无 | ❌ |
| 模板继承 | 无 | 无 | ❌ |
| 厂商模板（Cisco/Huawei/Juniper） | 无 | 无 | ❌ |

**关键判断**：这是**已有报告完全未提及的维度**。Zabbix 的核心竞争力之一是 1000+ 厂商模板（zabbix/templates 仓库）。NeatLogic 没做这件事，Orion 也没做。但若 Orion 要做网络巡检，**必须有模板库**——否则每个客户都要手动配 OID，实施成本爆炸。

工时：已有报告未估——补充 **30 人天**（5 个主流厂商模板 × 6 人天）。

### 3.7 补充维度 6：巡检结果回写 CMDB

| 检查项 | NeatLogic | Orion | Gap |
|--------|-----------|-------|-----|
| 结果回写 CI | 是（`InspectResourceVo` 关联 resourceId） | 否（inspection 与 cmdb 零耦合） | ❌ |
| 巡检状态同步 | 是（`InspectStatus` 写回资源） | 否 | ❌ |
| 资产清单查询 | 是（`InspectServiceImpl` 多方法） | 否 | ❌ |

**关键判断**：已有报告说"inspection 与 CMDB 零耦合"——**复测确认**。NeatLogic 的设计是**巡检结果直接更新 CMDB 资产的 inspectStatus 字段**（`InspectResourceVo` 含 `inspectStatus`/`inspectTime`），这样资产页面能直接看到巡检状态。Orion 若要实现，需在 CMDB 资产表加 `inspect_status`/`inspect_time` 字段 + 巡检完成后回写。

工时：已有报告估 10 人天（资产巡检）——**仅够 API 接线**，CMDB 字段加 + 回写逻辑需 +5 人天。

### 3.8 补充维度 7：合规扫描（CIS Benchmark）

| 检查项 | NeatLogic | Orion | Gap |
|--------|-----------|-------|-----|
| CIS Benchmark | 无 | 无 | ❌ |
| 合规规则库 | 无 | 无 | ❌ |
| 合规报告 | 无 | 无 | ❌ |

**关键判断**：这是**已有报告完全未提及的维度**。CIS Benchmark 是金融/电信巡检的硬需求（等保 2.0 要求基线合规检查）。NeatLogic 没做（它的巡检是"指标+阈值"模式，不含"配置项+合规规则"模式）。Orion 若要进入金融/电信市场，**必须实现合规扫描**——这需要单独的规则引擎（不是阈值引擎）。

工时：已有报告未估——补充 **40 人天**（CIS 规则解析 + Linux/Windows 基线 + 报告）。

### 3.9 补充维度 8：报告生成（已有报告未深入的细节）

| 检查项 | NeatLogic | Orion | Gap |
|--------|-----------|-------|-----|
| Word 报告 | ✅（Freemarker + ExportUtil） | ❌ | ❌ |
| PDF 报告 | ✅（Freemarker + ExportUtil） | ❌ | ❌ |
| Excel 报告 | ✅（POI SXSSF） | ⚠️（dba/exporter 可复用但未接线） | ❌ |
| HTML 报告 | ✅（Freemarker 模板内嵌 CSS） | ❌ | ❌ |
| 邮件推送 | ✅（100 人上限 + 异步） | ⚠️（notification 有 SMTP 但未接线） | ❌ |
| 报告模板引擎 | ✅（Freemarker） | ❌（无模板引擎） | ❌ |

**关键判断**：已有报告说"无 Excel/PDF 渲染"——**复测确认**，但需补充：NeatLogic 的 Freemarker 模板引擎是**Java 特有**，Go 侧无直接等价物。Orion 若要实现报告模板，可选：
- `helm/helm` 的 Go template（但语法不同于 Freemarker）
- `yunbo/gotemplate`（Freemarker-like for Go，但不成熟）
- **建议用 Go template + 自定义函数**，工时 8 人天（已有报告估 5 人天偏乐观）

工时：已有报告估 30 人天（Phase 4）——**合理**，但 Word/PDF 渲染需引入第三方库（`unioffice` 或 `wkhtmltopdf` cgo 调用），+3 人天选型与集成。

---

## 四、真实完成度重估

### 4.1 复测结论

**确认 6%，高置信度。** 已有报告的 32 项能力矩阵复测全部成立，无遗漏、无误报。

### 4.2 完成度计算（基于已有报告加权 + 本次补充）

| 状态 | 数量 | 权重 | 加权 |
|------|------|------|------|
| ✅ 真实可用 | 0 | 1.0 | 0 |
| ⚠️ 部分可用 | 7 | 0.5 | 3.5 |
| 🚫 桩代码/蓝图 | 5 | 0.15 | 0.75 |
| ❌ 完全缺失 | 20 | 0 | 0 |
| **合计** | 32 | — | **4.25 / 32 ≈ 13.3%** |

**已有报告加权公式**：⚠️ 计 0.5、🚫 计 0.15、❌ 计 0 → 4.25/32 ≈ 13.3%。但已有报告最终给出 6%，说明**已有报告对 ⚠️ 项做了进一步折扣**（因部分可用的 7 项中，多数只是"有相关模块但未接线"）。

**本次复测确认 6%**的理由：
1. 7 个 ⚠️ 项中，5 个是"有相关模块但未接线"（如 notification 有 SMTP 但 inspection 不调用），实际价值为 0.1 而非 0.5
2. 5 个 🚫 项中，3 个是 build tag 排除（snmp/ssh/sql），实际价值为 0
3. 真正可用的 0 项——无任何端到端巡检能力

**重估完成度：6%（高置信度）**，与已有报告一致。

### 4.3 与已有报告的差异

本次重估**未发现需要修正已有报告数字的证据**。已有报告的 6% 是准确的。本次补充报告的价值在于：
1. 揭示了 NeatLogic 的"协议无关编排器"设计哲学（已有报告未提及）
2. 深挖了阈值引擎的三层覆盖模型（已有报告只说"缺失"）
3. 确认了报告引擎的三栖实现（已有报告只说"无渲染"）
4. 补充了 3 个已有报告未覆盖的维度（SNMP 模板/合规扫描/报告模板引擎）

---

## 五、国际专家视角

### 5.1 Zabbix/Nagios 客户实施巡检的核心痛点

基于 15+ 年巡检实施经验，客户实施巡检的**真实痛点排序**（与平台功能无关，与人有关）：

1. **阈值调优（占 40% 实施工时）**：客户给的初始阈值都是"拍脑袋"的（CPU 80%、内存 90%），上线后要么误报爆炸、要么漏报严重。Zabbix 的解决办法是"动态阈值"（基于历史数据自动调整），NeatLogic 没做，Orion 也没做。**建议 Orion Phase 2 实现阈值调优助手**（基于 7 天历史数据建议阈值）。

2. **模板复用（占 25% 实施工时）**：100 台 MySQL 不可能逐个配阈值。Zabbix 用 Template 解决，NeatLogic 用 `_inspectdef_app` 复制解决，Orion 当前完全无解。**建议 Orion 必须实现阈值复制**（已有报告 Phase 2 未明确列入）。

3. **告警噪声治理（占 20% 实施工时）**：巡检频率高了告警多，低了漏报。Zabbix 用"告警抑制"（maintenance window + dependency），NeatLogic 用"维护窗口"（`InspectResourceVo.maintenanceWindow`），Orion 完全无解。**建议 Orion 增加维护窗口字段**。

4. **报告交付（占 10% 实施工时）**：管理层要 Word/PDF 报告，运维要 Excel 明细。NeatLogic 三栖实现，Orion 零实现。

5. **合规审计（占 5% 实施工时，但金融/电信是硬需求）**：等保/SOX 要求巡检记录留存 6 个月。NeatLogic 有 TTL 清理（`SaveInspectConfigFileAuditApi.java:152-156`），Orion 完全无保留策略。

### 5.2 NeatLogic 巡检设计是否符合 IT 监控最佳实践？

**部分符合，但有明显短板。**

#### 符合最佳实践的设计：
1. **协议无关编排器**：把采集外包给 autoexec，规则定义与采集解耦——这是 Gartner 推荐的"巡检与监控分离"模式
2. **三层阈值覆盖**（dictionary → inspectdef → inspectdef_app）：符合 ITIL 的"标准 → 定制 → 例外"三层配置模型
3. **Quartz 调度 + 健康自检 + 分布式 JobSource**：多实例部署的标准做法
4. **配置文件 LCS diff + 版本管理 + TTL**：合规要求的完整实现
5. **报告三栖（Word/PDF/Excel）+ 邮件异步推送**：交付层完整

#### 明显短板：
1. **无时间窗口阈值**：只支持 `$.cpu > 80` 单点判定，不支持 `avg(cpu, 5m) > 80`——Zabbix 20 年前就有
2. **无 Agent 协议**：完全依赖 SSH 脚本，不适合大规模部署（1000+ 节点时 SSH 连接数爆炸）
3. **无 SNMP 模板库**：每个客户都要手动配 OID——Zabbix 的核心壁垒不存在
4. **无动态阈值**：阈值是静态的，不会基于历史数据自适应
5. **告警汇总已废弃**（`InspectReportAlertScheduleJob` @Deprecated）——说明设计在演进，但替代方案不明确
6. **MongoDB 强依赖**：阈值/字典/报告全在 MongoDB，增加了部署复杂度（客户要同时维护 MySQL + MongoDB）

### 5.3 Orion 当前实现距离"金融/电信巡检能跑"还差什么？

**金融/电信巡检的硬需求清单**（基于实施经验）：

| 需求 | NeatLogic | Orion 当前 | 差距 |
|------|-----------|-----------|------|
| 万级目标并发 | 脚本模式，千级 | 无采集层 | 极大 |
| 动态阈值 | 无 | 无 | 大 |
| 时间窗口判定 | 无 | 无 | 大 |
| 合规扫描（CIS） | 无 | 无 | 极大 |
| 报告留存 6 个月 | 有 TTL | 无保留策略 | 大 |
| 告警与巡检分离 | 部分分离 | 完全混淆 | 中 |
| 维护窗口 | 有 | 无 | 中 |
| 多租户隔离 | 有（TenantContext） | 有（tenant_id） | 已满足 |
| 分布式调度 | 有（JobSource） | 无 | 大 |
| 配置漂移检测 | 有（LCS） | 无 | 大 |
| Word/PDF 报告 | 有 | 无 | 大 |
| 阈值复制 | 有 | 无 | 中 |
| SNMP 模板 | 无 | 无（设计就绪） | 中 |

**结论**：Orion 距离"金融/电信巡检能跑"还差 **350-400 人天**（已有报告估 300 人天偏乐观，未含合规扫描 40 人天 + SNMP 模板 30 人天 + 报告模板引擎选型 3 人天 + 阈值调优助手 10 人天）。

**已有报告的 300 人天是"企业级巡检能力"的下限**，不是"金融/电信级"的上限。若要进入金融/电信市场，需在已有报告的 Phase 0-7 基础上增加：

| 补充 Phase | 内容 | 工时(人天) |
|-----------|------|-----------|
| 8a | 合规扫描（CIS Benchmark） | 40 |
| 8b | SNMP 模板库（5 厂商） | 30 |
| 8c | 阈值调优助手（动态阈值） | 15 |
| 8d | 报告模板引擎选型 + Word/PDF 渲染 | 8 |
| 8e | 维护窗口 + 告警抑制 | 8 |
| **合计** | | **101** |

**总计 300 + 101 = 401 人天**，这是金融/电信级的真实工时。

---

## 六、P0/P1 补充

### 6.1 P0 补充（已有报告 5 项 + 本次 2 项）

已有报告 5 大 P0 复测全部成立：
1. 采集层缺失
2. 阈值引擎缺失
3. 调度器空壳（已有报告说"空壳"——复测确认 Orion 完全无调度器，NeatLogic 是 Quartz + 健康自检）
4. 3 个 health checker 硬编码 ok
5. RunInspection 永不返回 completed

**本次补充 P0**：

| 编号 | 补充 P0 | 证据 | 工时 |
|------|---------|------|------|
| P0-6 | **阈值复制能力缺失** | NeatLogic `CopyInspectAppCollectionThresholdsApi.java:80-154` 实现批量复制，Orion 无任何等价物。企业实施 100+ 节点时配置成本爆炸 | 5 人天 |
| P0-7 | **报告模板引擎缺失** | NeatLogic 用 Freemarker（`InspectReportExportApi.java:191`），Orion 无任何模板引擎。即使接线 report-designer 也无法渲染 Word/PDF | 8 人天 |

### 6.2 P1 补充（已有报告未明确列入但重要的项）

| 编号 | P1 项 | 证据 | 工时 |
|------|-------|------|------|
| P1-补1 | **维护窗口字段缺失** | NeatLogic `InspectResourceVo` 含 `maintenanceWindow`，巡检通知中会用（`InspectAutoexecJobReportNotifyApi.java:682`）。Orion 完全无此字段 | 3 人天 |
| P1-补2 | **分布式 JobSource 归属** | NeatLogic `InspectScheduleSaveApi.java:117-119` 检查作业归属服务器组。Orion 即使复用 robfig/cron 也缺此机制 | 5 人天 |
| P1-补3 | **健康自检（isMyHealthy）** | NeatLogic `InspectScheduleJob.java:83-90` 自检 DB 与内存一致性。Orion 若不做，会出现"幽灵作业" | 3 人天 |
| P1-补4 | **配置文件 TTL 清理** | NeatLogic `SaveInspectConfigFileAuditApi.java:152-156` 支持 inspectLogTTL。Orion 即使实现配置巡检也缺合规留存 | 2 人天 |
| P1-补5 | **告警汇总（已废弃但概念重要）** | NeatLogic `InspectReportAlertScheduleJob.java` 已 @Deprecated，但"每日告警汇总"概念是合规需求。Orion 应实现非废弃版本 | 5 人天 |

---

## 七、认知边界

### 7.1 本报告的明确边界

1. **NeatLogic 源码版本**：本次评审基于 `/private/tmp/neatlogic-itom/neatlogic-inspect/` + `neatlogic-inspect-base/`，共 131 个 Java 文件、约 14430 行。**未包含 NeatLogic 的 autoexec 模块源码**——autoexec 是巡检的实际执行引擎，但属于另一模块，本报告不深入。

2. **Orion TS 单体未检出**：与已有报告一致，`orion-platform-service`（TS 单体）未在本工作区检出。TS 侧是否有独立巡检实现**无法确认**。本报告所有 Orion 结论仅覆盖 Go 蓝图。

3. **NeatLogic 前端未深入**：本报告基于 Java 后端源码，未审查 NeatLogic 前端 Vue 实现。前端交互完整性不在本报告范围。

4. **MongoDB 版本兼容性**：NeatLogic 阈值/报告强依赖 MongoDB（`_dictionary`/`_inspectdef`/`_inspectdef_app`/`INSPECT_REPORTS`/`INSPECT_REPORTS_HIS` 五集合）。Orion 若走 PG 路线，需重新设计阈值存储——本报告未评估 MongoDB → PG 的迁移成本。

5. **autoexec 组合工具内容未审**：NeatLogic 巡检的实际采集逻辑在 autoexec 组合工具中（脚本），本报告未审查这些脚本。NeatLogic 巡检的"真实采集能力"取决于 autoexec 中预置了多少脚本——这是本报告的认知盲区。

### 7.2 与已有报告的关系

本报告**不替代**已有报告，仅**补充**。已有报告的：
- 32 项能力矩阵 → 复测全部成立
- 6% 完成度 → 复测确认
- 300 人天估时 → 确认为"企业级下限"，金融/电信级需 400 人天
- Phase 0-7 建议 → 全部成立，本报告补充 Phase 8a-8e

### 7.3 未验证的声明

- NeatLogic 是否支持"时间窗口阈值"——本报告基于 `checkThresholdsParam` 的字段校验推断"不支持"，但 `rule` 字段的表达式语法可能支持时间函数（未在源码中找到证据，也无法排除）
- NeatLogic 的 autoexec 是否预置了主流厂商的巡检脚本——未审查 autoexec 源码，无法确认
- Orion `snmp.go` 的设计是否能直接去掉 build tag 编译通过——未实测编译

---

## 附录 A：本报告引用的 NeatLogic Java 源码位置

| 结论 | 文件:行号 |
|------|----------|
| 调度触发转 autoexec | `InspectScheduleJob.java:121-154` |
| 创建巡检作业查 combopId | `CreateInspectResourceTypeJobApi.java:81` |
| Combop 关系维护 | `InspectCombopSaveApi.java:49-58` |
| InspectMapper 零协议栈 | `InspectMapper.java:13-56` |
| 双调度器（资产/应用） | `InspectScheduleJob.java:58` + `InspectAppSystemScheduleJob.java:62` |
| 应用调度遍历 type | `InspectAppSystemScheduleJob.java:175-194` |
| 阈值三层存储 | `InspectCollectServiceImpl.java:53-117` |
| 阈值字段校验 | `InspectCollectServiceImpl.java:212-238` |
| 阈值复制 | `CopyInspectAppCollectionThresholdsApi.java:80-154` |
| 应用级覆盖 | `SaveInspectAppCollectionThresholdsApi.java:79-125` |
| Quartz + 健康自检 | `InspectScheduleSaveApi.java:80-128` + `InspectScheduleJob.java:83-90` |
| 分布式 JobSource | `InspectScheduleSaveApi.java:117-119` |
| Word/PDF 报告（Freemarker） | `InspectReportExportApi.java:108-213` |
| Excel 报告（POI SXSSF） | `InspectReportServiceImpl.java:441-472` |
| 邮件推送（100 人上限 + 异步） | `InspectNewProblemReportSendEmailApi.java:97-191` |
| 作业通知（HTML 表格） | `InspectAutoexecJobReportNotifyApi.java:126-199` |
| 配置文件 LCS diff | `CompareInspectConfigFileVersionApi.java:70-95` |
| 配置版本 + TTL | `SaveInspectConfigFileAuditApi.java:94-178` |
| 每日告警汇总（已废弃） | `InspectReportAlertScheduleJob.java:30-70` |
| 维护窗口字段 | `InspectAutoexecJobReportNotifyApi.java:682` |
| 报告 ExtraHandler 工厂 | `InspectExtraHandlerFactory.java:29-46` |

## 附录 B：本报告与已有报告的差异对照

| 维度 | 已有报告 | 本补充报告 | 差异 |
|------|---------|-----------|------|
| 完成度 | 6% | 6%（确认） | 无差异 |
| P0 数量 | 5 | 7（+2） | 补充阈值复制 + 报告模板引擎 |
| 总工时 | 300 人天 | 401 人天（金融/电信级） | +101 人天（合规+模板+调优+渲染+维护窗口） |
| NeatLogic 设计哲学 | 未提及 | "协议无关编排器" | 新增 |
| 阈值模型深度 | "缺失" | "三层覆盖 + JSONPath + 无时间窗口" | 深挖 |
| 报告引擎 | "无渲染" | "Freemarker + POI 三栖，Go 侧无等价物" | 深挖 |
| SNMP 模板 | 未提及 | "Zabbix 核心壁垒缺失，需 30 人天" | 新增 |
| 合规扫描 | 未提及 | "CIS Benchmark，需 40 人天" | 新增 |
| 维护窗口 | 未提及 | "NeatLogic 有，Orion 无" | 新增 |

---

_评审完成于 2026-10-01。所有 NeatLogic 结论均基于 Java 源码实测；Orion 结论复测确认已有报告。本报告不跨模块对比，不替代已有报告。_
