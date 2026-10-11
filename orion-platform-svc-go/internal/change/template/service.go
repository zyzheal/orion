// Service layer for ADR-015 §4.1 Change 三层 SOP.
//
// Thin orchestration over the Repository — validates domain invariants
// (name non-empty, template_type in allowed set, etc.) and delegates
// persistence. The handler layer depends on this interface, not on
// PostgresRepository, so tests can inject a mock.
package template

import (
	"context"
	"errors"
	"strings"
)

// ErrValidation is a sentinel for domain-level validation failures
// (distinct from ErrNotFound / ErrVersionMismatch which come from repo).
var ErrValidation = errors.New("change/template: validation failed")

// ErrInvalidEnumValue is returned when an enum (authority / template_type)
// has a value outside the allowed set.
var ErrInvalidEnumValue = errors.New("change/template: invalid enum value")

// ServiceInterface defines the service contract used by handlers.
type ServiceInterface interface {
	CreateTemplate(ctx context.Context, tenantID string, req *CreateChangeTemplateRequest, createdBy string) (*ChangeTemplate, error)
	GetTemplate(ctx context.Context, tenantID, id string) (*ChangeTemplate, error)
	ListTemplates(ctx context.Context, tenantID string, onlyActive bool) ([]*ChangeTemplate, error)
	UpdateTemplate(ctx context.Context, tenantID, id string, req *UpdateChangeTemplateRequest) (*ChangeTemplate, error)
	DeleteTemplate(ctx context.Context, tenantID, id string) (bool, error)

	CreateSOP(ctx context.Context, tenantID string, req *CreateChangeSOPRequest, createdBy string) (*ChangeSOP, error)
	GetSOP(ctx context.Context, tenantID, id string) (*ChangeSOP, error)
	GetSOPDetail(ctx context.Context, tenantID, id string) (*SOPDetail, error)
	ListSOPs(ctx context.Context, tenantID, templateID string, onlyActive bool) ([]*ChangeSOP, error)
	UpdateSOP(ctx context.Context, tenantID, id string, req *UpdateChangeSOPRequest) (*ChangeSOP, error)
	DeleteSOP(ctx context.Context, tenantID, id string) (bool, error)

	CreateStep(ctx context.Context, tenantID string, req *CreateChangeSopStepRequest, createdBy string) (*ChangeSopStep, error)
	GetStep(ctx context.Context, tenantID, id string) (*ChangeSopStep, error)
	ListSteps(ctx context.Context, tenantID, sopID string) ([]*ChangeSopStep, error)
	UpdateStep(ctx context.Context, tenantID, id string, req *UpdateChangeSopStepRequest) (*ChangeSopStep, error)
	DeleteStep(ctx context.Context, tenantID, id string) (bool, error)
}

// Service is the default implementation of ServiceInterface.
type Service struct {
	repo Repository
}

// NewService constructs a Service. repo must not be nil.
func NewService(repo Repository) *Service {
	if repo == nil {
		return nil
	}
	return &Service{repo: repo}
}

// --- Template ---

func (s *Service) CreateTemplate(ctx context.Context, tenantID string, req *CreateChangeTemplateRequest, createdBy string) (*ChangeTemplate, error) {
	if err := validateCreateTemplateRequest(req); err != nil {
		return nil, err
	}
	return s.repo.CreateTemplate(ctx, tenantID, req, createdBy)
}

func (s *Service) GetTemplate(ctx context.Context, tenantID, id string) (*ChangeTemplate, error) {
	return s.repo.GetTemplate(ctx, tenantID, id)
}

func (s *Service) ListTemplates(ctx context.Context, tenantID string, onlyActive bool) ([]*ChangeTemplate, error) {
	return s.repo.ListTemplates(ctx, tenantID, onlyActive)
}

func (s *Service) UpdateTemplate(ctx context.Context, tenantID, id string, req *UpdateChangeTemplateRequest) (*ChangeTemplate, error) {
	if req == nil {
		return nil, errors.New("change/template: nil request")
	}
	if err := validateUpdateTemplateRequest(req); err != nil {
		return nil, err
	}
	return s.repo.UpdateTemplate(ctx, tenantID, id, req)
}

func (s *Service) DeleteTemplate(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteTemplate(ctx, tenantID, id)
}

// --- SOP ---

func (s *Service) CreateSOP(ctx context.Context, tenantID string, req *CreateChangeSOPRequest, createdBy string) (*ChangeSOP, error) {
	if err := validateCreateSOPRequest(req); err != nil {
		return nil, err
	}
	return s.repo.CreateSOP(ctx, tenantID, req, createdBy)
}

func (s *Service) GetSOP(ctx context.Context, tenantID, id string) (*ChangeSOP, error) {
	return s.repo.GetSOP(ctx, tenantID, id)
}

func (s *Service) GetSOPDetail(ctx context.Context, tenantID, id string) (*SOPDetail, error) {
	return s.repo.GetSOPDetail(ctx, tenantID, id)
}

func (s *Service) ListSOPs(ctx context.Context, tenantID, templateID string, onlyActive bool) ([]*ChangeSOP, error) {
	return s.repo.ListSOPs(ctx, tenantID, templateID, onlyActive)
}

