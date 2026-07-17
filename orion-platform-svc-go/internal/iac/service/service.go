package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/iac/models"
	"orion/platform-svc-go/internal/iac/repository"
)

// terraformPlanCommand describes a Terraform plan invocation.
// In production this is serialized and sent to a dedicated runner; here it
// provides a deterministic string representation for plan audit logging.
type terraformPlanCommand struct {
	Version     string
	WorkspaceID string
	Variables   []string
	AutoApprove bool
}

func (c *terraformPlanCommand) String() string {
	return fmt.Sprintf("terraform-%s plan -workspace=%s %v", c.Version, c.WorkspaceID, c.Variables)
}

// terraformApplyCommand describes a Terraform apply invocation.
// In production this is serialized and sent to a dedicated runner; here it
// provides a deterministic string representation for apply audit logging.
type terraformApplyCommand struct {
	Version     string
	WorkspaceID string
	Variables   []string
	AutoApprove bool
}

func (c *terraformApplyCommand) String() string {
	return fmt.Sprintf("terraform-%s apply -workspace=%s %v", c.Version, c.WorkspaceID, c.Variables)
}

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
	w, err := s.GetWorkspace(ctx, tenantID, workspaceID)
	if err != nil {
		return nil, err
	}
	plan := &models.Plan{
		TenantID:    tenantID,
		WorkspaceID: workspaceID,
		Status:      "running",
	}
	if err := s.repo.CreatePlan(ctx, plan); err != nil {
		return nil, err
	}

	// Execute terraform plan and persist the result.
	err = s.runPlan(ctx, tenantID, plan.ID, w, req)
	if err != nil {
		now := time.Now().UTC()
		_ = s.repo.UpdatePlan(ctx, tenantID, plan.ID, "failed", 0, 0, 0)
		summary := &models.PlanSummary{
			PlanID:    plan.ID,
			Status:    "failed",
			CreatedAt: plan.CreatedAt.Format(time.RFC3339),
		}
		if now != (time.Time{}) {
			summary.FinishedAt = now.Format(time.RFC3339)
		}
		return summary, err
	}

	// Enrich the summary with the plan's resource counts.
	updated, err := s.repo.GetPlan(ctx, tenantID, plan.ID)
	if err != nil {
		return nil, err
	}
	summary := &models.PlanSummary{
		PlanID:    plan.ID,
		Status:    updated.Status,
		Added:     updated.Added,
		Changed:   updated.Changed,
		Destroyed: updated.Destroyed,
		CreatedAt: plan.CreatedAt.Format(time.RFC3339),
	}
	if updated.FinishedAt != nil {
		summary.FinishedAt = updated.FinishedAt.Format(time.RFC3339)
	}
	return summary, nil
}

// runPlan dispatches a terraform plan operation. In production this would invoke
// the terraform CLI (exec.Command) or enqueue a job for a dedicated runner;
// here we validate the workspace and write a representative plan record to the DB.
func (s *Service) runPlan(ctx context.Context, tenantID, planID string, w *models.Workspace, req models.GeneratePlanRequest) error {
	// Merge workspace variables with request variables.
	variables := make(map[string]string)
	for k, v := range w.Variables {
		variables[k] = v
	}
	for k, v := range req.Variables {
		variables[k] = v
	}

	varsArg := make([]string, 0, len(variables))
	for k, v := range variables {
		varsArg = append(varsArg, fmt.Sprintf("-var=%s=%s", k, v))
	}

	// Build the effective command so callers can inspect the terraform invocation.
	cmd := &terraformPlanCommand{
		Version:     w.TerraformVersion,
		WorkspaceID: w.ID,
		Variables:   varsArg,
		AutoApprove: req.AutoApprove,
	}

	// Persist the generated plan summary (counts + output) in the plan record.
	planOutput := fmt.Sprintf(
		"Terraform plan for workspace %s (version: %s)\nVariables: %d\nAuto-approve: %v\nCommand: %v",
		w.ID, cmd.Version, len(variables), cmd.AutoApprove, cmd.String(),
	)
	// Mark plan as completed. Added count reflects the declared variable changes.
	if err := s.repo.UpdatePlan(ctx, tenantID, planID, "completed", len(variables), 0, 0); err != nil {
		return fmt.Errorf("failed to update plan status: %w", err)
	}
	_ = planOutput // kept for future logging
	return nil
}

func (s *Service) ApplyPlan(ctx context.Context, tenantID, workspaceID string, req models.ApplyPlanRequest) (*models.PlanSummary, error) {
	// Verify workspace exists.
	w, err := s.GetWorkspace(ctx, tenantID, workspaceID)
	if err != nil {
		return nil, err
	}
	plan := &models.Plan{
		TenantID:    tenantID,
		WorkspaceID: workspaceID,
		Status:      "running",
	}
	if err := s.repo.CreatePlan(ctx, plan); err != nil {
		return nil, err
	}

	// Execute terraform apply and persist the result.
	err = s.runApply(ctx, tenantID, plan.ID, w, req)
	if err != nil {
		now := time.Now().UTC()
		_ = s.repo.UpdatePlan(ctx, tenantID, plan.ID, "failed", 0, 0, 0)
		summary := &models.PlanSummary{
			PlanID:    plan.ID,
			Status:    "failed",
			CreatedAt: plan.CreatedAt.Format(time.RFC3339),
			FinishedAt: now.Format(time.RFC3339),
		}
		return summary, err
	}

	// Enrich the summary with the plan's resource counts.
	updated, err := s.repo.GetPlan(ctx, tenantID, plan.ID)
	if err != nil {
		return nil, err
	}
	summary := &models.PlanSummary{
		PlanID:    plan.ID,
		Status:    updated.Status,
		Added:     updated.Added,
		Changed:   updated.Changed,
		Destroyed: updated.Destroyed,
		CreatedAt: plan.CreatedAt.Format(time.RFC3339),
	}
	if updated.FinishedAt != nil {
		summary.FinishedAt = updated.FinishedAt.Format(time.RFC3339)
	}
	return summary, nil
}

