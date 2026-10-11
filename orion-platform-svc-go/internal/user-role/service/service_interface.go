package service

import (
	"context"

	"orion/platform-svc-go/internal/user-role/models"
)

// ServiceInterface 定义 user_role 服务层契约，供 handler 层 mock 测试。
type ServiceInterface interface {
	Grant(ctx context.Context, req *models.GrantRequest, grantedByUser *string) (*models.UserRole, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.UserRole, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, page, pageSize int) (*models.PageResult, error)
	Patch(ctx context.Context, tenantID, id string, req *models.PatchRequest) (*models.UserRole, error)
	Delete(ctx context.Context, tenantID, id string) error
	HasRole(ctx context.Context, tenantID, userID, role string) (bool, error)
	UsersWithRole(ctx context.Context, tenantID, role string) ([]string, error)
}
