# 工单模块 (Ticketing) 深度评审报告

> 评审视角: 资深产品经理 + 技术专家
> 生成日期: 2026-05-11
> 模块路径: `orion-platform-service/src/services/ticketing/`

---

## 模块概览

工单模块是整个 Orion 系统中**代码量最大、功能最完整**的子模块之一。

| 指标 | 数值 |
|------|------|
| 核心服务文件 | 12 个 |
| 控制器文件 | 1 个 (1884 行) |
| 类型定义 | 1024 行 |
| 测试文件 | 12 个，5684 行 |
| 数据库迁移 | 2 个 (038, 061) |
| API 端点 | 45+ 个 |
| 代码总量 | ~12000 行 (含测试) |

---

## 功能矩阵

### 已实现功能

| 功能域 | 子功能 | 状态 |
|--------|--------|------|
| **工单 CRUD** | 创建、查询、列表、删除 | ✅ 完整 |
| **来源集成** | 告警自动转工单、事件转工单、手动创建 | ✅ 完整 |
| **工作流** | 状态机 (open→assigned→in-progress→resolved→closed) | ✅ 完整 |
| **SLA 管理** | SLA 目标配置、合规报告、 breached 检测 | ✅ 完整 |
| **智能派单** | 自动派单 (DispatchEngine)、手动派单、工程师注册 | ✅ 完整 |
| **派单算法** | 多维度评分 (专业度/负载/可用率/成功率/SLA紧急度) | ✅ 完整 |
| **负载均衡** | 负载报告、重新分配建议 | ✅ 完整 |
| **工单关联** | 重复/引起/阻塞/相关、根因关联分析 | ✅ 完整 |
| **工单转移** | 工程师间转单、hold 机制、转移历史 | ✅ 完整 |
| **工程师休假** | 请假/病假/培训/离线、自动重分配、SLA 暂停 | ✅ 完整 |
| **BI 分析** | 高管看板、经理看板、个人看板、效率评分、周期对比 | ✅ 完整 |
| **数据导出** | 按数据集导出 (tickets/sla/dispatch/efficiency) | ✅ 完整 |
| **MCP 工具** | ticket-tools.ts (AI Agent 可调用) | ✅ 完整 |
| **多租户** | tenant_id 隔离 | ✅ 完整 |

---

## 产品经理视角评审

### 优势

1. **功能覆盖面广**: 从工单创建到 BI 分析的全链路覆盖，对标 Jira Service Management + PagerDuty
2. **智能派单设计优秀**: 多维度评分算法考虑了专业匹配度、当前负载、可用率、历史成功率，这是企业级产品的标准能力
3. **工程师休假管理**: 支持请假/病假/培训/离线等多种场景，且能自动重分配和暂停 SLA，这在同类产品中很少见
4. **BI 分层设计**: 高管/经理/个人三层看板，满足不同角色的数据需求
5. **MCP 工具集成**: AI Agent 可通过 MCP 调用工单工具，这是面向 AI 时代的设计

### 产品缺口

| # | 缺口 | 严重性 | 说明 |
|---|------|--------|------|
| P1 | **缺少客户门户** | 🔴 | 工单系统通常需要外部客户提交工单的入口，当前仅支持内部创建 |
| P2 | **缺少 SLA 实时倒计时 UI** | ⚠️ | API 提供 SLA 数据，但前端无实时倒计时展示 |
| P3 | **缺少工单模板** | ⚠️ | 不同类型工单 (基础设施/数据库/安全) 应有不同字段模板 |
| P4 | **缺少工单评论/协作** | ⚠️ | 无工单内评论、@提及、内部笔记功能 |
| P5 | **缺少满意度评价** | ⚠️ | 工单关闭后无 CSAT (Customer Satisfaction) 评价 |
| P6 | **缺少工单自动化规则** | ⚠️ | 无"当 X 发生时自动执行 Y"的 if-this-then-that 规则引擎 |
| P7 | **缺少工单标签自动分类** | ⚠️ | 虽然 AI Service 有 placeholder，但工单创建时未对接 AI 自动分类 |
| P8 | **缺少工单附件支持** | ⚠️ | 无法上传截图、日志文件等附件 |
| P9 | **缺少工单订阅/通知** | ⚠️ | 工单状态变更时无邮件/IM 通知订阅机制 |
| P10 | **缺少工单时间追踪** | 💡 | 无工时记录功能，无法统计处理每个工单的实际耗时 |

---

## 技术专家视角评审

### 优势

