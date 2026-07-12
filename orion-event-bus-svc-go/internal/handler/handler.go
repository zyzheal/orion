package handler

import (
	"errors"
	"strconv"

	"orion/event-bus-svc-go/internal/models"
	"orion/event-bus-svc-go/internal/service"

	"orion/go-common/pkg/auth"
	"go.uber.org/zap"

	"github.com/gin-gonic/gin"
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
	tenantID := c.GetString("tenant_id")
	var req models.CreateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	sub, err := h.svc.Subscribe(c.Request.Context(), tenantID, &req)
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
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Unsubscribe(c.Request.Context(), tenantID, id); err != nil {
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
	sub, err := h.svc.UpdateSubscriptionEnabled(c.Request.Context(), tenantID, id, *req.Enabled)
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
	tenantID := c.GetString("tenant_id")
	var eventType *string
	if et := c.Query("event_type"); et != "" {
		eventType = &et
	}
	subs, err := h.svc.GetSubscriptions(c.Request.Context(), tenantID, eventType)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, subs)
}

// GetSubscription handles GET /subscriptions/:id
func (h *Handler) GetSubscription(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	sub, err := h.svc.GetSubscriptionByID(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, sub)
}

// CountSubscriptions handles GET /subscriptions/count
func (h *Handler) CountSubscriptions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountSubscriptions(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

// ---------- Event handlers ----------

// PublishEvent handles POST /events
func (h *Handler) PublishEvent(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.PublishEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	logEntry, err := h.svc.Publish(c.Request.Context(), tenantID, &req)
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
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	events, err := h.svc.GetEventHistory(c.Request.Context(), tenantID, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, events)
}

// GetEventStats handles GET /events/stats
func (h *Handler) GetEventStats(c *gin.Context) {
	stats, err := h.svc.GetEventStats(c.Request.Context())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

// RetryPendingEvents handles POST /events/retry
func (h *Handler) RetryPendingEvents(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	maxRetry, _ := strconv.Atoi(c.DefaultQuery("max_retry", "3"))
	retried, err := h.svc.RetryPendingEvents(c.Request.Context(), limit, maxRetry)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"retried": retried})
}

// GetEvent handles GET /events/:id
func (h *Handler) GetEvent(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	logEntry, err := h.svc.GetEventByID(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, logEntry)
}

// MarkEventProcessed handles PATCH /events/:id/process
func (h *Handler) MarkEventProcessed(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.MarkEventProcessed(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "marked as processed"})
}

// ---------- Config handlers (aligned with TS EventBusConfigRepository) ----------

// ListConfigs handles GET /configs
func (h *Handler) ListConfigs(c *gin.Context) {
	configs, err := h.svc.Repo().GetAllConfigs(c.Request.Context())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, configs)
}

// GetConfig handles GET /configs/:key
func (h *Handler) GetConfig(c *gin.Context) {
	cfg, err := h.svc.Repo().FindConfigByKey(c.Request.Context(), c.Param("key"))
	if err != nil {
		respondNotFound(c, "config not found")
		return
	}
	respondSuccess(c, cfg)
}

// UpsertConfig handles PUT /configs/:key
func (h *Handler) UpsertConfig(c *gin.Context) {
	key := c.Param("key")
	var body struct {
		Value       models.JSONB `json:"value" binding:"required"`
		Description *string      `json:"description"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.Repo().UpsertConfig(c.Request.Context(), key, body.Value, body.Description)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, cfg)
}