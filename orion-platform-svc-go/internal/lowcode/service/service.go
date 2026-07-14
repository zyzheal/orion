package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/lowcode/models"
	"orion/platform-svc-go/internal/lowcode/repository"

	"github.com/google/uuid"
)

// Service provides lowcode business logic.
type Service struct {
	repo *repository.Repository
}

var (
	ErrFlowNotFound     = errors.New("lowcode flow not found")
	ErrTemplateNotFound = errors.New("lowcode template not found")
	ErrFlowNotEnabled   = errors.New("lowcode flow is not enabled")
)

// NewService creates a new Service instance.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- Flow CRUD ---

// CreateFlow creates a new lowcode workflow definition.
func (s *Service) CreateFlow(ctx context.Context, tenantID, userID string, req *models.CreateFlowRequest) (*models.LowcodeFlow, error) {
	now := time.Now()
	flow := &models.LowcodeFlow{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Version:     req.Version,
		Nodes:       req.Nodes,
		Edges:       req.Edges,
		Enabled:     false,
		CreatedBy:   userID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if flow.Version == "" {
		flow.Version = "1.0.0"
	}

	if err := s.repo.CreateFlow(ctx, flow); err != nil {
		return nil, fmt.Errorf("failed to create flow: %w", err)
	}

	return flow, nil
}

// GetFlow retrieves a flow by id.
func (s *Service) GetFlow(ctx context.Context, tenantID, id string) (*models.LowcodeFlow, error) {
	flow, err := s.repo.GetFlowByID(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, repository.ErrFlowNotFound) {
			return nil, ErrFlowNotFound
		}
		return nil, fmt.Errorf("failed to get flow: %w", err)
	}
	return flow, nil
}

// ListFlows retrieves flows with optional filters and pagination.
func (s *Service) ListFlows(ctx context.Context, tenantID string, filter *models.ListFlowFilters, page, pageSize int) ([]models.LowcodeFlow, int, error) {
	offset := (page - 1) * pageSize

	items, err := s.repo.ListFlows(ctx, tenantID, filter, offset, pageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list flows: %w", err)
	}

	total, err := s.repo.CountFlows(ctx, tenantID, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count flows: %w", err)
	}

	return items, total, nil
}

// UpdateFlow updates an existing flow.
func (s *Service) UpdateFlow(ctx context.Context, tenantID, id string, req *models.UpdateFlowRequest) (*models.LowcodeFlow, error) {
	// Verify flow exists
	_, err := s.repo.GetFlowByID(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, repository.ErrFlowNotFound) {
			return nil, ErrFlowNotFound
		}
		return nil, fmt.Errorf("failed to get flow: %w", err)
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Version != nil {
		updates["version"] = *req.Version
	}
	if req.Nodes != nil {
		updates["nodes"] = *req.Nodes
	}
	if req.Edges != nil {
		updates["edges"] = *req.Edges
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	if len(updates) > 0 {
		if err := s.repo.UpdateFlow(ctx, tenantID, id, updates); err != nil {
			return nil, fmt.Errorf("failed to update flow: %w", err)
		}
	}

	flow, err := s.repo.GetFlowByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get updated flow: %w", err)
	}
	return flow, nil
}

// DeleteFlow deletes a flow by id.
func (s *Service) DeleteFlow(ctx context.Context, tenantID, id string) error {
	if err := s.repo.DeleteFlow(ctx, tenantID, id); err != nil {
		if errors.Is(err, repository.ErrFlowNotFound) {
			return ErrFlowNotFound
		}
		return fmt.Errorf("failed to delete flow: %w", err)
	}
	return nil
}

