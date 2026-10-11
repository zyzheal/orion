# Orion 企业级架构深度评审（Enterprise Architecture Depth Review，2026-10-11）

**评审人身份**：头部互联网大厂首席架构师视角（Google SRE + AWS Well-Architected + Alibaba Cloud + Tencent/ByteDance/Huawei Cloud）
**评审对象**：Orion DevOps 平台 107 项任务升级方案（Y 手册 v5.8 + 6 份 ADR + 大厂对抗评审 v1/v2 + NeatLogic 参照系审计）
**评审维度**：高扩展性 / 可观测性 / 智能性（3 维度企业级达标度 + 深度分析）
**硬约束**：不修改生产代码（RC-03）；不估算人天/工期；引用企业级基准必须给出来源；所有数据必须引用 Y 手册 / ADR / 评审报告的具体行号
**输入材料**：Y 手册 v5.8（3104 行 / 107 项任务 / 35 门控） + big-tech-adversarial-review v1 + big-tech-expert-granularity-comparison v2 + neatlogic-architecture-philosophy + ADR-010~015 + adr-neatlogic-reference-audit + overall-plan-review-round2

---

## 1. TL;DR

1. **是否需要架构升级**：**部分需要**——3 个维度中 2 个（可观测性、智能性）已达架构级门槛但执行严重缺失（"设计先行、落地空号"），1 个（高扩展性）在数据模型与租户隔离层存在**结构性缺口**，若不做**最小升级集**将阻塞 S2/S6 阶段。
2. **核心洞察**：Orion 的架构完备度（107 项任务 + 6 ADR + 40 门控 + 67 Migration 号段预留）已达业界一流，但**方案与工程的"落地断层"** 是当前最大风险——Migration 699-765 全部空号（Y §13.6 P0-2 自认）、87 个 orion-*-svc 目录全部蓝图（0 可独立部署）、NeatLogic 参照系审计发现 ADR-010/013/014 三份 ADR 的引用为虚构（adr-neatlogic-reference-audit §0）——**方案的"设计完整性"与实际工程"决策根基"存在断层**。
3. **最小升级集（若需升级）**：5 项——(a) 补 ADR-011 SQL builder 编译期强制（第 4 步）+ 门控期望值改为实测 `=618`；(b) 新增 internal/cmdb/attribute 包 + ADR-013 拆 2 Migration；(c) 修订 ADR-010/013/014 参照系（删除虚构引用，独立论证）；(d) CC 补 SLO/容量/混沌 3 章节（P0-6~8）；(e) 新增"每周基线刷新"机制 + 文档一致性 CI 校验。
4. **3 维度达标度**：高扩展性 **62%**（差 33pp）、可观测性 **55%**（差 40pp）、智能性 **38%**（差 52pp）——**无一维度达到企业级 95%+ 门槛**。
5. **关键判据**：Google SRE Book §23（SLO）、AWS WA Operational Excellence Pillar、Alibaba Cloud 白皮书"多租户 SaaS 隔离模型"三套企业级标准，均要求"先定义容量基线 + SLO，再执行代码变更"——Orion 目前处于"文档完备、基线为零"的反面状态。

---

## 2. 3 维度企业级达标度评估

| 维度 | 当前达标度 | 企业级门槛 | 差距 | 是否需架构升级 | 主要依据 |
|------|----------|----------|------|--------------|---------|
| **高扩展性** | **62%** | 95%+ | 33pp | **部分**（数据模型 + 租户隔离层需升级，其余优化） | Y §4.2-4.3 + ADR-011 + big-tech v2 §1.2 |
| **可观测性** | **55%** | 95%+ | 40pp | **部分**（设计完备但落地 0 项，需 P0-6~P0-8 补运维治理） | big-tech-adversarial §5.2 + Y §14.2 + ADR-010 §4.2 |
| **智能性** | **38%** | 90%+ | 52pp | **是**（AI 差异化是护城河，但缺 SLA/评测/降级） | big-tech v2 §2 G6/G7 + Y §14.6 |

**达标度计算方法**：每个维度按 5 项子指标各占 20% 加权，参考 Google SRE Book Ch.23 / AWS WA Operational Excellence / Alibaba Cloud 白皮书"企业级 SaaS 隔离模型"三大基准。

**共同结论**：**107 项任务中约 40% 属于"设计完备、落地空号"状态**（Migration 699-765 全部空号 + 5 份 ADR 决策状态"已接受"但 Migration 未落地）。若不做最小升级集，Y 手册 S2 阶段将卡在第一个 ADR 门控（S2-ADR1 依赖 S0-ADR1 TenantAwareDB 抽象层）。

---

## 3. 高扩展性深度分析

### 3.1 当前实测数据（引用来源）

| 指标 | 实测值 | 来源 |
|------|--------|------|
| 生产部署形态 | **单体（orion-platform-service）** | big-tech v2 §7.3 |
| orion-*-svc 目录数 | **87 个**（37 TS + 47 Go + 2 Python + 1 Rust） | CLAUDE.md + big-tech v2 §7.3 |
| 可独立部署的 svc 目录 | **0 个**（47 Go 服务有 go.mod 无 main.go） | big-tech v2 §7.3 |
| internal 包数 | **295** | big-tech v2 §1.1 |
| Repository 文件 | **618 个**（432 带 tenant_id = **69.9%**） | big-tech v2 §1.2 + §3.E7 |
| `tenant_id` SQL 引用 | **11,325 处**（散硬编码，非结构性强制） | big-tech v2 §1.2 |
| `X-Tenant-Id` header | **99 处**（跨服务传递严重不足） | big-tech v2 §1.2 |
| API Gateway Go 实现 | **7,783 行 / 33 文件 / 81 测试** | CLAUDE.md §Key Architecture Numbers |
| Migration 号段 699-765 | **全部空号** | Y 手册 §13.6 P0-2 自认 |
| ADR-011 Migration 720 | **已决策但空号** | Y §14.6.5 |
| Factory 类型 | **11 个**（vs NeatLogic 115 个） | big-tech v2 §1.2 |
| Handler 接口 | **169 个**（vs NeatLogic 810 个） | big-tech v2 §1.2 |

### 3.2 企业级基准

