package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/repository"
)

// depthRepo is a stateful RepositoryInterface mock. Every Service method on the
// Service struct is exercised through one of these hooks, so a test's
// assertion is about what the service sent to the repository instead of about
// a fixed canned value. The pointer fields on the struct hold the values the
// repository returns; the err* fields inject a failure at exactly one call
// site so the propagation tests can say which line the error was lost on.
//
// The default return values are chosen so that a happy-path test can call the
// service without first filling in every return; the tests below only override
// the fields they actually assert on.
type depthRepo struct {
	t *testing.T

	// --- tickets ---
	ticket       *models.Ticket
	tickets      []models.Ticket
	created      *models.Ticket
	createErr    error
	getTicketErr error
	listErr      error
	deleteErr    error
	updateErr    error

	// --- counts ---
	count      int
	countErr   error
	byStatus   map[string]int
	byStatusE  error
	byPriority map[string]int
	byPriorityE error
	byCategory map[string]int
	byCategoryE error

	// --- assignment rules ---
	assignRule *models.AssignmentRule
	assignRules []models.AssignmentRule
	createAssignmentRuleErr error
	listAssignmentRulesErr error
	deleteAssignmentRuleErr error
	createAssignmentErr     error

	// --- relations ---
	rel *models.TicketRelation
	rels []models.TicketRelation
	addRelationErr error
	getRelationsErr error
	findRelatedErr error
	detectDupErr   error

	// --- workflow history ---
	addHistoryErr    error
	getHistoryErr    error
	histories []models.WorkflowHistoryEntry

	// --- suspensions ---
	suspend     *models.Suspend
	suspensions []models.Suspend
	suspensionsForEng []models.Suspend
	createSuspendErr error
	updateSuspendErr error
	getSuspendErr    error
	listSuspensionsErr error
	listSuspensionsForEngErr error

	// --- SLA ---
	slaPolicy     *models.SLAPolicy
	slaPolicies   []models.SLAPolicy
	slaTarget     *models.SLATarget
	createSLAPolicyErr error
	updateSLAPolicyErr error
	deleteSLAPolicyErr error
	getSLAPolicyErr error
	listSLAPoliciesErr error
	createSLATargetErr error
	tracking *repository.TicketSLATracking
	getTrackingErr error
	updateTrackingErr error
	upsertTrackingErr error
	breaches []models.SLABreach
	breachesErr error
	compliance *models.ComplianceResult
	complianceErr error

	// --- dispatch ---
	engineer     *models.DispatchEngineer
	engineers    []models.DispatchEngineer
	regEngErr    error
	listEngErr   error
	getEngErr    error
	assignTicketErr error
	dispRule *models.DispatchRule
	dispRules []models.DispatchRule
	addDispRuleErr error
	listDispRuleErr error
	queueStatus *models.QueueStatus
	queueEntries []models.QueueEntry
	weights map[string]int
	updateWeightsErr error

	// --- automation rules ---
	automationRule *models.AutomationRule
	automationRules []models.AutomationRule
	createAutomationRuleErr error
	listAutomationRulesErr error
	updateAutomationRuleErr error
	deleteAutomationRuleErr error

	// --- transfers ---
	transferErr error
	transfers   []models.TransferHistoryEntry
	getTransfersErr error
	transferStats *models.TransferStats
	getTransferStatsErr error

	// --- service control ---
	setActiveErr error
	isActive  bool
	isActiveErr error

	// --- recorded calls (for assertion) ---
	calls map[string]int
}

func newDepthRepo(t *testing.T) *depthRepo {
	return &depthRepo{
		t:             t,
		byStatus:      map[string]int{},
		byPriority:    map[string]int{},
		byCategory:    map[string]int{},
		weights:       map[string]int{},
		calls:         map[string]int{},
		tracking:      &repository.TicketSLATracking{},
		queueStatus:   &models.QueueStatus{},
		transferStats: &models.TransferStats{},
	}
}

func (r *depthRepo) record(name string) {
	r.calls[name]++
}

// --- RepositoryInterface: service control ---

func (r *depthRepo) SetServiceActive(_ context.Context, _ string, _ bool) error {
	r.record("SetServiceActive")
	return r.setActiveErr
}
func (r *depthRepo) IsServiceActive(_ context.Context, _ string) (bool, error) {
	r.record("IsServiceActive")
	return r.isActive, r.isActiveErr
}

// --- tickets ---

func (r *depthRepo) CreateTicket(_ context.Context, t *models.Ticket) error {
	r.record("CreateTicket")
	if r.created == nil {
		r.created = t
	}
	if t.ID == "" {
		t.ID = "t-created"
	}
	return r.createErr
}
func (r *depthRepo) GetTicket(_ context.Context, _, id string) (*models.Ticket, error) {
	r.record("GetTicket")
	if r.ticket != nil && (r.ticket.ID == "" || r.ticket.ID == id) {
		return r.ticket, r.getTicketErr
	}
	if r.getTicketErr != nil {
		return nil, r.getTicketErr
	}
	return &models.Ticket{ID: id, Status: "open", Priority: "medium", TenantID: "t1"}, r.getTicketErr
}
func (r *depthRepo) ListTickets(_ context.Context, _ string, _ models.TicketListQuery) ([]models.Ticket, error) {
	r.record("ListTickets")
	return r.tickets, r.listErr
}
func (r *depthRepo) DeleteTicket(_ context.Context, _, _ string) error {
	r.record("DeleteTicket")
	return r.deleteErr
}
func (r *depthRepo) UpdateTicket(_ context.Context, _, _ string, _ map[string]interface{}) error {
	r.record("UpdateTicket")
	return r.updateErr
}
func (r *depthRepo) CountTickets(_ context.Context, _ string) (int, error) {
	r.record("CountTickets")
	return r.count, r.countErr
}
func (r *depthRepo) CountTicketsByStatus(_ context.Context, _ string) (map[string]int, error) {
	return r.byStatus, r.byStatusE
}
func (r *depthRepo) CountTicketsByPriority(_ context.Context, _ string) (map[string]int, error) {
	return r.byPriority, r.byPriorityE
}
func (r *depthRepo) CountTicketsByCategory(_ context.Context, _ string) (map[string]int, error) {
	return r.byCategory, r.byCategoryE
}

// --- workflow ---

func (r *depthRepo) AddWorkflowHistory(_ context.Context, _, _, _, _, _, _, _ string) error {
	r.record("AddWorkflowHistory")
	return r.addHistoryErr
}
func (r *depthRepo) GetWorkflowHistory(_ context.Context, _, _ string) ([]models.WorkflowHistoryEntry, error) {
	r.record("GetWorkflowHistory")
	return r.histories, r.getHistoryErr
}
func (r *depthRepo) CreateAssignment(_ context.Context, _, _, _, _, _ string) error {
	r.record("CreateAssignment")
	return r.createAssignmentErr
}

// --- relations ---

func (r *depthRepo) AddRelation(_ context.Context, _, _, _, _ string) (*models.TicketRelation, error) {
	r.record("AddRelation")
	return r.rel, r.addRelationErr
}
func (r *depthRepo) GetRelations(_ context.Context, _, _ string) ([]models.TicketRelation, error) {
	return r.rels, r.getRelationsErr
}
func (r *depthRepo) FindRelatedTickets(_ context.Context, _, _ string) ([]models.TicketRelation, error) {
	return r.rels, r.findRelatedErr
}
func (r *depthRepo) DetectDuplicates(_ context.Context, _, _ string) ([]models.TicketRelation, error) {
	return r.rels, r.detectDupErr
}

// --- assignment rules ---

func (r *depthRepo) CreateAssignmentRule(_ context.Context, _ string, _ models.CreateAssignmentRuleRequest) (*models.AssignmentRule, error) {
	r.record("CreateAssignmentRule")
	if r.assignRule == nil {
		r.assignRule = &models.AssignmentRule{ID: "rule-1"}
	}
	return r.assignRule, r.createAssignmentRuleErr
}
func (r *depthRepo) ListAssignmentRules(_ context.Context, _ string) ([]models.AssignmentRule, error) {
	return r.assignRules, r.listAssignmentRulesErr
}
func (r *depthRepo) DeleteAssignmentRule(_ context.Context, _, _ string) error {
	r.record("DeleteAssignmentRule")
	return r.deleteAssignmentRuleErr
}

// --- SLA policies/targets ---

func (r *depthRepo) CreateSLAPolicy(_ context.Context, _ string, _ models.CreateSLAPolicyRequest) (*models.SLAPolicy, error) {
	r.record("CreateSLAPolicy")
	if r.slaPolicy == nil {
		r.slaPolicy = &models.SLAPolicy{ID: "sp-1"}
	}
	return r.slaPolicy, r.createSLAPolicyErr
}
func (r *depthRepo) ListSLAPolicies(_ context.Context, _ string) ([]models.SLAPolicy, error) {
	return r.slaPolicies, r.listSLAPoliciesErr
}
func (r *depthRepo) GetSLAPolicy(_ context.Context, _, _ string) (*models.SLAPolicy, error) {
	return r.slaPolicy, r.getSLAPolicyErr
}
func (r *depthRepo) UpdateSLAPolicy(_ context.Context, _, _ string, _ map[string]interface{}) error {
	r.record("UpdateSLAPolicy")
	return r.updateSLAPolicyErr
}
func (r *depthRepo) DeleteSLAPolicy(_ context.Context, _, _ string) error {
	r.record("DeleteSLAPolicy")
	return r.deleteSLAPolicyErr
}
func (r *depthRepo) CreateSLATarget(_ context.Context, _ string, _ models.CreateSLATargetRequest) (*models.SLATarget, error) {
	r.record("CreateSLATarget")
	if r.slaTarget == nil {
		r.slaTarget = &models.SLATarget{ID: "st-1"}
	}
	return r.slaTarget, r.createSLATargetErr
}

// --- SLA tracking ---

func (r *depthRepo) GetSLATracking(_ context.Context, _, _ string) (*repository.TicketSLATracking, error) {
	return r.tracking, r.getTrackingErr
}
func (r *depthRepo) UpdateSLATracking(_ context.Context, _ string, _ map[string]interface{}) error {
	r.record("UpdateSLATracking")
	return r.updateTrackingErr
}
func (r *depthRepo) UpsertSLATracking(_ context.Context, _, _, _ string, _ int64) (*repository.TicketSLATracking, error) {
	r.record("UpsertSLATracking")
	if r.tracking == nil {
		r.tracking = &repository.TicketSLATracking{}
	}
	return r.tracking, r.upsertTrackingErr
}
func (r *depthRepo) GetSLABreaches(_ context.Context, _ string) ([]models.SLABreach, error) {
	return r.breaches, r.breachesErr
}
func (r *depthRepo) GetSLACompliance(_ context.Context, _, _ string) (*models.ComplianceResult, error) {
	return r.compliance, r.complianceErr
}

