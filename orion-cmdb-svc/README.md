# Orion CMDB Service

配置管理数据库服务，从 orion-platform-service 提取。提供 CMDB 配置管理、拓扑管理、K8s 对账等功能。

## 功能模块

| 模块 | 路由前缀 | 描述 |
|------|----------|------|
| CMDB 节点 | `/api/v1/cmdb/nodes` | 配置项 CRUD、查询 |
| 应用管理 | `/api/v1/cmdb/applications` | 应用管理、关联 |
| 拓扑管理 | `/api/v1/cmdb/topology` | 拓扑图、依赖关系 |
| 对账管理 | `/api/v1/cmdb/reconciliation` | K8s 对账、差异检测 |

## API 端点

```
POST   /api/v1/cmdb/nodes                        创建配置节点
GET    /api/v1/cmdb/nodes                        列表配置节点
GET    /api/v1/cmdb/nodes/:id                    获取节点详情
PUT    /api/v1/cmdb/nodes/:id                    更新节点
DELETE /api/v1/cmdb/nodes/:id                    删除节点
GET    /api/v1/cmdb/applications                 列表应用
GET    /api/v1/cmdb/applications/:id             获取应用详情
GET    /api/v1/cmdb/topology                     获取全局拓扑
GET    /api/v1/cmdb/topology/:nodeId             获取节点拓扑
POST   /api/v1/cmdb/reconciliation               执行对账
GET    /api/v1/cmdb/reconciliation/:id           获取对账结果
POST   /api/v1/cmdb/events                       发布配置变更事件
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

服务器默认运行在 `http://localhost:3022`

## 项目结构

```
orion-cmdb-svc/
├── src/
│   ├── app.ts                    # Fastify 应用入口
│   ├── config/
│   │   └── index.ts              # 配置管理
│   ├── middleware/
│   │   └── errorHandler.ts       # 全局错误处理
│   ├── routes/
│   │   └── cmdb.ts               # CMDB 路由
│   ├── services/
│   │   └── CmdbService.ts        # CMDB 核心服务
│   └── types/
│       └── cmdb.ts               # 类型定义
├── package.json
├── tsconfig.json
└── README.md
```

## TODO 清单

- [ ] 实现数据访问层 (Prisma Schema + Repositories)
- [ ] 实现 CmdbService 完整业务逻辑
- [ ] 实现拓扑图计算算法
- [ ] 实现 K8s 对账引擎
- [ ] 添加认证中间件 (JWT + 租户隔离)
- [ ] 添加数据库迁移
- [ ] 编写单元测试和集成测试
