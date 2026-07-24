# Orion Pipeline Service

CI/CD Pipeline 引擎服务，从 `orion-platform-service` 中提取的独立微服务。

## 职责

- Pipeline 定义与 CRUD 管理
- Pipeline 执行引擎 (DAG 拓扑排序、阶段调度)
- 运行状态管理与实时日志流 (SSE)
- 与 `orion-agent-svc` 集成执行任务
- 与 `orion-platform-core` 集成进行租户/项目验证
- 通过 `orion-api-gateway` 暴露 API

## 技术栈

| 组件 | 技术 |
|------|------|
| 运行时 | Node.js >= 20 |
| 框架 | Fastify 5.x |
| 语言 | TypeScript 5.x |
| 缓存/消息 | Redis 7 (状态管理 + SSE pub/sub) |
| 测试 | Vitest |
| 容器 | Docker + docker-compose |
| 代码质量 | Biome |

## 依赖服务

| 服务 | 用途 | 环境变量 |
|------|------|----------|
| orion-platform-core | 租户、项目管理 | `PLATFORM_CORE_URL` |
| orion-agent-svc | 任务执行调度 | `AGENT_SVC_URL` |
| orion-api-gateway | API 入口/路由 | `GATEWAY_URL` |
| Redis | 运行状态 + SSE | `REDIS_URL` |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际值

# 3. 启动开发服务器
npm run dev

# 4. 或使用 docker-compose
docker-compose up -d
```

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/pipelines` | 创建 Pipeline |
| GET | `/api/v1/pipelines` | 列表 Pipeline |
| GET | `/api/v1/pipelines/:id` | 获取 Pipeline 详情 |
| PUT | `/api/v1/pipelines/:id` | 更新 Pipeline |
| DELETE | `/api/v1/pipelines/:id` | 删除 Pipeline |
| POST | `/api/v1/pipelines/:id/run` | 运行 Pipeline |
| GET | `/api/v1/pipelines/:id/runs` | 列表运行记录 |
| GET | `/api/v1/pipelines/:id/runs/:rid` | 获取运行详情 |
| GET | `/api/v1/pipelines/:id/runs/:rid/logs` | SSE 实时日志流 |
| POST | `/api/v1/pipelines/:id/runs/:rid/cancel` | 取消运行 |
| GET | `/health` | 健康检查 |

## 项目结构

```
orion-pipeline-svc/
├── src/
│   ├── app.ts              # Fastify 应用入口
│   ├── config/
│   │   └── index.ts        # 配置加载与验证
│   ├── routes/
│   │   └── pipeline.ts     # Pipeline API 路由
│   ├── services/
│   │   ├── PipelineService.ts  # Pipeline CRUD 服务
│   │   └── PipelineEngine.ts   # Pipeline 执行引擎
│   ├── types/
│   │   └── pipeline.ts     # 类型定义
│   └── middleware/         # 中间件 (TODO)
├── test/                   # 测试文件
├── Dockerfile              # 多阶段构建
├── docker-compose.yml      # 本地开发
├── .env.example            # 环境变量示例
├── package.json
├── tsconfig.json
└── README.md
```

## 环境变量

参考 `.env.example`。关键配置项：

- `PORT` - 服务端口 (默认 3100)
- `REDIS_URL` - Redis 连接字符串
- `PLATFORM_CORE_URL` - Platform Core 服务地址
- `AGENT_SVC_URL` - Agent Service 服务地址
- `PIPELINE_MAX_CONCURRENT_RUNS` - 最大并发运行数 (默认 10)
- `PIPELINE_RUN_TIMEOUT_MS` - 单次运行超时 (默认 3600000ms)

## TODO

- [ ] 实现数据持久化层 (PostgreSQL / MongoDB)
- [ ] 实现与 Platform Core 的 HTTP 客户端集成
- [ ] 实现与 Agent Service 的任务调度集成
- [ ] 实现 SSE 日志流 (Redis pub/sub)
- [ ] 实现 DAG 拓扑排序与阶段调度
- [ ] 添加认证与租户隔离中间件
- [ ] 添加 Swagger/OpenAPI 文档
- [ ] 添加单元测试与集成测试
- [ ] 添加 CI/CD 流水线 (GitHub Actions / GitLab CI)
