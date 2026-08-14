package service_test

import (
	"context"
	"testing"
	"time"

	"orion/platform-svc-go/internal/integration-handler/models"
	"orion/platform-svc-go/internal/integration-handler/service"
)

// ---------------------------------------------------------------------------
// Fake repository implementation
// ---------------------------------------------------------------------------

type fakeIntegrationRepo struct {
	createIntegrationCalls    int
	getIntegrationByTenant    *models.Integration
	getIntegrationByTenantErr error
	listIntegrationsCalls     int
	listIntegrationsResult    []models.Integration
	listIntegrationsErr       error
	updateIntegrationResult   *models.Integration
	updateIntegrationErr      error
	deleteIntegrationErr      error
	countIntegrationsResult   int
	countIntegrationsErr      error
	createTaskResult          *models.IntegrationTask
	createTaskErr             error
	getTaskByTenant           *models.IntegrationTask
	getTaskByTenantErr        error
	listTasksByIntegrationErr error
	listTasksByIntegration    []models.IntegrationTask
	updateTaskStatusResult    *models.IntegrationTask
	updateTaskStatusErr       error
	deleteTaskErr             error
}

var _ service.RepositoryInterface = (*fakeIntegrationRepo)(nil)

func (f *fakeIntegrationRepo) CreateIntegration(ctx context.Context, tenantID, name, intType, handlerType string, config map[string]string) (*models.Integration, error) {
	f.createIntegrationCalls++
	now := time.Now().UTC()
	return &models.Integration{
		ID:          "gen-id",
		TenantID:    tenantID,
		Name:        name,
		Type:        intType,
		HandlerType: handlerType,
		Config:      "{}",
		Status:      string(models.IntegrationStatusEnabled),
		Enabled:     true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (f *fakeIntegrationRepo) GetIntegrationByTenant(ctx context.Context, tenantID, id string) (*models.Integration, error) {
	if f.getIntegrationByTenantErr != nil {
		return nil, f.getIntegrationByTenantErr
	}
	return f.getIntegrationByTenant, nil
}

func (f *fakeIntegrationRepo) ListIntegrations(ctx context.Context, tenantID, intType string, offset, limit int) ([]models.Integration, error) {
	f.listIntegrationsCalls++
	return f.listIntegrationsResult, f.listIntegrationsErr
}

func (f *fakeIntegrationRepo) UpdateIntegration(ctx context.Context, tenantID, id string, name, intType, handlerType *string, config map[string]string, status *string, enabled *bool) (*models.Integration, error) {
	return f.updateIntegrationResult, f.updateIntegrationErr
}

func (f *fakeIntegrationRepo) DeleteIntegration(ctx context.Context, tenantID, id string) error {
	return f.deleteIntegrationErr
}

func (f *fakeIntegrationRepo) CountIntegrations(ctx context.Context, tenantID string) (int, error) {
	return f.countIntegrationsResult, f.countIntegrationsErr
}

func (f *fakeIntegrationRepo) CreateTask(ctx context.Context, tenantID, integrationID, direction string, data map[string]interface{}) (*models.IntegrationTask, error) {
	if f.createTaskErr != nil {
		return nil, f.createTaskErr
	}
	now := time.Now().UTC()
	if f.createTaskResult != nil {
		return f.createTaskResult, nil
	}
	return &models.IntegrationTask{
		ID:            "gen-task-id",
		TenantID:      tenantID,
		IntegrationID: integrationID,
		Direction:     direction,
		Data:          "{}",
		Status:        string(models.TaskStatusPending),
		StartedAt:     now,
		CreatedAt:     now,
	}, nil
}

func (f *fakeIntegrationRepo) GetTaskByTenant(ctx context.Context, tenantID, id string) (*models.IntegrationTask, error) {
	if f.getTaskByTenantErr != nil {
		return nil, f.getTaskByTenantErr
	}
	return f.getTaskByTenant, nil
}

func (f *fakeIntegrationRepo) ListTasksByIntegration(ctx context.Context, tenantID, integrationID, status string, offset, limit int) ([]models.IntegrationTask, error) {
	return f.listTasksByIntegration, f.listTasksByIntegrationErr
}

func (f *fakeIntegrationRepo) UpdateTaskStatus(ctx context.Context, tenantID, id string, status, errMsg, response string, durationMs int64, finishedAt *time.Time) (*models.IntegrationTask, error) {
	return f.updateTaskStatusResult, f.updateTaskStatusErr
}

func (f *fakeIntegrationRepo) DeleteTask(ctx context.Context, tenantID, id string) error {
	return f.deleteTaskErr
}

func (f *fakeIntegrationRepo) ListLogsByTask(ctx context.Context, taskID string, offset, limit int) ([]models.IntegrationLog, error) {
	return nil, nil
}

func (f *fakeIntegrationRepo) CreateLog(ctx context.Context, taskID, level, message, details string) (*models.IntegrationLog, error) {
	return nil, nil
}

// ---------------------------------------------------------------------------
// Service construction tests
// ---------------------------------------------------------------------------

func TestService_NewServiceWithRepo_NonNil(t *testing.T) {
	s := service.NewServiceWithRepo(&fakeIntegrationRepo{})
	if s == nil {
		t.Fatal("NewServiceWithRepo returned nil")
	}
}

func TestService_NewServiceWithRepo_NilRepo(t *testing.T) {
	s := service.NewServiceWithRepo(nil)
	if s == nil {
		t.Fatal("NewServiceWithRepo returned nil")
	}
}

// ---------------------------------------------------------------------------
// Integration CRUD tests
// ---------------------------------------------------------------------------

func TestService_CreateIntegration(t *testing.T) {
	repo := &fakeIntegrationRepo{}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	req := &models.CreateIntegrationRequest{
		Name:        "jenkins",
		Type:        "rest_api",
		HandlerType: "RestAPIHandler",
		Config:      map[string]string{"url": "https://jenkins.example.com"},
	}

	integration, err := s.CreateIntegration(ctx, "tenant-1", req)
	if err != nil {
		t.Fatalf("CreateIntegration returned error: %v", err)
	}
	if integration == nil {
		t.Fatal("CreateIntegration returned nil integration")
	}
	if integration.Name != "jenkins" {
		t.Errorf("expected name jenkins, got %s", integration.Name)
	}
	if integration.Type != "rest_api" {
		t.Errorf("expected type rest_api, got %s", integration.Type)
	}
	if integration.HandlerType != "RestAPIHandler" {
		t.Errorf("expected handler_type RestAPIHandler, got %s", integration.HandlerType)
	}
	if integration.TenantID != "tenant-1" {
		t.Errorf("expected tenant_id tenant-1, got %s", integration.TenantID)
	}
	if integration.Status != string(models.IntegrationStatusEnabled) {
		t.Errorf("expected status enabled, got %s", integration.Status)
	}
	if !integration.Enabled {
		t.Error("expected enabled=true")
	}
	if repo.createIntegrationCalls != 1 {
		t.Errorf("expected 1 call to repo.CreateIntegration, got %d", repo.createIntegrationCalls)
	}
}

func TestService_GetIntegration_Found(t *testing.T) {
	expected := &models.Integration{
		ID:       "int-1",
		TenantID: "tenant-1",
		Name:     "gitlab-webhook",
		Type:     "webhook",
		Status:   "enabled",
	}
	repo := &fakeIntegrationRepo{getIntegrationByTenant: expected}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	integration, err := s.GetIntegration(ctx, "tenant-1", "int-1")
	if err != nil {
		t.Fatalf("GetIntegration returned error: %v", err)
	}
	if integration == nil {
		t.Fatal("GetIntegration returned nil")
	}
	if integration.ID != "int-1" {
		t.Errorf("expected id int-1, got %s", integration.ID)
	}
	if integration.Name != "gitlab-webhook" {
		t.Errorf("expected name gitlab-webhook, got %s", integration.Name)
	}
}

func TestService_GetIntegration_NotFound(t *testing.T) {
	repo := &fakeIntegrationRepo{getIntegrationByTenantErr: context.DeadlineExceeded}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	_, err := s.GetIntegration(ctx, "tenant-1", "nonexistent")
	if err == nil {
		t.Fatal("expected error for not-found, got nil")
	}
}

func TestService_ListIntegrations(t *testing.T) {
	expected := []models.Integration{
		{ID: "int-1", Name: "jenkins", Type: "rest_api"},
		{ID: "int-2", Name: "gitlab", Type: "webhook"},
	}
	repo := &fakeIntegrationRepo{listIntegrationsResult: expected}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	list, err := s.ListIntegrations(ctx, "tenant-1", "rest_api", 0, 10)
	if err != nil {
		t.Fatalf("ListIntegrations returned error: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 integrations, got %d", len(list))
	}
	if list[0].Name != "jenkins" {
		t.Errorf("expected first name jenkins, got %s", list[0].Name)
	}
	if list[1].Name != "gitlab" {
		t.Errorf("expected second name gitlab, got %s", list[1].Name)
	}
	if repo.listIntegrationsCalls != 1 {
		t.Errorf("expected 1 call, got %d", repo.listIntegrationsCalls)
	}
}

func TestService_ListIntegrations_EmptyResult(t *testing.T) {
	repo := &fakeIntegrationRepo{listIntegrationsResult: []models.Integration{}}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	list, err := s.ListIntegrations(ctx, "tenant-1", "", 0, 10)
	if err != nil {
		t.Fatalf("ListIntegrations returned error: %v", err)
	}
	if list == nil {
		t.Fatal("expected empty list not nil")
	}
	if len(list) != 0 {
		t.Errorf("expected empty list, got %d items", len(list))
	}
}

func TestService_UpdateIntegration(t *testing.T) {
	namePtr := "updated-jenkins"
	typePtr := "webhook"
	expected := &models.Integration{
		ID:   "int-1",
		Name: "updated-jenkins",
		Type: "webhook",
	}
	repo := &fakeIntegrationRepo{updateIntegrationResult: expected}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	req := &models.UpdateIntegrationRequest{
		Name:        &namePtr,
		Type:        &typePtr,
		HandlerType: nil,
	}

	integration, err := s.UpdateIntegration(ctx, "tenant-1", "int-1", req)
	if err != nil {
		t.Fatalf("UpdateIntegration returned error: %v", err)
	}
	if integration == nil {
		t.Fatal("UpdateIntegration returned nil")
	}
	if integration.Name != "updated-jenkins" {
		t.Errorf("expected name updated-jenkins, got %s", integration.Name)
	}
}

func TestService_DeleteIntegration_Success(t *testing.T) {
	repo := &fakeIntegrationRepo{}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	err := s.DeleteIntegration(ctx, "tenant-1", "int-1")
	if err != nil {
		t.Fatalf("DeleteIntegration returned error: %v", err)
	}
}

func TestService_DeleteIntegration_Error(t *testing.T) {
	repo := &fakeIntegrationRepo{deleteIntegrationErr: context.DeadlineExceeded}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	err := s.DeleteIntegration(ctx, "tenant-1", "int-1")
	if err == nil {
		t.Fatal("expected error from DeleteIntegration, got nil")
	}
}

func TestService_CountIntegrations(t *testing.T) {
	repo := &fakeIntegrationRepo{countIntegrationsResult: 42}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	count, err := s.CountIntegrations(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("CountIntegrations returned error: %v", err)
	}
	if count != 42 {
		t.Errorf("expected count 42, got %d", count)
	}
}

// ---------------------------------------------------------------------------
// Task CRUD tests
// ---------------------------------------------------------------------------

func TestService_CreateTask(t *testing.T) {
	repo := &fakeIntegrationRepo{}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	req := &models.CreateTaskRequest{
		IntegrationID: "int-1",
		Direction:     "outbound",
		Data:          map[string]interface{}{"key": "value"},
	}

	task, err := s.CreateTask(ctx, "tenant-1", req)
	if err != nil {
		t.Fatalf("CreateTask returned error: %v", err)
	}
	if task == nil {
		t.Fatal("CreateTask returned nil task")
	}
	if task.IntegrationID != "int-1" {
		t.Errorf("expected integration_id int-1, got %s", task.IntegrationID)
	}
	if task.Direction != "outbound" {
		t.Errorf("expected direction outbound, got %s", task.Direction)
	}
	if task.Status != string(models.TaskStatusPending) {
		t.Errorf("expected status pending, got %s", task.Status)
	}
}

func TestService_GetTask_Found(t *testing.T) {
	expected := &models.IntegrationTask{
		ID:            "task-1",
		TenantID:      "tenant-1",
		IntegrationID: "int-1",
		Direction:     "inbound",
		Status:        "completed",
	}
	repo := &fakeIntegrationRepo{getTaskByTenant: expected}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	task, err := s.GetTask(ctx, "tenant-1", "task-1")
	if err != nil {
		t.Fatalf("GetTask returned error: %v", err)
	}
	if task == nil {
		t.Fatal("GetTask returned nil")
	}
	if task.ID != "task-1" {
		t.Errorf("expected id task-1, got %s", task.ID)
	}
	if task.Status != "completed" {
		t.Errorf("expected status completed, got %s", task.Status)
	}
}

func TestService_GetTask_NotFound(t *testing.T) {
	repo := &fakeIntegrationRepo{getTaskByTenantErr: context.DeadlineExceeded}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	_, err := s.GetTask(ctx, "tenant-1", "missing")
	if err == nil {
		t.Fatal("expected error for not-found, got nil")
	}
}

func TestService_ListTasks(t *testing.T) {
	expected := []models.IntegrationTask{
		{ID: "task-1", IntegrationID: "int-1", Status: "completed"},
		{ID: "task-2", IntegrationID: "int-1", Status: "failed"},
	}
	repo := &fakeIntegrationRepo{listTasksByIntegration: expected}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	tasks, err := s.ListTasks(ctx, "tenant-1", "int-1", "completed", 0, 10)
	if err != nil {
		t.Fatalf("ListTasks returned error: %v", err)
	}
	if len(tasks) != 2 {
		t.Fatalf("expected 2 tasks, got %d", len(tasks))
	}
	if tasks[0].ID != "task-1" {
		t.Errorf("expected first task id task-1, got %s", tasks[0].ID)
	}
}

func TestService_ListTasks_Empty(t *testing.T) {
	repo := &fakeIntegrationRepo{listTasksByIntegration: []models.IntegrationTask{}}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	tasks, err := s.ListTasks(ctx, "tenant-1", "", "", 0, 10)
	if err != nil {
		t.Fatalf("ListTasks returned error: %v", err)
	}
	if len(tasks) != 0 {
		t.Errorf("expected 0 tasks, got %d", len(tasks))
	}
}

func TestService_UpdateTaskStatus(t *testing.T) {
	expected := &models.IntegrationTask{
		ID:     "task-1",
		Status: "completed",
	}
	repo := &fakeIntegrationRepo{updateTaskStatusResult: expected}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	task, err := s.UpdateTaskStatus(ctx, "tenant-1", "task-1", "completed", "", "ok", 150)
	if err != nil {
		t.Fatalf("UpdateTaskStatus returned error: %v", err)
	}
	if task == nil {
		t.Fatal("UpdateTaskStatus returned nil")
	}
	if task.Status != "completed" {
		t.Errorf("expected status completed, got %s", task.Status)
	}
}

func TestService_UpdateTaskStatus_WithFinishedAt(t *testing.T) {
	// Verify that the Service passes a non-nil finishedAt to the repo.
	// We can't directly inspect the arg, but we confirm the result is propagated.
	expected := &models.IntegrationTask{
		ID:     "task-1",
		Status: "failed",
	}
	repo := &fakeIntegrationRepo{updateTaskStatusResult: expected}
	s := service.NewServiceWithRepo(repo)
	ctx := context.Background()

	task, err := s.UpdateTaskStatus(ctx, "tenant-1", "task-1", "failed", "timeout", "", 5000)
	if err != nil {
		t.Fatalf("UpdateTaskStatus returned error: %v", err)
	}
	if task.Status != "failed" {
		t.Errorf("expected status failed, got %s", task.Status)
	}
}
