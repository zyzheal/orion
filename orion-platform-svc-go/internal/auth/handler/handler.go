package handler

import (
	"context"
	"net/http"

	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/auth/models"
	"orion/platform-svc-go/internal/auth/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for authentication.
type Handler struct {
	svc AuthService
}

// AuthService defines the contract the handler needs from the service layer.
type AuthService interface {
	Login(ctx context.Context, req *models.LoginRequest, tenantID string) (*models.LoginResponse, error)
	Register(ctx context.Context, req *models.RegisterRequest, tenantID string) (*models.RegisterResponse, error)
	Refresh(ctx context.Context, req *models.RefreshRequest) (*models.RefreshResponse, error)
	Logout(ctx context.Context, req *models.LogoutRequest) error
	GetProfile(ctx context.Context, tenantID, userID string) (*models.MeResponse, error)
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts auth routes. Called twice: public routes and JWT-protected routes.
// Public routes are mounted on a group without JWT middleware.
// Protected routes are mounted on a group with JWT middleware.
func (h *Handler) RegisterRoutes(public *gin.RouterGroup, protected *gin.RouterGroup) {
	// Public endpoints (no JWT required)
	public.POST("/auth/login", h.Login)
	public.POST("/auth/register", h.Register)
	public.POST("/auth/refresh", h.Refresh)

	// Protected endpoints (JWT required)
	protected.POST("/auth/logout", h.Logout)
	protected.GET("/auth/me", h.Me)
}

// Login authenticates a user and returns tokens.
func (h *Handler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request body", http.StatusBadRequest)
		return
	}

	requestedTenantID := c.GetHeader("X-Tenant-ID")

	resp, err := h.svc.Login(c.Request.Context(), &req, requestedTenantID)
	if err != nil {
		switch err {
		case service.ErrInvalidCredentials:
			errors.WriteError(c, errors.ErrUnauthorized, "invalid username or password", http.StatusUnauthorized)
		case service.ErrUserDisabled:
			errors.WriteError(c, errors.ErrForbidden, "account is disabled", http.StatusForbidden)
		case service.ErrUserSuspended:
			errors.WriteError(c, errors.ErrForbidden, "account is suspended", http.StatusForbidden)
		case service.ErrTenantAccessDenied:
			errors.WriteError(c, errors.ErrForbidden, "user does not have access to the specified tenant", http.StatusForbidden)
		case service.ErrMultipleTenants:
			errors.WriteError(c, errors.ErrBadRequest, "user belongs to multiple tenants, specify X-Tenant-ID header", http.StatusBadRequest)
		default:
			errors.WriteError(c, errors.ErrInternal, "authentication failed", http.StatusInternalServerError)
		}
		return
	}

	errors.WriteSuccess(c, resp)
}

// Register creates a new user account.
func (h *Handler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request body", http.StatusBadRequest)
		return
	}

	requestedTenantID := c.GetHeader("X-Tenant-ID")

	resp, err := h.svc.Register(c.Request.Context(), &req, requestedTenantID)
	if err != nil {
		switch err {
		case service.ErrUsernameExists:
			errors.WriteError(c, errors.ErrConflict, "username already exists", http.StatusConflict)
		case service.ErrPasswordTooShort:
			errors.WriteError(c, errors.ErrBadRequest, "password must be at least 8 characters", http.StatusBadRequest)
		default:
			errors.WriteError(c, errors.ErrInternal, "registration failed", http.StatusInternalServerError)
		}
		return
	}

	errors.WriteCreated(c, resp)
}

// Refresh validates a refresh token and issues new tokens.
func (h *Handler) Refresh(c *gin.Context) {
	var req models.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request body", http.StatusBadRequest)
		return
	}

	resp, err := h.svc.Refresh(c.Request.Context(), &req)
	if err != nil {
		switch err {
		case service.ErrInvalidRefreshToken:
			errors.WriteError(c, errors.ErrUnauthorized, "invalid or expired refresh token", http.StatusUnauthorized)
		case service.ErrUserDisabled:
			errors.WriteError(c, errors.ErrForbidden, "account is disabled", http.StatusForbidden)
		case service.ErrUserSuspended:
			errors.WriteError(c, errors.ErrForbidden, "account is suspended", http.StatusForbidden)
		default:
			errors.WriteError(c, errors.ErrInternal, "token refresh failed", http.StatusInternalServerError)
		}
		return
	}

	errors.WriteSuccess(c, resp)
}

// Logout invalidates tokens.
func (h *Handler) Logout(c *gin.Context) {
	var req models.LogoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Accept empty body; just proceed with silent logout
		req = models.LogoutRequest{}
	}

	if err := h.svc.Logout(c.Request.Context(), &req); err != nil {
		errors.WriteError(c, errors.ErrInternal, "logout failed", http.StatusInternalServerError)
		return
	}

	errors.WriteSuccess(c, gin.H{"message": "logged out successfully"})
}

// Me returns the current user's profile.
func (h *Handler) Me(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	resp, err := h.svc.GetProfile(c.Request.Context(), tenantID, userID)
	if err != nil {
		if err == service.ErrUserNotFound {
			errors.WriteError(c, errors.ErrNotFound, "user not found", http.StatusNotFound)
			return
		}
		errors.WriteError(c, errors.ErrInternal, "failed to get profile", http.StatusInternalServerError)
		return
	}

	errors.WriteSuccess(c, resp)
}