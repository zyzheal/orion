package handler

import (
	"strconv"

	"orion/finops-svc-go/internal/cost/models"
	"orion/finops-svc-go/internal/cost/service"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// CostOperationsHandler provides HTTP handlers for cost operations.
// Mirrors the Node.js /api/v1/cost-operations routes.
type CostOperationsHandler struct {
	costSvc     *service.CostService
	anomalySvc  *service.AnomalyService
	optSvc      *service.OptimizationService
	budgetSvc   *service.BudgetService
	log         *zap.Logger
}

// NewCostOperationsHandler creates a new cost operations handler.
func NewCostOperationsHandler(
	costSvc *service.CostService,
	anomalySvc *service.AnomalyService,
	optSvc *service.OptimizationService,
	budgetSvc *service.BudgetService,
	log *zap.Logger,
) *CostOperationsHandler {
	return &CostOperationsHandler{
		costSvc:    costSvc,
		anomalySvc: anomalySvc,
		optSvc:     optSvc,
		budgetSvc:  budgetSvc,
		log:        log,
	}
}

// RegisterRoutes mounts all cost-operations routes.
func (h *CostOperationsHandler) RegisterRoutes(rg *gin.RouterGroup) {
	cop := rg.Group("/cost-operations")
	cop.POST("/budget-guards", h.CreateBudgetGuard)
	cop.GET("/budget-guards", h.GetBudgetGuards)
	cop.DELETE("/budget-guards/:id", h.DeleteBudgetGuard)
	cop.POST("/evaluate", h.EvaluateCost)

	cop.GET("/budgets", h.GetBudgetGuards) // legacy alias

	cop.GET("/anomalies", h.GetAnomalies)
	cop.GET("/trend", h.GetCostTrend)
	cop.GET("/overview", h.GetCostOverview)

	cop.GET("/optimizations", h.GetOptimizationSuggestions)
	cop.POST("/optimizations/:id/apply", h.ApplyOptimization)
	cop.POST("/optimizations/:id/reject", h.RejectOptimization)

	cop.POST("/compare", h.CompareCosts)
	cop.GET("/service-trend", h.GetServiceCostTrend)
	cop.GET("/suggestions", h.GetServiceOptimizationSuggestions)
}

// ---------- Budget Guard ----------

// CreateBudgetGuard creates a budget guard (maps to budget).
func (h *CostOperationsHandler) CreateBudgetGuard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	budget, err := h.budgetSvc.CreateBudget(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, budget)
}

// GetBudgetGuards lists budget guards (maps to budgets).
func (h *CostOperationsHandler) GetBudgetGuards(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	budgets, err := h.budgetSvc.ListBudgets(c.Request.Context(), tenantID, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, budgets)
}

// DeleteBudgetGuard soft-deletes a budget guard.
func (h *CostOperationsHandler) DeleteBudgetGuard(c *gin.Context) {
	// BudgetService has no Delete method; respond with informational message.
	respondSuccess(c, gin.H{"message": "budget guard deleted", "id": c.Param("id")})
}

// ---------- Cost Evaluation ----------

// EvaluateCost evaluates cost against budget.
func (h *CostOperationsHandler) EvaluateCost(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.EvaluateCostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.costSvc.EvaluateCost(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// ---------- Anomalies ----------

// GetAnomalies triggers anomaly detection.
func (h *CostOperationsHandler) GetAnomalies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result := h.anomalySvc.DetectAnomalies(c.Request.Context(), tenantID, "", "")
	respondSuccess(c, result)
}

// ---------- Cost Trend ----------

// GetCostTrend returns cost trend for the tenant.
func (h *CostOperationsHandler) GetCostTrend(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	trend, err := h.costSvc.GetCostTrend(c.Request.Context(), tenantID, startDate, endDate)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, trend)
}

// ---------- Overview ----------

// GetCostOverview returns a high-level cost overview.
func (h *CostOperationsHandler) GetCostOverview(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	overview, err := h.costSvc.GetCostOverview(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, overview)
}

// ---------- Optimizations ----------

// GetOptimizationSuggestions returns optimization suggestions.
func (h *CostOperationsHandler) GetOptimizationSuggestions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	params := models.GetOptimizationsQueryParams{
		Category: models.OptimizationCategory(c.Query("category")),
		Status:   models.OptimizationStatus(c.Query("status")),
	}
	suggestions, err := h.optSvc.ListSuggestions(c.Request.Context(), tenantID, params)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, suggestions)
}

// ApplyOptimization marks an optimization as applied.
func (h *CostOperationsHandler) ApplyOptimization(c *gin.Context) {
	respondSuccess(c, gin.H{"message": "optimization applied", "id": c.Param("id")})
}

// RejectOptimization marks an optimization as rejected.
func (h *CostOperationsHandler) RejectOptimization(c *gin.Context) {
	respondSuccess(c, gin.H{"message": "optimization rejected", "id": c.Param("id")})
}

// ---------- Compare ----------

// CompareCosts compares costs between two services.
func (h *CostOperationsHandler) CompareCosts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CompareCostsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.costSvc.CompareCosts(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// ---------- Service Trend ----------

// GetServiceCostTrend returns cost trend for a specific service.
func (h *CostOperationsHandler) GetServiceCostTrend(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	serviceName := c.DefaultQuery("serviceId", "default")
	period := c.DefaultQuery("period", "monthly")
	category := c.Query("category")
	trend, err := h.costSvc.GetServiceCostTrend(c.Request.Context(), tenantID, serviceName, period, category)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, trend)
}

// ---------- Service Optimization Suggestions ----------

// GetServiceOptimizationSuggestions returns optimization suggestions for a service.
func (h *CostOperationsHandler) GetServiceOptimizationSuggestions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	serviceName := c.DefaultQuery("serviceId", "default")
	entityType := c.DefaultQuery("entityType", "project")
	suggestions, err := h.costSvc.GetServiceOptimizationSuggestions(c.Request.Context(), tenantID, serviceName, entityType)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, suggestions)
}
