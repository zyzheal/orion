package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/config/models"
	"orion/platform-svc-go/internal/config/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
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
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.Create(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, cfg)
}

func (h *Handler) ListConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	filter := models.ConfigFilter{
		Environment: c.Query("environment"),
		Status:      c.Query("status"),
		Search:      c.Query("search"),
		Page:        toInt(c.DefaultQuery("page", "0")),
		PageSize:    toInt(c.DefaultQuery("pageSize", "20")),
	}
	result, err := h.svc.List(c.Request.Context(), tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) GetConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	cfg, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cfg)
}

func (h *Handler) UpdateConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	var req models.UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.Update(c.Request.Context(), tenantID, id, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cfg)
}

func (h *Handler) DeleteConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "config deleted"})
}

// ---------- Config Versions ----------

func (h *Handler) GetConfigVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	versions, err := h.svc.GetVersions(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": versions, "total": len(versions)})
}

func (h *Handler) RollbackConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("configId")
	var req models.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.Rollback(c.Request.Context(), tenantID, id, req.Version, userID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": cfg, "message": "rollback complete"})
}

func (h *Handler) CloneConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("configId")
	var req models.CloneConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.Clone(c.Request.Context(), tenantID, id, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, cfg)
}

// ---------- Audit ----------

func (h *Handler) GetAuditTrail(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	entries, err := h.svc.GetAuditTrail(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": entries, "total": len(entries)})
}

func (h *Handler) GetDependencyGraph(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	nodes, err := h.svc.GetDependencyGraph(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": nodes})
}

// ---------- Snapshots ----------

func (h *Handler) CreateSnapshot(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("configId")
	snap, err := h.svc.CreateSnapshot(c.Request.Context(), tenantID, id, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, snap)
}

func (h *Handler) ListSnapshots(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	snaps, err := h.svc.ListSnapshots(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": snaps, "total": len(snaps)})
}

func (h *Handler) GetSnapshot(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	snapshotID := c.Param("snapshotId")
	snap, err := h.svc.GetSnapshot(c.Request.Context(), tenantID, id, snapshotID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, snap)
}

func (h *Handler) RestoreSnapshot(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("configId")
	snapshotID := c.Param("snapshotId")
	cfg, err := h.svc.RestoreSnapshot(c.Request.Context(), tenantID, id, snapshotID, userID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": cfg, "message": "snapshot restored"})
}

func (h *Handler) DeleteSnapshot(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	snapshotID := c.Param("snapshotId")
	if err := h.svc.DeleteSnapshot(c.Request.Context(), tenantID, snapshotID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "snapshot deleted"})
}

// ---------- Version Diff ----------

func (h *Handler) CompareVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("configId")
	versionFrom := c.Query("versionFrom")
	versionTo := c.Query("versionTo")
	result, err := h.svc.CompareVersions(c.Request.Context(), tenantID, id, versionFrom, versionTo)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---------- GitOps ----------

func (h *Handler) EnableGitOps(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateGitOpsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	gitOps, err := h.svc.EnableGitOps(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gitOps)
}

func (h *Handler) ListGitOpsConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListGitOpsConfigs(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) SyncFromGit(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("gitOpsConfigId")
	sync, err := h.svc.SyncFromGit(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": sync, "message": "sync triggered"})
}

func (h *Handler) DisableGitOps(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("gitOpsConfigId")
	cfg, err := h.svc.DisableGitOps(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": cfg, "message": "gitops disabled"})
}

func (h *Handler) DetectDrift(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.DetectDrift(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetSyncStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	status, err := h.svc.GetSyncStatus(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": status, "total": len(status)})
}

// ---------- Change Requests ----------

func (h *Handler) CreateChangeRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cr, err := h.svc.CreateChangeRequest(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, cr)
}

func (h *Handler) ListChangeRequests(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	page := toInt(c.DefaultQuery("page", "0"))
	pageSize := toInt(c.DefaultQuery("pageSize", "20"))
	result, err := h.svc.ListChangeRequests(c.Request.Context(), tenantID, status, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) GetChangeRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("changeRequestId")
	cr, err := h.svc.GetChangeRequest(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cr)
}

func (h *Handler) ApproveChange(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("changeRequestId")
	cr, err := h.svc.ApproveChange(c.Request.Context(), tenantID, id, userID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": cr, "message": "change approved"})
}

func (h *Handler) RejectChange(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("changeRequestId")
	var req models.ChangeApprovalRequest
	c.ShouldBindJSON(&req)
	cr, err := h.svc.RejectChange(c.Request.Context(), tenantID, id, userID, req.Reason)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": cr, "message": "change rejected"})
}

// ---------- Templates ----------

func (h *Handler) CreateTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tmpl, err := h.svc.CreateTemplate(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, tmpl)
}

func (h *Handler) ListTemplates(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	tmpls, err := h.svc.ListTemplates(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tmpls)
}

func (h *Handler) GetTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	tmpl, err := h.svc.GetTemplate(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tmpl)
}

func (h *Handler) UpdateTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tmpl, err := h.svc.UpdateTemplate(c.Request.Context(), tenantID, id, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tmpl)
}

func (h *Handler) DeleteTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteTemplate(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "template deleted"})
}

func (h *Handler) CreateTemplateVersion(c *gin.Context) {
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
	ver, err := h.svc.CreateTemplateVersion(c.Request.Context(), tenantID, id, userID, req.Version)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ver)
}

func (h *Handler) ListTemplateVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	versions, err := h.svc.ListTemplateVersions(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": versions, "total": len(versions)})
}

// ---------- Canary ----------

func (h *Handler) CreateCanary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateCanaryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	canary, err := h.svc.CreateCanary(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, canary)
}

func (h *Handler) PromoteCanary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	canary, err := h.svc.PromoteCanary(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": canary, "message": "canary promoted"})
}

func (h *Handler) RollbackCanary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	canary, err := h.svc.RollbackCanary(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": canary, "message": "canary rolled back"})
}

// ---------- Diff ----------

func (h *Handler) CompareEnvironments(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	sourceEnv := c.Param("sourceEnv")
	targetEnv := c.Param("targetEnv")
	result, err := h.svc.CompareEnvironments(c.Request.Context(), tenantID, sourceEnv, targetEnv)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---------- Webhooks ----------

func (h *Handler) CreateWebhook(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	webhook, err := h.svc.CreateWebhook(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, webhook)
}

func (h *Handler) ListWebhooks(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListWebhooks(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetWebhook(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	w, err := h.svc.GetWebhook(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, w)
}

func (h *Handler) UpdateWebhook(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	w, err := h.svc.UpdateWebhook(c.Request.Context(), tenantID, id, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, w)
}

func (h *Handler) DeleteWebhook(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteWebhook(c.Request.Context(), tenantID, id); err != nil {
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
