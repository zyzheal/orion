# Orion 巡检能力深度评审（对标 NeatLogic 巡检模块）

**评审日期**：2026-09-30
**评审角色**：巡检/可观测性领域专家（Nightingale / Zabbix / MonKey / ARMS / Prometheus 实施经验）
**评审对象**：`orion-platform-svc-go/internal/inspection/`、`orion-platform-svc-go/internal/cmdb-collector/`、`orion-frontend/src/pages/inspection/`、`docs/services/inspection/`
**结论等级**：❌ **不具备生产可用巡检能力**（真实完成度 **≈ 6%**，详见 §2.3）

> **本报告的所有代码结论均经实际 grep / Read 验证，非基于文档推断。** 关键：本工作区**未检出 `orion-platform-service`**（TS 单体权威实现），因此本报告**只对 Go 蓝图和前端**下判断。TS 侧是否有独立巡检实现，本报告**无法证实也无法排除**——这是明确的认知边界，不做假设。

---

## 1. 巡检视角能力矩阵（对标 NeatLogic 32 项）

标记说明：✅ 真实可用 ｜ ⚠️ 有骨架/部分可用 ｜ ❌ 完全缺失 ｜ 🚫 存在但为桩代码/蓝图（不可用）

### 1.1 巡检管理（NeatLogic 17 项）

| # | NeatLogic 功能点 | 状态 | 证据 | Gap 级别 | 工时(人天) |
|---|---|---|---|---|---|
| 1 | 巡检定义（阈值角度） | 🚫 | `metadata` JSONB 一列承载所有配置（`models.go:13`），无 `condition` 结构约束，spec 文档 §4.4 的 `cpu_threshold/mem_threshold` 示例**在代码中无任何对应实现** | P0 | 10 |
| 2 | 巡检定义（应用角度） | ❌ | 无"应用→模块→环境"层级模型；仅有平铺 `Record{Name, Status}` | P0 | 12 |
| 3 | 应用巡检（定时/人工） | 🚫 | 无 cron 消费 `schedule` 字段。前端 `InspectionPage.tsx:241` 有 Cron 输入框，后端**无任何调度器读取** | P0 | 8 |
| 4 | 应用巡检（报告） | 🚫 | `runInspection` 只把状态置为 `"running"` 后返回，**永不置回 completed、永不产出报告**（`service.go:48-60`） | P0 | 10 |
| 5 | 导出问题列表 | ❌ | 全仓 `grep excelize` 仅命中 `internal/dba/query/exporter.go`，**inspection 模块零导出能力** | P1 | 5 |
| 6 | 邮件推送 | ⚠️ | `internal/notification/.../channels.go:130-218` 有**真实** `net/smtp` 实现（含 SMTP Auth、RFC 5322 报文构造）。**但 inspection 模块无任何调用点**——通道存在、接线不存在 | P1 | 4 |
| 7 | 资产巡检（资产/职能视角） | ⚠️ | CMDB 有资产模型可复用，但 inspection 与 CMDB **零耦合**（`grep` 确认 inspection 目录不引用 cmdb 包） | P1 | 10 |
| 8 | 配置巡检（备份内容） | ❌ | 无文件/备份内容巡检 | P2 | 6 |
| 9 | 配置巡检（路径/通配符） | ❌ | 无文件路径模型 | P1 | 8 |
| 10 | 配置巡检（版本差异比对） | ❌ | 无 diff 引擎（见 §5） | P1 | 10 |
| 11 | 采集插件机制 | 🚫 | **SPI 已完整定义但零实现**：`cmdb-collector/interfaces/collector.go` 定义了 `Collector`/`Adapter` 接口（Name/Type/Discover/Collect/HealthCheck/ConfigSchema），`registry.go` 定义 `Register()`，但 `grep registry.Register` 确认**全仓无任何 adapter 注册调用** → 插件总线是空的 | P0 | 25 |
| 12 | 脚本语言（11 种） | ❌ | 无脚本运行时/沙箱 | P2 | 30 |
| 13 | 最新问题查询（应用/资产/状态） | ⚠️ | `List` 支持 `status` 过滤，但仅 `page/limit/status` 三参（`models.go:19-23`），无应用/资产维度 | P1 | 5 |
| 14 | 最新问题（按类型查看） | ❌ | `Record` 无 `type`/`category` 字段 | P1 | 4 |
| 15 | 最新问题导出 | ❌ | 同 #5 | P1 | 4 |
| 16 | 健康评分 | 🚫 | 前端 `api/inspection.ts:117` 请求 `/inspection/health-score`，**后端无此路由**。`GetStats` 只做 passed/failed/warnings/running 计数 | P0 | 6 |
| 17 | 巡检趋势/历史 | ⚠️ | `GetHistory` 返回 `[]string`（`id:name` 拼接），**无时间维度、无结果趋势** | P2 | 5 |

### 1.2 巡检范围（NeatLogic 15 项）

