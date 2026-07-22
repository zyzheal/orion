package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/workflow-svc-go/internal/workflow/models"
	"orion/workflow-svc-go/internal/workflow/repository"

	"github.com/google/uuid"
)

var ErrWorkflowNotFound = errors.New("workflow not found")

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ====== Legacy Workflow ======

func (s *Service) CreateWorkflow(ctx context.Context, tenantID string, req *models.CreateWorkflowRequest) (*models.Workflow, error) {
	w := &models.Workflow{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Steps:       models.JSONB(req.Steps),
		Status:      models.WfActive,
	}
	return w, s.repo.CreateWorkflow(ctx, w)
}

func (s *Service) ListWorkflows(ctx context.Context, tenantID string, offset, limit int) ([]models.Workflow, error) {
	return s.repo.ListWorkflows(ctx, tenantID, offset, limit)
}

func (s *Service) GetWorkflowByID(ctx context.Context, tenantID, id string) (*models.Workflow, error) {
	return s.repo.GetWorkflowByID(ctx, tenantID, id)
}

func (s *Service) DeleteWorkflow(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteWorkflow(ctx, tenantID, id)
}

func (s *Service) CountWorkflows(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountWorkflows(ctx, tenantID)
}

// ====== WorkflowRun ======

func (s *Service) StartRun(ctx context.Context, tenantID, wfID string) (*models.WorkflowRun, error) {
	if _, err := s.repo.GetWorkflowByID(ctx, tenantID, wfID); err != nil {
		return nil, ErrWorkflowNotFound
	}
	run := &models.WorkflowRun{
		ID:         uuid.New().String(),
		WorkflowID: wfID,
		TenantID:   tenantID,
		Status:     models.RunRunning,
		StartedAt:  time.Now(),
	}
	return run, s.repo.CreateRun(ctx, run)
}

func (s *Service) GetRun(ctx context.Context, id string) (*models.WorkflowRun, error) {
	return s.repo.GetRun(ctx, id)
}

// ====== Workflow Definition ======

func (s *Service) ListDefinitions(ctx context.Context, tenantID string, enabled *bool, offset, limit int) ([]models.WorkflowDefinition, error) {
	return s.repo.ListDefinitions(ctx, tenantID, enabled, offset, limit)
}

func (s *Service) GetDefinitionByID(ctx context.Context, tenantID, id string) (*models.WorkflowDefinition, error) {
	return s.repo.GetDefinitionByID(ctx, tenantID, id)
}

func (s *Service) CreateDefinition(ctx context.Context, tenantID string, req *models.CreateDefinitionRequest, createdBy string) (*models.WorkflowDefinition, error) {
	defID := uuid.New().String()
	nodes := buildNodes(req.Steps)
	edges := buildEdges(nodes)

	d := &models.WorkflowDefinition{
		ID:          defID,
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Nodes:       nodes,
		Edges:       edges,
		Enabled:     true,
		CreatedBy:   createdBy,
	}
	return d, s.repo.CreateDefinition(ctx, d)
}

func (s *Service) UpdateDefinition(ctx context.Context, tenantID, id string, req *models.UpdateDefinitionRequest) (*models.WorkflowDefinition, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
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

	return s.repo.UpdateDefinition(ctx, tenantID, id, updates)
}

func (s *Service) DeleteDefinition(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteDefinition(ctx, tenantID, id)
}

// ====== Workflow Instance ======

func (s *Service) CreateInstance(ctx context.Context, tenantID, definitionID string, req *models.CreateInstanceRequest) (*models.WorkflowInstance, error) {
	_, err := s.repo.GetDefinitionByID(ctx, tenantID, definitionID)
	if err != nil {
		return nil, ErrWorkflowNotFound
	}
	instID := "exec-" + time.Now().Format("20060102150405") + "-" + uuid.NewString()[:8]
	inst := &models.WorkflowInstance{
		ID:                   instID,
		WorkflowID:           definitionID,
		WorkflowDefinitionID: definitionID,
		TenantID:             tenantID,
		Status:               models.InstanceRunning,
		Input:                models.JSONB(req.InitialInput),
		TriggeredBy:          req.TriggeredBy,
	}
	return inst, s.repo.CreateInstance(ctx, inst)
}

