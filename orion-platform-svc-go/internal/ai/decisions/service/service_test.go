package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/ai-decisions/models"
	"orion/platform-svc-go/internal/ai-decisions/repository"
)

// mockDecisionRepo implements DecisionRepo backed by an in-memory map.
type mockDecisionRepo struct {
	decisions  map[string]*models.AIDecision
	feedbacks  map[string][]*models.DecisionFeedback // keyed by decisionID
	traces     map[string][]*models.DecisionTrace    // keyed by decisionID
	stats      *models.DecisionStats
	dbErr      error
	listErr    error
	count      int64
}

func newMockDecisionRepo() *mockDecisionRepo {
	return &mockDecisionRepo{
		decisions:  make(map[string]*models.AIDecision),
		feedbacks:  make(map[string][]*models.DecisionFeedback),
		traces:     make(map[string][]*models.DecisionTrace),
		stats:      &models.DecisionStats{ByStatus: make(map[models.DecisionStatus]int64), ByType: make(map[models.DecisionType]int64)},
	}
}

func (m *mockDecisionRepo) CreateDecision(_ context.Context, d *models.AIDecision) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	m.decisions[d.ID] = d
	return nil
}

func (m *mockDecisionRepo) GetByID(_ context.Context, id string, _ string) (*models.AIDecision, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	d, ok := m.decisions[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return d, nil
}

func (m *mockDecisionRepo) List(_ context.Context, _ string, _ *repository.ListFilter) ([]models.AIDecision, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	result := make([]models.AIDecision, 0, len(m.decisions))
	for _, d := range m.decisions {
		result = append(result, *d)
	}
	return result, nil
}

func (m *mockDecisionRepo) Count(_ context.Context, _ string, _ *repository.ListFilter) (int64, error) {
	if m.dbErr != nil {
		return 0, m.dbErr
	}
	return int64(len(m.decisions)), nil
}

func (m *mockDecisionRepo) UpdateDecisionStatus(_ context.Context, id string, _ string, status models.DecisionStatus, executedAt *int64) (*models.AIDecision, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	d, ok := m.decisions[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	d.Status = status
	if executedAt != nil {
		d.ExecutedAt = sql.NullInt64{Int64: *executedAt, Valid: true}
	}
	return d, nil
}

func (m *mockDecisionRepo) Delete(_ context.Context, id string, _ string) (bool, error) {
	if m.dbErr != nil {
		return false, m.dbErr
	}
	_, ok := m.decisions[id]
	delete(m.decisions, id)
	return ok, nil
}

func (m *mockDecisionRepo) CreateFeedback(_ context.Context, fb *models.DecisionFeedback) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	m.feedbacks[fb.DecisionID] = append(m.feedbacks[fb.DecisionID], fb)
	return nil
}

func (m *mockDecisionRepo) CreateTraces(_ context.Context, traces []*models.DecisionTrace) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	for _, t := range traces {
		m.traces[t.DecisionID] = append(m.traces[t.DecisionID], t)
	}
	return nil
}

func (m *mockDecisionRepo) GetTraces(_ context.Context, decisionID string, _ string) ([]models.DecisionTrace, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	ptrs := m.traces[decisionID]
	if ptrs == nil {
		return []models.DecisionTrace{}, nil
	}
	result := make([]models.DecisionTrace, len(ptrs))
	for i, p := range ptrs {
		result[i] = *p
	}
	return result, nil
}

func (m *mockDecisionRepo) DeleteTraces(_ context.Context, decisionID string, _ string) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	delete(m.traces, decisionID)
	return nil
}

func (m *mockDecisionRepo) DeleteFeedbacks(_ context.Context, decisionID string, _ string) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	_ = m.feedbacks[decisionID]
	delete(m.feedbacks, decisionID)
	return nil
}

func (m *mockDecisionRepo) GetStats(_ context.Context, _ string, _ *models.DateRange) (*models.DecisionStats, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return m.stats, nil
}

// ---- Decision CRUD tests ----

