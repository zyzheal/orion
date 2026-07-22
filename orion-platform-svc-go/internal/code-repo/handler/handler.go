package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/code-repo/models"
	"orion/platform-svc-go/internal/code-repo/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all code-repo endpoints under the given group.
// Mirrors /api/v1/code-repo routes from the TS source (25 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	cr := rg.Group("/code-repo")

	// --- Adapters ---
	// GET /code-repo/adapters
	cr.GET("/adapters", auth.RequirePermission("code_repo", "read"), h.ListAdapters)

	// --- Repositories ---
	// GET /code-repo/:adapterId/repos
	cr.GET("/:adapterId/repos", auth.RequirePermission("code_repo", "read"), h.ListRepositories)
	// GET /code-repo/:adapterId/repos/:repoId
	cr.GET("/:adapterId/repos/:repoId", auth.RequirePermission("code_repo", "read"), h.GetRepository)

	// --- Branches ---
	// GET /code-repo/:adapterId/repos/:repoId/branches
	cr.GET("/:adapterId/repos/:repoId/branches", auth.RequirePermission("code_repo", "read"), h.ListBranches)
	// POST /code-repo/:adapterId/repos/:repoId/branches
	cr.POST("/:adapterId/repos/:repoId/branches", auth.RequirePermission("code_repo", "write"), h.CreateBranch)
	// DELETE /code-repo/:adapterId/repos/:repoId/branches/:branchName
	cr.DELETE("/:adapterId/repos/:repoId/branches/:branchName", auth.RequirePermission("code_repo", "write"), h.DeleteBranch)

	// --- Pull Requests ---
	// GET /code-repo/:adapterId/repos/:repoId/pulls
	cr.GET("/:adapterId/repos/:repoId/pulls", auth.RequirePermission("code_repo", "read"), h.ListPullRequests)
	// POST /code-repo/:adapterId/repos/:repoId/pulls
	cr.POST("/:adapterId/repos/:repoId/pulls", auth.RequirePermission("code_repo", "write"), h.CreatePullRequest)
	// GET /code-repo/:adapterId/repos/:repoId/pull-requests (alternate path)
	cr.GET("/:adapterId/repos/:repoId/pull-requests", auth.RequirePermission("code_repo", "read"), h.ListPullRequests)
	// GET /code-repo/:adapterId/pull-requests/:prId — PR by prId with repoId query
	rg.GET("/code-repo/:adapterId/pull-requests/:prId", auth.RequirePermission("code_repo", "read"), h.GetPullRequestByID)
	// PUT /code-repo/:adapterId/pull-requests/:prId — update PR
	rg.PUT("/code-repo/:adapterId/pull-requests/:prId", auth.RequirePermission("code_repo", "write"), h.UpdatePullRequestByID)
	// POST /code-repo/:adapterId/repos/:repoId/pulls/:prId/merge
	cr.POST("/:adapterId/repos/:repoId/pulls/:prId/merge", auth.RequirePermission("code_repo", "write"), h.MergePullRequest)
	// POST /code-repo/:adapterId/repos/:repoId/pulls/:prId/close
	cr.POST("/:adapterId/repos/:repoId/pulls/:prId/close", auth.RequirePermission("code_repo", "write"), h.ClosePullRequest)

	// --- Reviews ---
	// POST /code-repo/:adapterId/repos/:repoId/pulls/:prId/reviews
	cr.POST("/:adapterId/repos/:repoId/pulls/:prId/reviews", auth.RequirePermission("code_repo", "write"), h.AddReview)
	// GET /code-repo/:adapterId/repos/:repoId/pulls/:prId/reviews
	cr.GET("/:adapterId/repos/:repoId/pulls/:prId/reviews", auth.RequirePermission("code_repo", "read"), h.ListReviews)

	// --- Comments ---
	// GET /code-repo/:adapterId/repos/:repoId/pulls/:prId/comments
	cr.GET("/:adapterId/repos/:repoId/pulls/:prId/comments", auth.RequirePermission("code_repo", "read"), h.ListComments)
	// POST /code-repo/:adapterId/repos/:repoId/pulls/:prId/comments
	cr.POST("/:adapterId/repos/:repoId/pulls/:prId/comments", auth.RequirePermission("code_repo", "write"), h.AddComment)

	// --- Commits ---
	// GET /code-repo/:adapterId/repos/:repoId/commits
	cr.GET("/:adapterId/repos/:repoId/commits", auth.RequirePermission("code_repo", "read"), h.ListCommits)
	// GET /code-repo/:adapterId/repos/:repoId/commits/:sha
	cr.GET("/:adapterId/repos/:repoId/commits/:sha", auth.RequirePermission("code_repo", "read"), h.GetCommit)

	// --- File Diff ---
	// GET /code-repo/:adapterId/repos/:repoId/diff
	cr.GET("/:adapterId/repos/:repoId/diff", auth.RequirePermission("code_repo", "read"), h.GetFileDiff)

	// --- Code Ownership ---
	// GET /code-repo/code-owners
	cr.GET("/code-owners", auth.RequirePermission("code_repo", "read"), h.ListCodeOwners)

	// --- Webhooks ---
	// GET /code-repo/webhooks/logs
	cr.GET("/webhooks/logs", auth.RequirePermission("code_repo", "read"), h.ListWebhookLogs)
	// POST /code-repo/webhooks/:id/secret
	cr.POST("/webhooks/:id/secret", auth.RequirePermission("code_repo", "write"), h.SetWebhookSecret)
	// GET /code-repo/webhooks/:id/secret
	cr.GET("/webhooks/:id/secret", auth.RequirePermission("code_repo", "read"), h.GetWebhookSecret)
	// POST /code-repo/webhooks/:id/rotate-secret
	cr.POST("/webhooks/:id/rotate-secret", auth.RequirePermission("code_repo", "write"), h.RotateWebhookSecret)
}

