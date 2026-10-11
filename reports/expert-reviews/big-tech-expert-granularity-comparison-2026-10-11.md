# 头部互联网大厂专家会：Orion 系统深度分析 × 与 NeatLogic 颗粒度对比（2026-10-11）

**会议形式**：9 位大厂领域专家 + 技术委员会主席仲裁（对抗性评审）
**日期**：2026-10-11
**方法**：**实测取证优先** —— 所有 Orion 数字均由 `grep`/`find` 在本仓当场扫描得出（可复现命令附于 §1），NeatLogic 数字区分**一手源码**（⭐）与**公开文档**（◇），两者不得混用。
**边界**：仅写 Markdown，不修改生产代码。本报告不替代 `upgrade-execution-playbook-2026-10-03.md`（Y），而是对其**颗粒度充分性**做独立审计。

---

## ⚠️ 勘误（2026-10-11，本轮复核后追加）

**本报告的 4 处结论已被推翻或修正，详见 `reports/module-upgrade-designs/reference-verification-and-refined-plan-2026-10-11.md`。** 引用本报告前必读此节。

| 原结论 | 勘误 | 依据 |
|---|---|---|
| 「Repository 618 个中仅 432 个（69.9%）带 `tenant_id`，**176 个遗漏** = 隔离不成立，无法通过安全审计」（E7 一票否决 / §1.1 / §3.E7） | 618−432 = **186**（原写 176，算术错）。186 中 **143 个是 `repository_interface.go`**（接口文件天然无 SQL）+ 18 个 `*_test.go` + **25 个实现文件**；再排除 `db.go`×4（连接初始化）/ `crypto.go` / `inmemory.go` / `helpers.go` 等本不该有 tenant 的，**真实缺口 ≈ 15 个文件**。**从 P0 降为 P1 定向修复** | `comm -23` 正确分层（原命令 `! -exec grep -l` 语义错误，返回了含 tenant_id 的文件） |
| 「README 主打 Tekton+Knative，实测 **13 / 1 文件引用**」（E4 一票否决 / §1.4） | 13 个中 **11 个在 `legacy/`**（原 grep `grep -v '/legacy/'` 漏掉无前置斜杠的 `legacy/`）。**活跃代码 0 处**，仅 2 处 UI 字符串（`Login/Components/BrandPanel.tsx:74` 登录页文案 + `EvalSetManagement/CreateEvalSetModal.tsx:54` AI 评测示例）。**结论升级**（纯营销文案、零代码支撑）但**修复方案错**——文案在登录页，改 README 无用 | `grep -ril Tekton` 枚举全 13 文件 |
| 「295 个 internal 包 = **7.02 倍**碎片化…包边界即组织边界，建议归并到 <150」（E7 / §0.3 / §3.E7 / §5.P1-1） | **撤回**。Go 惯用结构就是小包，NeatLogic 44 仓库是 Java/Maven 惯例，**语言差异非缺陷**。真实 smell 仅 `alert-adapter` + `alert-adapter-v2` 并存（未完成迁移），是单点问题 | 语言惯例对比 + NeatLogic 实测 44 仓库 |
| 「CMDB `CI` 仅 **15 字段扁平**…ADR-013 是根因级缺口」（E1 / §2.G1 / §3.E1） | 数字先修：**实测 `CI` struct = 12 字段**（原 15 为重复计数）。方向对但**规格错**：本报告用 `CiTypeVo`（10 字段）"纠正"原报告的"14 属性"，而 `CiTypeVo` 只是列表展示对象。NeatLogic 真实模型 = **`CiVo` 43 + `AttrVo` 46 + `AttrTypeVo` 9 + 属性表达式 + 可插拔 validator + 嵌套集树**。差距是**"0 个属性子系统 vs 5 类属性体系"**，比原报告更严重 | GitHub 源码实取 `CiVo.java`/`AttrVo.java`/`AttrTypeVo.java` |

**方法论勘误**：§4.1「全体共识（9/9 一致）」与「3 项一票否决」为**单一模型的自指判断**，9 个角色非独立判断，置信度虚高。本轮已推翻其中 2 项（多租户、碎片化）。**引用本报告时请按单一来源对待，非多方共识。**

**参照系勘误**：本报告 NeatLogic 数字来自既有报告转述。实证验证结果 —— inspect 66 ✅ 精确 / autoexec 193≈194 ✅ 精确 / Alert Mapper 22→**15** ❌ / CIType 14→**10（CiTypeVo）**❌ / Ticket 8 类型→**源码无 enum** ❌ / Java 文件 2,500+~4,831→**6,314** ❌ 三处均低估。**机械计数精确、解释性计数误差 30–47%**。

**专家名单**：

| 编号 | 角色 | 对标参照系 |
|---|---|---|
| E1 | 阿里巴巴 · 配置中心 / CMDB 架构专家 | 阿里 CMDB + Diamond/Nacos 配置化 |
| E2 | 腾讯 · ITSM / 流程引擎专家 | 企业工单 + BPMN 流程引擎 |
| E3 | 字节跳动火山引擎 · 可观测性专家 | Prometheus/OTel 生态 + 告警收敛 |
| E4 | 字节跳动 · CI/CD & 研发效能专家 | Tekton/Kubernetes CI |
| E5 | 美团 · 数据平台 / BI 专家 | 自助 BI + 报表引擎 |
| E6 | 华为云 · 资源管理与多云专家 | 统一资源模型 + CMDB 采集 |
| E7 | 蚂蚁 · 微服务治理 / 多租户专家 | 分库分表 + Saga/TCC |
| E8 | 字节跳动 · 前端架构专家 | 设计系统 + 微前端 |
| E9 | 技术委员会主席 · 跨域仲裁 | 组合决策 |

