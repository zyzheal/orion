# Orion P0 问题修复计划

> **生成日期**: 2026-05-22
> **来源报告**:
> 1. `docs/superpowers/specs/2026-05-22-full-frontend-gap-scan.md` — 前端 6 维度扫描（综合合规率 32.6%）
> 2. `docs/superpowers/specs/2026-05-22-backend-route-gap-scan.md` — 后端路由断裂与 Mock（31 处断裂 + 15 处 Mock）
> 3. `docs/superpowers/specs/2026-05-22-database-schema-audit.md` — 数据库规范审查（综合合规率 45%）
>
> **修复原则**: 后端优先于前端、数据层优先于业务层、去重合并、按模块分组

---

## 一、P0 问题总览（去重后 43 项）

| 来源 | 原始 P0 项数 | 去重合并后 | 说明 |
|------|------------|-----------|------|
| 前端扫描 | 43 项（85 页面缺标题 + 422 硬编码颜色 + 28 只读无编辑 + 494 缺 try/catch） | 8 大模块标题修复 + 全局样式 + 全局异常处理 | 同类型问题按模块合并 |
| 后端路由 | 8 处 A 类断裂 + 3 处 E 类未注册 + 13 处前端 Mock | 6 处核心断裂 + 3 处未注册 + 15 处 Mock 清理 | A-1/A-8/C-2 合并为 Agent 模块统一修复 |
| 数据库审计 | 5 项（tenant_id 64 处 + SERIAL 17 表 + 32 重复表 + 15 组重复编号 + 2 缺失编号） | 5 项 | 直接对应 |

---

## 二、按模块分组的 P0 修复清单

### 执行顺序原则

```
Phase 1: 数据库层修复（迁移编号/重复表/tenant_id 类型）
  ↓ 依赖：无
Phase 2: 后端路由修复（注册断裂路由 + 修复路径不匹配）
  ↓ 依赖：Phase 1 完成后数据库结构稳定
Phase 3: 前端 API Client 修复（替换 Mock + 对齐路径）
  ↓ 依赖：Phase 2 完成后后端路由可用
Phase 4: 前端页面级修复（标题规范 + 硬编码颜色 + 异常处理 + 编辑入口）
  ↓ 依赖：Phase 3 完成后 API 可正常调用
```

---

### Phase 1: 数据库层修复（预估 4.5 天）

#### DB-P0-1: 迁移编号重复修复

| 项目 | 详情 |
|------|------|
| **问题描述** | 15 组迁移文件共享同一编号，178 号 FK 引用 180 号才创建的表（高风险） |
| **影响文件** | `orion-platform-service/src/db/migrations/` 下 010/011/046/049/050/051/052/053/060/061/077/135/138/176/178 共 36 文件 |
| **修复方案** | 对已有重复编号保持现状（IF NOT EXISTS 兜底），对 178 号高危组重新编号：178→183, 179→184, 180→185，后续递增+1 |
| **预估工时** | 4 小时 |
| **验收标准** | `schema_migrations` 表中无重复文件名；178 号 FK 引用的表在之前已创建 |

#### DB-P0-2: tenant_id 类型统一（64 处 ALTER）

| 项目 | 详情 |
|------|------|
| **问题描述** | 64 处 tenant_id 使用 VARCHAR(32/64/255)/INTEGER，无法与 tenants(id) UUID 建立外键 |
| **影响文件** | 19 个迁移文件：051/054/056/071/072/073/076/077/079/080/115/116/117/120/150/151/165 + 新增迁移文件 |
| **修复方案** | 新建迁移 `183_fix_tenant_id_types.sql`，对每张表执行 `ALTER COLUMN tenant_id TYPE UUID USING tenant_id::text::UUID`（INTEGER 列先转 text），追加 `SET NOT NULL` + `ADD CONSTRAINT fk_* FOREIGN KEY REFERENCES tenants(id)` |
| **预估工时** | 1 天 |
| **验收标准** | 全部 64 处 tenant_id 列类型为 UUID；全部有 FK 约束指向 tenants(id)；迁移执行无报错 |

