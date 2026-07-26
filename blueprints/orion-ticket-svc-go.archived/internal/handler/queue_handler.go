package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/service"
)

// QueueHandler handles SLA-aware queue management HTTP requests
type QueueHandler struct {
	qm *service.QueueManager
}

func NewQueueHandler(qm *service.QueueManager) *QueueHandler {
	return &QueueHandler{qm: qm}
}

// GetSLAQueueStatus GET /api/v1/tickets/dispatch/queue/sla-status
func (h *QueueHandler) GetSLAQueueStatus(c *gin.Context) {
	status, err := h.qm.GetSLAQueueStatus(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, status)
}

// GetSLAQueueEntries GET /api/v1/tickets/dispatch/queue/sla-entries
func (h *QueueHandler) GetSLAQueueEntries(c *gin.Context) {
	entries, err := h.qm.GetSLAQueueEntries(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"entries": entries, "count": len(entries)})
}

// GetSLAAlerts GET /api/v1/tickets/dispatch/queue/sla-alerts
func (h *QueueHandler) GetSLAAlerts(c *gin.Context) {
	var alertType *models.SLAAlertType
	if t := c.Query("type"); t != "" {
		at := models.SLAAlertType(t)
		alertType = &at
	}
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit == 0 {
		limit = 50
	}

	alerts, err := h.qm.GetSLAAlerts(c.Request.Context(), alertType, limit)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"alerts": alerts, "count": len(alerts)})
}

// ReprioritizeQueue POST /api/v1/tickets/dispatch/queue/reprioritize
func (h *QueueHandler) ReprioritizeQueue(c *gin.Context) {
	count, err := h.qm.ReprioritizeAll(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"reprioritized": count})
}
