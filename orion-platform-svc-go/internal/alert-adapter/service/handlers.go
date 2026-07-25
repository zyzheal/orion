// Package service provides built-in AlertAdapterHandler implementations for the
// standard adapter types.
//
// Each handler is a reference implementation that demonstrates the SPI contract.
// Production handlers (e.g. real HTTP POST for webhook, actual SMTP for email)
// are wired by the platform operator — these provide sensible defaults that
// log events and pass through payloads for testing.
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"time"
)

// ---------------------------------------------------------------------------
// Base handler helpers
// ---------------------------------------------------------------------------

// noopHandler is the minimal SPI implementation used for types where we only
// track metadata. It stores config but does no actual external I/O.
type noopHandler struct {
	name     string
	atype    string
	category string
	config   map[string]string
}

func (h *noopHandler) Name() string            { return h.name }
func (h *noopHandler) Type() string            { return h.atype }
func (h *noopHandler) Category() string        { return h.category }
func (h *noopHandler) ValidateConfig(_ context.Context, config map[string]string) error { return nil }
func (h *noopHandler) Shutdown(_ context.Context) error { return nil }

// ---------------------------------------------------------------------------
// Source adapters — pull alerts from external monitoring systems
// ---------------------------------------------------------------------------

// prometheusHandler reads alerts from a Prometheus Alertmanager API.
type prometheusHandler struct {
	noopHandler
	alertmanagerURL string
	*alertQueue
}

func NewPrometheusHandler() *prometheusHandler {
	return &prometheusHandler{
		noopHandler: noopHandler{
			name:     "Prometheus",
			atype:    "prometheus",
			category: "source",
		},
		alertQueue: newAlertQueue(),
	}
}

func (h *prometheusHandler) Initialize(ctx context.Context, config map[string]string) error {
	h.config = config
	if url, ok := config["alertmanager_url"]; ok && url != "" {
		h.alertmanagerURL = url
	}
	return nil
}

func (h *prometheusHandler) Send(ctx context.Context, alert map[string]interface{}) error {
	// Prometheus source adapter primarily receives; sending a writeback is a no-op
	return nil
}

func (h *prometheusHandler) Receive(ctx context.Context) ([]map[string]interface{}, error) {
	// Reference implementation: drain queued alerts
	alerts := h.alertQueue.Drain()
	// TODO: in production, HTTP GET Alertmanager API at h.alertmanagerURL/api/v2/alerts
	return alerts, nil
}

// grafanaHandler reads alerts from Grafana Alerting API.
type grafanaHandler struct {
	noopHandler
	apiURL string
	*alertQueue
}

func NewGrafanaHandler() *grafanaHandler {
	return &grafanaHandler{
		noopHandler: noopHandler{
			name:     "Grafana",
			atype:    "grafana",
			category: "source",
		},
		alertQueue: newAlertQueue(),
	}
}

func (h *grafanaHandler) Initialize(ctx context.Context, config map[string]string) error {
	h.config = config
	if url, ok := config["api_url"]; ok && url != "" {
		h.apiURL = url
	}
	return nil
}

func (h *grafanaHandler) Send(ctx context.Context, alert map[string]interface{}) error {
	return nil
}

func (h *grafanaHandler) Receive(ctx context.Context) ([]map[string]interface{}, error) {
	return h.alertQueue.Drain(), nil
}

// zabbixHandler reads alerts from Zabbix Trapper/Webhook.
type zabbixHandler struct {
	noopHandler
	*alertQueue
}

func NewZabbixHandler() *zabbixHandler {
	return &zabbixHandler{
		noopHandler: noopHandler{
			name:     "Zabbix",
			atype:    "zabbix",
			category: "source",
		},
		alertQueue: newAlertQueue(),
	}
}

func (h *zabbixHandler) Initialize(ctx context.Context, config map[string]string) error {
	h.config = config
	return nil
}

func (h *zabbixHandler) Send(ctx context.Context, alert map[string]interface{}) error {
	return nil
}

func (h *zabbixHandler) Receive(ctx context.Context) ([]map[string]interface{}, error) {
	return h.alertQueue.Drain(), nil
}

