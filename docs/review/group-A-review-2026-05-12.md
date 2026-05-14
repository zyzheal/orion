# Group A Core Services Review Report

**Date**: 2026-05-12
**Scope**: orion-platform-service, orion-api-gateway, orion-frontend
**Reviewers**: code-architect (architecture), code-reviewer (quality), code-explorer (security)

---

## P0 - Blocking Issues (6 found)

| ID | Service | Issue | Impact |
|----|---------|-------|--------|
| P0-1 | platform | Pipeline 路由未注册 (`routes.ts` 中无 Pipeline 路由导入/调用) | Pipeline CRUD + 执行 API 全部不可用 |
| P0-2 | platform | PipelineEngine 未实例化 (仅在 `routes.ts.bak` 和测试中) | 无法触发任何 Pipeline 执行 |
| P0-3 | platform | Event 系统未接入应用生命周期 (NATS 消费者不启动) | 事件发布器静默失败 |
| P0-4 | gateway | `/api/v1/knowledge` 路由重复定义 (knowledge vs pandawiki) | Knowledge service (3020) 永远不可达 |
| P0-5 | frontend | 微前端子应用端口错误 (dba→3001, knowledge→3002, visor→3003) | 开发环境所有子应用加载失败 |
| P0-6 | gateway | JWT 默认密钥 `orion-default-jwt-secret-change-in-production` | 认证完全可绕过 |

## P1 - High Priority (13 found)

| ID | Service | Issue |
|----|---------|-------|
| P1-1 | platform | SagaCoordinator 未被全局接入 |
| P1-2 | platform | Tenant RLS 连接泄漏风险 (preHandler/onResponse 竞态) |
| P1-3 | platform | routes.ts 中 30+ 处注释掉的 TODO 路由 |
| P1-4 | gateway | Auth 中间件认证失败后缺少显式 return |
| P1-5 | gateway | Rate limit 默认 100 req/min 过低 (SPA 初始化即触发) |
| P1-6 | gateway | CORS 默认 `*` + credentials: true 危险组合 |
| P1-7 | frontend | 已删除文件仍被 routes.ts 引用 (AICostDashboard, AIDocManagement) |
| P1-8 | frontend | SubAppRoute 硬编码 3 个应用，扩展性差 |
| P1-9 | frontend | ESM 中使用 `require('wujie')` |
| P1-10 | gateway | Token 通过 query 参数传递 (URL 日志泄露) |
| P1-11 | gateway | Redis 连接缺少 TLS |
| P1-12 | frontend | Token 存储在 localStorage (XSS 可窃取) |
| P1-13 | platform | `routes-auth.ts` 大量 `as any` 类型断言 |

## P2 - Medium Priority (6 found)

| ID | Service | Issue |
|----|---------|-------|
| P2-1 | platform | DB 连接失败后继续启动，路由运行时会崩溃 |
| P2-2 | frontend | CSP 包含 `unsafe-inline` 和 `http:` 协议 |
| P2-3 | gateway | Proxy error 监听器重复注册 (内存泄漏) |
| P2-4 | platform | PipelineEngine Map 存储无上限 (OOM 风险) |
| P2-5 | frontend | API 路径一致性缺少自动化回归测试 |
| P2-6 | platform | `routes-auth.ts` JWT_SECRET 缺失时返回 500 暴露内部信息 |

---

## 修复优先级

1. P0-6: JWT 默认密钥 (1 行修改)
2. P0-4: knowledge 路由重复 (删除 1 行)
3. P0-5: 微前端端口错误 (修改 3 行)
4. P1-5: Gateway rate limit 过低 (修改 1 行)
5. P1-6: CORS `*` 默认值 (修改 1 行)
6. P1-4: Auth 中间件缺少 return (修改 1 行)
7. P1-7: 删除已删除文件的路由引用 (删除 ~20 行)
8. P1-10: 移除 query token 支持 (修改 1 行)
9. P0-1/P0-2/P0-3: Pipeline 路由注册 (需要较大改动，单独处理)
10. P2-2: 前端 CSP 修复
