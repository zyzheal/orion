# Orion Self-Healing Service

自愈引擎服务，从 orion-platform-service 提取。提供自愈引擎、事件响应、自动修复、策略管理等功能。

## 功能模块

| 模块 | 路由前缀 | 描述 |
|------|----------|------|
| 事件管理 | `/api/v1/selfhealing/incidents` | 自愈事件 CRUD |
| 策略评估 | `/api/v1/selfhealing/strategy` | 策略评估与决策 |
| 修复动作 | `/api/v1/selfhealing/actions` | 自动修复执行 |
| 知识库 | `/api/v1/selfhealing/knowledge` | 自愈知识库 |

## API 端点

```
POST   /api/v1/selfhealing/incidents             创建自愈事件
GET    /api/v1/selfhealing/incidents             列表自愈事件
GET    /api/v1/selfhealing/incidents/:id         获取事件详情
PUT    /api/v1/selfhealing/incidents/:id         更新事件
POST   /api/v1/selfhealing/strategy/evaluate     评估策略
POST   /api/v1/selfhealing/decision              做出修复决策
POST   /api/v1/selfhealing/actions/execute       执行修复动作
GET    /api/v1/selfhealing/knowledge             获取知识库
GET    /api/v1/selfhealing/knowledge/:id         获取知识详情
PUT    /api/v1/selfhealing/knowledge/:id         更新知识库
```

## 技术栈

- **Runtime:** Node.js >= 20
- **Framework:** Fastify 5.x
- **Language:** TypeScript 5.x
- **Database:** PostgreSQL 16 (TBD)
- **Validation:** Zod (TBD)

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

服务器默认运行在 `http://localhost:3025`

## 项目结构

```
orion-selfhealing-svc/
├── src/
│   ├── app.ts                    # Fastify 应用入口
│   ├── config/
│   │   └── index.ts              # 配置管理
│   ├── middleware/
│   │   └── errorHandler.ts       # 全局错误处理
│   ├── routes/
│   │   └── selfhealing.ts        # 自愈路由
│   ├── services/
│   │   └── SelfHealingService.ts # 自愈核心服务
│   └── types/
│       └── selfhealing.ts        # 类型定义
├── package.json
├── tsconfig.json
└── README.md
```

## TODO 清单

- [ ] 实现数据访问层 (Prisma Schema + Repositories)
- [ ] 实现 SelfHealingService 完整业务逻辑
- [ ] 实现自愈策略评估引擎
- [ ] 实现自动修复动作执行器
- [ ] 实现知识库管理
- [ ] 添加认证中间件 (JWT + 租户隔离)
- [ ] 添加数据库迁移
- [ ] 编写单元测试和集成测试
