package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/service"
)

type DispatchHandler struct {
	svc *service.DispatchService
}

func NewDispatchHandler(svc *service.DispatchService) *DispatchHandler {
	return &DispatchHandler{svc: svc}
}

// RegisterEngineer POST /api/v1/tickets/dispatch/engineers
func (h *DispatchHandler) RegisterEngineer(c *gin.Context) {
	var req models.RegisterEngineerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	engineer, err := h.svc.RegisterEngineer(c.Request.Context(), &req)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondCreated(c, engineer)
}

// ListEngineers GET /api/v1/tickets/dispatch/engineers
func (h *DispatchHandler) ListEngineers(c *gin.Context) {
	engineers, err := h.svc.ListEngineers(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"engineers": engineers, "count": len(engineers)})
}

// GetEngineer GET /api/v1/tickets/dispatch/engineers/:id
func (h *DispatchHandler) GetEngineer(c *gin.Context) {
	engineer, err := h.svc.GetEngineer(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, engineer)
}

// AutoDispatch POST /api/v1/tickets/:id/dispatch/auto
func (h *DispatchHandler) AutoDispatch(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		AssignedBy string `json:"assigned_by"`
	}
	c.ShouldBindJSON(&req)
	if req.AssignedBy == "" {
		req.AssignedBy = GetUserID(c)
	}

	record, err := h.svc.AutoDispatch(c.Request.Context(), id, tenantID, req.AssignedBy)
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}

	respondSuccess(c, record)
}

// ManualDispatch POST /api/v1/tickets/:id/dispatch/manual
func (h *DispatchHandler) ManualDispatch(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		EngineerID string `json:"engineer_id" binding:"required"`
		Reason     string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	record, err := h.svc.ManualDispatch(c.Request.Context(), id, tenantID, req.EngineerID, GetUserID(c), req.Reason)
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}

	respondSuccess(c, record)
}

// CalculateDispatchScore POST /api/v1/tickets/dispatch/score
func (h *DispatchHandler) CalculateDispatchScore(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req struct {
		TicketID   string `json:"ticket_id" binding:"required"`
		EngineerID string `json:"engineer_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	match, err := h.svc.CalculateDispatchScore(c.Request.Context(), req.TicketID, tenantID, req.EngineerID)
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}

	respondSuccess(c, match)
}

// GetDispatchQueueStatus GET /api/v1/tickets/dispatch/queue/status
func (h *DispatchHandler) GetDispatchQueueStatus(c *gin.Context) {
	status, err := h.svc.GetQueueStatus(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, status)
}

// GetDispatchQueueEntries GET /api/v1/tickets/dispatch/queue/entries
func (h *DispatchHandler) GetDispatchQueueEntries(c *gin.Context) {
	entries, err := h.svc.GetQueueEntries(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"entries": entries, "count": len(entries)})
}

// AddDispatchRule POST /api/v1/tickets/dispatch/rules
func (h *DispatchHandler) AddDispatchRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.AddDispatchRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	rule := &models.DispatchRule{
		TenantID:   tenantID,
		Name:       req.Name,
		Conditions: req.Conditions,
		Strategy:   req.Strategy,
		Weight:     req.Weight,
		Enabled:    true,
	}

	if err := h.svc.AddRule(c.Request.Context(), rule); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondCreated(c, rule)
}

// GetDispatchRules GET /api/v1/tickets/dispatch/rules
func (h *DispatchHandler) GetDispatchRules(c *gin.Context) {
	rules, err := h.svc.GetRules(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"rules": rules, "count": len(rules)})
}

// RemoveDispatchRule DELETE /api/v1/tickets/dispatch/rules/:ruleId
func (h *DispatchHandler) RemoveDispatchRule(c *gin.Context) {
	if err := h.svc.RemoveRule(c.Request.Context(), c.Param("ruleId")); err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, gin.H{"message": "rule removed"})
}

// GetLoadBalanceReport GET /api/v1/tickets/dispatch/load-balance
func (h *DispatchHandler) GetLoadBalanceReport(c *gin.Context) {
	report, err := h.svc.GetLoadBalanceReport(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, report)
}

// UpdateDispatchWeights PUT /api/v1/tickets/dispatch/weights
func (h *DispatchHandler) UpdateDispatchWeights(c *gin.Context) {
	var w models.DispatchWeights
	if err := c.ShouldBindJSON(&w); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	h.svc.UpdateWeights(w)
	respondSuccess(c, h.svc.GetWeights())
}

// GetDispatchWeights GET /api/v1/tickets/dispatch/weights
func (h *DispatchHandler) GetDispatchWeights(c *gin.Context) {
	respondSuccess(c, h.svc.GetWeights())
}

// GetDispatchMetrics GET /api/v1/tickets/dispatch/metrics
func (h *DispatchHandler) GetDispatchMetrics(c *gin.Context) {
	metrics, err := h.svc.GetMetrics(c.Request.Context(), time.Time{}, time.Time{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, metrics)
}

// GetEngineerPerformance GET /api/v1/tickets/dispatch/performance/:engineerId
func (h *DispatchHandler) GetEngineerPerformance(c *gin.Context) {
	perf, err := h.svc.GetEngineerPerformance(c.Request.Context(), c.Param("engineerId"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, perf)
}

// GetAllEngineerPerformances GET /api/v1/tickets/dispatch/performance
func (h *DispatchHandler) GetAllEngineerPerformances(c *gin.Context) {
	perfs, err := h.svc.GetAllPerformances(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, perfs)
}

// GetBestMatch GET /api/v1/tickets/dispatch/best-match/:ticketId
func (h *DispatchHandler) GetBestMatch(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")

	match, err := h.svc.GetBestMatch(c.Request.Context(), ticketID, tenantID)
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, match)
}

// GetSLAAlerts GET /api/v1/tickets/dispatch/sla-alerts
func (h *DispatchHandler) GetSLAAlerts(c *gin.Context) {
	alerts, err := h.svc.GetSLAAlerts(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"alerts": alerts, "count": len(alerts)})
}

// GetAssignmentSuccessMetrics GET /api/v1/tickets/dispatch/reports/assignment-success
func (h *DispatchHandler) GetAssignmentSuccessMetrics(c *gin.Context) {
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	metrics, err := h.svc.GetAssignmentSuccessMetrics(c.Request.Context(), start, end)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, metrics)
}

// GetTimeToAssignmentStats GET /api/v1/tickets/dispatch/reports/time-to-assignment
func (h *DispatchHandler) GetTimeToAssignmentStats(c *gin.Context) {
	stats, err := h.svc.GetTimeToAssignmentStats(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, stats)
}

// GetReassignmentSuggestions GET /api/v1/tickets/dispatch/load-balance/suggestions
func (h *DispatchHandler) GetReassignmentSuggestions(c *gin.Context) {
	suggestions, err := h.svc.GetReassignmentSuggestions(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"suggestions": suggestions, "count": len(suggestions)})
}
