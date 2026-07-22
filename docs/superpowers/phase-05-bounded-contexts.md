# Phase 0.5: DDD 限界上下文梳理

## 10 个限界上下文映射

### 1. CI/CD (核心域, P0)
- pipeline, runner, deploy, build-env, canary, artifact, code-repo

### 2. ITSM (核心域, P0)
- incident, change, problem, sla, self-healing, escalation

### 3. AI/Intelligence (核心域, P0)
- skill, llm, aiagent, aicost, aigateway, aireview, aisecurity, intelligence, mcp

### 4. Ticket (核心域, P0)
- ticketing, queue, runbook, ticket-knowledge

### 5. Governance & Compliance (支撑域, P1)
- governance, policy, compliance, risk, security-compliance

### 6. Observability (支撑域, P1)
- monitoring, alert, tracing, audit, slo

### 7. Infrastructure (支撑域, P1)
- infrastructure, iac, multi-cloud, dba, digital-twin, chaos, serverless

### 8. FinOps (支撑域, P1)
- finops-v2, efficiency, report-designer, cost-allocation

### 9. Config & Gateway (通用域, P2)
- config, gateway-dynamic, plugin, feature-flag, federation

### 10. Platform (通用域, P2)
- tenant, approval, team, project, sprint, i18n, capability, inception, handler-registry, service-registry, page-registry, internal-library, subapp, workbench, product-line, environment, developer-portal, chatops, cron

## 当前模块归属

| 限界上下文 | Go 平台已有模块 |
|------------|----------------|
| CI/CD | deploy, build-env, artifact, code-repo, plugin |
| ITSM | incident, change, sla |
| AI | skill, knowledge |
| Ticket | ticketing |
| Governance | policy, security-compliance |
| Observability | monitoring, alert, audit |
| Infrastructure | infrastructure, iac, multi-cloud, dba, digital-twin, chaos, serverless |
| FinOps | finops-v2 |
| Config/Gateway | config, gateway-dynamic, feature-flag, federation |
| Platform | tenant, approval, team, project, sprint, i18n, capability, inception, handler-registry, service-registry, page-registry, internal-library, subapp, workbench, product-line, environment, developer-portal, chatops, cron, project-member, artifact-ops |

## 待迁移模块

- pipeline, runner, canary (CI/CD 核心)
- problem, self-healing, escalation (ITSM)
- llm, aiagent, aicost, aigateway, aireview, aisecurity, intelligence (AI)
- queue, runbook, ticket-knowledge (Ticket)
- governance, compliance, risk (Governance)
- tracing, slo (Observability)
- efficiency, report-designer (FinOps)
- notification, identity, workflow (Platform 扩展)
