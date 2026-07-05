# Orion 设计文档索引

> 版本：v3.1 | 最后更新：2026-06-26
> 变更日志：[CHANGELOG.md](CHANGELOG.md) | 管理规范：[docs/文档管理规范.md](docs/文档管理规范.md)

---

## 快速导航

```
📖 完整设计方案    →  Orion-完整设计方案.md
📐 架构决策 (ADR)  →  docs/adr/ (8 份)
🏗️ 架构设计        →  docs/architecture/ (40 份)
🤖 AI/算法         →  docs/services/ai/ (22 份)
🔒 安全            →  docs/services/security/ (12 份)
🗄️ 数据库          →  docs/services/dba/ (6 份)
🔧 可观测性/监控    →  docs/services/monitor/ (8 份)
📦 制品管理        →  docs/services/artifact/ (5 份)
🔌 插件/工具       →  docs/services/plugin/ (6 份)
🚀 部署/发布       →  docs/services/deploy/ (4 份)
🛡️ 自愈/SRE       →  docs/services/selfhealing/ (3 份)
💬 协作/ChatOps    →  docs/services/chatops/ (3 份)
📋 工单/审批       →  docs/services/ticket/ (2 份) + approval/ (2 份)
📚 知识库          →  docs/services/knowledge/ (4 份)
📊 效能/FinOps     →  docs/services/efficiency/ (2 份) + finops/ (2 份)
🔌 集成规范        →  docs/services/ (多个 spec 文件)
📝 规范文档        →  docs/规范汇总/ + docs/non-functional/
🔄 迁移方案        →  docs/migration/ (1 份)
```

---

## 代码实现状态总览

| 维度 | 数量 | 说明 |
|------|------|------|
| **后端服务目录** | 139 个 | `orion-platform-service/src/services/` |
| **有 barrel 导出** | 100 个 | 含 `index.ts` |
| **有源码无 barrel** | 38 个 | 缺少 `index.ts` |
| **后端服务模块** | 73 个 | 3+ 源码文件的实质服务 |
| **前端页面** | 202 个 | `orion-frontend/src/pages/` |
| **前端 API 客户端** | 239 个 | `orion-frontend/src/api/` |
| **前端 .tsx 文件** | 739 个 | 前端组件源文件 |
| **前端 .ts 文件** | 345 个 | 前端逻辑源文件 |
| **后端路由** | 175 个 | `api/*-routes.ts` 文件 |
| **数据库迁移** | 643 个 | SQL migration 文件 |
| **微服务蓝图** | 87 个 | 37 TS + 47 Go + 2 Python + 1 Rust（全部非独立部署） |
| **设计文档** | ~466 份 | docs/ + 根目录 |

> 30+ 服务已迁移至 PostgreSQL Repository 模式。47 个 Go 微服务仅有 `go.mod` 无 `main.go`，为编译单元非独立部署。前端 35/175 routes 有精确匹配页面（20%），其余通过 Orion-MF 微前端或命名差异关联。

---

## 文档目录结构