func (s *Service) ListInstances(ctx context.Context, workflowID string, limit int) ([]models.WorkflowInstance, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return s.repo.ListInstancesByWorkflow(ctx, workflowID, limit)
}

func (s *Service) GetInstanceByID(ctx context.Context, id string) (*models.WorkflowInstance, error) {
	return s.repo.GetInstanceByID(ctx, id)
}

// ====== Workflow Trigger ======

func (s *Service) ListTriggers(ctx context.Context, tenantID string, workflowID *string, typ *models.TriggerType, enabled *bool, offset, limit int) ([]models.WorkflowTrigger, error) {
	return s.repo.ListTriggers(ctx, tenantID, workflowID, typ, enabled, offset, limit)
}

func (s *Service) GetTriggerByID(ctx context.Context, tenantID, id string) (*models.WorkflowTrigger, error) {
	return s.repo.GetTriggerByID(ctx, tenantID, id)
}

func (s *Service) CreateTrigger(ctx context.Context, tenantID string, createdBy string, req *models.CreateTriggerRequest) (*models.WorkflowTrigger, error) {
	t := &models.WorkflowTrigger{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		WorkflowID:    req.WorkflowID,
		Name:          req.Name,
		Type:          req.Type,
		Config:        models.JSONB(req.Config),
		WebhookSecret: req.WebhookSecret,
		WebhookPath:   req.WebhookPath,
		Enabled:       req.Enabled,
		CreatedBy:     createdBy,
	}
	return t, s.repo.CreateTrigger(ctx, t)
}

func (s *Service) UpdateTrigger(ctx context.Context, tenantID, id string, req *models.UpdateTriggerRequest) (*models.WorkflowTrigger, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Config != nil {
		updates["config"] = models.JSONB(*req.Config)
	}
	if req.WebhookSecret != nil {
		updates["webhook_secret"] = *req.WebhookSecret
	}
	if req.WebhookPath != nil {
		updates["webhook_path"] = *req.WebhookPath
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	return s.repo.UpdateTrigger(ctx, tenantID, id, updates)
}

func (s *Service) DeleteTrigger(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteTrigger(ctx, tenantID, id)
}

func (s *Service) SetTriggerEnabled(ctx context.Context, tenantID, id string, enabled bool) error {
	return s.repo.SetTriggerEnabled(ctx, tenantID, id, enabled)
}

func (s *Service) FindTriggerByWebhookPath(ctx context.Context, webhookPath string) (*models.WorkflowTrigger, error) {
	return s.repo.FindTriggerByWebhookPath(ctx, webhookPath)
}

// ====== Trigger Log ======

func (s *Service) CreateTriggerLog(ctx context.Context, req *models.CreateTriggerLogRequest) (*models.TriggerLog, error) {
	log := &models.TriggerLog{
		ID:           uuid.New().String(),
		TriggerID:    req.TriggerID,
		EventType:    req.EventType,
		EventPayload: models.JSONB(req.EventPayload),
		Status:       "pending",
	}
	return log, s.repo.CreateTriggerLog(ctx, log)
}

func (s *Service) UpdateTriggerLogStatus(ctx context.Context, id, status, errMsg string, durationMs *int) error {
	return s.repo.UpdateTriggerLogStatus(ctx, id, status, errMsg, durationMs)
}

// ====== Workflow Task ======

func (s *Service) ListTasks(ctx context.Context, tenantID string, assigneeID *string, status *models.TaskStatus, offset, limit int) ([]models.WorkflowTask, error) {
	return s.repo.ListTasks(ctx, tenantID, assigneeID, status, offset, limit)
}

func (s *Service) GetTaskByID(ctx context.Context, tenantID, id string) (*models.WorkflowTask, error) {
	return s.repo.GetTaskByID(ctx, tenantID, id)
}

func (s *Service) CreateTask(ctx context.Context, req *models.CreateTaskRequest) (*models.WorkflowTask, error) {
	t := &models.WorkflowTask{
		ID:                  uuid.New().String(),
		TenantID:            req.TenantID,
		WorkflowID:          req.WorkflowID,
		WorkflowInstanceID:  req.WorkflowInstanceID,
		NodeID:              req.NodeID,
		AssigneeID:          req.AssigneeID,
		Status:              models.TaskPending,
		Comment:             req.Comment,
		FormData:            models.JSONB(req.FormData),
	}
	return t, s.repo.CreateTask(ctx, t)
}

func (s *Service) ClaimTask(ctx context.Context, tenantID, id string, assigneeID string, comment *string) (*models.WorkflowTask, error) {
	task, err := s.repo.GetTaskByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrWorkflowNotFound
	}
	if task.Status != models.TaskPending {
		return nil, errors.New("task is not pending")
	}
	err = s.repo.UpdateTaskStatus(ctx, tenantID, id, models.TaskAssigned, &assigneeID, comment)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTaskByID(ctx, tenantID, id)
}

