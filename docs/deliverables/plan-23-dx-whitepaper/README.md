# Plan 23 — 开发者体验白皮书 (Developer Experience Whitepaper)

> 优先级: P2  
> 来源: v3.5 系统评审 — 本地代码扫描新增  
> 日期: 2026-08-26

## 本地代码扫描结果

| 模块 | 路径 | 文件数 | 行数 | 状态 |
|------|------|--------|------|------|
| Developer Portal | `internal/developer-portal/` | config+handler+models+repository+service | ~600 | ✅ 有基础框架 |

### 已有能力
- Developer Portal CRUD handler + repository + service
- Config 子目录 — 有配置管理基础
- Models — 有 DeveloperApp/DeveloperKey 等模型

### 缺口
1. **无快速开始指南** — 无 onboarding 流程，无 5分钟入门
2. **无代码规范文档** — 无 Go/React 编码规范，无 lint 配置标准
3. **无 PR 模板** — 无 Pull Request 模板，无 Review Checklist
4. **无调试指南** — 无本地开发环境搭建，无常见调试方法
5. **无 API 探索** — 无 API Explorer/Playground，无 OpenAPI 交互文档
6. **无 CLI 工具** — 无项目脚手架 CLI，无代码生成器
7. **无开发者指标** — 无 DORA 指标，无 Lead Time/Pull/Change Failure Rate

## 设计方案

### 1. 快速开始 (Quick Start)

```markdown
## 5 分钟入门

### 环境要求
- Go 1.25+
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 启动
make dev          # 启动后端 + 前端
make migrate      # 执行数据库迁移
make seed         # 初始化种子数据
make open-browser # 打开 http://localhost:5173
```

### 2. 代码规范

```go
// Go 代码规范
// 1. 命名: 导出函数 PascalCase, 内部 camelCase, 常量 UPPER_SNAKE
// 2. 错误处理: 必须包裹错误 (fmt.Errorf %w), 禁止忽略 error
// 3. Context: 所有函数第一参数必须是 context.Context
// 4. 日志: 使用 go-common/logger, 禁止 log.Printf
// 5. 测试: 覆盖率 >= 70%, 使用 testify/assert + testify/suite
```

```typescript
// React/TypeScript 代码规范
// 1. 组件: 函数组件 + Hooks, 禁止 Class Component
// 2. 状态: 全局 Zustand, 局部 useState/useReducer
// 3. 类型: 禁止 any, 必须显式 interface/type
// 4. 样式: CSS Modules 或 styled-components
// 5. 测试: Vitest + @testing-library/react
```

### 3. PR 模板

```markdown
## Pull Request 模板

### 变更类型
- [ ] feat: 新功能
- [ ] fix: Bug 修复
- [ ] refactor: 重构
- [ ] perf: 性能优化
- [ ] docs: 文档
- [ ] test: 测试
- [ ] chore: 构建/依赖

### 检查清单
- [ ] 代码通过 `make lint`
- [ ] 测试通过 `make test`
- [ ] 覆盖率不低于 70%
- [ ] 新增 API 有 OpenAPI 注释
- [ ] 变更已添加到 CHANGELOG
- [ ] 无 console.log / fmt.Println 残留
- [ ] 无敏感信息 (密钥/密码)
```

### 4. 调试指南

```markdown
## 本地开发

### 后端调试
# Air 热重载
air -c .air.toml

# Delve 调试器
dlv debug ./cmd/platform-svc -- --config config.dev.yaml

### 前端调试
# Vite dev server (HMR)
npm run dev

# React DevTools + Redux DevTools

### 常见问题
1. 数据库连接失败 → 检查 PGHOST/PGPORT 环境变量
2. Redis 连接失败 → 检查 REDIS_ADDR
3. 端口冲突 → lsof -i :8080
4. 迁移失败 → 检查 migration 版本号
```

### 5. API Explorer

```go
type APIExplorer struct {
    OpenAPISpec  map[string]interface{}
    PlaygroundURL string
    TryItOut      bool
    Examples      map[string]Example
}

type Example struct {
    Method   string                 `json:"method"`
    Path     string                 `json:"path"`
    Request  map[string]interface{} `json:"request"`
    Response map[string]interface{} `json:"response"`
    CurlCmd  string                 `json:"curlCmd"`
}
```

- 前端: `src/pages/developer-portal/api-explorer/` — Swagger UI 交互
- 后端: `/api/v1/developer-portal/openapi.json` — OpenAPI 3.0 规范
- 支持 Try It Out — 直接发送请求测试 API

### 6. DORA 指标

```go
type DORAMetrics struct {
    DeploymentFrequency  float64 `json:"deploymentFrequency"`  // 次/天
    LeadTimeForChanges   float64 `json:"leadTimeForChanges"`   // 小时
    ChangeFailureRate    float64 `json:"changeFailureRate"`    // 百分比
    TimeToRestoreService float64 `json:"timeToRestoreService"` // 小时
    Period               string  `json:"period"`               // daily, weekly, monthly
    Team                 string  `json:"team"`
}
```

| 级别 | 部署频率 | 变更提前期 | 失败率 | 恢复时间 |
|------|---------|-----------|--------|---------|
| Elite | 多次/天 | <1小时 | <15% | <1小时 |
| High | 每天 | 1天-1周 | 15-20% | <1天 |
| Medium | 每周 | 1周-1月 | 20-30% | <1天 |
| Low | 每月 | 1-6月 | >30% | >1天 |

### API 端点设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/developer-portal/quickstart` | 获取快速开始指南 |
| GET | `/api/v1/developer-portal/openapi.json` | OpenAPI 3.0 规范 |
| GET | `/api/v1/developer-portal/dora-metrics` | DORA 指标 |
| GET | `/api/v1/developer-portal/api-examples` | API 示例列表 |

### 合并策略

1. **复用** `internal/developer-portal/` 的 handler/repository/service — 不重建
2. **增强** `internal/developer-portal/config/` — 新增开发者文档配置
3. **新增** `docs/developer-guide/` — 快速开始、代码规范、PR 模板、调试指南
4. **新增** `internal/dora/` — DORA 指标采集 + 汇报
5. 前端增强 `src/pages/developer-portal/` — API Explorer + DORA Dashboard

### 实现优先级

| 优先级 | 任务 | 预计工时 |
|--------|------|----------|
| P0 | 快速开始 + 环境搭建指南 | 1d |
| P0 | API Explorer (Swagger UI) | 2d |
| P1 | 代码规范 + PR 模板 | 1d |
| P1 | DORA 指标采集 + Dashboard | 3d |
| P2 | CLI 脚手架工具 | 3d |
| P2 | 调试指南 + FAQ | 1d |