package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/config/models"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

// Service defines the contract the handler needs from the service layer (for testability).
type Service interface {
	Create(ctx context.Context, tenantID, userID string, req models.CreateConfigRequest) (*models.Config, error)
	Get(ctx context.Context, tenantID, id string) (*models.Config, error)
	List(ctx context.Context, tenantID string, filter models.ConfigFilter) (*models.ListResult[models.Config], error)
	Update(ctx context.Context, tenantID, id string, req models.UpdateConfigRequest) (*models.Config, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetVersions(ctx context.Context, tenantID, configID string) ([]models.ConfigVersion, error)
	Rollback(ctx context.Context, tenantID, configID, version, userID string) (*models.Config, error)
	Clone(ctx context.Context, tenantID, configID, userID string, req models.CloneConfigRequest) (*models.Config, error)
	GetAuditTrail(ctx context.Context, tenantID, configID string) ([]models.AuditEntry, error)
	GetDependencyGraph(ctx context.Context, tenantID, configID string) ([]models.DependencyNode, error)
	CreateSnapshot(ctx context.Context, tenantID, configID, userID string) (*models.ConfigSnapshot, error)
	ListSnapshots(ctx context.Context, tenantID, configID string) ([]models.ConfigSnapshot, error)
	GetSnapshot(ctx context.Context, tenantID, configID, snapshotID string) (*models.ConfigSnapshot, error)
	RestoreSnapshot(ctx context.Context, tenantID, configID, snapshotID, userID string) (*models.Config, error)
	DeleteSnapshot(ctx context.Context, tenantID, snapshotID string) error
	CompareVersions(ctx context.Context, tenantID, configID, versionFrom, versionTo string) (*models.VersionDiffResult, error)
	EnableGitOps(ctx context.Context, tenantID string, req models.CreateGitOpsRequest) (*models.GitOpsConfig, error)
	ListGitOpsConfigs(ctx context.Context, tenantID string) ([]models.GitOpsConfig, error)
	SyncFromGit(ctx context.Context, tenantID, gitOpsConfigID string) (*models.GitOpsSyncStatus, error)
	DisableGitOps(ctx context.Context, tenantID, gitOpsConfigID string) (*models.GitOpsConfig, error)
	DetectDrift(ctx context.Context, tenantID string) (any, error)
	GetSyncStatus(ctx context.Context, tenantID string) ([]models.GitOpsSyncStatus, error)
	CreateChangeRequest(ctx context.Context, tenantID, userID string, req models.CreateChangeRequestRequest) (*models.ChangeRequest, error)
	ListChangeRequests(ctx context.Context, tenantID string, status string, page, pageSize int) (*models.ListResult[models.ChangeRequest], error)
	GetChangeRequest(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error)
	ApproveChange(ctx context.Context, tenantID, id, approvedBy string) (*models.ChangeRequest, error)
	RejectChange(ctx context.Context, tenantID, id, approvedBy, reason string) (*models.ChangeRequest, error)
	CreateTemplate(ctx context.Context, tenantID, userID string, req models.CreateTemplateRequest) (*models.ConfigTemplate, error)
	ListTemplates(ctx context.Context, tenantID string) ([]models.ConfigTemplate, error)
	GetTemplate(ctx context.Context, tenantID, id string) (*models.ConfigTemplate, error)
	UpdateTemplate(ctx context.Context, tenantID, id string, req models.UpdateTemplateRequest) (*models.ConfigTemplate, error)
	DeleteTemplate(ctx context.Context, tenantID, id string) error
	CreateTemplateVersion(ctx context.Context, tenantID, templateID, userID string, version string) (*models.ConfigTemplateVersion, error)
	ListTemplateVersions(ctx context.Context, tenantID, templateID string) ([]models.ConfigTemplateVersion, error)
	CreateCanary(ctx context.Context, tenantID, userID string, req models.CreateCanaryRequest) (*models.CanaryDeployment, error)
	PromoteCanary(ctx context.Context, tenantID, id string) (*models.CanaryDeployment, error)
	RollbackCanary(ctx context.Context, tenantID, id string) (*models.CanaryDeployment, error)
	CompareEnvironments(ctx context.Context, tenantID, sourceEnv, targetEnv string) (*models.EnvironmentDiffResult, error)
	CreateWebhook(ctx context.Context, tenantID, userID string, req models.CreateWebhookRequest) (*models.ConfigWebhook, error)
	ListWebhooks(ctx context.Context, tenantID string) ([]models.ConfigWebhook, error)
	GetWebhook(ctx context.Context, tenantID, id string) (*models.ConfigWebhook, error)
	UpdateWebhook(ctx context.Context, tenantID, id string, req models.UpdateWebhookRequest) (*models.ConfigWebhook, error)
	DeleteWebhook(ctx context.Context, tenantID, id string) error
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	read := auth.RequirePermission("config", "read")
	write := auth.RequirePermission("config", "write")
	delete := auth.RequirePermission("config", "delete")
	manage := auth.RequirePermission("config", "manage")
	execute := auth.RequirePermission("config", "execute")
	approve := auth.RequirePermission("config", "approve")

	// ----- Config CRUD -----
	rg.POST("/configs", write, h.CreateConfig)
	rg.GET("/configs", read, h.ListConfigs)
	rg.GET("/configs/:configId", read, h.GetConfig)
	rg.PUT("/configs/:configId", write, h.UpdateConfig)
	rg.DELETE("/configs/:configId", delete, h.DeleteConfig)

	// ----- Config Versions -----
	rg.GET("/configs/:configId/versions", read, h.GetConfigVersions)
	rg.POST("/configs/:configId/rollback", manage, h.RollbackConfig)
	rg.POST("/configs/:configId/clone", write, h.CloneConfig)

	// ----- Config Audit -----
	rg.GET("/configs/:configId/audit", read, h.GetAuditTrail)
	rg.GET("/configs/:configId/dependencies", read, h.GetDependencyGraph)

	// ----- Config Snapshots -----
	rg.POST("/configs/:configId/snapshots", write, h.CreateSnapshot)
	rg.GET("/configs/:configId/snapshots", read, h.ListSnapshots)
	rg.GET("/configs/:configId/snapshots/:snapshotId", read, h.GetSnapshot)
	rg.POST("/configs/:configId/snapshots/:snapshotId/restore", manage, h.RestoreSnapshot)
	rg.DELETE("/configs/:configId/snapshots/:snapshotId", delete, h.DeleteSnapshot)

	// ----- Version Diff -----
	rg.GET("/configs/:configId/versions/diff", read, h.CompareVersions)

	// ----- GitOps -----
	rg.POST("/gitops", manage, h.EnableGitOps)
	rg.GET("/gitops", read, h.ListGitOpsConfigs)
	rg.POST("/gitops/:gitOpsConfigId/sync", execute, h.SyncFromGit)
	rg.POST("/gitops/:gitOpsConfigId/disable", manage, h.DisableGitOps)
	rg.GET("/gitops/drift", read, h.DetectDrift)
	rg.GET("/gitops/sync-status", read, h.GetSyncStatus)

	// ----- Change Requests -----
	rg.POST("/change-requests", write, h.CreateChangeRequest)
	rg.GET("/change-requests", read, h.ListChangeRequests)
	rg.GET("/change-requests/:changeRequestId", read, h.GetChangeRequest)
	rg.POST("/change-requests/:changeRequestId/approve", approve, h.ApproveChange)
	rg.POST("/change-requests/:changeRequestId/reject", approve, h.RejectChange)

	// ----- Templates -----
	rg.POST("/templates", write, h.CreateTemplate)
	rg.GET("/templates", read, h.ListTemplates)
	rg.GET("/templates/:id", read, h.GetTemplate)
	rg.PUT("/templates/:id", write, h.UpdateTemplate)
	rg.DELETE("/templates/:id", delete, h.DeleteTemplate)
	rg.POST("/templates/:id/versions", write, h.CreateTemplateVersion)
	rg.GET("/templates/:id/versions", read, h.ListTemplateVersions)

	// ----- Canary -----
	rg.POST("/canary", write, h.CreateCanary)
	rg.POST("/canary/:id/promote", manage, h.PromoteCanary)
	rg.POST("/canary/:id/rollback", manage, h.RollbackCanary)

	// ----- Diff -----
	rg.GET("/diff/:sourceEnv/:targetEnv", read, h.CompareEnvironments)

	// ----- Webhooks -----
	rg.POST("/webhooks", write, h.CreateWebhook)
	rg.GET("/webhooks", read, h.ListWebhooks)
	rg.GET("/webhooks/:id", read, h.GetWebhook)
	rg.PUT("/webhooks/:id", write, h.UpdateWebhook)
	rg.DELETE("/webhooks/:id", delete, h.DeleteWebhook)
}

// ---------- Config CRUD ----------

func (h *Handler) CreateConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.Create(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, cfg)
}

