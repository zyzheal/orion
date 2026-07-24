package handler

import (
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
	tenantID := c.GetString("tenant_id")
	var req models.CreateGitSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	g, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, g)
}

func (h *GitSyncHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	g, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "git sync config not found")
		return
	}
	middleware.RespondSuccess(c, g)
}

func (h *GitSyncHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	gs, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gs)
}

func (h *GitSyncHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "git sync deleted"})
}

func (h *GitSyncHandler) SyncNow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.SyncNow(c.Request.Context(), tenantID, id)
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
