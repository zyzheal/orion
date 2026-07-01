# NeatLogic AutoExec vs Orion 深度对比分析

> **结论先行：neatlogic-autoexec 不是 Orion 的扩展，而是独立发展的同类自动化执行引擎。两者在架构、技术栈、运行环境上完全不同，但在"编排-阶段-目标节点-并行/灰度执行"这一核心概念模型上高度相似。**

---

## 1. 项目基本信息对比

| 维度 | neatlogic-autoexec | Orion |
|------|-------------------|-------|
| **语言/框架** | Java / Spring Boot | TypeScript / Fastify |
| **数据访问** | MyBatis + MySQL | TypeORM + PostgreSQL |
| **执行模型** | Runner 远程推送执行 | K8s/容器/Tekton 执行 |
| **多租户** | 无租户隔离 | 完整多租户架构 |
| **定位** | 自动化运维执行平台 | AI-Driven DevOps 平台 |
| **代码规模** | 370 Java 文件 | 1700+ TypeScript 文件 |
| **架构模式** | 单体应用 | 微服务准备（当前单体） |

---

## 2. 核心概念映射

| NeatLogic 概念 | Orion 对应概念 | 实现状态 |
|---------------|--------------|---------|
| 编排 (Combop/Service) | Pipeline | ✅ Orion 有完整 Pipeline 模型 |
| 阶段组 (Phase Group) | Stage Group | ⚠️ 概念存在，无独立抽象 |
| 阶段 (Phase) | Stage | ✅ 完整实现 |
| 原子工具 (Tool/Atom) | Step / Action | ✅ 完整实现 |
| 执行目标节点 (Target Node) | targets[] | ✅ **刚完成** (multi-target execution) |
| 阶段组策略 (Group Policy) | executionMode | ✅ **刚完成** (oneshot/grayScale) |
| 并行策略 (Parallel Policy) | executionMode | ✅ oneshot = PARALLEL, grayScale = ROUND_COUNT |
| 分批数 (Round Count) | batchSize | ✅ **刚完成** |
| 执行账号/协议 | runsOn | ⚠️ 部分实现 |

### 执行模式语义对比

```
NeatLogic:
  parallelPolicy = PARALLEL     → 所有节点并发执行 (oneshot)
  parallelPolicy = ROUND_COUNT  → 分批顺序执行 (grayScale)
  jobGroupVo.policy = GRAYSCALE → 灰度分批策略

Orion (刚完成):
  executionMode: 'oneshot'      → 所有 target 并行执行
  executionMode: 'grayScale'    → 分批顺序执行
  batchSize: number             → 每批节点数
```

**结论：Orion 的 multi-target execution 设计与 NeatLogic 的并行策略模型在语义上完全一致。**

---

## 3. 已实现功能清单（Orion vs NeatLogic）

### 3.1 Orion 已实现、与 NeatLogic 对应的功能

| 功能域 | NeatLogic 实现 | Orion 实现 | 备注 |
|--------|--------------|-----------|------|
| Pipeline/Combop CRUD | ✅ | ✅ | Orion PipelineService |
| 阶段/Phase 编排 | ✅ | ✅ | Stage 模型 + StageOrchestrator |
| 多目标并行执行 | ✅ | ✅ | **刚完成** MultiTargetExecutor |
| 灰度分批执行 | ✅ | ✅ | **刚完成** GrayScaleController |
| 参数化执行 | ✅ | ⚠️ 部分 | Orion 有 context，但无参数传递链 |
| 模板版本管理 | ✅ | ✅ | PipelineTemplateService |
| 定时触发 | ✅ | ✅ | PipelineTriggerService |
| 审批门禁 | ✅ | ✅ | PipelineGateController |
| 质量门禁 | ✅ | ✅ | QualityGateService |
| 自动重试 | ✅ | ✅ | AutoRetryService |
| 执行队列 | ✅ | ✅ | PipelineExecutionQueue |
| 检查点/恢复 | ✅ | ✅ | PipelineCheckpointManager |
| 回滚 | ✅ | ✅ | RollbackService |
| SSE 实时日志 | ✅ | ✅ | PipelineEventSSEBridge |
| 事件通知 | ✅ | ✅ | NotificationDispatcher |
| 多租户 | ❌ | ✅ | Orion 强项 |
| K8s 原生集成 | ❌ | ✅ | Orion 强项 |

### 3.2 NeatLogic 有但 Orion 未实现的功能