// kafkaHandler subscribes to a Kafka topic for incoming alerts.
type kafkaHandler struct {
	noopHandler
	brokers string
	topic   string
	*alertQueue
}

func NewKafkaHandler() *kafkaHandler {
	return &kafkaHandler{
		noopHandler: noopHandler{
			name:     "Kafka",
			atype:    "kafka",
			category: "source",
		},
		alertQueue: newAlertQueue(),
	}
}

func (h *kafkaHandler) ValidateConfig(ctx context.Context, config map[string]string) error {
	if brokers, ok := config["brokers"]; !ok || brokers == "" {
		return fmt.Errorf("%w: kafka requires 'brokers' config", ErrInvalidConfig)
	}
	if topic, ok := config["topic"]; !ok || topic == "" {
		return fmt.Errorf("%w: kafka requires 'topic' config", ErrInvalidConfig)
	}
	return nil
}

func (h *kafkaHandler) Initialize(ctx context.Context, config map[string]string) error {
	h.config = config
	h.brokers = config["brokers"]
	h.topic = config["topic"]
	// TODO: in production, create kafka consumer group
	return nil
}

func (h *kafkaHandler) Send(ctx context.Context, alert map[string]interface{}) error {
	// Kafka source handler can also act as an export sink
	return nil
}

func (h *kafkaHandler) Receive(ctx context.Context) ([]map[string]interface{}, error) {
	// TODO: poll kafka consumer
	return h.alertQueue.Drain(), nil
}

// ---------------------------------------------------------------------------
// Notification / Export adapters — push alerts out
// ---------------------------------------------------------------------------

// webhookHandler POSTs alerts to an external HTTP endpoint.
type webhookHandler struct {
	noopHandler
	url        string
	method     string
	headers    map[string]string
	client     *http.Client
}