#### DB-P0-3: SERIAL 主键迁移 UUID（17+ 张表）

| 项目 | 详情 |
|------|------|
| **问题描述** | 17 张表使用 SERIAL 自增整数主键，违反 UUID 主键规范 |
| **影响文件** | 11 个迁移文件：071/072/074/075/076/077/078/080/116/163 涉及的 jwt_key_rotation、token_blacklist、llm_traces 等 17 张表 |
| **修复方案** | 新建迁移 `184_migrate_serial_to_uuid.sql`，对每张表：`ADD COLUMN new_id UUID DEFAULT gen_random_uuid()` → `DROP CONSTRAINT *_pkey` → `DROP COLUMN id` → `RENAME new_id TO id` → `ADD PRIMARY KEY (id)` → 更新外键引用 |
| **预估工时** | 2 天 |
| **验收标准** | 17 张表主键类型均为 UUID；所有外键引用正常；迁移执行无报错 |

#### DB-P0-4: 32 张重复表结构合并

| 项目 | 详情 |
|------|------|
| **问题描述** | 32 张表在多个迁移文件中被 `CREATE TABLE IF NOT EXISTS` 重复定义，结构可能不一致 |
| **影响文件** | 32 张表涉及 15+ 个迁移文件：api_contracts(3 处)、artifact_operations(3 处)、ephemeral_environments(2 处) 等 |
| **修复方案** | 新建迁移 `185_consolidate_duplicate_tables.sql`：(1) 确认每个重复表首次创建的迁移，以其定义为基准；(2) 将后续迁移中的 `CREATE TABLE IF NOT EXISTS` 替换为 `ALTER TABLE ADD COLUMN IF NOT EXISTS` 补齐差异列；(3) 将后续 `CREATE INDEX` 替换为 `CREATE INDEX IF NOT EXISTS` |
| **预估工时** | 1 天 |
| **验收标准** | 每张重复表仅有一个有效结构定义；所有差异列已补齐；迁移幂等执行 |

#### DB-P0-5: 165 号迁移全面重写

| 项目 | 详情 |
|------|------|
| **问题描述** | cross_domain_workflows 等 4 张表同时违反：VARCHAR(255) 主键、VARCHAR(255) tenant_id、TIMESTAMP 无时区、无 RLS、无 CHECK |
| **影响文件** | `165_create_cross_domain_workflows.sql` |
| **修复方案** | 新建迁移 `186_fix_165_violations.sql`：主键转 UUID、tenant_id 转 UUID+FK、时间戳转 TIMESTAMPTZ、追加 RLS 策略、追加 CHECK 约束 |
| **预估工时** | 0.5 天 |
| **验收标准** | 4 张表符合全部 7 项规范（UUID 主键、UUID FK tenant_id、TIMESTAMPTZ、RLS、CHECK、审计字段、索引） |

---

### Phase 2: 后端路由修复（预估 1.5 天）

#### BE-P0-1: Agent Approvals + Agent Run 路由统一修复（合并 A-1 + A-8 + C-2）

| 项目 | 详情 |
|------|------|
| **问题描述** | 前端调用 `/v1/agent-approvals` 和 `/v1/agent-runs`，后端 `ai-agent-routes.ts` 注册于 `/ai-agents` 前缀，无 `/agent-approvals` 路由，前端 mock 返回空数组 |
| **影响文件** | `orion-platform-service/src/api/ai-agent-routes.ts`、`orion-frontend/src/api/agents.ts` |
| **修复方案** | (1) 后端在 `ai-agent-routes.ts` 中新增 `GET /agent-approvals`、`POST /agent-approvals/:id/respond`、`GET /agent-runs`、`POST /agent-runs`、`GET /agent-runs/:runId/decisions` 路由；(2) 前端 `agents.ts` 路径统一为 `/v1/ai-agents/agent-approvals` 等，移除 `Promise.resolve([])` mock |
| **预估工时** | 4 小时 |
| **验收标准** | 前端调用返回真实数据（非空数组）；approval 操作有数据库持久化；无 console.warn 提示 |

