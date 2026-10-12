package eventstore

import (
	"context"
	"database/sql"
	"errors"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"

	"orion/platform-svc-go/internal/domain/events"
)

// TestPostgreSQLEventStore_Append_Real asserts the real PostgreSQLEventStore
// (not the mockEventStore sibling) issues the expected INSERT into
// domain_events and commits the transaction.
func TestPostgreSQLEventStore_Append_Real(t *testing.T) {
	raw, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer raw.Close()
	es := NewPostgreSQLEventStore(sqlx.NewDb(raw, "postgres"))

	mock.ExpectBegin()
	mock.ExpectExec(`INSERT INTO domain_events`).
		WithArgs(
			sqlmock.AnyArg(), // id (uuid generated inside Append)
			"pipeline",
			"pipe-1",
			"tenant-1",
			"pipeline.created",
			sqlmock.AnyArg(), // JSON blob
			sqlmock.AnyArg(), // occurred_at
			sqlmock.AnyArg(), // correlation_id
			sqlmock.AnyArg(), // causation_id
			sqlmock.AnyArg(), // created_at
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	ev := &MockDomainEvent{
		aggregateType: "pipeline", aggregateID: "pipe-1",
		tenantID: "tenant-1", eventType: "pipeline.created",
		occurredAt: time.Now().UTC(),
	}
	if err := es.Append(context.Background(), ev); err != nil {
		t.Fatalf("Append: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("sqlmock: %v", err)
	}
}

// TestPostgreSQLEventStore_Append_Empty does not touch the DB.
func TestPostgreSQLEventStore_Append_Empty(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	es := NewPostgreSQLEventStore(sqlx.NewDb(raw, "postgres"))

	if err := es.Append(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("expected no DB calls, got: %v", err)
	}
}

// TestPostgreSQLEventStore_Append_MarshalError rolls back the transaction.
func TestPostgreSQLEventStore_Append_MarshalError_Rollback(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	es := NewPostgreSQLEventStore(sqlx.NewDb(raw, "postgres"))

	mock.ExpectBegin()
	mock.ExpectRollback()

	// An event whose EventType is a string but the payload is unmarshalable
	// can be simulated by returning a JSON-invalid value via a helper event.
	if err := es.Append(context.Background(), &unmarshalableEvent{}); err == nil {
		t.Error("expected error for unmarshalable event, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("expected begin+rollback: %v", err)
	}
}

// unmarshalableEvent is a DomainEvent whose json.Marshal fails.
type unmarshalableEvent struct{}

func (e *unmarshalableEvent) MarshalJSON() ([]byte, error) {
	return nil, errors.New("boom")
}
func (e *unmarshalableEvent) AggregateType() string    { return "x" }
func (e *unmarshalableEvent) AggregateID() string      { return "x" }
func (e *unmarshalableEvent) TenantID() string         { return "x" }
func (e *unmarshalableEvent) EventType() string        { return "x" }
func (e *unmarshalableEvent) OccurredAt() time.Time    { return time.Time{} }
func (e *unmarshalableEvent) Version() int             { return 0 }
func (e *unmarshalableEvent) SetAggregateID(string)    {}
func (e *unmarshalableEvent) SetTenantID(string)       {}
func (e *unmarshalableEvent) SetVersion(int)           {}

// TestPostgreSQLEventStore_Append_InsertError rolls back and wraps the error.
func TestPostgreSQLEventStore_Append_InsertError_Rollback(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	es := NewPostgreSQLEventStore(sqlx.NewDb(raw, "postgres"))

	mock.ExpectBegin()
	mock.ExpectExec(`INSERT INTO domain_events`).WillReturnError(errors.New("insert failed"))
	mock.ExpectRollback()

	err := es.Append(context.Background(), &MockDomainEvent{
		aggregateType: "pipeline", aggregateID: "pipe-1",
		tenantID: "tenant-1", eventType: "pipeline.created",
		occurredAt: time.Now().UTC(),
	})
	if err == nil {
		t.Fatal("expected insert error, got nil")
	}
	if !strings.Contains(err.Error(), "insert failed") {
		t.Errorf("error message %q missing 'insert failed'", err.Error())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("expected begin+insert+rollback: %v", err)
	}
}

// TestPostgreSQLEventStore_GetByAggregate_Real scans rows and sets versions.
func TestPostgreSQLEventStore_GetByAggregate_Real(t *testing.T) {
	raw, mock, _ := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	defer raw.Close()
	es := NewPostgreSQLEventStore(sqlx.NewDb(raw, "postgres"))

	since := time.Now().UTC()
	mock.ExpectQuery(`SELECT .* FROM domain_events`).
		WithArgs("pipeline", "pipe-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "aggregate_type", "aggregate_id", "tenant_id",
			"event_type", "event_data", "occurred_at",
			"correlation_id", "causation_id",
		}).
			AddRow(uuid.NewString(), "pipeline", "pipe-1", "tenant-1",
				"pipeline.created", []byte(`{"foo":1}`), since, "", "").
			AddRow(uuid.NewString(), "pipeline", "pipe-1", "tenant-1",
				"pipeline.activated", []byte(`{"foo":2}`), since.Add(time.Second), "", ""))

	evs, err := es.GetByAggregate(context.Background(), "tenant-1", "pipeline", "pipe-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(evs) != 2 {
		t.Fatalf("len = %d, want 2", len(evs))
	}
	// Versions must be assigned 1..N in row order
	if evs[0].Version() != 1 || evs[1].Version() != 2 {
		t.Errorf("versions = %d %d, want 1 2", evs[0].Version(), evs[1].Version())
	}
	if evs[0].EventType() != "pipeline.created" {
		t.Errorf("evs[0].EventType = %q", evs[0].EventType())
	}
}

// TestPostgreSQLEventStore_GetByAggregate_EmptyRows returns empty slice.
func TestPostgreSQLEventStore_GetByAggregate_EmptyRows(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	es := NewPostgreSQLEventStore(sqlx.NewDb(raw, "postgres"))

	mock.ExpectQuery(`SELECT .* FROM domain_events`).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "aggregate_type", "aggregate_id", "tenant_id",
			"event_type", "event_data", "occurred_at",
			"correlation_id", "causation_id",
		}))

	evs, err := es.GetByAggregate(context.Background(), "t", "a", "b")
	if err != nil {
		t.Fatal(err)
	}
	if len(evs) != 0 {
		t.Errorf("len = %d, want 0", len(evs))
	}
}

