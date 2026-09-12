package service

import (
	"context"
	"errors"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/performance/models"
)

// fakeRepo records every call so a test can assert on the arguments the service
// decided to persist, not just on the value it handed back.
type fakeRepo struct {
	baselines []models.Baseline
	listErr   error
	evalErr   error

	bottlenecks      []models.Bottleneck
	getBottleneckErr error
	suggestions      []models.Suggestion

	results []models.TestResult

	recordedEvalBaselineID string
	recordedEvalTenantID   string
	recordedEvalValue      float64
	recordedEvalStatus     string
	recordedEvalCalls      int
	recordedTest           *models.TestResultRequest
	lastBottleneckService  string
	bottleneckCalls        int
	lastResultsService     string
}

var _ RepositoryInterface = (*fakeRepo)(nil)

func (f *fakeRepo) CreateBaseline(ctx context.Context, tenantID string, b *models.Baseline) (*models.Baseline, error) {
	return b, nil
}

func (f *fakeRepo) DetectRegression(ctx context.Context, tenantID string, req *models.DetectRegressionRequest) (*models.RegressionResult, error) {
	return nil, nil
}

func (f *fakeRepo) GetBaselineByID(ctx context.Context, id string, tenantID string) (*models.Baseline, error) {
	return nil, sentinel.NotFound
}

func (f *fakeRepo) GetBottlenecks(ctx context.Context, tenantID, serviceName string) ([]models.Bottleneck, error) {
	f.bottleneckCalls++
	f.lastBottleneckService = serviceName
	return f.bottlenecks, f.getBottleneckErr
}

func (f *fakeRepo) GetEvaluationHistory(ctx context.Context, baselineID string, tenantID string) ([]models.Evaluation, error) {
	return nil, nil
}

func (f *fakeRepo) GetSuggestions(ctx context.Context, tenantID, serviceName string) ([]models.Suggestion, error) {
	return f.suggestions, nil
}

func (f *fakeRepo) GetTestResults(ctx context.Context, tenantID, serviceName string) ([]models.TestResult, error) {
	f.lastResultsService = serviceName
	return f.results, nil
}

func (f *fakeRepo) ListBaselines(ctx context.Context, tenantID string) ([]models.Baseline, error) {
	return f.baselines, f.listErr
}

func (f *fakeRepo) ProfileService(ctx context.Context, tenantID string, serviceName string) (*models.Profile, error) {
	return nil, nil
}

func (f *fakeRepo) RecordEvaluation(ctx context.Context, tenantID, baselineID string, value float64, status string) (*models.Evaluation, error) {
	f.recordedEvalCalls++
	f.recordedEvalTenantID = tenantID
	f.recordedEvalBaselineID = baselineID
	f.recordedEvalValue = value
	f.recordedEvalStatus = status
	return &models.Evaluation{
		ID:         "e-1",
		TenantID:   tenantID,
		BaselineID: baselineID,
		Value:      value,
		Status:     status,
	}, f.evalErr
}

func (f *fakeRepo) RecordTestResult(ctx context.Context, tenantID string, req *models.TestResultRequest) (*models.TestResult, error) {
	f.recordedTest = req
	return &models.TestResult{ID: "tr-1", TenantID: tenantID,
		ServiceName: req.ServiceName, TestName: req.TestName,
		Duration: req.Duration, Status: req.Status}, nil
}

// The pre-Round-18 service recorded an evaluation with an empty baseline_id,
// orphaning it: GetEvaluationHistory filters by baseline_id and could never
// return it. Recording the baseline id here is what catches a regression.
func TestEvaluatePerformance_RecordsUnderTheMatchingBaselineID(t *testing.T) {
	repo := &fakeRepo{baselines: []models.Baseline{
		{ID: "b-latency", ServiceName: "checkout", Metric: "p95_latency_ms", Threshold: 100},
		{ID: "b-throughput", ServiceName: "checkout", Metric: "throughput", Threshold: 0},
	}}
	svc := NewService(repo)

	e, err := svc.EvaluatePerformance(context.Background(), "t1", &models.EvaluateRequest{
		ServiceName: "checkout",
		Metric:      "p95_latency_ms",
		Value:       150,
	})
	if err != nil {
		t.Fatalf("EvaluatePerformance: %v", err)
	}
	if e == nil || e.ID == "" {
		t.Fatalf("EvaluatePerformance returned %+v, want a recordable evaluation", e)
	}
	if repo.recordedEvalBaselineID != "b-latency" {
		t.Fatalf("recorded baseline_id = %q, want b-latency: an empty id orphans the row", repo.recordedEvalBaselineID)
	}
	if repo.recordedEvalCalls != 1 {
		t.Fatalf("RecordEvaluation called %d times, want 1", repo.recordedEvalCalls)
	}
	if repo.recordedEvalTenantID != "t1" || repo.recordedEvalValue != 150 {
		t.Errorf("recorded (%q, %v), want (t1, 150)", repo.recordedEvalTenantID, repo.recordedEvalValue)
	}
	if repo.recordedEvalStatus != models.EvalStatusExceeded {
		t.Errorf("status = %q, want %q", repo.recordedEvalStatus, models.EvalStatusExceeded)
	}
}

