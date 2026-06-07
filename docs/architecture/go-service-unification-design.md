# Orion Go 微服务统一设计方案

**文档版本**: v1.0
**创建日期**: 2026-06-07
**状态**: 实施中
**作者**: Orion Architecture Team

---

## 执行摘要

本设计文档提出将 Orion 系统从 Node.js + Go 双版本架构统一为 **Go 单一技术栈**的完整方案。当前系统存在 31 个服务同时拥有 Node.js 和 Go 版本，导致维护成本高、权威实现不明确、前端调用目标混乱。

**目标**: 以 Go (Gin + go-common) 为统一后端技术栈，分 3 波完成迁移，最终废弃所有 Node.js 微服务目录。

**预期收益**:
- 维护成本降低 50%（消除双版本维护）
- 类型安全提升（Go 静态类型 vs TypeScript 运行时类型错误）
- 并发性能提升（goroutine vs Node.js 单线程）
- 部署简化（统一构建、统一镜像）

---

## 一、现状分析

### 1.1 服务分布

| 类别 | 数量 | 说明 |
|------|------|------|
| Node.js 微服务 | 34 | `orion-*-svc/` 目录 |
| Go 微服务 | 46 | `orion-*-svc-go/` 目录 |
| 双版本服务 | 31 | 同时存在 Node.js 和 Go 版本 |
| 仅 Node.js | 3 | auth-svc, tenant-svc, user-svc |
| 仅 Go | 15 | event-bus, feature-flag, scheduler, secret 等 |

### 1.2 双版本服务实现差距

| 分类 | 服务 | Node.js 行数 | Go 行数 | 判定 |
|------|------|-------------|---------|------|
| **Go 已超越** | cmdb | 974 | 1772 | Go 权威 |
| | runner | 766 | 2171 | Go 权威 |
| | visor | 974 | 2067 | Go 权威 |
| | inception | 799 | 1211 | Go 权威 |
| | config-mgmt | 1376 | 2551 | Go 权威 |
| | skill | 1366 | 2577 | Go 权威 |
| | canary | N/A | 2396 | Go 权威 |
| **基本持平** | governance | 1993 | 1974 | Go 统一 |
| | risk | 2245 | 1956 | Go 统一 |
| | monitor | 3951 | 1953 | Go 补充 |
| | notify | 1701 | 1182 | Go 补充 |
| | selfhealing | 2313 | 1108 | Go 补充 |
| | digital-twin | 1149 | 2261 | Go 权威 |
| | dr | 5882 | 2156 | Go 补充 |
| | artifact | 3580 | 1184 | Go 补充 |
| | approval | 2890 | 1411 | Go 补充 |
| | community | 3035 | 1711 | Go 补充 |
| | efficiency | 5509 | 1239 | Go 补充 |
| | plugin | 4446 | 950 | Go 补充 |
| | finops | 8383 | 2500 | Go 补充 |
| | chatops | 9185 | 2853 | Go 补充 |
| | security | 7759 | 1276 | Go 补充 |
| | deploy | 6732 | 1197 | Go 补充 |
| | code | 13379 | 1873 | Go 补充 |
| | ticket | 13816 | 7321 | Go 补充 |
| | pipeline | 26197 | 3478 | Go 补充 |
| **差距大** | ai | 19599 | 0 | 需新建 Go |
| | llm | 0 | 1223 | Go 已有 |
| | graph | 739 | 294 | Go 补充 |
| | pandawiki | 845 | 297 | Go 补充 |
| | intelligence | 845 | 298 | Go 补充 |

### 1.3 缺失服务

| 服务 | 状态 | 说明 |
|------|------|------|
| orion-tool-svc | **完全缺失** | 函数矩阵中列出但无目录 |
| orion-ai-svc (Go) | **缺失** | 仅有 Node.js 版本 (19599 行) |

---

## 二、统一架构设计

### 2.1 目标架构

