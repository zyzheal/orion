package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all ticketing endpoints.
// Mirrors /api/v1/ticketing and /api/v1/tickets from the TS source (82 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Service control (TS paths: /ticketing/...)
	f := rg.Group("/ticketing")
	f.POST("/start", auth.RequirePermission("ticketing", "write"), h.StartService)
	f.POST("/stop", auth.RequirePermission("ticketing", "write"), h.StopService)
	f.GET("/health", auth.RequirePermission("ticketing", "read"), h.HealthCheck)

	// Assignment rules (TS paths: /ticketing/rules/...)
	f.POST("/rules", auth.RequirePermission("ticketing", "write"), h.AddAssignmentRule)
	rg.GET("/ticketing/rules", auth.RequirePermission("ticketing", "read"), h.GetAssignmentRules)
	f.DELETE("/rules/:id", auth.RequirePermission("ticketing", "delete"), h.RemoveAssignmentRule)

	// SLA target
	f.POST("/sla", auth.RequirePermission("ticketing", "write"), h.AddSLATarget)

	// SLA policies
	f.POST("/sla/policies", auth.RequirePermission("ticketing", "write"), h.CreateSLAPolicy)
	f.GET("/sla/policies", auth.RequirePermission("ticketing", "read"), h.ListSLAPolicies)
	f.GET("/sla/policies/:policyId", auth.RequirePermission("ticketing", "read"), h.GetSLAPolicy)
	f.PUT("/sla/policies/:policyId", auth.RequirePermission("ticketing", "write"), h.UpdateSLAPolicy)
	f.DELETE("/sla/policies/:policyId", auth.RequirePermission("ticketing", "delete"), h.DeleteSLAPolicy)

	// SLA tracking
	f.GET("/sla/tickets/:ticketId/status", auth.RequirePermission("ticketing", "read"), h.GetTicketSLAStatus)
	f.GET("/sla/breaches", auth.RequirePermission("ticketing", "read"), h.GetBreaches)
	f.GET("/sla/compliance/:policyId", auth.RequirePermission("ticketing", "read"), h.GetCompliance)

	// Automation rules
	f.POST("/automation/rules", auth.RequirePermission("ticketing", "write"), h.CreateAutomationRule)
	f.GET("/automation/rules", auth.RequirePermission("ticketing", "read"), h.ListAutomationRules)
	f.PUT("/automation/rules/:ruleId", auth.RequirePermission("ticketing", "write"), h.UpdateAutomationRule)
	f.DELETE("/automation/rules/:ruleId", auth.RequirePermission("ticketing", "delete"), h.DeleteAutomationRule)
	f.POST("/automation/rules/:ruleId/execute", auth.RequirePermission("ticketing", "write"), h.ExecuteRule)

	// Ticket CRUD (TS paths: /tickets/...)
	t := rg.Group("/tickets")
	t.POST("", auth.RequirePermission("ticketing", "write"), h.CreateTicket)
	t.POST("/from-alert", auth.RequirePermission("ticketing", "write"), h.CreateTicketFromAlert)
	t.POST("/from-incident", auth.RequirePermission("ticketing", "write"), h.CreateTicketFromIncident)
	t.GET("/:id", auth.RequirePermission("ticketing", "read"), h.GetTicket)
	rg.GET("/tickets", auth.RequirePermission("ticketing", "read"), h.ListTickets)

	// Workflow
	t.POST("/:id/transition", auth.RequirePermission("ticketing", "write"), h.TransitionStatus)
	t.POST("/:id/assign", auth.RequirePermission("ticketing", "write"), h.AssignTicket)
	t.POST("/:id/escalate", auth.RequirePermission("ticketing", "write"), h.EscalateTicket)
	t.POST("/:id/resolve", auth.RequirePermission("ticketing", "write"), h.ResolveTicket)
	t.POST("/:id/close", auth.RequirePermission("ticketing", "write"), h.CloseTicket)
	t.GET("/:id/history", auth.RequirePermission("ticketing", "read"), h.GetWorkflowHistory)

	// Relations
	t.POST("/:id/relations", auth.RequirePermission("ticketing", "write"), h.AddRelation)
	t.GET("/:id/relations", auth.RequirePermission("ticketing", "read"), h.GetRelations)
	t.GET("/:id/related", auth.RequirePermission("ticketing", "read"), h.FindRelatedTickets)
	t.GET("/:id/duplicates", auth.RequirePermission("ticketing", "read"), h.DetectDuplicates)
	rg.POST("/tickets/correlate", auth.RequirePermission("ticketing", "read"), h.CorrelateRootCause)

	// SLA (per ticket)
	t.GET("/:id/sla", auth.RequirePermission("ticketing", "read"), h.GetTicketSLA)

	// Reports
	rg.GET("/tickets/reports/sla", auth.RequirePermission("ticketing", "read"), h.GetSLACompliance)
	rg.GET("/tickets/reports/resolution", auth.RequirePermission("ticketing", "read"), h.GetResolutionStats)
	rg.GET("/tickets/reports/backlog", auth.RequirePermission("ticketing", "read"), h.GetBacklogAnalysis)
	rg.GET("/tickets/reports/trends", auth.RequirePermission("ticketing", "read"), h.GetTrendReport)
	rg.GET("/tickets/reports/statistics", auth.RequirePermission("ticketing", "read"), h.GetStatistics)

	// Dispatch
	t.POST("/dispatch/engineers", auth.RequirePermission("ticketing", "write"), h.RegisterEngineer)
	rg.GET("/tickets/dispatch/engineers", auth.RequirePermission("ticketing", "read"), h.ListEngineers)
	rg.GET("/tickets/dispatch/engineers/:id", auth.RequirePermission("ticketing", "read"), h.GetEngineer)
	rg.POST("/tickets/dispatch/auto/:ticketId", auth.RequirePermission("ticketing", "write"), h.AutoDispatch)
	rg.POST("/tickets/dispatch/manual/:ticketId", auth.RequirePermission("ticketing", "write"), h.ManualDispatch)
	rg.GET("/tickets/dispatch/best-match/:ticketId", auth.RequirePermission("ticketing", "read"), h.GetBestMatch)
	rg.POST("/tickets/dispatch/score", auth.RequirePermission("ticketing", "read"), h.CalculateDispatchScore)
	rg.GET("/tickets/dispatch/queue/status", auth.RequirePermission("ticketing", "read"), h.GetDispatchQueueStatus)
	rg.GET("/tickets/dispatch/queue/entries", auth.RequirePermission("ticketing", "read"), h.GetDispatchQueueEntries)
	rg.GET("/tickets/dispatch/sla-alerts", auth.RequirePermission("ticketing", "read"), h.GetSLAAlerts)
	rg.POST("/tickets/dispatch/rules", auth.RequirePermission("ticketing", "write"), h.AddDispatchRule)
	rg.GET("/tickets/dispatch/rules", auth.RequirePermission("ticketing", "read"), h.GetDispatchRules)
	rg.GET("/tickets/dispatch/load-balance/report", auth.RequirePermission("ticketing", "read"), h.GetLoadBalanceReport)
	rg.GET("/tickets/dispatch/load-balance/suggestions", auth.RequirePermission("ticketing", "read"), h.GetReassignmentSuggestions)
	rg.GET("/tickets/dispatch/reports/metrics", auth.RequirePermission("ticketing", "read"), h.GetDispatchMetrics)
	rg.GET("/tickets/dispatch/reports/assignment-success", auth.RequirePermission("ticketing", "read"), h.GetAssignmentSuccessMetrics)
	rg.GET("/tickets/dispatch/reports/time-to-assignment", auth.RequirePermission("ticketing", "read"), h.GetTimeToAssignmentStats)
	rg.GET("/tickets/dispatch/reports/performance/:engineerId", auth.RequirePermission("ticketing", "read"), h.GetEngineerPerformance)
	rg.GET("/tickets/dispatch/reports/performance", auth.RequirePermission("ticketing", "read"), h.GetAllEngineerPerformances)
	rg.PUT("/tickets/dispatch/weights", auth.RequirePermission("ticketing", "write"), h.UpdateDispatchWeights)
	rg.GET("/tickets/dispatch/weights", auth.RequirePermission("ticketing", "read"), h.GetDispatchWeights)

	// Transfer
	rg.POST("/tickets/transfer/:ticketId", auth.RequirePermission("ticketing", "write"), h.TransferTicket)
	rg.GET("/tickets/transfer/:ticketId/history", auth.RequirePermission("ticketing", "read"), h.GetTransferHistory)
	rg.GET("/tickets/transfer/stats", auth.RequirePermission("ticketing", "read"), h.GetTransferStats)

	// Suspend
	t.POST("/suspend", auth.RequirePermission("ticketing", "write"), h.CreateSuspend)
	t.POST("/suspend/:id/activate", auth.RequirePermission("ticketing", "write"), h.ActivateSuspend)
	t.POST("/suspend/:id/end", auth.RequirePermission("ticketing", "write"), h.EndSuspend)
	t.POST("/suspend/:id/cancel", auth.RequirePermission("ticketing", "write"), h.CancelSuspend)
	rg.GET("/tickets/suspend", auth.RequirePermission("ticketing", "read"), h.ListSuspensions)
	rg.GET("/tickets/suspend/:id", auth.RequirePermission("ticketing", "read"), h.GetSuspend)
	rg.GET("/tickets/suspend/engineer/:engineerId", auth.RequirePermission("ticketing", "read"), h.GetEngineerSuspensions)
	rg.GET("/tickets/suspend/engineer/:engineerId/impact", auth.RequirePermission("ticketing", "read"), h.GetEngineerSuspendImpact)

	// BI Analytics
	rg.GET("/tickets/bi/dashboard/executive", auth.RequirePermission("ticketing", "read"), h.GetExecutiveDashboard)
	rg.GET("/tickets/bi/dashboard/manager", auth.RequirePermission("ticketing", "read"), h.GetManagerDashboard)
	rg.GET("/tickets/bi/dashboard/engineer/:engineerId", auth.RequirePermission("ticketing", "read"), h.GetEngineerDashboard)
	rg.GET("/tickets/bi/efficiency/:engineerId", auth.RequirePermission("ticketing", "read"), h.GetEngineerEfficiency)
	rg.GET("/tickets/bi/score/:engineerId", auth.RequirePermission("ticketing", "read"), h.GetEfficiencyScore)
	rg.GET("/tickets/bi/compare", auth.RequirePermission("ticketing", "read"), h.ComparePeriods)
	rg.POST("/tickets/bi/export", auth.RequirePermission("ticketing", "read"), h.ExportBIData)
	rg.GET("/tickets/bi/trend", auth.RequirePermission("ticketing", "read"), h.GetTimeTrend)
}

