package service

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/pipeline-error-detail/models"
	"orion/platform-svc-go/internal/pipeline-error-detail/repository"
)

// --- mock repository ---

type mockRepo struct {
	detail *repository.RunDetail
	err    error
}

func (m *mockRepo) GetRunDetail(_ context.Context, runID string) (*repository.RunDetail, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.detail, nil
}

// --- helpers ---

func newTestService(repo Repository) *Service {
	return &Service{repo: repo}
}

func ptrTime(s string) *time.Time {
	t, _ := time.Parse(time.RFC3339, s)
	return &t
}

func nullStr(s string) sql.NullString {
	return sql.NullString{String: s, Valid: true}
}

func TestGetErrorDetail_Success(t *testing.T) {
	now := ptrTime("2026-07-15T10:00:00Z")
	repo := &mockRepo{
		detail: &repository.RunDetail{
			Run: repository.PipelineRun{
				Status:      "failed",
				StartedAt:   now,
				CompletedAt: now,
			},
			Stages: []repository.StageRecord{
				{
					Name:        "build",
					Error:       nullStr("syntax error: unexpected EOF"),
					StartedAt:   now,
					CompletedAt: now,
				},
			},
			Tasks: []repository.TaskRecord{
				{
					Name:        "compile",
					Error:       nullStr("compilation failed"),
					StartedAt:   now,
					CompletedAt: now,
				},
			},
		},
	}
	svc := newTestService(repo)

	detail, err := svc.GetErrorDetail(context.Background(), "run-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if detail.ErrorType != models.CategoryCompilationError {
		t.Errorf("expected compilation_error, got %s", detail.ErrorType)
	}
	if detail.Severity != models.SeverityCritical {
		t.Errorf("expected critical, got %s", detail.Severity)
	}
	if detail.StageName != "build" {
		t.Errorf("expected build, got %s", detail.StageName)
	}
	if detail.RawError != "syntax error: unexpected EOF" {
		t.Errorf("expected syntax error message, got %s", detail.RawError)
	}
	if detail.Classification == nil {
		t.Fatal("expected non-nil classification")
	}
	if detail.Classification.Type != "permanent" {
		t.Errorf("expected permanent, got %s", detail.Classification.Type)
	}
}

func TestGetErrorDetail_EmptyRunID(t *testing.T) {
	svc := newTestService(&mockRepo{})

	_, err := svc.GetErrorDetail(context.Background(), "")
	if err != ErrInvalidRun {
		t.Errorf("expected ErrInvalidRun, got %v", err)
	}
}

func TestGetErrorDetail_RunNotFound(t *testing.T) {
	repo := &mockRepo{err: repository.ErrRunNotFound}
	svc := newTestService(repo)

	_, err := svc.GetErrorDetail(context.Background(), "nonexistent")
	if err != ErrRunNotFound {
		t.Errorf("expected ErrRunNotFound, got %v", err)
	}
}

func TestGetErrorDetail_NotFailed(t *testing.T) {
	now := ptrTime("2026-07-15T10:00:00Z")
	repo := &mockRepo{
		detail: &repository.RunDetail{
			Run: repository.PipelineRun{
				Status:      "succeeded",
				StartedAt:   now,
				CompletedAt: now,
			},
		},
	}
	svc := newTestService(repo)

	_, err := svc.GetErrorDetail(context.Background(), "run-1")
	if err != ErrNotFailed {
		t.Errorf("expected ErrNotFailed, got %v", err)
	}
}

func TestGetErrorDetail_NoErrors(t *testing.T) {
	now := ptrTime("2026-07-15T10:00:00Z")
	repo := &mockRepo{
		detail: &repository.RunDetail{
			Run: repository.PipelineRun{
				Status:      "failed",
				StartedAt:   now,
				CompletedAt: now,
			},
			Stages: []repository.StageRecord{
				{Name: "build", StartedAt: now, CompletedAt: now},
			},
			Tasks: []repository.TaskRecord{
				{Name: "compile", StartedAt: now, CompletedAt: now},
			},
		},
	}
	svc := newTestService(repo)

	detail, err := svc.GetErrorDetail(context.Background(), "run-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if detail.ErrorType != models.CategoryUnknown {
		t.Errorf("expected unknown_error, got %s", detail.ErrorType)
	}
	if detail.RawError != "" {
		t.Errorf("expected empty raw error, got %s", detail.RawError)
	}
}

func TestGetErrorDetail_RepoError(t *testing.T) {
	repo := &mockRepo{err: errors.New("database connection failed")}
	svc := newTestService(repo)

	_, err := svc.GetErrorDetail(context.Background(), "run-1")
	if err == nil || err.Error() != "database connection failed" {
		t.Errorf("expected database connection failed, got %v", err)
	}
}

func TestGetErrorDetail_CancelledStatus(t *testing.T) {
	now := ptrTime("2026-07-15T10:00:00Z")
	repo := &mockRepo{
		detail: &repository.RunDetail{
			Run: repository.PipelineRun{
				Status:      "cancelled",
				StartedAt:   now,
				CompletedAt: now,
			},
			Stages: []repository.StageRecord{
				{
					Name:        "deploy",
					Error:       nullStr("deployment failed: timeout"),
					StartedAt:   now,
					CompletedAt: now,
				},
			},
		},
	}
	svc := newTestService(repo)

	detail, err := svc.GetErrorDetail(context.Background(), "run-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if detail.ErrorType != models.CategoryDeploymentFail {
		t.Errorf("expected deployment_failure, got %s", detail.ErrorType)
	}
}

func TestGetErrorDetail_TransientError(t *testing.T) {
	now := ptrTime("2026-07-15T10:00:00Z")
	repo := &mockRepo{
		detail: &repository.RunDetail{
			Run: repository.PipelineRun{
				Status:      "failed",
				StartedAt:   now,
				CompletedAt: now,
			},
			Stages: []repository.StageRecord{
				{
					Name:        "network",
					Error:       nullStr("ETIMEDOUT connection refused"),
					StartedAt:   now,
					CompletedAt: now,
				},
			},
		},
	}
	svc := newTestService(repo)

	detail, err := svc.GetErrorDetail(context.Background(), "run-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if detail.Classification == nil {
		t.Fatal("expected non-nil classification")
	}
	if !detail.Classification.ShouldRetry {
		t.Error("expected shouldRetry=true for transient error")
	}
	if detail.Classification.Type != "transient" {
		t.Errorf("expected transient, got %s", detail.Classification.Type)
	}
}

func TestErrorMessages(t *testing.T) {
	tests := []struct {
		err error
		msg string
	}{
		{ErrInvalidRun, "runId is required"},
		{ErrNotFailed, "error detail is only available for failed or cancelled runs"},
		{ErrRunNotFound, "pipeline run not found"},
	}
	for _, tt := range tests {
		if tt.err.Error() != tt.msg {
			t.Errorf("expected %q, got %q", tt.msg, tt.err.Error())
		}
	}
}