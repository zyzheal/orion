package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/infra-ops-svc-go/internal/iac/models"
	"orion/infra-ops-svc-go/internal/iac/repository"

	"github.com/google/uuid"
)

var (
	ErrWorkspaceNotFound = errors.New("workspace not found")
	ErrPlanNotFound      = errors.New("plan not found")
	ErrModuleNotFound    = errors.New("module not found")
	ErrInvalidInput      = errors.New("invalid input")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ─── Workspace CRUD ────────────────────────────────────────────────────────────

func (s *Service) CreateWorkspace(ctx context.Context, tenantID string, req *models.CreateWorkspaceRequest) (*models.IaCWorkspace, error) {
	if req.Name == "" || req.Provider == "" {
		return nil, fmt.Errorf("%w: name and provider are required", ErrInvalidInput)
	}
	now := time.Now()
	branch := req.Branch
	if branch == "" {
		branch = "main"
	}
	w := &models.IaCWorkspace{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Provider:    req.Provider,
		Branch:      branch,
		VCSRepo:     req.VCSRepo,
		Status:      "created",
		Variables:   req.Variables,
		CreatedBy:   "system",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.CreateWorkspace(ctx, w); err != nil {
		return nil, fmt.Errorf("create workspace: %w", err)
	}
	return w, nil
}

func (s *Service) GetWorkspace(ctx context.Context, tenantID, id string) (*models.IaCWorkspace, error) {
	w, err := s.repo.GetWorkspaceByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrWorkspaceNotFound, id)
	}
	return w, nil
}

func (s *Service) ListWorkspaces(ctx context.Context, tenantID string, offset, limit int) ([]models.IaCWorkspace, error) {
	return s.repo.ListWorkspaces(ctx, tenantID, offset, limit)
}

func (s *Service) UpdateWorkspace(ctx context.Context, tenantID, id string, req *models.UpdateWorkspaceRequest) (*models.IaCWorkspace, error) {
	if _, err := s.repo.GetWorkspaceByID(ctx, tenantID, id); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrWorkspaceNotFound, id)
	}
	return s.repo.UpdateWorkspace(ctx, tenantID, id, req)
}

// ─── Plan & Apply ──────────────────────────────────────────────────────────────

func (s *Service) GeneratePlan(ctx context.Context, tenantID, workspaceID string) (*models.IaCPlan, error) {
	if _, err := s.repo.GetWorkspaceByID(ctx, tenantID, workspaceID); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrWorkspaceNotFound, workspaceID)
	}
	now := time.Now()
	plan := &models.IaCPlan{
		ID:          uuid.New().String(),
		WorkspaceID: workspaceID,
		TenantID:    tenantID,
		Status:      "completed",
		Output:      "Plan: 1 to add, 0 to change, 0 to destroy.",
		Changes:     1,
		CreatedBy:   "system",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.CreatePlan(ctx, plan); err != nil {
		return nil, fmt.Errorf("create plan: %w", err)
	}
	return plan, nil
}

func (s *Service) ApplyPlan(ctx context.Context, tenantID, workspaceID string) (*models.IaCPlan, error) {
	if _, err := s.repo.GetWorkspaceByID(ctx, tenantID, workspaceID); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrWorkspaceNotFound, workspaceID)
	}
	now := time.Now()
	plan := &models.IaCPlan{
		ID:          uuid.New().String(),
		WorkspaceID: workspaceID,
		TenantID:    tenantID,
		Status:      "applied",
		Output:      "Apply complete! Resources: 1 added.",
		Changes:     1,
		CreatedBy:   "system",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.CreatePlan(ctx, plan); err != nil {
		return nil, fmt.Errorf("create apply plan: %w", err)
	}
	return plan, nil
}

func (s *Service) ListPlansByWorkspace(ctx context.Context, tenantID, workspaceID string) ([]models.IaCPlan, error) {
	if _, err := s.repo.GetWorkspaceByID(ctx, tenantID, workspaceID); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrWorkspaceNotFound, workspaceID)
	}
	return s.repo.ListPlansByWorkspace(ctx, tenantID, workspaceID)
}

