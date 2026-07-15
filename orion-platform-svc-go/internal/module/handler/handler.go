package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/module/models"
	"orion/platform-svc-go/internal/module/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/module")
	r.GET("", auth.RequirePermission("module", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("module", "read"), h.Get)
	r.PUT("/:id/toggle", auth.RequirePermission("module", "write"), h.Toggle)
	r.GET("/validate", auth.RequirePermission("module", "read"), h.Validate)
	r.GET("/startup-order", auth.RequirePermission("module", "read"), h.StartupOrder)
}

// List returns all module status for the tenant.
func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	snapshot, err := h.svc.GetModuleStatus(c.Request.Context(), tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, "failed to list modules", http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, snapshot)
}

// Get returns a single module by id.
func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	mod, err := h.svc.GetModuleByID(c.Request.Context(), tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "module not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, gin.H{"module": mod})
}

// Toggle enables or disables a module.
func (h *Handler) Toggle(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.ToggleModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	mod, err := h.svc.ToggleModule(c.Request.Context(), tenantID, id, req.Enabled)
	switch {
	case err != nil && err.Error() == "core module cannot be disabled":
		errors.WriteError(c, errors.ErrValidation, "core module cannot be disabled", http.StatusBadRequest)
		return
	case err != nil && err.Error() == "module not found":
		errors.WriteError(c, errors.ErrNotFound, "module not found", http.StatusNotFound)
		return
	case err != nil:
		errors.WriteError(c, errors.ErrInternal, "module toggle failed", http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"module": mod})
}

// Validate returns dependency validation results.
func (h *Handler) Validate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	results, err := h.svc.ValidateDependencies(c.Request.Context(), tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, "failed to validate dependencies", http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"validation": results})
}

// StartupOrder returns the ordered list of enabled module names.
func (h *Handler) StartupOrder(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	order, err := h.svc.GetStartupOrder(c.Request.Context(), tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, "failed to get startup order", http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"order": order})
}