| # | 巡检范围 | 状态 | 证据 | Gap 级别 | 工时(人天) |
|---|---|---|---|---|---|
| 18 | 应用巡检（HTTP URL 模拟） | ⚠️ | `health-check/service.go:182-235` 有**真实** `http.Client` + 超时 + 延迟统计。但**属 health-check 模块，非 inspection**，且仅 GET 无状态码断言/响应体校验 | P1 | 5 |
| 19 | 应用巡检（ICMP） | ❌ | 全仓无 ICMP 实现（`grep icmp` 仅命中 cmdb 文档字符串） | P1 | 6 |
| 20 | 应用巡检（报文序列） | ❌ | 无 | P2 | 8 |
| 21 | 应用巡检（模拟用户访问） | ❌ | 无多步会话/凭证/脚本编排 | P2 | 15 |
| 22 | OS 巡检（CPU/内存/存储/IO/网络） | ❌ | 无 Agent，无 Node Exporter 对接。Prometheus 集成点是 `alert-adapter/service/handlers.go:74-79` 的 **`Receive()` 桩函数，注释为 `// TODO: in production, HTTP GET Alertmanager API`** | P0 | 20 |
| 23 | 虚拟化巡检（vCenter/FusionCompute） | ❌ | 无 vCenter/VMware API 客户端，无 API 适配器实现 | P1 | 20 |
| 24 | 中间件巡检（WebLogic/Tomcat/Nginx 等 7 种） | ❌ | 无 JVM/MBean/JMX 采集。**这是最硬的技术缺口**——JMX 在 Go 侧需走 Jolokia HTTP 代理，全仓无 | P1 | 25 |
| 25 | 数据库巡检（Oracle/MySQL/PG/…） | ⚠️ | `dba/` 域有 `slowquery`/`advisor`/`explain` 真实能力（`dba/advisor/slow_lookup.go` 等有 `pg_stat`/`information_schema` 真实 SQL），DBA 巡检是 Orion 的**相对强项**。但与 inspection 模块**无数据打通** | P1 | 12 |
| 26 | 网络巡检（交换机/F5/防火墙） | 🚫 | `internal/cmdb/transport/snmp.go` 存在较完整 SNMP 设计（v1/v2c/v3、Community、BulkGet、MaxOids、重试），**但文件首行是 `//go:build ignore`——不参与编译，是纯设计蓝图**。`ssh.go`/`sql.go` 同样 `go:build ignore` | P0 | 20 |
| 27 | 容器巡检（Docker/K8s 健康） | 🚫 | `health-check/service.go:257-265` `checkKubernetes` **硬编码返回 `{status:"ok", ping:true}`，从不连接 K8s API**。`checkDatabase`/`checkRedis` 同样硬编码 ok（`:237-255`） | P0 | 12 |
| 28 | 存储巡检（IBM/EMC/NetApp/HDS） | ❌ | 无存储厂商 API | P2 | 15 |
| 29 | 服务器硬件巡检（IPMI） | ❌ | 全仓无 IPMI | P2 | 10 |
| 30 | 网络巡检（专线/带宽） | ❌ | 无 | P2 | 6 |
| 31 | 巡检结果归档/历史 | ⚠️ | 仅 `inspection_records` 单表软删除（`repository.go:146-161`），**无独立 results 表**，历史结果覆盖写 | P1 | 6 |
| 32 | 巡检报告（导出/推送） | ❌ | `report-designer` 域有完整 `CreateReport`/`ExecuteReport`/`PreviewReport`/`CreateSchedule`（375 行、17 方法），但**与 inspection 无关联**，且**无 Excel/PDF 渲染**（全仓无 go-pdf/fpdf） | P0 | 15 |

### 1.3 矩阵汇总

| 状态 | 数量 | 占比 |
|---|---|---|
| ✅ 真实可用 | 0 | 0% |
| ⚠️ 部分可用 | 7 | 21.9% |
| 🚫 桩代码/蓝图 | 5 | 15.6% |
| ❌ 完全缺失 | 20 | 62.5% |

**加权完成度 ≈ 6%**（⚠️ 计 0.5、🚫 计 0.15、❌ 计 0）。核心原因：Orion 巡检是"规则元数据 CRUD 壳"，缺少巡检系统的三个不可替代内核——**采集层、执行引擎、阈值引擎**。

---

## 2. Orion 现有巡检深度代码分析

### 2.1 服务接口与数据模型清单

**Go 侧（`internal/inspection/`，共 18 个 .go 文件 / 2450 行）**

| 层 | 文件 | 行数 | 实质内容 |
|---|---|---|---|
| model | `models/models.go` | 29 | `Record`（ID/TenantID/Name/Status/Metadata/CreatedAt/UpdatedAt/DeletedAt）+ `ListQuery` + `CreateRequest` |
| repository | `repository/repository.go` | 170 | sqlx 五方法 CRUD，单表 `inspection_records`，JSONB `metadata`，软删除，租户隔离 |
| service | `service/service.go` | 142 | 11 方法，见下 |
| handler | `handler/handler.go` | 207 | 12 条路由，全部带 `auth.RequirePermission` RBAC |
| test | — | 1143 | 797 + 332 + 13 个测试函数 |

**Service 的 11 个方法（`service_interface.go`，代码生成）**：`List` / `Get` / `Create` / `Update` / `Delete` / `RunInspection` / `GetResults` / `UpdateStatus` / `ListTemplates` / `GetStats` / `GetHistory` / `BatchCreate`

**关键代码事实**——`RunInspection` 的全部实现（`service.go:48-60`）：

```go
func (s *Service) RunInspection(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
    rec, err := s.repo.GetByID(ctx, tenantID, id)
    if err != nil {
        return map[string]interface{}{"status": "ok", "inspectionId": id}, nil
    }
    rec.Status = "running"
    _, err = s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "running"})
    ...
    return map[string]interface{}{"status": "running", "inspectionId": id}, nil
}
```

**这就是整个 Orion 的"巡检执行"**。它：(1) 不读取任何配置；(2) 不连接任何目标；(3) 不产生任何检查项结果；(4) 状态停在 `"running"` 永远无法收敛；(5) 目标不存在时**静默返回 ok**（吞错，见 §7.4）。

同时 `GetResults` 把当前 Record 本身当结果返回（`:62-69`），`ListTemplates` 直接等于 `List`（`:80-83`）——这些是语义占位，不是功能。

**前端侧**：`InspectionPage.tsx` 540 行，191 行测试，有三个 Tab（规则/结果/报告），有 Cron 输入、健康评分进度条、报告列表。

### 2.2 与 NeatLogic 概念映射

| NeatLogic 概念 | Orion 对应 | 映射完整度 |
|---|---|---|
| 巡检定义（InspectionDefinition） | `inspection_records` 行（扁平） | 10%（无类型、无目标、无条件结构） |
| 巡检任务（Task/Run） | 无独立实体，复用 Record | 0% |
| 巡检结果（Item 级） | 无（NeatLogic 是 Rule→Item 两级，Orion 无 Item） | 0% |
| 巡检报告 | `report-designer`（跨模块、未接线） | 15% |
| 采集插件 | `cmdb-collector` SPI（空注册表） | 10% |
| 问题清单（Issue） | 无（无 status 状态机推进） | 0% |
| 巡检范围（Scope/资产） | CMDB 资产（未耦合） | 0% |

### 2.3 真实完成度

