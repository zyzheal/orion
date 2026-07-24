package handler

import (
	"net/http"

	"orion/platform-svc-go/internal/application/models"
	"orion/platform-svc-go/internal/application/service"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes HTTP endpoints for application management.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all application routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/applications", auth.RequirePermission("application", "read"), h.List)
	rg.GET("/applications/:id", auth.RequirePermission("application", "read"), h.Get)
	rg.POST("/applications", auth.RequirePermission("application", "write"), h.Create)
	rg.PUT("/applications/:id", auth.RequirePermission("application", "write"), h.Update)
	rg.DELETE("/applications/:id", auth.RequirePermission("application", "delete"), h.Delete)
}

// Create creates a new application.
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "application.Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.CreateApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	a, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteCreated(c, a)
}

// Get retrieves a single application by id.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "application.Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	a, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, a)
}

// List retrieves applications for the tenant.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "application.List")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	filter := &models.ListFilter{}
	if n := c.Query("name"); n != "" {
		filter.Name = &n
	}

	items, err := h.svc.List(ctx, tenantID, filter)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, items)
}

// Update updates an application's name.
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "application.Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.CreateApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	a, err := h.svc.Update(ctx, tenantID, c.Param("id"), req.Name)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, a)
}

// Delete removes an application.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "application.Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	c.Status(http.StatusNoContent)
}
