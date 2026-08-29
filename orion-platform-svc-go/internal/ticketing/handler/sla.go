package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/service"
)

type SLAHandler struct {
	svc *service.SLAService
}

func NewSLAHandler(svc *service.SLAService) *SLAHandler {
	return &SLAHandler{svc: svc}
}

// AddSLATarget POST /api/v1/tickets/sla/targets
func (h *SLAHandler) AddSLATarget(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingAddSLATarget")
	defer span.End()
	var req models.CreateSLATargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	target, err := h.svc.CreateTarget(ctx, &req)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondCreated(c, target)
}

// GetTicketSLA GET /api/v1/tickets/:id/sla
func (h *SLAHandler) GetTicketSLA(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingGetTicketSLA")
	defer span.End()
	sla, err := h.svc.GetTicketSLA(ctx, c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, sla)
}

// GetSLACompliance GET /api/v1/tickets/sla/compliance
func (h *SLAHandler) GetSLACompliance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingGetSLACompliance")
	defer span.End()
	report, err := h.svc.GetComplianceReport(ctx, time.Time{}, time.Time{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, report)
}

// CheckSLABreaches GET /api/v1/tickets/sla/breaches
func (h *SLAHandler) CheckSLABreaches(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingCheckSLABreaches")
	defer span.End()
	breaches, err := h.svc.CheckBreaches(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"breaches": breaches, "count": len(breaches)})
}
