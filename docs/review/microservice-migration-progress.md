# 微服务拆分迁移进度报告

> 更新日期: 2026-05-11
> 审计日期: 2026-05-11 #1 (代码审计 - 发现以下偏差并修正)
> 审计日期: 2026-05-11 #2 (二次审计 - 发现新偏差并修正)

## 总体状态

微服务 P0+P1 全量拆分已完成。15 个独立微服务已创建，Gateway **57** 个代理路由配置完毕。

> **二次审计偏差说明**:
> - Gateway 代理路由: 上次修正为 53 → 实际 **57** 个 (继续增加)
> - 剩余路由注册点: 上次修正为 41 → 实际 **35** (27 active + 8 commented)
> - Git 提交 hash: `8ab2de4` → 实际 `8ab2de8`
> - 15 个核心服务的文件数和代码量 **全部与文档一致**

## 已拆分的微服务清单

### P0 服务（完整业务逻辑迁移）

| # | 服务名 | 端口 | 文件数 | 代码量 | 包含模块 |
|---|--------|------|--------|--------|----------|
| 1 | ticket-svc | 3004 | 23 | ~11,051 lines | Ticket CRUD, Dispatch, Workflow, SLA, BI, Transfer, Suspend |
| 2 | finops-svc | 3009 | 20 | ~8,265 lines | Cost, FinOps V2, Cost Operations, Budget, ROI, Cloud Cost |
| 3 | code-svc | 3010 | 34 | ~12,255 lines | Code Repository, Build System, Test Reports |
| 4 | plugin-svc | 3011 | 14 | ~3,983 lines | Plugin SPI, Plugin Management, Plugin Marketplace |
| 5 | ai-svc | 3012 | 30 | ~12,487 lines | AI Gateway, AI Decision, AI Review, AI Security, Vector Store, LLM Trace, Degradation |
| 6 | security-svc | 3013 | 18 | ~4,747 lines | Risk, SBOM, Supply Chain, Policy, Quality Gate |
| 7 | artifact-svc | 3014 | 12 | ~2,013 lines | Artifacts, Artifact Ops, Artifact Versions |

### P1 服务（服务代码+路由迁移）

| # | 服务名 | 端口 | 文件数 | 代码量 | 包含模块 |
|---|--------|------|--------|--------|----------|
| 8 | efficiency-svc | 3015 | 12 | ~4,652 lines | Efficiency, Efficiency Enhanced (DORA metrics) |
| 9 | dr-svc | 3016 | 17 | ~5,446 lines | Backup, Disaster Recovery, DR Advanced |
| 10 | federation-svc | 3017 | 14 | ~2,681 lines | Federation, Multi-Cloud, Federation Advanced |

### 骨架服务（框架+stub 路由）

| # | 服务名 | 端口 | 文件数 | 代码量 | 状态 |
|---|--------|------|--------|--------|------|
| 11 | pipeline-svc | 3002 | 58 | ~14,991 lines | ✅ 业务逻辑已填充 (46 个服务文件) |
| 12 | deploy-svc | 3003 | 14 | ~4,034 lines | ✅ 业务逻辑已填充 (10 个服务文件) |
| 13 | monitor-svc | 3005 | 13 | ~1,990 lines | ✅ 业务逻辑已填充 (5 个服务文件) |
| 14 | intelligence-svc | 3006 | 15 | ~715 (Python) | ✅ AI 端点已实现 (7 API) |
| 15 | agent-svc | 3007 | 16 | ~2,037 lines | ✅ 业务逻辑已填充 (9 个服务文件) |

## 统计数据

| 指标 | 文档值 | 实际值 | 偏差 |
|------|--------|--------|------|
| 独立微服务总数 (P0+P1+骨架) | 15 | 15 | 一致 |
| 额外服务目录 (未列入文档) | - | 9 | 已记录 |
| 总文件数 (15 服务 src/) | 252 | ~284 | +32 (骨架填充) |
| 总代码量 (15 服务 src/) | ~72,303 | ~97,762 | +25,459 (骨架填充) |
| Gateway 代理路由 | 48→53 | **57** | +4 (继续增长) |
| platform-service routes.ts | 484→483 | 483 | 一致 |
| platform-service route 文件 | 101 | **43** (清理后) | -58 孤儿已删除 |
| platform-service services/ | 98 | **60** (清理后) | -38 孤儿已删除 |
| 剩余路由注册点 | 36→41 | **35** (27 active + 8 commented) | 修正 |
| 独立数据库数 | 16 | 16 | 一致 |
| 15 服务标准文件 | - | **全部完整** | 9 个服务已补齐 |

