package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/pipeline-executor/models"
	"orion/platform-svc-go/internal/pipeline-executor/repository"
	"orion/platform-svc-go/internal/pipeline-executor/service"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

func newTestHandler(t *testing.T) (*Handler, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	return NewHandler(service.NewExecutor(repo, zap.NewNop())), mock
}

func postCreate(t *testing.T, h *Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/pipelines", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Set("tenant_id", "tenant-a")
	h.CreatePipeline(c)
	return w
}

type envelope struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   string          `json:"error"`
	Code    string          `json:"code"`
}

func decodeEnvelope(t *testing.T, w *httptest.ResponseRecorder) envelope {
	t.Helper()
	var env envelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("response is not a JSON envelope: %v\nbody: %s", err, w.Body.String())
	}
	return env
}

// POST /pipelines bound Name, Description and Category, then handed the executor
// only Name and Category. Repository.CreatePipeline already mapped
// req.Description into its INSERT, so the description was discarded at exactly
// two copy points and never persisted. This test drives the whole seam: request
// body -> bound request -> executor -> INSERT arguments -> response body.
func TestCreatePipelinePersistsDescription(t *testing.T) {
	h, mock := newTestHandler(t)
	mock.ExpectExec(`INSERT INTO pipelines`).
		WithArgs(
			sqlmock.AnyArg(), // id, generated
			"tenant-a",
			"deploy-web",
			"deploys the web service",
			"automation",
			models.PipelineStatusActive,
			sqlmock.AnyArg(), // created_at
			sqlmock.AnyArg(), // updated_at
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	w := postCreate(t, h, `{"name":"deploy-web","description":"deploys the web service","category":"automation"}`)

	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body: %s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the description was not bound into the INSERT: %v", err)
	}

	env := decodeEnvelope(t, w)
	if !env.Success {
		t.Fatalf("envelope.success = false: %s", w.Body.String())
	}
	var p models.Pipeline
	if err := json.Unmarshal(env.Data, &p); err != nil {
		t.Fatalf("data is not a pipeline: %v", err)
	}
	if p.Description != "deploys the web service" {
		t.Fatalf("pipeline.description = %q, want %q", p.Description, "deploys the web service")
	}
	if p.Name != "deploy-web" || p.Category != "automation" {
		t.Fatalf("pipeline name/category = %q/%q", p.Name, p.Category)
	}
}

// An omitted description must still reach storage as the empty string rather
// than being silently substituted with something the caller never sent.
func TestCreatePipelineAcceptsMissingDescription(t *testing.T) {
	h, mock := newTestHandler(t)
	mock.ExpectExec(`INSERT INTO pipelines`).
		WithArgs(sqlmock.AnyArg(), "tenant-a", "deploy-web", "",
			models.CategoryAutomation, models.PipelineStatusActive,
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	w := postCreate(t, h, `{"name":"deploy-web","category":"automation"}`)

	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body: %s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the INSERT arguments are wrong: %v", err)
	}
}

// The binding contract is enforced before anything reaches storage: a body
// missing the two required fields must 400 and must not issue SQL.
func TestCreatePipelineRejectsMissingRequiredFields(t *testing.T) {
	h, mock := newTestHandler(t)

	w := postCreate(t, h, `{"description":"no name, no category"}`)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body: %s", w.Code, w.Body.String())
	}
	env := decodeEnvelope(t, w)
	if env.Success || env.Code != "BAD_REQUEST" {
		t.Fatalf("want a BAD_REQUEST envelope, got success=%v code=%q", env.Success, env.Code)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a rejected request must not touch the database: %v", err)
	}
}

// A storage failure must surface as 500 without any data payload, so a caller
// cannot read a rejected create as a created pipeline.
func TestCreatePipelineReportsStorageFailure(t *testing.T) {
	h, mock := newTestHandler(t)
	mock.ExpectExec(`INSERT INTO pipelines`).WillReturnError(fmt.Errorf("disk full"))

	w := postCreate(t, h, `{"name":"deploy-web","category":"automation"}`)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500; body: %s", w.Code, w.Body.String())
	}
	env := decodeEnvelope(t, w)
	if env.Success {
		t.Fatalf("a failed create must not report success")
	}
	if env.Code != "INTERNAL_ERROR" {
		t.Fatalf("envelope.code = %q, want INTERNAL_ERROR", env.Code)
	}
	if len(env.Data) > 0 {
		t.Fatalf("a failed create returned a data payload: %s", string(env.Data))
	}
	if !strings.Contains(env.Error, "disk full") {
		t.Fatalf("envelope.error = %q, want the underlying failure", env.Error)
	}
}
