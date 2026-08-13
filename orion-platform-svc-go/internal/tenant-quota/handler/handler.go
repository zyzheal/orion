package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/tenant-quota/models"
	"orion/platform-svc-go/internal/tenant-quota/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/tenant-quota")

	f.GET("/plans", auth.RequirePermission("quota", "read"), h.ListPlans)
	f.POST("/plans", auth.RequirePermission("quota", "write"), h.CreatePlan)
	f.GET("/plans/:id", auth.RequirePermission("quota", "read"), h.GetPlan)
	f.PUT("/plans/:id", auth.RequirePermission("quota", "write"), h.UpdatePlan)
	f.DELETE("/plans/:id", auth.RequirePermission("quota", "delete"), h.DeletePlan)

	f.GET("/usage", auth.RequirePermission("quota", "read"), h.ListUsage)
	f.GET("/usage/:metric", auth.RequirePermission("quota", "read"), h.GetUsage)
	f.POST("/usage/increment", auth.RequirePermission("quota", "write"), h.IncrementUsage)
	f.POST("/usage/reset", auth.RequirePermission("quota", "delete"), h.ResetUsage)
	f.POST("/check", auth.RequirePermission("quota", "read"), h.CheckQuota)

	f.GET("/alerts", auth.RequirePermission("quota", "read"), h.ListAlerts)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tid := c.GetString("tenant_id")
	if tid == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tid
}

// --- Plan ---

func (h *Handler) ListPlans(c *gin.Context) {
	plans, err := h.svc.ListPlans(c.Request.Context(), h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, plans)
}

func (h *Handler) CreatePlan(c *gin.Context) {
	var req models.CreatePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.CreatePlan(c.Request.Context(), &req, h.getTenantID(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, p)
}

func (h *Handler) GetPlan(c *gin.Context) {
	p, err := h.svc.GetPlan(c.Request.Context(), c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, p)
}

func (h *Handler) UpdatePlan(c *gin.Context) {
	var req models.UpdatePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.UpdatePlan(c.Request.Context(), c.Param("id"), h.getTenantID(c), &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, p)
}

func (h *Handler) DeletePlan(c *gin.Context) {
	deleted, err := h.svc.DeletePlan(c.Request.Context(), c.Param("id"), h.getTenantID(c))
	if err != nil || !deleted {
		middleware.RespondNotFound(c, "plan not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

// --- Usage ---

func (h *Handler) ListUsage(c *gin.Context) {
	usages, err := h.svc.ListUsage(c.Request.Context(), h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, usages)
}

func (h *Handler) GetUsage(c *gin.Context) {
	u, err := h.svc.GetUsage(c.Request.Context(), h.getTenantID(c), c.Param("metric"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if u == nil {
		middleware.RespondSuccess(c, gin.H{"metric": c.Param("metric"), "currentValue": 0})
		return
	}
	middleware.RespondSuccess(c, u)
}

func (h *Handler) IncrementUsage(c *gin.Context) {
	var req models.IncrementUsageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.IncrementUsage(c.Request.Context(), &req, h.getTenantID(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) ResetUsage(c *gin.Context) {
	if err := h.svc.ResetUsage(c.Request.Context(), h.getTenantID(c)); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"reset": true})
}

func (h *Handler) CheckQuota(c *gin.Context) {
	var body struct {
		Metric string `json:"metric" binding:"required"`
		Amount int64  `json:"amount"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if body.Amount == 0 {
		body.Amount = 1
	}
	result, err := h.svc.CheckQuota(c.Request.Context(), h.getTenantID(c), body.Metric, body.Amount)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if !result.Allowed {
		middleware.RespondSuccess(c, result)
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Alerts ---

func (h *Handler) ListAlerts(c *gin.Context) {
	alerts, err := h.svc.ListAlerts(c.Request.Context(), h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, alerts)
}