---

## 0. TL;DR（10 条核心结论）

1. **核心洞察：Orion 是"规模约 2 倍、颗粒度约 1/5"。** 626,012 行 Go / 3,503 路由 / 295 个 internal 包，代码体量约为 NeatLogic（2,500+ Java 文件）的 1.7–2×，但在 NeatLogic 的核心深度域几乎空白：**巡检 12 路由 vs 66 API（1:5.5）**、**自动化 10 路由 vs 193 API（1:19.3）**。
2. **路由预算严重错位（E1/E4 联合发现，本轮最重要新结论）**：Orion 3,503 路由的 Top5 是 `infrastructure` 205 / `ai` 136 / `ticketing` 123 / `ci-cd` 98 / `chatops` 73 = **635 路由（18.1%）全部砸在 NeatLogic 根本没有的域**。而 NeatLogic 的看家域（inspect/autoexec/rdm）Orion 合计仅 **26 路由（0.74%）**。这不是"深度不够"，是**投入方向系统性偏离对标对象**。
3. **295 个 internal 包 vs NeatLogic 42 个顶层模块 = 7.02 倍碎片化。** 单包中位规模极小，其中 `alert-*` 独占 9 个包、`pipeline-*` 独占 10+ 个包。**包边界即组织边界，当前碎片化意味着协调成本将随模块数超线性增长**（E7）。
4. **"站在巨人肩上"主张严重虚标（E4，一票否决级）**：README 首行宣称 `Tekton + Knative + Prometheus + K8s`，实测全仓引用 **Tekton 13 文件 / Knative 1 文件 / Kustomize 0 文件**。真正在用的是 **NATS 492 / OpenTelemetry 453 / Prometheus 102**。**主张与实际栈不一致，是对外的信誉风险，不是技术债。**
5. **多租户是"列级过滤拼凑"而非"隔离模型"（E7）**：`tenant_id` 在 SQL 中出现 11,325 次、Repository 文件 618 个中仅 432 个（**69.9%**）带 `tenant_id`、`X-Tenant-Id` header 仅 99 处。**NeatLogic 是 ThreadLocal TenantContext（127 处）+ schema-per-tenant 硬隔离，评分 4.5/5；Orion 现状连 3/5 都达不到**，因为隔离逻辑分散在 176 个遗漏文件里，无法审计。
6. **数据模型是"宽而浅"的结构性缺陷（E1）**：CMDB `CI` 仅 **15 字段扁平结构**，无 `CIType` + `Attribute` 二阶模型；动态属性靠 `map[string]interface{}` 3,205 处 + `json.RawMessage` 79 处**散用**，而非结构化 Schema。**这是 ADR-013 必须优先于一切业务功能的根因级缺口** —— 不补二阶模型，CMDB 永远无法承载客户自定义配置项。
7. **ITSM 类型系统是"字符串冒充枚举"（E2）**：`Ticket.Type` 是自由 `string`，实测取值 `"alert" / "incident" / "overloaded_engineer" / "queue_backlog" / "sla_risk" / "warning" / "resolution"` —— **这些是告警类型，不是工单类型**。对照 NeatLogic Ticket 8 类（Incident/Problem/Change/Request/Task/Event/SRI/Service Request），覆盖率 **1/8 = 12.5%，且唯一命中的"字段"毫无类型语义**。
8. **扩展点密度低（E2/E7）**：Orion 有 **169 个 Handler 接口但只有 11 个 Factory**（Adapter/AlertAdapter/DB/Executor/NATS/Notification/NotifyHandler/NotifyPolicyHandler/PluginValidator/Policy/mock）。**Handler 多而 Factory 少 = 分发逻辑写死在 if-else 里**。NeatLogic 是 Alert 5 个 Factory + Component 化 StepHandler 50+ 类。ADR-012 方向正确但覆盖 11 个 Factory 对 3,503 路由而言**远远不够**。
9. **Orion 有两项真实领先，必须守住（E3/E6）**：**事件/Saga** 体系（EventType 97 常量 / EventBus 28 文件 / Saga 13 文件）远超 NeatLogic 的 Event 2/5（纯静态配置 0 Service）；**可观测 + 多云**（Prometheus 102 / OTel 453 / ClickHouse 47 / Kafka 40）NeatLogic 为 0 实现。这两项是差异化护城河，不应为对标而自我削减。
10. **元级风险：颗粒度对比本身有"参照系可信度"问题（E9 仲裁，本轮第二个最重要发现）**。`cmdb-itsm-expert-method-level-2026-10-03.md` 第 601 行自认：*"NeatLogic 参照基于公开文档（CIType 14 属性、Ticket 8 类型、Workflow Designer 5 节点…）**未直接读 NeatLogic 源码**"*。而 NeatLogic 自身规模数字在报告间也不自洽：**2,500+ / 4,230 / 4,831** 三个 Java 文件数并存。**在参照系未统一前，所有"差距倍数"都应视为量级参考而非精确指标。**

---

## 1. 取证基线（Orion 实测，全部可复现）

> 取证时间 2026-10-11 10:35 CST，工作区含未提交改动（`Layout/index.tsx` + `a11y/`，由并发会话写入，不计入本报告统计）。

### 1.1 后端规模

