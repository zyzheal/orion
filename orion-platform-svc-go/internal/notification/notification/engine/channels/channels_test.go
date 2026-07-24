package channels

import (
	"context"
	"orion/platform-svc-go/internal/notification/engine"
	"orion/platform-svc-go/internal/notification/notification/models"
)

// ---------------------------------------------------------------------------
// TestHelper - 测试辅助函数
// ---------------------------------------------------------------------------

// NewTestHandler creates a handler for testing with a custom channel type.
func NewTestHandler(chType models.ChannelType) *TestHandler {
	return &TestHandler{
		TypeField: chType,
		healthy:   true,
	}
}

// TestHandler is a configurable test double for NotifyChannel.
type TestHandler struct {
	TypeField models.ChannelType
	healthy   bool
}

func (h *TestHandler) Type() models.ChannelType { return h.TypeField }

func (h *TestHandler) Execute(ctx context.Context, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	if !h.healthy {
		return nil, engine.ErrNoChannelConfigured
	}
	return &engine.SendResult{
		Success:   true,
		MessageID: "test-" + msg.ID,
	}, nil
}

func (h *TestHandler) Healthy() bool { return h.healthy }

func (h *TestHandler) SetHealthy(healthy bool) { h.healthy = healthy }
