# 微服务迁移分析报告 - 剩余模块

> 基于 platform-service 代码量统计和业务域划分

## 当前状态

- **platform-service routes.ts**: 581 行，63 个路由模块
- **已迁移**: Pipeline (25803 lines), Ticket (部分), Monitor/Alert (部分), Deploy (部分), Agent, Intelligence

## 待迁移模块按优先级分类

### P0: 核心业务域（代码量大，独立性强）

| 模块 | 代码量 | 路由数 | 迁移优先级 |
|------|--------|--------|-----------|
| FinOps/Cost | 9,727 lines | 3 (cost, finops-v2, cost-operations) | ★★★★★ |
| AI/Review | 4,508 + 15,224 lines | 4 (ai-gateway, ai-decision, ai-review, ai-security) | ★★★★★ |
| Code Repository | 5,803 lines | 1 (code-repo) | ★★★★ |
| Build/CI | 5,379 lines | 2 (build, test-reports) | ★★★★ |

### P1: 中等业务域（有独立价值）

| 模块 | 代码量 | 路由数 | 迁移优先级 |
|------|--------|--------|-----------|
| Efficiency | 6,193 + 效率增强 | 2 (efficiency, efficiency-enhanced) | ★★★★ |
| Backup/DR | 5,463 + disaster-recovery | 4 (backup, disaster-recovery, disaster-recovery-advanced) | ★★★ |
| Self-Healing | 5,295 lines | 1 (self-healing) | ★★★ |
| Plugin System | 4,537 + plugin-routes | 4 (plugin-spi, plugins, plugins-enhanced, plugins/marketplace) | ★★★ |
| Config Management | 6,659 lines | 3 (config, system-config, config-mgmt-enhanced) | ★★★ |

### P2: 支撑性模块（可与 platform-core 合并）

| 模块 | 代码量 | 路由数 | 迁移建议 |
|------|--------|--------|----------|
| Tenant/IAM | 4,442 + roles/users/api-keys/privacy | 5 | 合并到 platform-core |
| Infrastructure | project/environment/ephemeral-env/product-line | 4 | 合并到 platform-core |
| Communication | notification/chatops/confirmation | 3 | 合并到 platform-core |
| Security | risk-engine/sbom/supply-chain | 4 | 独立安全服务或合并 |

### P3: 高级/实验性特性（保持不动）

- Community/Social (2 modules)
- Federation/Multi-Cloud (4 modules)
- Digital Twin, API Governance, Cross-Domain Orchestration
- Module Management, Scripts, MCP, Vector Store

## 建议迁移顺序

1. **orion-finops-svc** (FinOps/Cost) - 9,727 lines, 3 routes
2. **orion-ai-svc** (AI Review/Gateway/Decision) - 19,732 lines, 4 routes
3. **orion-code-svc** (Code Repository + Build) - 11,182 lines, 3 routes
4. **orion-efficiency-svc** (Efficiency) - 6,193 lines, 2 routes
5. **orion-backup-svc** (Backup + DR) - 5,463 + 2 modules

## 不建议迁移的模块

以下模块与 platform-core 高度耦合，建议保留：
- Tenant, Role, User, API Key, Privacy → IAM 核心
- Project, Environment, Product Line → 基础设施
- Notification, ChatOps, Confirmation → 通信层
- Module, Script, MCP → 平台内核功能

## 总结

platform-service 当前 63 个路由模块中：
- **12-15 个**适合迁移为独立微服务（P0+P1）
- **~20 个**应保留在 platform-core（P2）
- **~28 个**为高级特性保持现状（P3）

迁移后 platform-service 预计缩减至 ~300 行，专注平台内核功能。
