package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/rca/models"
)

// Service tests use a recording fake repository. The service is now programmed
// against the repository.Repository interface rather than the concrete
// *repository.RCARespository, which is what makes these assertions possible:
// every method on the interface takes tenantID, so the fake can fail a test if
// the caller's tenant is dropped or, worse, replaced with the zero UUID.
//
// Pinned here:
//   - the acting user reached triggered_by from the auth context, not a literal
//     "manual";
//   - the analysis window was not discarded;
//   - two identical analyses always produced the same priority ordering, even
//     though the category catalogue is a Go map;
//   - an analysis with no signal returns no root cause instead of an invented
//     one;
//   - a timeline lookup goes through the tenant-scoped analysis lookup first, so
//     it resolves the incident rather than passing an analysis id where an
//     incident id belongs.

var (
	tenantA    = uuid.MustParse("11111111-1111-1111-1111-111111111111")
	tenantB    = uuid.MustParse("22222222-2222-2222-2222-222222222222")
	analysisID = uuid.MustParse("33333333-3333-3333-3333-333333333333")
	incidentID = uuid.MustParse("44444444-4444-4444-4444-444444444444")
)

type fakeRepo struct {
	createTenant uuid.UUID
	createBy     string
	createErr    error

	updateTenant uuid.UUID
	updateID     uuid.UUID
	updateStatus string
	updateCauses []models.RootCause
	updateConf   float64
	updateErr    error

	getTenant uuid.UUID
	getID     uuid.UUID
	get       *models.RCAAnalysis
	getErr    error
	getCalls  int

	historyTenant uuid.UUID
	historyInc    string
	history       models.RCAAnalysisResponse
	historyErr    error

	timelineTenant uuid.UUID
	timelineInc    string
	timelineCalls  int
	timelineErr    error
	timeline       []models.TimelineEvent
}

func (f *fakeRepo) CreateAnalysis(ctx context.Context, tenantID uuid.UUID, incidentID, triggeredBy string) (*models.RCAAnalysis, error) {
	f.createTenant, f.createBy = tenantID, triggeredBy
	if f.createErr != nil {
		return nil, f.createErr
	}
	now := time.Now()
	return &models.RCAAnalysis{
		ID: analysisID, TenantID: tenantID, IncidentID: incidentID,
		Status: "running", TriggeredBy: triggeredBy, StartedAt: now,
		RootCauses: []models.RootCause{},
	}, nil
}

func (f *fakeRepo) GetAnalysis(ctx context.Context, tenantID, id uuid.UUID) (*models.RCAAnalysis, error) {
	f.getCalls++
	f.getTenant, f.getID = tenantID, id
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.get, nil
}

func (f *fakeRepo) UpdateAnalysis(ctx context.Context, tenantID, id uuid.UUID, status string, rootCauses []models.RootCause, confidence float64) error {
	f.updateTenant, f.updateID = tenantID, id
	f.updateStatus, f.updateCauses, f.updateConf = status, rootCauses, confidence
	return f.updateErr
}

func (f *fakeRepo) QueryAnalysisHistory(ctx context.Context, tenantID uuid.UUID, incidentID string, limit, offset int) (models.RCAAnalysisResponse, error) {
	f.historyTenant, f.historyInc = tenantID, incidentID
	return f.history, f.historyErr
}

func (f *fakeRepo) GetTimeline(ctx context.Context, tenantID uuid.UUID, incidentID string, limit int) ([]models.TimelineEvent, error) {
	f.timelineCalls++
	f.timelineTenant, f.timelineInc = tenantID, incidentID
	if f.timelineErr != nil {
		return nil, f.timelineErr
	}
	return f.timeline, nil
}

func newSvc(repo *fakeRepo) *RCAService {
	return NewRCAService(repo, zap.NewNop())
}

