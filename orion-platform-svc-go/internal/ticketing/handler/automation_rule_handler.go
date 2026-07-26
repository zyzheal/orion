package handler

import (
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
	tenantID := c.GetString("tenant_id")
	createdBy := GetUserID(c)

	var req models.CreateAutomationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.Create(c.Request.Context(), tenantID, createdBy, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, rule)
}

func (h *AutomationRuleHandler) ListRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	enabled := c.Query("enabled")
	var enabledFilter *bool
	if enabled != "" {
		val := enabled == "true"
		enabledFilter = &val
	}
	rules, err := h.svc.List(c.Request.Context(), tenantID, enabledFilter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rules)
}

func (h *AutomationRuleHandler) GetRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	rule, err := h.svc.Get(c.Request.Context(), tenantID, ruleID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *AutomationRuleHandler) UpdateRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	var req models.UpdateAutomationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.Update(c.Request.Context(), tenantID, ruleID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *AutomationRuleHandler) DeleteRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	if err := h.svc.Delete(c.Request.Context(), tenantID, ruleID); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *AutomationRuleHandler) ExecuteRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	var req struct {
		TicketID    string           `json:"ticket_id"`
		TriggeredBy string           `json:"triggered_by"`
		TicketData  map[string]any   `json:"ticket_data"`
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
	execution, err := h.svc.Execute(c.Request.Context(), tenantID, ruleID, req.TicketID, triggeredBy, req.TicketData)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, execution)
}
