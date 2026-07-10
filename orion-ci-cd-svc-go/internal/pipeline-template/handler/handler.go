package handler

import (
	"net/http"
	"strconv"

	"orion/ci-cd-svc-go/internal/pipeline-template/models"
	"orion/ci-cd-svc-go/internal/pipeline-template/repository"
	"orion/ci-cd-svc-go/internal/pipeline-template/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
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
	r.POST("", auth.RequirePermission("pipeline", "write"), h.Create)
	r.GET("", h.List)
	r.GET("/count", h.Count)
	r.GET("/:id", h.Get)
	r.PUT("/:id", auth.RequirePermission("pipeline", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("pipeline", "delete"), h.Delete)
	r.POST("/:id/instantiate", auth.RequirePermission("pipeline", "write"), h.Instantiate)
	r.POST("/from-pipeline/:pipelineId", auth.RequirePermission("pipeline", "write"), h.SaveAsTemplate)
}

// ---------------------------------------------------------------------------
// Create – POST /api/v1/templates
// ---------------------------------------------------------------------------

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreatePipelineTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		if err == service.ErrInvalidYAML {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, d)
}

// ---------------------------------------------------------------------------
// List – GET /api/v1/templates?category=&tag=&is_public=&page=&page_size=
// ---------------------------------------------------------------------------

func (h *Handler) List(c *gin.Context) {
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

	result, err := h.svc.List(c.Request.Context(), tenantID, filter, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ---------------------------------------------------------------------------
// Get – GET /api/v1/templates/:id
// ---------------------------------------------------------------------------

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

// ---------------------------------------------------------------------------
// Update – PUT /api/v1/templates/:id
// ---------------------------------------------------------------------------

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdatePipelineTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

// ---------------------------------------------------------------------------
// Delete – DELETE /api/v1/templates/:id
// ---------------------------------------------------------------------------

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ---------------------------------------------------------------------------
// Count – GET /api/v1/templates/count
// ---------------------------------------------------------------------------

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ---------------------------------------------------------------------------
// Instantiate – POST /api/v1/templates/:id/instantiate
// ---------------------------------------------------------------------------

func (h *Handler) Instantiate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	templateID := c.Param("id")

	var req models.InstantiateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.svc.InstantiateTemplate(c.Request.Context(), tenantID, templateID, &req)
	if err != nil {
		switch err {
		case service.ErrNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case service.ErrMissingParam:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusCreated, result)
}

// ---------------------------------------------------------------------------
// SaveAsTemplate – POST /api/v1/templates/from-pipeline/:pipelineId
// ---------------------------------------------------------------------------

func (h *Handler) SaveAsTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	var req models.CreatePipelineTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	d, err := h.svc.SavePipelineAsTemplate(c.Request.Context(), tenantID, pipelineID, &req)
	if err != nil {
		switch err {
		case service.ErrPipelineNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case service.ErrInvalidYAML:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusCreated, d)
}