// --- Adapters ---

func (h *Handler) ListAdapters(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAdapters")
	defer span.End()
	adapters, err := h.svc.ListAdapters(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, adapters)
}

// --- Repositories ---

func (h *Handler) ListRepositories(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRepositories")
	defer span.End()
	adapterID := c.Param("adapterId")
	repos, err := h.svc.ListRepositories(ctx, adapterID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, repos)
}

func (h *Handler) GetRepository(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRepository")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	repo, err := h.svc.GetRepository(ctx, adapterID, repoID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "repository not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, repo)
}

// --- Branches ---

func (h *Handler) ListBranches(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBranches")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	branches, err := h.svc.ListBranches(ctx, adapterID, repoID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, branches)
}

func (h *Handler) CreateBranch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateBranch")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	var req models.CreateBranchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.CreateBranch(ctx, adapterID, repoID, req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "branch created", "name": req.Name})
}

func (h *Handler) DeleteBranch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteBranch")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	branchName := c.Param("branchName")
	if err := h.svc.DeleteBranch(ctx, adapterID, repoID, branchName); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "branch deleted"})
}

// --- Pull Requests ---

func (h *Handler) ListPullRequests(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPullRequests")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	state := c.Query("state")
	prs, err := h.svc.ListPullRequests(ctx, adapterID, repoID, state)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, prs)
}

func (h *Handler) GetPullRequestByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPullRequestByID")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Query("repoId")
	if repoID == "" {
		middleware.RespondBadRequest(c, "repoId query parameter is required")
		return
	}
	prID := c.Param("prId")
	pr, err := h.svc.GetPullRequest(ctx, adapterID, repoID, prID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "pull request not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, pr)
}

func (h *Handler) CreatePullRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreatePullRequest")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	var req models.CreatePullRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	pr, err := h.svc.CreatePullRequest(ctx, adapterID, repoID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, pr)
}

