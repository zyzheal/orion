package service

// Regression tests for the two discarded repository errors on mounted routes.
//
// The repositories in internal/ticket/repository take *database.DB rather than
// *sqlx.DB, so go-sqlmock cannot stand in for them. These tests instead drive
// the services through the interfaces declared in
// internal/ticket/repository/interfaces.go, which is the seam the production
// wiring uses anyway.

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/ticket/models"
)

// discardFakeDispatch serves queue entries and engineers without touching a DB.
//
// seen records every tenant-scoped call as "Method:tenantID" so a test can prove
// the tenant actually reached the repository call site. Without it a fix that
// threads tenantID to the interface but drops it at the call would still return
// the right rows from these fakes and pass.
type discardFakeDispatch struct {
	entries        []models.DispatchQueueEntry
	engineers      map[string]*models.EngineerProfile
	dequeueErr     error
	getEngineerErr error
	enqueueErr     error
	recordErr      error
	status         *models.DispatchQueueStatus
	statusErr      error
	incrementErr   error
	decrementErr   error
	removeErr      error
	seen           []string
	allEngineers   []models.EngineerProfile
}

// wantSeen fails the test unless a tenant-scoped call reached the fake with the
// tenant the caller was told to act for.
func wantSeen(t *testing.T, f *discardFakeDispatch, call string) {
	t.Helper()
	for _, s := range f.seen {
		if s == call {
			return
		}
	}
	t.Fatalf("repository never received %q; got %v", call, f.seen)
}

