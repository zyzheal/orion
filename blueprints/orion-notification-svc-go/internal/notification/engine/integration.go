package engine

import (
	"context"
	"fmt"
	"time"

	"orion/notification-svc-go/internal/notification/models"
)

// ---------------------------------------------------------------------------
// EngineAdapter - 现有 Service → Engine 的桥接适配器（最小侵入）
//
// 设计原则：
//  1. 现有 Service 代码完全不改动
//  2. EngineAdapter 作为 Service 的可选增强层
//  3. 通过 WithPolicyExecutor() 注入到 Service
//
// 使用方式（main.go 中）：
//
//	engineAdapter := engine.NewEngineAdapter(policyFactory, handlerFactory)
//	svc := notification_service.NewService(repo)
//	svc.WithEngine(engineAdapter)  // 可选，不影响现有功能
//
// ---------------------------------------------------------------------------

// EngineAdapter bridges the existing notification Service with the unified engine.
type EngineAdapter struct {
	policyFactory  *NotifyPolicyHandlerFactory
	handlerFactory *NotifyHandlerFactory
	executor       *NotifyPolicyExecutor
	router         *ChannelRouter
}

// EngineOptions configures the EngineAdapter.
type EngineOptions struct {
	// ChannelChains defines delivery chains for event types.
	ChannelChains map[string][]models.ChannelType
	// AuditLogger logs delivery audit records.
	AuditLogger AuditLogger
	// DefaultThrottleMinutes limits notifications per minute.
	DefaultThrottleMinutes int
}

// NewEngineAdapter creates a new adapter.
func NewEngineAdapter(
	policyFactory *NotifyPolicyHandlerFactory,
	handlerFactory *NotifyHandlerFactory,
) *EngineAdapter {
	executor := NewNotifyPolicyExecutor(policyFactory, handlerFactory)
	router := NewChannelRouter(handlerFactory)
	return &EngineAdapter{
		policyFactory:  policyFactory,
		handlerFactory: handlerFactory,
		executor:       executor,
		router:         router,
	}
}

// WithOptions applies engine configuration.
func (a *EngineAdapter) WithOptions(opts EngineOptions) *EngineAdapter {
	if opts.AuditLogger != nil {
		a.executor.WithAuditLogger(opts.AuditLogger)
	}
	if len(opts.ChannelChains) > 0 {
		a.executor.WithChannelChains(opts.ChannelChains)
	}
	return a
}

// ---------------------------------------------------------------------------
// Bridge functions: convert existing models to engine types
// ---------------------------------------------------------------------------

// ToNotifyMessage converts a CreateNotificationRequest to a NotifyMessage.
// This bridges the existing API model to the engine's canonical message type.
func ToNotifyMessage(req *models.CreateNotificationRequest, notificationID string) *NotifyMessage {
	msg := &NotifyMessage{
		ID:        notificationID,
		TenantID:  req.TenantID,
		UserID:    req.UserID,
		Type:      req.Type,
		Title:     req.Title,
		Content:   req.Body,
		Subject:   req.Subject,
		Recipient: req.Recipient,
		Metadata: models.JSONB(map[string]any{
			"channel": string(req.Channel),
			"request": req,
		}),
		Priority:   0,
		MaxRetries: 3,
	}
	if req.Metadata != nil {
		msg.TemplVars = req.Metadata
	}
	return msg
}

// ToPolicyEvent converts a business event (from NATS/Kafka) to a PolicyEvent.
func ToPolicyEvent(eventType, sourceID, tenantID string, attrs map[string]any) *PolicyEvent {
	return &PolicyEvent{
		EventType:  eventType,
		SourceID:   sourceID,
		Source:     "external",
		TenantID:   tenantID,
		Attributes: attrs,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
	}
}

// ExecuteEvent routes a policy event through the full engine pipeline.
// Call this from the existing Service when processing business events.
func (a *EngineAdapter) ExecuteEvent(ctx context.Context, event *PolicyEvent, config *NotifyPolicyConfig) error {
	return a.executor.Execute(ctx, event, config)
}

// ExecuteEventAsync runs the event processing in a background goroutine.
func (a *EngineAdapter) ExecuteEventAsync(ctx context.Context, event *PolicyEvent, config *NotifyPolicyConfig) {
	a.executor.ExecuteAsync(ctx, event, config)
}

// DeliverMessage routes a single NotifyMessage to its channel handler.
// Call this from the existing Service.SendNotification for direct delivery.
func (a *EngineAdapter) DeliverMessage(ctx context.Context, msg *NotifyMessage) (*SendResult, error) {
	chType := msg.Metadata["channel"]
	if chType == nil {
		return nil, ErrNoChannelConfigured
	}

	handler, ok := a.handlerFactory.Get(models.ChannelType(chType.(string)))
	if !ok {
		return nil, fmt.Errorf("no handler for channel: %s", chType)
	}
	return handler.Execute(ctx, msg)
}

// DeliverRoute routes a message through the configured channel chain.
// Falls back to single-channel delivery if no chain is configured.
func (a *EngineAdapter) DeliverRoute(ctx context.Context, policyName string, msg *NotifyMessage) (*SendResult, error) {
	return a.router.Route(ctx, policyName, msg)
}

// HandlerFactory returns the channel handler factory for direct access.
func (a *EngineAdapter) HandlerFactory() *NotifyHandlerFactory {
	return a.handlerFactory
}

// PolicyFactory returns the policy handler factory for direct access.
func (a *EngineAdapter) PolicyFactory() *NotifyPolicyHandlerFactory {
	return a.policyFactory
}

// Executor returns the policy executor for direct access.
func (a *EngineAdapter) Executor() *NotifyPolicyExecutor {
	return a.executor
}

// Metrics returns a snapshot of all engine metrics.
func (a *EngineAdapter) Metrics() EngineMetrics {
	return EngineMetrics{
		HandlerFactory: a.handlerFactory.Metrics(),
		PolicyFactory:  a.policyFactory.Metrics(),
		Executor:       a.executor.Metrics(),
	}
}

// EngineMetrics aggregates metrics from all engine components.
type EngineMetrics struct {
	HandlerFactory FactoryMetrics       `json:"handlerFactory"`
	PolicyFactory  PolicyFactoryMetrics `json:"policyFactory"`
	Executor       ExecutorMetrics      `json:"executor"`
}
