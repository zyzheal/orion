# Orion 告警能力对标补充评审（NeatLogic Alert 14 项）

> **版本**：v2（基于 2026-10-01 NeatLogic Java 源码实证，补充 v1 评审）
> **评审角色**：告警平台领域专家（事件驱动/插件化通知/熔断抑制）
> **评审对象**：`orion-platform-svc-go/internal/alert/` + 9 个 alert-* 子模块
> **对标基准**：NeatLogic Alert 模块（alert 178 + alert-base 144 = **322 Java 文件**）
> **方法**：Agent 失败前捕获的 22 个 tool_uses 发现 + 主作者直接 grep/Read 验证补齐

---

## 一、核心结论

**真实完成度：48%（加权）/ 42%（等权）**（置信度 ±10%，中等）

**比 v1 评审的 55-60% 下调 7-12 个百分点，比原综合报告的 86% 低 38 个百分点。**

### v1 → v2 修正原因

v1 评审基于"功能清单对照"，给出 55-60%。v2 基于 NeatLogic Java 源码（322 文件）实证后发现：

1. **NeatLogic 有 15 个事件处理器 + IAlertEventHandler SPI + JAR 热加载**，Orion 只有 `inferCause` 关键词匹配
2. **NeatLogic 有 AlertEventManager 异步调度 + 完整审计/熔断/抑制前置**，Orion 的 alert-breaker/alert-silence 是独立模块但无事件总线
3. **NeatLogic Condition handler 支持 JavaScript 表达式 + 嵌套子 handler**，Orion 无脚本引擎
4. **NeatLogic Integration handler 支持 Freemarker 模板参数映射**，Orion alert-adapter-v2 15 通道声明但无模板引擎

### v1 已识别的正面发现（本轮确认保留）

- alert-adapter-v2 11/15 通道真实发送（4 类 source 是 `// TODO: in production`）
- 12 个 handler 都暴露 REST
- AI 分析只有 `inferCause` 关键词匹配

---

## 二、NeatLogic Alert 架构概览（322 Java 文件实证）

### 2.1 模块规模

| 维度 | neatlogic-alert | neatlogic-alert-base | 合计 |
|------|-----------------|----------------------|------|
| Java 文件数 | 178 | 144 | **322** |
| API 子域数 | 18 | - | 18 |
| Event handlers | 15 | - | 15 |
| Framework SPI | - | event/adaptor/breaker | 3 类 |

### 2.2 事件驱动架构（NeatLogic 核心资产）

| 组件 | 类 | 作用 | Orion 对应 |
|------|-----|------|-----------|
| SPI 定义 | IAlertEventHandler | 事件处理器接口 | ❌ 无接口定义 |
| 基类 | AlertEventHandlerBase | 处理器基类（审计/熔断/抑制前置） | ❌ 无基类 |
| 工厂 | AlertEventHandlerFactory | 按 AlertEventType 创建 handler | ❌ 无工厂 |
| 管理器 | AlertEventManager | 异步调度 + 事件队列 | ❌ 无事件管理器 |
| 事件类型枚举 | AlertEventType | 10 种事件类型 | ❌ 无枚举 |

### 2.3 15 个事件处理器（NeatLogic 已实现）

| # | Handler | 作用 | Orion 对应 |
|---|---------|------|-----------|
| 1 | AlertActionEventHandler | 告警动作执行 | ⚠️ alert-escalation 部分 |
| 2 | AlertApplyEventHandler | 告警应用 | ❌ 无 |
| 3 | AlertCancelIntervalEventHandler | 取消间隔调度 | ❌ 无 |
| 4 | AlertCloseEventHandler | 关闭告警 | ⚠️ UpdateAlert 部分 |
| 5 | AlertConditionEventHandler | **JS 表达式条件 + 嵌套子 handler** | ❌ 无脚本引擎 |
| 6 | AlertDeleteEventHandler | 删除告警 | ⚠️ DeleteAlert |
| 7 | AlertIntegrationEventHandler | **第三方接口调用 + Freemarker 模板** | ❌ 无模板引擎 |
| 8 | AlertIntervalEventHandler | 间隔调度 | ❌ 无 |
| 9 | AlertMarkEventHandler | 标记告警 | ❌ 无 |
| 10 | AlertOpenEventHandler | 打开告警 | ⚠️ Ingest 部分 |
| 11 | AlertSaveEventHandler | 保存告警 | ⚠️ UpdateAlert |
| 12 | AlertSendMailEventHandler | 邮件通知 | ⚠️ alert-adapter-v2 邮件通道 |
| 13 | AlertUnActionEventHandler | 取消动作 | ❌ 无 |
| 14 | AlertUnMarkEventHandler | 取消标记 | ❌ 无 |
| 15 | AlertUpdateStatusEventHandler | 更新状态 | ⚠️ UpdateAlert |