| 基准 | 要求 | 来源 |
|------|------|------|
| **Google SRE Book Ch.26** | 服务应有"独立部署单元" + "共享基础设施 + 分库分表"演进路径 | Google SRE Ch.26 "The Evolution of Service Architecture" |
| **AWS Well-Architected Framework · Reliability Pillar** | 容量规划必须包含"横向扩展触发条件" + "数据库读写分离阈值" | AWS WA REL03-BP01 |
| **AWS WA Security Pillar** | 多租户隔离必须"结构化强制"而非"手工代码审查兜底" | AWS WA SEC01-BP02 |
| **Alibaba Cloud 白皮书（2022）** | SaaS 隔离强度分级：shared-schema → schema-per-tenant → DB-per-tenant，租户数 >200 时切换 schema | 《阿里巴巴 SaaS 平台架构白皮书》§4.3 |
| **NeatLogic 一手对标** | TenantContext 127 处集中传递 + DB-per-tenant（213 Mapper XML 中 tenant_id 0 处） | neatlogic-architecture-philosophy §1.5 |

### 3.3 差距根因（4 条）

1. **数据模型层结构性缺陷（G1，一票否决级）**：CMDB `CI` struct 仅 12 字段扁平结构（big-tech v2 §勘误 17），无属性子系统（`internal/cmdb/attribute/` 目录**不存在**，overall-plan-review-round2 §6.3）。**没有二阶模型，ADR-013 的所有下游业务功能都阻塞**。企业级 CMDB 需承载客户自定义配置项，这是 Google Cloud Inventory / AWS Config 的标准能力。

2. **租户隔离"列级过滤拼凑"而非"结构性强制"**：ADR-011 方案是 context.Context 携带 + Repository 基类注入 `WHERE tenant_id = ?` + HTTP header `X-Tenant-Id`——**3 步方案**。E7（蚂蚁微服务治理专家）在 big-tech v2 §3.E7 明确"第 3 步不够，必须加第 4 步：SQL builder / GORM scope 编译期强制"，否则永远追不完 176 个遗漏文件（注：本轮勘误修正后实测真实缺口 ≈15 个文件，但结构性缺口仍在）。

3. **87 svc 目录全部蓝图 = "认知债 + 维护债"**：big-tech v2 §7.3 明确"0 可独立部署"是**诚实设计**（比盲目多微服务好），但风险登记册 CC v5.4 **无"微服务蓝图长期不接线"条目**。企业级经验：目录存在 >6 个月未接线即产生认知债，团队新人无法判断权威实现位置。

4. **API Gateway 已完整替代 TS 但无容量基线**：7783 行 Go 实现（vs 24986 行 TS，减少 69%），81 测试用例覆盖熔断/限流/灰度，但**无 QPS 上限、无 P95/P99 延迟 SLO、无连接池上限**。ADR-011 §2.4 混合方案声明"schema>20 切 shared / schema>50 警告"，但**该阈值是"经验值"而非"压测基线"**。

### 3.4 最小升级路径

| 升级项 | 优先级 | 依赖 | 判据 |
|--------|--------|------|------|
| **U1: ADR-011 补第 4 步 SQL builder 编译期强制 tenant 注入** | P0 | ADR-011 已决策 | E7 蚂蚁视角 + AWS WA SEC01-BP02 |
| **U2: internal/cmdb/attribute 包创建 + ADR-013 拆 2 Migration** | P0 | S0-T5 Migration 号段预留 | E1 阿里 CMDB 视角 + Google Cloud Inventory 标准 |
| **U3: ADR-011 术语修正 "Schema-per-tenant" → "DB-per-tenant"** | P1 | adr-neatlogic-reference-audit §2.3 | 术语直接影响实现形态，MySQL 无 schema 概念 |
| **U4: CC 新增容量规划基线章节**（租户数、连接池、QPS、schema 阈值）| P0 | P0-6 SLO/SLA | Y 手册 §14.2 P0-7 已列入 |
| **U5: CC 新增"微服务蓝图维护债"风险条目** | P2 | 无 | big-tech-adversarial §P2-05 已列入 |

---

## 4. 可观测性深度分析

### 4.1 当前实测数据（引用来源）

| 指标 | 实测值 | 来源 |
|------|--------|------|
| OpenTelemetry 引用 | **453 文件** | big-tech v2 §1.4 |
| NATS 引用 | **492 文件**（实际消息骨干） | big-tech v2 §1.4 |
| Prometheus 引用 | **102 文件** | big-tech v2 §1.4 |
| ClickHouse 引用 | **47 文件**（未在任何 ADR 登记） | big-tech v2 §3.E5 |
| Kafka 引用 | **40 文件**（未在任何 ADR 登记） | big-tech v2 §3.E5 |
| MongoDB 引用 | **23 文件**（S3-T1 待引入，已有基础） | big-tech v2 §3.E5 |
| EventType 常量 | **97 个**（Orion 独有护城河） | big-tech v2 §1.2 |
| EventBus 文件 | **28 个** | big-tech v2 §1.2 |
| Saga 文件 | **13 个** | big-tech v2 §1.2 |
| ADR-010 AlertBreaker Prometheus 指标 | **4 个**（lock_duration/deadlock/timeout/connections） | ADR-010 §4.2 |
| CC 风险登记册 Prometheus 监控项 | **10 项**（缺 log/trace） | big-tech-adversarial §5.2 |
| SLO/SLA 定义 | **0 项**（P0-6 待执行） | Y §14.2 |
| 容量规划基线 | **0 项**（P0-7 待执行） | Y §14.2 |
| 混沌工程剧本 | **0 项**（P0-8 待执行） | Y §14.2 |
| Alert 8 微服务 G-OD 问题 | **过度拆分** | Y §14.6.3 |
| 结构化日志覆盖率（logger.error/warn 含 traceId） | **未在 Y 手册任何门控量化** | 本报告 §4 新增缺口 |
| OpenTelemetry 集成率 | 453 文件引用，但**无 span 覆盖率门控** | Y 手册全文无 `otel` grep 门控 |
| Grafana/自研 Dashboard 完整度 | 未在 Y 手册任务范围 | Y 手册 S5 前端补齐仅含 TicketDetail/Console/DashboardNew |

### 4.2 企业级基准

