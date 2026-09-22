package service

import (
	"context"
	"errors"
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

// fakeEvalStore stands in for both repository interfaces RunEval touches.
// UpdateEvalRun applies the update map onto the stored run, mirroring what the
// real repository does, so assertions on the returned run are assertions on
// what the service actually wrote.
type fakeEvalStore struct {
	RepositoryInterface
	RAGRepositoryInterface

	setErr          error
	cases           []models.EvalSetCase
	updateErr       error
	updated         map[string]interface{}
	runs            map[string]*models.EvalRun
	retrieveByQuery map[string][]models.RAGRetrieveResult
	retrieveErrBy   map[string]error
	topKSeen        []int
}

var _ RepositoryInterface = (*fakeEvalStore)(nil)
var _ RAGRepositoryInterface = (*fakeEvalStore)(nil)

func (f *fakeEvalStore) GetEvalSet(ctx context.Context, tenantID, id string) (*models.EvalSet, error) {
	return nil, f.setErr
}

func (f *fakeEvalStore) ListEvalSetCases(ctx context.Context, tenantID, setID string) ([]models.EvalSetCase, error) {
	return f.cases, nil
}

func (f *fakeEvalStore) CreateEvalRun(ctx context.Context, run *models.EvalRun) error {
	run.ID = "run-1"
	if f.runs == nil {
		f.runs = map[string]*models.EvalRun{}
	}
	f.runs[run.ID] = run
	return nil
}

func (f *fakeEvalStore) UpdateEvalRun(ctx context.Context, id string, updates map[string]interface{}) error {
	f.updated = updates
	if run, ok := f.runs[id]; ok {
		if v, ok := updates["status"]; ok {
			run.Status = v.(string)
		}
		if v, ok := updates["pass_count"]; ok {
			run.PassCount = v.(int)
		}
		if v, ok := updates["total_count"]; ok {
			run.TotalCount = v.(int)
		}
		if v, ok := updates["avg_recall"]; ok {
			run.AvgRecall = v.(float64)
		}
		if v, ok := updates["avg_score"]; ok {
			run.AvgScore = v.(float64)
		}
		if v, ok := updates["report"]; ok {
			run.Report = v.(string)
		}
	}
	return f.updateErr
}

func (f *fakeEvalStore) GetEvalRun(ctx context.Context, tenantID, id string) (*models.EvalRun, error) {
	return f.runs[id], nil
}

func (f *fakeEvalStore) Retrieve(ctx context.Context, tenantID, query, spaceID string, topK *int) ([]models.RAGRetrieveResult, error) {
	if topK != nil {
		f.topKSeen = append(f.topKSeen, *topK)
	}
	if err := f.retrieveErrBy[query]; err != nil {
		return nil, err
	}
	return f.retrieveByQuery[query], nil
}

func runEval(t *testing.T, store *fakeEvalStore, req models.RunEvalRequest) (*models.EvalRun, error) {
	t.Helper()
	s := &Service{repo: store, ragRepo: store}
	return s.RunEval(context.Background(), "t1", req, "u1")
}

// The original code added 1.0 per case, so avg_recall was total/total == 1.00
// for any non-empty run and AvgRecallDelta in CompareRuns could never move.
func Test_RunEval_AvgRecallIsMeasuredAgainstGoldSources(t *testing.T) {
	store := &fakeEvalStore{
		cases: []models.EvalSetCase{
			// full hit: the one declared gold source is retrieved
			{Query: "qa", GoldAnswer: "hello world", GoldSources: "[d1]", ID: "c1"},
			// partial hit: one of two declared gold sources is retrieved
			{Query: "qb", GoldAnswer: "unrelated text", GoldSources: "[d2,d3]", ID: "c2"},
			// declares no gold sources: passable, but recall is not measurable
			{Query: "qc", GoldAnswer: "", GoldSources: "[]", ID: "c3"},
		},
		retrieveByQuery: map[string][]models.RAGRetrieveResult{
			"qa": {{ID: "d1", Content: "hello world of ideas", Similarity: 0.9}},
			"qb": {{ID: "d2", Content: "the sky is blue", Similarity: 0.6}},
			"qc": {{ID: "d9", Content: "noise", Similarity: 0.4}},
		},
	}
	run, err := runEval(t, store, models.RunEvalRequest{SetID: "set-1"})
	if err != nil {
		t.Fatal(err)
	}
	// (1.0 + 0.5) / 2 gold-bearing cases, not / 3 total cases.
	if run.AvgRecall != 0.75 {
		t.Fatalf("avg_recall = %v, want 0.75", run.AvgRecall)
	}
	// All three cases reached retrieval, so all three score.
	if run.AvgScore != 0.63 {
		t.Fatalf("avg_score = %v, want 0.63", run.AvgScore)
	}
	if run.Report != `{"total":3,"pass":2,"fail":1,"pass_rate":0.67,"gold_cases":2}` {
		t.Fatalf("report = %s", run.Report)
	}
	if run.Status != "completed" || run.PassCount != 2 || run.TotalCount != 3 {
		t.Fatalf("run = %+v", run)
	}
	if len(store.topKSeen) != 3 || store.topKSeen[0] != 5 {
		t.Fatalf("topK seen = %v, want [5 5 5]", store.topKSeen)
	}
}

// A case whose retrieval errored must not be in either denominator: dividing
// by total_count would report a quality the retrieval never produced.
func Test_RunEval_RetrievalErrorLeavesBothDenominators(t *testing.T) {
	store := &fakeEvalStore{
		cases: []models.EvalSetCase{
			{Query: "qa", GoldAnswer: "the sky is blue", GoldSources: "[d1,d2]", ID: "c1"},
			{Query: "qb", GoldAnswer: "irrelevant", GoldSources: "[d3]", ID: "c2"},
		},
		retrieveByQuery: map[string][]models.RAGRetrieveResult{
			"qa": {{ID: "d2", Content: "the sky is blue", Similarity: 0.6}},
		},
		retrieveErrBy: map[string]error{"qb": errors.New("embedding store down")},
	}
	run, err := runEval(t, store, models.RunEvalRequest{SetID: "set-1"})
	if err != nil {
		t.Fatal(err)
	}
	// One measured case with recall 0.5 -> 0.50, not 0.25 as /2 would give.
	if run.AvgRecall != 0.5 {
		t.Fatalf("avg_recall = %v, want 0.5", run.AvgRecall)
	}
	// 0.6 / 1 measured case, not 0.3 as /2 would give.
	if run.AvgScore != 0.6 {
		t.Fatalf("avg_score = %v, want 0.6", run.AvgScore)
	}
	if run.Report != `{"total":2,"pass":1,"fail":1,"pass_rate":0.50,"gold_cases":1}` {
		t.Fatalf("report = %s", run.Report)
	}
}

// CreateEvalSet defaults gold_sources to "[]", so a run whose cases never
// declared gold sources must report 0.00 with gold_cases 0 rather than a
// measured zero -- otherwise the run reads as a total retrieval failure.
func Test_RunEval_NoGoldSourcesIsNotMeasureable(t *testing.T) {
	store := &fakeEvalStore{
		cases: []models.EvalSetCase{
			{Query: "qa", GoldAnswer: "", GoldSources: "[]", ID: "c1"},
			{Query: "qb", GoldAnswer: "", GoldSources: "[]", ID: "c2"},
		},
		retrieveByQuery: map[string][]models.RAGRetrieveResult{
			"qa": {{ID: "d1", Similarity: 0.8}},
			"qb": {{ID: "d2", Similarity: 0.2}},
		},
	}
	run, err := runEval(t, store, models.RunEvalRequest{SetID: "set-1"})
	if err != nil {
		t.Fatal(err)
	}
	if run.AvgRecall != 0 {
		t.Fatalf("avg_recall = %v, want 0", run.AvgRecall)
	}
	if run.AvgScore != 0.5 {
		t.Fatalf("avg_score = %v, want 0.5", run.AvgScore)
	}
	if run.Report != `{"total":2,"pass":2,"fail":0,"pass_rate":1.00,"gold_cases":0}` {
		t.Fatalf("report = %s", run.Report)
	}
}

// CompareRuns reads avg_recall straight off the run, so a regression in
// retrieval ranking now surfaces as a non-zero AvgRecallDelta.
func Test_CompareRuns_AvgRecallDeltaReflectsRetrieval(t *testing.T) {
	base := &models.EvalRun{ID: "b", PassCount: 1, TotalCount: 1, AvgRecall: 0.5, AvgScore: 0.5}
	head := &models.EvalRun{ID: "h", PassCount: 1, TotalCount: 1, AvgRecall: 1.0, AvgScore: 0.5}
	s := &Service{ragRepo: &mockEvalRAGRepo{runs: map[string]*models.EvalRun{"b": base, "h": head}}}
	cmp, err := s.CompareRuns(context.Background(), "t1", models.CompareRunsRequest{BaseRunID: "b", HeadRunID: "h"})
	if err != nil {
		t.Fatal(err)
	}
	if cmp.Delta.AvgRecallDelta != 0.5 {
		t.Fatalf("avg_recall delta = %v, want 0.5", cmp.Delta.AvgRecallDelta)
	}
}

func Test_RunEval_SetNotFound(t *testing.T) {
	store := &fakeEvalStore{setErr: errors.New("no such set")}
	if _, err := runEval(t, store, models.RunEvalRequest{SetID: "missing"}); err == nil {
		t.Fatal("expected error for missing eval set")
	}
}

// The service writes the run result and then reads it back. Discarding the
// write error used to return 200 with the run still marked status=running.
func Test_RunEval_UpdateEvalRunErrorPropagates(t *testing.T) {
	store := &fakeEvalStore{
		updateErr: errors.New("disk full"),
		cases:     []models.EvalSetCase{{Query: "qa", GoldAnswer: "a", GoldSources: "[d1]", ID: "c1"}},
		retrieveByQuery: map[string][]models.RAGRetrieveResult{
			"qa": {{ID: "d1", Content: "a", Similarity: 0.9}},
		},
	}
	run, err := runEval(t, store, models.RunEvalRequest{SetID: "set-1"})
	if err == nil {
		t.Fatal("expected the write error to be returned, not swallowed")
	}
	if run != nil {
		t.Fatalf("expected nil run, got %+v", run)
	}
	if !strings.Contains(err.Error(), "record eval run result") {
		t.Fatalf("error = %v", err)
	}
}

func Test_RunEval_EmptySet(t *testing.T) {
	store := &fakeEvalStore{}
	run, err := runEval(t, store, models.RunEvalRequest{SetID: "set-1"})
	if err != nil {
		t.Fatal(err)
	}
	if run.AvgRecall != 0 || run.AvgScore != 0 {
		t.Fatalf("avg_recall=%v avg_score=%v, want both 0", run.AvgRecall, run.AvgScore)
	}
	if run.Report != `{"total":0,"pass":0,"fail":0,"pass_rate":0.00,"gold_cases":0}` {
		t.Fatalf("report = %s", run.Report)
	}
}

func Test_ParseGoldSources(t *testing.T) {
	tests := []struct {
		in   string
		want []string
	}{
		{`[doc-1,doc-2]`, []string{"doc-1", "doc-2"}},     // CreateEvalSet's shape
		{`["doc-1","doc-2"]`, []string{"doc-1", "doc-2"}}, // JSON shape
		{`[ doc-1 , doc-2 ]`, []string{"doc-1", "doc-2"}},
		{`[doc-1,,doc-2,]`, []string{"doc-1", "doc-2"}},
		{`["doc-1"]`, []string{"doc-1"}},
		{"", nil},
		{"[]", nil},
		{"   ", nil},
		{"not json at all", []string{"not json at all"}},
		{`[""]`, nil},
	}
	for _, tt := range tests {
		got := parseGoldSources(tt.in)
		if len(got) != len(tt.want) {
			t.Errorf("parseGoldSources(%q) = %v, want %v", tt.in, got, tt.want)
			continue
		}
		for i := range got {
			if got[i] != tt.want[i] {
				t.Errorf("parseGoldSources(%q)[%d] = %q, want %q", tt.in, i, got[i], tt.want[i])
			}
		}
	}
}

func Test_RecallForCase(t *testing.T) {
	gold := "[d1,d2]"
	res := []models.RAGRetrieveResult{{ID: "d1"}, {ID: "d2"}, {ID: "other"}}
	if got, ok := recallForCase(gold, res); !ok || got != 1.0 {
		t.Fatalf("full hit = %v,%v, want 1.0,true", got, ok)
	}
	partial := []models.RAGRetrieveResult{{ID: "d2"}}
	if got, ok := recallForCase(gold, partial); !ok || got != 0.5 {
		t.Fatalf("partial hit = %v,%v, want 0.5,true", got, ok)
	}
	miss := []models.RAGRetrieveResult{{ID: "other"}}
	if got, ok := recallForCase(gold, miss); !ok || got != 0.0 {
		t.Fatalf("no hit = %v,%v, want 0.0,true", got, ok)
	}
	if got, ok := recallForCase(gold, nil); !ok || got != 0.0 {
		t.Fatalf("no results = %v,%v, want 0.0,true", got, ok)
	}
	// Not measurable, so it must not enter the denominator.
	if got, ok := recallForCase("[]", res); ok || got != 0 {
		t.Fatalf("no gold sources = %v,%v, want 0,false", got, ok)
	}
	if got, ok := recallForCase("", res); ok || got != 0 {
		t.Fatalf("empty gold sources = %v,%v, want 0,false", got, ok)
	}
	// A result with no ID cannot be matched against declared sources.
	if got, ok := recallForCase("[d1]", []models.RAGRetrieveResult{{ID: "", Content: "x"}}); !ok || got != 0 {
		t.Fatalf("blank ID = %v,%v, want 0.0,true", got, ok)
	}
}
