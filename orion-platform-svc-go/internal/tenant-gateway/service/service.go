package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/tenant-gateway/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenant *models.Tenant) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Tenant, error)
	GetByName(ctx context.Context, tenantID, name string) (*models.Tenant, error)
	List(ctx context.Context, tenantID string, q models.ListQuery) (*models.TenantListResponse, error)
	SoftDelete(ctx context.Context, tenantID, id string) error
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	// Quota methods.
	GetQuota(ctx context.Context, tenantID, tenantKey string) (*models.TenantQuota, error)
	CreateQuota(ctx context.Context, tenantID, tenantKey string, quota *models.TenantQuota) error
	UpdateQuota(ctx context.Context, tenantID, tenantKey string, updates map[string]interface{}) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func defaultTier(req models.CreateTenantRequest) models.TenantTier {
	tier := req.Tier
	if tier == "" {
		tier = models.TierStandard
	}
	return tier
}

// --- CRUD ---

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateTenantRequest) (*models.Tenant, error) {
	// Check name uniqueness.
	if _, err := s.repo.GetByName(ctx, tenantID, req.Name); err == nil {
		return nil, ErrAlreadyExists(req.Name)
	} else if err != sql.ErrNoRows {
		return nil, fmt.Errorf("tenant-gateway create name check: %w", err)
	}

	now := time.Now().Unix()
	dispName := req.DisplayName
	if dispName == "" {
		dispName = req.Name
	}
	tenant := &models.Tenant{
		Name:            req.Name,
		DisplayName:     dispName,
		TenantTier:      defaultTier(req),
		Status:          models.StatusActive,
		NamespacePoolID: defaultNamespacePool(),
		OwnerEmail:      req.OwnerEmail,
		BusinessUnit:    req.BusinessUnit,
		CostCenter:      req.CostCenter,
		TenantID:        tenantID,
		CreatedAt:       &now,
		UpdatedAt:       &now,
		ExpiresAt:       req.ExpiresAt,
	}
	if err := s.repo.Create(ctx, tenant); err != nil {
		return nil, err
	}
	// Initialize default quota for the tenant.
	_ = s.initQuota(ctx, tenantID, tenant.ID, tenant.TenantTier)
	return tenant, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Tenant, error) {
	t, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFoundTenant(id)
		}
		return nil, err
	}
	if t.Status == models.StatusDeleted {
		return nil, ErrNotFoundTenant(id)
	}
	return t, nil
}

