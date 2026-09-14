package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/worker-dispatcher/repository"
	"orion/platform-svc-go/internal/worker-dispatcher/service"
)

// assignmentOutageRepo satisfies the repository interface without touching a
// database: the embedded real repository supplies every other method and is
// never called by the test.
type assignmentOutageRepo struct {
	*repository.Repository
}

func (r *assignmentOutageRepo) GetActiveAssignments(ctx context.Context, tenantID, workerID string) (int, error) {
	return 0, errors.New("connection refused")
}

func loadCtx() (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "t-1")
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/worker/load/w-1", nil)
	c.Params = gin.Params{{Key: "workerId", Value: "w-1"}}
	return c, w
}

func TestGetWorkerLoadAnswersInternalErrorForARepositoryOutage(t *testing.T) {
	h := NewHandler(service.NewService(&assignmentOutageRepo{}))
	c, w := loadCtx()

	h.GetWorkerLoad(c)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500: an outage must not be reported as current_load 0", w.Code)
	}
	if !strings.Contains(w.Body.String(), "connection refused") {
		t.Fatalf("body %q does not carry the failure reason", w.Body.String())
	}
}

func TestGetWorkerLoadReturnsTheActiveAssignmentCount(t *testing.T) {
	raw, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	// The default matcher is regexp and "*" is a repetition operator, so the
	// literal COUNT(*) would abort the parse. The exact statement is pinned by
	// the repository test; here the count value is what matters.
	mock.ExpectQuery(`SELECT COUNT`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(4))
	h := NewHandler(service.NewService(repository.NewRepository(sqlx.NewDb(raw, "postgres"))))

	c, w := loadCtx()
	h.GetWorkerLoad(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body %q", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"current_load":4`) {
		t.Fatalf("body %q does not carry the load", w.Body.String())
	}
}