func (f *discardFakeDispatch) CreateEngineer(ctx context.Context, ep *models.EngineerProfile) error {
	return nil
}
func (f *discardFakeDispatch) UpdateEngineer(ctx context.Context, ep *models.EngineerProfile) error {
	return nil
}
func (f *discardFakeDispatch) GetEngineer(ctx context.Context, id string) (*models.EngineerProfile, error) {
	if f.getEngineerErr != nil {
		return nil, f.getEngineerErr
	}
	if f.engineers == nil {
		return nil, sql.ErrNoRows
	}
	ep, ok := f.engineers[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return ep, nil
}
func (f *discardFakeDispatch) ListEngineers(ctx context.Context) ([]models.EngineerProfile, error) {
	return f.allEngineers, nil
}
func (f *discardFakeDispatch) IncrementLoad(ctx context.Context, engineerID string) error {
	return f.incrementErr
}
func (f *discardFakeDispatch) DecrementLoad(ctx context.Context, engineerID string) error {
	return f.decrementErr
}
func (f *discardFakeDispatch) CreateRecord(ctx context.Context, rec *models.DispatchRecord) error {
	return f.recordErr
}
func (f *discardFakeDispatch) GetRecordByTicket(ctx context.Context, ticketID string) (*models.DispatchRecord, error) {
	return nil, sql.ErrNoRows
}
func (f *discardFakeDispatch) ListRecordsByEngineer(ctx context.Context, engineerID string, limit int) ([]models.DispatchRecord, error) {
	return nil, nil
}
func (f *discardFakeDispatch) CreateRule(ctx context.Context, rule *models.DispatchRule) error {
	return nil
}
func (f *discardFakeDispatch) ListRules(ctx context.Context) ([]models.DispatchRule, error) {
	return nil, nil
}
func (f *discardFakeDispatch) DeleteRule(ctx context.Context, id string) error {
	return nil
}
func (f *discardFakeDispatch) Enqueue(ctx context.Context, ticketID, tenantID, priority string) error {
	f.seen = append(f.seen, "Enqueue:"+tenantID)
	return f.enqueueErr
}
func (f *discardFakeDispatch) Dequeue(ctx context.Context, tenantID string, limit int) ([]models.DispatchQueueEntry, error) {
	f.seen = append(f.seen, "Dequeue:"+tenantID)
	return f.entries, f.dequeueErr
}
func (f *discardFakeDispatch) RemoveFromQueue(ctx context.Context, tenantID, ticketID string) error {
	f.seen = append(f.seen, "RemoveFromQueue:"+tenantID)
	return f.removeErr
}
func (f *discardFakeDispatch) UpdateQueueEntry(ctx context.Context, tenantID, ticketID, lastError string, attempts int) error {
	return nil
}
func (f *discardFakeDispatch) GetQueueStatus(ctx context.Context, tenantID string) (*models.DispatchQueueStatus, error) {
	f.seen = append(f.seen, "GetQueueStatus:"+tenantID)
	return f.status, f.statusErr
}
func (f *discardFakeDispatch) GetMetrics(ctx context.Context, start, end time.Time) (*models.DispatchMetrics, error) {
	return nil, nil
}

// discardFakeSLA lets one test force sql.ErrNoRows and another force a driver
// fault; both shapes matter because the fix has to distinguish them.
type discardFakeSLA struct {
	record    *models.SLARecord
	err       error
	pending   []models.SLARecord
	updateErr error
	updated   []*models.SLARecord
	seen      []string
}

func (f *discardFakeSLA) CreateTarget(ctx context.Context, target *models.SLATarget) error {
	return nil
}
func (f *discardFakeSLA) ListTargets(ctx context.Context, tenantID string) ([]models.SLATarget, error) {
	return nil, nil
}
func (f *discardFakeSLA) GetTargetByPriority(ctx context.Context, tenantID, priority string) (*models.SLATarget, error) {
	return nil, nil
}
func (f *discardFakeSLA) DeleteTarget(ctx context.Context, tenantID, id string) error { return nil }
func (f *discardFakeSLA) CreateRecord(ctx context.Context, record *models.SLARecord) error {
	return nil
}
func (f *discardFakeSLA) GetRecordByTicket(ctx context.Context, tenantID, ticketID string) (*models.SLARecord, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.record, nil
}
func (f *discardFakeSLA) UpdateRecord(ctx context.Context, record *models.SLARecord) error {
	if f.updateErr != nil {
		return f.updateErr
	}
	f.updated = append(f.updated, record)
	return nil
}
func (f *discardFakeSLA) FindBreachedRecords(ctx context.Context, tenantID string) ([]models.SLARecord, error) {
	return nil, nil
}
func (f *discardFakeSLA) FindPendingRecords(ctx context.Context, tenantID string) ([]models.SLARecord, error) {
	f.seen = append(f.seen, "FindPendingRecords:"+tenantID)
	return f.pending, nil
}
func (f *discardFakeSLA) PauseRecord(ctx context.Context, tenantID, ticketID, reason string) error {
	return nil
}
func (f *discardFakeSLA) UnpauseRecord(ctx context.Context, tenantID, ticketID string) error {
	return nil
}
func (f *discardFakeSLA) GetComplianceReport(ctx context.Context, tenantID string, start, end time.Time) (*models.SLAComplianceReport, error) {
	return nil, nil
}

// ---------------------------------------------------------------- F-B
//
// GET /tickets/dispatch/queue/sla-entries.

func TestGetSLAQueueEntries_NoSLARecordIsNotAFault(t *testing.T) {
	dispatch := &discardFakeDispatch{
		entries: []models.DispatchQueueEntry{{
			TicketID: "t-1", TenantID: "ten", Priority: "high",
			EnqueuedAt: time.Now().Add(-time.Minute),
		}},
	}
	qm := NewQueueManager(dispatch, &discardFakeSLA{err: sql.ErrNoRows})

	got, err := qm.GetSLAQueueEntries(context.Background(), "ten")
	require_NoError(t, err)
	if len(got) != 1 {
		t.Fatalf("returned %d entries, want 1: a ticket without an SLA record still belongs in the queue", len(got))
	}
	if got[0].SLADeadline != nil {
		t.Errorf("SLADeadline = %v, want nil: there is no record to read a deadline from", got[0].SLADeadline)
	}
	if got[0].EscalationLevel != 0 {
		t.Errorf("EscalationLevel = %d, want 0", got[0].EscalationLevel)
	}
}

// The discarded error was the real defect: with it swallowed, a refused
// connection answered 200 with deadline-less entries, indistinguishable from a
// healthy queue. The response must fail.
func TestGetSLAQueueEntries_SLARepositoryFaultSurfaces(t *testing.T) {
	want := errors.New("connection refused")
	dispatch := &discardFakeDispatch{
		entries: []models.DispatchQueueEntry{{
			TicketID: "t-1", TenantID: "ten", Priority: "high",
			EnqueuedAt: time.Now().Add(-time.Minute),
		}},
	}
	qm := NewQueueManager(dispatch, &discardFakeSLA{err: want})

	got, err := qm.GetSLAQueueEntries(context.Background(), "ten")
	if err == nil {
		t.Fatalf("err = nil, want the driver error; %d stale entries returned", len(got))
	}
	if got != nil {
		t.Errorf("returned %v, want nil alongside an error", got)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error intact", err.Error())
	}
	if !strings.Contains(err.Error(), "t-1") {
		t.Errorf("error = %q, want the ticket id so the operator knows which row failed", err.Error())
	}
}

// A wrapped ErrNoRows must be treated like a bare one: an implementation that
// wraps the driver error is common, and == would miss it.
func TestGetSLAQueueEntries_WrappedNoRowsIsStillNotAFault(t *testing.T) {
	dispatch := &discardFakeDispatch{
		entries: []models.DispatchQueueEntry{{
			TicketID: "t-1", TenantID: "ten", Priority: "low",
			EnqueuedAt: time.Now(),
		}},
	}
	wrapped := errors.Join(errors.New("wrapper"), sql.ErrNoRows)
	qm := NewQueueManager(dispatch, &discardFakeSLA{err: wrapped})

	got, err := qm.GetSLAQueueEntries(context.Background(), "ten")
	require_NoError(t, err)
	if len(got) != 1 {
		t.Fatalf("returned %d entries, want 1", len(got))
	}
}

// The happy path: a record is present, so the deadline is surfaced.
func TestGetSLAQueueEntries_SLARecordSurfacesTheDeadline(t *testing.T) {
	// 3h of a 3h1m window is ~99.7% elapsed, which the code escalates to
	// level 2 (>=90). 2h of a 2h30m window would be 80% and only level 1, so
	// the fixture has to sit in the upper band to prove the branch is reached.
	created := time.Now().Add(-3 * time.Hour)
	deadline := time.Now().Add(time.Minute)
	dispatch := &discardFakeDispatch{
		entries: []models.DispatchQueueEntry{{
			TicketID: "t-1", TenantID: "ten", Priority: "critical",
			EnqueuedAt: time.Now(),
		}},
	}
	sla := &discardFakeSLA{record: &models.SLARecord{
		TicketID: "t-1", CreatedAt: created, ResolutionDeadlineAt: deadline,
	}}
	qm := NewQueueManager(dispatch, sla)

	got, err := qm.GetSLAQueueEntries(context.Background(), "ten")
	require_NoError(t, err)
	if len(got) != 1 {
		t.Fatalf("returned %d entries, want 1", len(got))
	}
	if got[0].SLADeadline == nil || !got[0].SLADeadline.Equal(deadline) {
		t.Fatalf("SLADeadline = %v, want %v", got[0].SLADeadline, deadline)
	}
	if got[0].EscalationLevel != 2 {
		t.Errorf("EscalationLevel = %d, want 2 at this elapsed fraction", got[0].EscalationLevel)
	}
}

// A Dequeue fault must also surface, since GetSLAQueueEntries is the mounted
// entry point.
func TestGetSLAQueueEntries_DequeueFaultSurfaces(t *testing.T) {
	want := errors.New("no such relation")
	qm := NewQueueManager(&discardFakeDispatch{dequeueErr: want}, &discardFakeSLA{})
	got, err := qm.GetSLAQueueEntries(context.Background(), "ten")
	if err == nil {
		t.Fatalf("err = nil, want the driver error")
	}
	if got != nil {
		t.Errorf("returned %v, want nil alongside an error", got)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error", err.Error())
	}
}

// ---------------------------------------------------------------- F-A
//
// POST /tickets/transfer/suspend/:suspendId.

type discardFakeSuspend struct {
	record     *models.SuspendRecord
	getErr     error
	pending    int
	pendingErr error
}

func (f *discardFakeSuspend) Create(ctx context.Context, rec *models.SuspendRecord) error {
	return nil
}
func (f *discardFakeSuspend) GetByID(ctx context.Context, id string) (*models.SuspendRecord, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	if f.record == nil || f.record.ID != id {
		return nil, sql.ErrNoRows
	}
	return f.record, nil
}
func (f *discardFakeSuspend) Update(ctx context.Context, rec *models.SuspendRecord) error {
	return nil
}
func (f *discardFakeSuspend) ListByStatus(ctx context.Context, status string) ([]models.SuspendRecord, error) {
	return nil, nil
}
func (f *discardFakeSuspend) ListByEngineer(ctx context.Context, engineerID string) ([]models.SuspendRecord, error) {
	return nil, nil
}
func (f *discardFakeSuspend) FindActiveByEngineer(ctx context.Context, engineerID string) (*models.SuspendRecord, error) {
	return nil, sql.ErrNoRows
}
func (f *discardFakeSuspend) CountPendingByEngineer(ctx context.Context, engineerID string) (int, error) {
	return f.pending, f.pendingErr
}
func (f *discardFakeSuspend) CountActiveByEngineer(ctx context.Context, engineerID string) (int, error) {
	return 0, nil
}

type discardFakeTransfer struct {
	created   []*models.TransferRecord
	createErr error
	listErr   error
}

func (f *discardFakeTransfer) Create(ctx context.Context, rec *models.TransferRecord) error {
	if f.createErr != nil {
		return f.createErr
	}
	f.created = append(f.created, rec)
	return nil
}
func (f *discardFakeTransfer) ListByTicket(ctx context.Context, ticketID string) ([]models.TransferRecord, error) {
	return nil, f.listErr
}
func (f *discardFakeTransfer) GetStats(ctx context.Context, start, end time.Time) (map[string]any, error) {
	return nil, nil
}

type discardFakeTicket struct {
	ticket    *models.Ticket
	assignErr error
	statusErr error
}

func (f *discardFakeTicket) Create(ctx context.Context, ticket *models.Ticket) error {
	return nil
}
func (f *discardFakeTicket) GetByID(ctx context.Context, id, tenantID string) (*models.Ticket, error) {
	if f.ticket == nil {
		return nil, sql.ErrNoRows
	}
	return f.ticket, nil
}
func (f *discardFakeTicket) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Ticket, int, error) {
	return nil, 0, nil
}
func (f *discardFakeTicket) Update(ctx context.Context, ticket *models.Ticket) error { return nil }
func (f *discardFakeTicket) Delete(ctx context.Context, id, tenantID string) error   { return nil }
func (f *discardFakeTicket) UpdateStatus(ctx context.Context, id, tenantID, status string) error {
	return f.statusErr
}
func (f *discardFakeTicket) UpdateAssignee(ctx context.Context, id, tenantID, assignedTo string) error {
	return f.assignErr
}
func (f *discardFakeTicket) Count(ctx context.Context, tenantID string) (int, error) { return 0, nil }

