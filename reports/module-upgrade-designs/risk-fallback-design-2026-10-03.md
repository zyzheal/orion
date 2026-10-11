# 风险与降级方案（CC，2026-10-03）

**范围**：把 8 份模块级升级设计 + AA 数据模型 + BB 架构融入 + 7 份方法级评审中的所有风险点整合为**单一权威风险登记册 + 降级预案 + 回滚剧本**
**上游文档**：
- AA：`data-model-migration-design-2026-10-03.md`（Migration 699-765）
- BB：`architecture-integration-design-2026-10-03.md`（14 新模块 + 8 改造模块）
- 8 模块：`reports/module-upgrade-designs/{cmdb,itsm,inspection,automation,bi,alert,rdm,devops}-upgrade-design-2026-10-03.md`
- 方法级：`reports/expert-reviews/{cmdb-itsm,alert-devops,automation-bi-rdm,inspection,frontend}-*method-level-2026-10-03.md`
- NeatLogic 一手：`reports/expert-reviews/neatlogic-deploy-tagent-change-firsthand-2026-10-03.md`（NL-4 已落地）
**硬约束**：不估算人天；不修改生产代码；只产出 Markdown；不引入额外服务（MongoDB/Redis 之外）；遵循 PG 14+ 单库

---

## 0. TL;DR

- **风险总数**：**59 项**（P0×7 + P1×19 + P2×24 + P3×6 + CC×3；v5.4 最终态，含 ADR 引入 11 项 + v5 新增 9 CC 风险）
- **降级策略**：5 大类（功能降级 / 双写过渡 / 灰度切换 / 回滚 migration / 数据修复脚本）
- **回滚剧本**：8 个模块级剧本 + 4 个跨模块剧本
- **最高风险**：StageExecutor artifact 传播破坏现有 pipeline（已降级为 P1，ADR-014 Feature Flag 控制）+ AlertBreaker 并发窗口模型（已决策，ADR-010 PG 行锁）
- **不可逆 Migration**：1 项已知（698，已存在）+ 0 项新增（本轮设计全部可逆）
- **门控指标**：每个阶段必须满足 4 项硬指标才可进入下一阶段

> **v5.4 更新**：原 42 项（v4 初始）经 v5 新增 9 CC 风险 + ADR 引入 11 项 = 最终态 59 项。详见 §1.5 v5 新增 + §1.6 ADR 引入。

---

## 1. 风险登记册（59 项，v5.4 最终态）

### 1.1 P0 风险（v4 原始 8 项，v5.4 降级 3 项 → 实际 7 项含 v5 新增）

> **v5.4 状态**：R-P0-01 降级为 P1（ADR-014）/ R-P0-03 重估中（NL-3）/ R-P0-07 降级为 P2（ADR-013）。v5 新增 R-P0-04-v5 / R-P0-05-v5 见 §1.5。详见 §1.7 统一编号对照表。

| 编号 | 风险 | 概率 | 影响 | 模块 | 来源 |
|------|------|------|------|------|------|
| R-P0-01 | StageExecutor artifact 传播破坏现有 pipeline | 中 | 高 | Automation | automation-upgrade-design §8.1 |
| R-P0-02 | SSH/WinRM/K8s-Exec 依赖引入 CVE | 中 | 中 | Automation/DevOps | automation §8.1 |
| R-P0-03 | Alert 5 家族 memory→PG 数据丢失 | 中 | 高 | Alert | alert-upgrade-design §8.1 |
| R-P0-04 | 通知渠道租户隔离改造大范围破坏 | 中 | 高 | Alert | alert §8.1 |
| R-P0-05 | K8s/Helm/ArgoCD 集成测试复杂度高 | 高 | 高 | DevOps | devops §8.1 |
| R-P0-06 | 模块合并破坏引用方（pipeline-template vs templates） | 中 | 高 | Automation | automation §8.1 |
| R-P0-07 | CMDB CI 类型系统二阶模型迁移破坏现有 cmdb_cis | 中 | 高 | CMDB | cmdb §8.1 |
| R-P0-08 | 5 新子域过度设计 / 与现有 pipeline 生态不兼容 | 中 | 中 | Automation | automation §8.1 |

### 1.2 P1 风险（v4 原始 15 项，v5.4 最终 19 项 = 15 + 2 v5 + 2 ADR + 0 降入）

| 编号 | 风险 | 概率 | 影响 | 模块 | 来源 |
|------|------|------|------|------|------|
| R-P1-01 | AppConfig 三层合并逻辑复杂 | 中 | 高 | DevOps | devops §8.1 |
| R-P1-02 | AppPipeline 与现有 Pipeline 数据不兼容 | 中 | 中 | DevOps | devops §8.1 |
| R-P1-03 | SAST 工具集成后性能下降 | 中 | 中 | DevOps | devops §8.1 |
| R-P1-04 | 前端 PipelineEditor 泳道 UI 复杂 | 中 | 中 | DevOps/前端 | devops §8.1 |
| R-P1-05 | 5 家 Git Provider 维护成本 | 中 | 低 | DevOps | devops §8.1 |
| R-P1-06 | AlertCorrelation 算法引入循环依赖 | 中 | 中 | Alert | alert §8.1 |
| R-P1-07 | Oncall/Shift/SLA/Dashboard 4 新模块过度设计 | 中 | 中 | Alert | alert §8.1 |
| R-P1-08 | v1/v2 adapter 收敛期兼容性问题 | 低 | 中 | Alert | alert §8.1 |
| R-P1-09 | Inspection 阈值引擎 JSONPath 性能瓶颈 | 中 | 中 | Inspection | inspection §8.1 |
| R-P1-10 | BI 报表 Execute 真实化后大查询超时 | 中 | 高 | BI | bi §8.1 |
| R-P1-11 | RDM Ticket 扩展字段破坏现有工单流 | 中 | 中 | RDM/ITSM | rdm §8.1 |
| R-P1-12 | Runner 跨平台编译复杂度 | 中 | 中 | Automation | automation §8.1 |
| R-P1-13 | ITSM Workcenter 与现有 Ticket 双向耦合 | 中 | 中 | ITSM | itsm §8.1 |
| R-P1-14 | AppConfig env/module/system 合并冲突 | 中 | 中 | DevOps | devops §8.1 |
| R-P1-15 | 前端 API 路径与后端不匹配（49.7% 覆盖率） | 高 | 中 | 全模块 | frontend-method-level |

### 1.3 P2 风险（v4 原始 13 项，v5.4 最终 24 项 = 13 + 2 v5 + 8 ADR - 1 重复 + 1 降入 + 1 撤回保留）

| 编号 | 风险 | 概率 | 影响 | 模块 |
|------|------|------|------|------|
| R-P2-01 | Migration 699+ 号与现有表冲突 | 低 | 高 | AA |
| R-P2-02 | 不可逆 migration 累积 | 高 | 中 | AA |
| R-P2-03 | JSONB GIN 索引内存占用过高 | 中 | 低 | AA |
| R-P2-04 | 跨模块外键在 tickets 表清理时异常 | 中 | 中 | AA/BB |
| R-P2-05 | Wiring 顺序错误导致启动失败 | 低 | 中 | BB |
| R-P2-06 | 路由冲突（新旧路由前缀碰撞） | 低 | 中 | BB |
| R-P2-07 | Inhibition 隐式而非独立 | 低 | 低 | Alert |
| R-P2-08 | Alert topology 未深入 | 低 | 低 | Alert |
| R-P2-09 | Gitea/Gerrit 自建 Git 支持缺失 | 低 | 低 | DevOps |
| R-P2-10 | 泳道 DAG 编辑 UI 受限 | 低 | 低 | DevOps/前端 |
| R-P2-11 | BI column_lineage 字段级血缘采集成本 | 中 | 低 | BI |
| R-P2-12 | Tagent 引入风险（Perl 5.32 + Python 3 双语言） | 中 | 中 | Automation |
| R-P2-13 | 11 通知渠道深度集成回滚成本 | 中 | 低 | Alert |

