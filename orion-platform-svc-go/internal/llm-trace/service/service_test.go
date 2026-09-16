package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/llm-trace/models"
)

// fakeRepo records which repository calls the service makes, so a test can
// prove both that a fault surfaced and that no write happened afterwards.
type fakeRepo struct {
	traces         []models.LLMTrace
	trace          *models.LLMTrace
	getTraceErr    error
	getPricingErr  error
	customPricing  *models.ModelPricing
	listErr        error
	listByRangeErr error
	updateErr      error

	getCalls        int
	getPricingCalls int
	updateCalls     int
	listQuery       *models.ListTracesQuery
	countQuery      *models.ListTracesQuery
	updated         map[string]interface{}
}

var _ RepositoryInterface = (*fakeRepo)(nil)

func (f *fakeRepo) CountTracesByTenant(ctx context.Context, tenantID string, q *models.ListTracesQuery) (int64, error) {
	f.countQuery = q
	return 0, nil
}

func (f *fakeRepo) CreateTrace(ctx context.Context, t *models.LLMTrace) error {
	return nil
}

func (f *fakeRepo) GetCustomPricing(ctx context.Context, modelID string) (*models.ModelPricing, error) {
	f.getPricingCalls++
	return f.customPricing, f.getPricingErr
}

func (f *fakeRepo) GetDailyStats(ctx context.Context, tenantID, dateStr string) (*models.DailyStats, error) {
	return nil, nil
}

func (f *fakeRepo) GetTrace(ctx context.Context, traceID, tenantID string) (*models.LLMTrace, error) {
	f.getCalls++
	if f.getTraceErr != nil {
		return nil, f.getTraceErr
	}
	if f.trace != nil {
		return f.trace, nil
	}
	if len(f.traces) > 0 {
		return &f.traces[0], nil
	}
	return nil, sql.ErrNoRows
}

func (f *fakeRepo) GetTrackingAccuracy(ctx context.Context, tenantID string) (*models.TrackingAccuracy, error) {
	return nil, nil
}

func (f *fakeRepo) ListTracesByTenant(ctx context.Context, tenantID string, q *models.ListTracesQuery) ([]models.LLMTrace, error) {
	f.listQuery = q
	return f.traces, f.listErr
}

func (f *fakeRepo) ListTracesByTenantAndDateRange(ctx context.Context, tenantID string, start, end *time.Time) ([]models.LLMTrace, error) {
	return f.traces, f.listByRangeErr
}

func (f *fakeRepo) UpdateTrace(ctx context.Context, traceID, tenantID string, fields map[string]interface{}) error {
	f.updateCalls++
	f.updated = fields
	return f.updateErr
}

func TestService_CalculateCost_PropagatesPricingFault(t *testing.T) {
	f := &fakeRepo{getPricingErr: errors.New("connection refused")}
	got, err := NewService(f).CalculateCost(context.Background(), "gpt-4", 100, 10)
	if err == nil {
		t.Fatal("err = nil, want the pricing fault")
	}
	if got != nil {
		t.Fatalf("breakdown = %+v, want nil with an error", got)
	}
	if !strings.Contains(err.Error(), "connection refused") {
		t.Errorf("error = %q, want the repository fault to be visible", err.Error())
	}
}

func TestService_CalculateBatchCost_PropagatesPricingFault(t *testing.T) {
	f := &fakeRepo{getPricingErr: errors.New("connection refused")}
	traces := []models.LLMTrace{{ModelID: "gpt-4"}}
	got, err := NewService(f).CalculateBatchCost(context.Background(), traces)
	if err == nil {
		t.Fatal("err = nil, want the pricing fault")
	}
	if got != nil {
		t.Fatalf("breakdown = %+v, want nil with an error", got)
	}
}

