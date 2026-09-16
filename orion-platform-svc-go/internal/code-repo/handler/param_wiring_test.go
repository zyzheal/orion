package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/code-repo/models"
)

// recordingCRSvc promotes every method of fakeHandlerService and records what
// UpdatePullRequestByID resolved. handler_test.go drives the handler with an
// empty context, so it cannot tell a reachable body fallback from a dead one.
type recordingCRSvc struct {
	*fakeHandlerService
	gotAdapter string
	gotRepo    string
	gotPR      string
	gotTitle   *string
}

func (r *recordingCRSvc) UpdatePullRequest(ctx context.Context, adapterID, repoID, prID string, req models.UpdatePullRequestRequest) (*models.PullRequest, error) {
	r.gotAdapter, r.gotRepo, r.gotPR, r.gotTitle = adapterID, repoID, prID, req.Title
	return &models.PullRequest{}, nil
}

func newCRRouter(rec *recordingCRSvc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "tenant-1")
		c.Set("roles", []string{"admin"})
		c.Next()
	})
	NewHandler(rec).RegisterRoutes(r.Group("/api/v1"))
	return r
}

func TestCODEREPO_UpdatePullRequestByID_ResolvesRepoFromQuery(t *testing.T) {
	rec := &recordingCRSvc{}
	r := newCRRouter(rec)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/v1/code-repo/ad-1/pull-requests/pr-2?repoId=repo-q", strings.NewReader(`{"title":"t"}`))
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("code=%d (%s), want 200", w.Code, w.Body.String())
	}
	if rec.gotAdapter != "ad-1" || rec.gotPR != "pr-2" {
		t.Fatalf("adapter=%q pr=%q, want ad-1/pr-2", rec.gotAdapter, rec.gotPR)
	}
	if rec.gotRepo != "repo-q" {
		t.Fatalf("repo=%q, want repo-q from the query", rec.gotRepo)
	}
}

// Before the body was bound ahead of the repoId guard, this request got a 400
// with "repoId is required in query or request body" even though the body
// carried repoId: the guard returned before ShouldBindJSON ever ran, so the
// message advertised a contract the code could not fulfil.
func TestCODEREPO_UpdatePullRequestByID_ResolvesRepoFromBody(t *testing.T) {
	rec := &recordingCRSvc{}
	r := newCRRouter(rec)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPut, "/api/v1/code-repo/ad-1/pull-requests/pr-2", strings.NewReader(`{"repo_id":"repo-b"}`)))
	if w.Code != http.StatusOK {
		t.Fatalf("code=%d (%s), want 200: the body repo_id must satisfy the handler", w.Code, w.Body.String())
	}
	if rec.gotRepo != "repo-b" {
		t.Fatalf("repo=%q, want repo-b from the request body", rec.gotRepo)
	}
}

// The message is pinned: it is the only place the handler tells a caller how to
// supply repoId, so a rewording would silently break that guidance.
func TestCODEREPO_UpdatePullRequestByID_StillRejectsAMissingRepo(t *testing.T) {
	rec := &recordingCRSvc{}
	r := newCRRouter(rec)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPut, "/api/v1/code-repo/ad-1/pull-requests/pr-2", strings.NewReader(`{"title":"t"}`)))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("code=%d (%s), want 400", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "repoId is required in query or request body") {
		t.Fatalf("body=%s, want the pinned repoId guidance", w.Body.String())
	}
	if rec.gotRepo != "" {
		t.Fatalf("service was reached with repo=%q, want no call", rec.gotRepo)
	}
}
