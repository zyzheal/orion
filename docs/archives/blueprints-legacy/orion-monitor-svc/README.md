# orion-monitor-svc

Orion Platform 的监控、自愈、告警和 OnCall 服务。从 `orion-platform-service` 提取的独立微服务。

## 技术栈

- **Runtime:** Node.js >= 20
- **Framework:** Fastify 5.x
- **Language:** TypeScript 5.x
- **Testing:** Vitest
- **Container:** Docker + docker-compose

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 构建
npm run build

# 生产启动
npm start

# 测试
npm test
```

## 使用 Docker Compose 启动

```bash
docker compose up -d
```

包含 Redis 依赖。服务运行在 `http://localhost:3100`。

## API 端点

### 监控

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/monitoring/rules` | 创建监控规则 |
| GET | `/api/v1/monitoring/rules` | 列表规则 |
| GET | `/api/v1/monitoring/rules/:id` | 获取单条规则 |
| PUT | `/api/v1/monitoring/rules/:id` | 更新规则 |
| DELETE | `/api/v1/monitoring/rules/:id` | 删除规则 |

### 告警

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/alerts/subscribe` | 订阅告警 |
| GET | `/api/v1/alerts` | 列表告警 |
| POST | `/api/v1/alerts/:id/resolve` | 解决告警 |

### 自愈

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/self-healing/policies` | 创建自愈策略 |
| GET | `/api/v1/self-healing/policies` | 列表策略 |
| GET | `/api/v1/self-healing/runs` | 自愈执行记录 |
| POST | `/api/v1/self-healing/trigger` | 手动触发自愈 |

### OnCall

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/oncall/schedules` | 创建排班 |
| GET | `/api/v1/oncall/schedules` | 列表排班 |
| GET | `/api/v1/oncall/current` | 当前值班人 |
| PUT | `/api/v1/oncall/schedules/:id` | 更新排班 |
| DELETE | `/api/v1/oncall/schedules/:id` | 删除排班 |

## 请求头

所有业务接口需要以下请求头用于多租户隔离：

| Header | Required | Description |
|--------|----------|-------------|
| `x-tenant-id` | Yes | 租户 ID |
| `x-project-id` | Yes (部分接口) | 项目 ID |
| `x-user-id` | Yes (写操作) | 操作用户 ID |

## 服务依赖

| 依赖服务 | 用途 |
|----------|------|
| `orion-ticket-svc` | 告警自动转工单 |
| `orion-platform-core` | 租户、项目、用户信息 |

## 环境变量

参考 `.env.example`。

## 项目结构

```
src/
  app.ts                        # Fastify 应用入口
  routes/
    monitoring.ts               # 监控规则路由
    alerts.ts                   # 告警路由
    selfhealing.ts              # 自愈路由
    oncall.ts                   # OnCall 排班路由
  services/
    MonitoringService.ts        # 监控服务
    AlertService.ts             # 告警服务
    SelfHealingService.ts       # 自愈引擎
    OnCallService.ts            # OnCall 排班服务
  types/
    monitor.ts                  # 类型定义
  middleware/                   # 自定义中间件（预留）
test/                           # 测试文件
```

## TODO

- [ ] 接入数据库（PostgreSQL）替代内存存储
- [ ] 实现告警通知渠道（email、webhook、slack、钉钉、飞书、短信）
- [ ] 与 `orion-ticket-svc` 集成实现告警自动转工单
- [ ] 与 `orion-platform-core` 集成实现租户/项目/用户信息解析
- [ ] 实现 OnCall 排班轮换逻辑
- [ ] 自愈动作执行引擎（重启、扩缩容、回滚等）
- [ ] 监控规则评估引擎（定时扫描指标）
- [ ] 添加认证和授权中间件
- [ ] 添加 API 限流
