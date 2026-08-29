package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/notification/chatops/models"
	"orion/platform-svc-go/internal/notification/chatops/service"

	"github.com/gin-gonic/gin"
)

type RateLimitHandler struct {
	svc *service.RateLimitService
}

func NewRateLimitHandler(svc *service.RateLimitService) *RateLimitHandler {
	return &RateLimitHandler{svc: svc}
}

func (h *RateLimitHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRateLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rl, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, rl)
}

func (h *RateLimitHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	rl, err := h.svc.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "rate limit not found")
		return
	}
	respondSuccess(c, rl)
}

func (h *RateLimitHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.List(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *RateLimitHandler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsUpdate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateRateLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rl, err := h.svc.Update(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, rl)
}

func (h *RateLimitHandler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *RateLimitHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rl := rg.Group("/rate-limits")
	{
		rl.POST("", h.Create)
		rl.GET("", h.List)
		rl.GET("/:id", h.Get)
		rl.PUT("/:id", h.Update)
		rl.DELETE("/:id", h.Delete)
	}
}
