package handler

import (
	"orion/notification-svc-go/internal/notification/models"
	"orion/notification-svc-go/internal/notification/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// DeliveryHandler exposes HTTP endpoints for notification delivery tracking.
type DeliveryHandler struct {
	deliverySvc *service.DeliveryService
}

// NewDeliveryHandler creates a new DeliveryHandler.
func NewDeliveryHandler(deliverySvc *service.DeliveryService) *DeliveryHandler {
	return &DeliveryHandler{deliverySvc: deliverySvc}
}

// RegisterRoutes mounts all delivery tracking endpoints onto the given router group.
func (h *DeliveryHandler) RegisterRoutes(rg *gin.RouterGroup) {
	deliveries := rg.Group("/deliveries")
	deliveries.Use(auth.RequirePermission("notification", "write"))
	{
		deliveries.GET("", h.List)
		deliveries.GET("/:id", h.Get)
		deliveries.POST("/:id/retry", h.Retry)
	}
}

// List handles GET /deliveries - list deliveries with optional filters.
func (h *DeliveryHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	notificationID := c.Query("notification_id")
	status := c.Query("status")

	var items []models.NotificationDelivery
	var err error

	if notificationID != "" {
		items, err = h.deliverySvc.GetDeliveryHistory(c.Request.Context(), tenantID, notificationID)
	} else {
		// For now, return all deliveries; in production add pagination
		items, err = h.deliverySvc.GetPendingDeliveries(c.Request.Context(), tenantID, 100)
		_ = status
	}

	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// Get handles GET /deliveries/:id - get a single delivery record.
func (h *DeliveryHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	delivery, err := h.deliverySvc.GetDeliveryByID(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "delivery not found")
		return
	}
	respondSuccess(c, delivery)
}

// Retry handles POST /deliveries/:id/retry - retry a failed delivery.
func (h *DeliveryHandler) Retry(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	delivery, err := h.deliverySvc.RetryDelivery(c.Request.Context(), tenantID, id)
	if err != nil {
		if err == service.ErrDeliveryNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, delivery)
}