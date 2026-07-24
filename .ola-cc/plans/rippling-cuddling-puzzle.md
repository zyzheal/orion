# TS→Go 迁移 Phase 5 执行计划

## 背景

当前分支 `fix/p0-route-auth-and-error-envelope` 已完成 7 个新 Go 模块（api-governance、change-request、report-designer、oncall、diagnostic、backup、finops、deploy-enhanced）的 DI 注入和 1 个 middleware 错误信封修复。

Mark 任务：标记 TS 迁移状态，归档已迁移模块，更新 `routes.ts` 等

Z 深度分析第一阶段：分析 144 个未迁移 TS 模块，按 Wave 分批规划后续迁移

## 当前迁移全景

| 指标 | 数值 |
|------|------|
| Go platform 模块数 | 61（含本次新增） |
| 已归档 TS 模块 (routes.ts [ARCHIVED]) | 49 |
| 已归档 TS 文件头 ([ARCHIVED]) | 54 |
| 未迁移 TS 模块 | 144 |
| Go 构建状态 | `go build ./...` ✅ |
| Go 测试状态 | `go test ./...` ✅ |

## 未迁移模块深度分析

144 个未迁移 TS 模块，按优先级分为 3 层：

### T0 - 已有 Go 代码（2 模块，0.5d）
| 模块 | TS 路由 | Go 状态 |
|------|---------|---------|
| api-market | 14 | handler/service/repository 完整，仅需在 main.go 注册 |
| ci-type | 11 | handler/service/repository 完整，仅需在 main.go 注册 |

### T1 - 高优先级（36 模块，~247 路由）
| 体系 | 模块数 | 路由 | 复杂度 | 预估 |
|------|--------|------|--------|------|
| 通知体系 | 5 | ~43 | 中 | 5d |
| 工作流体系 | 5 | ~36 | 高 (含低代码) | 7d |
| 认证体系 | 8 | ~44 | 高 (SSO/MFA/JWT) | 10d |
| AI 平台 | 4 | ~22 | 中 (含 MCP JSON-RPC) | 5d |
| 可观测性 | 4 | ~40 | 中 | 6d |
| Pipeline 辅助 | 10 | ~53 | 中 | 8d |
| **小计** | **36** | **~247** | | **41d** |

### T2 - 小模块批量（~70 模块，平均 <8 路由）
| 类型 | 模块数 | 预估 |
|------|--------|------|
| 简单 CRUD / 功能单一 | ~70 | 15d (并行 Agent) |

## Wave 执行计划

### Wave 4.0 - 收尾当前分支（0.5d）
- [ ] 注册 `api-market` 和 `ci-type` 到 main.go
- [ ] 补齐 `user` Go 模块（仅有空目录）
- [ ] 补齐 `problem` Go 模块（仅有 repository + models）
- [ ] 归档确认：`backup-routes.ts`、`oncall-routes.ts`、`diagnostic-routes.ts` 等文件头标记
- [ ] `go build ./... && go test ./...` 验证

### Wave 4.1 - 通知体系（5d）
- notification + notification-template + notification-policy + webhook + channel

### Wave 4.2 - 工作流体系（7d）
- workflow + workflow-trigger + workflow-task + workflow-dependency + lowcode

### Wave 4.3 - 认证体系（10d）
- auth-enhanced + auth-mfa + sso-unified + sso-providers + role + session + api-key + user

### Wave 4.4 - AI 平台（5d）
- ai-agent + ai-decision + llm-trace + mcp

### Wave 4.5 - 可观测性（6d）
- tracing + slo + performance + health-check

### Wave 4.6 - Pipeline 辅助（8d）
- pipeline-batch + pipeline-sse + pipeline-execution-control + pipeline-audit-log
- pipeline-graph + pipeline-template + pipeline-version + pipeline-run-history
- pipeline-batch-operations + pipeline-trend

### Wave 5 - P2 小模块批量（15d）
- 并行 Agent 方式批量迁移 ~70 个简单 CRUD 模块

## 关键依赖（Go 生态）
- SSE: goroutine + channel（Go 原生支持）
- YAML: `gopkg.in/yaml.v3`
- TOTP/MFA: `github.com/pquerna/otp`
- JWT: `github.com/golang-jwt/jwt/v5`（已有）
- OIDC: `github.com/coreos/go-oidc/v3`
- LDAP: `github.com/go-ldap/ldap/v3`
- Cron: `github.com/robfig/cron/v3`
- JSON-RPC: Go 标准库 `net/rpc` 或第三方库