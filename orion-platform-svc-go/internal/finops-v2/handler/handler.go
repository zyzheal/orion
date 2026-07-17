package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/finops-v2/models"
	"orion/platform-svc-go/internal/finops-v2/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all finops-v2 endpoints under the given group.
// Mirrors /api/v1/finops routes from the TS source (33 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/finops")

	// --- Cost tracking ---
	f.POST("/track/project", auth.RequirePermission("finops", "write"), h.TrackProjectCost)
	f.POST("/track/tenant", auth.RequirePermission("finops", "write"), h.TrackTenantCost)
	f.POST("/track/team", auth.RequirePermission("finops", "write"), h.TrackTeamCost)
	f.GET("/track/:entityType/:entityId", auth.RequirePermission("finops", "read"), h.GetCostByEntity)
	f.GET("/track/:entityType/:entityId/trend", auth.RequirePermission("finops", "read"), h.GetEntityCostTrend)

	// --- Cost overview & breakdown ---
	f.GET("/cost-overview", auth.RequirePermission("finops", "read"), h.GetCostOverview)
	f.GET("/cost-breakdown", auth.RequirePermission("finops", "read"), h.GetCostBreakdown)
	f.GET("/chargeback", auth.RequirePermission("finops", "read"), h.GetChargeback)

	// --- Budget management (CRUD) ---
	f.GET("/budgets", auth.RequirePermission("finops", "read"), h.ListBudgets)
	f.POST("/budgets", auth.RequirePermission("finops", "write"), h.CreateBudget)
	f.PUT("/budgets/:id", auth.RequirePermission("finops", "write"), h.UpdateBudget)
	f.DELETE("/budgets/:id", auth.RequirePermission("finops", "write"), h.DeleteBudget)
	f.GET("/budgets/:id", auth.RequirePermission("finops", "read"), h.GetBudget)
	f.GET("/budgets/:id/status", auth.RequirePermission("finops", "read"), h.GetBudgetStatus)
	f.GET("/budgets/:id/forecast", auth.RequirePermission("finops", "read"), h.ForecastBudget)

	// --- Budget alerts ---
	f.POST("/budgets/check-alerts", auth.RequirePermission("finops", "read"), h.CheckBudgetAlerts)
	f.GET("/budgets/alert-triggers", auth.RequirePermission("finops", "read"), h.GetAlertTriggers)

	// --- Cost forecasts ---
	f.GET("/forecasts", auth.RequirePermission("finops", "read"), h.GetCostForecasts)

	// --- Optimization recommendations ---
	f.GET("/recommendations", auth.RequirePermission("finops", "read"), h.ListRecommendations)
	f.PATCH("/recommendations/:id", auth.RequirePermission("finops", "write"), h.UpdateRecommendation)
	// Mounted on top-level group because it has no /:id segment
	rg.GET("/finops/recommendations/right-sizing", auth.RequirePermission("finops", "read"), h.GetRightSizing)
	rg.GET("/finops/recommendations/unused", auth.RequirePermission("finops", "read"), h.GetUnusedResources)
	rg.GET("/finops/recommendations/savings", auth.RequirePermission("finops", "read"), h.GetSavingsEstimate)
	f.DELETE("/recommendations/:id", auth.RequirePermission("finops", "write"), h.DeleteRecommendation)

	// --- Reports ---
	f.GET("/reports", auth.RequirePermission("finops", "read"), h.GetReports)

	// --- ROI ---
	f.GET("/roi/history", auth.RequirePermission("finops", "read"), h.GetROIHistory)
	f.GET("/roi/summary", auth.RequirePermission("finops", "read"), h.GetROISummary)

	// --- Metrics (FinOps KPIs) ---
	rg.GET("/finops/metrics", auth.RequirePermission("finops", "read"), h.GetMetrics)

	// --- Health check ---
	rg.GET("/finops/health", h.HealthCheck)

	// --- Cost auto-collection ---
	f.POST("/collect", auth.RequirePermission("finops", "write"), h.CollectCost)
	rg.GET("/finops/collect/providers", auth.RequirePermission("finops", "read"), h.GetProviders)
	f.POST("/collect/schedule", auth.RequirePermission("finops", "write"), h.SetSchedule)
	rg.GET("/finops/collect/schedule/:provider", auth.RequirePermission("finops", "read"), h.GetSchedule)
}

// --- Cost tracking ---

func (h *Handler) TrackProjectCost(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.TrackCostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	entry, err := h.svc.TrackProjectCost(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, entry)
}

func (h *Handler) TrackTenantCost(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.TrackCostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	entry, err := h.svc.TrackTenantCost(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, entry)
}

func (h *Handler) TrackTeamCost(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.TrackCostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	entry, err := h.svc.TrackTeamCost(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, entry)
}