#### BE-P0-2: Alert CRUD 端点补全（A-2）

| 项目 | 详情 |
|------|------|
| **问题描述** | `alert-routes.ts` 缺少 `DELETE /:id`、`POST /:id/acknowledge`、`POST /:id/resolve`，前端 `deleteAlert` 返回 `Promise.resolve()` |
| **影响文件** | `orion-platform-service/src/api/alert-routes.ts`、`orion-frontend/src/api/alerts.ts` |
| **修复方案** | (1) 后端新增 3 个端点，调用 AlertService 对应方法；(2) 前端 `deleteAlert`/`acknowledgeAlert`/`resolveAlert` 改为调用 `api.delete/post(...)`，移除 mock；(3) 确认 `alert-routes.ts` 已在 `routes.ts` 中 import 并注册 |
| **预估工时** | 3 小时 |
| **验收标准** | 删除/确认/解决告警操作返回成功；数据库记录状态变更；前端有 success/error 提示 |

#### BE-P0-3: Ephemeral Envs 全链路对接（A-5）

| 项目 | 详情 |
|------|------|
| **问题描述** | 后端 `ephemeral-env-routes.ts` 已注册于 `/ephemeral-envs`，但前端 API 客户端 7 个函数全部返回 `Promise.resolve()` |
| **影响文件** | `orion-frontend/src/api/ephemeral-envs.ts` |
| **修复方案** | 重写 `ephemeral-envs.ts` 全部 7 个函数：`getEphemeralEnvs()` → `api.get('/v1/ephemeral-envs')`、`createEphemeralEnv()` → `api.post(...)` 等 |
| **预估工时** | 2 小时 |
| **验收标准** | 7 个函数均调用真实 API；临时环境列表显示真实数据；创建/唤醒/销毁操作生效 |

#### BE-P0-4: 3 处未注册路由注册（E-1 + E-2 + E-3）

| 项目 | 详情 |
|------|------|
| **问题描述** | `vectorStoreRoutes`、`vectorRoutes`、`degradationRoutes` 在 `routes.ts` 中 import 但从未 `app.register` |
| **影响文件** | `orion-platform-service/src/api/routes.ts`（L27/L47/L50 import，L563/L572 仅注释无代码） |
| **修复方案** | 在 `routes.ts` 中取消注释，追加注册调用：`await registerWithRoleGuard(app, vectorStoreRoutes, '/vector-store', { database: options.database })` 等 |
| **预估工时** | 1 小时 |
| **验收标准** | 3 个路由前缀 `/vector-store`、`/vector`、`/degradation` 返回 200（非 404） |

#### BE-P0-5: Performance mock DB 修复（B-1）

| 项目 | 详情 |
|------|------|
| **问题描述** | `performance-routes.ts` 在无 `options.database` 时使用 `mockDb` 返回空数据 |
| **影响文件** | `orion-platform-service/src/api/performance-routes.ts` |
| **修复方案** | 确保路由注册时传入 `database` 参数；若无 DB 连接返回 `503 { error: 'database not available' }` 而非空数据 |
| **预估工时** | 1 小时 |
| **验收标准** | 性能分析页面返回真实数据或明确的 503 错误；不再静默返回空数组 |

---

### Phase 3: 前端 API Client Mock 清理（预估 1 天）

#### FE-API-P0-1: Notifications mock fallback 清除（A-6）

| 项目 | 详情 |
|------|------|
| **问题描述** | `notifications.ts` 在 catch 块中 fallback 到 `mockNotifications` 假数据，用户看到虚假通知 |
| **影响文件** | `orion-frontend/src/api/notifications.ts`（L160-199/L209-213/L222-224/L243-245/L255-257/L289-301） |
| **修复方案** | (1) 移除 `import mockNotificationData`；(2) catch 块中返回 `[]` + `message.error('获取通知失败')`；(3) 空 try/catch 吞错误的 3 个函数改为 propagate error |
| **预估工时** | 2 小时 |
| **验收标准** | 后端不可用时显示空列表 + 错误提示；不再出现 mock 假数据 |

