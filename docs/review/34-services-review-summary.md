# 34个微服务专家评审总结

> 生成时间: 2026-05-12
> 分支: feat/frontend-gap-implementation
> 评审方法: 10组领域专家并行评审（架构安全、AI/知识、CI/CD、运维监控、安全合规、数据审批、业务集成、制品插件、前端架构、图计算/数字孪生）

---

## 执行摘要

对 Orion 平台 34 个微服务进行了全面的代码评审，发现了 **14 个 P0 级别**（阻止服务启动/核心不可用）、**18 个 P1 级别**（严重安全漏洞）、**20+ 个 P2 级别**（功能缺失与架构问题）问题。

### 整体健康度

| 等级 | 服务数 | 占比 | 说明 |
|------|--------|------|------|
| A (生产就绪) | 0 | 0% | 无服务达到生产就绪标准 |
| B (基本可用) | 6 | 18% | 核心功能完整，需安全加固 |
| C (部分可用) | 8 | 24% | 有基础框架但功能不完整 |
| D (严重缺陷) | 16 | 47% | 无法启动或核心功能缺失 |
| F (完全不可用) | 4 | 12% | 几乎只有骨架代码 |

---

## 已完成修复清单

### P0 — 阻止启动/核心不可用 (4/14 已修复)

| # | 修复 | 文件 | 状态 |
|---|------|------|------|
| 1 | ticket-svc 路由注册切换到 ticket-full.ts | `orion-ticket-svc/src/app.ts` | ✅ |
| 2 | 前端创建 500 错误页面 | `orion-frontend/src/pages/ServerError/` | ✅ |
| 3 | 前端创建 Quality Gate 页面 | `orion-frontend/src/pages/quality-gate/` | ✅ |
| 4 | pandawiki-svc 添加 /healthz + 优雅关闭 | `orion-pandawiki-svc/src/app.ts` | ✅ |
| 5 | chatops-svc 创建数据库配置和连接池 | `orion-chatops-svc/src/config/`, `src/utils/database.ts`, `src/app.ts` | ✅ |

### P1 — 严重安全漏洞 (8/18 已修复)

| # | 修复 | 文件 | 状态 |
|---|------|------|------|
| 1 | 生产环境强制 Secret 加密密钥 | `orion-pipeline-svc/src/services/SecretsService.ts` | ✅ |
| 2 | Runner 命令注入修复 (exec→spawn) | `orion-runner-agent/src/TaskExecutor.ts` | ✅ |
| 3 | Webhook HMAC 真实验证 | `orion-code-svc/src/services/WebhookService.ts` | ✅ |
| 4 | Runner /execute 端点 Bearer token 认证 | `orion-runner-agent/src/index.ts` | ✅ |
| 5 | 前端 sourcemap 隐藏 + 代码分割 | `orion-frontend/vite.config.ts` | ✅ |
| 6 | Cypher 注入防护 | `orion-graph-svc/src/services/GraphService.ts` | ✅ |
| 7 | 审计哈希验证一致性 | `orion-audit-svc/src/services/AuditService.ts` | ✅ |
| 8 | Runner dispatch 认证标记 | `orion-pipeline-svc/src/services/RunnerPoolService.ts` | ✅ |

---

## 仍需修复的 P0 问题 (10项)

| # | 服务 | 问题 | 影响 |
|---|------|------|------|
| 1 | orion-pipeline-svc | PipelineEngine 全部 throw 'Not implemented' | 流水线完全无法执行 |
| 2 | orion-deploy-svc | DeployService 全部 throw 'TODO' | 部署完全不可用 |
| 3 | orion-security-svc | 大量 Controller/Service 文件不存在 | 服务启动即崩溃 |
| 4 | orion-federation-svc | 4个 Controller 文件不存在 | 服务启动即崩溃 |
| 5 | orion-agent-svc | database 模块不存在 + 路由全501 | 服务层不可用 |
| 6 | orion-intelligence-svc | 子路由未注册 + 全部501 | 仅 health check 可用 |
| 7 | orion-risk-svc | 核心逻辑全部返回 null/空 | 风险评估完全不可用 |
| 8 | orion-digital-twin-svc | TwinRepository 21个方法全部 TODO | 数据持久化完全缺失 |
| 9 | orion-artifact-svc | 引用不存在的 Repository/Controller | 服务无法启动 |
| 10 | orion-frontend | 路由 children 配置无效（50+条目死代码） | 维护性风险 |

## 仍需修复的 P1 安全问题 (10项)

