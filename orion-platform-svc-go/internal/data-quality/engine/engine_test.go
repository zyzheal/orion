package engine

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/data-quality/models"
	"orion/platform-svc-go/internal/data-quality/repository"
)

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type mockRepo struct {
	createScanResultFn func(ctx context.Context, result *models.ScanResult) error
	createAlertFn      func(ctx context.Context, alert *models.Alert) error
	listRulesFn        func(ctx context.Context, tenantID string, filter *models.RuleFilter) ([]models.Rule, error)
	rules              []models.Rule
}

func (m *mockRepo) CreateRule(ctx context.Context, rule *models.Rule) error { return nil }
func (m *mockRepo) GetRuleByID(ctx context.Context, tenantID, id string) (*models.Rule, error) { return nil, nil }
func (m *mockRepo) UpdateRule(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Rule, error) { return nil, nil }
func (m *mockRepo) DeleteRule(ctx context.Context, tenantID, id string) (bool, error) { return false, nil }
func (m *mockRepo) CreateScanResult(ctx context.Context, result *models.ScanResult) error {
	result.ID = "result-1"
	result.CreatedAt = time.Now().UTC()
	if m.createScanResultFn != nil {
		return m.createScanResultFn(ctx, result)
	}
	return nil
}
func (m *mockRepo) ListScanResults(ctx context.Context, tenantID, ruleID string, status *string) ([]models.ScanResult, error) { return nil, nil }
func (m *mockRepo) CreateAlert(ctx context.Context, alert *models.Alert) error {
	if m.createAlertFn != nil {
		return m.createAlertFn(ctx, alert)
	}
	alert.ID = "alert-1"
	alert.CreatedAt = time.Now().UTC()
	return nil
}
func (m *mockRepo) GetAlertByID(ctx context.Context, tenantID, id string) (*models.Alert, error) { return nil, nil }
func (m *mockRepo) ListAlerts(ctx context.Context, tenantID string, status *string) ([]models.Alert, error) { return nil, nil }
func (m *mockRepo) UpdateAlert(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Alert, error) { return nil, nil }
func (m *mockRepo) DeleteAlert(ctx context.Context, tenantID, id string) (bool, error) { return false, nil }
func (m *mockRepo) GetStats(ctx context.Context, tenantID string) (*models.QualityStats, error) { return &models.QualityStats{}, nil }
func (m *mockRepo) ListRules(ctx context.Context, tenantID string, filter *models.RuleFilter) ([]models.Rule, error) {
	if m.listRulesFn != nil {
		return m.listRulesFn(ctx, tenantID, filter)
	}
	return m.rules, nil
}

// Ensure mockRepo implements RepositoryInterface.
var _ repository.RepositoryInterface = (*mockRepo)(nil)

type mockSvc struct {
	getRuleFn       func(ctx context.Context, tenantID, id string) (*models.Rule, error)
	createAlertFn   func(ctx context.Context, tenantID string, req *models.CreateAlertRequest) (*models.Alert, error)
}

func (m *mockSvc) GetRule(ctx context.Context, tenantID, id string) (*models.Rule, error) {
	if m.getRuleFn != nil {
		return m.getRuleFn(ctx, tenantID, id)
	}
	return nil, sentinel.NotFound
}
func (m *mockSvc) CreateAlert(ctx context.Context, tenantID string, req *models.CreateAlertRequest) (*models.Alert, error) {
	if m.createAlertFn != nil {
		return m.createAlertFn(ctx, tenantID, req)
	}
	a := &models.Alert{ID: "alert-1", TenantID: tenantID, RuleID: req.RuleID, ScanResultID: req.ScanResultID, Severity: req.Severity, Status: "open"}
	a.Message = req.Message
	return a, nil
}

type mockNotifier struct {
	notifyFn func(ctx context.Context, alert *models.Alert) error
}