#### FE-API-P0-2: 剩余 Promise.resolve Mock 清理

| 项目 | 详情 |
|------|------|
| **问题描述** | `alerts.ts` 中 `deleteAlert` 返回 `Promise.resolve()`、`pipelines.ts` 中 `deleteCache/listCaches` 返回 `Promise.resolve()`、`workflow.ts` 中 `terminateWorkflow` 为空函数 |
| **影响文件** | `orion-frontend/src/api/alerts.ts`、`pipelines.ts`、`workflow.ts` |
| **修复方案** | (1) `deleteAlert` → `api.delete(\`/v1/alert/${id}\`)`（配合 BE-P0-2 后端端点）；(2) `deleteCache` → `api.delete(\`/v1/build-cache/entries/${id}\`)`；(3) `listCaches` → `api.get('/v1/build-cache/configs')`；(4) `terminateWorkflow` → `api.post(\`/v1/workflows/${id}/terminate\`)`（需后端先实现 A-4 terminate 端点） |
| **预估工时** | 2 小时 |
| **验收标准** | 4 个函数均调用真实 API；操作有 success/error 反馈 |

#### FE-API-P0-3: 路径对齐修复（A-7 + C-1）

| 项目 | 详情 |
|------|------|
| **问题描述** | 前端 `alerts.ts` 调用 `/v1/monitoring/rules` 但后端该路径属于 `monitoring-routes.ts`；`pipelines.ts` 调用 `/pipelines/versions/:name` 但后端注册 `/pipeline-versions` |
| **影响文件** | `orion-frontend/src/api/alerts.ts`、`pipelines.ts` |
| **修复方案** | (1) Alert Rules 路径确认为 monitoring 模块后保持 `/v1/monitoring/rules` 不变（Gateway 已代理）；(2) Pipeline Versions 前端改为 `/v1/pipeline-versions?pipeline_name=:name` |
| **预估工时** | 1 小时 |
| **验收标准** | 告警规则管理返回 200；Pipeline 版本列表返回真实数据 |

#### FE-API-P0-4: Workflow Terminate 端点后端实现 + 前端对接（A-4）

| 项目 | 详情 |
|------|------|
| **问题描述** | 后端 `workflow-routes.ts` 无 `POST /:id/terminate`，前端 `terminateWorkflow` 仅 `console.warn` |
| **影响文件** | `orion-platform-service/src/api/workflow-routes.ts`、`orion-frontend/src/api/workflow.ts` |
| **修复方案** | (1) 后端新增 `POST /workflows/:id/terminate`，调用 WorkflowService.terminate()；(2) 前端改为 `api.post(\`/v1/workflows/${id}/terminate\`)` |
| **预估工时** | 2 小时 |
| **验收标准** | 终止工作流操作返回成功；工作流状态变更为 terminated |

---

### Phase 4: 前端页面级修复（预估 5 天）

> 按 8 大菜单模块分组，每个模块包含：标题规范 + 硬编码颜色 + 异常处理 + 编辑入口

#### FE-P0-1: 全局 — 页面标题规范（85 主页面）

| 项目 | 详情 |
|------|------|
| **问题描述** | 98.1% 页面（~85 个主页面）缺少 `Title level={2}` + 图标规范 |
| **影响文件** | 8 大模块全部主页面，详见下方分模块清单 |
| **修复方案** | 每个页面添加 `<Title level={2}>` + 对应模块图标 + 可选副标题 `<Typography.Text>` |
| **预估工时** | 2 天（85 页面 × ~20 分钟/页面） |
| **验收标准** | 全部 85 主页面有 `Title level={2}`；标题左侧有模块图标；副标题使用 `colors.neutral[500]` |

