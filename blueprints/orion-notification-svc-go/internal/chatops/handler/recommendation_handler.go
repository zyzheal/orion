package handler

import (
	"net/http"

	"orion/notification-svc-go/internal/chatops/service"

	"github.com/gin-gonic/gin"
)

type RecommendationHandler struct {
	svc *service.RecommendationService
}

func NewRecommendationHandler(svc *service.RecommendationService) *RecommendationHandler {
	return &RecommendationHandler{svc: svc}
}

func (h *RecommendationHandler) GetRecommendations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	recs, err := h.svc.GetRecommendations(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, recs, "count": len(recs))
}

func (h *RecommendationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/recommendations", h.GetRecommendations)
}
