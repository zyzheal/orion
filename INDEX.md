# 📚 Orion 设计文档索引

> 版本：v1.1 | 创建日期：2026-04-10 | 状态：37 模块 251 功能完整  
> 变更日志：[CHANGELOG.md](CHANGELOG.md) | 管理规范：[docs/文档管理规范.md](docs/文档管理规范.md)  
> **最新更新**: 补充 53 个功能 (AI 算法/LLM/SSO/产物/二方库/知识库/CMDB)

---

## 快速导航

```
📖 完整设计方案  →  Orion-完整设计方案.md (868 行，主文档)
📋 任务分发      →  00-文档索引与任务分发.md (37 模块，251 功能)
📐 架构决策      →  docs/adr/ (11 份 ADR)
🏗️ 架构设计      →  docs/architecture/ (20 份)
🤖 AI/算法       →  docs/ai/ (15 份)
🔒 安全          →  docs/security/ (10 份)
🖥️ 前端          →  docs/frontend/ (12 份)
📊 效能          →  docs/efficiency/ (3 份)
🗄️ 数据库        →  docs/db/ (8 份)
🔧 运维/SRE      →  docs/sre/ (8 份)
🎨 UI/UX         →  docs/ui/ (3 份)
📦 制品管理      →  docs/artifact/ (5 份)
🔌 集成          →  docs/integration/ (6 份)
📚 知识库        →  docs/knowledge/ (4 份)
📝 评审报告      →  reports/ (5 份)
📊 协作          →  docs/collaboration/ (2 份)
🎨 高保真设计    →  design-md/ (23 份)
📄 文档模板      →  templates/ (2 份)
📋 需求功能汇总  →  docs/requirements/需求功能更新汇总.md
```

---

## 文档统计

| 维度 | 数量 |
|------|------|
| 总文档数 | **157 份** (不含子项目) |
| 总行数 | **~120,000 行** |
| ADR 决策记录 | **13 份** |
| 评审报告 | **5 份** |
| 高保真设计 | **23 份** |
| 文档模板 | **2 份** |
| 子项目 | orion-visor, orion-knowledge, orion-dba |
| **覆盖模块** | **37 个** |
| **覆盖功能** | **251 个** |
| **AI 功能** | **52 个** (23%) |

---

## 按领域索引

### 🔴 架构决策 (ADR)

| 编号 | 标题 | 状态 | 关联模块 |
|------|------|------|----------|
| [ADR-001](docs/adr/ADR-001-ProductLine-CRD%20设计.md) | ProductLine CRD 设计 | 提议中 | M6 |
| [ADR-002](docs/adr/ADR-002-Plugin-SPI%20接口设计.md) | Plugin-SPI 接口设计 | 已批准 | M15 |
| [ADR-003](docs/adr/ADR-003-成本数据采集架构.md) | 成本数据采集架构 | 已批准 | M22 |
| [ADR-004](docs/adr/ADR-004-备份恢复策略设计.md) | 备份恢复策略设计 | 已批准 | M25 |
| [ADR-005](docs/adr/ADR-005-数据库选型决策.md) | 数据库选型决策 | 已批准 | M25 |
| [ADR-006](docs/adr/ADR-006-ClickHouse%20集成设计.md) | ClickHouse 集成设计 | 已批准 | M22 |
| [ADR-008](docs/adr/ADR-008-ProductLine-CRD%20多分支产品线设计.md) | ProductLine-CRD 多分支产品线 | 已批准 | M6 |
| [ADR-009](docs/adr/ADR-009-依赖追踪设计.md) | 依赖追踪设计 | 已批准 | M15 |
| [ADR-010](docs/security/ADR-010-Prompt%20注入防护设计.md) | Prompt 注入防护设计 | 已批准 | M9 |
| [ADR-011](docs/adr/ADR-011-Plugin-SPI%20接口设计.md) | Plugin-SPI 接口设计 | 已批准 | M15 |
| [ADR-012](docs/adr/ADR-012-API 版本管理设计.md) | API 版本管理设计 | 已批准 | 全系统 |

### 🏗️ 架构设计

