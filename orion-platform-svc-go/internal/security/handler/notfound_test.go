package handler

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/security/repository"
	"orion/platform-svc-go/internal/security/service"
)

func timeDate(y int, m time.Month, d, h, min, sec int) time.Time {
	return time.Date(y, m, d, h, min, sec, 0, time.UTC)
}

// newRouter builds the production wiring for the /security group: the real
// handler, the real service, the real repository on a sqlmock driver, with the
// tenant the production middleware would have put in the context.
func newRouter(mock sqlmock.Sqlmock, db *sqlx.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(withTenant("t1"))
	h := NewHandler(service.NewService(repository.NewRepository(db)))
	h.RegisterRoutes(r.Group("/security"))
	return r
}

// TestReadRoutes_DiscriminateNotFoundFromDatabaseError drives the real HTTP
// stack and asserts that every read endpoint answers 404 for a missing row and
// 500 for any other failure.
//
// The 404 branches were dead code before the repository wrapped sql.ErrNoRows:
// GetByID / GetFinding / GetAuditPlan / GetExecution / GetCompliancePolicy /
// GetSBOM / GetDependencyGraph and the evaluation readers returned the raw
// driver error, so a missing id answered 500 with "sql: no rows" and the
// handler's !IsNotFound(err) branch never reached respondNotFound.
//
// RegisterRoutes registers the whole group rather than mounting the handlers
// by hand, so a renamed, removed or mis-registered route surfaces here as a
// gin 404 with the SQL expectation unconsumed instead of passing silently.
func TestReadRoutes_DiscriminateNotFoundFromDatabaseError(t *testing.T) {
	routes := []struct {
		name  string
		path  string
		query string
	}{
		{"scan", "/scans/s-1", "SELECT [^*]+ FROM security_scans WHERE"},
		{"finding", "/findings/f-1", "SELECT [^*]+ FROM security_findings WHERE"},
		{"audit plan", "/audit/plans/ap-1", "SELECT [^*]+ FROM audit_plans WHERE"},
		{"audit execution", "/audit/executions/ae-1", "SELECT [^*]+ FROM audit_executions WHERE"},
		{"compliance policy", "/compliance/policies/pol-1", "SELECT [^*]+ FROM compliance_policies WHERE"},
		{"latest evaluation", "/compliance/evaluations/pol-1", "SELECT [^*]+ FROM compliance_evaluations WHERE"},
		{"sbom", "/sbom/sb-1", "SELECT [^*]+ FROM supply_chain_sboms WHERE"},
		// :package_name/:package_version is two path segments, so the package
		// name below must not itself contain a slash.
		{"dependency graph", "/dependency/left-pad/v1.3.0", "SELECT [^*]+ FROM dependency_graphs WHERE"},
	}
	outcomes := []struct {
		name string
		err  error
		code int
		want string
	}{
		{"not found", sql.ErrNoRows, http.StatusNotFound, `"code":"NOT_FOUND"`},
		{"database failure", errors.New("connection refused"), http.StatusInternalServerError, `"code":"INTERNAL_ERROR"`},
	}
	for _, tc := range routes {
		for _, oc := range outcomes {
			t.Run(tc.name+"/"+oc.name, func(t *testing.T) {
				db, mock, err := sqlmock.New()
				if err != nil {
					t.Fatalf("sqlmock.New: %v", err)
				}
				t.Cleanup(func() { _ = db.Close() })

				mock.ExpectQuery(tc.query).WillReturnError(oc.err)
				r := newRouter(mock, sqlx.NewDb(db, "sqlmock"))

				req := httptest.NewRequest(http.MethodGet, "/security"+tc.path, nil)
				req = req.WithContext(context.Background())
				w := httptest.NewRecorder()
				r.ServeHTTP(w, req)

				if w.Code != oc.code {
					t.Fatalf("status = %d, want %d (body=%q)", w.Code, oc.code, w.Body.String())
				}
				if !strings.Contains(w.Body.String(), oc.want) {
					t.Errorf("body %q does not contain %s", w.Body.String(), oc.want)
				}
				if err := mock.ExpectationsWereMet(); err != nil {
					t.Fatalf("sql expectations not met: %v", err)
				}
			})
		}
	}
}

