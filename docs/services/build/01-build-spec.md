# 构建服务 Spec 文档

**生成日期**: 2026-07-03
**状态**: 编写中
**成熟度**: L1（初始定义）

---

## 一、服务定位

构建服务（Build Service）是 Orion 交付域的核心组件之一，负责管理代码构建的全生命周期。它提供构建记录管理、构建环境配置、构建制品存储三大能力：

- **构建管理**：跟踪每次构建的执行状态（pending → running → success/failed/cancelled），支持手动触发、取消、重试，并提供构建日志和统计聚合。
- **环境管理**：管理构建运行时环境（Docker 镜像、配置参数），为不同的项目/语言提供标准化的构建环境模板。
- **制品管理**：记录构建产出的制品（容器镜像、二进制文件等），支持存储路径追踪、下载计数、过期清理。

该服务对标 CI/CD 流水线中的构建环节，为前端流水线模块提供后端 API 支撑。它作为 Go 微服务蓝图实现，与 `orion-platform-service` 中的 Node.js Build 模块存在功能重叠，当前以独立服务形式部署运行。

---

## 二、验收标准

| 编号 | 验收标准 | 优先级 | 验证方式 |
|------|---------|--------|---------|
| BUILD-01 | 支持构建记录的完整 CRUD（创建/查询/列表/更新/删除），所有查询按租户隔离 | P0 | API 测试 |
| BUILD-02 | 构建生命周期支持触发（pending→running）、取消（running→cancelled）、重试（failed/cancelled→新 pending）三种状态转换 | P0 | API 测试 |
| BUILD-03 | 构建列表支持按项目 ID 和状态筛选，支持分页返回（page / page_size），默认每页 20 条，最大 100 条 | P0 | API 测试 |
| BUILD-04 | 构建统计接口返回 total/success/failed/running/pending 计数和平均耗时 | P0 | API 测试 |
| BUILD-05 | 构建触发后异步执行构建逻辑（模拟），完成后自动更新状态和镜像 tag | P0 | 集成测试 |
| BUILD-06 | 支持按 pipeline_run_id 查询关联的构建记录 | P1 | API 测试 |
| BUILD-07 | 构建日志查询接口返回构建的日志内容 | P1 | API 测试 |
| BUILD-08 | 构建环境的完整 CRUD（不支持列表分页，软删除） | P0 | API 测试 |
| BUILD-09 | 制品的完整 CRUD，支持按 run_id / stage_id / type 筛选 | P0 | API 测试 |
| BUILD-10 | 制品下载时递增 downloaded_count 计数器 | P1 | API 测试 |
| BUILD-11 | 支持清理过期制品（根据 expires_at 字段）和按 run_id 批量清理 | P1 | API 测试 |
| BUILD-12 | 所有写操作接口（创建/更新/删除/触发/取消/重试）需要 pipeline:write/delete/execute 权限 | P0 | API 测试 |
| BUILD-13 | 健康检查接口同时检测 PostgreSQL 和 Redis 连接状态 | P0 | API 测试 |
| BUILD-14 | 服务启动时自动执行数据库迁移（file://migrations） | P0 | 集成测试 |
| BUILD-15 | 所有服务方法通过 OTel 追踪埋点（span + 属性 + 错误记录） | P1 | 单元测试 |

---

## 三、API 设计

### 3.1 构建管理

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| GET | `/api/v1/builds` | 构建列表（分页，支持筛选） | Query: `page`(int), `page_size`(int), `project_id`(string), `status`(string) | `{ code, message, data: { data: Build[], total, page, limit, total_pages } }` |
| POST | `/api/v1/builds` | 创建构建 | Body: `CreateBuildInput` | `{ code, message, data: Build }` |
| GET | `/api/v1/builds/stats` | 构建统计 | Header: `X-Tenant-ID` | `{ code, message, data: BuildStats }` |
| GET | `/api/v1/builds/count` | 构建计数 | Header: `X-Tenant-ID` | `{ code, message, data: { count } }` |
| GET | `/api/v1/builds/pipeline-run/:runId` | 按管道运行 ID 获取构建 | Path: `runId` | `{ code, message, data: Build }` |
| GET | `/api/v1/builds/:id` | 获取构建详情 | Path: `id` | `{ code, message, data: Build }` |
| PUT | `/api/v1/builds/:id` | 更新构建 | Path: `id`, Body: `Build` | `{ code, message, data: Build }` |
| DELETE | `/api/v1/builds/:id` | 删除构建 | Path: `id` | `{ code, message, data: { message } }` |
| POST | `/api/v1/builds/:id/trigger` | 触发构建（pending→running） | Path: `id` | `{ code, message, data: Build }` |
| GET | `/api/v1/builds/:id/status` | 获取构建状态 | Path: `id` | `{ code, message, data: { id, status, image, tag, ... } }` |
| POST | `/api/v1/builds/:id/cancel` | 取消构建（running→cancelled） | Path: `id` | `{ code, message, data: Build }` |
| POST | `/api/v1/builds/:id/retry` | 重试构建（基于失败/已取消的构建创建新构建并自动触发） | Path: `id` | `{ code, message, data: Build }` |
| GET | `/api/v1/builds/:id/logs` | 获取构建日志 | Path: `id` | `{ code, message, data: { build_id, status, logs } }` |

