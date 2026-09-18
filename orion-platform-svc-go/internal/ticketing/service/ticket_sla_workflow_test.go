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

// wfRepo is a recording RepositoryInterface. Every method the tests below do
// not drive returns the zero value, but the ones they do drive capture their
// arguments so the assertions are about what the service sent to the database
// rather than about the returned object. The error fields inject a failure at
// exactly one call site, which is what makes the propagation tests able to say
// which line the error was lost on.
type wfRepo struct {
	created    *models.Ticket
	slaArgs    *wfSLAArgs
	ticketMods []map[string]interface{}
	slaMods    []map[string]interface{}
	histories  []wfHistory
	assigns    []wfAssign
	tickets    []models.Ticket
	// overrideTracking replaces the empty tracking row, so a test can plant a
	// stored target or a breach flag. Without it every test saw
	// TargetResolutionTimeMs 0, which made the keep-the-stored-value branch
	// unreachable.
	overrideTracking *repository.TicketSLATracking

	errCreateTicket      error
	errUpdateTicket      error
	errGetSLATracking    error
	errAddHistory        error
	errCreateAssignment  error
	errUpdateSLATracking error
}

type wfSLAArgs struct {
	tenantID string
	ticketID string
	priority string
	targetMs int64
}

type wfHistory struct {
	action, fromState, toState, userID, comment string
}

type wfAssign struct {
	assignee, assignedBy, reason string
}

