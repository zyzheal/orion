package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/service"
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
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")

	var req models.TransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	record, err := h.svc.ManualTransfer(c.Request.Context(), ticketID, tenantID, req.ToEngineerID, req.InitiatedBy, req.Reason)
	if err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	respondSuccess(c, record)
}

// CheckAutoTransfer POST /api/v1/tickets/transfer/auto-check
func (h *TransferHandler) CheckAutoTransfer(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	transfers, err := h.svc.CheckAndAutoTransfer(c.Request.Context(), tenantID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondSuccess(c, gin.H{"transfers": transfers, "count": len(transfers)})
}

// TransferDueToSuspend POST /api/v1/tickets/transfer/suspend/:suspendId
func (h *TransferHandler) TransferDueToSuspend(c *gin.Context) {
	transfers, err := h.svc.TransferDueToSuspend(c.Request.Context(), c.Param("suspendId"))
	if err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	respondSuccess(c, gin.H{"transfers": transfers, "count": len(transfers)})
}

// GetTransferHistory GET /api/v1/tickets/transfer/:ticketId/history
func (h *TransferHandler) GetTransferHistory(c *gin.Context) {
	history, err := h.svc.GetTransferHistory(c.Request.Context(), c.Param("ticketId"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"history": history, "count": len(history)})
}

// GetTransferStats GET /api/v1/tickets/transfer/stats
func (h *TransferHandler) GetTransferStats(c *gin.Context) {
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	stats, err := h.svc.GetTransferStats(c.Request.Context(), start, end)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, stats)
}

// GetTransferConfig GET /api/v1/tickets/transfer/config
func (h *TransferHandler) GetTransferConfig(c *gin.Context) {
	respondSuccess(c, h.svc.GetConfig())
}

// UpdateTransferConfig PUT /api/v1/tickets/transfer/config
func (h *TransferHandler) UpdateTransferConfig(c *gin.Context) {
	var config models.AutoTransferConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	h.svc.UpdateConfig(config)
	respondSuccess(c, h.svc.GetConfig())
}