```
orion-design/
├── CLAUDE.md                          # Claude Code 项目指引
├── AGENTS.md                          # Codex 指引
├── README.md                          # 项目说明
├── INDEX.md                           # 本文件
├── Orion-完整设计方案.md               # 完整设计方案主文档
├── API-QUICK-REFERENCE.md             # API 端点快速参考
├── CHANGELOG.md                       # 变更日志
├── docs/
│   ├── adr/                           # 架构决策记录 (8 份)
│   ├── architecture/                  # 架构设计 (40 份)
│   ├── cross-cutting/                 # 横切关注点
│   ├── design-constraints/            # 设计约束检测框架
│   ├── migration/                     # 数据迁移方案
│   ├── 规范汇总/                       # Orion 统一规范
│   └── services/                      # 服务设计文档 (按域组织)
│       ├── ai/                        # AI/算法 (22 份)
│       ├── security/                  # 安全 (12 份)
│       ├── dba/                       # 数据库 (6 份)
│       ├── monitor/                   # 可观测性 (8 份)
│       ├── plugin/                    # 插件/工具 (6 份)
│       ├── artifact/                  # 制品管理 (5 份)
│       ├── deploy/                    # 部署/发布 (4 份)
│       ├── selfhealing/               # 自愈/SRE (3 份)
│       ├── chatops/                   # 协作 (3 份)
│       ├── knowledge/                 # 知识库 (4 份)
│       ├── pipeline/                  # 流水线 (8 份)
│       ├── ticket/                    # 工单 (2 份)
│       ├── approval/                  # 审批 (2 份)
│       ├── code/                      # 代码管理 (3 份)
│       ├── cmdb/                      # CMDB (3 份)
│       ├── efficiency/                # 效能 (2 份)
│       ├── finops/                    # FinOps (2 份)
│       ├── config-mgmt/               # 配置管理 (3 份)
│       ├── governance/                # 治理 (2 份)
│       ├── intelligence/              # 智能 (2 份)
│       ├── federation/                # 联邦/多云 (5 份)
│       ├── community/                 # 社区 (2 份)
│       ├── dr/                        # 灾备 (3 份)
│       ├── digital-twin/              # 数字孪生 (1 份)
│       ├── quality-gate/              # 质量门禁 (1 份)
│       ├── agent/                     # AI Agent (1 份)
│       └── *.md                       # 独立服务设计 (8 份)
```

---

## 按领域索引

### 架构决策 (ADR)

| 编号 | 标题 | 状态 | 关联模块 |
|------|------|------|----------|
| [ADR-002](docs/adr/ADR-002-Plugin-SPI%20接口设计.md) | Plugin-SPI 接口设计 | 已批准 | M15 |
| [ADR-003](docs/adr/ADR-003-成本数据采集架构.md) | 成本数据采集架构 | 已批准 | M22 |
| [ADR-004](docs/adr/ADR-004-备份恢复策略设计.md) | 备份恢复策略设计 | 已批准 | M25 |
| [ADR-005](docs/adr/ADR-005-数据库选型决策.md) | 数据库选型决策 | 已批准 | M25 |
| [ADR-006](docs/adr/ADR-006-ClickHouse%20集成设计.md) | ClickHouse 集成设计 | 已批准 | M22 |
| [ADR-008](docs/adr/ADR-008-ProductLine-CRD%20多分支产品线设计.md) | ProductLine-CRD 多分支产品线 | 已批准 | M6 |
| [ADR-009](docs/adr/ADR-009-依赖追踪设计.md) | 依赖追踪设计 | 已批准 | M15 |
| [ADR-014](docs/adr/014-backend-technology-stack-migration.md) | 后端技术栈迁移 | 已批准 | - |

### 架构设计

| 文档 | 说明 |
|------|------|
| [当前系统架构](docs/architecture/当前系统架构.md) | 当前实际架构 |
| [最小系统启动指南](docs/architecture/最小系统启动指南.md) | 从零启动步骤 |
| [架构设计详解](docs/architecture/架构设计详解.md) | 分层架构、技术选型 |
| [架构重构设计](docs/architecture/架构重构设计.md) | 核心域 + 支撑域重构 |
| [平台服务拆分设计](docs/architecture/platform-service-split-design.md) | 拆分为 3 个服务 |
| [服务拆分实施方案](docs/architecture/platform-service-split-implementation.md) | 4 服务拆分方案 |
| [多租户隔离设计](docs/architecture/多租户隔离设计.md) | 四隔离模型 |
| [开放平台基座能力规则](docs/architecture/开放平台基座能力规则设计.md) | 插件 SPI 规范 |
| [跨时代颠覆性亮点设计](docs/architecture/跨时代颠覆性亮点设计.md) | 6 大亮点 |
| [外部组件集成架构](docs/architecture/外部组件集成架构设计.md) | 第三方集成 |
| [外部服务集成清单](docs/architecture/外部服务集成清单.md) | 集成列表 |
| [gRPC 集成设计](docs/architecture/grpc-integration-design.md) | gRPC vs REST |
| [熔断降级设计](docs/architecture/circuit-breaker-degradation-design.md) | L0-L3 降级 |
| [API Gateway 增强](docs/architecture/api-gateway-enhancement-design.md) | 限流/熔断/版本化 |
| [API 版本管理](docs/architecture/api-version-management-design.md) | 版本化策略 |
| [缓存层设计](docs/architecture/cache-layer-design.md) | Redis/失效策略 |
| [服务通信设计](docs/architecture/service-communication-design.md) | 服务间通信 |
| [Go 服务统一设计](docs/architecture/go-service-unification-design.md) | Go 微服务规范 |
| [RBAC+ABAC 统一实现](docs/architecture/rbac-abac-unified-implementation.md) | 权限引擎 |
| [租户隔离实现](docs/architecture/tenant-isolation-implementation-design.md) | 租户隔离 |
| [产品线管理设计](docs/architecture/product-line-management-design.md) | 产品线 CRD |
| [微前端子应用接入](docs/architecture/微前端子应用接入与后端交互设计.md) | wujie 集成 |
| [Orion 架构流程图](docs/architecture/%20Orion-架构流程图.md) | 10 个架构图 |

