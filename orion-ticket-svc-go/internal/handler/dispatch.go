package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/service"
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	engineer, err := h.svc.RegisterEngineer(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": engineer})
}

// ListEngineers GET /api/v1/tickets/dispatch/engineers
func (h *DispatchHandler) ListEngineers(c *gin.Context) {
	engineers, err := h.svc.ListEngineers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": engineers, "count": len(engineers)})
}

// GetEngineer GET /api/v1/tickets/dispatch/engineers/:id
func (h *DispatchHandler) GetEngineer(c *gin.Context) {
	engineer, err := h.svc.GetEngineer(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "engineer not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": engineer})
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
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": record})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	record, err := h.svc.ManualDispatch(c.Request.Context(), id, tenantID, req.EngineerID, GetUserID(c), req.Reason)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": record})
}

// GetBestMatch GET /api/v1/tickets/:id/dispatch/best-match
func (h *DispatchHandler) GetBestMatch(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	// Get ticket first (need to import ticket repo or pass through)
	_ = tenantID
	_ = id

	c.JSON(http.StatusNotImplemented, gin.H{"error": "use POST /dispatch/auto instead"})
}

// CalculateDispatchScore POST /api/v1/tickets/dispatch/score
func (h *DispatchHandler) CalculateDispatchScore(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req struct {
		TicketID   string `json:"ticket_id" binding:"required"`
		EngineerID string `json:"engineer_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	match, err := h.svc.CalculateDispatchScore(c.Request.Context(), req.TicketID, tenantID, req.EngineerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": match})
}

// GetDispatchQueueStatus GET /api/v1/tickets/dispatch/queue/status
func (h *DispatchHandler) GetDispatchQueueStatus(c *gin.Context) {
	status, err := h.svc.GetQueueStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": status})
}

// GetDispatchQueueEntries GET /api/v1/tickets/dispatch/queue/entries
func (h *DispatchHandler) GetDispatchQueueEntries(c *gin.Context) {
	entries, err := h.svc.GetQueueEntries(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": entries, "count": len(entries)})
}

// AddDispatchRule POST /api/v1/tickets/dispatch/rules
func (h *DispatchHandler) AddDispatchRule(c *gin.Context) {
	var req models.CreateDispatchRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule := &models.DispatchRule{
		ID:         uuid.New().String(),
		Name:       req.Name,
		Condition:  req.Condition,
		EngineerID: req.EngineerID,
		Priority:   req.Priority,
	}

	if err := h.svc.AddRule(rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": rule})
}

// GetDispatchRules GET /api/v1/tickets/dispatch/rules
func (h *DispatchHandler) GetDispatchRules(c *gin.Context) {
	rules, err := h.svc.GetRules()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rules, "count": len(rules)})
}

// RemoveDispatchRule DELETE /api/v1/tickets/dispatch/rules/:ruleId
func (h *DispatchHandler) RemoveDispatchRule(c *gin.Context) {
	if err := h.svc.RemoveRule(c.Param("ruleId")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "rule removed"})
}

// GetLoadBalanceReport GET /api/v1/tickets/dispatch/load-balance
func (h *DispatchHandler) GetLoadBalanceReport(c *gin.Context) {
	report, err := h.svc.GetLoadBalanceReport(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": report})
}

// UpdateDispatchWeights PUT /api/v1/tickets/dispatch/weights
func (h *DispatchHandler) UpdateDispatchWeights(c *gin.Context) {
	var w models.DispatchWeights
	if err := c.ShouldBindJSON(&w); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.svc.UpdateWeights(w)
	c.JSON(http.StatusOK, gin.H{"data": h.svc.GetWeights()})
}

// GetDispatchWeights GET /api/v1/tickets/dispatch/weights
func (h *DispatchHandler) GetDispatchWeights(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": h.svc.GetWeights()})
}

// GetDispatchMetrics GET /api/v1/tickets/dispatch/metrics
func (h *DispatchHandler) GetDispatchMetrics(c *gin.Context) {
	metrics, err := h.svc.GetMetrics(c.Request.Context(), time.Time{}, time.Time{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": metrics})
}

// GetEngineerPerformance GET /api/v1/tickets/dispatch/performance/:engineerId
func (h *DispatchHandler) GetEngineerPerformance(c *gin.Context) {
	perf, err := h.svc.GetEngineerPerformance(c.Request.Context(), c.Param("engineerId"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "engineer not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": perf})
}

// GetAllEngineerPerformances GET /api/v1/tickets/dispatch/performance
func (h *DispatchHandler) GetAllEngineerPerformances(c *gin.Context) {
	perfs, err := h.svc.GetAllPerformances(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": perfs})
}
