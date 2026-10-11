package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/rdm-code-reviews/service"
)

func makeCtx(method, path string, body string, params gin.Params) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = params
	var reader *strings.Reader
	if body != "" {
		reader = strings.NewReader(body)
	} else {
		reader = strings.NewReader("")
	}
	c.Request = httptest.NewRequest(method, path, reader)
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func TestList_EmptySlice(t *testing.T) {
	h := NewHandler(service.NewService(nil))
	c, w := makeCtx(http.MethodGet, "/api/v1/rdm/code-reviews?projectId=p1", "", nil)
	h.List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", w.Code, w.Body.String())
	}
}

func TestGet_NotFound(t *testing.T) {
	h := NewHandler(service.NewService(nil))
	c, w := makeCtx(http.MethodGet, "/api/v1/rdm/code-reviews/review-1", "",
		gin.Params{{Key: "id", Value: "review-1"}})
	h.Get(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d (body: %s)", w.Code, w.Body.String())
	}
}

func TestCreate_EchoesRequestWithGeneratedID(t *testing.T) {
	h := NewHandler(service.NewService(nil))
	body := `{"projectId":"p1","title":"Test PR","sourceBranch":"feat","targetBranch":"main","sourceCommit":"abc123","reviewers":["u1","u2"]}`
	c, w := makeCtx(http.MethodPost, "/api/v1/rdm/code-reviews", body, nil)
	h.Create(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d (body: %s)", w.Code, w.Body.String())
	}
	// Body should contain "pending" status and non-empty id.
	b := w.Body.String()
	if !strings.Contains(b, `"status":"pending"`) {
		t.Errorf("expected status=pending in response, got: %s", b)
	}
}

func TestCreate_MissingRequiredFields_BadRequest(t *testing.T) {
	h := NewHandler(service.NewService(nil))
	// Missing projectId/title/sourceBranch/targetBranch/sourceCommit.
	body := `{}`
	c, w := makeCtx(http.MethodPost, "/api/v1/rdm/code-reviews", body, nil)
	h.Create(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d (body: %s)", w.Code, w.Body.String())
	}
}

func TestDelete_ReturnsDeletedTrue(t *testing.T) {
	h := NewHandler(service.NewService(nil))
	c, w := makeCtx(http.MethodDelete, "/api/v1/rdm/code-reviews/review-1", "",
		gin.Params{{Key: "id", Value: "review-1"}})
	h.Delete(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	b := w.Body.String()
	if !strings.Contains(b, `"deleted":true`) {
		t.Errorf("expected deleted=true, got: %s", b)
	}
}

func TestListComments_EmptySlice(t *testing.T) {
	h := NewHandler(service.NewService(nil))
	c, w := makeCtx(http.MethodGet, "/api/v1/rdm/code-reviews/review-1/comments", "",
		gin.Params{{Key: "id", Value: "review-1"}})
	h.ListComments(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestCreateComment_EchoesWithGeneratedID(t *testing.T) {
	h := NewHandler(service.NewService(nil))
	body := `{"content":"please fix line 42","file":"main.go","line":42}`
	c, w := makeCtx(http.MethodPost, "/api/v1/rdm/code-reviews/review-1/comments", body,
		gin.Params{{Key: "id", Value: "review-1"}})
	h.CreateComment(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d (body: %s)", w.Code, w.Body.String())
	}
	b := w.Body.String()
	if !strings.Contains(b, `"file":"main.go"`) {
		t.Errorf("expected file=main.go in response, got: %s", b)
	}
	if !strings.Contains(b, `"line":42`) {
		t.Errorf("expected line=42 in response, got: %s", b)
	}
}

func TestRegisterRoutes_AllSix(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewHandler(service.NewService(nil))
	h.RegisterRoutes(r.Group("/api/v1"))

	routes := map[string]bool{}
	for _, rt := range r.Routes() {
		routes[rt.Method+" "+rt.Path] = true
	}
	expected := []string{
		"GET /api/v1/rdm/code-reviews",
		"GET /api/v1/rdm/code-reviews/:id",
		"POST /api/v1/rdm/code-reviews",
		"DELETE /api/v1/rdm/code-reviews/:id",
		"GET /api/v1/rdm/code-reviews/:id/comments",
		"POST /api/v1/rdm/code-reviews/:id/comments",
	}
	for _, e := range expected {
		if !routes[e] {
			t.Errorf("missing route: %s", e)
		}
	}
}