- **模型层**：30%（有实体但无领域结构）
- **API 层**：70%（CRUD + RBAC + 租户隔离 + 软删除 + 测试完备，这一层质量确实不错）
- **采集层**：0%
- **执行引擎**：5%（一个改状态的函数）
- **阈值引擎**：0%
- **报告层**：0%（模块内）
- **调度层**：0%
- **加权总评：≈ 6%**

### 2.4 文档-代码偏差（评审中发现的第二个 P0）

`docs/services/inspection/07-inspection-spec.md`（261 行）描述的模型与真实代码**不一致**：

| 项 | 文档声称 | 代码实际 |
|---|---|---|
| 表结构 | `inspection_rules` + `inspection_results` 两张表 | 单表 `inspection_records` |
| 字段 | `rule_type`/`target`/`condition`/`severity`/`enabled`/`schedule` | 仅 `name`/`status`/`metadata` |
| 已知问题 B1 | `Count` 查询错用表名 `inspections` | **代码中已无 Count 方法**（该 bug 不存在或已移除） |
| 已知问题 G1 | "缺巡检执行引擎" P0 | 准确，且比文档描述的更严重 |

文档的自陈问题清单（G1-G6）**方向正确但低估严重性**——文档把它描述为"待实现"，实际上 `RunInspection` 给了一个**看起来能跑但语义为空的实现**，这比缺失更危险（见 §7.1）。建议：**以代码为准更新 spec**，并把 spec §6.1 的 B1 标注为"已不适用"。

---

## 3. 巡检类型深度对比

### 3.1 应用巡检（HTTP URL 模拟 / ICMP / 报文序列 / 模拟用户访问）

- **Orion 现状**：`health-check` 模块有真实 HTTP GET 探活（含 `timeoutMs`、延迟毫秒统计、状态码分级），这是可用的。**但 health-check 与 inspection 是两个模块，无共享、无复用**。无 ICMP、无 TCP 端口连通性、无响应体/关键字断言、无多步会话。
- **实现路径**：HTTP URL 模拟可直接复用 `checkEndpoint` 逻辑上移到 inspection 执行器，工作量小（约 5 人天）。真正的增量在**断言引擎**——NeatLogic 支持"响应码 + 响应体正则 + 响应时间 + 证书有效期"复合断言，这是阈值引擎的一部分，不是采集。
- **判定**：⚠️ 部分可用（探活有，断言无）。**不要**在 inspection 里重复实现 HTTP 客户端，应把 `health-check` 的 checker 抽成 SPI 实现。

### 3.2 OS 巡检（CPU/内存/存储/IO/网络流量）

- **Orion 现状**：❌ 完全空白。这是巡检系统的**第一需求**，Orion 为零。
- **与 Node Exporter 的关系（关键架构判断）**：**Orion 不应自建 OS 指标采集**。理由：
  1. Orion 已有完整可观测性栈（`monitoring` 3584 行、`internal/middleware/prometheus.go` 指标暴露、`observability/webvitals.go`）；
  2. NeatLogic 之所以有 OS 巡检，是因为它**自己就是监控底座**，需自带 Agent；Orion 的定位是 Prometheus 之上的编排层；
  3. 自建 Agent 会引入分发、升级、版本漂移、安全审计四大长期负担。
- **正确路径**：OS 巡检 = **对 Prometheus 做 PromQL 断言查询**（`query_range` API），而非新造采集。当前唯一断点是 `alert-adapter` 的 `prometheusHandler.Receive()` 是 TODO 桩（`handlers.go:74-79`，注释明确写了 `// TODO: in production, HTTP GET Alertmanager API at h.alertmanagerURL/api/v2/alerts`）。
- **判定**：❌ 缺失，但**技术路线明确**——补 Prometheus HTTP API 客户端（`api/v1/query` + `api/v1/query_range`）即可覆盖 OS/虚拟化/中间件/数据库的大部分指标巡检。这是 Orion 巡检最高 ROI 的单项投资。

### 3.3 虚拟化巡检（vCenter / VMware / 华为 FusionCompute）

- **Orion 现状**：❌ 无。
- **是否需要 Agent**：不需要。vCenter 走 REST API（vAPI `/api/vcenter/…`，需 Basic Auth + 自签 CA 处理），华为 FusionCompute 走 ManageOne OpenAPI。两者都是**带凭证的 HTTP API 采集**，属于 `Collector` SPI 的 `Collect()` 实现，不需要在客户机部署 Agent。
- **判定**：❌ 缺失，P1。属于 SPI 落地后的增量插件，单个厂商约 10 人天。

### 3.4 中间件巡检（WebLogic / Tomcat / Apache / Jetty / WebSphere / Tuxedo / Nginx）

- **Orion 现状**：❌ 无。
- **JVM/MBean/JMX 判断**：这是 Orion 巡检**最硬的技术缺口**，也最容易被低估：
  - 7 种里只有 Nginx 简单（`stub_status` / 日志解析）；
  - WebLogic/WebSphere/Jetty 走 **JMX**。Go 无法原生读 MBean，业界标准是 **Jolokia**（在 JVM 上跑一个 HTTP 代理，把 MBean 暴露为 REST）。这意味着巡检方案里有一个**外部 Agent 依赖**——Jolokia 必须部署在目标 JVM 上；
  - Tomcat 同理（Jolokia war）；
  - Tuxedo 是老式 C/C++ 中间件，无标准 API，实际项目里靠 `tadmin`/`tlin` 命令行 + SSH。
- **判定**：❌ 缺失，P1。**建议明确写进架构文档：中间件 JVM 巡检以 Jolokia 为前置依赖**，并在采集插件的 `HealthCheck()` 里做 Jolokia 存活探测，否则客户会以为配置了就能用。

### 3.5 数据库巡检（与 DBA 模块关系）

- **Orion 现状**：⚠️ Orion 的**相对强项**。`dba/` 域有真实能力：`slowquery/collector.go`（真实采集）、`advisor/slow_lookup.go`（`pg_stat_*` / `information_schema` 真实 SQL）、`explain`、`osc`、`aireview`、`query/exporter.go`（**真实** `excelize/v2` Excel 导出，含表头样式、LocalStore、签名 URL）。
- **关系问题**：DBA 巡检是"慢查询/执行计划/容量"视角，NeatLogic 数据库巡检是"实例健康 + 参数合规 + 备份状态 + 表空间水位 + 会话"视角，**两者是互补而非重叠**。
- **判定**：⚠️ 有基础但需桥接。建议在 inspection 中注册一个 `dba-collector` SPI 实现，把 DBA 的 advisor 结果作为巡检结果源。**关键：DBA 的真实 Excel 导出器应下沉为通用组件**，巡检报告直接复用它——这是现成资产，零成本收益。

