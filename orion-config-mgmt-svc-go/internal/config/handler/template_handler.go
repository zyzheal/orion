package handler

import (
	"net/http"
	"strconv"

	"orion/config-mgmt-svc-go/internal/config/models"
	"orion/config-mgmt-svc-go/internal/config/service"

	"github.com/gin-gonic/gin"
)

// TemplateHandler handles config template HTTP endpoints.
type TemplateHandler struct {
	svc *service.TemplateService
}

// NewTemplateHandler creates a new TemplateHandler.
func NewTemplateHandler(svc *service.TemplateService) *TemplateHandler {
	return &TemplateHandler{svc: svc}
}

// Create handles POST /templates.
func (h *TemplateHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	t, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, t)
}

// List handles GET /templates.
func (h *TemplateHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	templates, err := h.svc.List(c.Request.Context(), tenantID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": templates})
}

// GetByID handles GET /templates/:id.
func (h *TemplateHandler) GetByID(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	t, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, t)
}

// Update handles PUT /templates/:id.
func (h *TemplateHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	t, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, t)
}

// Delete handles DELETE /templates/:id.
func (h *TemplateHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// CreateVersion handles POST /templates/:id/versions.
func (h *TemplateHandler) CreateVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateTemplateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	v, err := h.svc.CreateVersion(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, v)
}

// ListVersions handles GET /templates/:id/versions.
func (h *TemplateHandler) ListVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	versions, err := h.svc.ListVersions(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": versions})
}

// RegisterRoutes registers all template endpoints.
func (h *TemplateHandler) RegisterRoutes(rg *gin.RouterGroup) {
	t := rg.Group("/templates")
	{
		t.POST("", h.Create)
		t.GET("", h.List)
		t.GET("/:id", h.GetByID)
		t.PUT("/:id", h.Update)
		t.DELETE("/:id", h.Delete)
		t.POST("/:id/versions", h.CreateVersion)
		t.GET("/:id/versions", h.ListVersions)
	}
}
