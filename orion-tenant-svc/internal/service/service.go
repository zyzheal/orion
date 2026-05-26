package service

import (
	"context"
	"errors"

	"orion/tenant-svc/internal/models"
	"orion/tenant-svc/internal/repository"
)

var (
	ErrTenantNotFound   = errors.New("tenant not found")
	ErrTenantExists     = errors.New("tenant name already exists")
	ErrInvalidStatus    = errors.New("invalid tenant status")
)

// TenantService handles tenant business logic.
type TenantService struct {
	repo *repository.TenantRepository
}

func NewTenantService(repo *repository.TenantRepository) *TenantService {
	return &TenantService{repo: repo}
}

func (s *TenantService) Create(ctx context.Context, req models.CreateTenantRequest) (*models.Tenant, error) {
	// Check for duplicate name
	if _, err := s.repo.GetByName(ctx, req.Name); err == nil {
		return nil, ErrTenantExists
	}

	id := generateUUID()
	tenant := &models.Tenant{
		ID:             id,
		Name:           req.Name,
		DisplayName:    req.DisplayName,
		Status:         "active",
		QuotaUsers:     req.QuotaUsers,
		QuotaStorageMB: req.QuotaStorageMB,
	}

	if tenant.DisplayName == "" {
		tenant.DisplayName = tenant.Name
	}
	if tenant.QuotaUsers <= 0 {
		tenant.QuotaUsers = 100
	}
	if tenant.QuotaStorageMB <= 0 {
		tenant.QuotaStorageMB = 1024
	}

	if err := s.repo.Create(ctx, tenant); err != nil {
		return nil, err
	}

	return tenant, nil
}

func (s *TenantService) GetByID(ctx context.Context, id string) (*models.Tenant, error) {
	tenant, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, ErrTenantNotFound
	}
	return tenant, nil
}

func (s *TenantService) List(ctx context.Context, page, pageSize int) ([]models.Tenant, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize
	return s.repo.List(ctx, offset, pageSize)
}

func (s *TenantService) Update(ctx context.Context, id string, req models.UpdateTenantRequest) error {
	tenant, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return ErrTenantNotFound
	}

	if req.DisplayName != "" {
		tenant.DisplayName = req.DisplayName
	}
	if req.Status != "" {
		tenant.Status = req.Status
	}

	return s.repo.Update(ctx, tenant)
}

func (s *TenantService) UpdateStatus(ctx context.Context, id, status string) error {
	validStatuses := map[string]bool{
		"active":    true,
		"suspended": true,
		"deleted":   true,
	}
	if !validStatuses[status] {
		return ErrInvalidStatus
	}

	exists, err := s.repo.Exists(ctx, id)
	if err != nil || !exists {
		return ErrTenantNotFound
	}

	return s.repo.UpdateStatus(ctx, id, status)
}

func (s *TenantService) Delete(ctx context.Context, id string) error {
	exists, err := s.repo.Exists(ctx, id)
	if err != nil || !exists {
		return ErrTenantNotFound
	}

	return s.repo.SoftDelete(ctx, id)
}

func (s *TenantService) UpdateSettings(ctx context.Context, id, displayName string) error {
	exists, err := s.repo.Exists(ctx, id)
	if err != nil || !exists {
		return ErrTenantNotFound
	}

	return s.repo.UpdateSettings(ctx, id, displayName)
}

func generateUUID() string {
	return "00000000-0000-0000-0000-000000000000"
}