### AI/算法 (docs/services/ai/)

| 文档 | 说明 |
|------|------|
| [算法设计详解](docs/services/ai/算法设计详解.md) | 12 种算法详解 |
| [AI 模型训练与评估](docs/services/ai/AI模型训练与评估详细设计.md) | 模型训练流程 |
| [AI 降级方案](docs/services/ai/AI%20降级方案设计.md) | 15+ 降级场景 |
| [AI 模型测试集](docs/services/ai/AI%20模型测试集设计.md) | 测试集管理 |
| [AI-Skill-Schema](docs/services/ai/AI-Skill-Schema-定义.md) | Skill 定义规范 |
| [AI 模型验证集](docs/services/ai/AI%20模型验证集定义.md) | 验证集管理 |
| [向量存储生产方案](docs/services/ai/向量存储生产方案.md) | Chroma/Milvus 评估 |
| [PageRank 图数据更新](docs/services/ai/PageRank%20图数据更新设计.md) | 根因定位算法 |
| [特征漂移监控](docs/services/ai/特征漂移监控设计.md) | 模型监控 |
| [特征存储架构](docs/services/ai/feature-store-design.md) | 离线/在线特征 |
| [模型灰度发布](docs/services/ai/model-canary-release-design.md) | 影子模式→金丝雀 |
| [AI 成本控制](docs/services/ai/ai-cost-control-design.md) | Token 计费/预算 |
| [MLOps 与 ML 框架](docs/services/ai/mlops-and-ml-frameworks-design.md) | MLflow + Kubeflow |
| [GNN 与强化学习](docs/services/ai/gnn-and-rl-design.md) | 图神经网络 +RL |
| [代码表示学习](docs/services/ai/code-representation-learning-design.md) | AST+Code2Vec |
| [Skill 市场设计](docs/services/ai/skill-marketplace-design.md) | Skill 发现/安装 |
| [ML 金丝雀分析](docs/services/ai/ml-canary-analysis-design.md) | ML 异常检测 |
| [代码规范规则引擎](docs/services/ai/代码规范规则引擎设计.md) | DSL/热更新 |
| [测试推荐效果评估](docs/services/ai/测试推荐效果评估设计.md) | 准确率/采纳率 |
| [测试用例生成](docs/services/ai/测试用例生成设计.md) | 变更分析/覆盖率 |
| [测试选择器](docs/services/ai/test-selector-design.md) | 智能测试选择 |

### 安全 (docs/services/security/)

