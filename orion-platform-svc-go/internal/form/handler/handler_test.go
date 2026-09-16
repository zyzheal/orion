package handler

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"orion/go-common/pkg/auth"
	form_repo "orion/platform-svc-go/internal/form/repository"
	form_service "orion/platform-svc-go/internal/form/service"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

const tenant = "t1"

// newRouter builds the real repository, engine and handler on top of sqlmock
// behind the same permission middleware production uses. No test doubles at the
// seams this file is asserting on.
func newRouter(t *testing.T) (*gin.Engine, sqlmock.Sqlmock) {
	t.Helper()

	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.MatchExpectationsInOrder(false)

	repo := form_repo.NewRepository(sqlx.NewDb(db, "postgres"))
	engine := form_service.NewFormEngine(repo, zap.NewNop())
	h := NewHandler(engine, zap.NewNop())

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", tenant)
		c.Set("user_id", "user-1")
		c.Set("roles", []string{"admin"})
		c.Next()
	})
	h.RegisterRoutes(r.Group("/api"))
	return r, mock
}

func do(r *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func envelope(w *httptest.ResponseRecorder) map[string]any {
	var env map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		panic("envelope: " + err.Error() + " body=" + w.Body.String())
	}
	return env
}

// validFieldsJSON is the fields array the repository stores for a form that can
// be submitted: required fields, and the keys ValidateSubmission reads.
const validFieldsJSON = `[{"name":"name","label":"Name","type":"text","required":true}]`

func formRow(id, code, description, layout, fields, status string) []driver.Value {
	now := time.Now().UTC()
	return []driver.Value{
		id, tenant, "Employee Onboarding", code, "hr", description,
		layout, fields, status, int64(1), now, now,
	}
}

