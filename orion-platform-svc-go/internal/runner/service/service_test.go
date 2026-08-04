// Package service provides business logic for the Runner CI task execution service.
package service

import (
	"strings"
	"testing"

	"orion/platform-svc-go/internal/runner/models"
)

// ===========================================================================
// ValidateTaskParameters
// ===========================================================================

func TestValidateTaskParameters_EmptyType(t *testing.T) {
	errs := ValidateTaskParameters("", "", "", 0)
	if len(errs) == 0 {
		t.Fatal("expected error for empty task type")
	}
}

func TestValidateTaskParameters_UnknownType(t *testing.T) {
	errs := ValidateTaskParameters("invalid", "", "", 0)
	if len(errs) == 0 {
		t.Fatal("expected error for unknown task type")
	}
}

func TestValidateTaskParameters_ShellMissingCommand(t *testing.T) {
	errs := ValidateTaskParameters("shell", "", "", 0)
	found := false
	for _, e := range errs {
		if strings.Contains(e, "command") || strings.Contains(e, "script") {
			found = true
		}
	}
	if !found {
		t.Fatal("expected shell command/script error")
	}
}

func TestValidateTaskParameters_ShellWithScript(t *testing.T) {
	errs := ValidateTaskParameters("shell", "", "echo hello", 0)
	if len(errs) > 0 {
		t.Fatalf("unexpected errors for shell with script: %v", errs)
	}
}

func TestValidateTaskParameters_ShellWithCommand(t *testing.T) {
	errs := ValidateTaskParameters("shell", "echo hello", "", 0)
	if len(errs) > 0 {
		t.Fatalf("unexpected errors for shell with command: %v", errs)
	}
}

func TestValidateTaskParameters_InvalidTimeoutTooLow(t *testing.T) {
	errs := ValidateTaskParameters("build", "", "", 100)
	found := false
	for _, e := range errs {
		if strings.Contains(e, "timeout") {
			found = true
		}
	}
	if !found {
		t.Fatal("expected timeout error")
	}
}

func TestValidateTaskParameters_InvalidTimeoutTooHigh(t *testing.T) {
	errs := ValidateTaskParameters("build", "", "", 4000000)
	found := false
	for _, e := range errs {
		if strings.Contains(e, "timeout") {
			found = true
		}
	}
	if !found {
		t.Fatal("expected timeout error")
	}
}

func TestValidateTaskParameters_ValidNpmTask(t *testing.T) {
	errs := ValidateTaskParameters("npm", "", "", 300000)
	if len(errs) > 0 {
		t.Fatalf("unexpected errors for valid npm task: %v", errs)
	}
}

func TestValidateTaskParameters_WhitespaceTrimmed(t *testing.T) {
	errs := ValidateTaskParameters("  build ", "", "", 0)
	if len(errs) > 0 {
		t.Fatalf("unexpected errors for whitespace-padded type: %v", errs)
	}
}

// ===========================================================================
// EstimateTaskDuration
// ===========================================================================

func TestEstimateTaskDuration_ShellCapsAt60s(t *testing.T) {
	d := EstimateTaskDuration("shell", 120000)
	if d != 60000 {
		t.Errorf("shell 120000ms -> %d, want 60000", d)
	}
}

func TestEstimateTaskDuration_ShellBelow60s(t *testing.T) {
	d := EstimateTaskDuration("shell", 30000)
	if d != 30000 {
		t.Errorf("shell 30000ms -> %d, want 30000", d)
	}
}

func TestEstimateTaskDuration_HTTPCapsAt30s(t *testing.T) {
	d := EstimateTaskDuration("http", 60000)
	if d != 30000 {
		t.Errorf("http 60000ms -> %d, want 30000", d)
	}
}

func TestEstimateTaskDuration_HTTPBelow30s(t *testing.T) {
	d := EstimateTaskDuration("http", 15000)
	if d != 15000 {
		t.Errorf("http 15000ms -> %d, want 15000", d)
	}
}

func TestEstimateTaskDuration_DeployCapsAt10min(t *testing.T) {
	d := EstimateTaskDuration("deploy", 1200000)
	if d != 600000 {
		t.Errorf("deploy 1200000ms -> %d, want 600000", d)
	}
}

func TestEstimateTaskDuration_DeployBelow10min(t *testing.T) {
	d := EstimateTaskDuration("deploy", 300000)
	if d != 300000 {
		t.Errorf("deploy 300000ms -> %d, want 300000", d)
	}
}

func TestEstimateTaskDuration_PipelineUnchanged(t *testing.T) {
	d := EstimateTaskDuration("pipeline", 600000)
	if d != 600000 {
		t.Errorf("pipeline 600000ms -> %d, want 600000", d)
	}
}

func TestEstimateTaskDuration_Default5min(t *testing.T) {
	d := EstimateTaskDuration("npm", 0)
	if d != 300000 {
		t.Errorf("npm 0ms -> %d, want 300000", d)
	}
}