// TestPostgreSQLEventStore_GetByType_Real filters by tenant+type+since.
func TestPostgreSQLEventStore_GetByType_Real(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	es := NewPostgreSQLEventStore(sqlx.NewDb(raw, "postgres"))

	since := time.Now().UTC().Add(-time.Hour)
	when := time.Now().UTC()
	mock.ExpectQuery(`SELECT .* FROM domain_events`).
		WithArgs("tenant-1", "pipeline.activated", since).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "aggregate_type", "aggregate_id", "tenant_id",
			"event_type", "event_data", "occurred_at",
			"correlation_id", "causation_id",
		}).AddRow(uuid.NewString(), "pipeline", "pipe-1", "tenant-1",
			"pipeline.activated", []byte(`{}`), when, "", ""))

	evs, err := es.GetByType(context.Background(), "tenant-1", "pipeline.activated", since)
	if err != nil {
		t.Fatal(err)
	}
	if len(evs) != 1 {
		t.Fatalf("len = %d, want 1", len(evs))
	}
	if evs[0].EventType() != "pipeline.activated" {
		t.Errorf("type = %q", evs[0].EventType())
	}
}

// TestPostgreSQLEventStore_GetLatestVersion_CountsRows.
func TestPostgreSQLEventStore_GetLatestVersion_Real(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	es := NewPostgreSQLEventStore(sqlx.NewDb(raw, "postgres"))

	mock.ExpectQuery(`SELECT COUNT`).WithArgs("pipeline", "pipe-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(7))

	n, err := es.GetLatestVersion(context.Background(), "tenant-1", "pipeline", "pipe-1")
	if err != nil {
		t.Fatal(err)
	}
	if n != 7 {
		t.Errorf("version = %d, want 7", n)
	}
}

// TestPostgreSQLEventStore_GetLatestVersion_NoRows returns 0 (not error).
func TestPostgreSQLEventStore_GetLatestVersion_NoRows(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	es := NewPostgreSQLEventStore(sqlx.NewDb(raw, "postgres"))

	// sqlx will call .Scan with an int; an empty result triggers ErrNoRows
	mock.ExpectQuery(`SELECT COUNT`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}))

	n, err := es.GetLatestVersion(context.Background(), "t", "a", "b")
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("version = %d, want 0", n)
	}
}

