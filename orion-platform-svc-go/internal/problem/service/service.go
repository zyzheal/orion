package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"orion/platform-svc-go/internal/problem/models"
	"orion/platform-svc-go/internal/problem/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateKnownError(ctx context.Context, ke *models.KnownError) error
	CreateProblem(ctx context.Context, problem *models.Problem) error
	DeleteKnownError(ctx context.Context, id string) (bool, error)
	DeleteProblem(ctx context.Context, id string, tenantID string) (bool, error)
	GetChangeLinks(ctx context.Context, problemID string) ([]string, error)
	GetIncidentLinks(ctx context.Context, problemID string) ([]string, error)
	GetKnownErrorByID(ctx context.Context, id string) (*models.KnownError, error)
	GetProblemByID(ctx context.Context, id string, tenantID string) (*models.Problem, error)
	GetStats(ctx context.Context, tenantID string) (*models.ProblemStats, error)
	LinkChangeWithTenant(ctx context.Context, problemID, changeID, tenantID string) (*models.Problem, error)
	LinkIncidentWithTenant(ctx context.Context, problemID, incidentID, tenantID string) (*models.Problem, error)
	ListKnownErrors(ctx context.Context, tenantID string, filter *models.KnownErrorFilter) ([]models.KnownError, int, error)
	ListProblems(ctx context.Context, tenantID string, filter *models.ProblemFilter) ([]models.Problem, int, error)
	SearchKnownErrors(ctx context.Context, query string, tenantID string) ([]models.KnownError, int, error)
	UpdateKnownError(ctx context.Context, id string, updates map[string]interface{}) (*models.KnownError, error)
	UpdateProblem(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Problem, error)
}

var (
	ErrNotFound     = errors.New("problem not found")
	ErrBadRequest   = errors.New("bad request")
	ErrStatusLocked = errors.New("status cannot be changed")
)

// Service orchestrates problem management business logic.
type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// IsNotFound returns true if err is ErrNotFound or repo.ErrNotFound.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound) || errors.Is(err, repository.ErrNotFound)
}

// IsBadRequest returns true if err is ErrBadRequest.
func IsBadRequest(err error) bool {
	return errors.Is(err, ErrBadRequest)
}

// --- Problem CRUD ---

// ListProblems retrieves all problems for a tenant with optional filtering.
func (s *Service) ListProblems(ctx context.Context, tenantID string, filter *models.ProblemFilter) ([]models.Problem, int, error) {
	return s.repo.ListProblems(ctx, tenantID, filter)
}