| 文档 | 行数 | 说明 |
|------|------|------|
| [架构设计详解](docs/architecture/架构设计详解.md) | ~1000 | 分层架构、部署架构、技术选型 |
| [架构重构设计](docs/architecture/架构重构设计.md) | ~600 | 核心域 + 支撑域重构方案 |
| [微服务与微前端架构](docs/architecture/微服务与微前端架构设计.md) | ~800 | 服务拆分、前端模块化 |
| [服务拆分与数据库划分](docs/architecture/服务拆分与数据库划分详解.md) | ~1100 | 12 个微服务 + 数据库分配 |
| [多租户隔离设计](docs/architecture/多租户隔离设计.md) | ~400 | 四隔离模型 |
| [开放平台基座能力规则](docs/architecture/开放平台基座能力规则设计.md) | ~500 | 插件 SPI 规范 |
| [跨时代颠覆性亮点设计](docs/architecture/跨时代颠覆性亮点设计.md) | ~700 | 自主事件指挥官等 6 大亮点 |
| [外部组件集成架构](docs/architecture/外部组件集成架构设计.md) | ~300 | 第三方系统集成 |
| [外部服务集成清单](docs/architecture/外部服务集成清单.md) | ~200 | 集成列表 |
| [P0 功能模块补充](docs/architecture/P0 功能模块补充设计.md) | ~300 | 核心模块补充 |
| [P0 交互设计补充](docs/architecture/P0 交互设计补充.md) | ~400 | 交互设计 |
| [P0 缺陷修复汇总](docs/architecture/P0%20缺陷修复汇总报告.md) | ~200 | 缺陷修复 |
| [Plugin SPI 示例](docs/architecture/plugin-spi-examples.md) | ~300 | 代码示例 |
| [平台服务拆分设计](docs/architecture/platform-service-split-design.md) | ~880 | orion-platform-service 拆分为 3 个服务 |
| [gRPC 集成设计](docs/architecture/grpc-integration-design.md) | ~700 | gRPC vs REST 决策矩阵 |
| [熔断降级设计](docs/architecture/circuit-breaker-degradation-design.md) | ~600 | L0-L3 降级级别 |
| [数据库迁移与查询设计](docs/architecture/database-migration-and-query-design.md) | ~550 | Flyway 迁移工具 |
| [Orion 架构流程图](docs/architecture/Onion-架构流程图.md) | ~500 | 完整架构图 (10 个) |
| [服务拆分实施方案](docs/architecture/platform-service-split-implementation.md) | ~800 | 4 服务拆分方案 |
| [微前端统一技术栈](docs/architecture/micro-frontend-unified-stack-design.md) | ~1100 | React 18 + Ant Design 5 |
| [API Gateway 增强](docs/architecture/api-gateway-enhancement-design.md) | ~1100 | 限流/熔断/版本化/路由 |
| [配置漂移检测](docs/architecture/configuration-drift-detection-design.md) | ~950 | GitOps 漂移检测/自动回滚 |
| [缓存层设计](docs/architecture/cache-layer-design.md) | ~1150 | Redis/失效策略/一致性 |
| [API 版本管理](docs/architecture/api-version-management-design.md) | ~1150 | 版本化策略/生命周期 |
| [插件框架设计](docs/architecture/plugin-framework-design.md) | ~1400 | 微内核/生命周期/安全沙箱 |
| [工具市场设计](docs/architecture/tool-marketplace-design.md) | ~2569 | 工具发现/安装/依赖解析 |
| [Hotfix 通道设计](docs/architecture/hotfix-channel-design.md) | ~2718 | 紧急发布/分支策略/快速验证 |

### 🤖 AI/算法

