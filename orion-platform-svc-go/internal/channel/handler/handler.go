package handler

import (
        "strconv"

        "orion/go-common/pkg/auth"
        "orion/platform-svc-go/internal/channel/models"
        "orion/platform-svc-go/internal/channel/service"

        "github.com/gin-gonic/gin"
)

type Handler struct {
        svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
        return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
        f := rg.Group("/channel")

        f.POST("", auth.RequirePermission("channel", "write"), h.CreateChannel)
        f.GET("", auth.RequirePermission("channel", "read"), h.ListChannels)
        f.GET("/:id", auth.RequirePermission("channel", "read"), h.GetChannel)
        f.PUT("/:id", auth.RequirePermission("channel", "write"), h.UpdateChannel)
        f.DELETE("/:id", auth.RequirePermission("channel", "delete"), h.DeleteChannel)
        f.GET("/enabled/:type", auth.RequirePermission("channel", "read"), h.GetEnabledByType)
}

func (h *Handler) CreateChannel(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        var req models.CreateChannelRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        result, err := h.svc.Create(c.Request.Context(), tenantID, &req)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        c.JSON(201, result)
}

func (h *Handler) GetChannel(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        result, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
        if err != nil {
                c.JSON(404, gin.H{"error": "channel not found"})
                return
        }
        c.JSON(200, result)
}

func (h *Handler) ListChannels(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        filter := &models.ChannelFilter{Limit: 20}
        if t := c.Query("type"); t != "" {
                filter.Type = &t
        }
        if e := c.Query("enabled"); e != "" {
                b := e == "true" || e == "1"
                filter.Enabled = &b
        }
        if l := c.Query("limit"); l != "" {
                filter.Limit, _ = strconv.Atoi(l)
        }
        if o := c.Query("offset"); o != "" {
                filter.Offset, _ = strconv.Atoi(o)
        }
        result, total, err := h.svc.List(c.Request.Context(), tenantID, filter)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        c.JSON(200, gin.H{"data": result, "total": total})
}

func (h *Handler) UpdateChannel(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        var req models.UpdateChannelRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        result, err := h.svc.Update(c.Request.Context(), tenantID, id, &req)
        if err != nil {
                c.JSON(404, gin.H{"error": "channel not found"})
                return
        }
        c.JSON(200, result)
}

func (h *Handler) DeleteChannel(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        deleted, err := h.svc.Delete(c.Request.Context(), tenantID, id)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        if !deleted {
                c.JSON(404, gin.H{"error": "channel not found"})
                return
        }
        c.JSON(200, gin.H{"message": "channel deleted"})
}

func (h *Handler) GetEnabledByType(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        channelType := c.Param("type")
        result, err := h.svc.GetEnabledByType(c.Request.Context(), tenantID, channelType)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        c.JSON(200, result)
}