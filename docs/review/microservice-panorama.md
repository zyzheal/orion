# Orion 微服务拆分全景图

> 生成日期: 2026-05-12
> 基于代码审计: 34 个模块 + platform-service 内部 62 个子模块

---

## 一、总体概览

| 维度 | 数量 | 说明 |
|------|------|------|
| 独立微服务 | 24 个 | orion-*-svc 目录 |
| 平台核心 | 3 个 | platform-service, api-gateway, frontend |
| 基础设施 | 4 个 | db, dba, visor, knowledge(Python) |
| 编排工具 | 1 个 | microservices (Docker Compose) |
| Python 服务 | 2 个 | orion-ai-service, orion-knowledge |
| Java 服务 | 2 个 | orion-visor, orion-dba (Yearning) |
| Node.js 服务 | 24 个 | 全部 *-svc + platform + gateway |

## 二、独立微服务清单（24 个）

### 已完整迁移（P0, 7 个）

| # | 服务 | 端口 | 代码量 | 功能 |
|---|------|------|--------|------|
| 1 | orion-ticket-svc | 3004 | 11,051 行 | ITSM 工单管理、智能派单、SLA |
| 2 | orion-finops-svc | 3009 | 8,265 行 | FinOps 成本分析、ROI、预算 |
| 3 | orion-code-svc | 3010 | 12,255 行 | 代码仓库、构建、测试报告 |
| 4 | orion-plugin-svc | 3011 | 3,983 行 | 插件 SPI、生命周期、市场 |
| 5 | orion-ai-svc | 3012 | 12,487 行 | AI 网关/Review/向量存储/Trace |
| 6 | orion-security-svc | 3013 | 4,747 行 | 风险评估、SBOM、供应链安全 |
| 7 | orion-artifact-svc | 3014 | 2,013 行 | 制品管理、版本溯源 |

### 已迁移路由（P1, 3 个）

| # | 服务 | 端口 | 代码量 | 功能 |
|---|------|------|--------|------|
| 8 | orion-efficiency-svc | 3015 | 4,652 行 | DORA 指标、效能度量 |
| 9 | orion-dr-svc | 3016 | 5,446 行 | 灾备、备份、恢复 |
| 10 | orion-federation-svc | 3017 | 2,681 行 | 多云联邦、跨云调度 |

### 额外已创建（6 个）

| # | 服务 | 代码量 | 功能 |
|---|------|--------|------|
| 11 | orion-audit-svc | 1,971 行 | 审计日志、合规 |
| 12 | orion-community-svc | 2,437 行 | 开发者社区 |
| 13 | orion-governance-svc | 1,402 行 | API 治理 |
| 14 | orion-notify-svc | 1,056 行 | 通知、Webhook |
| 15 | orion-skill-svc | 1,326 行 | 技能市场 |
| 16 | orion-knowledge-svc | 3,450 行 | 知识库、RAG |

### 骨架服务（5 个）

| # | 服务 | 代码量 | 状态 | 缺失 |
|---|------|--------|------|------|
| 17 | orion-pipeline-svc | 14,450 行 | 最完整 | DB 对接 |
| 18 | orion-deploy-svc | 4,090 行 | 骨架 | 路由 501、无 DB |
| 19 | orion-monitor-svc | 2,048 行 | 半骨架 | 路由未连接 |
| 20 | orion-agent-svc | 2,041 行 | 半骨架 | 路由未连接 |
| 21 | orion-intelligence-svc | 715 行 | 纯骨架 | 无实现 |

### 其他独立服务（3 个）

| # | 服务 | 功能 |
|---|------|------|
| 22 | orion-approval-svc | 审批管理 |
| 23 | orion-chatops-svc | ChatOps 命令路由 |
| 24 | orion-runner-agent | Runner 执行器 |

## 三、平台核心（3 个）

| # | 模块 | 功能 |
|---|------|------|
| 25 | orion-platform-service | 38 路由端点，62 内部子模块 |
| 26 | orion-api-gateway | Fastify 网关，57+ 代理路由 |
| 27 | orion-frontend | React 18 + Vite + wujie, 27 页面 |

## 四、基础设施（5 个）

| # | 模块 | 技术栈 | 功能 |
|---|------|--------|------|
| 28 | orion-ai-service | Python | AI 事件订阅、Code Review |
| 29 | orion-db | SQL | PostgreSQL + Redis, 194 migrations |
| 30 | orion-dba | Java (Yearning) | SQL 审核 |
| 31 | orion-visor | Java | 自动化运维平台 |
| 32 | orion-knowledge | Python (PandaWiki) | 可插拔知识库 |

## 五、platform-service 内部可继续拆分模块

### 建议拆分（8 个）

| 优先级 | 模块 | 代码量 | 建议新服务 |
|--------|------|--------|-----------|
| P1 | ai/ | 15,224 行 | orion-ai-core-svc |
| P1 | config-mgmt/ | 6,659 行 | orion-config-mgmt-svc |
| P1 | self-healing/ | 5,295 行 | orion-selfhealing-svc |
| P2 | risk-assessment/ | 3,964 行 | 合并到 security-svc |
| P2 | security/ | 3,865 行 | 合并到 security-svc |
| P2 | cmdb/ | 3,563 行 | orion-cmdb-svc |
| P2 | digital-twin/ | 3,300 行 | orion-digital-twin-svc |
| P2 | audit/ | 3,095 行 | 合并到 audit-svc |

### 不建议拆分（平台内核）

user, role, session, api-key, project, environment, product-line, tenant, database, cache, metrics, health, scheduler, event-bus, module-lifecycle, guardian

## 六、技术栈分布

```
Python (2):  orion-ai-service, orion-knowledge
Java (2):    orion-visor, orion-dba
Node.js (24): 全部 *-svc + platform + gateway
React (1):   orion-frontend
```

## 七、Gateway 代理路由（57+）

Gateway 已为每个独立微服务配置代理路由，统一入口 `/api/v1/{service}/*` 转发到对应服务端口。
