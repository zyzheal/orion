package repository

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
}

func Test_joinStrings(t *testing.T) {
	tests := []struct {
		in  []string
		sep string
		out string
	}{
		{nil, ",", ""},
		{[]string{}, ",", ""},
		{[]string{"a"}, ",", "a"},
		{[]string{"a", "b"}, ",", "a,b"},
		{[]string{"a", "b", "c"}, " AND ", "a AND b AND c"},
	}
	for _, tt := range tests {
		got := joinStrings(tt.in, tt.sep)
		if got != tt.out {
			t.Fatalf("joinStrings(%v, %q) = %q, want %q", tt.in, tt.sep, got, tt.out)
		}
	}
}

func Test_toMapStringString_Nil(t *testing.T) {
	m := toMapStringString(nil)
	if m != nil {
		t.Fatalf("toMapStringString(nil) = %v, want nil", m)
	}
}

func Test_toMapStringString_StringValues(t *testing.T) {
	input := map[string]interface{}{
		"host": "localhost",
		"port": "8080",
	}
	m := toMapStringString(input)
	if len(m) != 2 {
		t.Fatalf("len = %d, want 2", len(m))
	}
	if m["host"] != "localhost" {
		t.Fatalf("m[host] = %q, want %q", m["host"], "localhost")
	}
	if m["port"] != "8080" {
		t.Fatalf("m[port] = %q, want %q", m["port"], "8080")
	}
}

func Test_toMapStringString_NonStringValues(t *testing.T) {
	input := map[string]interface{}{
		"count": 42,
		"ratio": 3.14,
	}
	m := toMapStringString(input)
	if len(m) != 2 {
		t.Fatalf("len = %d, want 2", len(m))
	}
	if m["count"] == "" {
		t.Fatal("m[count] should be non-empty")
	}
	if m["ratio"] == "" {
		t.Fatal("m[ratio] should be non-empty")
	}
}

func Test_Errors(t *testing.T) {
	if ErrNotFound == nil {
		t.Fatal("ErrNotFound should not be nil")
	}
	if ErrDuplicate == nil {
		t.Fatal("ErrDuplicate should not be nil")
	}
}

// ---------------------------------------------------------------------------
// Pagination binding.
//
// ListExtensionPoints used to append offset and limit to the argument list
// twice - once before the optional filters were added and once after - so the
// call bound two values the query never referenced. Postgres rejects that as a
// protocol violation (bind message supplies 5 parameters, but prepared
// statement requires 3), so every unfiltered GET /extension-points returned a
// 500 and InitializeAll could not load priority at all. WithArgs pins the
// argument count: the expected list below has exactly as many entries as the
// SQL's placeholders, so a duplicate append fails here.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Pagination binding.
//
// ListExtensionPoints used to append offset and limit to the argument list
// twice - once before the optional filters were added and once after - so the
// call bound two values the query never referenced. Postgres rejects that as a
// protocol violation (bind message supplies 5 parameters, but prepared
// statement requires 3), so every unfiltered GET /extension-points returned a
// 500 and InitializeAll could not load priority at all. WithArgs pins the
// argument count: each expected list below has exactly as many entries as the
// SQL references, so a duplicate append fails here.
// ---------------------------------------------------------------------------

func newMockRepoDB(t *testing.T) *sqlx.DB {
	t.Helper()
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return sqlx.NewDb(db, "postgres")
}

func epRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "category", "description", "handler_type",
		"config", "enabled", "priority", "status", "error",
		"registered_at", "initialized_at", "created_at", "updated_at",
	}).AddRow("ep-1", "tenant-1", "ext-a", "api", "", "builtin",
		[]byte("{}"), true, 10, "active", "",
		time.Now(), nil, time.Now(), time.Now())
}

func taskRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "extension_id", "name", "status", "duration_ms", "error",
		"started_at", "finished_at", "created_at",
	}).AddRow("t-1", "ext-a", "init:ext-a", "completed", 12, "",
		time.Now(), nil, time.Now())
}

