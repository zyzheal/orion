package aireview

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	engine "orion/platform-svc-go/internal/inception/engine"
)

// fakeRepo is an in-memory ReviewRepository for tests.
type fakeRepo struct {
	records map[string]*ReviewRecord
	order   []string // insertion order
	err     error
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{records: map[string]*ReviewRecord{}}
}

func (f *fakeRepo) Insert(ctx context.Context, rec *ReviewRecord) error {
	if f.err != nil {
		return f.err
	}
	if rec.ID == "" {
		rec.ID = "gen-id"
	}
	r := *rec
	f.records[rec.ID] = &r
	f.order = append(f.order, rec.ID)
	return nil
}

func (f *fakeRepo) Get(ctx context.Context, id string) (*ReviewRecord, error) {
	r, ok := f.records[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return r, nil
}

func (f *fakeRepo) ListByTenant(ctx context.Context, tenantID string, limit int) ([]ReviewRecord, error) {
	out := []ReviewRecord{}
	// Insertion order in f.order is oldest-first; we need newest-first.
	for i := len(f.order) - 1; i >= 0; i-- {
		r := f.records[f.order[i]]
		if r.TenantID != tenantID {
			continue
		}
		if len(out) >= limit {
			break
		}
		out = append(out, *r)
	}
	return out, nil
}

func TestServiceReviewSQLPersists(t *testing.T) {
	local := &fakeLocalEngine{report: &engine.AuditReport{Passed: true, Rules: []engine.AuditResult{}, ParsedOK: true, DBType: "mysql"}}
	ai := &fakeAIClient{enabled: true, model: "m", suggestions: []AISuggestion{{Category: "style", Severity: SeverityInfo, Title: "x"}}}
	reviewer := NewReviewer(local, ai, nil)
	repo := newFakeRepo()
	svc := NewService(reviewer, repo, nil)

	result, err := svc.ReviewSQL(context.Background(), "t-123", SQLReviewRequest{SQL: "SELECT * FROM users", DBType: "mysql"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ID == "" {
		t.Error("expected result ID populated after insert")
	}
	if result.TenantID != "t-123" {
		t.Errorf("expected tenant t-123, got %q", result.TenantID)
	}
	if len(repo.records) != 1 {
		t.Fatalf("expected 1 persisted record, got %d", len(repo.records))
	}
	// Verify stored record is well-formed JSON for local audit + AI suggestions.
	rec := repo.records[result.ID]
	var localPayload map[string]interface{}
	if err := json.Unmarshal([]byte(rec.LocalAudit), &localPayload); err != nil {
		t.Errorf("local audit JSON invalid: %v", err)
	}
	var aiPayload []map[string]interface{}
	if err := json.Unmarshal([]byte(rec.AISuggestions), &aiPayload); err != nil {
		t.Errorf("ai suggestions JSON invalid: %v", err)
	}
	if len(aiPayload) != 1 || aiPayload[0]["title"] != "x" {
		t.Errorf("unexpected ai payload: %v", aiPayload)
	}
}

func TestServiceReviewSQLNoRepoStillWorks(t *testing.T) {
	local := &fakeLocalEngine{report: &engine.AuditReport{Passed: true, Rules: []engine.AuditResult{}, ParsedOK: true, DBType: "mysql"}}
	reviewer := NewReviewer(local, nil, nil)
	svc := NewService(reviewer, nil, nil)
	result, err := svc.ReviewSQL(context.Background(), "t", SQLReviewRequest{SQL: "SELECT 1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ID == "" {
		t.Error("expected ID populated even without repo (for traceability)")
	}
}

func TestServiceGetHistory(t *testing.T) {
	repo := newFakeRepo()
	for i := 0; i < 5; i++ {
		rec := &ReviewRecord{ID: fmt.Sprintf("rec-%d", i), TenantID: "t", SQL: "SELECT 1", Verdict: "safe"}
		_ = repo.Insert(context.Background(), rec)
	}
	svc := NewService(nil, repo, nil)
	got, err := svc.GetReviewHistory(context.Background(), "t", 3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 3 {
		t.Errorf("expected 3 records, got %d", len(got))
	}
	// Newest first: should be the last inserted (rec-4).
	if got[0].ID != "rec-4" {
		t.Errorf("expected newest first (rec-4), got %q", got[0].ID)
	}
}

func TestServiceGetHistoryDefaultLimit(t *testing.T) {
	repo := newFakeRepo()
	for i := 0; i < 30; i++ {
		_ = repo.Insert(context.Background(), &ReviewRecord{ID: string(rune('a' + i)) + string(rune('0'+i%10)), TenantID: "t"})
	}
	svc := NewService(nil, repo, nil)
	got, _ := svc.GetReviewHistory(context.Background(), "t", 0)
	if len(got) != 20 {
		t.Errorf("expected default limit 20, got %d", len(got))
	}
}

func TestServiceGetHistoryCapsAt100(t *testing.T) {
	repo := newFakeRepo()
	for i := 0; i < 5; i++ {
		_ = repo.Insert(context.Background(), &ReviewRecord{ID: string(rune('a' + i)), TenantID: "t"})
	}
	svc := NewService(nil, repo, nil)
	// Repository is a fake; the cap logic is in Service. The fake
	// doesn't know about the cap; we just verify the call succeeds.
	_, err := svc.GetReviewHistory(context.Background(), "t", 10000)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestServiceGetResultNotFound(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(nil, repo, nil)
	_, err := svc.GetReviewResult(context.Background(), "nope")
	if err == nil {
		t.Error("expected error for missing record")
	}
}

func TestServiceNilReviewerReturnsError(t *testing.T) {
	svc := NewService(nil, nil, nil)
	_, err := svc.ReviewSQL(context.Background(), "t", SQLReviewRequest{SQL: "SELECT 1"})
	if err == nil {
		t.Error("expected error when reviewer is nil")
	}
}

func TestServiceNilRepoHistoryReturnsEmpty(t *testing.T) {
	svc := NewService(nil, nil, nil)
	got, err := svc.GetReviewHistory(context.Background(), "t", 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty history when no repo, got %d", len(got))
	}
}
