package repository

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/job-source/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"
)

func mockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock
}

// mockDBCapture is mockDB plus a sink for the exact statement text the repository
// compiled. sqlmock v1.5.2 exposes no ExecutedSQL, so the query matcher is the
// only place the actual SQL is observable; it always accepts here so the
// caller's expectation still supplies the contract and the sink only records.
func mockDBCapture(t *testing.T, sink *string) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(
		func(expected, actual string) error {
			*sink = actual
			return nil
		})))
	require.NoError(t, err)
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock
}

func TestRepository_Create_FillsIdentityAndTimestamps(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`INSERT INTO job_sources`).WillReturnResult(sqlmock.NewResult(0, 1))

	m := &models.JobSource{TenantID: "t1", Name: "n", Type: "manual"}
	require.NoError(t, repo.Create(context.Background(), m))
	require.NotEmpty(t, m.ID)
	require.False(t, m.CreatedAt.IsZero())
	require.False(t, m.UpdatedAt.IsZero())
	if m.Status != "active" {
		t.Errorf("status = %q, want active", m.Status)
	}
	if m.Config != "{}" {
		t.Errorf("config = %q, want {}", m.Config)
	}
	require.NoError(t, mock.ExpectationsWereMet())
}

// The repository wraps sql.ErrNoRows into the sentinel every caller compares
// against. Without the wrap an absent row looked exactly like a down database,
// and PUT /job-sources/:id plus POST /:id/trigger answered 500 for every id
// that had never existed.
func TestRepository_GetByID_EmptyResultSetReturnsNotFoundSentinel(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	mock.ExpectQuery(`SELECT \* FROM job_sources WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("nope", "t1").
		WillReturnError(sql.ErrNoRows)

	got, err := repo.GetByID(context.Background(), "t1", "nope")
	require.Error(t, err)
	require.Nil(t, got)
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("error = %v, want sentinel.NotFound", err)
	}
	if errors.Is(err, sql.ErrNoRows) {
		t.Error("the raw driver error must not escape the repository")
	}
}

// A genuine driver failure must survive the wrap untouched: flattening every
// error into sentinel.NotFound would turn a broken database into a 404.
func TestRepository_GetByID_DriverErrorIsReturnedUnwrapped(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	want := errors.New("connection refused")
	mock.ExpectQuery(`SELECT \* FROM job_sources`).
		WithArgs("id-1", "t1").
		WillReturnError(want)

	got, err := repo.GetByID(context.Background(), "t1", "id-1")
	require.Nil(t, got)
	require.Error(t, err)
	if !errors.Is(err, want) {
		t.Fatalf("error = %v, want the driver error", err)
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Error("a driver error must not be reported as not found")
	}
}

func TestRepository_GetByID_ReturnsTheRow(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	rows := sqlmock.NewRows([]string{"id", "tenant_id", "name", "type", "config", "enabled", "status", "created_at", "updated_at"}).
		AddRow("id-1", "t1", "n", "manual", "{}", true, "active", time.Unix(0, 0), time.Unix(0, 0))
	mock.ExpectQuery(`SELECT \* FROM job_sources`).WithArgs("id-1", "t1").WillReturnRows(rows)

	got, err := repo.GetByID(context.Background(), "t1", "id-1")
	require.NoError(t, err)
	require.NotNil(t, got)
	if got.ID != "id-1" || got.Name != "n" {
		t.Errorf("got %+v", got)
	}
}

// A non-positive limit must not reach SQL as LIMIT -1, which PostgreSQL rejects.
func TestRepository_List_DefaultsANonPositiveLimit(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	mock.ExpectQuery(`SELECT \* FROM job_sources WHERE tenant_id=\$1`).
		WithArgs("t1", 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	items, err := repo.List(context.Background(), "t1", 0, 0)
	require.NoError(t, err)
	require.Empty(t, items)
}

// The two branches of Update compile a different statement, so each one gets
// its own expectation with a distinct placeholder count.
func TestRepository_Update_SetsOnlyTheCallerMapKeys(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`UPDATE job_sources SET `).
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, repo.Update(context.Background(), "t1", "id-1", map[string]interface{}{
		"name": "renamed",
	}))
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestRepository_Update_DriverErrorIsWrapped(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	want := errors.New("no such column")
	mock.ExpectExec(`UPDATE job_sources SET `).WillReturnError(want)
	err := repo.Update(context.Background(), "t1", "id-1", map[string]interface{}{"name": "x"})
	require.Error(t, err)
	if !errors.Is(err, want) {
		t.Fatalf("error = %v, want the driver error", err)
	}
	if !strings.Contains(err.Error(), "failed to update job source") {
		t.Errorf("the driver error lost its repository context: %q", err.Error())
	}
}

func TestRepository_Delete(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`DELETE FROM job_sources WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("id-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, repo.Delete(context.Background(), "t1", "id-1"))
}

func TestRepository_CreateEvent_DefaultsStatusAndPayload(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`INSERT INTO job_source_events`).WillReturnResult(sqlmock.NewResult(0, 1))

	e := &models.JobSourceEvent{TenantID: "t1", SourceID: "id-1", ReceivedAt: time.Unix(0, 0)}
	require.NoError(t, repo.CreateEvent(context.Background(), e))
	if e.Status != "received" {
		t.Errorf("status = %q, want received", e.Status)
	}
	if e.Payload != "{}" {
		t.Errorf("payload = %q, want {}", e.Payload)
	}
}

func TestRepository_ListEvents_SourceIDSelectsTheScopedQuery(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	mock.ExpectQuery(`SELECT \* FROM job_source_events WHERE tenant_id=\$1 AND source_id=\$2`).
		WithArgs("t1", "id-1", 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	items, err := repo.ListEvents(context.Background(), "t1", "id-1", 0, 0)
	require.NoError(t, err)
	require.Empty(t, items)
}

func TestRepository_ListEvents_EmptySourceIDSelectsTheTenantQuery(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	mock.ExpectQuery(`SELECT \* FROM job_source_events WHERE tenant_id=\$1`).
		WithArgs("t1", 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	items, err := repo.ListEvents(context.Background(), "t1", "", 0, 0)
	require.NoError(t, err)
	require.Empty(t, items)
}

func TestRepository_MarshalJSONConfig_NilBecomesEmptyObject(t *testing.T) {
	out, err := MarshalJSONConfig(nil)
	require.NoError(t, err)
	if out != "{}" {
		t.Errorf("got %q, want {}", out)
	}
}

func TestRepository_UnmarshalJSONConfig_EmptyBecomesNil(t *testing.T) {
	out, err := UnmarshalJSONConfig("")
	require.NoError(t, err)
	if out != nil {
		t.Errorf("got %v, want nil", out)
	}
}

// An unwhitelisted key must never reach the SQL text: the pre-fix update
// interpolated map keys straight into the SET clause, so any key was an
// identifier injection.
func TestRepository_Update_IgnoresColumnsTheStatementDoesNotOwn(t *testing.T) {
	var sqlText string
	db, mock := mockDBCapture(t, &sqlText)
	repo := NewRepository(db)
	mock.ExpectExec(`UPDATE job_sources SET `).WithArgs("n", sqlmock.AnyArg(), "id-1", "t1").WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, repo.Update(context.Background(), "t1", "id-1", map[string]interface{}{
		"name":                      "n",
		"evil_col":                  "boom",
		"1; DROP TABLE job_sources": "boom",
	}))
	if !strings.HasPrefix(sqlText, "UPDATE job_sources SET ") {
		t.Fatalf("reflection returned %q, which is not the UPDATE statement", sqlText)
	}
	for _, bad := range []string{"evil_col", "DROP TABLE"} {
		if strings.Contains(sqlText, bad) {
			t.Errorf("unwhitelisted key reached the SQL text: %q in %s", bad, sqlText)
		}
	}
}

// id and tenant_id name the row in the WHERE clause. They must not also be
// settable through the SET clause, which would let a caller rename or
// re-tenant the row it is addressing.
func TestRepository_Update_RowIdentityIsNotSettable(t *testing.T) {
	var sqlText string
	db, mock := mockDBCapture(t, &sqlText)
	repo := NewRepository(db)
	mock.ExpectExec(`UPDATE job_sources SET `).WithArgs("n", sqlmock.AnyArg(), "id-1", "t1").WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, repo.Update(context.Background(), "t1", "id-1", map[string]interface{}{
		"name":      "n",
		"id":        "someone-else",
		"tenant_id": "someone-else",
	}))
	if strings.Contains(sqlText, "id = $") {
		t.Errorf("id is settable through the SET clause: %s", sqlText)
	}
	if strings.Contains(sqlText, "tenant_id = $") {
		t.Errorf("tenant_id is settable through the SET clause: %s", sqlText)
	}
	if !strings.Contains(sqlText, "WHERE id=$3 AND tenant_id=$4") {
		t.Errorf("the WHERE clause must keep naming the row and scoping the tenant: %s", sqlText)
	}
}

// A nil value means "the caller did not send this field". Binding it would
// write NULL, which job_sources rejects for name and type.
func TestRepository_Update_SkipsNilValues(t *testing.T) {
	var sqlText string
	db, mock := mockDBCapture(t, &sqlText)
	repo := NewRepository(db)
	mock.ExpectExec(`UPDATE job_sources SET `).WithArgs("n", sqlmock.AnyArg(), "id-1", "t1").WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, repo.Update(context.Background(), "t1", "id-1", map[string]interface{}{
		"name":    "n",
		"type":    nil,
		"config":  nil,
		"enabled": nil,
		"status":  nil,
	}))
	if !strings.HasPrefix(sqlText, "UPDATE job_sources SET ") {
		t.Fatalf("reflection returned %q, which is not the UPDATE statement", sqlText)
	}
	for _, bad := range []string{"type =", "config =", "enabled =", "status ="} {
		if strings.Contains(sqlText, bad) {
			t.Errorf("a nil value reached the SET clause: %q in %s", bad, sqlText)
		}
	}
	if !strings.Contains(sqlText, "name = $1") {
		t.Errorf("the non-nil field must still be set: %s", sqlText)
	}
}

