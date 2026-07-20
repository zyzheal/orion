package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/artifact-lifecycle/models"
	"orion/platform-svc-go/internal/artifact-lifecycle/service"

	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AdvanceStage")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.AdvanceStageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.AdvanceStage(ctx, tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ArchiveArtifact(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArchiveArtifact")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.Archive(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) CreateLifecycle(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateLifecycle")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateArtifactLifecycleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) DeleteLifecycle(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteLifecycle")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) GetLifecycle(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetLifecycle")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	artifactID := c.Param("artifactId")
	result, err := h.svc.GetByArtifactID(ctx, tenantID, artifactID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) GetStageHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStageHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	artifactID := c.Query("artifactId")
	result, err := h.svc.GetStageHistory(ctx, tenantID, artifactID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListLifecycle(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListLifecycle")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	result, err := h.svc.List(ctx, tenantID, limit, offset)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}