func TestEstimateTaskDuration_UppercaseType(t *testing.T) {
	d := EstimateTaskDuration("SHELL", 120000)
	if d != 60000 {
		t.Errorf("SHELL 120000ms -> %d, want 60000", d)
	}
}

// ===========================================================================
// Model constants
// ===========================================================================

func TestJobStatusConstants(t *testing.T) {
	statuses := []models.JobStatus{
		models.JobStatusPending,
		models.JobStatusRunning,
		models.JobStatusCompleted,
		models.JobStatusFailed,
		models.JobStatusCancelled,
	}
	for _, s := range statuses {
		if !models.ValidJobStatuses[s] {
			t.Errorf("status %q not in ValidJobStatuses", s)
		}
	}
}

func TestAgentStatusConstants(t *testing.T) {
	statuses := []models.AgentStatus{
		models.AgentStatusRegistering,
		models.AgentStatusOnline,
		models.AgentStatusOffline,
		models.AgentStatusDraining,
	}
	for _, s := range statuses {
		if !models.ValidAgentStatuses[s] {
			t.Errorf("status %q not in ValidAgentStatuses", s)
		}
	}
}

func TestValidTaskTypes(t *testing.T) {
	expected := []string{"shell", "npm", "test", "build", "http", "pipeline", "deploy"}
	for _, tt := range expected {
		if !models.ValidTaskTypes[tt] {
			t.Errorf("task type %q not in ValidTaskTypes", tt)
		}
	}
}

func TestJobStatusConstants_Value(t *testing.T) {
	if models.JobStatusPending != "pending" {
		t.Errorf("Pending = %q, want %q", models.JobStatusPending, "pending")
	}
	if models.JobStatusRunning != "running" {
		t.Errorf("Running = %q, want %q", models.JobStatusRunning, "running")
	}
}

// ===========================================================================
// Pagination helpers
// ===========================================================================

func TestPaginatedRequest_Defaults(t *testing.T) {
	p := &models.PaginatedRequest{}
	offset := p.Offset()
	limit := p.Limit()
	if offset != 0 {
		t.Errorf("Offset() = %d, want 0", offset)
	}
	if limit != 20 {
		t.Errorf("Limit() = %d, want 20", limit)
	}
}

func TestPaginatedRequest_Page2(t *testing.T) {
	p := &models.PaginatedRequest{Page: 2, PageSize: 20}
	offset := p.Offset()
	limit := p.Limit()
	if offset != 20 {
		t.Errorf("Offset() = %d, want 20", offset)
	}
	if limit != 20 {
		t.Errorf("Limit() = %d, want 20", limit)
	}
}

func TestPaginatedRequest_PageSizeCappedAt100(t *testing.T) {
	p := &models.PaginatedRequest{Page: 1, PageSize: 500}
	limit := p.Limit()
	if limit != 100 {
		t.Errorf("Limit() = %d, want 100", limit)
	}
}

func TestPaginatedRequest_EmptyPageDefaultsToOne(t *testing.T) {
	p := &models.PaginatedRequest{Page: 0, PageSize: 50}
	offset := p.Offset()
	if offset != 0 {
		t.Errorf("Offset() = %d, want 0 (Page 0 defaults to 1)", offset)
	}
}

// ===========================================================================
// Service construction
// ===========================================================================

func TestNewServiceReturnsNotNil(t *testing.T) {
	svc := NewService(nil)
	if svc == nil {
		t.Fatal("NewService(nil) returned nil")
	}
}

func TestServiceWithPlatformURL(t *testing.T) {
	svc := NewService(nil)
	svc.WithPlatformURL("http://platform:3001")
	// No panic = success; URL is set internally
}

// ===========================================================================
// AgentInfo / JobResult model construction
// ===========================================================================

func TestAgentInfoFields(t *testing.T) {
	info := models.AgentInfo{
		AgentID:       "a-1",
		ActiveJobs:    2,
		Status:        "online",
		MaxConcurrent: 5,
		Name:          "test-runner",
		Endpoint:      "http://localhost:3028",
	}
	if info.ActiveJobs != 2 {
		t.Errorf("ActiveJobs = %d, want 2", info.ActiveJobs)
	}
	if info.MaxConcurrent != 5 {
		t.Errorf("MaxConcurrent = %d, want 5", info.MaxConcurrent)
	}
}

func TestJobResultCompleted(t *testing.T) {
	duration := 1234
	result := models.JobResult{
		JobID:      "j-1",
		Status:     "completed",
		Success:    true,
		DurationMs: duration,
	}
	if !result.Success {
		t.Error("JobResult.Success should be true")
	}
	if result.DurationMs != duration {
		t.Errorf("DurationMs = %d, want %d", result.DurationMs, duration)
	}
}

func TestJobResultFailed(t *testing.T) {
	result := models.JobResult{
		JobID:    "j-2",
		Status:   "failed",
		Success:  false,
		ExitCode: 1,
		Stderr:   "command not found",
	}
	if result.Success {
		t.Error("JobResult.Success should be false for failed job")
	}
	if result.ExitCode != 1 {
		t.Errorf("ExitCode = %d, want 1", result.ExitCode)
	}
}
