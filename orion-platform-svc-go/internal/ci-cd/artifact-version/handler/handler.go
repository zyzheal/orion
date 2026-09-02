package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ci-cd/artifact-version/models"
	"orion/platform-svc-go/internal/ci-cd/artifact-version/service"
	"orion/platform-svc-go/internal/middleware"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionListVersions")
	defer span.End()
	tenantID := h.GetTenantID(c)
	artifactID := c.Query("artifact_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryVersions(ctx, tenantID, artifactID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"total": resp.Total, "data": resp.Data})
}

// CreateVersion creates a new version.
func (h *ArtifactVersionHandler) CreateVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionCreateVersion")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.CreateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	version, err := h.svc.CreateVersion(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "created", "data": version})
}

// GetVersion returns a version by ID.
func (h *ArtifactVersionHandler) GetVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionGetVersion")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	version, err := h.svc.GetVersion(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": version})
}

// DeprecateVersion marks a version as deprecated.
func (h *ArtifactVersionHandler) DeprecateVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionDeprecateVersion")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	version, err := h.svc.DeprecateVersion(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": version})
}

// ArchiveVersion marks a version as archived.
func (h *ArtifactVersionHandler) ArchiveVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionArchiveVersion")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	version, err := h.svc.ArchiveVersion(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": version})
}

// DeleteVersion removes a version.
func (h *ArtifactVersionHandler) DeleteVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionDeleteVersion")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	if err := h.svc.DeleteVersion(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}
