package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticketing/service"
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
	respondSuccess(c, report)
}

// GetReassignmentSuggestions GET /api/v1/tickets/dispatch/balancing/suggestions
func (h *LoadBalancerHandler) GetReassignmentSuggestions(c *gin.Context) {
	suggestions, err := h.svc.SuggestReassignments(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"suggestions": suggestions, "count": len(suggestions)})
}

// GetTeamCapacity GET /api/v1/tickets/dispatch/balancing/team/:team/capacity
func (h *LoadBalancerHandler) GetTeamCapacity(c *gin.Context) {
	capacity, err := h.svc.GetTeamCapacity(c.Request.Context(), c.Param("team"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, capacity)
}

// CheckEngineerCapacity GET /api/v1/tickets/dispatch/balancing/engineer/:id/capacity
func (h *LoadBalancerHandler) CheckEngineerCapacity(c *gin.Context) {
	check, err := h.svc.CheckEngineerCapacity(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, check)
}

// GetAvailableEngineers GET /api/v1/tickets/dispatch/balancing/available
func (h *LoadBalancerHandler) GetAvailableEngineers(c *gin.Context) {
	engineers, err := h.svc.GetAvailableEngineers(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"engineers": engineers, "count": len(engineers)})
}
