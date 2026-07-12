package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/iac/models"
	"orion/platform-svc-go/internal/iac/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- Workspace CRUD ---

func (s *Service) CreateWorkspace(ctx context.Context, tenantID string, req models.CreateWorkspaceRequest) (*models.Workspace, error) {
	if err := s.repo.CreateTableIfNotExists(ctx); err != nil {
		return nil, err
	}
	status := "active"
	w := &models.Workspace{
		TenantID:         tenantID,
		Name:             req.Name,
		Description:      req.Description,
		BackendType:      req.BackendType,
		BackendConfig:    req.BackendConfig,
		Variables:        req.Variables,
		Environment:      req.Environment,
		TerraformVersion: req.TerraformVersion,
		Status:           status,
	}
	if err := s.repo.CreateWorkspace(ctx, w); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *Service) GetWorkspace(ctx context.Context, tenantID, id string) (*models.Workspace, error) {
	w, err := s.repo.GetWorkspace(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return w, nil
}

func (s *Service) ListWorkspaces(ctx context.Context, tenantID string, limit, offset int) ([]models.Workspace, error) {
	return s.repo.ListWorkspaces(ctx, tenantID, limit, offset)
}

func (s *Service) UpdateWorkspace(ctx context.Context, tenantID, id string, req models.UpdateWorkspaceRequest) (*models.Workspace, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	updates["backend_config"] = req.BackendConfig
	updates["variables"] = req.Variables
	if req.Environment != nil {
		updates["environment"] = *req.Environment
	}
	if req.TerraformVersion != nil {
		updates["terraform_version"] = *req.TerraformVersion
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if err := s.repo.UpdateWorkspace(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.GetWorkspace(ctx, tenantID, id)
}

// --- Plan & Apply ---

func (s *Service) GeneratePlan(ctx context.Context, tenantID, workspaceID string, req models.GeneratePlanRequest) (*models.PlanSummary, error) {
	// Verify workspace exists.
	if _, err := s.GetWorkspace(ctx, tenantID, workspaceID); err != nil {
		return nil, err
	}
	plan := &models.Plan{
		TenantID:    tenantID,
		WorkspaceID: workspaceID,
		Status:      "pending",
	}
	if err := s.repo.CreatePlan(ctx, plan); err != nil {
		return nil, err
	}
	// TODO: trigger terraform plan execution (external tool / job queue).
	return &models.PlanSummary{
		PlanID:    plan.ID,
		Status:    "pending",
		CreatedAt: plan.CreatedAt.Format(time.RFC3339),
	}, nil
}

func (s *Service) ApplyPlan(ctx context.Context, tenantID, workspaceID string, req models.ApplyPlanRequest) (*models.PlanSummary, error) {
	// Verify workspace exists.
	if _, err := s.GetWorkspace(ctx, tenantID, workspaceID); err != nil {
		return nil, err
	}
	plan := &models.Plan{
		TenantID:    tenantID,
		WorkspaceID: workspaceID,
		Status:      "pending",
	}
	if err := s.repo.CreatePlan(ctx, plan); err != nil {
		return nil, err
	}
	// TODO: trigger terraform apply execution (external tool / job queue).
	return &models.PlanSummary{
		PlanID:    plan.ID,
		Status:    "pending",
		CreatedAt: plan.CreatedAt.Format(time.RFC3339),
	}, nil
}

// --- State & Resources ---

func (s *Service) GetCurrentState(ctx context.Context, tenantID, workspaceID string) (map[string]interface{}, error) {
	// Verify workspace exists.
	if _, err := s.GetWorkspace(ctx, tenantID, workspaceID); err != nil {
		return nil, err
	}
	versions, err := s.repo.ListStateVersions(ctx, tenantID, workspaceID)
	if err != nil {
		return nil, err
	}
	if len(versions) == 0 {
		return map[string]interface{}{"message": "no state found"}, nil
	}
	return map[string]interface{}{
		"workspace_id": workspaceID,
		"serial":       versions[0].Serial,
		"version_id":   versions[0].ID,
		"created_at":   versions[0].CreatedAt.Format(time.RFC3339),
	}, nil
}

func (s *Service) ListResources(ctx context.Context, tenantID, workspaceID string) ([]models.Resource, error) {
	return s.repo.ListResources(ctx, tenantID, workspaceID)
}

func (s *Service) ImportResource(ctx context.Context, tenantID, workspaceID string, req models.ImportResourceRequest) (*models.Resource, error) {
	// Verify workspace exists.
	if _, err := s.GetWorkspace(ctx, tenantID, workspaceID); err != nil {
		return nil, err
	}
	res := &models.Resource{
		TenantID:    tenantID,
		WorkspaceID: workspaceID,
		Type:        req.Type,
		Name:        req.Name,
		Provider:    req.Provider,
		Status:      "managed",
	}
	if err := s.repo.ImportResource(ctx, res); err != nil {
		return nil, err
	}
	return res, nil
}

// --- State Versions ---

func (s *Service) ListStateVersions(ctx context.Context, tenantID, workspaceID string) ([]models.StateVersion, error) {
	if _, err := s.GetWorkspace(ctx, tenantID, workspaceID); err != nil {
		return nil, err
	}
	return s.repo.ListStateVersions(ctx, tenantID, workspaceID)
}

func (s *Service) GetStateDiff(ctx context.Context, tenantID, workspaceID, versionA, versionB string) (*models.StateDiffResult, error) {
	// Verify workspace exists.
	if _, err := s.GetWorkspace(ctx, tenantID, workspaceID); err != nil {
		return nil, err
	}
	// Verify both versions exist.
	if _, err := s.repo.GetStateVersion(ctx, tenantID, workspaceID, versionA); err != nil {
		return nil, fmt.Errorf("state version A not found: %w", err)
	}
	if _, err := s.repo.GetStateVersion(ctx, tenantID, workspaceID, versionB); err != nil {
		return nil, fmt.Errorf("state version B not found: %w", err)
	}
	// TODO: diff actual state JSON.
	return &models.StateDiffResult{}, nil
}

// --- Plan Details ---

func (s *Service) ListPlans(ctx context.Context, tenantID, workspaceID string) ([]models.Plan, error) {
	return s.repo.ListPlansByWorkspace(ctx, tenantID, workspaceID)
}

func (s *Service) GetPlan(ctx context.Context, tenantID, planID string) (*models.Plan, error) {
	return s.repo.GetPlan(ctx, tenantID, planID)
}

// --- Modules ---

func (s *Service) ListModules(ctx context.Context, tenantID string) ([]models.WorkspaceModule, error) {
	return s.repo.ListModules(ctx, tenantID)
}

func (s *Service) CreateModule(ctx context.Context, tenantID string, req models.CreateModuleRequest) (*models.WorkspaceModule, error) {
	m := &models.WorkspaceModule{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Source:      req.Source,
		Version:     req.Version,
		Inputs:      req.Inputs,
	}
	if err := s.repo.CreateModule(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetModule(ctx context.Context, tenantID, id string) (*models.WorkspaceModule, error) {
	return s.repo.GetModuleByID(ctx, tenantID, id)
}

func (s *Service) DeleteModule(ctx context.Context, tenantID, id string) error {
	if err := s.repo.DeleteModule(ctx, tenantID, id); err != nil {
		return err
	}
	return nil
}

// --- Errors ---

var (
	ErrNotFound = errors.New("not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound) || (err != nil && contains(err, "not found"))
}

func contains(err error, s string) bool {
	e := err.Error()
	for i := 0; i <= len(e)-len(s); i++ {
		if e[i:i+len(s)] == s {
			return true
		}
	}
	return false
}
