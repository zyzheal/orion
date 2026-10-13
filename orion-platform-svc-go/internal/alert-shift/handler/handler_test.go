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
	alertshift_repo "orion/platform-svc-go/internal/alert-shift/repository"
	alertshift_service "orion/platform-svc-go/internal/alert-shift/service"
	"orion/platform-svc-go/internal/alert-shift/models"
)

const tenant = "t1"

// jsonConverter handles map/slice args by JSON-encoding them.
type jsonConverter struct{}

func (jsonConverter) ConvertValue(v interface{}) (driver.Value, error) {
	switch v.(type) {
	case map[string]interface{}, []interface{}, []string, []int:
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

	repo := alertshift_repo.NewRepository(sqlx.NewDb(db, "postgres"))
	svc := alertshift_service.NewService(repo, zap.NewNop())
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

var _ models.Shift // ensure import

func TestShiftCreate_BadRequest(t *testing.T) {
	r, _ := newRouter(t)
	w := do(r, "POST", "/api/v1/alert-shifts", `{}`)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestShiftCreate_Success(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("INSERT INTO alert_shifts").
		WillReturnResult(sqlmock.NewResult(0, 1))
	w := do(r, "POST", "/api/v1/alert-shifts", `{"name":"on-call"}`)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestShiftGet_NotFound(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery("SELECT.*FROM alert_shifts").
		WillReturnError(sql.ErrNoRows)
	w := do(r, "GET", "/api/v1/alert-shifts/missing", "")
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestShiftList_EmptySuccess(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery("SELECT.*FROM alert_shifts").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "team", "pattern", "start_time",
			"end_time", "weekdays", "enabled", "created_at", "updated_at",
		}))
	w := do(r, "GET", "/api/v1/alert-shifts", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestShiftDelete_Success(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("DELETE.*FROM alert_shifts").
		WillReturnResult(sqlmock.NewResult(0, 1))
	w := do(r, "DELETE", "/api/v1/alert-shifts/s1", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAssignmentCreate_Success(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("INSERT INTO alert_shift_assignments").
		WillReturnResult(sqlmock.NewResult(0, 1))
	w := do(r, "POST", "/api/v1/alert-shifts/s1/assignments",
		`{"userId":"u1","startTime":"2026-01-01T00:00:00Z","endTime":"2026-01-02T00:00:00Z"}`)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAssignmentList_EmptySuccess(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery("SELECT.*FROM alert_shift_assignments").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "shift_id", "user_id", "role", "start_time",
			"end_time", "assigned", "created_at",
		}))
	w := do(r, "GET", "/api/v1/alert-shifts/s1/assignments", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
