# Phase 5 F2: Node.js 服务下线计划

> **创建日期**: 2026-05-29
> **前提**: Phase 5 F1 完成，43 个 Go 服务骨架就绪

## 迁移映射

### 已完成迁移（可直接下线）

| Node.js 服务 | Go 替代服务 | 状态 |
|-------------|------------|------|
| services/auth | orion-auth-svc | ✅ 骨架就绪 |
| services/tenant | orion-tenant-svc | ✅ 骨架就绪 |
| services/user | orion-user-svc | ✅ 骨架就绪 |
| services/pipeline | orion-pipeline-svc-go | ✅ 骨架就绪 |
| services/build | orion-build-svc-go | ✅ 骨架就绪 |
| services/deploy | orion-deploy-svc-go | ✅ 骨架就绪 |
| services/approval | orion-approval-svc-go | ✅ 骨架就绪 |
| services/canary | orion-canary-svc-go | ✅ 骨架就绪 |
| services/scheduler | orion-scheduler-svc-go | ✅ 骨架就绪 |
| services/monitoring | orion-monitor-svc-go | ✅ 骨架就绪 |
| services/finops | orion-finops-svc-go | ✅ 骨架就绪 |
| services/ticketing | orion-ticket-svc-go | ✅ 骨架就绪 |
| services/cmdb | orion-cmdb-svc-go | ✅ 骨架就绪 |
| services/notification | orion-notification-svc-go | ✅ 骨架就绪 |
| services/feature-flag | orion-feature-flag-svc-go | ✅ 骨架就绪 |
| services/secret | orion-secret-svc-go | ✅ 骨架就绪 |
| services/workflow | orion-workflow-svc-go | ✅ 骨架就绪 |
| services/audit | orion-audit-svc-go | ✅ 骨架就绪 |
| services/config-mgmt | orion-config-mgmt-svc-go | ✅ 骨架就绪 |
| services/artifact | orion-artifact-svc-go | ✅ 骨架就绪 |
| services/code | orion-code-svc-go | ✅ 骨架就绪 |
| services/runner | orion-runner-svc-go | ✅ 骨架就绪 |
| services/plugin | orion-plugin-svc-go | ✅ 骨架就绪 |
| services/pipeline-template | orion-pipeline-template-svc-go | ✅ 骨架就绪 |
| services/event-bus | orion-event-bus-svc-go | ✅ 骨架就绪 |
| services/governance | orion-governance-svc-go | ✅ 骨架就绪 |
| services/risk | orion-risk-svc-go | ✅ 骨架就绪 |
| services/security | orion-security-svc-go + orion-security-svc-rust | ✅ 骨架就绪 |
| services/self-healing | orion-selfhealing-svc-go | ✅ 骨架就绪 |
| services/efficiency | orion-efficiency-svc-go | ✅ 骨架就绪 |
| services/dr | orion-dr-svc-go | ✅ 骨架就绪 |
| services/llm | orion-llm-svc-go | ✅ 骨架就绪 |
| services/intelligence | orion-intelligence-svc-go | ✅ 骨架就绪 |
| services/graph | orion-graph-svc-go | ✅ 骨架就绪 |
| services/inception | orion-inception-svc-go | ✅ 骨架就绪 |
| services/digital-twin | orion-digital-twin-svc-go | ✅ 骨架就绪 |
| services/lowcode | orion-lowcode-svc-go | ✅ 骨架就绪 |
| services/chatops | orion-chatops-svc-go | ✅ 骨架就绪 |
| services/community | orion-community-svc-go | ✅ 骨架就绪 |
| services/pandawiki | orion-pandawiki-svc-go | ✅ 骨架就绪 |
| services/federation | orion-federation-svc-go | ✅ 骨架就绪 |
| services/visor | orion-visor-svc-go | ✅ 骨架就绪 |
| services/skill | orion-skill-svc-go + orion-skill-config-svc-go | ✅ 骨架就绪 |
| services/notify | orion-notify-svc-go | ✅ 骨架就绪 |

### Python 服务（已有）

| Node.js 服务 | Python 替代服务 | 状态 |
|-------------|----------------|------|
| services/llm-trace | orion-llm-trace-svc-py | ✅ FastAPI |
| services/knowledge | orion-knowledge-svc-py | ✅ FastAPI |

### 共享库

| Node.js 模块 | Go 替代 | 状态 |
|-------------|---------|------|
| src/repositories/BaseRepository | orion-go-common/pkg/database/BaseRepository | ✅ |
| src/middleware/auth | orion-go-common/pkg/middleware | ✅ |
| src/errors/OrionError | orion-go-common/pkg/errors | ✅ |
| src/events/ | orion-event-bus-svc-go | ✅ 骨架就绪 |

## 下线步骤

### Phase 1: 双运行验证（1-2 周）
1. Go 服务部署到 staging 环境
2. API Gateway 路由切换到 Go 服务
3. 运行 E2E 测试验证功能一致性
4. 监控错误率和延迟

### Phase 2: 灰度切流（1 周）
1. 10% 流量切到 Go 服务
2. 监控 24 小时
3. 50% 流量切到 Go 服务
4. 监控 24 小时
5. 100% 流量切到 Go 服务

### Phase 3: Node.js 下线（1 周）
1. 确认 Go 服务稳定运行 7 天
2. 停止 Node.js 服务
3. 清理 Node.js 代码和配置
4. 更新文档

## 验收标准

- [ ] 零 Node.js 生产服务
- [ ] Go 服务 QPS >= Node.js 服务
- [ ] 全链路 E2E 测试通过
- [ ] 错误率 < 0.1%
- [ ] P99 延迟 < 200ms
