package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/ticketing/models"
)

// TransitionStatus transitions a ticket's status.
func (h *Handler) TransitionStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TransitionStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	userID := c.GetString("user_id")
	var req models.TransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.TransitionStatus(ctx, tenantID, ticketID, req, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// AssignTicket assigns a ticket to an engineer.
func (h *Handler) AssignTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AssignTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	userID := c.GetString("user_id")
	var req models.AssignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.AssignTicket(ctx, tenantID, ticketID, req, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// EscalateTicket escalates a ticket.
func (h *Handler) EscalateTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EscalateTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	userID := c.GetString("user_id")
	var req models.EscalateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.EscalateTicket(ctx, tenantID, ticketID, req, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// ResolveTicket resolves a ticket.
func (h *Handler) ResolveTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ResolveTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	userID := c.GetString("user_id")
	var req models.ResolveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.ResolveTicket(ctx, tenantID, ticketID, req, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// CloseTicket closes a ticket.
func (h *Handler) CloseTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CloseTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	userID := c.GetString("user_id")
	var body struct {
		Comment string `json:"comment"`
	}
	c.ShouldBindJSON(&body)
	t, err := h.svc.CloseTicket(ctx, tenantID, ticketID, body.Comment, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// GetWorkflowHistory returns the workflow history for a ticket.
func (h *Handler) GetWorkflowHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetWorkflowHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	items, err := h.svc.GetWorkflowHistory(ctx, tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}
