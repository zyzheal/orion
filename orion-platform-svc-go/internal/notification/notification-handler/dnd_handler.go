package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/notification/models"
	"orion/platform-svc-go/internal/notification/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// DNDHandler exposes HTTP endpoints for do-not-disturb management.
type DNDHandler struct {
	dndSvc *service.DNDService
}

// NewDNDHandler creates a new DNDHandler.
func NewDNDHandler(dndSvc *service.DNDService) *DNDHandler {
	return &DNDHandler{dndSvc: dndSvc}
}

// RegisterRoutes mounts all DND endpoints onto the given router group.
func (h *DNDHandler) RegisterRoutes(rg *gin.RouterGroup) {
	dnd := rg.Group("/dnd")
	dnd.Use(auth.RequirePermission("notification", "write"))
	{
		dnd.PUT("/:user_id", h.Set)
		dnd.DELETE("/:user_id", h.Clear)
		dnd.GET("/:user_id", h.Get)
		dnd.GET("/:user_id/active", h.IsActive)
		dnd.GET("/active/users", h.GetActiveUsers)
	}
}

// Set handles PUT /dnd/:user_id - set DND for a user.
func (h *DNDHandler) Set(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "NotificationSet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.Param("user_id")
	var req models.CreateDoNotDisturbInput
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	req.UserID = userID

	input := &models.CreateDoNotDisturbInput{
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		Reason:    req.Reason,
	}
	dnd, err := h.dndSvc.SetDND(ctx, tenantID, req.UserID, input)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, dnd)
}

// Clear handles DELETE /dnd/:user_id - clear DND for a user.
func (h *DNDHandler) Clear(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "NotificationClear")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.Param("user_id")
	if err := h.dndSvc.ClearDND(ctx, tenantID, userID); err != nil {
		if err == service.ErrDNDNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "DND cleared"})
}

// Get handles GET /dnd/:user_id - get DND settings for a user.
func (h *DNDHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "NotificationGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.Param("user_id")
	dnd, err := h.dndSvc.GetDndSettings(ctx, tenantID, userID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, dnd)
}

// IsActive handles GET /dnd/:user_id/active - check if DND is active.
func (h *DNDHandler) IsActive(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "NotificationIsActive")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.Param("user_id")
	active, err := h.dndSvc.IsDndActive(ctx, tenantID, userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"isActive": active, "userId": userID})
}

// GetActiveUsers handles GET /dnd/active/users - get all users with active DND.
func (h *DNDHandler) GetActiveUsers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "NotificationGetActiveUsers")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	users, err := h.dndSvc.GetDndSettings(ctx, tenantID, "")
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, users)
}