func TestEvaluatePerformance_MatchesOnTheMetricAsWellAsTheService(t *testing.T) {
	repo := &fakeRepo{baselines: []models.Baseline{
		{ID: "b-latency", ServiceName: "checkout", Metric: "p95_latency_ms", Threshold: 100},
		{ID: "b-throughput", ServiceName: "checkout", Metric: "throughput", Threshold: 0},
	}}
	svc := NewService(repo)

	if _, err := svc.EvaluatePerformance(context.Background(), "t1", &models.EvaluateRequest{
		ServiceName: "checkout",
		Metric:      "throughput",
		Value:       5,
	}); err != nil {
		t.Fatalf("EvaluatePerformance: %v", err)
	}
	if repo.recordedEvalBaselineID != "b-throughput" {
		t.Fatalf("recorded baseline_id = %q, want b-throughput: the metric must disambiguate", repo.recordedEvalBaselineID)
	}
}

func TestEvaluatePerformance_StatusOnlyExceedsAPositiveThreshold(t *testing.T) {
	tests := []struct {
		name      string
		threshold float64
		value     float64
		want      string
	}{
		{"over a positive threshold", 100, 150, models.EvalStatusExceeded},
		{"equal to the threshold", 100, 100, models.EvalStatusOK},
		{"just under the threshold", 100, 99.9, models.EvalStatusOK},
		{"no threshold configured", 0, 150, models.EvalStatusOK},
		{"negative threshold", -1, 150, models.EvalStatusOK},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepo{baselines: []models.Baseline{
				{ID: "b-1", ServiceName: "checkout", Metric: "p95_latency_ms", Threshold: tt.threshold},
			}}
			svc := NewService(repo)
			if _, err := svc.EvaluatePerformance(context.Background(), "t1", &models.EvaluateRequest{
				ServiceName: "checkout",
				Metric:      "p95_latency_ms",
				Value:       tt.value,
			}); err != nil {
				t.Fatalf("EvaluatePerformance: %v", err)
			}
			if repo.recordedEvalStatus != tt.want {
				t.Errorf("status = %q, want %q", repo.recordedEvalStatus, tt.want)
			}
		})
	}
}

// Without a baseline there is nothing to compare a measurement against, so the
// service must fail rather than write a row that describes nothing.
func TestEvaluatePerformance_NoMatchingBaselineIsNotFoundAndWritesNothing(t *testing.T) {
	repo := &fakeRepo{baselines: []models.Baseline{
		{ID: "b-1", ServiceName: "checkout", Metric: "throughput", Threshold: 0},
	}}
	svc := NewService(repo)

	e, err := svc.EvaluatePerformance(context.Background(), "t1", &models.EvaluateRequest{
		ServiceName: "checkout",
		Metric:      "p95_latency_ms",
		Value:       150,
	})
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("err = %v, want errors.Is(err, sentinel.NotFound): the handler maps that to a 404", err)
	}
	if e != nil {
		t.Errorf("returned %+v, want nil", e)
	}
	if repo.recordedEvalCalls != 0 {
		t.Errorf("RecordEvaluation called %d times, want 0", repo.recordedEvalCalls)
	}
}