```
┌─────────────────────────────────────────────────────────────┐
│                    orion-api-gateway (Node.js)               │
│                    统一入口 + 反向代理                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    ▼                 ▼                 ▼
┌─────────┐    ┌─────────────┐    ┌──────────────┐
│ Go 服务  │    │ Go 服务      │    │ Go 服务       │
│ 研发效能 │    │ 可观测性     │    │ 安全合规      │
│ 8 个     │    │ 6 个         │    │ 3 个          │
└─────────┘    └─────────────┘    └──────────────┘
    │                 │                 │
    └─────────────────┼─────────────────┘
                      ▼
              ┌───────────────┐
              │  go-common    │
              │  共享包        │
              └───────────────┘
```

### 2.2 Go 服务标准结构

```
orion-{name}-svc-go/
├── cmd/
│   └── server/
│       └── main.go              # 入口：配置加载、依赖注入、HTTP 服务启动
├── internal/
│   ├── config/
│   │   └── config.go            # 环境变量配置结构体
│   ├── handler/
│   │   ├── handler.go           # HTTP 处理器（路由注册）
│   │   └── *_handler.go         # 业务处理器
│   ├── service/
│   │   └── *_service.go         # 业务逻辑层
│   ├── repository/
│   │   └── *_repository.go      # 数据访问层（PostgreSQL）
│   └── models/
│       └── models.go            # 数据模型定义
├── migrations/
│   └── 001_create_*_tables.sql  # 数据库迁移
├── go.mod
└── go.sum
```

### 2.3 go-common 共享包

所有 Go 服务共享 `orion-go-common` 包：

| 包 | 职责 | 已有 |
|---|------|------|
| `pkg/database` | PostgreSQL 连接、Repository 基类 | ✓ |
| `pkg/middleware` | HTTP 中间件（RequestID, Recovery, CORS, Logger） | ✓ |
| `pkg/logger` | 结构化日志 (zap) | ✓ |
| `pkg/redis` | Redis 客户端封装 | ✓ |
| `pkg/otel` | OpenTelemetry 初始化 | ✓ |
| `pkg/audit` | 审计日志、WORM 存储、UEBA | ✓ |
| `pkg/auth` | RBAC/ABAC 授权引擎 | ✓ |

---

## 三、迁移计划

### 3.1 三波迁移策略

#### 第一波：基础设施 + 已超越服务（1-2 周）

| 服务 | 当前状态 | 目标 | 工作量 |
|------|---------|------|--------|
| orion-cmdb-svc-go | Go 1772 行 > Node 974 | Go 权威, 废弃 Node | 低 |
| orion-runner-svc-go | Go 2171 行 > Node 766 | Go 权威, 废弃 Node | 低 |
| orion-visor-svc-go | Go 2067 行 > Node 974 | Go 权威, 废弃 Node | 低 |
| orion-inception-svc-go | Go 1211 行 > Node 799 | Go 权威, 废弃 Node | 低 |
| orion-config-mgmt-svc-go | Go 2551 行 > Node 1376 | Go 权威, 废弃 Node | 低 |
| orion-skill-svc-go | Go 2577 行 > Node 1366 | Go 权威, 废弃 Node | 低 |
| orion-digital-twin-svc-go | Go 2261 行 > Node 1149 | Go 权威, 废弃 Node | 低 |
| orion-canary-svc-go | Go 2396 行, 无 Node | Go 权威 | 低 |

#### 第二波：持平 + 核心服务（2-4 周）

| 服务 | 当前差距 | 目标 | 工作量 |
|------|---------|------|--------|
| orion-governance-svc-go | 1974 ≈ 1993 | Go 统一 | 低 |
| orion-risk-svc-go | 1956 ≈ 2245 | Go 统一 | 低 |
| orion-ticket-svc-go | 7321 vs 13816 | Go 补充至 10000+ | 中 |
| orion-pipeline-svc-go | 3478 vs 26197 | Go 补充核心流程 | 高 |
| orion-deploy-svc-go | 1197 vs 6732 | Go 补充至 5000+ | 高 |
| orion-code-svc-go | 1873 vs 13379 | Go 补充至 8000+ | 高 |
| orion-finops-svc-go | 2500 vs 8383 | Go 补充至 5000+ | 中 |
| orion-chatops-svc-go | 2853 vs 9185 | Go 补充至 6000+ | 中 |
| orion-security-svc-go | 1276 vs 7759 | Go 补充至 5000+ | 中 |
| orion-monitor-svc-go | 1953 vs 3951 | Go 补充至 3000+ | 中 |
| orion-notify-svc-go | 1182 vs 1701 | Go 补充至 1500+ | 低 |
| orion-selfhealing-svc-go | 1108 vs 2313 | Go 补充至 2000+ | 中 |
| orion-dr-svc-go | 2156 vs 5882 | Go 补充至 4000+ | 中 |
| orion-artifact-svc-go | 1184 vs 3580 | Go 补充至 3000+ | 中 |
| orion-approval-svc-go | 1411 vs 2890 | Go 补充至 2500+ | 中 |
| orion-community-svc-go | 1711 vs 3035 | Go 补充至 2500+ | 中 |
| orion-efficiency-svc-go | 1239 vs 5509 | Go 补充至 4000+ | 中 |
| orion-plugin-svc-go | 950 vs 4446 | Go 补充至 3000+ | 中 |

