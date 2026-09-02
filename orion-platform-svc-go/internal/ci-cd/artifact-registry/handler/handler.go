package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ci-cd/artifact-registry/models"
	"orion/platform-svc-go/internal/ci-cd/artifact-registry/service"
	"orion/platform-svc-go/internal/middleware"
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

	artifacts := rg.Group("/artifact-registries/:id/artifacts")
	artifacts.GET("", auth.RequirePermission("ci-cd", "read"), h.ListArtifacts)
	artifacts.POST("", auth.RequirePermission("ci-cd", "write"), h.PushArtifact)
	artifacts.DELETE("/:artifact_id", auth.RequirePermission("ci-cd", "delete"), h.DeleteArtifact)
}

// ListRegistries returns paginated registries.
func (h *ArtifactRegistryHandler) ListRegistries(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactRegistryListRegistries")
	defer span.End()
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryRegistries(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"total": resp.Total, "data": resp.Data})
}

// CreateRegistry creates a new registry.
func (h *ArtifactRegistryHandler) CreateRegistry(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactRegistryCreateRegistry")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.CreateRegistryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	reg, err := h.svc.CreateRegistry(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, reg)
}

// GetRegistry returns a registry by ID.
func (h *ArtifactRegistryHandler) GetRegistry(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactRegistryGetRegistry")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	reg, err := h.svc.GetRegistry(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, reg)
}

// DeleteRegistry removes a registry.
func (h *ArtifactRegistryHandler) DeleteRegistry(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactRegistryDeleteRegistry")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	if err := h.svc.DeleteRegistry(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

// ListArtifacts returns paginated artifacts.
func (h *ArtifactRegistryHandler) ListArtifacts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactRegistryListArtifacts")
	defer span.End()
	tenantID := h.GetTenantID(c)
	registryID := c.Param("id")
	name := c.Query("name")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	Offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryArtifacts(ctx, tenantID, registryID, name, limit, Offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"total": resp.Total, "data": resp.Data})
}

// PushArtifact pushes an artifact.
func (h *ArtifactRegistryHandler) PushArtifact(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactRegistryPushArtifact")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.PushArtifactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	art, err := h.svc.PushArtifact(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "pushed", "data": art})
}

// DeleteArtifact removes an artifact.
func (h *ArtifactRegistryHandler) DeleteArtifact(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactRegistryDeleteArtifact")
	defer span.End()
	tenantID := h.GetTenantID(c)
	artifactID := c.Param("artifact_id")

	if err := h.svc.DeleteArtifact(ctx, tenantID, artifactID); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}