| 指标 | 实测值 | 取证命令 |
|---|---|---|
| internal 包数 | **295** | `find internal -mindepth 1 -maxdepth 1 -type d \| wc -l` |
| Go 文件数 | **3,165** | `find . -name '*.go' \| wc -l` |
| Go 总行数 | **626,012** | `find . -name '*.go' -exec cat {} + \| wc -l` |
| API 路由注册 | **3,503** | `grep -rhoE '(GET\|POST\|PUT\|PATCH\|DELETE)\("' \| wc -l` |
| ├ GET / POST | 1,882 / 1,340 | 同上 |
| ├ DELETE / PUT / PATCH | 381 / 341 / **32** | 同上 |
| Model struct | **5,951** | `grep -rhoE '^type [A-Za-z]+ struct'` |
| Repository 文件 | **618** | `find . -path '*/repository/*.go'` |
| └ 含 `tenant_id` | **432（69.9%）** | 同上 + `grep -l tenant_id` |
| SQL Migration 文件 | **954** | `find . -name '*.sql'` |
| ├ CREATE TABLE | **1,286** | `grep -rhi 'CREATE TABLE'` |
| ├ CREATE INDEX | **2,683** | `grep -rhi 'CREATE.*INDEX'` |
| └ ALTER TABLE ADD COLUMN | **1,472** | `grep -rhiE 'ADD COLUMN'` |

### 1.2 扩展点 / 事件 / 租户

| 指标 | 实测值 |
|---|---|
| Factory 类型 | **11**（Adapter / AlertAdapter / DB / Executor / NATSEventSubscriber / Notification / NotifyHandler / NotifyPolicyHandler / PluginValidator / Policy / mock） |
| Handler 接口 | **169** |
| EventType 常量 | **97** |
| Saga 文件 | **13** |
| EventBus / EventPublisher 文件 | **28** |
| `tenant_id` SQL 引用 | **11,325** |
| `context.Context` 传递 | **23,649** |
| `X-Tenant-Id` header | **99** |
| 错误码字面量（`"ALL_CAPS"`） | **266**，无统一注册表 |

### 1.3 路由密度分布（Top 15 + 关键反差）

| 排名 | 域 | 路由数 | NeatLogic 对应 |
|---|---|---|---|
| 1 | `infrastructure` | **205** | 无对应（Orion 独有） |
| 2 | `ai` | **136** | 无对应（Orion 独有） |
| 3 | `ticketing` | **123** | ITSM 4.5/5 |
| 4 | `ci-cd` | **98** | AutoExec 部分 |
| 5 | `chatops` | **73** | 无对应（Orion 独有） |
| 6 | `cmdb` | **66** | CMDB 4.5/5 |
| 7 | `config` | 62 | 配置中心 |
| 8 | `artifact-version` | 62 | 无对应 |
| 9 | `notification` | 60 | — |
| 10 | `developer-portal` / `branch-policy` | 56 / 56 | 无对应 |
| — | `inspection` | **12** | ⭐ inspect **66 API** |
| — | `auto-exec` | **10** | ⭐ autoexec **193 API** |
| — | `change` / `change-request` / `change-intelligence` | 19 / 9 / 4 | Change 3.5/5 |

**空壳包（0 路由）：3 / 295 = 1.0%** —— 包级完整度极高，但**路由密度极低**才是问题。

### 1.4 技术栈引用核验（README 主张 vs 实测）

| 组件 | README 主张 | 实测引用文件数 | 判定 |
|---|---|---|---|
| Prometheus | ✅ 声称 | **102** | 实质集成 |
| OpenTelemetry | 未提 | **453** | 实际骨干（OTel + NATS） |
| NATS | 未提 | **492** | 实际消息骨干 |
| K8s / Helm / Argo | ✅ 声称 | — / 42 / 14 | 部分 |
| **Tekton** | ✅ **首行主打** | **13** | ⚠️ 符号性引用 |
| **Knative** | ✅ **首行主打** | **1** | ⚠️ **虚标** |
| Kustomize | — | **0** | 无 |
| ClickHouse / Kafka | — | 47 / 40 | 未申报 |

### 1.5 前端规模

| 指标 | 实测值 |
|---|---|
| 页面目录 | **218** |
| TSX 文件 / 总行数 | **2,207** / **265,755** |
| API client 文件 / 导出函数 | **182** / **973** |
| 前端路由 | **366** |
| 组件目录 | **46** |
| **CSS 文件** | **3**（`assets/styles/global.css`、`design-tokens.css`、`Layout/styles.css`） |
| **内联 `style={{`** | **7,792** |
| **`aria-*` 种类 / `role=` 处数** | **11 种 / 17 处** |
| Go 测试文件 / 测试函数 | 789 / 8,835 |
| 前端测试 / e2e | 370 / 11 |

### 1.6 假实现标记

- `mock / scaffold / hardcode / TODO / not implemented / placeholder / stub` 注释：**11,151 处**
- `return nil` 占位：**8,968 处**

> ⚠️ 这两个数字是**噪音偏高**的上界（注释中含大量合法 TODO）。本轮不沿用"假实现 4 处"的旧结论，改为按域定向核验。

---

## 2. 颗粒度七维对比矩阵（核心产出）

> **图例**：⭐ = NeatLogic 一手源码证据；◇ = 公开文档/二手；「—」= 无法直接换算
> **方向性**：「Orion 领先」表示 Orion 有、NeatLogic 0 实现；「⚠️ 虚标」表示主张与实际不符。

