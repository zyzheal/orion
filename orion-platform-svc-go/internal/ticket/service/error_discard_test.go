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
type discardFakeDispatch struct {
	entries        []models.DispatchQueueEntry
	engineers      map[string]*models.EngineerProfile
	dequeueErr     error
	getEngineerErr error
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
	return nil, nil
}
func (f *discardFakeDispatch) IncrementLoad(ctx context.Context, engineerID string) error {
	return nil
}
func (f *discardFakeDispatch) DecrementLoad(ctx context.Context, engineerID string) error {
	return nil
}
func (f *discardFakeDispatch) CreateRecord(ctx context.Context, rec *models.DispatchRecord) error {
	return nil
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
	return nil
}
func (f *discardFakeDispatch) Dequeue(ctx context.Context, limit int) ([]models.DispatchQueueEntry, error) {
	return f.entries, f.dequeueErr
}
func (f *discardFakeDispatch) RemoveFromQueue(ctx context.Context, ticketID string) error {
	return nil
}
func (f *discardFakeDispatch) UpdateQueueEntry(ctx context.Context, ticketID, lastError string, attempts int) error {
	return nil
}
func (f *discardFakeDispatch) GetQueueStatus(ctx context.Context) (*models.DispatchQueueStatus, error) {
	return nil, nil
}
func (f *discardFakeDispatch) GetMetrics(ctx context.Context, start, end time.Time) (*models.DispatchMetrics, error) {
	return nil, nil
}

// discardFakeSLA lets one test force sql.ErrNoRows and another force a driver
// fault; both shapes matter because the fix has to distinguish them.
type discardFakeSLA struct {
	record *models.SLARecord
	err    error
}

func (f *discardFakeSLA) CreateTarget(ctx context.Context, target *models.SLATarget) error {
	return nil
}
func (f *discardFakeSLA) ListTargets(ctx context.Context) ([]models.SLATarget, error) {
	return nil, nil
}
func (f *discardFakeSLA) GetTargetByPriority(ctx context.Context, priority string) (*models.SLATarget, error) {
	return nil, nil
}
func (f *discardFakeSLA) DeleteTarget(ctx context.Context, id string) error { return nil }
func (f *discardFakeSLA) CreateRecord(ctx context.Context, record *models.SLARecord) error {
	return nil
}
func (f *discardFakeSLA) GetRecordByTicket(ctx context.Context, ticketID string) (*models.SLARecord, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.record, nil
}
func (f *discardFakeSLA) UpdateRecord(ctx context.Context, record *models.SLARecord) error {
	return nil
}
func (f *discardFakeSLA) FindBreachedRecords(ctx context.Context) ([]models.SLARecord, error) {
	return nil, nil
}
func (f *discardFakeSLA) FindPendingRecords(ctx context.Context) ([]models.SLARecord, error) {
	return nil, nil
}
func (f *discardFakeSLA) PauseRecord(ctx context.Context, ticketID, reason string) error {
	return nil
}
func (f *discardFakeSLA) UnpauseRecord(ctx context.Context, ticketID string) error {
	return nil
}
func (f *discardFakeSLA) GetComplianceReport(ctx context.Context, start, end time.Time) (*models.SLAComplianceReport, error) {
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

	got, err := qm.GetSLAQueueEntries(context.Background())
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

	got, err := qm.GetSLAQueueEntries(context.Background())
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

	got, err := qm.GetSLAQueueEntries(context.Background())
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

	got, err := qm.GetSLAQueueEntries(context.Background())
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
	got, err := qm.GetSLAQueueEntries(context.Background())
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
}

func (f *discardFakeTransfer) Create(ctx context.Context, rec *models.TransferRecord) error {
	if f.createErr != nil {
		return f.createErr
	}
	f.created = append(f.created, rec)
	return nil
}
func (f *discardFakeTransfer) ListByTicket(ctx context.Context, ticketID string) ([]models.TransferRecord, error) {
	return nil, nil
}
func (f *discardFakeTransfer) GetStats(ctx context.Context, start, end time.Time) (map[string]any, error) {
	return nil, nil
}

type discardFakeTicket struct{}

func (f *discardFakeTicket) Create(ctx context.Context, ticket *models.Ticket) error {
	return nil
}
func (f *discardFakeTicket) GetByID(ctx context.Context, id, tenantID string) (*models.Ticket, error) {
	return nil, sql.ErrNoRows
}
func (f *discardFakeTicket) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Ticket, int, error) {
	return nil, 0, nil
}
func (f *discardFakeTicket) Update(ctx context.Context, ticket *models.Ticket) error { return nil }
func (f *discardFakeTicket) Delete(ctx context.Context, id, tenantID string) error   { return nil }
func (f *discardFakeTicket) UpdateStatus(ctx context.Context, id, tenantID, status string) error {
	return nil
}
func (f *discardFakeTicket) UpdateAssignee(ctx context.Context, id, tenantID, assignedTo string) error {
	return nil
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

func require_NoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