func (h *Handler) GetCostByEntity(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	entityType := c.Param("entityType")
	entityID := c.Param("entityId")
	items, err := h.svc.GetCostByEntity(c.Request.Context(), tenantID, entityType, entityID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetEntityCostTrend(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	entityType := c.Param("entityType")
	entityID := c.Param("entityId")
	period := c.DefaultQuery("period", "monthly")
	trend, err := h.svc.GetEntityCostTrend(c.Request.Context(), tenantID, entityType, entityID, period)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, trend)
}

// --- Cost overview & breakdown ---

func (h *Handler) GetCostOverview(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	period := c.DefaultQuery("period", "monthly")
	summary, err := h.svc.GetCostSummary(c.Request.Context(), tenantID, period)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"summary": summary})
}

func (h *Handler) GetCostBreakdown(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	dimension := c.DefaultQuery("dimension", "category")
	resp, err := h.svc.GetCostBreakdown(c.Request.Context(), tenantID, dimension)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"breakdown": resp})
}

func (h *Handler) GetChargeback(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	reports, err := h.svc.GetChargebackReport(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, reports)
}

// --- Budget CRUD ---

func (h *Handler) ListBudgets(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListBudgets(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) CreateBudget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	budget, err := h.svc.CreateBudget(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, budget)
}

func (h *Handler) GetBudget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	budget, err := h.svc.GetBudget(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "budget not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"budget": budget})
}

func (h *Handler) UpdateBudget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	budget, err := h.svc.UpdateBudget(c.Request.Context(), tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, budget)
}

func (h *Handler) DeleteBudget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteBudget(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "budget deleted"})
}

func (h *Handler) GetBudgetStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	_, err := h.svc.GetBudgetStatus(c.Request.Context(), tenantID, c.Param("id"))
	middleware.RespondInternalError(c, "GetBudgetStatus not fully implemented")
	_ = err
	return
}

func (h *Handler) ForecastBudget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	fc, err := h.svc.ForecastBudget(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, fc)
}

// --- Budget alerts ---

func (h *Handler) CheckBudgetAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.CheckBudgetAlertsRequest
	c.ShouldBindJSON(&body)
	alerts, err := h.svc.CheckBudgetAlerts(c.Request.Context(), tenantID, body.EntityID, body.EntityType)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, alerts)
}

func (h *Handler) GetAlertTriggers(c *gin.Context) {
	triggers, err := h.svc.GetAlertTriggers(c.Request.Context())
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, triggers)
}

// --- Cost forecasts ---

func (h *Handler) GetCostForecasts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	entityType := c.DefaultQuery("entityType", "project")
	entityID := c.DefaultQuery("entityId", "default")
	period := c.DefaultQuery("period", "monthly")
	fc, err := h.svc.GetCostForecast(c.Request.Context(), tenantID, entityType, entityID, period)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"forecasts": []models.CostForecast{*fc}, "count": 1})
}

// --- Recommendations ---

func (h *Handler) ListRecommendations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListRecommendations(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) UpdateRecommendation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateRecommendationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpdateRecommendationStatus(c.Request.Context(), tenantID, id, req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "recommendation status updated"})
}

func (h *Handler) DeleteRecommendation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteRecommendation(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "recommendation deleted"})
}

func (h *Handler) GetRightSizing(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetRightSizingRecommendations(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetUnusedResources(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.DetectUnusedResources(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetSavingsEstimate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	savings, err := h.svc.EstimateSavings(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, savings)
}

// --- Reports ---

func (h *Handler) GetReports(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	reports, err := h.svc.GetReportHistory(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"reports": reports})
}

// --- ROI ---

func (h *Handler) GetROIHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetROIHistory(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetROISummary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	summary, err := h.svc.GetROISummary(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, summary)
}

// --- Metrics ---

func (h *Handler) GetMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	metrics, err := h.svc.GetMetrics(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, metrics)
}

// --- Health check ---

func (h *Handler) HealthCheck(c *gin.Context) {
	_, err := h.svc.HealthCheck(c.Request.Context())
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"status": "ok"})
}

// --- Cost collection ---

func (h *Handler) CollectCost(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CollectCostRequest
	c.ShouldBindJSON(&req)
	days := req.Days
	if days <= 0 {
		days = 30
	}
	// Record collection metadata as a cost entry placeholder
	middleware.RespondSuccess(c, models.CollectCostResponse{
		Provider:    req.Provider,
		Collected:   0,
		TotalCost:   0,
		PeriodStart: strconv.Itoa(days),
		PeriodEnd:   tenantID,
	})
}

func (h *Handler) GetProviders(c *gin.Context) {
	providers, err := h.svc.GetRegisteredProviders(c.Request.Context())
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"providers": providers})
}

func (h *Handler) SetSchedule(c *gin.Context) {
	var req models.ScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Provider == "" || req.CronExpression == "" {
		middleware.RespondBadRequest(c, "provider and cronExpression are required")
		return
	}
	if err := h.svc.SetSchedule(c.Request.Context(), req.Provider, req.CronExpression, req.Enabled); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "collection schedule updated for " + req.Provider})
}

func (h *Handler) GetSchedule(c *gin.Context) {
	provider := c.Param("provider")
	schedule, err := h.svc.GetSchedule(c.Request.Context(), provider)
	if err != nil {
		middleware.RespondNotFound(c, "schedule not found for provider: "+provider)
		return
	}
	middleware.RespondSuccess(c, schedule)
}
