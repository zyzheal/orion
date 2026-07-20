package handler

import (
	"errors"
	"fmt"
	"strings"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/page-registry/models"
	"orion/platform-svc-go/internal/page-registry/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Resource and action constants for page-registry RBAC
const (
	resourcePageRegistry = "page_registry"
	actionRead           = "read"
	actionWrite          = "write"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all page-registry endpoints on the given RouterGroup.
// All routes require auth.Auth middleware to be applied before this group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// GET /api/v1/page-registry - List all entries (read)
	rg.GET("/", auth.RequirePermission(resourcePageRegistry, actionRead), h.List)

	// GET /api/v1/page-registry/enabled - List enabled entries (read)
	rg.GET("/enabled", auth.RequirePermission(resourcePageRegistry, actionRead), h.ListEnabled)

	// GET /api/v1/page-registry/:path/history - Get history (read)
	rg.GET("/:path/history", auth.RequirePermission(resourcePageRegistry, actionRead), h.GetHistory)

	// GET /api/v1/page-registry/:path - Get single entry (read)
	rg.GET("/:path", auth.RequirePermission(resourcePageRegistry, actionRead), h.GetByPath)

	// POST /api/v1/page-registry - Create new entry (write)
	rg.POST("/", auth.RequirePermission(resourcePageRegistry, actionWrite), h.Create)

	// PUT /api/v1/page-registry/:path - Update entry (write)
	rg.PUT("/:path", auth.RequirePermission(resourcePageRegistry, actionWrite), h.Update)

	// PUT /api/v1/page-registry/:path/status - Toggle status (write)
	rg.PUT("/:path/status", auth.RequirePermission(resourcePageRegistry, actionWrite), h.ToggleStatus)

	// DELETE /api/v1/page-registry/:path - Delete entry (delete)
	rg.DELETE("/:path", auth.RequirePermission(resourcePageRegistry, actionWrite), h.Delete)
}

// ---------------------------------------------------------------------------
// Handler methods
// ---------------------------------------------------------------------------

// List returns all page registry entries for the tenant.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondForbidden(c, "missing tenant_id")
		return
	}
	items, err := h.svc.GetAll(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":  items,
		"total": len(items),
	})
}

// ListEnabled returns only enabled page registry entries for the tenant.
func (h *Handler) ListEnabled(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListEnabled")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondForbidden(c, "missing tenant_id")
		return
	}
	items, err := h.svc.GetEnabled(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data": items,
	})
}

// GetByPath returns a single page registry entry by path.
func (h *Handler) GetByPath(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetByPath")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondForbidden(c, "missing tenant_id")
		return
	}
	path := c.Param("path")
	if path == "" {
		middleware.RespondBadRequest(c, "path parameter is required")
		return
	}
	entry, err := h.svc.GetByPath(ctx, tenantID, path)
	if err != nil {
		middleware.RespondNotFound(c, "page entry not found: "+path)
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data": entry,
	})
}

// Create creates a new page registry entry.
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondForbidden(c, "missing tenant_id")
		return
	}
	var req models.CreatePageRegistryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	entry, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		// Detect conflict error (path already exists)
		if errors.Is(err, fmt.Errorf("path already exists")) {
			middleware.RespondConflict(c, "path already exists: "+req.Path)
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{
		"data":    entry,
		"message": "page entry created successfully",
	})
}

// Update updates an existing page registry entry.
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondForbidden(c, "missing tenant_id")
		return
	}
	path := c.Param("path")
	if path == "" {
		middleware.RespondBadRequest(c, "path parameter is required")
		return
	}
	var req models.UpdatePageRegistryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	entry, err := h.svc.Update(ctx, tenantID, path, req)
	if err != nil {
		// Check for not found
		if strings.Contains(err.Error(), "not found") {
			middleware.RespondNotFound(c, "page entry not found: "+path)
			return
		}
		// Check for conflict
		if strings.Contains(err.Error(), "path already exists") {
			middleware.RespondConflict(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":    entry,
		"message": "page entry updated successfully",
	})
}

// ToggleStatus toggles a page entry between enabled and disabled.
func (h *Handler) ToggleStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ToggleStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondForbidden(c, "missing tenant_id")
		return
	}
	path := c.Param("path")
	if path == "" {
		middleware.RespondBadRequest(c, "path parameter is required")
		return
	}
	entry, err := h.svc.ToggleStatus(ctx, tenantID, path)
	if err != nil {
		middleware.RespondNotFound(c, "page entry not found: "+path)
		return
	}
	statusMsg := "enabled"
	if entry.Status == "disabled" {
		statusMsg = "disabled"
	}
	middleware.RespondSuccess(c, gin.H{
		"data":    entry,
		"message": "page " + statusMsg + " successfully",
	})
}

// Delete deletes a page registry entry.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondForbidden(c, "missing tenant_id")
		return
	}
	path := c.Param("path")
	if path == "" {
		middleware.RespondBadRequest(c, "path parameter is required")
		return
	}
	err := h.svc.Delete(ctx, tenantID, path)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			middleware.RespondNotFound(c, "page entry not found: "+path)
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"message": "page entry deleted successfully",
	})
}

// GetHistory returns history entries for a given page path.
func (h *Handler) GetHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondForbidden(c, "missing tenant_id")
		return
	}
	path := c.Param("path")
	if path == "" {
		middleware.RespondBadRequest(c, "path parameter is required")
		return
	}
	history, err := h.svc.GetHistory(ctx, tenantID, path)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":  history,
		"total": len(history),
	})
}
