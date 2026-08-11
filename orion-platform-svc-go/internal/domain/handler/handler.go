// Package handler provides HTTP endpoints for the domain CQRS layer: command
// dispatch, aggregate inspection, event history retrieval, and health checks.
package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/domain/commands"
	"orion/platform-svc-go/internal/domain/events"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/domain/service"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Handler exposes the domain CQRS surface over HTTP.
type Handler struct {
	bus       commands.CommandBus
	publisher events.EventPublisher
	svc       *service.Service
	logger    *zap.Logger
}

func NewHandler(bus commands.CommandBus, publisher events.EventPublisher, svc *service.Service, logger *zap.Logger) *Handler {
	return &Handler{
		bus:       bus,
		publisher: publisher,
		svc:       svc,
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
// sends the command through the command bus.
func (h *Handler) DispatchCommand(c *gin.Context) {
	var req dispatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, "invalid command payload: "+err.Error())
		return
	}

	tenantID := req.TenantID
	if tenantID == "" {
		tenantID = c.GetString("tenant_id")
	}

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
		"command_id":   cmd.CommandID,
		"command_type": cmd.CommandType,
		"aggregate_id": cmd.AggregateID,
		"status":       "dispatched",
	})
}

// GetAggregate returns the latest event version for the given aggregate.
func (h *Handler) GetAggregate(c *gin.Context) {
	ctx := c.Request.Context()
	aggregateID := c.Param("aggregateID")
	tenantID := c.GetString("tenant_id")
	commandType := c.Query("command_type")
	if commandType == "" {
		commandType = aggregateID
	}

	if h.svc == nil {
		middleware.RespondSuccess(c, map[string]any{})
		return
	}
	version, err := h.svc.GetLatestVersion(ctx, tenantID, commandType, aggregateID)
	if err != nil {
		h.logger.Error("get aggregate version failed", zap.Error(err))
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, map[string]any{
		"aggregate_id": aggregateID,
		"version":      version,
		"status":       "active",
	})
}

// GetEventHistory returns the event stream for the given aggregate.
func (h *Handler) GetEventHistory(c *gin.Context) {
	ctx := c.Request.Context()
	aggregateID := c.Param("aggregateID")
	tenantID := c.GetString("tenant_id")
	commandType := c.Query("command_type")
	if commandType == "" {
		commandType = aggregateID
	}

	if h.svc == nil {
		middleware.RespondSuccess(c, []any{})
		return
	}
	eventList, err := h.svc.GetEventHistory(ctx, tenantID, commandType, aggregateID)
	if err != nil {
		h.logger.Error("get event history failed", zap.Error(err))
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if eventList == nil {
		eventList = []events.DomainEvent{}
	}

	type eventDTO struct {
		EventType     string `json:"event_type"`
		AggregateID   string `json:"aggregate_id"`
		AggregateType string `json:"aggregate_type"`
		Version       int    `json:"version"`
		CreatedAt     string `json:"created_at"`
	}

	dto := make([]eventDTO, len(eventList))
	for i, e := range eventList {
		dto[i] = eventDTO{
			EventType:     e.EventType(),
			AggregateID:   e.AggregateID(),
			AggregateType: e.AggregateType(),
			Version:       e.Version(),
			CreatedAt:     e.OccurredAt().UTC().Format(time.RFC3339),
		}
	}
	middleware.RespondSuccess(c, dto)
}

// Health returns a lightweight health indicator for the CQRS layer.
func (h *Handler) Health(c *gin.Context) {
	middleware.RespondSuccess(c, gin.H{"status": "healthy"})
}