// PublishFlow publishes a flow: sets enabled=true and bumps the patch version.
func (s *Service) PublishFlow(ctx context.Context, tenantID, id string) (*models.LowcodeFlow, error) {
	flow, err := s.repo.GetFlowByID(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, repository.ErrFlowNotFound) {
			return nil, ErrFlowNotFound
		}
		return nil, fmt.Errorf("failed to get flow: %w", err)
	}

	newVersion := bumpPatchVersion(flow.Version)
	updates := map[string]interface{}{
		"enabled": true,
		"version": newVersion,
	}

	if err := s.repo.UpdateFlow(ctx, tenantID, id, updates); err != nil {
		return nil, fmt.Errorf("failed to publish flow: %w", err)
	}

	flow, err = s.repo.GetFlowByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get published flow: %w", err)
	}
	return flow, nil
}

// ExecuteFlow creates a workflow execution instance.
func (s *Service) ExecuteFlow(ctx context.Context, tenantID, userID, flowID string, input string) (*models.LowcodeInstance, error) {
	flow, err := s.repo.GetFlowByID(ctx, tenantID, flowID)
	if err != nil {
		if errors.Is(err, repository.ErrFlowNotFound) {
			return nil, ErrFlowNotFound
		}
		return nil, fmt.Errorf("failed to get flow: %w", err)
	}

	if !flow.Enabled {
		return nil, ErrFlowNotEnabled
	}

	now := time.Now()
	inst := &models.LowcodeInstance{
		ID:                  uuid.New().String(),
		TenantID:            tenantID,
		WorkflowID:          flowID,
		WorkflowDefinitionID: flowID,
		Status:              "running",
		Variables:           flow.Nodes,
		Input:               input,
		Output:              "",
		CurrentNodeID:       "",
		TriggeredBy:         userID,
		StartedAt:           &now,
		CreatedAt:           now,
	}

	if err := s.repo.CreateInstance(ctx, inst); err != nil {
		return nil, fmt.Errorf("failed to create instance: %w", err)
	}

	return inst, nil
}

// --- Version Management ---

// CreateVersion creates a version snapshot of a workflow.
func (s *Service) CreateVersion(ctx context.Context, tenantID, userID, workflowID string) (*models.VersionSnapshot, error) {
	flow, err := s.repo.GetFlowByID(ctx, tenantID, workflowID)
	if err != nil {
		if errors.Is(err, repository.ErrFlowNotFound) {
			return nil, ErrFlowNotFound
		}
		return nil, fmt.Errorf("failed to get flow: %w", err)
	}

	now := time.Now()
	snap := &models.VersionSnapshot{
		ID:         uuid.New().String(),
		WorkflowID: workflowID,
		Version:    flow.Version,
		Definition: fmt.Sprintf(`{"nodes":%s,"edges":%s}`, flow.Nodes, flow.Edges),
		CreatedBy:  userID,
		CreatedAt:  now,
	}

	if err := s.repo.CreateVersionSnapshot(ctx, snap); err != nil {
		return nil, fmt.Errorf("failed to create version snapshot: %w", err)
	}

	return snap, nil
}

// ListVersions lists version snapshots for a workflow.
func (s *Service) ListVersions(ctx context.Context, tenantID, workflowID string) ([]models.VersionSnapshot, error) {
	// Verify the flow exists
	_, err := s.repo.GetFlowByID(ctx, tenantID, workflowID)
	if err != nil {
		if errors.Is(err, repository.ErrFlowNotFound) {
			return nil, ErrFlowNotFound
		}
		return nil, fmt.Errorf("failed to get flow: %w", err)
	}

	snapshots, err := s.repo.ListVersionSnapshots(ctx, workflowID)
	if err != nil {
		return nil, fmt.Errorf("failed to list versions: %w", err)
	}

	return snapshots, nil
}

// --- Import / Export ---

