package handler

import (
	"strconv"

	"orion/inspection-svc-go/internal/models"
	"orion/inspection-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// InspectionHandler handles inspection-related API requests.
type InspectionHandler struct {
	svc *service.InspectionService
}

// NewHandler creates a new InspectionHandler.
func NewHandler(svc *service.InspectionService) *InspectionHandler {
	return &InspectionHandler{svc: svc}
}

// RegisterRoutes registers all inspection routes on the given group.
func (h *InspectionHandler) RegisterRoutes(rg *gin.RouterGroup) {
	insp := rg.Group("/inspection")
	{
		// Rules
		insp.POST("/rules", auth.RequirePermission("inspection", "write"), h.CreateRule)
		insp.GET("/rules", auth.RequirePermission("inspection", "read"), h.ListRules)
		insp.GET("/rules/:id", auth.RequirePermission("inspection", "read"), h.GetRule)
		insp.PUT("/rules/:id", auth.RequirePermission("inspection", "write"), h.UpdateRule)
		insp.DELETE("/rules/:id", auth.RequirePermission("inspection", "delete"), h.DeleteRule)

		// Tasks
		insp.POST("/tasks", auth.RequirePermission("inspection", "write"), h.CreateTask)
		insp.GET("/tasks", auth.RequirePermission("inspection", "read"), h.ListTasks)
		insp.GET("/tasks/:id", auth.RequirePermission("inspection", "read"), h.GetTask)

		// Reports
		insp.POST("/reports", auth.RequirePermission("inspection", "write"), h.CreateReport)
		insp.GET("/reports", auth.RequirePermission("inspection", "read"), h.ListReports)
		insp.GET("/reports/:id", auth.RequirePermission("inspection", "read"), h.GetReport)

		// Results
		insp.GET("/results", auth.RequirePermission("inspection", "read"), h.ListResults)
		insp.GET("/results/:id", auth.RequirePermission("inspection", "read"), h.GetResult)
		insp.POST("/results", auth.RequirePermission("inspection", "write"), h.CreateResult)

		// Health Score
		insp.GET("/health-score", auth.RequirePermission("inspection", "read"), h.GetHealthScore)
	}
}

// --- Rules ---------------------------------------------------------------

func (h *InspectionHandler) ListRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	target := c.Query("target")
	enabledStr := c.Query("enabled")
	var enabled *bool
	if enabledStr != "" {
		e, _ := strconv.ParseBool(enabledStr)
		enabled = &e
	}

	rules, err := h.svc.ListRules(c.Request.Context(), tenantID, target, enabled)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rules)
}

func (h *InspectionHandler) CreateRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	var payload struct {
		RuleName    string                 `json:"rule_name"`
		RuleType    string                 `json:"rule_type"`
		Target      string                 `json:"target"`
		Frequency   string                 `json:"frequency"`
		Enabled     bool                   `json:"enabled"`
		Parameters  map[string]interface{} `json:"parameters"`
		Description string                 `json:"description"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		respondBadRequest(c, "invalid request body")
		return
	}

	rule := models.InspectionRule{
		Name:        payload.RuleName,
		RuleType:    payload.RuleType,
		Target:      payload.Target,
		Enabled:     payload.Enabled,
		Description: payload.Description,
	}
	r, err := h.svc.CreateRule(c.Request.Context(), tenantID, rule)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, r)
}

func (h *InspectionHandler) GetRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	ruleID := c.Param("id")

	r, err := h.svc.GetRule(c.Request.Context(), tenantID, ruleID)
	if err != nil {
		respondNotFound(c, "Rule not found")
		return
	}
	respondSuccess(c, r)
}

func (h *InspectionHandler) UpdateRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	ruleID := c.Param("id")

	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		respondBadRequest(c, "invalid request body")
		return
	}

	r, err := h.svc.UpdateRule(c.Request.Context(), tenantID, ruleID, data)
	if err != nil {
		respondNotFound(c, "Rule not found")
		return
	}
	respondSuccess(c, r)
}

func (h *InspectionHandler) DeleteRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	ruleID := c.Param("id")

	if err := h.svc.DeleteRule(c.Request.Context(), tenantID, ruleID); err != nil {
		respondNotFound(c, "Rule not found")
		return
	}
	respondSuccess(c, map[string]any{"message": "Rule deleted"})
}

// --- Tasks ---------------------------------------------------------------

func (h *InspectionHandler) ListTasks(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	ruleID := c.Query("ruleId")
	status := c.Query("status")

	tasks, err := h.svc.ListTasks(c.Request.Context(), tenantID, ruleID, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, tasks)
}

func (h *InspectionHandler) CreateTask(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	var payload struct {
		RuleID string `json:"ruleId"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		respondBadRequest(c, "ruleId is required")
		return
	}

	task, err := h.svc.CreateTask(c.Request.Context(), tenantID, payload.RuleID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, task)
}

func (h *InspectionHandler) GetTask(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	taskID := c.Param("id")

	t, err := h.svc.GetTask(c.Request.Context(), tenantID, taskID)
	if err != nil {
		respondNotFound(c, "Task not found")
		return
	}
	respondSuccess(c, t)
}

// --- Reports -------------------------------------------------------------

func (h *InspectionHandler) ListReports(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}

	reports, err := h.svc.ListReports(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, reports)
}

func (h *InspectionHandler) CreateReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	var payload struct {
		Title   string   `json:"title"`
		RuleIDs []string `json:"ruleIds"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		respondBadRequest(c, "invalid request body")
		return
	}

	title := payload.Title
	if title == "" {
		title = "自动巡检报告"
	}

	// Collect rule IDs from body
	ruleIDs := payload.RuleIDs

	report, err := h.svc.CreateReport(c.Request.Context(), tenantID, title, ruleIDs)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, report)
}

func (h *InspectionHandler) GetReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	reportID := c.Param("id")

	rpt, err := h.svc.GetReport(c.Request.Context(), tenantID, reportID)
	if err != nil {
		respondNotFound(c, "Report not found")
		return
	}
	respondSuccess(c, rpt)
}

// --- Results -------------------------------------------------------------

func (h *InspectionHandler) ListResults(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	ruleID := c.Query("ruleId")

	results, err := h.svc.ListResults(c.Request.Context(), tenantID, ruleID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, results)
}

func (h *InspectionHandler) GetResult(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	resultID := c.Param("id")

	result, err := h.svc.GetResult(c.Request.Context(), tenantID, resultID)
	if err != nil {
		respondNotFound(c, "Result not found")
		return
	}
	respondSuccess(c, result)
}

func (h *InspectionHandler) CreateResult(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	var payload struct {
		RuleID  string                 `json:"ruleId"`
		TaskID  string                 `json:"taskId"`
		Status  string                 `json:"status"`
		Message string                 `json:"message"`
		Data    map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		respondBadRequest(c, "invalid request body")
		return
	}

	result := models.InspectionResult{
		RuleID:      payload.RuleID,
		Status:      payload.Status,
		Details:     models.JSONB(payload.Data),
		Remediation: payload.Message,
	}
	r, err := h.svc.CreateResult(c.Request.Context(), tenantID, result)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, r)
}
func (h *InspectionHandler) GetHealthScore(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}

	score, err := h.svc.GetHealthScore(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, score)
}
