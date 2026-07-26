package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/ci-cd-svc-go/internal/artifact-version/models"
	"orion/ci-cd-svc-go/internal/artifact-version/service"
	"orion/go-common/pkg/auth"
)

type ArtifactVersionHandler struct {
	svc *service.ArtifactVersionService
}

func NewArtifactVersionHandler(svc *service.ArtifactVersionService) *ArtifactVersionHandler {
	return &ArtifactVersionHandler{svc: svc}
}

func (h *ArtifactVersionHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
}

// RegisterRoutes registers artifact-version routes.
func (h *ArtifactVersionHandler) RegisterRoutes(rg *gin.RouterGroup) {
	versions := rg.Group("/artifact-versions")
	versions.GET("", auth.RequirePermission("ci-cd", "read"), h.ListVersions)
	versions.POST("", auth.RequirePermission("ci-cd", "write"), h.CreateVersion)
	versions.GET("/:id", auth.RequirePermission("ci-cd", "read"), h.GetVersion)
	versions.PATCH("/:id/deprecate", auth.RequirePermission("ci-cd", "write"), h.DeprecateVersion)
	versions.PATCH("/:id/archive", auth.RequirePermission("ci-cd", "write"), h.ArchiveVersion)
	versions.DELETE("/:id", auth.RequirePermission("ci-cd", "delete"), h.DeleteVersion)
}

// ListVersions returns paginated versions.
func (h *ArtifactVersionHandler) ListVersions(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	artifactID := c.Query("artifact_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryVersions(c.Request.Context(), tenantID, artifactID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": resp.Total, "data": resp.Data})
}

// CreateVersion creates a new version.
func (h *ArtifactVersionHandler) CreateVersion(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.CreateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	version, err := h.svc.CreateVersion(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "created", "data": version})
}

// GetVersion returns a version by ID.
func (h *ArtifactVersionHandler) GetVersion(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	version, err := h.svc.GetVersion(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": version})
}

// DeprecateVersion marks a version as deprecated.
func (h *ArtifactVersionHandler) DeprecateVersion(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	version, err := h.svc.DeprecateVersion(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": version})
}

// ArchiveVersion marks a version as archived.
func (h *ArtifactVersionHandler) ArchiveVersion(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	version, err := h.svc.ArchiveVersion(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": version})
}

// DeleteVersion removes a version.
func (h *ArtifactVersionHandler) DeleteVersion(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	if err := h.svc.DeleteVersion(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
