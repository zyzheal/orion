package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/webhook/models"
	"orion/platform-svc-go/internal/webhook/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes HTTP handlers for webhook endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all webhook endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/webhooks")

	// Webhook CRUD
	f.GET("", auth.RequirePermission("webhook", "read"), h.List)
	f.POST("", auth.RequirePermission("webhook", "write"), h.Create)
	f.GET("/count", auth.RequirePermission("webhook", "read"), h.Count)
	f.GET("/:id", auth.RequirePermission("webhook", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("webhook", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("webhook", "delete"), h.Delete)

	// Webhook actions
	f.POST("/:id/trigger", auth.RequirePermission("webhook", "execute"), h.Trigger)
	f.POST("/trigger-event", auth.RequirePermission("webhook", "execute"), h.TriggerByEvent)
	f.POST("/:id/rotate-secret", auth.RequirePermission("webhook", "write"), h.RotateSecret)

	// Deliveries
	f.GET("/:id/deliveries", auth.RequirePermission("webhook", "read"), h.ListDeliveries)
}

// getTenantID extracts tenant_id from the Gin context.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

// getUserID extracts user_id from the Gin context.
func (h *Handler) getUserID(c *gin.Context) string {
	userID := c.GetString("user_id")
	if userID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return userID
}

// parsePagination reads page and pageSize from query parameters.
func parsePagination(c *gin.Context) (int, int) {
	page := 1
	pageSize := 20
	if p, err := strconv.Atoi(c.Query("page")); err == nil && p > 0 {
		page = p
	}
	if ps, err := strconv.Atoi(c.Query("pageSize")); err == nil && ps > 0 {
		pageSize = ps
	}
	return page, pageSize
}

// --- Webhook CRUD handlers ---

// List handles GET /webhooks
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := h.getTenantID(c)
	page, pageSize := parsePagination(c)

	filter := &models.ListFilter{}
	if et := c.Query("event_type"); et != "" {
		filter.EventType = &et
	}
	if en := c.Query("enabled"); en != "" {
		enabled := en == "true"
		filter.Enabled = &enabled
	}

	webhooks, total, err := h.svc.List(ctx, tenantID, filter, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     webhooks,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// Create handles POST /webhooks
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	var req models.CreateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	w, err := h.svc.Create(ctx, tenantID, userID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, w)
}

// Get handles GET /webhooks/:id
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	w, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, w)
}

// Update handles PUT /webhooks/:id
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	w, err := h.svc.Update(ctx, tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, w)
}

// Delete handles DELETE /webhooks/:id
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "webhook deleted"})
}

// Count handles GET /webhooks/count
func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Count")
	defer span.End()
	tenantID := h.getTenantID(c)
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

// --- Webhook action handlers ---

// Trigger handles POST /webhooks/:id/trigger
func (h *Handler) Trigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Trigger")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	if err := h.svc.Trigger(ctx, tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "webhook triggered"})
}

// TriggerByEvent handles POST /webhooks/trigger-event?event_type=xxx
func (h *Handler) TriggerByEvent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TriggerByEvent")
	defer span.End()
	eventType := c.Query("event_type")
	if eventType == "" {
		middleware.RespondBadRequest(c, "event_type query parameter is required")
		return
	}
	tenantID := h.getTenantID(c)
	if err := h.svc.TriggerByEvent(ctx, tenantID, eventType); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "webhooks triggered by event"})
}

// RotateSecret handles POST /webhooks/:id/rotate-secret
func (h *Handler) RotateSecret(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RotateSecret")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	secret, err := h.svc.RotateSecret(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"secret": secret})
}

// --- Delivery handlers ---

// ListDeliveries handles GET /webhooks/:id/deliveries
func (h *Handler) ListDeliveries(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDeliveries")
	defer span.End()
	webhookID := c.Param("id")
	// Verify the webhook exists and belongs to the tenant.
	tenantID := h.getTenantID(c)
	if _, err := h.svc.Get(ctx, tenantID, webhookID); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	page, pageSize := parsePagination(c)

	deliveries, total, err := h.svc.ListDeliveries(ctx, tenantID, webhookID, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":     deliveries,
		"page":     page,
		"pageSize": pageSize,
		"total":    total,
	})
}
