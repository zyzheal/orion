package handler

import (
	"strconv"
	"time"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/llm-trace/models"
	"orion/platform-svc-go/internal/llm-trace/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes LLM trace endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all llm-trace endpoints under /api/v1/llm.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/api/v1/llm")

	// --- Traces ---
	// GET /api/v1/llm/traces/:traceId - Get trace by ID
	f.GET("/traces/:traceId", auth.RequirePermission("llm-trace", "read"), h.GetTrace)

	// GET /api/v1/llm/traces - List traces with filters
	f.GET("/traces", auth.RequirePermission("llm-trace", "read"), h.ListTraces)

	// POST /api/v1/llm/traces - Create a new trace
	f.POST("/traces", auth.RequirePermission("llm-trace", "write"), h.CreateTrace)

	// POST /api/v1/llm/traces/:traceId/complete - Complete a trace
	f.POST("/traces/:traceId/complete", auth.RequirePermission("llm-trace", "write"), h.CompleteTrace)

	// --- Stats & Cost ---
	// GET /api/v1/llm/stats/daily - Get daily aggregated statistics
	f.GET("/stats/daily", auth.RequirePermission("llm-trace", "read"), h.GetDailyStats)

	// GET /api/v1/llm/cost/breakdown - Get cost breakdown
	// (placed before /traces/:traceId pattern to avoid collision — no :id param)
	// already safe since /stats/ and /cost/ paths differ from /traces/:traceId

	// GET /api/v1/llm/tracking/accuracy - Get tracking accuracy metrics
	f.GET("/tracking/accuracy", auth.RequirePermission("llm-trace", "read"), h.GetTrackingAccuracy)

	// GET /api/v1/llm/pricing - Get model pricing table
	f.GET("/pricing", auth.RequirePermission("llm-trace", "read"), h.GetPricing)

	// POST /api/v1/llm/cost/estimate - Estimate cost for tokens
	f.POST("/cost/estimate", auth.RequirePermission("llm-trace", "read"), h.EstimateCost)
}

// getTenantID extracts tenant_id from Gin context.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// getUserID extracts user_id from Gin context.
func (h *Handler) getUserID(c *gin.Context) string {
	userID := c.GetString("user_id")
	if userID == "" {
		return "system"
	}
	return userID
}

// GetTrace handler - GET /api/v1/llm/traces/:traceId
func (h *Handler) GetTrace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTrace")
	defer span.End()
	traceID := c.Param("traceId")
	tenantID := h.getTenantID(c)

	t, err := h.svc.GetTrace(ctx, traceID, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Trace not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// ListTraces handler - GET /api/v1/llm/traces
func (h *Handler) ListTraces(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTraces")
	defer span.End()
	tenantID := h.getTenantID(c)

	limitStr := c.Query("limit")
	scenarioID := c.Query("scenarioId")

	q := &models.ListTracesQuery{}
	if scenarioID != "" {
		q.ScenarioID = &scenarioID
	}
	if limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err == nil && limit > 0 {
			q.Limit = &limit
		}
	}

	traces, total, err := h.svc.ListTraces(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, gin.H{
		"data":  traces,
		"total": total,
		"limit": derefInt(q.Limit),
	})
}

// CreateTrace handler - POST /api/v1/llm/traces
func (h *Handler) CreateTrace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTrace")
	defer span.End()
	var req models.TraceCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)

	t, err := h.svc.CreateTrace(ctx, tenantID, userID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, t)
}

// CompleteTrace handler - POST /api/v1/llm/traces/:traceId/complete
func (h *Handler) CompleteTrace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CompleteTrace")
	defer span.End()
	traceID := c.Param("traceId")
	tenantID := h.getTenantID(c)

	var req models.TraceCompleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	t, err := h.svc.CompleteTrace(ctx, traceID, tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Trace not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// GetDailyStats handler - GET /api/v1/llm/stats/daily
func (h *Handler) GetDailyStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDailyStats")
	defer span.End()
	tenantID := h.getTenantID(c)

	var date *string
	if dateStr := c.Query("date"); dateStr != "" {
		// Validate date format
		_, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			middleware.RespondBadRequest(c, "invalid date format, expected YYYY-MM-DD")
			return
		}
		date = &dateStr
	}

	stats, err := h.svc.GetDailyStats(ctx, tenantID, date)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// GetTrackingAccuracy handler - GET /api/v1/llm/tracking/accuracy
