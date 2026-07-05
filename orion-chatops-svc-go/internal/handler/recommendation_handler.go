package handler

import (
	"net/http"

	"orion/chatops-svc-go/internal/service"

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": recs, "count": len(recs)})
}

func (h *RecommendationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/recommendations", h.GetRecommendations)
}
