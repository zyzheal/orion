package handler

import (
	"net/http"
	"strconv"

	"orion/finops-svc-go/internal/models"
	"orion/finops-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

type BudgetHandler struct {
	svc *service.BudgetService
}

func NewBudgetHandler(svc *service.BudgetService) *BudgetHandler {
	return &BudgetHandler{svc: svc}
}

func (h *BudgetHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.CreateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	budget, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, budget)
}

func (h *BudgetHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	budget, err := h.svc.Get(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "budget not found"})
		return
	}

	c.JSON(http.StatusOK, budget)
}

func (h *BudgetHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	budgets, err := h.svc.List(c.Request.Context(), tenantID, (page-1)*pageSize, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": budgets})
}

func (h *BudgetHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.UpdateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	budget, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, budget)
}

func (h *BudgetHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *BudgetHandler) RecordSpend(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	budgetID := c.Param("id")

	var req models.RecordSpendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.RecordSpend(c.Request.Context(), tenantID, budgetID, req.AmountCents); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "spend recorded"})
}

func (h *BudgetHandler) GetStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	status, err := h.svc.GetStatus(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}

func (h *BudgetHandler) GetForecast(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	forecast, err := h.svc.GetForecast(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, forecast)
}

func (h *BudgetHandler) GetAlertTriggers(c *gin.Context) {
	triggers, err := h.svc.GetAlertTriggers(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": triggers})
}

func (h *BudgetHandler) CheckThresholds(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	triggers, err := h.svc.CheckThresholds(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": triggers, "triggered": len(triggers)})
}

func (h *BudgetHandler) RegisterRoutes(rg *gin.RouterGroup) {
	budgets := rg.Group("/budgets")
	{
		budgets.POST("", h.Create)
		budgets.GET("", h.List)
		budgets.GET("/check-thresholds", h.CheckThresholds)
		budgets.GET("/:id", h.Get)
		budgets.PUT("/:id", h.Update)
		budgets.DELETE("/:id", h.Delete)
		budgets.POST("/:id/spend", h.RecordSpend)
		budgets.GET("/:id/status", h.GetStatus)
		budgets.GET("/:id/forecast", h.GetForecast)
		budgets.GET("/:id/alerts", h.GetAlertTriggers)
	}
}