// The discarded error was the defect: database/sql reports 0 for a failed
// COUNT, so a refused connection read as "this engineer has nothing pending"
// and answered 200 with {"transfers":null,"count":0}. The suspension was still
// in force. The response must fail instead.
func TestTransferDueToSuspend_CountFailureIsNotSilent(t *testing.T) {
	want := errors.New("connection refused")
	suspend := &discardFakeSuspend{
		record:     &models.SuspendRecord{ID: "s-1", Status: "active", EngineerID: "eng-1"},
		pendingErr: want,
	}
	svc := NewTransferService(&discardFakeTransfer{}, &discardFakeTicket{}, &discardFakeDispatch{}, suspend)

	got, err := svc.TransferDueToSuspend(context.Background(), "s-1")
	if err == nil {
		t.Fatalf("err = nil, want the driver error; the suspension is still in force")
	}
	if got != nil {
		t.Errorf("returned %v, want nil alongside an error", got)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error intact", err.Error())
	}
	if !strings.Contains(err.Error(), "eng-1") {
		t.Errorf("error = %q, want the engineer id", err.Error())
	}
}

// An empty count is a legitimate outcome, not a fault: this pins that the fix
// propagates driver errors only and did not turn a quiet engineer into a 500.
func TestTransferDueToSuspend_LegitimatelyEmptyCountReturnsNil(t *testing.T) {
	svc := NewTransferService(&discardFakeTransfer{}, &discardFakeTicket{}, &discardFakeDispatch{},
		&discardFakeSuspend{
			record:  &models.SuspendRecord{ID: "s-1", Status: "active", EngineerID: "eng-1"},
			pending: 0,
		})

	got, err := svc.TransferDueToSuspend(context.Background(), "s-1")
	require_NoError(t, err)
	if got != nil {
		t.Errorf("returned %v, want nil: nothing to transfer", got)
	}
}

