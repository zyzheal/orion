package service

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"orion/platform-svc-go/internal/pipeline-budget/models"
)

// ---------------------------------------------------------------------------
// Mock repository
// ---------------------------------------------------------------------------

type mockBudgetRepo struct {
	budgets  map[string]*models.BudgetConfig // key: tenantID:pipeID
	history  []models.BudgetHistoryRecord
	upsertFn func(ctx context.Context, b *models.BudgetConfig) error
}

func (m *mockBudgetRepo) GetByPipelineID(_ context.Context, tenantID, pipelineID string) (*models.BudgetConfig, error) {
	b, ok := m.budgets[tenantID+":"+pipelineID]
	if !ok {
		return nil, ErrNotFound
	}
	return b, nil
}

func (m *mockBudgetRepo) Upsert(ctx context.Context, b *models.BudgetConfig) error {
	if m.upsertFn != nil {
		return m.upsertFn(ctx, b)
	}
	key := b.TenantID + ":" + b.PipelineID
	m.budgets[key] = b
	return nil
}

func (m *mockBudgetRepo) AppendHistory(_ context.Context, h *models.BudgetHistoryRecord) error {
	m.history = append(m.history, *h)
	return nil
}

func (m *mockBudgetRepo) ListHistory(_ context.Context, tenantID, pipelineID string, offset, limit int) ([]models.BudgetHistoryRecord, error) {
	var filtered []models.BudgetHistoryRecord
	for _, h := range m.history {
		if h.TenantID == tenantID && h.PipelineID == pipelineID {
			filtered = append(filtered, h)
		}
	}
	// Apply offset/limit
	if offset >= len(filtered) {
		return []models.BudgetHistoryRecord{}, nil
	}
	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	return filtered[offset:end], nil
}

func (m *mockBudgetRepo) CountHistory(_ context.Context, tenantID, pipelineID string) (int, error) {
	count := 0
	for _, h := range m.history {
		if h.TenantID == tenantID && h.PipelineID == pipelineID {
			count++
		}
	}
	return count, nil
}

func newMockBudgetRepo() *mockBudgetRepo {
	return &mockBudgetRepo{
		budgets: make(map[string]*models.BudgetConfig),
	}
}