### 3.6 网络巡检（交换机 / F5 / 防火墙 / 专线）

- **Orion 现状**：🚫 **代码存在但不参与编译**。`internal/cmdb/transport/snmp.go` 是较完整的 SNMP 设计（RFC 3411 v3 / RFC 1905 v2c、Community、UserName/AuthPass/PrivPass、AuthProto MD5/SHA、PrivProto DES/AES、Timeout、Retries、MaxOids、Get/BulkGet），但**首行 `//go:build ignore`**。`ssh.go`、`sql.go` 同样 `go:build ignore`。
- **判定**：❌（当前不可用）。**注意这是"临门一脚"缺口**——设计已就绪，只差：(1) 去掉 build tag；(2) `github.com/golang/snmp` 已在设计里引用；(3) 在 `registry.Register()` 注册一个 `cisco-snmp` adapter（该名字已在注释中出现）。工作量约 10-15 人天，是**全报告 ROI 最高的单项**，且能同时点亮 #26（网络巡检）和部分 #22/#24。
- F5 走 iControl REST / LTM API，防火墙走各厂商 API（Huawei CLI/NETCONF），均为 API 采集。**NETCONF 全仓无支持**（`grep NETCONF` 无命中），若客户有 NETCONF-only 设备需补充。

### 3.7 容器巡检（Docker 健康/性能/内部应用）

- **Orion 现状**：🚫 `checkKubernetes` **硬编码返回 ok**，从不连接 K8s API（`health-check/service.go:257-265`）。`checkDatabase`、`checkRedis` 同样硬编码 ok（`:237-255`）——**三个 checker 都是假阳性工厂**。
- **判定**：❌ 缺失。**Orion 有真实 K8s client 能力**（`internal/cluster/service/service.go`、`internal/self-healing/executor/k8s_executor.go`、`internal/chaos/injector/injector.go` 均引用 client-go），所以这是**纯接线工作**而非技术攻坚。容器巡检的正确形态：
  - 健康：Pod `Ready` condition、CrashLoopBackOff 计数、OOMKilled
  - 性能：Prometheus kube-state-metrics + cadvisor
  - 内部应用：容器内 `/healthz` + 资源 request/limit 比值
- **工时**：约 8 人天。**但必须先修掉硬编码 ok 的三个 checker**，否则巡检结果永远是绿色（见 §7.3）。

### 3.8 存储巡检（IBM / EMC / NetApp / HDS）

- **Orion 现状**：❌ 无。**注意任务描述中"S3CLI"是误记**——存储巡检是块/文件存储厂商 API（NetApp ONTAP REST API、EMC Unity API、IBM Storwize CLI/GUI-API），不是对象存储 CLI。全仓无任何存储厂商 SDK。
- **判定**：❌ 缺失，P2。厂商碎片化严重、单厂商 ROI 低，**建议不做，改为文档说明"通过 SNMP + 厂商导出文件解析"覆盖**（NetApp/EMC 均支持 SNMP trap 上报磁盘状态），复用 SNMP transport 即可低成本兜底。

### 3.9 硬件巡检（IPMI）

- **Orion 现状**：❌ 无。**`grep ipmi` 全仓零命中**。
- **判定**：❌ 缺失，P2。Go 侧 IPMI 需走 `ipmitool` 子进程或 Redfish API。**建议优先 Redfish**（HTTP API，与 SNMP 同构，现代服务器标配），IPMI 2.0 作为 SSH fallback。约 10 人天。**务实建议：硬件巡检在企业巡检实践中通常由 BMC/Redfish 平台或 Zabbix IPMI Agent 承担，Orion 应定位为消费方而非采集方**，避免在 Orion 里重建硬件采集栈。

---

## 4. 巡检引擎架构建议

### 4.1 采集插件 SPI（复用已有 CMDB Collector 接口，不要新造）

`internal/cmdb-collector/interfaces/collector.go` 的接口设计**质量很高**，直接复用：

```go
type Collector interface {
    Name() string                                        // "promql", "ciso-snmp", "jolokia-jmx"
    Type() string                                        // "os"|"network"|"database"|"middleware"|"container"|"virtualization"
    Discover(ctx context.Context, target *models.Target) ([]*models.Device, error)
    Collect(ctx context.Context, device *models.Device) (*models.Collection, error)
    HealthCheck(ctx context.Context, target *models.Target) error   // 关键：大巡检前先探测可达性
    ConfigSchema() map[string]interface{}                 // 前端表单自动生成
}
```

**必须做的三个增强**（现有接口不足）：

1. **`Collect` 需带上下文与超时预算**：现为 `context.Context` 传入，但缺"单目标耗时预算"概念。建议加 `func (c Collector) CostHint() CostClass`（Cheap/Medium/Expensive），供调度器做并发控制（见 §7.1）。
2. **`Discover` 与 `Collect` 需区分同步/异步**：批量巡检中 Discover 一次可得几百设备，不应阻塞。建议 `Collect` 返回 `CollectResponse` 结构（`cmdb-collector/service.go:187` 已有雏形）。
3. **注册方式改为 wiring-time + 代码生成**：当前 `Registry.Register()` 全仓无人调用（已验证）。建议参照 `api-component` 的做法（`internal/api-component/service/service.go:77,97,124` 有真实注册调用），做 `init()` 自注册 + `//go:linkname` 或 factory 模式，避免"接口定义完美、生产环境零插件"的尴尬。

**首批 6 个插件（按 ROI 排序）**：`promql`（1 个覆盖 OS/虚拟/中间件/DB 指标）、`cisco-snmp`（拆 build tag）、`jolokia-jmx`、`http-synthetic`、`k8s-native`、`dba-advisor`。

### 4.2 阈值引擎

NeatLogic 的阈值引擎是"规则即数据"，Orion 目前连 condition 结构都没有。建议三层：

