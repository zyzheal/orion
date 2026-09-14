package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/code-scan/models"
)

var runRowCols = []string{
	"id", "tenant_id", "target", "branch", "status", "total_vulns", "critical_count",
	"high_count", "medium_count", "low_count", "duration_sec", "error",
	"started_at", "completed_at", "created_at",
}

var findingRowCols = []string{
	"id", "tenant_id", "scan_id", "category", "severity", "file_path",
	"line", "description", "fix", "created_at",
}

func repo(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return NewRepository(sqlx.NewDb(db, "sqlmock")), mock
}

// TestCreate_BindsEveryRunColumn proves the INSERT binds each named field.
// Every placeholder must resolve to a struct field, and the field must resolve
// to the column the placeholder writes into: sqlx lowercases Go field names by
// default, so TotalVulns would look for ":totalvulns" and the INSERT would die
// before it reached the database.
func TestCreate_BindsEveryRunColumn(t *testing.T) {
	r, mock := repo(t)
	now := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)
	started := now.Add(-7 * time.Second)

	mock.ExpectExec(`INSERT INTO code_scan_runs`).
		WithArgs("scan-1", "t1", "/repo/api", "main", "completed",
			3, 1, 1, 1, 0, 7, "", started, now, now).
		WillReturnResult(sqlmock.NewResult(1, 1))

	rec := &models.ScanRecord{
		ID: "scan-1", TenantID: "t1", Target: "/repo/api", Branch: "main",
		Status: "completed", TotalVulns: 3, Critical: 1, High: 1, Medium: 1,
		Low: 0, Duration: 7, StartedAt: &started, CompletedAt: &now, CreatedAt: now,
	}
	if err := r.Create(context.Background(), rec); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