func (s *Service) List(ctx context.Context, tenantID string, q models.ListQuery) (*models.TenantListResponse, error) {
	return s.repo.List(ctx, tenantID, q)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateTenantRequest) (*models.Tenant, error) {
	existing, err := s.Get(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	updates := make(map[string]interface{})
	if req.Name != nil && *req.Name != existing.Name {
		if _, err := s.repo.GetByName(ctx, tenantID, *req.Name); err == nil {
			return nil, ErrAlreadyExists(*req.Name)
		}
		updates["name"] = *req.Name
	}
	if req.DisplayName != nil {
		updates["display_name"] = *req.DisplayName
	}
	if req.Tier != nil {
		updates["tier"] = string(*req.Tier)
		_ = s.initQuota(ctx, tenantID, id, *req.Tier) // refresh quota
	}
	if req.Status != nil && *req.Status != existing.Status {
		updates["status"] = string(*req.Status)
	}
	if req.OwnerEmail != nil {
		updates["owner_email"] = *req.OwnerEmail
	}
	if req.BusinessUnit != nil {
		updates["business_unit"] = *req.BusinessUnit
	}
	if req.CostCenter != nil {
		updates["cost_center"] = *req.CostCenter
	}
	if req.ExpiresAt != nil {
		updates["expires_at"] = *req.ExpiresAt
	}
	if len(updates) == 0 {
		return existing, nil
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.Get(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	if _, err := s.Get(ctx, tenantID, id); err != nil {
		return err
	}
	return s.repo.SoftDelete(ctx, tenantID, id)
}

// --- Lifecycle ---

func (s *Service) Suspend(ctx context.Context, tenantID, id string) (*models.Tenant, error) {
	req := models.UpdateTenantRequest{Status: ptr(models.StatusSuspended)}
	return s.Update(ctx, tenantID, id, req)
}

func (s *Service) Activate(ctx context.Context, tenantID, id string) (*models.Tenant, error) {
	req := models.UpdateTenantRequest{Status: ptr(models.StatusActive)}
	return s.Update(ctx, tenantID, id, req)
}

// --- Quota ---

func (s *Service) GetQuotaStatus(ctx context.Context, tenantID, id string) (*models.QuotaStatusResponse, error) {
	t, err := s.Get(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	quotas := models.DefaultQuotas()
	q := quotas[t.TenantTier]
	return &models.QuotaStatusResponse{
		TenantID: id,
		Tier:     t.TenantTier,
		Quota:    q,
		Usage:    "{}",
		Alerts:   "[]",
	}, nil
}

func (s *Service) AdjustQuota(ctx context.Context, tenantID, id string, req models.QuotaAdjustmentRequest) (*models.Tenant, error) {
	tenant, err := s.Get(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if req.AdjustmentType != "permanent" && req.AdjustmentType != "temporary" {
		return nil, ErrInvalidAdjustmentType
	}

	// Map requested changes to the repository update payload.
	updates := make(map[string]interface{})
	if req.Changes.RequestsPerMinute != nil {
		updates["requests_per_minute"] = *req.Changes.RequestsPerMinute
	}
	if req.Changes.MaxStorageGB != nil {
		updates["max_storage_gb"] = *req.Changes.MaxStorageGB
	}
	if req.Changes.MaxAgents != nil {
		updates["max_agents"] = *req.Changes.MaxAgents
	}
	if req.Changes.MaxDeployments != nil {
		updates["max_deployments"] = *req.Changes.MaxDeployments
	}
	if req.Changes.CPULimit != nil {
		updates["cpu_limit"] = *req.Changes.CPULimit
	}

	if len(updates) == 0 {
		return tenant, nil
	}

	if req.AdjustmentType == "temporary" {
		// Persist the temporary quota override; it expires after 24h.
		if err := s.repo.UpdateQuota(ctx, tenantID, id, updates); err != nil {
			return nil, fmt.Errorf("tenant-gateway adjust temporary quota: %w", err)
		}
		// Schedule expiry: revert to tier defaults after 24 hours.
		go func() {
			time.Sleep(24 * time.Hour)
			_ = s.initQuota(ctx, tenantID, id, tenant.TenantTier)
		}()
	} else {
		// Permanent adjustment: update the stored quota directly.
		if err := s.repo.UpdateQuota(ctx, tenantID, id, updates); err != nil {
			return nil, fmt.Errorf("tenant-gateway adjust permanent quota: %w", err)
		}
	}
	return s.Get(ctx, tenantID, id)
}

// --- Internal helpers ---

func (s *Service) initQuota(ctx context.Context, tenantID, tenantKey string, tier models.TenantTier) error {
	// Get tier defaults.
	quotas := models.DefaultQuotas()
	quota, ok := quotas[tier]
	if !ok {
		return fmt.Errorf("tenant-gateway initQuota: unknown tier %q", tier)
	}

	// Only create if no quota record exists yet (avoid overwriting permanent adjustments).
	existing, err := s.repo.GetQuota(ctx, tenantID, tenantKey)
	if err == nil && existing != nil {
		// Quota already persisted; skip overwrite.
		return nil
	}
	if err != sql.ErrNoRows {
		return fmt.Errorf("tenant-gateway initQuota: get quota: %w", err)
	}
	if err := s.repo.CreateQuota(ctx, tenantID, tenantKey, &quota); err != nil {
		return fmt.Errorf("tenant-gateway initQuota: create quota: %w", err)
	}
	return nil
}

func defaultNamespacePool() string {
	return "orion-tenant-pool-001"
}

func ptr(v models.TenantStatus) *models.TenantStatus {
	return &v
}

// --- Errors ---

var (
	ErrNotFoundTenantBase    = errors.New("tenant not found")
	ErrAlreadyExistsBase     = errors.New("tenant name already exists")
	ErrInvalidAdjustmentType = errors.New("invalid adjustment type")
)

func ErrNotFoundTenant(id string) error {
	return fmt.Errorf("tenant %q not found: %w", id, ErrNotFoundTenantBase)
}

func ErrAlreadyExists(name string) error {
	return fmt.Errorf("tenant name %q already exists: %w", name, ErrAlreadyExistsBase)
}

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFoundTenantBase)
}

func IsAlreadyExists(err error) bool {
	return errors.Is(err, ErrAlreadyExistsBase)
}