func newTestService(repo *mockBudgetRepo) *Service {
	return &Service{repo: repo}
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

func makeBudgetConfig(tenantID, pipelineID string) *models.BudgetConfig {
	now := unixSec()
	period, _ := marshal(models.BudgetPeriod{Start: "2026-01-01T00:00:00Z", End: "2026-01-31T23:59:59Z"})
	limits, _ := marshal([]models.BudgetLimit{
		{ResourceType: "cpu", Limit: 100, Unit: "cores", Used: 30},
	})
	return &models.BudgetConfig{
		ID:         "budget-1",
		PipelineID: pipelineID,
		TenantID:   tenantID,
		Type:       models.BudgetTypeMonthly,
		Period:     period,
		Limits:     limits,
		Alerts:     "[]",
		CreatedAt:  &now,
		UpdatedAt:  &now,
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestGetBudget_Success(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)
	b := makeBudgetConfig("t1", "p1")
	repo.budgets["t1:p1"] = b

	got, err := svc.GetBudget(context.Background(), "t1", "p1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got.PipelineID != "p1" {
		t.Errorf("expected p1, got %s", got.PipelineID)
	}
}

func TestGetBudget_NotFound(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)

	_, err := svc.GetBudget(context.Background(), "t1", "nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestUpsertBudget_Create(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)

	req := &models.UpsertBudgetRequest{
		Type: models.BudgetTypeMonthly,
		Limits: []models.CreateLimitRequest{
			{ResourceType: "cpu", Limit: 100, Unit: "cores"},
		},
	}
	b, err := svc.UpsertBudget(context.Background(), "t1", "p1", req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if b.PipelineID != "p1" {
		t.Errorf("expected p1, got %s", b.PipelineID)
	}
	if b.Type != models.BudgetTypeMonthly {
		t.Errorf("expected monthly, got %s", b.Type)
	}
	// Verify history was appended
	if len(repo.history) != 1 {
		t.Errorf("expected 1 history entry, got %d", len(repo.history))
	}
}

func TestUpsertBudget_Update(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)
	repo.budgets["t1:p1"] = makeBudgetConfig("t1", "p1")

	req := &models.UpsertBudgetRequest{
		Type: models.BudgetTypeQuarterly,
		Limits: []models.CreateLimitRequest{
			{ResourceType: "cpu", Limit: 200, Unit: "cores"},
		},
	}
	b, err := svc.UpsertBudget(context.Background(), "t1", "p1", req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if b.Type != models.BudgetTypeQuarterly {
		t.Errorf("expected quarterly, got %s", b.Type)
	}
}

func TestUpsertBudget_UpsertError(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)
	repo.upsertFn = func(_ context.Context, _ *models.BudgetConfig) error {
		return errors.New("db error")
	}

	req := &models.UpsertBudgetRequest{
		Type: models.BudgetTypeMonthly,
		Limits: []models.CreateLimitRequest{
			{ResourceType: "cpu", Limit: 100, Unit: "cores"},
		},
	}
	_, err := svc.UpsertBudget(context.Background(), "t1", "p1", req)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestGetBudgetUsage_Success(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)
	repo.budgets["t1:p1"] = makeBudgetConfig("t1", "p1")

	usage, err := svc.GetBudgetUsage(context.Background(), "t1", "p1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if usage.PipelineID != "p1" {
		t.Errorf("expected p1, got %s", usage.PipelineID)
	}
	if len(usage.Resources) != 1 {
		t.Errorf("expected 1 resource, got %d", len(usage.Resources))
	}
	if usage.Resources[0].Percentage != 30 {
		t.Errorf("expected 30%% usage, got %d", usage.Resources[0].Percentage)
	}
}

func TestGetBudgetUsage_NotFound(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)

	_, err := svc.GetBudgetUsage(context.Background(), "t1", "nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestGetAlerts_Empty(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)
	repo.budgets["t1:p1"] = makeBudgetConfig("t1", "p1")

	alerts, err := svc.GetAlerts(context.Background(), "t1", "p1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(alerts) != 0 {
		t.Errorf("expected 0 alerts, got %d", len(alerts))
	}
}

func TestGetAlerts_NotFound(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)

	_, err := svc.GetAlerts(context.Background(), "t1", "nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestCreateAlert_Success(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)
	repo.budgets["t1:p1"] = makeBudgetConfig("t1", "p1")
	enabled := true

	alert, err := svc.CreateAlert(context.Background(), "t1", "p1", &models.CreateAlertRequest{
		Name:      "CPU Alert",
		Threshold: 80,
		Severity:  models.AlertSeverityWarning,
		Channels:  []string{"email"},
		Enabled:   &enabled,
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if alert.Name != "CPU Alert" {
		t.Errorf("expected CPU Alert, got %s", alert.Name)
	}
	if !alert.Enabled {
		t.Error("expected enabled=true")
	}
}

func TestCreateAlert_NotFound(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)

	_, err := svc.CreateAlert(context.Background(), "t1", "nonexistent", &models.CreateAlertRequest{
		Name: "alert", Threshold: 80, Severity: models.AlertSeverityWarning,
	})
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestUpdateAlert_Success(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)
	b := makeBudgetConfig("t1", "p1")
	now := unixSec()
	b.Alerts = `[{"id":"alert-1","name":"Old","threshold":50,"severity":"info","channels":"[]","enabled":true,"createdAt":` + fmt.Sprintf("%d", now) + `,"updatedAt":` + fmt.Sprintf("%d", now) + `}]`
	repo.budgets["t1:p1"] = b

	newName := "Updated Alert"
	newThreshold := 90.0
	updated, err := svc.UpdateAlert(context.Background(), "t1", "p1", "alert-1", &models.UpdateAlertRequest{
		Name:      &newName,
		Threshold: &newThreshold,
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if updated.Name != "Updated Alert" {
		t.Errorf("expected Updated Alert, got %s", updated.Name)
	}
	if updated.Threshold != 90 {
		t.Errorf("expected 90, got %f", updated.Threshold)
	}
}

func TestUpdateAlert_NotFound(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)
	repo.budgets["t1:p1"] = makeBudgetConfig("t1", "p1")

	_, err := svc.UpdateAlert(context.Background(), "t1", "p1", "nonexistent", &models.UpdateAlertRequest{})
	if err == nil {
		t.Fatal("expected error for nonexistent alert")
	}
}

func TestDeleteAlert_Success(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)
	b := makeBudgetConfig("t1", "p1")
	b.Alerts = `[{"id":"alert-1","name":"A","threshold":50,"severity":"info","channels":"[]","enabled":true}]`
	repo.budgets["t1:p1"] = b

	err := svc.DeleteAlert(context.Background(), "t1", "p1", "alert-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestDeleteAlert_BudgetNotFound(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)

	err := svc.DeleteAlert(context.Background(), "t1", "nonexistent", "alert-1")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestDeleteAlert_AlertNotFound(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)
	repo.budgets["t1:p1"] = makeBudgetConfig("t1", "p1")

	err := svc.DeleteAlert(context.Background(), "t1", "p1", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent alert")
	}
}

func TestGetHistoryPage_Success(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)
	repo.history = append(repo.history, models.BudgetHistoryRecord{
		PipelineID: "p1", TenantID: "t1", Action: models.HistoryActionConfigUpdated,
	})
	repo.history = append(repo.history, models.BudgetHistoryRecord{
		PipelineID: "p1", TenantID: "t1", Action: models.HistoryActionAlertTriggered,
	})

	page, err := svc.GetHistoryPage(context.Background(), "t1", "p1", nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if page.Total != 2 {
		t.Errorf("expected 2 total, got %d", page.Total)
	}
	if len(page.Items) != 2 {
		t.Errorf("expected 2 items, got %d", len(page.Items))
	}
}

func TestGetHistoryPage_Empty(t *testing.T) {
	repo := newMockBudgetRepo()
	svc := newTestService(repo)

	page, err := svc.GetHistoryPage(context.Background(), "t1", "p1", nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if page.Total != 0 {
		t.Errorf("expected 0 total, got %d", page.Total)
	}
}

func TestSortAlertsByThreshold(t *testing.T) {
	alerts := []models.BudgetAlert{
		{Name: "high", Threshold: 90},
		{Name: "low", Threshold: 50},
		{Name: "mid", Threshold: 70},
	}
	SortAlertsByThreshold(alerts)
	if alerts[0].Name != "low" {
		t.Errorf("expected low first, got %s", alerts[0].Name)
	}
	if alerts[2].Name != "high" {
		t.Errorf("expected high last, got %s", alerts[2].Name)
	}
}