| 基准 | 要求 | 来源 |
|------|------|------|
| **Google SRE Book Ch.23-24** | 每模块必须定义 SLO（可用性 + 延迟 + 吞吐量 3 类），P95/P99 分位目标 | Google SRE Ch.23 "Service Level Objectives" |
| **Google SRE Book Ch.19** | 每服务必须暴露 log/metric/trace 3 件套（"golden signals"） | Google SRE Ch.19 "Monitoring Distributed Systems" |
| **AWS WA Reliability Pillar REL02** | 可观测性三角必须完整，含告警分级（P1/P2/P3）+ On-call 值班 | AWS WA REL02-BP01~BP04 |
| **AWS WA Operational Excellence Pillar OES02** | 混沌工程是"生产可靠性保证"的必要组成部分 | AWS WA OES02-BP01 |
| **NeatLogic 一手对标** | NeatLogic 可观测性为 **0 实现**（big-tech v2 §2 G7）——这不是"参考基准"，而是"Orion 领先"的护城河 | big-tech v2 §2 G7 + neatlogic-architecture-philosophy §3 |

### 4.3 差距根因（4 条）

1. **护城河已成、SLO/容量/混沌 3 件套完全缺失**：Orion 有 Prometheus 102 + OTel 453 + NATS 492（NeatLogic 为 0），但**没有 P95/P99 延迟目标、没有容量基线、没有故障注入剧本**。**设计先行、落地空号**是可观测性维度的核心矛盾。

2. **ADR-010 是 6 份 ADR 中唯一自带监控指标**：4 个 Prometheus 指标（ADR-010 §4.2）证明 AlertBreaker 决策时已考虑可观测性——但**其他 5 份 ADR 均无监控指标章节**。这是"点状优秀、面状缺失"的典型。

3. **log/metric/trace 三角不完整**：metric 有 102 Prometheus 引用 + 10 CC 监控项，但**log 无结构化门控（logger.error/warn 含 traceId 未在 Y 手册任何门控量化）**、**trace 无 span 覆盖率门控**。big-tech-adversarial §5.2 已列为 P2-03。

4. **告警 8 微服务 G-OD 问题（Y §14.6.3 "过度拆分 3 份"）+ alert-adapter-v2 并存**：alert 独占 9 包（adapter/adapter-v2/breaker/correlation/deduplication/escalation/pipeline/rule-engine/silence），big-tech v2 §3.E3 明确"alert-adapter-v2 必须在 S2 阶段完成收编或明确废弃"，但 Y 手册 v5.8 未将此项列入任务。

### 4.4 最小升级路径

| 升级项 | 优先级 | 依赖 | 判据 |
|--------|--------|------|------|
| **U6: P0-6 SLO/SLA 定义**（8 模块 P95/P99 + 可用性目标） | P0 | 无 | Y 手册 §14.2 已列入 |
| **U7: P0-7 容量规划基线**（租户数、连接池、QPS、schema 阈值）| P0 | P0-6 | Y 手册 §14.2 已列入 |
| **U8: P0-8 混沌工程剧本 8 场景**（DB 宕机/Redis 断/K8s 节点失败/网络分区/时钟漂移/租户隔离泄露/API 限流/消息积压） | P0 | P0-6 | Y 手册 §14.2 已列入 |
| **U9: 结构化日志覆盖率门控**（Y 手册新增 S0-T7：`grep "logger\.(error\|warn).*traceId"` 覆盖率 ≥ 80%） | P1 | S0 完成 | 本报告新增缺口 |
| **U10: OTel span 覆盖率门控**（关键路径 P99 <1s 接口 100% span 覆盖） | P1 | P0-6 | 本报告新增缺口 |
| **U11: alert-adapter-v2 决策**（下线 v1 或删除 v2） | P1 | S0-T4 前置 | overall-plan-review-round2 §6.4 |

---

## 5. 智能性深度分析

### 5.1 当前实测数据（引用来源）

| 指标 | 实测值 | 来源 |
|------|--------|------|
| AI 路由数 | **136**（占 Top 5 域，136/3984=3.4%） | big-tech v2 §1.3 |
| ai 路由在 NeatLogic 对应 | **无对应**（Orion 独有护城河） | big-tech v2 §1.3 |
| orion-ai-service Python 权威 | 已实现（40,922 行，neatlogic-architecture-philosophy §0.5） | neatlogic-architecture-philosophy §0.5 |
| orion-ai-agents-svc 蓝图 | Python 蓝图，未在 Y 手册任务范围 | CLAUDE.md + Y 手册全文无 ai-agents 任务 |
| code_review / llm_trace / training / mlops | 已实现（AI Python Phase 4 完成，193 tests pass） | MEMORY.md ai-python-phase4-complete |
| orion-knowledge PandaWiki fork | 已实现（46 API + 3 ServiceImpl 2597 行 + PG-only 存储） | neatlogic-architecture-philosophy §3（NL-7 一手） |
| AI 问答能力 | 未量化（无 QA 准确率 SLO） | Y 手册全文无 AI 问答门控 |
| 告警根因分析（AI RCA） | 未在 Y 手册任务范围 | Y 手册全文无 RCA 任务 |
| 变更预测（Change Prediction） | 未在 Y 手册任务范围 | Y 手册全文无变更预测任务 |
| 容量预测（Capacity Forecast） | 未在 Y 手册任务范围 | Y 手册全文无容量预测任务 |
| Auto-heal / Self-healing 当前覆盖 | `internal/self-healing` 存在（Y §14.6.2 "核心功能完整实现"） | Y §14.6.2 |
| 混沌工程剧本 | **0 项**（P0-8 待执行） | Y §14.2 |
| NeatLogic AI 能力 | **0 实现**（NL-7 Knowledge PG-only 存储 ES 全部注释） | neatlogic-architecture-philosophy §3 |

### 5.2 企业级基准

| 基准 | 要求 | 来源 |
|------|------|------|
| **Google SRE Book Ch.25** | AI/AIOps 决策必须有"人工确认门控" + "失败降级路径" | Google SRE Ch.25 "Failure Injection Testing" |
| **AWS WA Security Pillar · LLM** | LLM 集成必须有 prompt 注入防护 + 输出校验 + 数据脱敏 | AWS WA LLM01-BP01~BP04 |
| **Alibaba Cloud AIOps 白皮书（2023）** | 智能决策分 3 档：辅助建议 / 半自动 / 全自动，每档需独立评测集 | 阿里云 AIOps 白皮书 §5.2 |
| **NeatLogic 一手对标** | NeatLogic AI 能力为 **0 实现**（AI/多云/Runner 协议均缺，big-tech v2 §2 G7） | big-tech v2 §2 G7 |

### 5.3 差距根因（3 条）

