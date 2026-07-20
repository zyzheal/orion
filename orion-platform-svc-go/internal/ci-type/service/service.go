package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"orion/platform-svc-go/internal/ci-type/models"
	"orion/platform-svc-go/internal/ci-type/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateType(ctx context.Context, t *models.CIType) error
	CreateVersion(ctx context.Context, v *models.CITypeVersion) error
	DeleteType(ctx context.Context, id string, tenantID string) (bool, error)
	GetByID(ctx context.Context, id string, tenantID string) (*models.CIType, error)
	GetNextVersion(ctx context.Context, ciTypeID string) (string, error)
	GetVersion(ctx context.Context, versionID string, ciTypeID string, tenantID string) (*models.CITypeVersion, error)
	List(ctx context.Context, tenantID string, filter *repository.ListFilter) ([]models.CIType, error)
	ListAttributes(ctx context.Context, ciTypeID string, tenantID string) ([]models.CIAttribute, error)
	ListVersions(ctx context.Context, ciTypeID string, tenantID string) ([]models.CITypeVersion, error)
	UpdateType(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.CIType, error)
	UpsertAttributes(ctx context.Context, ciTypeID string, tenantID string, attrs []models.CIAttribute) ([]models.CIAttribute, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ListTypes lists CI types for a tenant with optional filtering.
func (s *Service) ListTypes(ctx context.Context, tenantID string, filter *repository.ListFilter) ([]models.CIType, int, error) {
	types, err := s.repo.List(ctx, tenantID, filter)
	if err != nil {
		return nil, 0, err
	}
	if types == nil {
		types = []models.CIType{}
	}
	return types, len(types), nil
}

// GetTypeWithSchema returns a CI type with its attributes schema.
func (s *Service) GetTypeWithSchema(ctx context.Context, id string, tenantID string) (*models.TypeWithSchema, error) {
	t, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrCITypeNotFound
		}
		return nil, err
	}
	attrs, err := s.repo.ListAttributes(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &models.TypeWithSchema{
		CIType: *t,
		Schema: attrs,
	}, nil
}