func (r *wfRepo) AddDispatchRule(context.Context, string, models.AddDispatchRuleRequest) (*models.DispatchRule, error) {
	return nil, nil
}
func (r *wfRepo) AddRelation(context.Context, string, string, string, string) (*models.TicketRelation, error) {
	return nil, nil
}
func (r *wfRepo) AddWorkflowHistory(ctx context.Context, _, ticketID, action, fromState, toState, userID, comment string) error {
	_ = ctx
	r.histories = append(r.histories, wfHistory{action, fromState, toState, userID, comment})
	if r.errAddHistory != nil {
		return r.errAddHistory
	}
	if ticketID == "" {
		return errors.New("wfRepo: AddWorkflowHistory without a ticket ID")
	}
	return nil
}
func (r *wfRepo) AssignTicket(context.Context, string, string, string) error { return nil }
func (r *wfRepo) CountTickets(context.Context, string) (int, error)          { return 0, nil }
func (r *wfRepo) CountTicketsByCategory(context.Context, string) (map[string]int, error) {
	return nil, nil
}
func (r *wfRepo) CountTicketsByPriority(context.Context, string) (map[string]int, error) {
	return nil, nil
}
func (r *wfRepo) CountTicketsByStatus(context.Context, string) (map[string]int, error) {
	return nil, nil
}
func (r *wfRepo) CreateAssignment(ctx context.Context, _, ticketID, assignee, assignedBy, reason string) error {
	_ = ctx
	r.assigns = append(r.assigns, wfAssign{assignee, assignedBy, reason})
	if r.errCreateAssignment != nil {
		return r.errCreateAssignment
	}
	if ticketID == "" {
		return errors.New("wfRepo: CreateAssignment without a ticket ID")
	}
	return nil
}
func (r *wfRepo) CreateAssignmentRule(context.Context, string, models.CreateAssignmentRuleRequest) (*models.AssignmentRule, error) {
	return nil, nil
}
func (r *wfRepo) CreateAutomationRule(context.Context, string, models.CreateAutomationRuleRequest) (*models.AutomationRule, error) {
	return nil, nil
}
func (r *wfRepo) CreateSLAPolicy(context.Context, string, models.CreateSLAPolicyRequest) (*models.SLAPolicy, error) {
	return nil, nil
}
func (r *wfRepo) CreateSLATarget(context.Context, string, models.CreateSLATargetRequest) (*models.SLATarget, error) {
	return nil, nil
}
func (r *wfRepo) CreateSuspend(context.Context, string, models.CreateSuspendRequest) (*models.Suspend, error) {
	return nil, nil
}
func (r *wfRepo) CreateTicket(ctx context.Context, t *models.Ticket) error {
	_ = ctx
	if t.ID == "" {
		t.ID = "tk-fixed"
	}
	r.created = t
	return r.errCreateTicket
}
func (r *wfRepo) DeleteAssignmentRule(context.Context, string, string) error { return nil }
func (r *wfRepo) DeleteAutomationRule(context.Context, string, string) error { return nil }
func (r *wfRepo) DeleteSLAPolicy(context.Context, string, string) error      { return nil }
func (r *wfRepo) DeleteTicket(context.Context, string, string) error         { return nil }
func (r *wfRepo) DetectDuplicates(context.Context, string, string) ([]models.TicketRelation, error) {
	return nil, nil
}
func (r *wfRepo) FindRelatedTickets(context.Context, string, string) ([]models.TicketRelation, error) {
	return nil, nil
}
func (r *wfRepo) GetDispatchQueueEntries(context.Context, string) ([]models.QueueEntry, error) {
	return nil, nil
}
func (r *wfRepo) GetDispatchQueueStatus(context.Context, string) (*models.QueueStatus, error) {
	return &models.QueueStatus{}, nil
}
func (r *wfRepo) GetDispatchWeights(context.Context, string) (map[string]int, error) {
	return nil, nil
}
func (r *wfRepo) GetEngineer(context.Context, string, string) (*models.DispatchEngineer, error) {
	return &models.DispatchEngineer{}, nil
}
func (r *wfRepo) GetEngineerSuspensions(context.Context, string, string) ([]models.Suspend, error) {
	return nil, nil
}
func (r *wfRepo) GetRelations(context.Context, string, string) ([]models.TicketRelation, error) {
	return nil, nil
}
func (r *wfRepo) GetSLABreaches(context.Context, string) ([]models.SLABreach, error) {
	return nil, nil
}
func (r *wfRepo) GetSLACompliance(context.Context, string, string) (*models.ComplianceResult, error) {
	return &models.ComplianceResult{}, nil
}
func (r *wfRepo) GetSLAPolicy(context.Context, string, string) (*models.SLAPolicy, error) {
	return &models.SLAPolicy{}, nil
}
func (r *wfRepo) GetSLATracking(ctx context.Context, _, ticketID string) (*repository.TicketSLATracking, error) {
	_ = ctx
	if r.errGetSLATracking != nil {
		return nil, r.errGetSLATracking
	}
	if r.overrideTracking != nil {
		return r.overrideTracking, nil
	}
	if ticketID == "" {
		return nil, errors.New("wfRepo: GetSLATracking without a ticket ID")
	}
	return &repository.TicketSLATracking{}, nil
}
func (r *wfRepo) GetSuspend(context.Context, string, string) (*models.Suspend, error) {
	return &models.Suspend{}, nil
}
func (r *wfRepo) GetTicket(ctx context.Context, _, id string) (*models.Ticket, error) {
	_ = ctx
	for i := range r.tickets {
		if r.tickets[i].ID == id {
			return &r.tickets[i], nil
		}
	}
	return &models.Ticket{ID: id}, nil
}
func (r *wfRepo) GetTransferHistory(context.Context, string, string) ([]models.TransferHistoryEntry, error) {
	return nil, nil
}
func (r *wfRepo) GetTransferStats(context.Context, string) (*models.TransferStats, error) {
	return &models.TransferStats{}, nil
}
func (r *wfRepo) GetWorkflowHistory(context.Context, string, string) ([]models.WorkflowHistoryEntry, error) {
	return nil, nil
}
func (r *wfRepo) IsServiceActive(context.Context, string) (bool, error) { return true, nil }
func (r *wfRepo) ListAssignmentRules(context.Context, string) ([]models.AssignmentRule, error) {
	return nil, nil
}
func (r *wfRepo) ListAutomationRules(context.Context, string) ([]models.AutomationRule, error) {
	return nil, nil
}
func (r *wfRepo) ListDispatchRules(context.Context, string) ([]models.DispatchRule, error) {
	return nil, nil
}
func (r *wfRepo) ListEngineers(context.Context, string) ([]models.DispatchEngineer, error) {
	return nil, nil
}
func (r *wfRepo) ListSLAPolicies(context.Context, string) ([]models.SLAPolicy, error) {
	return nil, nil
}
func (r *wfRepo) ListSuspensions(context.Context, string) ([]models.Suspend, error) {
	return nil, nil
}
func (r *wfRepo) ListTickets(context.Context, string, models.TicketListQuery) ([]models.Ticket, error) {
	return r.tickets, nil
}
func (r *wfRepo) RegisterEngineer(context.Context, string, models.RegisterEngineerRequest) (*models.DispatchEngineer, error) {
	return &models.DispatchEngineer{}, nil
}
func (r *wfRepo) SetServiceActive(context.Context, string, bool) error { return nil }
func (r *wfRepo) TransferTicket(context.Context, string, string, string, string, string) error {
	return nil
}
func (r *wfRepo) UpdateAutomationRule(context.Context, string, string, map[string]interface{}) error {
	return nil
}
func (r *wfRepo) UpdateDispatchWeights(context.Context, string, map[string]int) error {
	return nil
}
func (r *wfRepo) UpdateSLAPolicy(context.Context, string, string, map[string]interface{}) error {
	return nil
}
func (r *wfRepo) UpdateSLATracking(ctx context.Context, ticketID string, updates map[string]interface{}) error {
	_ = ctx
	r.slaMods = append(r.slaMods, updates)
	if r.errUpdateSLATracking != nil {
		return r.errUpdateSLATracking
	}
	return nil
}
func (r *wfRepo) UpdateSuspendStatus(context.Context, string, string, string) error {
	return nil
}
func (r *wfRepo) UpdateTicket(ctx context.Context, _, ticketID string, updates map[string]interface{}) error {
	_ = ctx
	r.ticketMods = append(r.ticketMods, updates)
	if r.errUpdateTicket != nil {
		return r.errUpdateTicket
	}
	if ticketID == "" {
		return errors.New("wfRepo: UpdateTicket without a ticket ID")
	}
	return nil
}
func (r *wfRepo) UpsertSLATracking(ctx context.Context, tenantID, ticketID, priority string, targetMs int64) (*repository.TicketSLATracking, error) {
	_ = ctx
	r.slaArgs = &wfSLAArgs{tenantID, ticketID, priority, targetMs}
	if ticketID == "" {
		return nil, errors.New("wfRepo: UpsertSLATracking without a ticket ID")
	}
	return &repository.TicketSLATracking{}, nil
}