func setupDecisionRepoAndSVC() (*mockDecisionRepo, *Service) {
	repo := newMockDecisionRepo()
	svc := NewService(repo)
	return repo, svc
}

func sampleDecision() *models.AIDecision {
	return &models.AIDecision{
		ID:        "dec-1",
		TenantID:  "t-1",
		Type:      "scheduling",
		Status:    models.DecisionStatusPending,
		Input:     "{}",
		Output:    "{}",
		Confidence: 0.92,
		Reasoning:  `{"summary":"test","factors":[],"alternatives":[],"constraints":[],"assumptions":[]}`,
		Context:   "{}",
		CreatedBy: "u-1",
		CreatedAt: time.Now().Unix(),
	}
}

func sampleRecordReq() *models.RecordDecisionRequest {
	return &models.RecordDecisionRequest{
		Type:       "scheduling",
		Input:      map[string]interface{}{"key": "value"},
		Output:     map[string]interface{}{"result": "ok"},
		Confidence: 0.92,
		Reasoning: models.DecisionReasoning{
			Summary: "test decision",
			Factors: []models.DecisionFactor{{Name: "f1", Weight: 1.0, Description: "desc", Category: "c1"}},
		},
	}
}

func TestRecordDecision_Success(t *testing.T) {
	_, svc := setupDecisionRepoAndSVC()

	d, err := svc.RecordDecision(context.Background(), "t-1", "u-1", sampleRecordReq())
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if d == nil {
		t.Fatal("expected non-nil decision")
	}
	if d.Status != models.DecisionStatusPending {
		t.Fatalf("expected status pending, got %s", d.Status)
	}
}

func TestRecordDecision_DBError(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	repo.dbErr = errors.New("db unavailable")

	_, err := svc.RecordDecision(context.Background(), "t-1", "u-1", sampleRecordReq())
	if err == nil {
		t.Fatal("expected db error to propagate")
	}
}

func TestGetDecision_Success(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	d := sampleDecision()
	repo.decisions[d.ID] = d

	got, err := svc.GetDecision(context.Background(), d.ID, "t-1")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if got == nil {
		t.Fatal("expected non-nil decision")
	}
}

func TestGetDecision_NotFound(t *testing.T) {
	_, svc := setupDecisionRepoAndSVC()

	_, err := svc.GetDecision(context.Background(), "missing", "t-1")
	if !errors.Is(err, ErrDecisionNotFound) {
		t.Fatalf("expected ErrDecisionNotFound, got %v", err)
	}
}

func TestGetDecision_DBError(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	repo.dbErr = errors.New("db down")

	_, err := svc.GetDecision(context.Background(), "x", "t-1")
	if err == nil {
		t.Fatal("expected db error to propagate")
	}
}

func TestListDecisions_Empty(t *testing.T) {
	_, svc := setupDecisionRepoAndSVC()

	decisions, total, err := svc.ListDecisions(context.Background(), "t-1", &models.ListQuery{Limit: ptrInt(10)})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if total != 0 {
		t.Fatalf("expected total 0, got %d", total)
	}
	if len(decisions) != 0 {
		t.Fatalf("expected empty list, got %d items", len(decisions))
	}
}

func TestListDecisions_WithItems(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	repo.decisions["a"] = sampleDecision()
	repo.decisions["b"] = sampleDecision()
	repo.decisions["b"].ID = "b"

	decisions, total, err := svc.ListDecisions(context.Background(), "t-1", &models.ListQuery{Limit: ptrInt(10)})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if total != 2 {
		t.Fatalf("expected total 2, got %d", total)
	}
	if len(decisions) != 2 {
		t.Fatalf("expected 2 decisions, got %d", len(decisions))
	}
}

func TestListDecisions_DBError(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	repo.dbErr = errors.New("db down")

	_, _, err := svc.ListDecisions(context.Background(), "t-1", &models.ListQuery{})
	if err == nil {
		t.Fatal("expected db error to propagate")
	}
}

