package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"orion/finops-svc-go/internal/finops/models"
	"orion/finops-svc-go/internal/finops/service"
)

// AnalysisHandler provides HTTP handlers for FinOps analysis endpoints.
type AnalysisHandler struct {
	svc *service.AnalysisService
}

func NewAnalysisHandler(svc *service.AnalysisService) *AnalysisHandler {
	return &AnalysisHandler{svc: svc}
}

// ==================== Cost Records ====================

// RecordCost records an entity-level cost.
func (h *AnalysisHandler) RecordCost(c *gin.Context) {
	_ = c.GetString("tenant_id")

	var req struct {
		EntityType  string            `json:"entity_type" binding:"required"`
		EntityID    string            `json:"entity_id" binding:"required"`
		Amount      float64           `json:"amount" binding:"required"`
		Category    string            `json:"category"`
		Environment string            `json:"environment"`
		Tags        map[string]string `json:"tags"`
		Currency    string            `json:"currency"`
		Timestamp   string            `json:"timestamp"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var tagsStr string
	if req.Tags != nil {
		tj, _ := json.Marshal(req.Tags)
		tagsStr = string(tj)
	}

	var ts time.Time
	if req.Timestamp != "" {
		parsed, err := time.Parse(time.RFC3339, req.Timestamp)
		if err == nil {
			ts = parsed
		}
	}

	id, err := h.svc.RecordEntityCost(c.Request.Context(),
		req.EntityType, req.EntityID, req.Amount, req.Category,
		req.Environment, tagsStr, req.Currency, ts,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

// GetCostByEntity returns cost summary for an entity.
func (h *AnalysisHandler) GetCostByEntity(c *gin.Context) {
	entityType := c.Query("entity_type")
	entityID := c.Query("entity_id")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	ps, _ := parseTime(periodStart)
	pe, _ := parseTime(periodEnd)

	summary, err := h.svc.GetEntityCostSummary(c.Request.Context(), entityType, entityID, ps, pe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// GetCostTrendForEntity returns cost trend for an entity.
func (h *AnalysisHandler) GetCostTrendForEntity(c *gin.Context) {
	entityType := c.Query("entity_type")
	entityID := c.Query("entity_id")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	ps, _ := parseTime(periodStart)
	pe, _ := parseTime(periodEnd)

	trend, err := h.svc.GetCostTrendForEntity(c.Request.Context(), entityType, entityID, ps, pe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, trend)
}

// ListCostRecords returns all cost records.
func (h *AnalysisHandler) ListCostRecords(c *gin.Context) {
	entityType := c.Query("entity_type")
	entityID := c.Query("entity_id")
	category := c.Query("category")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	ps, _ := parseTime(periodStart)
	pe, _ := parseTime(periodEnd)

	records, err := h.svc.GetAllCostRecords(c.Request.Context(), entityType, entityID, category, ps, pe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": records})
}

// ==================== Reports ====================

// GenerateReport generates a cost report.
func (h *AnalysisHandler) GenerateReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req struct {
		Period    string             `json:"period" binding:"required"`
		TotalCost float64            `json:"total_cost" binding:"required"`
		Breakdown map[string]float64 `json:"breakdown"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	report, err := h.svc.GenerateReport(c.Request.Context(), tenantID, req.Period, req.TotalCost, req.Breakdown)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, report)
}

