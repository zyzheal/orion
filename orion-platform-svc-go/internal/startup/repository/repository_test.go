package repository

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/startup/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// Round 19 added the first tests to the startup module. Before that this
// repository handed sql.ErrNoRows straight back to its callers, which is what
// let an unknown id surface as a 500 and a database outage surface as a 404.
// DeleteModule returned nil for a DELETE that matched zero rows, so deleting an
// id that belongs to another tenant reported success. The tests below pin the
// sentinel mapping and the RowsAffected check.
//
// Table names are the bare ones migration 275 creates: startup_modules and
// startup_dependencies, with no schema or module prefix.

var (
	moduleColumns = []string{
		"id", "tenant_id", "name", "type", "priority", "description", "config",
		"status", "error", "duration_ms", "initialized_at", "created_at", "updated_at",
	}
	depColumns = []string{"id", "tenant_id", "module_id", "depends_on", "created_at"}
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

func regexpRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	return newMockRepo(t, sqlmock.QueryMatcherRegexp)
}

// exactRepo compares statements after collapsing whitespace, so a statement
// naming a table with any qualifier cannot satisfy its expectations.
func exactRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	return newMockRepo(t, exactMatcher{})
}

func normalizeSQL(s string) string {
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
}

// exactMatcher compares statements after collapsing whitespace, so a statement
// that names a table with any qualifier cannot satisfy its expectations.
// sqlmock v1.5's QueryMatcher is an interface, hence the small type.
type exactMatcher struct{}

func (exactMatcher) Match(expected, actual string) error {
	if normalizeSQL(actual) == normalizeSQL(expected) {
		return nil
	}
	return fmt.Errorf("SQL mismatch\n  got:  %s\n  want: %s",
		normalizeSQL(actual), normalizeSQL(expected))
}

func moduleRow(add ...[]driver.Value) *sqlmock.Rows {
	rows := sqlmock.NewRows(moduleColumns)
	for _, r := range add {
		rows.AddRow(r...)
	}
	return rows
}

func depRow(add ...[]driver.Value) *sqlmock.Rows {
	rows := sqlmock.NewRows(depColumns)
	for _, r := range add {
		rows.AddRow(r...)
	}
	return rows
}

// -------------------------------------------------------
// sql.ErrNoRows -> sentinel.NotFound
// -------------------------------------------------------