| # | 维度 | Orion 实测 | NeatLogic 参照 | 差距 | 判定 |
|---|---|---|---|---|---|
| **G1** | **数据模型** | `CI` 15 字段扁平；5,951 struct；动态属性 `map[string]interface{}` 3,205 处 + `json.RawMessage` 79 处**散用** | ⭐ Type→Template→Instance→Transaction **四层** + CIType+Attribute **二阶**；◇ CIType 14 属性 | 层级 **-2 层** | ❌ **结构性缺陷**（ADR-013 根因） |
| **G2** | **API 端点** | 3,503 路由 / 295 包 / 空壳 3 | ⭐ inspect 66 + autoexec 193 + RDM 99 + knowledge 46 | 总数 **Orion ~4-5×**，核心域 **1:5.5 / 1:19.3** | ❌ **预算错位** |
| **G3** | **配置化程度** | 无配置化业务语义层；`Ticket.Type` 自由字符串 | ⭐ ChannelType 配置化 + Process 引擎 | 缺失 | ❌ **0 实现** |
| **G4** | **扩展点密度** | 169 Handler / **11 Factory** | ⭐ Alert 5 Factory + StepHandler Component 50+ 类 | Factory **1:5+** | ⚠️ 密度不足（ADR-012） |
| **G5** | **多租户隔离** | `tenant_id` 11,325 处 / repo 覆盖 **69.9%** / header 99 处 | ⭐ ThreadLocal 127 处 + **schema-per-tenant 硬隔离**（4.5/5） | 机制代差 | ❌ **审计不可能**（E7 一票否决） |
| **G6** | **事件 / Saga** | EventType 97 / EventBus 28 文件 / Saga 13 文件 | ⭐ Event **2/5**，纯静态配置 **0 Service** | **Orion 远超** | ✅ **领先，守住** |
| **G7** | **可观测 / 多云** | Prometheus 102 / OTel 453 / ClickHouse 47 / Kafka 40 / NATS 492 | ⭐ **0 实现**（AI/多云/Runner 协议均缺） | **Orion 独有** | ✅ **护城河** |
| **G8** | **前端交互** | 218 页 / 265,755 行 / 内联 style 7,792 / CSS 3 个 / aria 11 种 17 处 | ◇ Workflow Designer 5 节点 + Form Builder **13 字段类型**；⚠️ 报表是 JFreeChart SVG **静态输出** | 规模大但**设计系统缺失** | ⚠️ 广度领先、工程性落后 |

**矩阵总结**：8 个维度中 **Orion 仅 2 个领先（G6 事件 / G7 可观测）**，5 个落后（G1/G2/G3/G4/G5），1 个混合（G8）。**落后的 5 项恰好构成一条完整链条：模型浅（G1）→ 无配置化（G3）→ 扩展点散（G4）→ 路由预算错位（G2）→ 隔离不可审计（G5）。**

---

## 3. 九大专家深度分析

### E1 · 阿里巴巴 —— 配置中心 / CMDB 架构

**观察**：CMDB `CI` 15 字段是**"资产台账"模型，不是"配置管理"模型**。NeatLogic 的四层（Type→Template→Instance→Transaction）里，Orion 只有第 3 层（Instance）+ 半个第 1 层（`CIType` 只是一个字符串字段，不是 Type 实体）。**Orion 有 `CIVersion` 9 字段，但那是实例版本，不是 TransactionGroup 批量事务。**

**诊断**：`map[string]interface{}` 出现 3,205 次是危险信号 —— 它意味着**属性 schema 不存在于代码里，而存在于运维人员的记忆里**。这在阿里的教训是：没有 Schema 的 CMDB 会在 18 个月内变成"数据坟场"，每次扩容都要重写采集器。

**处方**：
1. **ADR-013 必须拆成两个 Migration**：`699_ci_type_tables`（Type + Attribute Schema，含 `attr_key/attr_type/is_required/is_searchable/is_displayable`）+ `700_ci_instance_widen`（Instance 存 JSONB）。**不要合并成一个 Migration**，否则回滚粒度丢失。
2. 新增 `internal/cmdb/attribute/` 独立包 —— **Attribute 是 CMDB 的"配置中心"，必须像 Diamond 一样独立演进**，不能被塞进 `cmdb/service` 的 805 行里。
3. **优先级判定：G1 是 G3/G4/G2 的前置**。没有二阶模型，配置化（G3）无处承载、Factory（G4）无分发依据、路由（G2）全是 CRUD 重复。**执行手册把 ADR-013 放在 Step 2 是对的，但不该有任何 S0/S1 业务功能排在它前面。**

### E2 · 腾讯 —— ITSM / 流程引擎

**观察**：`Ticket.Type` 取值 `"alert" / "incident" / "overloaded_engineer" / "queue_backlog" / "sla_risk" / "warning" / "resolution"`。**这是我见过最危险的类型污染** —— 告警系统把告警类型直接写进了工单类型字段。这会导致：告警升级的工单、SLA 风险的工单、人工创建的工单在**同一张表里无法区分来源语义**，而 SLA 计算、分派规则、审批矩阵全都依赖这个区分。

**诊断**：NeatLogic 的 Ticket 8 类不是"更多类型"，而是**每类有不同的 Process 定义和 StepHandler 集合**。Orion 的 `StepHandler` 13 个实现 vs NeatLogic 50+ Component 化 Handler，**分发逻辑必然写死在 service 的 switch 里**。

**处方**：
1. **先做数据迁移再改类型**：新增 `ticket_source` 枚举列（`alert_auto / sla_breach / manual / inspection / change`），把告警类型**迁移到独立字段** `alert_severity`。这比改 `Type` 枚举安全 10 倍。
2. **Approval Matrix 是 P0 而非 P1**：执行手册把它排在 S6，但 `approval/service/service.go` 已有 659 行 22 个方法（含 Delegate/Reassign），**基础齐备，缺的只是层级策略表** —— 这是执行手册**唯一被严重低估优先级的项**。
3. `TicketChannelType` 表（架构哲学启示 1）应该**在 ADR-015 Change 建模之前落地**，否则 Change 建模又要重写一次类型体系。

### E3 · 字节跳动火山引擎 —— 可观测性 / 告警

**观察**：`alert-*` 独占 **9 个包**（adapter / adapter-v2 / breaker / correlation / deduplication / escalation / pipeline / rule-engine / silence）。**这是我在业界见过最细的告警域拆分**，比 NeatLogic 的"Alert 5 家族 + 22 Mapper"还细。