// A fault before the count must still be reported with its own context.
func TestTransferDueToSuspend_AbsentSuspendReturnsNotFoundShapedError(t *testing.T) {
	svc := NewTransferService(&discardFakeTransfer{}, &discardFakeTicket{}, &discardFakeDispatch{},
		&discardFakeSuspend{})

	got, err := svc.TransferDueToSuspend(context.Background(), "nope")
	if err == nil {
		t.Fatalf("err = nil, want an error for an absent suspend record")
	}
	if got != nil {
		t.Errorf("returned %v, want nil", got)
	}
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("error = %q, want the repository error preserved", err.Error())
	}
}

// The happy path still performs the work: two pending tickets, a backup with
// capacity, two transfers written.
func TestTransferDueToSuspend_TransfersPendingTicketsToTheBackup(t *testing.T) {
	tr := &discardFakeTransfer{}
	dispatch := &discardFakeDispatch{engineers: map[string]*models.EngineerProfile{
		"eng-9": {ID: "eng-9", CurrentLoad: 0, MaxCapacity: 5},
	}}
	svc := NewTransferService(tr, &discardFakeTicket{}, dispatch,
		&discardFakeSuspend{
			record: &models.SuspendRecord{
				ID: "s-1", Status: "active", EngineerID: "eng-1",
				BackupEngineerID: "eng-9", Reason: "planned leave",
			},
			pending: 2,
		})

	got, err := svc.TransferDueToSuspend(context.Background(), "s-1")
	require_NoError(t, err)
	if len(got) != 2 {
		t.Fatalf("returned %d transfers, want 2", len(got))
	}
	if len(tr.created) != 2 {
		t.Fatalf("persisted %d transfers, want 2", len(tr.created))
	}
	if got[0].ToEngineerID != "eng-9" || got[0].FromEngineerID != "eng-1" {
		t.Errorf("transfer = %+v, want eng-1 -> eng-9", got[0])
	}
}

