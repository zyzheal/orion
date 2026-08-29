package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticket/service"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetBalancingReport")
	defer span.End()
	report, err := h.svc.GetBalancingReport(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, report)
}

// GetReassignmentSuggestions GET /api/v1/tickets/dispatch/balancing/suggestions
func (h *LoadBalancerHandler) GetReassignmentSuggestions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetReassignmentSuggestions")
	defer span.End()
	suggestions, err := h.svc.SuggestReassignments(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"suggestions": suggestions, "count": len(suggestions)})
}

// GetTeamCapacity GET /api/v1/tickets/dispatch/balancing/team/:team/capacity
func (h *LoadBalancerHandler) GetTeamCapacity(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetTeamCapacity")
	defer span.End()
	capacity, err := h.svc.GetTeamCapacity(ctx, c.Param("team"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, capacity)
}

// CheckEngineerCapacity GET /api/v1/tickets/dispatch/balancing/engineer/:id/capacity
func (h *LoadBalancerHandler) CheckEngineerCapacity(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketCheckEngineerCapacity")
	defer span.End()
	check, err := h.svc.CheckEngineerCapacity(ctx, c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, check)
}

// GetAvailableEngineers GET /api/v1/tickets/dispatch/balancing/available
func (h *LoadBalancerHandler) GetAvailableEngineers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetAvailableEngineers")
	defer span.End()
	engineers, err := h.svc.GetAvailableEngineers(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"engineers": engineers, "count": len(engineers)})
}
