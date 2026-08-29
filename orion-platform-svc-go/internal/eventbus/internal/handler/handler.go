package handler

import (
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.uber.org/zap"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/eventbus/internal/models"
	"orion/platform-svc-go/internal/eventbus/internal/service"
)

// Handler exposes REST endpoints for the Event Bus domain.
type Handler struct {
	svc    *service.Service
	logger *zap.Logger
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service, logger *zap.Logger) *Handler {
	return &Handler{svc: svc, logger: logger}
}

// RegisterRoutes wires all Event Bus routes under the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Subscription routes
	subs := rg.Group("/subscriptions")
	subs.POST("", auth.RequirePermission("event_bus", "write"), h.Subscribe)
	subs.GET("", auth.RequirePermission("event_bus", "read"), h.ListSubscriptions)
	subs.GET("/count", auth.RequirePermission("event_bus", "read"), h.CountSubscriptions)
	subs.GET("/:id", auth.RequirePermission("event_bus", "read"), h.GetSubscription)
	subs.PATCH("/:id", auth.RequirePermission("event_bus", "write"), h.UpdateSubscription)
	subs.DELETE("/:id", auth.RequirePermission("event_bus", "delete"), h.Unsubscribe)

	// Event routes
	events := rg.Group("/events")
	events.POST("", auth.RequirePermission("event_bus", "write"), h.PublishEvent)
	events.GET("", auth.RequirePermission("event_bus", "read"), h.ListEvents)
	events.GET("/stats", auth.RequirePermission("event_bus", "read"), h.GetEventStats)
	events.GET("/:id", auth.RequirePermission("event_bus", "read"), h.GetEvent)
	events.PATCH("/:id/process", auth.RequirePermission("event_bus", "write"), h.MarkEventProcessed)
	events.POST("/retry", auth.RequirePermission("event_bus", "write"), h.RetryPendingEvents)

	// Config routes (aligned with TS EventBusConfigRepository)
	configs := rg.Group("/configs")
	configs.GET("", auth.RequirePermission("event_bus", "read"), h.ListConfigs)
	configs.GET("/:key", auth.RequirePermission("event_bus", "read"), h.GetConfig)
	configs.PUT("/:key", auth.RequirePermission("event_bus", "admin"), h.UpsertConfig)
}

// ---------- Subscription handlers ----------

// Subscribe handles POST /subscriptions
func (h *Handler) Subscribe(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalSubscribe")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	sub, err := h.svc.Subscribe(ctx, tenantID, &req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidInput) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, sub)
}

// Unsubscribe handles DELETE /subscriptions/:id
func (h *Handler) Unsubscribe(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalUnsubscribe")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Unsubscribe(ctx, tenantID, id); err != nil {
		if errors.Is(err, service.ErrSubscriptionNotFound) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "unsubscribed"})
}

// UpdateSubscription handles PATCH /subscriptions/:id
func (h *Handler) UpdateSubscription(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalUpdateSubscription")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Enabled == nil {
		respondBadRequest(c, "enabled field is required")
		return
	}
	sub, err := h.svc.UpdateSubscriptionEnabled(ctx, tenantID, id, *req.Enabled)
	if err != nil {
		if errors.Is(err, service.ErrSubscriptionNotFound) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, sub)
}

// ListSubscriptions handles GET /subscriptions
func (h *Handler) ListSubscriptions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalListSubscriptions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var eventType *string
	if et := c.Query("event_type"); et != "" {
		eventType = &et
	}
	subs, err := h.svc.GetSubscriptions(ctx, tenantID, eventType)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, subs)
}

// GetSubscription handles GET /subscriptions/:id
func (h *Handler) GetSubscription(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalGetSubscription")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	sub, err := h.svc.GetSubscriptionByID(ctx, tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, sub)
}

// CountSubscriptions handles GET /subscriptions/count
func (h *Handler) CountSubscriptions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalCountSubscriptions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountSubscriptions(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

// ---------- Event handlers ----------

// PublishEvent handles POST /events
func (h *Handler) PublishEvent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalPublishEvent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.PublishEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	logEntry, err := h.svc.Publish(ctx, tenantID, &req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidInput) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, logEntry)
}

// ListEvents handles GET /events
func (h *Handler) ListEvents(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalListEvents")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	events, err := h.svc.GetEventHistory(ctx, tenantID, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, events)
}

// GetEventStats handles GET /events/stats
func (h *Handler) GetEventStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalGetEventStats")
	defer span.End()
	stats, err := h.svc.GetEventStats(ctx)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

// RetryPendingEvents handles POST /events/retry
func (h *Handler) RetryPendingEvents(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalRetryPendingEvents")
	defer span.End()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	maxRetry, _ := strconv.Atoi(c.DefaultQuery("max_retry", "3"))
	retried, err := h.svc.RetryPendingEvents(ctx, limit, maxRetry)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"retried": retried})
}

// GetEvent handles GET /events/:id
func (h *Handler) GetEvent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalGetEvent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	logEntry, err := h.svc.GetEventByID(ctx, tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, logEntry)
}

// MarkEventProcessed handles PATCH /events/:id/process
func (h *Handler) MarkEventProcessed(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalMarkEventProcessed")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.MarkEventProcessed(ctx, tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "marked as processed"})
}

// ---------- Config handlers (aligned with TS EventBusConfigRepository) ----------

// ListConfigs handles GET /configs
func (h *Handler) ListConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalListConfigs")
	defer span.End()
	configs, err := h.svc.Repo().GetAllConfigs(ctx)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, configs)
}

// GetConfig handles GET /configs/:key
func (h *Handler) GetConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalGetConfig")
	defer span.End()
	cfg, err := h.svc.Repo().FindConfigByKey(ctx, c.Param("key"))
	if err != nil {
		respondNotFound(c, "config not found")
		return
	}
	respondSuccess(c, cfg)
}

// UpsertConfig handles PUT /configs/:key
func (h *Handler) UpsertConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusInternalUpsertConfig")
	defer span.End()
	key := c.Param("key")
	var body struct {
		Value       models.JSONB `json:"value" binding:"required"`
		Description *string      `json:"description"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.Repo().UpsertConfig(ctx, key, body.Value, body.Description)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, cfg)
}