func TestEvaluatePerformance_ListBaselinesErrorPropagates(t *testing.T) {
	wantErr := errors.New("database unavailable")
	repo := &fakeRepo{listErr: wantErr}
	svc := NewService(repo)

	_, err := svc.EvaluatePerformance(context.Background(), "t1", &models.EvaluateRequest{
		ServiceName: "checkout",
		Metric:      "p95_latency_ms",
		Value:       1,
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("err = %v, want the repository error", err)
	}
	if repo.recordedEvalCalls != 0 {
		t.Errorf("RecordEvaluation called %d times, want 0", repo.recordedEvalCalls)
	}
}

func TestEvaluatePerformance_RecordEvaluationErrorPropagates(t *testing.T) {
	wantErr := errors.New("deadlock")
	repo := &fakeRepo{
		baselines: []models.Baseline{{ID: "b-1", ServiceName: "checkout", Metric: "p95_latency_ms"}},
		evalErr:   wantErr,
	}
	svc := NewService(repo)

	_, err := svc.EvaluatePerformance(context.Background(), "t1", &models.EvaluateRequest{
		ServiceName: "checkout",
		Metric:      "p95_latency_ms",
		Value:       1,
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("err = %v, want the repository error", err)
	}
}

func TestGetBottlenecks_EmptyServiceNameShortCircuits(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo)

	bottlenecks, err := svc.GetBottlenecks(context.Background(), "t1", "")
	if err != nil {
		t.Fatalf("GetBottlenecks: %v", err)
	}
	if bottlenecks == nil || len(bottlenecks) != 0 {
		t.Fatalf("bottlenecks = %+v, want an empty slice", bottlenecks)
	}
	if repo.bottleneckCalls != 0 {
		t.Errorf("repository called %d times, want 0 for an empty service name", repo.bottleneckCalls)
	}
}

func TestGetBottlenecks_ForwardsTheServiceNameFromTheRoute(t *testing.T) {
	repo := &fakeRepo{bottlenecks: []models.Bottleneck{{ID: "bn-1", ServiceName: "checkout"}}}
	svc := NewService(repo)

	bottlenecks, err := svc.GetBottlenecks(context.Background(), "t1", "checkout")
	if err != nil {
		t.Fatalf("GetBottlenecks: %v", err)
	}
	if len(bottlenecks) != 1 {
		t.Fatalf("got %d bottlenecks, want 1", len(bottlenecks))
	}
	if repo.lastBottleneckService != "checkout" {
		t.Errorf("service name forwarded = %q, want checkout", repo.lastBottleneckService)
	}
}

func TestGetBottlenecks_RepositoryErrorPropagates(t *testing.T) {
	wantErr := errors.New("timeout")
	repo := &fakeRepo{getBottleneckErr: wantErr}
	svc := NewService(repo)

	_, err := svc.GetBottlenecks(context.Background(), "t1", "checkout")
	if !errors.Is(err, wantErr) {
		t.Fatalf("err = %v, want the repository error", err)
	}
}

// GetTestResults used to be declared to return []Baseline, so a test-results
// endpoint could never have held a test result. The assertion below is what
// keeps the return type correct: it would not compile against the old
// signature.
func TestGetTestResults_ReturnsTestResults(t *testing.T) {
	repo := &fakeRepo{results: []models.TestResult{
		{ID: "tr-1", ServiceName: "checkout", TestName: "bench_read", Duration: 1234, Status: "passed"},
	}}
	svc := NewService(repo)

	results, err := svc.GetTestResults(context.Background(), "t1", "checkout")
	if err != nil {
		t.Fatalf("GetTestResults: %v", err)
	}
	if len(results) != 1 || results[0].ID != "tr-1" || results[0].Duration != 1234 {
		t.Fatalf("results = %+v, want the recorded test result", results)
	}
	if repo.lastResultsService != "checkout" {
		t.Errorf("service name forwarded = %q, want checkout", repo.lastResultsService)
	}
}

func TestRecordTestResult_ReturnsTheStoredRow(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo)

	req := &models.TestResultRequest{
		ServiceName: "checkout",
		TestName:    "bench_read",
		Duration:    1234,
		Status:      "passed",
	}
	tr, err := svc.RecordTestResult(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("RecordTestResult: %v", err)
	}
	// The handler answers with this value. It used to be
	// {"message":"test result recorded"} with no identifier, which left a
	// client unable to correlate the run with what GET /test-results returned.
	if tr == nil || tr.ID == "" {
		t.Fatalf("RecordTestResult returned %+v, want a row carrying an id", tr)
	}
	if repo.recordedTest == nil || repo.recordedTest.TestName != "bench_read" {
		t.Fatalf("repository received %+v, want the submitted request", repo.recordedTest)
	}
}

func TestGetSuggestions_DelegatesToTheRepository(t *testing.T) {
	repo := &fakeRepo{suggestions: []models.Suggestion{{ID: "sg-1", Priority: "high"}}}
	svc := NewService(repo)

	suggestions, err := svc.GetSuggestions(context.Background(), "t1", "checkout")
	if err != nil {
		t.Fatalf("GetSuggestions: %v", err)
	}
	if len(suggestions) != 1 || suggestions[0].ID != "sg-1" {
		t.Fatalf("suggestions = %+v, want the repository rows", suggestions)
	}
}

func TestIsNotFound(t *testing.T) {
	// The service wraps sentinel.NotFound in a "create one first" message, so the
	// check has to survive wrapping or the handler would answer 500 for a
	// missing baseline instead of 404.
	if !IsNotFound(errors.Join(errors.New("select failed"), sentinel.NotFound)) {
		t.Error("IsNotFound returned false for a wrapped sentinel.NotFound")
	}
	if !IsNotFound(sentinel.NotFound) {
		t.Error("IsNotFound returned false for the bare sentinel")
	}
	if IsNotFound(errors.New("relation does not exist")) {
		t.Error("IsNotFound returned true for an unrelated error")
	}
	if IsNotFound(nil) {
		t.Error("IsNotFound returned true for nil")
	}
}
