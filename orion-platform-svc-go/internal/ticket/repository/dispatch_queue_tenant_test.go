package repository

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

// Tenant scoping for dispatch_queue.
//
// Migration 686 declares dispatch_queue.tenant_id as NOT NULL and indexes it,
// and Enqueue already writes it, so the column is populated for every row this
// code can create. The reads and the DELETE never filtered on it, which means
// GET /tickets/dispatch/queue/sla-status, /sla-entries, POST /reprioritize,
// POST /auto-check and both dispatch routes each answered with every tenant's
// backlog, and RemoveFromQueue could delete another tenant's row once a ticket
// id was guessed.

func dispatchQueueCols() []string {
	return []string{
		"ticket_id", "tenant_id", "priority", "enqueued_at", "attempts", "last_error",
	}
}

func dispatchQueueRow(ticketID, tenantID, priority string, enqueuedAt time.Time, attempts int) *sqlmock.Rows {
	return sqlmock.NewRows(dispatchQueueCols()).AddRow(
		ticketID, tenantID, priority, enqueuedAt, int64(attempts), "",
	)
}

// assertQueueScoped reads the statement the driver actually received, so it is
// independent of the ExpectQuery fragment: softening either one alone still
// leaves a check behind.
func assertQueueScoped(t *testing.T, seen *[]string, method string) {
	t.Helper()
	if len(*seen) == 0 {
		t.Errorf("%s ran no statement", method)
		return
	}
	for i, sql := range *seen {
		if !strings.Contains(sql, "tenant_id = $1") {
			t.Errorf("%s ran an unscoped statement #%d: %q", method, i, sql)
		}
	}
}

func TestDispatchRepository_EnqueueWritesTenantID(t *testing.T) {
	db, mock, seen := slaMockDB(t)
	r := NewDispatchRepository(db)

	mock.ExpectExec("INSERT INTO dispatch_queue (ticket_id, tenant_id, priority, enqueued_at, attempts)").
		WithArgs("t-1", "ten-a", "high").
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := r.Enqueue(context.Background(), "t-1", "ten-a", "high"); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}
	// tenant_id is $2 here, not $1, so the shared helper would not apply.
	if !strings.Contains((*seen)[0], "tenant_id") {
		t.Errorf("INSERT does not list tenant_id: %s", (*seen)[0])
	}
}

// Dequeue is the read behind four mounted routes. A tenant-independent version
// is legal SQL because ticket_id alone is a valid predicate, so only an
// assertion over the executed statement catches it.
func TestDispatchRepository_DequeueIsTenantScoped(t *testing.T) {
	db, mock, seen := slaMockDB(t)
	r := NewDispatchRepository(db)

	mock.ExpectQuery("SELECT * FROM dispatch_queue WHERE tenant_id = $1 ORDER BY").
		WithArgs("ten-a", 100).
		WillReturnRows(dispatchQueueRow("t-1", "ten-a", "critical", time.Now(), 0))

	entries, err := r.Dequeue(context.Background(), "ten-a", 100)
	if err != nil {
		t.Fatalf("Dequeue: %v", err)
	}
	if len(entries) != 1 || entries[0].TenantID != "ten-a" {
		t.Errorf("entries = %+v, want the one ten-a row", entries)
	}
	if *seen == nil || len(*seen) != 1 {
		t.Fatalf("ran %d statements, want 1", len(*seen))
	}
	if !strings.Contains((*seen)[0], "LIMIT $2") {
		t.Errorf("limit is not bound as a parameter: %s", (*seen)[0])
	}
	assertQueueScoped(t, seen, "Dequeue")
}

