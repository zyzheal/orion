package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/rdm-statistics/models"
)

// mockStatsRepo implements StatsRepository for testing.
type mockStatsRepo struct {
	burndown   []models.BurndownPoint
	velocity   []models.VelocityPoint
	defects    *models.DefectStats
	sprints    models.SprintSummaryList
	burrErr    error
	velErr     error
	defErr     error
	sprintErr  error
	burrCalled bool
	velCalled  bool
	defCalled  bool
	spCalled   bool
}

func (m *mockStatsRepo) GetBurndown(ctx context.Context, tenantID, sprintID string) ([]models.BurndownPoint, error) {
	m.burrCalled = true
	if m.burrErr != nil {
		return nil, m.burrErr
	}
	return m.burndown, nil
}

func (m *mockStatsRepo) GetVelocity(ctx context.Context, tenantID, projectID string, limit int) ([]models.VelocityPoint, error) {
	m.velCalled = true
	if m.velErr != nil {
		return nil, m.velErr
	}
	return m.velocity, nil
}

func (m *mockStatsRepo) GetDefectStats(ctx context.Context, tenantID, projectID string) (*models.DefectStats, error) {
	m.defCalled = true
	if m.defErr != nil {
		return nil, m.defErr
	}
	return m.defects, nil
}

func (m *mockStatsRepo) GetSprintStats(ctx context.Context, tenantID, projectID string) (models.SprintSummaryList, error) {
	m.spCalled = true
	if m.sprintErr != nil {
		return nil, m.sprintErr
	}
	return m.sprints, nil
}

func TestGetBurndown_WithRepo(t *testing.T) {
	repo := &mockStatsRepo{
		burndown: []models.BurndownPoint{{Date: "2026-01-01", RemainingPoints: 10, IdealPoints: 10}},
	}
	svc := NewService(repo)

	result, err := svc.GetBurndown(context.Background(), "t1", "sprint-1")
	if err != nil {
		t.Fatalf("GetBurndown: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 point, got %d", len(result))
	}
	if result[0].Date != "2026-01-01" {
		t.Errorf("expected date '2026-01-01', got %q", result[0].Date)
	}
	if !repo.burrCalled {
		t.Error("expected repo.GetBurndown to be called")
	}
}

func TestGetBurndown_NilRepo(t *testing.T) {
	svc := NewService(nil)
	result, err := svc.GetBurndown(context.Background(), "t1", "sprint-1")
	if err != nil {
		t.Fatalf("GetBurndown: %v", err)
	}
	if result == nil {
		t.Error("expected non-nil empty slice")
	}
	if len(result) != 0 {
		t.Errorf("expected 0 points, got %d", len(result))
	}
}

func TestGetVelocity_WithRepo(t *testing.T) {
	repo := &mockStatsRepo{
		velocity: []models.VelocityPoint{{Sprint: "s1", CompletedPoints: 30}},
	}
	svc := NewService(repo)

	result, err := svc.GetVelocity(context.Background(), "t1", "proj-1", 5)
	if err != nil {
		t.Fatalf("GetVelocity: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 point, got %d", len(result))
	}
	if result[0].CompletedPoints != 30 {
		t.Errorf("expected 30 points, got %d", result[0].CompletedPoints)
	}
}

func TestGetVelocity_DefaultLimit(t *testing.T) {
	repo := &mockStatsRepo{
		velocity: []models.VelocityPoint{{Sprint: "s1", CompletedPoints: 20}},
	}
	svc := NewService(repo)

	_, err := svc.GetVelocity(context.Background(), "t1", "proj-1", 0)
	if err != nil {
		t.Fatalf("GetVelocity: %v", err)
	}
	// limit=0 should default to 10
}

func TestGetVelocity_NilRepo(t *testing.T) {
	svc := NewService(nil)
	result, err := svc.GetVelocity(context.Background(), "t1", "proj-1", 10)
	if err != nil {
		t.Fatalf("GetVelocity: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected 0 points, got %d", len(result))
	}
}

func TestGetDefectStats_WithRepo(t *testing.T) {
	repo := &mockStatsRepo{
		defects: &models.DefectStats{
			BySeverity: []models.DefectBySeverity{{Severity: "critical", Count: 5}},
			ByStatus:   []models.DefectByStatus{{Status: "open", Count: 10}},
		},
	}
	svc := NewService(repo)

	result, err := svc.GetDefectStats(context.Background(), "t1", "proj-1")
	if err != nil {
		t.Fatalf("GetDefectStats: %v", err)
	}
	if len(result.BySeverity) != 1 {
		t.Errorf("expected 1 severity, got %d", len(result.BySeverity))
	}
	if result.BySeverity[0].Count != 5 {
		t.Errorf("expected count 5, got %d", result.BySeverity[0].Count)
	}
}

func TestGetDefectStats_NilRepo(t *testing.T) {
	svc := NewService(nil)
	result, err := svc.GetDefectStats(context.Background(), "t1", "proj-1")
	if err != nil {
		t.Fatalf("GetDefectStats: %v", err)
	}
	if result == nil {
		t.Error("expected non-nil result")
	}
	if len(result.BySeverity) != 0 {
		t.Errorf("expected 0 severities, got %d", len(result.BySeverity))
	}
	if len(result.ByStatus) != 0 {
		t.Errorf("expected 0 statuses, got %d", len(result.ByStatus))
	}
}

func TestGetSprintStats_WithRepo(t *testing.T) {
	repo := &mockStatsRepo{
		sprints: models.SprintSummaryList{
			{SprintID: "s1", SprintName: "Sprint 1", TotalTasks: 10, CompletedTasks: 8},
		},
	}
	svc := NewService(repo)

	result, err := svc.GetSprintStats(context.Background(), "t1", "proj-1")
	if err != nil {
		t.Fatalf("GetSprintStats: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 sprint, got %d", len(result))
	}
	if result[0].SprintID != "s1" {
		t.Errorf("expected sprint ID 's1', got %q", result[0].SprintID)
	}
}

func TestGetSprintStats_NilRepo(t *testing.T) {
	svc := NewService(nil)
	result, err := svc.GetSprintStats(context.Background(), "t1", "proj-1")
	if err != nil {
		t.Fatalf("GetSprintStats: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected 0 sprints, got %d", len(result))
	}
}