func (h *Handler) GetTrackingAccuracy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTrackingAccuracy")
	defer span.End()
	tenantID := h.getTenantID(c)

	accuracy, err := h.svc.GetTrackingAccuracy(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, accuracy)
}

// GetPricing handler - GET /api/v1/llm/pricing
func (h *Handler) GetPricing(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPricing")
	defer span.End()
	pricing := h.svc.GetAllPricing(ctx)

	pricingMap := make(map[string]gin.H)
	for k, v := range pricing {
		pricingMap[k] = gin.H{
			"input":  v.Input,
			"output": v.Output,
		}
	}

	middleware.RespondSuccess(c, gin.H{
		"currency": "CNY",
		"unit":     "per token",
		"pricing":  pricingMap,
	})
}

// EstimateCost handler - POST /api/v1/llm/cost/estimate
func (h *Handler) EstimateCost(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EstimateCost")
	defer span.End()
	var req models.CostEstimateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, "Missing required fields: modelId, inputTokens, outputTokens")
		return
	}

	breakdown := h.svc.CalculateCost(ctx, req.ModelID, req.InputTokens, req.OutputTokens)

	middleware.RespondSuccess(c, gin.H{
		"modelId":          req.ModelID,
		"inputTokens":      req.InputTokens,
		"outputTokens":     req.OutputTokens,
		"inputCost":        breakdown.InputCost,
		"outputCost":       breakdown.OutputCost,
		"totalCost":        breakdown.TotalCost,
		"currency":         breakdown.Currency,
		"breakdownByModel": breakdown.BreakdownByModel,
	})
}

// GetCostBreakdown handler - GET /api/v1/llm/cost/breakdown
func (h *Handler) GetCostBreakdown(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCostBreakdown")
	defer span.End()
	tenantID := h.getTenantID(c)

	q := &models.CostBreakdownQuery{}
	if startDateStr := c.Query("startDate"); startDateStr != "" {
		t, err := parseTimeQuery(startDateStr)
		if err != nil {
			middleware.RespondBadRequest(c, "invalid startDate format")
			return
		}
		q.StartDate = &t
	}
	if endDateStr := c.Query("endDate"); endDateStr != "" {
		t, err := parseTimeQuery(endDateStr)
		if err != nil {
			middleware.RespondBadRequest(c, "invalid endDate format")
			return
		}
		q.EndDate = &t
	}

	breakdown, totalTraces, err := h.svc.GetCostBreakdown(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, gin.H{
		"tenantId":         tenantID,
		"startDate":        startDateForQuery(q.StartDate),
		"endDate":          endDateForQuery(q.EndDate),
		"totalTraces":      totalTraces,
		"inputCost":        breakdown.InputCost,
		"outputCost":       breakdown.OutputCost,
		"totalCost":        breakdown.TotalCost,
		"currency":         breakdown.Currency,
		"breakdownByModel": breakdown.BreakdownByModel,
	})
}

// parseTimeQuery parses an ISO-8601 or YYYY-MM-DD string into time.Time.
func parseTimeQuery(s string) (time.Time, error) {
	// Try YYYY-MM-DD
	parsed, err := time.Parse("2006-01-02", s)
	if err == nil {
		return parsed, nil
	}
	// Try RFC3339
	parsed, err = time.Parse(time.RFC3339, s)
	if err == nil {
		return parsed, nil
	}
	return time.Time{}, err
}

func derefInt(i *int) int {
	if i == nil {
		return 0
	}
	return *i
}

func startDateForQuery(t *time.Time) interface{} {
	if t != nil {
		return t.Format("2006-01-02")
	}
	return nil
}

func endDateForQuery(t *time.Time) interface{} {
	if t != nil {
		return t.Format("2006-01-02")
	}
	return nil
}