// A non-active suspension is a business error, not a database fault.
func TestTransferDueToSuspend_InactiveSuspendIsRejected(t *testing.T) {
	svc := NewTransferService(&discardFakeTransfer{}, &discardFakeTicket{}, &discardFakeDispatch{},
		&discardFakeSuspend{
			record:  &models.SuspendRecord{ID: "s-1", Status: "scheduled", EngineerID: "eng-1"},
			pending: 5,
		})

	got, err := svc.TransferDueToSuspend(context.Background(), "s-1")
	if err == nil {
		t.Fatalf("err = nil, want an error for a non-active suspension")
	}
	if got != nil {
		t.Errorf("returned %v, want nil", got)
	}
	if !strings.Contains(err.Error(), "not active") {
		t.Errorf("error = %q, want the not-active reason", err.Error())
	}
}

// ---------------------------------------------------------------- F-C
//
// POST /tickets/:id/dispatch/auto and POST /tickets/:id/dispatch/manual.
//
// These are the fire-and-forget tail of DispatchService: the ticket assignment,
// the status change, the engineer load counter and the queue row all used to be
// written with the error thrown away, so the route answered 200 with a
// DispatchRecord while the ticket could still read open and unassigned.

func dispatchFixture() (*discardFakeDispatch, *discardFakeTicket) {
	eng := &models.EngineerProfile{
		ID: "eng-1", Name: "Ana", MaxCapacity: 5, CurrentLoad: 0,
		Availability: models.AvailabilityAvailable,
	}
	// allEngineers drives FindBestEngineer; engineers answers GetEngineer, which
	// ManualDispatch calls first.
	dispatch := &discardFakeDispatch{
		allEngineers: []models.EngineerProfile{*eng},
		engineers:    map[string]*models.EngineerProfile{"eng-1": eng},
	}
	ticket := &discardFakeTicket{ticket: &models.Ticket{
		ID: "t-1", TenantID: "ten-a", Priority: "high", AssignedTo: "eng-0",
	}}
	return dispatch, ticket
}