#### 第三波：新建 + 最终统一（4-6 周）

| 服务 | 当前状态 | 目标 | 工作量 |
|------|---------|------|--------|
| orion-ai-svc-go | **缺失** | 新建, 从 Node 19599 行移植 | 极高 |
| orion-tool-svc-go | **缺失** | 新建工具中心 | 高 |
| orion-graph-svc-go | 294 行 | 补充至 500+ | 低 |
| orion-pandawiki-svc-go | 297 行 | 补充至 500+ | 低 |
| orion-intelligence-svc-go | 298 行 | 补充至 500+ | 低 |
| orion-federation-svc-go | 297 行 | 补充至 1000+ | 中 |
| orion-event-bus-svc-go | 717 行 | 补充至 1500+ | 中 |
| orion-workflow-svc-go | 356 行 | 补充至 1000+ | 中 |
| orion-inspection-svc-go | 375 行 | 补充至 800+ | 低 |
| orion-plugin-svc-go | 950 行 | 补充至 2000+ | 中 |

### 3.2 保留 Node.js 的服务

以下服务保持 Node.js 不变（非微服务目录）：

| 服务 | 理由 |
|------|------|
| orion-platform-service | 主单体, 120 模块, 迁移成本极高, 保持 Node.js |
| orion-api-gateway | 轻量网关, Node.js/Fastify 足够 |
| orion-frontend | React/Vite, 与后端语言无关 |

---

## 四、缺失功能设计

### 4.1 orion-tool-svc-go（工具中心）

**功能矩阵**:
| 功能 | API | 说明 |
|------|-----|------|
| 工具注册 | POST /api/v1/tools | 注册新工具 |
| 工具列表 | GET /api/v1/tools | 分页查询工具 |
| 工具详情 | GET /api/v1/tools/:id | 获取工具详情 |
| 工具更新 | PUT /api/v1/tools/:id | 更新工具配置 |
| 工具删除 | DELETE /api/v1/tools/:id | 删除工具 |
| 工具分类 | GET /api/v1/tools/categories | 获取工具分类 |
| 工具搜索 | GET /api/v1/tools/search | 全文搜索 |
| 工具调用 | POST /api/v1/tools/:id/invoke | 调用工具 |
| 工具市场 | GET /api/v1/tools/marketplace | 工具市场列表 |
| 工具版本 | GET /api/v1/tools/:id/versions | 版本历史 |

**数据模型**:
```sql
CREATE TABLE tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    display_name VARCHAR(256),
    description TEXT,
    category VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,  -- 'cli', 'api', 'script', 'container'
    version VARCHAR(32) NOT NULL,
    config JSONB DEFAULT '{}',
    endpoint VARCHAR(512),
    auth_type VARCHAR(32),  -- 'none', 'api_key', 'oauth2', 'basic'
    auth_config JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    status VARCHAR(32) DEFAULT 'active',
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tools_tenant ON tools(tenant_id);
CREATE INDEX idx_tools_category ON tools(tenant_id, category);
CREATE INDEX idx_tools_status ON tools(tenant_id, status);
CREATE INDEX idx_tools_tags ON tools USING GIN(tags);
```

### 4.2 服务权威注册表

创建 `docs/architecture/service-authority-registry.md` 记录每个服务的权威实现：

