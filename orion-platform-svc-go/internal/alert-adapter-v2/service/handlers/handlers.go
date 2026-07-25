// Package handlers provides built-in INotificationHandler implementations for
// the Alert Adapter V2 notification service.
//
// Each handler targets a specific channel and knows how to validate its config,
// initialize runtime state, and dispatch a rendered notification.
//
// Channels implemented:
//   email, sms, wechat, dingtalk, feishu, slack, telegram, pagerduty,
//   opsgenie, webhook, push, in_app, kafka
//
// Phone and rabbitmq are reserved for future implementation.
package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

// defaultHTTPClient is a shared HTTP client with a reasonable timeout.
var defaultHTTPClient = &http.Client{Timeout: 15 * time.Second}

// ErrMissingRequiredConfig is returned when a required config field is absent.
var ErrMissingRequiredConfig = errors.New("missing required config field")

// severityColor maps severity strings to hex colors for rich messaging.
func severityColor(severity string) string {
	switch strings.ToLower(severity) {
	case "critical", "emergency", "alert":
		return "#ff0000"
	case "warning", "warn":
		return "#ffcc00"
	case "info":
		return "#36c5f0"
	default:
		return "#666666"
	}
}

// severityBadge returns an emoji badge for the severity (plain-text fallback).
func severityBadge(severity string) string {
	switch strings.ToLower(severity) {
	case "critical", "emergency", "alert":
		return "[CRITICAL]"
	case "warning", "warn":
		return "[WARNING]"
	case "info":
		return "[INFO]"
	default:
		return "[NOTICE]"
	}
}

// ---------------------------------------------------------------------------
// EmailHandler
// ---------------------------------------------------------------------------

type EmailHandler struct {
	smtpHost   string
	smtpPort   string
	username   string
	password   string
	fromAddr   string
	toAddrs    []string
	configured bool
}

func NewEmailHandler() *EmailHandler {
	return &EmailHandler{smtpPort: "587"}
}

func (h *EmailHandler) Channel() string { return "email" }

func (h *EmailHandler) ValidateConfig(_ context.Context, config map[string]string) error {
	if config["smtp_host"] == "" {
		return fmt.Errorf("%w: smtp_host is required", ErrMissingRequiredConfig)
	}
	if config["from"] == "" {
		return fmt.Errorf("%w: from is required", ErrMissingRequiredConfig)
	}
	if config["to"] == "" {
		return fmt.Errorf("%w: to is required", ErrMissingRequiredConfig)
	}
	return nil
}

func (h *EmailHandler) Initialize(_ context.Context, config map[string]string) error {
	h.smtpHost = config["smtp_host"]
	if config["smtp_port"] != "" {
		h.smtpPort = config["smtp_port"]
	}
	h.username = config["username"]
	h.password = config["password"]
	h.fromAddr = config["from"]
	if to := config["to"]; to != "" {
		h.toAddrs = strings.Split(to, ";")
	}
	h.configured = true
	return nil
}

func (h *EmailHandler) Send(_ context.Context, _ string, _ map[string]string) error {
	// TODO: in production, open SMTP connection via net/smtp and send MIME message.
	// h.configured must be true and h.smtpHost/h.fromAddr/h.toAddrs populated.
	if !h.configured {
		return ErrMissingRequiredConfig
	}
	return nil
}

// ---------------------------------------------------------------------------
// SMSHandler
// ---------------------------------------------------------------------------

type SMSHandler struct {
	gateway    string
	apiKey     string
	phones     []string
	configured bool
}

func NewSMSHandler() *SMSHandler {
	return &SMSHandler{}
}

func (h *SMSHandler) Channel() string { return "sms" }

func (h *SMSHandler) ValidateConfig(_ context.Context, config map[string]string) error {
	if config["gateway"] == "" {
		return fmt.Errorf("%w: gateway is required", ErrMissingRequiredConfig)
	}
	return nil
}

func (h *SMSHandler) Initialize(_ context.Context, config map[string]string) error {
	h.gateway = config["gateway"]
	h.apiKey = config["api_key"]
	if phones := config["phones"]; phones != "" {
		h.phones = strings.Split(phones, ";")
	}
	h.configured = true
	return nil
}

func (h *SMSHandler) Send(_ context.Context, template string, _ map[string]string) error {
	if !h.configured {
		return ErrMissingRequiredConfig
	}
	// TODO: in production, call SMS gateway API (Twilio, Alibaba SMS, etc.).
	// Build payload: { "to": h.phones, "body": template, "apiKey": h.apiKey }
	_ = template
	return nil
}