| 文档 | 说明 |
|------|------|
| [安全与权限详解](docs/services/security/安全与权限详解.md) | SSO + RBAC + ABAC |
| [认证授权与数据加密](docs/services/security/认证授权与数据加密设计.md) | 认证流程 |
| [数据隐私合规](docs/services/security/data-privacy-compliance-design.md) | GDPR/PIPL |
| [AI 安全加固](docs/services/security/AI%20安全加固设计.md) | Prompt 注入 |
| [Prompt 注入防护](docs/services/security/ADR-010-Prompt%20注入防护设计.md) | ADR-010 |
| [JWT 并发刷新保护](docs/services/security/JWT%20并发刷新保护设计.md) | Token 安全 |
| [自愈引擎权限治理](docs/services/security/自愈引擎权限治理设计.md) | 权限最小化 |
| [软件供应链安全](docs/services/security/software-supply-chain-security-design.md) | SLSA L3, SBOM |
| [SBOM 供应链溯源](docs/services/security/sbom-attestation-design.md) | SBOM 文档/签名 |
| [风险评估服务](docs/services/security/risk-assessment-design.md) | 风险评分引擎 |

### 数据库 (docs/services/dba/)

| 文档 | 说明 |
|------|------|
| [数据库分片与同步](docs/services/dba/数据库分片与同步设计.md) | 分片策略 |
| [分布式事务设计](docs/services/dba/distributed-transaction-design.md) | Saga 模式 |
| [外部开源系统接入](docs/services/dba/外部开源系统接入数据库扩展设计.md) | 多数据源 |
| [SQL 审计设计](docs/services/dba/sql-audit-design.md) | SQL 审计 |
| [CMDB 数据库 Schema](docs/services/dba/CMDB-数据库%20Schema%20设计.md) | 42 张表设计 |
| [数据库迁移与查询](docs/services/dba/database-migration-and-query-design.md) | Flyway 迁移 |

### 可观测性/监控 (docs/services/monitor/)

| 文档 | 说明 |
|------|------|
| [可观测性设计](docs/services/monitor/可观测性设计.md) | 指标/日志/追踪 |
| [部署架构与监控指标](docs/services/monitor/部署架构与监控指标设计.md) | 部署拓扑 |
| [OnCall 排班系统](docs/services/monitor/OnCall%20排班系统设计.md) | 排班规则/告警路由 |
| [告警服务](docs/services/monitor/alert-service-design.md) | 去重/关联/抑制 |
| [可观测性仪表盘](docs/services/monitor/observability-dashboard-trace-design.md) | 链路追踪 |
| [监控前端设计](docs/services/monitor/monitoring-frontend-design.md) | 指标/告警/规则 |
| [诊断前端设计](docs/services/monitor/diagnostic-frontend-design.md) | 诊断会话/报告 |
| [运维手册](docs/services/monitor/运维手册.md) | 运维操作指南 |

### 插件/工具 (docs/services/plugin/)

| 文档 | 说明 |
|------|------|
| [插件框架设计](docs/services/plugin/plugin-framework-design.md) | 微内核/生命周期 |
| [Plugin SPI 示例](docs/services/plugin/plugin-spi-examples.md) | 代码示例 |
| [工具市场设计](docs/services/plugin/tool-marketplace-design.md) | 工具发现/安装 |
| [IDE 插件设计](docs/services/plugin/ide-plugin-design.md) | IDE 集成 |
| [IDE 插件 API](docs/services/plugin/ide-plugin-api.md) | API 接口 |

### 部署/发布 (docs/services/deploy/)

| 文档 | 说明 |
|------|------|
| [Hotfix 通道设计](docs/services/deploy/hotfix-channel-design.md) | 紧急发布 |
| [临时开发环境](docs/services/deploy/ephemeral-dev-environments-design.md) | PR 环境 |
| [金丝雀流量规范](docs/services/deploy/06-canary-traffic-spec.md) | 金丝雀发布 |
| [环境管理规范](docs/services/deploy/06-env-mgmt-spec.md) | 环境管理 |

### 自愈/SRE (docs/services/selfhealing/)

| 文档 | 说明 |
|------|------|
| [SRE 运维加固](docs/services/selfhealing/SRE%20运维加固设计.md) | 监控/告警/演练 |
| [自愈引擎-Agent 协作](docs/services/selfhealing/自愈引擎-Agent%20协作设计.md) | Agent 协作 |
| [自愈前端设计](docs/services/selfhealing/self-healing-frontend-design.md) | 事件/策略/审批 |

