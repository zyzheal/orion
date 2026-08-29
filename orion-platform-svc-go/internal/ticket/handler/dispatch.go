package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orion/platform-svc-go/internal/ticket/models"
	"orion/platform-svc-go/internal/ticket/service"
)

type DispatchHandler struct {
	svc *service.DispatchService
}

func NewDispatchHandler(svc *service.DispatchService) *DispatchHandler {
	return &DispatchHandler{svc: svc}
}

// RegisterEngineer POST /api/v1/tickets/dispatch/engineers
func (h *DispatchHandler) RegisterEngineer(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketRegisterEngineer")
	defer span.End()
	var req models.RegisterEngineerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	engineer, err := h.svc.RegisterEngineer(ctx, &req)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondCreated(c, engineer)
}

// ListEngineers GET /api/v1/tickets/dispatch/engineers
func (h *DispatchHandler) ListEngineers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketListEngineers")
	defer span.End()
	engineers, err := h.svc.ListEngineers(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"engineers": engineers, "count": len(engineers)})
}

// GetEngineer GET /api/v1/tickets/dispatch/engineers/:id
func (h *DispatchHandler) GetEngineer(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetEngineer")
	defer span.End()
	engineer, err := h.svc.GetEngineer(ctx, c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, engineer)
}

// AutoDispatch POST /api/v1/tickets/:id/dispatch/auto
func (h *DispatchHandler) AutoDispatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketAutoDispatch")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		AssignedBy string `json:"assigned_by"`
	}
	c.ShouldBindJSON(&req)
	if req.AssignedBy == "" {
		req.AssignedBy = GetUserID(c)
	}

	record, err := h.svc.AutoDispatch(ctx, id, tenantID, req.AssignedBy)
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}

	respondSuccess(c, record)
}

// ManualDispatch POST /api/v1/tickets/:id/dispatch/manual
func (h *DispatchHandler) ManualDispatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketManualDispatch")
	defer span.End()
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

	record, err := h.svc.ManualDispatch(ctx, id, tenantID, req.EngineerID, GetUserID(c), req.Reason)
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}

	respondSuccess(c, record)
}

// CalculateDispatchScore POST /api/v1/tickets/dispatch/score
func (h *DispatchHandler) CalculateDispatchScore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketCalculateDispatchScore")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req struct {
		TicketID   string `json:"ticket_id" binding:"required"`
		EngineerID string `json:"engineer_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	match, err := h.svc.CalculateDispatchScore(ctx, req.TicketID, tenantID, req.EngineerID)
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}

	respondSuccess(c, match)
}

// GetDispatchQueueStatus GET /api/v1/tickets/dispatch/queue/status
func (h *DispatchHandler) GetDispatchQueueStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetDispatchQueueStatus")
	defer span.End()
	status, err := h.svc.GetQueueStatus(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, status)
}

// GetDispatchQueueEntries GET /api/v1/tickets/dispatch/queue/entries
func (h *DispatchHandler) GetDispatchQueueEntries(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetDispatchQueueEntries")
	defer span.End()
	entries, err := h.svc.GetQueueEntries(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"entries": entries, "count": len(entries)})
}

// AddDispatchRule POST /api/v1/tickets/dispatch/rules
func (h *DispatchHandler) AddDispatchRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketAddDispatchRule")
	defer span.End()
	var req models.CreateDispatchRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	rule := &models.DispatchRule{
		ID:         uuid.New().String(),
		Name:       req.Name,
		Condition:  req.Condition,
		EngineerID: req.EngineerID,
		Priority:   req.Priority,
	}

	if err := h.svc.AddRule(ctx, rule); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondCreated(c, rule)
}

// GetDispatchRules GET /api/v1/tickets/dispatch/rules
func (h *DispatchHandler) GetDispatchRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetDispatchRules")
	defer span.End()
	rules, err := h.svc.GetRules(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"rules": rules, "count": len(rules)})
}

// RemoveDispatchRule DELETE /api/v1/tickets/dispatch/rules/:ruleId
func (h *DispatchHandler) RemoveDispatchRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketRemoveDispatchRule")
	defer span.End()
	if err := h.svc.RemoveRule(ctx, c.Param("ruleId")); err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, gin.H{"message": "rule removed"})
}

// GetLoadBalanceReport GET /api/v1/tickets/dispatch/load-balance
func (h *DispatchHandler) GetLoadBalanceReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetLoadBalanceReport")
	defer span.End()
	report, err := h.svc.GetLoadBalanceReport(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, report)
}

// UpdateDispatchWeights PUT /api/v1/tickets/dispatch/weights
func (h *DispatchHandler) UpdateDispatchWeights(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketUpdateDispatchWeights")
	defer span.End()
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
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetDispatchWeights")
	defer span.End()
	respondSuccess(c, h.svc.GetWeights())
}

// GetDispatchMetrics GET /api/v1/tickets/dispatch/metrics
func (h *DispatchHandler) GetDispatchMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetDispatchMetrics")
	defer span.End()
	metrics, err := h.svc.GetMetrics(ctx, time.Time{}, time.Time{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, metrics)
}

// GetEngineerPerformance GET /api/v1/tickets/dispatch/performance/:engineerId
func (h *DispatchHandler) GetEngineerPerformance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetEngineerPerformance")
	defer span.End()
	perf, err := h.svc.GetEngineerPerformance(ctx, c.Param("engineerId"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, perf)
}

// GetAllEngineerPerformances GET /api/v1/tickets/dispatch/performance
func (h *DispatchHandler) GetAllEngineerPerformances(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetAllEngineerPerformances")
	defer span.End()
	perfs, err := h.svc.GetAllPerformances(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, perfs)
}

// GetBestMatch GET /api/v1/tickets/dispatch/best-match/:ticketId
func (h *DispatchHandler) GetBestMatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetBestMatch")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")

	match, err := h.svc.GetBestMatch(ctx, ticketID, tenantID)
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, match)
}

// GetSLAAlerts GET /api/v1/tickets/dispatch/sla-alerts
func (h *DispatchHandler) GetSLAAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetSLAAlerts")
	defer span.End()
	alerts, err := h.svc.GetSLAAlerts(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"alerts": alerts, "count": len(alerts)})
}

// GetAssignmentSuccessMetrics GET /api/v1/tickets/dispatch/reports/assignment-success
func (h *DispatchHandler) GetAssignmentSuccessMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetAssignmentSuccessMetrics")
	defer span.End()
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	metrics, err := h.svc.GetAssignmentSuccessMetrics(ctx, start, end)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, metrics)
}

// GetTimeToAssignmentStats GET /api/v1/tickets/dispatch/reports/time-to-assignment
func (h *DispatchHandler) GetTimeToAssignmentStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetTimeToAssignmentStats")
	defer span.End()
	stats, err := h.svc.GetTimeToAssignmentStats(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, stats)
}

// GetReassignmentSuggestions GET /api/v1/tickets/dispatch/load-balance/suggestions
func (h *DispatchHandler) GetReassignmentSuggestions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetReassignmentSuggestions")
	defer span.End()
	suggestions, err := h.svc.GetReassignmentSuggestions(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"suggestions": suggestions, "count": len(suggestions)})
}
