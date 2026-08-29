package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/plugin-marketplace/models"
	"orion/platform-svc-go/internal/plugin-marketplace/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/plugins/marketplace")
	{
		r.POST("", auth.RequirePermission("plugin-marketplace", "write"), h.PublishPlugin)
		r.GET("", auth.RequirePermission("plugin-marketplace", "read"), h.ListPlugins)
		r.GET("/stats", auth.RequirePermission("plugin-marketplace", "read"), h.GetStats)
		id := r.Group("/:id")
		{
			id.GET("", auth.RequirePermission("plugin-marketplace", "read"), h.GetPlugin)
			id.POST("/install", auth.RequirePermission("plugin-marketplace", "write"), h.InstallPlugin)
			id.POST("/rate", auth.RequirePermission("plugin-marketplace", "write"), h.RatePlugin)
			id.POST("/uninstall", auth.RequirePermission("plugin-marketplace", "write"), h.UninstallPlugin)
			id.GET("/quality", auth.RequirePermission("plugin-marketplace", "read"), h.GetQualityScore)
		}
	}
}

func (h *Handler) PublishPlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PublishPlugin")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondBadRequest(c, "tenant ID required")
		return
	}

	var req models.PublishPluginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	info, err := h.svc.PublishPlugin(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, info)
}

func (h *Handler) ListPlugins(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPlugins")
	defer span.End()
	filter := &models.ListPluginFilter{
		Category: ptrIf(c.Query("category")),
		Verified: ptrBool(c.Query("verified")),
		Search:   ptrIf(c.Query("search")),
		Limit:    ptrInt(c.Query("limit")),
		Offset:   ptrInt(c.Query("offset")),
	}

	info, total, err := h.svc.ListPlugins(ctx, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": info, "total": total, "limit": defaultLimit(filter.Limit), "offset": defaultOffset(filter.Offset)})
}

func (h *Handler) GetPlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPlugin")
	defer span.End()
	id := c.Param("id")
	info, err := h.svc.GetPlugin(ctx, id)
	if err != nil {
		if err == service.ErrPluginNotFound {
			middleware.RespondNotFound(c, "Plugin not found")
			return
		}
		if err == service.ErrPluginDisabled {
			middleware.RespondForbidden(c, "Plugin is disabled")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, info)
}

func (h *Handler) InstallPlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InstallPlugin")
	defer span.End()
	pluginID := c.Param("id")
	userID := c.GetString("user_id")

	var req models.InstallPluginRequest
	_ = c.ShouldBindJSON(&req)

	result, err := h.svc.InstallPlugin(ctx, pluginID, userID, &req)
	if err != nil {
		if err == service.ErrPluginNotFound {
			middleware.RespondNotFound(c, "Plugin not found")
			return
		}
		if err == service.ErrPluginDisabled {
			middleware.RespondForbidden(c, "Plugin is disabled")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) RatePlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RatePlugin")
	defer span.End()
	pluginID := c.Param("id")

	var req models.ReviewPluginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	if err := h.svc.RatePlugin(ctx, pluginID, &req); err != nil {
		if err == service.ErrPluginNotFound {
			middleware.RespondNotFound(c, "Plugin not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, nil)
}

func (h *Handler) UninstallPlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UninstallPlugin")
	defer span.End()
	pluginID := c.Param("id")

	if err := h.svc.UninstallPlugin(ctx, pluginID); err != nil {
		if err == service.ErrPluginNotFound {
			middleware.RespondNotFound(c, "Plugin not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, nil)
}

func (h *Handler) GetQualityScore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetQualityScore")
	defer span.End()
	pluginID := c.Param("id")

	resp, err := h.svc.GetQualityScore(ctx, pluginID)
	if err != nil {
		if err == service.ErrPluginNotFound {
			middleware.RespondNotFound(c, "Plugin not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPluginStats")
	defer span.End()
	stats, err := h.svc.GetStats(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func ptrIf(s string) *string {
	if s != "" {
		return &s
	}
	return nil
}

func ptrBool(s string) *bool {
	if s == "" {
		return nil
	}
	b := s == "true" || s == "1"
	return &b
}

func ptrInt(s string) *int {
	if s == "" {
		return nil
	}
	n, _ := strconv.Atoi(s)
	return &n
}

func defaultLimit(p *int) int {
	if p != nil && *p > 0 {
		return *p
	}
	return 20
}

func defaultOffset(p *int) int {
	if p != nil && *p > 0 {
		return *p
	}
	return 0
}
