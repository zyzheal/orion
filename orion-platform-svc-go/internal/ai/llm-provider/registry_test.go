package llmprovider

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
)

// ---- helpers ----

func newEchoProvider(name ProviderType, resp string, err error) *MockProvider {
	return &MockProvider{
		NameVal: name,
		ChatFn: func(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
			return &ChatResponse{
				Content:      resp,
				Model:        fmt.Sprintf("mock-%s", name),
				Provider:     name,
				InputTokens:  10,
				OutputTokens: 5,
				TotalTokens:  15,
			}, err
		},
		StreamFn: func(ctx context.Context, req *ChatRequest) (<-chan *StreamChunk, error) {
			return nil, nil
		},
	}
}

// ---- registry basic ops ----

func TestProviderRegistry_Register(t *testing.T) {
	r := NewProviderRegistry()
	p := newEchoProvider(ProviderType("test"), "hi", nil)
	r.Register(p)

	got, err := r.Get(ProviderType("test"))
	if err != nil {
		t.Fatalf("Get after Register: %v", err)
	}
	if got.Name() != ProviderType("test") {
		t.Fatalf("expected test, got %s", got.Name())
	}
}

func TestProviderRegistry_GetUnregistered(t *testing.T) {
	r := NewProviderRegistry()
	_, err := r.Get(ProviderType("nope"))
	if err == nil {
		t.Fatal("expected error for unregistered provider")
	}
	if !errors.Is(err, ErrProviderNotFound) {
		t.Fatalf("expected ErrProviderNotFound, got %v", err)
	}
}

func TestProviderRegistry_EnableDisable(t *testing.T) {
	r := NewProviderRegistry()
	p := newEchoProvider(ProviderType("x"), "ok", nil)
	r.Register(p)

	r.Disable(ProviderType("x"))
	_, err := r.Get(ProviderType("x"))
	if err == nil {
		t.Fatal("expected error after Disable")
	}
	if !r.IsEnabled(ProviderType("x")) {
		// expected
	}

	r.Enable(ProviderType("x"))
	_, err = r.Get(ProviderType("x"))
	if err != nil {
		t.Fatalf("expected success after Enable: %v", err)
	}
}

func TestProviderRegistry_ProvidersList(t *testing.T) {
	r := NewProviderRegistry()
	r.Register(newEchoProvider(ProviderType("a"), "1", nil))
	r.Register(newEchoProvider(ProviderType("b"), "2", nil))
	names := r.Providers()
	if len(names) != 2 {
		t.Fatalf("expected 2 providers, got %d", len(names))
	}
}

// ---- Resolve ----

func TestProviderRegistry_Resolve(t *testing.T) {
	r := NewProviderRegistry()
	r.Register(newEchoProvider(ProviderTypeOpenAI, "hi", nil))
	r.Register(newEchoProvider(ProviderTypeAnthropic, "hi", nil))

	// exact provider name
	p, err := r.Resolve("openai")
	if err != nil || p.Name() != ProviderTypeOpenAI {
		t.Fatalf("Resolve(openai): got %v", err)
	}

	// model name inference
	p, err = r.Resolve("gpt-4o")
	if err != nil || p.Name() != ProviderTypeOpenAI {
		t.Fatalf("Resolve(gpt-4o): got %v", err)
	}

	// empty model
	_, err = r.Resolve("")
	if !errors.Is(err, ErrInvalidModel) {
		t.Fatalf("expected ErrInvalidModel, got %v", err)
	}

	// empty model (whitespace)
	_, err = r.Resolve("  ")
	if !errors.Is(err, ErrInvalidModel) {
		t.Fatalf("expected ErrInvalidModel for whitespace, got %v", err)
	}
}

func TestProviderRegistry_ResolveAllDisabled(t *testing.T) {
	r := NewProviderRegistry()
	r.Register(newEchoProvider(ProviderTypeOpenAI, "hi", nil))
	r.Disable(ProviderTypeOpenAI)

	_, err := r.Resolve("gpt-4o")
	if err == nil {
		t.Fatal("expected error when all providers disabled")
	}
}

func TestProviderRegistry_ResolveInferredProviderNotRegistered(t *testing.T) {
	r := NewProviderRegistry()
	// only register openai, ask for claude model
	r.Register(newEchoProvider(ProviderTypeOpenAI, "hi", nil))

	_, err := r.Resolve("claude-3-opus")
	// inferred provider is anthropic but not registered -> error
	if err == nil {
		t.Fatal("expected error when inferred provider is not registered")
	}
}

// ---- Call (failover) ----

func TestRegistry_CallSuccess(t *testing.T) {
	r := NewProviderRegistry()
	r.Register(newEchoProvider(ProviderTypeOpenAI, "response", nil))

	ctx := context.Background()
	req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "hello"}}}
	resp, err := r.Call(ctx, req)
	if err != nil {
		t.Fatalf("Call failed: %v", err)
	}
	if resp.Content != "response" {
		t.Fatalf("expected 'response', got %s", resp.Content)
	}
	if resp.Provider != ProviderTypeOpenAI {
		t.Fatalf("expected openai, got %s", resp.Provider)
	}
}

