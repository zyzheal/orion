package service

import (
	"context"
	"testing"
)

func Test_NewModelRouter_DefaultStrategy(t *testing.T) {
	r := NewModelRouter("")
	if r.strategy != StrategyBalanced {
		t.Fatalf("expected balanced, got %s", r.strategy)
	}
}

func Test_ModelRouter_RegisterAndRoute(t *testing.T) {
	r := NewModelRouter(StrategyCost)
	r.RegisterProvider(ModelProvider{
		Name:           "openai",
		Endpoint:       "https://api.openai.com",
		Pricing:        Pricing{Input: 10, Output: 20},
		Capabilities:   []string{"text", "code"},
		MaxTokens:      4096,
		MaxInputTokens: 8192,
	})
	r.RegisterProvider(ModelProvider{
		Name:           "claude",
		Endpoint:       "https://api.anthropic.com",
		Pricing:        Pricing{Input: 5, Output: 15},
		Capabilities:   []string{"text", "code", "vision"},
		MaxTokens:      8192,
		MaxInputTokens: 16384,
	})

	resp, err := r.Route(context.Background(), RoutingRequest{
		InputTokens:  500,
		OutputTokens: 200,
		Capabilities: []string{"text"},
		CostBudget:   0.1,
	})
	if err != nil {
		t.Fatalf("Route: %v", err)
	}
	if resp.ProviderName != "claude" {
		t.Fatalf("expected claude (cheaper), got %s", resp.ProviderName)
	}
	if resp.EstimatedCost <= 0 {
		t.Fatal("expected positive estimated cost")
	}
}

func Test_ModelRouter_Route_EmptyProviders(t *testing.T) {
	r := NewModelRouter(StrategyBalanced)
	_, err := r.Route(context.Background(), RoutingRequest{})
	if err == nil {
		t.Fatal("expected error for no providers")
	}
}

func Test_ModelRouter_Route_NoCapabilityMatch(t *testing.T) {
	r := NewModelRouter(StrategyBalanced)
	r.RegisterProvider(ModelProvider{
		Name:         "text-only",
		Pricing:      Pricing{Input: 5, Output: 5},
		Capabilities: []string{"text"},
		MaxTokens:    4096,
		MaxInputTokens: 8192,
	})

	_, err := r.Route(context.Background(), RoutingRequest{
		Capabilities: []string{"vision"},
	})
	if err == nil {
		t.Fatal("expected error: no provider with vision")
	}
}

func Test_ModelRouter_Route_CostBudgetExceeded(t *testing.T) {
	r := NewModelRouter(StrategyCost)
	r.RegisterProvider(ModelProvider{
		Name:         "expensive",
		Pricing:      Pricing{Input: 500, Output: 500},
		Capabilities: []string{"text"},
		MaxTokens:    4096,
		MaxInputTokens: 8192,
	})

	_, err := r.Route(context.Background(), RoutingRequest{
		InputTokens:  10000,
		OutputTokens: 10000,
		CostBudget:   0.001,
	})
	if err == nil {
		t.Fatal("expected cost budget exceeded error")
	}
}

func Test_ModelRouter_Route_PromptTooLong(t *testing.T) {
	r := NewModelRouter(StrategyCost)
	r.RegisterProvider(ModelProvider{
		Name:           "small-context",
		Pricing:        Pricing{Input: 1, Output: 1},
		Capabilities:   []string{"text"},
		MaxTokens:      4096,
		MaxInputTokens: 2048,
	})

	_, err := r.Route(context.Background(), RoutingRequest{
		PromptLength: 9999,
	})
	if err == nil {
		t.Fatal("expected error: prompt too long for provider")
	}
}

func Test_ModelRouter_Unregister(t *testing.T) {
	r := NewModelRouter(StrategyCost)
	r.RegisterProvider(ModelProvider{Name: "p1", Pricing: Pricing{Input: 1, Output: 1}, Capabilities: []string{"text"}, MaxTokens: 4096, MaxInputTokens: 8192})
	r.RegisterProvider(ModelProvider{Name: "p2", Pricing: Pricing{Input: 1, Output: 1}, Capabilities: []string{"text"}, MaxTokens: 4096, MaxInputTokens: 8192})

	r.UnregisterProvider("p1")
	resp, err := r.Route(context.Background(), RoutingRequest{InputTokens: 100, OutputTokens: 50})
	if err != nil {
		t.Fatalf("Route: %v", err)
	}
	if resp.ProviderName != "p2" {
		t.Fatalf("expected p2, got %s", resp.ProviderName)
	}
}