#### FE-P0-2: 全局 — 硬编码颜色替换（422 文件）

| 项目 | 详情 |
|------|------|
| **问题描述** | 422/540 文件（78.1%）存在硬编码颜色值 `#xxxxxx` |
| **影响文件** | 高频违规 Top 10：PipelineEditor/StageModal、data-pipeline/DataPipelinePage、ArtifactBrowser、orchestration/OrchestrationPage、CMDB/CITablePage、visor/VisorPage、dba/DbaPage、cost/BudgetGuardPage 等 |
| **修复方案** | 逐文件替换：`#3370E6` → `colors.primary[500]`、`#52c41a` → `colors.success[500]`、`#faad14` → `colors.warning[500]`、`#f5222d` → `colors.error[500]`、`#d9d9d9` → `colors.neutral[300]`、`#fff` → `colors.light.bg.primary`、`#999` → `colors.neutral[500]` |
| **预估工时** | 1.5 天（422 文件 × ~12 分钟/文件） |
| **验收标准** | `grep -r '#[0-9a-fA-F]\{6\}' orion-frontend/src/pages/` 仅保留非样式色值（如图片 URL）；Design Token 覆盖率 100% |

#### FE-P0-3: 全局 — 异常处理补全（494 无 try/catch 文件）

| 项目 | 详情 |
|------|------|
| **问题描述** | 仅 8.5% 文件（46/540）有 try/catch，494 个文件缺乏结构化错误处理 |
| **影响文件** | 全部 540 .tsx 文件中无 try/catch 的 494 个 |
| **修复方案** | 对每个异步操作（API 调用）包裹 `try { ... } catch (error: unknown) { message.error(...) }`。注意：HTTP 错误已被拦截器处理，catch 块仅处理业务错误 |
| **预估工时** | 1.5 天（494 文件，按模块批量处理） |
| **验收标准** | 全部异步操作有 try/catch；无空 catch 块；catch 使用 `error: unknown` + `instanceof Error` |

#### FE-P0-4: 全局 — 只读 Descriptions 添加编辑入口（28 文件）

| 项目 | 详情 |
|------|------|
| **问题描述** | 28 个文件使用 Descriptions 展示详情，但无可编辑入口（无 Form.Item/Input/Select） |
| **影响文件** | AIReview/ReviewDetail、agent-svc/AgentDashboard/AgentDetailDrawer、federation-svc/ExecutorManagementPage、approval/ApprovalPage、RunnerManagement/index 等 28 文件 |
| **修复方案** | 添加编辑模式切换按钮；可编辑字段改用 `<Form.Item>` + `<Input>` / `<Select>`；底部固定保存按钮，调用对应 update API |
| **预估工时** | 1 天（28 文件 × ~25 分钟/文件） |
| **验收标准** | 28 个详情页均有编辑入口；编辑后保存按钮调用 update API；保存成功有 message.success，失败有 message.error |

#### FE-P0-5: 分模块 — 工作台（Workbench）页面修复

| 优先级 | 文件 | 修复项 | 工时 |
|--------|------|--------|------|
| P0 | `DashboardNew/index.tsx` | 添加 Title level={2} + DashboardOutlined + 副标题 | 20min |
| P0 | `Workbench/WorkbenchPage.tsx` | 添加 Title level={2} + DashboardOutlined | 20min |
| P0 | `TicketList/index.tsx` | 添加 Title level={2} + UnorderedListOutlined | 20min |
| P0 | `TicketDetail/index.tsx` | 补充 Title level={2} + 编辑入口 | 40min |
| P1 | `Projects/index.tsx` | 添加 Title level={2} | 20min |
| P1 | `ProductLine/index.tsx` | 添加 Title level={2} + 拆分 >1000 行文件 | 1h |
| P2 | `ExecutiveDashboard/index.tsx` | 添加副标题 | 15min |

#### FE-P0-6: 分模块 — 控制台（Console）页面修复