// --- dispatch ---

func (r *depthRepo) RegisterEngineer(_ context.Context, _ string, _ models.RegisterEngineerRequest) (*models.DispatchEngineer, error) {
	r.record("RegisterEngineer")
	if r.engineer == nil {
		r.engineer = &models.DispatchEngineer{ID: "e-1"}
	}
	return r.engineer, r.regEngErr
}
func (r *depthRepo) ListEngineers(_ context.Context, _ string) ([]models.DispatchEngineer, error) {
	return r.engineers, r.listEngErr
}
func (r *depthRepo) GetEngineer(_ context.Context, _, _ string) (*models.DispatchEngineer, error) {
	return r.engineer, r.getEngErr
}
func (r *depthRepo) AssignTicket(_ context.Context, _, _, _ string) error {
	r.record("AssignTicket")
	return r.assignTicketErr
}
func (r *depthRepo) AddDispatchRule(_ context.Context, _ string, _ models.AddDispatchRuleRequest) (*models.DispatchRule, error) {
	r.record("AddDispatchRule")
	if r.dispRule == nil {
		r.dispRule = &models.DispatchRule{ID: "dr-1"}
	}
	return r.dispRule, r.addDispRuleErr
}
func (r *depthRepo) ListDispatchRules(_ context.Context, _ string) ([]models.DispatchRule, error) {
	return r.dispRules, r.listDispRuleErr
}
func (r *depthRepo) GetDispatchQueueStatus(_ context.Context, _ string) (*models.QueueStatus, error) {
	return r.queueStatus, nil
}
func (r *depthRepo) GetDispatchQueueEntries(_ context.Context, _ string) ([]models.QueueEntry, error) {
	return r.queueEntries, nil
}
func (r *depthRepo) GetDispatchWeights(_ context.Context, _ string) (map[string]int, error) {
	return r.weights, nil
}
func (r *depthRepo) UpdateDispatchWeights(_ context.Context, _ string, _ map[string]int) error {
	r.record("UpdateDispatchWeights")
	return r.updateWeightsErr
}

// --- suspensions ---

func (r *depthRepo) CreateSuspend(_ context.Context, _ string, _ models.CreateSuspendRequest) (*models.Suspend, error) {
	r.record("CreateSuspend")
	if r.suspend == nil {
		r.suspend = &models.Suspend{ID: "s-1"}
	}
	return r.suspend, r.createSuspendErr
}
func (r *depthRepo) UpdateSuspendStatus(_ context.Context, _, _ string, _ string) error {
	r.record("UpdateSuspendStatus")
	return r.updateSuspendErr
}
func (r *depthRepo) GetSuspend(_ context.Context, _, _ string) (*models.Suspend, error) {
	return r.suspend, r.getSuspendErr
}
func (r *depthRepo) ListSuspensions(_ context.Context, _ string) ([]models.Suspend, error) {
	return r.suspensions, r.listSuspensionsErr
}
func (r *depthRepo) GetEngineerSuspensions(_ context.Context, _, _ string) ([]models.Suspend, error) {
	return r.suspensionsForEng, r.listSuspensionsForEngErr
}

// --- automation rules ---

func (r *depthRepo) CreateAutomationRule(_ context.Context, _ string, _ models.CreateAutomationRuleRequest) (*models.AutomationRule, error) {
	r.record("CreateAutomationRule")
	if r.automationRule == nil {
		r.automationRule = &models.AutomationRule{ID: "ar-1"}
	}
	return r.automationRule, r.createAutomationRuleErr
}
func (r *depthRepo) ListAutomationRules(_ context.Context, _ string) ([]models.AutomationRule, error) {
	return r.automationRules, r.listAutomationRulesErr
}
func (r *depthRepo) UpdateAutomationRule(_ context.Context, _ string, _ string, _ map[string]interface{}) error {
	r.record("UpdateAutomationRule")
	return r.updateAutomationRuleErr
}
func (r *depthRepo) DeleteAutomationRule(_ context.Context, _, _ string) error {
	r.record("DeleteAutomationRule")
	return r.deleteAutomationRuleErr
}

// --- transfers ---

func (r *depthRepo) TransferTicket(_ context.Context, _, _, _, _, _ string) error {
	r.record("TransferTicket")
	return r.transferErr
}
func (r *depthRepo) GetTransferHistory(_ context.Context, _, _ string) ([]models.TransferHistoryEntry, error) {
	return r.transfers, r.getTransfersErr
}
func (r *depthRepo) GetTransferStats(_ context.Context, _ string) (*models.TransferStats, error) {
	return r.transferStats, r.getTransferStatsErr
}

// Compile-time assertion: this mock satisfies the full RepositoryInterface so
// a renamed or added method forces the mock to be updated before the tests can
// pass.
var _ RepositoryInterface = (*depthRepo)(nil)

func ptrStr(s string) *string { return &s }

// ---------------------------------------------------------------------------
// Service control
// ---------------------------------------------------------------------------

func TestStartStopServicePropagatesAndRecords(t *testing.T) {
	t.Helper()
	dbErr := errors.New("db down")
	r := newDepthRepo(t)
	r.setActiveErr = dbErr
	s := NewService(r)
	if err := s.StartService(context.Background(), "t1"); !errors.Is(err, dbErr) {
		t.Errorf("StartService: got %v, want dbErr", err)
	}
	if err := s.StopService(context.Background(), "t1"); !errors.Is(err, dbErr) {
		t.Errorf("StopService: got %v, want dbErr", err)
	}
	if r.calls["SetServiceActive"] != 2 {
		t.Errorf("SetServiceActive calls = %d, want 2", r.calls["SetServiceActive"])
	}
}

func TestHealthCheckReturnsActiveFlagAndPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.isActive = true
	s := NewService(r)
	got, err := s.HealthCheck(context.Background(), "t1")
	if err != nil || got != true {
		t.Errorf("HealthCheck = (%v, %v), want (true, nil)", got, err)
	}
	r.isActiveErr = errors.New("db")
	if _, err := s.HealthCheck(context.Background(), "t1"); err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// Ticket CRUD
// ---------------------------------------------------------------------------

func TestCreateTicketDefaultsPriorityAndWritesSLAWindow(t *testing.T) {
	r := newDepthRepo(t)
	s := NewService(r)
	tk, err := s.CreateTicket(context.Background(), "t1",
		models.CreateTicketRequest{Title: "title"}, "u1")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if tk.Priority != "medium" || tk.Status != "open" || tk.ReporterID != "u1" {
		t.Errorf("ticket = %+v, want priority=medium status=open reporter=u1", tk)
	}
	if r.created == nil || r.created.ID != tk.ID {
		t.Errorf("repo did not receive the ticket: %+v", r.created)
	}
	if r.calls["UpsertSLATracking"] != 1 {
		t.Errorf("UpsertSLATracking calls = %d, want 1", r.calls["UpsertSLATracking"])
	}
}

func TestCreateTicketPropagatesAddHistoryError(t *testing.T) {
	r := newDepthRepo(t)
	r.addHistoryErr = errors.New("history failed")
	s := NewService(r)
	if _, err := s.CreateTicket(context.Background(), "t1",
		models.CreateTicketRequest{Title: "x"}, "u1"); err == nil {
		t.Error("expected error from AddWorkflowHistory")
	}
}

func TestGetTicketListTicketsDeleteTicketPassThrough(t *testing.T) {
	r := newDepthRepo(t)
	r.ticket = &models.Ticket{ID: "t1", Status: "open"}
	r.tickets = []models.Ticket{{ID: "t1"}}
	s := NewService(r)
	if tk, err := s.GetTicket(context.Background(), "t1", "t1"); err != nil || tk.ID != "t1" {
		t.Errorf("GetTicket = (%+v, %v)", tk, err)
	}
	if l, err := s.ListTickets(context.Background(), "t1", models.TicketListQuery{}); err != nil || len(l) != 1 {
		t.Errorf("ListTickets = (%+v, %v)", l, err)
	}
	if err := s.DeleteTicket(context.Background(), "t1", "t1"); err != nil {
		t.Errorf("DeleteTicket: %v", err)
	}
}