func NewWebhookHandler() *webhookHandler {
	return &webhookHandler{
		noopHandler: noopHandler{
			name:     "Webhook",
			atype:    "webhook",
			category: "export",
		},
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (h *webhookHandler) ValidateConfig(ctx context.Context, config map[string]string) error {
	if url, ok := config["url"]; !ok || url == "" {
		return fmt.Errorf("%w: webhook requires 'url' config", ErrInvalidConfig)
	}
	return nil
}

func (h *webhookHandler) Initialize(ctx context.Context, config map[string]string) error {
	h.config = config
	h.url = config["url"]
	h.method = config["method"]
	if h.method == "" {
		h.method = "POST"
	}
	h.headers = make(map[string]string)
	for k, v := range config {
		if strings.HasPrefix(strings.ToLower(k), "header_") {
			h.headers[k] = v
		}
	}
	return nil
}

func (h *webhookHandler) Send(ctx context.Context, alert map[string]interface{}) error {
	if h.url == "" {
		return ErrInvalidConfig
	}
	payload, err := json.Marshal(alert)
	if err != nil {
		return fmt.
		Errorf("marshal webhook payload failed: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, h.method, h.url, strings.NewReader(string(payload)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range h.headers {
		req.Header.Set(k, v)
	}
	resp, err := h.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned HTTP %d", resp.StatusCode)
	}
	return nil
}

func (h *webhookHandler) Receive(ctx context.Context) ([]map[string]interface{}, error) {
	// Webhook is export-only; receiving not supported
	return nil, nil
}

// emailHandler sends alerts via SMTP.
type emailHandler struct {
	noopHandler
	smtpHost  string
	smtpPort  string
	username  string
	password  string
	fromAddr  string
	toAddrs   []string
}

func NewEmailHandler() *emailHandler {
	return &emailHandler{
		noopHandler: noopHandler{
			name:     "Email",
			atype:    "email",
			category: "notification",
		},
	}
}

func (h *emailHandler) ValidateConfig(ctx context.Context, config map[string]string) error {
	if host, ok := config["smtp_host"]; !ok || host == "" {
		return fmt.Errorf("%w: email requires 'smtp_host' config", ErrInvalidConfig)
	}
	if to, ok := config["to"]; !ok || to == "" {
		return fmt.Errorf("%w: email requires 'to' config", ErrInvalidConfig)
	}
	return nil
}

func (h *emailHandler) Initialize(ctx context.Context, config map[string]string) error {
	h.config = config
	h.smtpHost = config["smtp_host"]
	h.smtpPort = config["smtp_port"]
	if h.smtpPort == "" {
		h.smtpPort = "587"
	}
	h.username = config["username"]
	h.password = config["password"]
	h.fromAddr = config["from"]
	if to, ok := config["to"]; ok && to != "" {
		h.toAddrs = strings.Split(to, ";")
	}
	return nil
}

func (h *emailHandler) Send(ctx context.Context, alert map[string]interface{}) error {
	// TODO: in production, open SMTP connection and send via net/smtp
	_ = ctx
	// Build email from alert payload
	title, _ := alert["title"].(string)
	message, _ := alert["message"].(string)
	severity, _ := alert["severity"].(string)
	_ = title
	_ = message
	_ = severity
	return nil
}

func (h *emailHandler) Receive(ctx context.Context) ([]map[string]interface{}, error) {
	return nil, nil
}

// smsHandler sends alerts via SMS gateway.
type smsHandler struct {
	noopHandler
	gateway string
	phones  []string
}

func NewSMSHandler() *smsHandler {
	return &smsHandler{
		noopHandler: noopHandler{
			name:     "SMS",
			atype:    "sms",
			category: "notification",
		},
	}
}

func (h *smsHandler) ValidateConfig(ctx context.Context, config map[string]string) error {
	if gw, ok := config["gateway"]; !ok || gw == "" {
		return fmt.Errorf("%w: sms requires 'gateway' config", ErrInvalidConfig)
	}
	return nil
}

func (h *smsHandler) Initialize(ctx context.Context, config map[string]string) error {
	h.config = config
	h.gateway = config["gateway"]
	if phones, ok := config["phones"]; ok && phones != "" {
		h.phones = strings.Split(phones, ";")
	}
	return nil
}

func (h *smsHandler) Send(ctx context.Context, alert map[string]interface{}) error {
	// TODO: in production, call SMS gateway API
	return nil
}

func (h *smsHandler) Receive(ctx context.Context) ([]map[string]interface{}, error) {
	return nil, nil
}

// wechatHandler sends alerts via WeChat Work (Enterprise WeChat) webhook.
type wechatHandler struct {
	noopHandler
	webhookURL string
}

func NewWeChatHandler() *wechatHandler {
	return &wechatHandler{
		noopHandler: noopHandler{
			name:     "WeChat",
			atype:    "wechat",
			category: "notification",
		},
	}
}

func (h *wechatHandler) ValidateConfig(ctx context.Context, config map[string]string) error {
	if url, ok := config["webhook_url"]; !ok || url == "" {
		return fmt.Errorf("%w: wechat requires 'webhook_url' config", ErrInvalidConfig)
	}
	return nil
}

func (h *wechatHandler) Initialize(ctx context.Context, config map[string]string) error {
	h.config = config
	h.webhookURL = config["webhook_url"]
	return nil
}

func (h *wechatHandler) Send(ctx context.Context, alert map[string]interface{}) error {
	if h.webhookURL == "" {
		return ErrInvalidConfig
	}
	// Build WeChat markdown message
	title, _ := alert["title"].(string)
	message, _ := alert["message"].(string)
	severity, _ := alert["severity"].(string)
	_ = severity

	content := fmt.Sprintf("**%s**\n\n%s", title, message)
	payload := map[string]interface{}{
		"msgtype": "markdown",
		"markdown": map[string]string{
			"content": content,
		},
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.webhookURL, strings.NewReader(string(b)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("wechat webhook returned HTTP %d", resp.StatusCode)
	}
	return nil
}

func (h *wechatHandler) Receive(ctx context.Context) ([]map[string]interface{}, error) {
	return nil, nil
}

// slackHandler sends alerts to a Slack channel via incoming webhook.
type slackHandler struct {
	noopHandler
	webhookURL string
}

func NewSlackHandler() *slackHandler {
	return &slackHandler{
		noopHandler: noopHandler{
			name:     "Slack",
			atype:    "slack",
			category: "notification",
		},
	}
}

func (h *slackHandler) ValidateConfig(ctx context.Context, config map[string]string) error {
	if url, ok := config["webhook_url"]; !ok || url == "" {
		return fmt.Errorf("%w: slack requires 'webhook_url' config", ErrInvalidConfig)
	}
	return nil
}

func (h *slackHandler) Initialize(ctx context.Context, config map[string]string) error {
	h.config = config
	h.webhookURL = config["webhook_url"]
	return nil
}

func (h *slackHandler) Send(ctx context.Context, alert map[string]interface{}) error {
	if h.webhookURL == "" {
		return ErrInvalidConfig
	}
	title, _ := alert["title"].(string)
	message, _ := alert["message"].(string)
	severity, _ := alert["severity"].(string)
	_ = severity

	color := "#ff0000"
	if severity == "warning" {
		color = "#ffcc00"
	} else if severity == "info" {
		color = "#36c5f0"
	}

	payload := map[string]interface{}{
		"attachments": []map[string]interface{}{
			{
				"color": color,
				"title": title,
				"text":  message,
			},
		},
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.webhookURL, strings.NewReader(string(b)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("slack webhook returned HTTP %d", resp.StatusCode)
	}
	return nil
}

func (h *slackHandler) Receive(ctx context.Context) ([]map[string]interface{}, error) {
	return nil, nil
}

// pagerDutyHandler sends alerts to PagerDuty Events API v2.
type pagerDutyHandler struct {
	noopHandler
	routingKey string
}

func NewPagerDutyHandler() *pagerDutyHandler {
	return &pagerDutyHandler{
		noopHandler: noopHandler{
			name:     "PagerDuty",
			atype:    "pagerduty",
			category: "notification",
		},
	}
}

func (h *pagerDutyHandler) ValidateConfig(ctx context.Context, config map[string]string) error {
	if rk, ok := config["routing_key"]; !ok || rk == "" {
		return fmt.Errorf("%w: pagerduty requires 'routing_key' config", ErrInvalidConfig)
	}
	return nil
}

func (h *pagerDutyHandler) Initialize(ctx context.Context, config map[string]string) error {
	h.config = config
	h.routingKey = config["routing_key"]
	return nil
}

func (h *pagerDutyHandler) Send(ctx context.Context, alert map[string]interface{}) error {
	if h.routingKey == "" {
		return ErrInvalidConfig
	}
	severity, _ := alert["severity"].(string)
	if severity == "" {
		severity = "info"
	}
	title, _ := alert["title"].(string)
	message, _ := alert["message"].(string)
	_ = message

	dedupKey := fmt.Sprintf("orion-%s", title)
	payload := map[string]interface{}{
		"routing_key": h.routingKey,
		"event_action": "trigger",
		"dedup_key":  dedupKey,
		"payload": map[string]interface{}{
			"summary":   title,
			"severity":  severity,
			"source":    "orion-platform",
		},
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://events.pagerduty.com/v2/enqueue", strings.NewReader(string(b)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("pagerduty returned HTTP %d", resp.StatusCode)
	}
	return nil
}

func (h *pagerDutyHandler) Receive(ctx context.Context) ([]map[string]interface{}, error) {
	return nil, nil
}

// ---------------------------------------------------------------------------
// Shared alert queue for source adapters
// ---------------------------------------------------------------------------

type alertQueue struct {
	mu     atomic.Pointer[[]map[string]interface{}]
}

func newAlertQueue() *alertQueue {
	return &alertQueue{}
}

func (q *alertQueue) Enqueue(alerts ...map[string]interface{}) {
	// Build a slice to pass as a pointer
	s := make([]map[string]interface{}, len(alerts))
	copy(s, alerts)
	q.mu.Store(&s)
}

func (q *alertQueue) Drain() []map[string]interface{} {
	ptr := q.mu.Swap(nil)
	if ptr == nil {
		return nil
	}
	result := *ptr
	*ptr = nil
	return result
}
