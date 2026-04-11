# Orion API Gateway

Orion 平台的 API 网关服务，基于 Fastify + TypeScript 构建。

## 功能特性

- **请求路由** - 将请求代理到后端服务
- **认证鉴权** - JWT Token 验证
- **限流保护** - 基于 IP 的速率限制
- **健康检查** - `/healthz` 端点检查服务状态
- **服务注册** - 自动注册和发现服务
- **日志记录** - 结构化请求/响应日志
- **错误处理** - 统一的错误响应格式
- **CORS 支持** - 跨域请求配置

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
| `PORT` | 服务端口 | `3000` |
| `HOST` | 服务地址 | `0.0.0.0` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `CORS_ORIGINS` | 允许的源（逗号分隔） | `*` |
| `JWT_SECRET` | JWT 密钥 | `orion-default-jwt-secret-change-in-production` |
| `JWT_EXPIRES_IN` | Token 过期时间 | `24h` |
| `RATE_LIMIT_MAX` | 限流请求数 | `100` |
| `RATE_LIMIT_WINDOW` | 限流时间窗口 (ms) | `60000` |
| `NATS_SERVERS` | NATS 服务器地址 | `nats://localhost:4222` |
| `PLATFORM_SERVICE_URL` | 平台服务地址 | `http://localhost:3001` |

### 启动示例

```bash
# 基础启动
PORT=3000 npm run dev

# 连接 NATS
NATS_SERVERS=nats://localhost:4222 npm run dev

# 生产环境
NODE_ENV=production \
JWT_SECRET=your-secret-key \
PORT=3000 \
npm start
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
  "service": "api-gateway"
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

### 代理路由

- `/api/v1/*` - 代理到平台服务
- `/api/v1/platform/*` - 代理到平台服务

## 项目结构

```
orion-api-gateway/
├── src/
│   ├── index.ts          # 入口文件
│   ├── app.ts            # 应用配置
│   ├── config/           # 配置管理
│   │   └── index.ts
│   ├── middleware/       # 中间件
│   │   ├── auth.ts       # JWT 认证
│   │   ├── health.ts     # 健康检查
│   │   ├── logging.ts    # 日志
│   │   ├── error.ts      # 错误处理
│   │   └── proxy.ts      # 代理
│   ├── routes/           # 路由
│   │   ├── api.ts
│   │   └── index.ts
│   ├── services/         # 业务服务
│   │   └── service-registry.ts
│   └── utils/            # 工具函数
│       └── index.ts
├── infra/                # 基础设施
│   └── nats/
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

## 认证

除了健康检查端点外，所有请求都需要 JWT 认证。

### 认证方式

1. **Authorization Header** (推荐)
   ```
   Authorization: Bearer <your-jwt-token>
   ```

2. **API Key Header**
   ```
   X-API-Key: <your-api-key>
   ```

3. **Query Parameter**
   ```
   ?token=<your-jwt-token>
   ```

## 限流

默认配置：
- 最大请求数：100 次/分钟
- 本地地址 (127.0.0.1) 不限流

## 错误响应

所有错误返回统一格式：

```json
{
  "error": "ERROR_CODE",
  "message": "Error description",
  "code": "ERROR_CODE",
  "timestamp": "2026-04-11T12:00:00.000Z",
  "requestId": "req-xxx"
}
```

## License

Apache-2.0
