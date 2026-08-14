package service_test

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/ai/aicost/models"
	"orion/platform-svc-go/internal/ai/aicost/service"
)

// fakeCostRepo is an in-memory fake of repository.RepositoryInterface.
type fakeCostRepo struct {
	// Configurable return values for ListSavingsHistory
	listRecords []models.SavingsRecord
	listErr     error

	// Configurable return values for GetTotalSavings
	totalSavings float64
	totalErr     error

	// Configurable return values for GetTotalSpend
	totalSpend float64
	spendErr   error

	// Last record passed to CreateSavingsRecord
	createdRecord *models.SavingsRecord
	createErr     error
}

func (f *fakeCostRepo) CreateSavingsRecord(ctx context.Context, record *models.SavingsRecord) error {
	f.createdRecord = record
	return f.createErr
}

func (f *fakeCostRepo) ListSavingsHistory(ctx context.Context, tenantID string) ([]models.SavingsRecord, error) {
	return f.listRecords, f.listErr
}

func (f *fakeCostRepo) GetTotalSavings(ctx context.Context, tenantID string) (float64, error) {
	return f.totalSavings, f.totalErr
}

func (f *fakeCostRepo) GetTotalSpend(ctx context.Context, tenantID string) (float64, error) {
	return f.totalSpend, f.spendErr
}

// Compile-time assertion that fakeCostRepo implements the interface.
var _ interface {
	CreateSavingsRecord(ctx context.Context, record *models.SavingsRecord) error
	ListSavingsHistory(ctx context.Context, tenantID string) ([]models.SavingsRecord, error)
	GetTotalSavings(ctx context.Context, tenantID string) (float64, error)
	GetTotalSpend(ctx context.Context, tenantID string) (float64, error)
} = (*fakeCostRepo)(nil)

// --- Service construction ---

