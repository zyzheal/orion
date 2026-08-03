// Package handler provides HTTP endpoints for the domain CQRS layer: command
// dispatch, aggregate inspection, event history retrieval, and health checks.
package handler

import (
	"encoding/json"
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/domain/commands"
	"orion/platform-svc-go/internal/domain/events"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Handler exposes the domain CQRS surface over HTTP.
type Handler struct {
	bus       commands.CommandBus
	publisher events.EventPublisher
	logger    *zap.Logger
}

// NewHandler creates a CQRS handler wired to the given command bus, event
// publisher, and structured logger.
func NewHandler(bus commands.CommandBus, publisher events.EventPublisher, logger *zap.Logger) *Handler {
	return &Handler{
		bus:       bus,
		publisher: publisher,
		logger:    logger,
	}
}

// RegisterRoutes mounts the CQRS endpoints onto the provided RouterGroup.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/domain/cqrs")

	r.POST("/commands", auth.RequirePermission("domain", "write"), h.DispatchCommand)
	r.GET("/aggregates/:aggregateID", auth.RequirePermission("domain", "read"), h.GetAggregate)
	r.GET("/aggregates/:aggregateID/events", auth.RequirePermission("domain", "read"), h.GetEventHistory)
	r.GET("/health", h.Health)
}

// dispatchRequest is the JSON body accepted by POST /domain/cqrs/commands.
type dispatchRequest struct {
	CommandType string `json:"command_type" binding:"required"`
	AggregateID string `json:"aggregate_id" binding:"required"`
	TenantID    string `json:"tenant_id"`
	Data        any    `json:"data"`
}

// DispatchCommand accepts {command_type, aggregate_id, tenant_id?, data} and
// sends the command through the command bus.  The bus returns
// ErrHandlerNotFound when no handler is registered for the command type.
func (h *Handler) DispatchCommand(c *gin.Context) {
	var req dispatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, "invalid command payload: "+err.Error())
		return
	}

	tenantID := req.TenantID
	if tenantID == "" {
		// Fall back to tenant propagated by auth middleware if available.
		tenantID = c.GetString("tenant_id")
	}

	// Marshal arbitrary payload into json.RawMessage for the Command struct.
	var data json.RawMessage
	if req.Data != nil {
		payload, err := json.Marshal(req.Data)
		if err != nil {
			middleware.RespondBadRequest(c, "failed to marshal command data: "+err.Error())
			return
		}
		data = payload
	}

	cmd := commands.NewCommand(req.CommandType, req.AggregateID, tenantID, data)

	if err := h.bus.Send(c.Request.Context(), cmd); err != nil {
		if _, ok := err.(*commands.HandlerNotFoundError); ok {
			h.logger.Warn("command handler not found", zap.String("command_type", req.CommandType))
			middleware.RespondNotFound(c, "no handler registered for command type: "+req.CommandType)
			return
		}
		h.logger.Error("command dispatch failed", zap.Error(err))
		middleware.RespondInternalError(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"command_id":  cmd.CommandID,
		"command_type": cmd.CommandType,
		"aggregate_id": cmd.AggregateID,
		"status":      "dispatched",
	})
}

// GetAggregate returns an empty map (stub — no aggregate store is wired yet).
func (h *Handler) GetAggregate(c *gin.Context) {
	aggregateID := c.Param("aggregateID")
	h.logger.Debug("get aggregate (stub)", zap.String("aggregate_id", aggregateID))
	middleware.RespondSuccess(c, map[string]any{})
}

// GetEventHistory returns an empty array (stub — no event store is wired yet).
func (h *Handler) GetEventHistory(c *gin.Context) {
	aggregateID := c.Param("aggregateID")
	h.logger.Debug("get event history (stub)", zap.String("aggregate_id", aggregateID))
	middleware.RespondSuccess(c, []any{})
}

// Health returns a lightweight health indicator for the CQRS layer.
func (h *Handler) Health(c *gin.Context) {
	middleware.RespondSuccess(c, gin.H{"status": "healthy"})
}