func (h *Handler) ListConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	filter := models.ConfigFilter{
		Environment: c.Query("environment"),
		Status:      c.Query("status"),
		Search:      c.Query("search"),
		Page:        toInt(c.DefaultQuery("page", "0")),
		PageSize:    toInt(c.DefaultQuery("pageSize", "20")),
	}
	result, err := h.svc.List(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) GetConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	cfg, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cfg)
}

func (h *Handler) UpdateConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	var req models.UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cfg)
}

func (h *Handler) DeleteConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "config deleted"})
}

// ---------- Config Versions ----------

func (h *Handler) GetConfigVersions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetConfigVersions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	versions, err := h.svc.GetVersions(ctx, tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": versions, "total": len(versions)})
}

func (h *Handler) RollbackConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RollbackConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("configId")
	var req models.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.Rollback(ctx, tenantID, id, req.Version, userID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": cfg, "message": "rollback complete"})
}

func (h *Handler) CloneConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CloneConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("configId")
	var req models.CloneConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.Clone(ctx, tenantID, id, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, cfg)
}

// ---------- Audit ----------

func (h *Handler) GetAuditTrail(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditTrail")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	entries, err := h.svc.GetAuditTrail(ctx, tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": entries, "total": len(entries)})
}

