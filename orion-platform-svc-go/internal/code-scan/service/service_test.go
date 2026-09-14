package service

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/code-scan/repository"
)

var runRowCols = []string{
	"id", "tenant_id", "target", "branch", "status", "total_vulns", "critical_count",
	"high_count", "medium_count", "low_count", "duration_sec", "error",
	"started_at", "completed_at", "created_at",
}

var findingCols = []string{
	"id", "tenant_id", "scan_id", "category", "severity", "file_path",
	"line", "description", "fix", "created_at",
}

var fixedTime = time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)

// runRow is one scan_runs row. started_at and completed_at are NULL because a
// pending run has neither, which is the shape the service writes first.
func runRow(status, target string) *sqlmock.Rows {
	return sqlmock.NewRows(runRowCols).AddRow(
		"scan-1", "t1", target, "main", status,
		int64(0), int64(0), int64(0), int64(0), int64(0), int64(0), "",
		nil, nil, fixedTime)
}

// newSvc wires the service against sqlmock. Every expectation must be
// registered before the call that starts the worker, because CreateScan and
// RerunScan launch the goroutine inside themselves: anything registered after
// the call could be consumed out of order.
func newSvc(t *testing.T) (*Service, sqlmock.Sqlmock) {
	return newSvcOrdered(t, true)
}

// newSvcUnordered matches expectations by query text instead of by order. The
// response read in RerunScan and the worker's first write can interleave, so
// an ordered mock would fail intermittently even though the SQL is correct.
func newSvcUnordered(t *testing.T) (*Service, sqlmock.Sqlmock) {
	return newSvcOrdered(t, false)
}

func newSvcOrdered(t *testing.T, ordered bool) (*Service, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	mock.MatchExpectationsInOrder(ordered)
	t.Cleanup(func() { _ = db.Close() })
	return NewService(repository.NewRepository(sqlx.NewDb(db, "sqlmock")), zap.NewNop()), mock
}

