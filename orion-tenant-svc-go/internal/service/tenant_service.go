package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"

	"orion/tenant-svc-go/internal/models"
	"orion/tenant-svc-go/internal/repository"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

var errInvalidName = errors.New("tenant name can only contain letters, numbers, hyphens and underscores")
var nameRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

type TenantService struct {
	repo *repository.TenantRepository
	log  *zap.Logger
}

func NewTenantService(repo *repository.TenantRepository, log *zap.Logger) *TenantService {
	return &TenantService{repo: repo, log: log}
}

// GetTenant retrieves a tenant by ID.
func (s *TenantService) GetTenant(ctx context.Context, id string) (*models.Tenant, error) {
	t, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, fmt.Errorf("tenant not found: %s", id)
	}
	return t, nil
}

// GetTenantByName retrieves a tenant by name.
func (s *TenantService) GetTenantByName(ctx context.Context, name string) (*models.Tenant, error) {
	return s.repo.FindByName(ctx, name)
}

// ListTenants returns paginated tenants.
func (s *TenantService) ListTenants(ctx context.Context, page, limit int, status string) ([]models.Tenant, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	offset := (page - 1) * limit

	tenants, err := s.repo.List(ctx, &status, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	var total int
	if status != "" {
		total, err = s.repo.Count(ctx, &status)
	} else {
		total, err = s.repo.Count(ctx, nil)
	}
	if err != nil {
		return nil, 0, err
	}
	return tenants, total, nil
}

// CreateTenant creates a new tenant.
func (s *TenantService) CreateTenant(ctx context.Context, name string, displayName string) (*models.Tenant, error) {
	name = toLowerCase(name)
	if name == "" {
		return nil, fmt.Errorf("tenant name is required")
	}
	if !nameRegex.MatchString(name) {
		return nil, errInvalidName
	}

	exists, err := s.repo.ExistsByName(ctx, name)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("tenant name already exists: %s", name)
	}

	var dn *string
	if displayName != "" {
		dn = &displayName
	}

	t := &models.Tenant{
		ID:          uuid.New().String(),
		Name:        name,
		DisplayName: dn,
		Status:      "active",
		Settings:    make(map[string]any),
	}
	if err := s.repo.Create(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

// UpdateTenant updates a tenant.
func (s *TenantService) UpdateTenant(ctx context.Context, id string, updates map[string]any) (*models.Tenant, error) {
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, fmt.Errorf("tenant not found: %s", id)
	}

	// Check duplicate name
	if name, ok := updates["name"]; ok {
		newName, ok := name.(string)
		if ok && newName != existing.Name {
			exists, _ := s.repo.ExistsByName(ctx, newName)
			if exists {
				return nil, fmt.Errorf("tenant name already exists: %s", newName)
			}
		}
	}

	return s.repo.Update(ctx, id, updates)
}

// DeleteTenant performs a soft delete.
func (s *TenantService) DeleteTenant(ctx context.Context, id string) error {
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return fmt.Errorf("tenant not found: %s", id)
	}
	return s.repo.SoftDelete(ctx, id)
}

// toLowerCase converts a string to lowercase.
func toLowerCase(s string) string {
	result := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		b := s[i]
		if b >= 'A' && b <= 'Z' {
			b = b + 32
		}
		result[i] = b
	}
	return string(result)
}