| 优先级 | 文件 | 修复项 | 工时 |
|--------|------|--------|------|
| P0 | `Console/index.tsx` | 统一 Title level={2} + SettingOutlined | 20min |
| P0 | `UserManagement/index.tsx` | 添加 Title level={2} + 拆分 >800 行文件 | 1h |
| P0 | `PluginManagement/index.tsx` | 添加 Title level={2} | 20min |
| P0 | `SubAppManagement/index.tsx` | 添加 Title level={2} | 20min |
| P0 | `FeatureFlagsPage/index.tsx` | 添加 Title level={2} | 20min |

#### FE-P0-7: 分模块 — 交付（Delivery）页面修复

| 优先级 | 文件 | 修复项 | 工时 |
|--------|------|--------|------|
| P0 | `PipelineList/index.tsx` | 添加 Title level={2} + CloudUploadOutlined | 20min |
| P0 | `PipelineEditor/index.tsx` | 添加 Title level={2} | 20min |
| P0 | `PipelineRunList/index.tsx` | 添加 Title level={2} | 20min |
| P0 | `PipelineRunLive/index.tsx` | 添加 Title level={2} | 20min |
| P0 | `DeploymentList/index.tsx` | 添加 Title level={2} | 20min |
| P0 | `PipelineDetail/index.tsx` | 添加 Title level={2} + 增加编辑入口 | 1h |

#### FE-P0-8: 分模块 — 可观测性（Observability）页面修复

| 优先级 | 文件 | 修复项 | 工时 |
|--------|------|--------|------|
| P0 | `monitor-svc/Monitoring/index.tsx` | 添加 Title level={2} + RadarChartOutlined | 20min |
| P0 | `AlertList/index.tsx` | 添加 Title level={2} | 20min |
| P0 | `security-svc/Diagnostic/Sessions.tsx` | 添加 Title level={2} | 20min |
| P0 | `security-svc/SelfHealing/IncidentList.tsx` | 添加 Title level={2} | 20min |
| P0 | `SbomDashboard/index.tsx` | 添加 Title level={2} | 20min |

#### FE-P0-9: 分模块 — AI 平台（AI Platform）页面修复

| 优先级 | 文件 | 修复项 | 工时 |
|--------|------|--------|------|
| P0 | `AIGateway/index.tsx` | 添加 Title level={2} + RobotOutlined | 20min |
| P0 | `AIAgents/index.tsx` | 添加 Title level={2} | 20min |
| P0 | `AISecurity/index.tsx` | 添加 Title level={2} | 20min |
| P0 | `AIReview/Dashboard.tsx` | 添加 Title level={2} | 20min |
| P0 | `ChatOps/index.tsx` | 添加 Title level={2} | 20min |
| P0 | `LLMTraceDashboard/TraceOverview.tsx` | 添加 Title level={2} | 20min |

#### FE-P0-10: 分模块 — 基础设施（Infrastructure）页面修复

| 优先级 | 文件 | 修复项 | 工时 |
|--------|------|--------|------|
| P0 | `Environments/index.tsx` | 添加 Title level={2} + ClusterOutlined | 20min |
| P0 | `BuildEnv/BuilderImageList.tsx` | 添加 Title level={2} | 20min |
| P0 | `BuildEnv/BuildCachePage.tsx` | 添加 Title level={2} | 20min |
| P0 | `CMDB/CITablePage.tsx` | 添加 Title level={2} | 20min |
| P0 | `CMDB/BatchExecPage.tsx` | 添加 Title level={2} + 拆分 >1000 行文件 | 1h |
| P0 | `VectorStore/index.tsx` | 添加 Title level={2} | 20min |
| P0 | `IacManagement/WorkspaceList.tsx` | 添加 Title level={2} | 20min |

#### FE-P0-11: 分模块 — 治理（Governance）页面修复

