package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/digital-twin/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// Round 20 added the first tests to the digital-twin repository. Before that
// UpdateReplaySession ran an UPDATE scoped by id alone, so a caller could cancel
// another tenant's replay session by guessing the id; it also reported success
// when the UPDATE matched zero rows. GetRecordingRecordsBySessionID had no
// tenant predicate and handed sql.ErrNoRows to its caller as a plain error.
// FindTwinByID and FindReplaySessionById surfaced sql.ErrNoRows as a database
// error, which made a missing resource answer 500 instead of 404.
//
// The tests below pin the tenant predicates, the argument order, the
// RowsAffected check and the sentinel error mapping.

// updateReplaySQL is the exact statement UpdateReplaySession must emit. The
// tenant clause is what makes the write cross-tenant safe; the exact matcher
// below rejects any statement that drops it.
const updateReplaySQL = "UPDATE digital_twin_replay_sessions s SET s.status=$1, s.updated_at=NOW() WHERE s.id=$2 AND s.twin_id IN (SELECT t.id FROM digital_twins t WHERE t.tenant_id=$3)"

const findReplayByIdSQL = "SELECT s.* FROM digital_twin_replay_sessions s INNER JOIN digital_twins t ON s.twin_id = t.id WHERE s.id=$1 AND t.tenant_id=$2"

const recordingRecordsSQL = "SELECT records FROM recording_sessions WHERE id=$1 AND tenant_id=$2"

var (
	twinColumns = []string{
		"id", "tenant_id", "name", "service_type", "source_service", "status",
		"created_at", "updated_at",
	}
	trafficColumns = []string{
		"id", "twin_id", "type", "request_count", "duration", "started_at", "completed_at",
	}
	replayColumns = []string{
		"id", "twin_id", "recording_session_id", "sandbox_endpoint", "status", "progress",
		"total_requests", "completed_requests", "matched_requests", "failed_requests",
		"started_at", "completed_at", "updated_at",
	}
)

func newMockRepo(t *testing.T, matcher sqlmock.QueryMatcher) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(matcher))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

func exactRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	return newMockRepo(t, exactMatcher{})
}

func normalizeSQL(s string) string {
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
}

// exactMatcher compares statements after collapsing whitespace, so a statement
// that drops a tenant predicate cannot satisfy its expectation.
type exactMatcher struct{}

func (exactMatcher) Match(expected, actual string) error {
	if normalizeSQL(actual) == normalizeSQL(expected) {
		return nil
	}
	return fmt.Errorf("SQL mismatch\n  got:  %s\n  want: %s",
		normalizeSQL(actual), normalizeSQL(expected))
}

func twinRow(id string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows(twinColumns).
		AddRow(id, "tenant-1", "web-api", "api", "my-service", "active", now, now)
}

func trafficRow(id string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows(trafficColumns).
		AddRow(id, "twin-1", "record", 42, "30s", now, nil)
}

func replayRow(id, status string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows(replayColumns).
		AddRow(id, "twin-1", "rec-1", "http://sandbox", status, 50,
			100, 80, 70, 5, now, nil, now)
}

func assertNotFound(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatal("expected a not-found error, got nil")
	}
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel not-found, got %v", err)
	}
}

// ==================== UpdateReplaySession ====================

func TestUpdateReplaySession_TenantScopedWriteAndReadBack(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectExec(updateReplaySQL).
		WithArgs("cancelled", "rp-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(findReplayByIdSQL).
		WithArgs("rp-1", "tenant-1").
		WillReturnRows(replayRow("rp-1", "cancelled"))

	got, err := r.UpdateReplaySession(context.Background(), "tenant-1", "rp-1", "cancelled")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "rp-1" || got.Status != "cancelled" {
		t.Fatalf("expected the updated session to be read back, got id=%s status=%s", got.ID, got.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestUpdateReplaySession_ZeroRowsIsNotFound(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectExec(updateReplaySQL).
		WithArgs("cancelled", "rp-unknown", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 0))

	got, err := r.UpdateReplaySession(context.Background(), "tenant-1", "rp-unknown", "cancelled")
	if got != nil {
		t.Fatalf("expected nil session on zero affected rows, got %+v", got)
	}
	assertNotFound(t, err)
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a zero-row UPDATE must not read the row back: %v", err)
	}
}

func TestUpdateReplaySession_ExecErrorIsPropagated(t *testing.T) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(exactMatcher{}))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	r := NewRepository(sqlx.NewDb(db, "postgres"))
	mock.ExpectExec(updateReplaySQL).
		WithArgs("cancelled", "rp-1", "tenant-1").
		WillReturnError(errors.New("db down"))

	if _, err := r.UpdateReplaySession(context.Background(), "tenant-1", "rp-1", "cancelled"); err == nil {
		t.Fatal("expected the exec error to be returned")
	}
}