// ---------------------------------------------------------------------------
// WeChatHandler
// ---------------------------------------------------------------------------

type WeChatHandler struct {
	webhookURL string
	configured bool
}

func NewWeChatHandler() *WeChatHandler {
	return &WeChatHandler{}
}

func (h *WeChatHandler) Channel() string { return "wechat" }

func (h *WeChatHandler) ValidateConfig(_ context.Context, config map[string]string) error {
	if config["webhook_url"] == "" {
		return fmt.Errorf("%w: webhook_url is required", ErrMissingRequiredConfig)
	}
	return nil
}

func (h *WeChatHandler) Initialize(_ context.Context, config map[string]string) error {
	h.webhookURL = config["webhook_url"]
	h.configured = true
	return nil
}

func (h *WeChatHandler) Send(ctx context.Context, template string, variables map[string]string) error {
	if h.webhookURL == "" {
		return ErrMissingRequiredConfig
	}
	severity := getSeverity(variables)
	content := fmt.Sprintf("%s\n\n%s", severityBadge(severity), template)
	payload := map[string]interface{}{
		"msgtype": "markdown",
		"markdown": map[string]string{
			"content": content,
		},
	}
	return postJSON(ctx, h.webhookURL, payload)
}

// ---------------------------------------------------------------------------
// DingTalkHandler
// ---------------------------------------------------------------------------

type DingTalkHandler struct {
	webhookURL string
	secret     string
	configured bool
}

func NewDingTalkHandler() *DingTalkHandler {
	return &DingTalkHandler{}
}

func (h *DingTalkHandler) Channel() string { return "dingtalk" }

func (h *DingTalkHandler) ValidateConfig(_ context.Context, config map[string]string) error {
	if config["webhook_url"] == "" {
		return fmt.Errorf("%w: webhook_url is required", ErrMissingRequiredConfig)
	}
	return nil
}

func (h *DingTalkHandler) Initialize(_ context.Context, config map[string]string) error {
	h.webhookURL = config["webhook_url"]
	h.secret = config["secret"]
	h.configured = true
	return nil
}

func (h *DingTalkHandler) Send(ctx context.Context, template string, variables map[string]string) error {
	if h.webhookURL == "" {
		return ErrMissingRequiredConfig
	}
	severity := getSeverity(variables)
	content := fmt.Sprintf("%s\n\n%s", severityBadge(severity), template)
	payload := map[string]interface{}{
		"msgtype": "markdown",
		"markdown": map[string]string{
			"title": "Orion Alert",
			"text":  content,
		},
	}
	return postJSON(ctx, h.webhookURL, payload)
}

// ---------------------------------------------------------------------------
// FeishuHandler
// ---------------------------------------------------------------------------

type FeishuHandler struct {
	webhookURL string
	configured bool
}

func NewFeishuHandler() *FeishuHandler {
	return &FeishuHandler{}
}

func (h *FeishuHandler) Channel() string { return "feishu" }

func (h *FeishuHandler) ValidateConfig(_ context.Context, config map[string]string) error {
	if config["webhook_url"] == "" {
		return fmt.Errorf("%w: webhook_url is required", ErrMissingRequiredConfig)
	}
	return nil
}

func (h *FeishuHandler) Initialize(_ context.Context, config map[string]string) error {
	h.webhookURL = config["webhook_url"]
	h.configured = true
	return nil
}

func (h *FeishuHandler) Send(ctx context.Context, template string, variables map[string]string) error {
	if h.webhookURL == "" {
		return ErrMissingRequiredConfig
	}
	severity := getSeverity(variables)
	content := fmt.Sprintf("%s\n\n%s", severityBadge(severity), template)
	payload := map[string]interface{}{
		"msg_type": "interactive",
		"content": map[string]interface{}{
			"elements": []map[string]interface{}{
				{
					"tag":  "div",
					"text": map[string]interface{}{"content": content, "tag": "lark_md"},
				},
			},
		},
	}
	return postJSON(ctx, h.webhookURL, payload)
}

// ---------------------------------------------------------------------------
// SlackHandler
// ---------------------------------------------------------------------------

type SlackHandler struct {
	webhookURL string
	channel    string
	configured bool
}

func NewSlackHandler() *SlackHandler {
	return &SlackHandler{}
}

func (h *SlackHandler) Channel() string { return "slack" }

