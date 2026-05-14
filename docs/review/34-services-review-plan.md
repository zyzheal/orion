# 34个微服务评审修复计划

> 生成时间: 2026-05-12
> 分支: feat/frontend-gap-implementation
> 评审范围: 全部34个微服务
> 状态: 已完成评审 + 部分P0/P1修复

## 已完成修复

### P0 修复 (4/14)
- [x] **1.3** orion-ticket-svc — 修复路由注册错误 (ticket.ts → ticket-full.ts)
- [x] **1.13** orion-frontend — 创建 500 错误页面和 Quality Gate 页面
- [x] **1.10** orion-pandawiki-svc — 添加健康检查端点和优雅关闭
- [x] **1.11** orion-chatops-svc — 创建数据库配置和连接池初始化

### P1 安全修复 (8/18)
- [x] **2.5** orion-pipeline-svc — 移除 Secret 加密 Fallback（生产环境强制要求密钥）
- [x] **2.2** orion-runner-agent — 修复命令注入 (exec → spawn with shell:false)
- [x] **2.4** orion-code-svc — 启用真实 Webhook HMAC 验证
- [x] **2.16** orion-runner-agent — /execute 端点添加 Bearer token 认证
- [x] **2.12** orion-frontend — 修复 sourcemap 泄露 (hidden mode) + 代码分割
- [x] **2.7** orion-graph-svc — 修复 Cypher 注入 (label/type 白名单校验)
- [x] **2.11** orion-audit-svc — 修复审计哈希验证不一致 (verifyChain 统一 payload)
- [x] 添加 Runner dispatch 认证 TODO 标记

## 修复优先级

### Phase 1: P0 — 修复阻止启动/核心不可用的问题（14项）
### Phase 2: P1 — 修复严重安全漏洞（18项）
### Phase 3: P2 — 功能缺失与架构改进（20+项）

---

## Phase 1: P0 修复清单

### 1.1 orion-pipeline-svc — 实现 PipelineEngine 核心逻辑
- **现状**: 所有方法 throw 'Not implemented'
- **修复**: 实现 DAG 拓扑排序、阶段调度、状态机流转、SSE 日志流
- **文件**: `src/services/PipelineEngine.ts`

### 1.2 orion-deploy-svc — 实现 DeployService 核心逻辑
- **现状**: 所有方法 throw 'TODO'
- **修复**: 实现创建部署、列表查询、回滚、状态更新
- **文件**: `src/services/DeployService.ts`

### 1.3 orion-ticket-svc — 修复路由注册错误
- **现状**: app.ts 注册 ticket.ts（全501），ticket-full.ts 未注册
- **修复**: 切换路由注册到 ticket-full.ts
- **文件**: `src/app.ts`

### 1.4 orion-security-svc — 补齐缺失文件
- **现状**: Controller/Service/Repository 大量文件不存在
- **修复**: 补齐 SupplyChainController, SbomController, PolicyController, PolicyEvaluationController, PolicyRepository, PolicyService, PolicyEvaluationService, ExemptionService, QualityGateTrendService, 类型定义
- **文件**: `src/controllers/`, `src/services/policy/`, `src/repositories/`, `src/types/`

### 1.5 orion-federation-svc — 补齐缺失 Controller
- **现状**: 4个 Controller 文件不存在
- **修复**: 实现 FederationController, FederationAdvancedController, MultiCloudController, MultiCloudAdvancedController（调用已有的 FederationService）
- **文件**: `src/routes/controllers/`

### 1.6 orion-agent-svc — 创建 database 模块 + 实现核心路由
- **现状**: database.ts 不存在，路由全501
- **修复**: 创建 utils/database.ts，实现 Agent 注册/心跳/任务路由，注册 taskRoutes
- **文件**: `src/utils/database.ts`, `src/routes/agent.ts`, `src/routes/task.ts`, `src/app.ts`

### 1.7 orion-intelligence-svc — 注册子路由 + 实现核心端点
- **现状**: 子路由未注册，全部501
- **修复**: 在 main.py 中 include_router 所有子路由，实现 classify/summarize/sentiment 核心逻辑
- **文件**: `src/main.py`, `src/api/*.py`

### 1.8 orion-risk-svc — 实现核心逻辑 + 添加数据库层
- **现状**: 全部返回 null/空/501，无数据库配置
- **修复**: 实现 RiskService 核心逻辑，添加 PostgreSQL 连接和 Repository
- **文件**: `src/services/RiskService.ts`, `src/utils/database.ts`, `src/config/index.ts`

### 1.9 orion-digital-twin-svc — 实现 TwinRepository
- **现状**: 21个方法全部 TODO
- **修复**: 实现 PostgreSQL Repository 层
- **文件**: `src/services/DigitalTwinService.ts` (TwinRepository 部分)

### 1.10 orion-pandawiki-svc — 添加健康检查 + 租户认证
- **现状**: 无 healthz，租户ID从header读取
- **修复**: 添加 /healthz 端点，添加 JWT 认证中间件
- **文件**: `src/app.ts`, `src/routes/pandawiki.ts`

