package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/artifact-lifecycle/models"
	"orion/platform-svc-go/internal/artifact-lifecycle/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
r := rg.Group("/artifact-lifecycle")
	r.GET("", auth.RequirePermission("artifact-lifecycle", "read"), h.ListLifecycle)
	r.GET("/:artifactId", auth.RequirePermission("artifact-lifecycle", "read"), h.GetLifecycle)
	r.POST("", auth.RequirePermission("artifact-lifecycle", "write"), h.CreateLifecycle)
	r.PUT("/:id/stage", auth.RequirePermission("artifact-lifecycle", "write"), h.AdvanceStage)
	r.DELETE("/:id", auth.RequirePermission("artifact-lifecycle", "delete"), h.DeleteLifecycle)
	r.GET("/stages", auth.RequirePermission("artifact-lifecycle", "read"), h.GetStageHistory)
	r.PUT("/:id/archive", auth.RequirePermission("artifact-lifecycle", "write"), h.ArchiveArtifact)
}

func (h *Handler) AdvanceStage(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.AdvanceStageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.AdvanceStage(ctx, tenantID, id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
c.JSON(http.StatusOK, result)
}

func (h *Handler) ArchiveArtifact(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.Archive(ctx, tenantID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) CreateLifecycle(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	var req models.CreateArtifactLifecycleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (h *Handler) DeleteLifecycle(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

func (h *Handler) GetLifecycle(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	artifactID := c.Param("artifactId")
	result, err := h.svc.GetByArtifactID(ctx, tenantID, artifactID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetStageHistory(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	artifactID := c.Query("artifactId")
	result, err := h.svc.GetStageHistory(ctx, tenantID, artifactID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) ListLifecycle(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
result, err := h.svc.List(ctx, tenantID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}
