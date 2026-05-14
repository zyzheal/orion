# 34 Microservices Parallel Review - Summary

**Date**: 2026-05-12
**Method**: Agent parallel review (architecture + quality + security) in A→B→C→D→E groups
**Reports**: `docs/review/group-{A,B,C,D,E}-review-2026-05-12.md`

---

## Overall Statistics

| Group | Services | P0 | P1 | P2 | Total |
|-------|----------|----|----|----|-------|
| A (platform, gateway, frontend) | 3 | 6 | 13 | 6 | 25 |
| B (pipeline, deploy, agent, runner, security, code, artifact) | 7 | 5 | 10 | 7 | 22 |
| C (audit, chatops, cmdb, config-mgmt, monitor, notify, selfhealing, skill, plugin, risk, governance, dr, ticket, approval) | 14 | 6 | 8 | 5 | 19 |
| D (intelligence, knowledge, ai, graph, federation, digital-twin, finops, efficiency, community) | 9 | 4 | 6 | 4 | 14 |
| E (inception, pandawiki, visor, dba) | 4 | 7 | 9 | 7 | 23 |
| **Total** | **37** | **28** | **46** | **29** | **103** |

---

## Fixes Applied (12 total)

### Group A (6 fixes)
1. **P0-6**: JWT 默认密钥 → 改为强制要求环境变量 (api-gateway config)
2. **P0-4**: `/api/v1/knowledge` 路由重复 → 删除重复定义 (api-gateway routes)
3. **P0-5**: 微前端子应用端口错误 → 修正为正确端口 (frontend apps.ts)
4. **P1-5**: Rate limit 100→1000 req/min (api-gateway config)
5. **P1-6**: CORS `*` → 明确前端域名 (api-gateway config)
6. **P1-4/P1-10**: Auth 中间件添加 return + 移除 query token 支持 (api-gateway auth.ts)

### Group B (6 fixes)
7. **P0-1**: RunnerService `exec()` → `spawn()` 参数数组化 (runner-svc)
8. **P0-5**: CacheStorageDriver tar 命令 `exec()` → `spawn()` (code-svc)
9. **P1-5**: Webhook 签名验证改为默认拒绝模式 (code-svc)
10. **P1-7**: DeployService 添加状态转换验证 (deploy-svc)
11. **P0-4**: PipelineEngine 添加 Map TTL 清理机制 (pipeline-svc)

### Group E (2 fixes)
12. **P0-1/P0-2**: package.json 脚本入口修正 (inception-svc, pandawiki-svc)

---

## Unresolved Critical Issues (requiring larger changes)

| Priority | Issue | Group | Services Affected | Effort |
|----------|-------|-------|-------------------|--------|
| P0 | Pipeline 路由未注册 + PipelineEngine 未实例化 | A | platform-service | Medium |
| P0 | Event 系统未接入应用生命周期 | A | platform-service | Medium |
| P0 | 全部服务缺少 JWT 认证中间件 | B/C/D/E | 25+ services | Large |
| P0 | CORS 全开放 `origin: true` | B/C/D/E | 25+ services | Small |
| P0 | 密码明文拼入 SQL 命令字符串 | E | inception-svc | Medium |
| P0 | Terminal 端点无 WebSocket 实现 | E | visor-svc | Medium |
| P0 | `/query` 无认证 | E | dba-svc | Small |
| P1 | 核心服务完全未实现 (占位符) | C/D | cmdb, config-mgmt, monitor, intelligence, digital-twin | Large |
| P1 | DeployService Map → PostgreSQL | B | deploy-svc | Medium |
| P1 | Database SSL 可绕过 | B/D | 8 services | Small |
| P2 | 0 测试覆盖 | B/C/E | 20+ services | Large |

---

## Risk Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Startup readiness | 65% | Most services can start, but core features (Pipeline, Deploy) partially non-functional |
| Security | 40% | Widespread lack of auth, CORS open, some RCE vectors fixed |
| Type safety | 35% | `as any` pervasive across all services |
| Persistence | 50% | 30+ services migrated to PostgreSQL, but critical ones (Deploy) still in-memory |
| Test coverage | 20% | Only agent-svc has tests; most services have zero coverage |
| Documentation | 70% | Design docs exist, but code doesn't match specs in many areas |

---

## Recommended Next Steps

1. **Immediate (this week)**:
   - Register Pipeline routes in platform-service (P0, core functionality)
   - Add JWT auth middleware to all B/C/D/E services (P0, security)
   - Fix CORS `origin: true` to specific domains across all services (P0, security)

2. **Short term (next 2 weeks)**:
   - Migrate DeployService to PostgreSQL
   - Implement dba-svc `/query` authentication
   - Fix inception-svc password handling

3. **Medium term (next month)**:
   - Implement core logic for placeholder services (cmdb, config-mgmt, monitor, intelligence)
   - Add test coverage for critical paths (PipelineEngine, DeployService, RunnerService)
   - Add rate limiting to all services
