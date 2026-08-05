package llmprovider

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// DefaultClient is the shared http client used by provider adapters.
var DefaultClient = &http.Client{
	Timeout: 120 * time.Second, // 2 min default; override per-provider if needed
}

// ProviderConfig holds configuration for instantiating a provider client.
type ProviderConfig struct {
	Name         string       `json:"name"`
	Type         ProviderType `json:"type"`
	BaseURL      string       `json:"baseUrl"`
	APIKey       string       `json:"apiKey"`
	DefaultModel string       `json:"defaultModel"`
	Enabled      bool         `json:"enabled"`
	HTTPClient   *http.Client `json:"-"`
}

// TokenPool tracks per-provider token consumption.
type TokenPool struct {
	Name      ProviderType `json:"name"`
	Capacity  int64        `json:"capacity"`
	Available int64        `json:"available"`
	Consumed  int64        `json:"consumed"`
}

// HealthStat holds per-provider health counters.
type HealthStat struct {
	Name       ProviderType `json:"name"`
	Enabled    bool         `json:"enabled"`
	TotalCalls int64        `json:"totalCalls"`
	Success    int64        `json:"success"`
	Error      string       `json:"error"`
}

// DefaultModelProviderMap maps well-known model names to their provider type.
var DefaultModelProviderMap = map[string]ProviderType{
	"gpt-4":             ProviderTypeOpenAI,
	"gpt-4o":            ProviderTypeOpenAI,
	"gpt-4o-mini":       ProviderTypeOpenAI,
	"gpt-4-turbo":       ProviderTypeOpenAI,
	"gpt-3.5-turbo":     ProviderTypeOpenAI,
	"claude-opus":       ProviderTypeAnthropic,
	"claude-sonnet":     ProviderTypeAnthropic,
	"claude-3-opus":     ProviderTypeAnthropic,
	"claude-3-sonnet":   ProviderTypeAnthropic,
	"claude-3-haiku":    ProviderTypeAnthropic,
	"deepseek-chat":     ProviderTypeDeepSeek,
	"deepseek-coder":    ProviderTypeDeepSeek,
}

// inferProviderFromModel guesses the provider type from a model name.
func inferProviderFromModel(model string) ProviderType {
	if p, ok := DefaultModelProviderMap[model]; ok {
		return p
	}
	ml := strings.ToLower(model)
	if strings.HasPrefix(ml, "gpt") {
		return ProviderTypeOpenAI
	}
	if strings.HasPrefix(ml, "claude") {
		return ProviderTypeAnthropic
	}
	if strings.HasPrefix(ml, "deepseek") {
		return ProviderTypeDeepSeek
	}
	for prefix, p := range DefaultModelProviderMap {
		if strings.HasPrefix(ml, prefix) {
			return p
		}
	}
	return ""
}

// ProviderRegistry holds a set of named LLMProvider implementations and
// resolves a provider from a model name.
type ProviderRegistry struct {
	mu          sync.RWMutex
	providers   map[ProviderType]LLMProvider
	enabled     map[ProviderType]bool
	tokenPools  map[ProviderType]*TokenPool
	healthMu    sync.Mutex
	healthStats map[ProviderType]*HealthStat
}

// NewProviderRegistry creates an empty registry.
func NewProviderRegistry() *ProviderRegistry {
	return &ProviderRegistry{
		providers:   make(map[ProviderType]LLMProvider),
		enabled:     make(map[ProviderType]bool),
		tokenPools:  make(map[ProviderType]*TokenPool),
		healthStats: make(map[ProviderType]*HealthStat),
	}
}

// Register stores a provider under its Name(). The provider is considered
// enabled by default; use Enable/Disable to change state.
func (r *ProviderRegistry) Register(p LLMProvider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	name := p.Name()
	r.providers[name] = p
	if _, ok := r.enabled[name]; !ok {
		r.enabled[name] = true
	}
	r.healthMu.Lock()
	if _, ok := r.healthStats[name]; !ok {
		r.healthStats[name] = &HealthStat{Name: name, Enabled: true}
	}
	r.healthStats[name].Enabled = r.enabled[name]
	r.healthMu.Unlock()
}

// Enable marks a provider as available for resolution.
func (r *ProviderRegistry) Enable(name ProviderType) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.enabled[name] = true
	r.healthMu.Lock()
	if s, ok := r.healthStats[name]; ok {
		s.Enabled = true
	}
	r.healthMu.Unlock()
}

// Disable prevents a provider from being resolved (but keeps it registered).
func (r *ProviderRegistry) Disable(name ProviderType) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.enabled[name] = false
	r.healthMu.Lock()
	if s, ok := r.healthStats[name]; ok {
		s.Enabled = false
	}
	r.healthMu.Unlock()
}

// IsEnabled reports whether a provider is currently enabled.
func (r *ProviderRegistry) IsEnabled(name ProviderType) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.enabled[name]
}