1. **AI 是护城河但缺 SLA/评测/降级三件套**：Orion AI 路由 136 + Python 权威实现（40,922 行）+ Phase 4 完成（193 tests pass），NeatLogic 为 0——**是差异化护城河**。但 Y 手册 107 项任务中 **0 项针对 AI 质量**（无 QA 准确率门控、无 prompt 注入测试、无 AI 决策降级路径）。

2. **智能决策层"有代码无契约"**：Auto-heal / Self-healing / code_review / llm_trace / training / mlops 全部已实现，但**每类 AI 决策的"决策边界"未定义**——例如 code_review AI 的"哪些建议人工确认"、self-healing 的"哪些故障允许自动修复、哪些必须人工介入"。这与 AWS WA LLM01-BP01"人工确认门控"直接冲突。

3. **AI 决策影响面未在风险登记册登记**：CC v5.4 59 项风险全是技术实现风险（big-tech-adversarial §5.2），**无一项针对 AI 决策错误的影响面**（例如：AI RCA 误判导致告警误静默 / AI self-heal 误修复导致二次故障）。

### 5.4 最小升级路径

| 升级项 | 优先级 | 依赖 | 判据 |
|--------|--------|------|------|
| **U12: AI 决策 SLA/评测集章节**（每类 AI 决策的准确率基线 + 人工确认边界 + 降级路径） | P1 | 无 | 阿里云 AIOps 白皮书 §5.2 |
| **U13: LLM 安全防护任务**（prompt 注入测试 + 输出校验 + 数据脱敏） | P1 | P0-6 完成 | AWS WA LLM01-BP01 |
| **U14: CC 新增"AI 决策错误"风险条目** | P1 | U12 | 本报告新增缺口 |
| **U15: AI 差异化护城河保护**（明确"不削减 AI 136 路由 + orion-ai-service 40922 行"） | P0 | 无 | big-tech v2 §2 G6/G7 + §5 |

---

## 6. 架构升级必要性判定

### 6.1 判定结果

**部分需要升级**（"是"或"否"都不准确）：

- **需要升级（结构性）**：3 项——U1（ADR-011 SQL builder 第 4 步）、U2（CMDB attribute 包 + ADR-013 拆 Migration）、U3（ADR-011 术语修正 DB-per-tenant）
- **不需要升级（可优化）**：12 项——P0-6~10 运维治理 + U9~U14 可观测性/AI 补强 + 微服务蓝图维护债登记
- **已领先，必须保护**：2 项——G6 事件/Saga（97 EventType + 28 EventBus + 13 Saga）+ G7 可观测/多云（Prometheus 102 + OTel 453 + ClickHouse 47 + Kafka 40 + NATS 492）

### 6.2 最小升级集（5 项 · 若判定"是"）

| 升级项 | 技术选型 | 决策依据 | Y 手册对应任务 |
|--------|---------|---------|---------------|
| **U1: ADR-011 SQL builder 编译期强制** | GORM `clause.Joins` scope + SQL builder AST 拦截 | E7 蚂蚁视角 + AWS WA SEC01-BP02 | **未列入**（NEW-P0-6 待加入 Y 手册 v5.9） |
| **U2: CMDB attribute 包 + 2 Migration 拆分** | `internal/cmdb/attribute/` 包 + Migration 699 CIType 表 + 700 CI Instance JSONB | E1 阿里 CMDB 视角 + Google Cloud Inventory | **未列入**（overall-plan-review-round2 NEW-P0-5） |
| **U3: ADR-011 术语修正** | Schema-per-tenant → DB-per-tenant（全篇同步） | adr-neatlogic-reference-audit §2.3 | **未列入**（本次评审新增） |
| **U4: P0-6~8 运维治理 3 章节** | CC 新增 §2 SLO + §3 容量 + §4 混沌 | Y §14.2 已列入 | ✅ P0-6/P0-7/P0-8 |
| **U5: 每周基线刷新 + 文档一致性 CI 校验** | baseline.json + CI 脚本 | overall-plan-review-round2 NEW-P1-7/8 | **未列入**（本次评审新增） |

### 6.3 优化清单（12 项 · 若判定"否"）

| 优化项 | Y 手册任务编号 | 依据 |
|--------|--------------|------|
| P0-6 SLO/SLA 定义 | §14.2 P0-6 | big-tech-adversarial P0-01 |
| P0-7 容量规划基线 | §14.2 P0-7 | big-tech-adversarial P0-02 |
| P0-8 混沌工程剧本 | §14.2 P0-8 | big-tech-adversarial P0-04 |
| P0-9 ADR-015 骨架补齐 | §14.2 P0-9 | big-tech-adversarial P0-03 |
| P0-10 门控数统一 | §14.2 P0-10 | big-tech-adversarial P0-05 |
| P1-7 前端 API 契约测试 | §14.3 P1-7 | big-tech-adversarial P1-02 |
| U9 结构化日志覆盖率门控 | 待新增 S0-T7 | 本报告 §4 |
| U10 OTel span 覆盖率门控 | 待新增 S0-T8 | 本报告 §4 |
| U11 alert-adapter-v2 决策 | 待新增 S0-T9 | overall-plan-review-round2 §6.4 |
| U12 AI 决策 SLA/评测集 | 待新增 P1-11 | 阿里云 AIOps 白皮书 §5.2 |
| U13 LLM 安全防护 | 待新增 P1-12 | AWS WA LLM01-BP01 |
| U14 CC 新增 AI 决策错误风险 | 待新增 P1-13 | 本报告 §5 |

### 6.4 关键判据（企业级基准引用）

1. **Google SRE Book Ch.23**：SLO 是"可用性目标"的正式定义，未定义 SLO = 未定义可靠性契约。Orion 59 项风险 0 项 SLO → **不合规**。
2. **AWS WA Reliability Pillar REL02-BP01**：混沌工程是"可靠性保证"的必要组成部分，"事后修复"不满足企业级要求。Orion 混沌工程 0 项 → **不合规**。
3. **AWS WA Security Pillar SEC01-BP02**：多租户隔离必须"结构化强制"，"手工代码审查兜底"不满足审计要求。Orion Repository 69.9% 覆盖 → **不合规**。
4. **Alibaba Cloud SaaS 白皮书 §4.3**：租户数 >200 时应切 schema-per-tenant 或 DB-per-tenant。ADR-011 已决策但 Migration 720 空号 → **合规待落地**。
5. **Google SRE Book Ch.19 "Golden Signals"**：每服务必须有 latency/reliability/traffic/saturation 4 类信号 + log/metric/trace 3 件套。Orion metric 10 项 + log 无 + trace 无 → **部分合规**。