func TestService_GetCostBreakdown_PropagatesRepositoryFaults(t *testing.T) {
	t.Run("list fault", func(t *testing.T) {
		f := &fakeRepo{listByRangeErr: errors.New("list down")}
		b, n, err := NewService(f).GetCostBreakdown(context.Background(), "t", &models.CostBreakdownQuery{})
		if err == nil || b != nil || n != 0 {
			t.Fatalf("got (%v, %v, %d), want (fault, nil, 0)", b, err, n)
		}
		if !strings.Contains(err.Error(), "list down") {
			t.Errorf("error = %q, want the list fault", err.Error())
		}
	})
	t.Run("pricing fault", func(t *testing.T) {
		f := &fakeRepo{traces: []models.LLMTrace{{ModelID: "gpt-4"}}, getPricingErr: errors.New("pricing down")}
		b, n, err := NewService(f).GetCostBreakdown(context.Background(), "t", &models.CostBreakdownQuery{})
		if err == nil || b != nil || n != 0 {
			t.Fatalf("got (%v, %v, %d), want (fault, nil, 0)", b, err, n)
		}
		if !strings.Contains(err.Error(), "pricing down") {
			t.Errorf("error = %q, want the pricing fault", err.Error())
		}
	})
}

func TestService_CompleteTrace_PropagatesPricingFaultWithoutWriting(t *testing.T) {
	f := &fakeRepo{
		trace:         &models.LLMTrace{ModelID: "gpt-4", RequestStartedAt: time.Now().UTC().Add(-time.Second)},
		getPricingErr: errors.New("pricing table unreachable"),
	}
	got, err := NewService(f).CompleteTrace(context.Background(), "trace-1", "tenant-1",
		&models.TraceCompleteRequest{OutputContent: "out", InputTokens: 100, OutputTokens: 10})
	if err == nil {
		t.Fatal("err = nil, want the pricing fault")
	}
	if got != nil {
		t.Fatalf("trace = %+v, want nil with an error", got)
	}
	if f.updateCalls != 0 {
		t.Fatalf("UpdateTrace was called %d times after a pricing fault", f.updateCalls)
	}
	if !strings.Contains(err.Error(), "pricing table unreachable") {
		t.Errorf("error = %q, want the repository fault", err.Error())
	}
}

func TestService_CompleteTrace_UnknownTraceIsNotFound(t *testing.T) {
	f := &fakeRepo{getTraceErr: sql.ErrNoRows}
	got, err := NewService(f).CompleteTrace(context.Background(), "missing", "tenant-1",
		&models.TraceCompleteRequest{OutputContent: "out"})
	if got != nil {
		t.Fatalf("trace = %+v, want nil", got)
	}
	if !errors.Is(err, ErrTraceNotFound) {
		t.Fatalf("err = %v, want ErrTraceNotFound", err)
	}
}

func TestService_CompleteTrace_WrapsUpdateFault(t *testing.T) {
	f := &fakeRepo{
		trace:     &models.LLMTrace{ModelID: "gpt-4", RequestStartedAt: time.Now().UTC().Add(-time.Second)},
		updateErr: errors.New("update rejected"),
	}
	got, err := NewService(f).CompleteTrace(context.Background(), "trace-1", "tenant-1",
		&models.TraceCompleteRequest{OutputContent: "out"})
	if got != nil {
		t.Fatalf("trace = %+v, want nil", got)
	}
	if err == nil || !strings.Contains(err.Error(), "update rejected") {
		t.Fatalf("err = %v, want the update fault wrapped", err)
	}
}

// The persisted numbers must come from the effective price, not the built-in
// table: this is what makes the old "ignore the error, use defaults" behaviour
// observable rather than silent.
func TestService_CompleteTrace_PersistsCostFromCustomPricing(t *testing.T) {
	started := time.Date(2026, 8, 26, 10, 0, 0, 0, time.UTC)
	f := &fakeRepo{
		trace:         &models.LLMTrace{ModelID: "model-x", RequestStartedAt: started},
		customPricing: &models.ModelPricing{Input: 2.0, Output: 8.0},
	}
	got, err := NewService(f).CompleteTrace(context.Background(), "trace-1", "tenant-1",
		&models.TraceCompleteRequest{OutputContent: "hello", InputTokens: 1000, OutputTokens: 500})
	if err != nil {
		t.Fatalf("CompleteTrace: %v", err)
	}
	if got == nil {
		t.Fatal("CompleteTrace returned nil without an error")
	}
	fields := f.updated
	if fields == nil {
		t.Fatal("UpdateTrace was never called")
	}
	if gotCost := fields["input_cost"]; gotCost != 2000.0 {
		t.Errorf("input_cost = %v, want 2000.0", gotCost)
	}
	if gotCost := fields["output_cost"]; gotCost != 4000.0 {
		t.Errorf("output_cost = %v, want 4000.0", gotCost)
	}
	if gotCost := fields["total_cost"]; gotCost != 6000.0 {
		t.Errorf("total_cost = %v, want 6000.0", gotCost)
	}
	if got := fields["total_tokens"]; got != 1500 {
		t.Errorf("total_tokens = %v, want 1500", got)
	}
	if got := fields["status"]; got != string(models.TraceStatusCompleted) {
		t.Errorf("status = %v, want completed", got)
	}
	if _, ok := fields["error_message"]; ok {
		t.Error("error_message was written although no error was reported")
	}
	if got := fields["output_hash"]; got == "" {
		t.Error("output_hash is empty")
	} else if len(got.(string)) != 64 {
		t.Errorf("output_hash = %v, want a sha256 hex string", got)
	}
}

