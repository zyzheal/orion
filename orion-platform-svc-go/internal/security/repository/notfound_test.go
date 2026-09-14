package repository

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/security/models"

	"github.com/DATA-DOG/go-sqlmock"
)

// sqlmockResult keeps the expectation sites readable.
func sqlmockResult(n int64) driver.Result {
	return sqlmock.NewResult(0, n)
}

// TestGetOne_NoRowsIsNotFound pins the mapping that lets the handlers answer 404.
// The readers used to hand the driver's "sql: no rows" up through the service, so
// every missing id answered 500 and every 404 branch in handler.go was dead code.
func TestGetOne_NoRowsIsNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT `+scanColumns+` FROM security_scans WHERE id=$1 AND tenant_id=$2`).
		WithArgs("missing", "t-1").WillReturnError(sql.ErrNoRows)

	_, err := NewRepository(db).GetScanByID(context.Background(), "t-1", "missing")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
}

// TestGetOne_DriverErrorIsNotNotFound is the negative half. getOne must only
// translate sql.ErrNoRows; a driver failure is a 500, and conflating the two is
// how a database outage used to render as "not found" for a whole tenant.
func TestGetOne_DriverErrorIsNotNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT `+scanColumns+` FROM security_scans WHERE id=$1 AND tenant_id=$2`).
		WithArgs("s-1", "t-1").WillReturnError(errors.New("connection refused"))

	_, err := NewRepository(db).GetScanByID(context.Background(), "t-1", "s-1")
	if err == nil {
		t.Fatal("want an error")
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatalf("a driver error must not be reported as not-found: %v", err)
	}
	if err.Error() != "connection refused" {
		t.Fatalf("the driver error must pass through unchanged, got %v", err)
	}
}

// TestUpdateScan_WritesEveryFinishedScanField pins the statement that
// UpdateScanStatus now ends with. Before it existed the service mutated an
// in-memory copy and returned it, so the endpoint answered with a scan whose row
// was still "pending".
func TestUpdateScan_WritesEveryFinishedScanField(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectExec(`UPDATE security_scans SET status=$1, critical_count=$2, high_count=$3, medium_count=$4, low_count=$5, total_count=$6, passed=$7, gate_failed=$8, scan_start_time=$9, scan_end_time=$10, duration_ms=$11, result=$12 WHERE id=$13 AND tenant_id=$14`).
		WithArgs("completed", 2, 5, 9, 3, 19, true, false,
			now.Add(-time.Minute), now.Add(-30*time.Second), 4200, models.JSONB{"engine": "trivy"}, "s-1", "t-1").
		WillReturnResult(sqlmockResult(1))

	start := now.Add(-time.Minute)
	end := now.Add(-30 * time.Second)
	err := NewRepository(db).UpdateScan(context.Background(), "t-1", &models.SecurityScan{
		ID: "s-1", Status: "completed",
		CriticalCount: 2, HighCount: 5, MediumCount: 9, LowCount: 3, TotalCount: 19,
		Passed: true, GateFailed: false,
		ScanStartTime: &start, ScanEndTime: &end, DurationMs: 4200,
		Result: models.JSONB{"engine": "trivy"},
	})
	if err != nil {
		t.Fatalf("UpdateScan: %v", err)
	}
}