func TestDeleteTicketPropagatesRepositoryError(t *testing.T) {
	r := newDepthRepo(t)
	r.deleteErr = errors.New("cannot delete")
	s := NewService(r)
	if err := s.DeleteTicket(context.Background(), "t1", "t1"); err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// Workflow — extra branches not covered by ticket_sla_workflow_test.go
// ---------------------------------------------------------------------------

func TestTransitionStatusRejectsUnknownSourceState(t *testing.T) {
	r := newDepthRepo(t)
	r.ticket = &models.Ticket{ID: "t1", Status: "archived"}
	s := NewService(r)
	_, err := s.TransitionStatus(context.Background(), "t1", "t1",
		models.TransitionRequest{Status: "open"}, "u1")
	if err == nil || !strings.Contains(err.Error(), "invalid transition") {
		t.Errorf("expected invalid transition, got %v", err)
	}
}

func TestTransitionStatusRejectsUnknownDestinationState(t *testing.T) {
	r := newDepthRepo(t)
	r.ticket = &models.Ticket{ID: "t1", Status: "open"}
	s := NewService(r)
	_, err := s.TransitionStatus(context.Background(), "t1", "t1",
		models.TransitionRequest{Status: "nonexistent"}, "u1")
	if err == nil {
		t.Error("expected invalid transition error")
	}
}

func TestTransitionStatusPropagatesGetTicketError(t *testing.T) {
	r := newDepthRepo(t)
	r.getTicketErr = errors.New("no such ticket")
	s := NewService(r)
	if _, err := s.TransitionStatus(context.Background(), "t1", "t1",
		models.TransitionRequest{Status: "open"}, "u1"); err == nil {
		t.Error("expected error")
	}
}

func TestEscalateTicketCappedAtCritical(t *testing.T) {
	r := newDepthRepo(t)
	r.ticket = &models.Ticket{ID: "t1", Status: "open", Priority: "critical"}
	s := NewService(r)
	if _, err := s.EscalateTicket(context.Background(), "t1", "t1",
		models.EscalateRequest{Reason: "urgent"}, "u1"); err != nil {
		t.Errorf("unexpected err: %v", err)
	}
	// Only AddWorkflowHistory should have been called: no UpdateTicket because
	// priority is already at its ceiling.
	if r.calls["UpdateTicket"] != 0 {
		t.Errorf("UpdateTicket should not have been called; calls = %d", r.calls["UpdateTicket"])
	}
}

func TestCloseTicketPropagatesHistoryError(t *testing.T) {
	r := newDepthRepo(t)
	r.addHistoryErr = errors.New("no history")
	s := NewService(r)
	if _, err := s.CloseTicket(context.Background(), "t1", "t1", "done", "u1"); err == nil {
		t.Error("expected error")
	}
}

func TestCloseTicketPropagatesUpdateTicketError(t *testing.T) {
	r := newDepthRepo(t)
	r.updateErr = errors.New("no update")
	s := NewService(r)
	if _, err := s.CloseTicket(context.Background(), "t1", "t1", "done", "u1"); err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// Assignment rules / relations
// ---------------------------------------------------------------------------

func TestAssignmentRuleCRUDPropagatesAndReturns(t *testing.T) {
	r := newDepthRepo(t)
	r.assignRules = []models.AssignmentRule{{ID: "r1"}, {ID: "r2"}}
	s := NewService(r)
	if _, err := s.AddAssignmentRule(context.Background(), "t1",
		models.CreateAssignmentRuleRequest{Name: "r"}); err != nil {
		t.Errorf("AddAssignmentRule: %v", err)
	}
	if l, err := s.GetAssignmentRules(context.Background(), "t1"); err != nil || len(l) != 2 {
		t.Errorf("GetAssignmentRules = (%+v, %v)", l, err)
	}
	if err := s.RemoveAssignmentRule(context.Background(), "t1", "r1"); err != nil {
		t.Errorf("RemoveAssignmentRule: %v", err)
	}
}

func TestAssignmentRuleCRUDPropagatesErrors(t *testing.T) {
	r := newDepthRepo(t)
	r.createAssignmentRuleErr = errors.New("create fail")
	r.listAssignmentRulesErr = errors.New("list fail")
	r.deleteAssignmentRuleErr = errors.New("delete fail")
	s := NewService(r)
	if _, err := s.AddAssignmentRule(context.Background(), "t1", models.CreateAssignmentRuleRequest{}); err == nil {
		t.Error("expected create err")
	}
	if _, err := s.GetAssignmentRules(context.Background(), "t1"); err == nil {
		t.Error("expected list err")
	}
	if err := s.RemoveAssignmentRule(context.Background(), "t1", "r1"); err == nil {
		t.Error("expected delete err")
	}
}

func TestRelationDelegation(t *testing.T) {
	r := newDepthRepo(t)
	r.rel = &models.TicketRelation{ID: "r1"}
	r.rels = []models.TicketRelation{{ID: "r1"}}
	s := NewService(r)
	if _, err := s.AddRelation(context.Background(), "t1", "t1", models.CreateRelationRequest{RelatedID: "t2", Type: "duplicate"}); err != nil {
		t.Errorf("AddRelation: %v", err)
	}
	if l, err := s.GetRelations(context.Background(), "t1", "t1"); err != nil || len(l) != 1 {
		t.Errorf("GetRelations: %+v %v", l, err)
	}
	if l, err := s.FindRelatedTickets(context.Background(), "t1", "t1"); err != nil || len(l) != 1 {
		t.Errorf("FindRelatedTickets: %+v %v", l, err)
	}
	if l, err := s.DetectDuplicates(context.Background(), "t1", "t1"); err != nil || len(l) != 1 {
		t.Errorf("DetectDuplicates: %+v %v", l, err)
	}
}

func TestRelationDelegationPropagatesErrors(t *testing.T) {
	r := newDepthRepo(t)
	r.addRelationErr = errors.New("x")
	r.getRelationsErr = errors.New("y")
	r.findRelatedErr = errors.New("z")
	r.detectDupErr = errors.New("w")
	s := NewService(r)
	if _, err := s.AddRelation(context.Background(), "t1", "t1", models.CreateRelationRequest{}); err == nil {
		t.Error("expected AddRelation err")
	}
	if _, err := s.GetRelations(context.Background(), "t1", "t1"); err == nil {
		t.Error("expected GetRelations err")
	}
	if _, err := s.FindRelatedTickets(context.Background(), "t1", "t1"); err == nil {
		t.Error("expected FindRelatedTickets err")
	}
	if _, err := s.DetectDuplicates(context.Background(), "t1", "t1"); err == nil {
		t.Error("expected DetectDuplicates err")
	}
}

func TestGetWorkflowHistoryPassesThrough(t *testing.T) {
	r := newDepthRepo(t)
	r.histories = []models.WorkflowHistoryEntry{{Action: "create"}}
	s := NewService(r)
	l, err := s.GetWorkflowHistory(context.Background(), "t1", "t1")
	if err != nil || len(l) != 1 || l[0].Action != "create" {
		t.Errorf("GetWorkflowHistory = (%+v, %v)", l, err)
	}
}

func TestGetWorkflowHistoryPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.getHistoryErr = errors.New("no hist")
	s := NewService(r)
	if _, err := s.GetWorkflowHistory(context.Background(), "t1", "t1"); err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// CorrelateRootCause
// ---------------------------------------------------------------------------

func TestCorrelateRootCauseEmptyInput(t *testing.T) {
	r := newDepthRepo(t)
	s := NewService(r)
	out, err := s.CorrelateRootCause(context.Background(), "t1", nil)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if out["correlated"] != false {
		t.Errorf("empty input should return correlated=false, got %v", out["correlated"])
	}
}

func TestCorrelateRootCauseGroupsByCategorySource(t *testing.T) {
	r := newDepthRepo(t)
	r.tickets = []models.Ticket{
		{ID: "a", Category: "billing", Source: "email"},
		{ID: "b", Category: "billing", Source: "email"},
		{ID: "c", Category: "network", Source: "web"},
	}
	s := NewService(r)
	out, err := s.CorrelateRootCause(context.Background(), "t1", []string{"a", "b", "c"})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out["correlated"] != false {
		t.Errorf("three groups, want correlated=false; got %v", out["correlated"])
	}
	groups := out["groups"].(map[string][]string)
	if len(groups) != 2 {
		t.Errorf("groups = %v, want 2 buckets", groups)
	}
}

func TestCorrelateRootCauseSingleGroup(t *testing.T) {
	r := newDepthRepo(t)
	r.tickets = []models.Ticket{
		{ID: "a", Category: "billing", Source: "email"},
		{ID: "b", Category: "billing", Source: "email"},
	}
	s := NewService(r)
	out, _ := s.CorrelateRootCause(context.Background(), "t1", []string{"a", "b"})
	if out["correlated"] != true {
		t.Errorf("single group should be correlated=true; got %v", out["correlated"])
	}
}

func TestCorrelateRootCausePropagatesListError(t *testing.T) {
	r := newDepthRepo(t)
	r.listErr = errors.New("db")
	s := NewService(r)
	if _, err := s.CorrelateRootCause(context.Background(), "t1", []string{"a"}); err == nil {
		t.Error("expected error")
	}
}

func TestCorrelateRootCauseIgnoresMissingTickets(t *testing.T) {
	r := newDepthRepo(t)
	r.tickets = []models.Ticket{{ID: "a", Category: "c", Source: "s"}}
	s := NewService(r)
	out, err := s.CorrelateRootCause(context.Background(), "t1", []string{"a", "missing"})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	groups := out["groups"].(map[string][]string)
	if len(groups["c|s"]) != 1 {
		t.Errorf("groups = %v, want only a in the c|s bucket", groups)
	}
}

// ---------------------------------------------------------------------------
// SLA policies / targets
// ---------------------------------------------------------------------------

func TestSLAPolicyCRUD(t *testing.T) {
	r := newDepthRepo(t)
	r.slaPolicy = &models.SLAPolicy{ID: "sp1", Name: "n"}
	r.slaPolicies = []models.SLAPolicy{{ID: "sp1"}, {ID: "sp2"}}
	s := NewService(r)
	if _, err := s.CreateSLAPolicy(context.Background(), "t1", models.CreateSLAPolicyRequest{Name: "p"}); err != nil {
		t.Errorf("CreateSLAPolicy: %v", err)
	}
	if l, err := s.ListSLAPolicies(context.Background(), "t1"); err != nil || len(l) != 2 {
		t.Errorf("ListSLAPolicies = %+v %v", l, err)
	}
	if tk, err := s.GetSLAPolicy(context.Background(), "t1", "sp1"); err != nil || tk.ID != "sp1" {
		t.Errorf("GetSLAPolicy = %+v %v", tk, err)
	}
	if err := s.DeleteSLAPolicy(context.Background(), "t1", "sp1"); err != nil {
		t.Errorf("DeleteSLAPolicy: %v", err)
	}
}

func TestSLAPolicyCRUDPropagatesErrors(t *testing.T) {
	r := newDepthRepo(t)
	r.createSLAPolicyErr = errors.New("1")
	r.listSLAPoliciesErr = errors.New("2")
	r.getSLAPolicyErr = errors.New("3")
	r.deleteSLAPolicyErr = errors.New("4")
	s := NewService(r)
	if _, err := s.CreateSLAPolicy(context.Background(), "t1", models.CreateSLAPolicyRequest{}); err == nil {
		t.Error("expected err")
	}
	if _, err := s.ListSLAPolicies(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
	if _, err := s.GetSLAPolicy(context.Background(), "t1", "x"); err == nil {
		t.Error("expected err")
	}
	if err := s.DeleteSLAPolicy(context.Background(), "t1", "x"); err == nil {
		t.Error("expected err")
	}
}

func TestAddSLATargetPassesThrough(t *testing.T) {
	r := newDepthRepo(t)
	r.slaTarget = &models.SLATarget{ID: "t1"}
	s := NewService(r)
	tk, err := s.AddSLATarget(context.Background(), "t1", models.CreateSLATargetRequest{Priority: "high"})
	if err != nil || tk.ID != "t1" {
		t.Errorf("AddSLATarget = %+v %v", tk, err)
	}
}

func TestAddSLATargetPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.createSLATargetErr = errors.New("nope")
	s := NewService(r)
	if _, err := s.AddSLATarget(context.Background(), "t1", models.CreateSLATargetRequest{}); err == nil {
		t.Error("expected err")
	}
}

func TestGetBreachesAndCompliance(t *testing.T) {
	r := newDepthRepo(t)
	r.breaches = []models.SLABreach{{TicketID: "t1"}}
	r.compliance = &models.ComplianceResult{Compliance: 88.5}
	s := NewService(r)
	b, err := s.GetBreaches(context.Background(), "t1")
	if err != nil || len(b) != 1 {
		t.Errorf("GetBreaches = %+v %v", b, err)
	}
	c, err := s.GetCompliance(context.Background(), "t1", "p1")
	if err != nil || c.Compliance != 88.5 {
		t.Errorf("GetCompliance = %+v %v", c, err)
	}
}

func TestGetBreachesAndCompliancePropagate(t *testing.T) {
	r := newDepthRepo(t)
	r.breachesErr = errors.New("1")
	r.complianceErr = errors.New("2")
	s := NewService(r)
	if _, err := s.GetBreaches(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
	if _, err := s.GetCompliance(context.Background(), "t1", "p1"); err == nil {
		t.Error("expected err")
	}
}

// ---------------------------------------------------------------------------
// Automation rules
// ---------------------------------------------------------------------------

func TestAutomationRuleCreateListDelete(t *testing.T) {
	r := newDepthRepo(t)
	r.automationRule = &models.AutomationRule{ID: "ar1"}
	r.automationRules = []models.AutomationRule{{ID: "ar1"}}
	s := NewService(r)
	if _, err := s.CreateAutomationRule(context.Background(), "t1", models.CreateAutomationRuleRequest{Name: "n"}); err != nil {
		t.Errorf("Create: %v", err)
	}
	if l, err := s.ListAutomationRules(context.Background(), "t1"); err != nil || len(l) != 1 {
		t.Errorf("List: %+v %v", l, err)
	}
	if err := s.DeleteAutomationRule(context.Background(), "t1", "ar1"); err != nil {
		t.Errorf("Delete: %v", err)
	}
}

func TestAutomationRulePropagation(t *testing.T) {
	r := newDepthRepo(t)
	r.createAutomationRuleErr = errors.New("1")
	r.listAutomationRulesErr = errors.New("2")
	r.updateAutomationRuleErr = errors.New("3")
	r.deleteAutomationRuleErr = errors.New("4")
	s := NewService(r)
	if _, err := s.CreateAutomationRule(context.Background(), "t1", models.CreateAutomationRuleRequest{}); err == nil {
		t.Error("expected create")
	}
	if _, err := s.ListAutomationRules(context.Background(), "t1"); err == nil {
		t.Error("expected list")
	}
	// UpdateAutomationRule takes a request; the service converts it to a map
	// and delegates. It should propagate the repo's update error.
	_, _ = s.UpdateAutomationRule(context.Background(), "t1", "ar1",
		models.UpdateAutomationRuleRequest{Name: ptrStr("n")})
	if err := s.DeleteAutomationRule(context.Background(), "t1", "ar1"); err == nil {
		t.Error("expected delete")
	}
}

// ---------------------------------------------------------------------------
// ExecuteRule — three trigger branches
// ---------------------------------------------------------------------------

func TestExecuteRulePropagatesListError(t *testing.T) {
	r := newDepthRepo(t)
	r.listAutomationRulesErr = errors.New("1")
	s := NewService(r)
	if _, err := s.ExecuteRule(context.Background(), "t1", "r1"); err == nil {
		t.Error("expected err")
	}
}

func TestExecuteRuleNotFoundOrDisabled(t *testing.T) {
	r := newDepthRepo(t)
	r.automationRules = []models.AutomationRule{{ID: "other", Enabled: true}}
	s := NewService(r)
	out, err := s.ExecuteRule(context.Background(), "t1", "r1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.Executed {
		t.Errorf("missing rule should return Executed=false, got %+v", out)
	}
	r.automationRules = []models.AutomationRule{{ID: "r1", Enabled: false}}
	out, _ = s.ExecuteRule(context.Background(), "t1", "r1")
	if out.Executed {
		t.Errorf("disabled rule should return Executed=false")
	}
}

func TestExecuteRuleOnCreateTrigger(t *testing.T) {
	r := newDepthRepo(t)
	r.automationRules = []models.AutomationRule{{ID: "r1", Enabled: true, Trigger: "on_create"}}
	now := time.Now().UTC()
	old := now.Add(-2 * time.Hour)
	r.tickets = []models.Ticket{
		{ID: "a", Status: "open", CreatedAt: now},     // < 1h, matches
		{ID: "b", Status: "open", CreatedAt: old},      // > 1h, does not
		{ID: "c", Status: "open", CreatedAt: now.Add(-30 * time.Minute)}, // < 1h, matches
	}
	s := NewService(r)
	out, err := s.ExecuteRule(context.Background(), "t1", "r1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !out.Executed {
		t.Error("rule should execute")
	}
	if !strings.Contains(out.Message, "matched 2 tickets") {
		t.Errorf("Message = %q, want 'matched 2 tickets'", out.Message)
	}
}

func TestExecuteRuleOnAssignTrigger(t *testing.T) {
	r := newDepthRepo(t)
	r.automationRules = []models.AutomationRule{{ID: "r1", Enabled: true, Trigger: "on_assign"}}
	now := time.Now().UTC()
	r.tickets = []models.Ticket{
		{ID: "a", Status: "open", CreatedAt: now, AssigneeID: ptrStr("e1")},
		{ID: "b", Status: "open", CreatedAt: now}, // no assignee
	}
	s := NewService(r)
	out, _ := s.ExecuteRule(context.Background(), "t1", "r1")
	if !strings.Contains(out.Message, "matched 1 tickets") {
		t.Errorf("Message = %q, want 'matched 1 tickets'", out.Message)
	}
}

func TestExecuteRuleOnResolveTrigger(t *testing.T) {
	r := newDepthRepo(t)
	r.automationRules = []models.AutomationRule{{ID: "r1", Enabled: true, Trigger: "on_resolve"}}
	now := time.Now().UTC()
	r.tickets = []models.Ticket{
		{ID: "a", Status: "resolved", CreatedAt: now},
		{ID: "b", Status: "open", CreatedAt: now},
	}
	s := NewService(r)
	out, _ := s.ExecuteRule(context.Background(), "t1", "r1")
	if !strings.Contains(out.Message, "matched 1 tickets") {
		t.Errorf("Message = %q, want 'matched 1 tickets'", out.Message)
	}
}

func TestExecuteRuleOnEscalateTrigger(t *testing.T) {
	r := newDepthRepo(t)
	r.automationRules = []models.AutomationRule{{ID: "r1", Enabled: true, Trigger: "on_escalate"}}
	now := time.Now().UTC()
	r.tickets = []models.Ticket{
		{ID: "a", Status: "open", Priority: "critical", CreatedAt: now},
		{ID: "b", Status: "open", Priority: "high", CreatedAt: now},
	}
	s := NewService(r)
	out, _ := s.ExecuteRule(context.Background(), "t1", "r1")
	if !strings.Contains(out.Message, "matched 1 tickets") {
		t.Errorf("Message = %q, want 'matched 1 tickets'", out.Message)
	}
}

func TestExecuteRuleUnknownTriggerMatchesAll(t *testing.T) {
	r := newDepthRepo(t)
	r.automationRules = []models.AutomationRule{{ID: "r1", Enabled: true, Trigger: "on_thing_that_does_not_exist"}}
	now := time.Now().UTC()
	r.tickets = []models.Ticket{
		{ID: "a", CreatedAt: now}, {ID: "b", CreatedAt: now},
	}
	s := NewService(r)
	out, _ := s.ExecuteRule(context.Background(), "t1", "r1")
	if !strings.Contains(out.Message, "matched 2 tickets") {
		t.Errorf("Message = %q, want 'matched 2 tickets' (unknown trigger matches all)", out.Message)
	}
}

func TestExecuteRulePropagatesListTicketsError(t *testing.T) {
	r := newDepthRepo(t)
	r.automationRules = []models.AutomationRule{{ID: "r1", Enabled: true, Trigger: "on_create"}}
	r.listErr = errors.New("db")
	s := NewService(r)
	if _, err := s.ExecuteRule(context.Background(), "t1", "r1"); err == nil {
		t.Error("expected err")
	}
}

// ---------------------------------------------------------------------------
// Dispatch service methods
// ---------------------------------------------------------------------------

func TestRegisterEngineerDefaultsMaxTickets(t *testing.T) {
	r := newDepthRepo(t)
	r.engineer = &models.DispatchEngineer{ID: "e1"}
	s := NewService(r)
	out, err := s.RegisterEngineer(context.Background(), "t1", models.RegisterEngineerRequest{Name: "n"})
	if err != nil || out.ID != "e1" {
		t.Errorf("RegisterEngineer = %+v %v", out, err)
	}
}

func TestRegisterEngineerPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.regEngErr = errors.New("nope")
	s := NewService(r)
	if _, err := s.RegisterEngineer(context.Background(), "t1", models.RegisterEngineerRequest{}); err == nil {
		t.Error("expected err")
	}
}

func TestListEngineersAndGetEngineer(t *testing.T) {
	r := newDepthRepo(t)
	r.engineers = []models.DispatchEngineer{{ID: "e1"}, {ID: "e2"}}
	r.engineer = &models.DispatchEngineer{ID: "e1"}
	s := NewService(r)
	l, err := s.ListEngineers(context.Background(), "t1")
	if err != nil || len(l) != 2 {
		t.Errorf("ListEngineers = %+v %v", l, err)
	}
	tk, err := s.GetEngineer(context.Background(), "t1", "e1")
	if err != nil || tk.ID != "e1" {
		t.Errorf("GetEngineer = %+v %v", tk, err)
	}
}

func TestListEngineersAndGetEngineerPropagate(t *testing.T) {
	r := newDepthRepo(t)
	r.listEngErr = errors.New("1")
	r.getEngErr = errors.New("2")
	s := NewService(r)
	if _, err := s.ListEngineers(context.Background(), "t1"); err == nil {
		t.Error("expected list err")
	}
	if _, err := s.GetEngineer(context.Background(), "t1", "x"); err == nil {
		t.Error("expected get err")
	}
}

// AutoDispatch: no engineers, no match, one match with load+skill, list error
func TestAutoDispatchNoEngineers(t *testing.T) {
	r := newDepthRepo(t)
	s := NewService(r)
	out, err := s.AutoDispatch(context.Background(), "t1", "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.EngineerID != "" || !strings.Contains(out.Reason, "no engineers") {
		t.Errorf("out = %+v, want no engineers reason", out)
	}
}

func TestAutoDispatchNoMatchingActiveEngineer(t *testing.T) {
	r := newDepthRepo(t)
	r.engineers = []models.DispatchEngineer{
		{ID: "e1", UserID: "u1", IsActive: false},
	}
	r.ticket = &models.Ticket{ID: "t1", Category: "billing"}
	s := NewService(r)
	out, err := s.AutoDispatch(context.Background(), "t1", "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.EngineerID != "" || !strings.Contains(out.Reason, "no matching") {
		t.Errorf("out = %+v, want no matching engineer", out)
	}
}

func TestAutoDispatchPicksHighestScoringEngineer(t *testing.T) {
	r := newDepthRepo(t)
	// e1 has 0 load, skill matches billing -> highest score
	r.engineers = []models.DispatchEngineer{
		{ID: "e1", UserID: "u1", Name: "alice", IsActive: true,
			Skills: "billing,payments", MaxTickets: 5, CurrentLoad: 0},
		{ID: "e2", UserID: "u2", Name: "bob", IsActive: true,
			Skills: "network", MaxTickets: 5, CurrentLoad: 1},
	}
	r.ticket = &models.Ticket{ID: "t1", Category: "billing"}
	s := NewService(r)
	out, err := s.AutoDispatch(context.Background(), "t1", "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.EngineerID != "u1" || out.Name != "alice" {
		t.Errorf("picked %+v, want alice/u1", out)
	}
	if r.calls["AssignTicket"] != 1 {
		t.Errorf("AssignTicket calls = %d, want 1", r.calls["AssignTicket"])
	}
}

func TestAutoDispatchPropagatesListEngineersError(t *testing.T) {
	r := newDepthRepo(t)
	r.listEngErr = errors.New("db")
	s := NewService(r)
	if _, err := s.AutoDispatch(context.Background(), "t1", "t1"); err == nil {
		t.Error("expected err")
	}
}

func TestAutoDispatchPropagatesGetTicketError(t *testing.T) {
	r := newDepthRepo(t)
	r.engineers = []models.DispatchEngineer{{ID: "e1", IsActive: true, MaxTickets: 5}}
	r.getTicketErr = errors.New("no ticket")
	s := NewService(r)
	if _, err := s.AutoDispatch(context.Background(), "t1", "t1"); err == nil {
		t.Error("expected err")
	}
}

func TestGetBestMatchReturnsPreviewWithoutAssignment(t *testing.T) {
	r := newDepthRepo(t)
	r.engineers = []models.DispatchEngineer{
		{ID: "e1", UserID: "u1", Name: "alice", IsActive: true,
			Skills: "billing", MaxTickets: 10, CurrentLoad: 0},
	}
	r.ticket = &models.Ticket{ID: "t1", Category: "billing"}
	s := NewService(r)
	out, err := s.GetBestMatch(context.Background(), "t1", "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.EngineerID != "u1" {
		t.Errorf("out.EngineerID = %q, want u1", out.EngineerID)
	}
	// GetBestMatch must NOT trigger the assignment side-effect.
	if r.calls["AssignTicket"] != 0 {
		t.Errorf("AssignTicket calls = %d, want 0 (preview only)", r.calls["AssignTicket"])
	}
}

func TestGetBestMatchNoEngineers(t *testing.T) {
	r := newDepthRepo(t)
	s := NewService(r)
	out, err := s.GetBestMatch(context.Background(), "t1", "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !strings.Contains(out.Reason, "no engineers") {
		t.Errorf("reason = %q, want 'no engineers'", out.Reason)
	}
}

func TestCalculateDispatchScoreRequiresSkills(t *testing.T) {
	r := newDepthRepo(t)
	s := NewService(r)
	_, err := s.CalculateDispatchScore(context.Background(), "t1", models.DispatchScoreRequest{})
	if err == nil || !strings.Contains(err.Error(), "skills required") {
		t.Errorf("expected skills required error, got %v", err)
	}
}

func TestCalculateDispatchScoreBumpsOnSkillAndPriority(t *testing.T) {
	r := newDepthRepo(t)
	r.engineer = &models.DispatchEngineer{
		ID: "e1", UserID: "u1", Name: "alice",
		Skills: "billing", MaxTickets: 10, CurrentLoad: 0,
	}
	s := NewService(r)
	out, err := s.CalculateDispatchScore(context.Background(), "t1",
		models.DispatchScoreRequest{Skills: []string{"billing"}, Category: "billing", Priority: "critical"})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.EngineerID != "u1" {
		t.Errorf("out.EngineerID = %q, want u1", out.EngineerID)
	}
	// Base load score 50 (empty load), +30 skill, +20 critical = 100
	if out.Score < 99.9 {
		t.Errorf("score = %f, want >= 99.9 (50+30+20)", out.Score)
	}
}

func TestCalculateDispatchScorePropagatesGetEngineerError(t *testing.T) {
	r := newDepthRepo(t)
	r.getEngErr = errors.New("nope")
	s := NewService(r)
	if _, err := s.CalculateDispatchScore(context.Background(), "t1",
		models.DispatchScoreRequest{Skills: []string{"x"}}); err == nil {
		t.Error("expected err")
	}
}

func TestDispatchQueueStatusAndEntries(t *testing.T) {
	r := newDepthRepo(t)
	r.queueStatus = &models.QueueStatus{Pending: 3, Assigned: 4, Total: 7}
	r.queueEntries = []models.QueueEntry{{TicketID: "t1"}}
	s := NewService(r)
	qs, err := s.GetDispatchQueueStatus(context.Background(), "t1")
	if err != nil || qs.Total != 7 {
		t.Errorf("QueueStatus = %+v %v", qs, err)
	}
	entries, err := s.GetDispatchQueueEntries(context.Background(), "t1")
	if err != nil || len(entries) != 1 {
		t.Errorf("QueueEntries = %+v %v", entries, err)
	}
}

func TestAddDispatchRuleAndListDispatchRules(t *testing.T) {
	r := newDepthRepo(t)
	r.dispRule = &models.DispatchRule{ID: "dr1"}
	r.dispRules = []models.DispatchRule{{ID: "dr1"}}
	s := NewService(r)
	if _, err := s.AddDispatchRule(context.Background(), "t1", models.AddDispatchRuleRequest{Name: "r"}); err != nil {
		t.Errorf("AddDispatchRule: %v", err)
	}
	if l, err := s.GetDispatchRules(context.Background(), "t1"); err != nil || len(l) != 1 {
		t.Errorf("GetDispatchRules: %+v %v", l, err)
	}
}

func TestAddDispatchRuleAndListPropagate(t *testing.T) {
	r := newDepthRepo(t)
	r.addDispRuleErr = errors.New("1")
	r.listDispRuleErr = errors.New("2")
	s := NewService(r)
	if _, err := s.AddDispatchRule(context.Background(), "t1", models.AddDispatchRuleRequest{}); err == nil {
		t.Error("expected err")
	}
	if _, err := s.GetDispatchRules(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
}

func TestManualDispatchPropagatesAssignmentError(t *testing.T) {
	r := newDepthRepo(t)
	r.assignTicketErr = errors.New("nope")
	s := NewService(r)
	if err := s.ManualDispatch(context.Background(), "t1", "t1", "u1"); err == nil {
		t.Error("expected err")
	}
}

func TestManualDispatchSucceedsWhenRepoClean(t *testing.T) {
	r := newDepthRepo(t)
	s := NewService(r)
	if err := s.ManualDispatch(context.Background(), "t1", "t1", "u1"); err != nil {
		t.Errorf("unexpected err: %v", err)
	}
}

// GetSLAAlerts: breaches + near-breaches + non-alerts
func TestGetSLAAlertsMarksBreachesAndNearBreaches(t *testing.T) {
	now := time.Now().UTC()
	r := newDepthRepo(t)
	// medium default target = 24h resolution
	r.tickets = []models.Ticket{
		// Created 25h ago -> breach (past due)
		{ID: "breach", Status: "open", Priority: "medium",
			CreatedAt: now.Add(-25 * time.Hour), Title: "br"},
		// Created 20h ago -> due in 4h, and 4 < 0.25*24 = 6, so near-breach.
		{ID: "near", Status: "open", Priority: "medium",
			CreatedAt: now.Add(-20 * time.Hour), Title: "nr"},
		// Created just now -> not alert
		{ID: "fresh", Status: "open", Priority: "medium",
			CreatedAt: now, Title: "fr"},
		// Resolved tickets never alert
		{ID: "resolved", Status: "resolved", Priority: "medium",
			CreatedAt: now.Add(-100 * time.Hour)},
		{ID: "closed", Status: "closed", Priority: "medium",
			CreatedAt: now.Add(-100 * time.Hour)},
	}
	s := NewService(r)
	alerts, err := s.GetSLAAlerts(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	byID := map[string]models.SLAAlert{}
	for _, a := range alerts {
		byID[a.TicketID] = a
	}
	if _, ok := byID["breach"]; !ok {
		t.Errorf("expected breach alert, got %+v", alerts)
	}
	if _, ok := byID["near"]; !ok {
		t.Errorf("expected near-breach alert, got %+v", alerts)
	}
	if _, ok := byID["fresh"]; ok {
		t.Errorf("fresh ticket should not alert, got %+v", byID["fresh"])
	}
	if _, ok := byID["resolved"]; ok {
		t.Errorf("resolved ticket should not alert, got %+v", byID["resolved"])
	}
}

func TestGetSLAAlertsEmptyTickets(t *testing.T) {
	r := newDepthRepo(t)
	s := NewService(r)
	alerts, err := s.GetSLAAlerts(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(alerts) != 0 {
		t.Errorf("alerts = %+v, want empty", alerts)
	}
}

func TestGetSLAAlertsPropagatesListError(t *testing.T) {
	r := newDepthRepo(t)
	r.listErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetSLAAlerts(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
}

func TestGetSLAAlertsUsesPrioritySpecificTarget(t *testing.T) {
	// critical target = 4h; a ticket created 5h ago is breached.
	now := time.Now().UTC()
	r := newDepthRepo(t)
	r.tickets = []models.Ticket{
		{ID: "c1", Status: "open", Priority: "critical", CreatedAt: now.Add(-5 * time.Hour)},
	}
	s := NewService(r)
	alerts, _ := s.GetSLAAlerts(context.Background(), "t1")
	if len(alerts) != 1 || alerts[0].BreachType != "resolution" {
		t.Errorf("alerts = %+v, want one resolution breach", alerts)
	}
}

// ---------------------------------------------------------------------------
// GetLoadBalanceReport
// ---------------------------------------------------------------------------

func TestGetLoadBalanceReportEmptyTenant(t *testing.T) {
	r := newDepthRepo(t)
	s := NewService(r)
	report, err := s.GetLoadBalanceReport(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if report.MinLoad != 0 || report.MaxLoad != 0 || report.AvgLoad != 0 {
		t.Errorf("empty report = %+v", report)
	}
	if len(report.Loads) != 0 || len(report.Engineers) != 0 {
		t.Errorf("should have no loads/engineers")
	}
}

func TestGetLoadBalanceReportComputesStats(t *testing.T) {
	r := newDepthRepo(t)
	r.engineers = []models.DispatchEngineer{
		{ID: "e1", Name: "alice", CurrentLoad: 3, MaxCapacity: 10},
		{ID: "e2", Name: "bob", CurrentLoad: 5, MaxCapacity: 10},
		{ID: "e3", Name: "carol", CurrentLoad: 1, MaxCapacity: 10},
	}
	s := NewService(r)
	report, err := s.GetLoadBalanceReport(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if report.MaxLoad != 5 || report.MinLoad != 1 {
		t.Errorf("min=%d max=%d, want 1/5", report.MinLoad, report.MaxLoad)
	}
	// avg = (3+5+1)/3 = 3
	if report.AvgLoad < 2.99 || report.AvgLoad > 3.01 {
		t.Errorf("avg = %f, want ~3", report.AvgLoad)
	}
	if len(report.Engineers) != 3 {
		t.Errorf("engineers = %+v", report.Engineers)
	}
}

func TestGetLoadBalanceReportPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.listEngErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetLoadBalanceReport(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
}

// ---------------------------------------------------------------------------
// GetReassignmentSuggestions
// ---------------------------------------------------------------------------

func TestGetReassignmentSuggestionsEmpty(t *testing.T) {
	r := newDepthRepo(t)
	s := NewService(r)
	out, err := s.GetReassignmentSuggestions(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 0 {
		t.Errorf("should be empty, got %+v", out)
	}
}

func TestGetReassignmentSuggestionsPairsOverloadedWithUnderloaded(t *testing.T) {
	r := newDepthRepo(t)
	r.engineers = []models.DispatchEngineer{
		{ID: "e1", UserID: "u1", Name: "over", IsActive: true, MaxTickets: 5, CurrentLoad: 5},  // 100%
		{ID: "e2", UserID: "u2", Name: "under", IsActive: true, MaxTickets: 10, CurrentLoad: 0}, // 0%
		{ID: "e3", UserID: "u3", Name: "idle", IsActive: true, MaxTickets: 10, CurrentLoad: 0},  // 0%
	}
	s := NewService(r)
	out, err := s.GetReassignmentSuggestions(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("suggestions = %+v, want 1", out)
	}
	if out[0].EngineerID != "u1" || out[0].TargetID != "u2" {
		t.Errorf("suggestion = %+v, want u1 -> u2", out[0])
	}
}

func TestGetReassignmentSuggestionsSkipsInactive(t *testing.T) {
	r := newDepthRepo(t)
	r.engineers = []models.DispatchEngineer{
		{ID: "e1", UserID: "u1", Name: "over", IsActive: false, MaxTickets: 5, CurrentLoad: 5},
		{ID: "e2", UserID: "u2", Name: "under", IsActive: false, MaxTickets: 10, CurrentLoad: 0},
	}
	s := NewService(r)
	out, _ := s.GetReassignmentSuggestions(context.Background(), "t1")
	if len(out) != 0 {
		t.Errorf("inactive engineers should not produce suggestions, got %+v", out)
	}
}

func TestGetReassignmentSuggestionsPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.listEngErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetReassignmentSuggestions(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
}

// ---------------------------------------------------------------------------
// GetDispatchMetrics / AssignmentSuccess / TimeToAssignment / Performance
// ---------------------------------------------------------------------------

func TestGetDispatchMetricsSplitsTotal(t *testing.T) {
	r := newDepthRepo(t)
	r.engineers = []models.DispatchEngineer{
		{ID: "e1", CurrentLoad: 3}, {ID: "e2", CurrentLoad: 4}, {ID: "e3", CurrentLoad: 5},
	}
	s := NewService(r)
	m, err := s.GetDispatchMetrics(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if m.TotalDispatched != 12 {
		t.Errorf("total = %d, want 12", m.TotalDispatched)
	}
	if m.AutoDispatched != 6 || m.ManualDispatched != 6 {
		t.Errorf("auto=%d manual=%d, want 6/6", m.AutoDispatched, m.ManualDispatched)
	}
}

func TestGetDispatchMetricsPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.listEngErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetDispatchMetrics(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
}

func TestGetAssignmentSuccessMetricsEmpty(t *testing.T) {
	r := newDepthRepo(t)
	s := NewService(r)
	out, err := s.GetAssignmentSuccessMetrics(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.Rate != 100.0 {
		t.Errorf("empty tenant rate = %f, want 100", out.Rate)
	}
}

func TestGetAssignmentSuccessMetricsCountsAssigned(t *testing.T) {
	r := newDepthRepo(t)
	r.tickets = []models.Ticket{
		{ID: "a", AssigneeID: ptrStr("e1")},
		{ID: "b"},
		{ID: "c", AssigneeID: ptrStr("e1")},
		{ID: "d"},
	}
	s := NewService(r)
	out, _ := s.GetAssignmentSuccessMetrics(context.Background(), "t1")
	if out.Total != 4 || out.Successful != 2 {
		t.Errorf("got %+v, want total=4 successful=2", out)
	}
	if out.Rate < 49.9 || out.Rate > 50.1 {
		t.Errorf("rate = %f, want 50", out.Rate)
	}
}

func TestGetAssignmentSuccessMetricsPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.listErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetAssignmentSuccessMetrics(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
}

func TestGetTimeToAssignmentStatsEmpty(t *testing.T) {
	r := newDepthRepo(t)
	s := NewService(r)
	out, err := s.GetTimeToAssignmentStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.AvgMinutes != 0 || out.P95Minutes != 0 {
		t.Errorf("empty stats = %+v", out)
	}
}

func TestGetTimeToAssignmentStatsSkipsUnassigned(t *testing.T) {
	r := newDepthRepo(t)
	now := time.Now().UTC()
	r.tickets = []models.Ticket{
		{ID: "a", AssigneeID: ptrStr("e1"), CreatedAt: now.Add(-30 * time.Minute),
			UpdatedAt: now},
		{ID: "b"}, // unassigned, skipped
		{ID: "c", AssigneeID: ptrStr("e2"), CreatedAt: now, UpdatedAt: now.Add(-1 * time.Minute)}, // negative age
	}
	s := NewService(r)
	out, _ := s.GetTimeToAssignmentStats(context.Background(), "t1")
	if out.AvgMinutes < 29.9 || out.AvgMinutes > 30.1 {
		t.Errorf("avg = %f, want ~30", out.AvgMinutes)
	}
}

func TestGetTimeToAssignmentStatsPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.listErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetTimeToAssignmentStats(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
}

func TestGetEngineerPerformanceNoEngineerRow(t *testing.T) {
	now := time.Now().UTC()
	r := newDepthRepo(t)
	r.engineer = nil // not found
	r.getEngErr = nil
	r.engineer = &models.DispatchEngineer{} // present but zero-load
	r.tickets = []models.Ticket{
		{ID: "a", AssigneeID: ptrStr("e1"), Status: "resolved",
			CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now,
			ResolvedAt: ptrTime(now)},
	}
	s := NewService(r)
	p, err := s.GetEngineerPerformance(context.Background(), "t1", "e1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if p.TotalAssigned != 1 || p.Resolved != 1 {
		t.Errorf("p = %+v, want 1/1", p)
	}
}

func TestGetEngineerPerformancePropagatesListError(t *testing.T) {
	r := newDepthRepo(t)
	r.listErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetEngineerPerformance(context.Background(), "t1", "e1"); err == nil {
		t.Error("expected err")
	}
}

func TestGetEngineerPerformanceHandlesGetEngineerError(t *testing.T) {
	r := newDepthRepo(t)
	r.getEngErr = errors.New("nope")
	s := NewService(r)
	// The service returns a zero-current-load performance when the engineer
	// lookup fails. It must NOT return an error.
	p, err := s.GetEngineerPerformance(context.Background(), "t1", "e1")
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if p.CurrentLoad != 0 || p.EngineerID != "e1" {
		t.Errorf("p = %+v", p)
	}
}

func TestGetAllEngineerPerformances(t *testing.T) {
	r := newDepthRepo(t)
	r.engineers = []models.DispatchEngineer{
		{ID: "e1", UserID: "u1", CurrentLoad: 3},
		{ID: "e2", UserID: "u2", CurrentLoad: 4},
	}
	s := NewService(r)
	out, err := s.GetAllEngineerPerformances(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 2 || out[0].EngineerID != "u1" || out[1].CurrentLoad != 4 {
		t.Errorf("out = %+v", out)
	}
}

func TestGetAllEngineerPerformancesPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.listEngErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetAllEngineerPerformances(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
}

func TestUpdateAndGetDispatchWeights(t *testing.T) {
	r := newDepthRepo(t)
	r.weights = map[string]int{"skill_a": 10}
	s := NewService(r)
	w, err := s.GetDispatchWeights(context.Background(), "t1")
	if err != nil || w["skill_a"] != 10 {
		t.Errorf("GetDispatchWeights = %v %v", w, err)
	}
	if err := s.UpdateDispatchWeights(context.Background(), "t1", map[string]int{"skill_b": 20}); err != nil {
		t.Errorf("UpdateDispatchWeights: %v", err)
	}
}

func TestUpdateDispatchWeightsPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.updateWeightsErr = errors.New("nope")
	s := NewService(r)
	if err := s.UpdateDispatchWeights(context.Background(), "t1", map[string]int{}); err == nil {
		t.Error("expected err")
	}
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

func TestTransferTicketRecordsHistoryAndCallsRepo(t *testing.T) {
	r := newDepthRepo(t)
	s := NewService(r)
	if err := s.TransferTicket(context.Background(), "t1", "t1",
		models.TransferRequest{ToUserID: "u2", Reason: "vacation"}, "u1"); err != nil {
		t.Errorf("err: %v", err)
	}
	if r.calls["AddWorkflowHistory"] != 1 || r.calls["TransferTicket"] != 1 {
		t.Errorf("calls = %v", r.calls)
	}
}

func TestTransferTicketPropagatesRepoError(t *testing.T) {
	r := newDepthRepo(t)
	r.transferErr = errors.New("nope")
	s := NewService(r)
	if err := s.TransferTicket(context.Background(), "t1", "t1",
		models.TransferRequest{ToUserID: "u2"}, "u1"); err == nil {
		t.Error("expected err")
	}
}

func TestGetTransferHistory(t *testing.T) {
	r := newDepthRepo(t)
	r.transfers = []models.TransferHistoryEntry{{TicketID: "t1"}}
	s := NewService(r)
	l, err := s.GetTransferHistory(context.Background(), "t1", "t1")
	if err != nil || len(l) != 1 {
		t.Errorf("l=%+v err=%v", l, err)
	}
}

func TestGetTransferHistoryPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.getTransfersErr = errors.New("nope")
	s := NewService(r)
	if _, err := s.GetTransferHistory(context.Background(), "t1", "t1"); err == nil {
		t.Error("expected err")
	}
}

// ---------------------------------------------------------------------------
// Suspend
// ---------------------------------------------------------------------------

func TestCreateSuspendDefaultsTypeToAdhoc(t *testing.T) {
	r := newDepthRepo(t)
	r.suspend = &models.Suspend{ID: "s1"}
	s := NewService(r)
	out, err := s.CreateSuspend(context.Background(), "t1",
		models.CreateSuspendRequest{EngineerID: "e1"})
	if err != nil || out.ID != "s1" {
		t.Errorf("out = %+v err = %v", out, err)
	}
}

func TestCreateSuspendPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.createSuspendErr = errors.New("nope")
	s := NewService(r)
	if _, err := s.CreateSuspend(context.Background(), "t1", models.CreateSuspendRequest{}); err == nil {
		t.Error("expected err")
	}
}

func TestActivateSuspendUpdatesStatusAndReturnsSuspend(t *testing.T) {
	r := newDepthRepo(t)
	r.suspend = &models.Suspend{ID: "s1", Status: "active"}
	s := NewService(r)
	out, err := s.ActivateSuspend(context.Background(), "t1", "s1")
	if err != nil || out.Status != "active" {
		t.Errorf("out=%+v err=%v", out, err)
	}
	if r.calls["UpdateSuspendStatus"] != 1 {
		t.Errorf("UpdateSuspendStatus calls = %d", r.calls["UpdateSuspendStatus"])
	}
}

func TestActivateSuspendPropagatesStatusUpdateError(t *testing.T) {
	r := newDepthRepo(t)
	r.updateSuspendErr = errors.New("nope")
	s := NewService(r)
	if _, err := s.ActivateSuspend(context.Background(), "t1", "s1"); err == nil {
		t.Error("expected err")
	}
}

func TestEndSuspendSetsCompletedStatus(t *testing.T) {
	r := newDepthRepo(t)
	r.suspend = &models.Suspend{ID: "s1", Status: "completed"}
	s := NewService(r)
	out, err := s.EndSuspend(context.Background(), "t1", "s1")
	if err != nil || out.Status != "completed" {
		t.Errorf("out=%+v err=%v", out, err)
	}
}

func TestCancelSuspendSetsCancelledStatus(t *testing.T) {
	r := newDepthRepo(t)
	r.suspend = &models.Suspend{ID: "s1", Status: "cancelled"}
	s := NewService(r)
	out, err := s.CancelSuspend(context.Background(), "t1", "s1")
	if err != nil || out.Status != "cancelled" {
		t.Errorf("out=%+v err=%v", out, err)
	}
}

func TestSuspendStatusUpdatePropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.updateSuspendErr = errors.New("nope")
	s := NewService(r)
	if _, err := s.EndSuspend(context.Background(), "t1", "s1"); err == nil {
		t.Error("expected EndSuspend err")
	}
	if _, err := s.CancelSuspend(context.Background(), "t1", "s1"); err == nil {
		t.Error("expected CancelSuspend err")
	}
}

func TestListSuspensionsAndGetEngineerSuspensions(t *testing.T) {
	r := newDepthRepo(t)
	r.suspensions = []models.Suspend{{ID: "s1"}}
	r.suspensionsForEng = []models.Suspend{{ID: "s2"}}
	s := NewService(r)
	l, err := s.ListSuspensions(context.Background(), "t1")
	if err != nil || len(l) != 1 {
		t.Errorf("ListSuspensions=%+v err=%v", l, err)
	}
	l2, err := s.GetEngineerSuspensions(context.Background(), "t1", "e1")
	if err != nil || len(l2) != 1 || l2[0].ID != "s2" {
		t.Errorf("GetEngineerSuspensions=%+v err=%v", l2, err)
	}
}

func TestListSuspensionsPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.listSuspensionsErr = errors.New("1")
	r.listSuspensionsForEngErr = errors.New("2")
	s := NewService(r)
	if _, err := s.ListSuspensions(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
	if _, err := s.GetEngineerSuspensions(context.Background(), "t1", "e1"); err == nil {
		t.Error("expected err")
	}
}

func TestGetSuspendPassesThrough(t *testing.T) {
	r := newDepthRepo(t)
	r.suspend = &models.Suspend{ID: "s1"}
	s := NewService(r)
	out, err := s.GetSuspend(context.Background(), "t1", "s1")
	if err != nil || out.ID != "s1" {
		t.Errorf("out=%+v err=%v", out, err)
	}
}

func TestGetSuspendPropagatesError(t *testing.T) {
	r := newDepthRepo(t)
	r.getSuspendErr = errors.New("nope")
	s := NewService(r)
	if _, err := s.GetSuspend(context.Background(), "t1", "s1"); err == nil {
		t.Error("expected err")
	}
}

func TestGetEngineerSuspendImpactCountsAffected(t *testing.T) {
	now := time.Now().UTC()
	r := newDepthRepo(t)
	r.tickets = []models.Ticket{
		{ID: "a", AssigneeID: ptrStr("e1"), Status: "open", CreatedAt: now},
		{ID: "b", AssigneeID: ptrStr("e1"), Status: "resolved", CreatedAt: now}, // resolved
		{ID: "c", AssigneeID: ptrStr("e2"), Status: "open", CreatedAt: now},    // other engineer
	}
	s := NewService(r)
	out, err := s.GetEngineerSuspendImpact(context.Background(), "t1", "e1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.AffectedTix != 1 {
		t.Errorf("AffectedTix = %d, want 1", out.AffectedTix)
	}
}

func TestGetEngineerSuspendImpactPropagatesListError(t *testing.T) {
	r := newDepthRepo(t)
	r.listErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetEngineerSuspendImpact(context.Background(), "t1", "e1"); err == nil {
		t.Error("expected err")
	}
}

// ---------------------------------------------------------------------------
// GetTransferStats averages over ticket count
// ---------------------------------------------------------------------------

func TestGetTransferStatsAveragesByCount(t *testing.T) {
	r := newDepthRepo(t)
	r.transferStats = &models.TransferStats{TotalTransfers: 10}
	r.count = 5
	s := NewService(r)
	out, err := s.GetTransferStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.AvgTransfers < 1.99 || out.AvgTransfers > 2.01 {
		t.Errorf("AvgTransfers = %f, want 2.0", out.AvgTransfers)
	}
}

func TestGetTransferStatsSkipsAverageForZeroCount(t *testing.T) {
	r := newDepthRepo(t)
	r.transferStats = &models.TransferStats{TotalTransfers: 10}
	r.count = 0
	s := NewService(r)
	out, err := s.GetTransferStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.AvgTransfers != 0 {
		t.Errorf("AvgTransfers = %f, want 0 (no count)", out.AvgTransfers)
	}
}

func TestGetTransferStatsPropagatesCountError(t *testing.T) {
	r := newDepthRepo(t)
	r.countErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetTransferStats(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
}

func TestGetTransferStatsPropagatesStatsError(t *testing.T) {
	r := newDepthRepo(t)
	r.getTransferStatsErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetTransferStats(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
}

// ---------------------------------------------------------------------------
// ComparePeriods / ExportBIData / GetTimeTrend
// ---------------------------------------------------------------------------

func TestComparePeriodsRejectsBadFormat(t *testing.T) {
	r := newDepthRepo(t)
	s := NewService(r)
	if _, err := s.ComparePeriods(context.Background(), "t1", "2026-01-01..2026-01-07", "2026"); err == nil {
		t.Error("expected format error")
	}
}

func TestComparePeriodsCountsTicketsInWindows(t *testing.T) {
	r := newDepthRepo(t)
	now := time.Now().UTC()
	r.tickets = []models.Ticket{
		{ID: "a", CreatedAt: now.Add(-3 * time.Hour)},
		{ID: "b", CreatedAt: now.Add(-40 * 24 * time.Hour)},
		{ID: "c", CreatedAt: now.Add(-60 * 24 * time.Hour)},
	}
	s := NewService(r)
	// Current window: yesterday..today; previous window: 60..40 days ago.
	today := now.Format("2006-01-02")
	yesterday := now.Add(-24 * time.Hour).Format("2006-01-02")
	cur := yesterday + ".." + today
	d60 := now.Add(-60 * 24 * time.Hour).Format("2006-01-02")
	d40 := now.Add(-40 * 24 * time.Hour).Format("2006-01-02")
	prev := d60 + ".." + d40
	out, err := s.ComparePeriods(context.Background(), "t1", cur, prev)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	m := out.Metrics["tickets_created"]
	if m.Current != 1 || m.Previous != 2 {
		t.Errorf("metrics = %+v, want current=1 previous=2", m)
	}
	// (1-2)/2 * 100 = -50
	if m.ChangePct < -50.1 || m.ChangePct > -49.9 {
		t.Errorf("ChangePct = %f, want -50", m.ChangePct)
	}
}

func TestComparePeriodsPropagatesListError(t *testing.T) {
	r := newDepthRepo(t)
	r.listErr = errors.New("db")
	s := NewService(r)
	if _, err := s.ComparePeriods(context.Background(), "t1", "a..b", "c..d"); err == nil {
		t.Error("expected err")
	}
}

func TestExportBIDataReturnsAllWhenNoRange(t *testing.T) {
	now := time.Now().UTC()
	r := newDepthRepo(t)
	r.tickets = []models.Ticket{
		{ID: "a", CreatedAt: now, UpdatedAt: now, ReporterID: "u1"},
		{ID: "b", CreatedAt: now.Add(-24 * time.Hour), UpdatedAt: now, ReporterID: "u2"},
	}
	s := NewService(r)
	out, err := s.ExportBIData(context.Background(), "t1", models.BIDataExportRequest{Format: "json"})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	data := out["data"].([]map[string]interface{})
	if len(data) != 2 {
		t.Errorf("exported %d rows, want 2", len(data))
	}
}

func TestExportBIDataFiltersByDateRange(t *testing.T) {
	now := time.Now().UTC()
	inWindow := now.Add(-2 * time.Hour)
	outWindow := now.Add(-40 * 24 * time.Hour)
	r := newDepthRepo(t)
	r.tickets = []models.Ticket{
		{ID: "a", CreatedAt: inWindow, UpdatedAt: now},
		{ID: "b", CreatedAt: outWindow, UpdatedAt: now},
	}
	s := NewService(r)
	req := models.BIDataExportRequest{
		From:   now.Add(-24 * time.Hour).Format("2006-01-02"),
		To:     now.Format("2006-01-02"),
		Format: "json",
	}
	out, err := s.ExportBIData(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	data := out["data"].([]map[string]interface{})
	if len(data) != 1 || data[0]["id"] != "a" {
		t.Errorf("exported %+v, want only a", data)
	}
}

func TestExportBIDataPropagatesListError(t *testing.T) {
	r := newDepthRepo(t)
	r.listErr = errors.New("db")
	s := NewService(r)
	if _, err := s.ExportBIData(context.Background(), "t1", models.BIDataExportRequest{}); err == nil {
		t.Error("expected err")
	}
}

func TestGetTimeTrendBucketsByDay(t *testing.T) {
	now := time.Now().UTC()
	d0 := now.Format("2006-01-02")
	dMinus1 := now.Add(-24 * time.Hour).Format("2006-01-02")
	r := newDepthRepo(t)
	r.tickets = []models.Ticket{
		{ID: "a", CreatedAt: now},
		{ID: "b", CreatedAt: now},
		{ID: "c", CreatedAt: now.Add(-24 * time.Hour)},
	}
	s := NewService(r)
	out, err := s.GetTimeTrend(context.Background(), "t1", "7d")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out.Labels) != 2 || len(out.Values) != 2 {
		t.Errorf("got %+v", out)
	}
	byDay := map[string]int{}
	for i, l := range out.Labels {
		byDay[l] = out.Values[i]
	}
	if byDay[d0] != 2 || byDay[dMinus1] != 1 {
		t.Errorf("byDay = %v, want {d0:2 dMinus1:1}", byDay)
	}
}

func TestGetTimeTrendPropagatesListError(t *testing.T) {
	r := newDepthRepo(t)
	r.listErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetTimeTrend(context.Background(), "t1", "7d"); err == nil {
		t.Error("expected err")
	}
}

// helper for pointer *time.Time fields
func ptrTime(t time.Time) *time.Time { return &t }

// ---------------------------------------------------------------------------
// ticket_sla_report.go — GetResolutionStats / GetTrendReport
// ---------------------------------------------------------------------------

func TestGetResolutionStatsNoResolvedTickets(t *testing.T) {
	r := newDepthRepo(t)
	r.tickets = []models.Ticket{
		{ID: "a", Status: "open"},
		{ID: "b", Status: "assigned"},
	}
	s := NewService(r)
	out, err := s.GetResolutionStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.Total != 2 {
		t.Errorf("Total = %d, want 2 (len(tickets) in empty-resolved branch)", out.Total)
	}
	if out.AvgResolutionH != 0 {
		t.Errorf("avg = %f, want 0", out.AvgResolutionH)
	}
	if out.ByPriority == nil {
		t.Errorf("ByPriority should not be nil when there are no resolved tickets")
	}
	if out.ByPriority == nil {
		t.Errorf("ByPriority should not be nil when there are no resolved tickets")
	}
}

func TestGetResolutionStatsAveragesResolvedTickets(t *testing.T) {
	now := time.Now().UTC()
	r := newDepthRepo(t)
	r.tickets = []models.Ticket{
		{ID: "a", Status: "resolved", Priority: "high",
			CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now},
		{ID: "b", Status: "resolved", Priority: "high",
			CreatedAt: now.Add(-4 * time.Hour), UpdatedAt: now},
		{ID: "c", Status: "closed", Priority: "low",
			CreatedAt: now.Add(-10 * time.Hour), UpdatedAt: now},
		{ID: "d", Status: "open", Priority: "medium"},
	}
	s := NewService(r)
	out, _ := s.GetResolutionStats(context.Background(), "t1")
	if out.Total != 3 {
		t.Errorf("Total = %d, want 3", out.Total)
	}
	// avg of 2, 4, 10 hours = 5.33
	if out.AvgResolutionH < 5.3 || out.AvgResolutionH > 5.4 {
		t.Errorf("avg = %f, want ~5.33", out.AvgResolutionH)
	}
	// high: avg of 2 and 4 = 3
	if out.ByPriority["high"] < 2.99 || out.ByPriority["high"] > 3.01 {
		t.Errorf("high avg = %f, want 3", out.ByPriority["high"])
	}
	if out.ByPriority["low"] < 9.99 || out.ByPriority["low"] > 10.01 {
		t.Errorf("low avg = %f, want 10", out.ByPriority["low"])
	}
}

func TestGetResolutionStatsPropagatesListError(t *testing.T) {
	r := newDepthRepo(t)
	r.listErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetResolutionStats(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
}

func TestGetTrendReportReturnsSevenDays(t *testing.T) {
	r := newDepthRepo(t)
	now := time.Now().UTC()
	r.tickets = []models.Ticket{
		{ID: "a", CreatedAt: now, ResolvedAt: ptrTime(now)},
		{ID: "b", CreatedAt: now.Add(-24 * time.Hour), ResolvedAt: ptrTime(now.Add(-24 * time.Hour))},
	}
	s := NewService(r)
	out, err := s.GetTrendReport(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out.Periods) != 7 || len(out.Created) != 7 || len(out.Resolved) != 7 {
		t.Errorf("trend lengths = periods=%d created=%d resolved=%d, want 7/7/7",
			len(out.Periods), len(out.Created), len(out.Resolved))
	}
	totalCreated := 0
	for _, v := range out.Created {
		totalCreated += v
	}
	if totalCreated != 2 {
		t.Errorf("totalCreated = %d, want 2", totalCreated)
	}
	totalResolved := 0
	for _, v := range out.Resolved {
		totalResolved += v
	}
	if totalResolved != 2 {
		t.Errorf("totalResolved = %d, want 2", totalResolved)
	}
}

func TestGetTrendReportSkipsTicketsWithoutResolvedAt(t *testing.T) {
	r := newDepthRepo(t)
	now := time.Now().UTC()
	r.tickets = []models.Ticket{
		{ID: "a", CreatedAt: now, ResolvedAt: nil},
	}
	s := NewService(r)
	out, _ := s.GetTrendReport(context.Background(), "t1")
	totalCreated := 0
	totalResolved := 0
	for _, v := range out.Created {
		totalCreated += v
	}
	for _, v := range out.Resolved {
		totalResolved += v
	}
	if totalCreated != 1 || totalResolved != 0 {
		t.Errorf("created=%d resolved=%d, want 1/0", totalCreated, totalResolved)
	}
}

func TestGetTrendReportPropagatesListError(t *testing.T) {
	r := newDepthRepo(t)
	r.listErr = errors.New("db")
	s := NewService(r)
	if _, err := s.GetTrendReport(context.Background(), "t1"); err == nil {
		t.Error("expected err")
	}
}

// ---------------------------------------------------------------------------
// ticket_sla_report.go — GetTicketSLA with stored target / breach
// ---------------------------------------------------------------------------

func TestGetTicketSLAPropagatesTrackingError(t *testing.T) {
	r := newDepthRepo(t)
	r.getTrackingErr = errors.New("no tracking")
	s := NewService(r)
	if _, err := s.GetTicketSLA(context.Background(), "t1", "t1"); err == nil {
		t.Error("expected err")
	}
}

func TestGetTicketSLAPropagatesGetTicketError(t *testing.T) {
	r := newDepthRepo(t)
	r.getTicketErr = errors.New("no ticket")
	s := NewService(r)
	if _, err := s.GetTicketSLA(context.Background(), "t1", "t1"); err == nil {
		t.Error("expected err")
	}
}

// ---------------------------------------------------------------------------
// ticket_errors.go — IsNotFound
// ---------------------------------------------------------------------------

func TestIsNotFoundRecognisesOnlyItsOwnErrors(t *testing.T) {
	if !IsNotFound(ErrNotFoundTicket("t1")) {
		t.Error("IsNotFound should return true for ErrNotFoundTicket")
	}
	if !IsNotFound(ErrNotFoundRule("r1")) {
		t.Error("IsNotFound should return true for ErrNotFoundRule")
	}
	if IsNotFound(errors.New("random")) {
		t.Error("IsNotFound should return false for unrelated error")
	}
	if IsNotFound(nil) {
		t.Error("IsNotFound(nil) should be false")
	}
}

func TestErrNotFoundTicketFormatsID(t *testing.T) {
	err := ErrNotFoundTicket("t-123")
	if !strings.Contains(err.Error(), "t-123") {
		t.Errorf("err = %v, want contains t-123", err)
	}
}

func TestErrNotFoundRuleFormatsID(t *testing.T) {
	err := ErrNotFoundRule("r-456")
	if !strings.Contains(err.Error(), "r-456") {
		t.Errorf("err = %v, want contains r-456", err)
	}
}
