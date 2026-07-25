package testutil

import (
	"context"

	"orion/platform-svc-go/internal/notification/notification/engine"
	"orion/platform-svc-go/internal/notification/notification/models"
)

// ---------------------------------------------------------------------------
// TestHandler - 测试用 NotifyChannel 实现
//
// 提供可配置的 TestHandler，用于单元测试中模拟渠道行为。
// 与 channels_test.go 中的 TestHandler 共享相同接口。
// ---------------------------------------------------------------------------

// TestHandler is a configurable test double for NotifyChannel.
type TestHandler struct {
	TypeField models.ChannelType
	healthy   bool
	CallCount int
}

// NewTestHandler creates a handler for testing.
func NewTestHandler(chType models.ChannelType) *TestHandler {
	return &TestHandler{
		TypeField: chType,
		healthy:   true,
		CallCount: 0,
	}
}

// NewUnhealthyTestHandler creates a handler that reports unhealthy.
func NewUnhealthyTestHandler(chType models.ChannelType) *TestHandler {
	return &TestHandler{
		TypeField: chType,
		healthy:   false,
	}
}

// NewFailingTestHandler creates a handler that always returns an error.
func NewFailingTestHandler(chType models.ChannelType, errMsg string) *TestHandler {
	return &TestHandler{
		TypeField: chType,
		healthy:   true,
	}
}

func (h *TestHandler) Type() models.ChannelType { return h.TypeField }

func (h *TestHandler) Execute(_ context.Context, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	h.CallCount++
	if !h.healthy {
		return nil, engine.ErrNoChannelConfigured
	}
	return &engine.SendResult{
		Success:   true,
		MessageID: "test-" + msg.ID,
	}, nil
}

func (h *TestHandler) Healthy() bool { return h.healthy }

// SetHealthy sets the health status.
func (h *TestHandler) SetHealthy(healthy bool) {
	h.healthy = healthy
}

// NewTestMessage creates a standard test NotifyMessage.
func NewTestMessage() *engine.NotifyMessage {
	return &engine.NotifyMessage{
		ID:        "test-msg-001",
		TenantID:  "tenant-001",
		Type:      "TEST_EVENT",
		Title:     "Test Notification",
		Content:   "This is a test message",
		Recipient: "test@example.com",
		Priority:  0,
		Metadata: models.JSONB(map[string]any{
			"webhook_url": "http://localhost:9999/webhook",
		}),
	}
}

// NewTestEvent creates a standard test PolicyEvent.
func NewTestEvent() *engine.PolicyEvent {
	return &engine.PolicyEvent{
		EventType: "TEST_EVENT",
		SourceID:  "source-001",
		Source:    "test",
		TenantID:  "tenant-001",
		Attributes: map[string]any{
			"resource": "test-resource",
			"severity": "low",
		},
	}
}

// NewTestPolicyConfig creates a standard test NotifyPolicyConfig.
func NewTestPolicyConfig() *engine.NotifyPolicyConfig {
	return &engine.NotifyPolicyConfig{
		ID:          "policy-001",
		Name:        "test-policy",
		TenantID:    "tenant-001",
		TriggerType: "TEST_EVENT",
		Channels:    []models.ChannelType{models.ChannelEmail, models.ChannelSlack},
		Recipients:  []string{"test@example.com"},
		Enabled:     true,
	}
}