| 文档 | 行数 | 说明 |
|------|------|------|
| [算法设计详解](docs/ai/算法设计详解.md) | ~800 | 12 种算法详解 |
| [AI 模型训练与评估](docs/ai/AI 模型训练与评估详细设计.md) | ~700 | 模型训练流程 |
| [AI 降级方案](docs/ai/AI%20降级方案设计.md) | ~1500 | 15+ 降级场景 |
| [AI 模型测试集](docs/ai/AI%20模型测试集设计.md) | ~400 | 测试集管理 |
| [AI-Skill-Schema](docs/ai/AI-Skill-Schema-定义.md) | ~300 | Skill 定义规范 |
| [AI 模型验证集](docs/ai/AI%20模型验证集定义.md) | ~200 | 验证集管理 |
| [向量存储生产方案](docs/ai/向量存储生产方案.md) | ~300 | Chroma/Milvus 评估 |
| [PageRank 图数据更新](docs/ai/PageRank%20图数据更新设计.md) | ~200 | 根因定位算法 |
| [特征漂移监控](docs/ai/特征漂移监控设计.md) | ~200 | 模型监控 |
| [特征存储架构](docs/ai/feature-store-design.md) | ~850 | 离线/在线特征计算 |
| [模型灰度发布](docs/ai/model-canary-release-design.md) | ~820 | 影子模式→金丝雀 |
| [AI 成本控制](docs/ai/ai-cost-control-design.md) | ~1050 | Token 计费/预算管理 |
| [MLOps 与 ML 框架](docs/ai/mlops-and-ml-frameworks-design.md) | ~900 | MLflow + Kubeflow |
| [GNN 与强化学习](docs/ai/gnn-and-rl-design.md) | ~1200 | 图神经网络 +RL |
| [代码表示学习](docs/ai/code-representation-learning-design.md) | ~950 | AST+Code2Vec+Transformer |
| [**Skill 市场设计**](docs/ai/skill-marketplace-design.md) | ~1100 | **Skill 发现/安装/评分/审核** |

### 🔒 安全 (新增 3 份)

| 文档 | 行数 | 说明 |
|------|------|------|
| [安全与权限详解](docs/security/安全与权限详解.md) | ~800 | SSO + RBAC + ABAC |
| [认证授权与数据加密](docs/security/认证授权与数据加密设计.md) | ~600 | 认证流程 |
| [数据隐私合规](docs/security/data-privacy-compliance-design.md) | ~800 | GDPR/PIPL |
| [AI 安全加固](docs/security/AI%20安全加固设计.md) | ~500 | Prompt 注入等 |
| [Prompt 注入防护](docs/security/ADR-010-Prompt%20注入防护设计.md) | ~400 | ADR-010 |
| [JWT 并发刷新保护](docs/security/JWT%20并发刷新保护设计.md) | ~300 | Token 安全 |
| [自愈引擎权限治理](docs/security/自愈引擎权限治理设计.md) | ~300 | 权限最小化 |
| [软件供应链安全](docs/security/software-supply-chain-security-design.md) | ~900 | SLSA L3, SBOM |
| [UEBA 行为分析](docs/security/ueba-design.md) | ~600 | 用户行为分析 |
| [审计日志防篡改](docs/security/audit-log-tamper-proof-design.md) | ~500 | 链式 Hash 验证 |

### 🖥️ 前端 (新增 3 份)

| 文档 | 行数 | 说明 |
|------|------|------|
| [前端架构设计](docs/frontend/前端架构设计.md) | ~1000 | 技术栈、状态管理 |
| [前端组件库设计](docs/frontend/前端组件库设计.md) | ~800 | 组件规范 |
| [前端性能优化](docs/frontend/前端性能优化设计.md) | ~600 | 优化策略 |
| [页面风格与架构](docs/frontend/页面风格与架构设计.md) | ~500 | Design System |
| [审批组件库](docs/frontend/审批组件库.md) | ~400 | 审批专用组件 |
| [API 层设计规范](docs/frontend/API%20层设计规范.md) | ~300 | 前端 API 层 |
| [WebSocket 认证集成](docs/frontend/WebSocket%20认证集成设计.md) | ~300 | 实时通信 |
| [组件状态管理优化](docs/frontend/组件状态管理优化.md) | ~300 | 状态管理 |
| [Micro-frontend Guide](docs/frontend/micro-frontend-development-guide.md) | ~500 | 微前端开发指南 |
| [微前端统一技术栈](docs/frontend/micro-frontend-unified-stack-design.md) | ~1100 | Vue 3 + qiankun |
| [WebSocket 单例管理](docs/frontend/websocket-singleton-design.md) | ~900 | 多 Tab 共享连接 |
| [AI 人工确认交互设计规范](docs/frontend/AI 人工确认交互设计规范.md) | ~1200 | P0/P1/P2/P3 分层确认 |

