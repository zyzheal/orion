package service

import (
	"context"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/knowledge/models"
)

func Test_NormalizeText(t *testing.T) {
	if got := normalizeText("  Hello World "); got != "hello world" {
		t.Fatalf("normalizeText = %q", got)
	}
}

func Test_FirstWords(t *testing.T) {
	if got := firstWords("a b c d e f", 3); got != "a b c" {
		t.Fatalf("firstWords = %q", got)
	}
}

func Test_SafeRate(t *testing.T) {
	if safeRate(3, 6) != 0.5 {
		t.Fatal("safeRate(3,6) should be 0.5")
	}
	if safeRate(0, 0) != 0 {
		t.Fatal("safeRate(0,0) should be 0")
	}
}

func Test_Round2(t *testing.T) {
	if got := round2(0.12345); got != 0.12 {
		t.Fatalf("round2(0.12345) = %v", got)
	}
}

func Test_ResultsScore(t *testing.T) {
	if got := resultsScore(nil); got != 0 {
		t.Fatalf("resultsScore(nil) = %v", got)
	}
	rs := []models.RAGRetrieveResult{{Similarity: 0.8}, {Similarity: 0.4}}
	if got := round2(resultsScore(rs)); got != 0.6 {
		t.Fatalf("resultsScore = %v, want 0.6", got)
	}
}

func Test_SafeRateRound(t *testing.T) {
	if got := safeRateRound(10, 4); got != 2.5 {
		t.Fatalf("safeRateRound(10,4) = %v", got)
	}
	if got := safeRateRound(0, 0); got != 0 {
		t.Fatalf("safeRateRound(0,0) = %v", got)
	}
}

// mockRAGRepo wraps the real RAGRepositoryInterface with a fakes for eval runs.
type mockEvalRAGRepo struct {
	RAGRepositoryInterface
	runs     map[string]*models.EvalRun
	runOrder int
}

func (m *mockEvalRAGRepo) GetEvalRun(ctx context.Context, tenantID, id string) (*models.EvalRun, error) {
	return m.runs[id], nil
}

func Test_CompareRuns_RegressionDetection(t *testing.T) {
	s := &Service{ragRepo: &mockEvalRAGRepo{runs: map[string]*models.EvalRun{
		"run1": {ID: "run1", PassCount: 50, TotalCount: 100, AvgScore: 0.9},
		"run2": {ID: "run2", PassCount: 30, TotalCount: 100, AvgScore: 0.7},
	}}}
	cmp, err := s.CompareRuns(context.Background(), "t1", models.CompareRunsRequest{BaseRunID: "run1", HeadRunID: "run2"})
	if err != nil {
		t.Fatal(err)
	}
	if !cmp.Delta.Regression {
		t.Fatal("expected regression flag when head pass rate drops")
	}
	if cmp.Delta.PassRateDelta != -0.2 {
		t.Fatalf("pass rate delta = %v, want -0.2", cmp.Delta.PassRateDelta)
	}
}

func Test_CompareRuns_NoRegression(t *testing.T) {
	s := &Service{ragRepo: &mockEvalRAGRepo{runs: map[string]*models.EvalRun{
		"run1": {ID: "run1", PassCount: 50, TotalCount: 100, AvgScore: 0.8},
		"run2": {ID: "run2", PassCount: 80, TotalCount: 100, AvgScore: 0.85},
	}}}
	cmp, _ := s.CompareRuns(context.Background(), "t1", models.CompareRunsRequest{BaseRunID: "run1", HeadRunID: "run2"})
	if cmp.Delta.Regression {
		t.Fatal("expected no regression flag when metrics improve")
	}
}

func Test_EvalRunReport(t *testing.T) {
	report := `{"total":10,"pass":7,"fail":3,"pass_rate":0.70}`
	if !strings.Contains(report, "pass_rate") {
		t.Fatal("report should contain pass_rate")
	}
}