### 3.2 构建环境管理

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| GET | `/api/v1/environments` | 环境列表 | Header: `X-Tenant-ID` | `{ code, message, data: BuildEnvironment[] }` |
| POST | `/api/v1/environments` | 创建环境 | Body: `CreateEnvironmentInput` | `{ code, message, data: BuildEnvironment }` |
| GET | `/api/v1/environments/:id` | 获取环境详情 | Path: `id` | `{ code, message, data: BuildEnvironment }` |
| PUT | `/api/v1/environments/:id` | 更新环境 | Path: `id`, Body: `CreateEnvironmentInput` | `{ code, message, data: BuildEnvironment }` |
| DELETE | `/api/v1/environments/:id` | 删除环境（软删除，设置 status='deleted'） | Path: `id` | `{ code, message, data: { message } }` |

### 3.3 制品管理

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| GET | `/api/v1/artifacts` | 制品列表（分页，支持筛选） | Query: `page`(int), `page_size`(int), `run_id`(string), `stage_id`(string), `type`(string) | `{ code, message, data: Artifact[] }` |
| POST | `/api/v1/artifacts` | 创建制品 | Body: `CreateArtifactInput` | `{ code, message, data: Artifact }` |
| GET | `/api/v1/artifacts/:id` | 获取制品详情 | Path: `id` | `{ code, message, data: Artifact }` |
| DELETE | `/api/v1/artifacts/:id` | 删除制品 | Path: `id` | `{ code, message, data: { message } }` |
| POST | `/api/v1/artifacts/:id/download` | 记录制品下载（递增 downloaded_count） | Path: `id` | `{ code, message, data: { message } }` |
| POST | `/api/v1/artifacts/cleanup` | 清理过期制品（expires_at < NOW()） | Header: `X-Tenant-ID` | `{ code, message, data: { cleaned } }` |
| DELETE | `/api/v1/artifacts/run/:runId` | 按运行 ID 清理制品 | Path: `runId` | `{ code, message, data: { cleaned } }` |

### 3.4 系统

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| GET | `/health` | 健康检查（检测 DB + Redis 连接） | 无 | `{ status, service, timestamp, db, redis }` |

### 3.5 统一响应格式

所有业务接口统一使用以下 JSON 结构：

```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

错误时：
```json
{
  "code": 500,
  "message": "internal error"
}
```

### 3.6 状态码

| HTTP 状态码 | 场景 |
|------------|------|
| 200 | 成功 |
| 400 | 请求参数校验失败 |
| 404 | 资源不存在 |
| 409 | 状态转换冲突（如触发非 pending 状态的构建） |
| 500 | 服务内部错误 |
| 503 | 健康检查失败（DB/Redis 不可用） |

---

## 四、数据模型

### 4.1 Build（构建记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK, 自动生成 | 构建唯一标识 |
| `tenant_id` | VARCHAR(36) | NOT NULL | 租户 ID，所有查询强制隔离 |
| `project_id` | VARCHAR(36) | NULLABLE | 关联项目 ID |
| `pipeline_run_id` | VARCHAR(36) | NULLABLE | 关联管道运行 ID |
| `repo_id` | VARCHAR(36) | NULLABLE | 代码仓库 ID |
| `branch` | VARCHAR(255) | NOT NULL | 构建分支名 |
| `commit_sha` | VARCHAR(64) | NOT NULL | 构建 commit SHA |
| `image` | VARCHAR(512) | NULLABLE | 构建产出镜像名称 |
| `tag` | VARCHAR(255) | NULLABLE | 镜像 tag |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | 构建状态：`pending` / `running` / `success` / `failed` / `cancelled` |
| `source_ref` | VARCHAR(255) | NULLABLE | 触发来源引用（如 PR#123） |
| `build_args` | JSONB | DEFAULT '{}' | 构建参数（环境变量、编译选项等） |
| `started_at` | TIMESTAMPTZ | NULLABLE | 构建开始时间 |
| `completed_at` | TIMESTAMPTZ | NULLABLE | 构建完成时间 |
| `duration_ms` | BIGINT | NULLABLE | 构建耗时（毫秒） |
| `error_message` | TEXT | NULLABLE | 错误信息 |
| `logs` | TEXT | NULLABLE | 构建日志内容 |
| `created_at` | TIMESTAMPTZ | NOT NULL, AUTO | 记录创建时间 |

**状态机**：

```
pending ──trigger──→ running ──complete──→ success
                         │                      │
                         ├──cancel──→ cancelled  │
                         │                       │
                         └──fail────→ failed ────┘
                                           │
                              retry ───────┘
                                           │
                                    pending (新记录)
