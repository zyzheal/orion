package handler

import (
	"strconv"

	"orion/ci-cd-svc-go/internal/pipeline/models"
	"orion/ci-cd-svc-go/internal/pipeline/service"

	"github.com/gin-gonic/gin"
)

type TemplateHandler struct {
	svc *service.TemplateService
}

func NewTemplateHandler(svc *service.TemplateService) *TemplateHandler {
	return &TemplateHandler{svc: svc}
}

func (h *TemplateHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	tmpl, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, tmpl)
}

func (h *TemplateHandler) GetByID(c *gin.Context) {
	tmpl, err := h.svc.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondNotFound(c, "template not found")
		return
	}

	respondSuccess(c, tmpl)
}

func (h *TemplateHandler) List(c *gin.Context) {
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

	templates, total, err := h.svc.List(c.Request.Context(), tenantID, category, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"data": templates, "total": total})
}

func (h *TemplateHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
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
