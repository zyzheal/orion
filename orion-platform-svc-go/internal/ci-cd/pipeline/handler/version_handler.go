package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/ci-cd/pipeline/models"
	"orion/platform-svc-go/internal/ci-cd/pipeline/service"

	"github.com/gin-gonic/gin"
)

type VersionHandler struct {
	svc *service.VersionService
}

func NewVersionHandler(svc *service.VersionService) *VersionHandler {
	return &VersionHandler{svc: svc}
}

func (h *VersionHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	var req models.CreateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	version, err := h.svc.Create(ctx, tenantID, pipelineID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, version)
}

func (h *VersionHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineList")
	defer span.End()
	pipelineID := c.Param("pipelineId")

	versions, err := h.svc.List(ctx, pipelineID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, versions)
}

func (h *VersionHandler) GetByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineGetByID")
	defer span.End()
	version, err := h.svc.GetByID(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, "version not found")
		return
	}

	respondSuccess(c, version)
}

func (h *VersionHandler) GetActive(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineGetActive")
	defer span.End()
	pipelineID := c.Param("pipelineId")

	version, err := h.svc.GetActive(ctx, pipelineID)
	if err != nil {
		respondNotFound(c, "no active version")
		return
	}

	respondSuccess(c, version)
}

func (h *VersionHandler) Rollback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineRollback")
	defer span.End()
	pipelineID := c.Param("pipelineId")
	versionID := c.Param("id")

	if err := h.svc.Rollback(ctx, pipelineID, versionID); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "rolled back"})
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
