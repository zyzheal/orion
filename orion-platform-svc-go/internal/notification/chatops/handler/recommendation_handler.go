package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/notification/chatops/service"

	"github.com/gin-gonic/gin"
)

type RecommendationHandler struct {
	svc *service.RecommendationService
}

func NewRecommendationHandler(svc *service.RecommendationService) *RecommendationHandler {
	return &RecommendationHandler{svc: svc}
}

func (h *RecommendationHandler) GetRecommendations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ChatopsGetRecommendations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	recs, err := h.svc.GetRecommendations(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": recs, "count": len(recs)})
}

func (h *RecommendationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/recommendations", h.GetRecommendations)
}