func TestUpdateDecisionStatus_Success(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	d := sampleDecision()
	repo.decisions[d.ID] = d

	updated, err := svc.UpdateDecisionStatus(context.Background(), d.ID, "t-1", models.DecisionStatusAccepted)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if updated.Status != models.DecisionStatusAccepted {
		t.Fatalf("expected accepted, got %s", updated.Status)
	}
}

func TestUpdateDecisionStatus_NotFound(t *testing.T) {
	_, svc := setupDecisionRepoAndSVC()

	_, err := svc.UpdateDecisionStatus(context.Background(), "missing", "t-1", models.DecisionStatusExecuted)
	if !errors.Is(err, ErrDecisionNotFound) {
		t.Fatalf("expected ErrDecisionNotFound, got %v", err)
	}
}

func TestUpdateDecisionStatus_SetExecutedAt(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	d := sampleDecision()
	repo.decisions[d.ID] = d

	_, err := svc.UpdateDecisionStatus(context.Background(), d.ID, "t-1", models.DecisionStatusExecuted)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if !d.ExecutedAt.Valid {
		t.Fatal("expected ExecutedAt to be set for executed status")
	}
}

func TestDeleteDecision_Success(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	d := sampleDecision()
	repo.decisions[d.ID] = d
	// pre-populate traces and feedback so delete cascades
	repo.traces[d.ID] = []*models.DecisionTrace{{DecisionID: d.ID, TenantID: "t-1"}}
	repo.feedbacks[d.ID] = []*models.DecisionFeedback{{DecisionID: d.ID, TenantID: "t-1"}}

	deleted, err := svc.DeleteDecision(context.Background(), d.ID, "t-1")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if !deleted {
		t.Fatal("expected deleted=true")
	}
	if _, ok := repo.decisions[d.ID]; ok {
		t.Fatal("decision should be removed from repo")
	}
}

func TestDeleteDecision_NotFound(t *testing.T) {
	_, svc := setupDecisionRepoAndSVC()

	_, err := svc.DeleteDecision(context.Background(), "missing", "t-1")
	if !errors.Is(err, ErrDecisionNotFound) {
		t.Fatalf("expected ErrDecisionNotFound, got %v", err)
	}
}

func TestDeleteDecision_DBError(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	d := sampleDecision()
	repo.decisions[d.ID] = d
	repo.dbErr = errors.New("db down")

	_, err := svc.DeleteDecision(context.Background(), d.ID, "t-1")
	if err == nil {
		t.Fatal("expected db error to propagate")
	}
}

// ---- Feedback tests ----