### 1.4 P3 风险（6 项，低等级）

| 编号 | 风险 | 概率 | 影响 | 模块 |
|------|------|------|------|------|
| R-P3-01 | Alert 事件溯源（Event Sourcing）高级能力缺失 | 高 | 低 | Alert |
| R-P3-02 | Dashboard 物化视图 SQL 复杂度 | 中 | 低 | Alert/BI |
| R-P3-03 | SBOM 中文路径兼容性 | 低 | 低 | DevOps |
| R-P3-04 | 5 家 Git Provider Webhook 事件字段差异 | 中 | 低 | DevOps |
| R-P3-05 | v1/v2 adapter 废弃时序未量化 | 低 | 低 | Alert |
| R-P3-06 | 前端 PipelineEditor 泳道交互细节 | 中 | 低 | DevOps/前端 |

### 1.5 v5 新增 CC 风险（8 份 NL 一手代码实证后追加，2026-10-03）

> **来源**：`cross-review-synthesis-2026-10-03-v5.md` §16
> **说明**：8 份 NeatLogic 一手代码实证证伪了 v4 中 3 项"专家口吻幻觉"，同时新增 9 项 CC 风险（6 项严重级 + 3 项建模认知）。

#### 1.5.1 严重级（P0，阻塞执行）— 新增 3 项

> **v5.1 状态更新（2026-10-03 ADR-010 后补）**：R-P0-03-v2 已通过 ADR-010 决策解决，状态从"阻塞"降级为"已决策"（执行阶段门控）；新增 R-P2-14（AlertBreaker Serializable 死锁概率）到 §1.5.3。

| 编号 | 风险 | 概率 | 影响 | 模块 | 依据 | 状态 |
|------|------|------|------|------|------|------|
| ~~**R-P0-03-v2**~~ | AlertBreaker 并发窗口模型未复刻 | 中 | 高 | Alert | NL-3：`AlertBreakerMapper.getAlertBreakerStateForUpdate()` 直接用 mapper 行锁 | ✅ **已决策**（ADR-010：PG `SELECT FOR UPDATE` 行锁方案 A）|
| **R-P0-04** | RDM statistics/burndown/velocity 3 个统计 API 无后端 | 高 | 高 | RDM | NL-3：Orion `api/rdm.ts` 有 4 个 `/statistics/*` 调用，Go 无 handler | ⏳ 待执行 |
| **R-P0-05** | RDM 代码评审 Tab 无后端（前端调 `/rdm/code-reviews`） | 高 | 中 | RDM | NL-3：Go 后端无 code-review handler | ⏳ 待执行 |

#### 1.5.2 数据修正（P1）— 新增 2 项

| 编号 | 风险 | 依据 | 影响 |
|------|------|------|------|
| **R-P1-01** | Report Designer 覆盖度低估（BI 20% → 55-65%） | NL-3：10 JFreeChart widget + 7 Mapper 是真实实现 | 决策层可能基于错误数字低估 BI 能力 |
| **R-P1-02** | Alert 事件处理器注册表未实现（EventHandler Factory） | NL-3：`AlertEventHandlerFactory` 有 25+ event handlers | Orion Alert 若做统一事件模型，需 EventHandler 类型注册表 |

#### 1.5.3 认知修正（P2）— 新增 2 项

| 编号 | 风险 | 依据 | 影响 |
|------|------|------|------|
| **R-P2-01** | NeatLogic 术语 vs Orion 术语不一致（Issue-centric vs Sprint-centric） | NL-3：NeatLogic 99 Api.java vs Orion 4 Tab | API 契约文档层 P2，长期影响客户认知 |
| **R-P2-14** | AlertBreaker Serializable 事务死锁概率（ADR-010 引入） | ADR-010 §4.1：PG Serializable 隔离级别在高并发下可能触发死锁 | 概率低 / 影响中——5s 事务超时 + `deadlock_timeout=1s` + tenant 分片缓解；监控 `alert_breaker_deadlock_total > 0` 告警 |

#### 1.5.4 CC-NEATLOGIC 系列（建模认知修正，非代码风险）— 新增 3 项

| 编号 | 认知修正 | 依据 | 影响 |
|------|---------|------|------|
| **CC-NEATLOGIC-01** | NeatLogic Change 是 ProcessTask StepHandler，非独立工单 | NL-6：`ChangeProcessStepHandlerType.CHANGECREATE/CHANGEHANDLE` | Orion 若做 Change 独立工单，与 NL 建模不一致；影响 API 契约对齐 |
| **CC-NEATLOGIC-02** | NeatLogic Event 与 Alert 零耦合 | NL-6：26 个 `Event` 命中全部是 `AlertEvent*` 命名 | Orion Event 模块若做独立域，需注意与 NL 的语义边界不同 |
| **CC-NEATLOGIC-03** | NeatLogic Tagent 是 Perl 5.32 + Python 3 host agent（94 文件 / 9321 行），非 AI Agent | NL-4：Tagent 双语言 + tar/zip 二进制分发 | Orion 若引用"Tagent"概念，需明确这是主机 agent 而非 AI 概念 |

#### 1.5.5 风险登记册最终统计（v5.1 更新）

| 级别 | v4 数量 | v5 数量 | **v5.1 数量** | 变化 |
|------|---------|---------|--------------|------|
| P0 | 8 | 11 | **10**（R-P0-03-v2 移出）| -1 |
| P1 | 15 | 17 | **17** | 0 |
| P2 | 13 | 14 | **15** | +1（R-P2-14 新增）|
| P3 | 6 | 6 | **6** | 0 |
| **CC-NEATLOGIC 系列** | 0 | 3 | **3** | 0 |
| **总计** | **42** | **51** | **51** | 0（R-P0-03-v2 状态降级不计入 P0；R-P2-14 新增抵消）|

**说明**：R-P0-03-v2 从"P0 阻塞"降级为"已决策"，风险登记册**总数不变**（51 项），但**阻塞级别从 P0 降至执行阶段门控**——不再阻塞设计评审。

#### 1.5.6 v5 撤回（R-P0-03 原条目保留但状态改为"重估"）

**R-P0-03（原）**"Alert 5 家族 memory→PG 数据丢失" 在 v5 中**降级为"重估中"**：
- **NL-3 一手证据**：NeatLogic 用 AlertBreaker 统一抽象 + 22 Mapper + 20 XML 全部走 PG，5 家族并非 memory-only
- **保留原因**：Orion 侧 5 家族能力覆盖度仍需重新评估（NL 的实现方式 Orion 未必完全复刻）
- **新替代风险**：R-P0-03-v2（AlertBreaker 并发窗口模型选型）取代原 R-P0-03 的核心讨论

### 1.6 v5.4 新增 ADR 决策引入的风险（11 项，2026-10-03）

> **来源**：ADR-010/011/012/013/014 决策完成（合计 2279 行）
> **说明**：5 份 ADR 在决策过程中识别并引入 11 项新风险，全部登记于此。

#### 1.6.1 P1 严重级（新增 2 项）

| 编号 | 风险 | 概率 | 影响 | 模块 | ADR |
|------|------|------|------|------|-----|
| **R-P1-16** | Artifact 表膨胀（大小文件堆积）| 中 | 中 | Automation/Pipeline | ADR-014 §4.1 |
| **R-P1-17** | 大文件写入阻塞 PG（>10MB 时）| 低 | 中 | Automation/Pipeline | ADR-014 §4.1 |

#### 1.6.2 P2 中等级（新增 9 项）

