package handler

import (
	stderrors "errors"
	"orion/platform-svc-go/internal/middleware"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/pipeline-version/models"
	"orion/platform-svc-go/internal/pipeline-version/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/pipelines")

	g.GET("/:pipelineId/versions/:versionId", auth.RequirePermission("pipeline", "read"), h.GetVersion)
	g.GET("/:pipelineId/versions/:versionId/diff", auth.RequirePermission("pipeline", "read"), h.DiffVersions)
	g.POST("/:pipelineId/versions/:versionId/rollback", auth.RequirePermission("pipeline", "write"), h.Rollback)
	g.POST("/:pipelineId/versions/:versionId/tag", auth.RequirePermission("pipeline", "write"), h.AddTag)
	g.DELETE("/:pipelineId/versions/:versionId/tag/:tag", auth.RequirePermission("pipeline", "write"), h.RemoveTag)
	g.POST("/:pipelineId/versions/:versionId/baseline", auth.RequirePermission("pipeline", "write"), h.SetBaseline)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) GetVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetVersion")
	defer span.End()
	tenantID := h.getTenantID(c)
	version, err := h.svc.GetVersion(ctx, c.Param("versionId"), tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "version not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, version)
}

func (h *Handler) DiffVersions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DiffVersions")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req models.DiffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	diff, err := h.svc.DiffVersions(ctx, c.Param("versionId"), req.OtherVersionID, tenantID)
	if err != nil {
		if stderrors.Is(err, service.ErrVersionNotFound) {
			middleware.RespondNotFound(c, "version not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, diff)
}

func (h *Handler) Rollback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Rollback")
	defer span.End()
	tenantID := h.getTenantID(c)
	_, err := h.svc.Rollback(ctx, c.Param("versionId"), tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "version not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, nil)
}

func (h *Handler) AddTag(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddTag")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req models.AddTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	version, err := h.svc.AddTag(ctx, c.Param("versionId"), tenantID, req.Tag)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "version not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, version)
}

func (h *Handler) RemoveTag(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RemoveTag")
	defer span.End()
	tenantID := h.getTenantID(c)
	tag := c.Param("tag")
	version, err := h.svc.RemoveTag(ctx, c.Param("versionId"), tenantID, tag)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "version not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, version)
}

func (h *Handler) SetBaseline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SetBaseline")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req models.SetBaselineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	version, err := h.svc.SetBaseline(ctx, c.Param("versionId"), tenantID, req.Set)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "version not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, version)
}

func respondSuccess(c *gin.Context, data interface{}) {
	errors.WriteSuccess(c, data)
}

func respondNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, 404)
}

func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, 400)
}

func respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, 500)
}
