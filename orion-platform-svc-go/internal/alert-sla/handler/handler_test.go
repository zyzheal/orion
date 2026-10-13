package handler

import (
	"bytes"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
	alertsla_repo "orion/platform-svc-go/internal/alert-sla/repository"
	alertsla_service "orion/platform-svc-go/internal/alert-sla/service"
)

const tenant = "t1"

func newRouter(t *testing.T) (*gin.Engine, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.MatchExpectationsInOrder(false)

	repo := alertsla_repo.NewRepository(sqlx.NewDb(db, "postgres"))
	svc := alertsla_service.NewService(repo, zap.NewNop())
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

func TestSLACreate_BadRequest(t *testing.T) {
	r, _ := newRouter(t)
	w := do(r, "POST", "/api/v1/alert-slas", `{}`)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestSLACreate_Success(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("INSERT INTO alert_sla").
		WillReturnResult(sqlmock.NewResult(0, 1))
	w := do(r, "POST", "/api/v1/alert-slas", `{"name":"critical-sla"}`)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSLAGet_NotFound(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery("SELECT.*FROM alert_sla").
		WillReturnError(sql.ErrNoRows)
	w := do(r, "GET", "/api/v1/alert-slas/missing", "")
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestSLAGet_Success(t *testing.T) {
	r, mock := newRouter(t)
	now := time.Now()
	rows := sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "severity", "response_time",
		"resolve_time", "escalation_delay", "enabled", "created_at", "updated_at",
	}).AddRow("sla1", "t1", "critical-sla", "all", 300,
		3600, 600, true, now, now)
	mock.ExpectQuery("SELECT.*FROM alert_sla").WillReturnRows(rows)
	w := do(r, "GET", "/api/v1/alert-slas/sla1", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSLAList_Success(t *testing.T) {
	r, mock := newRouter(t)
	now := time.Now()
	rows := sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "severity", "response_time",
		"resolve_time", "escalation_delay", "enabled", "created_at", "updated_at",
	}).AddRow("sla1", "t1", "critical-sla", "all", 300,
		3600, 600, true, now, now)
	mock.ExpectQuery("SELECT.*FROM alert_sla").WillReturnRows(rows)
	w := do(r, "GET", "/api/v1/alert-slas", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSLAList_EmptySuccess(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery("SELECT.*FROM alert_sla").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "severity", "response_time",
			"resolve_time", "escalation_delay", "enabled", "created_at", "updated_at",
		}))
	w := do(r, "GET", "/api/v1/alert-slas", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSLAUpdate_Success(t *testing.T) {
	r, mock := newRouter(t)
	now := time.Now()
	mock.ExpectExec("UPDATE alert_sla").
		WillReturnResult(sqlmock.NewResult(0, 1))
	rows := sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "severity", "response_time",
		"resolve_time", "escalation_delay", "enabled", "created_at", "updated_at",
	}).AddRow("sla1", "t1", "updated-sla", "all", 300,
		3600, 600, true, now, now)
	mock.ExpectQuery("SELECT.*FROM alert_sla").WillReturnRows(rows)
	w := do(r, "PUT", "/api/v1/alert-slas/sla1", `{"name":"updated-sla"}`)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSLADelete_Success(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("DELETE.*FROM alert_sla").
		WillReturnResult(sqlmock.NewResult(0, 1))
	w := do(r, "DELETE", "/api/v1/alert-slas/sla1", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSLADelete_NotFound(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectExec("DELETE.*FROM alert_sla").
		WillReturnResult(sqlmock.NewResult(0, 0))
	w := do(r, "DELETE", "/api/v1/alert-slas/missing", "")
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}