### 灾备 (docs/services/dr/)

| 文档 | 说明 |
|------|------|
| [灾备与备份恢复](docs/services/dr/灾备与备份恢复设计.md) | 多活架构 |
| [备份恢复策略 ADR](docs/services/dr/ADR-004-备份恢复策略设计.md) | ADR-004 |

### 协作/ChatOps (docs/services/chatops/)

| 文档 | 说明 |
|------|------|
| [ChatOps 命令集设计](docs/services/chatops/ChatOps%20命令集设计.md) | 10+ IM 命令 |
| [ChatOps 详细设计](docs/services/chatops/chatops-design.md) | IM 集成/命令解析 |
| [多模态触发规范](docs/services/chatops/12-multi-modal-trigger-spec.md) | 触发方式 |

### 工单/审批

| 文档 | 说明 |
|------|------|
| [智能工单与自动排单](docs/services/ticket/智能工单与自动排单设计.md) | NLP 工单理解 |
| [新人 Onboarding](docs/services/ticket/新人%20Onboarding%20设计.md) | 入职流程 |
| [审批组件库](docs/services/approval/审批组件库.md) | 审批专用组件 |
| [审批工作流规范](docs/services/approval/05-approval-workflow-spec.md) | 工作流定义 |

### 知识库 (docs/services/knowledge/)

| 文档 | 说明 |
|------|------|
| [知识库基础设计](docs/services/knowledge/knowledge-base-design.md) | 基础设计 |
| [微服务改造方案](docs/services/knowledge/Orion-Knowledge%20微服务改造方案.md) | 完整改造 |
| [集成设计](docs/services/knowledge/orion-knowledge-integration-design.md) | 集成方案 |
| [改造说明](docs/services/knowledge/orion-knowledge-改造说明.md) | 改造细节 |

### 流水线 (docs/services/pipeline/)

| 文档 | 说明 |
|------|------|
| [构建缓存配置](docs/services/pipeline/构建缓存配置设计.md) | 缓存策略 |
| [Pipeline 规范](docs/services/pipeline/01-pipeline-spec.md) | 流水线规范 |
| [自主流水线规范](docs/services/pipeline/02-autonomous-pipeline-spec.md) | 自主执行 |
| [数据流水线规范](docs/services/pipeline/09-data-pipeline-spec.md) | 数据处理 |
| [插件系统设计](docs/services/pipeline/2026-05-08-pipeline-plugin-system-design.md) | 插件架构 |
| [CI/CD 优化](docs/services/pipeline/2026-05-05-cicd-capability-optimization-design.md) | 能力优化 |
| [流水线改进](docs/services/pipeline/pipeline-improvement-tech-design.md) | 技术改进 |

### CMDB (docs/services/cmdb/)

| 文档 | 说明 |
|------|------|
| [CMDB 模块设计](docs/services/cmdb/CMDB模块设计.md) | 模块结构 |
| [CMDB 集成接口](docs/services/cmdb/CMDB%20集成接口设计.md) | API 接口 |
| [CMDB 建设决策](docs/services/cmdb/CMDB%20模块建设决策.md) | 建设决策 |

### 效能/FinOps

| 文档 | 说明 |
|------|------|
| [DORA 指标计算](docs/services/efficiency/DORA%20指标计算设计.md) | 四指标算法 |
| [效能运营规范](docs/services/efficiency/06-efficiency-operations-spec.md) | 运营规范 |
| [FinOps 成本采集](docs/services/finops/FinOps-成本数据采集设计.md) | 成本数据 |
| [成本运营规范](docs/services/finops/04-cost-operations-spec.md) | 成本运营 |

### 其他服务设计

