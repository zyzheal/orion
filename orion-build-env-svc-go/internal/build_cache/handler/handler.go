package handler

import (
	"strconv"

	"orion-build-env-svc-go/internal/models"
	cacheSVC "orion-build-env-svc-go/internal/build_cache/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *cacheSVC.Service
}

func NewHandler(svc *cacheSVC.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/build-cache", auth.RequirePermission("build_cache", "read"), h.ListConfigs)
	rg.GET("/build-cache/:id", auth.RequirePermission("build_cache", "read"), h.GetConfig)
	rg.POST("/build-cache", auth.RequirePermission("build_cache", "write"), h.CreateConfig)
	rg.PUT("/build-cache/:id", auth.RequirePermission("build_cache", "write"), h.UpdateConfig)
	rg.DELETE("/build-cache/:id", auth.RequirePermission("build_cache", "delete"), h.DeleteConfig)
}

func (h *Handler) CreateConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateBuildCacheRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateConfig(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) GetConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetConfig(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) ListConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListConfigs(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) UpdateConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateBuildCacheRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.UpdateConfig(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) DeleteConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteConfig(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}
