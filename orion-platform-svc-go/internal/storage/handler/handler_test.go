package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/storage/models"
	"orion/platform-svc-go/internal/storage/service"

	"github.com/gin-gonic/gin"
)

// fakeRepo is the only collaborator the handler reaches, and it has to satisfy
// the whole storage service interface because the handler holds a concrete
// *service.Service rather than an interface.
type fakeRepo struct {
	updateErr error
	updateOut *models.StorageEntry
}

func (f *fakeRepo) Create(ctx context.Context, entity *models.StorageEntry) error { return nil }

func (f *fakeRepo) GetByID(ctx context.Context, id, tenantID string) (*models.StorageEntry, error) {
	return nil, nil
}

func (f *fakeRepo) GetByBucketAndKey(ctx context.Context, bucket, key, tenantID string) (*models.StorageEntry, error) {
	return nil, nil
}

func (f *fakeRepo) List(ctx context.Context, tenantID string, limit, offset int) ([]models.StorageEntry, error) {
	return nil, nil
}

func (f *fakeRepo) Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.StorageEntry, error) {
	return f.updateOut, f.updateErr
}

func (f *fakeRepo) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeRepo) DeleteByBucketAndKey(ctx context.Context, bucket, key, tenantID string) (bool, error) {
	return false, nil
}

func putCtx(t *testing.T, body string) (*httptest.ResponseRecorder, *gin.Context) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "t-1")
	c.Params = gin.Params{{Key: "id", Value: "e-1"}}
	c.Request = httptest.NewRequest(http.MethodPut, "/storage/e-1", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return w, c
}

type envelope struct {
	Success bool            `json:"success"`
	Code    string          `json:"code"`
	Error   string          `json:"error"`
	Data    json.RawMessage `json:"data"`
}

func TestUpdateAnswersNotFoundForAMissingEntry(t *testing.T) {
	h := NewHandler(service.NewService(&fakeRepo{updateErr: sentinel.NotFound}))
	w, c := putCtx(t, `{"key":"k2"}`)
	h.Update(c)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}
	var env envelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("response is not the error envelope: %v (%s)", err, w.Body.String())
	}
	if env.Success {
		t.Fatalf("a 404 reported success: %s", w.Body.String())
	}
	if env.Code != "NOT_FOUND" {
		t.Fatalf("code = %q, want NOT_FOUND", env.Code)
	}
}

func TestUpdateAnswersInternalErrorForAnOutage(t *testing.T) {
	outage := errors.New("connection refused")
	h := NewHandler(service.NewService(&fakeRepo{updateErr: outage}))
	w, c := putCtx(t, `{"key":"k2"}`)
	h.Update(c)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	var env envelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("response is not the error envelope: %v (%s)", err, w.Body.String())
	}
	if env.Code != "INTERNAL_ERROR" {
		t.Fatalf("code = %q, want INTERNAL_ERROR", env.Code)
	}
	if !strings.Contains(env.Error, "connection refused") {
		t.Fatalf("error message %q dropped the underlying cause", env.Error)
	}
}

func TestUpdateAnswersInternalErrorForARepositoryRejection(t *testing.T) {
	// Recorded non-fix: the repository answers sentinel.BadRequest for a column
	// outside the whitelist, and the handler maps it to 500 rather than 400.
	// The write is refused either way, but the status line lies about it. This
	// test pins the current shape so the drift is visible, not silent.
	h := NewHandler(service.NewService(&fakeRepo{
		updateErr: errors.New("bad request: column \"password\" is not updatable on storage_entries"),
	}))
	w, c := putCtx(t, `{"key":"k2"}`)
	h.Update(c)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	var env envelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("response is not the error envelope: %v (%s)", err, w.Body.String())
	}
	if env.Code != "INTERNAL_ERROR" {
		t.Fatalf("code = %q, want INTERNAL_ERROR", env.Code)
	}
}

func TestUpdateSucceedsAndReturnsTheEntry(t *testing.T) {
	entry := &models.StorageEntry{
		ID:        "e-1",
		TenantID:  "t-1",
		Bucket:    "b1",
		Key:       "k2",
		Size:      1024,
		Provider:  "s3",
		CreatedAt: time.Date(2026, 9, 14, 9, 0, 0, 0, time.UTC),
		UpdatedAt: time.Date(2026, 9, 14, 10, 0, 0, 0, time.UTC),
	}
	h := NewHandler(service.NewService(&fakeRepo{updateOut: entry}))
	w, c := putCtx(t, `{"key":"k2"}`)
	h.Update(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var env envelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("response is not the envelope: %v (%s)", err, w.Body.String())
	}
	if !env.Success {
		t.Fatalf("a 200 reported failure: %s", w.Body.String())
	}
	var got models.StorageEntry
	if err := json.Unmarshal(env.Data, &got); err != nil {
		t.Fatalf("data is not a storage entry: %v (%s)", err, env.Data)
	}
	if got.ID != "e-1" || got.Key != "k2" || got.Size != 1024 {
		t.Fatalf("data = %+v, want the updated entry", got)
	}
}

func TestUpdateAnswersBadRequestForMalformedJSON(t *testing.T) {
	h := NewHandler(service.NewService(&fakeRepo{}))
	w, c := putCtx(t, `{not json`)
	h.Update(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	var env envelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("response is not the error envelope: %v (%s)", err, w.Body.String())
	}
	if env.Code != "BAD_REQUEST" {
		t.Fatalf("code = %q, want BAD_REQUEST", env.Code)
	}
}

func TestUpdateRejectsABodyWithoutAKey(t *testing.T) {
	// An empty body is still a caller bug (no fields to write), not a missing
	// row. Before the repository returned sentinel.BadRequest for an empty map
	// the handler answered 404 here, which hid the bug behind a "not found".
	h := NewHandler(service.NewService(&fakeRepo{updateErr: errors.New("bad request: no fields to update")}))
	w, c := putCtx(t, `{}`)
	h.Update(c)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500: an empty update is a bug, not a missing entry", w.Code)
	}
	var env envelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("response is not the error envelope: %v (%s)", err, w.Body.String())
	}
	if env.Code != "INTERNAL_ERROR" {
		t.Fatalf("code = %q, want INTERNAL_ERROR", env.Code)
	}
}
