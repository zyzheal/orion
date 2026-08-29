package handler

import (
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/service"
)

type AutomationRuleHandler struct {
	svc *service.AutomationRuleService
}

func NewAutomationRuleHandler(svc *service.AutomationRuleService) *AutomationRuleHandler {
	return &AutomationRuleHandler{svc: svc}
}

func (h *AutomationRuleHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/ticketing/automation/rules", auth.RequirePermission("ticket", "write"), h.CreateRule)
	rg.GET("/ticketing/automation/rules", auth.RequirePermission("ticket", "read"), h.ListRules)
	rg.PUT("/ticketing/automation/rules/:ruleId", auth.RequirePermission("ticket", "write"), h.UpdateRule)
	rg.DELETE("/ticketing/automation/rules/:ruleId", auth.RequirePermission("ticket", "delete"), h.DeleteRule)
	rg.POST("/ticketing/automation/rules/:ruleId/execute", auth.RequirePermission("ticket", "write"), h.ExecuteRule)
}

func (h *AutomationRuleHandler) CreateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingCreateRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	createdBy := GetUserID(c)

	var req models.CreateAutomationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.Create(ctx, tenantID, createdBy, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, rule)
}

func (h *AutomationRuleHandler) ListRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingListRules")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	enabled := c.Query("enabled")
	var enabledFilter *bool
	if enabled != "" {
		val := enabled == "true"
		enabledFilter = &val
	}
	rules, err := h.svc.List(ctx, tenantID, enabledFilter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rules)
}

func (h *AutomationRuleHandler) GetRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingGetRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	rule, err := h.svc.Get(ctx, tenantID, ruleID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *AutomationRuleHandler) UpdateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingUpdateRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	var req models.UpdateAutomationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.Update(ctx, tenantID, ruleID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *AutomationRuleHandler) DeleteRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingDeleteRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	if err := h.svc.Delete(ctx, tenantID, ruleID); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *AutomationRuleHandler) ExecuteRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingExecuteRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	var req struct {
		TicketID    string         `json:"ticket_id"`
		TriggeredBy string         `json:"triggered_by"`
		TicketData  map[string]any `json:"ticket_data"`
	}
	if req.TicketData == nil {
		req.TicketData = map[string]any{}
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	triggeredBy := "manual"
	if req.TriggeredBy != "" {
		triggeredBy = req.TriggeredBy
	}
	execution, err := h.svc.Execute(ctx, tenantID, ruleID, req.TicketID, triggeredBy, req.TicketData)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, execution)
}
