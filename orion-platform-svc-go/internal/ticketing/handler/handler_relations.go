package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/ticketing/models"
)

// AddRelation adds a relation to a ticket.
func (h *Handler) AddRelation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddRelation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	var req models.CreateRelationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	r, err := h.svc.AddRelation(ctx, tenantID, ticketID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, r)
}

// GetRelations lists relations for a ticket.
func (h *Handler) GetRelations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRelations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	rels, err := h.svc.GetRelations(ctx, tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rels)
}

// FindRelatedTickets finds tickets related to the given ticket.
func (h *Handler) FindRelatedTickets(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FindRelatedTickets")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	rels, err := h.svc.FindRelatedTickets(ctx, tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rels)
}

// DetectDuplicates detects duplicate tickets.
func (h *Handler) DetectDuplicates(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DetectDuplicates")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	rels, err := h.svc.DetectDuplicates(ctx, tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rels)
}

// CorrelateRootCause correlates root causes across multiple tickets.
func (h *Handler) CorrelateRootCause(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CorrelateRootCause")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CorrelateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CorrelateRootCause(ctx, tenantID, req.TicketIDs)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
