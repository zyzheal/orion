// Plan 17 — LLM Gateway 路由策略引擎
// 本地: internal/llm/ (10 files, service 374 lines) has trace + pricing + repository
// 缺口: no routing strategy, no fallback chain, no real-time metrics, no degradation
package gateway

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

type RoutingStrategy string

const (
	StrategyRoundRobin  RoutingStrategy = "round_robin"
	StrategyWeighted    RoutingStrategy = "weighted"
	StrategyLatency     RoutingStrategy = "lowest_latency"
	StrategyCost        RoutingStrategy = "lowest_cost"
	StrategyFailover    RoutingStrategy = "failover"
)

type ModelProvider struct {
	Name      string  `json:"name"`
	Endpoint  string  `json:"endpoint"`
	APIKey    string  `json:"apiKey"`
	Weight    int     `json:"weight"`
	Model     string  `json:"model"`
	MaxTokens int     `json:"maxTokens"`
	CostPer1K float64 `json:"costPer1k"`
	Healthy   bool    `json:"healthy"`
}

type ProviderMetrics struct {
	RequestCount  int64
	ErrorCount   int64
	TotalLatency int64 // microseconds
	avgLatency   float64
}

func (m *ProviderMetrics) RecordRequest(latencyMicro int64, err bool) {
	atomic.AddInt64(&m.RequestCount, 1)
	atomic.AddInt64(&m.TotalLatency, latencyMicro)
	if err {
		atomic.AddInt64(&m.ErrorCount, 1)
	}
}

func (m *ProviderMetrics) AvgLatency() float64 {
	rc := atomic.LoadInt64(&m.RequestCount)
	if rc == 0 {
		return 0
	}
	return float64(atomic.LoadInt64(&m.TotalLatency)) / float64(rc) / 1000.0
}

func (m *ProviderMetrics) ErrorRate() float64 {
	rc := atomic.LoadInt64(&m.RequestCount)
	if rc == 0 {
		return 0
	}
	return float64(atomic.LoadInt64(&m.ErrorCount)) / float64(rc)
}

type LLMRequest struct {
	Model      string                 `json:"model"`
	Messages   []map[string]string    `json:"messages"`
	MaxTokens  int                    `json:"maxTokens"`
	Temperature float64               `json:"temperature"`
	Stream     bool                   `json:"stream"`
	Metadata   map[string]string      `json:"metadata"`
}

type LLMResponse struct {
	Content    string                 `json:"content"`
	Model      string                 `json:"model"`
	Provider   string                 `json:"provider"`
	TokensIn   int                    `json:"tokensIn"`
	TokensOut  int                    `json:"tokensOut"`
	LatencyMs  int64                  `json:"latencyMs"`
	CostCNY    float64                `json:"costCNY"`
}

type Gateway struct {
	mu       sync.RWMutex
	providers map[string]*ModelProvider
	metrics   map[string]*ProviderMetrics
	rrIndex   int
	strategy  RoutingStrategy
	fallback  []string // ordered fallback chain
}

func NewGateway(strategy RoutingStrategy) *Gateway {
	return &Gateway{
		providers: make(map[string]*ModelProvider),
		metrics:   make(map[string]*ProviderMetrics),
		strategy:  strategy,
	}
}

func (g *Gateway) RegisterProvider(p ModelProvider) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.providers[p.Name] = &p
	g.metrics[p.Name] = &ProviderMetrics{}
}

func (g *Gateway) SetFallback(chain []string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.fallback = chain
}

func (g *Gateway) Route(ctx context.Context, req LLMRequest) (*LLMResponse, error) {
	provider := g.selectProvider()
	if provider == nil {
		return nil, errors.New("no available provider")
	}

	start := time.Now()
	resp, err := g.callProvider(ctx, provider, req)
	latency := time.Since(start).Microseconds()

	g.metrics[provider.Name].RecordRequest(latency, err != nil)

	if err != nil {
		g.mu.Lock()
		provider.Healthy = false
		g.mu.Unlock()

		for _, fbName := range g.fallback {
			if fbName == provider.Name {
				continue
			}
			fb, ok := g.providers[fbName]
			if !ok || !fb.Healthy {
				continue
			}
			start2 := time.Now()
			resp2, err2 := g.callProvider(ctx, fb, req)
			latency2 := time.Since(start2).Microseconds()
			g.metrics[fb.Name].RecordRequest(latency2, err2 != nil)
			if err2 == nil {
				return resp2, nil
			}
		}
		return nil, fmt.Errorf("all providers failed: %w", err)
	}

	return resp, nil
}

func (g *Gateway) selectProvider() *ModelProvider {
	g.mu.RLock()
	defer g.mu.RUnlock()

	var healthy []*ModelProvider
	for _, p := range g.providers {
		if p.Healthy {
			healthy = append(healthy, p)
		}
	}
	if len(healthy) == 0 {
		return nil
	}

	switch g.strategy {
	case StrategyRoundRobin:
		g.rrIndex = (g.rrIndex + 1) % len(healthy)
		return healthy[g.rrIndex]
	case StrategyWeighted:
		totalWeight := 0
		for _, p := range healthy {
			totalWeight += p.Weight
		}
		target := rand.Intn(totalWeight)
		cum := 0
		for _, p := range healthy {
			cum += p.Weight
			if target < cum {
				return p
			}
		}
	case StrategyLatency:
		var best *ModelProvider
		bestLatency := time.Duration(1 << 62)
		for _, p := range healthy {
			l := time.Duration(g.metrics[p.Name].AvgLatency()) * time.Millisecond
			if l < bestLatency {
				bestLatency = l
				best = p
			}
		}
		if best != nil {
			return best
		}
	case StrategyCost:
		var best *ModelProvider
		bestCost := 1e10
		for _, p := range healthy {
			if p.CostPer1K < bestCost {
				bestCost = p.CostPer1K
				best = p
			}
		}
		if best != nil {
			return best
		}
	case StrategyFailover:
		for _, name := range g.fallback {
			if p, ok := g.providers[name]; ok && p.Healthy {
				return p
			}
		}
	}
	return healthy[0]
}

func (g *Gateway) callProvider(ctx context.Context, p *ModelProvider, req LLMRequest) (*LLMResponse, error) {
	resp := &LLMResponse{
		Model:    p.Model,
		Provider: p.Name,
	}
	resp.TokensIn = req.MaxTokens / 2
	resp.TokensOut = req.MaxTokens / 2
	resp.CostCNY = float64(resp.TokensIn+resp.TokensOut) * p.CostPer1K / 1000.0
	resp.Content = fmt.Sprintf("[response from %s]", p.Name)
	return resp, nil
}

func (g *Gateway) HealthCheck(ctx context.Context) map[string]bool {
	g.mu.RLock()
	defer g.mu.RUnlock()
	result := make(map[string]bool)
	for name, p := range g.providers {
		result[name] = p.Healthy
	}
	return result
}

func (g *Gateway) GetMetrics() map[string]map[string]interface{} {
	g.mu.RLock()
	defer g.mu.RUnlock()
	result := make(map[string]map[string]interface{})
	for name, m := range g.metrics {
		result[name] = map[string]interface{}{
			"requests":   atomic.LoadInt64(&m.RequestCount),
			"errors":     atomic.LoadInt64(&m.ErrorCount),
			"errorRate":  m.ErrorRate(),
			"avgLatency": m.AvgLatency(),
		}
	}
	return result
}