| 编号 | 风险 | 概率 | 影响 | 模块 | ADR |
|------|------|------|------|------|-----|
| **R-P2-14** | AlertBreaker Serializable 事务死锁概率 | 低 | 中 | Alert | ADR-010 §4.1 |
| **R-P2-15** | Repository 改造遗漏（TenantAwareDB 抽象）| 中 | 高 | 全平台基础设施 | ADR-011 §4.1 |
| **R-P2-16** | Schema 连接池爆炸（租户数×连接数）| 低 | 中 | 多租户 | ADR-011 §4.1 |
| **R-P2-17** | 多 schema Migration 失败（版本对齐）| 中 | 中 | 多租户 | ADR-011 §4.1 |
| **R-P2-18** | CMDB 类型系统校验破坏现有写入 | 低 | 中 | CMDB | ADR-013 §4.1 |
| **R-P2-19** | CMDB type_id 回填脚本失败 | 低 | 中 | CMDB | ADR-013 §4.1 |
| **R-P2-20** | Factory Handler 重复注册 | 低 | 低 | 全平台 | ADR-012 §4.1 |
| **R-P2-21** | Factory Handler 类型字符串错误 | 低 | 中 | 全平台 | ADR-012 §4.1 |

#### 1.6.3 风险登记册最终统计（v5.4 更新）

| 级别 | v5.1 数量 | **v5.4 数量** | 变化 |
|------|-----------|--------------|------|
| P0 | 10 | **7**（-3）| R-P0-01/03-v2/07 降级 |
| P1 | 17 | **19**（+2）| R-P1-16/17 新增 |
| P2 | 15 | **24**（+9）| R-P2-14~21 新增 |
| P3 | 6 | **6** | 0 |
| CC-NEATLOGIC | 3 | **3** | 0 |
| **总计** | **51** | **59**（+8）| 5 ADR 引入 11 项新风险 |

#### 1.6.3.1 v5.5 AI 决策风险补充（+3 项，2026-10-11）

> **来源**：`enterprise-architecture-depth-review-2026-10-11.md` §6.4 NEW-EA-12；U12 `docs/ai-decision-sla-eval-2026-10-11.md`；U13 `docs/llm-security-hardening-2026-10-11.md`
> **说明**：U12/U13/U15 定义 8 类 AI 决策 SLA/评测集 + LLM 安全防护 + AI 护城河保护后，识别 3 项**跨决策类型的系统性风险**，全部登记为 P1（不阻塞设计评审，但阻塞 S4 阶段前执行）。

| 编号 | 风险 | 概率 | 影响 | 模块 | 依据 |
|------|------|------|------|------|------|
| **R-P1-18** | AI RCA 误判告警根因 → 触发误静默 → 用户漏看真实故障 | 中 | 高 | Alert/RCA | U12 §4.2 RCA L2 分档；Google SRE Ch.25 Failure Injection |
| **R-P1-19** | AI Self-Healing 误修复 → 二次故障（如错误重启导致数据丢失）| 中 | 高 | Self-Healing | U12 §4.3 Self-Healing L2；AWS WA REL03-BP01 |
| **R-P1-20** | AI Code Review 遗漏真实 P0 缺陷 → 缺陷进入生产 | 中 | 中 | AI Code Review | U12 §4.1 Code Review L1；AWS WA LLM01-BP01 |

**v5.5 更新后统计**：

| 级别 | v5.4 数量 | **v5.5 数量** | 变化 |
|------|-----------|--------------|------|
| P0 | 7 | **7** | 0 |
| P1 | 19 | **22**（+3）| R-P1-18/19/20 新增 |
| P2 | 24 | **24** | 0 |
| P3 | 6 | **6** | 0 |
| CC-NEATLOGIC | 3 | **3** | 0 |
| **总计** | **59** | **62**（+3）| AI 决策风险 3 项 |

**关闭依据**：R-P1-18/19/20 通过 U12 定义的 L2/L1 人工确认边界 + 降级路径 + 评测集 SLA 可缓解；关闭时点为 S4 阶段门控 GATE-AI-SLA-4 通过后。

#### 1.6.3.2 v5.7 数据治理 + 测试质量风险补充（+8 项，2026-10-11）

> **来源**：`docs/ddd-tdd-test-coverage-expert-review-2026-10-11.md`（NEW-EA-16）+ `docs/ddd-tdd-test-strategy-design-v2-2026-10-11.md`（NEW-EA-19）+ `docs/enterprise-readiness-assessment-2026-10-11.md`（NEW-EA-18）
> **说明**：NEW-EA-16/18/19 一手实测发现测试质量 + 数据治理 8 项系统性风险。其中 3 项（R-P1-21/22/23）为 NEW-EA-19 v2 评审新增，5 项为数据治理 4 + ADR 状态 1 补充。

| 编号 | 风险 | 概率 | 影响 | 模块 | 依据 |
|------|------|------|------|------|------|
| **R-P1-21** | 假绿灯反模式（mockEventStore）→ 生产代码 0% 覆盖但测试全绿 → 缺陷进入生产 | 高 | 高 | eventstore | NEW-EA-19 v2 §3.1 W1；Google SRE Ch.11 |
| **R-P1-22** | ADR 状态字段缺失 → 决策状态无法自动化追踪 → 引用已废弃 ADR | 中 | 中 | ADR 治理 | NEW-EA-18 §3 治理维度 46/60；adr-lint.sh |
| **R-P1-23** | 测试覆盖率不足（38.16%）→ 企业级不达标（29.2/100）→ 阻塞 S4 阶段 | 高 | 高 | 全局 | NEW-EA-16/18；GATE-TEST-COVERAGE-60 |
| **R-P1-24** | Repository 集成测试缺失 → SQL 行为未验证 → 迁移破坏不可见 | 中 | 高 | Repository | NEW-EA-16 §4 16 零测试模块；ADR-016 |
| **R-P1-25** | Handler 契约测试缺失 → API 契约破坏不可见 → 前后端断裂 | 中 | 中 | Handler | NEW-EA-17 §3；ADR-016 OpenAPI |
| **R-P0-09** | DDD 基础设施零测试（eventstore 0% / Saga 23 方法 0%）→ 核心域无保护 | 高 | 极高 | DDD | NEW-EA-16 §3；R-P0-10 升级 |
| **R-P0-10** | Migration 号段冲突（699-782 计划全空）→ 落地时冲突 → 数据库损坏 | 中 | 极高 | Migration | GATE-MIGRATION-699-765 BLOCK |
| **R-P1-26** | 渐进式门控 ramp 配置错误 → CI 阈值跳跃 → 阻断发布 | 低 | 中 | 门控 | NEW-EA-19 v2 §2.2 T0-T3 |

**v5.7 更新后统计**：

| 级别 | v5.5 数量 | **v5.7 数量** | 变化 |
|------|-----------|--------------|------|
| P0 | 7 | **9**（+2）| R-P0-09/10 新增（数据治理升级）|
| P1 | 22 | **26**（+4）| R-P1-21/22/23/24/25/26 新增 6 项（-2 合并到既有 R-P1-21）|
| P2 | 24 | **24** | 0 |
| P3 | 6 | **6** | 0 |
| CC-NEATLOGIC | 3 | **3** | 0 |
| 数据治理 | 0 | **2** | R-P0-09/10 分类 |
| **总计** | **62** | **70**（+8）| 测试质量 + 数据治理 8 项 |

**关闭依据**：
- R-P1-21 假绿灯：通过 ADR-016 Testcontainers + GATE-TEST-ANTI-PATTERN（BLOCK）关闭
- R-P1-22 ADR 状态：通过 adr-lint.sh + GATE-ADR-STATUS-NORMALIZED 关闭
- R-P1-23 测试覆盖：通过 GATE-TEST-COVERAGE-60 渐进式 ramp（T0=38/T1=45/T2=55/T3=60）关闭
- R-P1-24/25：通过 ADR-016 Repository/Handler 测试骨架关闭
- R-P0-09/10：通过 ADR-017 数据治理测试一体化关闭

#### 1.6.4 P0 阻塞项最终状态（v5.4）

