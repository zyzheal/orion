package handler

import (
	"net/http"

	"orion/platform-svc-go/internal/ai/models"
	"orion/platform-svc-go/internal/ai/service"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes HTTP endpoints for AI model management.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all AI routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/ai/models", auth.RequirePermission("ai", "read"), h.List)
	rg.GET("/ai/models/:id", auth.RequirePermission("ai", "read"), h.Get)
	rg.POST("/ai/models", auth.RequirePermission("ai", "write"), h.Create)
	rg.PUT("/ai/models/:id", auth.RequirePermission("ai", "write"), h.Update)
	rg.DELETE("/ai/models/:id", auth.RequirePermission("ai", "delete"), h.Delete)
}

// Create creates a new AI model.
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ai.Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.CreateAIModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	m, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteCreated(c, m)
}

// Get retrieves a single AI model by id.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ai.Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	m, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, m)
}

// List retrieves AI models for the tenant.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ai.List")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	filter := &models.ListFilter{}
	if t := c.Query("type"); t != "" {
		filter.Type = &t
	}

	items, err := h.svc.List(ctx, tenantID, filter)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, items)
}

// Update updates an AI model.
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ai.Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	m, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}

	var req models.CreateAIModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	m.Name = req.Name
	m.Type = req.Type
	// Update currently uses a stub; the service Update method is reserved.
	errors.WriteSuccess(c, m)
}

// Delete removes an AI model.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ai.Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	c.Status(http.StatusNoContent)
}
