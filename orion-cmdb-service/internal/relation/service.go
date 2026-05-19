package relation

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Service errors
var (
	ErrRelationExists   = errors.New("relation already exists")
	ErrRelationNotFound = errors.New("relation not found")
	ErrSelfRelation     = errors.New("cannot create self-relation")
	ErrSameTypeExists   = errors.New("same type relation already exists between these CIs")
)

// Service defines the business logic layer for CI relations
type Service struct {
	repo *Repository
}

// NewService creates a new relation service
func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// CreateRelation creates a new CI relation
func (s *Service) CreateRelation(input *CreateRelationInput) (*Relation, error) {
	// Validate input
	if err := s.validateInput(input); err != nil {
		return nil, err
	}

	// Check for self-relation
	if input.FromCiID == input.ToCiID {
		return nil, ErrSelfRelation
	}

	// Check if exact relation already exists
	if s.repo.Exists(input.FromCiID, input.ToCiID, input.RelationType, input.TenantID) {
		return nil, ErrRelationExists
	}

	// Create relation
	now := time.Now()
	relation := &Relation{
		ID:           uuid.New().String(),
		TenantID:     input.TenantID,
		FromCiID:     input.FromCiID,
		ToCiID:       input.ToCiID,
		RelationType: input.RelationType,
		Description:  input.Description,
		CreatedBy:    input.CreatedBy,
		CreatedAt:    now,
	}

	if err := s.repo.Create(relation); err != nil {
		return nil, fmt.Errorf("failed to create relation: %w", err)
	}

	return relation, nil
}

// GetRelation retrieves a relation by ID
func (s *Service) GetRelation(id string) (*Relation, error) {
	if id == "" {
		return nil, ErrInvalidRelationInput
	}

	relation, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	return relation, nil
}

// GetRelationsByCiID retrieves all relations for a given CI
func (s *Service) GetRelationsByCiID(ciID string, tenantID int64) ([]Relation, error) {
	if ciID == "" || tenantID == 0 {
		return nil, ErrInvalidRelationInput
	}

	return s.repo.GetByCiID(ciID, tenantID)
}

// DeleteRelation deletes a relation by ID
func (s *Service) DeleteRelation(id string) error {
	if id == "" {
		return ErrInvalidRelationInput
	}

	return s.repo.Delete(id)
}

// DeleteRelationsByCiID deletes all relations associated with a CI
func (s *Service) DeleteRelationsByCiID(ciID string, tenantID int64) error {
	if ciID == "" || tenantID == 0 {
		return ErrInvalidRelationInput
	}

	return s.repo.DeleteByCiID(ciID, tenantID)
}

// validateInput validates the create relation input
func (s *Service) validateInput(input *CreateRelationInput) error {
	if input == nil {
		return ErrInvalidRelationInput
	}

	if input.FromCiID == "" {
		return ErrInvalidRelationInput
	}

	if input.ToCiID == "" {
		return ErrInvalidRelationInput
	}

	if input.RelationType == "" {
		return ErrInvalidRelationInput
	}

	// Validate relation type
	if !IsValidRelationType(input.RelationType) {
		return fmt.Errorf("invalid relation type: %s", input.RelationType)
	}

	return nil
}

// ErrInvalidRelationInput is returned when relation input is invalid
var ErrInvalidRelationInput = errors.New("invalid relation input")