// TestOneRow_ZeroRowsIsNotFound covers the DELETE and UPDATE paths. Without the
// RowsAffected check these reported success for ids that had already been deleted
// or that belonged to another tenant.
func TestOneRow_ZeroRowsIsNotFound(t *testing.T) {
	cases := []struct {
		name     string
		exec     string
		withArgs []driver.Value
		call     func(r *Repository) error
	}{
		{
			"DeleteScan",
			`DELETE FROM security_scans WHERE id=$1 AND tenant_id=$2`,
			[]driver.Value{"gone", "t-1"},
			func(r *Repository) error { return r.DeleteScan(context.Background(), "t-1", "gone") },
		},
		{
			"DeleteAuditPlan",
			`DELETE FROM audit_plans WHERE id=$1 AND tenant_id=$2`,
			[]driver.Value{"gone", "t-1"},
			func(r *Repository) error { return r.DeleteAuditPlan(context.Background(), "t-1", "gone") },
		},
		{
			"UpdateAuditPlanStatus",
			`UPDATE audit_plans SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
			[]driver.Value{"paused", "gone", "t-1"},
			func(r *Repository) error {
				return r.UpdateAuditPlanStatus(context.Background(), "t-1", "gone", "paused")
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db, mock := mockDB(t)
			mock.ExpectExec(tc.exec).WithArgs(tc.withArgs...).WillReturnResult(sqlmockResult(0))

			err := tc.call(NewRepository(db))
			if !errors.Is(err, sentinel.NotFound) {
				t.Fatalf("want sentinel.NotFound, got %v", err)
			}
			if !strings.Contains(err.Error(), "security") {
				t.Fatalf("the wrap must name the module so the 404 body is not generic: %v", err)
			}
		})
	}
}

func TestOneRow_OneRowIsNil(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`DELETE FROM security_scans WHERE id=$1 AND tenant_id=$2`).
		WithArgs("s-1", "t-1").WillReturnResult(sqlmockResult(1))

	if err := NewRepository(db).DeleteScan(context.Background(), "t-1", "s-1"); err != nil {
		t.Fatalf("a delete that matched a row must succeed, got %v", err)
	}
}

// errResult drives oneRow's error branch, which sqlmock cannot reach.
type errResult struct {
	n   int64
	err error
}

func (e errResult) LastInsertId() (int64, error) { return 0, nil }
func (e errResult) RowsAffected() (int64, error) { return e.n, e.err }

func TestOneRow_ReportsRowsAffectedFailures(t *testing.T) {
	for _, tc := range []struct {
		name string
		res  driver.Result
		want string
		isNF bool
	}{
		{"RowsAffected failure", errResult{1, errors.New("rows affected failed")}, "rows affected failed", false},
		{"empty table", errResult{0, nil}, "security s-1: not found", true},
		{"one row", errResult{1, nil}, "", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := (&Repository{}).oneRow(tc.res, "s-1")
			if err == nil && tc.want != "" {
				t.Fatalf("want %q", tc.want)
			}
			if err != nil && !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("want an error containing %q, got %v", tc.want, err)
			}
			if errors.Is(err, sentinel.NotFound) != tc.isNF {
				t.Fatalf("IsNotFound = %v, want %v (%v)", errors.Is(err, sentinel.NotFound), tc.isNF, err)
			}
		})
	}
}

// TestListFindings_InvalidSeverityFailsBeforeQuerying pins the repository's own
// validation. Without it a typo in the query string became an empty list that was
// indistinguishable from a scan that found nothing.
func TestListFindings_InvalidSeverityFailsBeforeQuerying(t *testing.T) {
	db, _ := mockDB(t)

	for _, bad := range []string{"Critical", "urgent", "1=1", "high' OR '1=1"} {
		_, err := NewRepository(db).ListFindings(context.Background(), "t-1", 0, 20, bad)
		if err == nil {
			t.Fatalf("ListFindings(%q) must refuse to query", bad)
		}
		if errors.Is(err, sentinel.NotFound) {
			t.Fatalf("a validation error must not look like a missing row: %v", err)
		}
		if !strings.Contains(err.Error(), "unsupported severity") {
			t.Fatalf("want the validation error, got %v", err)
		}
	}
}

func TestListFindings_FilterBranchPinsSeverityArgument(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+findingColumns+` FROM security_findings WHERE tenant_id=$1 AND severity=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`).
		WithArgs("t-1", "critical", 0, 20).WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "scan_id", "rule_id", "severity", "category", "title",
		"description", "file_path", "line_start", "line_end", "code_snippet",
		"match_text", "confidence", "remediation", "status", "assigned_to",
		"closed_at", "created_at",
	}).AddRow("f-1", "t-1", "s-1", "RULE-1", "critical", "secret", "hardcoded key",
		"", "", nil, nil, "", "", float64(1), "rotate", "open", nil, nil, now))

	got, err := NewRepository(db).ListFindings(context.Background(), "t-1", 0, 20, "critical")
	if err != nil {
		t.Fatalf("ListFindings: %v", err)
	}
	if len(got) != 1 || got[0].Severity != "critical" {
		t.Errorf("unexpected rows: %+v", got)
	}
}

// TestUpdateAuditFinding_WritesAssignment pins both halves of the audit finding
// claim path: the UPDATE that stores assigned_to and the SELECT that reads it
// back. audit_findings.assigned_to was defined only in migrations/security/001,
// which the migration runner never reads, so both of these statements answered
// 500 with 'column assigned_to does not exist'.
func TestUpdateAuditFinding_WritesAssignment(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	status := "closed"
	assignee := "u-1"
	note := "rotation added"

	mock.ExpectExec(`UPDATE audit_findings SET status=$1, closed_at=NOW(), assigned_to=$2, recommendation=$3 WHERE id=$4 AND tenant_id=$5`).
		WithArgs("closed", "u-1", "rotation added", "af-1", "t-1").
		WillReturnResult(sqlmockResult(1))
	mock.ExpectQuery(`SELECT `+auditFindingColumns+` FROM audit_findings WHERE id=$1 AND tenant_id=$2`).
		WithArgs("af-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "execution_id", "tenant_id", "title", "description", "severity", "category",
		"evidence", "recommendation", "status", "assigned_to", "closed_at", "created_at",
	}).AddRow("af-1", "ae-1", "t-1", "no rotation", "credentials never rotated", "high",
		"access", `{"path":"/etc/passwd"}`, "rotation added", "closed", "u-1", now, now))

	got, err := NewRepository(db).UpdateAuditFinding(context.Background(), "t-1", "af-1", &models.UpdateFindingRequest{
		Status:         &status,
		AssignedTo:     &assignee,
		Recommendation: &note,
	})
	if err != nil {
		t.Fatalf("UpdateAuditFinding: %v", err)
	}
	if got.Status != "closed" || got.AssignedTo == nil || *got.AssignedTo != "u-1" ||
		got.ClosedAt == nil || got.Recommendation != "rotation added" {
		t.Errorf("unexpected row: %+v", got)
	}
}
