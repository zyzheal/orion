# Group E Services Review Report

**Date**: 2026-05-12
**Scope**: orion-inception-svc, orion-pandawiki-svc, orion-visor-svc, orion-dba-svc

---

## P0 - Blocking Issues (7 found)

| ID | Service | Issue | Impact |
|----|---------|-------|--------|
| P0-1 | inception-svc | `npm run dev` 引用不存在的 `src/index.ts` | 无法启动 |
| P0-2 | pandawiki-svc | `npm run dev` 引用不存在的 `src/index.ts` | 无法启动 |
| P0-3 | inception-svc | 密码明文拼入 SQL 命令字符串 | 密码泄露到日志 |
| P0-4 | visor-svc | Terminal 端点无真实 WebSocket 实现 | 远程终端不可用 |
| P0-5 | visor-svc | 脚本执行无权限校验/审批流 | 任意主机命令执行 |
| P0-6 | dba-svc | `/query` 端点无 tenant/user 认证 | 任意 SQL 查询可执行 |
| P0-7 | dba-svc | SQL 执行无安全限制（DDL 阻断、时间窗口） | 危险操作无防护 |

## P1 - High Priority (9 found)

| ID | Service | Issue |
|----|---------|-------|
| P1-1 | 全部 4 个服务 | CORS `origin: true` 等价于 `*` |
| P1-2 | 全部 4 个服务 | 25 处 `as any` 零输入校验 |
| P1-3 | inception-svc | 执行端点无 token 认证 |
| P1-4 | pandawiki-svc | updateDocument/deleteDocument 缺少 tenantId |
| P1-5 | pandawiki-svc | 内容无 XSS 消毒 |
| P1-6 | visor-svc | 主机密码/私钥 API 传输无加密 |
| P1-7 | visor-svc/dba-svc | config 定义 database 但未使用 |
| P1-8 | dba-svc | 审批无角色校验 |
| P1-9 | dba-svc | URL 拼接 `tenantId=undefined` |

## P2 - Medium Priority (7 found)

| ID | Service | Issue |
|----|---------|-------|
| P2-1 | 全部 4 个服务 | 0 个测试文件 |
| P2-2 | 全部 4 个服务 | 无 tsconfig.json |
| P2-3 | 全部 4 个服务 | 部分服务无 graceful shutdown |
| P2-4 | inception-svc | `formatSql` 假实现 |
| P2-5 | inception-svc | `checkDangerousSql` 可绕过 |
| P2-6 | visor-svc | URL 参数字符串拼接 |
| P2-7 | pandawiki-svc | `Promise<any>` 返回类型 |

---

## 共性发现

四个服务全部采用 **API Proxy** 模式（Node.js Fastify 包装器 → 后端服务），无数据库持久化层。

### 修复优先级

1. P0-1/P0-2: 修复 package.json 脚本入口 (1 行修改 × 2)
2. P0-6: dba-svc `/query` 添加认证 (添加 preHandler)
3. P0-3: inception-svc 密码不再明文拼接
4. P1-1: 全部 4 个服务 CORS 限制为前端域名
