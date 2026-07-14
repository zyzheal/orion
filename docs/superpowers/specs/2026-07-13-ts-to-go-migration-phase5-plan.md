# TS→Go 迁移 Phase 5 执行方案（第二轮评审优化版）

**日期**: 2026-07-14  
**状态**: Wave 0-1 完成，Wave 2 启动，Wave 3-7 待实现  
**当前分支**: fix/p0-route-auth-and-error-envelope  
**实际代码检查**: 2026-07-14 基于 `internal/` 目录实际扫描

---

## 1. 实际进度（基于代码检查）

### 1.1 已完成模块（按 Wave 分组）

| Wave | 模块 | 路由数 | 状态 |
|------|------|--------|------|
| **Wave 0** | idempotency, sse, cron, dag, middleware 共享包 | — | ✅ 完成 |
| **Wave 1** | user, role, session, api-key, ci-type, api-market, eventbus, event-trigger, hook-chain | 88 | ✅ 完成 |
| **Wave 3** | notification, notification-policy, notification-template, scheduled-notification, webhook | 42 | ✅ 完成 |
| **Wave 4** | workflow, workflow-trigger, workflow-task, workflow-dependency, lowcode, workflow-webhook | 45 | ✅ 完成 |

**小计**: 20 个模块，完整三层+注册

### 1.2 待实现模块

| Wave | 模块 | 路由数 | 优先级 |
|------|------|--------|--------|
| **Wave 2** | auth-enhanced, auth-mfa, sso-unified, sso-providers, abac-policy, permission-audit | 39 | P0 |
| **Wave 3** | do-not-disturb, channel | 12 | P1 |
| **Wave 5** | pipeline-batch, pipeline-sse, pipeline-execution-control, pipeline-audit-log, pipeline-graph, pipeline-template, pipeline-version, pipeline-run-history, pipeline-batch-operations, pipeline-trend, change-intelligence | 56 | P1 |
| **Wave 6** | tracing, slo, performance, health-check | 40 | P2 |
| **Wave 7** | (71 个 P2 模块) | — | P2 |

### 1.3 总体完成度

| 指标 | 数值 |
|------|------|
| 总 Wave 数 | 8 (Wave 0-7) |
| 已完成 Wave | 4 (0, 1, 4 + 部分 3) |
| 总模块数 | ~114 |
| 已完成模块 | 20 |
| 完成率 | 17.5% |
| go build | ✅ |

### 1.4 P0 阻塞问题状态

| P0 | 问题 | 状态 |
|----|------|------|
| P0-1 | 影子模式只读化 | ✅ 已解决 |
| P0-2 | 双写冲突防范 | ✅ 已解决 |
| P0-3 | Go migration Down() | ✅ 已实现 |
| P0-4 | Gateway 灰度 | ❌ 待实现 |
| P0-5 | CI/CD 集成 | ✅ 已完成 |
| P0-6 | Helm 健康检查 | ✅ 已完成 |
| P0-7 | 单体治理策略 | ⚠️ 已规划 |
| P0-8 | AI 统一 Python | ⚠️ 已决策 |
| P0-9 | AI 能力路线图 | ⚠️ 已规划 |

---

## 2. 当前工作：Wave 2 认证+权限（启动中）

### 2.1 模块清单

| 模块 | 路由数 | 说明 | 技术依赖 |
|------|--------|------|----------|
| auth-enhanced | 9 | JWT 密钥轮换 + Token 黑名单 | go-common/pkg/auth/ 已存在 |
| auth-mfa | 10 | TOTP 设置/验证/备份码 | `github.com/pquerna/otp` |
| sso-unified | 4 | OIDC/LDAP/企微 SSO | `github.com/coreos/go-oidc/v3`, `github.com/go-ldap/ldap/v3` |
| sso-providers | 6 | 提供商 CRUD + 连接测试 | 同上 |
| abac-policy | 5 | 权限策略 | go-common/pkg/auth/abac.go 已存在 |
| permission-audit | 5 | 权限审计 | go-common/pkg/auth/permission.go 已存在 |

### 2.2 现有基础设施

- **go-common/pkg/auth/**: JWT 中间件、RBAC、ABAC、Permission Cache
- **internal/user/**: 用户模块已有完整三层
- **go-common/pkg/auth/authorization_engine.go**: 授权引擎已实现

### 2.3 实现顺序

1. auth-enhanced (JWT 密钥轮换) — 依赖 go-common/pkg/auth/
2. auth-mfa (TOTP) — 需新增 `go-common/pkg/mfa/`
3. sso-providers (提供商 CRUD) — 基础模块
4. sso-unified (SSO 统一) — 依赖 sso-providers
5. abac-policy (权限策略) — 依赖 go-common/pkg/auth/abac.go
6. permission-audit (权限审计) — 依赖 abac-policy

---

## 3. 剩余 Wave 计划

### Wave 3 剩余（1 天）

| 模块 | 路由数 | 说明 |
|------|--------|------|
| do-not-disturb | 5 | 免打扰设置 |
| channel | 7 | **TS 503 占位，Go 必须完整实现** |

### Wave 5（8 天）

| 模块 | 路由数 | 说明 |
|------|--------|------|
| pipeline-batch | 13 | 阶段组 CRUD + 批次执行 |
| pipeline-sse | 5 | SSE 实时日志 |
| pipeline-execution-control | 7 | 内联 PG → Repository |
| pipeline-audit-log | 5 | 审计日志 |
| pipeline-graph | 4 | YAML/JSON DAG |
| pipeline-template | 6 | CRUD + instantiate |
| pipeline-version | 6 | 版本管理 |
| pipeline-run-history | 1 | 聚合查询 |
| pipeline-batch-operations | 3 | 批量操作 |
| pipeline-trend | 2 | 趋势数据 |
| change-intelligence | 4 | AI 变更影响分析 |

### Wave 6（6 天）

| 模块 | 路由数 | 说明 |
|------|--------|------|
| tracing | 11 | 分布式追踪 |
| slo | 11 | SLO 定义 + 错误预算 |
| performance | 11 | 性能基线 |
| health-check | 7 | 健康检查 CRUD |

### Wave 7（16 天，10 子批次）

按限界上下文分批，每批 5-15 模块，独立 L1 回滚。

---

## 4. 时间线（更新版）

| 周次 | 日期 | 工作内容 |
|------|------|----------|
| Week 1 | 2026-07-14 | Wave 2 认证+权限 (5 天) |
| Week 2 | 2026-07-21 | Wave 3 剩余 (1 天) + Wave 5 Pipeline (7 天) |
| Week 3 | 2026-07-28 | Wave 5 Pipeline 继续 + Gateway 灰度 (3 天) |
| Week 4 | 2026-08-04 | Wave 6 可观测性 (6 天) |
| Week 5-8 | 2026-08-05~18 | Wave 7 P2 批量 (16 天) |

**总计**: ~8 周

---

## 5. 验证门控（每个 Wave 完成后）

```bash
# 构建 + 测试
go build ./cmd/server/
go test -race ./...
go vet ./...

# 路由注册完整性
grep -c "RegisterRoutes" cmd/server/main.go

# 端点覆盖率对比
scripts/check-endpoint-coverage.sh
```