func (h *Handler) GetDependencyGraph(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDependencyGraph")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	nodes, err := h.svc.GetDependencyGraph(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": nodes})
}

// ---------- Snapshots ----------

func (h *Handler) CreateSnapshot(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSnapshot")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("configId")
	snap, err := h.svc.CreateSnapshot(ctx, tenantID, id, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, snap)
}

func (h *Handler) ListSnapshots(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSnapshots")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	snaps, err := h.svc.ListSnapshots(ctx, tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": snaps, "total": len(snaps)})
}

func (h *Handler) GetSnapshot(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSnapshot")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	snapshotID := c.Param("snapshotId")
	snap, err := h.svc.GetSnapshot(ctx, tenantID, id, snapshotID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, snap)
}

func (h *Handler) RestoreSnapshot(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RestoreSnapshot")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("configId")
	snapshotID := c.Param("snapshotId")
	cfg, err := h.svc.RestoreSnapshot(ctx, tenantID, id, snapshotID, userID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": cfg, "message": "snapshot restored"})
}

func (h *Handler) DeleteSnapshot(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteSnapshot")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	snapshotID := c.Param("snapshotId")
	if err := h.svc.DeleteSnapshot(ctx, tenantID, snapshotID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "snapshot deleted"})
}

// ---------- Version Diff ----------

func (h *Handler) CompareVersions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CompareVersions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	versionFrom := c.Query("versionFrom")
	versionTo := c.Query("versionTo")
	result, err := h.svc.CompareVersions(ctx, tenantID, id, versionFrom, versionTo)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---------- GitOps ----------

func (h *Handler) EnableGitOps(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EnableGitOps")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateGitOpsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	gitOps, err := h.svc.EnableGitOps(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gitOps)
}

func (h *Handler) ListGitOpsConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListGitOpsConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListGitOpsConfigs(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) SyncFromGit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SyncFromGit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("gitOpsConfigId")
	sync, err := h.svc.SyncFromGit(ctx, tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": sync, "message": "sync triggered"})
}

