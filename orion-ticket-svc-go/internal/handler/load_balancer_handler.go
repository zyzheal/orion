package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion-ticket-svc-go/internal/service"
)

// LoadBalancerHandler handles advanced load balancing HTTP requests
type LoadBalancerHandler struct {
	svc *service.LoadBalancer
}

func NewLoadBalancerHandler(svc *service.LoadBalancer) *LoadBalancerHandler {
	return &LoadBalancerHandler{svc: svc}
}

// GetBalancingReport GET /api/v1/tickets/dispatch/balancing/report
func (h *LoadBalancerHandler) GetBalancingReport(c *gin.Context) {
	report, err := h.svc.GetBalancingReport(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": report})
}

// GetReassignmentSuggestions GET /api/v1/tickets/dispatch/balancing/suggestions
func (h *LoadBalancerHandler) GetReassignmentSuggestions(c *gin.Context) {
	suggestions, err := h.svc.SuggestReassignments(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": suggestions, "count": len(suggestions)})
}

// GetTeamCapacity GET /api/v1/tickets/dispatch/balancing/team/:team/capacity
func (h *LoadBalancerHandler) GetTeamCapacity(c *gin.Context) {
	capacity, err := h.svc.GetTeamCapacity(c.Request.Context(), c.Param("team"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": capacity})
}

// CheckEngineerCapacity GET /api/v1/tickets/dispatch/balancing/engineer/:id/capacity
func (h *LoadBalancerHandler) CheckEngineerCapacity(c *gin.Context) {
	check, err := h.svc.CheckEngineerCapacity(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": check})
}

// GetAvailableEngineers GET /api/v1/tickets/dispatch/balancing/available
func (h *LoadBalancerHandler) GetAvailableEngineers(c *gin.Context) {
	engineers, err := h.svc.GetAvailableEngineers(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": engineers, "count": len(engineers)})
}
