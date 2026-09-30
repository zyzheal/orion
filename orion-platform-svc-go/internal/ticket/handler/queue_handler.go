package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/pagination"
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
	tenantID, ok := tenantFrom(c)
	if !ok {
		return
	}
	status, err := h.qm.GetSLAQueueStatus(ctx, tenantID)
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
	tenantID, ok := tenantFrom(c)
	if !ok {
		return
	}
	entries, err := h.qm.GetSLAQueueEntries(ctx, tenantID)
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
	tenantID, ok := tenantFrom(c)
	if !ok {
		return
	}
	var alertType *models.SLAAlertType
	if t := c.Query("type"); t != "" {
		at := models.SLAAlertType(t)
		alertType = &at
	}
	// The service truncates the loop with `if limit > 0`, so any non-positive
	// limit means "no cap" and the whole queue comes back. The old guard only
	// rescued `== 0`, so ?limit=-1 answered with every queued ticket instead of
	// 50: one minus sign, no error, no 500, just an unexpectedly long response.
	// `pagination.Limit` floors the whole non-positive range, and it caps
	// nothing on top - a queue with 55 entries and limit=1000 still returns 55.
	limit := pagination.Limit(c.Query("limit"), 50)

	alerts, err := h.qm.GetSLAAlerts(ctx, tenantID, alertType, limit)
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
	tenantID, ok := tenantFrom(c)
	if !ok {
		return
	}
	count, err := h.qm.ReprioritizeAll(ctx, tenantID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"reprioritized": count})
}
