package handler

import (
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/webhook/store/models"
	"orion/platform-svc-go/internal/webhook/store/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
	"orion/go-common/pkg/sentinel"
)

// Handler exposes HTTP endpoints for the unified webhook config store.
// It replaces 30 individual webhook-* handlers with a single handler scoped
// by the :domain path parameter.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all webhook-config endpoints.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/webhook-config")
	r.GET("/:domain", auth.RequirePermission("webhook-config", "read"), h.ListByDomain)
	r.GET("/:domain/:id", auth.RequirePermission("webhook-config", "read"), h.Get)
	r.POST("/:domain", auth.RequirePermission("webhook-config", "write"), h.Create)
	r.PUT("/:domain/:id", auth.RequirePermission("webhook-config", "write"), h.Update)
	r.DELETE("/:domain/:id", auth.RequirePermission("webhook-config", "delete"), h.Delete)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	if tid := c.GetString("tenant_id"); tid != "" {
		return tid
	}
	return "00000000-0000-0000-0000-000000000000"
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateWebhookConfig")
	defer span.End()
	tenantID := h.getTenantID(c)
	domain := c.Param("domain")
	var req models.CreateConfigEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.Create(ctx, tenantID, domain, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetWebhookConfig")
	defer span.End()
	tenantID := h.getTenantID(c)
	result, err := h.svc.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), 404)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListByDomain(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListWebhookConfigByDomain")
	defer span.End()
	tenantID := h.getTenantID(c)
	domain := c.Param("domain")
	results, err := h.svc.ListByDomain(ctx, tenantID, domain)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, results)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := h.getTenantID(c)
	var req models.UpdateConfigEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := h.getTenantID(c)
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": "deleted"})
}