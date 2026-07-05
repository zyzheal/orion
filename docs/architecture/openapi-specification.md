# OpenAPI 规范管理架构

**生成日期**: 2026-07-02
**数据来源**: `orion-platform-service/src/api/docs/openapi.ts` + 实际路由分析
**权威规范文件**: `orion-platform-service/src/api/docs/openapi.ts`

---

## 一、现状

### 1.1 现有 OpenAPI 规范

平台服务已实现 Swagger 集成（`@fastify/swagger` + `@fastify/swagger-ui`），规范定义在：

```
orion-platform-service/src/api/docs/openapi.ts
```

**当前覆盖情况**：

| 维度 | 值 | 说明 |
|------|-----|------|
| 规范格式 | OpenAPI 3.0.3 | 标准格式 |
| 端点数量 | ~50 个 | 覆盖 8 个 tag |
| 实际路由数 | 175 个 | `src/api/*-routes.ts` |
| Schema 数量 | 12 个 | Config/Pipeline/Deploy/Alert/Ticket/User/Metric 等 |
| 覆盖缺口 | ~125 个端点 | 未在 OpenAPI 规范中定义 |
| Swagger UI | ✅ 已注册 | 可通过 `/documentation` 访问 |

### 1.2 Swagger UI 配置

```typescript
// orion-platform-service/src/app.ts
fastifySwagger({
  openapi: openapiSpec,  // 从 src/api/docs/openapi.ts 导入
  routePrefix: '/documentation',
})
fastifySwaggerUi({
  routePrefix: '/documentation',
  uiConfig: { docExpansion: 'list', filter: true },
})
```

**访问地址**：
- 开发环境: `http://localhost:3001/documentation`
- 生产环境: `https://orion.company.com/documentation`

---

## 二、端点覆盖差距分析

### 2.1 已覆盖的端点（8 Tag, ~50 个）

| Tag | 已覆盖端点 | 典型端点 |
|------|-----------|---------|
| Config | 3 | `GET /config/domains`, `GET /config/{domain}`, `GET /config/search` |
| Pipeline | 2 | `GET /pipelines`, `POST /pipelines`, `POST /pipelines/{id}/run` |
| Deploy | 2 | `GET /deployments`, `POST /deployments/{id}/rollback` |
| Alert | 2 | `GET /alerts`, `POST /alerts/{id}/resolve` |
| Ticketing | 2 | `GET /tickets`, `POST /tickets` |
| User | 2 | `GET /users`, `GET /users/{id}` |
| Auth | 2 | `POST /auth/login`, `POST /auth/refresh` |
| Monitoring | 2 | `GET /metrics`, `GET /health` |

### 2.2 未覆盖的端点（~125 个）

| 服务域 | 端点数量 | 说明 |
|--------|---------|------|
| Approval | ~15 | 审批 CRUD + 流程定义 + 委托 |
| Notification | ~10 | 通知模板/渠道/设置 |
| Config-Mgmt | ~12 | 配置版本/快照/发布 |
| Code-Repo | ~10 | PR/Webhook/代码ownership |
| Artifact | ~10 | 制品版本/溯源/对比 |
| Self-Healing | ~8 | 自愈规则/执行/历史 |
| Security | ~15 | 漏洞/SBOM/合规/扫描 |
| ChatOps | ~8 | 命令/会话/集成 |
| Pipeline 扩展 | ~12 | 运行详情/日志/重试/模板 |
| Monitor | ~10 | 告警规则/抑制/渠道 |
| RBAC/Team/Capability | ~15 | 角色/团队/能力管理 |
| 其他 | ~10 | Health/Stats/FeatureFlag 等 |

---

## 三、API 一致性现状

### 3.1 路径前缀一致性

**规范**：所有 API 应使用 `/api/v1/<domain>/` 前缀（如 `/api/v1/pipelines`）

**当前状态**：

| 路径格式 | 端点数 | 示例 |
|---------|--------|------|
| `/api/v1/<domain>/` | ~60 | `/api/v1/pipelines`, `/api/v1/deployments` |
| `/api/v1/<domain>` (无尾斜杠) | ~20 | `/api/v1/config/domains` |
| `/api/v1/` (裸路径) | ~30 | `/api/v1/auth/login`, `/api/v1/health` |
| `/api/` (无 v1) | ~5 | `/api/health` |
| 不一致 | ~60 | 同上混合使用 |

### 3.2 前端-后端路径匹配度

| 指标 | 值 | 说明 |
|------|-----|------|
| 前端 API 客户端文件数 | 239 | `orion-frontend/src/api/` |
| 后端路由文件数 | 175 | `src/api/*-routes.ts` |
| 精确匹配 | ~35 (20%) | 路径/方法/参数完全一致 |
| 命名差异 | ~50 | 如 `pipelines` vs `pipeline-list` |
| 缺失后端 | ~30 | 前端有 API 客户端但后端无路由 |
| 缺失前端 | ~60 | 后端有路由但前端无 API 客户端 |

---

## 四、Schema 覆盖差距

### 4.1 已定义 Schema

| Schema | 来源 Tag | 字段数 |
|--------|---------|--------|
| ConfigDomain | Config | 4 |
| Config | Config | 2 |
| ConfigItem | Config | 5 |
| Pipeline | Pipeline | 5 |
| PipelineCreateInput | Pipeline | 3 |
| Deployment | Deploy | 7 |
| Alert | Alert | 6 |
| Ticket | Ticketing | 8 |
| TicketCreateInput | Ticketing | 4 |
| User | User | 7 |
| MetricData | Monitoring | 3 |

### 4.2 缺失的关键 Schema

