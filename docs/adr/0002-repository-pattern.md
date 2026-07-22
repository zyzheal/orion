# ADR-0002: Repository 模式采用

## Status

**Accepted** — 2026-06-28

## Context

Orion 平台在 M25 持久化迁移前，所有服务使用 `Map()` 内存存储，服务重启后数据丢失。M25 迁移后，30+ 服务从 Map 迁移到 PostgreSQL，但数据访问层代码分散在 service 层中，存在以下问题：

1. **SQL 散落**：每个 service 直接拼接 SQL，无法复用
2. **事务管理不一致**：不同 service 对事务处理方式不同
3. **测试困难**：service 测试需要真实数据库，无法 mock
4. **租户隔离**：tenant_id 过滤逻辑重复出现在每个 SQL 中
5. **迁移成本**：更换数据库需要修改大量 service 代码

## Decision

采用 **Repository 模式**作为数据访问层的统一抽象，所有 Go 微服务和迁移后的 TS 服务遵循以下规范：

### 核心原则

1. **接口定义在服务层**：`RepositoryInterface` 定义在 `service/service.go` 中，而非 repository 包中
2. **具体实现在 repository 层**：`repository/repository.go` 实现接口，包含 SQL 逻辑
3. **Service 通过接口依赖**：Service 构造函数接收 `RepositoryInterface`，不依赖具体实现
4. **tenant_id 必须过滤**：所有查询必须包含 `WHERE tenant_id = $1`

### 目录结构

```
internal/<module>/
├── handler/        # HTTP 处理器 (Gin)
├── models/         # 数据模型
├── repository/     # 数据访问层 (接口实现)
│   └── repository.go
└── service/        # 业务逻辑层 (接口定义 + 实现)
    └── service.go  # 包含 RepositoryInterface 定义
```

### RepositoryInterface 定义规范

```go
// service/service.go
type RepositoryInterface interface {
    Create(ctx context.Context, tenantID string, item *models.Item) (*models.Item, error)
    Delete(ctx context.Context, tenantID, id string) (bool, error)
    GetByID(ctx context.Context, tenantID, id string) (*models.Item, error)
    List(ctx context.Context, tenantID string, opt models.ListOptions) ([]models.Item, int, error)
    Update(ctx context.Context, tenantID, id string, item *models.Item) (*models.Item, error)
}
```

### Repository 实现规范

```go
// repository/repository.go
type Repository struct {
    db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
    return &Repository{db: db}
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Item, error) {
    var item models.Item
    err := r.db.GetContext(ctx, &item,
        `SELECT * FROM items WHERE id = $1 AND tenant_id = $2`, id, tenantID)
    if err == sql.ErrNoRows {
        return nil, ErrNotFound
    }
    return &item, err
}
```

### 依赖注入

```go
// main 或 handler 初始化
repo := repository.NewRepository(db)
service := service.NewService(repo)
```

### 测试

Service 测试通过 mock RepositoryInterface 实现：

```go
type mockRepository struct{}

func (m *mockRepository) GetByID(ctx context.Context, tenantID, id string) (*models.Item, error) {
    // mock 实现
}
```

## Consequences

### 正面
- **可测试性**：Service 可独立于数据库测试，通过 mock RepositoryInterface
- **代码复用**：SQL 逻辑集中在 repository 层，复用性强
- **数据库无关**：更换数据库只需修改 repository 实现
- **租户隔离**：tenant_id 过滤在 repository 层统一处理，避免遗漏
- **依赖倒置**：Service 依赖抽象，不依赖具体数据库驱动

### 负面
- **接口定义成本高**：每个 module 需要定义和实现接口
- **多一层抽象**：代码量增加，学习曲线上升
- **性能开销**：接口调用有轻微性能损耗（可忽略）

### 执行状态

- **Go 微服务**：528 个 Go 文件，93 个模块已完成 Repository 模式迁移
- **TS 服务**：30+ 服务从 Map 迁移到 PostgreSQL Repository
- **测试覆盖**：288 包测试通过，0 FAIL

## 相关 ADR

- ADR-0003: 事件驱动架构 — Repository 模式与事件发布的集成
- ADR-0004: 多租户隔离 — tenant_id 过滤在 Repository 层统一处理
