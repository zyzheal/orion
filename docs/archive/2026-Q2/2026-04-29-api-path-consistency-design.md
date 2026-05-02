# API 路径一致性设计文档

> 日期: 2026-04-29
> 状态: 设计阶段
> 优先级: P0
> 关联决策: ADR-012 (API 版本管理设计)

## 1. 问题陈述

### 1.1 现状

前端 API 客户端使用 `/v1/` 版本前缀（如 `/api/v1/alert/list`），但后端路由无版本前缀（如 `/api/alert/ingest`）。这导致运行时 404 错误。

### 1.2 影响范围

- 前端 API 客户端: ~47 个文件
- 后端路由注册: `routes.ts` 中 50+ 路由前缀
- 不一致路径: ~30 处

### 1.3 根因

开发过程中缺乏统一的 API 路径规范，前后端独立演进导致路径分化。

## 2. 架构决策

### 2.1 决策

**采用 `/api/v1/{domain}/{resource}` 格式作为统一 API 路径规范**

### 2.2 理由

1. 符合 RESTful API 版本化最佳实践
2. 为未来 v2/v3 多版本共存预留空间
3. 前端路径设计已符合该规范
4. 符合 ADR-012 API 版本管理设计
5. 后端改动集中（仅修改 `routes.ts` 中的 prefix）

### 2.3 替代方案排除

- **方案 A（改前端）**: 短期可行，但不符合 API 版本化长期需求
- **方案 C（双路径支持）**: 维护成本高，易混淆

## 3. 设计规范

### 3.1 路径格式

```
/api/v1/{domain}/{resource}/{action?}
```

**示例**:
- `/api/v1/alert/ingest` - 告警接收
- `/api/v1/pipelines` - Pipeline CRUD
- `/api/v1/deploy/runs` - 部署执行
- `/api/v1/pipelines/:id/runs` - 子资源

### 3.2 路由注册规范

所有后端路由注册必须包含 `/v1` 前缀：

```typescript
// 修改前
await app.register(alertRoutes, { prefix: '/alert' });

// 修改后
await app.register(alertRoutes, { prefix: '/v1/alert' });
```

### 3.3 前端 API 客户端规范

前端 API 调用已符合规范，无需修改：

```typescript
// 当前实现（正确）
return api.get('/v1/alert/list', { params });
```

## 4. 实施范围

### 4.1 后端路由前缀修改清单

