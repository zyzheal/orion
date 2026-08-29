package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticket/models"
	"orion/platform-svc-go/internal/ticket/service"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetSLAQueueStatus")
	defer span.End()
	status, err := h.qm.GetSLAQueueStatus(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, status)
}

// GetSLAQueueEntries GET /api/v1/tickets/dispatch/queue/sla-entries
func (h *QueueHandler) GetSLAQueueEntries(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetSLAQueueEntries")
	defer span.End()
	entries, err := h.qm.GetSLAQueueEntries(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"entries": entries, "count": len(entries)})
}

// GetSLAAlerts GET /api/v1/tickets/dispatch/queue/sla-alerts
func (h *QueueHandler) GetSLAAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetSLAAlerts")
	defer span.End()
	var alertType *models.SLAAlertType
	if t := c.Query("type"); t != "" {
		at := models.SLAAlertType(t)
		alertType = &at
	}
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit == 0 {
		limit = 50
	}

	alerts, err := h.qm.GetSLAAlerts(ctx, alertType, limit)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"alerts": alerts, "count": len(alerts)})
}

// ReprioritizeQueue POST /api/v1/tickets/dispatch/queue/reprioritize
func (h *QueueHandler) ReprioritizeQueue(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketReprioritizeQueue")
	defer span.End()
	count, err := h.qm.ReprioritizeAll(ctx)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"reprioritized": count})
}
