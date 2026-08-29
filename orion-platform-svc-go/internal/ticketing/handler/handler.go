package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/service"

	"github.com/gin-gonic/gin"
)

// Handler is the monolithic ticketing handler.
// Individual handler methods are split across domain-specific files (see handler_*.go).
type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
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
// (implemented in handler_service.go)

// ==================== Ticket CRUD ====================
// (implemented in handler_ticket_crud.go)

// ==================== Workflow ====================
// (implemented in handler_workflow.go)

// ==================== Assignment Rules ====================
// (implemented in handler_assignment.go)

// ==================== Relations ====================
// (implemented in handler_relations.go)

// ==================== SLA ====================
// (implemented in handler_sla_base.go)

// ==================== Reports ====================
// (implemented in handler_reports.go)

// ==================== Dispatch ====================
// (implemented in handler_dispatch.go)

// ==================== Transfer ====================
// (implemented in handler_transfer.go)

// ==================== Suspend ====================
// (implemented in handler_suspend.go)

// ==================== BI Analytics ====================
// (implemented in handler_bi.go)

// ==================== SLA Policies ====================
// (implemented in handler_sla_policy.go)

// ==================== Automation Rules ====================
// (implemented in handler_automation.go)

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