var _ RepositoryInterface = (*wfRepo)(nil)

// The old CreateTicket wrote int64(target.ResolveH) * 3600, which is seconds,
// into target_resolution_time_ms. A critical ticket has a 4 hour window, so the
// column held 14400 where 14400000 was meant. The stored value then fed back
// into GetTicketSLA, which advertised a 14.4 second resolution target while the
// deadline was still computed from the uncorrupted default. The multiplication
// here is the invariant that 698 repairs in the database.
func TestCreateTicketWritesTheSLAWindowInMilliseconds(t *testing.T) {
	for _, tc := range []struct {
		priority string
		wantMS   int64
	}{
		{"critical", 4 * 3600 * 1000},
		{"high", 8 * 3600 * 1000},
		{"medium", 24 * 3600 * 1000},
		{"low", 72 * 3600 * 1000},
		// Empty priority defaults to medium before the lookup.
		{"", 24 * 3600 * 1000},
	} {
		repo := &wfRepo{}
		svc := NewService(repo)
		ticket, err := svc.CreateTicket(context.Background(), "tenant-1",
			models.CreateTicketRequest{Title: "t", Priority: tc.priority}, "user-1")
		if err != nil {
			t.Fatalf("CreateTicket(%q) returned an error: %v", tc.priority, err)
		}
		if repo.slaArgs == nil {
			t.Fatalf("CreateTicket(%q) never wrote an SLA tracking row", tc.priority)
		}
		if repo.slaArgs.targetMs != tc.wantMS {
			t.Errorf("CreateTicket(%q) wrote %d ms, want %d: the hour value needs *3600*1000",
				tc.priority, repo.slaArgs.targetMs, tc.wantMS)
		}
		if repo.slaArgs.ticketID != ticket.ID {
			t.Errorf("SLA row written for %q, ticket id is %q", repo.slaArgs.ticketID, ticket.ID)
		}
		if repo.slaArgs.tenantID != "tenant-1" {
			t.Errorf("SLA row written for tenant %q, want tenant-1", repo.slaArgs.tenantID)
		}
	}
}