| 优先级 | 文件 | 修复项 | 工时 |
|--------|------|--------|------|
| P0 | `PolicyManagement/index.tsx` | 添加 SafetyCertificateOutlined 图标 | 20min |
| P0 | `AuditLog/index.tsx` | 添加 Title level={2} | 20min |
| P0 | `TenantList/index.tsx` | 添加 Title level={2} | 20min |
| P0 | `ConfigManagement/index.tsx` | 添加 Title level={2} + 8 处 Descriptions 添加编辑入口 | 1h |
| P0 | `FinOpsDashboard/index.tsx` | 添加 Title level={2} | 20min |

#### FE-P0-12: 分模块 — 生态（Ecosystem）页面修复

| 优先级 | 文件 | 修复项 | 工时 |
|--------|------|--------|------|
| P0 | `SkillManagement/Marketplace.tsx` | 添加 Title level={2} + AppstoreOutlined | 20min |
| P0 | `SkillManagement/MySkills.tsx` | 添加 Title level={2} | 20min |
| P0 | `PluginSPI/index.tsx` | 添加 Title level={2} | 20min |

---

## 三、修复执行路线图

### 时间线

| 阶段 | 内容 | 预估工时 | 日历天数 | 前置依赖 |
|------|------|---------|---------|---------|
| **Phase 1** | 数据库层修复（DB-P0-1~5） | 4.5 天 | 5 天 | 无 |
| **Phase 2** | 后端路由修复（BE-P0-1~5） | 1.5 天 | 2 天 | Phase 1 完成 |
| **Phase 3** | 前端 API Mock 清理（FE-API-P0-1~4） | 1 天 | 1 天 | Phase 2 完成 |
| **Phase 4** | 前端页面级修复（FE-P0-1~12） | 5 天 | 5 天 | Phase 3 完成 |
| **总计** | — | **12 天** | **~3 周** | — |

### 每日执行计划

| 天 | 执行内容 |
|----|---------|
| D1 | DB-P0-1 迁移编号修复 + DB-P0-2 tenant_id 类型统一（第一批 20 张表） |
| D2 | DB-P0-2 tenant_id 类型统一（剩余 44 张表）+ DB-P0-3 SERIAL 主键迁移（第一批 8 张表） |
| D3 | DB-P0-3 SERIAL 主键迁移（剩余 9 张表）+ DB-P0-4 重复表合并 |
| D4 | DB-P0-5 165 号迁移重写 + 数据库全量回归测试 |
| D5 | BE-P0-1 Agent 路由统一 + BE-P0-2 Alert CRUD 补全 |
| D6 | BE-P0-3 Ephemeral Envs 对接 + BE-P0-4 未注册路由注册 + BE-P0-5 Performance mock 修复 |
| D7 | FE-API-P0-1 Notifications Mock 清除 + FE-API-P0-2 剩余 Mock 清理 + FE-API-P0-3 路径对齐 |
| D8 | FE-API-P0-4 Workflow Terminate + FE-P0-1 全局标题规范（工作台/控制台/交付模块） |
| D9 | FE-P0-1 全局标题规范（可观测性/AI/基础设施模块）+ FE-P0-1 治理/生态模块 |
| D10 | FE-P0-2 硬编码颜色替换（高频 Top 10 文件） |
| D11 | FE-P0-2 硬编码颜色替换（剩余 412 文件）+ FE-P0-3 异常处理补全（第一批） |
| D12 | FE-P0-3 异常处理补全（剩余）+ FE-P0-4 Descriptions 编辑入口补全 |
| D13 | 全量回归测试 + 验收指标对比 |
| D14 | 修复验收遗留问题 |

---

## 四、验收标准（修复前后对比指标）

### 4.1 数据库层验收

| 检查维度 | 修复前 | 目标 | 验收方法 |
|----------|--------|------|---------|
| tenant_id 类型一致率 | 35%（64 处错误） | 100% | `SELECT column_name, data_type FROM information_schema.columns WHERE column_name='tenant_id'` 全部返回 `uuid` |
| SERIAL 主键数量 | 17+ 张表 | 0 张 | `SELECT table_name FROM information_schema.columns WHERE column_default LIKE '%nextval%'` 返回 0 |
| 重复表定义 | 32 张表 | 0 张 | 扫描 migrations 目录，每张表仅一次 `CREATE TABLE` |
| 迁移编号唯一性 | 15 组重复 | 0 组重复 | 文件名编号无重复 |
| RLS 覆盖率 | 14% | 100%（全部业务表） | `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (SELECT tablename FROM pg_policies)` 返回仅系统表 |

