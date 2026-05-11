# API Gateway 路由聚合配置

## 1. 概述

orion-gateway 是所有外部请求的统一入口，负责将请求路由到对应的后端服务。

## 2. 路由表

| 路径前缀 | 目标服务 | 内部 URL | 说明 |
|----------|----------|----------|------|
| `/api/platform` | orion-platform-core | `http://orion-platform-core:3001` | 租户/项目/配置 |
| `/api/pipeline` | orion-pipeline-svc | `http://orion-pipeline-svc:3002` | CI/CD 流水线 |
| `/api/deploy` | orion-deploy-svc | `http://orion-deploy-svc:3003` | 部署管理 |
| `/api/ticket` | orion-ticket-svc | `http://orion-ticket-svc:3004` | 工单管理 |
| `/api/monitor` | orion-monitor-svc | `http://orion-monitor-svc:3005` | 监控自愈 |
| `/api/intelligence` | orion-intelligence-svc | `http://orion-intelligence-svc:3006` | AI 分析 |
| `/api/agent` | orion-agent-svc | `http://orion-agent-svc:3007` | Runner 管理 |
| `/api/knowledge` | orion-knowledge-svc | `http://orion-knowledge-svc:3008` | 知识库 |
| `/health` | - | 本地 | 网关健康检查 |
| `/api/health` | - | 本地 | 聚合健康检查 |

## 3. 路由配置示例 (Express + http-proxy-middleware)

```typescript
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

// 服务注册表
const services = {
  platform:    process.env.PLATFORM_SERVICE_URL    || 'http://orion-platform-core:3001',
  pipeline:    process.env.PIPELINE_SERVICE_URL    || 'http://orion-pipeline-svc:3002',
  deploy:      process.env.DEPLOY_SERVICE_URL      || 'http://orion-deploy-svc:3003',
  ticket:      process.env.TICKET_SERVICE_URL      || 'http://orion-ticket-svc:3004',
  monitor:     process.env.MONITOR_SERVICE_URL     || 'http://orion-monitor-svc:3005',
  intelligence: process.env.INTELLIGENCE_SERVICE_URL || 'http://orion-intelligence-svc:3006',
  agent:       process.env.AGENT_SERVICE_URL       || 'http://orion-agent-svc:3007',
  knowledge:   process.env.KNOWLEDGE_SERVICE_URL   || 'http://orion-knowledge-svc:3008',
};

// 路由规则
const routes: Record<string, string> = {
  '/api/platform':    services.platform,
  '/api/pipeline':    services.pipeline,
  '/api/deploy':      services.deploy,
  '/api/ticket':      services.ticket,
  '/api/monitor':     services.monitor,
  '/api/intelligence': services.intelligence,
  '/api/agent':       services.agent,
  '/api/knowledge':   services.knowledge,
};

// 注册代理中间件
for (const [path, target] of Object.entries(routes)) {
  app.use(
    path,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: { [`^${path}`]: '' },
      timeout: 30000,
      proxyTimeout: 30000,
      logLevel: 'warn',
      onError: (err, req, res) => {
        res.status(502).json({
          error: 'ServiceUnavailable',
          message: `Backend service ${target} is not available`,
        });
      },
    })
  );
}

// 聚合健康检查
app.get('/api/health', async (req, res) => {
  const healthChecks = Object.entries(services).map(async ([name, url]) => {
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
      return { name, status: response.ok ? 'healthy' : 'unhealthy' };
    } catch {
      return { name, status: 'unhealthy' };
    }
  });

  const results = await Promise.all(healthChecks);
  const allHealthy = results.every(r => r.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    services: results,
  });
});

app.listen(3000, () => {
  console.log('Gateway listening on port 3000');
});
```

## 4. 中间件链

请求处理顺序：

```
请求进入
    │
    ▼
1. CORS 处理
    │
    ▼
2. 请求日志 (morgan/winston)
    │
    ▼
3. JWT 认证 (验证 token 有效性)
    │
    ▼
4. 权限检查 (验证用户是否有目标资源访问权限)
    │
    ▼
5. 请求限流 (滑动窗口限流)
    │
    ▼
6. 路由代理 (转发到目标服务)
    │
    ▼
7. 响应头注入 (X-Request-ID, X-Response-Time)
    │
    ▼
响应返回
```

## 5. 错误处理

### 5.1 标准错误响应格式

```json
{
  "error": "ErrorCode",
  "message": "Human readable message",
  "requestId": "req_abc123"
}
```

### 5.2 HTTP 状态码映射

| 状态码 | 场景 |
|--------|------|
| 401 | JWT 无效或缺失 |
| 403 | 权限不足 |
| 404 | 路由不存在 |
| 429 | 请求频率过高 |
| 502 | 后端服务不可达 |
| 503 | 后端服务健康检查失败 |
| 504 | 后端服务超时 |

## 6. 负载均衡

当后端服务有多个实例时，Gateway 自动进行负载均衡：

```typescript
// 服务实例注册
const serviceInstances: Record<string, string[]> = {
  platform: [
    'http://orion-platform-core-1:3001',
    'http://orion-platform-core-2:3001',
  ],
};

// 轮询负载均衡
const roundRobin: Record<string, number> = {};

function getNextInstance(service: string): string {
  const instances = serviceInstances[service];
  if (!instances || instances.length === 0) {
    throw new Error(`No instances for service: ${service}`);
  }
  const index = (roundRobin[service] || 0) % instances.length;
  roundRobin[service] = index + 1;
  return instances[index];
}
```

## 7. WebSocket 支持

对于需要实时通信的场景，Gateway 支持 WebSocket 代理：

```typescript
app.use(
  '/api/platform/ws',
  createProxyMiddleware({
    target: services.platform,
    ws: true,
    changeOrigin: true,
  })
);
```

## 8. 配置热更新

Gateway 支持通过 NATS 事件动态更新路由配置：

```
事件主题: orion.gateway.config.updated
消息格式: { routes: { path: target, ... } }
```

收到配置更新事件后，Gateway 重新加载路由表而无需重启。