### 🗄️ 数据库 (新增 3 份)

| 文档 | 行数 | 说明 |
|------|------|------|
| [数据库分片与同步](docs/db/数据库分片与同步设计.md) | ~500 | 分片策略 |
| [分布式事务设计](docs/db/distributed-transaction-design.md) | ~500 | Saga 模式 |
| [外部开源系统接入](docs/db/外部开源系统接入数据库扩展设计.md) | ~300 | 多数据源 |
| [SQL 审计设计](docs/db/sql-audit-design.md) | ~200 | SQL 审计 |
| [CMDB 数据库 Schema](docs/db/CMDB-数据库%20Schema%20设计.md) | ~200 | CMDB 表结构 |
| [数据库迁移与查询设计](docs/db/database-migration-and-query-design.md) | ~550 | Flyway 迁移 |
| [数据库迁移策略](docs/db/database-migration-strategy-design.md) | ~400 | Schema 变更流程 |
| [缓存层设计](docs/db/cache-layer-design.md) | ~600 | Redis 使用场景 |

### 🔧 SRE / 运维

| 文档 | 行数 | 说明 |
|------|------|------|
| [部署架构与监控指标](docs/sre/部署架构与监控指标设计.md) | ~400 | 部署拓扑 |
| [可观测性设计](docs/sre/可观测性设计.md) | ~500 | 指标/日志/追踪 |
| [灾备与备份恢复](docs/sre/灾备与备份恢复设计.md) | ~700 | 多活架构 |
| [SRE 运维加固](docs/sre/SRE%20运维加固设计.md) | ~400 | 运维手册 |
| [运维手册](docs/sre/运维手册.md) | ~300 | 日常运维 |
| [SRE 运维加固设计](docs/sre/sre-hardening-design.md) | ~600 | 监控/告警/演练 |
| [混沌工程方案](docs/sre/chaos-engineering-design.md) | ~700 | 故障注入测试 |
| [容量规划与弹性伸缩](docs/sre/capacity-planning-design.md) | ~800 | HPA/VPA/集群自动伸缩 |
| [**OnCall 排班系统**](docs/sre/oncall-scheduling-design.md) | ~2595 | **排班规则/告警路由/升级策略** |

### 📦 制品管理 (新增 2 份)

| 文档 | 行数 | 说明 |
|------|------|------|
| [产物与二方库管理](docs/artifact/产物与二方库管理设计.md) | ~400 | 制品生命周期 |
| [Artifact Promotion](docs/artifact/artifact-promotion-design.md) | ~300 | 制品晋升 |
| [依赖追踪](docs/artifact/dependency-tracking-design.md) | ~200 | 依赖管理 |
| [产物管理详细设计](docs/artifact/artifact-management-design.md) | ~800 | 镜像/依赖包全生命周期 |
| [二方库管理详细设计](docs/artifact/internal-library-management-design.md) | ~700 | 内部库创建/发布/升级 |

### 🔌 第三方集成 (新增 1 份)

| 文档 | 行数 | 说明 |
|------|------|------|
| [GitLab Adapter](docs/integration/gitlab-adapter.md) | ~400 | GitLab 集成 |
| [Harbor Adapter](docs/integration/harbor-adapter.md) | ~300 | 镜像仓库 |
| [Nexus Adapter](docs/integration/nexus-adapter.md) | ~300 | 依赖仓库 |
| [Gerrit Adapter](docs/integration/gerrit-adapter.md) | ~200 | 代码审查 |
| [External System Onboarding](docs/integration/external-system-onboarding.md) | ~300 | 接入流程 |
| [SSO 集成设计](docs/integration/sso-integration-design.md) | ~500 | OIDC/SAML2/LDAP |

### 📊 效能度量 (新增 1 份)

| 文档 | 行数 | 说明 |
|------|------|------|
| [DORA 指标计算](docs/efficiency/DORA%20指标计算设计.md) | ~500 | 四指标算法 |
| [FinOps 成本采集](docs/efficiency/FinOps-成本数据采集设计.md) | ~400 | 成本数据 |
| [效能看板详细设计](docs/efficiency/dashboard-design.md) | ~900 | DORA/趋势/对比/AI 建议 |

