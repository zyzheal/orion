package channels

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"orion/platform-svc-go/internal/notification/models"
	"orion/platform-svc-go/internal/notification/notification-engine"
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

// SendJSON sends a POST request with a JSON body to the given URL.
func (b *BaseNotifyChannel) SendJSON(ctx context.Context, url string, payload map[string]any) (*engine.SendResult, error) {
	return b.SendJSONWithHeaders(ctx, url, payload, nil)
}

// SendJSONWithHeaders behaves like SendJSON but also applies the given extra
// headers (channel credentials, e.g. "Authorization: Bearer ***"). A nil or
// empty map is equivalent to SendJSON.
func (b *BaseNotifyChannel) SendJSONWithHeaders(ctx context.Context, url string, payload map[string]any, headers map[string]string) (*engine.SendResult, error) {
	if !b.healthy {
		return &engine.SendResult{
			Success: false,
			Error:   "channel is unhealthy",
		}, nil
	}

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
	for k, v := range headers {
		if k != "" && v != "" {
			req.Header.Set(k, v)
		}
	}

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

// ---------------------------------------------------------------------------
// EmailHandler - 邮件渠道
// ---------------------------------------------------------------------------

// EmailHandler implements NotifyChannel for email delivery over SMTP.
//
// Relay settings arrive per-message in msg.Metadata, matching how the other
// real channels (Slack, Webhook, DingTalk, WeChat) read their webhook_url.
// Recognised keys: smtp_host (required), smtp_from (required), smtp_port
// (default 587), smtp_user / smtp_pass (optional basic auth), smtp_starttls
// (default true), smtp_insecure_skip_verify (default false).
type EmailHandler struct {
	BaseNotifyChannel
	// dialer overrides the TCP connect used to reach the relay. Nil in
	// production (net.Dialer with a 10s timeout); settable from this package's
	// tests to point at a local SMTP stub.
	dialer func(ctx context.Context, network, addr string) (net.Conn, error)
}

func (h *EmailHandler) Type() models.ChannelType { return models.ChannelEmail }

func (h *EmailHandler) Execute(ctx context.Context, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	host, ok := metaString(msg.Metadata, "smtp_host")
	if !ok {
		return nil, fmt.Errorf("email smtp_host not configured in metadata")
	}
	from, ok := metaString(msg.Metadata, "smtp_from")
	if !ok {
		return nil, fmt.Errorf("email smtp_from not configured in metadata")
	}
	port := metaInt(msg.Metadata, "smtp_port", 587)
	user, _ := metaString(msg.Metadata, "smtp_user")
	pass, _ := metaString(msg.Metadata, "smtp_pass")
	startTLS := metaBool(msg.Metadata, "smtp_starttls", true)
	insecure := metaBool(msg.Metadata, "smtp_insecure_skip_verify", false)

	recipients := recipientsOf(msg)
	if len(recipients) == 0 {
		return nil, fmt.Errorf("email notification has no recipients")
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	dial := h.dialer
	if dial == nil {
		d := &net.Dialer{Timeout: 10 * time.Second}
		dial = d.DialContext
	}

	conn, err := dial(ctx, "tcp", addr)
	if err != nil {
		h.SetHealthy(false)
		return nil, fmt.Errorf("smtp connect to %s failed: %w", addr, err)
	}
	defer conn.Close()

	smtpConn, err := smtp.NewClient(conn, host)
	if err != nil {
		h.SetHealthy(false)
		return nil, fmt.Errorf("smtp hello failed: %w", err)
	}
	defer smtpConn.Close()

	t0 := time.Now()

	if startTLS {
		if err := smtpConn.StartTLS(&tls.Config{
			ServerName:         host,
			InsecureSkipVerify: insecure,
		}); err != nil {
			h.SetHealthy(false)
			return nil, fmt.Errorf("smtp starttls failed: %w", err)
		}
	}
	if user != "" && pass != "" {
		if err := smtpConn.Auth(smtp.PlainAuth("", user, pass, host)); err != nil {
			h.SetHealthy(false)
			return nil, fmt.Errorf("smtp auth failed: %w", err)
		}
	}
	if err := smtpConn.Mail(from); err != nil {
		h.SetHealthy(false)
		return nil, fmt.Errorf("smtp mail from failed: %w", err)
	}
	for _, to := range recipients {
		if err := smtpConn.Rcpt(to); err != nil {
			h.SetHealthy(false)
			return nil, fmt.Errorf("smtp rcpt for %s failed: %w", to, err)
		}
	}
	w, err := smtpConn.Data()
	if err != nil {
		h.SetHealthy(false)
		return nil, fmt.Errorf("smtp data failed: %w", err)
	}
	if _, err := io.WriteString(w, buildEmailMessage(msg, from, recipients)); err != nil {
		_ = w.Close()
		h.SetHealthy(false)
		return nil, fmt.Errorf("smtp write message failed: %w", err)
	}
	if err := w.Close(); err != nil {
		h.SetHealthy(false)
		return nil, fmt.Errorf("smtp data terminated: %w", err)
	}
	if err := smtpConn.Quit(); err != nil {
		h.SetHealthy(false)
		return nil, fmt.Errorf("smtp quit failed: %w", err)
	}

	h.SetHealthy(true)
	return &engine.SendResult{
		Success:    true,
		MessageID:  fmt.Sprintf("email-%d", time.Now().UnixNano()),
		DurationMS: time.Since(t0).Milliseconds(),
	}, nil
}

// buildEmailMessage renders a plain-text RFC 5322 message. net/smtp's Data
// reader receives only the message body, so headers are emitted here.
func buildEmailMessage(msg *engine.NotifyMessage, from string, recipients []string) string {
	subject := msg.Subject
	if subject == "" {
		subject = msg.Title
	}
	var b strings.Builder
	fmt.Fprintf(&b, "From: %s\r\n", from)
	fmt.Fprintf(&b, "To: %s\r\n", strings.Join(recipients, ", "))
	if len(msg.CC) > 0 {
		fmt.Fprintf(&b, "Cc: %s\r\n", strings.Join(msg.CC, ", "))
	}
	if msg.Metadata != nil {
		if listID, ok := metaString(msg.Metadata, "message_id"); ok {
			fmt.Fprintf(&b, "Message-ID: <%s>\r\n", listID)
		}
	}
	b.WriteString("Subject: " + subject + "\r\n")
	b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("\r\n")
	b.WriteString(msg.Content)
	return b.String()
}

// recipientsOf merges the primary recipient, CC and BCC lists into a single
// de-duplicated delivery list.
func recipientsOf(msg *engine.NotifyMessage) []string {
	var raw []string
	if msg.Recipient != "" {
		raw = append(raw, msg.Recipient)
	}
	raw = append(raw, msg.CC...)
	raw = append(raw, msg.BCC...)

	seen := make(map[string]struct{})
	out := make([]string, 0, len(raw))
	for _, r := range raw {
		r = strings.TrimSpace(r)
		if r == "" {
			continue
		}
		if _, dup := seen[r]; dup {
			continue
		}
		seen[r] = struct{}{}
		out = append(out, r)
	}
	return out
}

// metaString reads a trimmed string value from a JSONB metadata map, tolerating
// nil maps and non-string values (a wrong-typed key is reported as absent
// rather than panicking, unlike the direct .(string) asserts in the older
// webhook channels).
func metaString(m models.JSONB, key string) (string, bool) {
	v, ok := m[key]
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	s = strings.TrimSpace(s)
	return s, ok && s != ""
}

// metaInt reads an integer metadata value, accepting ints and numeric strings,
// and falling back to def when the key is absent or malformed.
func metaInt(m models.JSONB, key string, def int) int {
	switch v := m[key].(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case string:
		var n int
		if _, err := fmt.Sscanf(strings.TrimSpace(v), "%d", &n); err == nil {
			return n
		}
	}
	return def
}

// metaBool reads a boolean metadata value, accepting bools and the string
// spellings "true"/"false"/"1"/"0", and falling back to def otherwise.
func metaBool(m models.JSONB, key string, def bool) bool {
	switch v := m[key].(type) {
	case bool:
		return v
	case string:
		switch strings.ToLower(strings.TrimSpace(v)) {
		case "true", "1":
			return true
		case "false", "0":
			return false
		}
	}
	return def
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

// SMSHandler implements NotifyChannel for SMS delivery via an HTTP SMS gateway.
//
// Gateway settings arrive per-message in msg.Metadata, matching the other real
// channels' webhook_url convention. Recognised keys: sms_gateway_url (required),
// sms_api_key (optional, sent as "Authorization: Bearer ***"), sms_sign_name
// (optional signature prefix), sms_phones (optional []string; falls back to
// msg.Recipient, split on comma or semicolon).
type SMSHandler struct {
	BaseNotifyChannel
}

func (h *SMSHandler) Type() models.ChannelType { return models.ChannelType("sms") }

func (h *SMSHandler) Execute(ctx context.Context, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	gatewayURL, ok := metaString(msg.Metadata, "sms_gateway_url")
	if !ok {
		return nil, fmt.Errorf("sms_gateway_url not configured in metadata")
	}

	phones := phonesOf(msg)
	if len(phones) == 0 {
		return nil, fmt.Errorf("sms notification has no phone numbers")
	}

	text := msg.Content
	if msg.Title != "" && msg.Content != "" {
		text = fmt.Sprintf("%s: %s", msg.Title, msg.Content)
	} else if msg.Content == "" {
		text = msg.Title
	}

	payload := map[string]any{
		"phones":         phones,
		"message":        text,
		"notificationId": msg.ID,
		"tenantId":       msg.TenantID,
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
	}
	if sign, ok := metaString(msg.Metadata, "sms_sign_name"); ok {
		payload["signature"] = sign
	}

	headers := map[string]string{}
	if key, ok := metaString(msg.Metadata, "sms_api_key"); ok {
		headers["Authorization"] = "Bearer " + key
	}

	return h.SendJSONWithHeaders(ctx, gatewayURL, payload, headers)
}

// phonesOf collects the target phone numbers, preferring the explicit
// sms_phones metadata list and falling back to msg.Recipient.
func phonesOf(msg *engine.NotifyMessage) []string {
	var phones []string
	if v, ok := msg.Metadata["sms_phones"]; ok {
		switch list := v.(type) {
		case []string:
			phones = append(phones, list...)
		case []any:
			for _, item := range list {
				if s, ok := item.(string); ok {
					phones = append(phones, s)
				}
			}
		case string:
			phones = append(phones, list)
		}
	}
	if len(phones) == 0 {
		phones = []string{msg.Recipient}
	}

	// A single Recipient field may hold several numbers separated by commas,
	// semicolons or whitespace, so each raw chunk is split before dedup.
	seen := make(map[string]struct{})
	var out []string
	for _, chunk := range phones {
		for _, p := range strings.FieldsFunc(chunk, func(r rune) bool {
			return r == ',' || r == ';' || r == ' ' || r == '\t' || r == '\n'
		}) {
			if p == "" {
				continue
			}
			if _, dup := seen[p]; dup {
				continue
			}
			seen[p] = struct{}{}
			out = append(out, p)
		}
	}
	return out
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
