package handler

import (
	"net/http"
	"strconv"

	"orion-build-env-svc-go/internal/models"
	cacheSVC "orion-build-env-svc-go/internal/build_cache/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *cacheSVC.Service
}

func NewHandler(svc *cacheSVC.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/build-cache", h.ListConfigs)
	rg.GET("/build-cache/:id", h.GetConfig)
	rg.POST("/build-cache", h.CreateConfig)
	rg.PUT("/build-cache/:id", h.UpdateConfig)
	rg.DELETE("/build-cache/:id", h.DeleteConfig)
}

func (h *Handler) CreateConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateBuildCacheRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "error": err.Error()})
		return
	}
	m, err := h.svc.CreateConfig(c.Request.Context(), tenantID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": m})
}

func (h *Handler) GetConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetConfig(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": m})
}

func (h *Handler) ListConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListConfigs(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": items})
}

func (h *Handler) UpdateConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateBuildCacheRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "error": err.Error()})
		return
	}
	m, err := h.svc.UpdateConfig(c.Request.Context(), tenantID, id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": m})
}

func (h *Handler) DeleteConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteConfig(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "deleted"})
}
