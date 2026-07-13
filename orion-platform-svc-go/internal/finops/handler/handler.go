package handler

import (
	"fmt"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/finops/models"
	"orion/platform-svc-go/internal/finops/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all finops endpoints under the given group.
// Mirrors /api/v1/cost-operations routes from the TS source (14 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/cost-operations")

	// --- Budget Guards ---
	// POST /cost-operations/budget-guards
	f.POST("/budget-guards", auth.RequirePermission("finops", "write"), h.CreateBudgetGuard)
	// GET /cost-operations/budget-guards
	f.GET("/budget-guards", auth.RequirePermission("finops", "read"), h.ListBudgetGuards)
	// DELETE /cost-operations/budget-guards/:id
	f.DELETE("/budget-guards/:id", auth.RequirePermission("finops", "write"), h.DeleteBudgetGuard)
	// GET /cost-operations/budgets (legacy alias for budget-guards)
	f.GET("/budgets", auth.RequirePermission("finops", "read"), h.ListBudgetGuards)

	// --- Evaluate ---
	// POST /cost-operations/evaluate
	f.POST("/evaluate", auth.RequirePermission("finops", "read"), h.EvaluateCost)

	// --- Anomalies ---
	// GET /cost-operations/anomalies
	f.GET("/anomalies", auth.RequirePermission("finops", "read"), h.DetectAnomalies)

	// --- Cost Trend ---
	// GET /cost-operations/trend
	f.GET("/trend", auth.RequirePermission("finops", "read"), h.GetCostTrend)

	// --- Cost Overview ---
	// GET /cost-operations/overview
	f.GET("/overview", auth.RequirePermission("finops", "read"), h.GetCostOverview)

	// --- Optimization Suggestions ---
	// GET /cost-operations/optimizations
	f.GET("/optimizations", auth.RequirePermission("finops", "read"), h.ListOptimizations)
	// POST /cost-operations/optimizations/:id/apply
	f.POST("/optimizations/:id/apply", auth.RequirePermission("finops", "write"), h.ApplyOptimization)
	// POST /cost-operations/optimizations/:id/reject
	f.POST("/optimizations/:id/reject", auth.RequirePermission("finops", "write"), h.RejectOptimization)

	// --- Cost Comparison (4.40) ---
	// POST /cost-operations/compare
	f.POST("/compare", auth.RequirePermission("finops", "read"), h.CompareCosts)

	// --- Service Cost Trend (4.40) ---
	// GET /cost-operations/service-trend
	f.GET("/service-trend", auth.RequirePermission("finops", "read"), h.GetServiceCostTrend)

	// --- Service Optimization Suggestions (4.40) ---
	// GET /cost-operations/suggestions
	f.GET("/suggestions", auth.RequirePermission("finops", "read"), h.GetServiceOptimizationSuggestions)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// --- Budget Guards ---

func (h *Handler) CreateBudgetGuard(c *gin.Context) {
	var req models.CreateBudgetGuardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Name == "" || req.Action == "" {
		respondBadRequest(c, "name and action are required")
		return
	}
	tenantID := h.getTenantID(c)
	guard, err := h.svc.CreateBudgetGuard(c.Request.Context(), &req, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, guard)
}

func (h *Handler) ListBudgetGuards(c *gin.Context) {
	tenantID := h.getTenantID(c)
	guards, err := h.svc.ListBudgetGuards(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, guards)
}

func (h *Handler) DeleteBudgetGuard(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteBudgetGuard(c.Request.Context(), id, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "budget guard not found")
		return
	}
	respondSuccess(c, gin.H{"message": "budget guard deleted"})
}

// --- Evaluate Cost ---

func (h *Handler) EvaluateCost(c *gin.Context) {
	var req struct {
		PipelineID    string   `json:"pipelineId"`
		EstimatedCost *float64 `json:"estimatedCost"`
		ProjectID     *string  `json:"projectId"`
		Environment   *string  `json:"environment"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.PipelineID == "" || req.EstimatedCost == nil {
		respondBadRequest(c, "pipelineId and estimatedCost are required")
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.EvaluateCost(c.Request.Context(), tenantID, req.PipelineID, *req.EstimatedCost, req.ProjectID, req.Environment)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	// Mirrors TS: 200 if passed, 403 if failed
	if !result.Passed {
		respondForbidden(c, result.Message)
		return
	}
	respondSuccess(c, result)
}

// --- Anomalies ---

func (h *Handler) DetectAnomalies(c *gin.Context) {
	var req models.DetectAnomaliesRequest
	c.ShouldBindJSON(&req) // optional body, don't fail on bad json
	tenantID := h.getTenantID(c)
	result, err := h.svc.DetectAnomalies(c.Request.Context(), tenantID, req.Days, req.Start, req.End)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// --- Cost Trend ---

func (h *Handler) GetCostTrend(c *gin.Context) {
	daysStr := c.Query("days")
	days := 30
	if daysStr != "" {
		var d int
		_, err := fmt.Sscanf(daysStr, "%d", &d)
		if err == nil && d > 0 {
			days = d
		}
	}
	tenantID := h.getTenantID(c)
	trend, err := h.svc.GetCostTrend(c.Request.Context(), tenantID, days)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, trend)
}

// --- Cost Overview ---

func (h *Handler) GetCostOverview(c *gin.Context) {
	tenantID := h.getTenantID(c)
	overview, err := h.svc.GetCostOverview(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, overview)
}

// --- Optimization Suggestions ---

func (h *Handler) ListOptimizations(c *gin.Context) {
	tenantID := h.getTenantID(c)
	category := c.Query("category")
	minSavings := c.Query("minSavings")
	var catPtr *string
	if category != "" {
		catPtr = &category
	}
	var minPtr *float64
	if minSavings != "" {
		var v float64
		_, err := fmt.Sscanf(minSavings, "%f", &v)
		if err == nil {
			minPtr = &v
		}
	}
	suggestions, err := h.svc.GetOptimizationSuggestions(c.Request.Context(), tenantID, catPtr, minPtr)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, suggestions)
}

func (h *Handler) ApplyOptimization(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	applied, err := h.svc.ApplyOptimization(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !applied {
		respondNotFound(c, "optimization not found")
		return
	}
	respondSuccess(c, gin.H{"message": "optimization applied"})
}

func (h *Handler) RejectOptimization(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	rejected, err := h.svc.RejectOptimization(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !rejected {
		respondNotFound(c, "optimization not found")
		return
	}
	respondSuccess(c, gin.H{"message": "optimization rejected"})
}

// --- Cost Comparison (4.40) ---

func (h *Handler) CompareCosts(c *gin.Context) {
	var req models.CostComparisonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.CompareCosts(c.Request.Context(), tenantID, req.ServiceA, req.ServiceB, req.Period)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// --- Service Cost Trend (4.40) ---

func (h *Handler) GetServiceCostTrend(c *gin.Context) {
	tenantID := h.getTenantID(c)
	serviceID := c.DefaultQuery("serviceId", "default")
	period := c.DefaultQuery("period", "monthly")
	trend, err := h.svc.GetServiceCostTrend(c.Request.Context(), tenantID, serviceID, period)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, trend)
}

// --- Service Optimization Suggestions (4.40) ---

func (h *Handler) GetServiceOptimizationSuggestions(c *gin.Context) {
	tenantID := h.getTenantID(c)
	serviceID := c.DefaultQuery("serviceId", "default")
	entityType := c.DefaultQuery("entityType", "project")
	suggestions, err := h.svc.GetServiceOptimizationSuggestions(c.Request.Context(), tenantID, serviceID, entityType)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, suggestions)
}
