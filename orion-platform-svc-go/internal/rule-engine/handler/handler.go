package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/rule-engine/models"
	"orion/platform-svc-go/internal/rule-engine/service"
	"orion/go-common/pkg/auth"
)

type RuleEngineHandler struct {
	svc *service.RuleEngineService
}

func NewRuleEngineHandler(svc *service.RuleEngineService) *RuleEngineHandler {
	return &RuleEngineHandler{svc: svc}
}

func (h *RuleEngineHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
}

// RegisterRoutes registers rule-engine routes.
func (h *RuleEngineHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rules := rg.Group("/rule-engine/rules")
	rules.GET("", auth.RequirePermission("ai", "read"), h.ListRules)
	rules.POST("", auth.RequirePermission("ai", "write"), h.CreateRule)
	rules.GET("/:id", auth.RequirePermission("ai", "read"), h.GetRule)
	rules.PUT("/:id", auth.RequirePermission("ai", "write"), h.UpdateRule)
	rules.DELETE("/:id", auth.RequirePermission("ai", "delete"), h.DeleteRule)

	rg.POST("/rule-engine/evaluate", auth.RequirePermission("ai", "execute"), h.Evaluate)
}

// ListRules returns all rules.
func (h *RuleEngineHandler) ListRules(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	resp, err := h.svc.QueryRules(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": resp.Total, "data": resp.Data})
}

// CreateRule creates a new rule.
func (h *RuleEngineHandler) CreateRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	rule, err := h.svc.CreateRule(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "created", "data": rule})
}

// GetRule returns a rule by ID.
func (h *RuleEngineHandler) GetRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	rule, err := h.svc.GetRule(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": rule})
}

// UpdateRule updates a rule.
func (h *RuleEngineHandler) UpdateRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Priority    *int    `json:"priority"`
		IsEnabled   *bool   `json:"is_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	rule, err := h.svc.UpdateRule(c.Request.Context(), tenantID, id, req.Name, req.Description, req.Priority, req.IsEnabled)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": rule})
}

// DeleteRule removes a rule.
func (h *RuleEngineHandler) DeleteRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id := c.Param("id")

	if err := h.svc.DeleteRule(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// Evaluate evaluates a rule against input data.
func (h *RuleEngineHandler) Evaluate(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.EvaluateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	result, err := h.svc.Evaluate(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}