// Get returns the registered provider by exact name.
func (r *ProviderRegistry) Get(name ProviderType) (LLMProvider, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.providers[name]
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrProviderNotFound, name)
	}
	if !r.enabled[name] {
		return nil, fmt.Errorf("%w %q (disabled)", ErrProviderNotFound, name)
	}
	return p, nil
}

// Resolve picks a provider for a model string:
//  1. if model is empty, return ErrInvalidModel
//  2. if the model name is a registered provider name, use that
//  3. otherwise infer from DefaultModelProviderMap / prefix matching
//  4. return the first enabled provider as a last resort
func (r *ProviderRegistry) Resolve(model string) (LLMProvider, error) {
	model = strings.TrimSpace(model)
	if model == "" {
		return nil, ErrInvalidModel
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	if p, ok := r.providers[ProviderType(model)]; ok && r.enabled[ProviderType(model)] {
		return p, nil
	}

	inferred := inferProviderFromModel(model)
	if inferred != "" {
		if p, ok := r.providers[inferred]; ok && r.enabled[inferred] {
			return p, nil
		}
		return nil, fmt.Errorf("%w: %q (model %q inferred provider)", ErrProviderNotFound, inferred, model)
	}

	for name, enabled := range r.enabled {
		if enabled {
			p, ok := r.providers[name]
			if ok {
				return p, nil
			}
		}
	}
	return nil, fmt.Errorf("%w: no enabled provider for model %q", ErrProviderNotFound, model)
}

// Providers returns a copy of the set of registered provider names.
func (r *ProviderRegistry) Providers() []ProviderType {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]ProviderType, 0, len(r.providers))
	for name := range r.providers {
		names = append(names, name)
	}
	return names
}

// Call resolves a provider for the request and invokes Chat with automatic
// failover. On rate-limit errors, it tries the next enabled provider.
// Context cancellation is propagated; the first successful response wins.
func (r *ProviderRegistry) Call(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	r.mu.RLock()
	var providers []ProviderType
	for name := range r.providers {
		if r.enabled[name] {
			providers = append(providers, name)
		}
	}
	tokenPools := make(map[ProviderType]*TokenPool)
	for name, pool := range r.tokenPools {
		tokenPools[name] = pool
	}
	r.mu.RUnlock()

	if len(providers) == 0 {
		return nil, fmt.Errorf("%w: no enabled provider", ErrProviderNotFound)
	}

	// Build resolution order: preferred provider first, then the rest.
	var order []ProviderType
	preferred, resolveErr := r.Resolve(req.Model)
	if resolveErr == nil {
		order = append(order, preferred.Name())
	}
	for _, name := range providers {
		if resolveErr != nil || name != preferred.Name() {
			order = append(order, name)
		}
	}
	// Deduplicate
	seen := make(map[ProviderType]bool)
	deduped := make([]ProviderType, 0, len(order))
	for _, n := range order {
		if !seen[n] {
			seen[n] = true
			deduped = append(deduped, n)
		}
	}
	order = deduped

	var lastErr error
	for _, name := range order {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		if pool := tokenPools[name]; pool != nil && pool.Available <= 0 {
			if lastErr == nil {
				lastErr = fmt.Errorf("provider %q: token pool exhausted (capacity %d)", name, pool.Capacity)
			}
			continue
		}

		r.mu.RLock()
		p := r.providers[name]
		r.mu.RUnlock()
		if p == nil {
			continue
		}

		resp, err := p.Chat(ctx, req)
		r.recordHealth(name, err == nil, err)

		if err == nil {
			if pool := tokenPools[name]; pool != nil && resp.TotalTokens > 0 {
				pool.Available -= int64(resp.TotalTokens)
				pool.Consumed += int64(resp.TotalTokens)
			}
			return resp, nil
		}

		if strings.Contains(err.Error(), "rate") {
			lastErr = err
			continue
		}
		return nil, err
	}
	return nil, lastErr
}

// SetTokenLimit sets the token budget for a provider.
func (r *ProviderRegistry) SetTokenLimit(name ProviderType, limit int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tokenPools[name] = &TokenPool{Name: name, Capacity: limit, Available: limit}
}

// TokenPool returns the current token pool for a provider, or nil if unset.
func (r *ProviderRegistry) TokenPool(name ProviderType) *TokenPool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.tokenPools[name]
}

// Health returns a copy of health statistics for all registered providers.
func (r *ProviderRegistry) Health(_ context.Context) map[ProviderType]HealthStat {
	r.healthMu.Lock()
	defer r.healthMu.Unlock()
	out := make(map[ProviderType]HealthStat)
	for name, s := range r.healthStats {
		out[name] = *s
	}
	return out
}

// recordHealth updates per-provider health counters.
func (r *ProviderRegistry) recordHealth(name ProviderType, ok bool, err error) {
	r.healthMu.Lock()
	defer r.healthMu.Unlock()
	s, exists := r.healthStats[name]
	if !exists {
		s = &HealthStat{Name: name}
		r.healthStats[name] = s
	}
	s.TotalCalls++
	if ok {
		s.Success++
	} else if err != nil {
		s.Error = err.Error()
	}
}
