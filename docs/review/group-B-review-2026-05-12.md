# Group B Services Review Report

**Date**: 2026-05-12
**Scope**: orion-pipeline-svc, orion-deploy-svc, orion-agent-svc, orion-runner-svc, orion-security-svc, orion-code-svc, orion-artifact-svc
**Reviewers**: code-architect (architecture), code-reviewer (quality), code-explorer (security)

---

## P0 - Blocking Issues (5 found)

| ID | Service | Issue | Impact |
|----|---------|-------|--------|
| P0-1 | runner/agent/code | 命令注入 -- `child_process.exec()` 直接执行用户输入 | RCE，攻击者可获取主机控制权 |
| P0-2 | 全部 7 个服务 | 无任何认证/鉴权中间件 | 所有 API 端点公开可访问 |
| P0-3 | 全部 7 个服务 | CORS `origin: true` 全开放 | 任何网页可跨域访问 |
| P0-4 | pipeline-svc | PipelineEngine Map 存储无清理机制 | 内存无限增长 → OOM |
| P0-5 | code-svc | CacheStorageDriver shell 注入 (tar 命令拼接) | 路径穿越 + 命令注入 |

## P1 - High Priority (10 found)

| ID | Service | Issue |
|----|---------|-------|
| P1-1 | pipeline-svc | Pipeline YAML 使用 `js-yaml.load()` 潜在反序列化风险 |
| P1-2 | 全部 7 个服务 | Database SSL 可通过 `DB_SSL_REJECT_UNAUTHORIZED=false` 绕过 |
| P1-3 | deploy-svc | DeployService 使用 Map() 内存存储，无持久化 |
| P1-4 | agent/runner | 缺少优雅关闭钩子，活跃任务中断 |
| P1-5 | code-svc | Webhook 签名验证在密钥未配置时返回 true |
| P1-6 | security-svc | Policy 绕过无审批/审计追踪 |
| P1-7 | deploy-svc | 状态转换无验证 (cancelled → deploying 等非法转换) |
| P1-8 | pipeline-svc | PipelineEngine 并发控制未实现 (maxConcurrentRuns 无效) |
| P1-9 | security-svc | SbomDocumentService 大量 `as any`，合规检查不可靠 |
| P1-10 | agent-svc | RunnerManager setInterval 无清理机制 |

## P2 - Medium Priority (7 found)

| ID | Service | Issue |
|----|---------|-------|
| P2-1 | runner-svc | 使用旧版 Fastify 4.x (其他服务用 5.x) |
| P2-2 | artifact-svc | Artifact 扫描为模拟实现，非真实安全扫描 |
| P2-3 | deploy-svc | 路由全部返回 501，DeployService 有实现但未调用 |
| P2-4 | 全部 7 个服务 | 缺少速率限制 |
| P2-5 | agent-svc | 数据库密码默认空字符串 |
| P2-6 | pipeline-svc | PipelineEngine 全局 Map 状态，服务重启丢失 |
| P2-7 | deploy-svc | CanaryAnalysisService/EnvironmentService 核心方法抛出 TODO |

---

## 修复优先级

1. P0-1: Runner/Agent 命令注入 → 改用 `spawn()` + 参数数组
2. P0-5: CacheStorageDriver shell 注入 → 参数化传递
3. P0-2: 全部服务添加 JWT 认证中间件
4. P0-3: CORS 限制为前端域名
5. P0-4: PipelineEngine 添加 Map TTL 清理
6. P1-5: Webhook 签名验证改为默认拒绝模式
7. P1-7: DeployService 添加状态转换验证
8. P1-2: 数据库 SSL 强制验证