func analyzeReq(include, exclude []string) *models.AnalyzeRequest {
	return &models.AnalyzeRequest{
		IncidentID:      "inc-42",
		TimeRange:       models.TimeRange{Start: time.Date(2026, 8, 26, 9, 0, 0, 0, time.UTC), End: time.Date(2026, 8, 26, 10, 0, 0, 0, time.UTC)},
		IncludePatterns: include, ExcludePatterns: exclude,
	}
}

func TestAnalyzePassesCallerTenantAndActingUser(t *testing.T) {
	repo := &fakeRepo{}
	svc := newSvc(repo)

	got, err := svc.Analyze(context.Background(), tenantA, analyzeReq(nil, nil), "user-7")
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}
	if repo.createTenant != tenantA {
		t.Fatalf("CreateAnalysis tenant = %s, want %s (the caller's)", repo.createTenant, tenantA)
	}
	if repo.updateTenant != tenantA {
		t.Fatalf("UpdateAnalysis tenant = %s, want %s", repo.updateTenant, tenantA)
	}
	if repo.updateID != analysisID {
		t.Fatalf("UpdateAnalysis id = %s, want %s", repo.updateID, analysisID)
	}
	if repo.createBy != "user-7" || got.TriggeredBy != "user-7" {
		t.Fatalf("triggered_by = %q / %q, want user-7", repo.createBy, got.TriggeredBy)
	}
	if repo.updateStatus != "completed" || got.Status != "completed" {
		t.Fatalf("status = %q / %q", repo.updateStatus, got.Status)
	}
	if repo.updateCauses == nil || len(repo.updateCauses) != len(got.RootCauses) {
		t.Fatalf("the computed root causes did not reach UpdateAnalysis: %v", repo.updateCauses)
	}
	if repo.updateConf != got.Confidence {
		t.Fatalf("the computed confidence did not reach UpdateAnalysis: %v / %v", repo.updateConf, got.Confidence)
	}
	if got.CompletedAt == nil {
		t.Fatal("Analyze() did not set completed_at")
	}
}

func TestAnalyzeNoSignalReturnsNoRootCauses(t *testing.T) {
	svc := newSvc(&fakeRepo{})
	// An empty include list means "consider everything", not "no signal", so
	// the no-signal case is an include list that matches nothing at all.
	got, err := svc.Analyze(context.Background(), tenantA, analyzeReq([]string{"not-a-keyword"}, nil), "u")
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}
	if len(got.RootCauses) != 0 {
		t.Fatalf("no-signal analysis invented %d root causes: %+v", len(got.RootCauses), got.RootCauses)
	}
	if got.Confidence != 0.0 {
		t.Fatalf("no-signal analysis claimed confidence %v, want 0", got.Confidence)
	}
}

func TestAnalyzeExcludingEverythingStillPersists(t *testing.T) {
	repo := &fakeRepo{}
	svc := newSvc(repo)

	// The caller pinned all five categories into the exclude list, so there is no
	// signal at all. The analysis must still be recorded as completed, with an
	// empty root-cause list rather than a fabricated one.
	got, err := svc.Analyze(context.Background(), tenantA, analyzeReq(nil, allFive()), "u")
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}
	if len(got.RootCauses) != 0 || got.Confidence != 0.0 {
		t.Fatalf("root causes = %d, confidence = %v, want 0 and 0", len(got.RootCauses), got.Confidence)
	}
	if repo.updateCauses == nil {
		t.Fatal("an empty result must be persisted as an empty list, not nil")
	}
	if len(repo.updateCauses) != 0 {
		t.Fatalf("update received %d root causes, want 0", len(repo.updateCauses))
	}
	if repo.updateConf != 0.0 {
		t.Fatalf("update confidence = %v, want 0", repo.updateConf)
	}
}

