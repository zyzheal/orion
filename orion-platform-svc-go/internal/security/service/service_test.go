package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/security/models"
	"orion/platform-svc-go/internal/security/repository"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func TestNewServiceNotNil(t *testing.T) {
	svc := NewService(&repository.Repository{})
	if svc == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestNewServiceNilRepo(t *testing.T) {
	svc := NewService(nil)
	if svc == nil {
		t.Fatal("NewService returned nil")
	}
}

// mockSvc wires a Service through the real repository onto a sqlmock DB, so a
// service test observes the exact statements the endpoint sends.
func mockSvc(t *testing.T) (*Service, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return NewService(repository.NewRepository(sqlx.NewDb(raw, "postgres"))), mock
}

// TestIsNotFound pins the one predicate the handlers switch on to choose between
// 404 and 500. It must recognise the repository's sentinel and this module's own
// per-entity sentinels, and nothing else: a driver error that is not mapped here
// is answered 404, which is how a database outage used to present as "row not
// found" and how every 500 branch stayed unreachable.
func TestIsNotFound(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"repository sentinel", sentinel.NotFound, true},
		{"wrapped sentinel", fmt.Errorf("audit plans: %w", sentinel.NotFound), true},
		{"scan", ErrSecurityScanNotFound, true},
		{"audit plan", ErrAuditPlanNotFound, true},
		{"finding", ErrFindingNotFound, true},
		{"policy", ErrPolicyNotFound, true},
		{"SBOM", ErrSBOMNotFound, true},
		{"driver failure", errors.New("connection refused"), false},
		{"raw driver no-rows", sql.ErrNoRows, false},
		{"validation", ErrInvalidSeverity, false},
		{"nil", nil, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsNotFound(tc.err); got != tc.want {
				t.Errorf("IsNotFound(%v) = %v, want %v", tc.err, got, tc.want)
			}
		})
	}
}

// TestCalculateScore_FloorsAtZero pins the clamp. Unguarded, the formula went
// negative past ten gaps, so the worst possible policy looked cleaner than a
// compliant one.
func TestCalculateScore_FloorsAtZero(t *testing.T) {
	for _, n := range []int{0, 1, 5, 9, 10, 11, 50} {
		gaps := make([]models.ComplianceGap, n)
		if got := NewService(nil).calculateScore(gaps); got < 0 || got > 100 {
			t.Errorf("calculateScore(%d gaps) = %v, want it in [0,100]", n, got)
		}
	}
	if got := NewService(nil).calculateScore(nil); got != 100 {
		t.Errorf("calculateScore(0 gaps) = %v, want 100", got)
	}
	if got := NewService(nil).calculateScore(make([]models.ComplianceGap, 10)); got != 0 {
		t.Errorf("calculateScore(10 gaps) = %v, want 0", got)
	}
	if got := NewService(nil).calculateScore(make([]models.ComplianceGap, 11)); got != 0 {
		t.Errorf("calculateScore(11 gaps) = %v, want 0", got)
	}
}

const policyColumns = "id, tenant_id, name, description, framework_type, requirements, rules, severity_threshold, enabled, created_by, created_at, updated_at"

func policyRow() *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "description", "framework_type", "requirements",
		"rules", "severity_threshold", "enabled", "created_by", "created_at", "updated_at",
	}).AddRow("pol-1", "t-1", "security baseline", "controls", "security",
		`{"controls":["c-1"]}`, `["r-1","r-2"]`, "high", true, nil, now, now)
}

const evaluationColumns = "id, tenant_id, policy_id, status, score, total_checks, passed_checks, failed_checks, gaps, started_at, completed_at, created_at"

func evaluationRow(score float64, gapsJSON string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "policy_id", "status", "score", "total_checks",
		"passed_checks", "failed_checks", "gaps", "started_at", "completed_at", "created_at",
	}).AddRow("ev-1", "t-1", "pol-1", "completed", score, 10, 8, 2, gapsJSON, now, nil, now)
}