```

### 4.2 BuildEnvironment（构建环境）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK, 自动生成 | 环境唯一标识 |
| `tenant_id` | VARCHAR(36) | NOT NULL | 租户 ID |
| `name` | VARCHAR(255) | NOT NULL | 环境名称（如 "go-1.22", "node-20"） |
| `type` | VARCHAR(50) | NOT NULL | 环境类型（如 "docker", "vm"） |
| `image` | VARCHAR(512) | NOT NULL | 基础镜像（如 "golang:1.22"） |
| `description` | TEXT | NULLABLE | 环境描述 |
| `config` | JSONB | DEFAULT '{}' | 环境配置（资源限制、环境变量等） |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'active' | 状态：`active` / `deleted`（软删除） |
| `created_at` | TIMESTAMPTZ | NOT NULL, AUTO | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL, AUTO | 更新时间 |

### 4.3 Artifact（构建制品）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK, 自动生成 | 制品唯一标识 |
| `tenant_id` | VARCHAR(36) | NOT NULL | 租户 ID |
| `name` | VARCHAR(255) | NOT NULL | 制品名称 |
| `type` | VARCHAR(50) | NOT NULL | 制品类型（如 "image", "binary", "jar", "npm"） |
| `storage_type` | VARCHAR(50) | DEFAULT 'local' | 存储类型（如 "local", "s3", "oss"） |
| `storage_path` | VARCHAR(1024) | NOT NULL | 存储路径 |
| `size_bytes` | BIGINT | DEFAULT 0 | 制品大小（字节） |
| `checksum_sha256` | VARCHAR(64) | NULLABLE | SHA256 校验和 |
| `run_id` | VARCHAR(36) | NOT NULL | 关联的运行 ID |
| `stage_id` | VARCHAR(36) | NULLABLE | 关联的阶段 ID |
| `expires_at` | TIMESTAMPTZ | NULLABLE | 过期时间（过期后可被清理） |
| `downloaded_count` | INTEGER | DEFAULT 0 | 下载次数 |
| `metadata` | JSONB | DEFAULT '{}' | 元数据（构建参数、版本信息等） |
| `created_at` | TIMESTAMPTZ | NOT NULL, AUTO | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL, AUTO | 更新时间 |

### 4.4 BuildStats（构建统计，只读聚合视图）

| 字段 | 类型 | 说明 |
|------|------|------|
| `total` | INTEGER | 构建总数 |
| `success` | INTEGER | 成功构建数 |
| `failed` | INTEGER | 失败构建数 |
| `running` | INTEGER | 运行中构建数 |
| `pending` | INTEGER | 待处理构建数 |
| `avg_duration` | FLOAT | 平均构建耗时（毫秒） |

### 4.5 分页模型

**PaginatedRequest**（查询参数）：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | int | 1 | 页码 |
| `page_size` | int | 20 | 每页条数（最大 100） |

**PaginatedResult**（响应 data 结构）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `data` | T[] | 当前页数据 |
| `total` | int | 总记录数 |
| `page` | int | 当前页码 |
| `limit` | int | 每页条数 |
| `total_pages` | int | 总页数 |

---

## 五、依赖与集成

### 5.1 基础设施依赖

| 组件 | 用途 | 连接方式 |
|------|------|---------|
| **PostgreSQL** | 持久化存储（构建记录、环境、制品） | `sqlx` 连接池，最大 25 连接，空闲 5 连接 |
| **Redis** | JWT 认证缓存、会话管理 | `go-redis` 客户端 |
| **OTel Collector** | 可观测性（链路追踪 + 指标） | gRPC OTel exporter |
| **go-common** | 公共库（auth/middleware/logger/otel/redis） | 内部 module 引用 |

### 5.2 数据库表

- `builds` — 构建记录表
- `build_environments` — 构建环境配置表
- `artifacts` — 构建制品表

服务启动时自动通过 `golang-migrate/migrate` 执行 `file://migrations` 目录下的迁移文件。