func TestAnalyzeConfidenceTracksSpecificity(t *testing.T) {
	cases := []struct {
		name    string
		include []string
		exclude []string
		want    int
		conf    float64
	}{
		{"one category", []string{"performance"}, nil, 1, 0.2},
		{"keyword selects the category", []string{"Latency"}, nil, 1, 0.2},
		{"two categories", []string{"performance", "data"}, nil, 2, 0.4},
		{"all five", []string{"performance", "availability", "data", "security", "configuration"}, nil, 5, 0.95},
		{"one excluded", []string{"performance", "data", "security", "availability"}, []string{"availability"}, 3, 0.6},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := newSvc(&fakeRepo{})
			got, err := svc.Analyze(context.Background(), tenantA, analyzeReq(tc.include, tc.exclude), "u")
			if err != nil {
				t.Fatalf("Analyze() error = %v", err)
			}
			if len(got.RootCauses) != tc.want {
				t.Fatalf("root causes = %d, want %d (%+v)", len(got.RootCauses), tc.want, got.RootCauses)
			}
			if got.Confidence != tc.conf {
				t.Fatalf("confidence = %v, want %v", got.Confidence, tc.conf)
			}
		})
	}
}

func TestAnalyzePrioritiesAreDeterministic(t *testing.T) {
	// The category catalogue is a map. Iterating it directly produced a
	// different priority ordering on every run, so two identical analyses of the
	// same incident disagreed with each other.
	req := analyzeReq([]string{"performance", "availability", "data", "security", "configuration"}, nil)
	first, err := newSvc(&fakeRepo{}).Analyze(context.Background(), tenantA, req, "u")
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}
	want := make([]string, 0, len(first.RootCauses))
	for i, rc := range first.RootCauses {
		want = append(want, rc.Category)
		if rc.Priority != i+1 {
			t.Fatalf("priority %d = %d, want %d", i, rc.Priority, i+1)
		}
	}
	for run := 0; run < 200; run++ {
		got, err := newSvc(&fakeRepo{}).Analyze(context.Background(), tenantA, req, "u")
		if err != nil {
			t.Fatalf("run %d: %v", run, err)
		}
		if len(got.RootCauses) != len(want) {
			t.Fatalf("run %d: %d root causes, want %d", run, len(got.RootCauses), len(want))
		}
		for i := range want {
			if got.RootCauses[i].Category != want[i] {
				t.Fatalf("run %d: position %d = %s, want %s (map iteration is not order-independent)",
					run, i, got.RootCauses[i].Category, want[i])
			}
		}
	}
}

func TestAnalyzeEvidenceCarriesTheWindow(t *testing.T) {
	req := analyzeReq([]string{"performance"}, nil)
	got, err := newSvc(&fakeRepo{}).Analyze(context.Background(), tenantA, req, "u")
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}
	if len(got.RootCauses) != 1 {
		t.Fatalf("root causes = %d", len(got.RootCauses))
	}
	ev := got.RootCauses[0].Evidence
	if len(ev) != 1 || ev[0] == "" {
		t.Fatalf("evidence = %v, want the analysis window", ev)
	}
	for _, want := range []string{"Time range", req.TimeRange.Start.Format(time.RFC3339), req.TimeRange.End.Format(time.RFC3339)} {
		if !strings.Contains(ev[0], want) {
			t.Fatalf("evidence %q does not contain %q", ev[0], want)
		}
	}
}

func TestAnalyzeCreateFailureIsPropagated(t *testing.T) {
	repo := &fakeRepo{createErr: errors.New("db down")}
	if _, err := newSvc(repo).Analyze(context.Background(), tenantA, analyzeReq(nil, nil), "u"); err == nil {
		t.Fatal("Analyze() swallowed a create error")
	} else if !strings.Contains(err.Error(), "db down") {
		t.Fatalf("Analyze() error = %v", err)
	}
}

func TestAnalyzeUpdateFailureIsPropagated(t *testing.T) {
	if _, err := newSvc(&fakeRepo{updateErr: errors.New("locked")}).Analyze(context.Background(), tenantA, analyzeReq(nil, nil), "u"); err == nil {
		t.Fatal("Analyze() swallowed an update error")
	}
}

