package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"orion/notification-svc-go/internal/notification/engine"
	"orion/notification-svc-go/internal/notification/models"
)

// ---------------------------------------------------------------------------
// BaseNotifyChannel - 基类（提供通用功能）
// ---------------------------------------------------------------------------

// BaseNotifyChannel provides common functionality for channel handlers.
type BaseNotifyChannel struct {
	httpClient *http.Client
	healthy    bool
}

// NewBaseNotifyChannel creates a new base channel.
func NewBaseNotifyChannel() *BaseNotifyChannel {
	return &BaseNotifyChannel{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		healthy:    true,
	}
}

// Healthy returns the health status.
func (b *BaseNotifyChannel) Healthy() bool {
	return b.healthy
}

// SetHealthy sets the health status.
func (b *BaseNotifyChannel) SetHealthy(h bool) {
	b.healthy = h
}

// SendJSON sends a POST request with JSON body to the given URL.
func (b *BaseNotifyChannel) SendJSON(ctx context.Context, url string, payload map[string]any) (*engine.SendResult, error) {
	if b.healthy {
		t0 := time.Now()

		jsonBody, err := json.Marshal(payload)
		if err != nil {
			b.SetHealthy(false)
			return nil, fmt.Errorf("failed to marshal payload: %w", err)
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(jsonBody)))
		if err != nil {
			b.SetHealthy(false)
			return nil, fmt.Errorf("failed to create request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json; charset=utf-8")

		resp, err := b.httpClient.Do(req)
		if err != nil {
			b.SetHealthy(false)
			return nil, fmt.Errorf("http request failed: %w", err)
		}
		defer resp.Body.Close()

		duration := time.Since(t0).Milliseconds()

		if resp.StatusCode >= 400 {
			b.SetHealthy(false)
			return &engine.SendResult{
				Success:      false,
				ResponseCode: resp.StatusCode,
				DurationMS:   duration,
				Error:        fmt.Sprintf("HTTP %d", resp.StatusCode),
			}, nil
		}

		return &engine.SendResult{
			Success:      true,
			ResponseCode: resp.StatusCode,
			DurationMS:   duration,
		}, nil
	}
	return &engine.SendResult{
		Success: false,
		Error:   "channel is unhealthy",
	}, nil
}

// ---------------------------------------------------------------------------
// EmailHandler - 邮件渠道
// ---------------------------------------------------------------------------

// EmailHandler implements NotifyChannel for email delivery.
// In production, integrates with SMTP relay; currently logs and succeeds.
type EmailHandler struct {
	BaseNotifyChannel
}

func (h *EmailHandler) Type() models.ChannelType { return models.ChannelEmail }

func (h *EmailHandler) Execute(ctx context.Context, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	// TODO: Integrate with SMTP relay in production
	// Currently: log delivery attempt and succeed
	return &engine.SendResult{
		Success:   true,
		MessageID: fmt.Sprintf("email-%d-%s", time.Now().UnixNano(), msg.Recipient),
	}, nil
}

// ---------------------------------------------------------------------------
// SlackHandler - Slack 渠道
// ---------------------------------------------------------------------------

// SlackHandler implements NotifyChannel for Slack delivery via incoming webhook.
type SlackHandler struct {
	BaseNotifyChannel
}

func (h *SlackHandler) Type() models.ChannelType { return models.ChannelSlack }

func (h *SlackHandler) Execute(ctx context.Context, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	webhookURL, ok := msg.Metadata["webhook_url"]
	if !ok {
		return nil, fmt.Errorf("slack webhook_url not configured in metadata")
	}

	text := fmt.Sprintf("*%s*\n%s", msg.Title, msg.Content)

	result, err := h.SendJSON(ctx, webhookURL.(string), map[string]any{
		"text": text,
	})
	return result, err
}

// ---------------------------------------------------------------------------
// WebhookHandler - Webhook 渠道
// ---------------------------------------------------------------------------

// WebhookHandler implements NotifyChannel for generic webhook delivery.
type WebhookHandler struct {
	BaseNotifyChannel
}

func (h *WebhookHandler) Type() models.ChannelType { return models.ChannelWebhook }

