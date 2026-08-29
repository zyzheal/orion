package handler

import (
	"go.opentelemetry.io/otel"
	"strconv"

	"orion/platform-svc-go/internal/ci-cd/pipeline/models"
	"orion/platform-svc-go/internal/ci-cd/pipeline/service"

	"github.com/gin-gonic/gin"
)

type TemplateHandler struct {
	svc *service.TemplateService
}

func NewTemplateHandler(svc *service.TemplateService) *TemplateHandler {
	return &TemplateHandler{svc: svc}
}

func (h *TemplateHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	tmpl, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, tmpl)
}

func (h *TemplateHandler) GetByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineGetByID")
	defer span.End()
	tmpl, err := h.svc.GetByID(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, "template not found")
		return
	}

	respondSuccess(c, tmpl)
}

func (h *TemplateHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	category := c.Query("category")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	templates, total, err := h.svc.List(ctx, tenantID, category, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"data": templates, "total": total})
}

func (h *TemplateHandler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *TemplateHandler) RegisterRoutes(rg *gin.RouterGroup) {
	templates := rg.Group("/templates")
	{
		templates.POST("", h.Create)
		templates.GET("", h.List)
		templates.GET("/:id", h.GetByID)
		templates.DELETE("/:id", h.Delete)
	}
}