func TestSelectedCategoriesKeywordsAndCase(t *testing.T) {
	cases := []struct {
		include []string
		want    []string
	}{
		{[]string{" Latency "}, []string{"performance"}},
		{[]string{"SLOW_QUERY", "timeout"}, []string{"performance"}},
		{[]string{"not-a-keyword"}, []string{}},
		{[]string{}, allFive()},
	}
	for _, tc := range cases {
		got := selectedCategories(tc.include, nil)
		if !sameStringSlice(got, tc.want) {
			t.Fatalf("selectedCategories(%v) = %v, want %v", tc.include, got, tc.want)
		}
	}
}

func TestSelectedCategoriesExcludeWins(t *testing.T) {
	// "performance" is requested twice, once as a category name and once via a
	// keyword, and excluded by its category name. Exclusion must win.
	got := selectedCategories([]string{"performance", "latency"}, []string{"performance"})
	if len(got) != 0 {
		t.Fatalf("selectedCategories() = %v, want empty (exclude must win)", got)
	}
	// Excluding a keyword excludes the category it belongs to.
	got = selectedCategories([]string{"performance"}, []string{"latency"})
	if len(got) != 0 {
		t.Fatalf("selectedCategories() = %v, want empty", got)
	}
}

func TestSelectedCategoriesDeterministic(t *testing.T) {
	want := selectedCategories(nil, []string{"security"})
	for i := 0; i < 200; i++ {
		got := selectedCategories(nil, []string{"security"})
		if !sameStringSlice(got, want) {
			t.Fatalf("run %d = %v, want %v", i, got, want)
		}
	}
}

func TestGetTimelineResolvesTheIncident(t *testing.T) {
	repo := &fakeRepo{
		get:      &models.RCAAnalysis{ID: analysisID, TenantID: tenantA, IncidentID: "inc-42"},
		timeline: []models.TimelineEvent{{ID: incidentID, Type: "deploy"}},
	}
	svc := newSvc(repo)

	got, err := svc.GetTimeline(context.Background(), tenantA, analysisID)
	if err != nil {
		t.Fatalf("GetTimeline() error = %v", err)
	}
	// The incident id must come from the analysis, never from the path parameter.
	if repo.timelineInc != "inc-42" {
		t.Fatalf("GetTimeline queried incident_id = %q, want inc-42 (the analysis's incident)", repo.timelineInc)
	}
	if repo.timelineTenant != tenantA {
		t.Fatalf("GetTimeline tenant = %s, want %s", repo.timelineTenant, tenantA)
	}
	if repo.getCalls != 1 || len(got) != 1 || got[0].Type != "deploy" {
		t.Fatalf("GetTimeline() = %+v, getCalls = %d", got, repo.getCalls)
	}
}

func TestGetTimelineForeignAnalysisIsNotFound(t *testing.T) {
	repo := &fakeRepo{getErr: errors.New("rca analysis not found")}
	_, err := newSvc(repo).GetTimeline(context.Background(), tenantA, analysisID)
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("GetTimeline() error = %v, want not found", err)
	}
	if repo.timelineCalls != 0 {
		t.Fatalf("a lookup that failed the tenant check still queried the timeline %d time(s)", repo.timelineCalls)
	}
}

