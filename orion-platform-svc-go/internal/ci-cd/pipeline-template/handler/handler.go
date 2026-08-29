package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ci-cd/pipeline-template/models"
	"orion/platform-svc-go/internal/ci-cd/pipeline-template/repository"
	"orion/platform-svc-go/internal/ci-cd/pipeline-template/service"
)

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/templates")
	r.GET("/count", h.Count)
	r.POST("/:id/instantiate", auth.RequirePermission("pipeline", "write"), h.Instantiate)
	r.POST("/from-pipeline/:pipelineId", auth.RequirePermission("pipeline", "write"), h.SaveAsTemplate)
}

// ---------------------------------------------------------------------------
// Create – POST /api/v1/templates
// ---------------------------------------------------------------------------

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineTemplateCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreatePipelineTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		if err == service.ErrInvalidYAML {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

// ---------------------------------------------------------------------------
// List – GET /api/v1/templates?category=&tag=&is_public=&page=&page_size=
// ---------------------------------------------------------------------------

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineTemplateList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filter := repository.ListFilter{TenantID: tenantID}
	if v := c.Query("category"); v != "" {
		filter.Category = v
	}
	if v := c.Query("tag"); v != "" {
		filter.Tag = v
	}
	if v := c.Query("is_public"); v != "" {
		b := v == "true"
		filter.IsPublic = &b
	}

	result, err := h.svc.List(ctx, tenantID, filter, page, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// ---------------------------------------------------------------------------
// Get – GET /api/v1/templates/:id
// ---------------------------------------------------------------------------

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineTemplateGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

// ---------------------------------------------------------------------------
// Update – PUT /api/v1/templates/:id
// ---------------------------------------------------------------------------

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineTemplateUpdate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdatePipelineTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Update(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

// ---------------------------------------------------------------------------
// Delete – DELETE /api/v1/templates/:id
// ---------------------------------------------------------------------------

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineTemplateDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ---------------------------------------------------------------------------
// Count – GET /api/v1/templates/count
// ---------------------------------------------------------------------------

func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineTemplateCount")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

// ---------------------------------------------------------------------------
// Instantiate – POST /api/v1/templates/:id/instantiate
// ---------------------------------------------------------------------------

func (h *Handler) Instantiate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineTemplateInstantiate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	templateID := c.Param("id")

	var req models.InstantiateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.InstantiateTemplate(ctx, tenantID, templateID, &req)
	if err != nil {
		switch err {
		case service.ErrNotFound:
			respondNotFound(c, err.Error())
		case service.ErrMissingParam:
			respondBadRequest(c, err.Error())
		default:
			respondInternalError(c, err.Error())
		}
		return
	}
	respondCreated(c, result)
}

// ---------------------------------------------------------------------------
// SaveAsTemplate – POST /api/v1/templates/from-pipeline/:pipelineId
// ---------------------------------------------------------------------------

func (h *Handler) SaveAsTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineTemplateSaveAsTemplate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	var req models.CreatePipelineTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	d, err := h.svc.SavePipelineAsTemplate(ctx, tenantID, pipelineID, &req)
	if err != nil {
		switch err {
		case service.ErrPipelineNotFound:
			respondNotFound(c, err.Error())
		case service.ErrInvalidYAML:
			respondBadRequest(c, err.Error())
		default:
			respondInternalError(c, err.Error())
		}
		return
	}
	respondCreated(c, d)
}