// Unfiltered: the SQL references $1, $2 and $3, so exactly three arguments.
func TestListExtensionPoints_BindsOneArgPerPlaceholder(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery("WHERE tenant_id =").
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(epRows())

	got, err := r.ListExtensionPoints(context.Background(), "tenant-1", "", "", 0, 20)
	if err != nil {
		t.Fatalf("ListExtensionPoints: %v", err)
	}
	if len(got) != 1 || got[0].ID != "ep-1" {
		t.Fatalf("got %d rows, want 1", len(got))
	}
	if got[0].Name != "ext-a" || got[0].Category != "api" || !got[0].Enabled || got[0].Priority != 10 {
		t.Errorf("row = %+v, want name=ext-a category=api enabled priority=10", got[0])
	}
	if got[0].Config == nil {
		t.Errorf("config column did not scan into the JSONB field")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// Both filters: they occupy $2 and $3 and the window moves to $4 and $5.
func TestListExtensionPoints_BindsFiltersBeforeTheWindow(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery("OFFSET \\$4 LIMIT \\$5").
		WithArgs("tenant-1", "api", "disabled", 50, 25).
		WillReturnRows(epRows())

	_, err = r.ListExtensionPoints(context.Background(), "tenant-1", "api", "disabled", 50, 25)
	if err != nil {
		t.Fatalf("ListExtensionPoints: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// The window must be in the SQL at all: a list endpoint that silently dropped
// LIMIT and OFFSET returns the whole table and looks correct.
func TestListExtensionPoints_PaginatesAtAll(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery("OFFSET \\$2 LIMIT \\$3").
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(epRows())

	_, err = r.ListExtensionPoints(context.Background(), "tenant-1", "", "", 0, 20)
	if err != nil {
		t.Fatalf("paginated query must be expected, got %v", err)
	}
}

func TestListStartupTasks_BindsOffsetAndLimit(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery("FROM startup_tasks ORDER BY created_at DESC OFFSET \\$1 LIMIT \\$2").
		WithArgs(0, 20).
		WillReturnRows(taskRows())
	mock.ExpectQuery("WHERE status = \\$1 ORDER BY created_at DESC OFFSET \\$2 LIMIT \\$3").
		WithArgs("running", 50, 25).
		WillReturnRows(taskRows())

	if _, err := r.ListStartupTasks(context.Background(), "", 0, 20); err != nil {
		t.Fatalf("ListStartupTasks(): %v", err)
	}
	if _, err := r.ListStartupTasks(context.Background(), "running", 50, 25); err != nil {
		t.Fatalf("ListStartupTasks(running): %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// The envelope reports total next to offset and limit, so total must count the
// same rows the page was fetched from.
func TestCountExtensionPoints_CountsTheSamePredicateAsTheList(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM extension_points WHERE tenant_id = \\$1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(17))
	mock.ExpectQuery("WHERE tenant_id = \\$1 AND category = \\$2 AND status = \\$3").
		WithArgs("tenant-1", "api", "disabled").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

	if n, err := r.CountExtensionPoints(context.Background(), "tenant-1", "", ""); err != nil || n != 17 {
		t.Errorf("unfiltered count = %d, %v; want 17, nil", n, err)
	}
	if n, err := r.CountExtensionPoints(context.Background(), "tenant-1", "api", "disabled"); err != nil || n != 3 {
		t.Errorf("filtered count = %d, %v; want 3, nil", n, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestListExtensionPoints_WrapsTheDriverError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery("WHERE tenant_id =").WillReturnError(sqlmock.ErrCancelled)

	_, err = r.ListExtensionPoints(context.Background(), "tenant-1", "", "", 0, 20)
	if err == nil {
		t.Fatal("expected the driver error to propagate")
	}
}

func TestListExtensionPoints_EmptyResultIsZeroLength(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery("WHERE tenant_id =").
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "category", "description", "handler_type",
			"config", "enabled", "priority", "status", "error",
			"registered_at", "initialized_at", "created_at", "updated_at",
		}))

	got, err := r.ListExtensionPoints(context.Background(), "tenant-1", "", "", 0, 20)
	if err != nil {
		t.Fatalf("ListExtensionPoints: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("got %d rows, want 0", len(got))
	}
}