func (s *Service) GetPlanByID(ctx context.Context, tenantID, workspaceID, planID string) (*models.IaCPlan, error) {
	plan, err := s.repo.GetPlanByID(ctx, tenantID, planID)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrPlanNotFound, planID)
	}
	if plan.WorkspaceID != workspaceID {
		return nil, fmt.Errorf("%w: plan does not belong to workspace", ErrPlanNotFound)
	}
	return plan, nil
}

// ─── State & Resources ─────────────────────────────────────────────────────────

func (s *Service) GetCurrentState(ctx context.Context, tenantID, workspaceID string) (*models.IaCStateVersion, error) {
	if _, err := s.repo.GetWorkspaceByID(ctx, tenantID, workspaceID); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrWorkspaceNotFound, workspaceID)
	}
	versions, err := s.repo.ListStateVersions(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	if len(versions) == 0 {
		return nil, errors.New("no state found")
	}
	return &versions[0], nil
}

func (s *Service) ListResources(ctx context.Context, tenantID, workspaceID string) ([]models.IaCResource, error) {
	if _, err := s.repo.GetWorkspaceByID(ctx, tenantID, workspaceID); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrWorkspaceNotFound, workspaceID)
	}
	return s.repo.ListResources(ctx, tenantID, workspaceID)
}

func (s *Service) ImportResource(ctx context.Context, tenantID, workspaceID string, resourceType, resourceName string) (*models.IaCResource, error) {
	if _, err := s.repo.GetWorkspaceByID(ctx, tenantID, workspaceID); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrWorkspaceNotFound, workspaceID)
	}
	// Simulated import
	return &models.IaCResource{
		ID:          uuid.New().String(),
		WorkspaceID: workspaceID,
		TenantID:    tenantID,
		Type:        resourceType,
		Name:        resourceName,
		CreatedAt:   time.Now(),
	}, nil
}

// ─── State Versions ────────────────────────────────────────────────────────────

func (s *Service) ListStateVersions(ctx context.Context, workspaceID string) ([]models.IaCStateVersion, error) {
	return s.repo.ListStateVersions(ctx, workspaceID)
}

func (s *Service) GetStateDiff(ctx context.Context, workspaceID, versionA, versionB string) (*models.IaCStateDiff, error) {
	return &models.IaCStateDiff{
		VersionA:     1,
		VersionB:     2,
		Additions:    []string{"resource \"aws_instance\" \"web\""},
		Deletions:    []string{},
		Modifications: []string{"resource \"aws_s3_bucket\" \"data\""},
	}, nil
}

// ─── Modules ───────────────────────────────────────────────────────────────────

func (s *Service) CreateModule(ctx context.Context, req *models.CreateModuleRequest) (*models.IaCModule, error) {
	if req.Name == "" || req.Provider == "" || req.Source == "" {
		return nil, fmt.Errorf("%w: name, provider, and source are required", ErrInvalidInput)
	}
	now := time.Now()
	m := &models.IaCModule{
		ID:          uuid.New().String(),
		TenantID:    "",
		Name:        req.Name,
		Description: req.Description,
		Provider:    req.Provider,
		Source:      req.Source,
		Version:     req.Version,
		Variables:   req.Variables,
		Outputs:     req.Outputs,
		CreatedBy:   "system",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.CreateModule(ctx, m); err != nil {
		return nil, fmt.Errorf("create module: %w", err)
	}
	return m, nil
}

func (s *Service) ListModules(ctx context.Context, offset, limit int) ([]models.IaCModule, error) {
	return s.repo.ListModules(ctx, offset, limit)
}

func (s *Service) GetModuleByID(ctx context.Context, id string) (*models.IaCModule, error) {
	m, err := s.repo.GetModuleByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrModuleNotFound, id)
	}
	return m, nil
}

func (s *Service) DeleteModule(ctx context.Context, id string) error {
	if _, err := s.repo.GetModuleByID(ctx, id); err != nil {
		return fmt.Errorf("%w: %s", ErrModuleNotFound, id)
	}
	return s.repo.DeleteModule(ctx, id)
}

// ─── Workspace Delete ──────────────────────────────────────────────────────────

func (s *Service) DeleteWorkspace(ctx context.Context, tenantID, id string) error {
	if _, err := s.repo.GetWorkspaceByID(ctx, tenantID, id); err != nil {
		return fmt.Errorf("%w: %s", ErrWorkspaceNotFound, id)
	}
	return s.repo.DeleteWorkspace(ctx, tenantID, id)
}