// defaultSLATargets has four entries. A ticket created with any other priority
// must not write ResolveH 0 into a NOT NULL column, because that is both an
// unresolvable deadline and, in GetTicketSLA, a signal to fall back to the
// default. Medium is the fallback so the writer and the reporter agree.
func TestCreateTicketFallsBackToMediumForAnUnknownPriority(t *testing.T) {
	repo := &wfRepo{}
	svc := NewService(repo)
	ticket, err := svc.CreateTicket(context.Background(), "tenant-1",
		models.CreateTicketRequest{Title: "t", Priority: "urgent"}, "user-1")
	if err != nil {
		t.Fatalf("CreateTicket returned an error: %v", err)
	}
	if ticket.Priority != "urgent" {
		t.Errorf("priority rewritten to %q, the stored priority must stay urgent", ticket.Priority)
	}
	if repo.slaArgs == nil || repo.slaArgs.targetMs == 0 {
		t.Fatalf("SLA window is %v: an unknown priority must resolve to the medium window, not 0", repo.slaArgs)
	}
	if want := int64(24 * 3600 * 1000); repo.slaArgs.targetMs != want {
		t.Errorf("unknown priority wrote %d ms, want %d (medium)", repo.slaArgs.targetMs, want)
	}
}

// GetTicketSLA must report the window it wrote. A critical ticket has
// ResponseH 0, so its response deadline is its creation time: one minute after
// creation it is already overdue. The old code stamped the response deadline
// one hour after creation regardless of priority, so a critical ticket that
// nobody had ever answered reported a passing response SLA.
func TestGetTicketSLAReportsTheCriticalWindow(t *testing.T) {
	created := time.Now().UTC().Add(-15 * time.Minute)
	repo := &wfRepo{tickets: []models.Ticket{{
		ID: "tk-crit", TenantID: "tenant-1", Status: "open",
		Priority: "critical", CreatedAt: created,
	}}}
	svc := NewService(repo)
	sla, err := svc.GetTicketSLA(context.Background(), "tenant-1", "tk-crit")
	if err != nil {
		t.Fatalf("GetTicketSLA returned an error: %v", err)
	}
	if sla.TargetResponseTimeMs != 0 {
		t.Errorf("critical response window is %d ms, want 0", sla.TargetResponseTimeMs)
	}
	if sla.ResponseOK {
		t.Error("ResponseOK is true for a critical ticket with no first response 15 minutes in")
	}
	if want := int64(4 * 3600 * 1000); sla.TargetResolutionTimeMs != want {
		t.Errorf("critical resolution window is %d ms, want %d", sla.TargetResolutionTimeMs, want)
	}
	if got, want := sla.ResponseDue, created.Format(time.RFC3339); got != want {
		t.Errorf("ResponseDue is %s, want %s (creation time for a zero hour window)", got, want)
	}
	wantResolve := created.Add(4 * time.Hour).Format(time.RFC3339)
	if sla.ResolutionDue != wantResolve {
		t.Errorf("ResolutionDue is %s, want %s", sla.ResolutionDue, wantResolve)
	}
}

// An unknown priority reaches GetTicketSLA every time a client sends a
// non-canonical value. The pre-fix fallback was a hardcoded (1, 24) pair, so
// the response window silently narrowed from the medium four hours to one.
func TestGetTicketSLAFallsBackToMediumForAnUnknownPriority(t *testing.T) {
	repo := &wfRepo{tickets: []models.Ticket{{
		ID: "tk-urg", TenantID: "tenant-1", Status: "open",
		Priority: "urgent", CreatedAt: time.Now().UTC().Add(-time.Hour),
	}}}
	sla, err := NewService(repo).GetTicketSLA(context.Background(), "tenant-1", "tk-urg")
	if err != nil {
		t.Fatalf("GetTicketSLA returned an error: %v", err)
	}
	if want := int64(4 * 3600 * 1000); sla.TargetResponseTimeMs != want {
		t.Errorf("unknown priority reports a %d ms response window, want %d (medium)",
			sla.TargetResponseTimeMs, want)
	}
	if want := int64(24 * 3600 * 1000); sla.TargetResolutionTimeMs != want {
		t.Errorf("unknown priority reports a %d ms resolution window, want %d (medium)",
			sla.TargetResolutionTimeMs, want)
	}
}

