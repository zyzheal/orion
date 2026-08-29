package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/code-repo/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/code-repo/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeHandlerService{})
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

type fakeHandlerService struct{}

func (f *fakeHandlerService) AddComment(ctx context.Context, adapterID, repoID, prID string, userID, username string, req models.CreateCommentRequest) (*models.Comment, error) {
	return &models.Comment{}, nil
}

func (f *fakeHandlerService) AddReview(ctx context.Context, adapterID, repoID, prID string, userID, username string, req models.CreateReviewRequest) (*models.Review, error) {
	return &models.Review{}, nil
}

func (f *fakeHandlerService) ClosePullRequest(ctx context.Context, adapterID, repoID, prID string) error {
	return nil
}

func (f *fakeHandlerService) CreateBranch(ctx context.Context, adapterID, repoID string, req models.CreateBranchRequest) error {
	return nil
}

func (f *fakeHandlerService) CreatePullRequest(ctx context.Context, adapterID, repoID string, req models.CreatePullRequestRequest) (*models.PullRequest, error) {
	return &models.PullRequest{}, nil
}

func (f *fakeHandlerService) DeleteBranch(ctx context.Context, adapterID, repoID, branchName string) error {
	return nil
}

func (f *fakeHandlerService) GetCommit(ctx context.Context, adapterID, repoID, sha string) (*models.Commit, error) {
	return &models.Commit{}, nil
}

func (f *fakeHandlerService) GetFileDiff(ctx context.Context, adapterID, repoID string, base, head, path string) ([]models.FileDiff, error) {
	return []models.FileDiff{}, nil
}

func (f *fakeHandlerService) GetPullRequest(ctx context.Context, adapterID, repoID, prID string) (*models.PullRequest, error) {
	return &models.PullRequest{}, nil
}

func (f *fakeHandlerService) GetRepository(ctx context.Context, adapterID, repoID string) (*models.CodeRepo, error) {
	return &models.CodeRepo{}, nil
}

func (f *fakeHandlerService) GetWebhookSecret(ctx context.Context, repoID string) (*models.WebhookSecretResponse, error) {
	return &models.WebhookSecretResponse{}, nil
}

func (f *fakeHandlerService) ListAdapters(ctx context.Context) ([]models.CodeRepoAdapter, error) {
	return []models.CodeRepoAdapter{}, nil
}

func (f *fakeHandlerService) ListBranches(ctx context.Context, adapterID, repoID string) ([]models.Branch, error) {
	return []models.Branch{}, nil
}

func (f *fakeHandlerService) ListCodeOwners(ctx context.Context, repoID string) ([]models.CodeOwner, error) {
	return []models.CodeOwner{}, nil
}

func (f *fakeHandlerService) ListComments(ctx context.Context, adapterID, repoID, prID string) ([]models.Comment, error) {
	return []models.Comment{}, nil
}

func (f *fakeHandlerService) ListCommits(ctx context.Context, adapterID, repoID string, limit, offset int) ([]models.Commit, error) {
	return []models.Commit{}, nil
}

func (f *fakeHandlerService) ListPullRequests(ctx context.Context, adapterID, repoID, state string) ([]models.PullRequest, error) {
	return []models.PullRequest{}, nil
}

func (f *fakeHandlerService) ListRepositories(ctx context.Context, adapterID string) ([]models.CodeRepo, error) {
	return []models.CodeRepo{}, nil
}

func (f *fakeHandlerService) ListReviews(ctx context.Context, adapterID, repoID, prID string) ([]models.Review, error) {
	return []models.Review{}, nil
}

func (f *fakeHandlerService) ListWebhookLogs(ctx context.Context, limit, offset int) ([]map[string]any, error) {
	return []map[string]any{}, nil
}

func (f *fakeHandlerService) MergePullRequest(ctx context.Context, adapterID, repoID, prID string) error {
	return nil
}

func (f *fakeHandlerService) RotateWebhookSecret(ctx context.Context, repoID, providedSecret string) (*models.WebhookSecretResponse, error) {
	return &models.WebhookSecretResponse{}, nil
}

func (f *fakeHandlerService) SetWebhookSecret(ctx context.Context, repoID, secret string) (*models.WebhookSecretResponse, error) {
	return &models.WebhookSecretResponse{}, nil
}

func (f *fakeHandlerService) UpdatePullRequest(ctx context.Context, adapterID, repoID, prID string, req models.UpdatePullRequestRequest) (*models.PullRequest, error) {
	return &models.PullRequest{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)

func TestCODE_REPO_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCODE_REPO_Handler_ListAdapters(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListAdapters(c)
	if w.Code >= 500 {
		t.Fatalf("ListAdapters: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListRepositories(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListRepositories(c)
	if w.Code >= 500 {
		t.Fatalf("ListRepositories: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_GetRepository(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetRepository(c)
	if w.Code >= 500 {
		t.Fatalf("GetRepository: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListBranches(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListBranches(c)
	if w.Code >= 500 {
		t.Fatalf("ListBranches: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_CreateBranch(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateBranch(c)
	if w.Code >= 500 {
		t.Fatalf("CreateBranch: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_DeleteBranch(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteBranch(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteBranch: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListPullRequests(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListPullRequests(c)
	if w.Code >= 500 {
		t.Fatalf("ListPullRequests: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_GetPullRequestByID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetPullRequestByID(c)
	if w.Code >= 500 {
		t.Fatalf("GetPullRequestByID: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_CreatePullRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreatePullRequest(c)
	if w.Code >= 500 {
		t.Fatalf("CreatePullRequest: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_UpdatePullRequestByID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdatePullRequestByID(c)
	if w.Code >= 500 {
		t.Fatalf("UpdatePullRequestByID: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_MergePullRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().MergePullRequest(c)
	if w.Code >= 500 {
		t.Fatalf("MergePullRequest: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ClosePullRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ClosePullRequest(c)
	if w.Code >= 500 {
		t.Fatalf("ClosePullRequest: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_AddReview(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().AddReview(c)
	if w.Code >= 500 {
		t.Fatalf("AddReview: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListReviews(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListReviews(c)
	if w.Code >= 500 {
		t.Fatalf("ListReviews: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_AddComment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().AddComment(c)
	if w.Code >= 500 {
		t.Fatalf("AddComment: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListComments(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListComments(c)
	if w.Code >= 500 {
		t.Fatalf("ListComments: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListCommits(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListCommits(c)
	if w.Code >= 500 {
		t.Fatalf("ListCommits: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_GetCommit(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetCommit(c)
	if w.Code >= 500 {
		t.Fatalf("GetCommit: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_GetFileDiff(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetFileDiff(c)
	if w.Code >= 500 {
		t.Fatalf("GetFileDiff: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListCodeOwners(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListCodeOwners(c)
	if w.Code >= 500 {
		t.Fatalf("ListCodeOwners: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_ListWebhookLogs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListWebhookLogs(c)
	if w.Code >= 500 {
		t.Fatalf("ListWebhookLogs: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_SetWebhookSecret(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().SetWebhookSecret(c)
	if w.Code >= 500 {
		t.Fatalf("SetWebhookSecret: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_GetWebhookSecret(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetWebhookSecret(c)
	if w.Code >= 500 {
		t.Fatalf("GetWebhookSecret: got %d", w.Code)
	}
}

func TestCODE_REPO_Handler_RotateWebhookSecret(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RotateWebhookSecret(c)
	if w.Code >= 500 {
		t.Fatalf("RotateWebhookSecret: got %d", w.Code)
	}
}
