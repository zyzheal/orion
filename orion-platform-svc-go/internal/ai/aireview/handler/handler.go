package handler

import (
	"orion/platform-svc-go/internal/ai/aireview/models"
	"orion/platform-svc-go/internal/ai/aireview/service"

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
	r := rg.Group("/ai-review")
	{
		r.POST("", h.Create)
		r.GET("", h.List)
	}
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAIReview")
	defer span.End()
	var req models.CreateAIReviewRequest
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAIReviews")
	defer span.End()
	items, err := h.svc.List(ctx, c.GetString("tenant_id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}