1. **架构清晰**: `TicketService` (编排器) → 多个专业子服务 (DispatchEngine, TicketBIService, TicketWorkflowService 等)
2. **数据库设计完善**: 6 张核心表 (workflow_history, sla, dispatch_queue, engineer_load, assignments, relations, transfers, suspensions)，索引覆盖查询场景
3. **测试覆盖率高**: 5684 行测试代码 vs 5813 行业务代码，比例接近 1:1，在同类系统中属于优秀水平
4. **类型定义完整**: 50+ 种 TypeScript 类型，涵盖工单、派单、SLA、BI 等所有领域模型

### 技术缺口

| # | 缺口 | 严重性 | 文件/行 | 说明 |
|---|------|--------|---------|------|
| T1 | **双重 Service 并存** | 🔴 | `TicketService.ts` vs `TicketingService.ts` | 两套 Service 功能重叠，`TicketingService` 仅 82 行但被 Controller 直接调用，职责不清 |
| T2 | **Controller 1884 行** | 🔴 | `TicketingController.ts` | 45+ 个端点集中在一个文件，违反单一职责，应拆分为 TicketController / DispatchController / BIController / SuspendController |
| T3 | **TicketBIService 1840 行** | ⚠️ | `TicketBIService.ts` | BI 服务过于庞大，应拆分为 DashboardService / ExportService / TrendService |
| T4 | **NATS 事件未持久化** | ⚠️ | `TicketService.ts` | 工单事件发布到 NATS 但无 JetStream ack，事件丢失后无法恢复 |
| T5 | **内存上限 10 万工单** | ⚠️ | `TicketService.ts:74` | `maxTicketsInMemory: 100000`，超出后无淘汰策略 |
| T6 | **AssignmentRule 存储不一致** | ⚠️ | `TicketService.ts` vs migration 061 | 代码中使用内存 Map 存储 AssignmentRule，但数据库有 dispatch_rules 表，未使用 Repository 模式 |
| T7 | **SLA 检测依赖定时轮询** | ⚠️ | `DEFAULT_CONFIG.escalationCheckIntervalMs = 5min` | 5 分钟轮询间隔意味着 SLA breached 最多延迟 5 分钟才被检测 |
| T8 | **缺少分布式锁** | ⚠️ | `TicketService.ts` | 工单状态转移、派单等并发操作无分布式锁保护 |
| T9 | **BI 计算在内存中完成** | ⚠️ | `TicketBIService.ts` | 效率评分、趋势分析等全部在内存中计算，数据量大时应下推到 ClickHouse/PostgreSQL |
| T10 | **缺少软删除** | 💡 | `tickets` 表 | 工单删除为物理删除，企业系统通常需要软删除 + 回收站 |
| T11 | **日期解析无时区处理** | 💡 | Controller 中 `new Date(query.periodStart)` | 多租户场景下时区不一致会导致报表数据偏差 |
| T12 | **错误码不统一** | 💡 | Controller | 使用字符串硬编码 (`VALIDATION_ERROR`, `CREATE_ERROR` 等)，无统一错误码枚举 |

---

## 数据库评审

### 表设计评价

| 表名 | 字段数 | 索引数 | 评价 |
|------|--------|--------|------|
| ticket_workflow_history | 7 | 2 | ✅ 简洁完整 |
| ticket_sla | 10 | 1 | ⚠️ 缺少 breached_at 时间戳 |
| dispatch_queue | 6 | 1 | ✅ 设计合理 |
| engineer_load | 6 | 1 | ⚠️ 缺少历史负载记录 |
| ticket_assignments | 7 | 2 | ✅ 完整 |
| ticket_relations | 8 | 3 | ✅ 完整，有 CHECK 约束防止自关联 |
| dispatch_rules | 7 | 2 | ✅ JSONB 存储条件灵活 |
| ticket_transfers | 10 | 4 | ✅ 完整 |
| engineer_suspensions | 12 | 待确认 | ✅ 设计完善 |

### 数据库缺口

| # | 缺口 | 说明 |
|---|------|------|
| D1 | **缺少 comments 表** | 工单评论/协作无存储表 |
| D2 | **缺少 attachments 表** | 工单附件无存储表 |
| D3 | **缺少 templates 表** | 工单模板无存储表 |
| D4 | **缺少 tags 表** | 标签存在 tags 字段但无独立表，无法做标签统计 |
| D5 | **缺少 satisfaction 表** | 满意度评价无存储表 |
| D6 | **缺少 audit_log 表** | 工单操作审计日志无独立表 |

---

## 测试评审

### 测试覆盖矩阵

