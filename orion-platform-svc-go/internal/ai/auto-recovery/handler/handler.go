package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ai/auto-recovery/models"
	"orion/platform-svc-go/internal/ai/auto-recovery/service"
	"orion/go-common/pkg/auth"
)

type AutoRecoveryHandler struct {
	svc *service.AutoRecoveryService
}

func NewAutoRecoveryHandler(svc *service.AutoRecoveryService) *AutoRecoveryHandler {
	return &AutoRecoveryHandler{svc: svc}
}

func (h *AutoRecoveryHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenant_id")
}

// RegisterRoutes registers auto-recovery routes.
func (h *AutoRecoveryHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rules := rg.Group("/auto-recovery/rules")
	rules.GET("", auth.RequirePermission("ai", "read"), h.ListRules)
	rules.POST("", auth.RequirePermission("ai", "write"), h.CreateRule)
	rules.GET("/:id", auth.RequirePermission("ai", "read"), h.GetRule)
	rules.DELETE("/:id", auth.RequirePermission("ai", "delete"), h.DeleteRule)
	rules.POST("/:id/execute", auth.RequirePermission("ai", "execute"), h.ExecuteRule)

	actions := rg.Group("/auto-recovery/actions")
	actions.GET("", auth.RequirePermission("ai", "read"), h.ListActions)
}

// ListRules returns paginated rules.
func (h *AutoRecoveryHandler) ListRules(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryRules(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"total": resp.Total, "data": resp.Data})
}

// CreateRule creates a new rule.
func (h *AutoRecoveryHandler) CreateRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	rule, err := h.svc.CreateRule(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, rule)
}

// GetRule returns a single rule.
func (h *AutoRecoveryHandler) GetRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	rule, err := h.svc.GetRule(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

// DeleteRule removes a rule.
func (h *AutoRecoveryHandler) DeleteRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	if err := h.svc.DeleteRule(c.Request.Context(), tenantID, id); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}

// ExecuteRule triggers rule execution.
func (h *AutoRecoveryHandler) ExecuteRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	ruleID := c.Param("id")

	var req struct {
		Metrics map[string]float64 `json:"metrics"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Metrics = map[string]float64{}
	}

	action, err := h.svc.ExecuteRule(c.Request.Context(), tenantID, ruleID, req.Metrics)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"action": action})
}

// ListActions returns paginated actions.
func (h *AutoRecoveryHandler) ListActions(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	ruleID := c.Query("rule_id")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryActions(c.Request.Context(), tenantID, ruleID, status, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"total": resp.Total, "data": resp.Data})
}
