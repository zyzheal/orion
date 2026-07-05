# Orion 微服务功能清单

**总计 34 个微服务 + 1 个网关 + 2 个平台底座**

---

## 一、基础设施层（3 个）

| # | 服务名称 | 端口 | 技术栈 | 核心功能 |
|---|---------|------|--------|---------|
| 1 | orion-api-gateway | 3000 | Node.js/Fastify | **API 网关** — 统一入口，37+ 条代理路由，反向代理到所有微服务 |
| 2 | orion-platform-core | - | Node.js | **平台底座核心** — 共享基础设施（工具函数、类型定义、公共配置） |
| 3 | orion-platform-service | 3001 | Node.js/Fastify | **平台主服务** — 核心业务逻辑（流水线、配置、租户、审计等），48 个路由模块 |

---

## 二、研发效能层（8 个）

| # | 服务名称 | 端口 | 技术栈 | 核心功能 |
|---|---------|------|--------|---------|
| 4 | orion-pipeline-svc | 3002 | Node.js/Fastify | **流水线编排** — CI/CD Pipeline 创建/执行/状态管理，46 个服务文件，14991 行 |
| 5 | orion-deploy-svc | 3003 | Node.js/Fastify | **智能部署** — 灰度发布、金丝雀部署、回滚，10 个服务文件 |
| 6 | orion-runner-svc | 3028 | Node.js/Fastify | **CI Runner** — 任务注册、心跳、执行、结果回报，轻量级任务执行器 |
| 7 | orion-code-svc | 3010 | Node.js/Fastify | **代码管理** — 代码仓库对接、构建环境、测试报告 |
| 8 | orion-artifact-svc | 3014 | Node.js/Fastify | **制品管理** — 制品版本管理、发布、生命周期管理 |
| 9 | orion-plugin-svc | 3011 | Node.js/Fastify | **插件框架** — SPI 扩展机制、插件市场、插件生命周期 |
| 10 | orion-tool-svc | - | - | **工具中心** — 工具注册、工具市场、工具调用网关 |
| 11 | orion-approval-svc | 3023 | Node.js/Fastify | **审批/确认** — 人工审批流、变更确认、多级审批 |

---

## 三、AI 智能层（5 个）

| # | 服务名称 | 端口 | 技术栈 | 核心功能 |
|---|---------|------|--------|---------|
| 12 | orion-intelligence-svc | 3006 | Python | **AI 决策引擎** — AI 决策/审查/安全分析/变更智能 |
| 13 | orion-ai-svc | 3012 | Node.js/Fastify | **AI 网关** — 向量存储、LLM 路由、模型降级、AI 成本管控 |
| 14 | orion-agent-svc | 3007 | Node.js/Fastify | **AI Agent** — Agent 编排、任务分发、Agent 生命周期管理 |
| 15 | orion-skill-svc | 3021 | Node.js/Fastify | **Skill 管理** — 技能注册、发现、执行、版本管理 |
| 16 | orion-knowledge-svc | 3020 | Node.js | **知识库服务** — 知识检索、RAG 问答、知识索引 |

---

## 四、可观测性与运维层（6 个）

| # | 服务名称 | 端口 | 技术栈 | 核心功能 |
|---|---------|------|--------|---------|
| 17 | orion-monitor-svc | 3005 | Node.js/Fastify | **监控告警** — 指标采集、告警规则、故障诊断，5 个服务文件 |
| 18 | orion-selfhealing-svc | 3025 | Node.js/Fastify | **自愈引擎** — 自动故障检测、自愈策略执行、恢复流程 |
| 19 | orion-config-mgmt-svc | 3024 | Node.js/Fastify | **配置管理** — GitOps 配置同步、配置漂移检测、版本管理 |
| 20 | orion-dba-svc | 3031 | Node.js/Fastify | **DBA 服务** — SQL 审核/工单审批/数据源管理，包装 Yearning Java 后端 |

---

