# 全模块审计报告

> 审计日期: 2026-05-11
> 审计范围: platform-service 全部 route 文件、services 目录、已拆分微服务、Gateway 配置

## 执行摘要

**发现 58 个孤儿 route 文件**（~10,398 行代码），属于已拆分微服务但残留在 platform-service 中未被引用。这些文件既不编译也不运行，但占用仓库体积并造成维护混淆。

## 1. platform-service routes.ts 状态

| 指标 | 数值 |
|------|------|
| routes.ts 总行数 | 483 |
| import 的 route 模块 | 35 个 |
| active 注册的路由 | 27 个 |
| commented 的路由 | 8 个 (audit, skill, notification, webhook, knowledge, community, community-advanced, api-governance) |
| 未 import 的 route 文件 | **58 个** (~10,398 行) |
| 总 route 文件数 | 101 个 (含 routes-cmdb.ts) |

## 2. 孤儿 route 文件清单（58 个，需删除）

### 属于已拆分微服务（应清理出 platform-service）

| 归属服务 | 孤儿文件数 | 代码量 | 文件列表 |
|---------|-----------|--------|---------|
| **ticket-svc** | 1 | 413 | ticketing-routes |
| **finops-svc** | 3 | 433 | cost-routes, cost-operations-routes, finops-v2-routes |
| **code-svc** | 5 | 1,517 | code-repo-routes, build-routes, test-report-routes, test-generation-routes, test-selector-routes |
| **plugin-svc** | 4 | 559 | plugin-routes, plugin-spi-routes, plugin-marketplace-routes, plugin-hotreload-routes |
| **ai-svc** | 5 | 1,444 | ai-gateway-routes, ai-decision-routes, ai-review-routes, ai-security-routes, ai-cost-routes |
| **security-svc** | 5 | 1,094 | risk-routes, sbom-routes, supply-chain-routes, quality-gate-routes, policy-routes |
| **artifact-svc** | 3 | 487 | artifact-routes, artifact-ops-routes, artifact-version-routes |
| **efficiency-svc** | 2 | 700 | efficiency-routes, efficiency-enhanced-routes |
| **dr-svc** | 3 | 284 | backup-routes, disaster-recovery-routes, disaster-recovery-advanced-routes |
| **federation-svc** | 4 | 231 | federation-routes, federation-advanced-routes, multi-cloud-routes, multi-cloud-advanced-routes |
| **pipeline-svc** | 9 | 939 | pipeline-budget-routes, pipeline-graph-routes, pipeline-sse-routes, pipeline-template-routes, pipeline-version-routes, autonomous-pipeline-routes, data-pipeline-routes, hook-chain-routes, canary-analysis-routes, canary-traffic-routes, chaos-enhanced-routes |
| **deploy-svc** | 2 | 459 | deploy-routes, deploy-enhanced-routes |
| **monitor-svc** | 6 | 880 | alert-routes, monitoring-routes, observability-routes, oncall-routes, performance-routes, queue-routes, escalation-routes |
| **intelligence-svc** | 2 | 526 | change-intelligence-routes, diagnostic-routes |
| **agent-svc** | 1 | 52 | runner-routes |

**合计: 58 个孤儿文件, ~10,018 行**

### 仍在 platform-service 中但有 route 文件未 import（需确认）

| 文件 | 代码量 | 状态 |
|------|--------|------|
| approval-routes.ts | 222 | 有 service (approval/) 但 routes.ts 中无 import |
| auth-enhanced-routes.ts | 421 | 有 service (auth/) 但 routes.ts 中无 import |
| cron-routes.ts | 227 | 有 service 但 routes.ts 中无 import |
| developer-portal-routes.ts | 98 | 有 service 但 routes.ts 中无 import |
| security-compliance-routes.ts | 140 | import 了但注册被注释 |
| self-healing-routes.ts | 133 | 有 service 但 routes.ts 中无 import |

## 3. services/ 目录状态（98 个子目录）

platform-service/src/services/ 下有 98 个服务模块目录。其中：
- **已迁移到独立微服务的 services**: 对应的 service 目录仍存在（代码冗余）
- **仍在 platform-service 中正常使用的 services**: ~50 个
- **已废弃但有 service 目录的**: 对应 commented 注册的服务

