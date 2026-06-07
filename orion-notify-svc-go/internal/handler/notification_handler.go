package handler

import (
	"net/http"
	"strconv"

	"orion/notify-svc-go/internal/models"
	"orion/notify-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

// NotificationHandler handles HTTP requests for notifications and settings.
type NotificationHandler struct {
	notifySvc   *service.NotificationService
	settingsSvc *service.SettingsService
}

func NewNotificationHandler(notifySvc *service.NotificationService, settingsSvc *service.SettingsService) *NotificationHandler {
	return &NotificationHandler{notifySvc: notifySvc, settingsSvc: settingsSvc}
}

// RegisterRoutes registers notification and settings routes under the given router group.
func (h *NotificationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	// Notification endpoints
	n := rg.Group("/notifications")
	n.POST("", h.Send)
	n.GET("", h.List)
	n.POST("/:id/read", h.MarkAsRead)
	n.GET("/unread-count", h.GetUnreadCount)
	n.POST("/broadcast", h.Broadcast)

	// Notification settings endpoints
	s := rg.Group("/notification-settings")
	s.GET("", h.GetSettings)
	s.PUT("", h.UpdateSettings)
}

// Send creates a new in-app notification.
// POST /api/v1/notifications
func (h *NotificationHandler) Send(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	n, err := h.notifySvc.Send(c.Request.Context(), tenantID, &req)
	if err != nil {
		if err == service.ErrInvalidInput {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, n)
}

// List returns paginated notifications for a user.
// GET /api/v1/notifications?user_id=xxx&page=1&page_size=20
func (h *NotificationHandler) List(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter is required"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	resp, err := h.notifySvc.GetNotifications(c.Request.Context(), userID, pageSize, page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// MarkAsRead marks a notification as read.
// POST /api/v1/notifications/:id/read
func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
	id := c.Param("id")
	n, err := h.notifySvc.MarkAsRead(c.Request.Context(), id)
	if err != nil {
		if err == service.ErrNotificationNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, n)
}

// GetUnreadCount returns the number of unread notifications for a user.
// GET /api/v1/notifications/unread-count?user_id=xxx
func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter is required"})
		return
	}

	count, err := h.notifySvc.GetUnreadCount(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// Broadcast creates a notification for multiple users.
// POST /api/v1/notifications/broadcast
func (h *NotificationHandler) Broadcast(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.BroadcastNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	count, err := h.notifySvc.Broadcast(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// GetSettings returns the notification settings for the authenticated user.
// GET /api/v1/notification-settings
func (h *NotificationHandler) GetSettings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter is required"})
		return
	}

	settings, err := h.settingsSvc.GetSettings(c.Request.Context(), userID, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settings)
}

// UpdateSettings updates the notification settings for the authenticated user.
// PUT /api/v1/notification-settings
func (h *NotificationHandler) UpdateSettings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter is required"})
		return
	}

	var req models.UpdateNotificationSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	settings, err := h.settingsSvc.UpdateSettings(c.Request.Context(), userID, tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settings)
}
