package handler

import (
	"database/sql/driver"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/workflow/workflow/models"
	"orion/platform-svc-go/internal/workflow/workflow/repository"
	"orion/platform-svc-go/internal/workflow/workflow/service"
)

var definitionColumns = []string{
	"id", "tenant_id", "name", "description", "nodes", "edges",
	"enabled", "version", "created_by", "created_at", "updated_at",
}

// sqlmock hands driver.Value entries straight to Scan, so timestamps must be
// time.Time rather than RFC3339 strings.
func definitionRows(enabled bool) *sqlmock.Rows {
	now := time.Now().UTC()
	row := []driver.Value{
		"wf-1", "tenant-a", "nightly deploy", "nightly deploy",
		`{"nodes":[]}`, `{"edges":[]}`,
		enabled, "1.0", "alice", now, now,
	}
	return sqlmock.NewRows(definitionColumns).AddRow(row...)
}

func newMockHandler(t *testing.T) (sqlmock.Sqlmock, *ExtraHandler) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewExtraHandler(service.NewService(repository.NewRepository(sqlx.NewDb(db, "postgres"))))
}

// terminateContext builds a POST /workflows/wf-1/terminate request straight from
// the path params, bypassing RegisterRoutes because that wraps every route in the
// real auth middleware.
func terminateContext(id string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/workflows/"+id+"/terminate", nil)
	c.Params = gin.Params{{Key: "id", Value: id}}
	c.Set("tenant_id", "tenant-a")
	return c, w
}

func TestTerminateCancelsInstancesAndDisablesTheWorkflow(t *testing.T) {
	mock, h := newMockHandler(t)
	mock.ExpectQuery("SELECT \\* FROM workflow_definitions WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("wf-1", "tenant-a").
		WillReturnRows(definitionRows(true))
	mock.ExpectExec("UPDATE workflow_instances").
		WithArgs(
			models.InstanceCancelled, "wf-1", "tenant-a",
			models.InstanceRunning, models.InstancePaused, "pending",
		).
		WillReturnResult(sqlmock.NewResult(0, 3))
	mock.ExpectQuery("UPDATE workflow_definitions SET").
		WithArgs(false, "wf-1", "tenant-a").
		WillReturnRows(definitionRows(false))

	c, w := terminateContext("wf-1")
	h.Terminate(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, `"cancelled_instances":3`) {
		t.Errorf("response does not report the 3 cancelled instances: %s", body)
	}
	if !strings.Contains(body, `"enabled":false`) {
		t.Errorf("response must carry the disabled definition: %s", body)
	}
	if m := mock.ExpectationsWereMet(); m != nil {
		t.Fatalf("unexpected SQL: %v", m)
	}
}

func TestTerminateReturnsNotFoundForUnknownWorkflows(t *testing.T) {
	mock, h := newMockHandler(t)
	mock.ExpectQuery("SELECT \\* FROM workflow_definitions WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("wf-missing", "tenant-a").
		WillReturnRows(sqlmock.NewRows(definitionColumns))

	c, w := terminateContext("wf-missing")
	h.Terminate(c)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404: a foreign id must not be reported as terminated (body: %s)",
			w.Code, w.Body.String())
	}
	if m := mock.ExpectationsWereMet(); m != nil {
		t.Fatalf("no SQL beyond the ownership lookup: %v", m)
	}
}