func TestAutoDispatch_IncrementLoadFaultSurfaces(t *testing.T) {
	want := errors.New("deadlock detected")
	dispatch, ticket := dispatchFixture()
	dispatch.incrementErr = want
	svc := NewDispatchService(dispatch, ticket, &discardFakeSLA{})

	got, err := svc.AutoDispatch(context.Background(), "t-1", "ten-a", "op-1")
	if err == nil {
		t.Fatalf("err = nil, want the driver error; record was %+v", got)
	}
	if got != nil {
		t.Errorf("returned %v, want nil alongside an error", got)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error", err.Error())
	}
	if !strings.Contains(err.Error(), "increment load") {
		t.Errorf("error = %q, want the step named", err.Error())
	}
}

// The last write in the chain: if it fails the ticket was assigned and its load
// was counted but the queue row remains, so the same ticket is dispatchable a
// second time. The caller has to know.
func TestAutoDispatch_RemoveFromQueueFaultSurfaces(t *testing.T) {
	want := errors.New("no such table")
	dispatch, ticket := dispatchFixture()
	dispatch.removeErr = want
	svc := NewDispatchService(dispatch, ticket, &discardFakeSLA{})

	got, err := svc.AutoDispatch(context.Background(), "t-1", "ten-a", "op-1")
	if err == nil {
		t.Fatalf("err = nil, want the driver error; record was %+v", got)
	}
	if got != nil {
		t.Errorf("returned %v, want nil alongside an error", got)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error", err.Error())
	}
	if !strings.Contains(err.Error(), "remove from queue") {
		t.Errorf("error = %q, want the step named", err.Error())
	}
	wantSeen(t, dispatch, "RemoveFromQueue:ten-a")
}

// ManualDispatch shares the same tail.
func TestManualDispatch_UpdateStatusFaultSurfaces(t *testing.T) {
	want := errors.New("row not found")
	dispatch, ticket := dispatchFixture()
	ticket.statusErr = want
	svc := NewDispatchService(dispatch, ticket, &discardFakeSLA{})

	got, err := svc.ManualDispatch(context.Background(), "t-1", "ten-a", "eng-1", "op-1", "manual")
	if err == nil {
		t.Fatalf("err = nil, want the driver error; record was %+v", got)
	}
	if got != nil {
		t.Errorf("returned %v, want nil alongside an error", got)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error", err.Error())
	}
	if !strings.Contains(err.Error(), "update status") {
		t.Errorf("error = %q, want the step named", err.Error())
	}
}

// The enqueue half: the error text promises the ticket was queued, so a failed
// INSERT must not be discarded.
func TestAutoDispatch_NoEngineerAndEnqueueFails(t *testing.T) {
	want := errors.New("connection refused")
	dispatch, ticket := dispatchFixture()
	dispatch.allEngineers = nil // makes FindBestEngineer fail
	dispatch.enqueueErr = want
	svc := NewDispatchService(dispatch, ticket, &discardFakeSLA{})

	got, err := svc.AutoDispatch(context.Background(), "t-1", "ten-a", "op-1")
	if err == nil {
		t.Fatalf("err = nil, want the enqueue fault; record was %+v", got)
	}
	if got != nil {
		t.Errorf("returned %v, want nil alongside an error", got)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error", err.Error())
	}
	if !strings.Contains(err.Error(), "enqueue failed") {
		t.Errorf("error = %q, want it to say the enqueue failed", err.Error())
	}
}

