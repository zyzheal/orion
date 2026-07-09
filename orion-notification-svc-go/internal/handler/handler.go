package handler

import (
	"net/http"
	"strconv"

	"orion/notification-svc-go/internal/models"
	"orion/notification-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for the notification service.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all notification endpoints onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Notifications
	n := rg.Group("/notifications")
	n.POST("", auth.RequirePermission("notification", "write"), h.Send)
	n.GET("", h.List)
	n.GET("/count", h.Count)
	n.GET("/unread-count", h.GetUnreadCount)
	n.GET("/:id", h.Get)
	n.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.Delete)
	n.POST("/:id/read", auth.RequirePermission("notification", "write"), h.MarkAsRead)
	n.POST("/broadcast", auth.RequirePermission("notification", "write"), h.Broadcast)

	// Templates
	t := rg.Group("/templates")
	t.POST("", auth.RequirePermission("notification", "write"), h.CreateTemplate)
	t.GET("", h.ListTemplates)
	t.GET("/:id", h.GetTemplate)
	t.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.DeleteTemplate)

	// Channels
	c := rg.Group("/channels")
	c.POST("", auth.RequirePermission("notification", "write"), h.CreateChannel)
	c.GET("", h.ListChannels)
	c.GET("/:id", h.GetChannel)
	c.PUT("/:id", auth.RequirePermission("notification", "write"), h.UpdateChannel)
	c.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.DeleteChannel)

	// Settings
	s := rg.Group("/settings")
	s.GET("", h.GetSettings)
	s.PUT("", auth.RequirePermission("notification", "write"), h.UpdateSettings)

	// Settings by user_id (frontend compatibility)
	s2 := rg.Group("/notifications/settings")
	s2.GET("/:user_id", h.GetSettings)
	s2.PUT("/:user_id", auth.RequirePermission("notification", "write"), h.UpdateSettings)

	// Subscriptions
	sub := rg.Group("/subscriptions")
	sub.GET("", h.GetSubscriptions)
	sub.POST("", auth.RequirePermission("notification", "write"), h.Subscribe)
	sub.DELETE("/:channel", auth.RequirePermission("notification", "delete"), h.Unsubscribe)
}

// ---- Notification Handlers ----

// Send handles POST /notifications - create and dispatch a notification.
func (h *Handler) Send(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.TenantID == "" {
		req.TenantID = tenantID
	}

	n, err := h.svc.SendNotification(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": n})
}

// List handles GET /notifications - list notifications with optional filters.
func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var opts models.ListNotificationsQuery
	if err := c.ShouldBindQuery(&opts); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	items, total, err := h.svc.ListNotifications(c.Request.Context(), tenantID, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"data":  items,
		"total": total,
		"page":  opts.Page,
	})
}

// Get handles GET /notifications/:id - get a single notification.
func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	n, err := h.svc.GetNotification(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "notification not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": n})
}

// MarkAsRead handles POST /notifications/:id/read - mark notification as read.
func (h *Handler) MarkAsRead(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	n, err := h.svc.MarkAsRead(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrNotificationNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": n})
}

// GetUnreadCount handles GET /notifications/unread-count - get unread count for user.
func (h *Handler) GetUnreadCount(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter is required"})
		return
	}

	count, err := h.svc.GetUnreadCount(c.Request.Context(), tenantID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// Broadcast handles POST /notifications/broadcast - send to multiple users.
func (h *Handler) Broadcast(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.BroadcastRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	count, err := h.svc.Broadcast(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"sent": count})
}

// Delete handles DELETE /notifications/:id.
func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// Count handles GET /notifications/count.
func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ---- Template Handlers ----

// CreateTemplate handles POST /templates.
func (h *Handler) CreateTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var t models.NotificationTemplate
	if err := c.ShouldBindJSON(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.CreateTemplate(c.Request.Context(), tenantID, &t); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": t})
}

// ListTemplates handles GET /templates.
func (h *Handler) ListTemplates(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListTemplates(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// GetTemplate handles GET /templates/:id.
func (h *Handler) GetTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	t, err := h.svc.GetTemplate(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "template not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": t})
}

// DeleteTemplate handles DELETE /templates/:id.
func (h *Handler) DeleteTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteTemplate(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ---- Channel Handlers ----

// CreateChannel handles POST /channels.
func (h *Handler) CreateChannel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var ch models.NotificationChannel
	if err := c.ShouldBindJSON(&ch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.CreateChannel(c.Request.Context(), tenantID, &ch); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": ch})
}

// ListChannels handles GET /channels.
func (h *Handler) ListChannels(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListChannels(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// GetChannel handles GET /channels/:id.
func (h *Handler) GetChannel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ch, err := h.svc.GetChannel(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ch})
}

// UpdateChannel handles PUT /channels/:id.
func (h *Handler) UpdateChannel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var ch models.NotificationChannel
	if err := c.ShouldBindJSON(&ch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ch.ID = c.Param("id")
	if err := h.svc.UpdateChannel(c.Request.Context(), tenantID, &ch); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ch})
}

// DeleteChannel handles DELETE /channels/:id.
func (h *Handler) DeleteChannel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteChannel(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ---- Settings Handlers ----

// GetSettings handles GET /settings - get notification preferences for a user.
func (h *Handler) GetSettings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter is required"})
		return
	}

	settings, err := h.svc.GetSettings(c.Request.Context(), tenantID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": settings})
}

// UpdateSettings handles PUT /settings - update notification preferences.
func (h *Handler) UpdateSettings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter is required"})
		return
	}

	var req models.UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	settings, err := h.svc.UpdateSettings(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": settings})
}

// ---- Subscription Handlers ----

// GetSubscriptions handles GET /subscriptions - list user's channel subscriptions.
func (h *Handler) GetSubscriptions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter is required"})
		return
	}

	subs, err := h.svc.GetSubscriptions(c.Request.Context(), tenantID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": subs})
}

// Subscribe handles POST /subscriptions - subscribe to a channel.
func (h *Handler) Subscribe(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter is required"})
		return
	}

	var req models.SubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sub, err := h.svc.Subscribe(c.Request.Context(), tenantID, userID, req.Channel, req.Enabled)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": sub})
}

// Unsubscribe handles DELETE /subscriptions/:channel - unsubscribe from a channel.
func (h *Handler) Unsubscribe(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter is required"})
		return
	}

	if err := h.svc.Unsubscribe(c.Request.Context(), tenantID, userID, c.Param("channel")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unsubscribed"})
}

// helper for string pointer
func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	v, _ := strconv.Atoi(s)
	_ = v
	return &s
}