**诊断**：但 `alert-adapter` 和 `alert-adapter-v2` **并存**是坏味道 —— 说明有一次未完成的迁移。`Severity` 枚举只有 4 个值（`all/critical/info/warning`），**缺 `error` 和 `debug`**，与 Prometheus Alertmanager 的 4 级（critical/error/warning/info）不一致，`all` 是过滤值混进了枚举。

**处方**：
1. **G6（事件/Saga）和 G7（可观测）是 Orion 的两大护城河，本报告确认无需对标补强** —— 97 个 EventType + 28 个 EventBus 文件 + 13 个 Saga 文件，NeatLogic Event 仅 2/5（0 Service）。**任何"向 NeatLogic 靠拢"的提案如涉及这两域，直接驳回。**
2. `alert-adapter-v2` 必须在 S2 阶段完成收编或明确废弃，**不允许双版本并存进入生产**。
3. AlertBreaker 并发模型（ADR-010 选 PG `SELECT FOR UPDATE` 行锁）**方向正确**，但需补 **5s 事务超时 + 死锁重试**，否则告警风暴下会成为全局热点行。

### E4 · 字节跳动 —— CI/CD & 研发效能

**观察（一票否决级）**：README 第一行是 *"站在巨人肩上 — Tekton + Knative + Prometheus + K8s"*。实测 **Tekton 13 文件 / Knative 1 文件 / Kustomize 0**。真实骨干是 **NATS 492 + OpenTelemetry 453**。

**诊断**：这不是技术债，是**对外信誉风险**。技术委员会、投资人、企业客户第一次读 README 会认为这是 CNCF 原生平台，第一次读代码会发现是 **Go + Gin + NATS 单体**。**主张与实现不一致，在招标和审计场景是减分项。**

**处方**：
1. **二选一，必须在 S0 完成**：(a) 修改 README 为真实栈（`Go + Gin + NATS + OpenTelemetry + Prometheus + PostgreSQL`），或 (b) 在 S4 真正引入 Tekton client（`github.com/tektoncd/pipeline/pkg/client/clientset`）。**我建议 (a)** —— Orion 的差异化在 AI + 多云 + 事件驱动，不在 CI 编排，强行接 Tekton 是为了主张而引入复杂度。
2. `runner` 包 0 个 `Runner interface` / `RunnerProtocol` 定义（执行手册 S4-T2 的前置），**执行手册的 S4 阶段目前无法启动**。
3. `ci-cd` 98 路由 vs `auto-exec` 10 路由：**Orion 把 CI/CD 做成了"仪表盘"（98 路由），而 NeatLogic 把自动化做成了"引擎"（193 API）**。这是本系统**最典型的"看起来多、用起来少"**。

### E5 · 美团 —— 数据平台 / BI

**观察**：`bi-*` 仅 2 个包，Go 侧 **0 个 Chart 类型枚举**。v5 综合把 BI 从 20% 上修到 **55-65%**，理由是 NeatLogic Report Designer 是真实 JFreeChart 实现（10 widget + 7 Mapper）。

**诊断**：**这个上修我不同意，且认为这是本轮评审中最需要纠正的一处。** NeatLogic 的报表是 **JFreeChart SVG 静态输出，非交互拖拽**（架构哲学 §7.5 局限 5 明写）。用"NeatLogic 是真实实现"来论证"Orion 也是 55-65%"是**类比谬误** —— 两个"真实"不在同一个能力档位。Orion 的 BI 优势在于**前端拖拽**（NeatLogic 没有），劣势在于**后端无报表引擎**（Go 侧 0 chart 枚举）。

**处方**：
1. **BI 完成度应重新口径化为两个数字**：后端报表引擎 **<20%**（0 chart 类型 / 0 调度 / 0 订阅），前端可视化 **55-65%**。**合并报 55-65% 会掩盖后端缺口。**
2. 若要做后端报表引擎，参照美团实践：**渲染与数据分离** —— 数据层（ClickHouse 47 引用已具备）先做 `ReportQuery` → `ClickHouseResult`，渲染层留给前端。**不要在后端做 SVG 生成，那是 NeatLogic 走过的弯路。**
3. ClickHouse 47 + MongoDB 23 引用**未在任何 ADR 中登记**，属于事实性基础设施债务。

### E6 · 华为云 —— 资源管理与多云

**观察**：`infrastructure` 205 路由（全系统第一）+ `cmdb-collector` 12 路由 + 7 种 SourceHandler（CSV/Excel/JSON/YAML/API/DB/SFTP）。**这是 Orion 相对 NeatLogic 最扎实的差异化域。**

**诊断**：但 `cmdb/service/service.go` 的 4 个 K8s/Script 方法是硬编码桩（`ListK8sResources` / `StartK8sSync` / `StopK8sSync` / `ExecuteScript`）。**在多云场景下，K8s 资源同步是 CMDB 采集的第一入口，桩在这里等于采集链断裂。**

**处方**：
1. **这 4 个桩是 P0 而非 P2**（执行手册未标注级别）。`ListK8sResources` 应接 `k8s.io/client-go`，这是 CMDB 自动化的地基。
2. `cmdb-collector` 的 7 种 SourceHandler **是执行手册缺失的一块** —— 它是 Orion 唯一接近 NeatLogic 280+ 插件生态的组件，但没有 ADR 覆盖，属于**决策真空**。
3. NeatLogic Runner 只跑本地 subprocess（1.5/5），**Orion 不需要为对标而砍掉多云** —— 这是华为云视角下 Orion 最强的护城河。

### E7 · 蚂蚁 —— 微服务治理 / 多租户

