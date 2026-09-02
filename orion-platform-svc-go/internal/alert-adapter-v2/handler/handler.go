package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/alert-adapter-v2/models"
	"orion/platform-svc-go/internal/alert-adapter-v2/service"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct{ factory *service.NotificationFactory }

func NewHandler(factory *service.NotificationFactory) *Handler { return &Handler{factory: factory} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/alert-adapters/v2")
	g.POST("/adapters", auth.RequirePermission("alert", "write"), h.CreateAdapter)
	g.GET("/adapters", auth.RequirePermission("alert", "read"), h.ListAdapters)
	g.GET("/adapters/:id", auth.RequirePermission("alert", "read"), h.GetAdapter)
	g.PATCH("/adapters/:id", auth.RequirePermission("alert", "write"), h.UpdateAdapter)
	g.DELETE("/adapters/:id", auth.RequirePermission("alert", "delete"), h.DeleteAdapter)
	g.POST("/templates", auth.RequirePermission("alert", "write"), h.CreateTemplate)
	g.GET("/templates", auth.RequirePermission("alert", "read"), h.ListTemplates)
	g.POST("/:id/send", auth.RequirePermission("alert", "execute"), h.SendNotification)
	g.GET("/:id/events", auth.RequirePermission("alert", "read"), h.ListEvents)
}

func (h *Handler) CreateAdapter(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertAdapterCreateAdapter")
	defer span.End()
	var req struct {
		Name, Channel, Config string `json:"name,omitempty"`
	}
	_ = c.ShouldBindJSON(&req)
	a, err := h.factory.CreateAdapter(ctx, c.GetString("tenant_id"), req.Name, req.Channel, req.Config)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, a)
}

func (h *Handler) ListAdapters(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertAdapterListAdapters")
	defer span.End()
	ch := c.Query("channel")
	offset, _ := strconv.Atoi(c.Query("offset"))
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit <= 0 {
		limit = 20
	}
	items, err := h.factory.ListAdapters(ctx, c.GetString("tenant_id"), ch, offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetAdapter(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertAdapterGetAdapter")
	defer span.End()
	a, err := h.factory.GetAdapter(ctx, c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, a)
}

func (h *Handler) UpdateAdapter(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertAdapterUpdateAdapter")
	defer span.End()
	var req models.UpdateAdapterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	a, err := h.factory.UpdateAdapter(ctx, c.GetString("tenant_id"), c.Param("id"), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, a)
}

func (h *Handler) DeleteAdapter(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertAdapterDeleteAdapter")
	defer span.End()
	if err := h.factory.DeleteAdapter(ctx, c.GetString("tenant_id"), c.Param("id")); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"status": "deleted"})
}

func (h *Handler) CreateTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertAdapterCreateTemplate")
	defer span.End()
	var req struct{ Name, Channel, Template, Variables string }
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.factory.CreateTemplate(ctx, c.GetString("tenant_id"), req.Name, req.Channel, req.Template, req.Variables)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, t)
}

func (h *Handler) ListTemplates(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertAdapterListTemplates")
	defer span.End()
	ch := c.Query("channel")
	offset, _ := strconv.Atoi(c.Query("offset"))
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit <= 0 {
		limit = 20
	}
	items, err := h.factory.ListTemplates(ctx, c.GetString("tenant_id"), ch, offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) SendNotification(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertAdapterSendNotification")
	defer span.End()
	var req struct {
		TemplateID, AlertID string
		Variables           map[string]string
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ev, err := h.factory.SendNotification(ctx, c.GetString("tenant_id"), c.Param("id"), req.TemplateID, req.AlertID, req.Variables)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ev)
}

func (h *Handler) ListEvents(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertAdapterListEvents")
	defer span.End()
	offset, _ := strconv.Atoi(c.Query("offset"))
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit <= 0 {
		limit = 20
	}
	items, err := h.factory.ListEvents(ctx, c.GetString("tenant_id"), c.Param("id"), c.Query("status"), offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}