// RemoveFromQueue runs after every successful dispatch. With tenant_id out of
// the clause, one tenant could dequeue another tenant's ticket by id.
func TestDispatchRepository_RemoveFromQueueIsTenantScoped(t *testing.T) {
	db, mock, seen := slaMockDB(t)
	r := NewDispatchRepository(db)

	mock.ExpectExec("DELETE FROM dispatch_queue WHERE tenant_id = $1 AND ticket_id = $2").
		WithArgs("ten-a", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.RemoveFromQueue(context.Background(), "ten-a", "t-1"); err != nil {
		t.Fatalf("RemoveFromQueue: %v", err)
	}
	assertQueueScoped(t, seen, "RemoveFromQueue")
}

// UpdateQueueEntry has no caller, but it is scoped so an unscoped variant does
// not come back the next time something uses it.
func TestDispatchRepository_UpdateQueueEntryIsTenantScoped(t *testing.T) {
	db, mock, seen := slaMockDB(t)
	r := NewDispatchRepository(db)

	mock.ExpectExec("UPDATE dispatch_queue SET attempts = $1, last_error = $2 WHERE tenant_id = $3 AND ticket_id = $4").
		WithArgs(3, "boom", "ten-a", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.UpdateQueueEntry(context.Background(), "ten-a", "t-1", "boom", 3); err != nil {
		t.Fatalf("UpdateQueueEntry: %v", err)
	}
	if !strings.Contains((*seen)[0], "tenant_id = $3") {
		t.Errorf("tenant predicate is not on the third placeholder: %s", (*seen)[0])
	}
}

// GetQueueStatus is three statements, so the predicate has to be in all three:
// dropping it from one leaks that figure while the other two look fine.
func TestDispatchRepository_GetQueueStatusScopesAllThreeStatements(t *testing.T) {
	db, mock, seen := slaMockDB(t)
	r := NewDispatchRepository(db)

	mock.ExpectQuery("SELECT COUNT(*) FROM dispatch_queue WHERE tenant_id = $1").
		WithArgs("ten-a").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(7)))
	mock.ExpectQuery("SELECT MIN(enqueued_at) FROM dispatch_queue WHERE tenant_id = $1").
		WithArgs("ten-a").
		WillReturnRows(sqlmock.NewRows([]string{"min"}).AddRow(time.Date(2026, 8, 25, 9, 0, 0, 0, time.UTC)))
	mock.ExpectQuery("COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - enqueued_at)) * 1000)").
		WithArgs("ten-a").
		WillReturnRows(sqlmock.NewRows([]string{"avg"}).AddRow(float64(4200)))

	status, err := r.GetQueueStatus(context.Background(), "ten-a")
	if err != nil {
		t.Fatalf("GetQueueStatus: %v", err)
	}
	if status.PendingCount != 7 {
		t.Errorf("PendingCount = %d, want 7", status.PendingCount)
	}
	if status.OldestEntry == nil {
		t.Errorf("OldestEntry = nil, want the earliest enqueued_at")
	}
	if status.AvgWaitMs != 4200 {
		t.Errorf("AvgWaitMs = %v, want 4200", status.AvgWaitMs)
	}
	if len(*seen) != 3 {
		t.Fatalf("ran %d statements, want 3", len(*seen))
	}
	assertQueueScoped(t, seen, "GetQueueStatus")
}

// A fault on any of the three must surface: answering with a zero-valued
// status would look like an empty queue.
func TestDispatchRepository_GetQueueStatusFaultSurfaces(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	r := NewDispatchRepository(db)

	want := errors.New("connection refused")
	mock.ExpectQuery("SELECT COUNT(*) FROM dispatch_queue WHERE tenant_id = $1").
		WithArgs("ten-a").
		WillReturnError(want)

	status, err := r.GetQueueStatus(context.Background(), "ten-a")
	if err == nil {
		t.Fatalf("err = nil, want the driver error; status was %+v", status)
	}
	if status != nil {
		t.Errorf("status = %+v, want nil alongside an error", status)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error", err.Error())
	}
	if !strings.Contains(err.Error(), "count pending") {
		t.Errorf("error = %q, want the step named", err.Error())
	}
}

// Dequeue is a read the caller cannot afford to get wrong, so its fault has to
// surface too.
func TestDispatchRepository_DequeueFaultSurfaces(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	r := NewDispatchRepository(db)

	want := errors.New("connection refused")
	mock.ExpectQuery("SELECT * FROM dispatch_queue WHERE tenant_id = $1 ORDER BY").
		WithArgs("ten-a", 100).
		WillReturnError(want)

	entries, err := r.Dequeue(context.Background(), "ten-a", 100)
	if err == nil {
		t.Fatalf("err = nil, want the driver error; %d entries returned", len(entries))
	}
	if entries != nil {
		t.Errorf("entries = %v, want nil alongside an error", entries)
	}
	if !errors.Is(err, want) {
		t.Fatalf("error = %q, want the driver error", err.Error())
	}
}
