package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/ticketing/models"
)

// AddSLATarget adds a new SLA target for the tenant.
func (h *Handler) AddSLATarget(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddSLATarget")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateSLATargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	sla, err := h.svc.AddSLATarget(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, sla)
}

// GetTicketSLA returns the SLA status for a ticket.
func (h *Handler) GetTicketSLA(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTicketSLA")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	status, err := h.svc.GetTicketSLA(ctx, tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}
