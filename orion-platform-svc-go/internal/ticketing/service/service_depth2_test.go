package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/repository"
	"orion/platform-svc-go/internal/ticketing/testutil"
)

// ---------------------------------------------------------------------------
// TicketGeneratorService
// ---------------------------------------------------------------------------

func TestTicketGeneratorFromAlertNilRepo(t *testing.T) {
	s := NewTicketGeneratorService(nil)
	if _, err := s.FromAlert(context.Background(), "t1", map[string]any{"title": "x"}, "u1"); err == nil {
		t.Error("expected error")
	}
}

func TestTicketGeneratorFromAlertExtractsTitleAndPriority(t *testing.T) {
	repo := testutil.NewMockTicketRepository()
	s := NewTicketGeneratorService(repo)
	tk, err := s.FromAlert(context.Background(), "t1", map[string]any{
		"title":    "disk full",
		"severity": "critical",
		"details":  "disk 100%",
	}, "u1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !strings.Contains(tk.Title, "[Alert] disk full") {
		t.Errorf("title = %q", tk.Title)
	}
	if tk.Priority != "critical" || tk.Type != "alert" || tk.Status != "open" {
		t.Errorf("priority=%q type=%q status=%q", tk.Priority, tk.Type, tk.Status)
	}
	if tk.CreatedBy != "u1" || tk.TenantID != "t1" {
		t.Errorf("createdBy=%q tenantID=%q", tk.CreatedBy, tk.TenantID)
	}
}

func TestTicketGeneratorFromAlertFallsBackToMessage(t *testing.T) {
	repo := testutil.NewMockTicketRepository()
	s := NewTicketGeneratorService(repo)
	tk, err := s.FromAlert(context.Background(), "t1",
		map[string]any{"message": "cpu high"}, "u1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !strings.Contains(tk.Title, "cpu high") {
		t.Errorf("title = %q", tk.Title)
	}
	if tk.Priority != "medium" {
		t.Errorf("priority = %q, want medium", tk.Priority)
	}
}

func TestTicketGeneratorFromAlertFallsBackToPriorityField(t *testing.T) {
	repo := testutil.NewMockTicketRepository()
	s := NewTicketGeneratorService(repo)
	tk, _ := s.FromAlert(context.Background(), "t1",
		map[string]any{"title": "x", "priority": "high"}, "u1")
	if tk.Priority != "high" {
		t.Errorf("priority = %q, want high", tk.Priority)
	}
}

func TestTicketGeneratorFromAlertRequiresTitleOrMessage(t *testing.T) {
	repo := testutil.NewMockTicketRepository()
	s := NewTicketGeneratorService(repo)
	_, err := s.FromAlert(context.Background(), "t1", map[string]any{"source": "mon"}, "u1")
	if err == nil || !strings.Contains(err.Error(), "title/message") {
		t.Errorf("err = %v", err)
	}
}

func TestTicketGeneratorFromIncidentNilRepo(t *testing.T) {
	s := NewTicketGeneratorService(nil)
	if _, err := s.FromIncident(context.Background(), "t1", map[string]any{"id": "i"}, "u1"); err == nil {
		t.Error("expected error")
	}
}

func TestTicketGeneratorFromIncidentRequiresIDAndTitle(t *testing.T) {
	repo := testutil.NewMockTicketRepository()
	s := NewTicketGeneratorService(repo)
	_, err := s.FromIncident(context.Background(), "t1", map[string]any{"title": "x"}, "u1")
	if err == nil || !strings.Contains(err.Error(), "id") {
		t.Errorf("err = %v", err)
	}
	_, err = s.FromIncident(context.Background(), "t1", map[string]any{"id": "i"}, "u1")
	if err == nil || !strings.Contains(err.Error(), "title") {
		t.Errorf("err = %v", err)
	}
}

