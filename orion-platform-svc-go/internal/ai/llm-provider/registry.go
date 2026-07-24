package llmprovider

import (
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

// DefaultModelProviderMap maps well-known model names to their provider type.
var DefaultModelProviderMap = map[string]ProviderType{
	"gpt-4":           ProviderTypeOpenAI,
	"gpt-4o":          ProviderTypeOpenAI,
	"gpt-4o-mini":     ProviderTypeOpenAI,
	"gpt-4-turbo":     ProviderTypeOpenAI,
	"gpt-3.5-turbo":   ProviderTypeOpenAI,
	"claude-opus":     ProviderTypeAnthropic,
	"claude-sonnet":   ProviderTypeAnthropic,
	"claude-3-opus":   ProviderTypeAnthropic,
	"claude-3-sonnet": ProviderTypeAnthropic,
	"claude-3-haiku":  ProviderTypeAnthropic,
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
	// fallback: try prefix matching by well-known model families
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
	mu        sync.RWMutex
	providers map[ProviderType]LLMProvider
	enabled   map[ProviderType]bool // enabled flag per provider
}

// NewProviderRegistry creates an empty registry.
func NewProviderRegistry() *ProviderRegistry {
	return &ProviderRegistry{
		providers: make(map[ProviderType]LLMProvider),
		enabled:   make(map[ProviderType]bool),
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
}

// Enable marks a provider as available for resolution.
func (r *ProviderRegistry) Enable(name ProviderType) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.enabled[name] = true
}

// Disable prevents a provider from being resolved (but keeps it registered).
func (r *ProviderRegistry) Disable(name ProviderType) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.enabled[name] = false
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

	// Step 1: model string might actually be a registered provider name
	if p, ok := r.providers[ProviderType(model)]; ok && r.enabled[ProviderType(model)] {
		return p, nil
	}

	// Step 2: infer from well-known model names
	inferred := inferProviderFromModel(model)
	if inferred != "" {
		if p, ok := r.providers[inferred]; ok && r.enabled[inferred] {
			return p, nil
		}
		return nil, fmt.Errorf("%w: %q (model %q inferred provider)", ErrProviderNotFound, inferred, model)
	}

	// Step 3: fallback to first enabled provider
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
