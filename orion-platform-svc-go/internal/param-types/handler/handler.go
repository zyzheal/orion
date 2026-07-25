package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/param-types/models"
	"orion/platform-svc-go/internal/param-types/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes HTTP endpoints for parameter type catalog and validation.
type Handler struct {
	reg *service.ParamTypeRegistry
}

// NewHandler creates a new Handler.
func NewHandler(reg *service.ParamTypeRegistry) *Handler {
	return &Handler{reg: reg}
}

// RegisterRoutes mounts the /api/param-types group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/param-types")

	// Core CRUD
	r.POST("", auth.RequirePermission("param_type", "write"), h.Create)
	r.GET("", h.List)
	r.GET("/:id", h.Get)
	r.PATCH("/:id", auth.RequirePermission("param_type", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("param_type", "write"), h.Delete)

	// Validation endpoint
	r.POST("/validate", h.Validate)

	// Param templates
	r.POST("/templates", auth.RequirePermission("param_type", "write"), h.CreateTemplate)
	r.GET("/templates", h.ListTemplates)
}

// ===========================================================================
// CRUD
// ===========================================================================

// Create creates or updates a tenant-level param type override.
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ParamTypeCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_ = ctx

	var req models.CreateParamTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	pt, err := h.reg.UpsertParamType(tenantID, &req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, pt)
}

// List returns the param type catalog (seed + tenant overrides).
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ParamTypeList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_ = ctx

	items, err := h.reg.ListParamTypes(tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// Get returns a single param type by ID.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ParamTypeGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	pt, err := h.reg.GetParamType(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if pt == nil {
		middleware.RespondNotFound(c, "param type not found: "+id)
		return
	}
	middleware.RespondSuccess(c, pt)
}

// Update patches a tenant-level param type override.
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ParamTypeUpdate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_ = ctx

	id := c.Param("id")

	var req models.CreateParamTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	pt, err := h.reg.UpsertParamType(tenantID, &req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "updated", "param_type": pt, "note": "updated by code; id param " + id + " is informational"})
}

// Delete removes a tenant-level param type override.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ParamTypeDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	if err := h.reg.DeleteParamType(ctx, tenantID, c.Param("id")); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

// ===========================================================================
// Validation
// ===========================================================================

// Validate validates a value against a param type and returns parsed result.
func (h *Handler) Validate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ParamTypeValidate")
	defer span.End()
	_ = ctx

	var req models.ValidateParamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	resp := h.reg.ValidateValue(req.ParamType, req.Value)
	if !resp.Valid {
		middleware.RespondBadRequest(c, resp.Error)
		return
	}
	middleware.RespondSuccess(c, resp)
}

// ===========================================================================
// Templates
// ===========================================================================

// CreateTemplate creates a new script param template.
func (h *Handler) CreateTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ParamTemplateCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_ = ctx

	var req models.CreateParamTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tpl, err := h.reg.CreateParamTemplate(tenantID, &req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, tpl)
}

// ListTemplates lists script param templates.
func (h *Handler) ListTemplates(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ParamTemplateList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_ = ctx

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	_ = page
	tpls, err := h.reg.ListParamTemplates(tenantID, (page-1)*pageSize, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": tpls, "page": page, "page_size": pageSize})
}