func TestGetModuleByID_MapsNoRowsToSentinelNotFound(t *testing.T) {
	mock, repo := regexpRepo(t)
	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("m-1", "t1").
		WillReturnError(sql.ErrNoRows)

	mod, err := repo.GetModuleByID(context.Background(), "t1", "m-1")
	if mod != nil {
		t.Fatalf("GetModuleByID = %+v, want nil", mod)
	}
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("GetModuleByID err = %v, want sentinel.NotFound", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestGetModuleByID_PassesThroughRealQueryErrors(t *testing.T) {
	mock, repo := regexpRepo(t)
	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("m-1", "t1").
		WillReturnError(errors.New("connection refused"))

	_, err := repo.GetModuleByID(context.Background(), "t1", "m-1")
	if err == nil {
		t.Fatal("GetModuleByID err = nil, want the database error")
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatalf("a connection failure was reported as not-found: %v", err)
	}
}

func TestGetModuleByName_MapsNoRowsToSentinelNotFound(t *testing.T) {
	mock, repo := regexpRepo(t)
	mock.ExpectQuery(`FROM startup_modules WHERE name=\$1 AND tenant_id=\$2`).
		WithArgs("web", "t1").
		WillReturnError(sql.ErrNoRows)

	mod, err := repo.GetModuleByName(context.Background(), "t1", "web")
	if mod != nil || !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("GetModuleByName = %+v, %v; want nil, sentinel.NotFound", mod, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestGetModuleByID_ScansEveryColumn(t *testing.T) {
	mock, repo := exactRepo(t)
	mock.ExpectQuery("SELECT * FROM startup_modules WHERE id=$1 AND tenant_id=$2").
		WithArgs("m-1", "t1").
		WillReturnRows(moduleRow([]driver.Value{
			"m-1", "t1", "web", models.ModuleTypeLazy, 7, "edge", `{"dsn":"db"}`,
			models.StatusActive, "", int64(42), nil, time.Now(), time.Now(),
		}))

	mod, err := repo.GetModuleByID(context.Background(), "t1", "m-1")
	if err != nil {
		t.Fatalf("GetModuleByID: %v", err)
	}
	if mod.ID != "m-1" || mod.TenantID != "t1" || mod.Name != "web" {
		t.Fatalf("identity fields = %+v", mod)
	}
	if mod.Type != models.ModuleTypeLazy {
		t.Errorf("type = %q, want %q", mod.Type, models.ModuleTypeLazy)
	}
	if mod.Priority != 7 || mod.Description != "edge" || mod.Config != `{"dsn":"db"}` {
		t.Errorf("row fields = %+v", mod)
	}
	if mod.Status != models.StatusActive || mod.DurationMs != 42 {
		t.Errorf("runtime fields = %+v", mod)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the query did not hit startup_modules: %v", err)
	}
}

// -------------------------------------------------------
// Empty result sets must serialise as [], not null
// -------------------------------------------------------

func TestListModules_EmptyTenantReturnsEmptySlice(t *testing.T) {
	mock, repo := regexpRepo(t)
	mock.ExpectQuery(`FROM startup_modules WHERE tenant_id=\$1 ORDER BY priority DESC, name OFFSET \$2 LIMIT \$3`).
		WithArgs("t1", 40, 20).
		WillReturnRows(moduleRow())

	items, err := repo.ListModules(context.Background(), "t1", 40, 20)
	if err != nil {
		t.Fatalf("ListModules: %v", err)
	}
	if items == nil {
		t.Fatal("ListModules returned nil for an empty tenant; JSON would emit null instead of []")
	}
	if len(items) != 0 {
		t.Fatalf("ListModules returned %d items, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestListDependencies_EmptyModuleReturnsEmptySlice(t *testing.T) {
	mock, repo := regexpRepo(t)
	mock.ExpectQuery(`FROM startup_dependencies WHERE tenant_id=\$1 AND module_id=\$2`).
		WithArgs("t1", "web").
		WillReturnRows(depRow())

	items, err := repo.ListDependencies(context.Background(), "t1", "web")
	if err != nil {
		t.Fatalf("ListDependencies: %v", err)
	}
	if items == nil {
		t.Fatal("ListDependencies returned nil; JSON would emit null instead of []")
	}
	if len(items) != 0 {
		t.Fatalf("ListDependencies returned %d items, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// -------------------------------------------------------
// DELETE that matches nothing is not a deletion
// -------------------------------------------------------

func TestDeleteModule_ZeroRowsReturnsSentinelNotFound(t *testing.T) {
	mock, repo := exactRepo(t)
	mock.ExpectExec("DELETE FROM startup_modules WHERE id=$1 AND tenant_id=$2").
		WithArgs("m-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := repo.DeleteModule(context.Background(), "t1", "m-1")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("DeleteModule on a missing row = %v, want sentinel.NotFound", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestDeleteModule_OneRowSucceeds(t *testing.T) {
	mock, repo := regexpRepo(t)
	mock.ExpectExec(`DELETE FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("m-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.DeleteModule(context.Background(), "t1", "m-1"); err != nil {
		t.Fatalf("DeleteModule: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestDeleteModule_PassesThroughQueryErrors(t *testing.T) {
	mock, repo := regexpRepo(t)
	mock.ExpectExec(`DELETE FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("m-1", "t1").
		WillReturnError(errors.New("deadlock detected"))

	err := repo.DeleteModule(context.Background(), "t1", "m-1")
	if err == nil || errors.Is(err, sentinel.NotFound) {
		t.Fatalf("DeleteModule err = %v, want the deadlock to reach the caller", err)
	}
}

// -------------------------------------------------------
// Write paths: the INSERT must target migration 275's tables
// -------------------------------------------------------

func TestCreateModule_InsertsIntoStartupModules(t *testing.T) {
	mock, repo := exactRepo(t)
	mock.ExpectExec("INSERT INTO startup_modules ( id, tenant_id, name, type, priority, description, config, status, error, duration_ms, initialized_at, created_at, updated_at ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)").
		WithArgs("m-1", "t1", "web", models.ModuleTypeLazy, 7, "edge", `{"dsn":"db"}`,
			models.StatusPending, "", int64(0), nil, sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.CreateModule(context.Background(), &models.StartupModule{
		ID: "m-1", TenantID: "t1", Name: "web", Type: models.ModuleTypeLazy,
		Priority: 7, Description: "edge", Config: `{"dsn":"db"}`, Status: models.StatusPending,
	})
	if err != nil {
		t.Fatalf("CreateModule: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("CreateModule did not use the migration 275 statement: %v", err)
	}
}

func TestCreateDependency_InsertsNamesNotUUIDs(t *testing.T) {
	mock, repo := exactRepo(t)
	mock.ExpectExec("INSERT INTO startup_dependencies (id, tenant_id, module_id, depends_on, created_at) VALUES ($1,$2,$3,$4,$5)").
		WithArgs("d-1", "t1", "web", "core", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.CreateDependency(context.Background(), &models.StartupDependency{
		ID: "d-1", TenantID: "t1", ModuleID: "web", DependsOn: "core", CreatedAt: time.Now(),
	})
	if err != nil {
		t.Fatalf("CreateDependency: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("CreateDependency did not use the migration 275 statement: %v", err)
	}
}

// -------------------------------------------------------
// Count and HasDependency
// -------------------------------------------------------

func TestCountModules_ReturnsTenantTotal(t *testing.T) {
	mock, repo := regexpRepo(t)
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM startup_modules WHERE tenant_id=\$1`).
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))

	total, err := repo.CountModules(context.Background(), "t1")
	if err != nil {
		t.Fatalf("CountModules: %v", err)
	}
	if total != 5 {
		t.Fatalf("CountModules = %d, want 5", total)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestHasDependency_TrueAndFalse(t *testing.T) {
	mock, repo := exactRepo(t)
	mock.ExpectQuery("SELECT EXISTS(SELECT 1 FROM startup_dependencies WHERE tenant_id=$1 AND module_id=$2 AND depends_on=$3)").
		WithArgs("t1", "web", "core").
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery("SELECT EXISTS(SELECT 1 FROM startup_dependencies WHERE tenant_id=$1 AND module_id=$2 AND depends_on=$3)").
		WithArgs("t1", "web", "cache").
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	if !repo.HasDependency(context.Background(), "t1", "web", "core") {
		t.Error("HasDependency(web, core) = false, want true")
	}
	if repo.HasDependency(context.Background(), "t1", "web", "cache") {
		t.Error("HasDependency(web, cache) = true, want false")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