// CreateType creates a new CI type.
func (s *Service) CreateType(ctx context.Context, req *models.CreateCITypeRequest, tenantID string) (*models.CIType, error) {
	t := &models.CIType{
		TenantID:    tenantID,
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Description: req.Description,
		Status:      "active",
	}
	if req.Status != nil {
		t.Status = *req.Status
	}
	if err := s.repo.CreateType(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

// UpdateType updates a CI type.
func (s *Service) UpdateType(ctx context.Context, id string, req *models.UpdateCITypeRequest, tenantID string) (*models.CIType, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.DisplayName != nil {
		updates["display_name"] = *req.DisplayName
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	t, err := s.repo.UpdateType(ctx, id, tenantID, updates)
	if err != nil {
		return nil, err
	}
	return t, nil
}

// DeleteType deletes a CI type.
func (s *Service) DeleteType(ctx context.Context, id string, tenantID string) (bool, error) {
	return s.repo.DeleteType(ctx, id, tenantID)
}

// GetAttributes returns the attributes for a CI type.
func (s *Service) GetAttributes(ctx context.Context, ciTypeID string, tenantID string) ([]models.CIAttribute, error) {
	attrs, err := s.repo.ListAttributes(ctx, ciTypeID, tenantID)
	if err != nil {
		return nil, err
	}
	if attrs == nil {
		attrs = []models.CIAttribute{}
	}
	return attrs, nil
}

// SetAttributes replaces all attributes for a CI type.
func (s *Service) SetAttributes(ctx context.Context, ciTypeID string, tenantID string, attrs []models.CreateCIAttributeRequest) ([]models.CIAttribute, error) {
	attributeList := make([]models.CIAttribute, len(attrs))
	for i, a := range attrs {
		attributeList[i] = models.CIAttribute{
			Name:         a.Name,
			Type:         "string",
			Required:     a.Required,
			DefaultValue: a.DefaultValue,
		}
		if a.Type != "" {
			attributeList[i].Type = a.Type
		}
	}
	return s.repo.UpsertAttributes(ctx, ciTypeID, tenantID, attributeList)
}

// ValidateInstance validates instance data against the CI type schema.
func (s *Service) ValidateInstance(ctx context.Context, ciTypeID string, tenantID string, data map[string]interface{}) (*models.ValidationResult, error) {
	attrs, err := s.repo.ListAttributes(ctx, ciTypeID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrCITypeNotFound
		}
		return nil, err
	}

	var result models.ValidationResult
	result.Errors = []string{}
	result.Warnings = []string{}

	// Check required attributes
	for _, attr := range attrs {
		if !attr.Required {
			continue
		}
		val, ok := data[attr.Name]
		if !ok {
			result.Errors = append(result.Errors, "missing required field: "+attr.Name)
			continue
		}
		if val == nil {
			result.Errors = append(result.Errors, "field "+attr.Name+" is required but is null")
		}
	}

	// Check type compatibility
	for _, attr := range attrs {
		val, ok := data[attr.Name]
		if !ok {
			continue
		}
		switch attr.Type {
		case "string":
			if val != "" && val != nil && attr.Type == "string" {
				// Accept any value as string type
			}
		case "number":
			switch val.(type) {
			case float64, int, int64, uint, uint64:
				// valid
			default:
				result.Errors = append(result.Errors, "field "+attr.Name+" should be a number")
			}
		case "boolean":
			if _, ok := val.(bool); !ok {
				result.Errors = append(result.Errors, "field "+attr.Name+" should be a boolean")
			}
		}
	}

	result.Valid = len(result.Errors) == 0
	return &result, nil
}

// CreateVersion creates a version snapshot of a CI type.
func (s *Service) CreateVersion(ctx context.Context, ciTypeID string, tenantID string, changeSummary *string) (*models.CITypeVersion, error) {
	// Verify CI type exists
	_, err := s.repo.GetByID(ctx, ciTypeID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrCITypeNotFound
		}
		return nil, err
	}
	// Snapshot current attributes
	attrs, _ := s.repo.ListAttributes(ctx, ciTypeID, tenantID)
	snapshot, _ := json.Marshal(attrs)

	version, err := s.repo.GetNextVersion(ctx, ciTypeID)
	if err != nil {
		return nil, err
	}

	v := &models.CITypeVersion{
		CITypeID:           ciTypeID,
		Version:            version,
		ChangeSummary:      sql.NullString{String: "", Valid: changeSummary != nil},
		AttributesSnapshot: string(snapshot),
	}
	if changeSummary != nil {
		v.ChangeSummary = sql.NullString{String: *changeSummary, Valid: true}
	}
	if err := s.repo.CreateVersion(ctx, v); err != nil {
		return nil, err
	}
	return v, nil
}

// GetVersions returns all versions for a CI type.
func (s *Service) GetVersions(ctx context.Context, ciTypeID string, tenantID string) ([]models.CITypeVersion, error) {
	versions, err := s.repo.ListVersions(ctx, ciTypeID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrCITypeNotFound
		}
		return nil, err
	}
	if versions == nil {
		versions = []models.CITypeVersion{}
	}
	return versions, nil
}

// Rollback rolls back a CI type to a previous version's attributes.
func (s *Service) Rollback(ctx context.Context, ciTypeID string, tenantID string, versionID string) (*models.CIType, error) {
	version, err := s.repo.GetVersion(ctx, versionID, ciTypeID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrCITypeNotFound
		}
		return nil, err
	}
	// Restore attributes from the version snapshot
	var snapshotAttrs []models.CIAttribute
	if err := json.Unmarshal([]byte(version.AttributesSnapshot), &snapshotAttrs); err != nil {
		return nil, errors.New("failed to parse version snapshot")
	}
	if _, err := s.repo.UpsertAttributes(ctx, ciTypeID, tenantID, snapshotAttrs); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, ciTypeID, tenantID)
}

// --- Errors ---

var (
	ErrCITypeNotFound = errors.New("CI type not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrCITypeNotFound)
}
