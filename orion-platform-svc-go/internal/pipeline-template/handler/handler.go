package handler

import (
	"context"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-template/models"
	"orion/platform-svc-go/internal/pipeline-template/service"

	"github.com/gin-gonic/gin"
)

// HandlerService is the contract the handler needs from the service layer.
type HandlerService interface {
	ListTemplates(ctx context.Context, tenantID string) ([]models.PipelineTemplate, int, error)
	GetTemplate(ctx context.Context, id string, tenantID string) (*models.PipelineTemplate, error)
	CreateTemplate(ctx context.Context, req *models.CreateTemplateRequest, tenantID string) (*models.PipelineTemplate, error)
	UpdateTemplate(ctx context.Context, id string, req *models.UpdateTemplateRequest, tenantID string) (*models.PipelineTemplate, error)
	DeleteTemplate(ctx context.Context, id string, tenantID string) (bool, error)
	InstantiateTemplate(ctx context.Context, templateID string, req *models.InstantiateRequest, tenantID string) (*models.InstantiatedPipeline, error)
}

type Handler struct {
	svc HandlerService
}

func NewHandler(svc HandlerService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all pipeline-template endpoints under the given group.
// Mirrors /api/v1/pipeline-templates routes from the TS source (6 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/pipeline-templates")

	// GET /pipeline-templates - List templates
	f.GET("/", auth.RequirePermission("pipeline", "read"), h.ListTemplates)
	// GET /pipeline-templates/:templateId - Get template detail
	f.GET("/:templateId", auth.RequirePermission("pipeline", "read"), h.GetTemplate)
	// POST /pipeline-templates - Create template
	f.POST("/", auth.RequirePermission("pipeline", "write"), h.CreateTemplate)
	// PUT /pipeline-templates/:templateId - Update template
	// PUT routes must be registered before the catch-all /:templateId path is
	// treated as a DELETE, but POST on /:templateId/instantiate needs to live
	// under the same variable group.  Instantiation is registered here and
	// ordered before DELETE so the nested path resolves first.
	f.PUT("/:templateId", auth.RequirePermission("pipeline", "write"), h.UpdateTemplate)
	// DELETE /pipeline-templates/:templateId - Delete template
	f.DELETE("/:templateId", auth.RequirePermission("pipeline", "write"), h.DeleteTemplate)
	// POST /pipeline-templates/:templateId/instantiate - Instantiate template into a pipeline
	f.POST("/:templateId/instantiate", auth.RequirePermission("pipeline", "write"), h.InstantiateTemplate)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) ListTemplates(c *gin.Context) {
	tenantID := h.getTenantID(c)
	templates, total, err := h.svc.ListTemplates(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.PaginatedResponse{
		Data:     templates,
		Total:    total,
		Page:     1,
		PageSize: total,
	})
}

func (h *Handler) GetTemplate(c *gin.Context) {
	id := c.Param("templateId")
	tenantID := h.getTenantID(c)
	t, err := h.svc.GetTemplate(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "pipeline template not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, t)
}

func (h *Handler) CreateTemplate(c *gin.Context) {
	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	t, err := h.svc.CreateTemplate(c.Request.Context(), &req, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, t)
}

func (h *Handler) UpdateTemplate(c *gin.Context) {
	id := c.Param("templateId")
	var req models.UpdateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	t, err := h.svc.UpdateTemplate(c.Request.Context(), id, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "pipeline template not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, t)
}

func (h *Handler) DeleteTemplate(c *gin.Context) {
	id := c.Param("templateId")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteTemplate(c.Request.Context(), id, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "pipeline template not found")
		return
	}
	respondSuccess(c, gin.H{"message": "pipeline template deleted"})
}

func (h *Handler) InstantiateTemplate(c *gin.Context) {
	id := c.Param("templateId")
	var req models.InstantiateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	inst, err := h.svc.InstantiateTemplate(c.Request.Context(), id, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "pipeline template not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, inst)
}
