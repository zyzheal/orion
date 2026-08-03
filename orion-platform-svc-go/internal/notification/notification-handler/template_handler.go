package handler

import (
	"orion/platform-svc-go/internal/notification/notification/models"
	"orion/platform-svc-go/internal/notification/notification/service"

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
	}

	// Public read-only endpoints (no write permission required)
	tr := rg.Group("/templates")
	{
		tr.POST("/:id/preview", auth.RequirePermission("notification", "read"), h.Preview)
		tr.GET("/:id/variables", auth.RequirePermission("notification", "read"), h.RenderVariables)
	}
}

// Create handles POST /templates - create a new notification template.
func (h *TemplateHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var t models.NotificationTemplate
	if err := c.ShouldBindJSON(&t); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.templateSvc.CreateTemplate(c.Request.Context(), tenantID, &t); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, t)
}

// List handles GET /templates - list all templates for a tenant.
func (h *TemplateHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.templateSvc.ListTemplates(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// Get handles GET /templates/:id - get a single template.
func (h *TemplateHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	t, err := h.templateSvc.GetTemplate(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "template not found")
		return
	}
	respondSuccess(c, t)
}

// Update handles PUT /templates/:id - update an existing template.
func (h *TemplateHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	_ = id

	var t models.NotificationTemplate
	if err := c.ShouldBindJSON(&t); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if err := h.templateSvc.CreateTemplate(c.Request.Context(), tenantID, &t); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, t)
}

// Delete handles DELETE /templates/:id - remove a template.
func (h *TemplateHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.templateSvc.DeleteTemplate(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, "template not found")
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// Preview handles POST /templates/:id/preview - render a template with sample variables.
func (h *TemplateHandler) Preview(c *gin.Context) {
	_ = c.GetString("tenant_id")
	var input models.TemplatePreviewInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	result := h.templateSvc.PreviewTemplate(c.Request.Context(), &input)
	respondSuccess(c, result)
}

// RenderVariables handles GET /templates/:id/variables - extract variable placeholders.
func (h *TemplateHandler) RenderVariables(c *gin.Context) {
	vars := h.templateSvc.PreviewTemplate(c.Request.Context(), nil)
	respondSuccess(c, vars)
}