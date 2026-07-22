package llmprovider

import (
	"context"
	"sync/atomic"
)

// MockProvider implements LLMProvider for testing.
type MockProvider struct {
	NameVal   ProviderType
	ChatFn    func(ctx context.Context, req *ChatRequest) (*ChatResponse, error)
	StreamFn  func(ctx context.Context, req *ChatRequest) (<-chan *StreamChunk, error)
	ChatCalls atomic.Int64
}

// NewMockProvider creates a mock provider that echoes messages.
func NewMockProvider(name ProviderType) *MockProvider {
	return &MockProvider{
		NameVal: name,
		ChatFn: func(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
			return &ChatResponse{
				Content:  "mock response",
				Model:    "mock-model",
				Provider: name,
			}, nil
		},
		StreamFn: func(ctx context.Context, req *ChatRequest) (<-chan *StreamChunk, error) {
			ch := make(chan *StreamChunk, 2)
			go func() {
				defer close(ch)
				ch <- &StreamChunk{Content: "mock"}
				ch <- &StreamChunk{Done: true}
			}()
			return ch, nil
		},
	}
}

func (m *MockProvider) Name() ProviderType {
	return m.NameVal
}

func (m *MockProvider) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	m.ChatCalls.Add(1)
	return m.ChatFn(ctx, req)
}

func (m *MockProvider) ChatStream(ctx context.Context, req *ChatRequest) (<-chan *StreamChunk, error) {
	return m.StreamFn(ctx, req)
}
