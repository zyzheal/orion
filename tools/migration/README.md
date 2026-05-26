# Orion 迁移工具集

用于将 Node.js 后端服务迁移到 Go/Rust/Python 的自动化工具。

## 工具列表

### 1. `extract-api-contract.ts` — 提取 API 契约

从 Node.js Fastify 路由文件中提取所有 API 端点，生成 OpenAPI 3.0 YAML spec。

```bash
# 提取单个文件
npx tsx tools/migration/extract-api-contract.ts orion-platform-service/src/api/auth-routes.ts --output api-contracts/

# 提取所有路由文件
npx tsx tools/migration/extract-api-contract.ts orion-platform-service/src/api/ --output api-contracts/
```

**输出**：
- `api-contracts/<module>-openapi.yaml` — 每个路由文件的独立 spec
- `api-contracts/openapi-combined.yaml` — 合并后的完整 spec

### 2. `generate-go-scaffold.ts` — 生成 Go 项目脚手架

读取 OpenAPI 3.0 spec，生成完整的 Go 服务项目。

```bash
npx tsx tools/migration/generate-go-scaffold.ts api-contracts/auth-openapi.json --output orion-auth-svc/
```

**生成的目录结构**：
```
orion-auth-svc/
├── cmd/server/main.go          # 入口 + Gin 路由 + 健康检查 + OTel
├── internal/
│   ├── handler/handler.go      # HTTP handlers（每个 API 端点一个方法）
│   ├── service/service.go      # 业务逻辑层（接口定义）
│   ├── repository/repository.go # 数据访问层（sqlx）
│   ├── middleware/middleware.go # Auth/TenantID/RequestID/CORS/Logging/Metrics
│   ├── config/config.go        # 配置加载（环境变量 + YAML）
│   ├── models/models.go        # 数据模型（分页请求/响应基类）
│   └── otel/otel.go            # OpenTelemetry 初始化
├── migrations/001_create_entities.sql
├── api/openapi.yaml
├── config/config.example.yaml
├── Dockerfile                  # 多阶段构建
├── docker-compose.yml          # PostgreSQL + Redis
├── go.mod
└── Makefile                    # build/test/lint/docker-build/run/migrate-up
```

### 3. `validate-migration.ts` — 验证迁移正确性

对比 Node.js 路由和 Go 服务，检查完整性。

```bash
npx tsx tools/migration/validate-migration.ts \
  --node-routes orion-platform-service/src/api/auth-routes.ts \
  --go-service orion-auth-svc/
```

**检查项**：
- 目录结构（10 个必需目录）
- 必需文件（10 个文件）
- go.mod 依赖（gin/sqlx/zap/jwt/redis）
- Makefile targets（6 个）
- Dockerfile 质量（多阶段构建/非 root 用户/端口暴露）
- 健康检查端点
- 中间件（Auth/TenantID/RequestID/CORS/Logging/Metrics）
- API 端点覆盖对比

**输出**：终端报告 + `.migration/validation-report.json`

## 完整迁移流程

```bash
# Step 1: 从 Node.js 提取 API 契约
npx tsx tools/migration/extract-api-contract.ts \
  orion-platform-service/src/api/auth-routes.ts \
  --output api-contracts/

# Step 2: 生成 Go 项目脚手架
npx tsx tools/migration/generate-go-scaffold.ts \
  api-contracts/auth-openapi.json \
  --output orion-auth-svc/

# Step 3: 手动填充业务逻辑
cd orion-auth-svc/
# - 填充 internal/handler/handler.go 中的方法体
# - 填充 internal/service/service.go 中的业务逻辑
# - 填充 internal/repository/repository.go 中的数据访问
# - 更新 migrations/001_create_entities.sql 中的数据模型

# Step 4: 构建并测试
make build
make test

# Step 5: 验证迁移正确性
npx tsx tools/migration/validate-migration.ts \
  --node-routes orion-platform-service/src/api/auth-routes.ts \
  --go-service orion-auth-svc/
```

## 注意事项

- `extract-api-contract.ts` 使用正则表达式解析路由，对于复杂的动态路由可能需要手动调整
- `generate-go-scaffold.ts` 生成的是基础脚手架，业务逻辑需要手动实现
- `validate-migration.ts` 的 P0 失败项必须修复后才能上线
- 所有工具需要 `npx tsx` 运行，依赖 TypeScript 执行环境
