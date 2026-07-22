# Go 微服务迁移规范 (2026-07-11)

> 所有并行 Agent 必须严格遵守此规范，确保代码风格一致。

---

## 一、Go 服务标准架构（3 层模式）

```
internal/
├── handler/          # HTTP 处理层（路由注册 + 请求解析 + 响应封装）
├── service/          # 业务逻辑层（纯业务，无 HTTP 依赖）
├── repository/       # 数据访问层（PostgreSQL CRUD）
├── models/           # 数据模型（struct + JSON tag）
├── config/           # 配置（可选）
```

### 1.1 Handler 层规范

```go
// internal/handler/ticket_handler.go
package handler

import (
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"
    svc "orion/ticket-svc-go/internal/service"
)

type Handler struct {
    svc *svc.TicketService
}

func New(s *svc.TicketService) *Handler {
    return &Handler{svc: s}
}

// RegisterRoutes 注册所有路由
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
    r.GET("/tickets", h.ListTickets)
    r.GET("/tickets/:id", h.GetTicket)
    r.POST("/tickets", h.CreateTicket)
    r.PUT("/tickets/:id", h.UpdateTicket)
    r.DELETE("/tickets/:id", h.DeleteTicket)
    // ... 更多路由
}

// ListTickets 列表查询
func (h *Handler) ListTickets(c *gin.Context) {
    // 1. 解析查询参数
    tenantID := c.GetHeader("X-Tenant-ID")
    page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
    pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

    // 2. 调用 service
    tickets, total, err := h.svc.List(c.Request.Context(), tenantID, page, pageSize)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    // 3. 标准响应格式
    c.JSON(http.StatusOK, gin.H{
        "data":  tickets,
        "total": total,
        "page":  page,
    })
}
```

### 1.2 Service 层规范

```go
// internal/service/ticket_service.go
package service

import (
    "context"
    "errors"
    "time"

    repo "orion/ticket-svc-go/internal/repository"
    "orion/ticket-svc-go/internal/models"
)

type TicketService struct {
    repo *repo.TicketRepository
}

func NewTicketService(r *repo.TicketRepository) *TicketService {
    return &TicketService{repo: r}
}

// List 查询工单列表
func (s *TicketService) List(ctx context.Context, tenantID string, page, pageSize int) ([]models.Ticket, int64, error) {
    if page < 1 {
        page = 1
    }
    if pageSize < 1 || pageSize > 100 {
        pageSize = 20
    }

    tickets, total, err := s.repo.ListByTenant(ctx, tenantID, (page-1)*pageSize, pageSize)
    if err != nil {
        return nil, 0, err
    }
    return tickets, total, nil
}

// Create 创建工单
func (s *TicketService) Create(ctx context.Context, tenantID string, input models.TicketInput) (*models.Ticket, error) {
    if input.Title == "" {
        return nil, errors.New("title is required")
    }
    if len(input.Title) > 200 {
        return nil, errors.New("title must not exceed 200 characters")
    }

    ticket := models.Ticket{
        ID:        generateUUID(),
        TenantID:  tenantID,
        Title:     input.Title,
        Status:    "open",
        CreatedAt: time.Now(),
        UpdatedAt: time.Now(),
    }

    err := s.repo.Create(ctx, &ticket)
    if err != nil {
        return nil, err
    }
    return &ticket, nil
}
```

### 1.3 Repository 层规范

```go
// internal/repository/ticket_repository.go
package repository

import (
    "context"
    "database/sql"

    "orion/ticket-svc-go/internal/models"
    "github.com/jackc/pgx/v5"
)

type TicketRepository struct {
    db *pgx.Conn
}

func NewTicketRepository(db *pgx.Conn) *TicketRepository {
    return &TicketRepository{db: db}
}

// ListByTenant 按租户查询工单
func (r *TicketRepository) ListByTenant(ctx context.Context, tenantID string, offset, limit int) ([]models.Ticket, int64, error) {
    // 1. 先查总数
    countQuery := "SELECT COUNT(*) FROM tickets WHERE tenant_id = $1"
    var total int64
    err := r.db.QueryRow(ctx, countQuery, tenantID).Scan(&total)
    if err != nil {
        return nil, 0, err
    }

    // 2. 查询列表
    listQuery := `
        SELECT id, tenant_id, title, description, status, priority, 
               assignee_id, created_at, updated_at
        FROM tickets 
        WHERE tenant_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
    `
    rows, err := r.db.Query(ctx, listQuery, tenantID, limit, offset)
    if err != nil {
        return nil, total, err
    }
    defer rows.Close()

    var tickets []models.Ticket
    for rows.Next() {
        var t models.Ticket
        err := rows.Scan(&t.ID, &t.TenantID, &t.Title, &t.Description, 
                         &t.Status, &t.Priority, &t.AssigneeID, 
                         &t.CreatedAt, &t.UpdatedAt)
        if err != nil {
            return nil, total, err
        }
        tickets = append(tickets, t)
    }

    return tickets, total, nil
}
```