// 698 rescales every stored row by 1000, so a repaired ticket carries the
// correct millisecond value. GetTicketSLA must keep it rather than recomputing
// from the priority map, otherwise a tenant that changed a priority after
// creation would be reported against the window it was created with.
func TestGetTicketSLAKeepsTheStoredResolutionTarget(t *testing.T) {
	created := time.Now().UTC().Add(-time.Hour)
	repo := &wfRepo{tickets: []models.Ticket{{
		ID: "tk-stored", TenantID: "tenant-1", Status: "open",
		Priority: "low", CreatedAt: created,
	}}}
	// The ticket is low priority, so the derived window would be 72 hours. The
	// stored value is 8 hours and must win.
	stored := int64(8 * 3600 * 1000)
	repo.overrideTracking = &repository.TicketSLATracking{TargetResolutionTimeMs: stored}
	sla, err := NewService(repo).GetTicketSLA(context.Background(), "tenant-1", "tk-stored")
	if err != nil {
		t.Fatalf("GetTicketSLA returned an error: %v", err)
	}
	if sla.TargetResolutionTimeMs != stored {
		t.Errorf("resolution window is %d ms, want the stored %d ms",
			sla.TargetResolutionTimeMs, stored)
	}
	if want := int64(8 * 3600 * 1000); sla.TargetResponseTimeMs != want {
		t.Errorf("low response window is %d ms, want %d", sla.TargetResponseTimeMs, want)
	}
}

// A record that was marked breached must stay breached no matter how fresh the
// deadline looks. The flag is the only durable evidence that an alert fired.
func TestGetTicketSLADoesNotClearAStoredBreach(t *testing.T) {
	repo := &wfRepo{tickets: []models.Ticket{{
		ID: "tk-breached", TenantID: "tenant-1", Status: "in-progress",
		Priority: "medium", CreatedAt: time.Now().UTC().Add(-10 * time.Minute),
	}}, overrideTracking: &repository.TicketSLATracking{
		Breached:         true,
		ResponseBreached: true,
	}}
	svc := NewService(repo)
	sla, err := svc.GetTicketSLA(context.Background(), "tenant-1", "tk-breached")
	if err != nil {
		t.Fatalf("GetTicketSLA returned an error: %v", err)
	}
	if !sla.Breached {
		t.Error("Breached dropped the stored breach flag")
	}
	if sla.ResolutionOK || sla.ResponseOK {
		t.Errorf("a breached record reported OK: ResolutionOK=%v ResponseOK=%v",
			sla.ResolutionOK, sla.ResponseOK)
	}
}

// GET /ticketing/sla/tickets/:ticketId/status is registered on the live
// ticketing handler, and before the fix its repository body was a connectivity
// check that returned a TicketSLAStatus with only ticket_id set. Every window
// and deadline on the route read as zero, so a queue full of breaches looked
// identical to an empty one. The service now computes the same value
// GetTicketSLA reports on GET /tickets/:id/sla, so the two routes agree. The
// fixture uses a high ticket on purpose: a critical ticket has a zero hour
// response window, which is also what a placeholder returns.
func TestGetTicketSLAStatusReportsTheComputedWindow(t *testing.T) {
	created := time.Now().UTC().Add(-15 * time.Minute)
	repo := &wfRepo{tickets: []models.Ticket{{
		ID: "tk-status", TenantID: "tenant-1", Status: "open",
		Priority: "high", CreatedAt: created,
	}}}
	svc := NewService(repo)
	sla, err := svc.GetTicketSLAStatus(context.Background(), "tenant-1", "tk-status")
	if err != nil {
		t.Fatalf("GetTicketSLAStatus returned an error: %v", err)
	}
	if got, want := sla.TicketID, "tk-status"; got != want {
		t.Errorf("TicketID is %q, want %q", got, want)
	}
	if got, want := sla.Priority, "high"; got != want {
		t.Errorf("Priority is %q, want %q", got, want)
	}
	if got, want := sla.Status, "open"; got != want {
		t.Errorf("Status is %q, want %q", got, want)
	}
	if want := int64(1 * 3600 * 1000); sla.TargetResponseTimeMs != want {
		t.Errorf("high response window is %d ms, want %d", sla.TargetResponseTimeMs, want)
	}
	if want := int64(8 * 3600 * 1000); sla.TargetResolutionTimeMs != want {
		t.Errorf("high resolution window is %d ms, want %d", sla.TargetResolutionTimeMs, want)
	}
	// A high ticket has a one hour response window, so the deadline is an hour
	// after creation rather than at creation time the way a critical ticket's
	// zero hour window is.
	wantRespond := created.Add(time.Hour).Format(time.RFC3339)
	if sla.ResponseDue != wantRespond {
		t.Errorf("ResponseDue is %q, want %q", sla.ResponseDue, wantRespond)
	}
	wantResolve := created.Add(8 * time.Hour).Format(time.RFC3339)
	if sla.ResolutionDue != wantResolve {
		t.Errorf("ResolutionDue is %q, want %q", sla.ResolutionDue, wantResolve)
	}
	// Fifteen minutes into a one hour response window nobody has replied yet, so
	// both deadlines are still in the future.
	if !sla.ResponseOK || !sla.ResolutionOK {
		t.Errorf("a 15 minute old high ticket reported OK: ResponseOK=%v ResolutionOK=%v",
			sla.ResponseOK, sla.ResolutionOK)
	}
}

