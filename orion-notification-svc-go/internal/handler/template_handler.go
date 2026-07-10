package handler

import (
	"net/http"

	"orion/notification-svc-go/internal/models"
	"orion/notification-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// TemplateHandler exposes HTTP endpoints for notification template management.
type TemplateHandler struct {
	templateSvc *service.TemplateService
}

// NewTemplateHandler creates a new TemplateHandler.
func NewTemplateHandler(templateSvc *service.TemplateService) *TemplateHandler {
	return &TemplateHandler{templateSvc: templateSvc}
}

// RegisterRoutes mounts all template endpoints onto the given router group.
func (h *TemplateHandler) RegisterRoutes(rg *gin.RouterGroup) {
	t := rg.Group("/templates")
	t.Use(auth.RequirePermission("notification", "write"))
	{
		t.POST("", h.Create)
		t.GET("", h.List)
		t.GET("/:id", h.Get)
		t.PUT("/:id", h.Update)
		t.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.Delete)
		t.POST("/:id/preview", h.Preview)
		t.POST("/:id/variables/render", h.RenderVariables)
	}
}

// Create handles POST /templates - create a new notification template.
func (h *TemplateHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var t models.NotificationTemplate
	if err := c.ShouldBindJSON(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.templateSvc.CreateTemplate(c.Request.Context(), tenantID, &t); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": t})
}

// List handles GET /templates - list all templates for a tenant.
func (h *TemplateHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.templateSvc.ListTemplates(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// Get handles GET /templates/:id - get a single template.
func (h *TemplateHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	t, err := h.templateSvc.GetTemplate(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "template not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": t})
}

// Update handles PUT /templates/:id - update an existing template.
func (h *TemplateHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var t models.NotificationTemplate
	if err := c.ShouldBindJSON(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.templateSvc.UpdateTemplate(c.Request.Context(), tenantID, id, &t); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": t})
}

// Delete handles DELETE /templates/:id - remove a template.
func (h *TemplateHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.templateSvc.DeleteTemplate(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
