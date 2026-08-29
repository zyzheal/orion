package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticket/models"
	"orion/platform-svc-go/internal/ticket/service"
)

// TransferHandler handles transfer-related HTTP requests
type TransferHandler struct {
	svc *service.TransferService
}

func NewTransferHandler(svc *service.TransferService) *TransferHandler {
	return &TransferHandler{svc: svc}
}

// ManualTransfer POST /api/v1/tickets/transfer/:ticketId
func (h *TransferHandler) ManualTransfer(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketManualTransfer")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")

	var req models.TransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	record, err := h.svc.ManualTransfer(ctx, ticketID, tenantID, req.ToEngineerID, req.InitiatedBy, req.Reason)
	if err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	respondSuccess(c, record)
}

// CheckAutoTransfer POST /api/v1/tickets/transfer/auto-check
func (h *TransferHandler) CheckAutoTransfer(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketCheckAutoTransfer")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	transfers, err := h.svc.CheckAndAutoTransfer(ctx, tenantID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondSuccess(c, gin.H{"transfers": transfers, "count": len(transfers)})
}

// TransferDueToSuspend POST /api/v1/tickets/transfer/suspend/:suspendId
func (h *TransferHandler) TransferDueToSuspend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketTransferDueToSuspend")
	defer span.End()
	transfers, err := h.svc.TransferDueToSuspend(ctx, c.Param("suspendId"))
	if err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	respondSuccess(c, gin.H{"transfers": transfers, "count": len(transfers)})
}

// GetTransferHistory GET /api/v1/tickets/transfer/:ticketId/history
func (h *TransferHandler) GetTransferHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetTransferHistory")
	defer span.End()
	history, err := h.svc.GetTransferHistory(ctx, c.Param("ticketId"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"history": history, "count": len(history)})
}

// GetTransferStats GET /api/v1/tickets/transfer/stats
func (h *TransferHandler) GetTransferStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetTransferStats")
	defer span.End()
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	stats, err := h.svc.GetTransferStats(ctx, start, end)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, stats)
}

// GetTransferConfig GET /api/v1/tickets/transfer/config
func (h *TransferHandler) GetTransferConfig(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetTransferConfig")
	defer span.End()
	respondSuccess(c, h.svc.GetConfig())
}

// UpdateTransferConfig PUT /api/v1/tickets/transfer/config
func (h *TransferHandler) UpdateTransferConfig(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketUpdateTransferConfig")
	defer span.End()
	var config models.AutoTransferConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	h.svc.UpdateConfig(config)
	respondSuccess(c, h.svc.GetConfig())
}
