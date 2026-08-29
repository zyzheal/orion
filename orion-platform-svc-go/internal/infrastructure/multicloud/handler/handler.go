package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/infrastructure/multicloud/models"
	"orion/platform-svc-go/internal/infrastructure/multicloud/service"

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
	r := rg.Group("/multiclouds")
	{
		r.POST("", auth.RequirePermission("multicloud", "write"), h.Create)
		r.GET("", auth.RequirePermission("multicloud", "read"), h.List)
		r.GET("/:id", auth.RequirePermission("multicloud", "read"), h.Get)
		r.DELETE("/:id", auth.RequirePermission("multicloud", "delete"), h.Delete)
	}
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateMultiCloud")
	defer span.End()
	var req models.CreateMultiCloudRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(ctx, c.GetString("tenant_id"), req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMultiCloud")
	defer span.End()
	m, err := h.svc.Get(ctx, c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListMultiClouds")
	defer span.End()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(ctx, c.GetString("tenant_id"), limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteMultiCloud")
	defer span.End()
	if err := h.svc.Delete(ctx, c.GetString("tenant_id"), c.Param("id")); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}