func TestSuggestFixesAggregatesAndSorts(t *testing.T) {
	rcA := uuid.MustParse("55555555-5555-5555-5555-555555555555")
	rcB := uuid.MustParse("66666666-6666-6666-6666-666666666666")
	repo := &fakeRepo{get: &models.RCAAnalysis{
		ID: analysisID, TenantID: tenantA, IncidentID: "inc-42",
		RootCauses: []models.RootCause{
			{ID: rcA, Fixes: []models.Fix{
				{Title: "Enable caching", Priority: 3},
				{Title: "Optimize queries", Priority: 1},
			}},
			{ID: rcB, Fixes: []models.Fix{
				{Title: "Enable backups", Priority: 2},
			}},
		},
	}}
	svc := newSvc(repo)

	got, err := svc.SuggestFixes(context.Background(), tenantA, analysisID)
	if err != nil {
		t.Fatalf("SuggestFixes() error = %v", err)
	}
	if repo.getTenant != tenantA || repo.getID != analysisID {
		t.Fatalf("SuggestFixes queried tenant %s / id %s, want %s / %s", repo.getTenant, repo.getID, tenantA, analysisID)
	}
	if len(got) != 3 {
		t.Fatalf("SuggestFixes() = %d fixes, want 3: %+v", len(got), got)
	}
	wantOrder := []struct {
		title    string
		priority int
		rc       uuid.UUID
	}{
		{"Optimize queries", 1, rcA},
		{"Enable backups", 2, rcB},
		{"Enable caching", 3, rcA},
	}
	for i, want := range wantOrder {
		if got[i].Title != want.title || got[i].Priority != want.priority || got[i].RootCauseID != want.rc {
			t.Fatalf("fix %d = %q/%d/%s, want %q/%d/%s", i, got[i].Title, got[i].Priority, got[i].RootCauseID, want.title, want.priority, want.rc)
		}
	}
}

func TestSuggestFixesEmptyAnalysisIsAnEmptySlice(t *testing.T) {
	repo := &fakeRepo{get: &models.RCAAnalysis{ID: analysisID, TenantID: tenantA, RootCauses: []models.RootCause{}}}
	got, err := newSvc(repo).SuggestFixes(context.Background(), tenantA, analysisID)
	if err != nil {
		t.Fatalf("SuggestFixes() error = %v", err)
	}
	if got == nil || len(got) != 0 {
		t.Fatalf("SuggestFixes() = %v, want an empty non-nil slice", got)
	}
}

func TestSuggestFixesNotFoundIsPropagated(t *testing.T) {
	_, err := newSvc(&fakeRepo{getErr: errors.New("rca analysis not found")}).SuggestFixes(context.Background(), tenantA, analysisID)
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("SuggestFixes() error = %v, want not found", err)
	}
}

func TestTenantReachesEveryPassThrough(t *testing.T) {
	repo := &fakeRepo{}
	svc := newSvc(repo)

	if _, err := svc.QueryAnalysisHistory(context.Background(), tenantB, "inc-9", 25, 10); err != nil {
		t.Fatalf("QueryAnalysisHistory() error = %v", err)
	}
	if repo.historyTenant != tenantB || repo.historyInc != "inc-9" {
		t.Fatalf("QueryAnalysisHistory tenant = %s / incident = %q", repo.historyTenant, repo.historyInc)
	}

	if _, err := svc.GetAnalysis(context.Background(), tenantB, analysisID); err != nil {
		t.Fatalf("GetAnalysis() error = %v", err)
	}
	if repo.getTenant != tenantB || repo.getID != analysisID {
		t.Fatalf("GetAnalysis tenant = %s / id = %s", repo.getTenant, repo.getID)
	}
}

func TestGetAnalysisNotFoundIsPropagated(t *testing.T) {
	_, err := newSvc(&fakeRepo{getErr: errors.New("rca analysis not found: x")}).GetAnalysis(context.Background(), tenantA, analysisID)
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("GetAnalysis() error = %v, want not found", err)
	}
}

func TestSuggestFixesFallback(t *testing.T) {
	got := suggestFixes("unknown-category")
	if len(got) != 1 || got[0].Title != "Investigate manually" {
		t.Fatalf("suggestFixes() = %+v", got)
	}
	if len(suggestFixes("performance")) != 3 {
		t.Fatalf("suggestFixes(performance) = %d fixes", len(suggestFixes("performance")))
	}
	for _, cat := range []string{"availability", "data", "security", "configuration"} {
		if got := suggestFixes(cat); len(got) < 2 {
			t.Fatalf("suggestFixes(%s) = %d fixes", cat, len(got))
		}
	}
}

// --- helpers -------------------------------------------------------------

func allFive() []string {
	return []string{"availability", "configuration", "data", "performance", "security"}
}

func sameStringSlice(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
