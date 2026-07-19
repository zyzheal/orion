package handler

import (
	"context"
	"net/http"
	"strconv"

	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/permission/models"

	"github.com/gin-gonic/gin"
)

// Service defines the methods the handler calls on the service layer.
type Service interface {
	Create(ctx context.Context, tenantID, userID string, req *models.CreatePermissionRequest) (*models.Permission, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Permission, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Permission, error)
	Update(ctx context.Context, tenantID, id string, req *models.UpdatePermissionRequest) (*models.Permission, error)
	Delete(ctx context.Context, tenantID, id string) error
	Count(ctx context.Context, tenantID string) (int, error)
}

// Handler exposes HTTP endpoints for permission management.
type Handler struct {
	svc Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all permission routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/permissions", h.Create)
	rg.GET("/permissions", h.List)
	rg.GET("/permissions/count", h.Count)
	rg.GET("/permissions/:id", h.Get)
	rg.PUT("/permissions/:id", h.Update)
	rg.DELETE("/permissions/:id", h.Delete)
}

// Create creates a new permission.
func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.CreatePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	perm, err := h.svc.Create(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteCreated(c, perm)
}

// List retrieves permissions with optional filters and pagination.
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
	if resource := c.Query("resource"); resource != "" {
		filter.Resource = &resource
	}
	if action := c.Query("action"); action != "" {
		filter.Action = &action
	}

	items, err := h.svc.List(c.Request.Context(), tenantID, filter, (page-1)*pageSize, pageSize)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": items, "page": page, "page_size": pageSize})
}

// Get retrieves a single permission by id.
func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	perm, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, perm)
}

// Update modifies an existing permission.
func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.UpdatePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	perm, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, perm)
}

// Delete removes a permission by id.
func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	c.Status(http.StatusNoContent)
}

// Count returns the total number of permissions for the tenant.
func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"count": count})
}
