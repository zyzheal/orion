package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/identity/apikey/models"
	"orion/platform-svc-go/internal/identity/apikey/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/api_keys")
	{
		r.POST("", h.Create)
		r.GET("", h.List)
		r.DELETE("/:id", h.Delete)
	}
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateApiKey")
	defer span.End()
	var req models.CreateApiKeyRequest
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

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListApiKeys")
	defer span.End()
	items, err := h.svc.List(ctx, c.GetString("tenant_id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteApiKey")
	defer span.End()
	if err := h.svc.Delete(ctx, c.GetString("tenant_id"), c.Param("id")); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}