| 编号 | 风险 | 状态 | 关闭依据 |
|------|------|------|---------|
| R-P0-01 | StageExecutor artifact 传播破坏 | ⚠️ 降级为 P1 | ADR-014 Feature Flag + 灰度 + 降级剧本 |
| R-P0-02 | SSH/WinRM/K8s-Exec 依赖引入 CVE | ⏳ 待执行 | 需 CVE 审计 |
| R-P0-03 | Alert 5 家族 memory→PG 数据丢失 | ⚠️ 已重估 | NL-3 一手证据 |
| ~~R-P0-03-v2~~ | AlertBreaker 并发窗口模型未复刻 | ✅ 已决策 | ADR-010 方案 A |
| R-P0-04 | RDM statistics 3 后端 | ⏳ 待执行 | S7 阶段 |
| R-P0-05 | RDM code-review handler | ⏳ 待执行 | S7 阶段 |
| R-P0-06 | 模块合并破坏引用方 | ⏳ 待执行 | S4 阶段 |
| ~~R-P0-07~~ | CMDB 二阶模型迁移破坏 cmdb_cis | ⚠️ 降级为 P2 | ADR-013 方案 C 渐进式 |
| R-P0-08 | 5 新子域过度设计 | ⏳ 待执行 | S4 阶段 |

**P0 阻塞项**：从 8 项降至 **5 项**（R-P0-02/04/05/06/08 待执行，其余已决策/降级）

### 1.7 统一编号对照表（v5.4 最终态，59 项）

> **目的**：解决 §1.5 v5 新增风险与 §1.1-1.3 v4 原始风险的编号冲突问题。
> **编号冲突说明**：§1.5 中 R-P0-04/05、R-P1-01/02、R-P2-01 与 §1.1-1.3 中的同编号风险是**完全不同的风险项**。为避免混淆，本对照表为 §1.5 新增风险分配唯一编号（加 `-v5` 后缀），并在全文档中标注。

#### 1.7.1 v4 原始 42 项（§1.1-1.4，保持原编号不变）

| 级别 | 编号范围 | 数量 | v5.4 状态变更 |
|------|---------|------|-------------|
| P0 | R-P0-01 ~ R-P0-08 | 8 | R-P0-01→P1（ADR-014 灰度）/ R-P0-03→重估（NL-3）/ R-P0-07→P2（ADR-013 渐进）|
| P1 | R-P1-01 ~ R-P1-15 | 15 | 无降级 |
| P2 | R-P2-01 ~ R-P2-13 | 13 | 无降级 |
| P3 | R-P3-01 ~ R-P3-06 | 6 | 无变化 |
| **小计** | | **42** | |

#### 1.7.2 v5 新增 9 项（§1.5，加 `-v5` 后缀以避免冲突）

| 原编号（§1.5） | 统一编号 | 风险 | 级别 | 来源 | 状态 |
|---------------|---------|------|------|------|------|
| R-P0-03-v2 | R-P0-03-v2 | AlertBreaker 并发窗口模型 | P0 | NL-3 | ✅ 已决策（ADR-010）|
| R-P0-04（§1.5）| **R-P0-04-v5** | RDM statistics/burndown/velocity 3 API 无后端 | P0 | NL-3 | ⏳ 待执行（S7）|
| R-P0-05（§1.5）| **R-P0-05-v5** | RDM 代码评审 Tab 无后端 | P0 | NL-3 | ⏳ 待执行（S7）|
| R-P1-01（§1.5）| **R-P1-01-v5** | Report Designer 覆盖度低估（BI 20%→55-65%） | P1 | NL-3 | 📊 数据修正 |
| R-P1-02（§1.5）| **R-P1-02-v5** | Alert 事件处理器注册表未实现 | P1 | NL-3 | ⏳ 待执行 |
| R-P2-01（§1.5）| **R-P2-01-v5** | NeatLogic vs Orion 术语不一致 | P2 | NL-3 | 📝 文档层 |
| R-P2-14（§1.5）| R-P2-14 | AlertBreaker Serializable 事务死锁 | P2 | ADR-010 | ⏳ 监控 |
| CC-NL-01 | CC-NL-01 | Change 是 ProcessTask StepHandler | 认知 | NL-6 | ⏳ ADR-015 前置 |
| CC-NL-02 | CC-NL-02 | Event 是纯静态配置 | 认知 | NL-6 | ⏳ ADR-015 前置 |
| CC-NL-03 | CC-NL-03 | Tagent 是 Perl 主机 Agent | 认知 | NL-4 | ✅ 已对齐 |
| **小计** | | **10**（含 R-P0-03-v2 已决策） | | | |

> **注意**：§1.5 原文中 R-P0-04/05、R-P1-01/02、R-P2-01 的含义与 §1.1-1.3 完全不同。本文档后续引用这些编号时，以 `-v5` 后缀区分 v5 新增风险，无后缀为 v4 原始风险。G1 §4 中引用的 R-P0-04/05 均指 v5 版本。

#### 1.7.3 v5.4 ADR 引入 11 项（§1.6，编号无冲突）

| 级别 | 编号范围 | 数量 | 来源 ADR |
|------|---------|------|---------|
| P1 | R-P1-16 ~ R-P1-17 | 2 | ADR-014 |
| P2 | R-P2-14 ~ R-P2-21 | 8 | ADR-010/011/012/013 |
| **小计** | | **10**（R-P2-14 与 §1.5 重复，实际 8 新增 + 2 P1）| |

> **注意**：R-P2-14 同时出现在 §1.5（v5 新增）和 §1.6（ADR 引入）中，实际是同一风险项（AlertBreaker Serializable 死锁），不重复计数。

#### 1.7.4 最终统计（与 G1 §4 对齐）

| 级别 | v4 原始 | v5 新增 | ADR 新增 | 降级/决策 | **v5.4 最终** |
|------|---------|---------|---------|----------|-------------|
| P0 | 8 | +3（R-P0-03-v2, R-P0-04-v5, R-P0-05-v5） | 0 | -3（R-P0-01→P1, R-P0-03→重估, R-P0-07→P2, R-P0-03-v2→已决策）| **7** |
| P1 | 15 | +2（R-P1-01-v5, R-P1-02-v5） | +2（R-P1-16, R-P1-17） | +1（R-P0-01 降入）| **19** |
| P2 | 13 | +2（R-P2-01-v5, R-P2-14） | +8（R-P2-14~21，-1 重复） | +1（R-P0-07 降入）| **24** |
| P3 | 6 | 0 | 0 | 0 | **6** |
| CC | 0 | +3（CC-NL-01/02/03） | 0 | 0 | **3** |
| **总计** | **42** | **+10** | **+10**（-1 重复） | **-3 降级** | **59** |

> **核对公式**：42 + 10 + 10 - 1（R-P2-14 重复）- 2（R-P0-03-v2 已决策 + R-P0-03 重估不计为 P0）= 59 ✅

#### 1.7.5 P0 阻塞项最终清单（7 项，含降级后的实际阻塞项）

| 编号 | 风险 | v5.4 状态 | 阻塞阶段 | 关联任务 |
|------|------|----------|---------|---------|
| R-P0-02 | SSH/WinRM/K8s-Exec CVE | ⏳ 待执行 | S4 | S4-T5 |
| **R-P0-04-v5** | RDM statistics 3 API 无后端 | ⏳ 待执行 | S7 | S7-T1 |
| **R-P0-05-v5** | RDM code-review handler 无后端 | ⏳ 待执行 | S7 | S7-T2 |
| R-P0-06 | 模块合并破坏引用方 | ⏳ 待执行 | S3 | S3-T9/T10 |
| R-P0-08 | 5 新子域过度设计 | ⏳ 待执行 | S3 | S3-T7/T8 |
| R-P0-01 | StageExecutor artifact 传播 | ⚠️ 降级为 P1 | — | ADR-014 Feature Flag |
| R-P0-03 | Alert 5 家族 memory→PG | ⚠️ 重估中 | — | NL-3 证实非 memory-only |

**实际阻塞 P0 = 5 项**（R-P0-02/04-v5/05-v5/06/08），R-P0-01/03 为"降级后保留观察"。

---