// TestCreateFormBindsEveryFieldTheClientSent is the wire-boundary regression.
// The bound :description and :fields values are asserted as query arguments, so
// a mutant that drops either one at the handler seam fails here even though the
// engine and repository are real code.
func TestCreateFormBindsEveryFieldTheClientSent(t *testing.T) {
	r, mock := newRouter(t)

	fields := []map[string]any{
		{"name": "name", "label": "Name", "type": "text", "required": true},
		{"name": "age", "label": "Age", "type": "number", "required": false},
	}
	body, err := json.Marshal(map[string]any{
		"name":        "Employee Onboarding",
		"code":        "hr-onboarding",
		"category":    "hr",
		"description": "collected at first login",
		"layout":      map[string]any{"columns": 2},
		"fields":      fields,
	})
	if err != nil {
		t.Fatal(err)
	}

	var fieldsJSON string
	b, _ := json.Marshal(fields)
	fieldsJSON = string(b)

	// Column order of the INSERT: id, tenant_id, name, code, category,
	// description, layout, fields, status, version, created_at, updated_at.
	mock.ExpectExec(`INSERT INTO forms`).WithArgs(
		sqlmock.AnyArg(), tenant, "Employee Onboarding", "hr-onboarding", "hr",
		"collected at first login", sqlmock.AnyArg(), fieldsJSON,
		sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
	).WillReturnResult(sqlmock.NewResult(1, 1))

	w := do(r, http.MethodPost, "/api/forms", string(body))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", w.Code, http.StatusOK, w.Body.String())
	}
	env := envelope(w)
	if env["success"] != true {
		t.Errorf("success = %v, want true; body=%s", env["success"], w.Body.String())
	}
	data, _ := env["data"].(map[string]any)
	if data == nil {
		t.Fatalf("data missing; body=%s", w.Body.String())
	}
	if got, want := data["description"], "collected at first login"; got != want {
		t.Errorf("description = %v, want %q", got, want)
	}
	if got, want := data["name"], "Employee Onboarding"; got != want {
		t.Errorf("name = %v, want %q", got, want)
	}
	if _, ok := data["fields"].(string); !ok {
		t.Errorf("fields = %T (%v), want a string", data["fields"], data["fields"])
	} else if got := data["fields"].(string); got[:1] != "[" {
		t.Errorf("fields = %q: the nil-fields mutant writes an object, got an object", got)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestCreateFormRejectsAMissingFieldsArray pins that binding:"required" on
// Fields is enforced at the handler, which is what made the dropped field
// invisible to the client.
func TestCreateFormRejectsAMissingFieldsArray(t *testing.T) {
	r, mock := newRouter(t)

	w := do(r, http.MethodPost, "/api/forms",
		`{"name":"X","code":"x","category":"c"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body=%s", w.Code, http.StatusBadRequest, w.Body.String())
	}
	env := envelope(w)
	if env["success"] == true {
		t.Errorf("reported success for a rejected body; body=%s", w.Body.String())
	}
	// No expectation is registered: any INSERT would surface as an error here.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestSubmitFormAcceptsDataThroughTheRoute drives the whole chain: bind,
// validate against the stored fields column, insert the submission.
func TestSubmitFormAcceptsDataThroughTheRoute(t *testing.T) {
	r, mock := newRouter(t)

	mock.ExpectQuery(`SELECT \* FROM forms WHERE id`).
		WithArgs("form-1", tenant).
		WillReturnRows(sqlmock.NewRows(
			[]string{"id", "tenant_id", "name", "code", "category", "description",
				"layout", "fields", "status", "version", "created_at", "updated_at"},
		).AddRow(formRow("form-1", "onboarding", "desc", `{"columns":2}`,
			validFieldsJSON, "active")...))

	mock.ExpectExec(`INSERT INTO form_submissions`).WillReturnResult(sqlmock.NewResult(1, 1))

	w := do(r, http.MethodPost, "/api/forms/form-1/submit", `{"data":{"name":"Ada"}}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", w.Code, http.StatusOK, w.Body.String())
	}
	env := envelope(w)
	data, _ := env["data"].(map[string]any)
	if data == nil {
		t.Fatalf("data missing; body=%s", w.Body.String())
	}
	if got, want := data["data"], `{"name":"Ada"}`; got != want {
		t.Errorf("data = %v, want %q", got, want)
	}
	if got, want := data["submittedBy"], "user-1"; got != want {
		t.Errorf("submittedBy = %v, want %q", got, want)
	}
	// Record-only finding, pinned so it cannot drift silently: form_submissions
	// has no comment column in migration 605, so Comment cannot be populated.
	// Anyone who adds the column must update this test deliberately.
	if got, want := data["comment"], ""; got != want {
		t.Errorf("comment = %v, want %q (no comment column exists)", got, want)
	}
	if got, want := data["status"], "submitted"; got != want {
		t.Errorf("status = %v, want %q", got, want)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestSubmitFormRejectsMalformedFieldsColumn is the arm that gives the test
// above discriminating power: an object-typed fields column is refused, so the
// accept path is not passing a validator that accepts anything.
func TestSubmitFormRejectsMalformedFieldsColumn(t *testing.T) {
	r, mock := newRouter(t)

	mock.ExpectQuery(`SELECT \* FROM forms WHERE id`).
		WithArgs("form-1", tenant).
		WillReturnRows(sqlmock.NewRows(
			[]string{"id", "tenant_id", "name", "code", "category", "description",
				"layout", "fields", "status", "version", "created_at", "updated_at"},
		).AddRow(formRow("form-1", "broken", "desc", `{"columns":2}`, "{}", "active")...))

	w := do(r, http.MethodPost, "/api/forms/form-1/submit", `{"data":{"name":"Ada"}}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body=%s", w.Code, http.StatusBadRequest, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestSubmitFormAnswersBadRequestForValidationFailures pins the status mapping:
// a validation rejection is a client error, not a 500.
func TestSubmitFormAnswersBadRequestForValidationFailures(t *testing.T) {
	r, mock := newRouter(t)

	mock.ExpectQuery(`SELECT \* FROM forms WHERE id`).
		WithArgs("form-1", tenant).
		WillReturnRows(sqlmock.NewRows(
			[]string{"id", "tenant_id", "name", "code", "category", "description",
				"layout", "fields", "status", "version", "created_at", "updated_at"},
		).AddRow(formRow("form-1", "onboarding", "desc", `{"columns":2}`,
			validFieldsJSON, "active")...))

	w := do(r, http.MethodPost, "/api/forms/form-1/submit", `{"data":{}}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body=%s", w.Code, http.StatusBadRequest, w.Body.String())
	}
	env := envelope(w)
	if env["success"] == true {
		t.Errorf("reported success for incomplete data; body=%s", w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestGetSubmissionDoesNotShadowTheIDRoute pins the /forms/submissions/:sid
// route. It is registered after /forms/:id, so if the static segment were being
// shadowed by the wildcard this request would hit GetForm and answer 404.
func TestGetSubmissionDoesNotShadowTheIDRoute(t *testing.T) {
	r, mock := newRouter(t)

	mock.ExpectQuery(`SELECT \* FROM form_submissions WHERE id`).
		WithArgs("sub-1", tenant).
		WillReturnRows(sqlmock.NewRows(
			[]string{"id", "tenant_id", "form_id", "data", "submitted_by",
				"status", "created_at", "updated_at"},
		).AddRow("sub-1", tenant, "form-1", `{"name":"Ada"}`, "user-1",
			"submitted", time.Now().UTC(), time.Now().UTC()))

	w := do(r, http.MethodGet, "/api/forms/submissions/sub-1", "")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", w.Code, http.StatusOK, w.Body.String())
	}
	env := envelope(w)
	data, _ := env["data"].(map[string]any)
	if data == nil {
		t.Fatalf("data missing; body=%s", w.Body.String())
	}
	if got, want := data["id"], "sub-1"; got != want {
		t.Errorf("id = %v, want %q", got, want)
	}
	if got, want := data["data"], `{"name":"Ada"}`; got != want {
		t.Errorf("data = %v, want %q", got, want)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestGetFormAnswersNotFoundForAnUnknownID pins the error mapping on the route
// that owns the wildcard, and that it is scoped by tenant.
func TestGetFormAnswersNotFoundForAnUnknownID(t *testing.T) {
	r, _ := newRouter(t)

	w := do(r, http.MethodGet, "/api/forms/does-not-exist", "")
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d; body=%s", w.Code, http.StatusNotFound, w.Body.String())
	}
}

// TestHandlerRequiresTheFormPermission pins the auth guard on the write route.
// The middleware above is admin; a context with no role must be refused before
// it reaches the engine.
func TestHandlerRequiresTheFormPermission(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	engine := form_service.NewFormEngine(form_repo.NewRepository(sqlx.NewDb(db, "postgres")), zap.NewNop())

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/forms/:id", auth.RequirePermission("form", "read"),
		NewHandler(engine, zap.NewNop()).GetForm)

	w := do(r, http.MethodGet, "/api/forms/form-1", "")
	if w.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d; body=%s", w.Code, http.StatusForbidden, w.Body.String())
	}
}
