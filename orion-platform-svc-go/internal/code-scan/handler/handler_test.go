package handler

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/code-scan/repository"
	"orion/platform-svc-go/internal/code-scan/service"
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

// withTenant mounts the tenant the production middleware puts in the context.
// gin reads c.GetString("tenant_id") from c.Keys, not from the request context,
// so a bare httptest request would hand every handler an empty tenant and
// silently scope the query at "".
func withTenant(tenantID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("tenant_id", tenantID)
		c.Next()
	}
}

// newRouter builds the production wiring for the /security group: the real
// handler, the real service, the real repository on a sqlmock driver. The
// service is returned so the test can Wait on the scan worker.
func newRouter(t *testing.T) (*gin.Engine, *service.Service, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.MatchExpectationsInOrder(false)

	svc := service.NewService(repository.NewRepository(sqlx.NewDb(db, "sqlmock")), zap.NewNop())
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(withTenant("t1"))
	NewHandler(svc).RegisterRoutes(r.Group("/security"))
	return r, svc, mock
}

func do(r *gin.Engine, method, path string, body []byte) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
		req = httptest.NewRequest(method, path, strings.NewReader(string(body)))
	}
	req = req.WithContext(context.Background())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func tmpDir(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	for p, body := range files {
		full := filepath.Join(dir, p)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

// workerExpectations registers the two transactions the scan worker runs after
// a run row has been created: StartScan and FinishScan. total and critical are
// the counts the walk is expected to produce, so the expectation fails if the
// worker ever reports the request's counts instead of its own.
func workerExpectations(mock sqlmock.Sqlmock, total, critical int) {
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings`).WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE code_scan_runs SET status='running'`).
		WithArgs(sqlmock.AnyArg(), "t1", sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings`).WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`UPDATE code_scan_runs SET status='completed'`).
		WithArgs(total, critical, 0, 0, 0, sqlmock.AnyArg(), sqlmock.AnyArg(), "t1", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()
}

// TestListScansRoute_ReturnsTheTenantRowsThroughTheRealStack pins the whole
// GET /scans path: the tenant middleware, the query, the column mapping and the
// envelope. RegisterRoutes is called rather than mounting the handlers by hand,
// so a renamed or dropped route surfaces here as a gin 404 with the SQL
// expectation unconsumed instead of passing silently.
func TestListScansRoute_ReturnsTheTenantRows(t *testing.T) {
	r, _, mock := newRouter(t)
	now := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)

	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 ORDER BY created_at DESC, id DESC LIMIT \$2`).
		WithArgs("t1", 100).
		WillReturnRows(sqlmock.NewRows(runRowCols).AddRow(
			"scan-1", "t1", "/repo", "main", "completed",
			int64(3), int64(1), int64(1), int64(1), int64(0), int64(7), "",
			now, nil, now))

	w := do(r, http.MethodGet, "/security/code-scan/scans", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%q)", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, `"success":true`) {
		t.Errorf("body %q must report success", body)
	}
	for _, want := range []string{
		`"id":"scan-1"`, `"status":"completed"`, `"totalVulns":3`,
		`"critical":1`, `"duration":7`, `"branch":"main"`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("body %q does not contain %s", body, want)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

// TestListScansRoute_EmptyTenantAnswersEmptyArrayAnEmpty slice must serialise
// as [], not null: the frontend renders it straight into a table.
func TestListScansRoute_EmptyTenantAnswersEmptyArray(t *testing.T) {
	r, _, mock := newRouter(t)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1`).
		WithArgs("t1", 100).
		WillReturnRows(sqlmock.NewRows(runRowCols))

	w := do(r, http.MethodGet, "/security/code-scan/scans", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%q)", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"data":[]`) {
		t.Errorf("an empty tenant must serialise as [], got %s", w.Body.String())
	}
}

// TestListScansRoute_DatabaseErrorIsInternalError keeps the read endpoints from
// answering 200 with an empty list when the database is down: that would look
// like "no scans" to the page.
func TestListScansRoute_DatabaseErrorIsInternalError(t *testing.T) {
	r, _, mock := newRouter(t)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1`).
		WithArgs("t1", 100).
		WillReturnError(errors.New("connection refused"))

	w := do(r, http.MethodGet, "/security/code-scan/scans", nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500 (body=%q)", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"code":"INTERNAL_ERROR"`) {
		t.Errorf("body %q does not contain \"code\":\"INTERNAL_ERROR\"", w.Body.String())
	}
}

