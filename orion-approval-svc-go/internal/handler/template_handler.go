package handler

import (
	"context"
	"errors"
	"net/http"

	"orion/approval-svc-go/internal/models"
	"orion/approval-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

// TemplateHandler provides HTTP handlers for approval template operations.
type TemplateHandler struct {
	svc TemplateService
}

// TemplateService defines the service interface for template operations.
type TemplateService interface {
	CreateTemplate(ctx context.Context, tenantID string, req *models.CreateTemplateRequest) (*models.ApprovalTemplate, error)
	GetTemplates(ctx context.Context, tenantID string) ([]models.ApprovalTemplate, error)
	GetDefaultTemplate(ctx context.Context, tenantID string, resourceType string) (*models.ApprovalTemplate, error)
	DeleteTemplate(ctx context.Context, tenantID string, id string) error
}

func NewTemplateHandler(svc TemplateService) *TemplateHandler {
	return &TemplateHandler{svc: svc}
}

// RegisterRoutes registers template routes.
func (h *TemplateHandler) RegisterRoutes(rg *gin.RouterGroup) {
	templates := rg.Group("/approvals/templates")
	{
		templates.POST("", h.CreateTemplate)
		templates.GET("", h.ListTemplates)
		templates.GET("/default/:resourceType", h.GetDefaultTemplate)
		templates.DELETE("/:id", h.DeleteTemplate)
	}
}

func (h *TemplateHandler) CreateTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateTemplateRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	template, err := h.svc.CreateTemplate(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, template)
}

func (h *TemplateHandler) ListTemplates(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	templates, err := h.svc.GetTemplates(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": templates, "total": len(templates)})
}

func (h *TemplateHandler) GetDefaultTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	resourceType := c.Param("resourceType")
	if resourceType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "resource_type is required"})
		return
	}
	template, err := h.svc.GetDefaultTemplate(c.Request.Context(), tenantID, resourceType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if template == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no default template found for resource type"})
		return
	}
	c.JSON(http.StatusOK, template)
}

func (h *TemplateHandler) DeleteTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "template id is required"})
		return
	}
	if err := h.svc.DeleteTemplate(c.Request.Context(), tenantID, id); err != nil {
		if errors.Is(err, service.ErrApprovalNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "template deleted"})
}

// validateTemplateRequest validates a CreateTemplateRequest.
func validateTemplateRequest(r *models.CreateTemplateRequest) error {
	if r.Name == "" {
		return errors.New("name is required")
	}
	if len(r.Name) > 255 {
		return errors.New("name must not exceed 255 characters")
	}
	if r.ResourceType == "" {
		return errors.New("resource_type is required")
	}
	if r.Levels == nil || len(r.Levels) == 0 {
		return errors.New("levels must not be empty")
	}
	return nil
}