// The delegation must carry the repository failure rather than collapsing it
// into a 200 with an empty status. Before the fix the endpoint answered 200
// from a connectivity check, which is the same shape as a real database
// failure: the caller could not tell a broken query from a healthy ticket.
func TestGetTicketSLAStatusPropagatesTheTrackingFailure(t *testing.T) {
	want := errors.New("sla tracking unavailable")
	repo := &wfRepo{
		tickets:           []models.Ticket{{ID: "tk-status", Priority: "high"}},
		errGetSLATracking: want,
	}
	sla, err := NewService(repo).GetTicketSLAStatus(context.Background(), "tenant-1", "tk-status")
	if err == nil {
		t.Fatalf("GetTicketSLAStatus = %+v, want the repository error", sla)
	}
	if !errors.Is(err, want) {
		t.Fatalf("GetTicketSLAStatus err = %q, want %q", err, want.Error())
	}
	if sla != nil {
		t.Errorf("GetTicketSLAStatus = %+v, want nil alongside the error", sla)
	}
}

func TestTransitionStatusPropagatesTheSLAUpdateError(t *testing.T) {
	repo := &wfRepo{
		tickets:              []models.Ticket{{ID: "tk-1", Status: "in-progress", Priority: "medium"}},
		errUpdateSLATracking: errors.New("sla tracking unavailable"),
	}
	_, err := NewService(repo).TransitionStatus(context.Background(), "tenant-1", "tk-1",
		models.TransitionRequest{Status: "resolved", Comment: "done"}, "user-1")
	if err == nil {
		t.Fatal("TransitionStatus succeeded while the SLA tracking update failed")
	}
	if !strings.Contains(err.Error(), "sla tracking unavailable") {
		t.Errorf("error %q does not carry the repository failure", err)
	}
	if len(repo.slaMods) != 1 {
		t.Fatalf("SLA update attempted %d times, want 1", len(repo.slaMods))
	}
	if _, ok := repo.slaMods[0]["resolved_at"]; !ok {
		t.Error("SLA update carried no resolved_at, so the ticket and the SLA row disagree")
	}
	if len(repo.histories) != 1 || repo.histories[0].action != "transition" {
		t.Errorf("transition history = %+v, want one transition row", repo.histories)
	}
}

func TestTransitionStatusPropagatesTheStatusUpdateError(t *testing.T) {
	repo := &wfRepo{
		tickets:         []models.Ticket{{ID: "tk-1", Status: "open", Priority: "low"}},
		errUpdateTicket: errors.New("tickets table unavailable"),
	}
	_, err := NewService(repo).TransitionStatus(context.Background(), "tenant-1", "tk-1",
		models.TransitionRequest{Status: "closed"}, "user-1")
	if err == nil || !strings.Contains(err.Error(), "tickets table unavailable") {
		t.Fatalf("TransitionStatus error = %v, want the repository failure", err)
	}
	if len(repo.slaMods) != 0 {
		t.Errorf("SLA updated %d times after the status update failed", len(repo.slaMods))
	}
}

func TestTransitionStatusPropagatesTheHistoryError(t *testing.T) {
	repo := &wfRepo{
		tickets:       []models.Ticket{{ID: "tk-1", Status: "open", Priority: "low"}},
		errAddHistory: errors.New("history table unavailable"),
	}
	_, err := NewService(repo).TransitionStatus(context.Background(), "tenant-1", "tk-1",
		models.TransitionRequest{Status: "assigned"}, "user-1")
	if err == nil || !strings.Contains(err.Error(), "history table unavailable") {
		t.Fatalf("TransitionStatus error = %v, want the repository failure", err)
	}
	// The status is written but the audit row is not, so the caller must be told.
	if len(repo.ticketMods) != 1 {
		t.Errorf("status update attempted %d times, want 1", len(repo.ticketMods))
	}
}