func writeTree(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	for path, body := range files {
		full := filepath.Join(dir, path)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

// TestCreateScan_RejectsEmptyAndNonexistentTargets is the guard against a run
// row that can never be scanned. validateTarget must reject before any SQL
// happens, so no expectation is registered: a mutant that inserts first would
// fail on an unexpected driver call.
func TestCreateScan_RejectsEmptyAndNonexistentTargets(t *testing.T) {
	s, _ := newSvc(t)
	for _, target := range []string{"", "   ", "/definitely/not/here/now", "no/such/file.go"} {
		rec, err := s.CreateScan(context.Background(), "t1", target, "main")
		if err == nil {
			t.Fatalf("target %q: expected an error, got %+v", target, rec)
		}
		if !errors.Is(err, ErrInvalidTarget) {
			t.Fatalf("target %q: want ErrInvalidTarget, got %v", target, err)
		}
		if rec != nil {
			t.Errorf("target %q: a rejected target must not return a record", target)
		}
	}
}

// TestCreateScan_WalksTheTargetAndWritesTheFindings is the end-to-end path:
// the HTTP call records a pending row and returns, then the worker moves the
// row through running and completed and stores what the walk actually found.
// Without Wait, the assertion would pass even if the worker never ran.
func TestCreateScan_WalksTheTargetAndWritesTheFindings(t *testing.T) {
	s, mock := newSvc(t)
	target := writeTree(t, map[string]string{
		"pkg/creds.go": "// line one\nvar key = \"AKIAIOSFODNN7EXAMPLE\"\n",
	})

	mock.ExpectExec(`INSERT INTO code_scan_runs`).
		WithArgs(sqlmock.AnyArg(), "t1", sqlmock.AnyArg(), "feature-x", "pending",
			0, 0, 0, 0, 0, 0, "", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	// worker StartScan
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings WHERE tenant_id=\$1 AND scan_id=\$2`).
		WithArgs("t1", sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE code_scan_runs SET status='running'`).
		WithArgs(sqlmock.AnyArg(), "t1", sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	// worker FinishScan: the counts come from the walk, not from the request
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings`).WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE code_scan_runs SET status='completed'`).
		WithArgs(1, 1, 0, 0, 0, sqlmock.AnyArg(), sqlmock.AnyArg(), "t1", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`INSERT INTO code_scan_findings`).
		WithArgs(sqlmock.AnyArg(), "t1", sqlmock.AnyArg(), "sensitive_data", "critical",
			"pkg/creds.go", int64(2), "AWS access key ID committed to source",
			"Revoke the key in IAM and move it to environment configuration", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	rec, err := s.CreateScan(context.Background(), "t1", target, "feature-x")
	if err != nil {
		t.Fatalf("CreateScan: %v", err)
	}
	if rec.Status != "pending" {
		t.Errorf("the row is created as pending, got %q", rec.Status)
	}
	if rec.Branch != "feature-x" {
		t.Errorf("the requested branch must be stored, got %q", rec.Branch)
	}
	if !filepath.IsAbs(rec.Target) {
		t.Errorf("the stored target must be absolute so a later rerun resolves: %q", rec.Target)
	}
	if rec.TenantID != "t1" {
		t.Errorf("the tenant must be stored with the run, got %q", rec.TenantID)
	}
	if !strings.HasPrefix(rec.ID, "scan-") {
		t.Errorf("the run id must be generated by the service, got %q", rec.ID)
	}

	s.Wait()
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the worker did not drive the full lifecycle: %v", err)
	}
}

// TestCreateScan_DefaultsTheBranch stores "main" when the caller does not
// send one, so the run list never shows a blank branch column.
func TestCreateScan_DefaultsTheBranch(t *testing.T) {
	s, mock := newSvc(t)
	target := writeTree(t, map[string]string{"main.go": "package main\n"})

	mock.ExpectExec(`INSERT INTO code_scan_runs`).
		WithArgs(sqlmock.AnyArg(), "t1", sqlmock.AnyArg(), "main", "pending",
			0, 0, 0, 0, 0, 0, "", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings`).WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE code_scan_runs SET status='running'`).
		WithArgs(sqlmock.AnyArg(), "t1", sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings`).WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE code_scan_runs SET status='completed'`).
		WithArgs(0, 0, 0, 0, 0, sqlmock.AnyArg(), sqlmock.AnyArg(), "t1", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	rec, err := s.CreateScan(context.Background(), "t1", target, "  ")
	if err != nil {
		t.Fatalf("CreateScan: %v", err)
	}
	if rec.Branch != "main" {
		t.Errorf("a blank branch must default to main, got %q", rec.Branch)
	}
	s.Wait()
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

// TestRerunScan_CleanTreeReportsZero is the regression test for a rerun that
// repeats the previous attempt's total. The target has no findings now, so the
// completed UPDATE must carry all-zero counts; if StartScan did not reset the
// counters the row would still claim the first attempt's 47 findings, and the
// DELETE that drops them would have to run again in the same transaction.
func TestRerunScan_CleanTreeReportsZero(t *testing.T) {
	s, mock := newSvcUnordered(t)
	target := writeTree(t, map[string]string{"main.go": "package main\n\nfunc main() {}\n"})

	// the stored run, from the first (already failed) attempt
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 AND id=\$2`).
		WithArgs("t1", "scan-1").WillReturnRows(runRow("failed", target))

	// synchronous StartScan: 47 old findings are dropped here
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings WHERE tenant_id=\$1 AND scan_id=\$2`).
		WithArgs("t1", "scan-1").WillReturnResult(sqlmock.NewResult(0, 47))
	mock.ExpectExec(`UPDATE code_scan_runs SET status='running'`).
		WithArgs(sqlmock.AnyArg(), "t1", "scan-1").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	// worker StartScan
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings`).WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE code_scan_runs SET status='running'`).
		WithArgs(sqlmock.AnyArg(), "t1", "scan-1").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	// worker FinishScan: a clean tree must report zero, not the old 47
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings`).WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE code_scan_runs SET status='completed'`).
		WithArgs(0, 0, 0, 0, 0, sqlmock.AnyArg(), sqlmock.AnyArg(), "t1", "scan-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	// the response re-reads the row the database actually holds
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 AND id=\$2`).
		WithArgs("t1", "scan-1").WillReturnRows(runRow("completed", target))

	rec, err := s.RerunScan(context.Background(), "t1", "scan-1")
	if err != nil {
		t.Fatalf("RerunScan: %v", err)
	}
	s.Wait()

	if rec.Status != "completed" {
		t.Errorf("the rerun must finish as completed, got %q", rec.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

// TestRerunScan_MissingIDIsNotFound maps the repository sentinel onto the
// handler's 404 branch.
func TestRerunScan_MissingIDIsNotFound(t *testing.T) {
	s, mock := newSvc(t)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 AND id=\$2`).
		WithArgs("t1", "missing").WillReturnError(sql.ErrNoRows)

	_, err := s.RerunScan(context.Background(), "t1", "missing")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

// TestRerunScan_UnscannableTargetIsInvalidTarget catches the directory being
// deleted between the first run and the rerun.
func TestRerunScan_UnscannableTargetIsInvalidTarget(t *testing.T) {
	s, mock := newSvc(t)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 AND id=\$2`).
		WithArgs("t1", "scan-1").WillReturnRows(runRow("failed", "/no/such/directory/at/all"))

	_, err := s.RerunScan(context.Background(), "t1", "scan-1")
	if !errors.Is(err, ErrInvalidTarget) {
		t.Fatalf("want ErrInvalidTarget, got %v", err)
	}
	// No StartScan may have run: a deleted target cannot be scanned, so the row
	// must be left untouched rather than flipped to 'running'.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

func TestListScans_ClampsLimit(t *testing.T) {
	for _, tc := range []struct {
		name string
		in   int
		want int
	}{
		{"absent", 0, 100},
		{"negative", -5, 100},
		{"exact", 50, 50},
		{"over", 5000, 1000},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s, mock := newSvc(t)
			mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 ORDER BY created_at DESC, id DESC LIMIT \$2`).
				WithArgs("t1", tc.want).
				WillReturnRows(sqlmock.NewRows(runRowCols))

			out, err := s.ListScans(context.Background(), "t1", tc.in)
			if err != nil {
				t.Fatalf("ListScans: %v", err)
			}
			if out == nil || len(out) != 0 {
				t.Fatalf("want an empty non-nil slice, got %v", out)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("limit %d must be bound as %d: %v", tc.in, tc.want, err)
			}
		})
	}
}

