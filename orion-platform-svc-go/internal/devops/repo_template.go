// Plan 09 — 数据库 DevOps 框架 (Repository Template)
//
// 用法:
//   1. 复制本文件到目标模块 (e.g. internal/xxx/repository/base_repo.go)
//   2. 修改 T 为具体模型类型
//   3. 修改 TableName() 为实际表名
//   4. 删除此注释头
package devops

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// BaseRepository 泛型仓储基类
type BaseRepository[T any] struct {
	db       *sql.DB
	schema   string
	tenantID string
}

func NewBaseRepository[T any](db *sql.DB, schema, tenantID string) BaseRepository[T] {
	return BaseRepository[T]{db: db, schema: schema, tenantID: tenantID}
}

func (r *BaseRepository[T]) DB() *sql.DB       { return r.db }
func (r *BaseRepository[T]) Schema() string     { return r.schema }
func (r *BaseRepository[T]) TenantID() string   { return r.tenantID }

// ---- 标准请求/响应结构 ----

type CreateRequest struct {
	TenantID    string                 `json:"tenant_id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Meta        map[string]interface{} `json:"meta,omitempty"`
}

type UpdateRequest struct {
	Name        *string                `json:"name,omitempty"`
	Description *string                `json:"description,omitempty"`
	Meta        map[string]interface{} `json:"meta,omitempty"`
}

type ListRequest struct {
	Page     int    `json:"page" form:"page"`
	PageSize int    `json:"page_size" form:"page_size"`
	SortBy   string `json:"sort_by" form:"sort_by"`
	SortAsc  bool   `json:"sort_asc" form:"sort_asc"`
	Search   string `json:"search" form:"search"`
	TenantID string `json:"tenant_id"`
}

type ListResponse struct {
	Items   []interface{} `json:"items"`
	Total   int           `json:"total"`
	Page    int           `json:"page"`
	PageSize int          `json:"page_size"`
	HasMore bool          `json:"hasMore"`
}

type SoftDeleteRequest struct {
	ID       string `json:"id"`
	TenantID string `json:"tenant_id"`
}

// ---- 迁移结构 ----

type MigrationStep struct {
	ID          string     `json:"id"`
	Version     string     `json:"version"`
	Description string     `json:"description"`
	SQL         string     `json:"sql"`
	Rollback    string     `json:"rollback,omitempty"`
	AppliedAt   *time.Time `json:"appliedAt,omitempty"`
	Status      string     `json:"status"`
}

type MigrationPlan struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Steps       []MigrationStep `json:"steps"`
	StartedAt   *time.Time      `json:"startedAt,omitempty"`
	CompletedAt *time.Time      `json:"completedAt,omitempty"`
	Status      string          `json:"status"`
}

// BuildQuery 构建带租户隔离的 WHERE 子句
func (r *BaseRepository[T]) BuildQuery(table string, req ListRequest) (string, []interface{}) {
	query := fmt.Sprintf("SELECT * FROM %s.%s WHERE tenant_id = $1", r.schema, table)
	args := []interface{}{r.tenantID}
	if req.TenantID != "" {
		query += " AND tenant_id = $2"
		args = append(args, req.TenantID)
	}
	if req.Search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", len(args)+1, len(args)+2)
		searchPattern := "%" + req.Search + "%"
		args = append(args, searchPattern, searchPattern)
	}
	if req.SortBy != "" {
		allowed := map[string]bool{"id": true, "name": true, "created_at": true, "updated_at": true}
		if allowed[req.SortBy] {
			dir := "ASC"
			if !req.SortAsc {
				dir = "DESC"
			}
			query += fmt.Sprintf(" ORDER BY %s %s", req.SortBy, dir)
		}
	}
	if req.PageSize > 0 {
		offset := (req.Page - 1) * req.PageSize
		query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2)
		args = append(args, req.PageSize, offset)
	}
	_ = context.Background() // suppress unused import
	return query, args
}