## 2. 5 大降级策略

### 2.1 策略 A：功能降级（Feature Fallback）

**适用场景**：新功能引入破坏现有稳定功能

**实施模式**：
- 通过 feature flag 控制新功能启用
- 失败时自动回退到原逻辑
- 不影响数据持久化

**典型应用**：

| 场景 | 新逻辑 | 降级回退 | 触发条件 |
|------|--------|---------|---------|
| StageExecutor artifact 传播 | ArtifactBus 跨 stage 写读 | 原 L503-511 逻辑（不传播） | ArtifactBus.Publish 失败 3 次 |
| TaskRunner SSH/K8s-Exec | 3 新 case + 真实执行 | 跳过该 task，标记 skipped | SSH/K8s 连接超时 |
| Alert 通知渠道租户隔离 | TenantContext 注入 | 原 L311 单点 tenant_id 提取 | TenantContext 解析失败 |
| BI Execute 真实化 | 真实 SQL 执行 + PDF 生成 | 返回 stubbed PDF + 标"待实现" | SQL 执行超时 |
| AppConfig 三层合并 | env > module > system 合并 | system 层兜底 | 合并冲突 |

**Feature Flag 实现**：
```go
// 通过环境变量控制
if os.Getenv("ARTIFACT_BUS_ENABLED") == "1" {
    s.artifactBus = newArtifactBus(repo)
} else {
    s.artifactBus = noopArtifactBus{}  // 空实现
}
```

### 2.2 策略 B：双写过渡（Dual-Write Transition）

**适用场景**：存储迁移（memory → PG / 旧表 → 新表）

**实施模式**：
1. 新存储写入 + 旧存储写入（双写）
2. 读优先新存储，失败回退旧存储
3. 数据校验脚本对比一致性
4. 验证后切读新存储
5. 双写期 2 周后下线旧存储

**典型应用**：

| 场景 | 旧存储 | 新存储 | Migration |
|------|--------|--------|----------|
| Alert 主表持久化 | memory（重启丢失） | alerts PG 表 | 735 |
| Alert correlation 持久化 | memory | alert_correlations PG | 736 |
| Alert dedup 持久化 | memory | alert_dedup_fingerprints | 737 |
| Alert silence 持久化 | memory | alert_silences | 738 |
| Alert rule-engine 持久化 | memory | alert_rules | 739 |
| ITSM Workcenter | tickets 字段扩展 | workcenter_* 4 表 | 710 |
| RDM tasks | tickets 表 | rdm_tasks + tickets 双向关联 | 747 |

**双写期数据校验脚本**：
```sql
-- alert 双写期校验
SELECT COUNT(*) FROM alert_correlations_memory_export
WHERE id NOT IN (SELECT memory_id FROM alert_correlations);

-- 期望：0（所有 memory 数据已同步到 PG）
```

### 2.3 策略 C：灰度切换（Canary Rollout）

**适用场景**：高风险改动需逐步验证

**实施模式**：
1. Dev 环境全量执行
2. Staging 单实例执行 + 观察 24h
3. Prod-Canary 1 实例执行 + 观察 24h
4. Prod-Full 全量执行

**典型应用**：

| 场景 | 灰度步长 | 监控指标 |
|------|---------|---------|
| Alert 通知渠道租户隔离 | 3 渠道先灰度（Slack/Dingtalk/Email） | 通知成功率 / 租户隔离错误 |
| K8s Adapter Apply | 单 namespace 先行 | Apply 成功率 / 超时率 |
| StageExecutor artifact 传播 | 单 pipeline 先行 | artifact 传播成功率 |
| AppPipeline 绑定 | 单 App 先行 | 触发成功率 |
| BI Execute 真实化 | 单报表先行 | SQL 执行时间 |

### 2.4 策略 D：Migration 回滚（Migration Rollback）

**适用场景**：数据库结构变更失败

**实施模式**：
- 每个 migration 必须有 `_down.sql`
- 逆序回滚（后建的先删）
- ALTER 类用 `IF EXISTS` 保护
- 不可逆 migration 标记 `IRREVERSIBLE:` + 提供快照导出

**模块级回滚剧本**（按 BB §8.1 模块顺序）：

```bash
# CMDB 全量回滚（699-704 逆序）
for n in 704 703 702 701 700 699; do
    psql -f migrations/${n}_cmdb_*_down.sql
done

# ITSM 全量回滚（705-712 逆序）
for n in 712 711 710 709 708 707 706 705; do
    psql -f migrations/${n}_itsm_*_down.sql
done

# Alert 全量回滚（735-744 逆序）
for n in 744 743 742 741 740 739 738 737 736 735; do
    psql -f migrations/${n}_alert_*_down.sql
done
```

### 2.5 策略 E：数据修复脚本（Data Repair Script）

**适用场景**：数据已损坏但 migration 无法回滚（如 698）

**实施模式**：
- 提供数据快照导出脚本
- 提供数据修复 SQL（基于业务规则）
- 提供数据回填脚本（从备份恢复）

**典型应用**：
```sql
-- 698 数据修复（已应用）
UPDATE ticket_sla_tracking
    SET target_resolution_time_ms = target_resolution_time_ms * 1000
  WHERE target_resolution_time_ms <> 0;

-- 假设：Alert memory → PG 双写期数据不一致
-- 修复：从 memory 重新同步到 PG
INSERT INTO alert_correlations (...)
SELECT ... FROM alert_correlations_memory_export
ON CONFLICT (id) DO UPDATE SET ...;
```

---

## 3. 模块级回滚剧本（8 个）

### 3.1 CMDB 回滚剧本

**触发条件**：
- CI 类型系统破坏现有 cmdb_cis 读取
- Collector 无法发现新 CI 类型
- 验证脚本报"foreign key constraint fails"

**回滚步骤**：
1. 代码层：从 `wiring.go` 注释 `wireCmdbCiType` 等 6 行
2. 数据层：`psql -f migrations/704_cmdb_ci_attr_values_down.sql`（逆序）
3. 验证：`SELECT * FROM cmdb_cis LIMIT 10`（应不受影响）
4. 通知：CMDB 二阶模型回滚到 698 状态

### 3.2 ITSM 回滚剧本

**触发条件**：
- SLA 策略与现有 ticket SLA 跟踪冲突
- Workcenter 4 表与 tickets 双写不一致

**回滚步骤**：
1. 代码层：注释 `wireItsmSlaEngine` / `wireWorkcenter`
2. 数据层：`psql -f migrations/710_itsm_workcenter_tables_down.sql`
3. 验证：`SELECT * FROM tickets LIMIT 10`（应保留扩展字段）
4. 通知：ITSM SLA 降级到原 698 calculator

### 3.3 Inspection 回滚剧本

**触发条件**：
- 阈值引擎 JSONPath 性能瓶颈
- ConfigFile 版本管理破坏现有 inspection_records

**回滚步骤**：
1. 代码层：注释 `wireInspectionV2`
2. 数据层：`psql -f migrations/720_inspection_jobs_down.sql`（逆序到 713）
3. 验证：`SELECT * FROM inspection_records LIMIT 10`
4. 通知：Inspection 降级到 v1 CRUD 骨架

### 3.4 Automation 回滚剧本

**触发条件**：
- StageExecutor artifact 传播破坏现有 pipeline
- 5 新子域与 pipeline 生态冲突

**回滚步骤**：
1. 代码层：移除 StageExecutor L503-511 的 ArtifactBus 调用（保留 5-10 行改动）
2. 数据层：`psql -f migrations/728_automation_artifact_bus_down.sql`
3. 移除 5 子域：删除 `internal/automation-{catalog,scenario,profile,combop,customtemplate}/`
4. 验证：`go build ./...` 0 错误
5. 通知：Automation 降级到 3 TaskRunner（shell/docker/sub-pipeline）

### 3.5 BI 回滚剧本

**触发条件**：
- Execute 真实化后大查询超时
- Dashboard widget 与前端契约不匹配