func (h *Handler) DisableGitOps(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DisableGitOps")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("gitOpsConfigId")
	cfg, err := h.svc.DisableGitOps(ctx, tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": cfg, "message": "gitops disabled"})
}

func (h *Handler) DetectDrift(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DetectDrift")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.DetectDrift(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetSyncStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSyncStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status, err := h.svc.GetSyncStatus(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": status, "total": len(status)})
}

// ---------- Change Requests ----------

func (h *Handler) CreateChangeRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateChangeRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cr, err := h.svc.CreateChangeRequest(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, cr)
}

func (h *Handler) ListChangeRequests(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListChangeRequests")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	page := toInt(c.DefaultQuery("page", "0"))
	pageSize := toInt(c.DefaultQuery("pageSize", "20"))
	result, err := h.svc.ListChangeRequests(ctx, tenantID, status, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) GetChangeRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetChangeRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("changeRequestId")
	cr, err := h.svc.GetChangeRequest(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cr)
}

func (h *Handler) ApproveChange(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApproveChange")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("changeRequestId")
	cr, err := h.svc.ApproveChange(ctx, tenantID, id, userID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": cr, "message": "change approved"})
}

func (h *Handler) RejectChange(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RejectChange")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("changeRequestId")
	var req models.ChangeApprovalRequest
	c.ShouldBindJSON(&req)
	cr, err := h.svc.RejectChange(ctx, tenantID, id, userID, req.Reason)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": cr, "message": "change rejected"})
}

// ---------- Templates ----------

func (h *Handler) CreateTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTemplate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tmpl, err := h.svc.CreateTemplate(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, tmpl)
}

func (h *Handler) ListTemplates(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTemplates")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	tmpls, err := h.svc.ListTemplates(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tmpls)
}

func (h *Handler) GetTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTemplate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	tmpl, err := h.svc.GetTemplate(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tmpl)
}

func (h *Handler) UpdateTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateTemplate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tmpl, err := h.svc.UpdateTemplate(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tmpl)
}

func (h *Handler) DeleteTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteTemplate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteTemplate(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "template deleted"})
}

func (h *Handler) CreateTemplateVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTemplateVersion")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("id")
	var req struct {
		Version string `json:"version" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ver, err := h.svc.CreateTemplateVersion(ctx, tenantID, id, userID, req.Version)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ver)
}

func (h *Handler) ListTemplateVersions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTemplateVersions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	versions, err := h.svc.ListTemplateVersions(ctx, tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": versions, "total": len(versions)})
}

// ---------- Canary ----------

func (h *Handler) CreateCanary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateCanary")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateCanaryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	canary, err := h.svc.CreateCanary(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, canary)
}

func (h *Handler) PromoteCanary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PromoteCanary")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	canary, err := h.svc.PromoteCanary(ctx, tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": canary, "message": "canary promoted"})
}

func (h *Handler) RollbackCanary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RollbackCanary")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	canary, err := h.svc.RollbackCanary(ctx, tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": canary, "message": "canary rolled back"})
}

// ---------- Diff ----------

func (h *Handler) CompareEnvironments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CompareEnvironments")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	sourceEnv := c.Param("sourceEnv")
	targetEnv := c.Param("targetEnv")
	result, err := h.svc.CompareEnvironments(ctx, tenantID, sourceEnv, targetEnv)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---------- Webhooks ----------

func (h *Handler) CreateWebhook(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateWebhook")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	webhook, err := h.svc.CreateWebhook(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, webhook)
}

func (h *Handler) ListWebhooks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListWebhooks")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListWebhooks(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetWebhook(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetWebhook")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	w, err := h.svc.GetWebhook(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, w)
}

func (h *Handler) UpdateWebhook(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateWebhook")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	w, err := h.svc.UpdateWebhook(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, w)
}

func (h *Handler) DeleteWebhook(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteWebhook")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteWebhook(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "webhook deleted"})
}

// ---------- Helpers ----------

func toInt(v string) int {
	i, _ := strconv.Atoi(v)
	return i
}