### 🎨 UI/UX (新增 1 份)

| 文档 | 行数 | 说明 |
|------|------|------|
| [核心页面线框图](docs/ui/核心页面线框图设计.md) | ~400 | 页面布局 |
| [Design-Tokens](docs/ui/Design-Tokens%20完整定义.md) | ~300 | 设计令牌 |
| [UI 视觉交互设计评审报告](docs/ui/ui-ux-design-review.md) | ~500 | UI 评审详细 |

### 📡 事件总线 (新增 1 份)

| 文档 | 行数 | 说明 |
|------|------|------|
| [NATS 事件总线功能](docs/event-bus/NATS%20事件总线功能设计.md) | ~400 | 事件格式 |
| [NATS 高可用方案](docs/event-bus/NATS%20高可用方案设计.md) | ~300 | 集群部署 |
| [事件 Schema 注册表](docs/event-bus/event-schema-registry-design.md) | ~1100 | CloudEvents 规范 |

### 🏗️ IaC 管理

| 文档 | 行数 | 说明 |
|------|------|------|
| [**IaC 管理设计**](docs/iac/iac-management-design.md) | ~1036 | **Terraform 集成/State 管理** |
| [IaC-AI-审查流程](docs/iac/IaC-AI-审查流程设计.md) | ~300 | AI 审查流程 |

| 文档 | 行数 | 说明 |
|------|------|------|
| [CMDB 模块设计](docs/cmdb/CMDB 模块设计.md) | ~300 | 模块结构 |
| [CMDB 集成接口](docs/cmdb/CMDB%20集成接口设计.md) | ~300 | API 接口 |
| [CMDB 建设决策](docs/cmdb/CMDB%20模块建设决策.md) | ~200 | 建设决策 |
| [CMDB 数据库 Schema](docs/cmdb/CMDB-数据库%20Schema%20设计.md) | ~200 | 42 张表设计 |

### 📝 评审报告

| 文档 | 行数 | 说明 |
|------|------|------|
| [评审报告](reports/评审报告.md) | ~400 | 综合评审 |
| [模块功能与交互评审](reports/模块功能与交互评审报告.md) | ~500 | 交互评审 |
| [26 模块多角色评审](reports/26%20模块多角色评审报告.md) | ~600 | 多角色评审 (已扩展为 37 模块) |
| [多角色综合评审](reports/多角色综合评审报告.md) | ~400 | 综合评审 |
| [UI 视觉交互评审](reports/UI%20视觉交互设计评审报告.md) | ~500 | UI 评审 |

### 📊 协作

| 文档 | 行数 | 说明 |
|------|------|------|
| [ChatOps 命令集设计](docs/collaboration/ChatOps 命令集设计.md) | ~400 | 10+ IM 命令 |
| [智能工单与自动排单设计](docs/collaboration/智能工单与自动排单设计.md) | ~31000 | NLP 工单理解/智能路由 |
| [**ChatOps 详细设计**](docs/collaboration/chatops-design.md) | ~3087 | **IM 集成/命令解析/执行引擎** |

### 📚 知识库 (新增 2 份)

| 文档 | 行数 | 说明 |
|------|------|------|
| [微服务改造方案](docs/knowledge/Orion-Knowledge%20微服务改造方案.md) | ~700 | 完整改造方案 |
| [知识库基础设计](docs/knowledge/knowledge-base-design.md) | ~300 | 基础设计 |
| [RAG 问答详细设计](docs/knowledge/rag-qa-design.md) | ~800 | RAG 智能问答 |
| [知识图谱构建](docs/knowledge/knowledge-graph-design.md) | ~600 | 文档关联/知识网络 |

### 📄 需求文档 (新增 4 份)

| 文档 | 行数 | 说明 |
|------|------|------|
| [产品需求文档-PRD](docs/requirements/产品需求文档-PRD.md) | ~1500 | 37 模块 251 功能完整定义 |
| [端到端场景需求规格说明书](docs/requirements/端到端场景需求规格说明书.md) | ~900 | 19 个端到端场景 |
| [AI 自动化机会分析](docs/requirements/AI 自动化机会分析与痛点需求挖掘.md) | ~800 | 7 个 AI 自动化场景 |
| [需求功能更新汇总](docs/requirements/需求功能更新汇总.md) | ~300 | 53 个补充功能详情 |

