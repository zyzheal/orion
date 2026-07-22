package handler

import (
	"context"
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/user/models"
	"orion/platform-svc-go/internal/user/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	Create(ctx context.Context, tenantID, creatorID string, req *models.CreateUserRequest) (*service.CreateUserResponse, error)
	Authenticate(ctx context.Context, req *models.AuthenticateRequest) (*models.User, error)
	List(ctx context.Context, tenantID string, filter *models.GetUserFilters, offset, limit int) ([]models.User, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.User, error)
	Count(ctx context.Context, tenantID string) (int, error)
	Update(ctx context.Context, tenantID, id string, req *models.UpdateUserRequest) (*models.User, error)
	ChangePassword(ctx context.Context, tenantID, userID string, req *models.ChangePasswordRequest) error
	Delete(ctx context.Context, tenantID, id string) error
}

// Handler exposes HTTP endpoints for user management.
type Handler struct {
	svc Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all user routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/users", auth.RequirePermission("user", "write"), h.Create)
	rg.GET("/users", auth.RequirePermission("user", "read"), h.List)
	rg.GET("/users/count", auth.RequirePermission("user", "read"), h.Count)
	rg.POST("/users/authenticate", h.Authenticate)
	rg.GET("/users/:id", auth.RequirePermission("user", "read"), h.Get)
	rg.PUT("/users/:id", auth.RequirePermission("user", "write"), h.Update)
	rg.PUT("/users/:id/password", auth.RequirePermission("user", "write"), h.ChangePassword)
	rg.DELETE("/users/:id", auth.RequirePermission("user", "delete"), h.Delete)
}

// Create creates a new user.
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := h.svc.Create(ctx, tenantID, userID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteCreated(c, resp)
}

// List retrieves users with optional filters and pagination.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	filter := &models.GetUserFilters{}
	if username := c.Query("username"); username != "" {
		filter.Username = &username
	}
	if email := c.Query("email"); email != "" {
		filter.Email = &email
	}
	if fullName := c.Query("full_name"); fullName != "" {
		filter.FullName = &fullName
	}
	if role := c.Query("role"); role != "" {
		filter.Role = &role
	}
	if status := c.Query("status"); status != "" {
		filter.Status = &status
	}

	items, err := h.svc.List(ctx, tenantID, filter, (page-1)*pageSize, pageSize)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": items, "page": page, "page_size": pageSize})
}

// Get retrieves a single user by id.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	user, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, user)
}

// Update modifies an existing user.
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	user, err := h.svc.Update(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, user)
}

// Delete removes a user by id.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	c.Status(http.StatusNoContent)
}

// Count returns the total number of users for the tenant.
func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Count")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"count": count})
}

// Authenticate verifies credentials and returns the authenticated user.
func (h *Handler) Authenticate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Authenticate")
	defer span.End()
	var req models.AuthenticateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	user, err := h.svc.Authenticate(ctx, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrUnauthorized, err.Error(), http.StatusUnauthorized)
		return
	}
	user.Password = ""
	errors.WriteSuccess(c, gin.H{"user": user})
}

// ChangePassword updates a user's password.
func (h *Handler) ChangePassword(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChangePassword")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.svc.ChangePassword(ctx, tenantID, userID, &req); err != nil {
		errors.WriteError(c, errors.ErrUnauthorized, err.Error(), http.StatusUnauthorized)
		return
	}
	errors.WriteSuccess(c, gin.H{"ok": true})
}