// ==================== Service Control ====================

func (h *Handler) StartService(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.StartService(c.Request.Context(), tenantID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "ticketing service started"})
}

func (h *Handler) StopService(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.StopService(c.Request.Context(), tenantID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "ticketing service stopped"})
}

func (h *Handler) HealthCheck(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	active, err := h.svc.HealthCheck(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"healthy": active})
}

// ==================== Ticket CRUD ====================

func (h *Handler) CreateTicket(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	reporterID := c.GetString("user_id")
	if reporterID == "" {
		middleware.RespondBadRequest(c, "user_id required")
		return
	}
	t, err := h.svc.CreateTicket(c.Request.Context(), tenantID, req, reporterID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, t)
}

// CreateTicketFromAlert mirrors /tickets/from-alert: creates a ticket sourced from an alert.
func (h *Handler) CreateTicketFromAlert(c *gin.Context) {
	ticketID := c.Param("id")
	_ = ticketID
	h.createTicketWithSource(c, "alert")
}

// CreateTicketFromIncident mirrors /tickets/from-incident: creates a ticket sourced from an incident.
func (h *Handler) CreateTicketFromIncident(c *gin.Context) {
	h.createTicketWithSource(c, "incident")
}

func (h *Handler) createTicketWithSource(c *gin.Context, source string) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req.Source = source
	reporterID := c.GetString("user_id")
	if reporterID == "" {
		middleware.RespondBadRequest(c, "user_id required")
		return
	}
	t, err := h.svc.CreateTicket(c.Request.Context(), tenantID, req, reporterID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, t)
}