### 1.11 orion-chatops-svc — 初始化数据库连接
- **现状**: database 通过 options 注入但 app.ts 未初始化
- **修复**: 在 buildApp() 中初始化数据库连接池
- **文件**: `src/app.ts`

### 1.12 orion-artifact-svc — 修复缺失导入
- **现状**: 引用不存在的 Repository/Controller
- **修复**: 修正导入路径或补齐缺失文件
- **文件**: `src/app.ts`, `src/routes/`

### 1.13 orion-frontend — 创建缺失页面
- **现状**: Quality Gate 页面不存在，无 500 页面
- **修复**: 创建 QualityGatePage 组件和 ServerError 页面
- **文件**: `src/pages/quality-gate/`, `src/pages/ServerError/`

---

## Phase 2: P1 安全修复清单

### 2.1 全平台 — 统一 JWT 认证中间件
- 创建共享 auth middleware，从 JWT token 提取 userId/tenantId
- 替换所有服务中 `request.headers['tenantId']` 的做法
- 影响: 20+ 服务

### 2.2 orion-runner-agent — 修复命令注入
- `exec()` → `spawn()` with `shell: false`
- 添加容器/VM 沙箱隔离
- 文件: `src/TaskExecutor.ts:104`

### 2.3 orion-ai-svc — 禁用或加固 /execute 端点
- 添加强制认证 + 白名单语言支持 + 资源限制
- 文件: `src/routes/ai-security.ts:213-238`

### 2.4 orion-code-svc — 修复 Webhook HMAC 验证
- 启用真实的 HMAC 验证
- 使用原始请求体进行签名验证
- 文件: `src/services/WebhookService.ts:160`, `src/controllers/WebhookController.ts:50`

### 2.5 orion-pipeline-svc — 移除 Secret 加密 Fallback
- 生产环境强制要求配置加密密钥
- 文件: `src/services/SecretsService.ts:391-396`

### 2.6 orion-inception-svc — 修复 SQL 注入
- 白名单校验 db 名称，参数化查询
- 文件: `src/services/InceptionService.ts:93-99`

### 2.7 orion-graph-svc — 修复 Cypher 注入
- label/type 白名单校验，移除开放 Cypher 端点
- 文件: `src/services/GraphService.ts:205,234`

### 2.8 全平台 — 修复硬编码密钥/默认值
- 移除所有默认密码/secret
- 启动时校验必填配置
- 影响: 8+ 服务

### 2.9 全平台 — 修复 SSL rejectUnauthorized: false
- 生产环境使用正确 CA 证书
- 影响: 6+ 服务

### 2.10 orion-approval-svc — 修复审批并发竞态
- 使用数据库事务 + FOR UPDATE 锁
- 文件: `src/services/MultiLevelApprovalService.ts:130-181`

### 2.11 orion-audit-svc — 修复审计哈希验证不一致
- 统一 verifyLog 和 verifyChain 的 hash payload 构建
- 文件: `src/services/AuditService.ts:19,74,117`

### 2.12 orion-frontend — 修复 WebSocket token 泄露
- URL 参数 → onopen 消息认证
- 文件: `src/websocket/ws-client.ts:102-103`

### 2.13 orion-frontend — 启用子应用沙箱隔离
- 配置 wujie strictIsolation
- 文件: `src/microfront/config.ts`

### 2.14 orion-frontend — 配置 CSP
- 添加 Content-Security-Policy 响应头
- 文件: `vite.config.ts`, `index.html`

### 2.15 orion-frontend — 生产环境关闭 sourcemap
- `sourcemap: true` → `'hidden'`
- 文件: `vite.config.ts:27`

---

## Phase 3: P2 架构改进

### 3.1 集成真实 EventBus (NATS)
- 在平台服务中初始化 NATS 连接
- 将事件发布者连接到 NATS
- 影响: 全局

### 3.2 集成 Tekton Pipeline
- 替换 Mock K8sBuildExecutor
- 实现 Tekton PipelineRun CRD 创建和监控
- 影响: orion-code-svc, orion-pipeline-svc

### 3.3 移除 Mock/随机数数据
- federation-svc: 移除 Math.random() 健康数据
- efficiency-svc: 移除硬编码假数据
- 影响: 2 服务

### 3.4 统一插件管理系统
- 合并 PluginManagerService 和 PluginService
- 实现真实沙箱隔离
- 影响: orion-plugin-svc

### 3.5 集成真实 Embedding
- orion-knowledge-svc: 替换 simulated-hash-v1
- 影响: orion-knowledge-svc

### 3.6 统一 API 版本前缀和端口规范
- 登记所有服务端口
- 统一 /v1 前缀

### 3.7 实现 SLA 与派单引擎
- orion-ticket-svc: 实现 SLAService 核心方法
- orion-ticket-svc: 实现 DispatchEngine 核心策略

### 3.8 实现 AI 核心功能
- orion-ai-service (Python): 真实 LLM 集成
- orion-intelligence-svc: 实现核心端点逻辑