// TestListScansRoute_LimitIsReadFromTheQuery pins ?limit= all the way through
// to the bound argument. A missing or non-numeric value falls back to the
// service default rather than reaching the database as an unbounded query.
func TestListScansRoute_LimitIsReadFromTheQuery(t *testing.T) {
	for _, tc := range []struct {
		name  string
		query string
		want  int
	}{
		{"explicit", "?limit=7", 7},
		{"absent", "", 100},
		{"garbage", "?limit=abc", 100},
		{"negative", "?limit=-3", 100},
		{"over", "?limit=99999", 1000},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r, _, mock := newRouter(t)
			mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 ORDER BY created_at DESC, id DESC LIMIT \$2`).
				WithArgs("t1", tc.want).
				WillReturnRows(sqlmock.NewRows(runRowCols))

			w := do(r, http.MethodGet, "/security/code-scan/scans"+tc.query, nil)
			if w.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200 (body=%q)", w.Code, w.Body.String())
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("limit must be bound as %d: %v", tc.want, err)
			}
		})
	}
}

// TestListFindingsRoute_ScanIDFromTheQueryScopesTheTenant pins ?scanId=, which
// comes from the URL rather than from an entity the server generated.
func TestListFindingsRoute_ScanIDFromTheQueryScopesTheTenant(t *testing.T) {
	r, _, mock := newRouter(t)
	now := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_findings WHERE tenant_id=\$1 AND scan_id=\$2 ORDER BY severity, created_at DESC, id DESC LIMIT \$3`).
		WithArgs("t1", "s-1", 100).
		WillReturnRows(sqlmock.NewRows(findingRowCols).AddRow(
			"v-1", "t1", "s-1", "sensitive_data", "critical",
			"config/prod.yaml", int64(2), "Hardcoded credential", "rotate", now))

	w := do(r, http.MethodGet, "/security/code-scan/findings?scanId=s-1", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%q)", w.Code, w.Body.String())
	}
	for _, want := range []string{`"id":"v-1"`, `"severity":"critical"`, `"scanId":"s-1"`, `"file":"config/prod.yaml"`, `"line":2`} {
		if !strings.Contains(w.Body.String(), want) {
			t.Errorf("body %q does not contain %s", w.Body.String(), want)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

// TestCreateScanRoute_BadTargetIsBadRequestWithoutWriting verifies the target
// check happens before any SQL. No expectation is registered, so a mutant that
// inserts the row first fails on an unexpected driver call.
func TestCreateScanRoute_BadTargetIsBadRequestWithoutWriting(t *testing.T) {
	r, _, mock := newRouter(t)

	w := do(r, http.MethodPost, "/security/code-scan/scans",
		[]byte(`{"target":"/no/such/directory","branch":"main"}`))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body=%q)", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"code":"BAD_REQUEST"`) {
		t.Errorf("body %q does not contain \"code\":\"BAD_REQUEST\"", w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("no SQL may run for a bad target: %v", err)
	}
}

// TestCreateScanRoute_MissingTargetIsBadRequest pins the binding rule on the
// request body.
func TestCreateScanRoute_MissingTargetIsBadRequest(t *testing.T) {
	r, _, mock := newRouter(t)

	w := do(r, http.MethodPost, "/security/code-scan/scans", []byte(`{"branch":"main"}`))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body=%q)", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("no SQL may run for a malformed body: %v", err)
	}
}

// TestCreateScanRoute_ReturnsThePendingRunAndTheWorkerCompletesIt drives the
// POST through the real stack. The response is 201 with the row the database
// accepted, and the worker must then drive that row to completed.
func TestCreateScanRoute_ReturnsThePendingRunAndTheWorkerCompletesIt(t *testing.T) {
	r, svc, mock := newRouter(t)
	target := tmpDir(t, map[string]string{
		"pkg/creds.go": "// line one\nvar key = \"AKIAIOSFODNN7EXAMPLE\"\n",
	})

	mock.ExpectExec(`INSERT INTO code_scan_runs`).
		WithArgs(sqlmock.AnyArg(), "t1", sqlmock.AnyArg(), "main", "pending",
			0, 0, 0, 0, 0, 0, "", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	workerExpectations(mock, 1, 1)
	mock.ExpectExec(`INSERT INTO code_scan_findings`).
		WithArgs(sqlmock.AnyArg(), "t1", sqlmock.AnyArg(), "sensitive_data", "critical",
			"pkg/creds.go", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	w := do(r, http.MethodPost, "/security/code-scan/scans",
		[]byte(`{"target":"`+target+`","branch":""}`))
	svc.Wait()

	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (body=%q)", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, `"success":true`) || !strings.Contains(body, `"status":"pending"`) {
		t.Errorf("body %q must report a pending run", body)
	}
	if !strings.Contains(body, `"branch":"main"`) {
		t.Errorf("a blank branch must default to main; body %q", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the worker did not drive the run to completion: %v", err)
	}
}

// TestCreateScanRoute_DatabaseErrorIsInternalError keeps a storage failure from
// being reported as a created run.
func TestCreateScanRoute_DatabaseErrorIsInternalError(t *testing.T) {
	r, _, mock := newRouter(t)
	target := tmpDir(t, map[string]string{"main.go": "package main\n"})
	mock.ExpectExec(`INSERT INTO code_scan_runs`).
		WillReturnError(errors.New("connection refused"))

	w := do(r, http.MethodPost, "/security/code-scan/scans",
		[]byte(`{"target":"`+target+`"}`))
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500 (body=%q)", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"code":"INTERNAL_ERROR"`) {
		t.Errorf("body %q does not contain \"code\":\"INTERNAL_ERROR\"", w.Body.String())
	}
}

// TestRerunRoute_MissingIDIsNotFound pins the 404 branch: without the
// repository's sql.ErrNoRows wrap this route would answer 500 with
// "sql: no rows" for a scan that was never created.
func TestRerunRoute_MissingIDIsNotFound(t *testing.T) {
	r, _, mock := newRouter(t)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 AND id=\$2`).
		WithArgs("t1", "missing").WillReturnError(sql.ErrNoRows)

	w := do(r, http.MethodPost, "/security/code-scan/scans/missing/run", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 (body=%q)", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"code":"NOT_FOUND"`) {
		t.Errorf("body %q does not contain \"code\":\"NOT_FOUND\"", w.Body.String())
	}
}