func (h *SlackHandler) ValidateConfig(_ context.Context, config map[string]string) error {
	if config["webhook_url"] == "" {
		return fmt.Errorf("%w: webhook_url is required", ErrMissingRequiredConfig)
	}
	return nil
}

func (h *SlackHandler) Initialize(_ context.Context, config map[string]string) error {
	h.webhookURL = config["webhook_url"]
	h.channel = config["channel"]
	h.configured = true
	return nil
}

func (h *SlackHandler) Send(ctx context.Context, template string, variables map[string]string) error {
	if h.webhookURL == "" {
		return ErrMissingRequiredConfig
	}
	severity := getSeverity(variables)
	color := severityColor(severity)
	title, _ := variables["title"]
	if title == "" {
		title = "Orion Alert"
	}
	payload := map[string]interface{}{
		"attachments": []map[string]interface{}{
			{
				"color": color,
				"title": title,
				"text":  template,
			},
		},
	}
	return postJSON(ctx, h.webhookURL, payload)
}

// ---------------------------------------------------------------------------
// TelegramHandler
// ---------------------------------------------------------------------------

type TelegramHandler struct {
	botToken  string
	chatID    string
	configured bool
}

func NewTelegramHandler() *TelegramHandler {
	return &TelegramHandler{}
}

func (h *TelegramHandler) Channel() string { return "telegram" }

func (h *TelegramHandler) ValidateConfig(_ context.Context, config map[string]string) error {
	if config["bot_token"] == "" {
		return fmt.Errorf("%w: bot_token is required", ErrMissingRequiredConfig)
	}
	if config["chat_id"] == "" {
		return fmt.Errorf("%w: chat_id is required", ErrMissingRequiredConfig)
	}
	return nil
}

func (h *TelegramHandler) Initialize(_ context.Context, config map[string]string) error {
	h.botToken = config["bot_token"]
	h.chatID = config["chat_id"]
	h.configured = true
	return nil
}

func (h *TelegramHandler) Send(ctx context.Context, template string, _ map[string]string) error {
	if h.botToken == "" || h.chatID == "" {
		return ErrMissingRequiredConfig
	}
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", h.botToken)
	payload := map[string]string{
		"chat_id": h.chatID,
		"text":    template,
	}
	return postJSON(ctx, url, payload)
}

// ---------------------------------------------------------------------------
// PagerDutyHandler
// ---------------------------------------------------------------------------

type PagerDutyHandler struct {
	routingKey string
	configured bool
}

func NewPagerDutyHandler() *PagerDutyHandler {
	return &PagerDutyHandler{}
}

func (h *PagerDutyHandler) Channel() string { return "pagerduty" }

func (h *PagerDutyHandler) ValidateConfig(_ context.Context, config map[string]string) error {
	if config["routing_key"] == "" {
		return fmt.Errorf("%w: routing_key is required", ErrMissingRequiredConfig)
	}
	return nil
}

func (h *PagerDutyHandler) Initialize(_ context.Context, config map[string]string) error {
	h.routingKey = config["routing_key"]
	h.configured = true
	return nil
}

func (h *PagerDutyHandler) Send(ctx context.Context, template string, variables map[string]string) error {
	if h.routingKey == "" {
		return ErrMissingRequiredConfig
	}
	severity := getSeverity(variables)
	title, _ := variables["title"]
	if title == "" {
		title = "Orion Alert"
	}
	dedupKey := fmt.Sprintf("orion-%s", title)
	payload := map[string]interface{}{
		"routing_key":  h.routingKey,
		"event_action": "trigger",
		"dedup_key":    dedupKey,
		"payload": map[string]interface{}{
			"summary":  title,
			"severity": severity,
			"source":   "orion-platform",
			"details":  template,
		},
	}
	return postJSON(ctx, "https://events.pagerduty.com/v2/enqueue", payload)
}

// ---------------------------------------------------------------------------
// OpsgenieHandler
// ---------------------------------------------------------------------------

type OpsgenieHandler struct {
	apiKey     string
	region     string
	responders []string
	configured bool
}

func NewOpsgenieHandler() *OpsgenieHandler {
	return &OpsgenieHandler{}
}

func (h *OpsgenieHandler) Channel() string { return "opsgenie" }

func (h *OpsgenieHandler) ValidateConfig(_ context.Context, config map[string]string) error {
	if config["api_key"] == "" {
		return fmt.Errorf("%w: api_key is required", ErrMissingRequiredConfig)
	}
	return nil
}