## 保留在 platform-service 的模块（36个）

### P2: 平台内核（19个，不建议拆分）

| 类别 | 模块 |
|------|------|
| IAM/Auth (5) | tenant, role, user, apiKey, privacy |
| 基础设施 (4) | project, environment, ephemeral-env, product-line |
| 通信 (3) | notification, chatops, confirmation |
| 配置 (3) | config, config-mgmt-enhanced, unified-config |
| 平台核心 (4) | eventbus, module, session, metrics |

### P3: 高级/实验特性（17个）

| 类别 | 模块 |
|------|------|
| 社区社交 (2) | community, community-advanced |
| DevOps (5) | iac, webhook, script, skill, mcp |
| 其他 (10) | cmdb, audit, knowledge, api-governance, internal-library, digital-twin, multi-modal-trigger, cross-domain |

### 额外服务目录（已创建但未列入文档）

以下服务目录已存在，有代码但未被列入本文档的微服务清单：

| # | 服务名 | 文件数 | 代码量 | 状态 |
|---|--------|--------|--------|------|
| 1 | orion-audit-svc | 18 | ~1,971 | 独立服务 |
| 2 | orion-community-svc | 17 | ~2,437 | 独立服务 |
| 3 | orion-governance-svc | 18 | ~1,402 | 独立服务 |
| 4 | orion-notify-svc | 55 | ~1,056 | 独立服务 |
| 5 | orion-platform-core | 26 | ~2,920 | 平台核心拆分 |
| 6 | orion-skill-svc | 14 | ~1,326 | 独立服务 |
| 7 | orion-knowledge-svc | 18 | ~3,450 | 独立服务 |
| 8 | orion-runner-agent | 6 | ~581 | Runner Agent |
| 9 | orion-ai-service | 1373 | ~983 (src) | 旧版 AI 服务 (与 orion-ai-svc 重复) |

## Gateway 代理路由清单

| 服务 | 代理前缀 |
|------|----------|
| platform-core | /api/v1 (fallback) |
| pipeline-svc | /api/v1/pipeline, /api/v1/pipelines |
| deploy-svc | /api/v1/deploy |
| ticket-svc | /api/v1/tickets |
| monitor-svc | /api/v1/monitoring, /api/v1/alert |
| intelligence-svc | /api/v1/ai-gateway, /api/v1/ai-decision, /api/v1/ai-review, /api/v1/ai-security, /api/v1/change-intelligence |
| agent-svc | /api/v1/agents |
| finops-svc | /api/v1/cost, /api/v1/finops, /api/v1/cost-operations |
| code-svc | /api/v1/code-repo, /api/v1/build, /api/v1/test-reports |
| plugin-svc | /api/v1/plugins-spi, /api/v1/plugins, /api/v1/plugins-enhanced, /api/v1/plugins/marketplace |
| ai-svc | /api/v1/ai-gateway, /api/v1/ai-decision, /api/v1/ai-review, /api/v1/ai-security, /api/v1/vector-store, /api/v1/vector, /api/v1/llm, /api/v1/degradation |
| security-svc | /api/v1/risk, /api/v1/sbom, /api/v1/supply-chain, /api/v1/policies, /api/v1/quality-gates |
| artifact-svc | /api/v1/artifacts, /api/v1/artifact-ops, /api/v1/artifact-versions |
| efficiency-svc | /api/v1/efficiency |
| dr-svc | /api/v1/backup, /api/v1/disaster-recovery |
| federation-svc | /api/v1/federation, /api/v1/federation-advanced, /api/v1/multi-cloud, /api/v1/multi-cloud-advanced |
| knowledge-svc | /api/v1/knowledge |
| skill-svc | /api/v1/skills |
| notify-svc | /api/v1/notifications, /api/v1/webhooks |
| audit-svc | /api/v1/audit, /api/v1/compliance |
| community-svc | /api/v1/community, /api/v1/community-advanced |
| governance-svc | /api/v1/api-governance |
| platform-svc | /api/v1/platform |

