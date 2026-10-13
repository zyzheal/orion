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
	sprintanalytics_repo "orion/platform-svc-go/internal/sprint-analytics/repository"
	sprintanalytics_service "orion/platform-svc-go/internal/sprint-analytics/service"
	"orion/platform-svc-go/internal/sprint-analytics/models"
)

const tenant = "t1"

// jsonConverter handles map/slice args by JSON-encoding them.
type jsonConverter struct{}

func (jsonConverter) ConvertValue(v interface{}) (driver.Value, error) {
	switch v.(type) {
	case map[string]interface{}, []interface{}, []string, []int,
		[]map[string]interface{}, []models.ActionItem:
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

	repo := sprintanalytics_repo.NewRepository(sqlx.NewDb(db, "postgres"))
	svc := sprintanalytics_service.NewSprintService(repo, zap.NewNop())
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

func TestReviewCreate_BadRequest(t *testing.T) {
	r, _ := newRouter(t)
	w := do(r, "POST", "/api/v1/sprints/sp1/review", `{"date":"2026-01-01"}`)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestReviewCreate_Success(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("INSERT INTO sprint_reviews").
		WillReturnResult(sqlmock.NewResult(0, 1))
	w := do(r, "POST", "/api/v1/sprints/sp1/review", `{"sprintId":"sp1","date":"2026-01-01"}`)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestReviewGet_NotFound(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery("SELECT.*FROM sprint_reviews").
		WillReturnError(sql.ErrNoRows)
	w := do(r, "GET", "/api/v1/sprints/sp1/review", "")
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestReviewDelete_Success(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("DELETE.*FROM sprint_reviews").
		WillReturnResult(sqlmock.NewResult(0, 1))
	w := do(r, "DELETE", "/api/v1/sprints/sp1/review/rev1", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRetroCreate_Success(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("INSERT INTO sprint_retrospectives").
		WillReturnResult(sqlmock.NewResult(0, 1))
	w := do(r, "POST", "/api/v1/sprints/sp1/retrospective", `{"sprintId":"sp1","date":"2026-01-01"}`)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRetroGet_NotFound(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery("SELECT.*FROM sprint_retrospectives").
		WillReturnError(sql.ErrNoRows)
	w := do(r, "GET", "/api/v1/sprints/sp1/retrospective", "")
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestRetroDelete_Success(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("DELETE.*FROM sprint_retrospectives").
		WillReturnResult(sqlmock.NewResult(0, 1))
	w := do(r, "DELETE", "/api/v1/sprints/sp1/retrospective/ret1", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