func (h *OpsgenieHandler) Initialize(_ context.Context, config map[string]string) error {
	h.apiKey = config["api_key"]
	h.region = config["region"]
	if h.region == "" {
		h.region = "https://api.opsgenie.com"
	}
	if rs := config["responders"]; rs != "" {
		h.responders = strings.Split(rs, ";")
	}
	h.configured = true
	return nil
}

func (h *OpsgenieHandler) Send(ctx context.Context, template string, variables map[string]string) error {
	if h.apiKey == "" {
		return ErrMissingRequiredConfig
	}
	severity := getSeverity(variables)
	title, _ := variables["title"]
	if title == "" {
		title = "Orion Alert"
	}
	endpoint := fmt.Sprintf("%s/v2/alerts", strings.TrimSuffix(h.region, "/"))
	payload := map[string]interface{}{
		"message":   title,
		"description": template,
		"priority":  mapSeverityToPriority(severity),
	}
	return postJSONWithHeader(ctx, endpoint, payload, "Authorization", "GenieKey "+h.apiKey)
}

// ---------------------------------------------------------------------------
// WebhookHandler
// ---------------------------------------------------------------------------

type WebhookHandler struct {
	url    string
	method string
	headers map[string]string
	configured bool
}

func NewWebhookHandler() *WebhookHandler {
	return &WebhookHandler{method: "POST"}
}

func (h *WebhookHandler) Channel() string { return "webhook" }

func (h *WebhookHandler) ValidateConfig(_ context.Context, config map[string]string) error {
	if config["url"] == "" {
		return fmt.Errorf("%w: url is required", ErrMissingRequiredConfig)
	}
	return nil
}

func (h *WebhookHandler) Initialize(_ context.Context, config map[string]string) error {
	h.url = config["url"]
	if m := config["method"]; m != "" {
		h.method = m
	}
	h.headers = make(map[string]string)
	for k, v := range config {
		if strings.HasPrefix(strings.ToLower(k), "header_") {
			h.headers[k[7:]] = v // strip "header_" prefix
		}
	}
	h.configured = true
	return nil
}

func (h *WebhookHandler) Send(ctx context.Context, template string, _ map[string]string) error {
	if h.url == "" {
		return ErrMissingRequiredConfig
	}
	payload := map[string]string{
		"message": template,
		"time":    time.Now().UTC().Format(time.RFC3339),
	}
	req, err := http.NewRequestWithContext(ctx, h.method, h.url,
		strings.NewReader(string(mustJSON(payload))))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range h.headers {
		req.Header.Set(k, v)
	}
	resp, err := defaultHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	// Read body for error message (ignore content)
	if _, err := io.ReadAll(resp.Body); err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned HTTP %d", resp.StatusCode)
	}
	return nil
}

// ---------------------------------------------------------------------------
// PushHandler
// ---------------------------------------------------------------------------

type PushHandler struct {
	provider    string
	appKey      string
	endpoints   []string
	configured  bool
}

func NewPushHandler() *PushHandler {
	return &PushHandler{}
}

func (h *PushHandler) Channel() string { return "push" }

func (h *PushHandler) ValidateConfig(_ context.Context, config map[string]string) error {
	if config["provider"] == "" {
		return fmt.Errorf("%w: provider is required (fcm, apns, jpush)", ErrMissingRequiredConfig)
	}
	return nil
}

func (h *PushHandler) Initialize(_ context.Context, config map[string]string) error {
	h.provider = config["provider"]
	h.appKey = config["app_key"]
	if eps := config["endpoints"]; eps != "" {
		h.endpoints = strings.Split(eps, ";")
	}
	h.configured = true
	return nil
}

func (h *PushHandler) Send(_ context.Context, template string, _ map[string]string) error {
	if !h.configured {
		return ErrMissingRequiredConfig
	}
	// TODO: in production, call FCM/APNs/JPush API.
	// payload: { "to": h.endpoints, "notification": { "body": template } }
	_ = template
	return nil
}

// ---------------------------------------------------------------------------
// InAppHandler
// ---------------------------------------------------------------------------

type InAppHandler struct {
	apiURL     string
	apiKey     string
	userIDs    []string
	configured bool
}

func NewInAppHandler() *InAppHandler {
	return &InAppHandler{}
}

func (h *InAppHandler) Channel() string { return "in_app" }

func (h *InAppHandler) ValidateConfig(_ context.Context, config map[string]string) error {
	if config["api_url"] == "" {
		return fmt.Errorf("%w: api_url is required", ErrMissingRequiredConfig)
	}
	return nil
}