| 当前前缀 | 修改后前缀 | 路由文件 |
|---------|-----------|---------|
| `/alert` | `/v1/alert` | alert-routes.ts |
| `/pipelines` | `/v1/pipelines` | routes.ts (inline) |
| `/pipeline-runs` | `/v1/pipeline-runs` | routes.ts (inline) |
| `/stages` | `/v1/stages` | routes.ts (inline) |
| `/tasks` | `/v1/tasks` | routes.ts (inline) |
| `/cmdb` | `/v1/cmdb` | routes-cmdb.ts |
| `/build` | `/v1/build` | build-routes.ts |
| `/code-repo` | `/v1/code-repo` | code-repo-routes.ts |
| `/config` | `/v1/config` | config-routes.ts |
| `/cost` | `/v1/cost` | cost-routes.ts |
| `/risk` | `/v1/risk` | risk-routes.ts |
| `/finops` | `/v1/finops` | finops-v2-routes.ts |
| `/ai-review` | `/v1/ai-review` | ai-review-routes.ts |
| `/diagnostic` | `/v1/diagnostic` | diagnostic-routes.ts |
| `/test-selector` | `/v1/test-selector` | test-selector-routes.ts |
| `/deploy` | `/v1/deploy` | deploy-routes.ts |
| `/monitoring` | `/v1/monitoring` | monitoring-routes.ts |
| `/tickets` | `/v1/tickets` | ticketing-routes.ts |
| `/self-healing` | `/v1/self-healing` | self-healing-routes.ts |
| `/backup` | `/v1/backup` | backup-routes.ts |
| `/plugins-spi` | `/v1/plugins-spi` | plugin-spi-routes.ts |
| `/plugins` | `/v1/plugins` | routes-plugin.ts |
| `/ai-security` | `/v1/ai-security` | ai-security-routes.ts |
| `/ai-gateway` | `/v1/ai-gateway` | ai-gateway-routes.ts |
| `/audit` | `/v1/audit` | audit-routes.ts |
| `/tenant` | `/v1/tenant` | tenant-routes.ts |
| `/efficiency` | `/v1/efficiency` | efficiency-routes.ts |
| `/sbom` | `/v1/sbom` | sbom-routes.ts |
| `/policies` | `/v1/policies` | policy-routes.ts |
| `/change-intelligence` | `/v1/change-intelligence` | change-intelligence-routes.ts |
| `/canary-analysis` | `/v1/canary-analysis` | canary-analysis-routes.ts |
| `/skills` | `/v1/skills` | skill-routes.ts |
| `/ai-cost` | `/v1/ai-cost` | ai-cost-routes.ts |
| `/iac` | `/v1/iac` | iac-routes.ts |
| `/chatops` | `/v1/chatops` | chatops-routes.ts |
| `/confirmations` | `/v1/confirmations` | confirmation-routes.ts |
| `/artifacts` | `/v1/artifacts` | artifact-routes.ts |
| `/vector-store` | `/v1/vector-store` | vector-store-routes.ts |
| `/oncall` | `/v1/oncall` | oncall-routes.ts |
| `/approvals` | `/v1/approvals` | approval-routes.ts |
| `/cron` | `/v1/cron` | cron-routes.ts |
| `/eventbus` | `/v1/eventbus` | eventbus-routes.ts |
| `/product-lines` | `/v1/product-lines` | product-line-routes.ts |
| `/internal-libraries` | `/v1/internal-libraries` | internal-library-routes.ts |
| `/notifications` | `/v1/notifications` | notification-routes.ts |
| `/roles` | `/v1/roles` | role-routes.ts |
| `/sessions` | `/v1/sessions` | session-routes.ts |
| `/webhooks` | `/v1/webhooks` | webhook-routes.ts |
| `/projects` | `/v1/projects` | project-routes.ts |
| `/environments` | `/v1/environments` | environment-routes.ts |
| `/queue` | `/v1/queue` | queue-routes.ts |
| `/knowledge` | `/v1/knowledge` | knowledge-routes.ts |
| `/metrics` | `/v1/metrics` | metrics-routes.ts |
| `/users` | `/v1/users` | user-routes.ts |
| `/` (agent) | `/v1/` | routes-agent.ts |

### 4.2 不需要修改的部分

- 前端 API 客户端（已符合规范）
- 健康检查端点 (`/healthz`)
- 静态资源路由

## 5. 验证策略

### 5.1 自动化验证

1. 编写脚本对比前端 API 路径和后端路由前缀
2. 运行后端测试套件确保路由注册正确
3. 运行前端测试套件确保 API 调用正确

### 5.2 手动验证

1. 启动后端服务，访问关键端点验证 200 响应
2. 启动前端开发服务器，验证 API 调用无 404

## 6. 回滚计划

如果修改后出现大面积 404：

1. 使用 git revert 回滚路由前缀修改
2. 临时修改 API Gateway 添加路径重写规则
3. 重新评估方案可行性

## 7. 时间线

| 阶段 | 内容 | 预计时间 |
|-----|------|---------|
| 1. 后端路由前缀修改 | routes.ts 及子路由文件 | 1 小时 |
| 2. 前端路径验证 | 对比检查 ~47 个 API 文件 | 30 分钟 |
| 3. 测试验证 | 运行后端 + 前端测试 | 30 分钟 |
| 4. 文档更新 | API 文档同步 | 30 分钟 |

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 遗漏路由前缀 | 部分 API 404 | 自动化脚本验证 |
| 前端路径不一致 | 部分 API 仍 404 | 逐项对比验证 |
| 第三方集成依赖旧路径 | 集成失败 | 通知相关方，更新文档 |

## 9. 成功标准

- [ ] 所有后端路由以 `/v1/` 开头
- [ ] 前端 API 调用路径与后端路由匹配
- [ ] 运行时无 404 错误（健康检查除外）
- [ ] 测试套件通过率 100%
