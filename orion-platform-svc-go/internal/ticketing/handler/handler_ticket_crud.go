package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/service"
)

// CreateTicket creates a new ticket for the tenant.
func (h *Handler) CreateTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	reporterID := c.GetString("user_id")
	if reporterID == "" {
		middleware.RespondBadRequest(c, "user_id required")
		return
	}
	t, err := h.svc.CreateTicket(ctx, tenantID, req, reporterID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, t)
}

// CreateTicketFromAlert creates a ticket sourced from an alert.
func (h *Handler) CreateTicketFromAlert(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTicketFromAlert")
	defer span.End()
	h.createTicketWithSource(c, "alert")
}

// CreateTicketFromIncident creates a ticket sourced from an incident.
func (h *Handler) CreateTicketFromIncident(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTicketFromIncident")
	defer span.End()
	h.createTicketWithSource(c, "incident")
}

func (h *Handler) createTicketWithSource(c *gin.Context, source string) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTicketWithSource")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req.Source = source
	reporterID := c.GetString("user_id")
	if reporterID == "" {
		middleware.RespondBadRequest(c, "user_id required")
		return
	}
	t, err := h.svc.CreateTicket(ctx, tenantID, req, reporterID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, t)
}

// GetTicket retrieves a ticket by id.
func (h *Handler) GetTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	t, err := h.svc.GetTicket(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "ticket not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// ListTickets lists tickets matching the query parameters.
func (h *Handler) ListTickets(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTickets")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := buildTicketListQuery(c)
	items, err := h.svc.ListTickets(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"total": len(items),
		"items": items,
	})
}