func TestUpdateReplaySession_TenantCannotBeSwappedWithID(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectExec(updateReplaySQL).
		WithArgs("cancelled", "tenant-1", "rp-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(findReplayByIdSQL).
		WithArgs("rp-1", "tenant-1").
		WillReturnRows(replayRow("rp-1", "cancelled"))

	// The argument order above is deliberately wrong (id/tenant swapped). The
	// repository must reject it, which keeps a call-site swap detectable.
	if _, err := r.UpdateReplaySession(context.Background(), "tenant-1", "rp-1", "cancelled"); err == nil {
		t.Fatal("expected the swapped argument order to be rejected")
	}
}

// ==================== GetRecordingRecordsBySessionID ====================

func TestGetRecordingRecordsBySessionID_TenantScopedAndParsed(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(recordingRecordsSQL).
		WithArgs("rec-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"records"}).
			AddRow([]byte(`[{"path":"/a"},{"path":"/b"}]`)))

	got, err := r.GetRecordingRecordsBySessionID(context.Background(), "tenant-1", "rec-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 records, got %d", len(got))
	}
	first, ok := got[0].(map[string]interface{})
	if !ok || first["path"] != "/a" {
		t.Fatalf("records must be parsed JSON objects, got %#v", got[0])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestGetRecordingRecordsBySessionID_NoRowsIsNotFound(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(recordingRecordsSQL).
		WithArgs("rec-missing", "tenant-1").
		WillReturnError(sql.ErrNoRows)

	got, err := r.GetRecordingRecordsBySessionID(context.Background(), "tenant-1", "rec-missing")
	if got != nil {
		t.Fatalf("expected nil records, got %#v", got)
	}
	assertNotFound(t, err)
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestGetRecordingRecordsBySessionID_NilJSONIsEmptySlice(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(recordingRecordsSQL).
		WithArgs("rec-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"records"}).AddRow(nil))

	got, err := r.GetRecordingRecordsBySessionID(context.Background(), "tenant-1", "rec-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil {
		t.Fatal("expected a non-nil empty slice, got nil")
	}
	if len(got) != 0 {
		t.Fatalf("expected no records, got %d", len(got))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestGetRecordingRecordsBySessionID_InvalidJSONIsError(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(recordingRecordsSQL).
		WithArgs("rec-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"records"}).AddRow([]byte(`{not json`)))

	_, err := r.GetRecordingRecordsBySessionID(context.Background(), "tenant-1", "rec-1")
	if err == nil {
		t.Fatal("expected a JSON decode error")
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatalf("a decode failure must not be reported as not-found: %v", err)
	}
}

func TestGetRecordingRecordsBySessionID_DBErrorIsNotNotFound(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(recordingRecordsSQL).
		WithArgs("rec-1", "tenant-1").
		WillReturnError(errors.New("db down"))

	_, err := r.GetRecordingRecordsBySessionID(context.Background(), "tenant-1", "rec-1")
	if err == nil {
		t.Fatal("expected the database error to be returned")
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatalf("a database outage must not be reported as not-found: %v", err)
	}
}

// ==================== Reads ====================

func TestFindTwinByID_ScopedToTenant(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery("SELECT * FROM digital_twins WHERE id=$1 AND tenant_id=$2").
		WithArgs("twin-1", "tenant-1").
		WillReturnRows(twinRow("twin-1"))

	got, err := r.FindTwinByID(context.Background(), "tenant-1", "twin-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "twin-1" || got.TenantID != "tenant-1" {
		t.Fatalf("unexpected twin: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestFindTwinByID_NoRowsIsNotFound(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery("SELECT * FROM digital_twins WHERE id=$1 AND tenant_id=$2").
		WithArgs("twin-x", "tenant-1").
		WillReturnError(sql.ErrNoRows)

	got, err := r.FindTwinByID(context.Background(), "tenant-1", "twin-x")
	if got != nil {
		t.Fatalf("expected nil twin, got %+v", got)
	}
	assertNotFound(t, err)
}

func TestFindTwinByID_DBErrorIsPropagated(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery("SELECT * FROM digital_twins WHERE id=$1 AND tenant_id=$2").
		WithArgs("twin-1", "tenant-1").
		WillReturnError(errors.New("db down"))

	if _, err := r.FindTwinByID(context.Background(), "tenant-1", "twin-1"); err == nil {
		t.Fatal("expected the database error to be returned")
	}
}

func TestFindAllTwins_PassesTenant(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery("SELECT * FROM digital_twins WHERE tenant_id=$1 ORDER BY created_at DESC").
		WithArgs("tenant-1").
		WillReturnRows(twinRow("twin-1"))

	twins, err := r.FindAllTwins(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(twins) != 1 || twins[0].ID != "twin-1" {
		t.Fatalf("unexpected twins: %+v", twins)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestFindTrafficRecordsByTwinID_ArgOrderIsTwinThenTenant(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery("SELECT r.* FROM digital_twin_traffic_records r INNER JOIN digital_twins t ON r.twin_id = t.id WHERE r.twin_id=$1 AND t.tenant_id=$2 ORDER BY r.started_at DESC").
		WithArgs("twin-1", "tenant-1").
		WillReturnRows(trafficRow("rec-1"))

	records, err := r.FindTrafficRecordsByTwinID(context.Background(), "tenant-1", "twin-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(records) != 1 || records[0].ID != "rec-1" {
		t.Fatalf("unexpected records: %+v", records)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestFindReplaySessionsByTwinID_ArgOrderIsTwinThenTenant(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery("SELECT s.* FROM digital_twin_replay_sessions s INNER JOIN digital_twins t ON s.twin_id = t.id WHERE s.twin_id=$1 AND t.tenant_id=$2 ORDER BY s.started_at DESC").
		WithArgs("twin-1", "tenant-1").
		WillReturnRows(replayRow("rp-1", "running"))

	sessions, err := r.FindReplaySessionsByTwinID(context.Background(), "tenant-1", "twin-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(sessions) != 1 || sessions[0].ID != "rp-1" {
		t.Fatalf("unexpected sessions: %+v", sessions)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestFindReplaySessionById_ScopedToTenant(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(findReplayByIdSQL).
		WithArgs("rp-1", "tenant-1").
		WillReturnRows(replayRow("rp-1", "running"))

	got, err := r.FindReplaySessionById(context.Background(), "tenant-1", "rp-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "rp-1" {
		t.Fatalf("unexpected session: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestFindReplaySessionById_NoRowsIsNotFound(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(findReplayByIdSQL).
		WithArgs("rp-x", "tenant-1").
		WillReturnError(sql.ErrNoRows)

	got, err := r.FindReplaySessionById(context.Background(), "tenant-1", "rp-x")
	if got != nil {
		t.Fatalf("expected nil session, got %+v", got)
	}
	assertNotFound(t, err)
}

// ==================== Writes ====================

func TestCreateTwin_InsertsTenantColumn(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectExec("INSERT INTO digital_twins (id, tenant_id, name, service_type, source_service, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)").
		WithArgs(sqlmock.AnyArg(), "tenant-1", "web-api", "api", "my-service", "active", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	twin, err := r.CreateTwin(context.Background(), "tenant-1", models.CreateDigitalTwinRequest{
		Name: "web-api", ServiceType: "api", SourceService: "my-service",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if twin.TenantID != "tenant-1" || twin.ID == "" {
		t.Fatalf("unexpected twin: %+v", twin)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestCreateTrafficRecord_InsertsTypedRecord(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectExec("INSERT INTO digital_twin_traffic_records (id, twin_id, type, request_count, duration, started_at, completed_at) VALUES ($1, $2, $3, $4, $5, $6, $7)").
		WithArgs(sqlmock.AnyArg(), "twin-1", "record", 12, "30s", sqlmock.AnyArg(), nil).
		WillReturnResult(sqlmock.NewResult(1, 1))

	record, err := r.CreateTrafficRecord(context.Background(), models.CreateTrafficRecordInput{
		TwinID: "twin-1", Type: "record", StartedAt: time.Now().UTC(), RequestCount: 12, Duration: "30s",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if record.TwinID != "twin-1" || record.Type != "record" {
		t.Fatalf("unexpected record: %+v", record)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}