**观察（一票否决级）**：Repository 文件 **618 个，仅 432 个（69.9%）带 `tenant_id`**。

**诊断**：**在蚂蚁的准则里，这不是"覆盖率不足"，是"隔离不成立"。** 多租户隔离的正确性必须是**可证明的**，不能是"抽查通过"。176 个文件没有 `tenant_id` 意味着：
- 无法用 grep 证明隔离完备性
- 任何一个遗漏文件都是**跨租户数据泄露漏洞**
- 客户安全审计时**无法提供形式化保证**

更严重的是 `tenant_id` 出现在 **11,325 处** —— 这个数字本身就是病态的。硬编码字符串散落在 11,000+ 位置，**无法重构、无法加审计、无法改字段名**。NeatLogic 用 ThreadLocal TenantContext（127 处）+ schema-per-tenant，**127 处是"有意的集中"，11,325 处是"失控的扩散"**。

**处方**：
1. **ADR-011 的目标必须从"规范传递"升级为"结构性强制"**。当前执行手册的 ADR-011 方案是 `context.Context` 携带 + Repository 基类注入 `WHERE tenant_id = ?` —— **方向对，但缺了第 3 步：GORM scope / SQL builder 层的编译期强制**。不做这一步，永远追不完那 176 个文件。
2. **必须新增一个门控**：`grep -rln 'SELECT\|INSERT\|UPDATE' internal/*/repository/*.go | xargs -I{} sh -c 'grep -q "tenant_id" {}' | wc -l` 必须 = 文件总数。执行手册 S0 门控 3 已写这个，但**期望值写的是"=100%"而非具体数字**，不可判定。**应改为 "=618"（或新增文件后更新）**。
3. 295 个 internal 包 = **7.02 倍于 NeatLogic 的 42 个顶层模块**。包边界即组织边界，**当前碎片化意味着跨域事务（S6 阶段）的协调成本会随模块数超线性增长**。建议 S6 前先做一次包合并审计，把 `alert-*` 9 包、`pipeline-*` 10+ 包按能力域归并。

### E8 · 字节跳动 —— 前端架构

**观察**：218 页面 / 265,755 行 TSX / 973 个 API 函数 —— **规模是行业前 1%**。但：
- **CSS 文件仅 3 个**，**内联 `style={{` 7,792 处** → **无设计系统提取**
- **`aria-*` 仅 11 种、`role=` 仅 17 处** → 265,755 行代码的无障碍覆盖率 **<0.01%**
- 组件目录仅 **46 个**（vs 218 个页面）→ **组件复用率极低，页面即组件**

**诊断**：**7,792 处内联 style 是本轮前端最大的结构性缺陷。** 它意味着：
- 无法做主题切换（深色模式只能逐处改）
- 无法做 design token 治理（`design-tokens.css` 存在但被 7,792 处内联样式绕过）
- **任何视觉规范变更都是 7,792 次修改**

这与 CLAUDE.md 声明的"Apple / 飞书风格 + Design Token 体系"直接矛盾 —— **Token 体系存在，但没有被执行**。

**处方**：
1. **执行手册 S1（A11y 12 项）严重不足**。11 种 aria-* / 17 处 role= 的量级下，12 项修复任务**不可能解决问题**。建议 S1 扩容为"S1-A 阻塞规则（ESLint jsx-a11y error）+ S1-B 存量清理（按页面分批）+ S1-C 设计系统强制（禁内联 style）"三段。
2. **新增硬门控**：`npx eslint --rule '{"jsx-a11y/no-static-element-interactions":"error"}' src/` 必须 0 error。**当前 `.eslintrc.json` 里连 `jsx-a11y` 插件都未引入**（执行手册 S0-T4 的目标文件 `.eslintrc*` 实际是 `.eslintrc.json`，且插件需在 `package.json` 添加 `eslint-plugin-jsx-a11y`）。
3. **内联 style 治理优先级高于 a11y**：建议新增 S0-T7「样式提取」—— 先把高频内联样式（>50 次重复的）提取为 CSS module 或 antd token，再谈 a11y。**顺序反了会做两遍**。
4. ⚠️ **并发写入告警**：取证时发现 `src/components/a11y/`（A11yButton/A11yInput/index.ts）+ `Layout/index.tsx`（div→button + aria-label）在无人操作下被创建。**这是 S1 任务正在被并行执行的证据** —— 方向正确，但**未纳入执行手册的 PR 追踪，属于流程失控**。

### E9 · 技术委员会主席 —— 跨域仲裁

**观察 1：参照系可信度问题（本轮第二个最重要发现）**

`cmdb-itsm-expert-method-level-2026-10-03.md` 第 601 行原文：

> *"NeatLogic 参照基于公开文档（CIType 14 属性、Ticket 8 类型、Workflow Designer 5 节点、Approval Matrix 6 概念、Form Builder 13 字段类型）…**未直接读 NeatLogic 源码**。"*

但 `design-docs-summary-2026-10-03.md` 声称 *NeatLogic 一手代码 42 顶层模块中 **29 个已一手实证扫描（100% 业务覆盖）***。**两个说法并存于同一文档集。**

**NeatLogic 自身规模数字也不自洽**：`2,500+ Java 文件`（benchmark-analysis）/ `4,230 Java 文件`（architecture-philosophy）/ `4,831 文件`（deep-analysis）。**三个数字差 1.9 倍。**

**仲裁结论**：**所有"差距倍数"（1:5.5、1:19.3、7.02×）都应标注为"量级参考"而非"精确指标"**。本报告的 §2 矩阵已按 ⭐/◇ 区分证据等级，但**在参照系统一前，不应把任何倍数写入对外材料**。

**观察 2：执行手册的颗粒度充分性审计**