// TestRerunRoute_DropsThePreviousAttemptAndReportsTheFreshCounts is the rerun
// regression through HTTP: the stored run is found, its counters are reset, and
// a clean target finishes with zero findings.
func TestRerunRoute_DropsThePreviousAttemptAndReportsTheFreshCounts(t *testing.T) {
	r, svc, mock := newRouter(t)
	target := tmpDir(t, map[string]string{"main.go": "package main\n"})
	now := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)

	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 AND id=\$2`).
		WithArgs("t1", "s-1").
		WillReturnRows(sqlmock.NewRows(runRowCols).AddRow(
			"s-1", "t1", target, "main", "failed",
			int64(47), int64(3), int64(10), int64(20), int64(14), int64(9), "timeout",
			now, nil, now))

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM code_scan_findings WHERE tenant_id=\$1 AND scan_id=\$2`).
		WithArgs("t1", "s-1").WillReturnResult(sqlmock.NewResult(0, 47))
	mock.ExpectExec(`UPDATE code_scan_runs SET status='running'`).
		WithArgs(sqlmock.AnyArg(), "t1", "s-1").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	workerExpectations(mock, 0, 0)

	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 AND id=\$2`).
		WithArgs("t1", "s-1").
		WillReturnRows(sqlmock.NewRows(runRowCols).AddRow(
			"s-1", "t1", target, "main", "completed",
			int64(0), int64(0), int64(0), int64(0), int64(0), int64(1), "",
			now, now, now))

	w := do(r, http.MethodPost, "/security/code-scan/scans/s-1/run", nil)
	svc.Wait()

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%q)", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, `"status":"completed"`) || !strings.Contains(body, `"totalVulns":0`) {
		t.Errorf("a rerun of a clean tree must report zero findings, body %q", body)
	}
	if strings.Contains(body, `"totalVulns":47`) {
		t.Errorf("the rerun repeated the previous attempt's total: %s", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}

// TestRerunRoute_DatabaseErrorIsInternalError.
func TestRerunRoute_DatabaseErrorIsInternalError(t *testing.T) {
	r, _, mock := newRouter(t)
	mock.ExpectQuery(`SELECT [^*]+ FROM code_scan_runs WHERE tenant_id=\$1 AND id=\$2`).
		WithArgs("t1", "s-1").WillReturnError(errors.New("connection refused"))

	w := do(r, http.MethodPost, "/security/code-scan/scans/s-1/run", nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500 (body=%q)", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"code":"INTERNAL_ERROR"`) {
		t.Errorf("body %q does not contain \"code\":\"INTERNAL_ERROR\"", w.Body.String())
	}
}

// TestRoutesAreMountedUnderTheSecurityGroup proves the four routes are
// registered by RegisterRoutes at the paths the frontend calls.
func TestRoutesAreMountedUnderTheSecurityGroup(t *testing.T) {
	r, _, _ := newRouter(t)
	want := map[string][]string{
		http.MethodGet:  {"/security/code-scan/scans", "/security/code-scan/findings"},
		http.MethodPost: {"/security/code-scan/scans", "/security/code-scan/scans/:id/run"},
	}
	for method, paths := range want {
		registered := map[string]bool{}
		for _, route := range r.Routes() {
			if route.Method == method {
				registered[route.Path] = true
			}
		}
		for _, p := range paths {
			if !registered[p] {
				t.Errorf("%s %s is not registered", method, p)
			}
		}
	}
}