```
L1 静态阈值    cpu > 90 持续 5min
L2 多阈值/边界  warning>=80, critical>=95（NeatLogic 标配）
L3 基线/时序    与过去 7 天同时间段对比（动态基线，抑制阈值漂移）
```

- **存储**：`metadata` JSONB 已有，但需加 schema 校验（当前 `CreateRequest.Config map[string]interface{}` 完全无约束，见 §7.5）。
- **计算位置**：**阈值判定必须在 PromQL 侧做**（`alert` 表达式），不要在 Orion 拉全量时序回来再判——否则 1000 台机器 × 每分钟拉取会打爆 Prometheus。
- **与告警引擎的边界**：见 §7.7，这是最容易被做错的地方。

### 4.3 报告生成

- **Excel**：直接复用 `internal/dba/query/exporter.go` 的 `WriteExcel` + `LocalStore` + `LocalURLProvider`（签名 URL 下载）。**这是现成的、质量不错的资产，零成本**。
- **PDF**：全仓无 PDF 库（`grep go-pdf/fpdf` 零命中）。**建议不要引入 go-pdf**——企业巡检报告的实际消费场景是"Excel 给运维、邮件摘要给管理层"，PDF 排版是坑（中文字体嵌入、大表分页）。优先做**HTML 报告 + 浏览器打印**，或用 report-designer 的 `PreviewReport`（`service.go:326`）渲染 HTML。
- **邮件推送**：`internal/notification/.../channels.go` 有真实 SMTP（含 Auth、RFC 5322），**直接接线，不要新写**。

### 4.4 与自动化 / CMDB / 告警联动

| 联动 | 现状 | 建议 |
|---|---|---|
| 巡检 → 告警 | ❌ 无 | fail 结果按 severity 触发告警，但**必须走 alert-deduplication**（已有该模块） |
| 巡检 → 自动化 | ❌ 无 | `auto-exec` / `self-healing` 已存在，fail 可关联 `remediation` 字段触发 |
| 巡检 ↔ CMDB | ❌ 零耦合 | 巡检范围**必须**来自 CMDB 资产树，否则"应用视角巡检"无锚点 |
| 巡检 → 诊断 | ⚠️ | `diagnostic` 域（1370 行）有 TriggerDiagnostic/Symptom/Pattern，可把巡检 fail 作为诊断入口 |
| 巡检 → 报告 | ❌ 跨模块未接 | `report-designer` 有完整报告引擎（375 行 17 方法），补数据源适配即可 |

### 4.5 巡检结果缓存 / 去重 / 老化

当前完全没有，且**这是大规模巡检的成败关键**：

- **缓存**：同一巡检项在短时间内对同一目标的重复结果应幂等。建议 Redis 缓存 key = `hash(collector, device, condition)`，TTL = 巡检周期。
- **去重**：巡检发现的问题应生成稳定指纹（`device + item + metric + value_range`），与已有 `alert-deduplication` 模块共享指纹算法。
- **老化**：`inspection_results` 需要独立表 + 分区（`executed_at` 按月），**当前单表 + 软删除方案在 10 万目标 × 每小时巡检下会在 3 个月内不可查询**。建议 `pg_partman` 或原生 `PARTITION BY RANGE`。
- **软删除的反模式**：`repository.go:146-161` 软删除 `inspection_records`——规则可以软删，但**结果数据绝不应软删**（审计需要）。这是模型设计错误。

---

## 5. 配置巡检深度分析

NeatLogic 的"配置巡检"（备份内容巡检 / 路径定义+通配符 / 版本差异比对）是**Orion 目前完全空白且最被低估**的一块——它不依赖任何协议采集，纯平台能力，是最容易先落地的巡检类型。

### 5.1 配置文件版本比对（git-style diff）

- **现状**：❌ 全仓无 diff 引擎。Go 侧成熟方案是 `github.com/sergi/go-diff`（纯 diff）+ `github.com/pmezard/go-difflib`（统一格式输出）。
- **实现建议**：
  - 采集：SSH 拉取（`ssh.go` 蓝图可复用）或 NFS/SFTP 挂载（`cmdb-import/service.go` 已有 SFTP 经验，见记忆中的 cmdb-import 修复）
  - 比对：统一 diff 格式输出（`+/-` 行级），**不要用行号锚定**——配置文件行号会漂移
  - 敏感字段屏蔽：`password|secret|token|key` 正则脱敏，**这是配置巡检最容易出的安全事故**

### 5.2 变更检测策略

三种策略，按场景选：

| 策略 | 适用 | 成本 |
|---|---|---|
| 全量比对 | 小配置（<1MB），如 Nginx/Tomcat | 低 |
| 摘要比对（hash 短路） | 大配置，先比 md5 再比内容 | 中 |
| 结构化解析比对 | 有 schema 的配置（YAML/JSON/HCL），按 key 比对，忽略注释/格式差异 | 高 |

**建议从摘要比对起步**（性价比最高）：拉文件 → 算 hash → 与基线 hash 比对 → 不同才做详细 diff。这把 99% 的巡检成本降为零。

### 5.3 基线管理

- **基线生成**：首次巡检结果自动成为基线，或人工审批后设为基线（**建议强制人工审批**——自动基线会把配置漂移固化成"正常"）
- **基线锁定**：基线变更需走 `change-request` 流程（Orion 已有该模块），把"配置基线变更"纳入变更管理
- **基线快照**：基线不可变（immutable snapshot），保留历史版本，支持回滚比对
- **漂移容忍度**：区分"格式漂移"（空格/注释，忽略）与"语义漂移"（值变更，告警）

---

## 6. Orion 关键短板（P0 / P1）

从巡检专家视角，按"会造成客户事故"的严重度排序：

### P0-1：`RunInspection` 是空实现，且"看起来能跑"
`service.go:48-60` 把状态置为 `running` 就返回，永不收敛、无结果、无报告。**最危险的是它有 13 个通过的测试**——测试在验证一个假实现。客户会在验收时发现"巡检按钮点下去没反应"，这是**信誉级事故**。**要么删掉这个按钮，要么实现它**。约 10 人天。

### P0-2：三个 health checker 硬编码返回 `"ok"`
`checkDatabase`/`checkRedis`/`checkKubernetes`（`health-check/service.go:237-265`）无条件返回 `{status:"ok", ping:true}`，从不建立连接。**这是假阳性工厂**——巡检系统的头号原罪。三个方法各 1-2 人天可修。

