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
	insptmpl_repo "orion/platform-svc-go/internal/inspection-template/repository"
	insptmpl_service "orion/platform-svc-go/internal/inspection-template/service"
	"orion/platform-svc-go/internal/inspection-template/models"
)

const tenant = "t1"

// jsonConverter handles map/slice args by JSON-encoding them.
type jsonConverter struct{}

func (jsonConverter) ConvertValue(v interface{}) (driver.Value, error) {
	switch v.(type) {
	case map[string]interface{}, []interface{}, []string, []int,
		[]models.Rule:
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

	repo := insptmpl_repo.NewRepository(sqlx.NewDb(db, "postgres"))
	svc := insptmpl_service.NewService(repo, zap.NewNop())
	h := NewHandler(svc)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", tenant)
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

func TestTemplateCreate_BadRequest(t *testing.T) {
	r, _ := newRouter(t)
	w := do(r, "POST", "/api/v1/inspection-templates", `{}`)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestTemplateCreate_Success(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("INSERT INTO inspection_templates").
		WillReturnResult(sqlmock.NewResult(0, 1))
	w := do(r, "POST", "/api/v1/inspection-templates", `{"name":"cpu-check"}`)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestTemplateGet_NotFound(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery("SELECT.*FROM inspection_templates").
		WillReturnError(sql.ErrNoRows)
	w := do(r, "GET", "/api/v1/inspection-templates/missing", "")
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestTemplateList_EmptySuccess(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery("SELECT.*FROM inspection_templates").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "description", "category", "target_type",
			"rules", "enabled", "version", "created_by", "created_at", "updated_at",
		}))
	w := do(r, "GET", "/api/v1/inspection-templates", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestTemplateDelete_Success(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("DELETE.*FROM inspection_templates").
		WillReturnResult(sqlmock.NewResult(0, 1))
	w := do(r, "DELETE", "/api/v1/inspection-templates/t1", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestTemplateDelete_NotFound(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("DELETE.*FROM inspection_templates").
		WillReturnResult(sqlmock.NewResult(0, 0))
	w := do(r, "DELETE", "/api/v1/inspection-templates/missing", "")
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}