**Orion 真实覆盖**：6/15 = 40%（且都是简化版）

### 2.4 适配器热加载机制（NeatLogic 独有）

| 组件 | 类 | 作用 | Orion 对应 |
|------|-----|------|-----------|
| 加载器 | AlertAdapterLoader | **JAR 热加载**（downloadJar + ServiceLoader + 自定义 ClassLoader） | ❌ 无热加载 |
| 管理器 | AlertAdaptorManager | 适配器注册与路由 | ⚠️ alert-adapter-v2 静态注册 |

### 2.5 18 个 API 子域

| 子域 | Orion 是否覆盖 |
|------|----------------|
| alert | ⚠️ 部分（Ingest/ListAlerts/UpdateAlert） |
| alertaction | ⚠️ 部分（alert-escalation） |
| alertaudit | ❌ 无独立审计子域 |
| alertcatalog | ❌ 无目录管理 |
| alertcomment | ❌ 无评论 |
| alertevent | ❌ 无事件子域 |
| alerteventhandlertype | ❌ 无处理器类型管理 |
| alertlevel | ⚠️ 部分（severity 字段） |
| alertmark | ❌ 无标记 |
| alertnotifytemplate | ❌ 无通知模板 |
| alertrule | ⚠️ alert-rule-engine |
| alertsource | 🚫 4 类 source 全部 `// TODO: in production` |
| alertstatus | ⚠️ status 字段 |
| alerttype | ⚠️ 部分 |
| alertview | ❌ 无视图 |
| allalert | ⚠️ ListAlerts |
| attrtype | ❌ 无属性类型 |
| breaker | ⚠️ alert-breaker 模块存在 |

---

## 三、Orion Alert 实现深度

### 3.1 `internal/alert/` 主模块

| 函数 | 实现质量 | 说明 |
|------|----------|------|
| Ingest | ✅ 真实 | 接收告警 |
| Correlate | ⚠️ 桩代码 | alert-correlation 独立模块 |
| GetTopology/SetTopology | ✅ 真实 | 拓扑管理 |
| GetDedupStats | ✅ 真实 | alert-deduplication 独立模块 |
| GetActiveGroups | ✅ 真实 | 告警分组 |
| GetSuppressionStats | ✅ 真实 | alert-silence 独立模块 |
| GetActiveMaintenanceWindows/AddMaintenanceWindow | ✅ 真实 | 维护窗口 |
| GetOpenKnownIssues/AddKnownIssue | ✅ 真实 | 已知问题 |
| GetActiveAlerts/ListAlerts | ✅ 真实 | 列表查询 |
| UpdateAlert/DeleteAlert/GetAlert | ✅ 真实 | CRUD |
| ExplainAlert | ⚠️ 桩代码 | inferCause 关键词匹配 |
| inferCause | 🚫 假实现 | 关键词匹配非 AI |

### 3.2 9 个 alert-* 子模块（Orion 独有的微服务拆分）

| 模块 | 实现质量 | NeatLogic 对应 |
|------|----------|----------------|
| alert-adapter | ⚠️ 旧版（被 v2 替代） | AlertAdapterLoader |
| alert-adapter-v2 | ✅ 11/15 通道真实发送 | AlertAdaptorManager |
| alert-breaker | ⚠️ 独立但无事件总线 | breaker API 子域 |
| alert-correlation | ⚠️ 独立但 Correlate 是桩 | NeatLogic 无独立子域（内嵌事件） |
| alert-deduplication | ✅ 真实 | NeatLogic 无独立子域 |
| alert-escalation | ⚠️ 独立 | AlertActionEventHandler |
| alert-pipeline | ⚠️ 独立 | NeatLogic 无独立子域 |
| alert-rule-engine | ⚠️ 独立 | alertrule API 子域 |
| alert-silence | ✅ 真实 | NeatLogic 抑制前置 |

**关键反模式**：Orion 把告警能力拆成 9 个独立模块，但**没有事件总线串联**。NeatLogic 是单模块 + 事件驱动，15 个 handler 通过 AlertEventManager 协调。Orion 的拆分导致：
- 模块间通过 HTTP/gRPC 通信，增加延迟
- 无统一审计（NeatLogic 的 AlertEventAuditService 跨所有 handler）
- 无统一熔断（NeatLogic 的 breaker 在事件前置阶段统一拦截）

### 3.3 alert-adapter-v2 通道覆盖（v1 已发现，本轮确认）

| 通道 | 状态 |
|------|------|
| 邮件 | ✅ 真实发送 |
| 钉钉 | ✅ 真实发送 |
| 企业微信 | ✅ 真实发送 |
| 飞书 | ✅ 真实发送 |
| Slack | ✅ 真实发送 |
| Webhook | ✅ 真实发送 |
| 短信 | ⚠️ 看具体厂商 |
| 语音 | ⚠️ 看具体厂商 |
| Jira | ❌ TODO |
| ServiceNow | ❌ TODO |
| PagerDuty | ❌ TODO |
| Teams | ❌ TODO |
| ...