// TestPostgreSQLEventStore_GetEventsAfterVersion_Real returns [] when no
// reference row exists (offset > last row).
func TestPostgreSQLEventStore_GetEventsAfterVersion_NoRefRow(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	es := NewPostgreSQLEventStore(sqlx.NewDb(raw, "postgres"))

	// First query: get the reference timestamp at offset N
	mock.ExpectQuery(`SELECT occurred_at FROM domain_events`).
		WillReturnRows(sqlmock.NewRows([]string{"occurred_at"}))

	evs, err := es.GetEventsAfterVersion(context.Background(), "t", "a", "b", 99)
	if err != nil {
		t.Fatal(err)
	}
	if len(evs) != 0 {
		t.Errorf("got %d events, want 0", len(evs))
	}
}

// TestPostgreSQLEventStore_DeleteOlderThan_Real returns RowsAffected.
func TestPostgreSQLEventStore_DeleteOlderThan_Real(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	es := NewPostgreSQLEventStore(sqlx.NewDb(raw, "postgres"))

	mock.ExpectExec(`DELETE FROM domain_events`).
		WithArgs("tenant-1", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 5))

	n, err := es.DeleteOlderThan(context.Background(), "tenant-1", time.Now().UTC().Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if n != 5 {
		t.Errorf("deleted = %d, want 5", n)
	}
}

// TestPostgreSQLEventStore_DeleteOlderThan_Error returns error.
func TestPostgreSQLEventStore_DeleteOlderThan_Error(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	es := NewPostgreSQLEventStore(sqlx.NewDb(raw, "postgres"))

	mock.ExpectExec(`DELETE FROM domain_events`).WillReturnError(errors.New("db down"))

	_, err := es.DeleteOlderThan(context.Background(), "tenant-1", time.Now().UTC())
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "db down") {
		t.Errorf("err = %v", err)
	}
}

// TestRowToStoredEvent_MapsFields exercises the row→storedEvent adapter.
func TestRowToStoredEvent_MapsFields(t *testing.T) {
	row := struct {
		ID            string          `db:"id"`
		AggregateType string          `db:"aggregate_type"`
		AggregateID   string          `db:"aggregate_id"`
		TenantID      string          `db:"tenant_id"`
		EventType     string          `db:"event_type"`
		EventData     json.RawMessage `db:"event_data"`
		OccurredAt    time.Time       `db:"occurred_at"`
		CorrelationID string          `db:"correlation_id"`
		CausationID   string          `db:"causation_id"`
	}{
		ID: "r1", AggregateType: "agg", AggregateID: "a1",
		TenantID: "t1", EventType: "created",
		EventData: json.RawMessage(`{"x":1}`),
		OccurredAt: time.Now().UTC(),
		CorrelationID: "corr-1", CausationID: "cause-1",
	}

	ev := rowToStoredEvent(row)
	assert.Equal(t, "agg", ev.AggregateType())
	assert.Equal(t, "a1", ev.AggregateID())
	assert.Equal(t, "t1", ev.TenantID())
	assert.Equal(t, "created", ev.EventType())
}

// TestSafeCorrelationID_TypeAssertion verifies the safe accessor handles
// events that do (and do not) implement the CorrelationID() method.
func TestSafeCorrelationID_TypeAssertion(t *testing.T) {
	// MockDomainEvent has no CorrelationID() method
	var ev events.DomainEvent = &MockDomainEvent{}
	assert.Equal(t, "", safeCorrelationID(ev))
	assert.Equal(t, "", safeCausationID(ev))
}

// TestStoredEvent_Getters verifies storedEvent implements the DomainEvent
// contract correctly.
func TestStoredEvent_Getters(t *testing.T) {
	original := storedEvent{
		aggregateType: "a", aggregateID: "b", eventType: "c",
		tenantID: "d", occurredAt: time.Now().UTC(), version: 42,
		correlationID: "corr", causationID: "cause",
		eventData: json.RawMessage(`{}`),
	}
	assert.Equal(t, "a", original.AggregateType())
	assert.Equal(t, "b", original.AggregateID())
	assert.Equal(t, "c", original.EventType())
	assert.Equal(t, "d", original.TenantID())
	assert.Equal(t, 42, original.Version())

	original.SetAggregateID("z")
	original.SetTenantID("z")
	original.SetVersion(99)
	assert.Equal(t, "z", original.AggregateID())
	assert.Equal(t, "z", original.TenantID())
	assert.Equal(t, 99, original.Version())
}