// TestGetComplianceScore_DatabaseErrorIsNotFullCompliance is the regression for
// the case where a tenant looked fully conformant because its database was down.
// Before the fix the lookup error fell through the "no policies" branch and
// returned OverallScore 100.
func TestGetComplianceScore_DatabaseErrorIsNotFullCompliance(t *testing.T) {
	svc, mock := mockSvc(t)
	mock.ExpectQuery("SELECT .* FROM compliance_policies WHERE tenant_id=\\$1 ORDER BY created_at DESC").
		WithArgs("t-1").WillReturnError(errors.New("db down"))

	got, err := svc.GetComplianceScore(context.Background(), "t-1")
	if err == nil {
		t.Fatalf("want an error, got %+v", got)
	}
	if got != nil {
		t.Fatalf("a failed lookup must not produce a score, got %+v", got)
	}
	if strings.Contains(err.Error(), "not found") {
		t.Fatalf("a database error must not be reported as not-found: %v", err)
	}
}

func TestGetComplianceScore_EvaluationLookupErrorIsNotFullCompliance(t *testing.T) {
	svc, mock := mockSvc(t)
	mock.ExpectQuery("SELECT .* FROM compliance_policies WHERE tenant_id=\\$1 ORDER BY created_at DESC").
		WithArgs("t-1").WillReturnRows(policyRow())
	mock.ExpectQuery("SELECT .* FROM compliance_evaluations WHERE tenant_id=\\$1 AND policy_id=\\$2 ORDER BY created_at DESC LIMIT 1").
		WithArgs("t-1", "pol-1").WillReturnError(errors.New("db down"))

	got, err := svc.GetComplianceScore(context.Background(), "t-1")
	if err == nil {
		t.Fatalf("want an error, got %+v", got)
	}
	if got != nil {
		t.Fatalf("a failed evaluation lookup must not score the tenant, got %+v", got)
	}
}

func TestGetComplianceScore_MissingEvaluationIsFullCompliance(t *testing.T) {
	svc, mock := mockSvc(t)
	mock.ExpectQuery("SELECT .* FROM compliance_policies WHERE tenant_id=\\$1 ORDER BY created_at DESC").
		WithArgs("t-1").WillReturnRows(policyRow())
	mock.ExpectQuery("SELECT .* FROM compliance_evaluations WHERE tenant_id=\\$1 AND policy_id=\\$2 ORDER BY created_at DESC LIMIT 1").
		WithArgs("t-1", "pol-1").WillReturnError(sql.ErrNoRows)

	got, err := svc.GetComplianceScore(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("GetComplianceScore: %v", err)
	}
	if got.OverallScore != 100 || got.PoliciesEvaluated != 1 {
		t.Errorf("no evaluation means compliant: got %+v", got)
	}
}

func TestGetComplianceScore_ScoresTheStoredEvaluation(t *testing.T) {
	svc, mock := mockSvc(t)
	mock.ExpectQuery("SELECT .* FROM compliance_policies WHERE tenant_id=\\$1 ORDER BY created_at DESC").
		WithArgs("t-1").WillReturnRows(policyRow())
	mock.ExpectQuery("SELECT .* FROM compliance_evaluations WHERE tenant_id=\\$1 AND policy_id=\\$2 ORDER BY created_at DESC LIMIT 1").
		WithArgs("t-1", "pol-1").WillReturnRows(evaluationRow(80, `[{"severity":"critical","rule":"r-1"},{"severity":"high","rule":"r-2"}]`))

	got, err := svc.GetComplianceScore(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("GetComplianceScore: %v", err)
	}
	if got.OverallScore != 80 || got.PoliciesEvaluated != 1 ||
		got.OpenGaps != 2 || got.CriticalGaps != 1 || got.PoliciesByFramework["security"] != 80 {
		t.Errorf("unexpected summary: %+v", got)
	}
}

const scanColumns = "id, tenant_id, scan_type, target, scanner, status, critical_count, high_count, medium_count, low_count, total_count, passed, gate_failed, scan_start_time, scan_end_time, duration_ms, result, created_at"

func scanRow() *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "scan_type", "target", "scanner", "status",
		"critical_count", "high_count", "medium_count", "low_count", "total_count",
		"passed", "gate_failed", "scan_start_time", "scan_end_time", "duration_ms",
		"result", "created_at",
	}).AddRow("s-1", "t-1", "sast", "svc-a", "trivy", "pending",
		0, 0, 0, 0, 0, false, false, nil, nil, 0, `{}`, now)
}

