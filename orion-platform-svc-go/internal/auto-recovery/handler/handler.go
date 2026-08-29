package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/auto-recovery/models"
	"orion/platform-svc-go/internal/auto-recovery/service"
)

type AutoRecoveryHandler struct {
	svc *service.AutoRecoveryService
}

func NewAutoRecoveryHandler(svc *service.AutoRecoveryService) *AutoRecoveryHandler {
	return &AutoRecoveryHandler{svc: svc}
}

func (h *AutoRecoveryHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoRecoveryListRules")
	defer span.End()
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryRules(ctx, tenantID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": resp.Total, "data": resp.Data})
}

// CreateRule creates a new rule.
func (h *AutoRecoveryHandler) CreateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoRecoveryCreateRule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	rule, err := h.svc.CreateRule(ctx, tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "created", "data": rule})
}

// GetRule returns a single rule.
func (h *AutoRecoveryHandler) GetRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoRecoveryGetRule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	rule, err := h.svc.GetRule(ctx, tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": rule})
}

// DeleteRule removes a rule.
func (h *AutoRecoveryHandler) DeleteRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoRecoveryDeleteRule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	if err := h.svc.DeleteRule(ctx, tenantID, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// ExecuteRule triggers rule execution.
func (h *AutoRecoveryHandler) ExecuteRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoRecoveryExecuteRule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	ruleID := c.Param("id")

	var req struct {
		Metrics map[string]float64 `json:"metrics"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Metrics = map[string]float64{}
	}

	action, err := h.svc.ExecuteRule(ctx, tenantID, ruleID, req.Metrics)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"action": action}})
}

// ListActions returns paginated actions.
func (h *AutoRecoveryHandler) ListActions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoRecoveryListActions")
	defer span.End()
	tenantID := h.GetTenantID(c)
	ruleID := c.Query("rule_id")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryActions(ctx, tenantID, ruleID, status, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": resp.Total, "data": resp.Data})
}
