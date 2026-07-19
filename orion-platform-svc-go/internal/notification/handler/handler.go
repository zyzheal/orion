package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/notification/models"
	"orion/platform-svc-go/internal/notification/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

// Service defines the methods the handler calls on the notification service.
type Service interface {
	List(ctx context.Context, tenantID string, filter *models.ListFilter, page int, pageSize int) ([]models.Notification, int, error)
	GetStats(ctx context.Context, tenantID string) (*models.NotificationStats, error)
	Create(ctx context.Context, tenantID string, userID string, req *models.CreateNotificationRequest) (*models.Notification, error)
	Count(ctx context.Context, tenantID string) (int, error)
	Get(ctx context.Context, tenantID string, id string) (*models.Notification, error)
	Update(ctx context.Context, tenantID string, id string, req *models.UpdateNotificationRequest) (*models.Notification, error)
	Delete(ctx context.Context, tenantID string, id string) (bool, error)
	MarkRead(ctx context.Context, tenantID string, id string) error
	MarkAllRead(ctx context.Context, tenantID string, userID string) error
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all notification endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/notifications")

	// GET /notifications - List notifications
	f.GET("", auth.RequirePermission("notification", "read"), h.List)
	// GET /notifications/stats - Get notification statistics
	f.GET("/stats", auth.RequirePermission("notification", "read"), h.GetStats)
	// POST /notifications - Create a notification
	f.POST("", auth.RequirePermission("notification", "write"), h.Create)
	// GET /notifications/count - Get total notification count
	f.GET("/count", auth.RequirePermission("notification", "read"), h.Count)
	// GET /notifications/:id - Get notification by ID
	f.GET("/:id", auth.RequirePermission("notification", "read"), h.Get)
	// PUT /notifications/:id - Update notification
	f.PUT("/:id", auth.RequirePermission("notification", "write"), h.Update)
	// DELETE /notifications/:id - Delete notification
	f.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.Delete)
	// POST /notifications/:id/read - Mark notification as read
	f.POST("/:id/read", auth.RequirePermission("notification", "write"), h.MarkRead)
	// POST /notifications/read-all - Mark all notifications as read
	f.POST("/read-all", auth.RequirePermission("notification", "write"), h.MarkAllRead)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// List handles GET /notifications
func (h *Handler) List(c *gin.Context) {
	tenantID := h.getTenantID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	filter := &models.ListFilter{}
	if v := c.Query("notificationType"); v != "" {
		filter.NotificationType = &v
	}
	if v := c.Query("channel"); v != "" {
		filter.Channel = &v
	}
	if v := c.Query("status"); v != "" {
		filter.Status = &v
	}
	if v := c.Query("priority"); v != "" {
		filter.Priority = &v
	}
	if v := c.Query("read"); v != "" {
		readVal := v == "true"
		filter.Read = &readVal
	}
	if v := c.Query("userId"); v != "" {
		filter.UserID = &v
	}

	notifications, total, err := h.svc.List(c.Request.Context(), tenantID, filter, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     notifications,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// GetStats handles GET /notifications/stats
func (h *Handler) GetStats(c *gin.Context) {
	tenantID := h.getTenantID(c)
	stats, err := h.svc.GetStats(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// Create handles POST /notifications
func (h *Handler) Create(c *gin.Context) {
	var req models.CreateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "00000000-0000-0000-0000-000000000000"
	}
	n, err := h.svc.Create(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		if err == service.ErrInvalidInput {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, n)
}

// Count handles GET /notifications/count
func (h *Handler) Count(c *gin.Context) {
	tenantID := h.getTenantID(c)
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

// Get handles GET /notifications/:id
func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	n, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "notification not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, n)
}

// Update handles PUT /notifications/:id
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	n, err := h.svc.Update(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "notification not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, n)
}

// Delete handles DELETE /notifications/:id
func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.Delete(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "notification not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "notification deleted"})
}

// MarkRead handles POST /notifications/:id/read
func (h *Handler) MarkRead(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	err := h.svc.MarkRead(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "notification not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "notification marked as read"})
}

// MarkAllRead handles POST /notifications/read-all
func (h *Handler) MarkAllRead(c *gin.Context) {
	tenantID := h.getTenantID(c)
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "00000000-0000-0000-0000-000000000000"
	}
	err := h.svc.MarkAllRead(c.Request.Context(), tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "all notifications marked as read"})
}
