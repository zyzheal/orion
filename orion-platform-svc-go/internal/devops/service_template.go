// Plan 09 — 数据库 DevOps 框架 (Service Template)
//
// 标准 Service 层模板:
//   - 所有方法接收 context.Context 第一参数
//   - 使用 RepositoryInterface 注入依赖 (便于测试)
//   - 统一错误处理
//   - 支持事务操作
package devops

import (
	"context"
	"database/sql"
	"fmt"
)

// ServiceBase 通用 Service 基类
type ServiceBase struct {
	repo interface{} // 具体模块的 Repository
	db   *sql.DB
}

func NewServiceBase(repo interface{}, db *sql.DB) *ServiceBase {
	return &ServiceBase{repo: repo, db: db}
}

// ============================================================
// 标准 Service Interface 模式
// ============================================================

// BaseServiceInterface 所有 Service 必须实现的接口
type BaseServiceInterface interface {
	Create(ctx context.Context, tenantID string, req *CreateRequest) (interface{}, error)
	Get(ctx context.Context, tenantID, id string) (interface{}, error)
	List(ctx context.Context, req *ListRequest) (*ListResponse, error)
	Update(ctx context.Context, tenantID, id string, req *UpdateRequest) (interface{}, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
}

// ============================================================
// 事务辅助方法
// ============================================================

// TransactionFn 事务函数类型
type TransactionFn func(tx *sql.Tx) error

// WithTransaction 在事务中执行操作
func (s *ServiceBase) WithTransaction(ctx context.Context, fn TransactionFn) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		}
	}()

	if err := fn(tx); err != nil {
		if rbErr := tx.Rollback(); rbErr != nil {
			return fmt.Errorf("tx error: %w, rollback error: %v", err, rbErr)
		}
		return err
	}

	return tx.Commit()
}

// ============================================================
// 验证辅助方法
// ============================================================

// ValidateCreateRequest 验证创建请求
func ValidateCreateRequest(req *CreateRequest) error {
	if req == nil {
		return fmt.Errorf("request cannot be nil")
	}
	if req.TenantID == "" {
		return fmt.Errorf("tenant_id is required")
	}
	if req.Name == "" {
		return fmt.Errorf("name is required")
	}
	if len(req.Name) > 128 {
		return fmt.Errorf("name must not exceed 128 characters")
	}
	return nil
}

// ValidateListRequest 验证列表请求并设置默认值
func ValidateListRequest(req *ListRequest) *ListRequest {
	if req == nil {
		req = &ListRequest{}
	}
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 {
		req.PageSize = 20
	}
	if req.PageSize > 100 {
		req.PageSize = 100
	}
	if req.SortBy == "" {
		req.SortBy = "created_at"
	}
	if !req.SortAsc {
		req.SortAsc = false // default DESC for created_at
	}
	return req
}