// ImportWorkflow imports a workflow from JSON.
func (s *Service) ImportWorkflow(ctx context.Context, tenantID, userID string, req *models.ImportWorkflowRequest) (*models.LowcodeFlow, error) {
	now := time.Now()
	flow := &models.LowcodeFlow{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Version:     "1.0.0",
		Nodes:       req.CurrentDefinition.Nodes,
		Edges:       req.CurrentDefinition.Edges,
		Enabled:     false,
		CreatedBy:   userID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.CreateFlow(ctx, flow); err != nil {
		return nil, fmt.Errorf("failed to import workflow: %w", err)
	}

	return flow, nil
}

// ExportWorkflow exports a workflow as JSON.
func (s *Service) ExportWorkflow(ctx context.Context, tenantID, id string) (*models.ExportResponse, error) {
	flow, err := s.repo.GetFlowByID(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, repository.ErrFlowNotFound) {
			return nil, ErrFlowNotFound
		}
		return nil, fmt.Errorf("failed to get flow: %w", err)
	}

	resp := &models.ExportResponse{
		ID:          flow.ID,
		Name:        flow.Name,
		Description: flow.Description,
		Version:     flow.Version,
		CreatedAt:   flow.CreatedAt,
		UpdatedAt:   flow.UpdatedAt,
	}
	resp.Definition.Nodes = flow.Nodes
	resp.Definition.Edges = flow.Edges

	return resp, nil
}

// --- Template CRUD ---

// CreateTemplate creates a new template.
func (s *Service) CreateTemplate(ctx context.Context, userID string, req *models.CreateTemplateRequest) (*models.LowcodeTemplate, error) {
	now := time.Now()
	tmpl := &models.LowcodeTemplate{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Thumbnail:   "",
		Definition:  "",
		Tags:        req.Tags,
		UsageCount:  0,
		CreatedBy:   userID,
		CreatedAt:   now,
	}

	if err := s.repo.CreateTemplate(ctx, tmpl); err != nil {
		return nil, fmt.Errorf("failed to create template: %w", err)
	}

	return tmpl, nil
}

// ListTemplates lists all templates.
func (s *Service) ListTemplates(ctx context.Context) ([]models.LowcodeTemplate, error) {
	items, err := s.repo.ListTemplates(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list templates: %w", err)
	}
	return items, nil
}

// ApplyTemplate applies a template to create a workflow.
func (s *Service) ApplyTemplate(ctx context.Context, tenantID, userID, templateID string, req *models.ApplyTemplateRequest) (*models.LowcodeFlow, error) {
	tmpl, err := s.repo.GetTemplateByID(ctx, templateID)
	if err != nil {
		if errors.Is(err, repository.ErrTemplateNotFound) {
			return nil, ErrTemplateNotFound
		}
		return nil, fmt.Errorf("failed to get template: %w", err)
	}

	// Parse the template definition to extract nodes and edges
	var nodes, edges string
	if tmpl.Definition != "" {
		// The definition is stored as JSON: {"nodes": "...", "edges": "..."}
		// For simplicity, we store the whole definition as nodes and leave edges empty
		// The actual parsing would depend on the template definition format
		nodes = tmpl.Definition
	}

	now := time.Now()
	flow := &models.LowcodeFlow{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.WorkflowName,
		Description: req.Description,
		Version:     "1.0.0",
		Nodes:       nodes,
		Edges:       edges,
		Enabled:     false,
		CreatedBy:   userID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.CreateFlow(ctx, flow); err != nil {
		return nil, fmt.Errorf("failed to create workflow from template: %w", err)
	}

	// Increment template usage count
	if err := s.repo.IncrementTemplateUsage(ctx, templateID); err != nil {
		return nil, fmt.Errorf("failed to increment template usage: %w", err)
	}

	return flow, nil
}

// --- helpers ---

// bumpPatchVersion bumps the patch version of a semver string.
// e.g., "1.2.3" -> "1.2.4", "1.0.0" -> "1.0.1"
func bumpPatchVersion(version string) string {
	parts := strings.Split(version, ".")
	if len(parts) != 3 {
		return version + ".0.1"
	}

	patch, err := strconv.Atoi(parts[2])
	if err != nil {
		return version
	}

	parts[2] = strconv.Itoa(patch + 1)
	return strings.Join(parts, ".")
}