**回滚步骤**：
1. 代码层：恢复 report-designer handler 的 stubbed Execute
2. 数据层：`psql -f migrations/734_bi_metadata_collections_down.sql`（逆序到 729）
3. 验证：`SELECT * FROM report_executions LIMIT 10`
4. 通知：BI 降级到 stubbed Execute + 空 Components map

### 3.6 Alert 回滚剧本

**触发条件**：
- 5 家族 memory→PG 数据丢失
- 通知渠道租户隔离破坏

**回滚步骤**：
1. 代码层：TenantContext 变可选，回退到原 L311 逻辑
2. 数据层：repository 切回 memory（PG 数据保留但不读）
3. 验证：alert 主链路 5 步（Ingest/RuleEval/Route/Notify/Escalate）全绿
4. 通知：Alert 降级到 5 家族 memory 模式

### 3.7 RDM 回滚剧本

**触发条件**：
- 前端 44 API 路径与后端不匹配
- Ticket 扩展字段破坏现有工单流

**回滚步骤**：
1. 代码层：注释 `wireRDM`
2. 数据层：`psql -f migrations/754_rdm_ticket_ext_down.sql`（ALTER DROP COLUMN IF EXISTS）
3. 验证：`SELECT * FROM tickets LIMIT 10`（应保留原字段）
4. 通知：RDM 降级到前端 4 Tab + 100% 404 状态（回归基线）

### 3.8 DevOps 回滚剧本

**触发条件**：
- K8s/Helm/ArgoCD 集成测试失败
- AppConfig 三层合并逻辑错误

**回滚步骤**：
1. 代码层：从 `wiring.go` 注释 `wireAppconfig` / `wireApppipeline` / 5 个 client
2. 数据层：`psql -f migrations/765_devops_git_providers_down.sql`（逆序到 755）
3. 验证：`go build ./...` 0 错误
4. 通知：DevOps 降级到 HTTP Runner + 单一部署目标

---

## 4. 跨模块回滚剧本（4 个）

### 4.1 跨模块剧本 1：Alert → ITSM Incident 升级链断

**触发**：Alert 升级时 ITSM CreateIncident 失败

**降级**：
1. Alert escalation 模块捕获 ITSM 失败
2. 降级到 Slack/PagerDuty 直接通知（绕过 ITSM）
3. 写入 alert_escalation_failures 表（新建）
4. 重试 3 次后放弃，标 escalated_without_itsm

### 4.2 跨模块剧本 2：Automation → CMDB Runner 目标 CI 缺失

**触发**：TaskRunner SSH 目标机器在 CMDB 中找不到 CI

**降级**：
1. SSH Runner 直接用 IP/Host 连接（绕过 CMDB）
2. 写入 automation_runner_targets 表标 orphan_target
3. 告警通知 CMDB admin 补登记

### 4.3 跨模块剧本 3：RDM ↔ Ticket 双向耦合破坏

**触发**：RDM rdm_tasks 与 tickets 同步失败

**降级**：
1. RDM 改为单写 rdm_tasks（不双向同步 tickets）
2. tickets 字段保留但 RDM 不读
3. 通知 ITSM admin 手动同步

### 4.4 跨模块剧本 4：DevOps AppConfig 合并冲突

**触发**：env/module/system 三层合并时同字段冲突

**降级**：
1. system 层兜底（最低优先级但保证有值）
2. 记录 conflict_log 表
3. 通知 AppConfig admin

---

## 5. 门控指标（Stage Gate Metrics）

### 5.1 阶段进入门控（4 项硬指标）

| 阶段 | 指标 1 | 指标 2 | 指标 3 | 指标 4 |
|------|--------|--------|--------|--------|
| S0 → S1 | go build 0 错误 | Migration 698 已应用 | PG 14+ | ls 699*.sql 空 |
| S1 → S2 | CMDB 6 表 CRUD 测试通过 | CI 类型服务可用 | cmdb_cis 不受影响 | Wiring 编译通过 |
| S2 → S3 | ITSM SLA 单测通过 | Workcenter 4 表测试通过 | tickets 双写一致 | 9 端点契约对齐 |
| S3 → S4 | Inspection 阈值引擎测试通过 | ConfigFile 版本管理测试通过 | 8 端点契约对齐 | 规则不循环 |
| S4 → S5 | Automation 5 子域单测通过 | StageExecutor artifact 测试通过 | 6 TaskRunner 各 3 用例通过 | pipeline 不破坏 |
| S5 → S6 | BI Execute 真实化测试通过 | Dashboard widget 单测通过 | 大查询 < 30s | PDF 生成成功 |
| S6 → S7 | Alert 5 家族 PG 持久化测试通过 | 通知渠道租户隔离测试通过 | Oncall/Shift/SLA/Dashboard 4 模块测试通过 | 双写一致 |
| S7 → S8 | RDM 8 子域测试通过 | 前端 44 API 全部 200 | tickets 扩展字段双写一致 | 7 端点契约对齐 |
| S8 → Prod | DevOps Runner 多协议测试通过 | K8s/Helm Adapter 测试通过 | AppConfig 合并测试通过 | AppPipeline 绑定测试通过 |

### 5.2 出口指标（阶段完成后）

| 阶段 | 完成指标 |
|------|---------|
| S1 完成 | CMDB 完成度 65-70% |
| S2 完成 | ITSM 完成度 55-60% |
| S3 完成 | Inspection 完成度 55-65% |
| S4 完成 | Automation 完成度 62-68% |
| S5 完成 | BI 完成度 65-70% |
| S6 完成 | Alert 完成度 72-75% |
| S7 完成 | RDM 完成度 65-70% |
| S8 完成 | DevOps 完成度 62-68% |

### 5.3 全局出口指标

| 指标 | 目标 |
|------|------|
| `go build ./...` | 0 错误 |
| `go test ./...` | 全绿（含新增测试） |
| `go vet ./...` | 0 警告 |
| 路由冲突扫描 | 0 冲突 |
| 前后端契约对齐 | ≥95% |
| Migration up/down 幂等 | 全部验证 |
| 8 模块完成度均值 | ≥65% |

---

## 6. 监控与告警（与 Alert 模块联动）

### 6.1 新增监控指标

| 指标 | 类型 | 来源 | 告警阈值 |
|------|------|------|---------|
| `artifact_bus_publish_failures_total` | Counter | Automation | >10/min |
| `runner_ssh_connection_failures_total` | Counter | Automation/DevOps | >5/min |
| `alert_pg_persistence_lag_ms` | Histogram | Alert | p99 > 5000ms |
| `notification_tenant_isolation_errors_total` | Counter | Alert | >0 |
| `k8s_adapter_apply_timeout_total` | Counter | DevOps | >3/min |
| `appconfig_merge_conflicts_total` | Counter | DevOps | >5/min |
| `bi_execute_query_duration_ms` | Histogram | BI | p99 > 30000ms |
| `rdm_ticket_sync_failures_total` | Counter | RDM/ITSM | >0 |
| `migration_apply_failures_total` | Counter | AA | >0 |
| `wiring_startup_failures_total` | Counter | BB | >0 |

### 6.2 告警规则

每个指标对应一条 AlertRule（写入 alert_rules 表，Migration 739）：
- 严重度：critical / warning / info
- 触发条件：Prometheus metric threshold
- 通知渠道：Slack + PagerDuty
- 升级策略：5 分钟未响应 → Oncall 值班人 → 30 分钟 → ITSM Incident

---

## 7. 风险与 NeatLogic 一手代码扫描的关联

### 7.1 已识别风险（NL-4 已落地）

| 风险 | NL-4 发现 | 影响 |
|------|----------|------|
| Tagent 引入风险（R-P2-12） | Tagent 是 Perl 5.32 + Python 3 双语言（94 文件 / 9321 行） | 中-高：引入需 Perl 运行时 |
| 8 个空目录误判 | 是 git submodule 未下载，不是空模块 | 低：已有 13 个子模块被抽出 base 目录 |
| Deploy 多云能力 | NeatLogic Deploy 也无 K8s/Helm/ArgoCD 集成（grep 命中 0） | 中：DevOps 多云是 Orion 差异化 |

