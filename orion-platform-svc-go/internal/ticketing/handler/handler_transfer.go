package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/ticketing/models"
)

// TransferTicket transfers a ticket to another engineer.
func (h *Handler) TransferTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TransferTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")
	userID := c.GetString("user_id")
	var req models.TransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.TransferTicket(ctx, tenantID, ticketID, req, userID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "ticket transferred"})
}

// GetTransferHistory returns the transfer history for a ticket.
func (h *Handler) GetTransferHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTransferHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")
	history, err := h.svc.GetTransferHistory(ctx, tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, history)
}

// GetTransferStats returns transfer statistics for the tenant.
func (h *Handler) GetTransferStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTransferStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetTransferStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}
