package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"orion/workflow-svc-go/internal/ticket/models"
	"orion/workflow-svc-go/internal/ticket/service"
)

type SLAHandler struct {
	svc *service.SLAService
}

func NewSLAHandler(svc *service.SLAService) *SLAHandler {
	return &SLAHandler{svc: svc}
}

// AddSLATarget POST /api/v1/tickets/sla/targets
func (h *SLAHandler) AddSLATarget(c *gin.Context) {
	var req models.CreateSLATargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	target, err := h.svc.CreateTarget(c.Request.Context(), &req)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondCreated(c, target)
}

// GetTicketSLA GET /api/v1/tickets/:id/sla
func (h *SLAHandler) GetTicketSLA(c *gin.Context) {
	sla, err := h.svc.GetTicketSLA(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, sla)
}

// GetSLACompliance GET /api/v1/tickets/sla/compliance
func (h *SLAHandler) GetSLACompliance(c *gin.Context) {
	report, err := h.svc.GetComplianceReport(c.Request.Context(), time.Time{}, time.Time{})
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, report)
}

// CheckSLABreaches GET /api/v1/tickets/sla/breaches
func (h *SLAHandler) CheckSLABreaches(c *gin.Context) {
	breaches, err := h.svc.CheckBreaches(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"data": breaches, "count": len(breaches)})
}
