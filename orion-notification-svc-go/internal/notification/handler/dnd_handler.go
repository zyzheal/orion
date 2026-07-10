package handler

import (
	"net/http"

	"orion/notification-svc-go/internal/notification/models"
	"orion/notification-svc-go/internal/notification/service"

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
	dnd.Use(auth.Auth(auth.AuthConfig{}))
	{
		dnd.PUT("/:user_id", auth.RequirePermission("notification", "write"), h.Set)
		dnd.DELETE("/:user_id", auth.RequirePermission("notification", "write"), h.Clear)
		dnd.GET("/:user_id", auth.RequirePermission("notification", "read"), h.Get)
		dnd.GET("/:user_id/active", auth.RequirePermission("notification", "read"), h.IsActive)
		dnd.GET("/active/users", auth.RequirePermission("notification", "admin"), h.GetActiveUsers)
	}
}

// Set handles PUT /dnd/:user_id - set DND for a user.
func (h *DNDHandler) Set(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Param("user_id")
	var req models.CreateDoNotDisturbInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.UserID = userID

	dnd, err := h.dndSvc.SetDND(c.Request.Context(), tenantID, req.UserID, req.StartTime, req.EndTime, req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": dnd})
}

// Clear handles DELETE /dnd/:user_id - clear DND for a user.
func (h *DNDHandler) Clear(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Param("user_id")
	if err := h.dndSvc.ClearDND(c.Request.Context(), tenantID, userID); err != nil {
		if err == service.ErrDNDNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "DND cleared"})
}

// Get handles GET /dnd/:user_id - get DND settings for a user.
func (h *DNDHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Param("user_id")
	dnd, err := h.dndSvc.GetDndSettings(c.Request.Context(), tenantID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": dnd})
}

// IsActive handles GET /dnd/:user_id/active - check if DND is active.
func (h *DNDHandler) IsActive(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Param("user_id")
	active, err := h.dndSvc.IsDndActive(c.Request.Context(), tenantID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"isActive": active, "userId": userID}})
}

// GetActiveUsers handles GET /dnd/active/users - get all users with active DND.
func (h *DNDHandler) GetActiveUsers(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	users, err := h.dndSvc.GetActiveUsers(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": users})
}