func TestAssignTicketPropagatesTheAssignmentError(t *testing.T) {
	repo := &wfRepo{
		tickets:             []models.Ticket{{ID: "tk-1", Status: "open", Priority: "low"}},
		errCreateAssignment: errors.New("assignments table unavailable"),
	}
	_, err := NewService(repo).AssignTicket(context.Background(), "tenant-1", "tk-1",
		models.AssignRequest{AssigneeID: "eng-9"}, "user-1")
	if err == nil || !strings.Contains(err.Error(), "assignments table unavailable") {
		t.Fatalf("AssignTicket error = %v, want the repository failure", err)
	}
	if len(repo.ticketMods) != 0 {
		t.Errorf("status rewritten %d times with no assignment row backing it", len(repo.ticketMods))
	}
}

func TestAssignTicketMovesAnOpenTicketToAssigned(t *testing.T) {
	repo := &wfRepo{tickets: []models.Ticket{{ID: "tk-1", Status: "open", Priority: "low"}}}
	if _, err := NewService(repo).AssignTicket(context.Background(), "tenant-1", "tk-1",
		models.AssignRequest{AssigneeID: "eng-9", Comment: "on call"}, "user-1"); err != nil {
		t.Fatalf("AssignTicket returned an error: %v", err)
	}
	if len(repo.assigns) != 1 {
		t.Fatalf("assignment rows written %d times, want 1", len(repo.assigns))
	}
	a := repo.assigns[0]
	if a.assignee != "eng-9" || a.assignedBy != "user-1" || a.reason != "on call" {
		t.Errorf("assignment row = %+v, want eng-9 / user-1 / on call", a)
	}
	if len(repo.ticketMods) != 1 {
		t.Fatalf("status updates = %d, want 1", len(repo.ticketMods))
	}
	mods := repo.ticketMods[0]
	if mods["status"] != "assigned" || mods["assignee_id"] != "eng-9" {
		t.Errorf("status update = %+v, want status assigned and assignee eng-9", mods)
	}
	if len(repo.histories) != 1 {
		t.Fatalf("history rows = %d, want 1", len(repo.histories))
	}
	h := repo.histories[0]
	if h.action != "assign" || h.fromState != "open" || h.toState != "assigned" {
		t.Errorf("history = %+v, want open to assigned", h)
	}
}

// Escalation raises the priority one step and records the priority pair, so
// the audit row joins back to the priority column it moved. The pre-fix pair
// was an empty from_state and a to_state of "escalated", which is not a status.
func TestEscalateTicketBumpsThePriorityAndRecordsThePair(t *testing.T) {
	repo := &wfRepo{tickets: []models.Ticket{{ID: "tk-1", Status: "open", Priority: "medium"}}}
	_, err := NewService(repo).EscalateTicket(context.Background(), "tenant-1", "tk-1",
		models.EscalateRequest{Reason: "customer exec"}, "user-1")
	if err != nil {
		t.Fatalf("EscalateTicket returned an error: %v", err)
	}
	if len(repo.ticketMods) != 1 || repo.ticketMods[0]["priority"] != "high" {
		t.Errorf("priority update = %+v, want high", repo.ticketMods)
	}
	if len(repo.histories) != 1 {
		t.Fatalf("history rows = %d, want 1", len(repo.histories))
	}
	h := repo.histories[0]
	if h.action != "escalate" || h.fromState != "medium" || h.toState != "high" {
		t.Errorf("history = %+v, want escalate from medium to high", h)
	}
}

func TestEscalateTicketPropagatesThePriorityUpdateError(t *testing.T) {
	repo := &wfRepo{
		tickets:         []models.Ticket{{ID: "tk-1", Status: "open", Priority: "low"}},
		errUpdateTicket: errors.New("tickets table unavailable"),
	}
	_, err := NewService(repo).EscalateTicket(context.Background(), "tenant-1", "tk-1",
		models.EscalateRequest{Reason: "repeat offender"}, "user-1")
	if err == nil || !strings.Contains(err.Error(), "tickets table unavailable") {
		t.Fatalf("EscalateTicket error = %v, want the repository failure", err)
	}
}

