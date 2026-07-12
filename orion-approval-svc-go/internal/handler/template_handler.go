package handler

import (
	"context"
	"errors"

	"orion/approval-svc-go/internal/models"
	"orion/approval-svc-go/internal/service"
	"orion/go-common/pkg/auth"

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
		templates.POST("", auth.RequirePermission("approval", "write"), h.CreateTemplate)
		templates.GET("", auth.RequirePermission("approval", "read"), h.ListTemplates)
		templates.GET("/default/:resourceType", auth.RequirePermission("approval", "read"), h.GetDefaultTemplate)
		templates.DELETE("/:id", auth.RequirePermission("approval", "delete"), h.DeleteTemplate)
	}
}

func (h *TemplateHandler) CreateTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := validateTemplateRequest(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	template, err := h.svc.CreateTemplate(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, template)
}

func (h *TemplateHandler) ListTemplates(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	templates, err := h.svc.GetTemplates(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"data": templates, "total": len(templates)})
}

func (h *TemplateHandler) GetDefaultTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	resourceType := c.Param("resourceType")
	if resourceType == "" {
		respondBadRequest(c, "resource_type is required")
		return
	}
	template, err := h.svc.GetDefaultTemplate(c.Request.Context(), tenantID, resourceType)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if template == nil {
		respondNotFound(c, "no default template found for resource type")
		return
	}
	respondSuccess(c, template)
}

func (h *TemplateHandler) DeleteTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if id == "" {
		respondBadRequest(c, "template id is required")
		return
	}
	if err := h.svc.DeleteTemplate(c.Request.Context(), tenantID, id); err != nil {
		if errors.Is(err, service.ErrApprovalNotFound) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "template deleted"})
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