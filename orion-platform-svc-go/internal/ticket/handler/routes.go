package handler

import (
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// RegisterTicketDomainRoutes mounts the /api/v1/tickets routes owned by the
// handlers in this package that have no RegisterRoutes of their own.
//
// internal/ticketing/handler is registered earlier in setupRouter and already
// serves this package's shared surface: GET/POST /tickets, GET /tickets/:id,
// the workflow (:id/transition, :id/history, :id/escalate, :id/close), the
// relations (:id/relations, :id/related, :id/duplicates, /tickets/correlate),
// GET /tickets/:id/sla, the suspend CRUD, the transfer CRUD, the dispatch
// engineer/rule/weight/queue/report routes and the whole BI report set. This
// function therefore registers only the paths ticketingH does not own, so Gin
// never sees a second (method, path) pair — the second registration panics and
// aborts the server at boot (see cmd/server/boot_test.go).
//
// Order matters for Gin's trie: the static /tickets/<segment> paths come first
// and the /tickets/:id subtree is never re-registered, only extended.
// nil handlers are skipped so callers can wire whichever subset is constructed.
func RegisterTicketDomainRoutes(
	rg *gin.RouterGroup,
	ticket *TicketHandler,
	sla *SLAHandler,
	dispatch *DispatchHandler,
	queue *QueueHandler,
	lb *LoadBalancerHandler,
	transfer *TransferHandler,
) {
	// ---- Ticket CRUD: ticketingH owns GET/POST /tickets and GET /tickets/:id ----
	if ticket != nil {
		rg.PUT("/tickets/:id", auth.RequirePermission("ticket", "write"), ticket.UpdateTicket)
		rg.DELETE("/tickets/:id", auth.RequirePermission("ticket", "delete"), ticket.DeleteTicket)
		rg.GET("/tickets/stats", auth.RequirePermission("ticket", "read"), ticket.Count)
		rg.GET("/tickets/:id/comments", auth.RequirePermission("ticket", "read"), ticket.ListComments)
		rg.POST("/tickets/:id/comments", auth.RequirePermission("ticket", "write"), ticket.CreateComment)
	}

	// ---- SLA: ticketingH owns GET /tickets/:id/sla and /tickets/reports/sla ----
	if sla != nil {
		rg.POST("/tickets/sla/targets", auth.RequirePermission("ticket", "write"), sla.AddSLATarget)
		rg.GET("/tickets/sla/compliance", auth.RequirePermission("ticket", "read"), sla.GetSLACompliance)
		rg.GET("/tickets/sla/breaches", auth.RequirePermission("ticket", "read"), sla.CheckSLABreaches)
	}

	// ---- Dispatch: ticketingH owns the /tickets/dispatch/* variants; these use
	// the ticket id as a path segment instead. ----
	if dispatch != nil {
		rg.POST("/tickets/:id/dispatch/auto", auth.RequirePermission("ticket", "write"), dispatch.AutoDispatch)
		rg.POST("/tickets/:id/dispatch/manual", auth.RequirePermission("ticket", "write"), dispatch.ManualDispatch)
	}

	// ---- SLA-aware dispatch queue: ticketingH owns queue/status and queue/entries ----
	if queue != nil {
		rg.GET("/tickets/dispatch/queue/sla-status", auth.RequirePermission("ticket", "read"), queue.GetSLAQueueStatus)
		rg.GET("/tickets/dispatch/queue/sla-entries", auth.RequirePermission("ticket", "read"), queue.GetSLAQueueEntries)
		rg.GET("/tickets/dispatch/queue/sla-alerts", auth.RequirePermission("ticket", "read"), queue.GetSLAAlerts)
		rg.POST("/tickets/dispatch/queue/reprioritize", auth.RequirePermission("ticket", "write"), queue.ReprioritizeQueue)
	}

	// ---- Engineer load balancing: ticketingH owns /tickets/dispatch/load-balance/* ----
	if lb != nil {
		rg.GET("/tickets/dispatch/balancing/report", auth.RequirePermission("ticket", "read"), lb.GetBalancingReport)
		rg.GET("/tickets/dispatch/balancing/suggestions", auth.RequirePermission("ticket", "read"), lb.GetReassignmentSuggestions)
		rg.GET("/tickets/dispatch/balancing/team/:team/capacity", auth.RequirePermission("ticket", "read"), lb.GetTeamCapacity)
		rg.GET("/tickets/dispatch/balancing/engineer/:id/capacity", auth.RequirePermission("ticket", "read"), lb.CheckEngineerCapacity)
		rg.GET("/tickets/dispatch/balancing/available", auth.RequirePermission("ticket", "read"), lb.GetAvailableEngineers)
	}

	// ---- Transfer: ticketingH owns /tickets/transfer/:ticketId, its history and /stats ----
	if transfer != nil {
		rg.POST("/tickets/transfer/suspend/:suspendId", auth.RequirePermission("ticket", "write"), transfer.TransferDueToSuspend)
		rg.POST("/tickets/transfer/auto-check", auth.RequirePermission("ticket", "write"), transfer.CheckAutoTransfer)
		rg.GET("/tickets/transfer/config", auth.RequirePermission("ticket", "read"), transfer.GetTransferConfig)
		rg.PUT("/tickets/transfer/config", auth.RequirePermission("ticket", "write"), transfer.UpdateTransferConfig)
	}
}
