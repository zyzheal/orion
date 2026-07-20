package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/api-market/models"
	"orion/platform-svc-go/internal/api-market/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all api-market endpoints under /market.
// Mirrors /api/v1/market routes from the TS source (14 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/market")

	// --- Products ---
	// POST /market/products - Create product
	f.POST("/products", auth.RequirePermission("api_market", "write"), h.CreateProduct)
	// GET /market/products - List products
	f.GET("/products", h.ListProducts)
	// GET /market/products/:id - Get product
	f.GET("/products/:id", h.GetProduct)
	// POST /market/products/:id/publish - Publish product
	f.POST("/products/:id/publish", auth.RequirePermission("api_market", "write"), h.PublishProduct)
	// DELETE /market/products/:id - Delete product
	f.DELETE("/products/:id", auth.RequirePermission("api_market", "delete"), h.DeleteProduct)

	// --- Developer Apps ---
	// POST /market/apps - Create app
	f.POST("/apps", auth.RequirePermission("api_market", "write"), h.CreateDeveloperApp)
	// GET /market/apps - List my apps
	f.GET("/apps", h.ListApps)
	// GET /market/apps/:id - Get app
	f.GET("/apps/:id", h.GetApp)

	// --- API Keys ---
	// POST /market/apps/:appId/keys - Generate API key
	f.POST("/apps/:appId/keys", auth.RequirePermission("api_market", "write"), h.GenerateAPIKey)
	// GET /market/apps/:appId/keys - List API keys
	f.GET("/apps/:appId/keys", h.ListAPIKeys)

	// --- Auth (public, no auth middleware) ---
	// POST /market/auth/token - Validate API key (public endpoint)
	f.POST("/auth/token", h.ValidateToken)

	// --- Subscriptions ---
	// GET /market/subscriptions/check - Check if app has access to product
	f.GET("/subscriptions/check", h.CheckSubscription)
	// POST /market/subscriptions - Subscribe to product
	f.POST("/subscriptions", auth.RequirePermission("api_market", "write"), h.Subscribe)
	// GET /market/subscriptions/:appId - List subscriptions
	f.GET("/subscriptions/:appId", h.ListSubscriptions)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// getOwnerID extracts user id from Gin context.
func (h *Handler) getOwnerID(c *gin.Context) string {
	ownerID := c.GetString("user_id")
	if ownerID == "" {
		// Fall back to tenant_id if no user_id set
		ownerID = h.getTenantID(c)
	}
	return ownerID
}

// --- Product handlers ---

func (h *Handler) CreateProduct(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateProduct")
	defer span.End()
	var req models.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	ownerID := h.getOwnerID(c)
	product, err := h.svc.CreateProduct(ctx, &req, ownerID, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, product)
}

func (h *Handler) ListProducts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListProducts")
	defer span.End()
	tenantID := h.getTenantID(c)
	products, err := h.svc.ListProducts(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, products)
}

func (h *Handler) GetProduct(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetProduct")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	product, err := h.svc.GetProduct(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "product not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, product)
}

func (h *Handler) PublishProduct(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PublishProduct")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	product, err := h.svc.PublishProduct(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "product not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, product)
}

func (h *Handler) DeleteProduct(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteProduct")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteProduct(ctx, id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "product not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "product deleted"})
}

// --- Developer App handlers ---

func (h *Handler) CreateDeveloperApp(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateDeveloperApp")
	defer span.End()
	var req models.CreateDeveloperAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	developerID := h.getOwnerID(c)
	app, err := h.svc.CreateDeveloperApp(ctx, &req, developerID, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, app)
}

func (h *Handler) ListApps(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListApps")
	defer span.End()
	tenantID := h.getTenantID(c)
	developerID := h.getOwnerID(c)
	apps, err := h.svc.ListAppsByDeveloper(ctx, tenantID, developerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, apps)
}

func (h *Handler) GetApp(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetApp")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	app, err := h.svc.GetApp(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "app not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, app)
}

// --- API Key handlers ---

func (h *Handler) GenerateAPIKey(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GenerateAPIKey")
	defer span.End()
	appID := c.Param("appId")
	var req models.GenerateAPIKeyRequest
	_ = c.ShouldBindJSON(&req) // scopes is optional, ignore bind errors
	tenantID := h.getTenantID(c)
	key, err := h.svc.GenerateAPIKey(ctx, appID, req.Scopes, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "app not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, key)
}

func (h *Handler) ListAPIKeys(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAPIKeys")
	defer span.End()
	appID := c.Param("appId")
	tenantID := h.getTenantID(c)
	keys, err := h.svc.ListAPIKeys(ctx, appID, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	// Return safe keys (without secrets)
	middleware.RespondSuccess(c, keys)
}

func (h *Handler) ValidateToken(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ValidateToken")
	defer span.End()
	var req models.ValidateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.ClientID == "" || req.ClientSecret == "" {
		middleware.RespondBadRequest(c, "clientId and clientSecret required")
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.ValidateAPIKey(ctx, tenantID, req.ClientID, req.ClientSecret)
	if err != nil {
		if err == service.ErrInvalidCredentials {
			middleware.RespondForbidden(c, "invalid credentials")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"valid":              true,
		"credentialId":       result.CredentialID,
		"appId":              result.AppID,
		"scopes":             result.Scopes,
		"rateLimitPerMin":    result.RateLimitPerMin,
	})
}

// --- Subscription handlers ---

func (h *Handler) CheckSubscription(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CheckSubscription")
	defer span.End()
	appID := c.Query("appId")
	productID := c.Query("productId")
	if appID == "" || productID == "" {
		middleware.RespondBadRequest(c, "appId and productId are required")
		return
	}
	tenantID := h.getTenantID(c)
	hasAccess, err := h.svc.CheckSubscription(ctx, appID, productID, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"appId":     appID,
		"productId": productID,
		"hasAccess": hasAccess,
	})
}

func (h *Handler) Subscribe(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Subscribe")
	defer span.End()
	var req models.SubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	err := h.svc.Subscribe(ctx, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "subscribed successfully"})
}

func (h *Handler) ListSubscriptions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSubscriptions")
	defer span.End()
	appID := c.Param("appId")
	tenantID := h.getTenantID(c)
	// Verify the user owns this app
	ownerID := h.getOwnerID(c)
	app, err := h.svc.GetApp(ctx, appID, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "app not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	// Check ownership (if developer_id is set and differs from user)
	if app.DeveloperID != nil && ownerID != "" && *app.DeveloperID != ownerID {
		middleware.RespondForbidden(c, "not authorized to view subscriptions for this app")
		return
	}
	subs, err := h.svc.ListSubscriptions(ctx, appID, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, subs)
}
