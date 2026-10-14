package handler

import (
	"bytes"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
	rdmreq_repo "orion/platform-svc-go/internal/rdm/requirement/repository"
	rdmreq_service "orion/platform-svc-go/internal/rdm/requirement/service"
	"orion/platform-svc-go/internal/rdm/requirement/models"
)

const tenant = "t1"

// jsonConverter handles map/slice args by JSON-encoding them.
type jsonConverter struct{}

func (jsonConverter) ConvertValue(v interface{}) (driver.Value, error) {
	switch v.(type) {
	case map[string]interface{}, []interface{}, []string, []int,
		[]map[string]interface{}:
		b, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		return string(b), nil
	}
	return driver.DefaultParameterConverter.ConvertValue(v)
}

func newRouter(t *testing.T) (*gin.Engine, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(
		sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp),
		sqlmock.ValueConverterOption(jsonConverter{}),
	)
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.MatchExpectationsInOrder(false)

	repo := rdmreq_repo.NewRepository(sqlx.NewDb(db, "postgres"))
	svc := rdmreq_service.NewService(repo, zap.NewNop())
	h := NewHandler(svc)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", tenant)
		c.Set("roles", []string{"admin"})
		c.Next()
	})
	h.RegisterRoutes(r.Group("/api/v1"))
	return r, mock
}

func do(r *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

var _ models.ListRequirementsRequest // ensure import

func TestCreate_BadRequest(t *testing.T) {
	r, _ := newRouter(t)
	w := do(r, "POST", "/api/v1/rdm/requirements", `{}`)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestCreate_Success(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("INSERT INTO rdm_requirements").
		WillReturnResult(sqlmock.NewResult(0, 1))
	w := do(r, "POST", "/api/v1/rdm/requirements", `{"title":"need auth"}`)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGet_NotFound(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery("SELECT.*FROM rdm_requirements").
		WillReturnError(sql.ErrNoRows)
	w := do(r, "GET", "/api/v1/rdm/requirements/missing", "")
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestList_EmptySuccess(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT \* FROM rdm_requirements`).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "title", "description", "status", "priority",
			"type", "effort_points", "sprint_id", "project_id", "parent_id",
			"repo_ref", "labels", "severity", "estimated_hours",
			"assignee_id", "created_by", "created_at", "updated_at",
		}))
	w := do(r, "GET", "/api/v1/rdm/requirements", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdate_BadRequest(t *testing.T) {
	r, _ := newRouter(t)
	w := do(r, "PUT", "/api/v1/rdm/requirements/r1", `{`)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestDelete_Success(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("DELETE.*FROM rdm_requirements").
		WillReturnResult(sqlmock.NewResult(0, 1))
	w := do(r, "DELETE", "/api/v1/rdm/requirements/r1", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDelete_NotFound(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("DELETE.*FROM rdm_requirements").
		WillReturnResult(sqlmock.NewResult(0, 0))
	w := do(r, "DELETE", "/api/v1/rdm/requirements/missing", "")
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}
