package models

import (
	"testing"
	"time"
)

func TestPipelineRunStatus_Constants(t *testing.T) {
	statuses := []PipelineRunStatus{
		StatusPending, StatusRunning, StatusSuccess,
		StatusFailed, StatusCancelled, StatusTimeout,
	}
	for _, s := range statuses {
		if s == "" {
			t.Error("status constant should not be empty")
		}
	}
}

func TestTriggerType_Constants(t *testing.T) {
	types := []TriggerType{
		TriggerManual, TriggerSchedule, TriggerWebhook,
		TriggerEvent, TriggerAPI,
	}
	for _, tt := range types {
		if tt == "" {
			t.Error("trigger type should not be empty")
		}
	}
}

func TestPipeline_Fields(t *testing.T) {
	now := time.Now()
	p := Pipeline{
		ID:       "pipe-1",
		TenantID: "tenant-abc",
		Name:     "build-and-deploy",
		Version:  "v1.0.0",
		Status:   "active",
	}

	if p.ID != "pipe-1" {
		t.Errorf("expected ID pipe-1, got %s", p.ID)
	}
	if p.TenantID != "tenant-abc" {
		t.Errorf("expected TenantID tenant-abc, got %s", p.TenantID)
	}
	_ = now
}

func TestPipelineRun_Fields(t *testing.T) {
	run := PipelineRun{
		ID:          "run-1",
		PipelineID:  "pipe-1",
		TenantID:    "tenant-abc",
		TriggerType: TriggerManual,
		Status:      StatusPending,
	}

	if run.Status != StatusPending {
		t.Errorf("expected Status pending, got %s", run.Status)
	}
	if run.TriggerType != TriggerManual {
		t.Errorf("expected TriggerType manual, got %s", run.TriggerType)
	}
}

func TestStage_Fields(t *testing.T) {
	stage := Stage{
		ID:       "stage-1",
		RunID:    "run-1",
		Name:     "build",
		Sequence: 1,
		Status:   StagePending,
	}

	if stage.Name != "build" {
		t.Errorf("expected Name build, got %s", stage.Name)
	}
	if stage.Sequence != 1 {
		t.Errorf("expected Sequence 1, got %d", stage.Sequence)
	}
}

func TestTask_Fields(t *testing.T) {
	task := Task{
		ID:       "task-1",
		StageID:  "stage-1",
		Name:     "compile",
		Type:     "shell",
		Status:   TaskPending,
		Sequence: 1,
	}

	if task.Type != "shell" {
		t.Errorf("expected Type shell, got %s", task.Type)
	}
	if task.Status != TaskPending {
		t.Errorf("expected Status pending, got %s", task.Status)
	}
}

func TestCreatePipelineRequest(t *testing.T) {
	req := CreatePipelineRequest{
		Name:   "test-pipeline",
		Config: "stages:\n  - name: build",
	}

	if req.Name != "test-pipeline" {
		t.Errorf("expected Name test-pipeline, got %s", req.Name)
	}
}

func TestRunPipelineRequest_Defaults(t *testing.T) {
	req := RunPipelineRequest{}

	if req.TriggerType != "" {
		t.Errorf("expected empty TriggerType, got %s", req.TriggerType)
	}
	if req.Environment != "" {
		t.Errorf("expected empty Environment, got %s", req.Environment)
	}
}