func (s *Service) CompleteTask(ctx context.Context, tenantID, id string, assigneeID string, comment *string, formData models.JSONB) (*models.WorkflowTask, error) {
	task, err := s.repo.GetTaskByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrWorkflowNotFound
	}
	if task.Status == models.TaskCompleted {
		return nil, errors.New("task already completed")
	}
	if task.Status == models.TaskCancelled {
		return nil, errors.New("task is cancelled")
	}
	return s.repo.CompleteTask(ctx, tenantID, id, models.TaskCompleted, &assigneeID, comment, formData)
}

// ====== Dependency Analysis ======

func (s *Service) AnalyzeDependencies(ctx context.Context, tenantID string) (*models.DependencyGraphResult, error) {
	defs, err := s.repo.GetAllDefinitionsForGraph(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	// Build dependency graph from nodes/edges
	edges := make([]models.DependencyEdge, 0)
	for _, d := range defs {
		nodesMap := make(map[string]string)
		if nodeArr := extractNodeArray(d.Nodes); nodeArr != nil {
			for _, n := range nodeArr {
				if n, ok := n.(map[string]interface{}); ok {
					if nid, ok := n["id"]; ok {
						nodesMap[fmt.Sprintf("%v", nid)] = d.ID
					}
				}
			}
		}
		if edgeArr := extractNodeArray(d.Edges); edgeArr != nil {
			for _, e := range edgeArr {
				if e, ok := e.(map[string]interface{}); ok {
					if src, ok := e["source"]; ok {
						if tgt, ok := e["target"]; ok {
							edges = append(edges, models.DependencyEdge{Source: nodesMap[fmt.Sprintf("%v", src)], Target: nodesMap[fmt.Sprintf("%v", tgt)]})
						}
					}
				}
			}
		}
	}
	cycles := findCycles(edges)
	return &models.DependencyGraphResult{
		IsSafe:           len(cycles) == 0,
		TotalDefinitions: len(defs),
		TotalEdges:       len(edges),
		Cycles:           cycles,
	}, nil
}

func (s *Service) CheckDefinition(ctx context.Context, tenantID, definitionID string) (*models.DefinitionCheckResult, error) {
	def, err := s.repo.GetDefinitionByID(ctx, tenantID, definitionID)
	if err != nil {
		return nil, ErrWorkflowNotFound
	}
	nodesMap := make(map[string]string)
	if nodeArr := extractNodeArray(def.Nodes); nodeArr != nil {
		for _, n := range nodeArr {
			if n, ok := n.(map[string]interface{}); ok {
				if nid, ok := n["id"]; ok {
					nodesMap[fmt.Sprintf("%v", nid)] = def.ID
				}
			}
		}
	}
	edges := make([]models.DependencyEdge, 0)
	if edgeArr := extractNodeArray(def.Edges); edgeArr != nil {
		for _, e := range edgeArr {
			if e, ok := e.(map[string]interface{}); ok {
				if src, ok := e["source"]; ok {
					if tgt, ok := e["target"]; ok {
						edges = append(edges, models.DependencyEdge{Source: nodesMap[fmt.Sprintf("%v", src)], Target: nodesMap[fmt.Sprintf("%v", tgt)]})
					}
				}
			}
		}
	}
	cycles := findCycles(edges)
	return &models.DefinitionCheckResult{
		DefinitionID: definitionID,
		IsSafe:       len(cycles) == 0,
		Dependencies: edges,
		Cycles:       cycles,
	}, nil
}

func (s *Service) GetVisualizationData(ctx context.Context, tenantID string) (*models.VisualizationData, error) {
	defs, err := s.repo.GetAllDefinitionsForGraph(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	nodes := make([]models.JSONB, 0)
	edges := make([]models.JSONB, 0)
	for _, d := range defs {
		nodes = append(nodes, models.JSONB{"id": d.ID, "name": d.Name, "type": "workflow"})
	}
	for _, d := range defs {
		if edgeArr := extractNodeArray(d.Edges); edgeArr != nil {
			for _, e := range edgeArr {
				if e, ok := e.(map[string]interface{}); ok {
					if src, ok := e["source"]; ok {
						if tgt, ok := e["target"]; ok {
							edges = append(edges, models.JSONB{"source": fmt.Sprintf("%v", src), "target": fmt.Sprintf("%v", tgt)})
						}
					}
				}
			}
		}
	}
	return &models.VisualizationData{Nodes: nodes, Edges: edges}, nil
}

// ====== Helpers ======

func buildNodes(steps []models.StepRequest) models.JSONB {
	result := make([]models.JSONB, len(steps))
	for i, step := range steps {
		result[i] = models.JSONB{
			"id":       step.ID,
			"type":     step.Type,
			"name":     step.Name,
			"config":   step.Config,
			"position": models.JSONB{"x": 20 + i*230, "y": 100},
		}
	}
	return models.JSONB{"nodes": result}
}

func buildEdges(nodes models.JSONB) models.JSONB {
	list, _ := nodes["nodes"].([]interface{})
	edges := make([]models.JSONB, 0)
	for i := 0; i < len(list)-1; i++ {
		n1, _ := list[i].(models.JSONB)
		n2, _ := list[i+1].(models.JSONB)
		edges = append(edges, models.JSONB{
			"id":     "edge-" + string(rune(i+1)),
			"source": n1["id"],
			"target": n2["id"],
		})
	}
	return models.JSONB{"edges": edges}
}

func findCycles(edges []models.DependencyEdge) []models.CycleResult {
	graph := make(map[string][]string)
	nodes := make(map[string]bool)
	for _, e := range edges {
		graph[e.Source] = append(graph[e.Source], e.Target)
		nodes[e.Source] = true
		nodes[e.Target] = true
	}
	visited := make(map[string]int) // 0=unvisited, 1=visiting, 2=done
	cycles := []models.CycleResult{}
	var dfs func(string, []string)
	dfs = func(n string, path []string) {
		visited[n] = 1
		for _, nb := range graph[n] {
			if visited[nb] == 1 {
				// Found cycle
				cycleStart := -1
				for i, p := range path {
					if p == nb {
						cycleStart = i
						break
					}
				}
				var cycle []string
				if cycleStart >= 0 {
					cycle = append(path[cycleStart:], nb)
				} else {
					cycle = append(path, nb)
				}
				cycles = append(cycles, models.CycleResult{Cycle: cycle, Safe: false})
			} else if visited[nb] == 0 {
				dfs(nb, append(path, n))
			}
		}
		visited[n] = 2
	}
	for n := range nodes {
		if visited[n] == 0 {
			dfs(n, []string{})
		}
	}
	return cycles
}

// extractNodeArray extracts the inner []interface{} array from a JSONB map
// that may store it under a "nodes"/"edges" key, or return nil if absent.
func extractNodeArray(jb models.JSONB) []interface{} {
	if jb == nil {
		return nil
	}
	// Direct list-style: some callers store top-level as []interface{}.
	// JSONB is a map, so check the "nodes"/"edges" key.
	for k, v := range jb {
		if k == "nodes" || k == "edges" {
			if arr, ok := v.([]interface{}); ok {
				return arr
			}
		}
	}
	return nil
}