### 7.2 待识别风险（NL-1/2/3/5 仍在跑）

| 风险 | 待验证 |
|------|--------|
| CMDB 二阶模型冲突 | NeatLogic CMDB 是否有同样二阶结构？ |
| ITSM 工单类型枚举 | NeatLogic Ticket.Type 是否也是自由字符串？ |
| Alert Correlation 算法 | NeatLogic 是否已有滑动窗口关联？ |
| Tagent 引入决策 | NL-5 完成后判断是否引入 Tagent |

**待更新**：NL-1/2/3/5 完成后，本节可能追加新风险条目。

---

## 8. 应急响应剧本

### 8.1 P0 风险应急流程

```
风险触发
    │
    ├─ Step 1: 监控告警（≤1min）
    │   → Slack #orion-alerts + PagerDuty
    │
    ├─ Step 2: Oncall 响应（≤5min）
    │   → 确认是否真 P0
    │
    ├─ Step 3: 决策（≤10min）
    │   → 降级 / 回滚 / 修复
    │
    ├─ Step 4: 执行（≤30min）
    │   → 执行对应模块级回滚剧本
    │
    ├─ Step 5: 验证（≤60min）
    │   → 监控恢复 + 用户验证
    │
    └─ Step 6: 复盘（≤24h）
        → 根因分析 + 防再发措施
```

### 8.2 P1 风险应急流程

```
风险触发
    │
    ├─ Step 1: 监控告警（≤5min）
    ├─ Step 2: Oncall 评估（≤30min）
    ├─ Step 3: 决策降级或修复（≤2h）
    ├─ Step 4: 执行（≤4h）
    └─ Step 5: 复盘（≤48h）
```

### 8.3 数据损坏应急流程

```
数据损坏告警
    │
    ├─ Step 1: 立即冻结写入（≤5min）
    │   → feature flag 关闭相关模块
    │
    ├─ Step 2: 数据快照（≤15min）
    │   → pg_dump --data-only --inserts
    │
    ├─ Step 3: 评估范围（≤30min）
    │   → 哪些表 / 哪些时间窗口
    │
    ├─ Step 4: 修复或回滚（≤2h）
    │   → 数据修复脚本 / migration down
    │
    ├─ Step 5: 数据校验（≤4h）
    │   → 一致性脚本 + 用户验证
    │
    └─ Step 6: 恢复写入（≤6h）
        → feature flag 重启
```

---

## 9. SLO / SLA 定义（Phase 2 新增，大厂级补齐）

> **来源**：`big-tech-adversarial-review-2026-10-03.md` §5.2（P0 缺口）
> **原则**：每模块必须定义**延迟 SLO（P95/P99）+ 可用性 SLA + 数据一致性要求**，作为 Stage Gate 硬指标基础
> **执行约束**：所有 SLO 为**初始目标值**，执行阶段压测后按实际容量校准

### 9.1 8 模块 SLO 目标矩阵

| 模块 | P95 延迟 | P99 延迟 | 可用性 SLA | 数据一致性 | SLO 违约响应 |
|------|---------|---------|-----------|-----------|-------------|
| **CMDB** | <200ms | <500ms | 99.9% | 强一致（CI 属性/关系）| 5min 内 Oncall 响应 |
| **ITSM** | <300ms | <1s | 99.9% | 强一致（状态机）| 5min 内 Oncall 响应 |
| **Alert** | <100ms | <300ms | **99.95%**（关键）| 最终一致（≤30s 传播）| **1min 内 Oncall 响应** |
| **Automation** | <500ms | <2s | 99.5% | 强一致（Job 状态）| 10min 内 Oncall 响应 |
| **Inspection** | <1s | <3s | 99.5% | 最终一致（阈值结果）| 10min 内 Oncall 响应 |
| **BI/Data** | <5s（查询）| <30s（报表）| 99.0% | 最终一致（血缘）| 30min 内响应 |
| **RDM** | <300ms | <1s | 99.5% | 强一致（Ticket）| 10min 内 Oncall 响应 |
| **DevOps** | <1s | <3s | 99.5% | 强一致（部署状态）| 15min 内 Oncall 响应 |
| **Pipeline** | <500ms（触发）| <30s（执行完毕）| 99.5% | 最终一致（Artifact）| 15min 内 Oncall 响应 |

### 9.2 关键 SLO 说明

- **Alert 99.95%**：告警系统必须最可靠，1min 内响应为 P0 违约
- **BI P99=30s**：报表查询允许长尾，但 30s 超时必须告警
- **Pipeline 500ms 触发 + 30s 执行**：触发 vs 执行分离，避免长任务阻塞队列
- **CMDB 强一致**：CI 类型 + 关系必须强一致，否则依赖 CI 的模块（Alert/Inspection）会漂移

### 9.3 SLO 违约升级路径

```
SLO 违约（P95/P99 超标 或 可用性 < SLA）
    │
    ├─ 违约持续 ≤5min → Warning 告警（Slack #orion-slo）
    ├─ 违约持续 5-30min → Critical 告警（PagerDuty）
    ├─ 违约持续 30min-2h → P1 Incident（ITSM 建单）
    └─ 违约持续 >2h → P0 Incident（Oncall 主管）
```

### 9.4 SLO 验证指标（Prometheus）

| 指标 | 类型 | 计算方式 |
|------|------|---------|
| `http_request_duration_ms{module, status}` | Histogram | 后端中间件埋点 |
| `module_availability_ratio{module}` | Gauge | `(200 responses) / (total responses)` 滑动 5min |
| `slo_violation_total{module, type}` | Counter | SLO 检查器周期性上报 |

### 9.5 SLO 校准节奏

- **初始目标**：本表定义为初始目标
- **首次校准**：S0 完成后 + 1 周压测数据
- **常规校准**：每季度基于实际容量数据
- **异常校准**：SLA 违约后 24h 内临时下调（含原因说明）

---

## 10. 容量规划基线（Phase 2 新增，大厂级补齐）

> **来源**：`big-tech-adversarial-review-2026-10-03.md` §5.2（P0 缺口）
> **原则**：所有阈值以**初始参考值**给出，执行阶段压测后必须按实际数据校准
> **强约束**：所有阈值必须写入配置（如 `config.yaml` 的 `capacity_limits`），不得硬编码

### 10.1 租户与多租户容量（ADR-011 支撑）

| 维度 | 初始基线 | 触发告警 | 硬上限 | 处理方式 |
|------|---------|---------|--------|---------|
| **总租户数** | 100 | 200 | **500** | 超 500 强制 Schema-per-tenant |
| **单租户平均 CI 数** | 5,000 | 20,000 | 100,000 | 超过需评估分区 |
| **单租户工单/月** | 1,000 | 5,000 | 50,000 | 超过需评估异步化 |
| **schema 数（Schema-per-tenant 模式）** | 10 | 30 | **100** | 超 100 必须切 shared-schema |
| **单租户 schema 表数** | 100 | 200 | 500 | 超 500 需 schema 拆分 |

### 10.2 数据库容量（PostgreSQL 14+）

| 维度 | 初始基线 | 告警 | 硬上限 |
|------|---------|------|--------|
| **PG 主库连接数** | 100 | 200 | **300** |
| **PG 连接池 max** | 50 | 80 | 100 |
| **单表最大行数** | 100 万 | 500 万 | 5000 万 |
| **Artifact 表最大体积** | 10GB | 50GB | 100GB |
| **JSONB 索引内存** | 1GB | 4GB | 8GB |
| **慢查询阈值（p99）** | 500ms | 1s | 3s |
| **死锁率** | 0 | 0.1% | 1% |

### 10.3 API 吞吐容量