// TestPostgreSQLSnapshotStore_Save_AssignsIDAndTimestamp.
func TestPostgreSQLSnapshotStore_Save_AssignsIDAndTimestamp(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	store := NewPostgreSQLSnapshotStore(sqlx.NewDb(raw, "postgres"))

	mock.ExpectExec(`INSERT INTO domain_snapshots`).
		WithArgs(
			sqlmock.AnyArg(), // ID auto-generated
			"pipeline", "pipe-1", "tenant-1",
			5, `{"status":"ACTIVE"}`, "",
			sqlmock.AnyArg(), // CreatedAt
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	snap := &Snapshot{
		AggregateType: "pipeline", AggregateID: "pipe-1",
		TenantID: "tenant-1", Version: 5, State: `{"status":"ACTIVE"}`,
	}
	if err := store.Save(context.Background(), snap); err != nil {
		t.Fatal(err)
	}
	if snap.ID == "" {
		t.Error("Save did not populate ID")
	} else if _, err := uuid.Parse(snap.ID); err != nil {
		t.Errorf("ID %q is not a valid UUID: %v", snap.ID, err)
	}
	if snap.CreatedAt.IsZero() {
		t.Error("Save did not populate CreatedAt")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("sqlmock: %v", err)
	}
}

// TestPostgreSQLSnapshotStore_Save_PreservesExistingID.
func TestPostgreSQLSnapshotStore_Save_PreservesExistingID(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	store := NewPostgreSQLSnapshotStore(sqlx.NewDb(raw, "postgres"))

	const fixedID = "00000000-0000-0000-0000-000000000000"
	mock.ExpectExec(`INSERT INTO domain_snapshots`).
		WithArgs(fixedID, sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Pre-set ID and a non-zero CreatedAt so they are not overwritten
	createdAt := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	snap := &Snapshot{
		ID: fixedID, AggregateType: "a", AggregateID: "b",
		TenantID: "t", Version: 1, State: "{}", CreatedAt: createdAt,
	}
	if err := store.Save(context.Background(), snap); err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, fixedID, snap.ID)
	assert.Equal(t, createdAt, snap.CreatedAt)
}

// TestPostgreSQLSnapshotStore_Save_Error returns wrapped error.
func TestPostgreSQLSnapshotStore_Save_Error(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	store := NewPostgreSQLSnapshotStore(sqlx.NewDb(raw, "postgres"))

	mock.ExpectExec(`INSERT INTO domain_snapshots`).WillReturnError(errors.New("save failed"))

	err := store.Save(context.Background(), &Snapshot{})
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "save failed") {
		t.Errorf("err = %v", err)
	}
}

// TestPostgreSQLSnapshotStore_GetLatest_Found.
func TestPostgreSQLSnapshotStore_GetLatest_Found(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	store := NewPostgreSQLSnapshotStore(sqlx.NewDb(raw, "postgres"))

	createdAt := time.Now().UTC()
	mock.ExpectQuery(`SELECT .* FROM domain_snapshots`).
		WithArgs("pipeline", "pipe-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "aggregate_type", "aggregate_id", "tenant_id",
			"version", "state", "metadata", "created_at",
		}).AddRow("s1", "pipeline", "pipe-1", "tenant-1", 5, `{"x":1}`, "", createdAt))

	snap, err := store.GetLatest(context.Background(), "tenant-1", "pipeline", "pipe-1")
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, "s1", snap.ID)
	assert.Equal(t, 5, snap.Version)
}

// TestPostgreSQLSnapshotStore_GetLatest_NotFound returns ErrSnapshotNotFound.
func TestPostgreSQLSnapshotStore_GetLatest_NotFound(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	store := NewPostgreSQLSnapshotStore(sqlx.NewDb(raw, "postgres"))

	// Empty rows → sqlx.Scan on pointer Snapshot → sql.ErrNoRows
	mock.ExpectQuery(`SELECT .* FROM domain_snapshots`).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "aggregate_type", "aggregate_id", "tenant_id",
			"version", "state", "metadata", "created_at",
		}))

	_, err := store.GetLatest(context.Background(), "t", "a", "b")
	if !errors.Is(err, ErrSnapshotNotFound) {
		t.Errorf("err = %v, want ErrSnapshotNotFound", err)
	}
}