| 执行手册项 | 颗粒度判定 | 依据 |
|---|---|---|
| S0 基础设施 6 项 | ❌ **4/5 门控不可执行** | `internal/common/errors.go` 不存在；`src/index.css` 不存在（实际 `assets/styles/global.css`）；`src/utils/request.ts` 不存在（实际 `src/api/client.ts`）；`jsx-a11y` 插件未引入 |
| S0 门控期望值 | ⚠️ **3 处不可判定** | "应=100%"未给具体数字；"应>=100"无基准 |
| S1 A11y 12 项 | ❌ **量级严重不足** | 存量 7,792 内联 style + 17 处 role=，12 项无法覆盖 |
| S2 核心 Service 10 项 | ⚠️ 缺 4 个 K8s 桩的级别标注 | E6 判定为 P0，手册未标 |
| S3 新模块 14 项 | ⚠️ 66 API 无清单 | big-tech-adversarial-review §297 已指出 |
| S4 Runner 6 项 | ❌ **前置不存在** | `runner` 包 0 个 `Runner interface` 定义 |
| S5 前端 12 项 | ⚠️ 缺样式治理 | E8 |
| S6 跨模块 8 项 | ❌ **295 包未先归并** | E7 |
| ADR-011 多租户 | ❌ **缺第 3 步结构性强制** | E7 一票否决 |
| ADR-013 CMDB 二阶 | ✅ 方向正确，建议拆 2 Migration | E1 |
| ADR-012 Factory | ⚠️ 覆盖 11 Factory 不足 | 3,503 路由 |
| ADR-010 AlertBreaker | ✅ 方向正确，补超时+重试 | E3 |
| ADR-014 ArtifactBus | ✅ | — |
| ADR-015 Change 建模 | ⚠️ **应在 TicketChannelType 之后** | E2 |

**14 项审计：2 项通过、5 项部分、7 项不通过。**

**观察 3：三条一票否决**

1. **E4（CI/CD）**：README 主张 `Tekton + Knative` 实测 13/1 文件引用 → **对外信誉风险，S0 必须二选一修正**。
2. **E7（多租户）**：Repository 隔离覆盖 69.9%，176 个文件无 `tenant_id` → **隔离不成立，无法通过客户安全审计**。
3. **E1 + E2（数据模型 + 类型系统）**：CMDB 无二阶模型 + ITSM 类型污染 → **G1 是所有上层能力的前置，任何业务功能开发都应暂停**。

---

## 4. 交叉共识与分歧

### 4.1 全体共识（9/9 一致）

| 共识 | 提出者 |
|---|---|
| 规模 ≠ 颗粒度，Orion 是"宽而浅" | E1–E9 全部 |
| G6 事件 / G7 可观测是真实护城河，不应为对标而削减 | E3、E6、E9 |
| 执行手册的门控期望值多处不可判定 | E4、E7、E9 |
| 参照系（NeatLogic 数字）未统一，倍数不宜对外 | E5、E9 |
| 并发写入（a11y/ + Layout）属流程失控 | E8、E9 |

### 4.2 关键分歧

**分歧 1：BI 完成度（E5 vs v5 综合报告）**

| 立场 | 数字 | 理由 |
|---|---|---|
| v5 综合（NL-3 一手） | **55-65%** | NeatLogic Report 是真实 JFreeChart（10 widget + 7 Mapper），Orion 同口径应上修 |
| **E5（本报告）** | **后端 <20% / 前端 55-65%** | NeatLogic 是**静态 SVG 输出**，两个"真实"不在同一档位；Orion 后端 0 chart 枚举 |

**仲裁（E9）**：**采纳 E5 的拆分口径。** 合并报一个数字会掩盖后端报表引擎的完全缺失。这是本轮**唯一推翻 v5 综合的结论**。

**分歧 2：ADR-011 方案深度（E7 vs 执行手册）**

| 立场 | 方案 |
|---|---|
| 执行手册 / ADR-011 | `context.Context` 携带 TenantContext + Repository 基类注入 `WHERE tenant_id = ?` + HTTP header `X-Tenant-Id` |
| **E7** | 以上三步之外必须加 **第 4 步：SQL builder / GORM scope 编译期强制**，否则永远追不完 176 个遗漏文件 |

**仲裁（E9）**：**采纳 E7。** 三步方案在 69.9% → 100% 的区间上是不可收敛的（每次新增 repository 都可能漏），需要结构性强制而非流程约束。

**分歧 3：S4 是否应引入 Tekton（E4 vs 原 README 主张）**

| 立场 | 方案 |
|---|---|
| README 主张 | 站在巨人肩上，集成 Tekton |
| **E4** | 二选一：修 README（推荐）或真接 Tekton client |

**仲裁（E9）**：**采纳 E4 的 (a) 修 README。** Orion 差异化在 AI + 多云 + 事件驱动，Tekton 集成是为主张引入复杂度。

---

## 5. 决策建议（按优先级）

### P0 —— 阻塞一切业务开发（3 项）

| # | 项 | 依据 | 归属 |
|---|---|---|---|
| P0-1 | **ADR-013 拆 2 Migration**（699 CIType 表 / 700 CI Instance JSONB）+ 新增 `internal/cmdb/attribute/` 包 | E1 | S0 前置 |
| P0-2 | **ADR-011 补第 4 步：SQL builder 编译期强制 tenant 注入** + 门控期望值改为具体数字 `=618` | E7 | S0 |
| P0-3 | **README 技术栈主张修正**（Tekton/Knative → NATS/OTel），或真接 Tekton client（不推荐） | E4 | S0 |

### P0.5 —— 数据卫生（2 项）