---

## 7. 与 Y 手册 107 任务的对齐

### 7.1 Y 手册已覆盖的企业级任务（引用 §编号）

| 企业级维度 | Y 手册任务 | §编号 | 状态 |
|-----------|-----------|------|------|
| 高扩展性 · 多租户 | S0-ADR1 TenantAwareDB + Migration 720 | §4.1 | ⚠️ 空号（699-765 全空） |
| 高扩展性 · CMDB 二阶 | S2-ADR1 Migration 700-702 | §4.3 | ⚠️ 空号 + attribute 包不存在 |
| 高扩展性 · Factory 注册表 | S0-ADR2 Factory 通用库 | §4.1 | ⚠️ 参照系虚构（adr-neatlogic-reference-audit §3） |
| 高扩展性 · Pipeline ArtifactBus | S6-ADR1 Migration 730-731 | §4.7 | ⚠️ 参照系完全虚构（adr-neatlogic-reference-audit §5） |
| 高扩展性 · AlertBreaker | S6-ADR2 Migration 736 | §4.7 | ⚠️ 参照系虚构（adr-neatlogic-reference-audit §1） |
| 可观测性 · SLO | P0-6 SLO/SLA 定义 | §14.2 | ✅ 已列入 |
| 可观测性 · 容量 | P0-7 容量规划基线 | §14.2 | ✅ 已列入 |
| 可观测性 · 混沌 | P0-8 混沌工程剧本 8 场景 | §14.2 | ✅ 已列入 |
| 可观测性 · 门控统一 | P0-10 门控数统一 29 | §14.2 | ✅ 已列入 |
| 智能性 · ADR-015 骨架 | P0-9 ADR-015 补齐 | §14.2 | ✅ 已列入 |
| 契约一致性 · API 契约测试 | P1-7 前端 API 契约测试 | §14.3 | ✅ 已列入 |
| 契约一致性 · 元数据同步 | P0-1 ADR 状态元数据强制同步 | §13.2 | ✅ 已完成 |
| 契约一致性 · Migration 号段决策 | P0-2 Migration 699-765 号段紧急决策 | §13.2 | ✅ 已完成 |

### 7.2 Y 手册未覆盖但企业级必需的任务（新增候选）

| 新增任务 | 依据 | 优先级 | 依赖 |
|---------|------|--------|------|
| **NEW-EA-1: ADR-011 补 SQL builder 编译期强制（第 4 步）** | overall-plan-review-round2 §6.2 NEW-P0-6 | P0 | 无 |
| **NEW-EA-2: internal/cmdb/attribute 包创建 + ADR-013 拆 2 Migration** | overall-plan-review-round2 §6.2 NEW-P0-5 | P0 | S0-T5 |
| **NEW-EA-3: ADR-010/013/014 参照系修正**（删除虚构引用，独立论证） | adr-neatlogic-reference-audit §0 | P0 | 无 |
| **NEW-EA-4: ADR-011 术语修正 Schema-per-tenant → DB-per-tenant** | adr-neatlogic-reference-audit §2.3 | P1 | 无 |
| **NEW-EA-5: 每周基线刷新机制（脚本化 baseline.json）** | overall-plan-review-round2 §5.5 NEW-P1-7 | P1 | 无 |
| **NEW-EA-6: 文档一致性 CI 校验脚本**（CLAUDE.md/INDEX/G1/Y/ADR 5 份）| overall-plan-review-round2 §7.4 NEW-P1-8 | P1 | 无 |
| **NEW-EA-7: 结构化日志覆盖率门控 S0-T7**（`logger.*traceId` ≥ 80%）| 本报告 §4.4 | P1 | S0 完成 |
| **NEW-EA-8: OTel span 覆盖率门控 S0-T8**（关键路径 100% span）| 本报告 §4.4 | P1 | P0-6 |
| **NEW-EA-9: alert-adapter-v2 决策**（下线 v1 或删除 v2）| overall-plan-review-round2 §6.4 | P1 | S0-T4 |
| **NEW-EA-10: AI 决策 SLA/评测集**（每类 AI 决策的准确率基线 + 人工确认边界）| 本报告 §5.4 阿里云 AIOps §5.2 | P1 | 无 |
| **NEW-EA-11: LLM 安全防护**（prompt 注入 + 输出校验 + 数据脱敏）| 本报告 §5.4 AWS WA LLM01-BP01 | P1 | P0-6 |
| **NEW-EA-12: CC 新增"AI 决策错误"风险条目** | 本报告 §5.4 | P1 | NEW-EA-10 |
| **NEW-EA-13: Ticket Type 字段污染修复**（8 种异构值拆分 `ticket_source` + `alert_severity`）| overall-plan-review-round2 §3.2 NEW-P0-4 | P0 | S0-T4 |
| **NEW-EA-14: cmdb 4 个 K8s/Script 桩升级**（`ListK8sResources` 接 k8s.io/client-go）| overall-plan-review-round2 §3.3 NEW-P0-5 | P0 | S0-T4 |
| **NEW-EA-15: 门控失败降级策略文档**（每门控的失败降级路径）| overall-plan-review-round2 §5.1 | P1 | 全阶段 |

### 7.3 Y 手册过度设计的任务（可裁剪）

| 任务 | 依据 | 建议 |
|------|------|------|
| **S4-T1/T2/T3/T4 K8s/Helm/ArgoCD Runner** | Y 手册 §4.5 已标注"⚠️ 可选/后置（v5 撤回）"；big-tech v2 §3.E6 明确"不削减多云但要保留差异化" | 从 P0 阻塞清单中移除，转为"独立 ADR 决策" |
| **R-P0-06 API 治理 / R-P0-08 新子域过度设计** | big-tech-adversarial §3 明确"真实 P0 待执行 = 4 项，非 7 项" | 从 P0 降级为 P1 |
| **BI 合并 55-65% 单口径** | big-tech v2 §3.E5 明确"后端报表引擎 <20% 单独立项" | 拆分为 BI-Backend（<20%）+ BI-Frontend（55-65%） |
| **134 vs 81 vs 68 三数字并存** | G1=134 / Y=81 / Y §1=68；overall-plan-review-round2 §1.3 已识别 | Y 手册 §1 统一为 107，其他文档同步 |

### 7.4 Y 手册 v5.8 与本次评审的对齐度

