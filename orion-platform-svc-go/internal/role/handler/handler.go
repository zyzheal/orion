package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/role/models"
	"orion/platform-svc-go/internal/role/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for role management operations.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all role routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/roles", auth.RequirePermission("role", "write"), h.Create)
	rg.GET("/roles", h.List)
	rg.GET("/roles/count", h.Count)
	rg.GET("/roles/:id", h.Get)
	rg.PUT("/roles/:id", auth.RequirePermission("role", "write"), h.Update)
	rg.DELETE("/roles/:id", auth.RequirePermission("role", "delete"), h.Delete)
	rg.POST("/roles/:id/permissions", auth.RequirePermission("role", "write"), h.SetPermissions)
	rg.GET("/roles/:id/permissions", h.GetPermissions)
}

// Create creates a new role.
func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	role, err := h.svc.Create(c.Request.Context(), tenantID, "", &req)
	if err != nil {
		if err == service.ErrDuplicateName {
			errors.WriteError(c, errors.ErrConflict, err.Error(), http.StatusConflict)
			return
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteCreated(c, role)
}

// List retrieves roles with optional status filter and pagination.
func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	filter := &models.ListFilter{}
	if status := c.Query("status"); status != "" {
		s := models.RoleStatus(status)
		filter.Status = &s
	}

	items, err := h.svc.List(c.Request.Context(), tenantID, filter, (page-1)*pageSize, pageSize)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": items, "page": page, "page_size": pageSize})
}

// Get retrieves a single role by id.
func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	role, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, role)
}

// Update modifies an existing role.
func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	role, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, role)
}

// Delete removes a role by id.
func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "deleted"})
}

// Count returns the total number of roles for the tenant.
func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = count
	errors.WriteSuccess(c, gin.H{"count": count})
}

// SetPermissions replaces all permissions for a role.
func (h *Handler) SetPermissions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.SetPermissionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	role, err := h.svc.SetPermissions(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, gin.H{"role_id": role.ID, "permissions": role.Permissions})
}

// GetPermissions retrieves the permissions for a role.
func (h *Handler) GetPermissions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	role, err := h.svc.GetPermissions(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, gin.H{"role_id": role.ID, "permissions": role.Permissions})
}