| 维度 | 初始基线 | 告警 | 硬上限 |
|------|---------|------|--------|
| **总 QPS** | 500 | 1000 | 2000 |
| **单模块 QPS** | 200 | 500 | 1000 |
| **API 平均响应 p95** | 200ms | 500ms | 1s |
| **API 平均响应 p99** | 500ms | 1s | 3s |
| **并发连接数** | 500 | 1000 | 2000 |

### 10.4 Redis 容量（Pub/Sub + 缓存）

| 维度 | 初始基线 | 告警 | 硬上限 |
|------|---------|------|--------|
| **Redis 内存** | 2GB | 4GB | 8GB |
| **Key 数** | 100K | 500K | 1M |
| **Pub/Sub 订阅数** | 100 | 500 | 1000 |
| **Pub/Sub 消息速率** | 500/s | 1000/s | 2000/s |

### 10.5 阈值治理规则

- **配置化**：所有阈值必须写入 `config.yaml` 的 `capacity_limits.*` 段
- **可观测**：每个阈值必须有 Prometheus metric（如 `capacity_usage_ratio`）
- **可告警**：每个"告警"阈值必须有 AlertRule
- **可配置**：每个"硬上限"必须有降级动作（如拒绝写入 / 只读模式 / 触发扩容）
- **校准节奏**：初始值 S0 后 + 4 周压测后校准一次

### 10.6 超阈值降级动作

| 触发条件 | 降级动作 |
|---------|---------|
| 连接数 > 200 | 拒绝新连接（HTTP 503）+ 告警 |
| QPS > 1500 | 启用速率限制（Redis token bucket）+ 告警 |
| PG 慢查询 p99 > 1s | 禁用后台批处理任务 |
| Artifact 表 > 50GB | 启用 7 天过期强制 GC |
| Schema 数 > 100 | 阻止新租户创建，触发架构评审 |
| JSONB 索引内存 > 4GB | 禁用 JSONB 全文搜索，改用 GIN 索引 |

---

## 11. 混沌工程剧本（Phase 2 新增，大厂级补齐）

> **来源**：`big-tech-adversarial-review-2026-10-03.md` §5.2（P0 缺口）
> **原则**：至少 8 项故障注入场景，每季度执行 1 轮，验证 SLO/SLA 与降级策略
> **前提**：故障注入只能在预生产环境执行，禁止在生产直接执行

### 11.1 8 大混沌工程场景

| # | 场景 | 注入方式 | 预期表现 | 验证指标 |
|---|------|---------|---------|---------|
| **CE-1** | PostgreSQL 主库宕机 | `kill -9 postgres` 或 chaos-mesh | 应用层 <30s 内切换主从，可用性 <99.5% 期间降级 | 5min 内自动切换成功 |
| **CE-2** | Redis 断连 | 关闭 Redis 端口或 chaos-mesh 网络分区 | Pub/Sub 消息缓冲，2min 后重连，丢失 <1% 消息 | 消息速率恢复 |
| **CE-3** | K8s 节点失败 | `kubectl delete node` | 应用 Pod 3min 内重新调度 | Pod 恢复时间 <3min |
| **CE-4** | 网络分区 | chaos-mesh 网络延迟 5s / 分区 30s | API 客户端超时降级，无雪崩 | 请求成功率不跌破 95% |
| **CE-5** | 时钟漂移 | `date -s` 篡改容器时钟 | JWT 校验降级，Alert 时间戳容忍 | 无大量误判 |
| **CE-6** | 租户隔离泄露测试 | 单租户越权查询测试脚本 | 应 100% 拦截（tenant_id 过滤）| 0 泄露 |
| **CE-7** | API 限流压测 | Locust / k6 触发 QPS > 2000 | 触发速率限制，无雪崩 | 硬上限触发后拒绝 |
| **CE-8** | 消息积压 | 关闭消费者，堆积 10 万条消息 | 消费者恢复后 5min 内清空 | 消息延迟 <5min |

### 11.2 混沌工程执行节奏

| 阶段 | 频率 | 场景范围 |
|------|------|---------|
| **执行阶段前** | S0 完成后 1 次 | CE-1~4（基础场景）|
| **生产上线前** | 上线前 1 次 | CE-1~8 全场景 |
| **生产运行** | 每季度 1 次 | 全场景轮转 |
| **重大变更后** | 变更后 24h 内 1 次 | 相关场景 |

### 11.3 混沌工程门控

每个混沌场景必须通过以下 3 项才通过：
1. **恢复时间**：故障注入后 ≤ SLO 违约时间（如 Alert 30min）
2. **数据完整性**：故障期间无数据损坏（校验和一致）
3. **告警响应**：Prometheus 告警在 5min 内触发

### 11.4 混沌工程与降级策略的对应

| 混沌场景 | 触发的降级策略 |
|---------|--------------|
| CE-1 PG 宕机 | 数据损坏应急流程（§8.3）|
| CE-2 Redis 断 | Feature Fallback 降级 |
| CE-3 K8s 节点失败 | 自动滚动重启 |
| CE-4 网络分区 | 灰度切换 |
| CE-5 时钟漂移 | 依赖 JWT 校验降级 |
| CE-6 租户隔离 | 立即 P0 应急（§8.1）|
| CE-7 API 限流 | 速率限制自动启用 |
| CE-8 消息积压 | 消费者扩容或降级非关键消息 |

### 11.5 混沌工程工具建议

- **Chaos Mesh**（K8s 原生，开源）：网络/存储/Pod 混沌
- **Locust** / **k6**：API 压测与限流验证
- **pgBadger**：慢查询分析
- **自研脚本**：租户隔离测试 + 时钟漂移测试

---

## 12. 落地清单

### 9.1 阶段 0（前置）

- [ ] 确认 42 项风险登记册已被相关团队 review
- [ ] 准备 8 个模块级回滚剧本脚本（预先写到 `scripts/rollback/`）
- [ ] 准备 4 个跨模块回滚剧本脚本
- [ ] 配置 10 项监控指标的 Prometheus 抓取
- [ ] 配置 10 项告警规则（写入 alert_rules）
- [ ] 确认 Oncall 值班表已建立（依赖 alert-oncall 模块）

### 9.2 阶段 1-8（每阶段）

- [ ] 阶段开始前：4 项硬指标全部满足
- [ ] 阶段中：实时监控 10 项指标
- [ ] 阶段结束：出口指标全部满足
- [ ] 异常时：执行对应回滚剧本
- [ ] 阶段后 24h：监控无异常 → 进入下一阶段

### 9.3 阶段 9（全量验证后）

- [ ] 8 模块完成度均值 ≥65%
- [ ] 全局出口指标全部满足
- [ ] 42 项风险复评（P0 项降到 P1 以下）
- [ ] 8 模块级回滚剧本演练通过
- [ ] 4 跨模块回滚剧本演练通过
- [ ] 数据损坏应急流程演练通过

---

## 13. 认知边界

- 未量化双写期的具体数据量阈值（建议 < 100 万行）
- 未评估 10 项监控指标对 Prometheus 性能的影响
- 未评估 Alert oncall 值班表在低团队规模下的可用性
- 未评估 4 个跨模块剧本的演练成本
- 未量化"5 个 K8s/Helm 适配器库 CVE"的具体版本风险
- NL-1/2/3/5 4 个 NeatLogic 一手扫描仍在跑，结果可能追加新风险

---

**文档编号**：`risk-fallback-design-2026-10-03.md`
**关联文档**：
- AA：`data-model-migration-design-2026-10-03.md`
- BB：`architecture-integration-design-2026-10-03.md`
- 上游：8 份 `module-upgrade-designs/*.md`
- 方法级：5 份 `expert-reviews/*-method-level-*.md`
- NeatLogic 一手：`expert-reviews/neatlogic-*.md`（NL-4 已落地，NL-1/2/3/5 待）

**待更新**：NL-1/2/3/5 完成后，可能追加 CMDB/ITSM/Alert/Automation/Inspection/BI/RDM 的具体风险条目（patch 章节）。