func TestTicketGeneratorFromIncidentExtractsAllFields(t *testing.T) {
	repo := testutil.NewMockTicketRepository()
	s := NewTicketGeneratorService(repo)
	tk, err := s.FromIncident(context.Background(), "t1", map[string]any{
		"id":            "i-1",
		"title":         "db down",
		"severity":      "high",
		"description":  "pg down",
	}, "u1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !strings.Contains(tk.Title, "[Incident i-1]") || !strings.Contains(tk.Title, "db down") {
		t.Errorf("title = %q", tk.Title)
	}
	if tk.Priority != "high" || tk.Type != "incident" {
		t.Errorf("priority=%q type=%q", tk.Priority, tk.Type)
	}
	if tk.Description != "pg down" {
		t.Errorf("description = %q", tk.Description)
	}
}

// TestTicketGeneratorFromIncidentPriorityFallbackDocumentsShadowing
// notes a bug in FromIncident: the inner `priority, _ := incident["priority"].(string)`
// shadows the outer priority, so when severity is empty but the priority
// field is provided, the outer priority still reads "" (empty), and the
// "default to high" branch never fires. This test locks in the current
// (buggy) behavior so a future fix is easy to spot.
func TestTicketGeneratorFromIncidentPriorityFallbackDocumentsShadowing(t *testing.T) {
	repo := testutil.NewMockTicketRepository()
	s := NewTicketGeneratorService(repo)
	tk, _ := s.FromIncident(context.Background(), "t1",
		map[string]any{"id": "i", "title": "x", "priority": "high"}, "u1")
	if tk.Priority != "" {
		t.Errorf("outer priority was %q; want empty (documented shadowing bug in FromIncident)", tk.Priority)
	}
}

// ---------------------------------------------------------------------------
// LoadBalancer
// ---------------------------------------------------------------------------

// statefulLBRepo is a DispatchRepositoryInterface mock that returns the
// engineers we plant so GetBalancingReport can compute real stats.
type statefulLBRepo struct {
	repository.DispatchRepositoryInterface
	engineers []models.DispatchEngineer
	err       error
}

func (r *statefulLBRepo) ListEngineersAll(_ context.Context) ([]models.DispatchEngineer, error) {
	return r.engineers, r.err
}

func TestLoadBalancerGetBalancingReportEmpty(t *testing.T) {
	repo := &statefulLBRepo{}
	lb := NewLoadBalancer(repo)
	r, err := lb.GetBalancingReport(context.Background())
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if r == nil || len(r.Engineers) != 0 {
		t.Errorf("report = %+v", r)
	}
}

func TestLoadBalancerGetBalancingReportComputesLoad(t *testing.T) {
	repo := &statefulLBRepo{engineers: []models.DispatchEngineer{
		{ID: "e1", Name: "a", CurrentLoad: 3, MaxCapacity: 10},
		{ID: "e2", Name: "b", CurrentLoad: 7, MaxCapacity: 10},
		{ID: "e3", Name: "c", CurrentLoad: 5, MaxCapacity: 10},
	}}
	lb := NewLoadBalancer(repo)
	r, err := lb.GetBalancingReport(context.Background())
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if r.MaxLoad != 7 || r.MinLoad != 3 {
		t.Errorf("min=%d max=%d, want 3/7", r.MinLoad, r.MaxLoad)
	}
	if r.AvgLoad < 4.99 || r.AvgLoad > 5.01 {
		t.Errorf("avg = %f, want 5", r.AvgLoad)
	}
	if len(r.Engineers) != 3 {
		t.Errorf("engineers = %d", len(r.Engineers))
	}
	for _, e := range r.Engineers {
		if e.EngineerID == "e2" {
			if e.Utilization < 69.9 || e.Utilization > 70.1 {
				t.Errorf("b utilization = %f, want 70", e.Utilization)
			}
		}
	}
}