// ListReports returns report history.
func (h *AnalysisHandler) ListReports(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	reports, err := h.svc.GetReports(c.Request.Context(), tenantID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": reports})
}

// ==================== ROI ====================

// CreateROI creates an ROI analysis.
func (h *AnalysisHandler) CreateROI(c *gin.Context) {
	var req struct {
		InvestmentType string  `json:"investment_type" binding:"required"`
		Name           string  `json:"name" binding:"required"`
		Cost           float64 `json:"cost" binding:"required"`
		MonthlySavings float64 `json:"monthly_savings" binding:"required"`
		Description    string  `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	roiPct := 0.0
	if req.Cost > 0 {
		roiPct = (req.MonthlySavings * 12 / req.Cost) * 100
	}
	paybackMonths := 0.0
	if req.MonthlySavings > 0 {
		paybackMonths = req.Cost / req.MonthlySavings
	}

	analysis, err := h.svc.CreateROIAnalysis(c.Request.Context(), models.CreateROIRequest{
		InvestmentType: req.InvestmentType,
		Name:           req.Name,
		Cost:           req.Cost,
		Savings:        req.MonthlySavings,
		ROIPercentage:  roiPct,
		PaybackMonths:  paybackMonths,
		Description:    req.Description,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, analysis)
}

// ListROI returns ROI analysis history.
func (h *AnalysisHandler) ListROI(c *gin.Context) {
	investmentType := c.Query("investment_type")
	minROI, _ := strconv.ParseFloat(c.DefaultQuery("min_roi", "0"), 64)

	history, err := h.svc.GetROIHistory(c.Request.Context(), investmentType, minROI)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": history})
}

// GetROISummary returns ROI summary statistics.
func (h *AnalysisHandler) GetROISummary(c *gin.Context) {
	summary, err := h.svc.GetROISummary(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// ==================== Cost Comparisons ====================

// CreateCostComparison creates a cost comparison.
func (h *AnalysisHandler) CreateCostComparison(c *gin.Context) {
	var req struct {
		Description    string  `json:"description" binding:"required"`
		BeforeCost     float64 `json:"before_cost" binding:"required"`
		AfterCost      float64 `json:"after_cost" binding:"required"`
		TimeSavingsHours float64 `json:"time_savings_hours"`
		Period         string  `json:"period"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	savings := req.BeforeCost - req.AfterCost
	savingsPct := 0.0
	if req.BeforeCost > 0 {
		savingsPct = (savings / req.BeforeCost) * 100
	}

	comparison, err := h.svc.CreateCostComparison(c.Request.Context(), models.CreateCostComparisonRequest{
		Description:    req.Description,
		BeforeCost:     req.BeforeCost,
		AfterCost:      req.AfterCost,
		Savings:        savings,
		SavingsPercent: savingsPct,
		Period:         req.Period,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, comparison)
}

// ListCostComparisons returns all cost comparisons.
func (h *AnalysisHandler) ListCostComparisons(c *gin.Context) {
	comparisons, err := h.svc.GetCostComparisons(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": comparisons})
}

// ==================== Chargeback ====================

// GenerateChargebackReport generates a chargeback report.
func (h *AnalysisHandler) GenerateChargebackReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	ps, _ := parseTime(periodStart)
	pe, _ := parseTime(periodEnd)

	report, err := h.svc.GenerateChargebackReport(c.Request.Context(), tenantID, ps, pe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}

// ==================== Cost Breakdown ====================

// GetCostBreakdown returns cost breakdown by dimension.
func (h *AnalysisHandler) GetCostBreakdown(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	dimension := c.Query("dimension")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	ps, _ := parseTime(periodStart)
	pe, _ := parseTime(periodEnd)

	breakdown, err := h.svc.GetCostBreakdown(c.Request.Context(), tenantID, dimension, ps, pe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": breakdown})
}

// ==================== Legacy Budget Alerts ====================

// CreateLegacyBudgetAlert creates a legacy budget alert.
func (h *AnalysisHandler) CreateLegacyBudgetAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req struct {
		BudgetAmount     float64 `json:"budget_amount" binding:"required"`
		ThresholdPercent float64 `json:"threshold_percent"`
		Environment      string  `json:"environment"`
		Currency         string  `json:"currency"`
		Period           string  `json:"period"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.ThresholdPercent == 0 {
		req.ThresholdPercent = 80
	}

	err := h.svc.CreateLegacyBudgetAlert(c.Request.Context(), tenantID, &models.LegacyBudgetAlert{
		Environment:      req.Environment,
		BudgetAmount:     req.BudgetAmount,
		ThresholdPercent: req.ThresholdPercent,
		Currency:         req.Currency,
		Period:           req.Period,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "budget alert created"})
}

// ListLegacyBudgetAlerts returns legacy budget alerts.
func (h *AnalysisHandler) ListLegacyBudgetAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	environment := c.Query("environment")

	alerts, err := h.svc.GetLegacyBudgetAlerts(c.Request.Context(), tenantID, environment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": alerts})
}

// DeleteLegacyBudgetAlert deletes a legacy budget alert.
func (h *AnalysisHandler) DeleteLegacyBudgetAlert(c *gin.Context) {
	id := c.Param("id")

	if err := h.svc.DeleteLegacyBudgetAlert(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "alert not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// RegisterRoutes registers analysis routes on the given router group.
func (h *AnalysisHandler) RegisterRoutes(rg *gin.RouterGroup) {
	// Cost records
	costs := rg.Group("/cost-records")
	{
		costs.POST("", h.RecordCost)
		costs.GET("", h.ListCostRecords)
		costs.GET("/summary", h.GetCostByEntity)
		costs.GET("/trend", h.GetCostTrendForEntity)
	}

	// Reports
	reports := rg.Group("/reports")
	{
		reports.POST("", h.GenerateReport)
		reports.GET("", h.ListReports)
	}

	// ROI
	roi := rg.Group("/roi")
	{
		roi.POST("", h.CreateROI)
		roi.GET("", h.ListROI)
		roi.GET("/summary", h.GetROISummary)
	}

	// Cost comparisons
	comparisons := rg.Group("/cost-comparisons")
	{
		comparisons.POST("", h.CreateCostComparison)
		comparisons.GET("", h.ListCostComparisons)
	}

	// Chargeback
	rg.POST("/chargeback", h.GenerateChargebackReport)

	// Cost breakdown
	rg.GET("/cost-breakdown", h.GetCostBreakdown)

	// Legacy budget alerts
	legacy := rg.Group("/legacy-budget-alerts")
	{
		legacy.POST("", h.CreateLegacyBudgetAlert)
		legacy.GET("", h.ListLegacyBudgetAlerts)
		legacy.DELETE("/:id", h.DeleteLegacyBudgetAlert)
	}
}

func parseTime(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, nil
	}
	return time.Parse(time.RFC3339, s)
}
