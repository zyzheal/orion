package service_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/ai/aicost/models"
	"orion/platform-svc-go/internal/ai/aicost/repository"
	"orion/platform-svc-go/internal/ai/aicost/service"
)

// fakeCostRepo is an in-memory fake of repository.RepositoryInterface that
// records the tenantID each method saw, so a call that drops or swaps the
// tenant fails here instead of silently answering for the wrong tenant.
type fakeCostRepo struct {
	// Savings ledger
	listRecords   []models.SavingsRecord
	listErr       error
	totalSavings  float64
	totalErr      error
	createdRecord *models.SavingsRecord
	createErr     error

	// Recorded spend
	totalSpend float64
	spendErr   error
	byModel    []repository.ModelSpend
	byModelErr error

	spendTenant   string
	byModelTenant string
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
	f.spendTenant = tenantID
	return f.totalSpend, f.spendErr
}

func (f *fakeCostRepo) ListSpendByModel(ctx context.Context, tenantID string) ([]repository.ModelSpend, error) {
	f.byModelTenant = tenantID
	return f.byModel, f.byModelErr
}

// Compile-time assertion that the fake covers the whole interface.
var _ repository.RepositoryInterface = (*fakeCostRepo)(nil)

const testTenant = "tenant-1"

func newService(fake *fakeCostRepo) *service.Service {
	return service.NewService(fake)
}

// --- Construction ---

