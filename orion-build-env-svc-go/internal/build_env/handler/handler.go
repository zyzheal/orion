package handler

import (
	"strconv"

	"orion-build-env-svc-go/internal/models"
	envSVC "orion-build-env-svc-go/internal/build_env/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *envSVC.Service
}

func NewHandler(svc *envSVC.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/builds", auth.RequirePermission("build_env", "read"), h.ListBuilds)
	rg.GET("/builds/:id", auth.RequirePermission("build_env", "read"), h.GetBuild)
	rg.POST("/builds", auth.RequirePermission("build_env", "write"), h.CreateBuild)
	rg.PUT("/builds/:id", auth.RequirePermission("build_env", "write"), h.UpdateBuild)
	rg.DELETE("/builds/:id", auth.RequirePermission("build_env", "delete"), h.DeleteBuild)
	rg.GET("/build-images", auth.RequirePermission("build_env", "read"), h.ListBuilderImages)
	rg.GET("/build-images/:id", auth.RequirePermission("build_env", "read"), h.GetBuilderImage)
	rg.POST("/build-images", auth.RequirePermission("build_env", "write"), h.CreateBuilderImage)
	rg.PUT("/build-images/:id", auth.RequirePermission("build_env", "write"), h.UpdateBuilderImage)
	rg.DELETE("/build-images/:id", auth.RequirePermission("build_env", "delete"), h.DeleteBuilderImage)
}

func (h *Handler) CreateBuild(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateBuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateBuild(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) GetBuild(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetBuild(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) ListBuilds(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListBuilds(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) UpdateBuild(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateBuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.UpdateBuild(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) DeleteBuild(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteBuild(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

func (h *Handler) CreateBuilderImage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateBuilderImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateBuilderImage(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) GetBuilderImage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetBuilderImage(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) ListBuilderImages(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListBuilderImages(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) UpdateBuilderImage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateBuilderImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.UpdateBuilderImage(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) DeleteBuilderImage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteBuilderImage(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}
