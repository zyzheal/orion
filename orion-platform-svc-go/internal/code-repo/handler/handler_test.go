package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/code-repo/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
}

func makeCtx(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, buf)
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

func TestCODE_REPO_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCODE_REPO_Handler_ListAdapters(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListAdapters(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListAdapters: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListRepositories(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListRepositories(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListRepositories: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_GetRepository(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetRepository(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetRepository: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListBranches(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListBranches(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListBranches: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_CreateBranch(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateBranch(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateBranch: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_DeleteBranch(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteBranch(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteBranch: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListPullRequests(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListPullRequests(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListPullRequests: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_GetPullRequestByID(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetPullRequestByID(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetPullRequestByID: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_CreatePullRequest(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreatePullRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreatePullRequest: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_UpdatePullRequestByID(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdatePullRequestByID(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdatePullRequestByID: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_MergePullRequest(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().MergePullRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("MergePullRequest: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ClosePullRequest(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ClosePullRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ClosePullRequest: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_AddReview(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().AddReview(c)
	if w.Code != http.StatusOK {
		t.Fatalf("AddReview: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListReviews(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListReviews(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListReviews: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_AddComment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().AddComment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("AddComment: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListComments(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListComments(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListComments: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListCommits(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListCommits(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListCommits: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_GetCommit(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetCommit(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetCommit: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_GetFileDiff(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetFileDiff(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetFileDiff: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListCodeOwners(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListCodeOwners(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListCodeOwners: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListWebhookLogs(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListWebhookLogs(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListWebhookLogs: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_SetWebhookSecret(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().SetWebhookSecret(c)
	if w.Code != http.StatusOK {
		t.Fatalf("SetWebhookSecret: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_GetWebhookSecret(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetWebhookSecret(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetWebhookSecret: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_RotateWebhookSecret(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RotateWebhookSecret(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RotateWebhookSecret: got %d", w.Code)
	}
}