func TestSubmitFeedback_Success(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	d := sampleDecision()
	repo.decisions[d.ID] = d

	_, err := svc.SubmitFeedback(context.Background(), "t-1", "u-1", d.ID, &models.SubmitFeedbackRequest{
		Type: models.FeedbackTypePositive,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if d.Status != models.DecisionStatusAccepted {
		t.Fatalf("expected accepted after positive feedback, got %s", d.Status)
	}
}

func TestSubmitFeedback_NotFound(t *testing.T) {
	_, svc := setupDecisionRepoAndSVC()

	_, err := svc.SubmitFeedback(context.Background(), "t-1", "u-1", "missing", &models.SubmitFeedbackRequest{
		Type: models.FeedbackTypePositive,
	})
	if !errors.Is(err, ErrDecisionNotFound) {
		t.Fatalf("expected ErrDecisionNotFound, got %v", err)
	}
}

func TestSubmitFeedback_Negative(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	d := sampleDecision()
	repo.decisions[d.ID] = d

	_, err := svc.SubmitFeedback(context.Background(), "t-1", "u-1", d.ID, &models.SubmitFeedbackRequest{
		Type: models.FeedbackTypeNegative,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if d.Status != models.DecisionStatusRejected {
		t.Fatalf("expected rejected after negative feedback, got %s", d.Status)
	}
}

// ---- Traces tests ----

func TestGetTraces_Success(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	d := sampleDecision()
	repo.decisions[d.ID] = d
	tr := &models.DecisionTrace{DecisionID: d.ID, TenantID: "t-1", Action: "step1", Step: 1}
	repo.traces[d.ID] = []*models.DecisionTrace{tr}

	traces, err := svc.GetTraces(context.Background(), d.ID, "t-1")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(traces) != 1 {
		t.Fatalf("expected 1 trace, got %d", len(traces))
	}
}

func TestGetTraces_NotFound(t *testing.T) {
	_, svc := setupDecisionRepoAndSVC()

	_, err := svc.GetTraces(context.Background(), "missing", "t-1")
	if !errors.Is(err, ErrDecisionNotFound) {
		t.Fatalf("expected ErrDecisionNotFound, got %v", err)
	}
}

// ---- Explanation tests ----

func TestGetExplanation_Success(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	d := sampleDecision()
	repo.decisions[d.ID] = d

	res, err := svc.GetExplanation(context.Background(), d.ID, "t-1")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if res == nil || res.Decision == nil {
		t.Fatal("expected non-nil explanation result")
	}
	if res.Explanation == "" {
		t.Fatal("expected non-empty explanation text")
	}
}

func TestGetExplanation_NotFound(t *testing.T) {
	_, svc := setupDecisionRepoAndSVC()

	_, err := svc.GetExplanation(context.Background(), "missing", "t-1")
	if !errors.Is(err, ErrDecisionNotFound) {
		t.Fatalf("expected ErrDecisionNotFound, got %v", err)
	}
}

// ---- Stats tests ----

func TestGetStats_Success(t *testing.T) {
	_, svc := setupDecisionRepoAndSVC()

	stats, err := svc.GetStats(context.Background(), "t-1", nil)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if stats == nil {
		t.Fatal("expected non-nil stats")
	}
}

func TestGetStats_DBError(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	repo.dbErr = errors.New("db down")

	_, err := svc.GetStats(context.Background(), "t-1", nil)
	if err == nil {
		t.Fatal("expected db error to propagate")
	}
}

// ---- Analysis tests ----

func TestAnalyzeDecisions_Pattern(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	d := sampleDecision()
	repo.decisions[d.ID] = d

	result, err := svc.AnalyzeDecisions(context.Background(), "t-1", &models.AnalyzeDecisionsRequest{
		DecisionIds:  []string{d.ID},
		AnalysisType: "pattern",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(result.Insights) == 0 {
		t.Fatal("expected at least one insight")
	}
}

func TestAnalyzeDecisions_Empty(t *testing.T) {
	_, svc := setupDecisionRepoAndSVC()

	result, err := svc.AnalyzeDecisions(context.Background(), "t-1", &models.AnalyzeDecisionsRequest{
		DecisionIds:  []string{"nonexistent"},
		AnalysisType: "pattern",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(result.Recommendations) == 0 {
		t.Fatal("expected at least one recommendation")
	}
}

func TestAnalyzeDecisions_Types(t *testing.T) {
	repo, svc := setupDecisionRepoAndSVC()
	d := sampleDecision()
	d.Type = models.DecisionTypeScheduling
	repo.decisions[d.ID] = d

	result, err := svc.AnalyzeDecisions(context.Background(), "t-1", &models.AnalyzeDecisionsRequest{
		Types:        []models.DecisionType{models.DecisionTypeScheduling},
		AnalysisType: "trend",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
}

func TestGenerateExplanation_OutputContainsFields(t *testing.T) {
	_, svc := setupDecisionRepoAndSVC()
	d := &models.AIDecision{
		Type:       "test_type",
		Confidence: 0.85,
		Reasoning:  `{"summary":"S","factors":[{"name":"n","category":"c","weight":0.5,"description":"d"}],"alternatives":[{"option":"o","score":0.9,"reason":"r"}],"constraints":["c1"],"assumptions":["a1"]}`,
	}
	explanation := svc.generateExplanation(d)
	if explanation == "" {
		t.Fatal("expected non-empty explanation")
	}
	// Unmarshal to ensure reasoning JSON is well formed
	var r models.DecisionReasoning
	if err := json.Unmarshal([]byte(d.Reasoning), &r); err != nil {
		t.Fatalf("bad reasoning json: %v", err)
	}
	_ = r
}