```markdown
| 服务 | 权威实现 | 语言 | 端口 | 状态 |
|------|---------|------|------|------|
| pipeline | orion-pipeline-svc-go | Go | 3002 | 迁移中 |
| ticket | orion-ticket-svc-go | Go | 3004 | 迁移中 |
| ... | ... | ... | ... | ... |
```

### 4.3 17 个缺失 Repository 模式的平台模块

以下平台模块需要补充 Repository 模式：

| 模块 | 文件数 | 优先级 | 说明 |
|------|--------|--------|------|
| billing | 3 | P1 | 计费模块 |
| capacity | 3 | P1 | 容量管理 |
| community | 4 | P2 | 社区协作 |
| config | 7 | P1 | 配置管理 |
| consistency | 3 | P2 | 一致性检查 |
| cost-tracking | 3 | P1 | 成本追踪 |
| deployment-window | 3 | P2 | 部署窗口 |
| inspection | 3 | P2 | 巡检 |
| metadata | 3 | P2 | 元数据 |
| middleware-ops | 3 | P2 | 中间件运维 |
| mlops | 3 | P2 | MLOps |
| output-validation | 3 | P2 | 输出验证 |
| quality-gate | 3 | P1 | 质量门禁 |
| adaptive-pipeline | 3 | P2 | 自适应流水线 |
| ai-review | 8 | P1 | AI 代码审查 |
| workbench | 3 | P2 | 工作台 |

---

## 五、Go 服务补充详细设计

### 5.1 orion-pipeline-svc-go（流水线编排）— 最高优先级

**当前**: 3478 行, 基础 CRUD
**目标**: 完整 CI/CD 编排引擎, ~15000 行

**需补充功能**:

| 功能模块 | 当前状态 | 目标 | 行数估算 |
|---------|---------|------|---------|
| Pipeline CRUD | ✓ 已有 | 完善 | 500 |
| Stage 编排 | 部分 | 完整 DAG 执行 | 2000 |
| Task Runner | 部分 | 插件化任务执行 | 1500 |
| 触发器系统 | 部分 | Webhook/Cron/Event 触发 | 1000 |
| SSE 实时日志 | 部分 | 完整 SSE 流 | 800 |
| 审批门禁 | 部分 | 人工/自动审批 | 600 |
| 版本管理 | 部分 | 版本对比/回滚 | 800 |
| 模板系统 | 部分 | 模板市场/参数化 | 1000 |
| 并发控制 | 缺失 | 并行/串行/矩阵执行 | 1500 |
| 超时/重试 | 缺失 | 任务级超时重试 | 800 |
| 资源配额 | 缺失 | 租户级资源限制 | 600 |
| Webhook 回调 | 缺失 | 状态变更通知 | 500 |

### 5.2 orion-ticket-svc-go（工单管理）— 高优先级

**当前**: 7321 行, 较完整
**目标**: 完整工单生命周期, ~12000 行

**需补充功能**:

| 功能模块 | 当前状态 | 目标 | 行数估算 |
|---------|---------|------|---------|
| SLA 引擎 | 部分 | 完整 SLA 计算/升级 | 1000 |
| 工单分析 | 部分 | 趋势/瓶颈分析 | 800 |
| 负载均衡 | 部分 | 智能分配算法 | 600 |
| 队列管理 | 部分 | 优先级队列 | 500 |
| 流转历史 | 部分 | 完整审计链 | 400 |
| 关联工单 | 部分 | 依赖/阻塞关系 | 500 |
| 挂起/恢复 | 部分 | 状态机完善 | 300 |
| 批量操作 | 缺失 | 批量更新/导出 | 400 |

### 5.3 orion-deploy-svc-go（智能部署）— 高优先级

**当前**: 1197 行, 基础框架
**目标**: 完整部署引擎, ~8000 行

**需补充功能**:

| 功能模块 | 当前状态 | 目标 | 行数估算 |
|---------|---------|------|---------|
| 灰度发布 | 部分 | 金丝雀/蓝绿/A-B | 2000 |
| 回滚引擎 | 部分 | 自动/手动回滚 | 1000 |
| K8s 集成 | 缺失 | Deployment/Service 管理 | 2000 |
| 部署窗口 | 缺失 | 时间窗口限制 | 500 |
| 审批流 | 缺失 | 多级审批 | 600 |
| 部署分析 | 缺失 | 成功率/耗时分析 | 500 |
| 环境管理 | 缺失 | 环境隔离/变量 | 800 |