func TestRegistry_CallFailoverOnRateLimit(t *testing.T) {
	r := NewProviderRegistry()
	r.Register(newEchoProvider(ProviderTypeOpenAI, "", ErrRateLimited))
	r.Register(newEchoProvider(ProviderTypeAnthropic, "fallback", nil))

	ctx := context.Background()
	req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "hello"}}}
	resp, err := r.Call(ctx, req)
	if err != nil {
		t.Fatalf("Call should failover: %v", err)
	}
	if resp.Provider != ProviderTypeAnthropic {
		t.Fatalf("expected failover to anthropic, got %s", resp.Provider)
	}
	if resp.Content != "fallback" {
		t.Fatalf("expected 'fallback', got %s", resp.Content)
	}
}

func TestRegistry_CallFailoverChain(t *testing.T) {
	r := NewProviderRegistry()
	r.Register(newEchoProvider(ProviderTypeOpenAI, "", ErrRateLimited))
	r.Register(newEchoProvider(ProviderTypeAnthropic, "", ErrRateLimited))
	r.Register(newEchoProvider(ProviderTypeCustom, "final", nil))

	ctx := context.Background()
	req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "hello"}}}
	resp, err := r.Call(ctx, req)
	if err != nil {
		t.Fatalf("Call should failover through chain: %v", err)
	}
	if resp.Provider != ProviderTypeCustom {
		t.Fatalf("expected custom, got %s", resp.Provider)
	}
}

func TestRegistry_CallAllProvidersFail(t *testing.T) {
	r := NewProviderRegistry()
	r.Register(newEchoProvider(ProviderTypeOpenAI, "", errors.New("provider down")))
	r.Register(newEchoProvider(ProviderTypeAnthropic, "", errors.New("provider down")))

	ctx := context.Background()
	req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "hello"}}}
	_, err := r.Call(ctx, req)
	if err == nil {
		t.Fatal("expected error when all providers fail")
	}
}

func TestRegistry_CallRespectsDisabled(t *testing.T) {
	r := NewProviderRegistry()
	r.Register(newEchoProvider(ProviderTypeOpenAI, "primary", nil))
	r.Register(newEchoProvider(ProviderTypeAnthropic, "backup", nil))
	r.Disable(ProviderTypeAnthropic)

	ctx := context.Background()
	req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "hello"}}}
	resp, err := r.Call(ctx, req)
	if err != nil {
		t.Fatalf("Call failed: %v", err)
	}
	// only openai is enabled, should NOT try anthropic
	if resp.Provider != ProviderTypeOpenAI {
		t.Fatalf("expected openai only, got %s", resp.Provider)
	}
}

func TestRegistry_CallFirstCallWins(t *testing.T) {
	// Register openai as primary (resolves first), with a transient error;
	// should failover to anthropic and still succeed.
	called := make([]ProviderType, 0)
	r := NewProviderRegistry()
	r.Register(&MockProvider{
		NameVal: ProviderTypeOpenAI,
		ChatFn: func(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
			called = append(called, ProviderTypeOpenAI)
			return nil, ErrRateLimited
		},
		StreamFn: func(ctx context.Context, req *ChatRequest) (<-chan *StreamChunk, error) {
			return nil, nil
		},
	})
	r.Register(&MockProvider{
		NameVal: ProviderTypeAnthropic,
		ChatFn: func(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
			called = append(called, ProviderTypeAnthropic)
			return &ChatResponse{Content: "ok", Provider: ProviderTypeAnthropic}, nil
		},
		StreamFn: func(ctx context.Context, req *ChatRequest) (<-chan *StreamChunk, error) {
			return nil, nil
		},
	})

	ctx := context.Background()
	req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "x"}}}
	resp, err := r.Call(ctx, req)
	if err != nil {
		t.Fatalf("Call failed: %v", err)
	}
	if len(called) != 2 {
		t.Fatalf("expected 2 calls, got %d: %v", len(called), called)
	}
	if called[0] != ProviderTypeOpenAI {
		t.Fatalf("expected first call openai, got %v", called[0])
	}
	if called[1] != ProviderTypeAnthropic {
		t.Fatalf("expected second call anthropic, got %v", called[1])
	}
	if resp.Provider != ProviderTypeAnthropic {
		t.Fatalf("expected anthropic, got %s", resp.Provider)
	}
}

func TestRegistry_CallTokenPoolExhausted(t *testing.T) {
	r := NewProviderRegistry()
	r.SetTokenLimit(ProviderTypeOpenAI, 1) // 1 token budget
	r.Register(newEchoProvider(ProviderTypeOpenAI, "first", nil))

	ctx := context.Background()
	// first call succeeds
	req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "hi"}}}
	_, err := r.Call(ctx, req)
	if err != nil {
		t.Fatalf("first call should succeed: %v", err)
	}

	// second call: pool exhausted -> failover
	r.Register(newEchoProvider(ProviderTypeAnthropic, "fallback", nil))
	_, err = r.Call(ctx, req)
	if err != nil {
		t.Fatalf("second call should failover: %v", err)
	}
	// should use anthropic since openai pool is exhausted
}

