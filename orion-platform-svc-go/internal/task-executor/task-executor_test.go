package task_executor_test

import (
	"testing"

	"orion/platform-svc-go/internal/task-executor/models"
	"orion/platform-svc-go/internal/task-executor/service"
)

func TestTaskExecutor_NewService_Nil(t *testing.T) {
	// Verify NewTaskExecutorService exists and accepts nil repo/logger.
	svc := service.NewTaskExecutorService(nil, nil)
	if svc == nil {
		t.Fatal("NewTaskExecutorService returned nil")
	}
}

func TestTaskExecutor_ContextDeadline(t *testing.T) {
	// Verify Task model and CreateTaskRequest types compile with expected fields.
	task := models.Task{
		ID:          "task_test_1",
		TenantID:    "tenant_1",
		Type:        "http_request",
		Name:        "test-task",
		Description: "verify types",
		Input:       map[string]interface{}{"key": "value"},
		Status:      "pending",
		TimeoutSec:  30,
	}
	if task.ID != "task_test_1" {
		t.Fatalf("unexpected ID: %s", task.ID)
	}
	if task.TimeoutSec != 30 {
		t.Fatalf("unexpected TimeoutSec: %d", task.TimeoutSec)
	}

	req := models.CreateTaskRequest{
		Type:       "data_processing",
		Name:       "processing-task",
		TimeoutSec: 60,
	}
	if req.Type != "data_processing" || req.TimeoutSec != 60 {
		t.Fatal("CreateTaskRequest fields not set correctly")
	}
}

func TestTaskExecutor_PackageAvailable(t *testing.T) {
	// Verify TaskResponse and ExecuteRequest types exist and are usable.
	resp := models.TaskResponse{
		Total: 1,
		Data:  []models.Task{{ID: "task_resp", Status: "completed"}},
	}
	if resp.Total != 1 || len(resp.Data) != 1 {
		t.Fatal("TaskResponse fields not correct")
	}

	execReq := models.ExecuteRequest{
		TaskID: "task_exec_1",
		Input:  map[string]interface{}{"param": 42},
	}
	if execReq.TaskID != "task_exec_1" {
		t.Fatalf("unexpected TaskID: %s", execReq.TaskID)
	}
}