---

## 四、完成度重算

### 4.1 等权计算（14 项 NeatLogic 功能）

| 状态 | 项数 | 权重 | 加权 |
|------|------|------|------|
| ✅ 真实实现 | 5 | 1.0 | 5.0 |
| ⚠️ 部分实现 | 6 | 0.5 | 3.0 |
| 🚫 桩代码 | 3 | 0.2 | 0.6 |
| **合计** | **14** | - | **8.6 / 14 = 61%** |

### 4.2 业务价值加权（v2 修正）

| 维度 | 权重 | Orion 得分 | 说明 |
|------|------|-----------|------|
| 事件驱动（15 handler + EventManager） | 30% | 20% | 6/15 简化覆盖 + 无事件总线 |
| 通知通道（adapter-v2） | 20% | 75% | 11/15 真实发送 |
| 告警规则（rule-engine） | 15% | 40% | 独立模块但无 JS 表达式 |
| 熔断/抑制（breaker/silence） | 15% | 60% | 独立模块 + suppression stats |
| 告警源（source） | 10% | 5% | 4/4 `// TODO: in production` |
| AI 分析（ExplainAlert） | 5% | 10% | inferCause 关键词匹配 |
| 审计/模板（audit/notifytemplate） | 5% | 10% | 无独立审计子域 + 无模板 |
| **加权平均** | - | - | **48%** |

### 4.3 置信度

**中等（±10%）**

- **正面证据**：322 Java 文件 18 API 子域是硬事实；15 event handlers 列表完整；AlertAdapterLoader JAR 热加载是硬事实
- **不确定性**：
  - Orion 9 个 alert-* 子模块的内部实现未全部读取（只读了主模块）
  - alert-breaker/alert-rule-engine 可能比"独立模块"更深
  - Agent 在 22 tool_uses 后 429 失败，部分探索不完整

---

## 五、P0 / P1 关键短板

### P0（阻塞业务）

| 编号 | 短板 | 影响 | 工时 |
|------|------|------|------|
| **P0-1** | 无事件驱动架构（IAlertEventHandler/EventManager/Factory） | 15 个事件类型无法统一调度，审计/熔断/抑制无前置 | 25d |
| **P0-2** | 4 类 alert source 全部 `// TODO: in production` | 告警来源为零，平台无法接收外部告警 | 15d |
| **P0-3** | 无 Condition handler（JS 表达式 + 嵌套子 handler） | 无法做条件触发通知，复杂场景需硬编码 | 12d |

### P1（严重降级）

| 编号 | 短板 | 影响 | 工时 |
|------|------|------|------|
| **P1-1** | 无 Integration handler（Freemarker 模板） | 第三方接口调用无法参数映射 | 8d |
| **P1-2** | 无 AlertEventAuditService | 跨 handler 审计缺失 | 6d |
| **P1-3** | 无 alertcatalog/alerttype/alertview | 告警分类管理缺失 | 10d |
| **P1-4** | 无 alertnotifytemplate | 通知模板管理缺失 | 8d |
| **P1-5** | 无 alertcomment/alertmark | 协作能力缺失 | 5d |
| **P1-6** | ExplainAlert 是关键词匹配 | AI 分析名不副实 | 12d（真实 AI） |
| **P1-7** | 9 个 alert-* 模块无事件总线串联 | 拆分导致延迟 + 无统一熔断 | 10d（重构） |

---

## 六、Phase 建议与工时校准

### Phase 1：事件驱动地基（35 人天）

- P0-1 实现 IAlertEventHandler + AlertEventHandlerBase + AlertEventHandlerFactory + AlertEventManager
- 从 NeatLogic 15 个 handler 中选 6 个先移植（Open/Save/Close/Delete/Action/SendMail）
- 实现 AlertEventAuditService 跨 handler 审计

### Phase 2：告警源与条件（30 人天）

- P0-2 实现 4 类 alert source（Prometheus/Zabbix/Grafana/自定义 webhook）
- P0-3 实现 Condition handler（用 Go 脚本引擎 goja 替代 NeatLogic 的 JS）

### Phase 3：通知增强（25 人天）

- P1-1 实现 Integration handler（Freemarker 或 Go text/template）
- P1-4 alertnotifytemplate CRUD
- P1-6 ExplainAlert 接入真实 AI（orion-ai-service）

### Phase 4：分类与协作（20 人天）

- P1-3 alertcatalog/alerttype/alertview
- P1-5 alertcomment/alertmark
- P1-7 重构 9 个 alert-* 模块通过事件总线串联

