package service

import (
	"context"
	"database/sql"
	"testing"

	"orion/platform-svc-go/internal/workflow/models"
	"orion/platform-svc-go/internal/workflow/repository"
)

// mockRepo embeds the real repository so method signatures match, but overrides every call.
type mockRepo struct {
	*repository.Repository

	workflows map[string]*models.Workflow
	execs     map[string]*models.WorkflowExecution
	wfErr     error
	execErr   error
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		Repository: &repository.Repository{}, // nil db – all methods overridden
		workflows:  map[string]*models.Workflow{},
		execs:      map[string]*models.WorkflowExecution{},
	}
}

// --- Workflow definition methods ---

func (m *mockRepo) GetByID(_ context.Context, id string, tenantID string) (*models.Workflow, error) {
	if m.wfErr != nil {
		return nil, m.wfErr
	}
	wf, ok := m.workflows[tenantID+":"+id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return wf, nil
}

func (m *mockRepo) Create(_ context.Context, wf *models.Workflow) error {
	if m.wfErr != nil {
		return m.wfErr
	}
	if wf.ID == "" {
		wf.ID = wf.ID + "generated-id"
	}
	m.workflows[wf.TenantID+":"+wf.ID] = wf
	return nil
}

func (m *mockRepo) List(_ context.Context, tenantID string, status *string, limit, offset int) ([]models.Workflow, error) {
	if m.wfErr != nil {
		return nil, m.wfErr
	}
	var out []models.Workflow
	for _, wf := range m.workflows {
		if wf.TenantID != tenantID {
			continue
		}
		if status != nil && *status != "" {
			if *status == "enabled" && !wf.Enabled {
				continue
			}
			if *status == "disabled" && wf.Enabled {
				continue
			}
		}
		out = append(out, *wf)
	}
	return out, nil
}

func (m *mockRepo) Count(_ context.Context, tenantID string, status *string) (int, error) {
	if m.wfErr != nil {
		return 0, m.wfErr
	}
	c := 0
	for _, wf := range m.workflows {
		if wf.TenantID != tenantID {
			continue
		}
		if status != nil && *status != "" {
			if *status == "enabled" && !wf.Enabled {
				continue
			}
			if *status == "disabled" && wf.Enabled {
				continue
			}
		}
		c++
	}
	return c, nil
}

func (m *mockRepo) Update(_ context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Workflow, error) {
	if m.wfErr != nil {
		return nil, m.wfErr
	}
	if len(updates) == 0 {
		return nil, repository.ErrNotFound
	}
	wf, ok := m.workflows[tenantID+":"+id]
	if !ok {
		return nil, repository.ErrNotFound
	}
	// Apply updates (best-effort for testing)
	if v, ok := updates["name"]; ok {
		wf.Name = v.(string)
	}
	if v, ok := updates["nodes"]; ok {
		wf.Nodes = v.(string)
	}
	if v, ok := updates["edges"]; ok {
		wf.Edges = v.(string)
	}
	if v, ok := updates["enabled"]; ok {
		wf.Enabled = v.(bool)
	}
	return wf, nil
}

func (m *mockRepo) Delete(_ context.Context, id string, tenantID string) (bool, error) {
	if m.wfErr != nil {
		return false, m.wfErr
	}
	_, ok := m.workflows[tenantID+":"+id]
	if !ok {
		return false, nil
	}
	delete(m.workflows, tenantID+":"+id)
	return true, nil
}

func (m *mockRepo) SetEnabled(_ context.Context, id string, tenantID string, enabled bool) (*models.Workflow, error) {
	if m.wfErr != nil {
		return nil, m.wfErr
	}
	wf, ok := m.workflows[tenantID+":"+id]
	if !ok {
		return nil, repository.ErrNotFound
	}
	wf.Enabled = enabled
	return wf, nil
}

// --- Workflow execution methods ---

func (m *mockRepo) CreateExecution(_ context.Context, exec *models.WorkflowExecution) error {
	if m.execErr != nil {
		return m.execErr
	}
	if exec.ID == "" {
		exec.ID = "exec-generated-id"
	}
	m.execs[exec.WorkflowDefinitionID+":"+exec.ID] = exec
	return nil
}

func (m *mockRepo) GetExecutionByID(_ context.Context, id string, tenantID string) (*models.WorkflowExecution, error) {
	if m.execErr != nil {
		return nil, m.execErr
	}
	for _, e := range m.execs {
		if e.ID == id && e.WorkflowDefinitionID != "" {
			return e, nil
		}
	}
	return nil, sql.ErrNoRows
}

func (m *mockRepo) ListExecutionsByWorkflowID(_ context.Context, workflowID string, tenantID string, limit, offset int) ([]models.WorkflowExecution, error) {
	if m.execErr != nil {
		return nil, m.execErr
	}
	var out []models.WorkflowExecution
	for _, e := range m.execs {
		if e.WorkflowDefinitionID == workflowID {
			out = append(out, *e)
		}
	}
	return out, nil
}

func (m *mockRepo) CountExecutionsByWorkflowID(_ context.Context, workflowID string, tenantID string) (int, error) {
	if m.execErr != nil {
		return 0, m.execErr
	}
	c := 0
	for _, e := range m.execs {
		if e.WorkflowDefinitionID == workflowID {
			c++
		}
	}
	return c, nil
}

func newTestService(repo *mockRepo) *Service {
	return &Service{repo: repo}
}

func setupWorkflow(repo *mockRepo, tenantID, id string) *models.Workflow {
	wf := &models.Workflow{ID: id, TenantID: tenantID, Name: "test wf", Enabled: true, Version: "1.0", Nodes: "[]", Edges: "[]"}
	repo.workflows[tenantID+":"+id] = wf
	return wf
}

// --- List ---

func TestListWorkflows_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	_ = setupWorkflow(repo, "t1", "wf-1")
	wf2 := setupWorkflow(repo, "t1", "wf-2")
	wf2.Enabled = false
	svc := newTestService(repo)

	result, total, err := svc.List(ctx, "t1", nil, 1, 20)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total != 2 {
		t.Errorf("expected total 2, got %d", total)
	}
	if len(result) != 2 {
		t.Errorf("expected 2 workflows, got %d", len(result))
	}
}