---

## 按模块索引

| 模块 | 名称 | 相关文档 |
|------|------|---------|
| M1 | 效能看板 | DORA 指标计算，前端组件库，效能看板详细设计 |
| M2 | 流水线可视化 | 前端架构，WebSocket 认证 |
| M3 | 审批工作台 | 审批组件库，前端架构 |
| M4 | 安全审计中心 | 安全与权限，数据隐私合规，审计日志防篡改 |
| M5 | Pipeline 引擎 | 算法设计，Plugin-SPI |
| M6 | 多分支产品线 | ADR-001, ADR-008 |
| M7 | 配置管理 GitOps | 开放平台基座 |
| M8 | 通知协作 | ChatOps 命令集，智能工单与自动排单 |
| M9 | AI 算法引擎 | 算法设计，AI 降级方案，Prompt 注入防护 |
| M10 | LLM 推理层 | AI 模型训练，特征漂移监控 |
| M11 | AI 增强层 | AI-Skill-Schema |
| M12 | Skill 管理 | AI-Skill-Schema |
| M13 | 代码管理 | GitLab Adapter, Gerrit Adapter |
| M14 | 构建环境 | 构建缓存 |
| M15 | 多工具链 | 工具管理中心，Plugin-SPI, 依赖追踪 |
| M16 | 智能部署 | 微服务架构，灾备方案 |
| M17 | 自愈引擎 | 可观测性，自愈权限治理 |
| M18 | 安全合规 | 安全与权限，Prompt 注入防护，软件供应链安全 |
| M19 | 多租户 | 多租户隔离设计 |
| M20 | IaC 管理 | IaC-AI-审查流程 |
| M21 | 审计中心 | 安全与权限，SQL 审计，审计日志防篡改 |
| M22 | FinOps 成本 | 成本数据采集，ClickHouse 集成 |
| M23 | SSO/RBAC | 认证授权，JWT 并发刷新，SSO 集成设计 |
| M24 | 事件总线 | NATS 事件总线，NATS 高可用 |
| M25 | 数据存储 | 数据库选型，数据库分片，备份恢复 |
| M26 | 可观测性 | 可观测性设计，部署架构 |
| M27 | 插件扩展 | Plugin-SPI, 开放平台基座 |
| M28 | Orion-Knowledge | 微服务改造方案，知识库基础设计，RAG 问答 |
| M29 | 产物管理 | 产物管理详细设计，Artifact Promotion |
| M30 | 二方库管理 | 二方库管理详细设计，依赖追踪 |
| M31 | 智能工单 | 智能工单与自动排单设计 |
| M32 | CMDB | CMDB 模块设计，CMDB 集成接口，CMDB Schema |
| M33 | 通知中心 | 通知协作，ChatOps |
| M34 | 人工确认交互 | AI 人工确认交互设计规范 |
| M35 | ChatOps | ChatOps 命令集设计 |
| M36 | AI 成本优化 | AI 成本控制设计 |
| M37 | AI 文档管理 | 知识库详细设计，RAG 问答，知识图谱 |

---

## 文档模板

| 模板 | 用途 |
|------|------|
| [ADR 模板](templates/模板-ADR%20架构决策.md) | 架构决策记录 |
| [模块技术规格](templates/模板%20-%20模块技术规格.md) | 模块详细设计 |

---

## 快速搜索

```bash
# 按关键词搜索所有文档
grep -rn "关键词" docs/ --include="*.md"

# 查找包含特定标签的文档
grep -rl "tags:.*RAG" docs/

# 列出所有 ADR
ls docs/adr/ADR-*.md

# 查找最近修改的文档
find docs/ -name "*.md" -mtime -7

# 统计文档行数
wc -l docs/**/*.md

# 验证统计一致性
./tools/search.sh --verify-stats
```

---

_维护者：Orion 架构团队 | 更新频率：每次文档变更时同步更新 | 最后更新：2026-04-11_