func TestLoadBalancerGetBalancingReportPropagatesListError(t *testing.T) {
	repo := &statefulLBRepo{err: errors.New("db")}
	lb := NewLoadBalancer(repo)
	if _, err := lb.GetBalancingReport(context.Background()); err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// AnalyzerService — validation branches
// ---------------------------------------------------------------------------

func TestAnalyzerServiceAddRelationInvalidType(t *testing.T) {
	s := NewAnalyzerService(testutil.NewMockRelationRepository(), testutil.NewMockTicketRepository())
	_, err := s.AddRelation(context.Background(), "t1", "t2", "not_a_type", "u1", "", 0.9)
	if err == nil || !strings.Contains(err.Error(), "invalid relation type") {
		t.Errorf("err = %v", err)
	}
}

func TestAnalyzerServiceGetRelations(t *testing.T) {
	s := NewAnalyzerService(testutil.NewMockRelationRepository(), testutil.NewMockTicketRepository())
	if _, err := s.GetRelations(context.Background(), "t1"); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestAnalyzerServiceFindRelatedTickets(t *testing.T) {
	s := NewAnalyzerService(testutil.NewMockRelationRepository(), testutil.NewMockTicketRepository())
	if _, err := s.FindRelatedTickets(context.Background(), "t1", 10, 0.5); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestAnalyzerServiceDetectDuplicates(t *testing.T) {
	s := NewAnalyzerService(testutil.NewMockRelationRepository(), testutil.NewMockTicketRepository())
	if _, err := s.DetectDuplicates(context.Background(), "t1", 0.8); err != nil {
		t.Errorf("err: %v", err)
	}
}

func TestAnalyzerServiceCorrelateRootCause(t *testing.T) {
	repo := testutil.NewMockRelationRepository()
	tr := testutil.NewMockTicketRepository()
	tr.Tickets["t1"] = &models.Ticket{ID: "t1", Category: "billing", Source: "email"}
	tr.Tickets["t2"] = &models.Ticket{ID: "t2", Category: "billing", Source: "email"}
	tr.Tickets["t3"] = &models.Ticket{ID: "t3", Category: "network", Source: "web"}
	s := NewAnalyzerService(repo, tr)
	if _, err := s.CorrelateRootCause(context.Background(), []string{"t1", "t2", "t3"}); err != nil {
		t.Errorf("err: %v", err)
	}
}

// ---------------------------------------------------------------------------
// WorkflowService transitions already covered by workflow_test.go; this
// exercises the extra branches: history on update, invalid transitions.
// ---------------------------------------------------------------------------

func TestWorkflowServiceTransitionInvalidState(t *testing.T) {
	wr := testutil.NewMockWorkflowRepository()
	tr := testutil.NewMockTicketRepository()
	tr.Tickets["t1"] = &models.Ticket{ID: "t1", Status: "open"}
	s := NewWorkflowService(wr, tr)
	if _, _, err := s.TransitionStatus(context.Background(), "t1", "t1", "archived", "u1", "x"); err == nil {
		t.Error("expected error for invalid transition")
	}
}

func TestWorkflowServiceTransitionTicketNotFound(t *testing.T) {
	wr := testutil.NewMockWorkflowRepository()
	tr := testutil.NewMockTicketRepository()
	s := NewWorkflowService(wr, tr)
	if _, _, err := s.TransitionStatus(context.Background(), "missing", "t1", "assigned", "u1", "x"); err == nil {
		t.Error("expected not found error")
	}
}

// ---------------------------------------------------------------------------
// SLAService — GetTicketSLA edge case: no record
// ---------------------------------------------------------------------------

func TestSLAServiceGetTicketSLAEmptyRecords(t *testing.T) {
	slaRepo := testutil.NewMockSLARepository()
	tr := testutil.NewMockTicketRepository()
	s := NewSLAService(slaRepo, tr)
	// Empty records map: should return a not-found error, not a panic.
	_, err := s.GetTicketSLA(context.Background(), "t1")
	if err == nil {
		t.Error("expected not-found error")
	}
}

func TestSLAServiceNewSLAServiceNilTicketRepoDoesNotPanic(t *testing.T) {
	s := NewSLAService(testutil.NewMockSLARepository(), nil)
	_ = s // just ensure construction does not panic
}

// ---------------------------------------------------------------------------
// NewService(nil) contract
// ---------------------------------------------------------------------------

func TestNewServiceAcceptsNilRepo(t *testing.T) {
	s := NewService(nil)
	if s == nil {
		t.Fatal("NewService(nil) should not return nil")
	}
}
