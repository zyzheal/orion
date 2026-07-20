package handler

import (
        "strconv"

        "orion/go-common/pkg/auth"
        "orion/platform-svc-go/internal/channel/models"
        "orion/platform-svc-go/internal/channel/service"

        "github.com/gin-gonic/gin"
	"orion/go-common/pkg/errors"
	"go.opentelemetry.io/otel/trace"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateChannel")
	defer span.End()
        tenantID := c.GetString("tenant_id")
        var req models.CreateChannelRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
                return
        }
        result, err := h.svc.Create(ctx, tenantID, &req)
        if err != nil {
                errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
                return
        }
        c.JSON(201, result)
}

func (h *Handler) GetChannel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetChannel")
	defer span.End()
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        result, err := h.svc.GetByID(ctx, tenantID, id)
        if err != nil {
                errors.WriteError(c, errors.ErrNotFound, "channel not found", 404)
                return
        }
        c.JSON(200, result)
}

func (h *Handler) ListChannels(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListChannels")
	defer span.End()
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
        result, total, err := h.svc.List(ctx, tenantID, filter)
        if err != nil {
                errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
                return
        }
        c.JSON(200, gin.H{"data": result, "total": total})
}

func (h *Handler) UpdateChannel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateChannel")
	defer span.End()
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        var req models.UpdateChannelRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
                return
        }
        result, err := h.svc.Update(ctx, tenantID, id, &req)
        if err != nil {
                errors.WriteError(c, errors.ErrNotFound, "channel not found", 404)
                return
        }
        c.JSON(200, result)
}

func (h *Handler) DeleteChannel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteChannel")
	defer span.End()
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        deleted, err := h.svc.Delete(ctx, tenantID, id)
        if err != nil {
                errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
                return
        }
        if !deleted {
                errors.WriteError(c, errors.ErrNotFound, "channel not found", 404)
                return
        }
        errors.WriteSuccess(c, gin.H{"message": "channel deleted"})
}

func (h *Handler) GetEnabledByType(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEnabledByType")
	defer span.End()
        tenantID := c.GetString("tenant_id")
        channelType := c.Param("type")
        result, err := h.svc.GetEnabledByType(ctx, tenantID, channelType)
        if err != nil {
                errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
                return
        }
        c.JSON(200, result)
}