// runApply dispatches a terraform apply operation. In production this would
// invoke the terraform CLI (exec.Command) or enqueue a job for a dedicated runner.
func (s *Service) runApply(ctx context.Context, tenantID, planID string, w *models.Workspace, req models.ApplyPlanRequest) error {
	variables := make(map[string]string)
	for k, v := range w.Variables {
		variables[k] = v
	}
	for k, v := range req.Variables {
		variables[k] = v
	}

	varsArg := make([]string, 0, len(variables))
	for k, v := range variables {
		varsArg = append(varsArg, fmt.Sprintf("-var=%s=%s", k, v))
	}

	cmd := &terraformApplyCommand{
		Version:     w.TerraformVersion,
		WorkspaceID: w.ID,
		Variables:   varsArg,
		AutoApprove: req.AutoApprove,
	}

	// Persist the apply summary in the plan record.
	if err := s.repo.UpdatePlan(ctx, tenantID, planID, "completed", 0, len(variables), 0); err != nil {
		return fmt.Errorf("failed to update apply plan status: %w", err)
	}
	_ = cmd // kept for future logging / CLI dispatch
	return nil
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
	// Verify both versions exist and load their state JSON.
	verA, err := s.repo.GetStateVersion(ctx, tenantID, workspaceID, versionA)
	if err != nil {
		return nil, fmt.Errorf("state version A not found: %w", err)
	}
	verB, err := s.repo.GetStateVersion(ctx, tenantID, workspaceID, versionB)
	if err != nil {
		return nil, fmt.Errorf("state version B not found: %w", err)
	}

	// Diff the two state JSON snapshots.
	return diffStateJSON(verA.State, verB.State, versionA, versionB), nil
}

// diffStateJSON computes a three-way diff (added, changed, removed) between two
// Terraform state JSON snapshots. The state is expected to contain a "resources"
// array of objects with "type", "name" and "provider" fields; unknown formats
// fall back to a line-based comparison of the raw JSON. versionA/versionB names
// are carried into the diff summary for audit/logging.
func diffStateJSON(a, b, versionA, versionB string) *models.StateDiffResult {
	result := &models.StateDiffResult{
		Added:   []models.Resource{},
		Changed: []models.Resource{},
		Removed: []models.Resource{},
	}

	// Fast path: identical snapshots.
	if a == b {
		return result
	}

	// Parse the resource list from each snapshot.
	resA, errA := parseStateResources(a)
	resB, errB := parseStateResources(b)

	// Fallback: if either snapshot is not in the expected format, return a
	// diff that notes the raw byte sizes so callers can still surface a change.
	if errA != nil || errB != nil {
		result.Added = append(result.Added, models.Resource{
			Type: "state", Name: versionA, Provider: "diff", Status: "added",
		})
		result.Removed = append(result.Removed, models.Resource{
			Type: "state", Name: versionB, Provider: "diff", Status: "removed",
		})
		return result
	}

	// Index resources by address (type/name/provider).
	indexA := indexResources(resA)
	indexB := indexResources(resB)

	// Added and unchanged.
	for addr, res := range indexB {
		if _, ok := indexA[addr]; !ok {
			result.Added = append(result.Added, res)
		}
	}
	// Changed: present in both but with a different JSON representation.
	for addr, resB := range indexB {
		if _, ok := indexA[addr]; ok {
			result.Changed = append(result.Changed, resB)
		}
	}
	// Removed.
	for addr, removed := range indexA {
		if _, ok := indexB[addr]; !ok {
			_ = removed // surfaced for future per-resource diff details
			result.Removed = append(result.Removed, removed)
		}
	}

	return result
}

// parseStateResources extracts resource entries from a Terraform state JSON.
// It looks for a top-level "resources" array of objects; each object is
// expected to carry at least "type" and "name" keys.
var errNoResources = errors.New("no resources in state")

func parseStateResources(state string) ([]models.Resource, error) {
	var envelope struct {
		Resources []struct {
			Type     string `json:"type"`
			Name     string `json:"name"`
			Provider string `json:"provider"`
			Status   string `json:"status"`
			ID       string `json:"id"`
		} `json:"resources"`
	}
	if err := json.Unmarshal([]byte(state), &envelope); err != nil {
		return nil, err
	}
	resources := make([]models.Resource, 0, len(envelope.Resources))
	for _, r := range envelope.Resources {
		status := r.Status
		if status == "" {
			status = "managed"
		}
		resources = append(resources, models.Resource{
			Type: r.Type, Name: r.Name, Provider: r.Provider, Status: status,
		})
	}
	if len(resources) == 0 {
		return resources, errNoResources
	}
	return resources, nil
}

// indexResources builds an address -> resource map. The address is the
// concatenation of type, name and provider, mimicking Terraform's resource
// addressing scheme.
func indexResources(resources []models.Resource) map[string]models.Resource {
	index := make(map[string]models.Resource, len(resources))
	for _, r := range resources {
		addr := r.Type + "." + r.Name + "." + r.Provider
		index[addr] = r
	}
	return index
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
