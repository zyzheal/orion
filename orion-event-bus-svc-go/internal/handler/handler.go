package handler

import (
	"errors"
	"net/http"
	"strconv"

	"orion/event-bus-svc-go/internal/models"
	"orion/event-bus-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler exposes REST endpoints for the Event Bus domain.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes wires all Event Bus routes under the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Subscription routes
	subs := rg.Group("/subscriptions")
	subs.POST("", auth.RequirePermission("event_bus", "write"), h.Subscribe)
	subs.GET("", h.ListSubscriptions)
	subs.GET("/count", h.CountSubscriptions)
	subs.GET("/:id", h.GetSubscription)
	subs.PATCH("/:id", auth.RequirePermission("event_bus", "write"), h.UpdateSubscription)
	subs.DELETE("/:id", auth.RequirePermission("event_bus", "delete"), h.Unsubscribe)

	// Event routes
	events := rg.Group("/events")
	events.POST("", auth.RequirePermission("event_bus", "write"), h.PublishEvent)
	events.GET("", h.ListEvents)
	events.GET("/:id", h.GetEvent)
	events.PATCH("/:id/process", auth.RequirePermission("event_bus", "write"), h.MarkEventProcessed)
}

// ---------- Subscription handlers ----------

// Subscribe handles POST /subscriptions
func (h *Handler) Subscribe(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sub, err := h.svc.Subscribe(c.Request.Context(), tenantID, &req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidInput) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, sub)
}

// Unsubscribe handles DELETE /subscriptions/:id
func (h *Handler) Unsubscribe(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Unsubscribe(c.Request.Context(), tenantID, id); err != nil {
		if errors.Is(err, service.ErrSubscriptionNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unsubscribed"})
}

// UpdateSubscription handles PATCH /subscriptions/:id
func (h *Handler) UpdateSubscription(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Enabled == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "enabled field is required"})
		return
	}
	sub, err := h.svc.UpdateSubscriptionEnabled(c.Request.Context(), tenantID, id, *req.Enabled)
	if err != nil {
		if errors.Is(err, service.ErrSubscriptionNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sub)
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": subs})
}

// GetSubscription handles GET /subscriptions/:id
func (h *Handler) GetSubscription(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	sub, err := h.svc.GetSubscriptionByID(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sub)
}

// CountSubscriptions handles GET /subscriptions/count
func (h *Handler) CountSubscriptions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountSubscriptions(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ---------- Event handlers ----------

// PublishEvent handles POST /events
func (h *Handler) PublishEvent(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.PublishEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	logEntry, err := h.svc.Publish(c.Request.Context(), tenantID, &req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidInput) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, logEntry)
}

// ListEvents handles GET /events
func (h *Handler) ListEvents(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	events, err := h.svc.GetEventHistory(c.Request.Context(), tenantID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": events})
}

// GetEvent handles GET /events/:id
func (h *Handler) GetEvent(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	logEntry, err := h.svc.GetEventByID(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, logEntry)
}

// MarkEventProcessed handles PATCH /events/:id/process
func (h *Handler) MarkEventProcessed(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.MarkEventProcessed(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "marked as processed"})
}