### P0-3：前端-后端 API 契约完全断裂
前端 `orion-frontend/src/api/inspection.ts`（119 行）调用：`/inspection/rules`、`/inspection/rules/:id`、`/inspection/tasks`、`/inspection/reports`、`/inspection/health-score`。**Go handler 实际只注册**：`/inspection`、`/inspection/:id`、`/inspection/:id/run`、`/inspection/:id/results`、`/inspection/:id/status`、`/inspection/templates`、`/inspection/stats`、`/inspection/batch`、`/inspection/history`。

**两组路径零交集**。前端 540 行页面 + 191 行测试构建在不存在于 Go 蓝图的 API 上。TS 单体侧可能有实现（本工作区未检出，无法确认），但**Go 蓝图与前端契约不一致是硬事实**，任何一次微服务拆分都会导致巡检前端全灭。约 5 人天对齐。

### P0-4：SNMP/SSH/SQL transport 被 `//go:build ignore` 冻结
`snmp.go`/`ssh.go`/`sql.go` 三个文件不参与编译，导致**网络巡检、SSH 采集、数据库直连三项能力同时归零**，而它们的设计其实是完整的（SNMP 支持到 v3 + 认证加密）。这是"代码写完了但不启用"的典型浪费。约 10-15 人天点亮。

### P0-5：无采集层、无执行引擎、无阈值引擎
巡检系统的三大不可替代内核 Orion 全部为零。这是结构性缺口，非补丁可解。详见 §8 Phase 规划。

### P1-1：`cmdb-collector` SPI 定义完美但零注册
`Registry.Register()` 定义完整，全仓无一处调用（已验证）。这是"造了插件总线、接了零根线"。**必须做 wiring，否则 SPI 是纸面架构**。

### P1-2：巡检与 CMDB / DBA / report-designer / notification 四模块零耦合
Orion 巡检最大的优势不是巡检本身，而是**周边模块成熟度远高于巡检**。但 inspection 目录 `grep` 确认不引用任何相邻包——孤岛。**巡检模块应该是最薄的层，全部能力来自编排已有模块**。

### P1-3：模型设计错误——单表 + 软删结果
`inspection_records` 单表承载规则和结果，且软删除。NeatLogic 是 Rule → Task → Result（Item 级）三级。当前设计**无法支撑历史趋势、无法支撑审计追溯**（软删结果 = 删除审计证据）。

---

## 7. 领域特有反模式 / 陷阱

以下是巡检生产环境**必然会踩**的坑，Orion 目前全部没有防护。

### 7.1 巡检风暴（Inspection Storm）—— 头号杀手

同时巡检 5000 台机器，若并发 200 × 单目标 5s 超时，会造成：
- SNMP：交换机 CPU 打满（SNMP agent 是嵌入式轻量实现，10 QPS 就吃力）
- SSH：目标机 sshd 连接数耗尽，运维被锁在自己机器外
- 数据库：巡检 SQL 打满 connection pool，**直接影响生产业务**

**Orion 现状**：`ExecuteAll`（`health-check/service.go:93`）和 `BatchCreate`（`service.go:126-142`）都是**串行 for 循环**，无并发控制、无速率限制、无熔断。

**必须实现**：
1. **分层并发池**：全局上限（如 200）+ 单 Collector 上限（如 20）+ 单目标上限（1）
2. **Collector 成本分级**：`CostHint()` 影响并发分配（JMX/IPMI 贵，PromQL 便宜）
3. **令牌桶限速**：按目标类型限速（SNMP 5 QPS、SSH 2/s、DB 10/s）
4. **熔断**：同一网段 50% 目标失败 → 熔断该网段，避免重试风暴
5. **错峰调度**：不要所有巡检同一秒触发，加 jitter

### 7.2 阈值漂移（Threshold Drift）

固定阈值 `cpu > 90` 在新老机器、忙闲时段表现完全不同。典型后果：**阈值被反复调高，直到永远不告警**。

**Orion 现状**：无任何基线/动态阈值能力。

**必须实现**：
1. **动态基线**：以过去 N 天同时间窗口的 P95 作为阈值（而非绝对值）
2. **阈值变更记录**：每次阈值修改记录 who/when/why，纳入审计
3. **阈值健康度指标**：统计"过去 30 天该规则告警次数"，连续 30 天零告警 → 提示阈值可能过松
4. **禁止自动放宽**：阈值只能人工调整，自动化不允许调高阈值

### 7.3 假阳性泛滥（False Positive Flood）

假阳性的成本是**告警疲劳**，最终结果是运维**关掉巡检**。这比不做巡检更糟。

Orion 当前的具体隐患：
- `checkDatabase`/`checkRedis`/`checkKubernetes` 硬编码 ok → **假阴性**（更危险，漏报生产故障）
- `RunInspection` 目标不存在时返回 ok（`service.go:51-52`）→ **吞错**，巡检看起来永远成功
- `GetStats` 把 `pending` 计入 `running`（`service.go:106-107`）→ 统计失真
- 无 `skipped` 状态处理 → 不可达目标会被误判为 fail 或 pass

**必须实现**：
1. **`unknown` 状态**：采集失败 ≠ 检查失败。区分 `pass` / `fail` / `error`（采集失败）/ `skipped`（主动跳过）/ `unknown`（无数据）
2. **flapping 抑制**：状态在 pass/fail 间快速震荡时，只报一次并标记 flapping
3. **抑制窗口**：变更后 N 分钟内抑制巡检告警（配合 change-request）
4. **可解释性**：每条 fail 必须带 `remediation` 建议 + 原始采集值（spec §4.3 已定义 `remediation` 字段但代码无此列）

### 7.4 巡检超时与结果丢失

- **`RunInspection` 无超时**：状态置 `running` 后**无任何超时兜底**，进程崩溃/网络中断后状态永久卡 `running`。必须加 `running` 状态超时回收（如 30min 未更新 → 标记 `error`）。
- **结果丢失**：结果写入与状态更新不是事务性的，崩溃会留下 `running` 孤儿状态。
- **建议**：所有执行必须走 task 实体 + 状态机 + 超时回收 + 幂等重试（至少 3 次指数退避）。

