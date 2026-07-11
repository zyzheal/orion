package handler

import (
	"net/http"
	"strconv"
	"strings"

	"orion-deploy-svc-go/internal/models"
	"orion-deploy-svc-go/internal/service"

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
		d.POST("/", h.Deploy)
		d.GET("/", h.GetHistory)
		d.GET("/latest/:appName/:env", h.GetLatest)
		d.GET("/metrics", h.GetMetrics)

		d.GET("/:id", h.GetStatus)
		d.PUT("/:id", h.UpdateStatus)
		d.DELETE("/:id", h.Cancel)

		d.POST("/:id/rollback", h.Rollback)
		d.GET("/:id/rollback", h.GetRollbackHistory)
		d.GET("/:id/audit", h.GetAuditTrail)

		// Release notes
		d.GET("/release-notes", h.ListReleaseNotes)
		d.POST("/release-notes", h.CreateReleaseNote)
		d.GET("/release-notes/:id", h.GetReleaseNote)
		d.PUT("/release-notes/:id", h.UpdateReleaseNote)
		d.DELETE("/release-notes/:id", h.DeleteReleaseNote)
	}
}

func (h *DeployHandler) Deploy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id is required"})
		return
	}
	var req models.DeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	actor := c.GetString("user_id")
	d, err := h.svc.Deploy(c.Request.Context(), tenantID, &req, actor)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": d})
}

func (h *DeployHandler) GetStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	d, err := h.svc.GetStatus(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": d})
}

func (h *DeployHandler) GetHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id is required"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *DeployHandler) GetLatest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	appName := c.Param("appName")
	env := c.Param("env")
	d, err := h.svc.GetLatest(c.Request.Context(), tenantID, appName, env)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": d})
}

func (h *DeployHandler) GetMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	m, err := h.svc.GetMetrics(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": m})
}

func (h *DeployHandler) UpdateStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateDeployStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	// Validate allowed status transitions
	allowed := map[string]bool{"running": true, "success": true, "failed": true, "cancelled": true}
	if !allowed[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}
	d, err := h.svc.UpdateStatus(c.Request.Context(), tenantID, id, req.Status, "")
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": d})
}

func (h *DeployHandler) Cancel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	actor := c.GetString("user_id")
	if err := h.svc.Cancel(c.Request.Context(), tenantID, id, actor); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deployment cancelled"})
}

func (h *DeployHandler) Rollback(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	actor := c.GetString("user_id")
	var req models.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	d, err := h.svc.Rollback(c.Request.Context(), tenantID, id, req.Reason, actor)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": d})
}

func (h *DeployHandler) GetRollbackHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	records, err := h.svc.GetRollbackHistory(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": records})
}

func (h *DeployHandler) GetAuditTrail(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	events, err := h.svc.GetAuditTrail(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": events})
}

// Release notes handlers
func (h *DeployHandler) ListReleaseNotes(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id is required"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	tag := c.Query("tag")
	notes, total, err := h.rns.List(c.Request.Context(), tenantID, page, pageSize, tag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": notes, "total": total})
}

func (h *DeployHandler) CreateReleaseNote(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id is required"})
		return
	}
	var req models.CreateReleaseNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	note, err := h.rns.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": note})
}

func (h *DeployHandler) GetReleaseNote(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	note, err := h.rns.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "release note not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": note})
}

func (h *DeployHandler) UpdateReleaseNote(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateReleaseNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	updates := make(map[string]interface{})
	if req.Content != "" {
		updates["content"] = req.Content
	}
	note, err := h.rns.Update(c.Request.Context(), tenantID, id, updates)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "release note not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": note})
}

func (h *DeployHandler) DeleteReleaseNote(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.rns.Delete(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "release note not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "release note deleted"})
}

// resolveAppName extracts app name from query or path
func resolveAppName(c *gin.Context) string {
	appName := c.Query("app_name")
	if appName == "" {
		appName = strings.TrimPrefix(c.Query("app"), "/")
	}
	return appName
}