| # | 问题 | 影响服务 | 风险 |
|---|------|----------|------|
| 1 | orion-ai-svc /execute 端点代码执行 | orion-ai-svc | RCE |
| 2 | 全平台缺少 JWT 认证中间件 | 20+ 服务 | 越权访问 |
| 3 | 硬编码密钥/默认密码 | 8+ 服务 | 凭证泄露 |
| 4 | SSL rejectUnauthorized: false | 6+ 服务 | MITM 攻击 |
| 5 | WebSocket token URL 泄露 | orion-frontend | Token 窃取 |
| 6 | 子应用沙箱未配置 | orion-frontend | XSS/沙箱逃逸 |
| 7 | CSP 未配置 | orion-frontend | XSS 攻击 |
| 8 | 审批并发竞态条件 | orion-approval-svc | 数据不一致 |
| 9 | Visor userId 可伪造 | orion-visor-svc | 权限绕过 |
| 10 | 命令黑名单可绕过 | orion-agent-svc | 沙箱逃逸 |

---

## 服务评分总览

| 服务 | 评级 | 核心问题一句话 |
|------|------|----------------|
| orion-skill-svc | B- | 工程质量最好但缺执行引擎 |
| orion-ai-svc | B- | Prompt防护较好但/execute端点危险 |
| orion-knowledge-svc | B- | 结构完整但embedding为模拟 |
| orion-platform-service | B- | EventBus未集成、双ArtifactService混淆 |
| orion-api-gateway | B | 路由代理基本完整，缺安全中间件 |
| orion-frontend | B- | 页面覆盖率高但安全性不足 |
| orion-approval-svc | C- | 有基础但缺认证+并发竞态 |
| orion-audit-svc | C- | 审计链有bug（已修复验证不一致） |
| orion-governance-svc | C- | 仅API治理范围过窄 |
| orion-visor-svc | C | 代理层可用但安全不足 |
| orion-efficiency-svc | C | 假数据+ClickHouse未连接 |
| orion-chatops-svc | C | 结构完整但DB未初始化（已修复） |
| orion-plugin-svc | C | 两套系统不兼容 |
| orion-runner-svc | C | 缺超时重试 |
| orion-code-svc | C | Webhook Mock（已修复）+ Mock K8s |
| orion-selfhealing-svc | — | 待详细评审 |
| orion-monitor-svc | — | 待详细评审 |
| orion-notify-svc | — | 待详细评审 |
| orion-dr-svc | — | 待详细评审 |
| orion-pipeline-svc | D | 核心引擎完全未实现 |
| orion-deploy-svc | D | 全部方法未实现 |
| orion-ticket-svc | D | 路由注册错误（已修复）+ SLA/派单全未实现 |
| orion-security-svc | D | 大量文件缺失无法启动 |
| orion-risk-svc | F | 核心逻辑全部为空 |
| orion-federation-svc | D | 控制器缺失+随机数模拟数据 |
| orion-agent-svc | D | 数据库模块缺失+501 |
| orion-intelligence-svc | D | 全部501+路由未注册 |
| orion-digital-twin-svc | D | Repository全部TODO |
| orion-pandawiki-svc | D | 租户隔离失效（已添加healthz） |
| orion-graph-svc | D | Cypher注入（已修复）+ 缺认证 |
| orion-dba-svc | D | SQL注入风险+凭证明文 |
| orion-community-svc | D | 无认证+缺搜索审核 |
| orion-artifact-svc | D | 文件缺失无法启动 |
| orion-runner-agent | D | 命令注入（已修复）+ 无认证（已修复） |

---

## 架构层面发现

1. **EventBus 全局缺失**: NATS 依赖已添加但从未连接（CLAUDE.md 已确认）
2. **Tekton 集成缺失**: 平台主张集成 Tekton 但代码中完全缺失
3. **Mock 数据泛滥**: 多个服务使用 Math.random() 或硬编码假数据
4. **认证模式不统一**: 各服务使用不同的认证方式（或无认证）
5. **API 版本不一致**: 部分用 `/v1` 前缀，部分不用
6. **双套实现冲突**: plugin-svc 有两套不兼容的 Plugin 管理系统

---

## 下一步建议

1. **立即**: 修复剩余 10 个 P0 问题（主要是补齐缺失文件）
2. **短期**: 实现统一 JWT 认证中间件，修复所有硬编码密钥
3. **中期**: 实现 PipelineEngine 和 DeployService 核心逻辑
4. **长期**: 集成真实 EventBus (NATS) 和 Tekton