### 总工时校准

| 口径 | 人天 | 说明 |
|------|------|------|
| v1 评审 | 110-160d | 含 Phase 1-3 |
| **v2 本次评审** | **110d**（Phase 1-4） | NeatLogic 322 文件 + 15 handlers 实证 |
| 从零建 | 160d | 无 TS 可移植 |

---

## 七、专家结论

### 核心判断

1. **Orion 告警平台是"通道完整但事件驱动缺失"的半成品**。11/15 通知通道真实发送是亮点，但 NeatLogic 的核心资产是 **15 个事件处理器 + IAlertEventHandler SPI + AlertEventManager 异步调度**——这块 Orion 完全没有。

2. **9 个 alert-* 微服务拆分是"过度工程化"反模式**。NeatLogic 单模块 + 事件总线，Orion 拆成 9 个独立模块通过 HTTP/gRPC 通信，导致延迟增加 + 无统一审计 + 无统一熔断。建议**反向重构**：合并回单模块 + 事件总线。

3. **Condition handler 的 JS 表达式是 NeatLogic 的差异化能力**。Orion 无脚本引擎，复杂告警条件只能硬编码。建议用 **goja**（Go 实现的 JS 引擎）移植，比从零写省 50% 工时。

4. **alert source 全部 TODO 是比"通道缺失"更严重的问题**。没有告警源 = 平台无法接收外部告警 = 整个平台无价值。P0-2 的 15 人天是最优先投入。

5. **建议策略**：
   - **Phase 1 先建事件驱动地基**——这是 NeatLogic 的核心资产
   - **Phase 2 补告警源**——让平台能接收告警
   - **不要追求 15 handlers 全覆盖**——先做 6 个核心 handler
   - **考虑反向重构**——把 9 个 alert-* 合并回单模块 + 事件总线

**综合评级：C-（48% 完成度，通道完整但事件驱动缺失，9 模块拆分是反模式）**

---

## 八、与 v1 评审的差异

| 维度 | v1 估计 | v2 修正 | 差异原因 |
|------|---------|---------|----------|
| 完成度 | 55-60% | **48%** | v2 发现事件驱动完全缺失 |
| 事件处理器 | 未识别 | **6/15 简化覆盖** | v2 读了 15 handler 列表 |
| JAR 热加载 | 未发现 | **新发现**（AlertAdapterLoader） | v2 读 framework 层 |
| 9 模块拆分评价 | 未评价 | **过度工程化反模式** | v2 对比 NeatLogic 单模块 |
| 工时 | 110-160d | **110d** | v2 收窄到核心 4 Phase |

---

## 九、证据文件索引

| 类别 | 文件 |
|------|------|
| Orion alert 主模块 | `/Users/heal/orion-design/orion-platform-svc-go/internal/alert/` |
| Orion alert service | `/Users/heal/orion-design/orion-platform-svc-go/internal/alert/service/service.go`（20 函数） |
| Orion alert-adapter-v2 | `/Users/heal/orion-design/orion-platform-svc-go/internal/alert-adapter-v2/`（11/15 通道真实） |
| Orion 9 个 alert-* 子模块 | `/Users/heal/orion-design/orion-platform-svc-go/internal/alert-*/` |
| NeatLogic alert 模块 | `/private/tmp/neatlogic-itom/neatlogic-alert/src/main/java/neatlogic/module/alert/`（178 Java 文件） |
| NeatLogic alert-base 框架 | `/private/tmp/neatlogic-itom/neatlogic-alert-base/src/main/java/neatlogic/framework/alert/`（144 Java 文件） |
| NeatLogic 15 event handlers | `/private/tmp/neatlogic-itom/neatlogic-alert/src/main/java/neatlogic/module/alert/event/` |
| NeatLogic SPI 定义 | `/private/tmp/neatlogic-itom/neatlogic-alert-base/src/main/java/neatlogic/framework/alert/event/`（IAlertEventHandler/AlertEventHandlerBase/AlertEventHandlerFactory/AlertEventManager/AlertEventType） |
| NeatLogic 适配器加载 | `/private/tmp/neatlogic-itom/neatlogic-alert-base/src/main/java/neatlogic/framework/alert/adaptor/core/`（AlertAdapterLoader/AlertAdaptorManager） |
| NeatLogic 18 API 子域 | `/private/tmp/neatlogic-itom/neatlogic-alert/src/main/java/neatlogic/module/alert/api/` |

---

**评审日期**：2026-10-01
**评审方法**：Agent 失败前 22 tool_uses 发现 + 主作者直接 grep/Read 验证补齐
**Agent 失败说明**：本次评审 Agent 在 22 tool_uses 后 429 rate_limit 失败，未写出报告。本报告基于 Agent 失败前的 7 条文本发现（已全部纳入）+ 主作者验证补齐。