## 五、安全与合规层（3 个）

| # | 服务名称 | 端口 | 技术栈 | 核心功能 |
|---|---------|------|--------|---------|
| 23 | orion-security-svc | 3013 | Node.js/Fastify | **安全扫描** — SBOM、供应链安全、策略引擎 |
| 24 | orion-audit-svc | 3027 | Node.js/Fastify | **审计日志** — 审计追踪、合规检查、日志归档 |
| 25 | orion-risk-svc | 3018 | Node.js/Fastify | **风险评估** — 变更风险评估、风险指标、风险预警 |

---

## 六、运营与协作层（5 个）

| # | 服务名称 | 端口 | 技术栈 | 核心功能 |
|---|---------|------|--------|---------|
| 26 | orion-ticket-svc | 3004 | Node.js/Fastify | **工单管理** — 工单创建/流转/状态管理、SLA 跟踪 |
| 27 | orion-notify-svc | 3026 | Node.js/Fastify | **通知中心** — 多渠道通知（钉钉/企微/飞书/Slack）、Webhook |
| 28 | orion-chatops-svc | 3022 | Node.js/Fastify | **ChatOps** — 即时通讯机器人、命令解析、交互式操作 |
| 29 | orion-community-svc | 3029 | Node.js/Fastify | **社区协作** — 最佳实践分享、模板市场、社区贡献 |
| 30 | orion-efficiency-svc | 3015 | Node.js/Fastify | **效能看板** — DORA 指标、研发效能分析、趋势报告 |

---

## 七、高级功能层（5 个）

| # | 服务名称 | 端口 | 技术栈 | 核心功能 |
|---|---------|------|--------|---------|
| 31 | orion-finops-svc | 3009 | Node.js/Fastify | **FinOps** — 成本分析、成本优化、账单管理 |
| 32 | orion-dr-svc | 3016 | Node.js/Fastify | **容灾管理** — 备份策略、灾难恢复演练、RPO/RTO 管理 |
| 33 | orion-federation-svc | 3017 | Node.js/Fastify | **多云联邦** — 多云管理、跨云编排、联邦认证 |
| 34 | orion-governance-svc | 3030 | Node.js/Fastify | **治理中心** — API 治理、策略执行、合规审计 |
| 35 | orion-digital-twin-svc | 3008 | Node.js/Fastify | **数字孪生** — 服务模拟、环境仿真、预测分析 |

---

## 八、外部服务包装层（6 个）

| # | 服务名称 | 端口 | 包装后端 | 核心功能 |
|---|---------|------|---------|---------|
| 36 | orion-inception-svc | 3033 | Inception TCP(6669) | **SQL 审核引擎** — 将 Inception TCP 协议包装为 HTTP API |
| 37 | orion-pandawiki-svc | 3034 | PandaWiki HTTP(8001) | **知识库管理** — PandaWiki 文档/空间/搜索/AI 问答统一 API |
| 38 | orion-graph-svc | 3035 | Neo4j Bolt(7687) | **知识图谱** — Neo4j Cypher 查询、最短路径、服务拓扑发现 |
| 39 | orion-dba-svc | 3031 | Yearning HTTP(8000) | **SQL 工单** — SQL 审核工单、数据源、权限管理 |
| 40 | orion-ai-service | 8000 | Python FastAPI | **AI 事件处理** — NATS 事件订阅、AI 模型调用 |

---

## 端口分配总览

| 端口范围 | 用途 | 数量 |
|---------|------|------|
| 3000-3007 | 核心基础设施 + AI + 效能 | 8 |
| 3008-3017 | 高级功能 + 安全 + 效能 | 10 |
| 3018-3029 | 运维 + 协作 + 治理 | 12 |
| 3030-3035 | 治理 + 外部服务包装 | 6 |
| 8000-8001 | Python/Java 后端 | 2 |

---

_文档生成时间：2026-05-12_
_基于 /Users/heal/orion-design 代码库实际文件分析_
