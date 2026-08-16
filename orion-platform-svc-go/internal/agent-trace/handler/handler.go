package handler

import (
	"strconv"
	"time"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/agent-trace/models"
	"orion/platform-svc-go/internal/agent-trace/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for agent trace observability.
type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	read := auth.RequirePermission("agent", "read")
	write := auth.RequirePermission("agent", "write")

	g := rg.Group("/agent-trace")
	{
		g.GET("/health", h.Health)
		g.POST("", write, h.RecordTrace)
		g.GET("/:id", read, h.GetTrace)
		g.PUT("/:id/complete", write, h.CompleteTrace)
		g.GET("/list", read, h.ListTraces)
		g.GET("/metrics", read, h.GetMetrics)
	}
}

func (h *Handler) Health(c *gin.Context) {
	middleware.RespondSuccess(c, gin.H{"status": "ok", "module": "agent-trace"})
}

type recordTraceRequest struct {
	AgentID     string `json:"agent_id" binding:"required"`
	AgentName   string `json:"agent_name"`
	Prompt      string `json:"prompt"`
	ToolCalls   []struct {
		Name       string `json:"name"`
		Input      string `json:"input"`
		Output     string `json:"output"`
		DurationMs int64  `json:"duration_ms"`
		Error      string `json:"error"`
	} `json:"tool_calls"`
	Response      string    `json:"response"`
	Status        string    `json:"status"`
	DurationMs    int64     `json:"duration_ms"`
	ParentTraceID string    `json:"parent_trace_id"`
}

func (h *Handler) RecordTrace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req recordTraceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	trace := &models.AgentTrace{
		TenantID:   tenantID,
		UserID:     userID,
		AgentID:    req.AgentID,
		AgentName:  req.AgentName,
		Prompt:     req.Prompt,
		Response:   req.Response,
		Status:     req.Status,
		DurationMs: req.DurationMs,
		ParentTraceID: req.ParentTraceID,
	}
	if trace.Status == "" {
		trace.Status = "completed"
	}
	for _, tc := range req.ToolCalls {
		trace.ToolCalls = append(trace.ToolCalls, models.ToolCall{
			Name:       tc.Name,
			Input:      tc.Input,
			Output:     tc.Output,
			DurationMs: tc.DurationMs,
			Error:      tc.Error,
		})
	}

	if err := h.svc.RecordTrace(c.Request.Context(), trace); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"trace_id": trace.ID})
}

func (h *Handler) GetTrace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if id == "" {
		middleware.RespondBadRequest(c, "trace id is required")
		return
	}
	trace, err := h.svc.GetTrace(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, trace)
}

type completeRequest struct {
	Status     string `json:"status"`
	Error      string `json:"error"`
	DurationMs int64  `json:"duration_ms"`
	Response   string `json:"response"`
}

func (h *Handler) CompleteTrace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req completeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.CompleteTrace(c.Request.Context(), tenantID, id, req.Error, req.DurationMs, req.Response); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"trace_id": id})
}

func (h *Handler) ListTraces(c *gin.Context) {
	_ = c.GetString("tenant_id")
	var req models.TraceQueryRequest
	req.AgentID = c.Query("agent_id")
	req.UserID = c.Query("user_id")
	req.Status = c.Query("status")
	if limitStr := c.Query("limit"); limitStr != "" {
		if n, err := strconv.Atoi(limitStr); err == nil && n > 0 && n <= 100 {
			req.Limit = n
		}
	}
	if pageStr := c.Query("page"); pageStr != "" {
		if n, err := strconv.Atoi(pageStr); err == nil && n >= 0 {
			req.Page = n
		}
	}
	if start := c.Query("start_time"); start != "" {
		if t, err := time.Parse(time.RFC3339, start); err == nil {
			req.StartTime = t
		}
	}
	if end := c.Query("end_time"); end != "" {
		if t, err := time.Parse(time.RFC3339, end); err == nil {
			req.EndTime = t
		}
	}

	traces, total, err := h.svc.ListTraces(c.Request.Context(), req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if traces == nil {
		traces = make([]*models.AgentTrace, 0)
	}
	middleware.RespondSuccess(c, gin.H{"traces": traces, "total": total, "page": req.Page, "limit": req.Limit})
}

func (h *Handler) GetMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	agentID := c.Query("agent_id")
	days := 7
	if dStr := c.Query("days"); dStr != "" {
		if d, err := strconv.Atoi(dStr); err == nil && d > 0 && d <= 365 {
			days = d
		}
	}
	metric, err := h.svc.GetMetrics(c.Request.Context(), tenantID, agentID, days)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, metric)
}