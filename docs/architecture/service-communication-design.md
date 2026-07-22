# Orion 微服务间通信设计方案

## 一、当前状态分析

### 已有的通信基础设施

| 组件 | 状态 | 说明 |
|------|------|------|
| NATS JetStream | 已部署 | 所有服务都有 event-bus-service.ts |
| 事件主题规范 | 已定义 | Pipeline/Code/Deployment/Config/Incident/SelfHealing |
| 事件发布器 | 已实现 | 各服务有独立的 EventPublisher |

### 现有事件类型（orion-platform-service/src/events/EventTypes.ts）

```typescript
// Pipeline 事件
pipeline.run.created/started/completed/failed/cancelled
pipeline.stage.started/completed/failed/skipped
pipeline.task.started/completed/failed

// Code 事件
code.pr.opened/merged/closed/updated

// Deployment 事件
deploy.started/completed/failed/cancelled/rolledback

// Config 事件
config.drift.detected/resolved
config.change.applied/rejected

// Incident 事件
incident.detected/acknowledged/resolved/escalated

// Self-Healing 事件
selfhealing.incident.detected/started/action_executed/completed/failed/approval_requested
```

### 问题

1. **事件类型定义分散** - 主服务有 EventTypes.ts，各微服务有独立定义
2. **订阅机制未连通** - 各服务有 JetStream 客户端，但未建立跨服务订阅
3. **服务发现缺失** - 不知道哪些服务在运行，不知道对方端口

---

## 二、通信方案设计

### 方案 A: 基于事件驱动的异步通信（推荐）

**原理**: 通过 NATS JetStream 实现服务间事件通信，无需直接 HTTP 调用

```
┌─────────────────┐     orion.pipeline.run.completed     ┌─────────────────┐
│ orion-pipeline  │ ─────────────────────────────────▶  │  orion-chatops  │
│     -svc        │                                     │      -svc       │
└─────────────────┘                                     └─────────────────┘
         │                                                     ▲
         │ orion.pipeline.stage.started                       │
         └───────────────────────────────────────────────────┘
```

**优点**:
- 松耦合 - 服务无需知道彼此存在
- 高可用 - 事件持久化，即使消费者离线
- 可扩展 - 新增订阅者无需修改发布者

**实现步骤**:

1. **统一事件类型定义**
   ```typescript
   // packages/event-types/index.ts
   export const PipelineEvents = {
     RUN_CREATED: 'pipeline.run.created',
     RUN_COMPLETED: 'pipeline.run.completed',
     // ...
   } as const;
   ```

2. **各服务安装共享包**
   ```bash
   npm install @orion/event-types
   ```

3. **配置跨服务订阅**（在 event-bus-service.ts 中）
   ```typescript
   // orion-chatops-svc 订阅 pipeline 事件
   await eventBus.subscribe('orion.pipeline.*', async (event) => {
     await this.handlePipelineEvent(event);
   });
   ```

4. **在 API Gateway 添加路由**（可选）
   - 将请求路由到各微服务
   - 或保持现状，仅通过主服务中转

### 方案 B: 基于 HTTP 的同步通信

**原理**: 通过 API Gateway 统一代理各微服务

```
                    ┌─────────────────────┐
                    │   API Gateway       │
                    │   (localhost:3000)  │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌───────────────┐
│ platform-svc  │    │  chatops-svc    │    │  pipeline-svc │
│  :3001        │    │    :3002        │    │    :3003      │
└───────────────┘    └─────────────────┘    └───────────────┘
```

**实现步骤**:

1. **在 service-client.ts 添加路由**
   ```typescript
   const SERVICE_ROUTES = {
     'platform-service': { baseUrl: 'http://localhost:3001' },
     'chatops-service': { baseUrl: 'http://localhost:3002' },
     'pipeline-service': { baseUrl: 'http://localhost:3003' },
     // ... 其他 31 个服务
   };
   ```

2. **为各服务分配端口**（在 package.json 或 .env）
   ```bash
   # orion-chatops-svc/.env
   PORT=3002

   # orion-pipeline-svc/.env
   PORT=3003
   ```

3. **在 API Gateway 添加路由规则**
   ```typescript
   // routes/chatops.routes.ts
   fastify.register(chatopsRoutes, { prefix: '/api/chatops' });
   ```

4. **配置 Nginx/API Gateway 负载均衡**（生产环境）

**优点**:
- 实现简单 - 基于现有 HTTP 基础设施
- 易于调试 - 可用 curl/Postman 直接测试
- 成熟方案 - HTTP 是最常见的微服务通信方式

**缺点**:
- 紧耦合 - 服务需知道对方地址
- 单点故障 - Gateway 挂了影响全局

### 方案 C: 混合方案（推荐生产使用）

| 通信类型 | 方案 | 示例 |
|----------|------|------|
| 同步调用 | HTTP via Gateway | 前端 → Gateway → Service |
| 异步通知 | NATS JetStream | Pipeline 完成 → ChatOps 通知 |
| 批量数据 | 消息队列 | 审计日志 → 批处理 |

---

## 三、实施建议

### 阶段 1：启用 HTTP 通信（1-2 周）

1. 分配服务端口
2. 在 API Gateway 添加路由
3. 测试服务间调用

### 阶段 2：启用事件通信（2-4 周）

1. 创建共享 @orion/event-types 包
2. 在各服务安装并使用
3. 配置 NATS 跨服务订阅

### 阶段 3：生产化（1-2 个月）

1. 添加 K8s 部署配置
2. 配置服务发现（Consul/Nacos）
3. 添加监控和链路追踪

---

## 四、端口分配建议

| 服务 | 端口 | 说明 |
|------|------|------|
| orion-platform-service | 3001 | 主服务 |
| orion-api-gateway | 3000 | 网关 |
| orion-chatops-svc | 3010 | ChatOps |
| orion-pipeline-svc | 3011 | Pipeline |
| orion-approval-svc | 3012 | Approval |
| orion-deploy-svc | 3013 | Deploy |
| orion-federation-svc | 3014 | Federation |
| orion-artifact-svc | 3015 | Artifact |
| orion-audit-svc | 3016 | Audit |
| orion-finops-svc | 3017 | FinOps |
| ... | ... | 继续分配 |

---

## 五、快速验证步骤

```bash
# 1. 启动 NATS
docker run -p 4222:4222 nats:latest

# 2. 启动主服务
cd orion-platform-service && npm run dev

# 3. 启动 chatops-svc（修改端口为 3010）
cd orion-chatops-svc && PORT=3010 npm run dev

# 4. 验证通信
# 发布事件到 NATS
nats pub orion.pipeline.run.completed '{"runId":"test-123"}'

# 观察 chatops-svc 日志是否收到事件
```

---

*设计完成时间: 2026-05-15*