func TestService_NewService(t *testing.T) {
	fake := &fakeCostRepo{}
	s := service.NewService(fake)
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestService_NewServiceNil(t *testing.T) {
	s := service.NewService(nil)
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

// --- AnalyzeCostSavings ---

func TestService_AnalyzeCostSavings(t *testing.T) {
	s := service.NewService(&fakeCostRepo{})
	analysis := s.AnalyzeCostSavings("tenant-1")

	if analysis.TenantID != "tenant-1" {
		t.Errorf("expected tenant-1, got %s", analysis.TenantID)
	}
	if analysis.TotalSpend != 5000.00 {
		t.Errorf("expected TotalSpend 5000.00, got %f", analysis.TotalSpend)
	}
	if len(analysis.Opportunities) != 2 {
		t.Fatalf("expected 2 opportunities, got %d", len(analysis.Opportunities))
	}
	if analysis.Currency != "CNY" {
		t.Errorf("expected CNY, got %s", analysis.Currency)
	}
}

func TestService_AnalyzeCostSavings_OpportunityDetails(t *testing.T) {
	s := service.NewService(&fakeCostRepo{})
	analysis := s.AnalyzeCostSavings("tenant-1")

	opp := analysis.Opportunities[0]
	if opp.Category != "model_optimization" {
		t.Errorf("expected category model_optimization, got %s", opp.Category)
	}
	if opp.EstimatedMonthlySavings != 1200.00 {
		t.Errorf("expected savings 1200.00, got %f", opp.EstimatedMonthlySavings)
	}
	if opp.RiskLevel != "low" {
		t.Errorf("expected riskLevel low, got %s", opp.RiskLevel)
	}
}

// --- RecommendOptimization ---

func TestService_RecommendOptimization(t *testing.T) {
	s := service.NewService(&fakeCostRepo{})
	recs, err := s.RecommendOptimization("tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(recs) != 2 {
		t.Fatalf("expected 2 recommendations, got %d", len(recs))
	}
	if recs[0].Category != "model_optimization" {
		t.Errorf("expected model_optimization, got %s", recs[0].Category)
	}
	if recs[1].Category != "idle_resources" {
		t.Errorf("expected idle_resources, got %s", recs[1].Category)
	}
}

// --- GetSavingsHistory ---

func TestService_GetSavingsHistory_Success(t *testing.T) {
	expected := []models.SavingsRecord{
		{ID: "rec-1", TenantID: "tenant-1", Amount: 100.0, Category: "optimize", Description: "test", CreatedAt: models.SavingsRecord{}.CreatedAt},
	}
	fake := &fakeCostRepo{listRecords: expected}
	s := service.NewService(fake)

	ctx := context.Background()
	records, err := s.GetSavingsHistory(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	if records[0].ID != "rec-1" {
		t.Errorf("expected ID rec-1, got %s", records[0].ID)
	}
	if records[0].Amount != 100.0 {
		t.Errorf("expected amount 100.0, got %f", records[0].Amount)
	}
}

func TestService_GetSavingsHistory_Empty(t *testing.T) {
	fake := &fakeCostRepo{listRecords: nil}
	s := service.NewService(fake)

	ctx := context.Background()
	records, err := s.GetSavingsHistory(ctx, "tenant-x")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(records) != 0 {
		t.Errorf("expected empty records, got %d", len(records))
	}
}

func TestService_GetSavingsHistory_Error(t *testing.T) {
	expectedErr := errors.New("db error")
	fake := &fakeCostRepo{listErr: expectedErr}
	s := service.NewService(fake)

	ctx := context.Background()
	_, err := s.GetSavingsHistory(ctx, "tenant-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err != expectedErr {
		t.Errorf("expected db error, got %v", err)
	}
}

// --- GetTotalSavings ---

func TestService_GetTotalSavings_Success(t *testing.T) {
	fake := &fakeCostRepo{totalSavings: 4200.50}
	s := service.NewService(fake)

	ctx := context.Background()
	total, err := s.GetTotalSavings(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 4200.50 {
		t.Errorf("expected 4200.50, got %f", total)
	}
}

func TestService_GetTotalSavings_Zero(t *testing.T) {
	fake := &fakeCostRepo{totalSavings: 0}
	s := service.NewService(fake)

	ctx := context.Background()
	total, err := s.GetTotalSavings(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 0 {
		t.Errorf("expected 0, got %f", total)
	}
}

func TestService_GetTotalSavings_Error(t *testing.T) {
	expectedErr := errors.New("repo failure")
	fake := &fakeCostRepo{totalErr: expectedErr}
	s := service.NewService(fake)

	ctx := context.Background()
	_, err := s.GetTotalSavings(ctx, "tenant-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err != expectedErr {
		t.Errorf("expected repo failure, got %v", err)
	}
}

// --- RecordSavings ---

func TestService_RecordSavings_Success(t *testing.T) {
	fake := &fakeCostRepo{}
	s := service.NewService(fake)

	ctx := context.Background()
	record, err := s.RecordSavings(ctx, "tenant-1", 500.0, "model", "switched model")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if record == nil {
		t.Fatal("expected non-nil record")
	}
	if record.TenantID != "tenant-1" {
		t.Errorf("expected tenant-1, got %s", record.TenantID)
	}
	if record.Amount != 500.0 {
		t.Errorf("expected 500.0, got %f", record.Amount)
	}
	if record.Category != "model" {
		t.Errorf("expected category model, got %s", record.Category)
	}
	if record.Description != "switched model" {
		t.Errorf("expected description 'switched model', got %s", record.Description)
	}
	if record.ID == "" {
		t.Error("expected non-empty ID (UUID)")
	}
	if record.CreatedAt.IsZero() {
		t.Error("expected non-zero CreatedAt")
	}

	// Verify the repo received the record
	if fake.createdRecord == nil {
		t.Fatal("fake repo did not receive a record")
	}
	if fake.createdRecord.TenantID != "tenant-1" {
		t.Errorf("repo got tenantID %s, want tenant-1", fake.createdRecord.TenantID)
	}
}

func TestService_RecordSavings_Error(t *testing.T) {
	expectedErr := errors.New("insert failed")
	fake := &fakeCostRepo{createErr: expectedErr}
	s := service.NewService(fake)

	ctx := context.Background()
	_, err := s.RecordSavings(ctx, "tenant-1", 100.0, "cat", "desc")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err != expectedErr {
		t.Errorf("expected 'insert failed', got %v", err)
	}
}

// --- GenerateAlerts ---

func TestService_GenerateAlerts(t *testing.T) {
	s := service.NewService(&fakeCostRepo{})
	alerts := s.GenerateAlerts("tenant-1")

	// Both opportunities have savings > 500, so both should trigger alerts
	if len(alerts) != 2 {
		t.Fatalf("expected 2 alerts, got %d", len(alerts))
	}
	for i, a := range alerts {
		if a.Type != "high_savings_opportunity" {
			t.Errorf("alert[%d]: expected type high_savings_opportunity, got '%s'", i, a.Type)
		}
	}
}

func TestService_GenerateAlerts_FirstAlert(t *testing.T) {
	s := service.NewService(&fakeCostRepo{})
	alerts := s.GenerateAlerts("tenant-1")

	a := alerts[0]
	if a.Category != "model_optimization" {
		t.Errorf("expected category model_optimization, got %s", a.Category)
	}
	if a.EstimatedMonthlySavings != 1200.00 {
		t.Errorf("expected 1200.00, got %f", a.EstimatedMonthlySavings)
	}
}