// TestPostgreSQLSnapshotStore_GetByVersion_Found.
func TestPostgreSQLSnapshotStore_GetByVersion_Found(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	store := NewPostgreSQLSnapshotStore(sqlx.NewDb(raw, "postgres"))

	createdAt := time.Now().UTC()
	mock.ExpectQuery(`SELECT .* FROM domain_snapshots`).
		WithArgs("pipeline", "pipe-1", "tenant-1", 3).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "aggregate_type", "aggregate_id", "tenant_id",
			"version", "state", "metadata", "created_at",
		}).AddRow("s3", "pipeline", "pipe-1", "tenant-1", 3, `{"v":3}`, "", createdAt))

	snap, err := store.GetByVersion(context.Background(), "tenant-1", "pipeline", "pipe-1", 3)
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, "s3", snap.ID)
	assert.Equal(t, 3, snap.Version)
}

// TestPostgreSQLSnapshotStore_GetByVersion_NotFound.
func TestPostgreSQLSnapshotStore_GetByVersion_NotFound(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	store := NewPostgreSQLSnapshotStore(sqlx.NewDb(raw, "postgres"))

	mock.ExpectQuery(`SELECT .* FROM domain_snapshots`).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "aggregate_type", "aggregate_id", "tenant_id",
			"version", "state", "metadata", "created_at",
		}))

	_, err := store.GetByVersion(context.Background(), "t", "a", "b", 99)
	if !errors.Is(err, ErrSnapshotNotFound) {
		t.Errorf("err = %v, want ErrSnapshotNotFound", err)
	}
}

// TestPostgreSQLSnapshotStore_ListByAggregate_MultipleRows.
func TestPostgreSQLSnapshotStore_ListByAggregate_MultipleRows(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	store := NewPostgreSQLSnapshotStore(sqlx.NewDb(raw, "postgres"))

	createdAt := time.Now().UTC()
	mock.ExpectQuery(`SELECT .* FROM domain_snapshots`).
		WithArgs("pipeline", "pipe-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "aggregate_type", "aggregate_id", "tenant_id",
			"version", "state", "metadata", "created_at",
		}).
			AddRow("s2", "pipeline", "pipe-1", "tenant-1", 2, "{}", "", createdAt).
			AddRow("s5", "pipeline", "pipe-1", "tenant-1", 5, "{}", "", createdAt))

	snaps, err := store.ListByAggregate(context.Background(), "tenant-1", "pipeline", "pipe-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(snaps) != 2 {
		t.Fatalf("len = %d, want 2", len(snaps))
	}
	assert.Equal(t, 2, snaps[0].Version)
	assert.Equal(t, 5, snaps[1].Version)
}

// TestPostgreSQLSnapshotStore_ListByAggregate_Error wraps error.
func TestPostgreSQLSnapshotStore_ListByAggregate_Error(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	store := NewPostgreSQLSnapshotStore(sqlx.NewDb(raw, "postgres"))

	mock.ExpectQuery(`SELECT .* FROM domain_snapshots`).
		WillReturnError(errors.New("query failed"))

	_, err := store.ListByAggregate(context.Background(), "t", "a", "b")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "query failed") {
		t.Errorf("err = %v", err)
	}
}

// sqlNoRowsErr asserts that a sql.ErrNoRows error propagates through the
// PostgreSQL stores' NotFound handling (guards against future regressions).
func sqlNoRowsErr(t *testing.T, got error, want error) {
	t.Helper()
	if !errors.Is(got, want) {
		t.Errorf("errors.Is(got, want) = false; got=%v want=%v", got, want)
	}
}

// TestRowScan_ErrorsWrap tests that scan errors are wrapped with detail.
func TestPostgreSQLEventStore_GetByAggregate_ScanError(t *testing.T) {
	raw, mock, _ := sqlmock.New()
	defer raw.Close()
	es := NewPostgreSQLEventStore(sqlx.NewDb(raw, "postgres"))

	// Return wrong column type → scan error
	mock.ExpectQuery(`SELECT .* FROM domain_events`).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "aggregate_type", "aggregate_id", "tenant_id",
			"event_type", "event_data", "occurred_at",
			"correlation_id", "causation_id",
		}).AddRow("id1", "a", "b", "c", "d", []byte(`{}`), "not-a-time", "", ""))

	_, err := es.GetByAggregate(context.Background(), "t", "a", "b")
	if err == nil {
		t.Fatal("expected scan error, got nil")
	}
	if !strings.Contains(err.Error(), "scan event row") {
		t.Errorf("err = %v", err)
	}
}

// Compile-time assertions to catch regressions.
var _ = sql.ErrNoRows
var _ = sqlNoRowsErr