func (h *Handler) UpdatePullRequestByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdatePullRequestByID")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Query("repoId")
	if repoID == "" {
		repoID = c.Param("repoId")
	}
	if repoID == "" {
		middleware.RespondBadRequest(c, "repoId is required in query or request body")
		return
	}
	prID := c.Param("prId")
	var req models.UpdatePullRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Allow repoId from body
	if repoID == "" && req.RepoID != "" {
		repoID = req.RepoID
	}
	if repoID == "" {
		middleware.RespondBadRequest(c, "repoId is required")
		return
	}
	pr, err := h.svc.UpdatePullRequest(ctx, adapterID, repoID, prID, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "pull request not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, pr)
}

func (h *Handler) MergePullRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MergePullRequest")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	prID := c.Param("prId")
	if err := h.svc.MergePullRequest(ctx, adapterID, repoID, prID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "pull request merged"})
}

func (h *Handler) ClosePullRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ClosePullRequest")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	prID := c.Param("prId")
	if err := h.svc.ClosePullRequest(ctx, adapterID, repoID, prID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "pull request closed"})
}

// --- Reviews ---

func (h *Handler) AddReview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddReview")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	prID := c.Param("prId")
	userID := c.GetString("user_id")
	username := c.GetString("username")
	var req models.CreateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	review, err := h.svc.AddReview(ctx, adapterID, repoID, prID, userID, username, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, review)
}

func (h *Handler) ListReviews(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListReviews")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	prID := c.Param("prId")
	reviews, err := h.svc.ListReviews(ctx, adapterID, repoID, prID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, reviews)
}

// --- Comments ---

func (h *Handler) AddComment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddComment")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	prID := c.Param("prId")
	userID := c.GetString("user_id")
	username := c.GetString("username")
	var req models.CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	comment, err := h.svc.AddComment(ctx, adapterID, repoID, prID, userID, username, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, comment)
}

func (h *Handler) ListComments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListComments")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	prID := c.Param("prId")
	comments, err := h.svc.ListComments(ctx, adapterID, repoID, prID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, comments)
}

// --- Commits ---

func (h *Handler) ListCommits(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCommits")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	commits, err := h.svc.ListCommits(ctx, adapterID, repoID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, commits)
}

func (h *Handler) GetCommit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCommit")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	sha := c.Param("sha")
	commit, err := h.svc.GetCommit(ctx, adapterID, repoID, sha)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "commit not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, commit)
}

// --- File Diff ---

func (h *Handler) GetFileDiff(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetFileDiff")
	defer span.End()
	adapterID := c.Param("adapterId")
	repoID := c.Param("repoId")
	base := c.Query("base")
	head := c.Query("head")
	path := c.Query("path")
	diff, err := h.svc.GetFileDiff(ctx, adapterID, repoID, base, head, path)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, diff)
}

// --- Code Owners ---

func (h *Handler) ListCodeOwners(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCodeOwners")
	defer span.End()
	repoID := c.Query("repoId")
	owners, err := h.svc.ListCodeOwners(ctx, repoID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"owners": owners})
}

// --- Webhooks ---

func (h *Handler) ListWebhookLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListWebhookLogs")
	defer span.End()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	logs, err := h.svc.ListWebhookLogs(ctx, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"logs": logs})
}

// --- Webhook Secrets ---

func (h *Handler) SetWebhookSecret(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SetWebhookSecret")
	defer span.End()
	repoID := c.Param("id")
	var req models.SetWebhookSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, "secret is required in request body")
		return
	}
	resp, err := h.svc.SetWebhookSecret(ctx, repoID, req.Secret)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, resp)
}

func (h *Handler) GetWebhookSecret(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetWebhookSecret")
	defer span.End()
	repoID := c.Param("id")
	resp, err := h.svc.GetWebhookSecret(ctx, repoID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "webhook secret not found for this repository")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

func (h *Handler) RotateWebhookSecret(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RotateWebhookSecret")
	defer span.End()
	repoID := c.Param("id")
	var req models.SetWebhookSecretRequest
	c.ShouldBindJSON(&req) // optional body
	resp, err := h.svc.RotateWebhookSecret(ctx, repoID, req.Secret)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}