| 文档 | 说明 |
|------|------|
| [AI Agent 编排](docs/services/agent/ai-agent-orchestration-design.md) | Agent 画像/工作流 |
| [AI 变更智能](docs/services/intelligence/ai-change-intelligence-design.md) | 变更风险分析 |
| [OPA 策略引擎](docs/services/governance/opa-policy-engine-design.md) | Rego 策略 |
| [配置漂移检测](docs/services/config-mgmt/configuration-drift-detection-design.md) | GitOps 漂移 |
| [GitOps 配置管理](docs/services/config-mgmt/gitops-config-management-design.md) | GitOps |
| [API Key 管理](docs/services/api-key-management-design.md) | API Key |
| [Cron 调度器](docs/services/cron-scheduler-design.md) | 定时任务 |
| [Webhook 管理](docs/services/webhook-management-design.md) | Webhook |
| [队列管理](docs/services/queue-management-design.md) | 消息队列 |
| [环境管理](docs/services/environment-management-design.md) | 环境管理 |
| [身份管理](docs/services/identity-management-design.md) | 身份认证 |
| [项目管理](docs/services/project-management-design.md) | 项目管理 |
| [向量存储](docs/services/vector-store-design.md) | 向量数据库 |
| [OnCall 排班](docs/services/oncall-scheduling-design.md) | 排班系统 |

### 规范文档

| 文档 | 说明 |
|------|------|
| [Orion 统一规范汇总](docs/规范汇总/Orion统一规范汇总.md) | 全局规范 |
| [数据迁移方案](docs/migration/数据迁移方案.md) | 迁移策略 |
| [API 设计规范](docs/cross-cutting/api/) | API 横切规范 |

---

## 按模块索引

| 模块 | 名称 | 实现状态 | 代码位置 | 相关文档 |
|------|------|----------|----------|----------|
| M1 | 效能看板 | 全栈 | `services/efficiency/` `pages/EfficiencyDashboard/` | DORA 指标计算 |
| M2 | 流水线可视化 | 前端组件 | `pages/PipelineList/` `PipelineEditor/` | Pipeline 规范 |
| M3 | 审批工作台 | 全栈 | `pages/Approvals/` `approval-routes.ts` | 审批工作流规范 |
| M4 | 安全审计中心 | 全栈 | `services/ai-security/` `pages/RiskDashboard/` | 安全与权限详解 |
| M5 | Pipeline 引擎 | 全栈 | `services/pipeline/` | Pipeline 规范 |
| M6 | 多分支产品线 | 全栈 | `services/product-line/` | ADR-001, ADR-008 |
| M7 | 配置管理 GitOps | 全栈 | `services/config-mgmt/` | GitOps 配置管理 |
| M8 | 通知协作 | 前端+API | `pages/NotificationCenter/` | ChatOps 命令集 |
| M9 | AI 算法引擎 | 全栈 | `services/ai/` `pages/AIGateway/` | 算法设计详解 |
| M10 | LLM 推理层 | 与 M9 共用 | `services/ai/` | AI 模型训练 |
| M11 | AI 增强层 | 全栈 | `services/ai-review/` | AI-Skill-Schema |
| M12 | Skill 管理 | 全栈 | `services/skill/` | Skill 市场设计 |
| M13 | 代码管理 | 全栈 | `services/code-repo/` | 代码管理设计 |
| M14 | 构建环境 | 全栈 | `services/build/` | 构建缓存配置 |
| M15 | 多工具链 | 全栈 | `services/plugin/` | 插件框架设计 |
| M16 | 智能部署 | 全栈 | `services/smart-deploy/` | 部署策略 |
| M17 | 自愈引擎 | 全栈 | `services/self-healing/` | SRE 运维加固 |
| M18 | 安全合规 | 全栈 | `services/policy/` `services/sbom/` | SBOM 供应链溯源 |
| M19 | 多租户 | 全栈 | `services/tenant/` | 多租户隔离设计 |
| M20 | IaC 管理 | 全栈 | `services/iac/` | IaC 规范 |
| M21 | 审计中心 | 全栈 | `services/audit/` | SQL 审计设计 |
| M22 | FinOps 成本 | 全栈 | `services/finops/` | FinOps 成本采集 |
| M23 | SSO/RBAC | 全栈 | `api/auth.ts` `pages/Login/` | 认证授权设计 |
| M24 | 事件总线 | 后端服务 | `services/event-bus-service.ts` | 事件总线规范 |
| M25 | 数据存储 | 后端+路由 | `services/database/` `services/backup/` | 数据库选型 ADR |
| M26 | 可观测性 | 全栈 | `services/monitoring/` `services/diagnostic/` | 可观测性设计 |
| M27 | 插件扩展 | 与 M15 共用 | `services/plugin/` | 插件框架设计 |
| M28 | Orion-Knowledge | 独立子项目 | `orion-knowledge/` | 知识库设计 |
| M29 | 产物管理 | 全栈 | `services/artifact/` | 产物管理设计 |
| M30 | 二方库管理 | 全栈 | `services/internal-library/` | 依赖追踪 ADR |
| M31 | 智能工单 | 全栈 | `services/ticketing/` | 智能工单设计 |
| M32 | CMDB | 后端服务 | `services/cmdb/` | CMDB 模块设计 |
| M33 | 通知中心 | 前端+API | `pages/NotificationCenter/` | ChatOps |
| M34 | 人工确认交互 | 前端+API | `pages/ConfirmationWorkbench/` | 确认交互规范 |
| M35 | ChatOps | 全栈 | `services/chatops/` | ChatOps 详细设计 |
| M36 | AI 成本优化 | 全栈 | `services/cost/` | AI 成本控制 |
| M37 | AI 文档管理 | 前端+子项目 | `pages/AIDocManagement/` | 知识库设计 |
| M38 | AI 变更智能 | 全栈 | `services/change-intelligence/` | AI 变更智能设计 |
| M39 | ML 金丝雀分析 | 全栈 | `services/canary-analysis/` | ML 金丝雀分析 |
| M40 | AI Agent 编排 | 全栈 | `services/agent-profile-service.ts` | AI Agent 编排设计 |
| M41 | 临时开发环境 | 全栈 | `services/ephemeral-env-service.ts` | 临时开发环境设计 |

