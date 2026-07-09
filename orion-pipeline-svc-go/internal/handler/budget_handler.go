package handler

import (
	"net/http"

	"orion/pipeline-svc-go/internal/models"
	"orion/pipeline-svc-go/internal/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// BudgetHandler provides HTTP handlers for pipeline budget operations.
type BudgetHandler struct {
	svc *service.BudgetService
}

func NewBudgetHandler(svc *service.BudgetService) *BudgetHandler {
	return &BudgetHandler{svc: svc}
}

func (h *BudgetHandler) RegisterRoutes(rg *gin.RouterGroup) {
	budget := rg.Group("/pipeline-budget")
	{
		budget.POST("", auth.RequirePermission("pipeline", "write"), h.SetBudget)
		budget.GET("", h.GetBudget)
		budget.PUT("", auth.RequirePermission("pipeline", "write"), h.UpdateBudget)
		budget.DELETE("", auth.RequirePermission("pipeline", "write"), h.DeleteBudget)
		budget.GET("/check", h.CheckBudget)
	}
}

// SetBudget creates a new budget.
func (h *BudgetHandler) SetBudget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.SetBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	budget, err := h.svc.Set(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, budget)
}

// GetBudget retrieves the effective budget.
func (h *BudgetHandler) GetBudget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Query("pipeline_id")

	budget, err := h.svc.Get(c.Request.Context(), tenantID, pipelineID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "budget not found"})
		return
	}

	c.JSON(http.StatusOK, budget)
}

// UpdateBudget updates an existing budget.
func (h *BudgetHandler) UpdateBudget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var budget models.PipelineBudget
	if err := c.ShouldBindJSON(&budget); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	budget.TenantID = tenantID
	if err := h.svc.Update(c.Request.Context(), tenantID, &budget); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "budget updated"})
}

// DeleteBudget deletes a budget.
func (h *BudgetHandler) DeleteBudget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "budget deleted"})
}

// CheckBudget checks if the spend is within budget.
func (h *BudgetHandler) CheckBudget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Query("pipeline_id")

	result, err := h.svc.Check(c.Request.Context(), tenantID, pipelineID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}