### 7.5 大规模巡检调度

- Orion 已有真实调度器可复用：`infrastructure/backup/service/scheduler.go`、`archive_scheduler.go`、`branch-policy/scheduler.go`、`job-source/service/adapters.go`（均引用 `robfig/cron`）。**不要为巡检新造调度器**。
- 关键设计：
  1. **分布式调度**：多实例部署时避免重复执行（Redis 分布式锁，key = `hash(rule_id + cron_slot)`）
  2. **巡检批次（Batch）**：单次巡检 = 1 个 Batch，包含 N 个 Target 的 M 个 Item。Batch 有独立状态与统计
  3. **增量执行**：支持"只巡检上次 fail 的目标"，大幅缩短大规模巡检耗时
  4. **优先级队列**：核心系统巡检优先，边缘系统后执行

### 7.6 巡检数据保留策略

Orion 当前完全无保留策略，**这是合规硬需求**（等保、SOX、ISO 27001 都要求巡检记录留存 6 个月以上）。

建议保留矩阵：

| 数据类型 | 热存储 | 温存储 | 冷存储 | 归档后 |
|---|---|---|---|---|
| 巡检结果明细 | 30 天 | 90 天 | 1 年（对象存储） | 删除 |
| 巡检汇总/趋势 | 90 天 | 1 年 | 3 年 | 删除 |
| 巡检报告 | 永久（不可变） | — | — | — |
| 基线快照 | 永久（可回溯） | — | — | — |
| 阈值变更记录 | 永久（审计） | — | — | — |

**实现建议**：
- 结果明细按月分区（`PARTITION BY RANGE (executed_at)`），PG 原生 `DROP PARTITION` 归档
- **报告与基线必须 append-only**，不可 UPDATE/DELETE（用触发器或独立 schema 强制）
- **绝不软删审计相关数据**——`repository.go` 当前的软删设计需修正

### 7.7 与告警系统的边界（最容易被做错）

**核心判断：巡检发现问题 ≠ 告警触发**。这是巡检与监控的根本分野，也是多数平台做错的地方。

| 维度 | 巡检（Inspection） | 告警（Alert） |
|---|---|---|
| 触发方式 | 定时/人工，拉取式 | 实时，推/拉结合 |
| 时间粒度 | 小时~天 | 秒~分钟 |
| 目的 | 发现**潜在风险与漂移**（配置不对、证书快过期、容量将满） | 发现**已发生异常**（CPU 爆、服务挂） |
| 输出 | 问题清单 + 报告 + 整改单 | 通知 + 值班响应 |
| 时效性 | 允许延迟，接受漏报个别窗口 | 不允许漏报 |
| 典型例子 | "SSL 证书 14 天后过期" | "数据库 CPU 100%" |

**Orion 的正确做法**：
1. 巡检结果**不直接**发告警，而是写入 Issue 表
2. Issue 按严重度**有条件地**升级：`critical` + 生产环境 → 触发告警；`low` → 仅进报告
3. 升级路径必须经过已有的 `alert-deduplication`（Orion 已有该模块）
4. **配置巡检的特殊处理**：配置漂移通常**不应该实时告警**（半夜改配置很常见），应汇总为日报。这是 NeatLogic 的设计取舍，Orion 应遵循

**陷阱**：把巡检做成"低频告警"是反模式——会导致告警噪声翻倍且掩盖真正的实时告警。

---

## 8. Phase 建议 + 工时校准

**总校准：约 285-300 人天（含 30% 联调测试缓冲）**。这是从零到有、可交付给企业客户的完整巡检能力，不是 demo。

### Phase 0：止损与地基（25 人天）— 必须先做
| 任务 | 工时 | 说明 |
|---|---|---|
| 删除或真实实现 `RunInspection` 空壳 | 10 | 消除信誉级风险 |
| 修复三个硬编码 `check*`（DB/Redis/K8s） | 3 | 消除假阴性工厂 |
| 对齐前后端 API 契约（rules/tasks/reports/health-score） | 5 | 防止微服务拆分时前端全灭 |
| 修正模型：拆分 `inspection_rules` / `inspection_tasks` / `inspection_results` 三表，结果表加分区 | 7 | 消除软删审计数据的设计错误 |
| 更新 spec 文档（当前文档与代码不一致） | 1 | |

### Phase 1：点亮采集层（45 人天）— ROI 最高
| 任务 | 工时 | 说明 |
|---|---|---|
| 去掉 `snmp.go`/`ssh.go`/`sql.go` 的 build tag，做真实实现 | 15 | **最高 ROI**，设计已就绪 |
| 实现 `promql` collector（Prometheus `query` + `query_range`） | 10 | 一个插件覆盖 OS/虚拟/中间件/DB 指标 |
| 实现 `http-synthetic` collector（复用 health-check） | 5 | 应用巡检 |
| 实现 `k8s-native` collector（复用 `internal/cluster` client-go） | 8 | 容器巡检 |
| Collector wiring + 注册机制（解决零注册问题） | 5 | SPI 落地 |
| 并发控制 + 限速 + 熔断框架 | — | 并入 7.1，约 10 人天计入本 Phase |

> Phase 1 结束时，一个 `promql` 插件 + 一个 `snmp` 插件即可覆盖 NeatLogic 15 项巡检范围中的**约 10 项**。

### Phase 2：执行引擎与阈值（40 人天）
| 任务 | 工时 | 说明 |
|---|---|---|
| 巡检执行引擎（Rule → Task → Batch → Item 状态机） | 15 | |
| 阈值引擎 L1/L2（静态 + 多阈值） | 8 | |
| condition/details JSON schema 校验 | 5 | 当前完全无约束 |
| 超时回收 + 幂等重试 + `unknown` 状态 | 6 | 7.4 |
| 结果去重/指纹 + flapping 抑制 | 6 | 7.3 |

### Phase 3：调度与大规模（35 人天）
| 任务 | 工时 | 说明 |
|---|---|---|
| 对接已有 cron 调度器（复用 backup/branch-policy 的 robfig/cron） | 8 | 不要新造 |
| 分布式调度（Redis 锁，多实例不重复） | 6 | 7.5 |
| 增量执行（只巡检上次 fail 的目标） | 7 | |
| 批次管理与统计 | 6 | |
| Prometheus 指标暴露（执行数/通过率/耗时/超时率） | 5 | |
| 数据保留/分区/归档策略实现 | 3 | 7.6 |

