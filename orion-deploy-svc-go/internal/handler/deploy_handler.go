package handler

import (
	"strconv"
	"strings"

	"orion-deploy-svc-go/internal/models"
	"orion-deploy-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// DeployHandler handles deployment API requests.
type DeployHandler struct {
	svc *service.DeployService
	rns *service.ReleaseNotesService
}

func NewDeployHandler(svc *service.DeployService, rns *service.ReleaseNotesService) *DeployHandler {
	return &DeployHandler{svc: svc, rns: rns}
}

// RegisterRoutes registers all deployment routes.
func (h *DeployHandler) RegisterRoutes(rg *gin.RouterGroup) {
	d := rg.Group("/deploy")
	{
		d.POST("/", auth.RequirePermission("deploy", "write"), h.Deploy)
		d.GET("/", auth.RequirePermission("deploy", "read"), h.GetHistory)
		d.GET("/latest/:appName/:env", auth.RequirePermission("deploy", "read"), h.GetLatest)
		d.GET("/metrics", auth.RequirePermission("deploy", "read"), h.GetMetrics)

		d.GET("/:id", auth.RequirePermission("deploy", "read"), h.GetStatus)
		d.PUT("/:id", auth.RequirePermission("deploy", "write"), h.UpdateStatus)
		d.DELETE("/:id", auth.RequirePermission("deploy", "delete"), h.Cancel)

		d.POST("/:id/rollback", auth.RequirePermission("deploy", "write"), h.Rollback)
		d.GET("/:id/rollback", auth.RequirePermission("deploy", "read"), h.GetRollbackHistory)
		d.GET("/:id/audit", auth.RequirePermission("deploy", "read"), h.GetAuditTrail)

		// Release notes
		d.GET("/release-notes", auth.RequirePermission("deploy", "read"), h.ListReleaseNotes)
		d.POST("/release-notes", auth.RequirePermission("deploy", "write"), h.CreateReleaseNote)
		d.GET("/release-notes/:id", auth.RequirePermission("deploy", "read"), h.GetReleaseNote)
		d.PUT("/release-notes/:id", auth.RequirePermission("deploy", "write"), h.UpdateReleaseNote)
		d.DELETE("/release-notes/:id", auth.RequirePermission("deploy", "delete"), h.DeleteReleaseNote)
	}
}

func (h *DeployHandler) Deploy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	var req models.DeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "invalid request body")
		return
	}
	actor := c.GetString("user_id")
	d, err := h.svc.Deploy(c.Request.Context(), tenantID, &req, actor)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *DeployHandler) GetStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	d, err := h.svc.GetStatus(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *DeployHandler) GetHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	appName := c.Query("appName")
	environment := c.Query("environment")
	status := c.Query("status")
	orderBy := c.Query("orderBy")
	order := c.DefaultQuery("order", "desc")

	q := models.ListDeployQuery{
		Page:     page,
		PageSize: pageSize,
		AppName:  appName,
		Environment: environment,
		Status:   status,
		OrderBy:  orderBy,
		Order:    order,
	}
	items, total, err := h.svc.GetHistory(c.Request.Context(), tenantID, q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"items": items, "total": total})
}

func (h *DeployHandler) GetLatest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	appName := c.Param("appName")
	env := c.Param("env")
	d, err := h.svc.GetLatest(c.Request.Context(), tenantID, appName, env)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *DeployHandler) GetMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	m, err := h.svc.GetMetrics(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *DeployHandler) UpdateStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateDeployStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "invalid request body")
		return
	}
	// Validate allowed status transitions
	allowed := map[string]bool{"running": true, "success": true, "failed": true, "cancelled": true}
	if !allowed[req.Status] {
		respondBadRequest(c, "invalid status")
		return
	}
	d, err := h.svc.UpdateStatus(c.Request.Context(), tenantID, id, req.Status, "")
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *DeployHandler) Cancel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	actor := c.GetString("user_id")
	if err := h.svc.Cancel(c.Request.Context(), tenantID, id, actor); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deployment cancelled"})
}

func (h *DeployHandler) Rollback(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	actor := c.GetString("user_id")
	var req models.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "invalid request body")
		return
	}
	d, err := h.svc.Rollback(c.Request.Context(), tenantID, id, req.Reason, actor)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *DeployHandler) GetRollbackHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	records, err := h.svc.GetRollbackHistory(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, records)
}

func (h *DeployHandler) GetAuditTrail(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	events, err := h.svc.GetAuditTrail(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, events)
}

// Release notes handlers
func (h *DeployHandler) ListReleaseNotes(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	tag := c.Query("tag")
	notes, total, err := h.rns.List(c.Request.Context(), tenantID, page, pageSize, tag)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"notes": notes, "total": total})
}

func (h *DeployHandler) CreateReleaseNote(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	var req models.CreateReleaseNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "invalid request body")
		return
	}
	note, err := h.rns.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, note)
}

func (h *DeployHandler) GetReleaseNote(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	note, err := h.rns.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "release note not found")
		return
	}
	respondSuccess(c, note)
}

func (h *DeployHandler) UpdateReleaseNote(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateReleaseNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "invalid request body")
		return
	}
	updates := make(map[string]interface{})
	if req.Content != "" {
		updates["content"] = req.Content
	}
	note, err := h.rns.Update(c.Request.Context(), tenantID, id, updates)
	if err != nil {
		respondNotFound(c, "release note not found")
		return
	}
	respondSuccess(c, note)
}

func (h *DeployHandler) DeleteReleaseNote(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.rns.Delete(c.Request.Context(), tenantID, id); err != nil {
		respondNotFound(c, "release note not found")
		return
	}
	respondSuccess(c, map[string]any{"message": "release note deleted"})
}

// resolveAppName extracts app name from query or path
func resolveAppName(c *gin.Context) string {
	appName := c.Query("app_name")
	if appName == "" {
		appName = strings.TrimPrefix(c.Query("app"), "/")
	}
	return appName
}
