package handler

import (
	"orion/platform-svc-go/internal/notification/notification/models"
	"orion/platform-svc-go/internal/notification/notification/service"

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
	n.GET("", auth.RequirePermission("notification", "read"), h.List)
	n.GET("/count", auth.RequirePermission("notification", "read"), h.Count)
	n.GET("/stats", auth.RequirePermission("notification", "read"), h.Stats)
	n.GET("/unread-count", auth.RequirePermission("notification", "read"), h.GetUnreadCount)
	n.GET("/:id", auth.RequirePermission("notification", "read"), h.Get)
	n.POST("", auth.RequirePermission("notification", "write"), h.Send)
	n.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.Delete)
	n.POST("/:id/read", auth.RequirePermission("notification", "write"), h.MarkAsRead)
	n.POST("/broadcast", auth.RequirePermission("notification", "write"), h.Broadcast)

	// Settings
	s := rg.Group("/settings")
	s.GET("", auth.RequirePermission("notification", "read"), h.GetSettings)
	s.PUT("", auth.RequirePermission("notification", "write"), h.UpdateSettings)

	// Settings by user_id (frontend compatibility)
	s2 := rg.Group("/notifications/settings")
	s2.GET("/:user_id", auth.RequirePermission("notification", "read"), h.GetSettings)
	s2.PUT("/:user_id", auth.RequirePermission("notification", "write"), h.UpdateSettings)

	// Subscriptions
	sub := rg.Group("/subscriptions")
	sub.GET("", auth.RequirePermission("notification", "read"), h.GetSubscriptions)
	sub.POST("", auth.RequirePermission("notification", "write"), h.Subscribe)
	sub.DELETE("/:channel", auth.RequirePermission("notification", "delete"), h.Unsubscribe)
}

// ---- Notification Handlers ----

// Send handles POST /notifications - create and dispatch a notification.
func (h *Handler) Send(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.TenantID == "" {
		req.TenantID = tenantID
	}

	n, err := h.svc.SendNotification(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, n)
}

// List handles GET /notifications - list notifications with optional filters.
func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var opts models.ListNotificationsQuery
	if err := c.ShouldBindQuery(&opts); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	items, total, err := h.svc.ListNotifications(c.Request.Context(), tenantID, opts)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{
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
		respondNotFound(c, "notification not found")
		return
	}
	respondSuccess(c, n)
}

// MarkAsRead handles POST /notifications/:id/read - mark notification as read.
func (h *Handler) MarkAsRead(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	n, err := h.svc.MarkAsRead(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrNotificationNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, n)
}

// GetUnreadCount handles GET /notifications/unread-count - get unread count for user.
func (h *Handler) GetUnreadCount(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		respondBadRequest(c, "user_id query parameter is required")
		return
	}

	count, err := h.svc.GetUnreadCount(c.Request.Context(), tenantID, userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

// Broadcast handles POST /notifications/broadcast - send to multiple users.
func (h *Handler) Broadcast(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.BroadcastRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	count, err := h.svc.Broadcast(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, gin.H{"sent": count})
}

// Delete handles DELETE /notifications/:id.
func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// Count handles GET /notifications/count.
func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

// Stats handles GET /notifications/stats.
func (h *Handler) Stats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.Stats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

// ---- Settings Handlers ----

// GetSettings handles GET /settings - get notification preferences for a user.
func (h *Handler) GetSettings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		respondBadRequest(c, "user_id query parameter is required")
		return
	}

	settings, err := h.svc.GetSettings(c.Request.Context(), tenantID, userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, settings)
}

// UpdateSettings handles PUT /settings - update notification preferences.
func (h *Handler) UpdateSettings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		respondBadRequest(c, "user_id query parameter is required")
		return
	}

	var req models.UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	settings, err := h.svc.UpdateSettings(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, settings)
}

// ---- Subscription Handlers ----

// GetSubscriptions handles GET /subscriptions - list user's channel subscriptions.
func (h *Handler) GetSubscriptions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		respondBadRequest(c, "user_id query parameter is required")
		return
	}

	subs, err := h.svc.GetSubscriptions(c.Request.Context(), tenantID, userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, subs)
}

// Subscribe handles POST /subscriptions - subscribe to a channel.
func (h *Handler) Subscribe(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		respondBadRequest(c, "user_id query parameter is required")
		return
	}

	var req models.SubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	sub, err := h.svc.Subscribe(c.Request.Context(), tenantID, userID, req.Channel, req.Enabled)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, sub)
}

// Unsubscribe handles DELETE /subscriptions/:channel - unsubscribe from a channel.
func (h *Handler) Unsubscribe(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Query("user_id")
	if userID == "" {
		respondBadRequest(c, "user_id query parameter is required")
		return
	}

	if err := h.svc.Unsubscribe(c.Request.Context(), tenantID, userID, c.Param("channel")); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "unsubscribed"})
}