func Test_ModelRouter_FastStrategy(t *testing.T) {
	r := NewModelRouter(StrategyFast)
	r.RegisterProvider(ModelProvider{
		Name:         "fast",
		Pricing:      Pricing{Input: 100, Output: 100},
		Capabilities: []string{"text", "code", "vision", "embedding"},
		MaxTokens:    4096,
		MaxInputTokens: 8192,
	})
	r.RegisterProvider(ModelProvider{
		Name:         "slow",
		Pricing:      Pricing{Input: 1, Output: 1},
		Capabilities: []string{"text"},
		MaxTokens:    2048,
		MaxInputTokens: 4096,
	})

	resp, err := r.Route(context.Background(), RoutingRequest{
		InputTokens:  100,
		OutputTokens: 50,
		CostBudget:   10,
	})
	if err != nil {
		t.Fatalf("Route: %v", err)
	}
	if resp.ProviderName != "fast" {
		t.Fatalf("expected fast (more caps), got %s", resp.ProviderName)
	}
}

func Test_ModelRouter_BalancedStrategy(t *testing.T) {
	r := NewModelRouter(StrategyBalanced)
	r.RegisterProvider(ModelProvider{
		Name:         "expensive",
		Pricing:      Pricing{Input: 200, Output: 200},
		Capabilities: []string{"text", "code", "vision"},
		MaxTokens:    4096,
		MaxInputTokens: 8192,
	})
	r.RegisterProvider(ModelProvider{
		Name:         "cheap",
		Pricing:      Pricing{Input: 5, Output: 5},
		Capabilities: []string{"text", "code", "vision", "embedding"},
		MaxTokens:    2048,
		MaxInputTokens: 4096,
	})

	resp, err := r.Route(context.Background(), RoutingRequest{
		InputTokens:  500,
		OutputTokens: 200,
		CostBudget:   10,
	})
	if err != nil {
		t.Fatalf("Route: %v", err)
	}
	if resp.ProviderName != "cheap" {
		t.Fatalf("expected cheap (more caps + lower cost), got %s", resp.ProviderName)
	}
}

func Test_TokenEstimator_Empty(t *testing.T) {
	te := TokenEstimator{}
	if te.CountTokens("") != 0 {
		t.Fatal("expected 0 tokens for empty")
	}
}

func Test_TokenEstimator_ASCII(t *testing.T) {
	te := TokenEstimator{}
	tokens := te.CountTokens("hello world this is a test")
	// ~15 chars/4 ≈ 3-4 tokens
	if tokens <= 0 {
		t.Fatalf("expected positive tokens, got %d", tokens)
	}
}

func Test_TokenEstimator_CJK(t *testing.T) {
	te := TokenEstimator{}
	tokens := te.CountTokens("你好世界")
	// 4 CJK chars * 1.3 = 5.2 -> ceil = 6
	if tokens < 5 {
		t.Fatalf("expected ~6 tokens for 4 CJK chars, got %d", tokens)
	}
}

func Test_UsageEstimator_DefaultOutputTokens(t *testing.T) {
	ue := UsageEstimator{}
	input, output, cost := ue.Estimate(RoutingRequest{InputTokens: 1000})
	if input != 1000 {
		t.Fatalf("expected input=1000, got %d", input)
	}
	if output != 300 {
		t.Fatalf("expected output=300 (1000*0.3), got %d", output)
	}
	if cost <= 0 {
		t.Fatal("expected positive cost")
	}
}

func Test_UsageEstimator_ZeroInput(t *testing.T) {
	ue := UsageEstimator{}
	input, output, cost := ue.Estimate(RoutingRequest{})
	if input != 0 {
		t.Fatalf("expected input=0, got %d", input)
	}
	// When no input, output is 0 too
	if output != 0 {
		t.Fatalf("expected output=0 for zero input, got %d", output)
	}
	if cost != 0 {
		t.Fatalf("expected cost=0, got %f", cost)
	}
}