func TestListWorkflows_FilterEnabled(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	_ = setupWorkflow(repo, "t1", "wf-1")
	setupWorkflow(repo, "t1", "wf-2").Enabled = false
	svc := newTestService(repo)
	status := "enabled"

	result, total, err := svc.List(ctx, "t1", &status, 1, 20)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if result[0].ID != "wf-1" {
		t.Errorf("expected wf-1, got %s", result[0].ID)
	}
}

func TestListWorkflows_Empty(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := newTestService(repo)

	result, total, err := svc.List(ctx, "t1", nil, 1, 20)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total != 0 {
		t.Errorf("expected total 0, got %d", total)
	}
	if result == nil {
		t.Error("expected non-nil slice")
	}
}

func TestListWorkflows_RepoError(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	repo.wfErr = sql.ErrConnDone
	svc := newTestService(repo)

	_, _, err := svc.List(ctx, "t1", nil, 1, 20)
	if err != repo.wfErr {
		t.Errorf("expected repo error, got %v", err)
	}
}

// --- Get ---

func TestGetWorkflow_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	setupWorkflow(repo, "t1", "wf-1")
	svc := newTestService(repo)

	wf, err := svc.Get(ctx, "wf-1", "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if wf.Name != "test wf" {
		t.Errorf("expected 'test wf', got %s", wf.Name)
	}
}

func TestGetWorkflow_NotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := newTestService(repo)

	_, err := svc.Get(ctx, "wf-999", "t1")
	if err != ErrWorkflowNotFound {
		t.Errorf("expected ErrWorkflowNotFound, got %v", err)
	}
}

func TestGetWorkflow_RepoError(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	repo.wfErr = sql.ErrConnDone
	svc := newTestService(repo)

	_, err := svc.Get(ctx, "wf-1", "t1")
	if err != sql.ErrConnDone {
		t.Errorf("expected sql.ErrConnDone, got %v", err)
	}
}

// --- Create ---

