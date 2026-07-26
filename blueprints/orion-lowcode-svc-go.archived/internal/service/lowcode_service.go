package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/lowcode-svc-go/internal/models"
	"orion/lowcode-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrLowCodeAppNotFound = errors.New("app not found")

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ============================================================
// LowCode App (component library)
// ============================================================

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateLowCodeAppRequest) (*models.LowCodeApp, error) {
	d := &models.LowCodeApp{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.LowCodeApp, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.LowCodeApp, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// ============================================================
// Workflow Definition (flows)
// ============================================================

// CreateWorkflow creates a new workflow definition.
func (s *Service) CreateWorkflow(ctx context.Context, tenantID, createdBy string, req *models.CreateWorkflowDefinitionRequest) (*models.WorkflowDefinition, error) {
	if req.Name == "" {
		return nil, errors.New("name is required")
	}
	if len(req.Nodes) == 0 {
		return nil, errors.New("nodes are required")
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	version := req.Version
	if version < 1 {
		version = 1
	}

	d := &models.WorkflowDefinition{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      req.Name,
		Version:   version,
		Enabled:   enabled,
		Nodes:     req.Nodes,
		Edges:     req.Edges,
		CreatedBy: createdBy,
	}
	if req.Description != "" {
		d.Description = &req.Description
	}

	err := s.repo.CreateDef(ctx, d)
	if err != nil {
		return nil, err
	}
	return d, nil
}

// ListWorkflows lists workflow definitions with optional filters.
func (s *Service) ListWorkflows(ctx context.Context, tenantID string, enabled *bool, offset, limit int, search string) ([]models.WorkflowDefinition, int, error) {
	if limit < 1 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	defs, err := s.repo.FindDefsByTenant(ctx, tenantID, enabled, offset, limit)
	if err != nil {
		return nil, 0, err
	}

	// Server-side search
	if search != "" {
		lowerSearch := strings.ToLower(search)
		filtered := make([]models.WorkflowDefinition, 0, len(defs))
		for _, d := range defs {
			if strings.Contains(strings.ToLower(d.Name), lowerSearch) {
				filtered = append(filtered, d)
			} else if d.Description != nil && strings.Contains(strings.ToLower(*d.Description), lowerSearch) {
				filtered = append(filtered, d)
			}
		}
		defs = filtered
	}

	return defs, len(defs), nil
}

// GetWorkflowByID returns a workflow definition by id.
func (s *Service) GetWorkflowByID(ctx context.Context, tenantID, id string) (*models.WorkflowDefinition, error) {
	d, err := s.repo.FindDefByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if d == nil {
		return nil, nil
	}
	// Tenant isolation
	if d.TenantID != tenantID {
		return nil, nil
	}
	return d, nil
}

// UpdateWorkflow updates a workflow definition.
func (s *Service) UpdateWorkflow(ctx context.Context, tenantID, id string, req *models.UpdateWorkflowDefinitionRequest) (*models.WorkflowDefinition, error) {
	existing, err := s.GetWorkflowByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, nil
	}

	// Check if there are fields to update
	hasUpdate := false
	if req.Name != nil || req.Description != nil || req.Version != nil ||
		req.Enabled != nil || req.Nodes != nil || req.Edges != nil {
		hasUpdate = true
	}
	if !hasUpdate {
		return nil, errors.New("no fields to update")
	}

	// Build update payload
	d := &models.WorkflowDefinition{
		ID:        existing.ID,
		TenantID:  existing.TenantID,
		Name:      existing.Name,
		Description: existing.Description,
		Version:   existing.Version,
		Enabled:   existing.Enabled,
		Nodes:     existing.Nodes,
		Edges:     existing.Edges,
		CreatedBy: existing.CreatedBy,
	}
	if req.Name != nil {
		d.Name = *req.Name
	}
	if req.Description != nil {
		d.Description = req.Description
	}
	if req.Version != nil {
		d.Version = *req.Version
	}
	if req.Enabled != nil {
		d.Enabled = *req.Enabled
	}
	if req.Nodes != nil {
		d.Nodes = req.Nodes
	}
	if req.Edges != nil {
		d.Edges = req.Edges
	}

	err = s.repo.UpdateDef(ctx, d)
	if err != nil {
		return nil, err
	}

	// Return updated record
	updated, err := s.repo.FindDefByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

// DeleteWorkflow deletes a workflow definition.
func (s *Service) DeleteWorkflow(ctx context.Context, tenantID, id string) error {
	existing, err := s.GetWorkflowByID(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return nil
	}
	return s.repo.DeleteDef(ctx, id)
}

// PublishWorkflow publishes a workflow (enables it and bumps version).
func (s *Service) PublishWorkflow(ctx context.Context, tenantID, id string) (*models.WorkflowDefinition, error) {
	existing, err := s.GetWorkflowByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, errors.New("workflow not found")
	}

	// Bump version
	newVersion := existing.Version + 1

	updated, err := s.UpdateWorkflow(ctx, tenantID, id, &models.UpdateWorkflowDefinitionRequest{
		Enabled:   &[]bool{true}[0],
		Version:   &newVersion,
	})
	return updated, err
}

// ExecuteWorkflow creates a new instance and starts execution.
func (s *Service) ExecuteWorkflow(ctx context.Context, tenantID, id, createdBy string, input map[string]any) (*models.WorkflowInstance, error) {
	def, err := s.GetWorkflowByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if def == nil {
		return nil, errors.New("workflow not found")
	}
	if !def.Enabled {
		return nil, errors.New("workflow is not enabled, please publish it first")
	}

	// Find the start node
	var startNode *models.WorkflowNode
	for i, node := range def.Nodes {
		if node.Type == models.NodeTypeStart {
			startNode = &def.Nodes[i]
			break
		}
	}
	if startNode == nil {
		return nil, errors.New("workflow has no start node")
	}

	inst := &models.WorkflowInstance{
		ID:                   uuid.New().String(),
		WorkflowID:           id,
		WorkflowDefinitionID: id,
		TenantID:             tenantID,
		Status:               models.StatusPending,
		CurrentNodeID:        startNode.ID,
		Variables:            map[string]any{},
		History:              nil,
		Input:                input,
	}

	err = s.repo.CreateInst(ctx, inst)
	if err != nil {
		return nil, err
	}
	return inst, nil
}

// ============================================================
// Workflow Version
// ============================================================

// CreateVersion creates a version snapshot.
func (s *Service) CreateVersion(ctx context.Context, tenantID, workflowID, createdBy string, commitMsg string) (*models.WorkflowVersion, error) {
	def, err := s.GetWorkflowByID(ctx, tenantID, workflowID)
	if err != nil {
		return nil, err
	}
	if def == nil {
		return nil, errors.New("workflow not found")
	}

	v := &models.WorkflowVersion{
		ID:         uuid.New().String(),
		WorkflowID: workflowID,
		TenantID:   tenantID,
		Version:    fmt.Sprintf("%d", def.Version),
		Nodes:      def.Nodes,
		Edges:      def.Edges,
		CommitMsg:  commitMsg,
		CreatedBy:  createdBy,
	}

	err = s.repo.CreateVersion(ctx, v)
	if err != nil {
		return nil, err
	}
	return v, nil
}

// ListVersions lists version snapshots for a workflow.
func (s *Service) ListVersions(ctx context.Context, tenantID, workflowID string, offset, limit int) ([]models.WorkflowVersion, int, error) {
	if limit < 1 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	// Verify workflow exists
	def, err := s.GetWorkflowByID(ctx, tenantID, workflowID)
	if err != nil {
		return nil, 0, err
	}
	if def == nil {
		return nil, 0, errors.New("workflow not found")
	}

	versions, total, err := s.repo.FindVersionsByWorkflowID(ctx, tenantID, workflowID, offset, limit)
	if err != nil {
		return nil, 0, err
	}

	// Prepend the current version as a pseudo-version
	current := models.WorkflowVersion{
		ID:         "current-" + workflowID,
		WorkflowID: workflowID,
		TenantID:   tenantID,
		Version:    fmt.Sprintf("%d", def.Version),
		Nodes:      def.Nodes,
		Edges:      def.Edges,
		CreatedBy:  def.CreatedBy,
		CreatedAt:  def.UpdatedAt,
	}

	allVersions := append([]models.WorkflowVersion{current}, versions...)
	return allVersions, total + 1, nil
}

// ============================================================
// Workflow Import / Export
// ============================================================

// ImportWorkflow creates a workflow from imported data.
func (s *Service) ImportWorkflow(ctx context.Context, tenantID, createdBy string, req *models.ImportWorkflowRequest) (*models.WorkflowDefinition, error) {
	return s.CreateWorkflow(ctx, tenantID, createdBy, &models.CreateWorkflowDefinitionRequest{
		Name:        req.Name,
		Description: req.Description,
		Version:     1,
		Nodes:       req.Nodes,
		Edges:       req.Edges,
		CreatedBy:   createdBy,
	})
}

// ExportWorkflow exports a workflow definition with its current version.
func (s *Service) ExportWorkflow(ctx context.Context, tenantID, id string) (*models.ExportResponse, error) {
	def, err := s.GetWorkflowByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if def == nil {
		return nil, errors.New("workflow not found")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	versions := []map[string]any{
		{
			"id":          "current-" + id,
			"workflow_id": id,
			"version":     fmt.Sprintf("%d", def.Version),
			"snapshot": map[string]any{
				"nodes": def.Nodes,
				"edges": def.Edges,
			},
			"created_by": def.CreatedBy,
			"created_at": def.UpdatedAt.Format(time.RFC3339),
		},
	}

	return &models.ExportResponse{
		Workflow: map[string]any{
			"id":          def.ID,
			"name":        def.Name,
			"description": def.Description,
			"version":     fmt.Sprintf("%d", def.Version),
			"nodes":       def.Nodes,
			"edges":       def.Edges,
		},
		ExportedAt: now,
		Versions:   versions,
	}, nil
}

// ============================================================
// Workflow Template
// ============================================================

// CreateTemplate creates a new workflow template.
func (s *Service) CreateTemplate(ctx context.Context, tenantID, createdBy string, req *models.CreateTemplateRequest) (*models.WorkflowTemplate, error) {
	if req.Name == "" {
		return nil, errors.New("name is required")
	}
	if req.Definition == nil || !hasNodes(req.Definition) {
		return nil, errors.New("definition with nodes is required")
	}

	t := &models.WorkflowTemplate{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		Name:       req.Name,
		Definition: req.Definition,
		CreatedBy:  createdBy,
	}
	if req.Description != "" {
		t.Description = &req.Description
	}
	if req.Category != "" {
		t.Category = &req.Category
	}
	if req.Thumbnail != "" {
		t.Thumbnail = &req.Thumbnail
	}
	if len(req.Tags) > 0 {
		t.Tags = models.StringList(req.Tags)
	}

	err := s.repo.CreateTemplate(ctx, t)
	if err != nil {
		return nil, err
	}
	return t, nil
}

// ListTemplates lists templates for a tenant.
func (s *Service) ListTemplates(ctx context.Context, tenantID string, offset, limit int) ([]models.WorkflowTemplate, int, error) {
	if limit < 1 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.ListTemplates(ctx, tenantID, offset, limit)
}

// ApplyTemplate creates a workflow from a template.
func (s *Service) ApplyTemplate(ctx context.Context, tenantID, templateID, createdBy string, workflowName, description string) (*models.WorkflowDefinition, error) {
	tpl, err := s.repo.FindTemplateByID(ctx, tenantID, templateID)
	if err != nil {
		return nil, err
	}
	if tpl == nil {
		return nil, errors.New("template not found")
	}

	// Extract nodes and edges from definition
	nodes := toNodeList(tpl.Definition)
	edges := toEdgeList(tpl.Definition)

	d := &models.WorkflowDefinition{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      workflowName,
		Version:   1,
		Enabled:   false,
		Nodes:     nodes,
		Edges:     edges,
		CreatedBy: createdBy,
	}
	if description != "" {
		d.Description = &description
	} else if tpl.Description != nil {
		d.Description = tpl.Description
	}

	err = s.repo.CreateDef(ctx, d)
	if err != nil {
		return nil, err
	}

	// Increment usage count
	s.repo.IncrementTemplateUsage(ctx, templateID)

	return d, nil
}

// hasNodes checks if a definition map has a nodes array with content.
func hasNodes(def map[string]any) bool {
	nodes, ok := def["nodes"]
	if !ok {
		return false
	}
	arr, ok := nodes.([]any)
	return ok && len(arr) > 0
}

// toNodeList extracts WorkflowNodeList from a definition map.
func toNodeList(def map[string]any) models.WorkflowNodeList {
	nodes, ok := def["nodes"]
	if !ok {
		return models.WorkflowNodeList{}
	}
	arr, ok := nodes.([]any)
	if !ok {
		return models.WorkflowNodeList{}
	}
	list := make(models.WorkflowNodeList, 0, len(arr))
	for _, item := range arr {
		raw, err := json.Marshal(item)
		if err != nil {
			continue
		}
		var node models.WorkflowNode
		if err := json.Unmarshal(raw, &node); err != nil {
			continue
		}
		list = append(list, node)
	}
	return list
}

// toEdgeList extracts WorkflowEdgeList from a definition map.
func toEdgeList(def map[string]any) models.WorkflowEdgeList {
	edges, ok := def["edges"]
	if !ok {
		return models.WorkflowEdgeList{}
	}
	arr, ok := edges.([]any)
	if !ok {
		return models.WorkflowEdgeList{}
	}
	list := make(models.WorkflowEdgeList, 0, len(arr))
	for _, item := range arr {
		raw, err := json.Marshal(item)
		if err != nil {
			continue
		}
		var edge models.WorkflowEdge
		if err := json.Unmarshal(raw, &edge); err != nil {
			continue
		}
		list = append(list, edge)
	}
	return list
}
