package handler

import (
	"net/http"
	"strconv"
	"time"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"

	"orion/ai-svc-go/internal/llm/models"
	"orion/ai-svc-go/internal/llm/service"
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
	var req models.TraceStartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Default tenant_id from context if not provided in body.
	if req.TenantID == "" {
		req.TenantID = c.GetString("tenant_id")
	}

	trace, err := h.svc.StartTrace(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, trace)
}

// CompleteTrace handles PUT /traces/:traceId/complete — finalises a trace.
func (h *Handler) CompleteTrace(c *gin.Context) {
	traceID := c.Param("traceId")
	var req models.TraceCompleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	trace, err := h.svc.CompleteTrace(c.Request.Context(), traceID, &req)
	if err != nil {
		if err == service.ErrTraceNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "trace not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, trace)
}

// GetTrace handles GET /traces/:traceId — retrieves a single trace.
func (h *Handler) GetTrace(c *gin.Context) {
	traceID := c.Param("traceId")
	trace, err := h.svc.GetTrace(c.Request.Context(), traceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "trace not found"})
		return
	}
	c.JSON(http.StatusOK, trace)
}

// ListTraces handles GET /traces — lists traces for a tenant.
func (h *Handler) ListTraces(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = c.GetString("tenant_id")
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	traces, err := h.svc.GetTracesByTenant(c.Request.Context(), tenantID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": traces})
}

// ListTracesByScenario handles GET /traces/scenario/:scenarioId.
func (h *Handler) ListTracesByScenario(c *gin.Context) {
	scenarioID := c.Param("scenarioId")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	traces, err := h.svc.GetTracesByScenario(c.Request.Context(), scenarioID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": traces})
}

// ClearTraces handles DELETE /traces — removes all traces.
func (h *Handler) ClearTraces(c *gin.Context) {
	if err := h.svc.ClearTraces(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "all traces cleared"})
}

// GetDailyStats handles GET /traces/stats/daily — aggregated daily stats.
func (h *Handler) GetDailyStats(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = c.GetString("tenant_id")
	}
	dateStr := c.DefaultQuery("date", time.Now().UTC().Format("2006-01-02"))
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format, use YYYY-MM-DD"})
		return
	}

	stats, err := h.svc.AggregateDailyStats(c.Request.Context(), tenantID, date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// ---------- Pricing Handlers ----------

// GetAllPricing handles GET /pricing — returns all model pricings.
func (h *Handler) GetAllPricing(c *gin.Context) {
	pricing := h.svc.GetAllPricing(c.Request.Context())
	c.JSON(http.StatusOK, gin.H{"data": pricing})
}

// GetPricingForModel handles GET /pricing/:modelId — returns pricing for one model.
func (h *Handler) GetPricingForModel(c *gin.Context) {
	modelID := c.Param("modelId")
	pricing := h.svc.GetPricingForModel(c.Request.Context(), modelID)
	c.JSON(http.StatusOK, pricing)
}

// SetCustomPricing handles POST /pricing — creates or updates custom pricing.
func (h *Handler) SetCustomPricing(c *gin.Context) {
	var req models.SetPricingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.TenantID == "" {
		req.TenantID = c.GetString("tenant_id")
	}

	p, err := h.svc.SetCustomPricing(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

// DeleteCustomPricing handles DELETE /pricing/:modelId.
func (h *Handler) DeleteCustomPricing(c *gin.Context) {
	modelID := c.Param("modelId")
	deleted, err := h.svc.DeleteCustomPricing(c.Request.Context(), modelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !deleted {
		c.JSON(http.StatusNotFound, gin.H{"error": "no custom pricing found for model"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "pricing deleted"})
}

// GetAvailableModels handles GET /pricing/models — lists all models with pricing.
func (h *Handler) GetAvailableModels(c *gin.Context) {
	models := h.svc.GetAvailableModels(c.Request.Context())
	c.JSON(http.StatusOK, gin.H{"data": models})
}

// CalculateSavings handles POST /pricing/savings — compares two models.
func (h *Handler) CalculateSavings(c *gin.Context) {
	var req models.SavingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result := h.svc.CalculateSavings(c.Request.Context(), &req)
	c.JSON(http.StatusOK, result)
}

// EstimateMonthlyCost handles GET /pricing/estimate — monthly cost projection.
func (h *Handler) EstimateMonthlyCost(c *gin.Context) {
	modelID := c.Query("model_id")
	if modelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "model_id query parameter is required"})
		return
	}
	dailyTokens, _ := strconv.ParseInt(c.DefaultQuery("daily_tokens", "0"), 10, 64)

	cost := h.svc.EstimateMonthlyCost(c.Request.Context(), modelID, dailyTokens)
	c.JSON(http.StatusOK, gin.H{
		"model_id":      modelID,
		"daily_tokens":  dailyTokens,
		"monthly_cost":  cost,
		"currency":      "CNY",
	})
}
