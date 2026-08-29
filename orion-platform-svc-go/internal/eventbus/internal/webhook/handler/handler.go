package handler

import (
	"go.opentelemetry.io/otel"
	"strconv"

	"orion/platform-svc-go/internal/eventbus/internal/webhook/models"
	"orion/platform-svc-go/internal/eventbus/internal/webhook/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Webhook CRUD routes
	webhook := rg.Group("/webhooks")
	webhook.POST("", h.Create)
	webhook.GET("", h.List)
	webhook.GET("/:id", h.Get)
	webhook.PUT("/:id", h.Update)
	webhook.DELETE("/:id", h.Delete)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusWebhookCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusWebhookGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusWebhookList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(ctx, tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusWebhookUpdate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EventBusWebhookDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}
