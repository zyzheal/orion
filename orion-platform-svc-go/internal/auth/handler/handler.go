package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/auth/models"
	"orion/platform-svc-go/internal/auth/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
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
func NewHandler(svc service.ServiceInterface) *Handler {
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

	// Auth config endpoints (JWT required)
	protected.GET("/auth/providers", h.ListProviders)
	protected.GET("/auth/policies", h.ListPolicies)
	protected.POST("/auth/providers", h.CreateProvider)
}

// Login authenticates a user and returns tokens.
func (h *Handler) Login(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Login")
	defer span.End()
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request body", http.StatusBadRequest)
		return
	}

	requestedTenantID := c.GetHeader("X-Tenant-ID")

	resp, err := h.svc.Login(ctx, &req, requestedTenantID)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Register")
	defer span.End()
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request body", http.StatusBadRequest)
		return
	}

	requestedTenantID := c.GetHeader("X-Tenant-ID")

	resp, err := h.svc.Register(ctx, &req, requestedTenantID)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Refresh")
	defer span.End()
	var req models.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request body", http.StatusBadRequest)
		return
	}

	resp, err := h.svc.Refresh(ctx, &req)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Logout")
	defer span.End()
	var req models.LogoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Accept empty body; just proceed with silent logout
		req = models.LogoutRequest{}
	}

	if err := h.svc.Logout(ctx, &req); err != nil {
		errors.WriteError(c, errors.ErrInternal, "logout failed", http.StatusInternalServerError)
		return
	}

	errors.WriteSuccess(c, gin.H{"message": "logged out successfully"})
}

// Me returns the current user's profile.
func (h *Handler) Me(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Me")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	resp, err := h.svc.GetProfile(ctx, tenantID, userID)
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

// ---------------------------------------------------------------------------
// Auth Config endpoints - providers and policies
// ---------------------------------------------------------------------------

// ListProviders returns all configured authentication providers.
func (h *Handler) ListProviders(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	providers := defaultProviders(tenantID)
	errors.WriteSuccess(c, providers)
}

// ListPolicies returns all configured authentication policies.
func (h *Handler) ListPolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policies := defaultPolicies(tenantID)
	errors.WriteSuccess(c, policies)
}

// CreateProvider creates a new authentication provider configuration.
func (h *Handler) CreateProvider(c *gin.Context) {
	var req models.CreateProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request body", http.StatusBadRequest)
		return
	}

	now := time.Now().UTC()
	provider := &models.AuthProvider{
		ID:           uuid.New().String(),
		Name:         req.Name,
		Type:         req.Type,
		Status:       "inactive",
		ClientID:     req.ClientID,
		ClientSecret: req.ClientSecret,
		DiscoveryURL: req.DiscoveryURL,
		LDAPHost:     req.LDAPHost,
		LDAPBaseDN:   req.LDAPBaseDN,
		TenantID:     c.GetString("tenant_id"),
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	errors.WriteSuccess(c, provider)
}

// defaultProviders returns built-in demo provider data.
func defaultProviders(tenantID string) []models.AuthProvider {
	return []models.AuthProvider{
		{
			ID: "prov-oauth2-001", Name: "GitHub OAuth", Type: "oauth2", Status: "active",
			ClientID: "***", DiscoveryURL: "https://github.com/login/oauth",
			TenantID: tenantID, CreatedAt: time.Now().Add(-30 * 24 * time.Hour).UTC(), UpdatedAt: time.Now().UTC(),
		},
		{
			ID: "prov-oidc-001", Name: "Google Workspace OIDC", Type: "oidc", Status: "active",
			ClientID: "***", DiscoveryURL: "https://accounts.google.com/.well-known/openid-configuration",
			TenantID: tenantID, CreatedAt: time.Now().Add(-25 * 24 * time.Hour).UTC(), UpdatedAt: time.Now().UTC(),
		},
		{
			ID: "prov-saml-001", Name: "Azure AD SAML", Type: "saml", Status: "active",
			DiscoveryURL: "https://login.microsoftonline.com/common/saml/metadata",
			TenantID: tenantID, CreatedAt: time.Now().Add(-20 * 24 * time.Hour).UTC(), UpdatedAt: time.Now().UTC(),
		},
		{
			ID: "prov-ldap-001", Name: "Company LDAP", Type: "ldap", Status: "active",
			LDAPHost: "ldap.company.internal:389", LDAPBaseDN: "dc=company,dc=com",
			TenantID: tenantID, CreatedAt: time.Now().Add(-45 * 24 * time.Hour).UTC(), UpdatedAt: time.Now().UTC(),
		},
		{
			ID: "prov-mfa-001", Name: "TOTP MFA", Type: "mfa", Status: "active",
			TenantID: tenantID, CreatedAt: time.Now().Add(-60 * 24 * time.Hour).UTC(), UpdatedAt: time.Now().UTC(),
		},
	}
}

// defaultPolicies returns built-in demo policy data.
func defaultPolicies(tenantID string) []models.AuthPolicy {
	return []models.AuthPolicy{
		{
			ID: "pol-mfa-001", Name: "MFA Required", Description: "Require MFA for all admin users",
			Enabled: true, Scope: "admin", TenantID: tenantID,
			CreatedAt: time.Now().Add(-30 * 24 * time.Hour).UTC(), UpdatedAt: time.Now().UTC(),
		},
		{
			ID: "pol-session-001", Name: "Session Timeout", Description: "Force logout after 2h inactivity",
			Enabled: true, Scope: "all", TenantID: tenantID,
			CreatedAt: time.Now().Add(-25 * 24 * time.Hour).UTC(), UpdatedAt: time.Now().UTC(),
		},
		{
			ID: "pol-password-001", Name: "Password Complexity", Description: "Minimum 12 chars, 2 special, 1 number",
			Enabled: true, Scope: "all", TenantID: tenantID,
			CreatedAt: time.Now().Add(-20 * 24 * time.Hour).UTC(), UpdatedAt: time.Now().UTC(),
		},
		{
			ID: "pol-sso-001", Name: "SSO Redirect", Description: "Auto-redirect to SSO for known IdPs",
			Enabled: false, Scope: "external", TenantID: tenantID,
			CreatedAt: time.Now().Add(-15 * 24 * time.Hour).UTC(), UpdatedAt: time.Now().UTC(),
		},
	}
}
