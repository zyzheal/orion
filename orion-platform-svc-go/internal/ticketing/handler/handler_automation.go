package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/ticketing/models"
)

// CreateAutomationRule creates a new automation rule.
func (h *Handler) CreateAutomationRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAutomationRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateAutomationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	r, err := h.svc.CreateAutomationRule(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, r)
}

// ListAutomationRules lists all automation rules for the tenant.
func (h *Handler) ListAutomationRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAutomationRules")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	rules, err := h.svc.ListAutomationRules(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rules)
}

// UpdateAutomationRule updates an automation rule.
func (h *Handler) UpdateAutomationRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateAutomationRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	var req models.UpdateAutomationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	r, err := h.svc.UpdateAutomationRule(ctx, tenantID, ruleID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, r)
}

// DeleteAutomationRule deletes an automation rule.
func (h *Handler) DeleteAutomationRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteAutomationRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	if err := h.svc.DeleteAutomationRule(ctx, tenantID, ruleID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "automation rule deleted"})
}

// ExecuteRule executes an automation rule manually.
func (h *Handler) ExecuteRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	result, err := h.svc.ExecuteRule(ctx, tenantID, ruleID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
