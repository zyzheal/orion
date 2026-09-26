package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
)

// ListPipelines, ListSteps and ListExecutions read `offset` straight from the
// query string and forwarded it to the repository, which clamps `limit` with
// clamp(limit, 1, 100) but never offset and binds it into `OFFSET $n`.
// `?offset=-40` reached Postgres as a negative OFFSET, which Postgres rejects
// with an error instead of data — a GET turned into a 500. The bound
// arguments are pinned with WithArgs so the test fails on the value actually
// handed to the database.
func TestListPipelines_NegativeOffsetIsClamped(t *testing.T) {
	h, mock := newTestHandler(t)
	mock.ExpectQuery(`COUNT`).WillReturnRows(sqlmock.NewRows([]string{"n"}).AddRow(0))
	mock.ExpectQuery(`FROM pipelines WHERE`).
		WithArgs("tenant-a", 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	c, w := offsetCtx("/pipelines?offset=-40", nil)
	h.ListPipelines(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("offset was not clamped before binding: %v", err)
	}
}

func TestListSteps_NegativeOffsetIsClamped(t *testing.T) {
	h, mock := newTestHandler(t)
	// ListSteps verifies tenant ownership of the pipeline before listing.
	mock.ExpectQuery(`SELECT EXISTS`).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery(`COUNT`).WillReturnRows(sqlmock.NewRows([]string{"n"}).AddRow(0))
	mock.ExpectQuery(`FROM pipeline_steps WHERE`).
		WithArgs("tenant-a", "p-1", 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	c, w := offsetCtx("/pipelines/:id/steps?offset=-40", gin.Params{{Key: "id", Value: "p-1"}})
	h.ListSteps(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("offset was not clamped before binding: %v", err)
	}
}

func TestListExecutions_NegativeOffsetIsClamped(t *testing.T) {
	h, mock := newTestHandler(t)
	mock.ExpectQuery(`COUNT`).WillReturnRows(sqlmock.NewRows([]string{"n"}).AddRow(0))
	mock.ExpectQuery(`FROM pipeline_executions WHERE`).
		WithArgs("tenant-a", "p-1", 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	c, w := offsetCtx("/pipelines/:id/executions?offset=-40", gin.Params{{Key: "id", Value: "p-1"}})
	h.ListExecutions(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("offset was not clamped before binding: %v", err)
	}
}

// A valid offset must pass through untouched: the clamp is a floor, not a cap.
func TestListSteps_ValidOffsetUnchanged(t *testing.T) {
	h, mock := newTestHandler(t)
	mock.ExpectQuery(`SELECT EXISTS`).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery(`COUNT`).WillReturnRows(sqlmock.NewRows([]string{"n"}).AddRow(0))
	mock.ExpectQuery(`FROM pipeline_steps WHERE`).
		WithArgs("tenant-a", "p-1", 25, 60).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	c, w := offsetCtx("/pipelines/:id/steps?offset=60&limit=25", gin.Params{{Key: "id", Value: "p-1"}})
	h.ListSteps(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a valid offset must be forwarded unchanged: %v", err)
	}
}

func offsetCtx(path string, params gin.Params) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-a")
	c.Params = params
	c.Request = httptest.NewRequest(http.MethodGet, path, nil)
	return c, w
}