func TestService_CompleteTrace_FailedTraceCarriesTheErrorMessage(t *testing.T) {
	f := &fakeRepo{trace: &models.LLMTrace{ModelID: "gpt-4", RequestStartedAt: time.Now().UTC().Add(-time.Second)}}
	if _, err := NewService(f).CompleteTrace(context.Background(), "trace-1", "tenant-1",
		&models.TraceCompleteRequest{OutputContent: "out", ErrorMessage: "boom"}); err != nil {
		t.Fatalf("CompleteTrace: %v", err)
	}
	if got := f.updated["status"]; got != string(models.TraceStatusFailed) {
		t.Errorf("status = %v, want failed", got)
	}
	if got := f.updated["error_message"]; got != "boom" {
		t.Errorf("error_message = %v, want boom", got)
	}
}

func TestService_CalculateCost_CustomPricingWins(t *testing.T) {
	f := &fakeRepo{customPricing: &models.ModelPricing{Input: 2.0, Output: 8.0}}
	b, err := NewService(f).CalculateCost(context.Background(), "model-x", 1000, 500)
	if err != nil {
		t.Fatalf("CalculateCost: %v", err)
	}
	if b.TotalCost != 6000.0 || b.InputCost != 2000.0 || b.OutputCost != 4000.0 {
		t.Fatalf("breakdown = %+v, want 2000/4000/6000", b)
	}
	if b.Currency != "CNY" {
		t.Errorf("currency = %q, want CNY", b.Currency)
	}
	if got := b.BreakdownByModel["model-x"]; got != 6000.0 {
		t.Errorf("breakdown by model = %v, want 6000.0", got)
	}
}

// An unknown model id must cost the same as gpt-4, not zero.
func TestService_CalculateCost_UnknownModelFallsBackToDefault(t *testing.T) {
	f := &fakeRepo{}
	b, err := NewService(f).CalculateCost(context.Background(), "never-seen-model", 1000, 500)
	if err != nil {
		t.Fatalf("CalculateCost: %v", err)
	}
	wantIn := float64(1000) * models.DefaultModelPricing["gpt-4"].Input
	wantOut := float64(500) * models.DefaultModelPricing["gpt-4"].Output
	if b.InputCost != wantIn || b.OutputCost != wantOut {
		t.Fatalf("costs = %v/%v, want %v/%v", b.InputCost, b.OutputCost, wantIn, wantOut)
	}
	if b.TotalCost != wantIn+wantOut {
		t.Errorf("total = %v, want %v", b.TotalCost, wantIn+wantOut)
	}
	if len(models.DefaultModelPricing) == 0 || b.TotalCost == 0 {
		t.Fatalf("total = %v, want a non-zero fallback price", b.TotalCost)
	}
}

func TestService_GetTrace_WrapsNoRowsInSentinel(t *testing.T) {
	f := &fakeRepo{getTraceErr: sql.ErrNoRows}
	got, err := NewService(f).GetTrace(context.Background(), "missing", "tenant-1")
	if got != nil {
		t.Fatalf("trace = %+v, want nil", got)
	}
	if !errors.Is(err, ErrTraceNotFound) {
		t.Fatalf("err = %v, want ErrTraceNotFound", err)
	}
}

