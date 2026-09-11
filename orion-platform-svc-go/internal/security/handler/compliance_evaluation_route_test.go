package handler

import (
	"context"
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

// TestGetComplianceEvaluationRouteServesLatestEvaluation guards the
// GET /compliance/evaluations/:id route against a regression in which it
// always answers 404.
//
// The route used to call svc.GetComplianceEvaluation first and discard its
// result, expecting to fall back to the latest evaluation. That method
// unconditionally returned ErrPolicyNotFound, so the route answered 404 for
// every id and the real lookup was unreachable. The stub is deleted and the
// handler now performs the lookup directly; if the stub or the discarded
// result is reintroduced, this test fails on the 404 status and on the
// unmet SQL expectation.
func TestGetComplianceEvaluationRouteServesLatestEvaluation(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	now := time.Date(2026, 8, 26, 12, 0, 0, 0, time.UTC)
	// QueryMatcherRegexp treats the expectation as a regexp, so the * and $ are
	// escaped.
	mock.ExpectQuery(`SELECT \* FROM compliance_evaluations WHERE policy_id=\$1 ORDER BY created_at DESC LIMIT 1`).
		WithArgs("pol-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "policy_id", "status", "score",
			"total_checks", "passed_checks", "failed_checks", "gaps",
			"started_at", "completed_at", "created_at",
		}).AddRow(
			"eval-1", "t1", "pol-1", "completed", 92.5,
			10, 9, 1, `[]`,
			now, now, now,
		))

	h := NewHandler(service.NewService(repository.NewRepository(sqlx.NewDb(db, "sqlmock"))))

	gin.SetMode(gin.TestMode)
	r := gin.New()
	ce := r.Group("/compliance/evaluations")
	ce.GET("/:id", h.GetComplianceEvaluation)

	req := httptest.NewRequest(http.MethodGet, "/compliance/evaluations/pol-1", nil)
	req = req.WithContext(context.Background())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (route short-circuited to 404: body=%q)", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
	body := w.Body.String()
	for _, want := range []string{`"policy_id":"pol-1"`, `"id":"eval-1"`, `"status":"completed"`} {
		if !strings.Contains(body, want) {
			t.Errorf("response %q does not contain %s", body, want)
		}
	}
}