func TestService_NewService(t *testing.T) {
	if s := service.NewService(&fakeCostRepo{}); s == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestService_NewServiceNil(t *testing.T) {
	if s := service.NewService(nil); s == nil {
		t.Fatal("NewService returned nil")
	}
}

// --- AnalyzeCostSavings ---

// TestAnalyzeCostSavings_BindsTenantAndReturnsRepoSpend pins both numbers in
// the analysis to the repository. The method used to return a hardcoded
// 5000.00 and two hardcoded opportunities for every tenant, ignoring
// tenantID entirely.
func TestAnalyzeCostSavings_BindsTenantAndReturnsRepoSpend(t *testing.T) {
	fake := &fakeCostRepo{totalSpend: 12.5}
	s := newService(fake)

	got, err := s.AnalyzeCostSavings(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.TenantID != testTenant {
		t.Errorf("TenantID = %q, want %q", got.TenantID, testTenant)
	}
	if got.TotalSpend != 12.5 {
		t.Errorf("TotalSpend = %v, want 12.5 from the repository", got.TotalSpend)
	}
	if got.TotalSpend == 5000.00 {
		t.Error("TotalSpend is still the old hardcoded 5000.00")
	}
	if got.Currency != "CNY" {
		t.Errorf("Currency = %q, want CNY", got.Currency)
	}
	if len(got.Opportunities) != 0 {
		t.Errorf("Opportunities = %d rows, want 0 with no per-model data", len(got.Opportunities))
	}
	if got.Opportunities == nil {
		t.Error("Opportunities is nil; callers expect an empty array, not null")
	}
	if fake.spendTenant != testTenant || fake.byModelTenant != testTenant {
		t.Errorf("repo saw spendTenant=%q byModelTenant=%q, want %q for both",
			fake.spendTenant, fake.byModelTenant, testTenant)
	}
}

// TestAnalyzeCostSavings_NoRecordsMeansZero keeps a tenant that has recorded
// nothing at zero instead of the old default.
func TestAnalyzeCostSavings_NoRecordsMeansZero(t *testing.T) {
	s := newService(&fakeCostRepo{totalSpend: 0})

	got, err := s.AnalyzeCostSavings(context.Background(), "empty-tenant")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.TotalSpend != 0 {
		t.Errorf("TotalSpend = %v, want 0 for a tenant with no records", got.TotalSpend)
	}
}

// TestAnalyzeCostSavings_BindsOpportunitiesFromPerModelSpend proves the
// opportunities are derived from the tenant's own per-model spend, with the
// share and risk label computed from that window.
func TestAnalyzeCostSavings_BindsOpportunitiesFromPerModelSpend(t *testing.T) {
	fake := &fakeCostRepo{
		totalSpend: 10000,
		byModel: []repository.ModelSpend{
			{ModelID: "gpt-4", Spend: 600.0, Requests: 10},
			{ModelID: "claude-3", Spend: 400.0, Requests: 5},
		},
	}
	s := newService(fake)

	got, err := s.AnalyzeCostSavings(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got.Opportunities) != 2 {
		t.Fatalf("got %d opportunities, want 2", len(got.Opportunities))
	}

	a := got.Opportunities[0]
	if a.ResourceName != "gpt-4" {
		t.Errorf("opportunity 0 ResourceName = %q, want gpt-4", a.ResourceName)
	}
	if a.Category != "model_consolidation" {
		t.Errorf("opportunity 0 Category = %q, want model_consolidation", a.Category)
	}
	if a.EstimatedMonthlySavings != 600.0 {
		t.Errorf("opportunity 0 savings = %v, want 600.0 from the recorded spend", a.EstimatedMonthlySavings)
	}
	if a.RiskLevel != "high" {
		t.Errorf("opportunity 0 risk = %q, want high (60%% of the window)", a.RiskLevel)
	}
	for _, want := range []string{"gpt-4", "600.00", "10 request", "60%"} {
		if !strings.Contains(a.Description, want) {
			t.Errorf("description %q does not contain %q", a.Description, want)
		}
	}

	b := got.Opportunities[1]
	if b.ResourceName != "claude-3" {
		t.Errorf("opportunity 1 ResourceName = %q, want claude-3", b.ResourceName)
	}
	if b.EstimatedMonthlySavings != 400.0 {
		t.Errorf("opportunity 1 savings = %v, want 400.0", b.EstimatedMonthlySavings)
	}
	if b.RiskLevel != "medium" {
		t.Errorf("opportunity 1 risk = %q, want medium (40%% of the window)", b.RiskLevel)
	}
}

// TestAnalyzeCostSavings_ShareIsAgainstTheMonthlyWindow pins the denominator:
// the share must be taken over the models' 30-day spend, never over the
// all-time total, which would make every share read as ~0 and every risk read
// as low.
func TestAnalyzeCostSavings_ShareIsAgainstTheMonthlyWindow(t *testing.T) {
	fake := &fakeCostRepo{
		totalSpend: 10000,
		byModel: []repository.ModelSpend{
			{ModelID: "a", Spend: 100.0, Requests: 1},
			{ModelID: "b", Spend: 100.0, Requests: 1},
		},
	}
	got, err := newService(fake).AnalyzeCostSavings(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got.Opportunities) != 2 {
		t.Fatalf("got %d opportunities, want 2", len(got.Opportunities))
	}
	if got.Opportunities[0].RiskLevel != "high" {
		t.Errorf("risk = %q, want high: 100 of a 200 window is 50%%, not 100 of 10000",
			got.Opportunities[0].RiskLevel)
	}
	if !strings.Contains(got.Opportunities[0].Description, "50%") {
		t.Errorf("description %q does not state the 50%% window share", got.Opportunities[0].Description)
	}
}

// TestAnalyzeCostSavings_SkipsModelsWithNoSpend keeps a model that recorded
// zero cost out of the list; it is not an opportunity.
func TestAnalyzeCostSavings_SkipsModelsWithNoSpend(t *testing.T) {
	fake := &fakeCostRepo{
		totalSpend: 500,
		byModel: []repository.ModelSpend{
			{ModelID: "free-tier", Spend: 0, Requests: 3},
			{ModelID: "paid", Spend: 500.0, Requests: 2},
		},
	}
	got, err := newService(fake).AnalyzeCostSavings(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got.Opportunities) != 1 {
		t.Fatalf("got %d opportunities, want 1", len(got.Opportunities))
	}
	if got.Opportunities[0].ResourceName != "paid" {
		t.Errorf("ResourceName = %q, want paid", got.Opportunities[0].ResourceName)
	}
}

// TestAnalyzeCostSavings_LabelsAMissingModelID names records whose model_id is
// null instead of emitting a blank resource.
func TestAnalyzeCostSavings_LabelsAMissingModelID(t *testing.T) {
	fake := &fakeCostRepo{
		totalSpend: 300,
		byModel:    []repository.ModelSpend{{ModelID: "", Spend: 300.0, Requests: 4}},
	}
	got, err := newService(fake).AnalyzeCostSavings(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got.Opportunities) != 1 {
		t.Fatalf("got %d opportunities, want 1", len(got.Opportunities))
	}
	if got.Opportunities[0].ResourceName != "unspecified-model" {
		t.Errorf("ResourceName = %q, want unspecified-model", got.Opportunities[0].ResourceName)
	}
}

func TestAnalyzeCostSavings_TotalSpendError(t *testing.T) {
	wantErr := errors.New("spend query failed")
	fake := &fakeCostRepo{spendErr: wantErr}

	got, err := newService(fake).AnalyzeCostSavings(context.Background(), testTenant)
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if !errors.Is(err, wantErr) {
		t.Errorf("err = %v, want it to wrap %v", err, wantErr)
	}
	if !strings.Contains(err.Error(), "read total spend") {
		t.Errorf("err = %q, want the failure to name the query", err.Error())
	}
	if got.TotalSpend == 5000.00 {
		t.Error("TotalSpend is still the old hardcoded 5000.00 on failure")
	}
}

func TestAnalyzeCostSavings_SpendByModelError(t *testing.T) {
	wantErr := errors.New("by-model query failed")
	fake := &fakeCostRepo{byModelErr: wantErr}

	_, err := newService(fake).AnalyzeCostSavings(context.Background(), testTenant)
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if !errors.Is(err, wantErr) {
		t.Errorf("err = %v, want it to wrap %v", err, wantErr)
	}
	if !strings.Contains(err.Error(), "read spend by model") {
		t.Errorf("err = %q, want the failure to name the query", err.Error())
	}
}

// --- RecommendOptimization ---

// TestRecommendOptimization_ReturnsTheSameSet pins that a recommendation list
// is the same analysis slice, not a second hardcoded set.
func TestRecommendOptimization_ReturnsTheSameSet(t *testing.T) {
	byModel := []repository.ModelSpend{
		{ModelID: "gpt-4", Spend: 600.0, Requests: 10},
		{ModelID: "claude-3", Spend: 400.0, Requests: 5},
	}
	fake := &fakeCostRepo{totalSpend: 1000, byModel: byModel}

	recs, err := newService(fake).RecommendOptimization(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(recs) != 2 {
		t.Fatalf("got %d recommendations, want 2", len(recs))
	}
	if recs[0].ResourceName != "gpt-4" || recs[0].EstimatedMonthlySavings != 600.0 {
		t.Errorf("recommendation 0 = %+v, want gpt-4 / 600.0", recs[0])
	}
	if recs[1].ResourceName != "claude-3" || recs[1].EstimatedMonthlySavings != 400.0 {
		t.Errorf("recommendation 1 = %+v, want claude-3 / 400.0", recs[1])
	}
	if recs[0].Category != "model_consolidation" {
		t.Errorf("category = %q, want model_consolidation", recs[0].Category)
	}
}

func TestRecommendOptimization_EmptySliceNotNil(t *testing.T) {
	recs, err := newService(&fakeCostRepo{}).RecommendOptimization(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(recs) != 0 {
		t.Errorf("got %d recommendations, want 0", len(recs))
	}
	if recs == nil {
		t.Error("recommendations is nil; callers expect an empty array, not null")
	}
}

func TestRecommendOptimization_PropagatesError(t *testing.T) {
	wantErr := errors.New("by-model query failed")
	_, err := newService(&fakeCostRepo{byModelErr: wantErr}).
		RecommendOptimization(context.Background(), testTenant)
	if !errors.Is(err, wantErr) {
		t.Fatalf("err = %v, want it to wrap %v", err, wantErr)
	}
}

// --- GenerateAlerts ---

// TestGenerateAlerts_OnlyOpportunitiesAboveTheFloor pins the threshold and the
// fields the alert carries.
func TestGenerateAlerts_OnlyOpportunitiesAboveTheFloor(t *testing.T) {
	fake := &fakeCostRepo{
		byModel: []repository.ModelSpend{
			{ModelID: "big", Spend: 600.0, Requests: 3},
			{ModelID: "small", Spend: 300.0, Requests: 2},
		},
	}
	alerts, err := newService(fake).GenerateAlerts(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("got %d alerts, want 1 (only the 600.00 opportunity clears 500.0)", len(alerts))
	}
	a := alerts[0]
	if a.Type != "high_savings_opportunity" {
		t.Errorf("Type = %q, want high_savings_opportunity", a.Type)
	}
	if a.ResourceName != "big" {
		t.Errorf("ResourceName = %q, want big", a.ResourceName)
	}
	if a.EstimatedMonthlySavings != 600.0 {
		t.Errorf("EstimatedMonthlySavings = %v, want 600.0", a.EstimatedMonthlySavings)
	}
	if a.RiskLevel != "high" {
		t.Errorf("RiskLevel = %q, want high", a.RiskLevel)
	}
	if a.Category != "model_consolidation" {
		t.Errorf("Category = %q, want model_consolidation", a.Category)
	}
}

// TestGenerateAlerts_EmptySliceNotNil keeps the JSON shape an array for a
// tenant with no opportunities.
// TestGenerateAlerts_AtTheFloorIsNotAlerted pins the cutoff: the floor is
// strict, so a model whose spend equals it is below it and stays quiet.
func TestGenerateAlerts_AtTheFloorIsNotAlerted(t *testing.T) {
	fake := &fakeCostRepo{
		byModel: []repository.ModelSpend{{ModelID: "borderline", Spend: 500.0, Requests: 4}},
	}
	alerts, err := newService(fake).GenerateAlerts(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 0 {
		t.Fatalf("got %d alerts, want none: 500.00 is the floor, not above it", len(alerts))
	}
	if alerts == nil {
		t.Fatalf("alerts is nil, want an empty slice")
	}
}

func TestGenerateAlerts_EmptySliceNotNil(t *testing.T) {
	alerts, err := newService(&fakeCostRepo{}).GenerateAlerts(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(alerts) != 0 {
		t.Errorf("got %d alerts, want 0", len(alerts))
	}
	if alerts == nil {
		t.Error("alerts is nil; callers expect an empty array, not null")
	}
}

func TestGenerateAlerts_PropagatesError(t *testing.T) {
	wantErr := errors.New("by-model query failed")
	_, err := newService(&fakeCostRepo{byModelErr: wantErr}).GenerateAlerts(context.Background(), testTenant)
	if !errors.Is(err, wantErr) {
		t.Fatalf("err = %v, want it to wrap %v", err, wantErr)
	}
}

// --- GetSavingsHistory ---

func TestGetSavingsHistory_Success(t *testing.T) {
	when := time.Date(2026, 8, 26, 0, 0, 0, 0, time.UTC)
	fake := &fakeCostRepo{listRecords: []models.SavingsRecord{
		{ID: "rec-1", TenantID: testTenant, Amount: 100.0, Category: "optimize", Description: "test", CreatedAt: when},
	}}

	records, err := newService(fake).GetSavingsHistory(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("got %d records, want 1", len(records))
	}
	if records[0].ID != "rec-1" || records[0].Amount != 100.0 {
		t.Errorf("record = %+v, want rec-1 / 100.0", records[0])
	}
}

func TestGetSavingsHistory_Empty(t *testing.T) {
	records, err := newService(&fakeCostRepo{listRecords: nil}).
		GetSavingsHistory(context.Background(), "tenant-x")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(records) != 0 {
		t.Errorf("got %d records, want 0", len(records))
	}
}

func TestGetSavingsHistory_Error(t *testing.T) {
	wantErr := errors.New("db error")
	_, err := newService(&fakeCostRepo{listErr: wantErr}).
		GetSavingsHistory(context.Background(), testTenant)
	if !errors.Is(err, wantErr) {
		t.Fatalf("err = %v, want %v", err, wantErr)
	}
}

// --- GetTotalSavings ---

func TestGetTotalSavings_Success(t *testing.T) {
	total, err := newService(&fakeCostRepo{totalSavings: 4200.50}).
		GetTotalSavings(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 4200.50 {
		t.Errorf("total = %v, want 4200.50", total)
	}
}

func TestGetTotalSavings_Zero(t *testing.T) {
	total, err := newService(&fakeCostRepo{totalSavings: 0}).
		GetTotalSavings(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 0 {
		t.Errorf("total = %v, want 0", total)
	}
}

func TestGetTotalSavings_Error(t *testing.T) {
	wantErr := errors.New("repo failure")
	_, err := newService(&fakeCostRepo{totalErr: wantErr}).
		GetTotalSavings(context.Background(), testTenant)
	if !errors.Is(err, wantErr) {
		t.Fatalf("err = %v, want %v", err, wantErr)
	}
}

// --- RecordSavings ---

func TestRecordSavings_Success(t *testing.T) {
	fake := &fakeCostRepo{}
	record, err := newService(fake).RecordSavings(context.Background(), testTenant, 500.0, "model", "switched model")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if record == nil {
		t.Fatal("expected a non-nil record")
	}
	if record.TenantID != testTenant {
		t.Errorf("TenantID = %q, want %q", record.TenantID, testTenant)
	}
	if record.Amount != 500.0 || record.Category != "model" || record.Description != "switched model" {
		t.Errorf("record = %+v, want 500.0 / model / switched model", record)
	}
	if record.ID == "" {
		t.Error("expected a non-empty ID")
	}
	if record.CreatedAt.IsZero() {
		t.Error("expected a non-zero CreatedAt")
	}
	if fake.createdRecord == nil {
		t.Fatal("the fake repository did not receive a record")
	}
	if fake.createdRecord.TenantID != testTenant {
		t.Errorf("repo saw tenantID %q, want %q", fake.createdRecord.TenantID, testTenant)
	}
}

func TestRecordSavings_Error(t *testing.T) {
	wantErr := errors.New("insert failed")
	_, err := newService(&fakeCostRepo{createErr: wantErr}).
		RecordSavings(context.Background(), testTenant, 100.0, "cat", "desc")
	if !errors.Is(err, wantErr) {
		t.Fatalf("err = %v, want %v", err, wantErr)
	}
}
