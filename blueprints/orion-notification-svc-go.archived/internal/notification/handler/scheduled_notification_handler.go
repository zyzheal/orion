package handler

import (
	"orion/notification-svc-go/internal/notification/models"
	"orion/notification-svc-go/internal/notification/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// ScheduledNotificationHandler exposes HTTP endpoints for scheduled notification management.
type ScheduledNotificationHandler struct {
	scheduledSvc *service.ScheduledNotificationService
}

// NewScheduledNotificationHandler creates a new ScheduledNotificationHandler.
func NewScheduledNotificationHandler(scheduledSvc *service.ScheduledNotificationService) *ScheduledNotificationHandler {
	return &ScheduledNotificationHandler{scheduledSvc: scheduledSvc}
}

// RegisterRoutes mounts all scheduled notification endpoints onto the given router group.
func (h *ScheduledNotificationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	scheduled := rg.Group("/scheduled-notifications")
	scheduled.Use(auth.RequirePermission("notification", "write"))
	{
		scheduled.POST("", h.Create)
		scheduled.GET("", h.List)
		scheduled.GET("/:id", h.Get)
		scheduled.PUT("/:id", h.Update)
		scheduled.PUT("/:id/toggle", h.Toggle)
		scheduled.POST("/:id/cancel", h.Cancel)
		scheduled.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.Delete)
	}

	// Cron validation endpoint (no write permission required)
	scheduled.GET("/validate-cron", auth.RequirePermission("notification", "read"), h.ValidateCron)
}

// Create handles POST /scheduled-notifications - create a new scheduled notification.
func (h *ScheduledNotificationHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateScheduledNotificationInput
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	n, err := h.scheduledSvc.CreateScheduledNotification(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, n)
}

// Get handles GET /scheduled-notifications/:id - get a single scheduled notification.
func (h *ScheduledNotificationHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	n, err := h.scheduledSvc.GetScheduledNotification(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "scheduled notification not found")
		return
	}
	respondSuccess(c, n)
}

// List handles GET /scheduled-notifications - list scheduled notifications.
func (h *ScheduledNotificationHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var opts models.ListNotificationsQuery
	if err := c.ShouldBindQuery(&opts); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	items, total, err := h.scheduledSvc.ListScheduledNotifications(c.Request.Context(), tenantID, opts)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": items, "total": total, "page": opts.Page})
}

// Update handles PUT /scheduled-notifications/:id - update a scheduled notification.
func (h *ScheduledNotificationHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateScheduledNotificationInput
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	n, err := h.scheduledSvc.UpdateScheduledNotification(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		if err == service.ErrScheduledNotificationNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, n)
}

// Toggle handles PUT /scheduled-notifications/:id/toggle - toggle enabled/disabled status.
func (h *ScheduledNotificationHandler) Toggle(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ToggleScheduledNotificationInput
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	n, err := h.scheduledSvc.ToggleScheduledNotification(c.Request.Context(), tenantID, c.Param("id"), *req.Enabled)
	if err != nil {
		if err == service.ErrScheduledNotificationNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, n)
}

// Cancel handles POST /scheduled-notifications/:id/cancel - cancel a pending scheduled notification.
func (h *ScheduledNotificationHandler) Cancel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.scheduledSvc.CancelScheduledNotification(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		if err == service.ErrScheduledNotificationNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "cancelled"})
}

// Delete handles DELETE /scheduled-notifications/:id - delete a scheduled notification.
func (h *ScheduledNotificationHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.scheduledSvc.DeleteScheduledNotification(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		if err == service.ErrScheduledNotificationNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ValidateCron handles GET /scheduled-notifications/validate-cron - validate a cron expression.
func (h *ScheduledNotificationHandler) ValidateCron(c *gin.Context) {
	cronExpr := c.Query("expression")
	if cronExpr == "" {
		respondBadRequest(c, "expression query parameter is required")
		return
	}

	result := h.scheduledSvc.ValidateCronExpression(cronExpr)
	respondSuccess(c, result)
}