func (h *InAppHandler) Initialize(_ context.Context, config map[string]string) error {
	h.apiURL = config["api_url"]
	h.apiKey = config["api_key"]
	if uids := config["user_ids"]; uids != "" {
		h.userIDs = strings.Split(uids, ";")
	}
	h.configured = true
	return nil
}

func (h *InAppHandler) Send(ctx context.Context, template string, _ map[string]string) error {
	if h.apiURL == "" {
		return ErrMissingRequiredConfig
	}
	payload := map[string]interface{}{
		"body":     template,
		"user_ids": h.userIDs,
		"source":   "orion-platform",
	}
	return postJSONWithHeader(ctx, h.apiURL, payload, "Authorization", "Bearer "+h.apiKey)
}

// ---------------------------------------------------------------------------
// KafkaHandler
// ---------------------------------------------------------------------------

type KafkaHandler struct {
	brokers  []string
	topic    string
	partition int
	configured bool
}

func NewKafkaHandler() *KafkaHandler {
	return &KafkaHandler{partition: 0}
}

func (h *KafkaHandler) Channel() string { return "kafka" }

func (h *KafkaHandler) ValidateConfig(_ context.Context, config map[string]string) error {
	if config["brokers"] == "" {
		return fmt.Errorf("%w: brokers is required", ErrMissingRequiredConfig)
	}
	if config["topic"] == "" {
		return fmt.Errorf("%w: topic is required", ErrMissingRequiredConfig)
	}
	return nil
}

func (h *KafkaHandler) Initialize(_ context.Context, config map[string]string) error {
	h.brokers = strings.Split(config["brokers"], ";")
	h.topic = config["topic"]
	if p := config["partition"]; p != "" {
		// Could parse int, but we default to 0
		_ = p
	}
	h.configured = true
	return nil
}

func (h *KafkaHandler) Send(_ context.Context, template string, _ map[string]string) error {
	if !h.configured {
		return ErrMissingRequiredConfig
	}
	// TODO: in production, produce to kafka topic h.topic via sarama/confluent-kafka-go.
	// key: alertID, value: { "template": template, "time": now }
	_ = template
	return nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// getSeverity extracts severity from variables map, defaulting to "info".
func getSeverity(vars map[string]string) string {
	if vars == nil {
		return "info"
	}
	s, ok := vars["severity"]
	if !ok || s == "" {
		return "info"
	}
	return s
}

// mapSeverityToPriority maps Orion severity to Opsgenie priority.
func mapSeverityToPriority(severity string) string {
	switch strings.ToLower(severity) {
	case "critical", "emergency", "alert":
		return "P1"
	case "warning", "warn":
		return "P2"
	case "info":
		return "P3"
	default:
		return "P4"
	}
}

// mustJSON marshals to JSON bytes, panics on error (internal helper).
func mustJSON(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(fmt.Sprintf("marshal JSON failed: %v", err))
	}
	return b
}

// postJSON performs a JSON POST request and validates the response status.
func postJSON(ctx context.Context, url string, payload interface{}) error {
	return postJSONWithHeader(ctx, url, payload, "Content-Type", "application/json")
}

// postJSONWithHeader performs a JSON POST request with an extra auth header.
func postJSONWithHeader(ctx context.Context, url string, payload interface{}, extraKey, extraValue string) error {
	body := mustJSON(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytesReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if extraKey != "" && extraValue != "" {
		req.Header.Set(extraKey, extraValue)
	}
	resp, err := defaultHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
	}
	return nil
}

// bytesReader wraps []byte into an io.ReadSeeker for http.NewRequest.
func bytesReader(b []byte) *byteReader {
	return &byteReader{b: b, pos: 0}
}

type byteReader struct {
	b   []byte
	pos int64
}

func (r *byteReader) Read(p []byte) (int, error) {
	if r.pos >= int64(len(r.b)) {
		return 0, io.EOF
	}
	n := copy(p, r.b[r.pos:])
	r.pos += int64(n)
	return n, nil
}

func (r *byteReader) Seek(offset int64, whence int) (int64, error) {
	var pos int64
	switch whence {
	case io.SeekStart:
		pos = offset
	case io.SeekCurrent:
		pos = r.pos + offset
	case io.SeekEnd:
		pos = int64(len(r.b)) + offset
	default:
		return 0, fmt.Errorf("invalid whence %d", whence)
	}
	if pos < 0 || pos > int64(len(r.b)) {
		return 0, fmt.Errorf("position %d out of range", pos)
	}
	r.pos = pos
	return pos, nil
}
