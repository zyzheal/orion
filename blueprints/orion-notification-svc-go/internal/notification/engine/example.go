package engine

import (
	"context"
	"orion/notification-svc-go/internal/notification/models"
)

// ---------------------------------------------------------------------------
// ExampleIntegration - 集成示例（供参考，实际集成在 cmd/server/main.go）
//
// 以下是将 engine 集成到现有 Service 的完整示例。
// 复制此代码到 main.go 即可启用统一通知引擎。
// ---------------------------------------------------------------------------

// ExampleIntegrationCode 包含集成代码片段，供 main.go 使用。
//
// 在 cmd/server/main.go 中的集成步骤：
//
// 1. 导入 engine 包（自动触发 init() 注册渠道处理器）：
//
//	import _ "orion/notification-svc-go/internal/notification/engine/channels"
//
// 2. 创建 EngineAdapter：
//
//	policyFactory := engine.NewNotifyPolicyHandlerFactory()
//	handlerFactory := engine.NewNotifyHandlerFactory()
//	// 渠道处理器已通过 init() 自动注册
//
//	adapter := engine.NewEngineAdapter(policyFactory, handlerFactory)
//	adapter.WithOptions(engine.EngineOptions{
//	    ChannelChains: map[string][]models.ChannelType{
//	        "ALERT_CRITICAL":   {models.ChannelEmail, models.ChannelSlack},
//	        "PIPELINE_FAILED":  {models.ChannelEmail, models.ChannelWebhook},
//	        "TICKET_ASSIGNED":  {models.ChannelEmail, models.ChannelDingtalk},
//	    },
//	})
//
// 3. 注入到 Service：
//
//	svc := notification_service.NewService(repo)
//	svc.WithEngine(adapter)
//
// 4. 在业务处理中使用：
//
//	// 直接发送（现有方式）
//	svc.SendNotification(ctx, tenantID, &models.CreateNotificationRequest{...})
//
//	// 策略驱动（新方式）
//	event := engine.ToPolicyEvent("ALERT_CRITICAL", alertID, tenantID, map[string]any{
//	    "severity": "critical",
//	    "resource": "cpu-usage",
//	})
//	adapter.ExecuteEventAsync(ctx, event, policyConfig)
//
// ---------------------------------------------------------------------------

// ExampleSendEmail demonstrates direct channel delivery.
func ExampleSendEmail(ctx context.Context, msg *NotifyMessage) error {
	handlerFactory := GlobalHandlerFactory
	handler, ok := handlerFactory.Get(models.ChannelEmail)
	if !ok {
		return ErrNoChannelConfigured
	}
	result, err := handler.Execute(ctx, msg)
	if err != nil {
		return err
	}
	_ = result
	return nil
}

// ExamplePolicyPipeline demonstrates the full policy-driven pipeline.
func ExamplePolicyPipeline(ctx context.Context, event *PolicyEvent, config *NotifyPolicyConfig) error {
	adapter := NewEngineAdapter(GlobalPolicyHandlerFactory, GlobalHandlerFactory)
	return adapter.ExecuteEvent(ctx, event, config)
}

// ExampleRegisterPolicyHandler demonstrates registering a policy handler.
//
// In a real application, this would be in each module's init():
//
//	func init() {
//	    engine.GlobalPolicyHandlerFactory.Register(&AlertPolicyHandler{})
//	}
func ExampleRegisterPolicyHandler() {
	// 示例：注册告警策略处理器
	GlobalPolicyHandlerFactory.Register(&AlertPolicyHandler{})
}

// AlertPolicyHandler is an example policy handler for alert events.
// Implements NotifyPolicyHandler to handle ALERT_* events.
type AlertPolicyHandler struct{}

func (h *AlertPolicyHandler) TriggerType() string { return "ALERT_CREATED" }

func (h *AlertPolicyHandler) Priority() int { return 100 }

func (h *AlertPolicyHandler) Handle(ctx context.Context, event *PolicyEvent, config *NotifyPolicyConfig) ([]*NotifyMessage, error) {
	// Convert alert event to notification message
	msg := &NotifyMessage{
		ID:       event.SourceID,
		TenantID: event.TenantID,
		Type:     event.EventType,
		Title:    "Alert: " + event.Attributes["resource"].(string),
		Content:  event.Attributes["message"].(string),
		Metadata: models.JSONB(map[string]any{
			"severity": event.Attributes["severity"],
			"resource": event.Attributes["resource"],
		}),
	}
	return []*NotifyMessage{msg}, nil
}

// ---------------------------------------------------------------------------
// 内置渠道链配置（默认值，可被覆盖）
// ---------------------------------------------------------------------------

// DefaultChannelChains provides sensible default delivery chains for common event types.
// These chains define which channels are attempted in order when a policy doesn't specify.
var DefaultChannelChains = map[string][]models.ChannelType{
	"ALERT_CRITICAL":     {models.ChannelEmail, models.ChannelSlack, models.ChannelWebhook},
	"ALERT_WARNING":      {models.ChannelEmail, models.ChannelSlack},
	"PIPELINE_COMPLETED": {models.ChannelSlack, models.ChannelWebhook},
	"PIPELINE_FAILED":    {models.ChannelEmail, models.ChannelSlack, models.ChannelWebhook},
	"TICKET_ASSIGNED":    {models.ChannelEmail, models.ChannelDingtalk},
	"TICKET_ESCALATED":   {models.ChannelEmail, models.ChannelSlack},
	"DEPLOYMENT_SUCCESS": {models.ChannelSlack},
	"DEPLOYMENT_FAILED":  {models.ChannelEmail, models.ChannelSlack},
}