func TestCreateWorkflow_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := newTestService(repo)

	req := &models.CreateWorkflowRequest{Name: "new wf"}
	nodes := "[{\"id\":\"n1\"}]"
	req.Nodes = &nodes

	wf, err := svc.Create(ctx, req, "t1", "u1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if wf.Name != "new wf" {
		t.Errorf("expected 'new wf', got %s", wf.Name)
	}
	if wf.CreatedBy != "u1" {
		t.Errorf("expected createdBy 'u1', got %s", wf.CreatedBy)
	}
	if wf.Enabled != true {
		t.Error("expected enabled true")
	}
	if wf.Version != "1.0" {
		t.Errorf("expected version 1.0, got %s", wf.Version)
	}
}

func TestCreateWorkflow_DefaultsNodesEdges(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := newTestService(repo)

	wf, err := svc.Create(ctx, &models.CreateWorkflowRequest{Name: "minimal"}, "t1", "u1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if wf.Nodes != "[]" {
		t.Errorf("expected nodes '[]', got %s", wf.Nodes)
	}
	if wf.Edges != "[]" {
		t.Errorf("expected edges '[]', got %s", wf.Edges)
	}
}

func TestCreateWorkflow_RepoError(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	repo.wfErr = sql.ErrConnDone
	svc := newTestService(repo)

	_, err := svc.Create(ctx, &models.CreateWorkflowRequest{Name: "bad"}, "t1", "u1")
	if err != sql.ErrConnDone {
		t.Errorf("expected sql.ErrConnDone, got %v", err)
	}
}

// --- Update ---

func TestUpdateWorkflow_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	setupWorkflow(repo, "t1", "wf-1")
	svc := newTestService(repo)

	name := "updated wf"
	req := &models.UpdateWorkflowRequest{Name: &name}

	wf, err := svc.Update(ctx, "wf-1", req, "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if wf.Name != "updated wf" {
		t.Errorf("expected 'updated wf', got %s", wf.Name)
	}
}

func TestUpdateWorkflow_NoFields(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	setupWorkflow(repo, "t1", "wf-1")
	svc := newTestService(repo)

	_, err := svc.Update(ctx, "wf-1", &models.UpdateWorkflowRequest{}, "t1")
	if err == nil {
		t.Fatal("expected error for no fields")
	}
}

func TestUpdateWorkflow_NotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := newTestService(repo)

	_, err := svc.Update(ctx, "wf-999", &models.UpdateWorkflowRequest{Name: strPtr("x")}, "t1")
	if err != ErrWorkflowNotFound {
		t.Errorf("expected ErrWorkflowNotFound, got %v", err)
	}
}

// --- Delete ---

func TestDeleteWorkflow_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	setupWorkflow(repo, "t1", "wf-1")
	svc := newTestService(repo)

	deleted, err := svc.Delete(ctx, "wf-1", "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !deleted {
		t.Error("expected deleted true")
	}
}

func TestDeleteWorkflow_NotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := newTestService(repo)

	deleted, err := svc.Delete(ctx, "wf-999", "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if deleted {
		t.Error("expected deleted false for non-existent")
	}
}

// --- Pause / Resume ---

func TestPauseWorkflow_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	setupWorkflow(repo, "t1", "wf-1")
	svc := newTestService(repo)

	wf, err := svc.Pause(ctx, "wf-1", "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if wf.Enabled {
		t.Error("expected workflow disabled after pause")
	}
}

func TestPauseWorkflow_NotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := newTestService(repo)

	_, err := svc.Pause(ctx, "wf-999", "t1")
	if err != ErrWorkflowNotFound {
		t.Errorf("expected ErrWorkflowNotFound, got %v", err)
	}
}

func TestResumeWorkflow_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	setupWorkflow(repo, "t1", "wf-1")
	svc := newTestService(repo)

	wf, err := svc.Resume(ctx, "wf-1", "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !wf.Enabled {
		t.Error("expected workflow enabled after resume")
	}
}

func TestResumeWorkflow_NotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := newTestService(repo)

	_, err := svc.Resume(ctx, "wf-999", "t1")
	if err != ErrWorkflowNotFound {
		t.Errorf("expected ErrWorkflowNotFound, got %v", err)
	}
}

// --- Execute ---