func (s *Service) UpdateSOP(ctx context.Context, tenantID, id string, req *UpdateChangeSOPRequest) (*ChangeSOP, error) {
	if req == nil {
		return nil, errors.New("change/template: nil request")
	}
	if err := validateUpdateSOPRequest(req); err != nil {
		return nil, err
	}
	return s.repo.UpdateSOP(ctx, tenantID, id, req)
}

func (s *Service) DeleteSOP(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteSOP(ctx, tenantID, id)
}

// --- Step ---

func (s *Service) CreateStep(ctx context.Context, tenantID string, req *CreateChangeSopStepRequest, createdBy string) (*ChangeSopStep, error) {
	if err := validateCreateStepRequest(req); err != nil {
		return nil, err
	}
	return s.repo.CreateStep(ctx, tenantID, req, createdBy)
}

func (s *Service) GetStep(ctx context.Context, tenantID, id string) (*ChangeSopStep, error) {
	return s.repo.GetStep(ctx, tenantID, id)
}

func (s *Service) ListSteps(ctx context.Context, tenantID, sopID string) ([]*ChangeSopStep, error) {
	return s.repo.ListSteps(ctx, tenantID, sopID)
}

func (s *Service) UpdateStep(ctx context.Context, tenantID, id string, req *UpdateChangeSopStepRequest) (*ChangeSopStep, error) {
	if req == nil {
		return nil, errors.New("change/template: nil request")
	}
	if err := validateUpdateStepRequest(req); err != nil {
		return nil, err
	}
	return s.repo.UpdateStep(ctx, tenantID, id, req)
}

func (s *Service) DeleteStep(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteStep(ctx, tenantID, id)
}

// --- Validation helpers ---

func validateCreateTemplateRequest(req *CreateChangeTemplateRequest) error {
	if req == nil {
		return errors.New("change/template: nil create request")
	}
	if strings.TrimSpace(req.Name) == "" {
		return validationErr("name is required")
	}
	if req.Name != "" && len(req.Name) > 255 {
		return validationErr("name must be <=255 chars")
	}
	if req.Authority != "" && !isValidAuthority(req.Authority) {
		return validationErr("authority must be public/team/private")
	}
	if req.TemplateType != "" && !isValidTemplateType(req.TemplateType) {
		return validationErr("templateType must be standard/emergency/minor")
	}
	return nil
}

func validateUpdateTemplateRequest(req *UpdateChangeTemplateRequest) error {
	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		return validationErr("name cannot be empty")
	}
	if req.Name != nil && len(*req.Name) > 255 {
		return validationErr("name must be <=255 chars")
	}
	if req.Authority != nil && !isValidAuthority(*req.Authority) {
		return validationErr("authority must be public/team/private")
	}
	if req.TemplateType != nil && !isValidTemplateType(*req.TemplateType) {
		return validationErr("templateType must be standard/emergency/minor")
	}
	return nil
}

func validateCreateSOPRequest(req *CreateChangeSOPRequest) error {
	if req == nil {
		return errors.New("change/template: nil create request")
	}
	if strings.TrimSpace(req.TemplateID) == "" {
		return validationErr("templateId is required")
	}
	if strings.TrimSpace(req.Name) == "" {
		return validationErr("name is required")
	}
	if req.Authority != "" && !isValidAuthority(req.Authority) {
		return validationErr("authority must be public/team/private")
	}
	if req.SOPType != "" && !isValidTemplateType(req.SOPType) {
		return validationErr("sopType must be standard/emergency/minor")
	}
	return nil
}

func validateUpdateSOPRequest(req *UpdateChangeSOPRequest) error {
	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		return validationErr("name cannot be empty")
	}
	if req.Authority != nil && !isValidAuthority(*req.Authority) {
		return validationErr("authority must be public/team/private")
	}
	if req.SOPType != nil && !isValidTemplateType(*req.SOPType) {
		return validationErr("sopType must be standard/emergency/minor")
	}
	return nil
}

func validateCreateStepRequest(req *CreateChangeSopStepRequest) error {
	if req == nil {
		return errors.New("change/template: nil create request")
	}
	if strings.TrimSpace(req.SOPID) == "" {
		return validationErr("sopId is required")
	}
	if strings.TrimSpace(req.Code) == "" {
		return validationErr("code is required")
	}
	if strings.TrimSpace(req.Name) == "" {
		return validationErr("name is required")
	}
	return nil
}

func validateUpdateStepRequest(req *UpdateChangeSopStepRequest) error {
	if req.Code != nil && strings.TrimSpace(*req.Code) == "" {
		return validationErr("code cannot be empty")
	}
	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		return validationErr("name cannot be empty")
	}
	return nil
}

func isValidAuthority(a Authority) bool {
	switch a {
	case AuthorityPublic, AuthorityTeam, AuthorityPrivate:
		return true
	}
	return false
}

func isValidTemplateType(t TemplateType) bool {
	switch t {
	case TemplateTypeStandard, TemplateTypeEmergency, TemplateTypeMinor:
		return true
	}
	return false
}

func validationErr(msg string) error {
	return errors.New("change/template: " + msg)
}
