# Orion Configuration Management Service

配置管理服务，从 orion-platform-service 提取。提供配置管理、版本对比、漂移检测、GitOps、特性开关、审批等功能。

## 功能模块

| 模块 | 路由前缀 | 描述 |
|------|----------|------|
| 配置管理 | `/api/v1/config` | 配置项 CRUD、版本管理 |
| 版本对比 | `/api/v1/config/diff` | 版本差异对比 |
| 漂移检测 | `/api/v1/config/drift` | 配置漂移检测 |
| 特性开关 | `/api/v1/config/feature-flags` | 特性开关管理 |
| 审批管理 | `/api/v1/config/approvals` | 配置变更审批 |
| GitOps | `/api/v1/config/gitops` | GitOps 同步 |

## API 端点

```
GET    /api/v1/config/:key                       获取配置
PUT    /api/v1/config/:key                       更新配置
GET    /api/v1/config/:key/versions              获取版本列表
GET    /api/v1/config/:key/versions/:version     获取指定版本
POST   /api/v1/config/diff                       版本差异对比
GET    /api/v1/config/drift/detect               检测配置漂移
POST   /api/v1/config/feature-flags              创建特性开关
PUT    /api/v1/config/feature-flags/:id/toggle   切换特性开关
GET    /api/v1/config/feature-flags              列表特性开关
POST   /api/v1/config/approvals                  创建审批
GET    /api/v1/config/approvals/:id              获取审批详情
POST   /api/v1/config/gitops/sync                GitOps 同步
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

服务器默认运行在 `http://localhost:3023`

## 项目结构

```
orion-config-mgmt-svc/
├── src/
│   ├── app.ts                    # Fastify 应用入口
│   ├── config/
│   │   └── index.ts              # 配置管理
│   ├── middleware/
│   │   └── errorHandler.ts       # 全局错误处理
│   ├── routes/
│   │   └── config-mgmt.ts        # 配置管理路由
│   ├── services/
│   │   └── ConfigMgmtService.ts  # 配置管理核心服务
│   └── types/
│       └── config-mgmt.ts        # 类型定义
├── package.json
├── tsconfig.json
└── README.md
```

## TODO 清单

- [ ] 实现数据访问层 (Prisma Schema + Repositories)
- [ ] 实现 ConfigMgmtService 完整业务逻辑
- [ ] 实现版本对比算法
- [ ] 实现配置漂移检测引擎
- [ ] 实现 GitOps 同步引擎
- [ ] 添加认证中间件 (JWT + 租户隔离)
- [ ] 添加数据库迁移
- [ ] 编写单元测试和集成测试