### Phase 4：报告与通知（30 人天）
| 任务 | 工时 | 说明 |
|---|---|---|
| 巡检报告引擎（复用 `report-designer`，补数据源适配） | 10 | report-designer 已有 17 方法 |
| Excel 导出（复用 `dba/query/exporter.go`） | 4 | **零成本资产** |
| HTML 报告渲染（不用 PDF） | 5 | |
| 邮件/IM 推送接线（复用 `notification` 真实 SMTP） | 4 | 通道已存在 |
| 健康评分计算（前端已请求 `/health-score`） | 4 | |
| 结果查询/过滤/分页完善 | 3 | |

### Phase 5：配置巡检（25 人天）— 独立且易落地
| 任务 | 工时 | 说明 |
|---|---|---|
| 配置文件采集（SSH/SFTP，复用 cmdb-import 经验） | 6 | |
| 摘要比对（hash 短路） | 3 | 5.2 |
| git-style diff 引擎 + 统一 diff 格式 | 6 | 5.1 |
| 基线管理（人工审批 + 不可变快照 + change-request 联动） | 6 | 5.3 |
| 敏感字段脱敏 | 2 | 安全硬需求 |
| 格式漂移 vs 语义漂移区分 | 2 | |

### Phase 6：领域插件扩展（30 人天）
| 任务 | 工时 | 说明 |
|---|---|---|
| `jolokia-jmx` collector（WebLogic/WebSphere/Tomcat/Jetty） | 12 | 需文档声明 Jolokia 前置依赖 |
| `vcenter` + `fusioncompute`（虚拟化合并） | 12 | |
| `redfish` 硬件巡检 | 6 | 优先 Redfish 而非 IPMI |

### Phase 7：治理与边界（20 人天）
| 任务 | 工时 | 说明 |
|---|---|---|
| 巡检 → 告警的有条件升级（经 alert-deduplication） | 6 | 7.7 |
| 巡检 → CMDB 资产树绑定（应用/资产视角） | 5 | |
| 阈值变更审计 + 漂移健康度指标 | 4 | 7.2 |
| 巡检 → 诊断/自愈联动（remediation → auto-exec） | 3 | |
| 全链路测试 + 演练（含巡检风暴压测） | 2 | |

### 分阶段汇总

| Phase | 内容 | 工时(人天) | 完成后效果 |
|---|---|---|---|
| 0 | 止损与地基 | 25 | 消除假象，契约一致，模型正确 |
| 1 | 点亮采集层 | 45 | 覆盖约 10/15 巡检范围，**可 demo** |
| 2 | 执行引擎 + 阈值 | 40 | 巡检真正能跑，结果可信 |
| 3 | 调度与大规模 | 35 | 支撑万级目标，巡检风暴防护 |
| 4 | 报告与通知 | 30 | 交付管理层价值 |
| 5 | 配置巡检 | 25 | 独立高价值能力 |
| 6 | 领域插件 | 30 | 覆盖 VM/中间件/硬件 |
| 7 | 治理与边界 | 20 | 企业级合规与联动 |
| **合计** | | **250 + 缓冲 ≈ 300** | 企业级巡检能力 |

**里程碑建议**：Phase 0+1 = 80 人天，2-3 人并行约 6-7 周即可交付可演示版本（覆盖 OS/网络/容器/应用四类巡检）。Phase 0 必须先行，**在 Phase 0 完成前不应向客户展示巡检功能**。

---

## 附录 A：本报告引用的关键代码位置

| 结论 | 文件:行 |
|---|---|
| `RunInspection` 空实现 | `internal/inspection/service/service.go:48-60` |
| `GetStats` 把 pending 计入 running | `internal/inspection/service/service.go:106-107` |
| `BatchCreate` 串行无并发 | `internal/inspection/service/service.go:126-142` |
| 单表 + 软删 | `internal/inspection/repository/repository.go:146-161` |
| 模型仅 3 字段（name/status/metadata） | `internal/inspection/models/models.go:8-17` |
| 路由清单（与前端不匹配） | `internal/inspection/handler/handler.go:23-37` |
| Prometheus handler 是 TODO 桩 | `internal/alert-adapter/service/handlers.go:74-79` |
| SNMP/SSH/SQL 被 `//go:build ignore` | `internal/cmdb/transport/{snmp,ssh,sql}.go` 首行 |
| Collector SPI 定义 | `internal/cmdb-collector/interfaces/collector.go:45-61` |
| `Registry.Register` 定义但零调用 | `internal/cmdb-collector/registry/registry.go:40` |
| `checkKubernetes/DB/Redis` 硬编码 ok | `internal/health-check/service/service.go:237-265` |
| 真实 HTTP 探活（可复用） | `internal/health-check/service/service.go:182-235` |
| 真实 Excel 导出器（可复用） | `internal/dba/query/exporter.go:56` 起 |
| 真实 SMTP 实现（可复用） | `internal/notification/notification-engine/channels/channels.go:130-218` |
| 报告引擎 17 方法（未接线） | `internal/report-designer/service/service.go` |
| 前端调用不存在的 API | `orion-frontend/src/api/inspection.ts:62-118` |
| 文档-代码模型不一致 | `docs/services/inspection/07-inspection-spec.md:89-137` |

## 附录 B：本报告未覆盖的边界声明

1. **`orion-platform-service`（TS 单体）未在本工作区检出**，TS 侧是否存在真实巡检实现无法确认。本报告全部结论仅覆盖 Go 蓝图与前端。
2. Prometheus 侧的**告警规则与指标采集**（即 PromQL 规则的编写与部署）属于运维配置而非平台代码，本报告不评估。
3. 工时为专家级估算，未包含 UI 重做（假设复用现有 Ant Design 页面骨架）与安全审计专项。
4. 未与告警、CMDB、监控等其他领域的专家报告做交叉对齐（按约束要求避免重复）。

---

_评审完成于 2026-09-30。所有代码结论均经实际 grep/Read 验证；文档与代码不一致处已单独标注。_
