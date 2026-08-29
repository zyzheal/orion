package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/config/models"
	"orion/platform-svc-go/internal/config/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
)

// GitSyncHandler handles Git sync endpoints.
type GitSyncHandler struct {
	svc *service.GitSyncService
}

// NewGitSyncHandler creates a new GitSyncHandler.
func NewGitSyncHandler(svc *service.GitSyncService) *GitSyncHandler {
	return &GitSyncHandler{svc: svc}
}

func (h *GitSyncHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateGitSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	g, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, g)
}

func (h *GitSyncHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	g, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "git sync config not found")
		return
	}
	middleware.RespondSuccess(c, g)
}

func (h *GitSyncHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	gs, err := h.svc.List(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gs)
}

func (h *GitSyncHandler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "git sync deleted"})
}

func (h *GitSyncHandler) SyncNow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigSyncNow")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.SyncNow(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// RegisterRoutes registers git sync routes.
func (h *GitSyncHandler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/git-sync")
	{
		g.POST("", h.Create)
		g.GET("", h.List)
		g.GET("/:id", h.Get)
		g.DELETE("/:id", h.Delete)
		g.POST("/:id/sync", h.SyncNow)
	}
}