### 5.4 orion-code-svc-go（代码管理）— 高优先级

**当前**: 1873 行, 基础框架
**目标**: 完整代码仓库集成, ~10000 行

**需补充功能**:

| 功能模块 | 当前状态 | 目标 | 行数估算 |
|---------|---------|------|---------|
| Git 集成 | 部分 | GitHub/GitLab/Bitbucket | 3000 |
| Webhook 处理 | 部分 | PR/Push/Tag 事件 | 1500 |
| 代码扫描 | 缺失 | 静态分析集成 | 1500 |
| 分支管理 | 缺失 | 分支策略/保护规则 | 1000 |
| 代码统计 | 缺失 | 提交/PR 统计 | 1000 |
| MR 审查 | 缺失 | 自动审查/合并 | 1000 |

### 5.5 orion-ai-svc-go（AI 网关）— 新建

**目标**: 从 Node.js 版本移植, ~15000 行

**核心功能**:

| 功能模块 | 说明 | 行数估算 |
|---------|------|---------|
| LLM 路由 | 多模型路由/降级 | 2000 |
| 向量存储 | Embedding/检索 | 2000 |
| AI 成本管控 | Token 计费/预算 | 1500 |
| 模型管理 | 模型注册/配置 | 1500 |
| Prompt 模板 | 模板管理/版本 | 1000 |
| 对话管理 | 会话/上下文 | 1500 |
| AI 审查 | 代码审查/安全分析 | 2000 |
| 变更智能 | 变更影响分析 | 1500 |
| 决策解释 | AI 决策可解释性 | 1000 |

### 5.6 orion-tool-svc-go（工具中心）— 新建

**目标**: 完整工具管理平台, ~5000 行

详见 4.1 节设计。

---

## 六、API 网关路由统一

### 6.1 路由映射表

所有前端请求通过 API 网关路由到 Go 服务：

```
前端请求 → orion-api-gateway → Go 服务
```

