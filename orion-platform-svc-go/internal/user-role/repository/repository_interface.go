package repository

import (
	"context"

	"orion/platform-svc-go/internal/user-role/models"
)

// RepositoryInterface 定义 user_role 数据访问契约。
type RepositoryInterface interface {
	Create(ctx context.Context, ur *models.UserRole) error
	GetByID(ctx context.Context, tenantID, id string) (*models.UserRole, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.UserRole, int, error)
	Update(ctx context.Context, tenantID, id string, req *models.PatchRequest) error
	Delete(ctx context.Context, tenantID, id string) error
	RolesForUser(ctx context.Context, tenantID, userID string) ([]string, error)
	UsersWithRole(ctx context.Context, tenantID, role string) ([]string, error)
}

// 编译期检查：确保 Repository 实现 RepositoryInterface。
var _ RepositoryInterface = (*Repository)(nil)