// The happy path still finishes the whole tail and keeps the queue scoped to
// the caller's tenant.
func TestAutoDispatch_HappyPathScopesEveryWrite(t *testing.T) {
	dispatch, ticket := dispatchFixture()
	svc := NewDispatchService(dispatch, ticket, &discardFakeSLA{})

	got, err := svc.AutoDispatch(context.Background(), "t-1", "ten-a", "op-1")
	require_NoError(t, err)
	if got == nil || got.EngineerID != "eng-1" {
		t.Fatalf("record = %+v, want eng-1 assigned", got)
	}
	wantSeen(t, dispatch, "RemoveFromQueue:ten-a")
}

// ---------------------------------------------------------------- F-D
//
// GET /tickets/sla/breaches, via SLAService.CheckBreaches.

func TestCheckBreaches_UpdateRecordFaultSurfaces(t *testing.T) {
	want := errors.New("connection refused")
	sla := &discardFakeSLA{
		pending: []models.SLARecord{{
			// RespondedAt stays nil: with it set the response-breach branch is
			// skipped and no update is issued at all, so the injected fault
			// would never be reached and the test would prove nothing.
			TicketID:             "t-42",
			ResponseDeadlineAt:   time.Now().Add(-time.Hour),
			ResolutionDeadlineAt: time.Now().Add(time.Hour),
		}},
		updateErr: want,
	}
	svc := NewSLAService(sla, &discardFakeTicket{})

	got, err := svc.CheckBreaches(context.Background(), "ten-a")
	if err == nil {
		t.Fatalf("err = nil, want the driver error; %d breaches reported as written", len(got))
	}
	if got != nil {
		t.Errorf("returned %v, want nil alongside an error", got)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error", err.Error())
	}
	if !strings.Contains(err.Error(), "t-42") {
		t.Errorf("error = %q, want the ticket id", err.Error())
	}
	if len(sla.updated) != 0 {
		t.Errorf("wrote %d rows after the fault, want 0", len(sla.updated))
	}
	if len(sla.seen) != 1 || sla.seen[0] != "FindPendingRecords:ten-a" {
		t.Errorf("service saw %v, want the pending scan scoped to ten-a", sla.seen)
	}
}

// A resolved-and-responded record is not a breach, so no update is issued and no
// fault can surface: this pins that the fix did not turn the quiet path into a
// 500.
func TestCheckBreaches_NoBreachWritesNothing(t *testing.T) {
	sla := &discardFakeSLA{
		pending: []models.SLARecord{{
			TicketID:             "t-43",
			RespondedAt:          timePtr(time.Now().Add(-time.Minute)),
			ResponseDeadlineAt:   time.Now().Add(time.Hour),
			ResolutionDeadlineAt: time.Now().Add(time.Hour),
		}},
	}
	svc := NewSLAService(sla, &discardFakeTicket{})

	got, err := svc.CheckBreaches(context.Background(), "ten-a")
	require_NoError(t, err)
	if len(got) != 0 {
		t.Fatalf("returned %d breaches, want 0", len(got))
	}
	if len(sla.updated) != 0 {
		t.Errorf("wrote %d rows, want 0", len(sla.updated))
	}
}

// The resolution branch is the one that fires first: a resolution deadline in
// the past takes the if, and the response deadline is never looked at. Only this
// fixture reaches that branch, so its fault needs its own test.
func TestCheckBreaches_ResolutionUpdateRecordFaultSurfaces(t *testing.T) {
	want := errors.New("unique violation")
	sla := &discardFakeSLA{
		pending: []models.SLARecord{{
			TicketID:             "t-45",
			ResponseDeadlineAt:   time.Now().Add(time.Hour),
			ResolutionDeadlineAt: time.Now().Add(-time.Hour),
		}},
		updateErr: want,
	}
	svc := NewSLAService(sla, &discardFakeTicket{})

	got, err := svc.CheckBreaches(context.Background(), "ten-a")
	if err == nil {
		t.Fatalf("err = nil, want the driver error; %d breaches reported as written", len(got))
	}
	if got != nil {
		t.Errorf("returned %v, want nil alongside an error", got)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error", err.Error())
	}
	if !strings.Contains(err.Error(), "t-45") {
		t.Errorf("error = %q, want the ticket id", err.Error())
	}
	if len(sla.updated) != 0 {
		t.Errorf("wrote %d rows after the fault, want 0", len(sla.updated))
	}
}