func TestService_GetTrace_RecognisesWrappedNoRows(t *testing.T) {
	f := &fakeRepo{getTraceErr: fmt.Errorf("query failed: %w", sql.ErrNoRows)}
	got, err := NewService(f).GetTrace(context.Background(), "missing", "tenant-1")
	if got != nil {
		t.Fatalf("trace = %+v, want nil", got)
	}
	if !errors.Is(err, ErrTraceNotFound) {
		t.Fatalf("err = %v, want ErrTraceNotFound from a wrapped driver error", err)
	}
}

func TestService_CompleteTrace_RecognisesWrappedNoRows(t *testing.T) {
	f := &fakeRepo{getTraceErr: fmt.Errorf("query failed: %w", sql.ErrNoRows)}
	got, err := NewService(f).CompleteTrace(context.Background(), "missing", "tenant-1",
		&models.TraceCompleteRequest{OutputContent: "out"})
	if got != nil {
		t.Fatalf("trace = %+v, want nil", got)
	}
	if !errors.Is(err, ErrTraceNotFound) {
		t.Fatalf("err = %v, want ErrTraceNotFound from a wrapped driver error", err)
	}
	if f.updateCalls != 0 {
		t.Fatalf("UpdateTrace was called %d times for a missing trace", f.updateCalls)
	}
}

func TestService_GetTrace_PassesThroughDriverFault(t *testing.T) {
	f := &fakeRepo{getTraceErr: errors.New("socket closed")}
	got, err := NewService(f).GetTrace(context.Background(), "trace-1", "tenant-1")
	if got != nil {
		t.Fatalf("trace = %+v, want nil", got)
	}
	if err == nil || errors.Is(err, ErrTraceNotFound) {
		t.Fatalf("err = %v, want the driver fault, not the not-found sentinel", err)
	}
}

// A nil query means "no filters"; the old code checked q != nil and then
// dereferenced it unconditionally in the else branch.
func TestService_ListTraces_NilQueryDoesNotDereference(t *testing.T) {
	f := &fakeRepo{}
	traces, total, err := NewService(f).ListTraces(context.Background(), "tenant-1", nil)
	if err != nil {
		t.Fatalf("ListTraces: %v", err)
	}
	if traces == nil {
		t.Fatal("traces = nil, want an empty slice")
	}
	if total != 0 {
		t.Errorf("total = %d, want 0", total)
	}
	if f.listQuery == nil {
		t.Fatal("the repository received a nil query")
	}
	if f.listQuery.ScenarioID != nil {
		t.Errorf("scenario filter = %v, want none", *f.listQuery.ScenarioID)
	}
	if f.countQuery != nil {
		t.Errorf("count query = %v, want nil", f.countQuery)
	}
}

func TestService_ListTraces_ScenarioFilterReachesTheRepository(t *testing.T) {
	scenario := "pipeline"
	f := &fakeRepo{}
	if _, _, err := NewService(f).ListTraces(context.Background(), "tenant-1",
		&models.ListTracesQuery{ScenarioID: &scenario}); err != nil {
		t.Fatalf("ListTraces: %v", err)
	}
	if f.listQuery == nil || f.listQuery.ScenarioID == nil || *f.listQuery.ScenarioID != "pipeline" {
		t.Fatalf("repository got %+v, want the scenario filter", f.listQuery)
	}
	if f.countQuery == nil {
		t.Fatal("the count query was not forwarded")
	}
}

func TestService_ListTraces_PropagatesListFault(t *testing.T) {
	f := &fakeRepo{listErr: errors.New("select down")}
	traces, total, err := NewService(f).ListTraces(context.Background(), "tenant-1", nil)
	if err == nil || traces != nil || total != 0 {
		t.Fatalf("got (%v, %d, %v), want (nil, 0, fault)", traces, total, err)
	}
	if !strings.Contains(err.Error(), "select down") {
		t.Errorf("error = %q, want the list fault", err.Error())
	}
}

func TestService_GetAllPricing_ReturnsTheBuiltInTable(t *testing.T) {
	got := NewService(&fakeRepo{}).GetAllPricing(context.Background())
	if len(got) != len(models.DefaultModelPricing) {
		t.Fatalf("pricing has %d entries, want %d", len(got), len(models.DefaultModelPricing))
	}
	if got["gpt-4"] != models.DefaultModelPricing["gpt-4"] {
		t.Errorf("gpt-4 pricing = %v", got["gpt-4"])
	}
}
