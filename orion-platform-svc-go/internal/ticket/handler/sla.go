package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticket/models"
	"orion/platform-svc-go/internal/ticket/service"
)

type SLAHandler struct {
	svc *service.SLAService
}

func NewSLAHandler(svc *service.SLAService) *SLAHandler {
	return &SLAHandler{svc: svc}
}

// AddSLATarget POST /api/v1/tickets/sla/targets
func (h *SLAHandler) AddSLATarget(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketAddSLATarget")
	defer span.End()
	tenantID, ok := tenantFrom(c)
	if !ok {
		return
	}
	var req models.CreateSLATargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	target, err := h.svc.CreateTarget(ctx, tenantID, &req)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondCreated(c, target)
}

// GetTicketSLA GET /api/v1/tickets/:id/sla
func (h *SLAHandler) GetTicketSLA(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetTicketSLA")
	defer span.End()
	tenantID, ok := tenantFrom(c)
	if !ok {
		return
	}
	sla, err := h.svc.GetTicketSLA(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, sla)
}

// GetSLACompliance GET /api/v1/tickets/sla/compliance
func (h *SLAHandler) GetSLACompliance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetSLACompliance")
	defer span.End()
	tenantID, ok := tenantFrom(c)
	if !ok {
		return
	}
	report, err := h.svc.GetComplianceReport(ctx, tenantID, time.Time{}, time.Time{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, report)
}

// CheckSLABreaches GET /api/v1/tickets/sla/breaches
func (h *SLAHandler) CheckSLABreaches(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketCheckSLABreaches")
	defer span.End()
	tenantID, ok := tenantFrom(c)
	if !ok {
		return
	}
	breaches, err := h.svc.CheckBreaches(ctx, tenantID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"breaches": breaches, "count": len(breaches)})
}
