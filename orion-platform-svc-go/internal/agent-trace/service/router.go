package service

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"

	"orion/platform-svc-go/internal/agent-trace/models"
)

// ModelProvider describes a registered LLM provider.
type ModelProvider struct {
	Name           string
	Endpoint       string
	APIKey         string
	Pricing        Pricing
	Capabilities   []string // "text", "vision", "code", "embedding"
	MaxTokens      int
	MaxInputTokens int
}

// Pricing per million tokens.
type Pricing struct {
	Input  float64
	Output float64
	Total  float64
}

// RoutingRequest describes the inference task to route.
type RoutingRequest struct {
	InputTokens   int
	OutputTokens  int
	Temperature   float64
	TopK          int
	PromptLength  int
	Capabilities  []string // required capabilities
	CostBudget    float64  // max acceptable cost, 0=unlimited
	PreferredTier string   // "fast", "balanced", "cost"
}

// RoutingResponse is the selected model for routing.
type RoutingResponse struct {
	ProviderName  string
	ModelName     string
	Reason        string
	EstimatedCost float64
	LatencyTier   string
}

// ModelRouter selects the optimal model provider for a given inference task.
type ModelRouter struct {
	mu       sync.RWMutex
	models   []ModelProvider
	strategy RoutingStrategy
}

// RoutingStrategy controls how the router selects a model.
type RoutingStrategy string

const (
	StrategyFast     RoutingStrategy = "fast"     // lowest latency
	StrategyBalanced RoutingStrategy = "balanced" // best balance
	StrategyCost     RoutingStrategy = "cost"     // lowest cost
)

// NewModelRouter creates a router with the given strategy.
func NewModelRouter(strategy RoutingStrategy) *ModelRouter {
	if strategy == "" {
		strategy = StrategyBalanced
	}
	return &ModelRouter{models: make([]ModelProvider, 0), strategy: strategy}
}

// RegisterProvider adds a provider to the routing pool.
func (r *ModelRouter) RegisterProvider(p ModelProvider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.models = append(r.models, p)
}

// UnregisterProvider removes a provider by name.
func (r *ModelRouter) UnregisterProvider(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i, p := range r.models {
		if p.Name == name {
			r.models = append(r.models[:i], r.models[i+1:]...)
			return
		}
	}
}

// Route selects the best model for the given request.
func (r *ModelRouter) Route(ctx context.Context, req RoutingRequest) (*RoutingResponse, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if len(r.models) == 0 {
		return nil, fmt.Errorf("no providers registered")
	}

	// Filter by required capabilities
	eligible := make([]ModelProvider, 0, len(r.models))
	for _, p := range r.models {
		if req.PromptLength > p.MaxInputTokens {
			continue
		}
		if req.OutputTokens > p.MaxTokens {
			continue
		}
		if hasCapabilities(p.Capabilities, req.Capabilities) {
			eligible = append(eligible, p)
		}
	}

	if len(eligible) == 0 {
		return nil, fmt.Errorf("no eligible provider for required capabilities %v", req.Capabilities)
	}

	scored := make([]scoredProvider, 0, len(eligible))
	for _, p := range eligible {
		cost := estimateCost(p.Pricing, req.InputTokens, req.OutputTokens)
		if req.CostBudget > 0 && cost > req.CostBudget {
			continue
		}
		score := r.scoreProvider(p, cost, req)
		scored = append(scored, scoredProvider{provider: p, cost: cost, score: score})
	}

	if len(scored) == 0 {
		return nil, fmt.Errorf("no provider within cost budget %.4f", req.CostBudget)
	}

	sort.SliceStable(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	best := scored[0]
	return &RoutingResponse{
		ProviderName:  best.provider.Name,
		ModelName:     best.provider.Name + "/" + selectModelName(best.provider),
		Reason:        fmt.Sprintf("strategy=%s, cost=%.4f, score=%.2f", r.strategy, best.cost, best.score),
		EstimatedCost: best.cost,
		LatencyTier:   tierForPricing(best.provider.Pricing),
	}, nil
}

type scoredProvider struct {
	provider ModelProvider
	cost     float64
	score    float64
}

func (r *ModelRouter) scoreProvider(p ModelProvider, cost float64, req RoutingRequest) float64 {
	switch r.strategy {
	case StrategyFast:
		// Prefer providers with more capabilities and higher MaxTokens (proxy for quality)
		return float64(len(p.Capabilities))*10 + float64(p.MaxTokens)/1000 - cost*10
	case StrategyCost:
		// Pure cost optimization
		return -cost*10 + float64(len(p.Capabilities))
	case StrategyBalanced:
		// Balanced: moderate cost penalty + capability bonus
		return float64(len(p.Capabilities))*5 + math.Max(0, 10-cost*20)
	default:
		return 0
	}
}

func hasCapabilities(providerCaps []string, required []string) bool {
	if len(required) == 0 {
		return true
	}
	have := make(map[string]bool, len(providerCaps))
	for _, c := range providerCaps {
		have[strings.ToLower(strings.TrimSpace(c))] = true
	}
	for _, r := range required {
		if !have[strings.ToLower(strings.TrimSpace(r))] {
			return false
		}
	}
	return true
}

func estimateCost(pricing Pricing, inputTokens, outputTokens int) float64 {
	return float64(inputTokens)*pricing.Input/1_000_000 + float64(outputTokens)*pricing.Output/1_000_000
}

func selectModelName(p ModelProvider) string {
	// Default model name based on capabilities
	if hasCapabilities(p.Capabilities, []string{"embedding"}) {
		return "embed-v2"
	}
	if hasCapabilities(p.Capabilities, []string{"vision"}) {
		return "vision-v3"
	}
	return "default"
}

func tierForPricing(p Pricing) string {
	total := p.Input + p.Output
	switch {
	case total > 50:
		return "premium"
	case total > 5:
		return "standard"
	default:
		return "economy"
	}
}

// TokenEstimator provides a simple token count for text input.
type TokenEstimator struct{}

// CountTokens estimates the number of tokens in a text.
func (e *TokenEstimator) CountTokens(text string) int {
	if text == "" {
		return 0
	}
	// Rough estimate: ~1.3 tokens per character for CJK, ~0.25 for ASCII
	cjk := 0
	ascii := 0
	for _, r := range text {
		if r > 0x4e00 && r < 0x9fff {
			cjk++
		} else if r >= 0x30 && r <= 0x7a {
			ascii++
		} else {
			ascii++
		}
	}
	return int(math.Ceil(float64(cjk)*1.3)) + ascii/4
}

// UsageEstimator predicts cost and token usage before routing.
type UsageEstimator struct{}

func (e *UsageEstimator) Estimate(req RoutingRequest) (int, int, float64) {
	inputTokens := req.InputTokens
	if inputTokens == 0 && req.PromptLength > 0 {
		te := &TokenEstimator{}
		inputTokens = te.CountTokens(strings.Repeat(" ", req.PromptLength))
	}
	outputTokens := req.OutputTokens
	if outputTokens == 0 {
		outputTokens = int(math.Min(float64(inputTokens)*0.3, 2000))
	}
	totalCost := float64(inputTokens+outputTokens) * 0.005 / 1000 // rough $5/M
	return inputTokens, outputTokens, totalCost
}

// Ensure types implement expected interfaces at compile time
var _ models.TokenUsage
