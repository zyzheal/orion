package handler

import (
	"orion/notification-svc-go/internal/notification/models"
	"orion/notification-svc-go/internal/notification/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// ChannelHandler exposes HTTP endpoints for notification channel management.
type ChannelHandler struct {
	channelSvc *service.ChannelService
}

// NewChannelHandler creates a new ChannelHandler.
func NewChannelHandler(channelSvc *service.ChannelService) *ChannelHandler {
	return &ChannelHandler{channelSvc: channelSvc}
}

// RegisterRoutes mounts all channel endpoints onto the given router group.
func (h *ChannelHandler) RegisterRoutes(rg *gin.RouterGroup) {
	c := rg.Group("/channels")
	c.Use(auth.RequirePermission("notification", "write"))
	{
		c.POST("", h.Create)
		c.GET("", h.List)
		c.GET("/:id", h.Get)
		c.PUT("/:id", h.Update)
		c.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.Delete)
	}
}

// Create handles POST /channels - create a new channel configuration.
func (h *ChannelHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var ch models.NotificationChannel
	if err := c.ShouldBindJSON(&ch); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.channelSvc.CreateChannel(c.Request.Context(), tenantID, &ch); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, ch)
}

// List handles GET /channels - list all channel configs for a tenant.
func (h *ChannelHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.channelSvc.ListChannels(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// Get handles GET /channels/:id - get a single channel config.
func (h *ChannelHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ch, err := h.channelSvc.GetChannel(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "channel not found")
		return
	}
	respondSuccess(c, ch)
}

// Update handles PUT /channels/:id - update a channel configuration.
func (h *ChannelHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var ch models.NotificationChannel
	if err := c.ShouldBindJSON(&ch); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	ch.ID = c.Param("id")
	if err := h.channelSvc.UpdateChannel(c.Request.Context(), tenantID, &ch); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, ch)
}

// Delete handles DELETE /channels/:id - remove a channel configuration.
func (h *ChannelHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.channelSvc.DeleteChannel(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}