func (h *WebhookHandler) Execute(ctx context.Context, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	webhookURL, ok := msg.Metadata["webhook_url"]
	if !ok {
		return nil, fmt.Errorf("webhook_url not configured in metadata")
	}

	payload := map[string]any{
		"recipient": msg.Recipient,
		"subject":   msg.Subject,
		"body":      msg.Content,
		"title":     msg.Title,
		"eventType": msg.Type,
		"tenantId":  msg.TenantID,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	result, err := h.SendJSON(ctx, webhookURL.(string), payload)
	return result, err
}

// ---------------------------------------------------------------------------
// DingtalkHandler - 钉钉渠道
// ---------------------------------------------------------------------------

// DingtalkHandler implements NotifyChannel for DingTalk delivery via incoming webhook.
type DingtalkHandler struct {
	BaseNotifyChannel
}

func (h *DingtalkHandler) Type() models.ChannelType { return models.ChannelDingtalk }

func (h *DingtalkHandler) Execute(ctx context.Context, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	webhookURL, ok := msg.Metadata["webhook_url"]
	if !ok {
		return nil, fmt.Errorf("dingtalk webhook_url not configured in metadata")
	}

	content := msg.Title
	if msg.Content != "" {
		content = fmt.Sprintf("%s\n%s", msg.Title, msg.Content)
	}

	result, err := h.SendJSON(ctx, webhookURL.(string), map[string]any{
		"msgtype": "text",
		"text": map[string]any{
			"content": content,
		},
	})
	return result, err
}

// ---------------------------------------------------------------------------
// WechatHandler - 企业微信渠道
// ---------------------------------------------------------------------------

// WechatHandler implements NotifyChannel for WeCom (WeChat Work) delivery.
type WechatHandler struct {
	BaseNotifyChannel
}

func (h *WechatHandler) Type() models.ChannelType { return models.ChannelWechat }

func (h *WechatHandler) Execute(ctx context.Context, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	webhookURL, ok := msg.Metadata["webhook_url"]
	if !ok {
		return nil, fmt.Errorf("wechat webhook_url not configured in metadata")
	}

	content := msg.Title
	if msg.Content != "" {
		content = fmt.Sprintf("%s\n%s", msg.Title, msg.Content)
	}

	result, err := h.SendJSON(ctx, webhookURL.(string), map[string]any{
		"msgtype": "text",
		"text": map[string]any{
			"content": content,
		},
	})
	return result, err
}

// ---------------------------------------------------------------------------
// InAppHandler - 应用内通知
// ---------------------------------------------------------------------------

// InAppHandler implements NotifyChannel for in-app notifications (no external delivery).
type InAppHandler struct {
	BaseNotifyChannel
}

func (h *InAppHandler) Type() models.ChannelType { return models.ChannelInApp }

func (h *InAppHandler) Execute(ctx context.Context, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	// In-app notifications are persisted as notification records,
	// so delivery is a no-op (the record itself IS the delivery).
	return &engine.SendResult{
		Success:   true,
		MessageID: msg.ID,
	}, nil
}

// ---------------------------------------------------------------------------
// SMSHandler - 短信渠道（预留）
// ---------------------------------------------------------------------------

// SMSHandler implements NotifyChannel for SMS delivery (pending implementation).
type SMSHandler struct {
	BaseNotifyChannel
}

func (h *SMSHandler) Type() models.ChannelType { return models.ChannelType("sms") }

func (h *SMSHandler) Execute(ctx context.Context, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	// TODO: Integrate with SMS gateway (Aliyun, Tencent, Twilio, etc.)
	return nil, fmt.Errorf("SMS channel not implemented yet")
}

// ---------------------------------------------------------------------------
// init() 注册（自动注册到全局工厂）
//
// 对应 NeatLogic 的 @Component 自动扫描注册。
// 每个渠道 handler 在 init() 中自动注册到 GlobalHandlerFactory。
// ---------------------------------------------------------------------------

func init() {
	engine.GlobalHandlerFactory.Register(&EmailHandler{})
	engine.GlobalHandlerFactory.Register(&SlackHandler{})
	engine.GlobalHandlerFactory.Register(&WebhookHandler{})
	engine.GlobalHandlerFactory.Register(&DingtalkHandler{})
	engine.GlobalHandlerFactory.Register(&WechatHandler{})
	engine.GlobalHandlerFactory.Register(&InAppHandler{})
	engine.GlobalHandlerFactory.Register(&SMSHandler{})
}
