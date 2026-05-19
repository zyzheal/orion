package cmdb

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Service defines the business logic layer for CI
type Service struct {
	repo      *Repository
	validator *Validator
}

// NewService creates a new CI service
func NewService(repo *Repository) *Service {
	return &Service{
		repo:      repo,
		validator: NewValidator(),
	}
}

// CreateCI creates a new CI
func (s *Service) CreateCI(input *CreateCIInput) (*CI, error) {
	// Validate input
	if err := s.validator.ValidateCreateInput(input); err != nil {
		return nil, err
	}

	// Apply defaults
	s.validator.ApplyDefaults(input)

	// Check if CI already exists
	if s.repo.Exists(input.CiID, input.TenantID) {
		return nil, ErrCIExists
	}

	// Create CI
	now := time.Now()
	ci := &CI{
		ID:          uuid.New().String(),
		TenantID:    input.TenantID,
		CiID:        input.CiID,
		CiType:      input.CiType,
		Name:        input.Name,
		Description: input.Description,
		Status:      input.Status,
		Environment: input.Environment,
		Tags:        input.Tags,
		Attributes:  input.Attributes,
		Version:     1,
		CreatedBy:   input.CreatedBy,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.Create(ci); err != nil {
		return nil, fmt.Errorf("failed to create CI: %w", err)
	}

	return ci, nil
}

// GetCI retrieves a CI by ID
func (s *Service) GetCI(id string) (*CI, error) {
	if id == "" {
		return nil, ErrInvalidInput
	}

	ci, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	return ci, nil
}

// UpdateCI updates an existing CI
func (s *Service) UpdateCI(id string, input *UpdateCIInput) (*CI, error) {
	if id == "" {
		return nil, ErrInvalidInput
	}

	// Validate input
	if err := s.validator.ValidateUpdateInput(input); err != nil {
		return nil, err
	}

	// Update CI
	ci, err := s.repo.Update(id, input)
	if err != nil {
		return nil, err
	}

	return ci, nil
}

// DeleteCI deletes a CI
func (s *Service) DeleteCI(id string) error {
	if id == "" {
		return ErrInvalidInput
	}

	return s.repo.Delete(id)
}

// ListCIs retrieves CIs with filtering and pagination
func (s *Service) ListCIs(ciType, status, search string, page, pageSize int, tenantID int64) ([]CI, int64, error) {
	// Validate pagination
	if page < 0 {
		page = 1
	}
	if pageSize < 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	return s.repo.List(ciType, status, search, page, pageSize, tenantID)
}

// GetCIByCiID retrieves a CI by its ci_id
func (s *Service) GetCIByCiID(ciID string, tenantID int64) (*CI, error) {
	if ciID == "" || tenantID == 0 {
		return nil, ErrInvalidInput
	}

	return s.repo.GetByCiID(ciID, tenantID)
}

// CountCIs counts CIs by type and status
func (s *Service) CountCIs(ciType, status string, tenantID int64) (int64, error) {
	return s.repo.Count(ciType, status, tenantID)
}