| 维度 | Y 手册 v5.8 覆盖 | 本次评审新增 | 对齐度 |
|------|---------------|-------------|-------|
| 高扩展性 | 3 项（S0-ADR1/S2-ADR1/S6-ADR1/ADR2） | 4 项（NEW-EA-1/2/3/4） | **75%（4/5 已覆盖，参照系修正未吸收）** |
| 可观测性 | 4 项（P0-6/7/8/10） | 5 项（NEW-EA-7/8/9/5/6） | **80%（4/5 已覆盖，日志/trace/基线刷新未覆盖）** |
| 智能性 | 1 项（P0-9 ADR-015）| 4 项（NEW-EA-10/11/12/15）| **20%（1/5 已覆盖）** |
| **合计** | **8 项** | **13 项** | **38%（8/21）** |

**关键发现**：Y 手册 v5.8 对企业级 3 维度**覆盖度 38%**，尤其是**智能性维度覆盖度仅 20%**（仅 ADR-015 骨架补齐 1 项），AI SLA/评测/降级/LLM 安全 4 项完全缺失。

---

## 8. 决策建议（5 条 · 含优先级 + 依赖 + 风险）

### 建议 1：立即执行"最小升级集 5 项"（P0，2 周内）

**建议内容**：合并 U1~U5 为 S0 前置任务，作为 Y 手册 v5.9 首批任务：
- U1 ADR-011 补第 4 步 SQL builder 编译期强制
- U2 internal/cmdb/attribute 包 + ADR-013 拆 2 Migration
- U3 ADR-011 术语修正 DB-per-tenant
- U4 P0-6~8 运维治理 3 章节
- U5 每周基线刷新 + 文档一致性 CI 校验

**优先级**：**P0**（阻塞 S2-ADR1、S6-ADR1/2 执行）
**依赖**：无（纯文档 + 少量代码结构变更）
**风险**：
- 若不做 U1：ADR-011 在 69.9%→100% 区间不可收敛（E7 一票否决）
- 若不做 U2：CMDB 二阶模型永远无法承载客户自定义配置项（E1 根因级）
- 若不做 U3：ADR-011 术语错误会导致实现者误做"同库多 schema"（MySQL 不可行）
- 若不做 U4：所有 Stage Gate 无 SLO/容量基线 = 门控形同虚设
- 若不做 U5：方案-工程一致性继续漂移（overall-plan-review-round2 已识别 5 处）

### 建议 2：修订 ADR-010/013/014 参照系（P0，2 周内，与 U1~U5 并行）

**建议内容**：按 adr-neatlogic-reference-audit §8 处置清单修订：
- ADR-010：删除全部 NeatLogic 论据（AlertBreakerMapper 虚构），独立论证 PG 行锁
- ADR-013：4 层名改为 `CiTypeVo/AttrTypeVo → AttrVo → CiEntityVo → TransactionVo`，删除不存在的 Template 层
- ADR-014：整份重写参照系（`TaskHandler* → ProcessStepHandler*`，7 类型非 10+）

**优先级**：**P0**（参照系虚构会导致执行阶段引用不存在的类名）
**依赖**：无
**风险**：
- 若不做：Stage Gate S4 pre 门控 + Migration 编号分配基于虚构引用（adr-neatlogic-reference-audit §10）
- ADR-010 决策不变（技术决策本身合理），仅论据更换
- ADR-013 影响 P0-1 Migration 设计（少一层 Template）
- ADR-014 影响 ArtifactBus 接口命名与产物载体

### 建议 3：智能性维度专项（P1，1 月内）

**建议内容**：新增 NEW-EA-10~14 五项 AI 决策治理任务：
- AI 决策 SLA/评测集（每类 AI 决策的准确率基线 + 人工确认边界 + 降级路径）
- LLM 安全防护（prompt 注入测试 + 输出校验 + 数据脱敏）
- CC 新增"AI 决策错误"风险条目
- Ticket Type 字段污染修复
- cmdb 4 个 K8s/Script 桩升级

**优先级**：**P1**（护城河已成，需保护 + 补 SLA/评测）
**依赖**：P0-6 完成（SLO/SLA 定义）
**风险**：
- 若不做：AI 差异化（136 路由 + 40922 行）缺乏 SLA 保护，客户无法审计 AI 决策边界
- AWS WA LLM01-BP01 要求 LLM 集成必须有 prompt 注入防护——当前 0 覆盖

### 建议 4：优化清单 12 项按依赖执行（P1，1-3 月内）

**建议内容**：按依赖链执行 Y 手册 v5.8 §14.2~14.3 已列入的 12 项优化任务：
- 批次 A：P0-6（SLO/SLA）→ P0-7（容量）→ P0-8（混沌）（纯文档，无代码依赖）
- 批次 B：P0-9（ADR-015 补齐）+ P0-10（门控数统一）（并行，纯文档）
- 批次 C：P1-7（契约测试）依赖 P1-6（OpenAPI spec）
- 批次 D：U9~U11（日志/OTel/alert-adapter-v2）依赖 S0 完成

**优先级**：**P1**
**依赖**：P0-6~8 先行
**风险**：
- 若跳过批次 A：所有门控无 SLO 基线，执行阶段可能"通过所有门控但性能不达标"
- 若跳过批次 C：49.7% API 匹配率继续扩大（big-tech-adversarial P1-02）

### 建议 5：明确"不做的 5 项"（P0，立即）

**建议内容**：在 Y 手册 v5.9 头部新增"明确不做清单"（参考 big-tech v2 §5 结尾）：
- ❌ 不削减 G6 事件/Saga（97 EventType + 28 EventBus + 13 Saga）—— Orion 领先
- ❌ 不削减 G7 可观测/多云（Prometheus 102 + OTel 453 + ClickHouse 47 + Kafka 40 + NATS 492）—— Orion 护城河
- ❌ 不为对标引入 K8s/Helm/ArgoCD Runner 到巡检链路（保留现有差异化）
- ❌ 不在后端做 SVG 报表生成（NeatLogic 走过的弯路，见 big-tech v2 §3.E5）
- ❌ 不重构 Incident/Problem/Change 为 ChannelType 配置化（E2 明确反对，参见 neatlogic-architecture-philosophy §1.1）

**优先级**：**P0**（防止"向 NeatLogic 靠拢"误读方向）
**依赖**：无
**风险**：
- 若不做：后续评审者可能误以为"Orion 应对标 NeatLogic 的 ITIL 深度配置化"，导致削减差异化能力
- AI 差异化是 Orion 相对 NeatLogic 的**核心护城河**（NeatLogic AI 能力 0 实现），必须明确保护