### 5.3 服务依赖

| 服务 | 依赖类型 | 说明 |
|------|---------|------|
| **Auth Service** | 强依赖 | JWT 认证 + 权限校验（pipeline:write/delete/execute） |
| **Pipeline Service** | 关联 | 构建记录通过 `pipeline_run_id` 与管道运行关联 |
| **Notification Service** | 可选 | 构建状态变更可触发通知（当前未集成） |

### 5.4 框架与工具

| 工具 | 版本 | 用途 |
|------|------|------|
| Gin | v1.x | HTTP 框架 |
| sqlx | v1.x | PostgreSQL 数据库操作 |
| golang-migrate | v4.x | 数据库迁移 |
| viper | v1.x | 配置管理 |
| go-uber.org/zap | v1.x | 结构化日志 |
| go.opentelemetry.io/otel | v1.x | OpenTelemetry 链路追踪 |

### 5.5 配置项

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|---------|--------|------|
| ServiceName | `SERVICE_NAME` | `orion-build-svc` | 服务名称 |
| Environment | `ENVIRONMENT` | `development` | 运行环境 |
| HTTPAddr | `HTTP_ADDR` | `:8085` | HTTP 监听地址 |
| DatabaseURL | `DATABASE_URL` | `postgres://orion:orion@localhost:5432/orion_build?sslmode=disable` | PostgreSQL 连接串 |
| RedisAddr | `REDIS_ADDR` | `localhost:6379` | Redis 地址 |
| RedisDB | `REDIS_DB` | `0` | Redis 数据库编号 |
| OTelEndpoint | `OTEL_ENDPOINT` | `""` | OTel Collector 端点 |
| JWTSecret | `JWT_SECRET` | **必填** | JWT 签名密钥 |

---

## 六、注意事项

### 6.1 已知问题

1. **模拟构建执行**：`executeBuild` 方法当前为模拟实现（`time.Sleep(500ms)` 后标记为 success），生产环境需对接实际的容器构建器（Kaniko、BuildKit 等）通过 Kubernetes API 执行。
2. **日志存储**：构建日志（`logs` 字段）直接存储在 PostgreSQL 的 TEXT 字段中，大型日志可能影响数据库性能。建议后续引入对象存储（S3/MinIO）或日志流式处理。
3. **重试语义**：当前重试（Retry）的实现是创建一条全新的构建记录并自动触发，而非在原记录上重试。这与某些 CI 系统的"原地重试"行为不同。
4. **环境软删除**：环境删除使用软删除（`status='deleted'`），数据物理保留，但列表接口已过滤 `status != 'deleted'`。
5. **数据归档**：无自动归档策略，历史构建和制品数据会持续积累，建议后续增加 TTL 自动归档机制。

### 6.2 限制条件

- 所有业务查询强制按 `tenant_id` 隔离，禁止跨租户数据访问。
- 分页最大 `page_size` 为 100，防止大查询对数据库造成压力。
- 构建状态转换有严格校验：只有 `pending` 可触发为 `running`，只有 `running` 可取消为 `cancelled`，只有 `failed` 或 `cancelled` 可重试。
- 写操作接口需要 `pipeline:write/delete/execute` 权限，读操作接口只需认证即可。
- 环境配置（`config`）和构建参数（`build_args`）以 JSONB 格式存储，不提供字段级校验。

### 6.3 后续优化方向

- **对接实际构建器**：集成 Kaniko / BuildKit / Docker-in-Docker 实现真实容器镜像构建
- **SSE 日志流**：构建日志实时流式推送到前端（参照 Pipeline SSE 模式）
- **制品存储后端**：支持 S3/MinIO/GCS 等对象存储，当前仅支持 `local` 模式
- **构建队列**：引入消息队列（如 RabbitMQ/Kafka）管理构建任务队列，支持并发控制
- **Webhook 通知**：构建状态变更时通过 Webhook 通知外部系统
- **缓存加速**：基于 commit_sha 的构建缓存，避免重复构建相同代码
