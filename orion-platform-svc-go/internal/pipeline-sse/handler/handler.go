package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-sse/models"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

// Hub defines the service interface needed by the SSE handler.
// Extracted from *service.SSEHub so tests can use a mock.
type Hub interface {
	CreateConnection(pipelineID, runID, userID string, logLevels []string, includeLogs, includeStatus bool) string
	StreamLogEvents(c *gin.Context, connID string)
	StreamStatusEvents(c *gin.Context, connID string)
	PublishLogEvent(ctx context.Context, tenantID string, event *models.PublishLogRequest) error
	PublishStatusEvent(ctx context.Context, tenantID string, event *models.PublishStatusRequest) error
	GetStats() *models.SSEStats
	ListEvents(ctx context.Context, pipelineID, runID string, limit int) ([]map[string]interface{}, error)
}

// Handler exposes HTTP handlers for pipeline SSE endpoints.
type Handler struct {
	hub Hub
}

// NewHandler creates a new Handler.
func NewHandler(hub Hub) *Handler {
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StreamLogs")
	defer span.End()
	pipelineID := c.Query("pipelineId")
	runID := c.Query("runId")
	logLevel := c.Query("logLevel")

	if pipelineID == "" || runID == "" {
		middleware.RespondBadRequest(c, "pipelineId and runId are required")
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StreamStatus")
	defer span.End()
	pipelineID := c.Query("pipelineId")
	runID := c.Query("runId")

	if pipelineID == "" || runID == "" {
		middleware.RespondBadRequest(c, "pipelineId and runId are required")
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PublishLog")
	defer span.End()
	var req models.PublishLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := c.GetString("tenant_id")

	if err := h.hub.PublishLogEvent(ctx, tenantID, &req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "log event published"})
}

// PublishStatus handles POST /pipelines/sse/publish/status.
// Internal endpoint that accepts a status event and broadcasts it.
func (h *Handler) PublishStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PublishStatus")
	defer span.End()
	var req models.PublishStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := c.GetString("tenant_id")

	if err := h.hub.PublishStatusEvent(ctx, tenantID, &req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "status event published"})
}

// GetStats handles GET /pipelines/sse/stats.
func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	stats := h.hub.GetStats()
	middleware.RespondSuccess(c, stats)
}

// GetEvents handles GET /pipelines/sse/events (optional, for replay).
func (h *Handler) GetEvents(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEvents")
	defer span.End()
	pipelineID := c.Query("pipelineId")
	runID := c.Query("runId")
	limitStr := c.DefaultQuery("limit", "200")

	if pipelineID == "" || runID == "" {
		middleware.RespondBadRequest(c, "pipelineId and runId are required")
		return
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 200
	}

	events, err := h.hub.ListEvents(ctx, pipelineID, runID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, events)
}