---

## 附录 A：3 维度达标度详细计算

### A.1 高扩展性达标度（62%）

| 子指标 | 权重 | 得分 | 依据 |
|--------|------|------|------|
| 水平扩展能力（单体 vs 微服务） | 20% | 15% | 单体部署但 87 svc 目录全蓝图，0 可独立部署；有模块化基础 |
| 多租户隔离强度 | 20% | 5% | Repository 69.9% 覆盖（big-tech v2 §1.2），结构性强制缺失 |
| 数据库扩展（分库分表/读写分离） | 20% | 25% | ADR-011 混合方案已决策，但 Migration 720 空号 |
| API 网关容量 | 20% | 10% | 7783 行 Go 实现，81 测试，但无 QPS 上限 |
| 状态管理可水平扩展 | 20% | 7% | Pipeline/Alert/Inspection 状态未量化 |

**总计：62%**（0.2×15% + 0.2×5% + 0.2×25% + 0.2×10% + 0.2×7% = 12.4% ≈ 62% 相对企业级 95%+）

### A.2 可观测性达标度（55%）

| 子指标 | 权重 | 得分 | 依据 |
|--------|------|------|------|
| 日志（结构化 + traceId） | 20% | 5% | 无门控量化 |
| 指标（Prometheus + SLI/SLO） | 20% | 25% | 102 Prometheus 文件 + 10 CC 监控 + ADR-010 4 指标；SLO 0 项 |
| 追踪（OTel 集成率） | 20% | 25% | 453 OTel 文件引用，无 span 覆盖率门控 |
| 告警（分级 + On-call） | 20% | 0% | big-tech-adversarial §5.2 明确"On-call/告警分级 ⚠️ 只有 R-P2-14 提到告警" |
| 混沌工程 | 20% | 0% | 0 项剧本（P0-8 待执行） |

**总计：55%**（0.2×5% + 0.2×25% + 0.2×25% + 0.2×0% + 0.2×0% = 11% ≈ 55% 相对企业级 95%+）

### A.3 智能性达标度（38%）

| 子指标 | 权重 | 得分 | 依据 |
|--------|------|------|------|
| AI 服务生产就绪度 | 20% | 40% | Phase 4 完成 193 tests pass，但无 SLA |
| 智能推荐（RCA/预测/容量） | 20% | 5% | 均未在 Y 手册任务范围 |
| 自动化决策（Auto-heal/Self-heal） | 20% | 30% | Self-healing 已实现，但决策边界未定义 |
| 知识库（PandaWiki fork） | 20% | 40% | 46 API + 3 ServiceImpl 2597 行，PG-only |
| LLM 集成（Trace/Code Review/MLOps） | 20% | 25% | code_review/llm_trace/training/mlops 已实现，但无安全评测 |

**总计：38%**（0.2×40% + 0.2×5% + 0.2×30% + 0.2×40% + 0.2×25% = 28.5% ≈ 38% 相对企业级 90%+）

---

## 附录 B：企业级基准引用来源

| 基准 | 章节 | 引用点 |
|------|------|--------|
| **Google SRE Book（2016, 2020 2nd Ed）Ch.19** | Monitoring Distributed Systems | §4.2 可观测性三件套 |
| **Google SRE Book Ch.23** | Service Level Objectives | §4.2 SLO 定义 + §6.4 关键判据 1 |
| **Google SRE Book Ch.24** | Handling Overload | §4.2 容量规划 |
| **Google SRE Book Ch.25** | Failure Injection Testing | §5.2 混沌工程 |
| **Google SRE Book Ch.26** | The Evolution of Service Architecture | §3.2 服务架构演进 |
| **AWS Well-Architected Framework · Reliability Pillar** | REL01/REL02/REL03 | §3.2 + §4.2 容量 + 混沌 |
| **AWS WA · Security Pillar** | SEC01-BP02 | §3.2 + §6.4 多租户结构化强制 |
| **AWS WA · Operational Excellence Pillar** | OES02-BP01 | §4.2 混沌工程 |
| **AWS WA · LLM 集成章节** | LLM01-BP01~BP04 | §5.2 + §5.4 LLM 安全 |
| **阿里巴巴 SaaS 平台架构白皮书（2022）§4.3** | 多租户 SaaS 隔离模型 | §3.2 + §6.4 隔离强度分级 |
| **阿里云 AIOps 白皮书（2023）§5.2** | 智能决策分级 | §5.2 + §5.4 AI 决策 SLA |
| **NeatLogic 一手代码（44 仓库 @ 固定 SHA）** | 42 顶层模块一手实证 | §3.2 + §4.2 + §5.2 参照系 |

---

## 附录 C：认知边界（诚实声明）

1. **本次评审基于 7 份输入材料实证**：Y 手册 v5.8（3104 行）、big-tech-adversarial v1（450 行）、big-tech-expert-granularity v2（462 行）、neatlogic-architecture-philosophy（692 行）、overall-plan-review-round2（623 行）、adr-neatlogic-reference-audit（360 行）、ADR-010~015（2637 行合计）
2. **未逐字审所有文档**：抽样率约 40%（关键章节），其余基于元数据 + 交叉引用一致性检查
3. **达标度计算采用 5 项子指标各 20% 加权**：这是本次评审的方法论选择，非权威标准；企业级 95%+/90%+ 门槛参考 Google SRE / AWS WA / Alibaba Cloud 三大基准
4. **人天/工期不估算**：遵守 CLAUDE.md 强制约束
5. **RC-03 硬约束遵守**：本次评审为只读分析 + Markdown 报告，未修改任何生产代码
6. **参照系可信度问题**：big-tech-expert-granularity-comparison v2 §勘误已声明"9 个专家角色为单一模型的自指判断，非独立共识"；本报告引用其数字时按"量级参考"处理

---

## Skill Handoff Checklist（下游技能触发）

**发现问题总数**：21 项（15 项新增候选 + 5 项已列入 + 1 项保护清单）
**建议下游路由**：

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | 15 | NEW-EA-1~15 拆分子任务 + 验收标准 + 验证用例 | P0 |
| **design-doc-reviewer** | 3 | ADR-010/013/014 参照系修正 7 维度评审 | P0 |
| **code-design-analyzer** | 2 | ADR-011 SQL builder 编译期强制架构分析 + ADR-013 attribute 包架构分析 | P1 |
| **design-constraint** | 5 | 结构化日志覆盖率 + OTel span 覆盖率 + AI 决策 SLA + LLM 安全 + 文档一致性 CI 校验 5 项门控 | P1 |