| 前端路径 | Go 服务 | 端口 |
|---------|---------|------|
| /api/v1/pipelines/* | orion-pipeline-svc-go | 3002 |
| /api/v1/tickets/* | orion-ticket-svc-go | 3004 |
| /api/v1/deploy/* | orion-deploy-svc-go | 3003 |
| /api/v1/code/* | orion-code-svc-go | 3010 |
| /api/v1/ai/* | orion-ai-svc-go | 3012 |
| /api/v1/tools/* | orion-tool-svc-go | 3036 |
| /api/v1/finops/* | orion-finops-svc-go | 3009 |
| /api/v1/chatops/* | orion-chatops-svc-go | 3022 |
| /api/v1/security/* | orion-security-svc-go | 3013 |
| /api/v1/monitor/* | orion-monitor-svc-go | 3005 |
| /api/v1/cmdb/* | orion-cmdb-svc-go | 3019 |
| /api/v1/config/* | orion-config-mgmt-svc-go | 3024 |
| ... | ... | ... |

### 6.2 健康检查统一

所有 Go 服务暴露统一健康检查端点：

```go
r.GET("/health", func(c *gin.Context) {
    c.JSON(200, gin.H{
        "status":  "healthy",
        "service": cfg.ServiceName,
        "version": cfg.Version,
        "timestamp": time.Now().UTC(),
    })
})
```

---

## 七、数据库迁移统一

### 7.1 迁移文件规范

每个 Go 服务的 `migrations/` 目录包含：

```
migrations/
├── 001_create_*_tables.sql    # 基础表
├── 002_add_*_indexes.sql      # 索引
└── 003_add_*_columns.sql      # 后续扩展
```

### 7.2 迁移执行

使用 `golang-migrate/migrate` 统一执行：

```go
func runMigrations(dbURL string, logger *zap.Logger) error {
    m, err := migrate.New("file://migrations", dbURL)
    if err != nil {
        return err
    }
    defer m.Close()
    if err := m.Up(); err != nil && err != migrate.ErrNoChange {
        return err
    }
    logger.Info("migrations applied")
    return nil
}
```

---

## 八、测试策略

### 8.1 测试分层

| 层级 | 覆盖率目标 | 工具 |
|------|-----------|------|
| 单元测试 | 80% | `go test` |
| 集成测试 | 核心路径 | `testcontainers-go` |
| API 测试 | 所有端点 | `httptest` |
| 竞态检测 | 全部 | `go test -race` |

### 8.2 测试文件规范

```
internal/
├── handler/
│   ├── handler.go
│   └── handler_test.go        # Handler 单元测试
├── service/
│   ├── pipeline_service.go
│   └── pipeline_service_test.go  # Service 单元测试
└── repository/
    ├── pipeline_repository.go
    └── pipeline_repository_test.go  # Repository 集成测试
```

---

## 九、实施时间线

| 阶段 | 时间 | 交付物 |
|------|------|--------|
| Phase 1: 基础设施统一 | 第 1-2 周 | 8 个已超越服务切换为 Go 权威 |
| Phase 2: 核心服务补充 | 第 3-6 周 | pipeline/ticket/deploy/code Go 版本补全 |
| Phase 3: 中层服务补充 | 第 7-10 周 | finops/chatops/security/ai Go 版本补全 |
| Phase 4: 新建 + 收尾 | 第 11-14 周 | tool-svc 新建, 最小服务补全 |
| Phase 5: 废弃清理 | 第 15-16 周 | 废弃 Node.js 微服务目录 |

---

## 十、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Go 版本功能不完整 | 服务降级 | 先在 API 网关灰度切流, 保留 Node.js 回退 |
| 数据库迁移冲突 | 数据丢失 | 每个服务独立数据库 schema, 迁移前备份 |
| 团队 Go 经验不足 | 开发效率 | go-common 提供模板, Code Review 把关 |
| 测试覆盖不足 | 线上 Bug | 强制 80% 覆盖率门禁 |

---

## 附录 A：Go 服务端口分配

| 端口 | 服务 | 说明 |
|------|------|------|
| 3000 | orion-api-gateway | API 网关 |
| 3001 | orion-platform-service | 平台主服务 (Node.js) |
| 3002 | orion-pipeline-svc-go | 流水线 |
| 3003 | orion-deploy-svc-go | 部署 |
| 3004 | orion-ticket-svc-go | 工单 |
| 3005 | orion-monitor-svc-go | 监控 |
| 3006 | orion-intelligence-svc-go | AI 决策 |
| 3007 | orion-agent-svc-go | AI Agent |
| 3008 | orion-digital-twin-svc-go | 数字孪生 |
| 3009 | orion-finops-svc-go | FinOps |
| 3010 | orion-code-svc-go | 代码管理 |
| 3011 | orion-plugin-svc-go | 插件框架 |
| 3012 | orion-ai-svc-go | AI 网关 |
| 3013 | orion-security-svc-go | 安全扫描 |
| 3014 | orion-artifact-svc-go | 制品管理 |
| 3015 | orion-efficiency-svc-go | 效能看板 |
| 3016 | orion-dr-svc-go | 容灾 |
| 3017 | orion-federation-svc-go | 多云联邦 |
| 3018 | orion-risk-svc-go | 风险评估 |
| 3019 | orion-cmdb-svc-go | CMDB |
| 3020 | orion-knowledge-svc-go | 知识库 |
| 3021 | orion-skill-svc-go | Skill 管理 |
| 3022 | orion-chatops-svc-go | ChatOps |
| 3023 | orion-approval-svc-go | 审批 |
| 3024 | orion-config-mgmt-svc-go | 配置管理 |
| 3025 | orion-selfhealing-svc-go | 自愈引擎 |
| 3026 | orion-notify-svc-go | 通知中心 |
| 3027 | orion-audit-svc-go | 审计日志 |
| 3028 | orion-runner-svc-go | CI Runner |
| 3029 | orion-community-svc-go | 社区协作 |
| 3030 | orion-governance-svc-go | 治理中心 |
| 3031 | orion-dba-svc-go | DBA 服务 |
| 3032 | orion-visor-svc-go | 运维平台 |
| 3033 | orion-inception-svc-go | SQL 审核 |
| 3034 | orion-pandawiki-svc-go | 知识库管理 |
| 3035 | orion-graph-svc-go | 知识图谱 |
| 3036 | orion-tool-svc-go | 工具中心 (新建) |
