package handler

import (
	"context"
	"database/sql"
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-templates/models"
	"orion/platform-svc-go/internal/pipeline-templates/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

// Handler exposes HTTP endpoints for Pipeline Templates.
type Handler struct {
	svc Service
}

// Service defines the contract the handler needs from the service layer.
type Service interface {
	GetCategories(ctx context.Context, tenantID string) ([]models.TemplateCategorySummary, error)
	List(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.PipelineTemplate, int, error)
	Create(ctx context.Context, tenantID string, req models.CreateTemplateRequest, authorID string) (*models.PipelineTemplate, error)
	Get(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error)
	Update(ctx context.Context, tenantID, id string, req models.UpdateTemplateRequest) (*models.PipelineTemplate, error)
	Delete(ctx context.Context, tenantID, id string) error
	Publish(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error)
	Deprecate(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error)
	GetVersions(ctx context.Context, tenantID, templateID string, q *models.ListQuery) ([]models.TemplateVersion, int, error)
	Instantiate(ctx context.Context, tenantID, id string, req models.InstantiateTemplateRequest) (*models.InstantiateTemplateResponse, error)
	Star(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error)
	Unstar(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error)
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all pipeline-templates routes.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/pipeline-templates")

	// Categories (no id, no pagination query required)
	r.GET("/categories",
		auth.RequirePermission("pipeline_templates", "read"),
		h.Categories)

	// Search (GET with query params)
	r.GET("/search",
		auth.RequirePermission("pipeline_templates", "read"),
		h.Search)

	// Collection: GET /pipeline-templates (list)
	r.GET("",
		auth.RequirePermission("pipeline_templates", "read"),
		h.List)

	// Collection: POST /pipeline-templates (create)
	r.POST("",
		auth.RequirePermission("pipeline_templates", "write"),
		h.Create)

	// Item: GET /pipeline-templates/:id
	r.GET("/:id",
		auth.RequirePermission("pipeline_templates", "read"),
		h.Get)

	// Item: PUT /pipeline-templates/:id
	r.PUT("/:id",
		auth.RequirePermission("pipeline_templates", "write"),
		h.Update)

	// Item: DELETE /pipeline-templates/:id
	r.DELETE("/:id",
		auth.RequirePermission("pipeline_templates", "delete"),
		h.Delete)

	// Actions on :id (specific endpoints, mount before :id variants with trailing paths)
	r.POST("/:id/publish",
		auth.RequirePermission("pipeline_templates", "write"),
		h.Publish)

	r.POST("/:id/deprecate",
		auth.RequirePermission("pipeline_templates", "write"),
		h.Deprecate)

	// Versions: GET /pipeline-templates/:id/versions
	r.GET("/:id/versions",
		auth.RequirePermission("pipeline_templates", "read"),
		h.Versions)

	// Instantiate: POST /pipeline-templates/:id/instantiate
	r.POST("/:id/instantiate",
		auth.RequirePermission("pipeline_templates", "write"),
		h.Instantiate)

	// Star: POST /pipeline-templates/:id/star
	r.POST("/:id/star",
		auth.RequirePermission("pipeline_templates", "write"),
		h.Star)

	// Unstar: DELETE /pipeline-templates/:id/star
	r.DELETE("/:id/star",
		auth.RequirePermission("pipeline_templates", "write"),
		h.Unstar)
}

// Categories returns the list of categories with counts.
func (h *Handler) Categories(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Categories")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	cats, err := h.svc.GetCategories(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": cats})
}

// Search returns a paginated search of templates.
func (h *Handler) Search(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Search")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	q := models.ListQuery{}
	if err := c.ShouldBindQuery(&q); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Handle comma-separated tags from query string
	if q.Tags != "" {
		// Already passed as a raw string from query param
	}

	items, total, err := h.svc.List(ctx, tenantID, &q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":  items,
		"total": total,
	})
}

// List returns a paginated list of templates.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	q := models.ListQuery{}
	if err := c.ShouldBindQuery(&q); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}

	items, total, err := h.svc.List(ctx, tenantID, &q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":  items,
		"total": total,
	})
}

// Create creates a new template.
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	authorID := c.GetString("user_id")
	if authorID == "" {
		authorID = "system"
	}
	ctx := middleware.TimeoutContext(c)

	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	tmpl, err := h.svc.Create(ctx, tenantID, req, authorID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, tmpl)
}

// Get retrieves a template by ID.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	tmpl, err := h.svc.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "template not found")
		return
	}
	middleware.RespondSuccess(c, tmpl)
}

// Update updates a template.
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	var req models.UpdateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	tmpl, err := h.svc.Update(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		middleware.RespondNotFound(c, "template not found")
		return
	}
	middleware.RespondSuccess(c, tmpl)
}

// Delete removes a template.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		if err == sql.ErrNoRows {
			middleware.RespondNotFound(c, "template not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

// Publish publishes a template.
func (h *Handler) Publish(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Publish")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	tmpl, err := h.svc.Publish(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "template not found")
		return
	}
	middleware.RespondSuccess(c, tmpl)
}

// Deprecate deprecates a template.
func (h *Handler) Deprecate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Deprecate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	tmpl, err := h.svc.Deprecate(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "template not found")
		return
	}
	middleware.RespondSuccess(c, tmpl)
}

// Versions returns paginated versions for a template.
func (h *Handler) Versions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Versions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	q := models.ListQuery{}
	if err := c.ShouldBindQuery(&q); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}

	versions, total, err := h.svc.GetVersions(ctx, tenantID, c.Param("id"), &q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":  versions,
		"total": total,
	})
}

// Instantiate creates a pipeline from a template.
func (h *Handler) Instantiate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Instantiate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	var req models.InstantiateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.Instantiate(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

// Star stars a template.
func (h *Handler) Star(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Star")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	tmpl, err := h.svc.Star(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "template not found")
		return
	}
	middleware.RespondSuccess(c, tmpl)
}

// Unstar removes a star from a template.
func (h *Handler) Unstar(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Unstar")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	tmpl, err := h.svc.Unstar(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "template not found")
		return
	}
	middleware.RespondSuccess(c, tmpl)
}

// unused import fix
var _ = http.StatusOK
var _ = strconv.Itoa
