package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/config/internal/config/models"
	"orion/platform-svc-go/internal/config/internal/config/service"

	"github.com/gin-gonic/gin"
)

type GitSyncHandler struct {
	svc *service.GitSyncService
}

func NewGitSyncHandler(svc *service.GitSyncService) *GitSyncHandler {
	return &GitSyncHandler{svc: svc}
}

func (h *GitSyncHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateGitSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	g, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, g)
}

func (h *GitSyncHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	g, err := h.svc.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "git sync not found")
		return
	}
	respondSuccess(c, g)
}

func (h *GitSyncHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.List(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": items})
}

func (h *GitSyncHandler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *GitSyncHandler) SyncNow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigSyncNow")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.SyncNow(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *GitSyncHandler) RegisterRoutes(rg *gin.RouterGroup) {
	gs := rg.Group("/git-sync")
	{
		gs.POST("", h.Create)
		gs.GET("", h.List)
		gs.GET("/:id", h.Get)
		gs.DELETE("/:id", h.Delete)
		gs.POST("/:id/sync", h.SyncNow)
	}
}