// TestCreate_DoesNotBindATenantFromAnotherTenant is the tenant test. The runs
// table holds every tenant's targets, so a bound tenant_id is the only thing
// stopping one tenant from learning another tenant's paths and branch names.
func TestCreate_DoesNotBindATenantFromAnotherTenant(t *testing.T) {
	r, mock := repo(t)
	mock.ExpectExec(`INSERT INTO code_scan_runs`).
		WithArgs("scan-1", sqlmock.AnyArg(), "/repo/api", "main", "pending",
			0, 0, 0, 0, 0, 0, "", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	rec := &models.ScanRecord{
		ID: "scan-1", TenantID: "t1", Target: "/repo/api", Branch: "main",
		Status: "pending", CreatedAt: time.Now().UTC(),
	}
	if err := r.Create(context.Background(), rec); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

func TestList_BindsTenantAndLimitAndNamesItsColumns(t *testing.T) {
	r, mock := repo(t)
	// [^*]+ forbids a SELECT *: a wildcard select crashes on the first row as
	// soon as a migration adds a column the model does not declare.
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 ORDER BY created_at DESC, id DESC LIMIT \$2`).
		WithArgs("t1", 100).
		WillReturnRows(sqlmock.NewRows(runRowCols))

	out, err := r.List(context.Background(), "t1", 100)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if out == nil {
		t.Fatal("an empty result must be an empty slice, not nil, so the API returns []")
	}
	if len(out) != 0 {
		t.Fatalf("expected an empty list, got %d rows", len(out))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

func TestList_MapsTheCountColumnsOntoTheModel(t *testing.T) {
	r, mock := repo(t)
	now := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)
	started := now.Add(-7 * time.Second)

	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1`).
		WithArgs("t1", 100).
		WillReturnRows(sqlmock.NewRows(runRowCols).AddRow(
			"scan-1", "t1", "/repo/api", "main", "completed",
			int64(3), int64(1), int64(1), int64(1), int64(0), int64(7), "",
			started, nil, now))

	out, err := r.List(context.Background(), "t1", 100)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("got %d rows, want 1", len(out))
	}
	got := out[0]
	if got.ID != "scan-1" || got.TenantID != "t1" || got.Target != "/repo/api" || got.Branch != "main" || got.Status != "completed" {
		t.Errorf("identity columns not mapped: %+v", got)
	}
	if got.TotalVulns != 3 {
		t.Errorf("TotalVulns = %d, want 3 (from total_vulns)", got.TotalVulns)
	}
	if got.Critical != 1 || got.High != 1 || got.Medium != 1 {
		t.Errorf("per-severity counts not mapped: %+v", got)
	}
	if got.Duration != 7 {
		t.Errorf("Duration = %d, want 7 (from duration_sec)", got.Duration)
	}
	if got.CompletedAt != nil {
		t.Errorf("a NULL completed_at must scan as a nil pointer, got %v", got.CompletedAt)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

func TestList_ReturnsTheDatabaseError(t *testing.T) {
	r, mock := repo(t)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1`).
		WithArgs("t1", 100).WillReturnError(errors.New("connection refused"))

	out, err := r.List(context.Background(), "t1", 100)
	if err == nil {
		t.Fatal("a database failure must surface as an error")
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Error("a connection failure must not be reported as a missing row")
	}
	if len(out) != 0 {
		t.Errorf("a failed list must not return rows, got %v", out)
	}
}

func TestGetByID_BindsTenantAndID(t *testing.T) {
	r, mock := repo(t)
	now := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 AND id=\$2`).
		WithArgs("t1", "scan-1").
		WillReturnRows(sqlmock.NewRows(runRowCols).AddRow(
			"scan-1", "t1", "/repo/api", "main", "pending",
			int64(0), int64(0), int64(0), int64(0), int64(0), int64(0), "",
			nil, nil, now))

	rec, err := r.GetByID(context.Background(), "t1", "scan-1")
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if rec.ID != "scan-1" || rec.TenantID != "t1" {
		t.Errorf("row not mapped: %+v", rec)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

// TestGetByID_NoRowsIsNotFound is the 404 path. sql.ErrNoRows is not
// sentinel.NotFound, so without this wrap a missing id answers 500 and the
// rerun button reports a server error for a scan that was never there.
func TestGetByID_NoRowsIsNotFound(t *testing.T) {
	r, mock := repo(t)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 AND id=\$2`).
		WithArgs("t1", "missing").WillReturnError(sql.ErrNoRows)

	_, err := r.GetByID(context.Background(), "t1", "missing")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
}

func TestGetByID_OtherErrorIsNotNotFound(t *testing.T) {
	r, mock := repo(t)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 AND id=\$2`).
		WithArgs("t1", "scan-1").WillReturnError(errors.New("connection refused"))

	_, err := r.GetByID(context.Background(), "t1", "scan-1")
	if errors.Is(err, sentinel.NotFound) {
		t.Fatalf("a database failure must not become a 404: %v", err)
	}
}

// TestStartScan_ResetsTheCountersAndDropsTheOldFindings is the rerun test.
// A rerun reuses the row, so the counters and the findings of the previous
// attempt must be cleared in the same transaction as the status change.
func TestStartScan_ResetsTheCountersAndDropsTheOldFindings(t *testing.T) {
	r, mock := repo(t)
	started := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings WHERE tenant_id=\$1 AND scan_id=\$2`).
		WithArgs("t1", "scan-1").WillReturnResult(sqlmock.NewResult(0, 47))
	mock.ExpectExec(`UPDATE code_scan_runs SET status='running'`).
		WithArgs(started, "t1", "scan-1").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	if err := r.StartScan(context.Background(), "t1", "scan-1", started); err != nil {
		t.Fatalf("StartScan: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

func TestStartScan_NoRowsAffectedIsNotFound(t *testing.T) {
	r, mock := repo(t)
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings`).WillReturnResult(sqlmock.NewResult(0, 0))
	// RowsAffected = 0: the row is not in this tenant, so no UPDATE matched.
	mock.ExpectExec(`UPDATE code_scan_runs SET status='running'`).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectRollback()

	err := r.StartScan(context.Background(), "t1", "missing", time.Now().UTC())
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

func TestFailScan_BindsTheErrorText(t *testing.T) {
	r, mock := repo(t)
	mock.ExpectExec(`UPDATE code_scan_runs SET status='failed'`).
		WithArgs("t1", "scan-1", "cannot read target").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.FailScan(context.Background(), "t1", "scan-1", "cannot read target"); err != nil {
		t.Fatalf("FailScan: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

// TestFinishScan_WritesCountsAndFindingsInOneTransaction is the atomicity test.
// The status update and the finding inserts must commit together: a crash
// between them would leave a run that claims 47 findings with an empty
// findings table.
func TestFinishScan_WritesCountsAndFindingsInOneTransaction(t *testing.T) {
	r, mock := repo(t)
	completed := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)
	created := completed.Add(-7 * time.Second)

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings WHERE tenant_id=\$1 AND scan_id=\$2`).
		WithArgs("t1", "scan-1").WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE code_scan_runs SET status='completed'`).
		WithArgs(3, 1, 1, 1, 0, 7, completed, "t1", "scan-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`INSERT INTO code_scan_findings`).
		WithArgs("vuln-1", "t1", "scan-1", "sensitive_data", "critical",
			"config/prod.yaml", int64(2), "description", "fix", created).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(`INSERT INTO code_scan_findings`).
		WithArgs("vuln-2", "t1", "scan-1", "injection", "high",
			"handlers/api.go", int64(41), "description", "fix", created).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	counts := models.Counts{Total: 3, Critical: 1, High: 1, Medium: 1, Low: 0}
	findings := []models.VulnFinding{
		{ID: "vuln-1", TenantID: "t1", ScanID: "scan-1", Category: "sensitive_data",
			Severity: "critical", File: "config/prod.yaml", Line: 2,
			Description: "description", Fix: "fix", CreatedAt: created},
		{ID: "vuln-2", TenantID: "t1", ScanID: "scan-1", Category: "injection",
			Severity: "high", File: "handlers/api.go", Line: 41,
			Description: "description", Fix: "fix", CreatedAt: created},
	}
	if err := r.FinishScan(context.Background(), "t1", "scan-1", counts, 7, completed, findings); err != nil {
		t.Fatalf("FinishScan: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

func TestFinishScan_NoRowsAffectedIsNotFoundAndDoesNotInsert(t *testing.T) {
	r, mock := repo(t)
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings`).WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE code_scan_runs SET status='completed'`).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectRollback()

	err := r.FinishScan(context.Background(), "t1", "missing",
		models.Counts{Total: 3, Critical: 1, High: 1, Medium: 1}, 7,
		time.Now().UTC(), []models.VulnFinding{
			{ID: "vuln-1", TenantID: "t1", ScanID: "missing", Category: "injection",
				Severity: "high", File: "a.go", Line: 1, Description: "d", Fix: "f",
				CreatedAt: time.Now().UTC()},
		})
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
	// The rollback must happen before any finding insert: an orphan findings row
	// with no run to belong to would show up in the list with a dead scan id.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

func TestListFindings_WithoutAScanIDListsTheTenantFindings(t *testing.T) {
	r, mock := repo(t)
	now := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_findings WHERE tenant_id=\$1 ORDER BY severity, created_at DESC, id DESC LIMIT \$2`).
		WithArgs("t1", 100).
		WillReturnRows(sqlmock.NewRows(findingRowCols).AddRow(
			"vuln-1", "t1", "scan-1", "sensitive_data", "critical",
			"config/prod.yaml", int64(2), "description", "fix", now))

	out, err := r.ListFindings(context.Background(), "t1", "", 100)
	if err != nil {
		t.Fatalf("ListFindings: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("got %d findings, want 1", len(out))
	}
	got := out[0]
	if got.ID != "vuln-1" || got.TenantID != "t1" || got.ScanID != "scan-1" || got.Category != "sensitive_data" ||
		got.Severity != "critical" || got.File != "config/prod.yaml" || got.Line != 2 {
		t.Errorf("finding columns not mapped: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

func TestListFindings_WithAScanIDScopesByTenantAndScan(t *testing.T) {
	r, mock := repo(t)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_findings WHERE tenant_id=\$1 AND scan_id=\$2 ORDER BY severity, created_at DESC, id DESC LIMIT \$3`).
		WithArgs("t1", "scan-1", 100).
		WillReturnRows(sqlmock.NewRows(findingRowCols))

	out, err := r.ListFindings(context.Background(), "t1", "scan-1", 100)
	if err != nil {
		t.Fatalf("ListFindings: %v", err)
	}
	if out == nil || len(out) != 0 {
		t.Fatalf("want an empty non-nil slice, got %v", out)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

func TestListFindings_DatabaseErrorSurfaces(t *testing.T) {
	r, mock := repo(t)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_findings WHERE tenant_id=\$1`).
		WithArgs("t1", 100).WillReturnError(errors.New("connection refused"))

	out, err := r.ListFindings(context.Background(), "t1", "", 100)
	if err == nil {
		t.Fatal("a database failure must surface as an error")
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Error("a connection failure must not be reported as a missing row")
	}
	if len(out) != 0 {
		t.Errorf("a failed list must not return findings, got %v", out)
	}
}