// GetProblem retrieves a single problem by ID.
func (s *Service) GetProblem(ctx context.Context, tenantID, id string) (*models.Problem, error) {
	problem, err := s.repo.GetProblemByID(ctx, id, tenantID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) || strings.Contains(err.Error(), "no rows in result") {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return problem, nil
}

// CreateProblem creates a new problem for a tenant.
func (s *Service) CreateProblem(ctx context.Context, tenantID string, req *models.CreateProblemRequest) (*models.Problem, error) {
	if req == nil {
		return nil, ErrBadRequest
	}
	if strings.TrimSpace(req.Title) == "" {
		return nil, ErrBadRequest
	}

	problem := &models.Problem{
		TenantID:    tenantID,
		Title:       req.Title,
		Description: req.Description,
		Status:      "new",
		Priority:    "medium",
		Severity:    req.Severity,
		Category:    req.Category,
		AssignedTo:  req.AssignedTo,
		CreatedBy:   req.CreatedBy,
		Metadata:    req.Metadata,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	if err := s.repo.CreateProblem(ctx, problem); err != nil {
		return nil, err
	}
	return problem, nil
}

// UpdateProblem updates a problem's fields.
func (s *Service) UpdateProblem(ctx context.Context, tenantID, id string, req *models.UpdateProblemRequest) (*models.Problem, error) {
	if req == nil {
		return nil, ErrBadRequest
	}

	updates := make(map[string]interface{})
	if req.Title != nil && *req.Title != "" {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Status != nil {
		newStatus := *req.Status
		allowed := []string{"new", "triaged", "in_progress", "resolved", "closed"}
		if !contains(allowed, newStatus) {
			return nil, ErrBadRequest
		}
		updates["status"] = newStatus
	}
	if req.Priority != nil {
		p := *req.Priority
		if p != "low" && p != "medium" && p != "high" && p != "critical" {
			return nil, ErrBadRequest
		}
		updates["priority"] = p
	}
	if req.Severity != nil {
		updates["severity"] = *req.Severity
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.AssignedTo != nil {
		updates["assigned_to"] = *req.AssignedTo
	}
	if req.Metadata != nil {
		updates["metadata"] = *req.Metadata
	}

	if len(updates) == 0 {
		updates["updated_at"] = time.Now().UTC()
	}

	updated, err := s.repo.UpdateProblem(ctx, id, tenantID, updates)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return updated, nil
}

// DeleteProblem deletes a problem by ID.
func (s *Service) DeleteProblem(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.DeleteProblem(ctx, id, tenantID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}

// GetStats retrieves aggregated statistics for all problems in a tenant.
func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.ProblemStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}

// --- Known Errors (KEDB) ---

// CreateKnownError creates a known error entry for a problem.
func (s *Service) CreateKnownError(ctx context.Context, tenantID string, req *models.CreateKnownErrorRequest) (*models.KnownError, error) {
	if req == nil {
		return nil, ErrBadRequest
	}
	if strings.TrimSpace(req.Title) == "" {
		return nil, ErrBadRequest
	}

	// Verify the problem belongs to this tenant
	_, err := s.GetProblem(ctx, tenantID, req.ProblemID)
	if err != nil {
		return nil, ErrNotFound
	}

	ke := &models.KnownError{
		ProblemID:        req.ProblemID,
		Name:             req.Title,
		Symptoms:         req.Symptoms,
		RootCause:        req.RootCause,
		Workaround:       req.Workaround,
		PermanentFix:     req.PermanentFix,
		AffectedServices: req.AffectedServices,
		Keywords:         req.Keywords,
		CreatedAt:        time.Now().UTC(),
	}

	if err := s.repo.CreateKnownError(ctx, ke); err != nil {
		return nil, err
	}
	return ke, nil
}

// GetKnownError retrieves a known error by ID (no tenant isolation - known errors are scoped via problem_id).
func (s *Service) GetKnownError(ctx context.Context, tenantID, id string) (*models.KnownError, error) {
	ke, err := s.repo.GetKnownErrorByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) || strings.Contains(err.Error(), "no rows in result") {
			return nil, ErrNotFound
		}
		return nil, err
	}
	// Verify the related problem belongs to this tenant
	_, err = s.GetProblem(ctx, tenantID, ke.ProblemID)
	if err != nil {
		return nil, ErrNotFound
	}
	return ke, nil
}

// ListKnownErrors lists all known errors for a tenant's problems.
func (s *Service) ListKnownErrors(ctx context.Context, tenantID string, filter *models.KnownErrorFilter) ([]models.KnownError, int, error) {
	return s.repo.ListKnownErrors(ctx, tenantID, filter)
}

// SearchKnownErrors searches known errors by keyword across name/keywords/symptoms.
func (s *Service) SearchKnownErrors(ctx context.Context, tenantID, query string) ([]models.KnownError, int, error) {
	if strings.TrimSpace(query) == "" {
		return nil, 0, ErrBadRequest
	}
	return s.repo.SearchKnownErrors(ctx, query, tenantID)
}

// UpdateKnownError updates a known error's fields.
func (s *Service) UpdateKnownError(ctx context.Context, tenantID, id string, req *models.UpdateKnownErrorRequest) (*models.KnownError, error) {
	if req == nil {
		return nil, ErrBadRequest
	}

	// Verify ownership via tenant
	ke, err := s.GetKnownError(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFound
	}

	updates := make(map[string]interface{})
	if req.Title != nil && *req.Title != "" {
		updates["name"] = *req.Title
	}
	if req.Symptoms != nil {
		updates["symptoms"] = *req.Symptoms
	}
	if req.RootCause != nil {
		updates["root_cause"] = *req.RootCause
	}
	if req.Workaround != nil {
		updates["workaround"] = *req.Workaround
	}
	if req.PermanentFix != nil {
		updates["permanent_fix"] = *req.PermanentFix
	}
	if req.AffectedServices != nil {
		updates["affected_services"] = *req.AffectedServices
	}
	if req.Keywords != nil {
		updates["keywords"] = *req.Keywords
	}

	if len(updates) == 0 {
		return ke, nil
	}

	updated, err := s.repo.UpdateKnownError(ctx, id, updates)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	// Re-verify tenant ownership after update
	_, err = s.GetProblem(ctx, tenantID, updated.ProblemID)
	if err != nil {
		return nil, ErrNotFound
	}
	return updated, nil
}

// DeleteKnownError deletes a known error.
func (s *Service) DeleteKnownError(ctx context.Context, tenantID, id string) error {
	// Verify ownership first
	_, err := s.GetKnownError(ctx, tenantID, id)
	if err != nil {
		return ErrNotFound
	}
	deleted, err := s.repo.DeleteKnownError(ctx, id)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}

// --- Linking ---

// LinkIncident links an incident to a problem.
func (s *Service) LinkIncident(ctx context.Context, tenantID, problemID, incidentID string) (*models.Problem, error) {
	if strings.TrimSpace(incidentID) == "" {
		return nil, ErrBadRequest
	}
	// Verify problem belongs to tenant
	_, err := s.GetProblem(ctx, tenantID, problemID)
	if err != nil {
		return nil, ErrNotFound
	}
	return s.repo.LinkIncidentWithTenant(ctx, problemID, incidentID, tenantID)
}

// GetIncidentLinks retrieves all incident IDs linked to a problem.
func (s *Service) GetIncidentLinks(ctx context.Context, tenantID, problemID string) ([]string, error) {
	_, err := s.GetProblem(ctx, tenantID, problemID)
	if err != nil {
		return nil, ErrNotFound
	}
	return s.repo.GetIncidentLinks(ctx, problemID)
}

// LinkChange links a change request to a problem.
func (s *Service) LinkChange(ctx context.Context, tenantID, problemID, changeID string) (*models.Problem, error) {
	if strings.TrimSpace(changeID) == "" {
		return nil, ErrBadRequest
	}
	_, err := s.GetProblem(ctx, tenantID, problemID)
	if err != nil {
		return nil, ErrNotFound
	}
	return s.repo.LinkChangeWithTenant(ctx, problemID, changeID, tenantID)
}

// GetChangeLinks retrieves all change IDs linked to a problem.
func (s *Service) GetChangeLinks(ctx context.Context, tenantID, problemID string) ([]string, error) {
	_, err := s.GetProblem(ctx, tenantID, problemID)
	if err != nil {
		return nil, ErrNotFound
	}
	return s.repo.GetChangeLinks(ctx, problemID)
}

// --- Helper ---

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}