---

## 二、迁移执行流程

### Step 1: 端点对齐分析

```bash
# 提取 Node.js 端点
grep -oE "app\.(get|post|put|patch|delete)\(['\"]([^'\"]+)['\"]" \
  orion-platform-service/src/api/{service}-routes.ts | \
  sed "s/app\.\(get|post|put|patch|delete\)(['\"]//;s/['\"])//" | sort -u

# 提取 Go 端点
for f in $(find orion-{service}-svc-go/internal -name "*.go"); do
  grep -oE "\.(GET|POST|PUT|PATCH|DELETE)\(['\"]([^'\"]+)['\"]" "$f" | \
    sed "s/\.\\(GET|POST|PUT|PATCH|DELETE\\)(['\"]//;s/['\"])//"
done | sort -u
```

### Step 2: 业务逻辑迁移

1. 阅读 Node.js 对应 service 文件：
   - `orion-platform-service/src/services/{service}/` 目录
   - 重点关注业务逻辑、参数校验、数据转换

2. 阅读 Node.js Repository 文件：
   - `orion-platform-service/src/repositories/{Service}Repository.ts`
   - 提取 SQL 查询逻辑

3. 实现 Go 三层架构：
   - 先写 models/（struct 定义）
   - 再写 repository/（PostgreSQL CRUD）
   - 再写 service/（业务逻辑）
   - 最后写 handler/（HTTP 路由）

### Step 3: 数据库迁移

- 检查 `orion-platform-service/db/migrations/` 目录中的 SQL 文件
- 将相关表的 DDL 迁移到 Go 服务的 `migrations/` 目录
- 使用 golang-migrate 格式：`001_create_{table}_table.up.sql`

### Step 4: 构建验证

```bash
cd orion-{service}-svc-go
go build -o /dev/null ./cmd/server/
```

### Step 5: 路由注册验证

确保所有新增路由都在 `main.go` 中正确注册：

```go
rg := r.Group("/api/v1")
rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: jwtSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

ticketHandler.RegisterRoutes(rg)
dispatchHandler.RegisterRoutes(rg)
slaHandler.RegisterRoutes(rg)
// ... 所有 handler 都要注册
```

---

## 三、Node.js → Go 映射参考

### 3.1 数据类型映射

| Node.js | Go |
|---------|-----|
| `string` | `string` |
| `number` | `int` / `float64` |
| `boolean` | `bool` |
| `Date` | `time.Time` |
| `Array<T>` | `[]T` |
| `Record<string, T>` | `map[string]T` |
| `Optional<T>` | `*T` (指针) |
| `null` | `nil` |
| `undefined` | 零值 |

### 3.2 错误处理映射

| Node.js | Go |
|---------|-----|
| `throw new Error("msg")` | `return nil, errors.New("msg")` |
| `try { } catch(e) { }` | `if err != nil { }` |
| `if (!value) throw ...` | `if value == "" { return nil, errors.New(...) }` |

### 3.3 数据库查询映射

| Node.js (TypeORM) | Go (pgx) |
|------------------|-----------|
| `repository.find({ where: { tenant_id } })` | `r.db.Query(ctx, query, tenantID)` |
| `repository.create(entity)` | `r.db.Exec(ctx, insertSQL, ...)` |
| `repository.save(entity)` | `r.db.Exec(ctx, upsertSQL, ...)` |
| `repository.delete(id)` | `r.db.Exec(ctx, deleteSQL, id)` |
| `repository.count()` | `r.db.QueryRow(ctx, countSQL).Scan(&count)` |

### 3.4 HTTP 响应格式

```go
// 成功响应
c.JSON(http.StatusOK, gin.H{
    "data": result,
    "total": total,
    "page":  page,
})

// 错误响应
c.JSON(http.StatusBadRequest, gin.H{
    "error": "invalid parameter",
    "code":  "VALIDATION_ERROR",
})

// 404
c.JSON(http.StatusNotFound, gin.H{
    "error": "not found",
})
```

---

## 四、禁止事项

1. **禁止直接翻译 TypeScript 代码** — 要按 Go 惯用法重写
2. **禁止使用 GORM** — 统一使用 `pgx` + 手写 SQL
3. **禁止在 handler 层写业务逻辑** — 业务逻辑必须在 service 层
4. **禁止跳过参数校验** — 所有输入参数必须校验
5. **禁止缺少 tenant_id 过滤** — 所有查询必须带租户过滤
6. **禁止使用 `fmt.Sprintf` 拼接 SQL** — 使用参数化查询防注入

---

## 五、当前分支状态

- **当前分支**: `fix/p0-route-auth-and-error-envelope`
- **迁移目标**: 将 Node.js 业务逻辑迁移到 Go 微服务
- **验证方式**: `go build -o /dev/null ./cmd/server/` 通过 + 路由注册完整
