package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticketing/service"
)

type recordingAssignmentRepo struct {
	fakeTicketingRepo
	removedID  string
	removedErr error
}

func (r *recordingAssignmentRepo) DeleteAssignmentRule(ctx context.Context, tenantID, id string) error {
	r.removedID = id
	return r.removedErr
}

func newTestAssignmentHandler() (*gin.Engine, *recordingAssignmentRepo) {
	gin.SetMode(gin.TestMode)
	repo := &recordingAssignmentRepo{}
	h := NewHandler(service.NewService(repo))

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "tenant-1")
		c.Next()
	})
	r.DELETE("/rules/:id", h.RemoveAssignmentRule)
	return r, repo
}

// TestHandler_RemoveAssignmentRulePassesAUUIDThrough is the handler half of the
// Round 64 fix. ticketing_assignment_rules.id is UUID PRIMARY KEY in
// 655_create_ticketing_missing_tables.sql, and RemoveAssignmentRule used to
// strconv.Atoi the path parameter first, so every id the database actually
// holds came back as a 400 "invalid rule id" before the delete could run. A
// reintroduced coercion fails this test on both assertions: the status becomes
// 400 and removedID stays empty.
func TestHandler_RemoveAssignmentRulePassesAUUIDThrough(t *testing.T) {
	r, repo := newTestAssignmentHandler()

	req := httptest.NewRequest(http.MethodDelete,
		"/rules/550e8400-e29b-41d4-a716-446655440000", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if repo.removedID != "550e8400-e29b-41d4-a716-446655440000" {
		t.Fatalf("repository was called with %q, want the UUID untouched", repo.removedID)
	}
}

// TestHandler_RemoveAssignmentRuleRejectsAnEmptyID drives the handler directly:
// gin will not route "/rules/" into ":id", so the empty-id guard is only
// reachable when the parameter is present but blank.
func TestHandler_RemoveAssignmentRuleRejectsAnEmptyID(t *testing.T) {
	repo := &recordingAssignmentRepo{}
	h := NewHandler(service.NewService(repo))

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/rules/", nil)
	c.Params = gin.Params{{Key: "id", Value: ""}}
	c.Set("tenant_id", "tenant-1")

	h.RemoveAssignmentRule(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for an empty id, got %d: %s", w.Code, w.Body.String())
	}
	if repo.removedID != "" {
		t.Errorf("an empty id must not reach the repository, got %q", repo.removedID)
	}
}

func TestHandler_RemoveAssignmentRulePropagatesARepositoryFailure(t *testing.T) {
	r, repo := newTestAssignmentHandler()
	repo.removedErr = service.ErrNotFoundRule("550e8400-e29b-41d4-a716-446655440000")

	req := httptest.NewRequest(http.MethodDelete,
		"/rules/550e8400-e29b-41d4-a716-446655440000", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for a repository failure, got %d: %s", w.Code, w.Body.String())
	}
}
