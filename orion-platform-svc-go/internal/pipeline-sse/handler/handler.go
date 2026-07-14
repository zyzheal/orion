package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-sse/models"
	"orion/platform-svc-go/internal/pipeline-sse/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP handlers for pipeline SSE endpoints.
type Handler struct {
	hub *service.SSEHub
}

// NewHandler creates a new Handler.
func NewHandler(hub *service.SSEHub) *Handler {
	return &Handler{hub: hub}
}

// RegisterRoutes registers all pipeline SSE endpoints under the given group.
// Mirrors the TS source routes under /pipelines/sse.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/pipelines/sse")

	// GET /pipelines/sse/logs - SSE stream for pipeline log events
	f.GET("/logs", auth.RequirePermission("pipeline", "read"), h.StreamLogs)

	// GET /pipelines/sse/status - SSE stream for pipeline status events
	f.GET("/status", auth.RequirePermission("pipeline", "read"), h.StreamStatus)

	// POST /pipelines/sse/publish/log - Internal endpoint to publish log events
	f.POST("/publish/log", h.PublishLog)

	// POST /pipelines/sse/publish/status - Internal endpoint to publish status events
	f.POST("/publish/status", h.PublishStatus)

	// GET /pipelines/sse/stats - Connection statistics
	f.GET("/stats", auth.RequirePermission("pipeline", "read"), h.GetStats)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// StreamLogs handles GET /pipelines/sse/logs.
// It establishes an SSE connection for streaming pipeline log events.
func (h *Handler) StreamLogs(c *gin.Context) {
	pipelineID := c.Query("pipelineId")
	runID := c.Query("runId")
	logLevel := c.Query("logLevel")

	if pipelineID == "" || runID == "" {
		respondBadRequest(c, "pipelineId and runId are required")
		return
	}

	userID := c.GetString("user_id")

	var logLevels []string
	if logLevel != "" {
		logLevels = []string{logLevel}
	}

	connID := h.hub.CreateConnection(pipelineID, runID, userID, logLevels, true, false)

	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	h.hub.StreamLogEvents(c, connID)
}

// StreamStatus handles GET /pipelines/sse/status.
// It establishes an SSE connection for streaming pipeline status events.
func (h *Handler) StreamStatus(c *gin.Context) {
	pipelineID := c.Query("pipelineId")
	runID := c.Query("runId")

	if pipelineID == "" || runID == "" {
		respondBadRequest(c, "pipelineId and runId are required")
		return
	}

	userID := c.GetString("user_id")
	connID := h.hub.CreateConnection(pipelineID, runID, userID, nil, false, true)

	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	h.hub.StreamStatusEvents(c, connID)
}

// PublishLog handles POST /pipelines/sse/publish/log.
// Internal endpoint that accepts a log event and broadcasts it.
func (h *Handler) PublishLog(c *gin.Context) {
	var req models.PublishLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := c.GetString("tenant_id")

	if err := h.hub.PublishLogEvent(c.Request.Context(), tenantID, &req); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "log event published"})
}

// PublishStatus handles POST /pipelines/sse/publish/status.
// Internal endpoint that accepts a status event and broadcasts it.
func (h *Handler) PublishStatus(c *gin.Context) {
	var req models.PublishStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := c.GetString("tenant_id")

	if err := h.hub.PublishStatusEvent(c.Request.Context(), tenantID, &req); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "status event published"})
}

// GetStats handles GET /pipelines/sse/stats.
func (h *Handler) GetStats(c *gin.Context) {
	stats := h.hub.GetStats()
	respondSuccess(c, stats)
}

// GetEvents handles GET /pipelines/sse/events (optional, for replay).
func (h *Handler) GetEvents(c *gin.Context) {
	pipelineID := c.Query("pipelineId")
	runID := c.Query("runId")
	limitStr := c.DefaultQuery("limit", "200")

	if pipelineID == "" || runID == "" {
		respondBadRequest(c, "pipelineId and runId are required")
		return
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 200
	}

	events, err := h.hub.ListEvents(c.Request.Context(), pipelineID, runID, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, events)
}