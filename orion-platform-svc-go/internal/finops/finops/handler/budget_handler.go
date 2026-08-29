package handler

import (
	"go.opentelemetry.io/otel"
	"strconv"

	"orion/platform-svc-go/internal/finops/finops/models"
	"orion/platform-svc-go/internal/finops/finops/service"

	"github.com/gin-gonic/gin"
)

type BudgetHandler struct {
	svc *service.BudgetService
}

func NewBudgetHandler(svc *service.BudgetService) *BudgetHandler {
	return &BudgetHandler{svc: svc}
}

func (h *BudgetHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.CreateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	budget, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, budget)
}

func (h *BudgetHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	budget, err := h.svc.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "budget not found")
		return
	}

	respondSuccess(c, budget)
}

func (h *BudgetHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	budgets, err := h.svc.List(ctx, tenantID, (page-1)*pageSize, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, budgets)
}

func (h *BudgetHandler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsUpdate")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.UpdateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	budget, err := h.svc.Update(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, budget)
}

func (h *BudgetHandler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *BudgetHandler) RecordSpend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsRecordSpend")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	budgetID := c.Param("id")

	var req models.RecordSpendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if err := h.svc.RecordSpend(ctx, tenantID, budgetID, req.AmountCents); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "spend recorded"})
}

func (h *BudgetHandler) GetStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsGetStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	status, err := h.svc.GetStatus(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, status)
}

func (h *BudgetHandler) GetForecast(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsGetForecast")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	forecast, err := h.svc.GetForecast(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, forecast)
}

func (h *BudgetHandler) GetAlertTriggers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsGetAlertTriggers")
	defer span.End()
	triggers, err := h.svc.GetAlertTriggers(ctx, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, triggers)
}

func (h *BudgetHandler) CheckThresholds(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsCheckThresholds")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	triggers, err := h.svc.CheckThresholds(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"triggers": triggers, "triggered": len(triggers)})
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