### 4.2 后端路由验收

| 检查维度 | 修复前 | 目标 | 验收方法 |
|----------|--------|------|---------|
| A 类断裂（前端调用无后端） | 8 处 | 0 处 | 逐端点 curl 验证返回 200/4xx（非 404） |
| E 类未注册路由 | 3 处 | 0 处 | `grep -c 'register' routes.ts` 覆盖全部 import |
| B 类空实现 | 3 处 | 0 处 | 路由返回真实数据或明确错误码 |
| Gateway 代理对齐 | 28 处不匹配 | 全部对齐 | 通过 Gateway 访问各端点返回正确响应 |

### 4.3 前端验收

| 检查维度 | 修复前 | 目标 | 验收方法 |
|----------|--------|------|---------|
| 页面标题规范覆盖率 | 1.9% | 100% | `grep -r 'Title level={2}' pages/` 覆盖全部 85 主页面 |
| 硬编码颜色违规文件数 | 422/540 | 0/540 | `grep -r '#[0-9a-fA-F]\{6\}' pages/ | wc -l` |
| try/catch 覆盖率 | 8.5% | 90%+ | `grep -r 'try {' pages/ | wc -l` / 异步函数总数 |
| 只读 Descriptions 无编辑 | 28/93 | 0/93 | `grep -r 'Descriptions' pages/` 均有对应编辑入口 |
| Mock fallback 清除 | 15 处 | 0 处 | `grep -r 'Promise.resolve' api/ | wc -l` |
| Design Token 使用率 | 68.9% 文件导入 | 100% | `grep -r 'from.*@/tokens/colors' pages/ | wc -l` / 540 |

### 4.4 模块级验收矩阵

| 模块 | 标题合规 | 颜色合规 | 异常处理 | 编辑入口 | 后端路由 | 综合达标 |
|------|---------|---------|---------|---------|---------|---------|
| 工作台 | 10/10 | 10/10 | 10/10 | 10/10 | 通过 | 100% |
| 控制台 | 12/12 | 12/12 | 12/12 | 12/12 | 通过 | 100% |
| 交付 | 14/14 | 14/14 | 14/14 | 14/14 | 通过 | 100% |
| 可观测性 | 12/12 | 12/12 | 12/12 | 12/12 | 通过 | 100% |
| AI 平台 | 15/15 | 15/15 | 15/15 | 15/15 | 通过 | 100% |
| 基础设施 | 18/18 | 18/18 | 18/18 | 18/18 | 通过 | 100% |
| 治理 | 14/14 | 14/14 | 14/14 | 14/14 | 通过 | 100% |
| 生态 | 5/5 | 5/5 | 5/5 | 5/5 | 通过 | 100% |
| **总计** | **100/100** | **100/100** | **100/100** | **100/100** | **通过** | **100%** |

---

## 五、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| SERIAL→UUID 迁移导致外键断裂 | 中 | 高 | 迁移前备份；逐表验证外键引用；提供回滚脚本 |
| tenant_id 类型转换数据丢失 | 低 | 高 | 使用 `USING tenant_id::text::UUID` 保留可转换数据；不可转换的记录单独处理 |
| 前端批量替换引入回归 | 中 | 中 | 按模块分批次提交；每个模块完成后运行 `npm run test` |
| 32 张重复表合并后结构差异 | 中 | 中 | 以首次创建迁移为基准；对比差异列逐一确认 |

---

*计划生成时间: 2026-05-22*
*基于 3 份深度分析报告 P0 问题去重合并*
*总预估: 12 工作日 / ~3 周*
