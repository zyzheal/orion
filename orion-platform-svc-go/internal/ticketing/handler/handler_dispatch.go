package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/ticketing/models"
)

// RegisterEngineer registers a new dispatch engineer.
func (h *Handler) RegisterEngineer(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterEngineer")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.RegisterEngineerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	e, err := h.svc.RegisterEngineer(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, e)
}

// ListEngineers lists all dispatch engineers for the tenant.
func (h *Handler) ListEngineers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListEngineers")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	engineers, err := h.svc.ListEngineers(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, engineers)
}

// GetEngineer retrieves a dispatch engineer by id.
func (h *Handler) GetEngineer(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEngineer")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	e, err := h.svc.GetEngineer(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, e)
}

// AutoDispatch automatically dispatches a ticket to the best-matched engineer.
func (h *Handler) AutoDispatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoDispatch")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")
	result, err := h.svc.AutoDispatch(ctx, tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ManualDispatch manually dispatches a ticket to a specific engineer.
func (h *Handler) ManualDispatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ManualDispatch")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")
	var body struct {
		EngineerID string `json:"engineer_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.ManualDispatch(ctx, tenantID, ticketID, body.EngineerID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "ticket dispatched"})
}

// GetBestMatch finds the best-matched engineer for a ticket.
func (h *Handler) GetBestMatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBestMatch")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")
	result, err := h.svc.GetBestMatch(ctx, tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// CalculateDispatchScore calculates the dispatch score for an engineer-ticket pair.
func (h *Handler) CalculateDispatchScore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CalculateDispatchScore")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.DispatchScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CalculateDispatchScore(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// GetDispatchQueueStatus returns the dispatch queue status.
func (h *Handler) GetDispatchQueueStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDispatchQueueStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status, err := h.svc.GetDispatchQueueStatus(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}

// GetDispatchQueueEntries lists the entries in the dispatch queue.
func (h *Handler) GetDispatchQueueEntries(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDispatchQueueEntries")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	entries, err := h.svc.GetDispatchQueueEntries(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, entries)
}

// GetSLAAlerts returns SLA alerts related to dispatch.
func (h *Handler) GetSLAAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSLAAlerts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	alerts, err := h.svc.GetSLAAlerts(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, alerts)
}

// AddDispatchRule adds a new dispatch rule.
func (h *Handler) AddDispatchRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddDispatchRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.AddDispatchRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	r, err := h.svc.AddDispatchRule(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, r)
}

// GetDispatchRules lists all dispatch rules for the tenant.
func (h *Handler) GetDispatchRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDispatchRules")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	rules, err := h.svc.GetDispatchRules(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rules)
}

// GetLoadBalanceReport returns the load balancing report.
func (h *Handler) GetLoadBalanceReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetLoadBalanceReport")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	report, err := h.svc.GetLoadBalanceReport(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

// GetReassignmentSuggestions returns reassignment suggestions.
func (h *Handler) GetReassignmentSuggestions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReassignmentSuggestions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	suggestions, err := h.svc.GetReassignmentSuggestions(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, suggestions)
}

// GetDispatchMetrics returns dispatch metrics.
func (h *Handler) GetDispatchMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDispatchMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	metrics, err := h.svc.GetDispatchMetrics(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, metrics)
}

// GetAssignmentSuccessMetrics returns assignment success metrics.
func (h *Handler) GetAssignmentSuccessMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAssignmentSuccessMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	metrics, err := h.svc.GetAssignmentSuccessMetrics(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, metrics)
}

// GetTimeToAssignmentStats returns time-to-assignment statistics.
func (h *Handler) GetTimeToAssignmentStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTimeToAssignmentStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetTimeToAssignmentStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// GetEngineerPerformance returns performance metrics for a specific engineer.
func (h *Handler) GetEngineerPerformance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEngineerPerformance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	engineerID := c.Param("engineerId")
	perf, err := h.svc.GetEngineerPerformance(ctx, tenantID, engineerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, perf)
}

// GetAllEngineerPerformances returns performance metrics for all engineers.
func (h *Handler) GetAllEngineerPerformances(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllEngineerPerformances")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	perfs, err := h.svc.GetAllEngineerPerformances(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, perfs)
}

// UpdateDispatchWeights updates the dispatch weights.
func (h *Handler) UpdateDispatchWeights(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateDispatchWeights")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body models.UpdateWeightsRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpdateDispatchWeights(ctx, tenantID, body.Weights); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "dispatch weights updated"})
}

// GetDispatchWeights returns the current dispatch weights.
func (h *Handler) GetDispatchWeights(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDispatchWeights")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	weights, err := h.svc.GetDispatchWeights(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, weights)
}
