package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/finops/finops/models"
	"orion/platform-svc-go/internal/finops/finops/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers for FinOps operations.
type Handler struct {
	svc *service.FinOpsService
}

func NewHandler(svc *service.FinOpsService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers FinOps routes on the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	costs := rg.Group("/costs")
	{
		costs.POST("/cloud", auth.RequirePermission("finops", "write"), h.RecordCloudCost)
		costs.POST("/k8s", auth.RequirePermission("finops", "write"), h.RecordK8sCost)
		costs.POST("/saas", auth.RequirePermission("finops", "write"), h.RecordSaaSCost)
		costs.GET("/summary", h.GetCostSummary)
	}

	alerts := rg.Group("/budget-alerts")
	{
		alerts.POST("", auth.RequirePermission("finops", "write"), h.CreateBudgetAlert)
		alerts.GET("", h.ListBudgetAlerts)
		alerts.PUT("/:id", auth.RequirePermission("finops", "write"), h.UpdateBudgetAlert)
	}
	costs.DELETE("/:id", auth.RequirePermission("finops", "delete"), h.Delete)
	costs.GET("/count", h.Count)
}

func (h *Handler) RecordCloudCost(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.RecordCostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if err := h.svc.RecordCloudCost(c.Request.Context(), tenantID, &req); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, gin.H{"message": "cost recorded"})
}

func (h *Handler) RecordK8sCost(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var cost models.K8sCost
	if err := c.ShouldBindJSON(&cost); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if err := h.svc.RecordK8sCost(c.Request.Context(), tenantID, &cost); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, gin.H{"message": "k8s cost recorded"})
}

func (h *Handler) RecordSaaSCost(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var cost models.SaaSCost
	if err := c.ShouldBindJSON(&cost); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if err := h.svc.RecordSaaSCost(c.Request.Context(), tenantID, &cost); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, gin.H{"message": "saas cost recorded"})
}

func (h *Handler) GetCostSummary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	summary, err := h.svc.GetCostSummary(c.Request.Context(), tenantID, periodStart, periodEnd)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, summary)
}

func (h *Handler) CreateBudgetAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateBudgetAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	alert, err := h.svc.CreateBudgetAlert(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	respondCreated(c, alert)
}

func (h *Handler) ListBudgetAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	alerts, err := h.svc.ListBudgetAlerts(c.Request.Context(), tenantID, (page-1)*pageSize, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, alerts)
}

func (h *Handler) UpdateBudgetAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.CreateBudgetAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	alert, err := h.svc.UpdateBudgetAlert(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, alert)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}
