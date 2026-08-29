package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/service"
)

type WorkflowHandler struct {
	svc *service.TicketService
}

func NewWorkflowHandler(svc *service.TicketService) *WorkflowHandler {
	return &WorkflowHandler{svc: svc}
}

// TransitionStatus POST /api/v1/tickets/:id/transition
func (h *WorkflowHandler) TransitionStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingTransitionStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.TransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	performedBy := GetUserID(c)
	ticket, history, err := h.svc.TransitionStatus(ctx, id, tenantID, req.Status, performedBy, req.Comment)
	if err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	respondSuccess(c, gin.H{"ticket": ticket, "history": history})
}

// GetWorkflowHistory GET /api/v1/tickets/:id/history
func (h *WorkflowHandler) GetWorkflowHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingGetWorkflowHistory")
	defer span.End()
	id := c.Param("id")

	history, err := h.svc.GetWorkflowHistory(ctx, id)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondSuccess(c, history)
}

// EscalateTicket POST /api/v1/tickets/:id/escalate
func (h *WorkflowHandler) EscalateTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingEscalateTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		EscalatedBy string `json:"escalated_by" binding:"required"`
		Reason      string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	ticket, err := h.svc.Escalate(ctx, id, tenantID, req.EscalatedBy, req.Reason)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondSuccess(c, ticket)
}

// CloseTicket POST /api/v1/tickets/:id/close
func (h *WorkflowHandler) CloseTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingCloseTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		PerformedBy string `json:"performed_by" binding:"required"`
		Reason      string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	ticket, err := h.svc.Close(ctx, id, tenantID, req.PerformedBy, req.Reason)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondSuccess(c, ticket)
}
