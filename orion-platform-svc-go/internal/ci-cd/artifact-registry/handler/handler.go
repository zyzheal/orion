package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ci-cd/artifact-registry/models"
	"orion/platform-svc-go/internal/ci-cd/artifact-registry/service"
	"orion/go-common/pkg/auth"
)

type ArtifactRegistryHandler struct {
	svc *service.ArtifactRegistryService
}

func NewArtifactRegistryHandler(svc *service.ArtifactRegistryService) *ArtifactRegistryHandler {
	return &ArtifactRegistryHandler{svc: svc}
}

func (h *ArtifactRegistryHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
}

// RegisterRoutes registers artifact-registry routes.
func (h *ArtifactRegistryHandler) RegisterRoutes(rg *gin.RouterGroup) {
	registries := rg.Group("/artifact-registries")
	registries.GET("", auth.RequirePermission("ci-cd", "read"), h.ListRegistries)
	registries.POST("", auth.RequirePermission("ci-cd", "write"), h.CreateRegistry)
	registries.GET("/:id", auth.RequirePermission("ci-cd", "read"), h.GetRegistry)
	registries.DELETE("/:id", auth.RequirePermission("ci-cd", "delete"), h.DeleteRegistry)

	artifacts := rg.Group("/artifact-registries/:registry_id/artifacts")
	artifacts.GET("", auth.RequirePermission("ci-cd", "read"), h.ListArtifacts)
	artifacts.POST("", auth.RequirePermission("ci-cd", "write"), h.PushArtifact)
	artifacts.DELETE("/:artifact_id", auth.RequirePermission("ci-cd", "delete"), h.DeleteArtifact)
}

// ListRegistries returns paginated registries.
func (h *ArtifactRegistryHandler) ListRegistries(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryRegistries(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": resp.Total, "data": resp.Data})
}

// CreateRegistry creates a new registry.
func (h *ArtifactRegistryHandler) CreateRegistry(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.CreateRegistryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	reg, err := h.svc.CreateRegistry(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "created", "data": reg})
}

// GetRegistry returns a registry by ID.
func (h *ArtifactRegistryHandler) GetRegistry(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	reg, err := h.svc.GetRegistry(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": reg})
}

// DeleteRegistry removes a registry.
func (h *ArtifactRegistryHandler) DeleteRegistry(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	if err := h.svc.DeleteRegistry(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// ListArtifacts returns paginated artifacts.
func (h *ArtifactRegistryHandler) ListArtifacts(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	registryID := c.Param("registry_id")
	name := c.Query("name")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	Offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryArtifacts(c.Request.Context(), tenantID, registryID, name, limit, Offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": resp.Total, "data": resp.Data})
}

// PushArtifact pushes an artifact.
func (h *ArtifactRegistryHandler) PushArtifact(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.PushArtifactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	art, err := h.svc.PushArtifact(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "pushed", "data": art})
}

// DeleteArtifact removes an artifact.
func (h *ArtifactRegistryHandler) DeleteArtifact(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	artifactID := c.Param("artifact_id")

	if err := h.svc.DeleteArtifact(c.Request.Context(), tenantID, artifactID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