func TestListFindings_PassesTheScanFilterThrough(t *testing.T) {
	s, mock := newSvc(t)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_findings WHERE tenant_id=\$1 AND scan_id=\$2 ORDER BY severity, created_at DESC, id DESC LIMIT \$3`).
		WithArgs("t1", "scan-9", 100).
		WillReturnRows(sqlmock.NewRows(findingCols))

	out, err := s.ListFindings(context.Background(), "t1", "scan-9", 100)
	if err != nil {
		t.Fatalf("ListFindings: %v", err)
	}
	if len(out) != 0 {
		t.Fatalf("want no findings, got %d", len(out))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

func TestNormaliseBranch(t *testing.T) {
	for _, tc := range []struct {
		in   string
		want string
	}{
		{"", "main"},
		{"   ", "main"},
		{"release/1.2", "release/1.2"},
		{"  hotfix/a  ", "hotfix/a"},
	} {
		if got := normaliseBranch(tc.in); got != tc.want {
			t.Errorf("normaliseBranch(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}

	long := strings.Repeat("x", 500)
	if got := normaliseBranch(long); len(got) != maxBranchLen {
		t.Errorf("a long branch must be capped at %d, got %d", maxBranchLen, len(got))
	}
}

func TestClampLimit(t *testing.T) {
	for _, in := range []int{-1, 0, 1, 100, 999, 1000, 1001, 100000} {
		got := clampLimit(in)
		if got < 1 {
			t.Errorf("clampLimit(%d) = %d, must be at least 1", in, got)
		}
		if got > maxLimit {
			t.Errorf("clampLimit(%d) = %d, exceeds the %d cap", in, got, maxLimit)
		}
	}
	if got := clampLimit(1000); got != 1000 {
		t.Errorf("clampLimit(1000) = %d, want 1000", got)
	}
	if got := clampLimit(0); got != defaultLimit {
		t.Errorf("clampLimit(0) = %d, want the %d default", got, defaultLimit)
	}
}

// TestNewID_IsUniqueAndPrefixed keeps the primary keys of the runs and
// findings tables from colliding when the service is called in quick
// succession.
func TestNewID_IsUniqueAndPrefixed(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 10000; i++ {
		id := newID("scan")
		if !strings.HasPrefix(id, "scan-") {
			t.Fatalf("bad prefix: %q", id)
		}
		if seen[id] {
			t.Fatalf("duplicate id: %q", id)
		}
		seen[id] = true
	}
}
