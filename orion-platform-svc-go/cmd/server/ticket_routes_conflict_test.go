package main

import (
	"testing"

	"github.com/gin-gonic/gin"
)

var noop = func(*gin.Context) {}

// TestTicketRoutesTreeConflict replays the full /api/v1 ticket registration
// sequence (existing duplicate ticketing module first, as in router.go:554,
// then the newly mounted internal/ticket/handler routes) and fails if Gin
// panics on a duplicate registration or a wildcard/static trie conflict.
func TestTicketRoutesTreeConflict(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	api := r.Group("/api/v1")

	// ---- already registered at router.go:554 (internal/ticketing/handler) ----
	api.GET("/tickets", noop)
	api.POST("/tickets/correlate", noop)
	api.GET("/tickets/reports/sla", noop)
	api.GET("/tickets/reports/resolution", noop)
	api.GET("/tickets/reports/backlog", noop)
	api.GET("/tickets/reports/trends", noop)
	api.GET("/tickets/reports/statistics", noop)
	api.GET("/tickets/dispatch/engineers", noop)
	api.GET("/tickets/dispatch/engineers/:id", noop)
	api.POST("/tickets/dispatch/auto/:ticketId", noop)
	api.POST("/tickets/dispatch/manual/:ticketId", noop)
	api.GET("/tickets/dispatch/best-match/:ticketId", noop)
	api.POST("/tickets/dispatch/score", noop)
	api.GET("/tickets/dispatch/queue/status", noop)
	api.GET("/tickets/dispatch/queue/entries", noop)
	api.GET("/tickets/dispatch/sla-alerts", noop)
	api.POST("/tickets/dispatch/rules", noop)
	api.GET("/tickets/dispatch/rules", noop)
	api.GET("/tickets/dispatch/load-balance/report", noop)
	api.GET("/tickets/dispatch/load-balance/suggestions", noop)
	api.GET("/tickets/dispatch/reports/metrics", noop)
	api.GET("/tickets/dispatch/reports/assignment-success", noop)
	api.GET("/tickets/dispatch/reports/time-to-assignment", noop)
	api.GET("/tickets/dispatch/reports/performance/:engineerId", noop)
	api.GET("/tickets/dispatch/reports/performance", noop)
	api.PUT("/tickets/dispatch/weights", noop)
	api.GET("/tickets/dispatch/weights", noop)
	api.POST("/tickets/transfer/:ticketId", noop)
	api.GET("/tickets/transfer/:ticketId/history", noop)
	api.GET("/tickets/transfer/stats", noop)
	api.GET("/tickets/suspend", noop)
	api.GET("/tickets/suspend/:id", noop)
	api.GET("/tickets/suspend/engineer/:engineerId", noop)
	api.GET("/tickets/suspend/engineer/:engineerId/impact", noop)
	api.GET("/tickets/bi/dashboard/executive", noop)
	api.GET("/tickets/bi/dashboard/manager", noop)
	api.GET("/tickets/bi/dashboard/engineer/:engineerId", noop)
	api.GET("/tickets/bi/efficiency/:engineerId", noop)
	api.GET("/tickets/bi/score/:engineerId", noop)
	api.GET("/tickets/bi/compare", noop)
	api.POST("/tickets/bi/export", noop)
	api.GET("/tickets/bi/trend", noop)

	// ---- already registered internal/ticket/handler ----
	api.POST("/tickets/from-alert", noop)
	api.POST("/tickets/from-incident", noop)

	// ---- NEW: internal/ticket/handler routes that do not collide ----
	api.POST("/tickets", noop)
	api.PUT("/tickets/:id", noop)
	api.DELETE("/tickets/:id", noop)
	api.POST("/tickets/:id/assign", noop)
	api.POST("/tickets/:id/resolve", noop)
	api.GET("/tickets/:id/comments", noop)
	api.POST("/tickets/:id/comments", noop)
	api.POST("/tickets/:id/transition", noop)
	api.GET("/tickets/:id/history", noop)
	api.POST("/tickets/:id/escalate", noop)
	api.POST("/tickets/:id/close", noop)
	api.GET("/tickets/:id/sla", noop)
	api.POST("/tickets/sla/targets", noop)
	api.GET("/tickets/sla/compliance", noop)
	api.GET("/tickets/sla/breaches", noop)
	api.GET("/tickets/:id/relations", noop)
	api.POST("/tickets/:id/relations", noop)
	api.GET("/tickets/:id/related", noop)
	api.GET("/tickets/:id/duplicates", noop)
	api.POST("/tickets/dispatch/engineers", noop)
	api.POST("/tickets/:id/dispatch/auto", noop)
	api.POST("/tickets/:id/dispatch/manual", noop)
	api.GET("/tickets/dispatch/queue/sla-status", noop)
	api.GET("/tickets/dispatch/queue/sla-entries", noop)
	api.GET("/tickets/dispatch/queue/sla-alerts", noop)
	api.POST("/tickets/dispatch/queue/reprioritize", noop)
	api.GET("/tickets/dispatch/balancing/report", noop)
	api.GET("/tickets/dispatch/balancing/suggestions", noop)
	api.GET("/tickets/dispatch/balancing/team/:team/capacity", noop)
	api.GET("/tickets/dispatch/balancing/engineer/:id/capacity", noop)
	api.GET("/tickets/dispatch/balancing/available", noop)
	api.POST("/tickets/transfer/suspend/:suspendId", noop)
	api.POST("/tickets/transfer/auto-check", noop)
	api.GET("/tickets/transfer/config", noop)
	api.PUT("/tickets/transfer/config", noop)
	api.POST("/tickets/suspend", noop)
	api.POST("/tickets/suspend/:id/activate", noop)
	api.POST("/tickets/suspend/:id/end", noop)
	api.POST("/tickets/suspend/:id/cancel", noop)
	api.GET("/tickets/stats", noop)

	// wildcard /tickets/:id LAST so static siblings are already in the trie
	api.GET("/tickets/:id", noop)
}
