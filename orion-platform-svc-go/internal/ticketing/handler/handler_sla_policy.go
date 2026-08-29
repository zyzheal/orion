package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/ticketing/models"
)

// CreateSLAPolicy creates a new SLA policy.
func (h *Handler) CreateSLAPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSLAPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateSLAPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.CreateSLAPolicy(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, p)
}

// ListSLAPolicies lists all SLA policies for the tenant.
func (h *Handler) ListSLAPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSLAPolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	policies, err := h.svc.ListSLAPolicies(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, policies)
}

// GetSLAPolicy retrieves an SLA policy by id.
func (h *Handler) GetSLAPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSLAPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	p, err := h.svc.GetSLAPolicy(ctx, tenantID, policyID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, p)
}

// UpdateSLAPolicy updates an SLA policy.
func (h *Handler) UpdateSLAPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateSLAPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	var req models.UpdateSLAPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.UpdateSLAPolicy(ctx, tenantID, policyID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, p)
}

// DeleteSLAPolicy deletes an SLA policy.
func (h *Handler) DeleteSLAPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteSLAPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	if err := h.svc.DeleteSLAPolicy(ctx, tenantID, policyID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "SLA policy deleted"})
}

// GetTicketSLAStatus returns the SLA status for a ticket.
func (h *Handler) GetTicketSLAStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTicketSLAStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")
	status, err := h.svc.GetTicketSLAStatus(ctx, tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}

// GetBreaches returns SLA breaches for the tenant.
func (h *Handler) GetBreaches(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBreaches")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	breaches, err := h.svc.GetBreaches(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, breaches)
}

// GetCompliance returns SLA compliance for a specific policy.
func (h *Handler) GetCompliance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCompliance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	result, err := h.svc.GetCompliance(ctx, tenantID, policyID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
