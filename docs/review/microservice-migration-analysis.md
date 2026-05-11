# 微服务迁移分析报告 - 剩余模块

> 基于 platform-service 代码量统计和业务域划分
> 审计日期: 2026-05-11 (二次审计 - 更新为最新状态)

## 当前状态

- **platform-service routes.ts**: 483 行，**35 个路由引用** (27 active + 8 commented)
- **Gateway api.ts**: **57 个代理路由**
- **已迁移完成**: P0 (7 服务) + P1 (3 服务) + 骨架 (5 服务) = 15 个独立微服务
- **Gateway 已配置**: 全部 15 个服务的代理路由 + 额外 7 个服务路由

## 已完成迁移的模块（与进度文档一致）

### P0 服务（完整业务逻辑迁移）✅

| 服务 | 端口 | 文件数 | 代码量 | 状态 |
|------|------|--------|--------|------|
| orion-ticket-svc | 3004 | 23 | 11,051 | ✅ 已迁移 |
| orion-finops-svc | 3009 | 20 | 8,265 | ✅ 已迁移 |
| orion-code-svc | 3010 | 34 | 12,255 | ✅ 已迁移 |
| orion-plugin-svc | 3011 | 14 | 3,983 | ✅ 已迁移 |
| orion-ai-svc | 3012 | 30 | 12,487 | ✅ 已迁移 |
| orion-security-svc | 3013 | 18 | 4,747 | ✅ 已迁移 |
| orion-artifact-svc | 3014 | 12 | 2,013 | ✅ 已迁移 |

### P1 服务（服务代码+路由迁移）✅

| 服务 | 端口 | 文件数 | 代码量 | 状态 |
|------|------|--------|--------|------|
| orion-efficiency-svc | 3015 | 12 | 4,652 | ✅ 已迁移 |
| orion-dr-svc | 3016 | 17 | 5,446 | ✅ 已迁移 |
| orion-federation-svc | 3017 | 14 | 2,681 | ✅ 已迁移 |

### 骨架服务（框架+stub 路由）

| 服务 | 端口 | 文件数 | 代码量 | 状态 |
|------|------|--------|--------|------|
| orion-pipeline-svc | 3002 | 14 | 778 | ⚠️ 骨架 |
| orion-deploy-svc | 3003 | 7 | 597 | ⚠️ 骨架 |
| orion-monitor-svc | 3005 | 12 | 1,592 | ⚠️ 骨架 |
| orion-intelligence-svc | 3006 | 15 | 715 | ⚠️ 骨架 |
| orion-agent-svc | 3007 | 10 | 1,041 | ⚠️ 骨架 |

## 保留在 platform-service 的模块

### P2: 平台内核（27 active + 8 commented = 35 引用）

| 类别 | 模块 | 状态 |
|------|------|------|
| IAM/Auth (5) | tenant, role, user, apiKey, privacy | active |
| 基础设施 (4) | project, environment, ephemeral-env, product-line | active |
| 通信 (3) | notification, chatops, confirmation | active* |
| 配置 (3) | config, config-mgmt-enhanced, unified-config | active |
| 平台核心 (4) | eventbus, module, session, metrics | active |
| 其他 (9) | cmdb, iac, webhook, skill, mcp, knowledge, vector-store, llm-trace, degradation | mixed |
| 已注释 (8) | audit, skill, + 其他 P3 模块 | commented out |

> *注: notification/webhook 已在 Gateway 配置了代理到 orion-notify-svc (3026)

### P3: 高级/实验性特性

- Community/Social (community, community-advanced) → 已有独立服务
- API Governance → 已有 orion-governance-svc
- Digital Twin, Cross-Domain Orchestration → 仍在 platform-service
- Config Management (原建议 P1，已保留在 platform-service)

## 额外已创建服务（不在原 P0-P3 计划中）

| 服务 | 文件数 | 代码量 | 来源 |
|------|--------|--------|------|
| orion-audit-svc | 18 | 1,971 | 从 P2 audit 模块拆分 |
| orion-community-svc | 17 | 2,437 | 从 P3 community 模块拆分 |
| orion-governance-svc | 18 | 1,402 | 从 P3 api-governance 模块拆分 |
| orion-notify-svc | 55 | 1,056 | 从 P2 notification 模块拆分 |
| orion-platform-core | 26 | 2,920 | 平台核心拆分 |
| orion-skill-svc | 14 | 1,326 | 从 P3 skill 模块拆分 |
| orion-knowledge-svc | 18 | 3,450 | 从 P2 knowledge 模块拆分 |
| orion-runner-agent | 6 | 581 | Runner Agent |
| orion-ai-service | 1373 | 983 | 旧版 AI 服务 (重复) |

## 建议迁移顺序（已调整）

1. ~~orion-finops-svc~~ ✅ 已完成
2. ~~orion-ai-svc~~ ✅ 已完成
3. ~~orion-code-svc~~ ✅ 已完成
4. ~~orion-efficiency-svc~~ ✅ 已完成
5. ~~orion-backup-svc~~ ✅ 已完成 (as orion-dr-svc)

**下一步建议**:
6. **填充骨架服务**: pipeline/deploy/monitor/intelligence/agent 需要真实业务逻辑
7. **清理重复**: orion-ai-service (旧版) vs orion-ai-svc
8. **同步文档**: 额外 9 个服务需纳入正式管理

## 不建议迁移的模块

以下模块与 platform-core 高度耦合，建议保留：
- Tenant, Role, User, API Key, Privacy → IAM 核心
- Project, Environment, Product Line → 基础设施
- Module, Script, MCP → 平台内核功能

## 总结

platform-service 当前 483 行 routes.ts 中：
- **15 个**已拆分为独立微服务（P0+P1+骨架）✅
- **27 个**仍 active 注册在 platform-service
- **8 个**已注释掉（准备移除）
- **9 个**额外服务已创建但未列入原计划

Gateway 已配置 57 个代理路由，覆盖所有已拆分服务 + 额外服务。
