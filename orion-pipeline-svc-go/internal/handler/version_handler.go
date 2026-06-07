package handler

import (
	"net/http"

	"orion/pipeline-svc-go/internal/models"
	"orion/pipeline-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

type VersionHandler struct {
	svc *service.VersionService
}

func NewVersionHandler(svc *service.VersionService) *VersionHandler {
	return &VersionHandler{svc: svc}
}

func (h *VersionHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	var req models.CreateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	version, err := h.svc.Create(c.Request.Context(), tenantID, pipelineID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, version)
}

func (h *VersionHandler) List(c *gin.Context) {
	pipelineID := c.Param("pipelineId")

	versions, err := h.svc.List(c.Request.Context(), pipelineID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": versions})
}

func (h *VersionHandler) GetByID(c *gin.Context) {
	version, err := h.svc.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "version not found"})
		return
	}

	c.JSON(http.StatusOK, version)
}

func (h *VersionHandler) GetActive(c *gin.Context) {
	pipelineID := c.Param("pipelineId")

	version, err := h.svc.GetActive(c.Request.Context(), pipelineID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no active version"})
		return
	}

	c.JSON(http.StatusOK, version)
}

func (h *VersionHandler) Rollback(c *gin.Context) {
	pipelineID := c.Param("pipelineId")
	versionID := c.Param("id")

	if err := h.svc.Rollback(c.Request.Context(), pipelineID, versionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "rolled back"})
}

func (h *VersionHandler) RegisterRoutes(rg *gin.RouterGroup) {
	versions := rg.Group("/pipelines/:pipelineId/versions")
	{
		versions.POST("", h.Create)
		versions.GET("", h.List)
		versions.GET("/active", h.GetActive)
		versions.GET("/:id", h.GetByID)
		versions.POST("/:id/rollback", h.Rollback)
	}
}