// TestListFindingsRoute_BadSeverityIsBadRequestWithoutQuerying pins the 400
// path in ListFindings. service.ListFindings rejects an unknown severity with
// ErrInvalidSeverity and the handler maps that to respondBadRequest rather than
// respondInternalError. (repository.ListFindings carries the same guard as a
// second line of defence for callers that reach the repository directly;
// TestListFindings_InvalidSeverityFailsBeforeQuerying pins that layer.)
//
// No SQL expectation is registered. Had the severity reached the repository,
// sqlmock would reject the call, the repository would return an error the
// service does not wrap as ErrInvalidSeverity, and the route would answer 500
// INTERNAL_ERROR -- which is exactly what happens when the service guard is
// removed. So the 400 status alone proves the check ran before any query.
func TestListFindingsRoute_BadSeverityIsBadRequestWithoutQuerying(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	r := newRouter(mock, sqlx.NewDb(db, "sqlmock"))

	req := httptest.NewRequest(http.MethodGet, "/security/findings?severity=urgent", nil)
	req = req.WithContext(context.Background())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body=%q)", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"code":"BAD_REQUEST"`) {
		t.Errorf("body %q does not contain \"code\":\"BAD_REQUEST\"", w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

// TestFindingsByScanIDRoute_TenantScopesTheScanIDFromTheURL guards the one
// route whose foreign key comes from the URL rather than from an entity id.
// /findings/scan/:scan_id takes the scan id straight from the path, so the
// predicate must bind tenant_id as well: without it, a caller who learned any
// scan id could read another tenant's findings.
//
// The regex forbids SELECT * so a regression back to a wildcard select fails
// here and in the repository test that pins the exact column list.
func TestFindingsByScanIDRoute_TenantScopesTheScanIDFromTheURL(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	now := timeDate(2026, 9, 14, 12, 0, 0)
	mock.ExpectQuery(`SELECT [^*]+ FROM security_findings WHERE tenant_id=\$1 AND scan_id=\$2 ORDER BY severity, created_at`).
		WithArgs("t1", "s-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "scan_id", "rule_id", "severity", "category", "title",
			"description", "file_path", "line_start", "line_end", "code_snippet",
			"match_text", "confidence", "remediation", "status", "assigned_to",
			"closed_at", "created_at",
		}).AddRow("f-1", "t1", "s-1", "RULE-1", "critical", "secret", "hardcoded key",
			"", "", nil, nil, "", "", float64(1), "rotate", "open", nil, nil, now))

	r := newRouter(mock, sqlx.NewDb(db, "sqlmock"))

	req := httptest.NewRequest(http.MethodGet, "/security/findings/scan/s-1", nil)
	req = req.WithContext(context.Background())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%q)", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if strings.Contains(body, `"code":"INTERNAL_ERROR"`) {
		t.Fatalf("body unexpectedly reports an internal error: %s", body)
	}
	for _, want := range []string{`"id":"f-1"`, `"severity":"critical"`, `"scan_id":"s-1"`} {
		if !strings.Contains(body, want) {
			t.Errorf("body %q does not contain %s", body, want)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

// TestComplianceScoreRoute_DatabaseFailureIsNotFullCompliance pins the
// end-to-end opposite of the old behaviour: when the policy read fails, the
// route must fail rather than report an empty policy set as a 100% compliant
// tenant. service.GetComplianceScore returns (nil, err) and the handler maps
// any error to respondInternalError, so the API can never turn a database
// outage into a pass.
func TestComplianceScoreRoute_DatabaseFailureIsNotFullCompliance(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	mock.ExpectQuery(`SELECT [^*]+ FROM compliance_policies WHERE tenant_id=\$1 ORDER BY created_at DESC`).
		WithArgs("t1").
		WillReturnError(errors.New("connection refused"))
	r := newRouter(mock, sqlx.NewDb(db, "sqlmock"))

	req := httptest.NewRequest(http.MethodGet, "/security/compliance/evaluations/score", nil)
	req = req.WithContext(context.Background())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500 (body=%q)", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, `"code":"INTERNAL_ERROR"`) {
		t.Errorf("body %q does not contain \"code\":\"INTERNAL_ERROR\"", body)
	}
	for _, forbidden := range []string{`"score":100`, `"success":true`} {
		if strings.Contains(body, forbidden) {
			t.Errorf("database failure must not be reported as compliant; body %q contains %s", body, forbidden)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}
