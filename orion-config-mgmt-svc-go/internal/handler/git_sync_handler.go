package handler

import (
	"net/http"

	"orion/config-mgmt-svc-go/internal/models"
	"orion/config-mgmt-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

type GitSyncHandler struct {
	svc *service.GitSyncService
}

func NewGitSyncHandler(svc *service.GitSyncService) *GitSyncHandler {
	return &GitSyncHandler{svc: svc}
}

func (h *GitSyncHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateGitSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	g, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, g)
}

func (h *GitSyncHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	g, err := h.svc.Get(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "git sync not found"})
		return
	}
	c.JSON(http.StatusOK, g)
}

func (h *GitSyncHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *GitSyncHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *GitSyncHandler) SyncNow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.SyncNow(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
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