| 缺失 Schema | 对应服务 | 影响 |
|------------|---------|------|
| Approval / ApprovalCreateInput | Approval | 审批流程无法自动生成客户端 |
| Notification / NotificationTemplate | Notification | 通知管理缺失 |
| CodeRepo / PullRequest / Webhook | Code | 代码集成缺失 |
| Artifact / ArtifactVersion | Artifact | 制品溯源缺失 |
| PipelineRun / Stage / Task | Pipeline | 运行详情缺失 |
| RBAC / Role / Permission | AuthZ | 权限管理缺失 |
| Vulnerability / SBOM | Security | 安全扫描缺失 |
| Monitoring/AlertRule / AlertChannel | Monitor | 告警配置缺失 |

---

## 五、OpenAPI 规范管理策略

### 5.1 维护方式

```
规范来源（唯一权威）: orion-platform-service/src/api/docs/openapi.ts
    │
    ├── Swagger UI: /documentation (Fastify 自动渲染)
    ├── JSON 导出: GET /documentation/json (Fastify 自动生成)
    └── CI 验证: 每次提交自动对比规范与实际路由
```

**维护原则**：
1. **规范即代码**：`openapi.ts` 是与 `*-routes.ts` 同级的代码文件，必须随路由变更同步更新
2. **单一来源**：所有 OpenAPI 内容只存在于 `openapi.ts`，不得在其他文件复制
3. **CI 门控**：新增路由必须同步更新规范，否则 CI 失败

### 5.2 扩展计划

**Phase 1（当前）**：基础规范覆盖核心 8 个 Tag（50 个端点）

**Phase 2**：补充 Approval/Notification/Config-Mgmt/Code/Artifact 端点（+60 个）

**Phase 3**：补充 Security/ChatOps/SelfHealing/Monitor 扩展端点（+50 个）

**Phase 4**：补充 RBAC/Team/Capability/FeatureFlag 等管理端点（+15 个）

**目标**：覆盖 175 个路由中的 100% 端点

### 5.3 前端 SDK 生成

当前 OpenAPI 规范可用于自动生成前端 API 客户端：

```bash
# 使用 openapi-typescript-codegen 生成
npx openapi-typescript-codegen --input http://localhost:3001/documentation/json \
  --output orion-frontend/src/api/generated \
  --client fetch
```

**当前状态**：前端 API 客户端（239 个文件）为手动编写，未使用自动生成。
**建议**：在 Phase 3 完成后，评估是否切换为自动生成的客户端。

---

## 六、CI/CD 集成

### 6.1 当前 CI 中的 AST 检查

`.github/workflows/ci.yml` 已有 `design-constraint` job：

```yaml
design-constraint:
  name: Design Constraint Check
  runs-on: ubuntu-latest
  steps:
    - name: Run Design Constraint AST Scan
      run: |
        npx tsx docs/design-constraints/framework/core/cli-check.ts \
          --scan orion-frontend/src/pages/ \
          --max-files 100 \
          --format json > design-constraint-results.json || true
```

**覆盖范围**：仅扫描 `orion-frontend/src/pages/`（前端页面交互）

### 6.2 建议的扩展

| 检查项 | 当前 | 建议 | 说明 |
|--------|------|------|------|
| 前端交互链 | ✅ 已覆盖 | 保持不变 | `cli-check.ts --verify` |
| 后端路由规范 | ❌ 未覆盖 | 新增 | 检查路由是否匹配 OpenAPI 规范 |
| API 路径一致性 | ❌ 未覆盖 | 新增 | 前端 `api/` vs 后端 `*-routes.ts` |
| OpenAPI 规范完整性 | ❌ 未覆盖 | 新增 | 新增路由必须有对应规范条目 |
| 事件命名一致性 | ❌ 未覆盖 | 新增 | 事件发布/订阅命名检查 |
| Go 服务编译 | ✅ 已覆盖 | 保持不变 | `go vet ./...` + `go build` |

### 6.3 后端 AST 扫描扩展方案

在 CI 中新增 `backend-design-check` job：

```yaml
backend-design-check:
  name: Backend Design Check
  runs-on: ubuntu-latest
  needs: type-check
  steps:
    - name: Check API route consistency
      run: |
        # 检查所有路由是否在 OpenAPI 规范中有定义
        # 检查前端 api/ 客户端是否有对应后端路由
    - name: Check event naming consistency
      run: |
        # 检查 EventPublisher.publish() 和 EventSubscriber.subscribe() 的主题是否一致
    - name: Check new routes have OpenAPI spec
      run: |
        # 新增路由必须同步更新 openapi.ts
```

---

## 七、行动计划

### P1（当前 Sprint）

| 任务 | 负责 | 产出 | 预计工时 |
|------|------|------|---------|
| 补充 Approval/Notification/Config-Mgmt 端点到 OpenAPI 规范 | 后端 | `openapi.ts` +60 端点 | 3 天 |
| 补充 Code/Artifact/Pipeline 扩展端点 | 后端 | `openapi.ts` +40 端点 | 3 天 |
| CI 新增 API 一致性检查 | DevOps | `ci.yml` 新增 job | 1 天 |
| 补充 Schema 定义（ Approval/Ticket/Alert 等） | 后端 | `openapi.ts` +10 Schema | 1 天 |

### P2（下 Sprint）

| 任务 | 负责 | 产出 | 预计工时 |
|------|------|------|---------|
| 补充 Security/ChatOps/SelfHealing 端点 | 后端 | `openapi.ts` +50 端点 | 3 天 |
| 100% 端点覆盖验证脚本 | DevOps | `scripts/verify-openapi.ts` | 2 天 |
| 前端 API 客户端自动生成评估 | 前端 | 评估报告 | 1 天 |