func TestExecuteWorkflow_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	setupWorkflow(repo, "t1", "wf-1")
	svc := newTestService(repo)

	exec, err := svc.Execute(ctx, "wf-1", "t1", "u1", `{"k":"v"}`)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if exec.Status != "running" {
		t.Errorf("expected status 'running', got %s", exec.Status)
	}
	if exec.Input != `{"k":"v"}` {
		t.Errorf("expected input with key, got %s", exec.Input)
	}
	if exec.TriggeredBy != "u1" {
		t.Errorf("expected triggeredBy 'u1', got %s", exec.TriggeredBy)
	}
}

func TestExecuteWorkflow_DefaultsInput(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	setupWorkflow(repo, "t1", "wf-1")
	svc := newTestService(repo)

	exec, err := svc.Execute(ctx, "wf-1", "t1", "u1", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if exec.Input != "{}" {
		t.Errorf("expected default input '{}', got %s", exec.Input)
	}
}

func TestExecuteWorkflow_Disabled(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	setupWorkflow(repo, "t1", "wf-1").Enabled = false
	svc := newTestService(repo)

	_, err := svc.Execute(ctx, "wf-1", "t1", "u1", "")
	if err != ErrWorkflowDisabled {
		t.Errorf("expected ErrWorkflowDisabled, got %v", err)
	}
}

func TestExecuteWorkflow_NotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := newTestService(repo)

	_, err := svc.Execute(ctx, "wf-999", "t1", "u1", "")
	if err != ErrWorkflowNotFound {
		t.Errorf("expected ErrWorkflowNotFound, got %v", err)
	}
}

// --- ListExecutions ---

func TestListExecutions_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	setupWorkflow(repo, "t1", "wf-1")
	svc := newTestService(repo)

	// Create two executions
	_ = repo.CreateExecution(ctx, &models.WorkflowExecution{ID: "e1", WorkflowID: "wf-1", WorkflowDefinitionID: "wf-1"})
	_ = repo.CreateExecution(ctx, &models.WorkflowExecution{ID: "e2", WorkflowID: "wf-1", WorkflowDefinitionID: "wf-1"})

	_, total, err := svc.ListExecutions(ctx, "wf-1", "t1", 1, 20)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total != 2 {
		t.Errorf("expected total 2, got %d", total)
	}
}

func TestListExecutions_Empty(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := newTestService(repo)

	result, total, err := svc.ListExecutions(ctx, "wf-1", "t1", 1, 20)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total != 0 {
		t.Errorf("expected total 0, got %d", total)
	}
	if result == nil {
		t.Error("expected non-nil slice")
	}
}

// --- GetExecution ---

func TestGetExecution_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	repo.CreateExecution(ctx, &models.WorkflowExecution{ID: "e1", WorkflowDefinitionID: "wf-1"})
	svc := newTestService(repo)

	exec, err := svc.GetExecution(ctx, "e1", "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if exec.ID != "e1" {
		t.Errorf("expected ID e1, got %s", exec.ID)
	}
}

func TestGetExecution_NotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := newTestService(repo)

	_, err := svc.GetExecution(ctx, "e-999", "t1")
	if err != ErrExecutionNotFound {
		t.Errorf("expected ErrExecutionNotFound, got %v", err)
	}
}

// --- Errors ---

func TestServiceErrors(t *testing.T) {
	tests := []struct {
		err  error
		msg  string
	}{
		{ErrWorkflowNotFound, "workflow not found"},
		{ErrExecutionNotFound, "workflow execution not found"},
		{ErrWorkflowDisabled, "workflow is disabled"},
	}
	for _, tt := range tests {
		if tt.err.Error() != tt.msg {
			t.Errorf("expected %q, got %q", tt.msg, tt.err.Error())
		}
	}
}

func TestIsNotFound(t *testing.T) {
	if !IsNotFound(ErrWorkflowNotFound) {
		t.Error("expected IsNotFound true for ErrWorkflowNotFound")
	}
	if !IsNotFound(ErrExecutionNotFound) {
		t.Error("expected IsNotFound true for ErrExecutionNotFound")
	}
	if IsNotFound(ErrWorkflowDisabled) {
		t.Error("expected IsNotFound false for ErrWorkflowDisabled")
	}
}

func strPtr(s string) *string {
	return &s
}
