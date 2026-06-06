package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/service"
)

type WorkflowHandler struct {
	svc *service.TicketService
}

func NewWorkflowHandler(svc *service.TicketService) *WorkflowHandler {
	return &WorkflowHandler{svc: svc}
}

// TransitionStatus POST /api/v1/tickets/:id/transition
func (h *WorkflowHandler) TransitionStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.TransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ticket, history, err := h.svc.TransitionStatus(c.Request.Context(), id, tenantID, req.ToStatus, req.PerformedBy, req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"ticket": ticket, "history": history}})
}

// GetWorkflowHistory GET /api/v1/tickets/:id/history
func (h *WorkflowHandler) GetWorkflowHistory(c *gin.Context) {
	id := c.Param("id")

	history, err := h.svc.GetWorkflowHistory(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": history})
}

// EscalateTicket POST /api/v1/tickets/:id/escalate
func (h *WorkflowHandler) EscalateTicket(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		EscalatedBy string `json:"escalated_by" binding:"required"`
		Reason      string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ticket, err := h.svc.Escalate(c.Request.Context(), id, tenantID, req.EscalatedBy, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": ticket})
}

// CloseTicket POST /api/v1/tickets/:id/close
func (h *WorkflowHandler) CloseTicket(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		PerformedBy string `json:"performed_by" binding:"required"`
		Reason      string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ticket, err := h.svc.Close(c.Request.Context(), id, tenantID, req.PerformedBy, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": ticket})
}