func TestResolveTicketPropagatesTheSLAUpdateError(t *testing.T) {
	repo := &wfRepo{
		errUpdateSLATracking: errors.New("sla tracking unavailable"),
	}
	_, err := NewService(repo).ResolveTicket(context.Background(), "tenant-1", "tk-1",
		models.ResolveRequest{Resolution: "patched"}, "user-1")
	if err == nil || !strings.Contains(err.Error(), "sla tracking unavailable") {
		t.Fatalf("ResolveTicket error = %v, want the repository failure", err)
	}
	if len(repo.ticketMods) != 1 || repo.ticketMods[0]["status"] != "resolved" {
		t.Errorf("ticket update = %+v, want status resolved", repo.ticketMods)
	}
	// The two writes must agree on the resolution instant.
	if len(repo.slaMods) != 1 {
		t.Fatalf("SLA update attempted %d times, want 1", len(repo.slaMods))
	}
	ticketAt, ok1 := repo.ticketMods[0]["resolved_at"].(time.Time)
	slaAt, ok2 := repo.slaMods[0]["resolved_at"].(time.Time)
	if !ok1 || !ok2 {
		t.Fatalf("resolved_at types are %T and %T", repo.ticketMods[0]["resolved_at"], repo.slaMods[0]["resolved_at"])
	}
	if !ticketAt.Equal(slaAt) {
		t.Errorf("ticket resolved_at %s and SLA resolved_at %s differ", ticketAt, slaAt)
	}
}

// The old loop reset the counter to zero right before incrementing it for
// resolved and closed tickets, so every resolved or closed ticket counted as
// exactly one. Total still counted them, so ByStatus could never sum to Total
// and the dashboard understated the finished work.
func TestBacklogAnalysisCountsEveryResolvedAndClosedTicket(t *testing.T) {
	hoursAgo := func(n int) time.Time { return time.Now().UTC().Add(-time.Duration(n) * time.Hour) }
	repo := &wfRepo{tickets: []models.Ticket{
		{ID: "t1", Status: "open", Priority: "high", CreatedAt: hoursAgo(5)},
		{ID: "t2", Status: "resolved", Priority: "medium", CreatedAt: hoursAgo(30)},
		{ID: "t3", Status: "resolved", Priority: "medium", CreatedAt: hoursAgo(60)},
		{ID: "t4", Status: "resolved", Priority: "low", CreatedAt: hoursAgo(90)},
		{ID: "t5", Status: "closed", Priority: "high", CreatedAt: hoursAgo(120)},
		{ID: "t6", Status: "closed", Priority: "low", CreatedAt: hoursAgo(200)},
	}}
	svc := NewService(repo)
	ba, err := svc.GetBacklogAnalysis(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("GetBacklogAnalysis returned an error: %v", err)
	}
	if ba.Total != 6 {
		t.Fatalf("Total = %d, want 6", ba.Total)
	}
	want := map[string]int{"open": 1, "resolved": 3, "closed": 2}
	for status, n := range want {
		if ba.ByStatus[status] != n {
			t.Errorf("ByStatus[%q] = %d, want %d", status, ba.ByStatus[status], n)
		}
	}
	var sum int
	for _, n := range ba.ByStatus {
		sum += n
	}
	if sum != ba.Total {
		t.Errorf("ByStatus sums to %d but Total is %d", sum, ba.Total)
	}
	if ba.Oldest == nil || ba.Oldest.ID != "t6" {
		t.Errorf("Oldest = %+v, want t6", ba.Oldest)
	}
	if ba.ByPriority["medium"] != 2 || ba.ByPriority["high"] != 2 || ba.ByPriority["low"] != 2 {
		t.Errorf("ByPriority = %+v, want two of each", ba.ByPriority)
	}
}

// A tenant with an empty backlog is a legitimate answer, and the oldest
// pointer must stay nil rather than pointing at a zero Ticket.
func TestBacklogAnalysisEmptyTenant(t *testing.T) {
	ba, err := NewService(&wfRepo{}).GetBacklogAnalysis(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("GetBacklogAnalysis returned an error: %v", err)
	}
	if ba.Total != 0 || ba.Oldest != nil || len(ba.ByStatus) != 0 {
		t.Errorf("empty backlog = %+v, want Total 0 and no oldest", ba)
	}
}