## 4. Gateway 路由与 platform-service 注册对照表

| Gateway 前缀 | platform-service 注册状态 | 备注 |
|-------------|-------------------------|------|
| /api/v1/platform | N/A (fallback) | Gateway 自身路由 |
| /api/v1/pipeline | 不在 platform-service | → pipeline-svc (3002) |
| /api/v1/deploy | 不在 platform-service | → deploy-svc (3003) |
| /api/v1/tickets | 不在 platform-service | → ticket-svc (3004) |
| /api/v1/monitoring, /api/v1/alert | 不在 platform-service | → monitor-svc (3005) |
| /api/v1/ai-gateway 等 (8个) | 不在 platform-service | → ai-svc (3012) |
| /api/v1/agents | 不在 platform-service | → agent-svc (3007) |
| /api/v1/cost 等 (3个) | 不在 platform-service | → finops-svc (3009) |
| /api/v1/code-repo 等 (3个) | 不在 platform-service | → code-svc (3010) |
| /api/v1/plugins 等 (4个) | 不在 platform-service | → plugin-svc (3011) |
| /api/v1/risk 等 (5个) | 不在 platform-service | → security-svc (3013) |
| /api/v1/artifacts 等 (3个) | 不在 platform-service | → artifact-svc (3014) |
| /api/v1/efficiency | 不在 platform-service | → efficiency-svc (3015) |
| /api/v1/backup, /disaster-recovery | 不在 platform-service | → dr-svc (3016) |
| /api/v1/federation 等 (4个) | 不在 platform-service | → federation-svc (3017) |
| /api/v1/knowledge | **commented** | → knowledge-svc (3020) 独立 |
| /api/v1/skills | **commented** | → skill-svc (3021) 独立 |
| /api/v1/notifications, /webhooks | **commented** | → notify-svc (3026) 独立 |
| /api/v1/audit, /compliance | **commented** | → audit-svc (3027) 独立 |
| /api/v1/community 等 (2个) | **commented** | → community-svc (3029) 独立 |
| /api/v1/api-governance | **commented** | → governance-svc (3030) 独立 |
| /api/v1/multi-cloud 等 (2个) | active | → federation-svc (3017) |
| /api/v1 (fallback) | active | → platform-service (3001) |

**结论**: Gateway 配置了路由到已独立的服务，但 platform-service 中对应的 route 文件未清理。8 个 commented 注册的路由已通过独立服务实现。

## 5. 发现的问题

### P0: 数据冗余（应立即清理）
- 58 个孤儿 route 文件 (~10,018 行) 残留在 platform-service
- 对应的 services/ 子目录也仍然存在（估计 ~5,000+ 行服务代码冗余）

### P1: 文档与代码不一致
- microservice-migration-analysis.md 中 P1 "Self-Healing"、"Config Management" 标记为待迁移，但实际已有独立 service 目录和 route 文件
- "Plugin System" 标记为待迁移，但 plugin-svc 已创建

### P2: 缺失的独立服务
- **approval-svc**: 有 approval/ service 和 approval-routes.ts，无独立服务目录
- **self-healing-svc**: 有 self-healing/ service 和 self-healing-routes.ts，无独立服务目录
- **auth-enhanced-svc**: 有 auth-enhanced-routes.ts，无独立服务目录
- **cron-svc**: 有 cron-routes.ts，无独立服务目录
- **developer-portal-svc**: 有 developer-portal-routes.ts，无独立服务目录

### P3: intelligence-svc 结构异常
- intelligence-svc 使用 Python (.py)，非 TypeScript
- 文件统计之前只算 .ts 显示 0 文件，实际有 .py 文件
- 需在文档中标注为 Python 服务

## 6. 建议清理操作

1. **删除 58 个孤儿 route 文件** — 已在独立微服务中实现
2. **删除对应的 orphaned services/ 子目录** — 减少冗余
3. **移除 routes.ts 中 8 个 commented 注册的 import** — 代码清理
4. **确认 approval/self-healing/auth-enhanced/cron/developer-portal 是否需要独立服务**
5. **更新文档标注 intelligence-svc 为 Python 服务**
