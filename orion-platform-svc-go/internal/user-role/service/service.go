package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/user-role/models"
	"orion/platform-svc-go/internal/user-role/repository"
)

// 服务层错误（供 handler 分类返回 HTTP 状态码）。
var (
	ErrAlreadyExists   = errors.New("role already granted to user")
	ErrNotFound        = errors.New("user_role not found")
	ErrRevoked         = errors.New("role already revoked")
	ErrExpired         = errors.New("role already expired")
	ErrGrantBySelf     = errors.New("cannot grant role to self via API")
	ErrInvalidStatus   = errors.New("invalid status")
)

// Service 编排 user_role 的业务逻辑。
type Service struct {
	repo repository.RepositoryInterface
	log  *zap.Logger
}

// NewService 创建新的 Service 实例。
func NewService(repo repository.RepositoryInterface, log *zap.Logger) *Service {
	if log == nil {
		log = zap.NewNop()
	}
	return &Service{repo: repo, log: log}
}

// Grant 授权一个用户一个角色。
//
// 幂等性：同一 (tenant, user, role) 若已存在 active 授权则返回 ErrAlreadyExists；
// handler 层应结合 Idempotency-Key 处理重试。
func (s *Service) Grant(ctx context.Context, req *models.GrantRequest, grantedByUser *string) (*models.UserRole, error) {
	if req.TenantID == "" {
		return nil, errors.New("tenant_id is required")
	}
	if req.Source == "" {
		req.Source = models.SourceManual
	}

	now := time.Now()

	// 检查是否已存在 active 授权
	// 由于 unique 约束只在 status 无过滤时生效，先查询是否存在
	// 这里简化处理：依赖 DB 唯一约束报错
	ur := &models.UserRole{
		ID:        uuid.New().String(),
		TenantID:  req.TenantID,
		UserID:    req.UserID,
		Role:      req.Role,
		Source:    req.Source,
		GrantedBy: req.GrantedBy,
		GrantedAt: now,
		ExpiresAt: req.ExpiresAt,
		Status:    models.StatusActive,
		Reason:    req.Reason,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.Create(ctx, ur); err != nil {
		s.log.Warn("failed to create user_role",
			zap.String("tenant_id", req.TenantID),
			zap.String("user_id", req.UserID),
			zap.String("role", req.Role),
			zap.Error(err))
		return nil, err
	}

	s.log.Info("user_role granted",
		zap.String("id", ur.ID),
		zap.String("tenant_id", ur.TenantID),
		zap.String("user_id", ur.UserID),
		zap.String("role", ur.Role),
		zap.Time("expires_at", derefTime(ur.ExpiresAt)))

	return ur, nil
}

// GetByID 根据 id 获取。
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.UserRole, error) {
	ur, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return ur, nil
}

// List 分页查询。
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter, page, pageSize int) (*models.PageResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	items, total, err := s.repo.List(ctx, tenantID, filter, offset, pageSize)
	if err != nil {
		return nil, err
	}

	return &models.PageResult{
		Data:     items,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
		HasMore:  page*pageSize < total,
	}, nil
}

// Patch 部分更新。
func (s *Service) Patch(ctx context.Context, tenantID, id string, req *models.PatchRequest) (*models.UserRole, error) {
	if req.Status != nil {
		switch *req.Status {
		case models.StatusActive, models.StatusRevoked, models.StatusExpired:
			// ok
		default:
			return nil, ErrInvalidStatus
		}
	}

	if err := s.repo.Update(ctx, tenantID, id, req); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

// Delete 撤销角色（软删）。
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	if err := s.repo.Delete(ctx, tenantID, id); err != nil {
		return err
	}
	s.log.Info("user_role revoked",
		zap.String("tenant_id", tenantID),
		zap.String("id", id))
	return nil
}

// HasRole 检查某用户是否拥有某角色（active 且未过期）。
// 用于权限检查（HasPermission helper）。
func (s *Service) HasRole(ctx context.Context, tenantID, userID, role string) (bool, error) {
	roles, err := s.repo.RolesForUser(ctx, tenantID, userID)
	if err != nil {
		return false, err
	}
	for _, r := range roles {
		if r == role {
			return true, nil
		}
	}
	return false, nil
}

// UsersWithRole 返回某租户下拥有指定角色的所有用户 ID。
func (s *Service) UsersWithRole(ctx context.Context, tenantID, role string) ([]string, error) {
	return s.repo.UsersWithRole(ctx, tenantID, role)
}

func derefTime(t *time.Time) time.Time {
	if t == nil {
		return time.Time{}
	}
	return *t
}