// TestUpdateScanStatus_Persists proves the endpoint writes the row. Before the
// fix it answered with a mutated in-memory copy, so the database still held the
// "pending" record and GET /scans/:id disagreed with the update.
func TestUpdateScanStatus_Persists(t *testing.T) {
	svc, mock := mockSvc(t)
	mock.ExpectQuery("SELECT .* FROM security_scans WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("s-1", "t-1").WillReturnRows(scanRow())
	mock.ExpectExec("UPDATE security_scans SET status=\\$1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	got, err := svc.UpdateScanStatus(context.Background(), "t-1", "s-1", map[string]interface{}{
		"status": "completed", "total_count": 19, "critical_count": 2, "passed": true,
	})
	if err != nil {
		t.Fatalf("UpdateScanStatus: %v", err)
	}
	if got.Status != "completed" || got.TotalCount != 19 || got.CriticalCount != 2 || !got.Passed {
		t.Errorf("unexpected scan: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the UPDATE did not fire: %v", err)
	}
}

func TestUpdateScanStatus_MissingScanIsNotFound(t *testing.T) {
	svc, mock := mockSvc(t)
	mock.ExpectQuery("SELECT .* FROM security_scans WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("missing", "t-1").WillReturnError(sql.ErrNoRows)

	_, err := svc.UpdateScanStatus(context.Background(), "t-1", "missing", map[string]interface{}{"status": "completed"})
	if !errors.Is(err, ErrSecurityScanNotFound) {
		t.Fatalf("want ErrSecurityScanNotFound, got %v", err)
	}
}

func TestUpdateScanStatus_DatabaseErrorSurfaces(t *testing.T) {
	svc, mock := mockSvc(t)
	mock.ExpectQuery("SELECT .* FROM security_scans WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("s-1", "t-1").WillReturnError(errors.New("connection refused"))

	_, err := svc.UpdateScanStatus(context.Background(), "t-1", "s-1", map[string]interface{}{"status": "completed"})
	if err == nil {
		t.Fatal("want an error")
	}
	if errors.Is(err, ErrSecurityScanNotFound) {
		t.Fatalf("a driver error must not be reported as a missing scan: %v", err)
	}
	if err.Error() != "connection refused" {
		t.Fatalf("the driver error must pass through unchanged, got %v", err)
	}
}

func TestListFindings_InvalidSeverityIsBadRequest(t *testing.T) {
	svc, _ := mockSvc(t)

	for _, bad := range []string{"Critical", "urgent", "1=1", "high' OR '1=1"} {
		got, err := svc.ListFindings(context.Background(), "t-1", 0, 20, bad)
		if !errors.Is(err, ErrInvalidSeverity) {
			t.Fatalf("ListFindings(%q): want ErrInvalidSeverity, got %v", bad, err)
		}
		if got != nil {
			t.Fatalf("a rejected filter must not return rows: %+v", got)
		}
	}
}

func TestListFindings_ValidSeverityStillQueries(t *testing.T) {
	svc, mock := mockSvc(t)
	now := time.Now().UTC()
	mock.ExpectQuery("SELECT .* FROM security_findings WHERE tenant_id=\\$1 AND severity=\\$2").
		WithArgs("t-1", "critical", 0, 20).WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "scan_id", "rule_id", "severity", "category", "title",
		"description", "file_path", "line_start", "line_end", "code_snippet",
		"match_text", "confidence", "remediation", "status", "assigned_to",
		"closed_at", "created_at",
	}).AddRow("f-1", "t-1", "s-1", "RULE-1", "critical", "secret", "hardcoded key",
		"", "", nil, nil, "", "", float64(1), "rotate", "open", nil, nil, now))

	got, err := svc.ListFindings(context.Background(), "t-1", 0, 20, "critical")
	if err != nil {
		t.Fatalf("ListFindings: %v", err)
	}
	if len(got) != 1 {
		t.Errorf("unexpected rows: %+v", got)
	}
}