// The breach itself still gets recorded and returned.
func TestCheckBreaches_ResolutionBreachIsMarkedAndReturned(t *testing.T) {
	sla := &discardFakeSLA{
		pending: []models.SLARecord{{
			TicketID:             "t-44",
			ResponseDeadlineAt:   time.Now().Add(time.Hour),
			ResolutionDeadlineAt: time.Now().Add(-time.Minute),
		}},
	}
	svc := NewSLAService(sla, &discardFakeTicket{})

	got, err := svc.CheckBreaches(context.Background(), "ten-a")
	require_NoError(t, err)
	if len(got) != 1 || got[0].BreachType != "resolution" {
		t.Fatalf("breaches = %+v, want one resolution breach", got)
	}
	if len(sla.updated) != 1 || !sla.updated[0].Breached {
		t.Fatalf("wrote %+v, want one breached row", sla.updated)
	}
}

// ---------------------------------------------------------------- F-E
//
// POST /tickets/transfer/auto-check and the manual transfer path.

func TestManualTransfer_TransferLimitReadFaultSurfaces(t *testing.T) {
	want := errors.New("connection refused")
	dispatch, ticket := dispatchFixture()
	svc := NewTransferService(&discardFakeTransfer{listErr: want}, ticket, dispatch, &discardFakeSuspend{})

	got, err := svc.ManualTransfer(context.Background(), "t-1", "ten-a", "eng-1", "op-1", "handover")
	if err == nil {
		t.Fatalf("err = nil, want the driver error; the max-transfer guard was skipped; got %+v", got)
	}
	if got != nil {
		t.Errorf("returned %v, want nil alongside an error", got)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error", err.Error())
	}
}

func TestManualTransfer_DecrementLoadFaultSurfaces(t *testing.T) {
	want := errors.New("deadlock detected")
	dispatch, ticket := dispatchFixture()
	dispatch.decrementErr = want
	svc := NewTransferService(&discardFakeTransfer{}, ticket, dispatch, &discardFakeSuspend{})

	got, err := svc.ManualTransfer(context.Background(), "t-1", "ten-a", "eng-1", "op-1", "handover")
	if err == nil {
		t.Fatalf("err = nil, want the driver error; got %+v", got)
	}
	if got != nil {
		t.Errorf("returned %v, want nil alongside an error", got)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error", err.Error())
	}
	if !strings.Contains(err.Error(), "decrement load") {
		t.Errorf("error = %q, want the step named", err.Error())
	}
}

func TestManualTransfer_DispatchRecordFaultSurfaces(t *testing.T) {
	want := errors.New("duplicate key")
	dispatch, ticket := dispatchFixture()
	dispatch.recordErr = want
	svc := NewTransferService(&discardFakeTransfer{}, ticket, dispatch, &discardFakeSuspend{})

	got, err := svc.ManualTransfer(context.Background(), "t-1", "ten-a", "eng-1", "op-1", "handover")
	if err == nil {
		t.Fatalf("err = nil, want the driver error; got %+v", got)
	}
	if got != nil {
		t.Errorf("returned %v, want nil alongside an error", got)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error", err.Error())
	}
	if !strings.Contains(err.Error(), "create dispatch record") {
		t.Errorf("error = %q, want the step named", err.Error())
	}
}

// ---------------------------------------------------------------- F-F
//
// POST /tickets/dispatch/queue/reprioritize. The count is read-only today, but
// the read must be tenant scoped.

func TestReprioritizeAll_ScopesDequeueToTenant(t *testing.T) {
	dispatch := &discardFakeDispatch{entries: []models.DispatchQueueEntry{{
		TicketID: "t-1", TenantID: "ten-a", Priority: "medium",
		EnqueuedAt: time.Now().Add(-time.Hour),
	}}}
	qm := NewQueueManager(dispatch, &discardFakeSLA{})

	count, err := qm.ReprioritizeAll(context.Background(), "ten-b")
	require_NoError(t, err)
	if count != 1 {
		t.Fatalf("count = %d, want 1", count)
	}
	wantSeen(t, dispatch, "Dequeue:ten-b")
}

func require_NoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
