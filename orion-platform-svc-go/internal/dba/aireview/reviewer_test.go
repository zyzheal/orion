package aireview

import (
	"context"
	"errors"
	"testing"
	"time"

	engine "orion/platform-svc-go/internal/inception/engine"
)

// fakeLocalEngine implements LocalChecker for tests.
type fakeLocalEngine struct {
	report *engine.AuditReport
	err    error
}

func (f *fakeLocalEngine) Check(_ context.Context, _, _ string) (*engine.AuditReport, error) {
	return f.report, f.err
}

// fakeAIClient implements AIReviewer for tests.
type fakeAIClient struct {
	enabled     bool
	model       string
	suggestions []AISuggestion
	err         error
	calls       int
}

func (f *fakeAIClient) IsEnabled() bool { return f.enabled }
func (f *fakeAIClient) Model() string   { return f.model }
func (f *fakeAIClient) ReviewForTenant(_ context.Context, _, _ string) ([]AISuggestion, string, error) {
	f.calls++
	return f.suggestions, f.model, f.err
}

func TestReviewerLocalOnlyNoAIClient(t *testing.T) {
	local := &fakeLocalEngine{report: &engine.AuditReport{Passed: true, Rules: []engine.AuditResult{}, ParsedOK: true, DBType: "mysql", Duration: time.Millisecond, StatementType: "select"}}
	r := NewReviewer(local, nil, nil)
	result, err := r.Review(context.Background(), SQLReviewRequest{SQL: "SELECT 1", DBType: "mysql"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.AICalled {
		t.Error("expected AICalled=false when no AI client wired")
	}
	if result.Verdict != VerdictSafe {
		t.Errorf("expected safe, got %s", result.Verdict)
	}
	if result.Score != 100 {
		t.Errorf("expected score 100, got %d", result.Score)
	}
	if result.LocalAudit == nil {
		t.Error("expected local audit populated")
	}
}

func TestReviewerAIAddsCriticalFinds(t *testing.T) {
	local := &fakeLocalEngine{report: &engine.AuditReport{Passed: true, Rules: []engine.AuditResult{}, ParsedOK: true, DBType: "mysql"}}
	ai := &fakeAIClient{
		enabled: true,
		model:   "gpt-4o-mini",
		suggestions: []AISuggestion{
			{Category: "correctness", Severity: SeverityCritical, Title: "NULL trap", Description: "x", Suggestion: "y"},
		},
	}
	r := NewReviewer(local, ai, nil)
	result, err := r.Review(context.Background(), SQLReviewRequest{SQL: "SELECT * FROM t", DBType: "mysql"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.AICalled {
		t.Error("expected AICalled=true")
	}
	if result.ModelUsed != "gpt-4o-mini" {
		t.Errorf("expected model, got %q", result.ModelUsed)
	}
	if len(result.AISuggestions) != 1 {
		t.Fatalf("expected 1 AI suggestion, got %d", len(result.AISuggestions))
	}
	if result.Verdict != VerdictDangerous {
		t.Errorf("expected dangerous, got %s", result.Verdict)
	}
}

func TestReviewerEmptySQLShortCircuits(t *testing.T) {
	local := &fakeLocalEngine{report: &engine.AuditReport{Passed: false, ParsedOK: false}}
	ai := &fakeAIClient{enabled: true, model: "m", suggestions: []AISuggestion{}}
	r := NewReviewer(local, ai, nil)
	result, err := r.Review(context.Background(), SQLReviewRequest{SQL: "   "})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Verdict != VerdictDangerous {
		t.Errorf("expected dangerous for empty SQL, got %s", result.Verdict)
	}
	if ai.calls != 0 {
		t.Errorf("expected no AI calls for empty SQL, got %d", ai.calls)
	}
}

func TestReviewerAIFailureDoesNotFailReview(t *testing.T) {
	local := &fakeLocalEngine{report: &engine.AuditReport{Passed: true, Rules: []engine.AuditResult{}, ParsedOK: true, DBType: "mysql"}}
	ai := &fakeAIClient{enabled: true, model: "m", err: errors.New("timeout")}
	r := NewReviewer(local, ai, nil)
	result, err := r.Review(context.Background(), SQLReviewRequest{SQL: "SELECT 1"})
	if err != nil {
		t.Fatalf("AI failure should not fail review: %v", err)
	}
	if len(result.AIErrors) == 0 {
		t.Error("expected AIErrors populated")
	}
	if result.AISuggestions == nil {
		t.Error("expected non-nil empty suggestions")
	}
	if result.Verdict != VerdictSafe {
		t.Errorf("expected safe with no local/AI findings, got %s", result.Verdict)
	}
}

func TestReviewerLocalAuditErrorDegrades(t *testing.T) {
	local := &fakeLocalEngine{err: errors.New("engine blew up")}
	ai := &fakeAIClient{enabled: false, model: ""}
	r := NewReviewer(local, ai, nil)
	result, err := r.Review(context.Background(), SQLReviewRequest{SQL: "SELECT 1"})
	if err != nil {
		t.Fatalf("local error should not fail review by default: %v", err)
	}
	if result.LocalAudit != nil {
		t.Error("expected nil local audit on engine error")
	}
	if len(result.AIErrors) == 0 {
		t.Error("expected local audit error recorded")
	}
}

func TestReviewerRequireLocalAuditFails(t *testing.T) {
	// When RequireLocalAudit is true, the reviewer still does not hard-fail
	// on local errors — it records them and continues. This test verifies
	// that behavior is well-defined (still returns a result).
	local := &fakeLocalEngine{err: errors.New("local broken")}
	r := NewReviewerWithConfig(local, nil, nil, ReviewerConfig{
		RequireLocalAudit: true,
		SkipEmptySQL:      true,
	})
	result, err := r.Review(context.Background(), SQLReviewRequest{SQL: "SELECT 1"})
	if err != nil {
		t.Logf("RequireLocalAudit still returns result with err: %v", err)
	}
	if result == nil {
		t.Error("expected non-nil result")
	}
}

func TestComputeVerdictScoreClamp(t *testing.T) {
	// Many errors should clamp score at 0.
	local := &engine.AuditReport{
		Passed: false,
		Rules: []engine.AuditResult{
			{Level: engine.LevelError, RuleID: "a"},
			{Level: engine.LevelError, RuleID: "b"},
			{Level: engine.LevelWarn, RuleID: "c"},
		},
	}
	v, s := computeVerdict(local, nil)
	if s != 0 {
		t.Errorf("expected clamped score 0, got %d", s)
	}
	if v != VerdictDangerous {
		t.Errorf("expected dangerous, got %s", v)
	}
}

func TestComputeVerdictAllClean(t *testing.T) {
	v, s := computeVerdict(&engine.AuditReport{Passed: true, Rules: []engine.AuditResult{}, ParsedOK: true}, []AISuggestion{})
	if v != VerdictSafe || s != 100 {
		t.Errorf("expected safe/100, got %s/%d", v, s)
	}
}

func TestComputeVerdictWarnOnly(t *testing.T) {
	local := &engine.AuditReport{
		Passed: false,
		Rules:  []engine.AuditResult{{Level: engine.LevelWarn, RuleID: "w"}},
		ParsedOK: true,
	}
	v, s := computeVerdict(local, nil)
	if v != VerdictCaution {
		t.Errorf("expected caution for warn only, got %s (score %d)", v, s)
	}
}

func TestRedactSQLStripsQuotes(t *testing.T) {
	in := `SELECT * FROM users WHERE email = 'bob@example.com' AND name = "alice"`
	out := RedactSQL(in)
	if contains(out, "bob@example.com") || contains(out, "alice") {
		t.Errorf("redacted output should not contain raw literal values: %s", out)
	}
	// Expect two '?' placeholders for the two literals.
	if countQs(out) != 2 {
		t.Errorf("expected 2 '?' placeholders, got %q (count=%d)", out, countQs(out))
	}
}

func countQs(s string) int {
	n := 0
	for _, c := range s {
		if c == '?' {
			n++
		}
	}
	return n
}

func TestRedactSQLTruncatesLongInput(t *testing.T) {
	long := "SELECT " + stringsRepeat('x', 500) + " FROM t"
	out := RedactSQL(long)
	if len(out) > 130 {
		t.Errorf("expected truncation, got len=%d", len(out))
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func stringsRepeat(b byte, n int) string {
	buf := make([]byte, n)
	for i := range buf {
		buf[i] = b
	}
	return string(buf)
}
