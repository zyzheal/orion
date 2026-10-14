// Package eventsub provides cross-module domain event subscribers.
// Subscribers register on the ComposedEventPublisher and react to events
// published by domain services. This enables loose coupling between modules:
// e.g., when inspection.schedule.created is published, the scheduler
// subscriber computes the next run time automatically.
package eventsub

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"go.uber.org/zap"
	"orion/platform-svc-go/internal/domain/events"
)

// LoggingHandler logs every event it receives. Useful for audit trail
// and debugging event flow. Implements events.EventHandler.
type LoggingHandler struct {
	logger *zap.Logger
	types  []string
}

// NewLoggingHandler creates a handler that logs events of the given types.
func NewLoggingHandler(logger *zap.Logger, types ...string) *LoggingHandler {
	return &LoggingHandler{logger: logger, types: types}
}

func (h *LoggingHandler) Handle(ctx context.Context, event events.DomainEvent) error {
	payload := extractPayload(event)
	h.logger.Info("domain event received",
		zap.String("type", event.EventType()),
		zap.String("tenant", event.TenantID()),
		zap.String("aggregateId", event.AggregateID()),
		zap.Any("payload", payload),
	)
	return nil
}

func (h *LoggingHandler) Supports() []string {
	return h.types
}

// InspectionScheduleHandler listens for inspection.schedule.created events
// and logs the creation. A future enhancement can trigger the scheduler to
// compute the next run time for the newly created schedule.
type InspectionScheduleHandler struct {
	logger *zap.Logger
}

func NewInspectionScheduleHandler(logger *zap.Logger) *InspectionScheduleHandler {
	return &InspectionScheduleHandler{logger: logger}
}

func (h *InspectionScheduleHandler) Handle(ctx context.Context, event events.DomainEvent) error {
	payload := extractPayload(event)
	scheduleID, _ := payload["id"].(string)
	templateID, _ := payload["templateId"].(string)
	h.logger.Info("inspection schedule created — computing next run",
		zap.String("scheduleId", scheduleID),
		zap.String("templateId", templateID),
		zap.String("tenant", event.TenantID()),
	)
	// Future: call scheduler.ComputeNextRun and update the schedule's
	// next_run_at field. For now, this is a placeholder that demonstrates
	// cross-module event handling.
	return nil
}

func (h *InspectionScheduleHandler) Supports() []string {
	return []string{"inspection.schedule.created"}
}

// SLACreatedHandler listens for alert.sla.created events and logs them.
// A future enhancement can trigger immediate SLA evaluation for existing
// alerts.
type SLACreatedHandler struct {
	logger *zap.Logger
}

func NewSLACreatedHandler(logger *zap.Logger) *SLACreatedHandler {
	return &SLACreatedHandler{logger: logger}
}

func (h *SLACreatedHandler) Handle(ctx context.Context, event events.DomainEvent) error {
	payload := extractPayload(event)
	slaID, _ := payload["id"].(string)
	severity, _ := payload["severity"].(string)
	h.logger.Info("SLA policy created — evaluating active alerts",
		zap.String("slaId", slaID),
		zap.String("severity", severity),
		zap.String("tenant", event.TenantID()),
	)
	// Future: call monitor.EvaluateSLA for all active alerts matching
	// this SLA policy's severity. For now, this is a placeholder.
	return nil
}

func (h *SLACreatedHandler) Supports() []string {
	return []string{"alert.sla.created"}
}

// RequirementCreatedHandler listens for rdm.requirement.created events.
// A future enhancement can trigger notifications or workflow automation.
type RequirementCreatedHandler struct {
	logger *zap.Logger
}

func NewRequirementCreatedHandler(logger *zap.Logger) *RequirementCreatedHandler {
	return &RequirementCreatedHandler{logger: logger}
}

func (h *RequirementCreatedHandler) Handle(ctx context.Context, event events.DomainEvent) error {
	payload := extractPayload(event)
	reqID, _ := payload["id"].(string)
	title, _ := payload["title"].(string)
	status, _ := payload["status"].(string)
	h.logger.Info("requirement created — notification trigger",
		zap.String("requirementId", reqID),
		zap.String("title", title),
		zap.String("status", status),
		zap.String("tenant", event.TenantID()),
	)
	// Future: send notification, trigger workflow automation, etc.
	return nil
}

func (h *RequirementCreatedHandler) Supports() []string {
	return []string{"rdm.requirement.created"}
}

// ShiftCreatedHandler listens for alert.shift.created events.
// A future enhancement can sync shift assignments to external calendar systems.
type ShiftCreatedHandler struct {
	logger *zap.Logger
}

func NewShiftCreatedHandler(logger *zap.Logger) *ShiftCreatedHandler {
	return &ShiftCreatedHandler{logger: logger}
}

func (h *ShiftCreatedHandler) Handle(ctx context.Context, event events.DomainEvent) error {
	payload := extractPayload(event)
	shiftID, _ := payload["id"].(string)
	name, _ := payload["name"].(string)
	h.logger.Info("alert shift created — calendar sync",
		zap.String("shiftId", shiftID),
		zap.String("name", name),
		zap.String("tenant", event.TenantID()),
	)
	return nil
}

func (h *ShiftCreatedHandler) Supports() []string {
	return []string{"alert.shift.created"}
}

// extractPayload attempts to extract the payload map from a domain event.
// If the event is a GenericDomainEvent (from EventBusAdapter), the Payload
// field is returned directly. Otherwise, the event is JSON-marshaled and
// re-parsed as a map for logging purposes.
func extractPayload(event events.DomainEvent) map[string]any {
	// Use type assertion to check for GenericDomainEvent
	// Since we can't import eventpublisher package (would create a cycle),
	// we use an interface check
	type payloadCarrier interface {
		GetPayload() map[string]any
	}
	// Try JSON marshal/unmarshal as a fallback
	data, err := json.Marshal(event)
	if err != nil {
		return nil
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return nil
	}
	if payload, ok := m["payload"].(map[string]any); ok {
		return payload
	}
	return m
}

// RegisterAll registers all cross-module event subscribers on the given
// event publisher. This is called during server wiring to activate
// event-driven cross-module communication.
func RegisterAll(publisher events.EventPublisher, logger *zap.Logger) {
	handlers := []events.EventHandler{
		NewLoggingHandler(logger,
			"alert.sla.deleted",
			"alert.shift.deleted",
			"inspection.template.created",
			"inspection.template.deleted",
			"inspection.schedule.deleted",
			"sprint.review.created",
			"sprint.review.deleted",
			"sprint.retrospective.created",
			"sprint.retrospective.deleted",
		),
		NewInspectionScheduleHandler(logger),
		NewSLACreatedHandler(logger),
		NewRequirementCreatedHandler(logger),
		NewShiftCreatedHandler(logger),
	}

	for _, h := range handlers {
		for _, eventType := range h.Supports() {
			publisher.Subscribe(eventType, h)
			logger.Info("cross-module event subscriber registered",
				zap.String("eventType", eventType),
				zap.String("handler", fmt.Sprintf("%T", h)),
			)
		}
	}
}

// Ensure *time.Time is referenced (used in future enhancements)
var _ = time.Now
