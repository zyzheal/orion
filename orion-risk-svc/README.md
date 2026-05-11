# Orion Risk Assessment Service

风险评估服务，从 orion-platform-service 提取。提供风险评估、风险分析、评分模型等功能。

## 功能模块

| 模块 | 路由前缀 | 描述 |
|------|----------|------|
| 风险评估 | `/api/v1/risk/assessments` | 创建、查询、更新风险评估 |
| 风险评分 | `/api/v1/risk/scores` | 获取风险评分、评分历史 |
| 风险事件 | `/api/v1/risk/events` | 风险事件列表、详情 |
| 风险详情 | `/api/v1/risk` | 风险详情查询、状态更新 |

## API 端点

```
POST   /api/v1/risk/assessments              创建风险评估
GET    /api/v1/risk/assessments              列表风险评估
GET    /api/v1/risk/assessments/:id          获取评估详情
PUT    /api/v1/risk/assessments/:id          更新评估
GET    /api/v1/risk/scores/:entityType/:entityId  获取风险评分
GET    /api/v1/risk/events                   列表风险事件
GET    /api/v1/risk/events/:id               获取事件详情
GET    /api/v1/risk/:id/detail               获取风险详情
PUT    /api/v1/risk/:id/status               更新风险状态
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

服务器默认运行在 `http://localhost:3021`

## 项目结构

```
orion-risk-svc/
├── src/
│   ├── app.ts                    # Fastify 应用入口
│   ├── config/
│   │   └── index.ts              # 配置管理
│   ├── middleware/
│   │   └── errorHandler.ts       # 全局错误处理
│   ├── routes/
│   │   └── risk.ts               # 风险路由
│   ├── services/
│   │   └── RiskService.ts        # 风险核心服务
│   └── types/
│       └── risk.ts               # 类型定义
├── package.json
├── tsconfig.json
└── README.md
```

## TODO 清单

- [ ] 实现数据访问层 (Prisma Schema + Repositories)
- [ ] 实现 RiskService 完整业务逻辑
- [ ] 实现风险评分算法
- [ ] 添加认证中间件 (JWT + 租户隔离)
- [ ] 添加数据库迁移
- [ ] 编写单元测试和集成测试
