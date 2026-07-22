# 模块间接口契约 (Phase 0.8)

## 1. 模块层架构

每个内部模块遵循统一的三层架构，层间通过构造函数注入依赖：

```
handler → service → repository → database.DB
         ↑              ↑
    gin.Router     sqlx.DB
```

## 2. 标准模块接口

### 2.1 Repository 层

所有 repository 实现统一构造函数签名：

```go
type Repository struct { db *sql.DB }
func NewRepository(db *sql.DB) *Repository
```

Repository 继承 `database.BaseRepository` 提供通用 CRUD 操作：
- `Exists(ctx, table, tenantID, where, args...) (bool, error)`
- `Count(ctx, table, tenantID, where, args...) (int, error)`
- `SoftDelete(ctx, table, tenantID, id) error`
- `UpdateStatus(ctx, table, tenantID, id, status) error`
- `FindOne(ctx, table, tenantID, id, dest) error`
- `FindList(ctx, table, tenantID, where, dest, args...) error`
- `Tx(ctx, fn func(tx *sqlx.Tx) error) error`

### 2.2 Service 层

所有 service 实现统一构造函数签名：

```go
type Service struct { repo *Repository }
func NewService(repo *Repository) *Service
```

Service 方法签名约定：
- `ctx context.Context` 始终为第一个参数（用于取消和追踪）
- `tenantID string` 为租户隔离参数
- 返回 `(*Entity, error)` 或 `([]Entity, error)`

### 2.3 Handler 层

所有 handler 实现统一构造函数和路由注册：

```go
type Handler struct { svc *Service }
func NewHandler(svc *Service) *Handler
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup)
```

响应通过 `response_writer.go` 统一格式：
- `respondSuccess(c, data)`
- `respondCreated(c, data)`
- `respondNotFound(c, message)`
- `respondBadRequest(c, message)`
- `respondInternalError(c, message)`

## 3. 注册约定

在 `main.go` 中按以下模式注册（已在所有模块中应用）：

```go
// 1. 创建 Repository
moduleRepo := module_repo.NewRepository(db.DB)
// 2. 创建 Service
moduleSvc := module_service.NewService(moduleRepo)
// 3. 创建 Handler
moduleH := module_handler.NewHandler(moduleSvc)
// 4. 注册路由
moduleH.RegisterRoutes(rg)
```

## 4. 跨模块隔离规则

- 模块 A 的 repository/service/handler **不得** import 模块 B 的任何代码
- 跨模块交互必须通过共享层：`go-common/pkg/`（database, redis, auth, otel 等）
- 跨模块数据访问通过数据库直接查询（SQL JOIN），不通过代码依赖
- 违规检测：CI 脚本 `scripts/check-cross-module-imports.sh`

## 5. 零耦合验证

当前 51 个内部模块 **零跨模块 import**，已通过验证。