| 功能 | NeatLogic 实现详情 | 优先级 | 复杂度 |
|------|-------------------|--------|--------|
| **Runner 远程执行** | 将脚本推送到远程服务器执行，支持 SSH/WinRM 等协议 | P0 | 高 |
| **参数抽取 (Param Extract)** | 从上游阶段输出中抽取参数传递给下游 | P0 | 中 |
| **参数聚合 (Param Aggregate)** | 聚合多个源参数到目标 | P1 | 中 |
| **条件分流 (Condition)** | 根据执行结果动态选择下一步 | P1 | 中 |
| **文件传输** | 阶段间文件传递 (FileHandler) | P1 | 中 |
| **节点分组管理** | Server Group + GroupTag 管理 | P2 | 中 |
| **定时作业 (Schedule)** | Cron 调度 + 自动触发 | P1 | 低 (已有基础) |
| **审计日志** | 完整的操作审计 (ConsoleLog, NodeLog) | P2 | 中 |
| **脚本版本管理** | Script 版本对比 + 参数版本化 | P2 | 低 |
| **全文本检索** | 脚本内容全文本索引 | P3 | 低 |
| **通知策略** | 可配置通知模板 + 参数化消息 | P2 | 低 |
| **全量导入导出** | Combop/模板导入导出 (JSON/ZIP) | P3 | 低 |
| **组合工具市场** | Catalog + 分类 + 权限管理 | P3 | 高 |
| **场景管理 (Scenario)** | 按业务场景组织组合工具 | P3 | 中 |
| **全局参数 (Global Param)** | 跨作业共享参数 | P2 | 低 |
| **Profile 管理** | 环境变量/配置 Profile | P2 | 低 |
| **风险评估 (Risk)** | 执行前风险评估 | P3 | 高 |
| **依赖分析** | 组合工具-脚本-Profile 依赖图谱 | P3 | 中 |

---

## 4. Orion 有但 NeatLogic 不具备的优势

| 功能 | Orion 实现 | NeatLogic |
|------|-----------|----------|
| 多租户架构 | ✅ 完整 | ❌ 无 |
| AI 集成 | ✅ AIReview, AIDoc, LLMTrace | ❌ 无 |
| K8s/Tekton 执行 | ✅ 原生 | ❌ 仅远程推送 |
| Canary 灰度发布 | ✅ CanaryTrafficService | ❌ 无 |
| 可观测性 | ✅ Prometheus + 自监控 | ⚠️ 基础 |
| 微前端架构 | ✅ 149 页面 | ❌ 单体 |
| API Gateway | ✅ orion-api-gateway | ❌ 无 |
| PostgreSQL 持久化 | ✅ 207 migrations | ⚠️ MySQL |
| 前端独立 | ✅ React + Design Token | ❌ 无 |

---

## 5. 架构差异深度分析

### 5.1 执行模型

```
NeatLogic 执行链:
  Combop(编排) → PhaseGroup(阶段组) → Phase(阶段) → Tool(工具)
                                                     ↓
                                                Runner 推送执行
                                                     ↓
                                                远程服务器

Orion 执行链:
  Pipeline → Stage → Task → Action
                           ↓
                     Tekton PipelineRun
                           ↓
                     K8s Pod / Container
```

### 5.2 数据模型差异

| 概念 | NeatLogic | Orion |
|------|-----------|-------|
| 编排 | `autoexec_combop` | `pipelines` |
| 阶段组 | `autoexec_combop_phase_group` | 无独立表 (Stage 内) |
| 阶段 | `autoexec_combop_phase` | `stages` |
| 工具 | `autoexec_tool` | `actions` (steps) |
| 作业执行 | `autoexec_job` | `pipeline_runs` |
| 节点 | `autoexec_job_phase_node` | targets[] |
| 执行日志 | `autoexec_job_phase_node_log` | `stage_executions` |

### 5.3 关键差异：节点分组

NeatLogic 的 `GRAYSCALE` 是**阶段组级别**的策略，影响整个阶段组内的所有阶段分批。Orion 的 `grayScale` 是**单个 Stage 级别**的策略。这意味着 NeatLogic 支持更细粒度的"多阶段按批次依次执行"，而 Orion 目前只在单个 Stage 内支持灰度。

---

## 6. 结论与建议

### 6.1 是否对本地项目进行扩展？

**否。** neatlogic-autoexec 是 NeatLogic 开源生态中的独立自动化执行模块，与 Orion 项目：
- 无代码共享
- 无继承关系
- 无依赖关系
- 技术栈完全不同 (Java vs TypeScript)

两者是**同类产品的不同实现**，在核心编排模型上独立演进出相似的概念。

### 6.2 Orion 的差距与借鉴方向

**高优先级 (P0):**
1. **Runner 远程执行** - 如果需要支持非容器化环境
2. **参数传递链** - 阶段间参数抽取/聚合 (NeatLogic 的核心优势)

**中优先级 (P1):**
3. **条件分流** - 阶段级 if/else
4. **文件传输** - 阶段间文件传递
5. **阶段组抽象** - 支持"多阶段按批次执行"

**低优先级 (P2/P3):**
6. 审计日志增强
7. 导入导出
8. 全文本检索
9. 风险评估

### 6.3 Orion 的独特优势

Orion 在以下方面显著领先：
- **多租户** - NeatLogic 完全没有
- **K8s 原生** - Tekton + Argo 集成
- **AI 驱动** - AIReview, AIDoc, LLMTrace
- **微前端** - 149 页面独立部署
- **可观测性** - Prometheus + 自监控

---

## 7. 数据来源

- neatlogic-autoexec 源码: `git@gitee.com:neat-logic/neatlogic-autoexec.git` (HEAD: f464b3e)
- 370 Java 源文件
- 分析日期: 2026-07-01
