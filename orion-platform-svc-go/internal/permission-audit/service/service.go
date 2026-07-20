package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/permission-audit/models"
	"orion/platform-svc-go/internal/permission-audit/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, log *models.PermissionAuditLog) error
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.PermissionAuditLog, error)
	List(ctx context.Context, tenantID string, filter *models.AuditLogFilter) ([]models.PermissionAuditLog, int, error)
}

var (
	ErrNotFound   = repository.ErrNotFound
	ErrBadRequest = errors.New("bad request")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) LogPermission(ctx context.Context, tenantID string, req *models.CreateAuditLogRequest, ipAddr, userAgent string) (*models.PermissionAuditLog, error) {
	if req == nil || req.UserID == "" || req.Action == "" || req.Resource == "" || req.Permission == "" {
		return nil, ErrBadRequest
	}
	if req.Result == "" {
		req.Result = "allowed"
	}
	if req.Result != "allowed" && req.Result != "denied" {
		return nil, ErrBadRequest
	}

	log := &models.PermissionAuditLog{
		TenantID:   tenantID,
		UserID:     req.UserID,
		Action:     req.Action,
		Resource:   req.Resource,
		Permission: req.Permission,
		Result:     req.Result,
		IPAddress:  ipAddr,
		UserAgent:  userAgent,
		Context:    req.Context,
	}

	if err := s.repo.Create(ctx, log); err != nil {
		return nil, err
	}
	return log, nil
}

func (s *Service) GetAuditLog(ctx context.Context, tenantID, id string) (*models.PermissionAuditLog, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) ListAuditLogs(ctx context.Context, tenantID string, filter *models.AuditLogFilter) ([]models.PermissionAuditLog, int, error) {
	if filter == nil {
		filter = &models.AuditLogFilter{Limit: 20}
	}
	return s.repo.List(ctx, tenantID, filter)
}

func (s *Service) DeleteAuditLog(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}