## Docker Compose 服务配置

所有 16 个数据库已在 `orion-microservices/scripts/init-db.sh` 中配置：
platform_db, pipeline_db, deploy_db, ticket_db, monitor_db, intelligence_db, agent_db, finops_db, code_db, plugin_db, ai_db, security_db, artifact_db, efficiency_db, dr_db, federation_db

## 后续工作建议

1. ~~**完整业务逻辑迁移**: pipeline/deploy/monitor/intelligence/agent 骨架服务需要填充真实业务逻辑~~ ✅ 已完成
2. **端到端验证**: docker-compose 启动所有服务，验证 Gateway 代理到每个服务
3. **数据库迁移**: 为每个服务创建独立的数据库迁移脚本
4. **CI/CD 更新**: 为每个独立服务配置独立的构建和部署流程
5. **监控/日志**: 分布式链路追踪和日志聚合配置
6. **清理重复服务**: orion-ai-service (旧版) 与 orion-ai-svc 功能重叠，需确认哪个保留
7. **文档同步**: 额外 9 个服务目录 (audit/community/governance/notify/platform-core/skill/knowledge/runner-agent/ai-service) 需纳入文档管理
8. **🔴 删除 58 个孤儿 route 文件** (~10,018 行) — 已在独立微服务中实现，残留在 platform-service 中未被引用（详见 [full-module-audit-2026-05-11.md](full-module-audit-2026-05-11.md)）

## Git 提交记录

```
ce9a520 fix(platform-service): remove remaining P1 route registrations
4fba0c0 feat(microservices): add 3 P1 services - efficiency/dr/federation migration
5aadbac feat(microservices): add 4 new services - plugin/ai/security/artifact (P0 migration)
7b0e188 feat(microservices): add Code service (code-repo + build + test-reports) migration
8ab2de8 feat(microservices): add FinOps service with full business logic migration
c06d862 fix(platform-service): remove remaining deploy route registration and fix orphaned syntax
b4a19e4 feat(microservices): add skeleton services for ticket/monitor/deploy/agent/intelligence + gateway routes + platform-service cleanup
```

## 2026-05-11: 全模块审计与完善 (COMPLETED)

### 清理工作
- **删除 58 个孤儿 route 文件** (~10,018 行) — 属于已拆分微服务但残留在 platform-service
- **删除 43 个孤儿 services/ 子目录** — 对应的业务逻辑已迁移到独立微服务
- platform-service services/ 目录: 98 → **55 个**
- platform-service route 文件: 101 → **43 个**

### 骨架服务填充
从 platform-service 迁移了 5 个骨架服务的完整业务逻辑：
- **pipeline-svc**: +44 服务文件, 778 → 14,991 行 (PipelineEngine, PipelineRepository, SCMWebhookService 等 46 个服务)
- **deploy-svc**: +7 服务文件, 597 → 4,034 行 (DeployService, CanaryAnalysis, EnvironmentService, SmartDeploy 等)
- **agent-svc**: +6 服务文件, 1,041 → 2,037 行 (AgentService, RunnerManager, TaskExecutor, AgentSandbox 等)
- **monitor-svc**: +1 服务文件, 1,592 → 1,990 行 (AlertService, MonitoringService, OnCallService, SelfHealingService, CacheMonitor)
- **intelligence-svc**: Python AI 服务, 7 个 API 端点 (classify, code_review, predict_sla, root_cause, sentiment, solution, summarize)

### 补全工作
- **9 个服务补全标准文件**: finops/code/plugin/ai/security/artifact/efficiency/dr/federation
  - 每个服务新增: Dockerfile, .env.example, README.md, .gitignore, docker-compose.yml, tsconfig.json
- **全部 15 个服务现在都有完整的标准文件** (Dockerfile + README + .env + .gitignore + docker-compose + tsconfig.json)

### 发现但未处理的问题
- 5 个模块有代码但无独立服务: approval, self-healing, auth-enhanced, cron, developer-portal
- 8 个 commented 注册的路由仍保留在 routes.ts 中 (audit, skill, notification, webhook, knowledge, community, community-advanced, api-governance) — 这些已有独立服务
- orion-ai-service (旧版) 与 orion-ai-svc 重复
