package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/deploy/models"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	Create(ctx context.Context, tenantID string, req models.CreateDeploymentRequest) (*models.Deployment, error)
	Get(ctx context.Context, tenantID, id string) (*models.Deployment, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.Deployment, error)
	GetLatest(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error)
	Metrics(ctx context.Context, tenantID string) (*models.DeploymentMetrics, error)
	Rollback(ctx context.Context, tenantID, id string, targetVersion, reason string) (*models.Rollback, error)
	GetRollbackHistory(ctx context.Context, tenantID, id string) ([]models.Rollback, error)
	Cancel(ctx context.Context, tenantID, id string) error
	GetAuditTrail(ctx context.Context, deploymentID string) ([]models.AuditEntry, error)
	GetReleaseNotes(ctx context.Context, deploymentID string) (*models.ReleaseNote, error)
	GenerateReleaseNotes(ctx context.Context, tenantID, deploymentID, content string) (*models.ReleaseNote, error)
	GetReleaseNotesByTenant(ctx context.Context, tenantID string) ([]models.ReleaseNote, error)
	LinkGitCommit(ctx context.Context, deploymentID, commitSHA, branch string) error
	GetDeploymentChangelog(ctx context.Context, deploymentID string) ([]models.GitChangelogEntry, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all deploy endpoints under /deploy.
// Mirrors /api/v1/deploy routes from the TS source (14 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/deploy")

	// --- Deployment Execution ---
	// POST /deploy - create a deployment
	f.POST("", auth.RequirePermission("deploy", "write"), h.Create)

	// --- Deployment Status ---
	// GET /deploy/:id - get deployment status
	f.GET("/:id", auth.RequirePermission("deploy", "read"), h.Get)

	// --- Deployment History ---
	// GET /deploy/history - list deployments
	f.GET("/history", auth.RequirePermission("deploy", "read"), h.List)
	// GET /deploy/latest/:appName/:environment - get latest deployment
	f.GET("/latest/:appName/:environment", auth.RequirePermission("deploy", "read"), h.GetLatest)

	// --- Deployment Metrics ---
	// GET /deploy/metrics - get deployment metrics
	f.GET("/metrics", auth.RequirePermission("deploy", "read"), h.GetMetrics)

	// --- Rollback ---
	// POST /deploy/:id/rollback - rollback a deployment
	f.POST("/:id/rollback", auth.RequirePermission("deploy", "write"), h.Rollback)
	// GET /deploy/:id/rollbacks - get rollback history
	f.GET("/:id/rollbacks", auth.RequirePermission("deploy", "read"), h.GetRollbackHistory)

	// --- Cancel ---
	// POST /deploy/:id/cancel - cancel a deployment
	// Mounted at top-level group to avoid conflict with /deploy/:id
	rg.POST("/deploy/:id/cancel", auth.RequirePermission("deploy", "write"), h.Cancel)

	// --- Audit Trail ---
	// GET /deploy/:id/audit - get deployment audit trail
	f.GET("/:id/audit", auth.RequirePermission("deploy", "read"), h.GetAuditTrail)

	// --- Release Notes ---
	// GET /deploy/:id/release-notes - get release notes
	f.GET("/:id/release-notes", auth.RequirePermission("deploy", "read"), h.GetReleaseNotes)
	// POST /deploy/:id/release-notes/generate - generate release notes
	f.POST("/:id/release-notes/generate", auth.RequirePermission("deploy", "write"), h.GenerateReleaseNotes)
	// GET /deploy/release-notes/tenant/:tenantId - get release notes by tenant
	rg.GET("/deploy/release-notes/tenant/:tenantId", auth.RequirePermission("deploy", "read"), h.GetReleaseNotesByTenant)

	// --- Git Integration ---
	// POST /deploy/:id/git/link - link a git commit
	f.POST("/:id/git/link", auth.RequirePermission("deploy", "write"), h.LinkGitCommit)
	// GET /deploy/:id/git/changelog - get deployment changelog
	f.GET("/:id/git/changelog", auth.RequirePermission("deploy", "read"), h.GetChangelog)
}

// Create handles POST /deploy.
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateDeploymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

// Get handles GET /:id.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "deployment not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

// List handles GET /history.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// GetLatest handles GET /latest/:appName/:environment.
func (h *Handler) GetLatest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetLatest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	appName := c.Param("appName")
	environment := c.Param("environment")
	m, err := h.svc.GetLatest(ctx, tenantID, appName, environment)
	if err != nil {
		middleware.RespondNotFound(c, "no deployment found")
		return
	}
	middleware.RespondSuccess(c, m)
}

// GetMetrics handles GET /metrics.
func (h *Handler) GetMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	metrics, err := h.svc.Metrics(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, metrics)
}

// Rollback handles POST /:id/rollback.
func (h *Handler) Rollback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Rollback")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rb, err := h.svc.Rollback(ctx, tenantID, id, req.TargetVersion, req.Reason)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, rb)
}

// GetRollbackHistory handles GET /:id/rollbacks.
func (h *Handler) GetRollbackHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRollbackHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	deploymentID := c.Param("id")
	items, err := h.svc.GetRollbackHistory(ctx, tenantID, deploymentID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// Cancel handles POST /:id/cancel.
func (h *Handler) Cancel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Cancel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Cancel(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deployment cancelled"})
}

// GetAuditTrail handles GET /:id/audit.
func (h *Handler) GetAuditTrail(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditTrail")
	defer span.End()
	deploymentID := c.Param("id")
	entries, err := h.svc.GetAuditTrail(ctx, deploymentID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, entries)
}

// GetReleaseNotes handles GET /:id/release-notes.
func (h *Handler) GetReleaseNotes(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReleaseNotes")
	defer span.End()
	deploymentID := c.Param("id")
	note, err := h.svc.GetReleaseNotes(ctx, deploymentID)
	if err != nil {
		middleware.RespondNotFound(c, "release notes not found")
		return
	}
	middleware.RespondSuccess(c, note)
}

// GenerateReleaseNotes handles POST /:id/release-notes/generate.
func (h *Handler) GenerateReleaseNotes(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GenerateReleaseNotes")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	deploymentID := c.Param("id")
	var req models.GenerateReleaseNotesRequest
	c.ShouldBindJSON(&req)
	note, err := h.svc.GenerateReleaseNotes(ctx, tenantID, deploymentID, req.Description)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, note)
}

// GetReleaseNotesByTenant handles GET /release-notes/tenant/:tenantId.
func (h *Handler) GetReleaseNotesByTenant(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReleaseNotesByTenant")
	defer span.End()
	tenantID := c.Param("tenantId")
	if tenantID == "" {
		tenantID = c.GetString("tenant_id")
	}
	notes, err := h.svc.GetReleaseNotesByTenant(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, notes)
}

// LinkGitCommit handles POST /:id/git/link.
func (h *Handler) LinkGitCommit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LinkGitCommit")
	defer span.End()
	deploymentID := c.Param("id")
	var req models.LinkGitCommitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.LinkGitCommit(ctx, deploymentID, req.CommitSHA, req.Branch); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "git commit linked"})
}

// GetChangelog handles GET /:id/git/changelog.
func (h *Handler) GetChangelog(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetChangelog")
	defer span.End()
	deploymentID := c.Param("id")
	entries, err := h.svc.GetDeploymentChangelog(ctx, deploymentID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, entries)
}