| 模块 | 测试行数 | 覆盖度 | 评价 |
|------|---------|--------|------|
| TicketService | 662 | 良好 | CRUD、工作流、SLA、派单均有覆盖 |
| TicketBIService | 1319 | 优秀 | 看板、导出、趋势分析全覆盖 |
| TicketWorkflowService | 250 | 一般 | 仅覆盖基本状态转移 |
| TicketTransferService | 659 | 优秀 | 转单全流程覆盖 |
| EngineerSuspendService | 385 | 良好 | 休假创建/激活/结束覆盖 |
| DispatchEngine | 243 | 一般 | 仅覆盖自动派单基本路径 |
| DispatchQueueManager | 375 | 良好 | 队列管理覆盖 |
| DispatchAnalytics | 397 | 良好 | 指标计算覆盖 |
| LoadBalancer | 222 | 一般 | 负载均衡基本路径 |
| TicketRelationAnalyzer | 447 | 良好 | 关联分析覆盖 |
| TicketReportService | 452 | 良好 | 报表生成覆盖 |
| TicketGenerator | 273 | 一般 | 工单生成基本路径 |

### 测试缺口

| # | 缺口 | 说明 |
|---|------|------|
| S1 | **无集成测试** | 全部为单元测试，无 API 端到端测试 |
| S2 | **无并发测试** | 未测试工单状态转移的并发安全性 |
| S3 | **无性能测试** | 未测试 10 万工单场景下的查询性能 |
| S4 | **无错误注入测试** | 未测试 NATS 断连、数据库超时等异常场景 |

---

## 前端集成评审

### 前端文件

| 文件 | 行数 | 功能 |
|------|------|------|
| `orion-frontend/src/pages/TicketManagement/` | 待确认 | 工单管理页面 |
| `orion-frontend/src/api/ticket*.ts` | 95+ API 文件中的工单相关 | API 客户端 |

### 前端缺口

| # | 缺口 | 说明 |
|---|------|------|
| F1 | **无工单可视化编辑器** | 工单创建为表单形式，无引导式向导 |
| F2 | **无工单看板视图** | 仅表格视图，无 Kanban 拖拽 |
| F3 | **无实时协作** | 工单编辑无 WebSocket 实时同步 |
| F4 | **无工单时间线** | 工单详情页无可视化时间线展示流转过程 |

---

## 优先级修复建议

### P0 (必须立即修复)

1. **T1: 统一双重 Service** — 明确 `TicketService` 和 `TicketingService` 的职责边界，合并或拆分
2. **T2: 拆分 Controller** — 1884 行拆分为 4 个 Controller (Ticket / Dispatch / BI / Suspend)

### P1 (重要)

3. **T6: 统一 AssignmentRule 存储** — 内存 Map 迁移到 PostgreSQL Repository
4. **T9: BI 计算下推** — 效率评分、趋势分析等迁移到 ClickHouse 或 PostgreSQL 聚合查询
5. **T4: NATS JetStream ack** — 工单事件使用 JetStream 确保不丢失
6. **P1: 客户门户** — 外部客户提交工单入口

### P2 (应该修复)

7. **T5: 内存淘汰策略** — 10 万工单上限后使用 LRU 淘汰
8. **T8: 分布式锁** — 工单状态转移和派单加锁
9. **D1-D6: 补充数据库表** — comments、attachments、templates、tags、satisfaction、audit_log
10. **S1-S4: 补充测试** — 集成测试、并发测试、性能测试、错误注入测试

### P3 (建议)

11. **P3-P10: 产品功能补充** — 工单模板、评论协作、满意度评价等
12. **F1-F4: 前端交互优化** — 看板视图、时间线、实时协作

---

## 综合评价

| 维度 | 评分 (1-10) | 说明 |
|------|-------------|------|
| 功能完整性 | 8.5/10 | 核心功能齐全，缺少客户门户和协作功能 |
| 代码质量 | 7.5/10 | 架构清晰但 Controller 和 BI Service 过于庞大 |
| 数据库设计 | 8/10 | 表设计完善但缺少评论/附件表 |
| 测试覆盖 | 8.5/10 | 单元测试优秀但缺少集成/并发/性能测试 |
| 可扩展性 | 7/10 | 内存计算和存储限制影响大规模使用 |
| 安全性 | 7.5/10 | 多租户隔离完整但缺少分布式锁 |
| **综合评分** | **7.8/10** | Orion 系统中完成度最高的模块之一 |

**结论**: 工单模块是 Orion 系统中**最成熟的模块**，功能覆盖面广，测试覆盖率高，数据库设计完善。主要改进方向是架构瘦身 (Controller/Service 拆分)、存储层统一 (内存→PostgreSQL)、以及产品功能补充 (客户门户/协作/模板)。
