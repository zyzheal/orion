package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/pipeline-run-history/models"
	"orion/platform-svc-go/internal/pipeline-run-history/repository"
)

// --- mock repository ---

type mockHistoryRepo struct {
	entries []models.RunHistoryEntry
	count   int
	err     error
}

func (m *mockHistoryRepo) GetRunHistory(_ context.Context, pipelineID, tenantID, period string, limit int) ([]models.RunHistoryEntry, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.entries, nil
}

func (m *mockHistoryRepo) CountRunHistory(_ context.Context, pipelineID, tenantID string) (int, error) {
	if m.err != nil {
		return 0, m.err
	}
	return m.count, nil
}

// --- helpers ---

func newTestService(repo Repository) *Service {
	return &Service{repo: repo}
}

func TestGetRunHistory_Success(t *testing.T) {
	now := time.Now()
	entries := []models.RunHistoryEntry{
		{
			PeriodStart: now,
			PeriodEnd:   now.Add(24 * time.Hour),
			TotalRuns:   10,
			Succeeded:   8,
			Failed:      2,
			Cancelled:   0,
		},
	}
	repo := &mockHistoryRepo{entries: entries, count: 10}
	svc := newTestService(repo)

	resp, err := svc.GetRunHistory(context.Background(), "pipeline-1", "tenant-1", "day", 30)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.PipelineID != "pipeline-1" {
		t.Errorf("expected pipeline-1, got %s", resp.PipelineID)
	}
	if resp.Period != "day" {
		t.Errorf("expected day, got %s", resp.Period)
	}
	if resp.TotalCount != 10 {
		t.Errorf("expected 10, got %d", resp.TotalCount)
	}
	if len(resp.Entries) != 1 {
		t.Errorf("expected 1 entry, got %d", len(resp.Entries))
	}
	if resp.Entries[0].TotalRuns != 10 {
		t.Errorf("expected 10 total runs, got %d", resp.Entries[0].TotalRuns)
	}
}

func TestGetRunHistory_DefaultParams(t *testing.T) {
	repo := &mockHistoryRepo{entries: []models.RunHistoryEntry{}, count: 0}
	svc := newTestService(repo)

	resp, err := svc.GetRunHistory(context.Background(), "pipeline-1", "tenant-1", "day", 30)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Period != "day" {
		t.Errorf("expected day, got %s", resp.Period)
	}
}

func TestGetRunHistory_WeekPeriod(t *testing.T) {
	repo := &mockHistoryRepo{entries: []models.RunHistoryEntry{}, count: 0}
	svc := newTestService(repo)

	resp, err := svc.GetRunHistory(context.Background(), "pipeline-1", "tenant-1", "week", 12)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Period != "week" {
		t.Errorf("expected week, got %s", resp.Period)
	}
}

func TestGetRunHistory_MonthPeriod(t *testing.T) {
	repo := &mockHistoryRepo{entries: []models.RunHistoryEntry{}, count: 0}
	svc := newTestService(repo)

	resp, err := svc.GetRunHistory(context.Background(), "pipeline-1", "tenant-1", "month", 12)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Period != "month" {
		t.Errorf("expected month, got %s", resp.Period)
	}
}

func TestGetRunHistory_InvalidPeriod(t *testing.T) {
	svc := newTestService(&mockHistoryRepo{})

	_, err := svc.GetRunHistory(context.Background(), "pipeline-1", "tenant-1", "year", 30)
	if err != ErrInvalidPeriod {
		t.Errorf("expected ErrInvalidPeriod, got %v", err)
	}
}

func TestGetRunHistory_InvalidLimitTooLow(t *testing.T) {
	svc := newTestService(&mockHistoryRepo{})

	_, err := svc.GetRunHistory(context.Background(), "pipeline-1", "tenant-1", "day", 0)
	if err != ErrInvalidLimit {
		t.Errorf("expected ErrInvalidLimit, got %v", err)
	}
}

func TestGetRunHistory_InvalidLimitTooHigh(t *testing.T) {
	svc := newTestService(&mockHistoryRepo{})

	_, err := svc.GetRunHistory(context.Background(), "pipeline-1", "tenant-1", "day", 400)
	if err != ErrInvalidLimit {
		t.Errorf("expected ErrInvalidLimit, got %v", err)
	}
}

func TestGetRunHistory_NilEntries(t *testing.T) {
	repo := &mockHistoryRepo{entries: nil, count: 0}
	svc := newTestService(repo)

	resp, err := svc.GetRunHistory(context.Background(), "pipeline-1", "tenant-1", "day", 30)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Entries == nil {
		t.Error("expected non-nil empty entries slice")
	}
	if len(resp.Entries) != 0 {
		t.Errorf("expected 0 entries, got %d", len(resp.Entries))
	}
}

func TestGetRunHistory_RepoError(t *testing.T) {
	repo := &mockHistoryRepo{err: errors.New("database error")}
	svc := newTestService(repo)

	_, err := svc.GetRunHistory(context.Background(), "pipeline-1", "tenant-1", "day", 30)
	if err == nil || err.Error() != "database error" {
		t.Errorf("expected database error, got %v", err)
	}
}

func TestGetRunHistory_NotFound(t *testing.T) {
	repo := &mockHistoryRepo{err: repository.ErrNotFound}
	svc := newTestService(repo)

	_, err := svc.GetRunHistory(context.Background(), "nonexistent", "tenant-1", "day", 30)
	if err == nil {
		t.Fatal("expected error")
	}
	if !IsNotFound(err) {
		t.Error("expected IsNotFound to return true")
	}
}

func TestErrorMessages(t *testing.T) {
	tests := []struct {
		err error
		msg string
	}{
		{ErrInvalidPeriod, "invalid period, must be day, week, or month"},
		{ErrInvalidLimit, "limit must be between 1 and 365"},
	}
	for _, tt := range tests {
		if tt.err.Error() != tt.msg {
			t.Errorf("expected %q, got %q", tt.msg, tt.err.Error())
		}
	}
}