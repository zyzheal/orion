package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/secret/models"
	"orion/platform-svc-go/internal/secret/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

// Handler exposes HTTP handlers for secret management endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all secret endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/secrets")

	// Secret CRUD
	f.POST("", auth.RequirePermission("secret", "write"), h.Create)
	f.GET("", auth.RequirePermission("secret", "read"), h.List)
	f.POST("/resolve", auth.RequirePermission("secret", "read"), h.Resolve)
	f.GET("/:id", auth.RequirePermission("secret", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("secret", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("secret", "delete"), h.Delete)
	f.GET("/:id/references", auth.RequirePermission("secret", "read"), h.GetReferences)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

// getUserID extracts user_id from Gin context, falling back to a zero UUID.
func (h *Handler) getUserID(c *gin.Context) string {
	userID := c.GetString("user_id")
	if userID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return userID
}

// --- Secret CRUD handlers ---

// Create handles POST /secrets
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	var req models.CreateSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	secret, err := h.svc.Create(ctx, tenantID, userID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, secret)
}

// List handles GET /secrets
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := h.getTenantID(c)
	filter := &models.ListFilter{}
	if scope := c.Query("scope"); scope != "" {
		filter.Scope = &scope
	}
	secrets, err := h.svc.List(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": secrets})
}

// Resolve handles POST /secrets/resolve
func (h *Handler) Resolve(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Resolve")
	defer span.End()
	var req models.ResolveSecretsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.Resolve(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// Get handles GET /secrets/:id
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	id := c.Param("id")
	secret, err := h.svc.Get(ctx, id, c.GetString("tenant_id"))
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "secret not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": secret})
}

// Update handles PUT /secrets/:id
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	secret, err := h.svc.Update(ctx, tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "secret not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": secret})
}

// Delete handles DELETE /secrets/:id
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := h.getTenantID(c)
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "secret not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "secret deleted"})
}

// GetReferences handles GET /secrets/:id/references
func (h *Handler) GetReferences(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReferences")
	defer span.End()
	id := c.Param("id")
	sec, err := h.svc.GetReferences(ctx, id, c.GetString("tenant_id"))
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "secret not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	refPattern := "${secrets." + sec.Name + "}"
	middleware.RespondSuccess(c, gin.H{
		"data": gin.H{
			"secretName":       sec.Name,
			"referencePattern": refPattern,
			"pipelines":        []string{},
			"hint":             "在 Pipeline YAML 中搜索 \"" + refPattern + "\" 查找引用",
		},
	})
}
