# Orion Platform Service

Orion 平台核心服务，基于 Express + TypeScript 构建。

## 功能特性

- **服务注册** - 自动注册到 NATS 服务发现
- **健康检查** - `/healthz` 端点检查服务状态
- **事件总线** - 集成 @orion/event-bus
- **Redis 缓存** - 支持连接池和常用缓存操作
- **数据库连接** - PostgreSQL 连接池管理
- **配置管理** - 支持环境变量和热加载

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- npm >= 9.0.0

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 启动服务

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

## 配置说明

通过环境变量配置：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | `3001` |
| `HOST` | 服务地址 | `0.0.0.0` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `SERVICE_NAME` | 服务名称 | `orion-platform-service` |
| `NATS_SERVERS` | NATS 服务器地址 | `nats://localhost:4222` |
| `NATS_USER` | NATS 用户名 | - |
| `NATS_PASS` | NATS 密码 | - |
| `REDIS_HOST` | Redis 主机 | `localhost` |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `REDIS_PASSWORD` | Redis 密码 | - |
| `DB_HOST` | 数据库主机 | `localhost` |
| `DB_PORT` | 数据库端口 | `5432` |
| `DB_USER` | 数据库用户 | `postgres` |
| `DB_PASSWORD` | 数据库密码 | - |
| `DB_NAME` | 数据库名称 | `orion` |
| `EVENT_BUS_ENABLED` | 是否启用事件总线 | `true` |

### 启动示例

```bash
# 基础启动
PORT=3001 npm run dev

# 连接 NATS 和 Redis
NATS_SERVERS=nats://localhost:4222 \
REDIS_HOST=localhost \
npm run dev

# 完整配置
PORT=3001 \
NATS_SERVERS=nats://localhost:4222,nats://localhost:4223 \
REDIS_HOST=localhost \
REDIS_PORT=6379 \
DB_HOST=localhost \
DB_NAME=orion \
npm run dev
```

## API 端点

### 健康检查

```bash
GET /healthz
```

响应示例：
```json
{
  "status": "healthy",
  "timestamp": "2026-04-11T12:00:00.000Z",
  "version": "1.0.0",
  "service": "orion-platform-service",
  "checks": {
    "self": { "status": "up", "latency": 1 },
    "redis": { "status": "up", "latency": 5 },
    "eventbus": { "status": "up" }
  }
}
```

### 就绪检查

```bash
GET /readyz
```

### 版本信息

```bash
GET /version
```

### 服务信息

```bash
GET /api/v1/info
```

## 项目结构

```
orion-platform-service/
├── packages/
│   └── event-bus/        # 事件总线包（已完成）
├── src/
│   ├── index.ts          # 入口文件
│   ├── app.ts            # 应用配置
│   ├── config/           # 配置管理
│   │   └── index.ts
│   ├── services/         # 业务服务
│   │   ├── health.ts          # 健康检查
│   │   ├── nats-registry.ts   # NATS 服务注册
│   │   ├── redis-cache.ts     # Redis 缓存
│   │   ├── database.ts        # 数据库连接池
│   │   └── event-bus-service.ts # 事件总线集成
│   └── utils/            # 工具函数
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## 测试

```bash
# 运行测试
npm test

# 带覆盖率
npm run test:coverage

# 类型检查
npm run typecheck

# Lint
npm run lint
npm run lint:fix
```

## 事件总线使用

```typescript
import { EventBusService } from './services/event-bus-service';

// 创建服务
const eventBus = new EventBusService({
  servers: ['nats://localhost:4222'],
  enabled: true,
});

// 连接
await eventBus.connect();

// 发布事件
await eventBus.publish('orion.platform.user.created', {
  userId: '123',
  email: 'user@example.com',
});

// 订阅事件
await eventBus.subscribe('orion.platform.user.*', async (event) => {
  console.log('Received event:', event);
});
```

## Redis 缓存使用

```typescript
import { RedisCache } from './services/redis-cache';

// 创建缓存
const redis = new RedisCache({
  host: 'localhost',
  port: 6379,
});

// 连接
await redis.connect();

// 设置缓存
await redis.set('user:123', { name: 'John' }, 3600);

// 获取缓存
const user = await redis.get('user:123');

// 删除缓存
await redis.delete('user:123');
```

## 错误处理

所有错误返回统一格式：

```json
{
  "error": "ERROR_CODE",
  "message": "Error description",
  "timestamp": "2026-04-11T12:00:00.000Z"
}
```

## License

Apache-2.0
