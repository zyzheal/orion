package models

import (
	"testing"
	"time"
)

func TestJob_Fields(t *testing.T) {
	now := time.Now()
	cronExpr := "0 */5 * * *"
	job := Job{
		ID:          "job-1",
		TenantID:    "tenant-1",
		Name:        "Cleanup job",
		Description: "Clean up old records",
		Type:        JobTypeCron,
		CronExpr:    &cronExpr,
		IntervalSec: nil,
		Status:      JobActive,
		LastRunAt:   nil,
		NextRunAt:   &now,
		RunCount:    0,
		MaxRuns:     nil,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if job.ID != "job-1" {
		t.Errorf("expected ID 'job-1', got '%s'", job.ID)
	}
	if job.TenantID != "tenant-1" {
		t.Errorf("expected TenantID 'tenant-1', got '%s'", job.TenantID)
	}
	if job.Name != "Cleanup job" {
		t.Errorf("expected Name 'Cleanup job', got '%s'", job.Name)
	}
	if job.Type != JobTypeCron {
		t.Errorf("expected Type 'cron', got '%s'", job.Type)
	}
	if *job.CronExpr != "0 */5 * * *" {
		t.Errorf("expected CronExpr '0 */5 * * *', got '%s'", *job.CronExpr)
	}
	if job.Status != JobActive {
		t.Errorf("expected Status 'active', got '%s'", job.Status)
	}
	if job.RunCount != 0 {
		t.Errorf("expected RunCount 0, got %d", job.RunCount)
	}
}

func TestJobStatus_Constants(t *testing.T) {
	if JobActive != "active" {
		t.Errorf("expected JobActive = 'active', got '%s'", JobActive)
	}
	if JobPaused != "paused" {
		t.Errorf("expected JobPaused = 'paused', got '%s'", JobPaused)
	}
	if JobDisabled != "disabled" {
		t.Errorf("expected JobDisabled = 'disabled', got '%s'", JobDisabled)
	}
}

func TestJobType_Constants(t *testing.T) {
	if JobTypeCron != "cron" {
		t.Errorf("expected JobTypeCron = 'cron', got '%s'", JobTypeCron)
	}
	if JobTypeOnce != "once" {
		t.Errorf("expected JobTypeOnce = 'once', got '%s'", JobTypeOnce)
	}
	if JobTypeInterval != "interval" {
		t.Errorf("expected JobTypeInterval = 'interval', got '%s'", JobTypeInterval)
	}
}

func TestJobRun_Fields(t *testing.T) {
	now := time.Now()
	run := JobRun{
		ID:         "run-1",
		JobID:      "job-1",
		Status:     "success",
		Error:      nil,
		StartedAt:  now,
		EndedAt:    &now,
		DurationMs: 1500,
	}

	if run.ID != "run-1" {
		t.Errorf("expected ID 'run-1', got '%s'", run.ID)
	}
	if run.JobID != "job-1" {
		t.Errorf("expected JobID 'job-1', got '%s'", run.JobID)
	}
	if run.Status != "success" {
		t.Errorf("expected Status 'success', got '%s'", run.Status)
	}
	if run.DurationMs != 1500 {
		t.Errorf("expected DurationMs 1500, got %d", run.DurationMs)
	}
}

func TestCreateJobRequest_Fields(t *testing.T) {
	cronExpr := "0 */5 * * *"
	req := CreateJobRequest{
		Name:        "Cleanup job",
		Description: "Clean up old records",
		Type:        JobTypeCron,
		CronExpr:    &cronExpr,
		IntervalSec: nil,
		MaxRuns:     nil,
	}

	if req.Name != "Cleanup job" {
		t.Errorf("expected Name 'Cleanup job', got '%s'", req.Name)
	}
	if req.Type != JobTypeCron {
		t.Errorf("expected Type 'cron', got '%s'", req.Type)
	}
	if *req.CronExpr != "0 */5 * * *" {
		t.Errorf("expected CronExpr '0 */5 * * *', got '%s'", *req.CronExpr)
	}
}

func TestPaginatedRequest_Defaults(t *testing.T) {
	p := PaginatedRequest{}

	offset := p.Offset()
	if offset != 0 {
		t.Errorf("expected offset 0, got %d", offset)
	}

	limit := p.Limit()
	if limit != 20 {
		t.Errorf("expected limit 20, got %d", limit)
	}
}