func (m *mockNotifier) Notify(ctx context.Context, alert *models.Alert) error {
	if m.notifyFn != nil {
		return m.notifyFn(ctx, alert)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

func newRule(tenantID string, ruleType string, threshold float64, expression string) *models.Rule {
	return &models.Rule{
		ID:        "rule-1",
		TenantID:  tenantID,
		Name:      "test-rule",
		RuleType:  ruleType,
		Threshold: &threshold,
		Expression: &expression,
		Severity:  "medium",
		Status:    "active",
	}
}

// ---------------------------------------------------------------------------
// Evaluator tests
// ---------------------------------------------------------------------------

func TestEvaluator_Evaluate_NilRule(t *testing.T) {
	e := &Evaluator{}
	_, err := e.Evaluate(context.Background(), nil, &EvaluationInput{})
	if err == nil || !strings.Contains(err.Error(), "nil") {
		t.Fatalf("expected nil rule error, got %v", err)
	}
}

func TestEvaluator_Evaluate_NilInput(t *testing.T) {
	e := &Evaluator{}
	rule := newRule("t1", "threshold_check", 5.0, "below 5")
	_, err := e.Evaluate(context.Background(), rule, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestEvaluator_ThresholdCheck_Below(t *testing.T) {
	// "below 5" semantics: fail when value < 5 (value must be >= threshold).
	e := &Evaluator{}
	rule := newRule("t1", "threshold_check", 5.0, "below 5")
	input := &EvaluationInput{Samples: []interface{}{4.0, 3.0, 6.0, 2.0}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 4,3,2 are below 5 -> fail; 6 passes
	if ev.Result.FailedRecords != 3 {
		t.Fatalf("expected 3 failed (4,3,2), got %d", ev.Result.FailedRecords)
	}
	if ev.Result.PassedRecords != 1 {
		t.Fatalf("expected 1 passed (6), got %d", ev.Result.PassedRecords)
	}
	if ev.Result.Status != "fail" {
		t.Fatalf("expected status fail, got %s", ev.Result.Status)
	}
	if ev.Alert == nil {
		t.Fatalf("expected alert on failure")
	}
}

func TestEvaluator_ThresholdCheck_AllPass(t *testing.T) {
	// "below 10" semantics: fail when value < 10; all samples >= 10 pass.
	e := &Evaluator{}
	rule := newRule("t1", "threshold_check", 10.0, "below 10")
	input := &EvaluationInput{Samples: []interface{}{11.0, 12.0, 10.0}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Result.Status != "pass" {
		t.Fatalf("expected pass, got %s", ev.Result.Status)
	}
	if ev.Alert != nil {
		t.Fatalf("expected no alert on pass")
	}
}

func TestEvaluator_ThresholdCheck_Above(t *testing.T) {
	e := &Evaluator{}
	rule := newRule("t1", "threshold_check", 5.0, "above 5")
	input := &EvaluationInput{Samples: []interface{}{6.0, 7.0, 3.0, 4.0}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// above 5 means fail when value > 5, so 6 and 7 fail
	if ev.Result.FailedRecords != 2 {
		t.Fatalf("expected 2 failed (6,7), got %d", ev.Result.FailedRecords)
	}
}

func TestEvaluator_RangeCheck(t *testing.T) {
	e := &Evaluator{}
	rule := newRule("t1", "range_check", 10.0, "0,10")
	input := &EvaluationInput{Samples: []interface{}{5.0, 12.0, -1.0, 0.0, 10.0}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 5, 0, 10 in range; 12, -1 out
	if ev.Result.PassedRecords != 3 {
		t.Fatalf("expected 3 passed, got %d", ev.Result.PassedRecords)
	}
	if ev.Result.FailedRecords != 2 {
		t.Fatalf("expected 2 failed, got %d", ev.Result.FailedRecords)
	}
}

func TestEvaluator_RangeCheck_BadExpression(t *testing.T) {
	e := &Evaluator{}
	rule := newRule("t1", "range_check", 10.0, "bad-expr")
	_, err := e.Evaluate(context.Background(), rule, &EvaluationInput{Samples: []interface{}{1}})
	if err != nil {
		t.Fatalf("should not error on bad range expression, evaluator degrades to all fail")
	}
}

func TestEvaluator_PatternMatch_Allow(t *testing.T) {
	e := &Evaluator{}
	rule := &models.Rule{
		ID:        "rule-2",
		TenantID:  "t1",
		Name:      "pattern-test",
		RuleType:  "pattern_match",
		Expression: strPtr2("[a-z]+"),
		Severity:  "low",
		Status:    "active",
	}
	input := &EvaluationInput{Samples: []interface{}{"hello", "world", "123"}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Result.FailedRecords != 1 {
		t.Fatalf("expected 1 failed (123), got %d", ev.Result.FailedRecords)
	}
}

func TestEvaluator_PatternMatch_Deny(t *testing.T) {
	e := &Evaluator{}
	denyThreshold := 1.0
	rule := &models.Rule{
		ID:        "rule-3",
		TenantID:  "t1",
		Name:      "deny-test",
		RuleType:  "pattern_match",
		Expression: strPtr2("ERROR"),
		Threshold: &denyThreshold,
		Severity:  "high",
		Status:    "active",
	}
	input := &EvaluationInput{Samples: []interface{}{"ok", "ERROR here", "fine"}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Result.FailedRecords != 1 {
		t.Fatalf("expected 1 failed (ERROR here), got %d", ev.Result.FailedRecords)
	}
}

func TestEvaluator_UnsupportedType(t *testing.T) {
	e := &Evaluator{}
	rule := &models.Rule{ID: "r", TenantID: "t", RuleType: "bogus"}
	_, err := e.Evaluate(context.Background(), rule, &EvaluationInput{})
	if !errors.Is(err, ErrUnsupportedType) {
		t.Fatalf("expected ErrUnsupportedType, got %v", err)
	}
}

func TestEvaluator_Completeness_Nil(t *testing.T) {
	e := &Evaluator{}
	rule := &models.Rule{ID: "r", TenantID: "t", Name: "completeness-test", RuleType: "completeness"}
	input := &EvaluationInput{Samples: []interface{}{1.0, nil, 3.0, nil}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Result.FailedRecords != 2 {
		t.Fatalf("expected 2 failed (nils), got %d", ev.Result.FailedRecords)
	}
	if ev.Result.PassedRecords != 2 {
		t.Fatalf("expected 2 passed, got %d", ev.Result.PassedRecords)
	}
}

func TestEvaluator_Completeness_AllPass(t *testing.T) {
	e := &Evaluator{}
	rule := &models.Rule{ID: "r", TenantID: "t", Name: "completeness-test", RuleType: "completeness"}
	input := &EvaluationInput{Samples: []interface{}{1.0, 2.0, 3.0}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Result.FailedRecords != 0 {
		t.Fatalf("expected 0 failed, got %d", ev.Result.FailedRecords)
	}
	if ev.Result.PassedRecords != 3 {
		t.Fatalf("expected 3 passed, got %d", ev.Result.PassedRecords)
	}
}

func TestEvaluator_Uniqueness_AllUnique(t *testing.T) {
	e := &Evaluator{}
	rule := &models.Rule{ID: "r", TenantID: "t", Name: "uniqueness-test", RuleType: "uniqueness"}
	input := &EvaluationInput{Samples: []interface{}{1, 2, 3, 4}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Result.FailedRecords != 0 {
		t.Fatalf("expected 0 failed, got %d", ev.Result.FailedRecords)
	}
	if ev.Result.PassedRecords != 4 {
		t.Fatalf("expected 4 passed, got %d", ev.Result.PassedRecords)
	}
}

func TestEvaluator_Uniqueness_HasDuplicates(t *testing.T) {
	e := &Evaluator{}
	rule := &models.Rule{ID: "r", TenantID: "t", Name: "uniqueness-test", RuleType: "uniqueness"}
	input := &EvaluationInput{Samples: []interface{}{1, 1, 2, 3, 3, 3}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 1 appears 2x -> 1 duplicate; 3 appears 3x -> 2 duplicates; total 3 failed
	if ev.Result.FailedRecords != 3 {
		t.Fatalf("expected 3 failed (duplicates), got %d", ev.Result.FailedRecords)
	}
}

func TestEvaluator_Referential_AllValid(t *testing.T) {
	e := &Evaluator{}
	expr := "A,B,C"
	rule := &models.Rule{ID: "r", TenantID: "t", Name: "ref-test", RuleType: "referential", Expression: &expr}
	input := &EvaluationInput{Samples: []interface{}{"A", "B", "C"}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Result.FailedRecords != 0 {
		t.Fatalf("expected 0 failed, got %d", ev.Result.FailedRecords)
	}
}

func TestEvaluator_Referential_Invalid(t *testing.T) {
	e := &Evaluator{}
	expr := "A,B,C"
	rule := &models.Rule{ID: "r", TenantID: "t", Name: "ref-test", RuleType: "referential", Expression: &expr}
	input := &EvaluationInput{Samples: []interface{}{"A", "X", "B", "Y"}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Result.FailedRecords != 2 {
		t.Fatalf("expected 2 failed (X,Y), got %d", ev.Result.FailedRecords)
	}
	if ev.Result.PassedRecords != 2 {
		t.Fatalf("expected 2 passed, got %d", ev.Result.PassedRecords)
	}
}

func TestEvaluator_Referential_NoExpression(t *testing.T) {
	e := &Evaluator{}
	rule := &models.Rule{ID: "r", TenantID: "t", Name: "ref-test", RuleType: "referential"}
	input := &EvaluationInput{Samples: []interface{}{"A", "B"}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Result.FailedRecords != 2 {
		t.Fatalf("expected 2 failed (no expression), got %d", ev.Result.FailedRecords)
	}
}

func TestEvaluator_CustomSQL_AllPass(t *testing.T) {
	e := &Evaluator{}
	threshold := 0.0
	rule := &models.Rule{ID: "r", TenantID: "t", Name: "sql-test", RuleType: "custom_sql", Threshold: &threshold}
	input := &EvaluationInput{Samples: []interface{}{0.0, 0.0}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Result.FailedRecords != 0 {
		t.Fatalf("expected 0 failed, got %d", ev.Result.FailedRecords)
	}
}

func TestEvaluator_CustomSQL_ExceedsThreshold(t *testing.T) {
	e := &Evaluator{}
	threshold := 5.0
	rule := &models.Rule{ID: "r", TenantID: "t", Name: "sql-test", RuleType: "custom_sql", Threshold: &threshold}
	input := &EvaluationInput{Samples: []interface{}{3.0, 10.0, 7.0}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Result.FailedRecords != 2 {
		t.Fatalf("expected 2 failed (>5), got %d", ev.Result.FailedRecords)
	}
	if ev.Result.PassedRecords != 1 {
		t.Fatalf("expected 1 passed, got %d", ev.Result.PassedRecords)
	}
}

func TestEvaluator_CustomSQL_NilSample(t *testing.T) {
	e := &Evaluator{}
	rule := &models.Rule{ID: "r", TenantID: "t", Name: "sql-test", RuleType: "custom_sql"}
	input := &EvaluationInput{Samples: []interface{}{nil, 1.0}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Result.FailedRecords != 1 {
		t.Fatalf("expected 1 failed (nil), got %d", ev.Result.FailedRecords)
	}
}

func TestEvaluator_NullCheck_RegExOverride(t *testing.T) {
	e := &Evaluator{}
	expr := "^\\s*$"
	rule := &models.Rule{ID: "r", TenantID: "t", Name: "null-test", RuleType: "null_check", Expression: &expr}
	input := &EvaluationInput{Samples: []interface{}{"hello", "   ", "world"}}
	ev, err := e.Evaluate(context.Background(), rule, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Result.FailedRecords != 1 {
		t.Fatalf("expected 1 failed (whitespace), got %d", ev.Result.FailedRecords)
	}
}

func TestEvaluator_Persist_NoCallback(t *testing.T) {
	e := &Evaluator{} // OnEvaluate is nil
	err := e.Persist(context.Background(), newRule("t", "t", 1, ""), &EvaluationResult{})
	if err != nil {
		t.Fatalf("nil callback should be a no-op, got %v", err)
	}
}

func strPtr2(s string) *string { return &s }

// ---------------------------------------------------------------------------
// Engine tests
// ---------------------------------------------------------------------------

func TestEngine_NewEngine(t *testing.T) {
	e := NewEngine(&mockRepo{}, &mockSvc{}, &mockNotifier{})
	if e == nil {
		t.Fatal("expected non-nil engine")
	}
	if e.repo == nil {
		t.Fatal("expected non-nil repo")
	}
	if e.eval == nil {
		t.Fatal("expected non-nil evaluator")
	}
}

func TestEngine_NewEngine_DefaultOptions(t *testing.T) {
	e := NewEngine(&mockRepo{}, &mockSvc{}, nil)
	if e.opts.AlertOnFail != true {
		t.Fatalf("expected AlertOnFail true by default")
	}
	if e.opts.NotifyOnFail != true {
		t.Fatalf("expected NotifyOnFail true by default")
	}
	if e.opts.MaxConcurrent != 1 {
		t.Fatalf("expected MaxConcurrent 1 by default, got %d", e.opts.MaxConcurrent)
	}
}

func TestEngine_NewEngine_CustomOptions(t *testing.T) {
	opts := EngineOptions{AlertOnFail: false, NotifyOnFail: false}
	e := NewEngine(&mockRepo{}, &mockSvc{}, nil, opts)
	if e.opts.AlertOnFail != false {
		t.Fatal("expected AlertOnFail false")
	}
}

func TestEngine_RunSingleRule_NotActive(t *testing.T) {
	inactiveRule := newRule("t1", "threshold_check", 5.0, "below 5")
	inactiveRule.Status = "disabled"
	svc := &mockSvc{
		getRuleFn: func(ctx context.Context, tenantID, id string) (*models.Rule, error) {
			return inactiveRule, nil
		},
	}
	e := NewEngine(&mockRepo{}, svc, nil)
	_, err := e.RunSingleRule(context.Background(), "t1", "r1", DefaultDataProvider)
	if err == nil {
		t.Fatal("expected error for inactive rule")
	}
}

func TestEngine_RunSingleRule_NotFound(t *testing.T) {
	svc := &mockSvc{
		getRuleFn: func(ctx context.Context, tenantID, id string) (*models.Rule, error) {
			return nil, sentinel.NotFound
		},
	}
	e := NewEngine(&mockRepo{}, svc, nil)
	_, err := e.RunSingleRule(context.Background(), "t1", "r1", DefaultDataProvider)
	if err == nil {
		t.Fatal("expected error for not found rule")
	}
}

func TestEngine_RunSingleRule_ProviderError(t *testing.T) {
	rule := newRule("t1", "threshold_check", 5.0, "below 5")
	svc := &mockSvc{
		getRuleFn: func(ctx context.Context, tenantID, id string) (*models.Rule, error) {
			return rule, nil
		},
	}
	providerErr := errors.New("provider failure")
	provider := func(ctx context.Context, rule *models.Rule) (*EvaluationInput, error) {
		return nil, providerErr
	}
	e := NewEngine(&mockRepo{}, svc, nil)
	res, err := e.RunSingleRule(context.Background(), "t1", "r1", provider)
	if err == nil {
		t.Fatal("expected provider error")
	}
	if res.EvaluationErr != providerErr {
		t.Fatalf("expected EvaluationErr, got %v", res.EvaluationErr)
	}
}

func TestEngine_RunAllActiveRules_Empty(t *testing.T) {
	svc := &mockSvc{}
	e := NewEngine(&mockRepo{rules: nil}, svc, nil)
	results, err := e.RunAllActiveRules(context.Background(), "t1", DefaultDataProvider)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if results != nil {
		t.Fatalf("expected nil results, got %v", results)
	}
}

func TestEngine_RunAllActiveRules_Fail(t *testing.T) {
	svc := &mockSvc{
		getRuleFn: func(ctx context.Context, tenantID, id string) (*models.Rule, error) {
			return newRule(tenantID, "threshold_check", 5.0, "below 5"), nil
		},
	}
	rules := []models.Rule{
		*newRule("t1", "threshold_check", 5.0, "below 5"),
	}
	e := NewEngine(&mockRepo{
		rules: rules,
		listRulesFn: func(ctx context.Context, tenantID string, filter *models.RuleFilter) ([]models.Rule, error) {
			return rules, nil
		},
	}, svc, nil)
	results, err := e.RunAllActiveRules(context.Background(), "t1", DefaultDataProvider)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if results == nil {
		t.Fatal("expected non-nil results")
	}
	// Empty samples => all pass
	for _, r := range results {
		if r.ScanResult == nil {
			t.Fatalf("expected scan result for rule %s", r.RuleID)
		}
		if r.ScanResult.Status != "pass" {
			t.Fatalf("expected pass for rule %s, got %s", r.RuleID, r.ScanResult.Status)
		}
	}
}

func TestEngine_RunAllActiveRules_Pooling(t *testing.T) {
	svc := &mockSvc{
		getRuleFn: func(ctx context.Context, tenantID, id string) (*models.Rule, error) {
			return newRule(tenantID, "threshold_check", 5.0, "below 5"), nil
		},
	}
	rules := make([]models.Rule, 10)
	for i := range rules {
		rules[i] = *newRule("t1", "threshold_check", 5.0, "below 5")
	}
	opts := EngineOptions{MaxConcurrent: 4}
	e := NewEngine(&mockRepo{
		rules: rules,
		listRulesFn: func(ctx context.Context, tenantID string, filter *models.RuleFilter) ([]models.Rule, error) {
			return rules, nil
		},
	}, svc, nil, opts)
	results, err := e.RunAllActiveRules(context.Background(), "t1", DefaultDataProvider)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 10 {
		t.Fatalf("expected 10 results, got %d", len(results))
	}
	for _, r := range results {
		if r.ScanResult == nil {
			t.Fatalf("expected scan result for rule %s", r.RuleID)
		}
	}
}

// ---------------------------------------------------------------------------
// Helper function tests
// ---------------------------------------------------------------------------

func TestCountResultStatus(t *testing.T) {
	results := []*EngineResult{
		{ScanResult: &models.ScanResult{Status: "pass"}},
		{ScanResult: &models.ScanResult{Status: "fail"}},
		{ScanResult: &models.ScanResult{Status: "fail"}},
		{ScanResult: nil},
	}
	p, f, e := CountResultStatus(results)
	if p != 1 || f != 2 || e != 1 {
		t.Fatalf("expected 1/2/1, got %d/%d/%d", p, f, e)
	}
}

func TestTimestampFromResult_Nil(t *testing.T) {
	if ts := TimestampFromResult(nil); !ts.IsZero() {
		t.Fatal("expected zero time")
	}
	if ts := TimestampFromResult(&EngineResult{ScanResult: nil}); !ts.IsZero() {
		t.Fatal("expected zero time")
	}
}

func TestTimestampFromResult_Valid(t *testing.T) {
	now := time.Now().UTC()
	result := &EngineResult{ScanResult: &models.ScanResult{CreatedAt: now}}
	ts := TimestampFromResult(result)
	if !ts.Equal(now) {
		t.Fatalf("expected %v, got %v", now, ts)
	}
}