// Every key filtered out leaves nothing to set. That call must be a no-op, not
// a statement that updates nothing and not an index-out-of-range panic on an
// empty SET list. It is exercised on update() rather than Update() because
// Update() always injects a whitelisted, non-nil updated_at, which would leave
// one key behind and hide the guard.
func TestRepository_Update_NoSettableKeysIsANoOp(t *testing.T) {
	var sqlText string
	db, _ := mockDBCapture(t, &sqlText)
	repo := NewRepository(db)
	err := repo.update(context.Background(), "t1", "id-1", map[string]interface{}{
		"name":      nil,
		"id":        "someone-else",
		"tenant_id": "someone-else",
		"unknown":   "boom",
	})
	require.NoError(t, err)
	if sqlText != "" {
		t.Errorf("no settable keys still compiled a statement: %q", sqlText)
	}
}

// The repository fills an unset received_at, because 685 declares it NOT NULL
// and sorts events by it. A zero time.Time is not nil, so the zero value is the
// only thing that could otherwise be written (year 1 AD).
func TestRepository_CreateEvent_FillsAnUnsetReceivedAt(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`INSERT INTO job_source_events`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	e := &models.JobSourceEvent{TenantID: "t1", SourceID: "id-1"}
	require.NoError(t, repo.CreateEvent(context.Background(), e))
	if e.ReceivedAt.IsZero() {
		t.Error("received_at left unset; 685 declares it NOT NULL and ORDER BY received_at DESC sorts on it")
	}
}

func TestRepository_CreateEvent_PreservesACallerSuppliedReceivedAt(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`INSERT INTO job_source_events`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	original := time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC)
	e := &models.JobSourceEvent{TenantID: "t1", SourceID: "id-1", ReceivedAt: original}
	require.NoError(t, repo.CreateEvent(context.Background(), e))
	if !e.ReceivedAt.Equal(original) {
		t.Errorf("received_at changed from %v to %v", original, e.ReceivedAt)
	}
}