### 新增服务

| 模块 | 名称 | 实现状态 | 代码位置 |
|------|------|----------|----------|
| S1 | 风险评估服务 | 后端 | `services/risk-assessment/` |
| S2 | 告警服务 | 后端 | `services/alert/` |
| S3 | 定时调度服务 | 后端 | `services/scheduler/` |
| S4 | 测试选择器 | 后端 | `services/test-selector/` |
| S5 | 构建增强服务 | 后端 | `services/build/` |
| S6 | 部署策略引擎 | 后端 | `services/smart-deploy/` |
| S7 | 策略引擎增强 | 后端 | `services/policy/` |
| S8 | SBOM 增强 | 后端 | `services/sbom/` |
| S9 | OnCall 排班 | 全栈 | `oncall-routes.ts` + `pages/OnCall/` |
| S10 | Vector Store | 全栈 | `vector-store-routes.ts` + `pages/VectorStore/` |
| S11 | API Key 管理 | 全栈 | `api-key-routes.ts` + `pages/ApiKeyManagement/` |
| S12 | Cron 管理 | 全栈 | `cron-routes.ts` + `pages/CronManagement/` |
| S13 | Webhook 管理 | 全栈 | `webhook-routes.ts` + `pages/WebhookManagement/` |
| S14 | Queue 管理 | 全栈 | `queue-routes.ts` + `pages/Queue/` |
| S15 | 环境管理 | 全栈 | `environment-routes.ts` + `pages/Environment/` |
| S16 | 用户权限 | 全栈 | `user-routes.ts` + `role-routes.ts` |
| S17 | 项目管理 | 全栈 | `project-routes.ts` + `pages/Projects/` |
| S18 | Approvals | 全栈 | `approval-routes.ts` + `pages/Approvals/` |

---

_维护者：Orion 架构团队 | 最后更新：2026-06-26_
