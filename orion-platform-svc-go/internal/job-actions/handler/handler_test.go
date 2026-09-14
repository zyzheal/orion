package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/job-actions/models"
	ja_repo "orion/platform-svc-go/internal/job-actions/repository"
	ja_service "orion/platform-svc-go/internal/job-actions/service"
)

// newRouter wires the real handler over the real executor over the real
// repository on a sqlmock driver, behind the same auth middleware production
// uses. The tenant and the role come from c.Keys, which is where production
// middleware puts them, so a bare httptest request would otherwise 403 with
// "no role assigned" or scope every query at tenant "".
func newRouter(t *testing.T, tenant string) (*gin.Engine, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.MatchExpectationsInOrder(false)

	repo := ja_repo.NewRepository(sqlx.NewDb(db, "postgres"))
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", tenant)
		c.Set("roles", []string{"admin"})
		c.Next()
	})
	NewHandler(ja_service.NewJobActionExecutor(repo, nil), repo).RegisterRoutes(r.Group("/api"))
	return r, mock
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

func actionRow(id, tenant string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "type", "description", "params", "category",
		"timeout", "retry_count", "enabled", "created_at", "updated_at",
	}).AddRow(id, tenant, "restart-web", models.TypeRestartService, "", "{}",
		models.CategoryDeployment, 300, 0, true, now, now)
}

func executionRow(id, tenant, actionID string) *sqlmock.Rows {
	now := time.Now().UTC()
	finished := now
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "action_id", "params", "status", "output", "error",
		"duration_ms", "started_at", "finished_at", "created_at",
	}).AddRow(id, tenant, actionID, "{}", models.StatusFailed, "",
		"action not implemented: restart_service", int64(3), now, &finished, now)
}

func envelope(w *httptest.ResponseRecorder) map[string]any {
	var env map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		return map[string]any{"_parse_error": err.Error(), "body": w.Body.String()}
	}
	return env
}

// The full path: POST /:id/execute for a type whose backend does not exist must
// end 501, not 500 and not 200. The 200 the broken code returned here is the
// bug: it told the caller the service had been restarted.
func TestExecuteActionAnswersNotImplemented(t *testing.T) {
	r, mock := newRouter(t, "t1")

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM job_actions`).
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(0))
	mock.ExpectQuery(`FROM job_actions WHERE tenant_id`).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "type", "description", "params", "category",
			"timeout", "retry_count", "enabled", "created_at", "updated_at",
		}))
	mock.ExpectExec(`INSERT INTO job_action_executions`).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(`UPDATE job_action_executions`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`UPDATE job_action_executions`).WillReturnResult(sqlmock.NewResult(0, 1))

	w := do(r, http.MethodPost, "/api/job-actions/"+models.TypeRestartService+"/execute",
		[]byte(`{"params":{"service":"web"}}`))

	if w.Code != http.StatusNotImplemented {
		t.Fatalf("status = %d body = %s, want %d", w.Code, w.Body.String(), http.StatusNotImplemented)
	}
	env := envelope(w)
	if env["code"] != "NOT_IMPLEMENTED" {
		t.Fatalf("code = %v, want NOT_IMPLEMENTED", env["code"])
	}
	if !strings.Contains(strings.ToLower(w.Body.String()), "not implemented") {
		t.Fatalf("body = %s, want the caller to be told the action is not implemented", w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the execution was not recorded the way the code claims: %v", err)
	}
}

// A malformed body is a caller error. The bind result used to be discarded, so
// every execute call silently ran with no params whatever the body said.
func TestExecuteActionRejectsMalformedBody(t *testing.T) {
	r, _ := newRouter(t, "t1")

	w := do(r, http.MethodPost, "/api/job-actions/"+models.TypeRestartService+"/execute", []byte(`{"params": oops`))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d body = %s, want %d", w.Code, w.Body.String(), http.StatusBadRequest)
	}
	if !strings.Contains(w.Body.String(), "invalid execute request") {
		t.Fatalf("body = %s, want the bind error surfaced", w.Body.String())
	}
}

// CreateAction validates the type before touching the database.
func TestCreateActionRejectsUnknownType(t *testing.T) {
	r, _ := newRouter(t, "t1")

	w := do(r, http.MethodPost, "/api/job-actions", []byte(`{"name":"x","type":"no_such_type"}`))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d body = %s, want %d", w.Code, w.Body.String(), http.StatusBadRequest)
	}
}

// ListHistory must bind the tenant id: job_action_executions.action_id has no
// foreign key back to job_actions, so an id one tenant owns is otherwise
// addressable from any other tenant's request.
func TestGetHistoryScopesByTenant(t *testing.T) {
	r, mock := newRouter(t, "t1")

	mock.ExpectQuery(`FROM job_actions WHERE id=\$1 AND tenant_id=\$2`).WillReturnRows(actionRow("a-1", "t1"))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM job_action_executions WHERE tenant_id=\$1 AND action_id=\$2`).
		WithArgs("t1", "a-1").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`FROM job_action_executions WHERE tenant_id=\$1 AND action_id=\$2 ORDER BY started_at DESC`).
		WithArgs("t1", "a-1", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnRows(executionRow("e-1", "t1", "a-1"))

	w := do(r, http.MethodGet, "/api/job-actions/a-1/history", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s, want %d", w.Code, w.Body.String(), http.StatusOK)
	}
	body := w.Body.String()
	// The tenant id must be echoed back so a caller can see which tenancy it
	// read, the type must name the backend that was missing, and the recorded
	// status must be the one the executor claims to have written.
	for _, want := range []string{`"tenant_id":"t1"`, "not implemented: " + models.TypeRestartService, models.StatusFailed} {
		if !strings.Contains(body, want) {
			t.Errorf("body = %s, want it to contain %q", body, want)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("history was not read with the tenant predicate: %v", err)
	}
}

func TestContainsActionType(t *testing.T) {
	for _, tc := range []struct {
		typ  string
		want bool
	}{
		{models.TypeRestartService, true},
		{models.TypeRollback, true},
		{models.TypeShellCommand, true},
		{"no_such_type", false},
		{"", false},
		{strings.ToUpper(models.TypeShellCommand), false},
	} {
		if got := containsActionType(tc.typ); got != tc.want {
			t.Errorf("containsActionType(%q) = %v, want %v", tc.typ, got, tc.want)
		}
	}
}

func TestAllActionTypesAreUniquelyDeclared(t *testing.T) {
	seen := make(map[string]int, len(models.AllActionTypes))
	for _, typ := range models.AllActionTypes {
		if typ == "" {
			t.Fatal("AllActionTypes holds an empty string")
		}
		seen[typ]++
	}
	for typ, n := range seen {
		if n != 1 {
			t.Errorf("action type %q is declared %d times", typ, n)
		}
	}
}