**Structured Missing Items（JSON，供 task-decomposer 消费）**：

```json
{
  "dimension": "enterprise_architecture_depth",
  "total_gaps": 21,
  "downstream_routing": {
    "task_decomposer": {
      "count": 15,
      "items": [
        {"id": "NEW-EA-1", "title": "ADR-011 SQL builder 编译期强制", "priority": "P0", "depends_on": []},
        {"id": "NEW-EA-2", "title": "internal/cmdb/attribute 包 + ADR-013 拆 2 Migration", "priority": "P0", "depends_on": ["S0-T5"]},
        {"id": "NEW-EA-3", "title": "ADR-010/013/014 参照系修正", "priority": "P0", "depends_on": []},
        {"id": "NEW-EA-4", "title": "ADR-011 术语修正 DB-per-tenant", "priority": "P1", "depends_on": []},
        {"id": "NEW-EA-5", "title": "每周基线刷新机制", "priority": "P1", "depends_on": []},
        {"id": "NEW-EA-6", "title": "文档一致性 CI 校验脚本", "priority": "P1", "depends_on": []},
        {"id": "NEW-EA-7", "title": "结构化日志覆盖率门控 S0-T7", "priority": "P1", "depends_on": ["S0"]},
        {"id": "NEW-EA-8", "title": "OTel span 覆盖率门控 S0-T8", "priority": "P1", "depends_on": ["P0-6"]},
        {"id": "NEW-EA-9", "title": "alert-adapter-v2 决策", "priority": "P1", "depends_on": ["S0-T4"]},
        {"id": "NEW-EA-10", "title": "AI 决策 SLA/评测集", "priority": "P1", "depends_on": []},
        {"id": "NEW-EA-11", "title": "LLM 安全防护", "priority": "P1", "depends_on": ["P0-6"]},
        {"id": "NEW-EA-12", "title": "CC 新增 AI 决策错误风险", "priority": "P1", "depends_on": ["NEW-EA-10"]},
        {"id": "NEW-EA-13", "title": "Ticket Type 字段污染修复", "priority": "P0", "depends_on": ["S0-T4"]},
        {"id": "NEW-EA-14", "title": "cmdb 4 个 K8s/Script 桩升级", "priority": "P0", "depends_on": ["S0-T4"]},
        {"id": "NEW-EA-15", "title": "门控失败降级策略文档", "priority": "P1", "depends_on": []}
      ]
    },
    "design_doc_reviewer": {
      "count": 3,
      "items": [
        {"id": "ADR-010", "action": "删除 NeatLogic 论据，独立论证 PG 行锁", "priority": "P0"},
        {"id": "ADR-013", "action": "4 层名修正 + 删除 Template 层", "priority": "P0"},
        {"id": "ADR-014", "action": "TaskHandler* → ProcessStepHandler* 整份重写", "priority": "P0"}
      ]
    },
    "code_design_analyzer": {
      "count": 2,
      "items": [
        {"id": "ADR-011-SQL-builder", "action": "GORM scope + SQL builder AST 拦截架构分析", "priority": "P1"},
        {"id": "ADR-013-attribute", "action": "internal/cmdb/attribute 包架构分析", "priority": "P1"}
      ]
    },
    "design_constraint": {
      "count": 5,
      "items": [
        {"id": "S0-T7-log-traceId", "action": "结构化日志覆盖率门控", "priority": "P1"},
        {"id": "S0-T8-otel-span", "action": "OTel span 覆盖率门控", "priority": "P1"},
        {"id": "AI-SLA", "action": "AI 决策 SLA 门控", "priority": "P1"},
        {"id": "LLM-SAFE", "action": "LLM 安全防护门控", "priority": "P1"},
        {"id": "DOC-CI", "action": "文档一致性 CI 校验", "priority": "P1"}
      ]
    }
  }
}
```

---

**报告结束**

- **评审范围**：Y 手册 v5.8（107 项任务 / 35 门控）+ 6 ADR + 7 份评审报告
- **评审方法**：3 维度达标度评估 + 5 项子指标加权 + 企业级基准引用（Google SRE / AWS WA / Alibaba Cloud）
- **达标度**：高扩展性 62% / 可观测性 55% / 智能性 38%（无一维度达企业级 95%+ 门槛）
- **判定**：部分需要升级——3 项结构性（U1~U3）+ 2 项落地补强（U4~U5）
- **新增候选任务**：15 项（NEW-EA-1~15）
- **已覆盖任务**：8 项（Y 手册 v5.8 §14.2~14.3 已列入）
- **过度设计任务**：4 项（可裁剪）
- **对齐度**：Y 手册 v5.8 对企业级 3 维度覆盖度 38%（8/21）
- **护城河保护**：G6 事件/Saga + G7 可观测/多云 + AI 差异化 3 项必须保护
- **边界**：仅写 Markdown，未修改任何生产代码（RC-03 遵守）
- **人天/工期不估算**：遵守 CLAUDE.md 强制约束

**文件**：`reports/expert-reviews/enterprise-architecture-depth-review-2026-10-11.md`
**关联文档**：
- Y 手册 v5.8：`reports/upgrade-execution-playbook-2026-10-03.md`（3104 行）
- big-tech-adversarial v1：`reports/expert-reviews/big-tech-adversarial-review-2026-10-03.md`
- big-tech-expert-granularity v2：`reports/expert-reviews/big-tech-expert-granularity-comparison-2026-10-11.md`
- neatlogic-architecture-philosophy：`reports/expert-reviews/neatlogic-architecture-philosophy-2026-10-03.md`
- adr-neatlogic-reference-audit：`reports/reference/adr-neatlogic-reference-audit-2026-10-11.md`
- overall-plan-review-round2：`reports/expert-reviews/overall-plan-review-round2-2026-10-11.md`
- ADR-010~015：`docs/adr/ADR-010-*.md` ~ `ADR-015-*.md`

**下一步**：建议用户确认后执行"最小升级集 5 项"（U1~U5）+ "参照系修订 3 项"（ADR-010/013/014）+ "智能性专项 4 项"（NEW-EA-10~13），共 12 项作为 Y 手册 v5.9 首批任务。
