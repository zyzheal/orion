# Orion ITSM Ticket Service

ITSM 工单管理服务，从 orion-platform-service 提取的最成熟模块。提供工单管理、智能派单、SLA 管理和 BI 分析功能。

## 功能模块

| 模块 | 路由前缀 | 描述 |
|------|----------|------|
| 工单管理 | `/api/v1/tickets` | 工单 CRUD、状态流转、分配、评论 |
| 智能派单 | `/api/v1/tickets/dispatch` | 自动派单、最佳匹配、派单规则 |
| SLA 管理 | `/api/v1/ticketing/sla` | SLA 策略、合规报告、升级 |
| BI 分析 | `/api/v1/tickets/bi` | 高管看板、经理看板、统计概览 |

## API 端点

### 工单管理

```
POST   /api/v1/tickets                        创建工单
GET    /api/v1/tickets                        列表工单
GET    /api/v1/tickets/:id                    获取详情
POST   /api/v1/tickets/:id/transition         状态流转
POST   /api/v1/tickets/:id/assign             分配工单
```

### 智能派单

```
POST   /api/v1/tickets/dispatch/auto/:id      自动派单
GET    /api/v1/tickets/dispatch/best-match/:id 最佳匹配
```

### SLA 管理

```
POST   /api/v1/ticketing/sla                  设置 SLA
GET    /api/v1/tickets/reports/sla            SLA 合规报告
```

### BI 分析

```
GET    /api/v1/tickets/bi/dashboard/executive  高管看板
GET    /api/v1/tickets/bi/dashboard/manager    经理看板
```

## 技术栈

- **Runtime:** Node.js >= 20
- **Framework:** Fastify 5.x
- **Language:** TypeScript 5.x
- **Database:** PostgreSQL 16 (via Prisma)
- **Cache:** Redis 7
- **Validation:** Zod
- **Testing:** Vitest

## 外部依赖

| 服务 | 用途 | 环境变量 |
|------|------|----------|
| orion-monitor-svc | 监控告警转工单 | `ORION_MONITOR_SVC_URL` |
| orion-intelligence-svc | AI 分类与智能推荐 | `ORION_INTELLIGENCE_SVC_URL` |
| orion-knowledge-svc | 知识库关联 | `ORION_KNOWLEDGE_SVC_URL` |
| orion-platform-core | 租户与用户服务 | `ORION_PLATFORM_CORE_URL` |

## 快速开始

### 开发环境

```bash
# 安装依赖
npm install

# 复制环境变量
cp .env.example .env

# 启动数据库和 Redis
docker-compose up -d postgres redis

# 启动开发服务器
npm run dev
```

### Docker 部署

```bash
# 构建镜像
docker-compose build

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f ticket-svc
```

## 类型系统

项目定义了 50+ 种 TypeScript 类型，涵盖：

- **基础枚举:** TicketStatus, TicketPriority, TicketType, TicketSource 等 16 种枚举
- **核心类型:** Ticket, TicketSLAInfo, ChangeInfo, TicketMetadata 等
- **历史与流转:** TicketHistory, FieldChange, HistoryAction
- **派单:** DispatchRequest, DispatchResult, DispatchCandidate, DispatchRule, MatchDetail
- **SLA:** SLAPolicy, SLAMetric, SLAEscalationRule, SLAReport, SLASchedule
- **工作流:** WorkflowDefinition, WorkflowNode, WorkflowInstance, ApprovalRecord
- **BI:** BIDashboardData, BIStats, DashboardChart, TicketTrend
- **其他:** TicketComment, KnowledgeAssociation, SatisfactionSurvey, ServiceCatalog

## 项目结构

```
orion-ticket-svc/
├── src/
│   ├── app.ts                    # Fastify 应用入口
│   ├── routes/
│   │   ├── ticket.ts             # 工单管理路由
│   │   ├── dispatch.ts           # 智能派单路由
│   │   ├── sla.ts                # SLA 管理路由
│   │   └── bi.ts                 # BI 分析路由
│   ├── services/
│   │   ├── TicketService.ts      # 工单核心服务
│   │   ├── DispatchEngine.ts     # 派单引擎
│   │   ├── WorkflowService.ts    # 工作流服务
│   │   └── SLAService.ts         # SLA 管理服务
│   ├── types/
│   │   └── ticket.ts             # 完整类型定义 (50+ 种)
│   ├── middleware/                # 中间件 (auth, tenant, etc.)
│   └── utils/                     # 工具函数
├── test/                          # 测试文件
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## TODO 清单

- [ ] 实现数据访问层 (Prisma Schema + Repositories)
- [ ] 实现 TicketService 完整业务逻辑
- [ ] 实现 DispatchEngine 匹配算法
- [ ] 实现 WorkflowService 工作流引擎
- [ ] 实现 SLAService 定时监控
- [ ] 实现 NotificationService 通知服务
- [ ] 实现 BIService BI 聚合查询
- [ ] 添加认证中间件 (JWT + 租户隔离)
- [ ] 添加 Prisma Schema 和数据库迁移
- [ ] 编写单元测试和集成测试
- [ ] 集成 orion-monitor-svc 告警转工单
- [ ] 集成 orion-intelligence-svc AI 分类
- [ ] 集成 orion-knowledge-svc 知识库
- [ ] 集成 orion-platform-core 用户/租户