func (h *Handler) GetTicket(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	t, err := h.svc.GetTicket(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "ticket not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

func (h *Handler) ListTickets(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	q := buildTicketListQuery(c)
	items, err := h.svc.ListTickets(c.Request.Context(), tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// ==================== Workflow ====================

func (h *Handler) TransitionStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	userID := c.GetString("user_id")
	var req models.TransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.TransitionStatus(c.Request.Context(), tenantID, ticketID, req, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

func (h *Handler) AssignTicket(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	userID := c.GetString("user_id")
	var req models.AssignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.AssignTicket(c.Request.Context(), tenantID, ticketID, req, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

func (h *Handler) EscalateTicket(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	userID := c.GetString("user_id")
	var req models.EscalateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.EscalateTicket(c.Request.Context(), tenantID, ticketID, req, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

func (h *Handler) ResolveTicket(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	userID := c.GetString("user_id")
	var req models.ResolveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.ResolveTicket(c.Request.Context(), tenantID, ticketID, req, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

func (h *Handler) CloseTicket(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	userID := c.GetString("user_id")
	var body struct {
		Comment string `json:"comment"`
	}
	c.ShouldBindJSON(&body)
	t, err := h.svc.CloseTicket(c.Request.Context(), tenantID, ticketID, body.Comment, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

func (h *Handler) GetWorkflowHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	items, err := h.svc.GetWorkflowHistory(c.Request.Context(), tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// ==================== Assignment Rules ====================

func (h *Handler) AddAssignmentRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAssignmentRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	r, err := h.svc.AddAssignmentRule(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, r)
}

func (h *Handler) GetAssignmentRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	rules, err := h.svc.GetAssignmentRules(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rules)
}

func (h *Handler) RemoveAssignmentRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid rule id")
		return
	}
	if err := h.svc.RemoveAssignmentRule(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "assignment rule removed"})
}

// ==================== Relations ====================

func (h *Handler) AddRelation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	var req models.CreateRelationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	r, err := h.svc.AddRelation(c.Request.Context(), tenantID, ticketID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, r)
}

func (h *Handler) GetRelations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	rels, err := h.svc.GetRelations(c.Request.Context(), tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rels)
}

func (h *Handler) FindRelatedTickets(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	rels, err := h.svc.FindRelatedTickets(c.Request.Context(), tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rels)
}

func (h *Handler) DetectDuplicates(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	rels, err := h.svc.DetectDuplicates(c.Request.Context(), tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rels)
}

func (h *Handler) CorrelateRootCause(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CorrelateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CorrelateRootCause(c.Request.Context(), tenantID, req.TicketIDs)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ==================== SLA ====================

func (h *Handler) AddSLATarget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSLATargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	sla, err := h.svc.AddSLATarget(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, sla)
}

func (h *Handler) GetTicketSLA(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("id")
	status, err := h.svc.GetTicketSLA(c.Request.Context(), tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}

// ==================== Reports ====================

func (h *Handler) GetSLACompliance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	report, err := h.svc.GetSLACompliance(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

func (h *Handler) GetResolutionStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetResolutionStats(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) GetBacklogAnalysis(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	analysis, err := h.svc.GetBacklogAnalysis(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, analysis)
}

func (h *Handler) GetTrendReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	report, err := h.svc.GetTrendReport(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

func (h *Handler) GetStatistics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	report, err := h.svc.GetStatistics(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

// ==================== Dispatch ====================

func (h *Handler) RegisterEngineer(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.RegisterEngineerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	e, err := h.svc.RegisterEngineer(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, e)
}

func (h *Handler) ListEngineers(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	engineers, err := h.svc.ListEngineers(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, engineers)
}

func (h *Handler) GetEngineer(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	e, err := h.svc.GetEngineer(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, e)
}

func (h *Handler) AutoDispatch(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")
	result, err := h.svc.AutoDispatch(c.Request.Context(), tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) ManualDispatch(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")
	var body struct {
		EngineerID string `json:"engineer_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.ManualDispatch(c.Request.Context(), tenantID, ticketID, body.EngineerID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "ticket dispatched"})
}

func (h *Handler) GetBestMatch(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")
	result, err := h.svc.GetBestMatch(c.Request.Context(), tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CalculateDispatchScore(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.DispatchScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CalculateDispatchScore(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetDispatchQueueStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	status, err := h.svc.GetDispatchQueueStatus(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}

func (h *Handler) GetDispatchQueueEntries(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	entries, err := h.svc.GetDispatchQueueEntries(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, entries)
}

func (h *Handler) GetSLAAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	alerts, err := h.svc.GetSLAAlerts(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, alerts)
}

func (h *Handler) AddDispatchRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.AddDispatchRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	r, err := h.svc.AddDispatchRule(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, r)
}

func (h *Handler) GetDispatchRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	rules, err := h.svc.GetDispatchRules(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rules)
}

func (h *Handler) GetLoadBalanceReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	report, err := h.svc.GetLoadBalanceReport(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

func (h *Handler) GetReassignmentSuggestions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	suggestions, err := h.svc.GetReassignmentSuggestions(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, suggestions)
}

func (h *Handler) GetDispatchMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	metrics, err := h.svc.GetDispatchMetrics(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, metrics)
}

func (h *Handler) GetAssignmentSuccessMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	metrics, err := h.svc.GetAssignmentSuccessMetrics(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, metrics)
}

func (h *Handler) GetTimeToAssignmentStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetTimeToAssignmentStats(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) GetEngineerPerformance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	engineerID := c.Param("engineerId")
	perf, err := h.svc.GetEngineerPerformance(c.Request.Context(), tenantID, engineerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, perf)
}

func (h *Handler) GetAllEngineerPerformances(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	perfs, err := h.svc.GetAllEngineerPerformances(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, perfs)
}

func (h *Handler) UpdateDispatchWeights(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.UpdateWeightsRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpdateDispatchWeights(c.Request.Context(), tenantID, body.Weights); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "dispatch weights updated"})
}

func (h *Handler) GetDispatchWeights(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	weights, err := h.svc.GetDispatchWeights(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, weights)
}

// ==================== Transfer ====================

func (h *Handler) TransferTicket(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")
	userID := c.GetString("user_id")
	var req models.TransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.TransferTicket(c.Request.Context(), tenantID, ticketID, req, userID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "ticket transferred"})
}

func (h *Handler) GetTransferHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")
	history, err := h.svc.GetTransferHistory(c.Request.Context(), tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, history)
}

func (h *Handler) GetTransferStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetTransferStats(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// ==================== Suspend ====================

func (h *Handler) CreateSuspend(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSuspendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	s, err := h.svc.CreateSuspend(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, s)
}

func (h *Handler) ActivateSuspend(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	s, err := h.svc.ActivateSuspend(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, s)
}

func (h *Handler) EndSuspend(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	s, err := h.svc.EndSuspend(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, s)
}

func (h *Handler) CancelSuspend(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	s, err := h.svc.CancelSuspend(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, s)
}

func (h *Handler) ListSuspensions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	suspensions, err := h.svc.ListSuspensions(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, suspensions)
}

func (h *Handler) GetSuspend(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	s, err := h.svc.GetSuspend(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, s)
}

func (h *Handler) GetEngineerSuspensions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	engineerID := c.Param("engineerId")
	suspensions, err := h.svc.GetEngineerSuspensions(c.Request.Context(), tenantID, engineerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, suspensions)
}

func (h *Handler) GetEngineerSuspendImpact(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	engineerID := c.Param("engineerId")
	impact, err := h.svc.GetEngineerSuspendImpact(c.Request.Context(), tenantID, engineerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, impact)
}

// ==================== BI Analytics ====================

func (h *Handler) GetExecutiveDashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	dashboard, err := h.svc.GetExecutiveDashboard(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, dashboard)
}

func (h *Handler) GetManagerDashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	dashboard, err := h.svc.GetManagerDashboard(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, dashboard)
}

func (h *Handler) GetEngineerDashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	engineerID := c.Param("engineerId")
	dashboard, err := h.svc.GetEngineerDashboard(c.Request.Context(), tenantID, engineerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, dashboard)
}

func (h *Handler) GetEngineerEfficiency(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	engineerID := c.Param("engineerId")
	efficiency, err := h.svc.GetEngineerEfficiency(c.Request.Context(), tenantID, engineerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, efficiency)
}

func (h *Handler) GetEfficiencyScore(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	engineerID := c.Param("engineerId")
	score, err := h.svc.GetEfficiencyScore(c.Request.Context(), tenantID, engineerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, score)
}

func (h *Handler) ComparePeriods(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	current := c.Query("current")
	previous := c.Query("previous")
	if current == "" || previous == "" {
		middleware.RespondBadRequest(c, "current and previous period required")
		return
	}
	result, err := h.svc.ComparePeriods(c.Request.Context(), tenantID, current, previous)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) ExportBIData(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.BIDataExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ExportBIData(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetTimeTrend(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	period := c.Query("period")
	if period == "" {
		period = "week"
	}
	trend, err := h.svc.GetTimeTrend(c.Request.Context(), tenantID, period)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, trend)
}

// ==================== SLA Policies ====================

func (h *Handler) CreateSLAPolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSLAPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.CreateSLAPolicy(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, p)
}

func (h *Handler) ListSLAPolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policies, err := h.svc.ListSLAPolicies(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, policies)
}

func (h *Handler) GetSLAPolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	p, err := h.svc.GetSLAPolicy(c.Request.Context(), tenantID, policyID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, p)
}

func (h *Handler) UpdateSLAPolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	var req models.UpdateSLAPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.UpdateSLAPolicy(c.Request.Context(), tenantID, policyID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, p)
}

func (h *Handler) DeleteSLAPolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	if err := h.svc.DeleteSLAPolicy(c.Request.Context(), tenantID, policyID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "SLA policy deleted"})
}

func (h *Handler) GetTicketSLAStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")
	status, err := h.svc.GetTicketSLAStatus(c.Request.Context(), tenantID, ticketID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}

func (h *Handler) GetBreaches(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	breaches, err := h.svc.GetBreaches(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, breaches)
}

func (h *Handler) GetCompliance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	result, err := h.svc.GetCompliance(c.Request.Context(), tenantID, policyID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ==================== Automation Rules ====================

func (h *Handler) CreateAutomationRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAutomationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	r, err := h.svc.CreateAutomationRule(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, r)
}

func (h *Handler) ListAutomationRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	rules, err := h.svc.ListAutomationRules(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rules)
}

func (h *Handler) UpdateAutomationRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	var req models.UpdateAutomationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	r, err := h.svc.UpdateAutomationRule(c.Request.Context(), tenantID, ruleID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, r)
}

func (h *Handler) DeleteAutomationRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	if err := h.svc.DeleteAutomationRule(c.Request.Context(), tenantID, ruleID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "automation rule deleted"})
}

func (h *Handler) ExecuteRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	result, err := h.svc.ExecuteRule(c.Request.Context(), tenantID, ruleID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ==================== Helpers ====================

func buildTicketListQuery(c *gin.Context) models.TicketListQuery {
	q := models.TicketListQuery{
		Limit:  50,
		Offset: 0,
	}
	if s := c.Query("status"); s != "" {
		q.Status = &s
	}
	if p := c.Query("priority"); p != "" {
		q.Priority = &p
	}
	if a := c.Query("assignee"); a != "" {
		q.Assignee = &a
	}
	if cat := c.Query("category"); cat != "" {
		q.Category = &cat
	}
	if search := c.Query("search"); search != "" {
		q.Search = &search
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			q.Limit = v
		}
	}
	if o := c.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil {
			q.Offset = v
		}
	}
	return q
}
