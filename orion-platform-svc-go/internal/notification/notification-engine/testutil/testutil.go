package testutil

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"

	"orion/platform-svc-go/internal/notification/models"
	"orion/platform-svc-go/internal/notification/notification-engine"
)

// ---------------------------------------------------------------------------
// TestHandler - 测试用 NotifyChannel 实现
//
// 提供可配置的 TestHandler，用于单元测试中模拟渠道行为。
// 与 channels_test.go 中的 TestHandler 共享相同接口。
// ---------------------------------------------------------------------------

// TestHandler is a configurable test double for NotifyChannel. Every field it
// mutates is guarded: BatchStrategy fans a handler out across goroutines, so a
// plain counter or health flag races the moment a test runs with -race.
type TestHandler struct {
	TypeField models.ChannelType

	mu      sync.Mutex
	healthy bool
	calls   atomic.Int32
	fail    atomic.Pointer[error]
}

// NewTestHandler creates a handler for testing.
func NewTestHandler(chType models.ChannelType) *TestHandler {
	return &TestHandler{
		TypeField: chType,
		healthy:   true,
	}
}

// NewUnhealthyTestHandler creates a handler that reports unhealthy.
func NewUnhealthyTestHandler(chType models.ChannelType) *TestHandler {
	return &TestHandler{
		TypeField: chType,
		healthy:   false,
	}
}

// NewFailingTestHandler creates a handler that returns errMsg on every call.
// Previously the error was dropped and the handler reported success, which made
// any "delivery failed" test assert on a handler that never failed.
func NewFailingTestHandler(chType models.ChannelType, errMsg string) *TestHandler {
	h := NewTestHandler(chType)
	err := fmt.Errorf("%s", errMsg)
	h.fail.Store(&err)
	return h
}

func (h *TestHandler) Type() models.ChannelType { return h.TypeField }

// Calls returns the number of Execute invocations observed.
func (h *TestHandler) Calls() int32 { return h.calls.Load() }

func (h *TestHandler) Execute(_ context.Context, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	h.calls.Add(1)
	if errPtr := h.fail.Load(); errPtr != nil {
		return nil, *errPtr
	}
	if !h.Healthy() {
		return nil, engine.ErrNoChannelConfigured
	}
	return &engine.SendResult{
		Success:   true,
		MessageID: "test-" + msg.ID,
	}, nil
}

// Healthy reports whether the handler accepts sends.
func (h *TestHandler) Healthy() bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.healthy
}

// SetHealthy sets the health status.
func (h *TestHandler) SetHealthy(healthy bool) {
	h.mu.Lock()
	h.healthy = healthy
	h.mu.Unlock()
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
