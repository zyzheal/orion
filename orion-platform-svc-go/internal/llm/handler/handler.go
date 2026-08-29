package handler

import (
	"strconv"
	"time"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"

	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/llm/models"
	"orion/platform-svc-go/internal/llm/service"
)

// Handler exposes HTTP endpoints for the LLM trace service.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a Handler backed by the given Service.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all endpoints under the provided router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Trace endpoints
	traces := rg.Group("/traces")
	{
		traces.POST("", auth.RequirePermission("llm", "write"), h.StartTrace)
		traces.GET("", h.ListTraces)
		traces.DELETE("", auth.RequirePermission("llm", "delete"), h.ClearTraces)
		traces.GET("/stats/daily", h.GetDailyStats)
		traces.GET("/scenario/:scenarioId", h.ListTracesByScenario)
		traces.GET("/:traceId", h.GetTrace)
		traces.PUT("/:traceId/complete", auth.RequirePermission("llm", "execute"), h.CompleteTrace)
	}

	// Pricing endpoints
	pricing := rg.Group("/pricing")
	{
		pricing.GET("", h.GetAllPricing)
		pricing.POST("", auth.RequirePermission("llm", "write"), h.SetCustomPricing)
		pricing.GET("/models", h.GetAvailableModels)
		pricing.POST("/savings", auth.RequirePermission("llm", "write"), h.CalculateSavings)
		pricing.GET("/estimate", h.EstimateMonthlyCost)
		pricing.GET("/:modelId", h.GetPricingForModel)
		pricing.DELETE("/:modelId", auth.RequirePermission("llm", "delete"), h.DeleteCustomPricing)
	}
}

// ---------- Trace Handlers ----------

// StartTrace handles POST /traces — begins a new trace.
func (h *Handler) StartTrace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMStartTrace")
	defer span.End()
	var req models.TraceStartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	// Default tenant_id from context if not provided in body.
	if req.TenantID == "" {
		req.TenantID = c.GetString("tenant_id")
	}

	trace, err := h.svc.StartTrace(ctx, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, trace)
}

// CompleteTrace handles PUT /traces/:traceId/complete — finalises a trace.
func (h *Handler) CompleteTrace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMCompleteTrace")
	defer span.End()
	traceID := c.Param("traceId")
	var req models.TraceCompleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	trace, err := h.svc.CompleteTrace(ctx, traceID, &req)
	if err != nil {
		if err == service.ErrTraceNotFound {
			respondNotFound(c, "trace not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, trace)
}

// GetTrace handles GET /traces/:traceId — retrieves a single trace.
func (h *Handler) GetTrace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMGetTrace")
	defer span.End()
	traceID := c.Param("traceId")
	trace, err := h.svc.GetTrace(ctx, traceID)
	if err != nil {
		respondNotFound(c, "trace not found")
		return
	}
	respondSuccess(c, trace)
}

// ListTraces handles GET /traces — lists traces for a tenant.
func (h *Handler) ListTraces(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMListTraces")
	defer span.End()
	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = c.GetString("tenant_id")
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	traces, err := h.svc.GetTracesByTenant(ctx, tenantID, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"data": traces})
}

// ListTracesByScenario handles GET /traces/scenario/:scenarioId.
func (h *Handler) ListTracesByScenario(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMListTracesByScenario")
	defer span.End()
	scenarioID := c.Param("scenarioId")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	traces, err := h.svc.GetTracesByScenario(ctx, scenarioID, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"data": traces})
}

// ClearTraces handles DELETE /traces — removes all traces.
func (h *Handler) ClearTraces(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMClearTraces")
	defer span.End()
	if err := h.svc.ClearTraces(ctx); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "all traces cleared"})
}

// GetDailyStats handles GET /traces/stats/daily — aggregated daily stats.
func (h *Handler) GetDailyStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMGetDailyStats")
	defer span.End()
	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = c.GetString("tenant_id")
	}
	dateStr := c.DefaultQuery("date", time.Now().UTC().Format("2006-01-02"))
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		respondBadRequest(c, "invalid date format, use YYYY-MM-DD")
		return
	}

	stats, err := h.svc.AggregateDailyStats(ctx, tenantID, date)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

// ---------- Pricing Handlers ----------

// GetAllPricing handles GET /pricing — returns all model pricings.
func (h *Handler) GetAllPricing(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMGetAllPricing")
	defer span.End()
	pricing := h.svc.GetAllPricing(ctx)
	respondSuccess(c, map[string]any{"data": pricing})
}

// GetPricingForModel handles GET /pricing/:modelId — returns pricing for one model.
func (h *Handler) GetPricingForModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMGetPricingForModel")
	defer span.End()
	modelID := c.Param("modelId")
	pricing := h.svc.GetPricingForModel(ctx, modelID)
	respondSuccess(c, pricing)
}

// SetCustomPricing handles POST /pricing — creates or updates custom pricing.
func (h *Handler) SetCustomPricing(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMSetCustomPricing")
	defer span.End()
	var req models.SetPricingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.TenantID == "" {
		req.TenantID = c.GetString("tenant_id")
	}

	p, err := h.svc.SetCustomPricing(ctx, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, p)
}

// DeleteCustomPricing handles DELETE /pricing/:modelId.
func (h *Handler) DeleteCustomPricing(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMDeleteCustomPricing")
	defer span.End()
	modelID := c.Param("modelId")
	deleted, err := h.svc.DeleteCustomPricing(ctx, modelID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "no custom pricing found for model")
		return
	}
	respondSuccess(c, map[string]any{"message": "pricing deleted"})
}

// GetAvailableModels handles GET /pricing/models — lists all models with pricing.
func (h *Handler) GetAvailableModels(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMGetAvailableModels")
	defer span.End()
	models := h.svc.GetAvailableModels(ctx)
	respondSuccess(c, map[string]any{"data": models})
}

// CalculateSavings handles POST /pricing/savings — compares two models.
func (h *Handler) CalculateSavings(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMCalculateSavings")
	defer span.End()
	var req models.SavingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result := h.svc.CalculateSavings(ctx, &req)
	respondSuccess(c, result)
}

// EstimateMonthlyCost handles GET /pricing/estimate — monthly cost projection.
func (h *Handler) EstimateMonthlyCost(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LLMEstimateMonthlyCost")
	defer span.End()
	modelID := c.Query("model_id")
	if modelID == "" {
		respondBadRequest(c, "model_id query parameter is required")
		return
	}
	dailyTokens, _ := strconv.ParseInt(c.DefaultQuery("daily_tokens", "0"), 10, 64)

	cost := h.svc.EstimateMonthlyCost(ctx, modelID, dailyTokens)
	respondSuccess(c, map[string]any{
		"model_id":     modelID,
		"daily_tokens": dailyTokens,
		"monthly_cost": cost,
		"currency":     "CNY",
	})
}
