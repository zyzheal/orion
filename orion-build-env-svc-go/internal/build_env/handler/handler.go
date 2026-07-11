package handler

import (
	"net/http"
	"strconv"

	"orion-build-env-svc-go/internal/models"
	envSVC "orion-build-env-svc-go/internal/build_env/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *envSVC.Service
}

func NewHandler(svc *envSVC.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/builds", h.ListBuilds)
	rg.GET("/builds/:id", h.GetBuild)
	rg.POST("/builds", h.CreateBuild)
	rg.PUT("/builds/:id", h.UpdateBuild)
	rg.DELETE("/builds/:id", h.DeleteBuild)
	rg.GET("/build-images", h.ListBuilderImages)
	rg.GET("/build-images/:id", h.GetBuilderImage)
	rg.POST("/build-images", h.CreateBuilderImage)
	rg.PUT("/build-images/:id", h.UpdateBuilderImage)
	rg.DELETE("/build-images/:id", h.DeleteBuilderImage)
}

func (h *Handler) CreateBuild(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateBuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "error": err.Error()})
		return
	}
	m, err := h.svc.CreateBuild(c.Request.Context(), tenantID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": m})
}

func (h *Handler) GetBuild(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetBuild(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": m})
}

func (h *Handler) ListBuilds(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListBuilds(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": items})
}

func (h *Handler) UpdateBuild(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateBuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "error": err.Error()})
		return
	}
	m, err := h.svc.UpdateBuild(c.Request.Context(), tenantID, id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": m})
}

func (h *Handler) DeleteBuild(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteBuild(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "deleted"})
}

func (h *Handler) CreateBuilderImage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateBuilderImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "error": err.Error()})
		return
	}
	m, err := h.svc.CreateBuilderImage(c.Request.Context(), tenantID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": m})
}

func (h *Handler) GetBuilderImage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetBuilderImage(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": m})
}

func (h *Handler) ListBuilderImages(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListBuilderImages(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": items})
}

func (h *Handler) UpdateBuilderImage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateBuilderImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "error": err.Error()})
		return
	}
	m, err := h.svc.UpdateBuilderImage(c.Request.Context(), tenantID, id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": m})
}

func (h *Handler) DeleteBuilderImage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteBuilderImage(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "deleted"})
}
