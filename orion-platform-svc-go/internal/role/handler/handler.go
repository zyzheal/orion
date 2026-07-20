package handler

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	orionerrors "orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/role/models"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/sentinel"
)

// ErrDuplicateName is the error returned when a role with the same name already exists.
var ErrDuplicateName = fmt.Errorf("role name already exists")

// Service defines the methods the handler calls on the service layer.
type Service interface {
	Create(ctx context.Context, tenantID, userID string, req *models.CreateRoleRequest) (*models.Role, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Role, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Role, error)
	Update(ctx context.Context, tenantID, id string, req *models.UpdateRoleRequest) (*models.Role, error)
	Delete(ctx context.Context, tenantID, id string) error
	Count(ctx context.Context, tenantID string) (int, error)
	SetPermissions(ctx context.Context, tenantID, id string, req *models.SetPermissionsRequest) (*models.Role, error)
	GetPermissions(ctx context.Context, tenantID, id string) (*models.Role, error)
}

// Handler exposes HTTP endpoints for role management operations.
type Handler struct {
	svc Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc Service) *Handler {
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		orionerrors.WriteError(c, orionerrors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	role, err := h.svc.Create(ctx, tenantID, "", &req)
	if err != nil {
		if err == ErrDuplicateName {
			orionerrors.WriteError(c, orionerrors.ErrConflict, err.Error(), http.StatusConflict)
			return
		}
		orionerrors.WriteError(c, orionerrors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	orionerrors.WriteCreated(c, role)
}

// List retrieves roles with optional status filter and pagination.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	PageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if PageSize < 1 || PageSize > 100 {
		PageSize = 20
	}

	filter := &models.ListFilter{}
	if status := c.Query("status"); status != "" {
		s := models.RoleStatus(status)
		filter.Status = &s
	}

	items, err := h.svc.List(ctx, tenantID, filter, (page-1)*PageSize, PageSize)
	if err != nil {
		orionerrors.WriteError(c, orionerrors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	orionerrors.WriteSuccess(c, gin.H{"data": items, "page": page, "page_size": PageSize})
}

// Get retrieves a single role by id.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	role, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		orionerrors.WriteError(c, orionerrors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	orionerrors.WriteSuccess(c, role)
}

// Update modifies an existing role.
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		orionerrors.WriteError(c, orionerrors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	role, err := h.svc.Update(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		orionerrors.WriteError(c, orionerrors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	orionerrors.WriteSuccess(c, role)
}

// Delete removes a role by id.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		orionerrors.WriteError(c, orionerrors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	c.Status(http.StatusNoContent)
}

// Count returns the total number of roles for the tenant.
func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Count")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		orionerrors.WriteError(c, orionerrors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	orionerrors.WriteSuccess(c, gin.H{"count": count})
}

// SetPermissions replaces all permissions for a role.
func (h *Handler) SetPermissions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SetPermissions")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.SetPermissionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		orionerrors.WriteError(c, orionerrors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	role, err := h.svc.SetPermissions(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		orionerrors.WriteError(c, orionerrors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	orionerrors.WriteSuccess(c, gin.H{"role_id": role.ID, "permissions": role.Permissions})
}

// GetPermissions retrieves the permissions for a role.
func (h *Handler) GetPermissions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPermissions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	role, err := h.svc.GetPermissions(ctx, tenantID, c.Param("id"))
	if err != nil {
		orionerrors.WriteError(c, orionerrors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	orionerrors.WriteSuccess(c, gin.H{"role_id": role.ID, "permissions": role.Permissions})
}