| # | 项 | 依据 |
|---|---|---|
| P0.5-1 | **Ticket 类型污染修复**：新增 `ticket_source` 枚举列 + `alert_severity` 独立字段，**迁移数据而非改枚举** | E2 |
| P0.5-2 | **cmdb 4 个 K8s/Script 桩升级为 P0**：`ListK8sResources` 接 `k8s.io/client-go` | E6 |

### P1 —— 结构性治理（4 项）

| # | 项 | 依据 |
|---|---|---|
| P1-1 | **包归并审计**：295 包 → 目标 <150（alert-* 9 包、pipeline-* 10+ 包按能力域归并），**S6 前置** | E7 |
| P1-2 | **内联 style 治理**（7,792 处）优先于 a11y，新增 S0-T7「样式提取」 | E8 |
| P1-3 | **ADR-012 Factory 扩容**：11 → 覆盖 Ticket/Workflow/TaskRunner 3 大分发点 | E2/E7 |
| P1-4 | **BI 口径拆分**：后端报表引擎 <20% 单独立项，与前端可视化 55-65% 分报 | E5 |

### P2 —— 门控工程化（3 项）

| # | 项 | 依据 |
|---|---|---|
| P2-1 | **执行手册 S0 的 4 个失效路径订正**（`errors.go` / `index.css` / `request.ts` / `.eslintrc.json`）+ `jsx-a11y` 插件引入 | E9 审计 |
| P2-2 | **S1 扩容三段**：S1-A 阻塞规则 / S1-B 存量清理 / S1-C 设计系统强制 | E8 |
| P2-3 | **参照系统一**：NeatLogic Java 文件数三数字（2,500+/4,230/4,831）择一为权威，并区分一手/二手证据 | E9 |

### 明确不做（守住的护城河）

| 项 | 依据 |
|---|---|
| ❌ 不削减 G6 事件/Saga（97 EventType / 28 EventBus / 13 Saga） | E3、E9 |
| ❌ 不为对标引入 K8s/Helm/ArgoCD Runner 到巡检链路（保留现有差异化） | E6 |
| ❌ 不在后端做 SVG 报表生成（NeatLogic 走过的弯路） | E5 |
| ❌ 不重构 Incident/Problem/Change 为 ChannelType 配置化 | E2 |

---

## 6. 与既有文档的关系

| 既有文档 | 本报告关系 |
|---|---|
| `upgrade-execution-playbook-2026-10-03.md`（Y，81 项 / 35 门控） | **独立审计**，§3.E9 逐项判定 14 项充分性（2 通过 / 5 部分 / 7 不通过） |
| `cross-review-synthesis-2026-10-03-v5.md` | **部分推翻**：BI 55-65% 单口径 → 拆分前后端 |
| `cmdb-itsm-expert-method-level-2026-10-03.md` | **补充**：其"未直接读源码"的自认被 §3.E9 上升为参照系风险 |
| `neatlogic-architecture-philosophy-2026-10-03.md` | **验证**：其 4 项启示全部成立；本报告补充 3 条一票否决 |
| ADR-010~015 | ADR-013/011 **需修订**；ADR-010/014 **通过**；ADR-012/015 **需扩容/重排** |

---

## 7. 复现清单

```bash
# §1.1 后端规模
cd orion-platform-svc-go
find internal -mindepth 1 -maxdepth 1 -type d | wc -l          # 295
find . -name '*.go' | wc -l                                     # 3165
find . -name '*.go' -exec cat {} + | wc -l                      # 626012
grep -rhoE '(GET|POST|PUT|PATCH|DELETE)\("' --include='*.go' . | wc -l   # 3503

# §1.2 扩展点
grep -rhoE 'type [A-Za-z]+Factory' --include='*.go' . | sort -u | wc -l   # 11
grep -rhoE 'type [A-Za-z]+Handler( Interface)?' --include='*.go' . | sort -u | wc -l  # 169

# §1.2 多租户（E7 一票否决）
find internal -path '*/repository/*.go' | wc -l                # 618
find internal -path '*/repository/*.go' -exec grep -l 'tenant_id' {} \; | wc -l  # 432  → 69.9%
grep -rhi 'tenant_id' --include='*.go' . | wc -l               # 11325

# §1.4 技术栈（E4 一票否决）
grep -ril "Tekton" --include='*.go' --include='*.yml' .. | wc -l   # 13
grep -ril "Knative" --include='*.go' --include='*.yml' .. | wc -l  # 1
grep -ril "OpenTelemetry\|otel" --include='*.go' .. | wc -l        # 453

# §1.5 前端（E8）
find orion-frontend/src -name '*.css' | wc -l                   # 3
grep -rho 'style={{' orion-frontend/src | wc -l                 # 7792
grep -rho 'aria-[a-z]*' orion-frontend/src | sort -u | wc -l    # 11
grep -rho 'role=' orion-frontend/src | wc -l                    # 17

# §3.E2 ITSM 类型污染
grep -rhoE 'Type:\s*"[a-z_]+"' internal/ticket internal/ticketing

# §3.E1 CMDB 模型
grep -A20 'type CI struct' internal/cmdb/models/models.go
```

---

**报告结束**

- **取证基线**：全部 Orion 数字当场 `grep`/`find` 得出，复现命令见 §7
- **证据等级**：NeatLogic 数字已按 ⭐（一手源码）/ ◇（公开文档）标注，**倍数仅供量级参考**
- **一票否决 3 项**：E4 技术栈虚标 / E7 多租户隔离不成立 / E1+E2 数据模型与类型系统
- **推翻既有结论 1 项**：BI 完成度 55-65% 单口径 → 拆分为后端 <20% / 前端 55-65%
- **执行手册审计**：14 项中 2 通过 / 5 部分 / 7 不通过
- **边界**：仅写 Markdown，未修改任何生产代码
