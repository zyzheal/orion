package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticket/models"
	"orion/platform-svc-go/internal/ticket/service"
)

type SuspendHandler struct {
	svc *service.SuspendService
}

func NewSuspendHandler(svc *service.SuspendService) *SuspendHandler {
	return &SuspendHandler{svc: svc}
}

// CreateSuspend POST /api/v1/tickets/suspend
func (h *SuspendHandler) CreateSuspend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketCreateSuspend")
	defer span.End()
	var req models.CreateSuspendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	record, err := h.svc.CreateSuspend(ctx, &req)
	if err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	respondCreated(c, record)
}

// ActivateSuspend POST /api/v1/tickets/suspend/:id/activate
func (h *SuspendHandler) ActivateSuspend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketActivateSuspend")
	defer span.End()
	record, err := h.svc.ActivateSuspend(ctx, c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, record)
}

// EndSuspend POST /api/v1/tickets/suspend/:id/end
func (h *SuspendHandler) EndSuspend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketEndSuspend")
	defer span.End()
	record, err := h.svc.EndSuspend(ctx, c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, record)
}

// CancelSuspend POST /api/v1/tickets/suspend/:id/cancel
func (h *SuspendHandler) CancelSuspend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketCancelSuspend")
	defer span.End()
	record, err := h.svc.CancelSuspend(ctx, c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, record)
}

// ListSuspensions GET /api/v1/tickets/suspend
func (h *SuspendHandler) ListSuspensions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketListSuspensions")
	defer span.End()
	status := c.Query("status")
	records, err := h.svc.ListSuspensions(ctx, status)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"records": records, "count": len(records)})
}

// GetSuspend GET /api/v1/tickets/suspend/:id
func (h *SuspendHandler) GetSuspend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetSuspend")
	defer span.End()
	record, err := h.svc.GetSuspend(ctx, c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, record)
}

// GetEngineerSuspensions GET /api/v1/tickets/suspend/engineer/:engineerId
func (h *SuspendHandler) GetEngineerSuspensions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetEngineerSuspensions")
	defer span.End()
	records, err := h.svc.GetEngineerSuspensions(ctx, c.Param("engineerId"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"records": records, "count": len(records)})
}

// GetEngineerSuspendImpact GET /api/v1/tickets/suspend/engineer/:engineerId/impact
func (h *SuspendHandler) GetEngineerSuspendImpact(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetEngineerSuspendImpact")
	defer span.End()
	impact, err := h.svc.GetSuspendImpact(ctx, c.Param("engineerId"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, impact)
}