func TestExecuteAudit_LookupErrorIsNotNotFound(t *testing.T) {
	for _, tc := range []struct {
		name      string
		driverErr error
	}{
		{"missing plan", sql.ErrNoRows},
		{"database down", errors.New("connection refused")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, mock := mockSvc(t)
			mock.ExpectQuery("SELECT .* FROM audit_plans WHERE id=\\$1 AND tenant_id=\\$2").
				WithArgs("p-1", "t-1").WillReturnError(tc.driverErr)

			got, err := svc.ExecuteAudit(context.Background(), "t-1", "p-1")
			if err == nil {
				t.Fatalf("want an error, got %+v", got)
			}
			if tc.name == "missing plan" {
				if !errors.Is(err, ErrAuditPlanNotFound) {
					t.Fatalf("want ErrAuditPlanNotFound, got %v", err)
				}
			} else {
				if errors.Is(err, ErrAuditPlanNotFound) || errors.Is(err, sentinel.NotFound) {
					t.Fatalf("a driver error must not be reported as a missing plan: %v", err)
				}
			}
		})
	}
}

func TestEvaluateCompliance_LookupErrorIsNotNotFound(t *testing.T) {
	for _, tc := range []struct {
		name      string
		driverErr error
	}{
		{"missing policy", sql.ErrNoRows},
		{"database down", errors.New("connection refused")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, mock := mockSvc(t)
			mock.ExpectQuery("SELECT .* FROM compliance_policies WHERE id=\\$1 AND tenant_id=\\$2").
				WithArgs("pol-1", "t-1").WillReturnError(tc.driverErr)

			got, err := svc.EvaluateCompliance(context.Background(), "t-1", "pol-1")
			if err == nil {
				t.Fatalf("want an error, got %+v", got)
			}
			if tc.name == "missing policy" {
				if !errors.Is(err, ErrPolicyNotFound) {
					t.Fatalf("want ErrPolicyNotFound, got %v", err)
				}
			} else if errors.Is(err, ErrPolicyNotFound) {
				t.Fatalf("a driver error must not be reported as a missing policy: %v", err)
			}
		})
	}
}

func TestAnalyzeDependency_LookupErrorDoesNotWrite(t *testing.T) {
	svc, mock := mockSvc(t)
	mock.ExpectQuery("SELECT .* FROM dependency_graphs WHERE tenant_id=\\$1 AND package_name=\\$2 AND package_version=\\$3").
		WithArgs("t-1", "golang.org/x/crypto", "v0.17.0").WillReturnError(errors.New("connection refused"))

	got, err := svc.AnalyzeDependency(context.Background(), "t-1", &models.AnalyzeDependencyRequest{
		PackageName: "golang.org/x/crypto", PackageVersion: "v0.17.0",
	})
	if err == nil {
		t.Fatalf("want an error, got %+v", got)
	}
	if got != nil {
		t.Fatalf("a failed lookup must not return a graph, got %+v", got)
	}
	if !strings.Contains(err.Error(), "connection refused") {
		t.Fatalf("the driver error must pass through instead of being retried as a new write: %v", err)
	}
}

func TestAnalyzeDependency_ReturnsTheExistingGraph(t *testing.T) {
	svc, mock := mockSvc(t)
	now := time.Now().UTC()
	mock.ExpectQuery("SELECT .* FROM dependency_graphs WHERE tenant_id=\\$1 AND package_name=\\$2 AND package_version=\\$3").
		WithArgs("t-1", "golang.org/x/crypto", "v0.17.0").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "package_name", "package_version", "direct_deps",
		"transitive_deps", "vulnerable_paths", "depth", "analyzed_at",
	}).AddRow("dg-1", "t-1", "golang.org/x/crypto", "v0.17.0",
		`["a"]`, `["b"]`, `[]`, 3, now))

	got, err := svc.AnalyzeDependency(context.Background(), "t-1", &models.AnalyzeDependencyRequest{
		PackageName: "golang.org/x/crypto", PackageVersion: "v0.17.0",
	})
	if err != nil {
		t.Fatalf("AnalyzeDependency: %v", err)
	}
	if got.ID != "dg-1" || got.Depth != 3 || len(got.DirectDeps) != 1 {
		t.Errorf("unexpected graph: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("an already-analyzed package must not be re-analyzed: %v", err)
	}
}