func TestRegistry_CallPoolExhaustedNoFallback(t *testing.T) {
	r := NewProviderRegistry()
	r.SetTokenLimit(ProviderTypeOpenAI, 1)
	r.Register(newEchoProvider(ProviderTypeOpenAI, "hi", nil))

	ctx := context.Background()
	req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "hi"}}}
	// first call ok
	r.Call(ctx, req)

	// second call: pool exhausted, no fallback
	_, err := r.Call(ctx, req)
	if err == nil {
		t.Fatal("expected error when pool exhausted and no fallback")
	}
}

func TestRegistry_CallContextCancellation(t *testing.T) {
	r := NewProviderRegistry()
	r.Register(&MockProvider{
		NameVal: ProviderTypeOpenAI,
		ChatFn: func(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
			<-ctx.Done() // block until cancelled
			return nil, ctx.Err()
		},
		StreamFn: func(ctx context.Context, req *ChatRequest) (<-chan *StreamChunk, error) {
			return nil, nil
		},
	})

	ctx, cancel := context.WithCancel(context.Background())
	req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "x"}}}
	go func() { cancel() }()

	_, err := r.Call(ctx, req)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestRegistry_CallNoProvidersRegistered(t *testing.T) {
	r := NewProviderRegistry()
	ctx := context.Background()
	req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "x"}}}
	_, err := r.Call(ctx, req)
	if err == nil {
		t.Fatal("expected error when no providers registered")
	}
}

// ---- Health ----

func TestRegistry_HealthAll(t *testing.T) {
	r := NewProviderRegistry()
	r.Register(newEchoProvider(ProviderTypeOpenAI, "ok", nil))
	r.Register(newEchoProvider(ProviderTypeAnthropic, "", errors.New("bad")))

	stats := r.Health(context.Background())
	if len(stats) != 2 {
		t.Fatalf("expected 2 health stats, got %d", len(stats))
	}

	healthy, unhealthy := 0, 0
	for name, s := range stats {
		if s.Name != name {
			t.Errorf("name mismatch for stat: %v", s)
		}
		if s.TotalCalls == 1 {
			if s.Error != "" {
				unhealthy++
			} else {
				healthy++
			}
		}
	}
	if healthy != 1 {
		t.Fatalf("expected 1 healthy, got %d", healthy)
	}
}

func TestRegistry_HealthEmpty(t *testing.T) {
	r := NewProviderRegistry()
	stats := r.Health(context.Background())
	if len(stats) != 0 {
		t.Fatalf("expected 0 health stats, got %d", len(stats))
	}
}

func TestRegistry_HealthWithFailover(t *testing.T) {
	r := NewProviderRegistry()
	r.Register(newEchoProvider(ProviderTypeOpenAI, "", ErrRateLimited))
	r.Register(newEchoProvider(ProviderTypeAnthropic, "ok", nil))

	ctx := context.Background()
	req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "hi"}}}
	_, err := r.Call(ctx, req)
	if err != nil {
		t.Fatalf("Call: %v", err)
	}

	stats := r.Health(ctx)
	if stats[ProviderTypeOpenAI].TotalCalls != 1 || stats[ProviderTypeOpenAI].Success != 0 {
		t.Fatalf("openai should have 1 call 0 success: %v", stats[ProviderTypeOpenAI])
	}
	if stats[ProviderTypeAnthropic].TotalCalls != 1 || stats[ProviderTypeAnthropic].Success != 1 {
		t.Fatalf("anthropic should have 1 call 1 success: %v", stats[ProviderTypeAnthropic])
	}
}

// ---- Token pool ----

func TestRegistry_TokenPool(t *testing.T) {
	r := NewProviderRegistry()
	r.SetTokenLimit(ProviderTypeOpenAI, 100)
	r.Register(newEchoProvider(ProviderTypeOpenAI, "ok", nil))

	pool := r.TokenPool(ProviderTypeOpenAI)
	if pool == nil || pool.Capacity != 100 || pool.Available != 100 {
		t.Fatalf("expected pool 100/100, got %+v", pool)
	}

	// consume
	ctx := context.Background()
	req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "x"}}}
	r.Call(ctx, req)
	pool = r.TokenPool(ProviderTypeOpenAI)
	// response reported 15 tokens
	expected := int64(100 - 15)
	if pool.Available != expected {
		t.Fatalf("expected pool available %d, got %d", expected, pool.Available)
	}
}

func TestRegistry_TokenPoolUnregistered(t *testing.T) {
	r := NewProviderRegistry()
	pool := r.TokenPool(ProviderTypeOpenAI)
	if pool != nil {
		t.Fatalf("expected nil pool for unregistered provider, got %+v", pool)
	}
}

// ---- Concurrency ----

func TestRegistry_CallConcurrent(t *testing.T) {
	r := NewProviderRegistry()
	r.Register(newEchoProvider(ProviderTypeOpenAI, "ok", nil))

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ctx := context.Background()
			req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "x"}}}
			_, err := r.Call(ctx, req)
			if err != nil {
				t.Errorf("concurrent call failed: %v", err)
			}
		}()
	}
	wg.Wait()
}
