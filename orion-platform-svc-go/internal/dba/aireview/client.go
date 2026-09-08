package aireview

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// DefaultAITimeout caps the wall-clock of a single AI review call.
// The reviewer treats timeouts as soft failures: local findings still win.
const DefaultAITimeout = 30 * time.Second

// DefaultRateLimitPerMinute caps the number of AI calls per tenant.
const DefaultRateLimitPerMinute = 10

// DefaultAIModel is the model name used when no override is supplied.
// It is resolved from DBA_AI_MODEL on first use so operators can swap
// providers without recompiling. Falls back to "gpt-4o-mini" for the
// zero-config case — the AIClient remains fully usable out of the box.
var DefaultAIModel = loadDefaultAIModel()

// loadDefaultAIModel reads DBA_AI_MODEL once at package init. Cached so
// subsequent calls do not re-hit os.Getenv; tests can set the env before
// importing this package to override the default model name.
func loadDefaultAIModel() string {
	if v := strings.TrimSpace(os.Getenv("DBA_AI_MODEL")); v != "" {
		return v
	}
	return "gpt-4o-mini"
}

// aiChatRequest mirrors the OpenAI-compatible chat completion body.
type aiChatRequest struct {
	Model       string       `json:"model"`
	Messages    []aiMessage  `json:"messages"`
	Temperature float64      `json:"temperature,omitempty"`
	MaxTokens   int          `json:"max_tokens,omitempty"`
	Stream      bool         `json:"stream"`
}

type aiMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type aiChatResponse struct {
	ID      string     `json:"id"`
	Model   string     `json:"model"`
	Choices []aiChoice `json:"choices"`
}

type aiChoice struct {
	Message      aiMessage `json:"message"`
	FinishReason string    `json:"finish_reason"`
}

// AIClient is a minimal OpenAI-compatible HTTP client for the review module.
// It is intentionally self-contained so aireview does not depend on the
// wider llm-provider stack. Wire it via NewAIClient(baseURL, apiKey, model);
// pass empty baseURL/apiKey to disable the AI path entirely.
type AIClient struct {
	baseURL      string
	apiKey       string
	model        string
	httpClient   *http.Client
	timeout      time.Duration
	maxTokens    int
	temperature  float64

	mu             sync.Mutex
	tenantCalls    map[string]int64
	rateLimit      int
	lastSweepMinute int64 // epoch minute of the last stale-key cleanup
}

// AIClientConfig carries optional overrides for NewAIClientWithConfig.
type AIClientConfig struct {
	BaseURL     string
	APIKey      string
	Model       string
	HTTPClient  *http.Client
	Timeout     time.Duration
	MaxTokens   int
	Temperature float64
	// RateLimitPerTenant caps calls per tenant per minute. 0 disables
	// rate limiting. Defaults to DefaultRateLimitPerMinute (10).
	RateLimitPerTenant int
}

// NewAIClient creates a client with the given base config. When baseURL
// or apiKey is empty, IsEnabled() returns false and Review short-circuits.
func NewAIClient(baseURL, apiKey, model string) *AIClient {
	return NewAIClientWithConfig(AIClientConfig{
		BaseURL: baseURL,
		APIKey:  apiKey,
		Model:   model,
	})
}

// NewAIClientWithConfig creates a client with full config overrides.
func NewAIClientWithConfig(cfg AIClientConfig) *AIClient {
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = &http.Client{}
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = DefaultAITimeout
	}
	if cfg.MaxTokens <= 0 {
		cfg.MaxTokens = 2048
	}
	if cfg.Temperature <= 0 {
		cfg.Temperature = 0.2
	}
	if cfg.RateLimitPerTenant <= 0 {
		cfg.RateLimitPerTenant = DefaultRateLimitPerMinute
	}
	if cfg.Model == "" {
		cfg.Model = DefaultAIModel
	}
	return &AIClient{
		baseURL:     strings.TrimRight(cfg.BaseURL, "/"),
		apiKey:      cfg.APIKey,
		model:       cfg.Model,
		httpClient:  cfg.HTTPClient,
		timeout:     cfg.Timeout,
		maxTokens:   cfg.MaxTokens,
		temperature: cfg.Temperature,
		tenantCalls: make(map[string]int64),
		rateLimit:   cfg.RateLimitPerTenant,
	}
}

// IsEnabled reports whether the client is configured to actually call AI.
func (c *AIClient) IsEnabled() bool {
	if c == nil {
		return false
	}
	return c.baseURL != "" && c.apiKey != ""
}

// Model returns the configured model name.
func (c *AIClient) Model() string {
	if c == nil || c.model == "" {
		return ""
	}
	return c.model
}

// Review sends the given prompt and returns structured suggestions.
// On rate-limit overflow this returns ErrRateLimited so the caller can
// degrade to a local-only result without treating it as a hard failure.
func (c *AIClient) Review(ctx context.Context, prompt string) ([]AISuggestion, string, error) {
	if !c.IsEnabled() {
		return []AISuggestion{}, "", ErrAIDisabled
	}
	if err := c.checkRateLimit(ctx, ""); err != nil {
		return []AISuggestion{}, c.model, err
	}
	return c.reviewWithTenant(ctx, prompt, "")
}

// ReviewForTenant is like Review but records the tenant key against the
// rate-limit bucket. Tenants with an empty ID share a global bucket.
func (c *AIClient) ReviewForTenant(ctx context.Context, prompt, tenantID string) ([]AISuggestion, string, error) {
	if !c.IsEnabled() {
		return []AISuggestion{}, "", ErrAIDisabled
	}
	if err := c.checkRateLimit(ctx, tenantID); err != nil {
		return []AISuggestion{}, c.model, err
	}
	return c.reviewWithTenant(ctx, prompt, tenantID)
}

// ErrAIDisabled is returned when the client is not configured. Callers
// should treat this as "no AI review was attempted" rather than a failure.
var ErrAIDisabled = fmt.Errorf("aireview: ai client not configured")

// ErrRateLimited is returned when the per-tenant rate limit is exceeded.
var ErrRateLimited = fmt.Errorf("aireview: ai rate limit exceeded")

func (c *AIClient) reviewWithTenant(ctx context.Context, prompt, tenantID string) ([]AISuggestion, string, error) {
	if c.baseURL == "" {
		return []AISuggestion{}, c.model, ErrAIDisabled
	}

	callCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	body := aiChatRequest{
		Model:       c.model,
		Messages: []aiMessage{
			{Role: "user", Content: prompt},
		},
		Temperature: c.temperature,
		MaxTokens:   c.maxTokens,
		Stream:      false,
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return []AISuggestion{}, c.model, fmt.Errorf("aireview: marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(callCtx, http.MethodPost, c.requestURL(), bytes.NewReader(payload))
	if err != nil {
		return []AISuggestion{}, c.model, fmt.Errorf("aireview: build request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		// Context deadline exceeded or network error — surface so the
		// caller can note the AI failure without failing the review.
		return []AISuggestion{}, c.model, fmt.Errorf("aireview: http call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return []AISuggestion{}, c.model, fmt.Errorf("aireview: ai http %d: %s", resp.StatusCode, strings.TrimSpace(string(snippet)))
	}

	rawBody, err := io.ReadAll(io.LimitReader(resp.Body, 8*1024*1024))
	if err != nil {
		return []AISuggestion{}, c.model, fmt.Errorf("aireview: read body: %w", err)
	}

	var aiResp aiChatResponse
	if err := json.Unmarshal(rawBody, &aiResp); err != nil {
		return []AISuggestion{}, c.model, fmt.Errorf("aireview: decode response: %w", err)
	}
	content := ""
	if len(aiResp.Choices) > 0 {
		content = aiResp.Choices[0].Message.Content
	}
	model := aiResp.Model
	if model == "" {
		model = c.model
	}

	// Strict JSON parse with graceful degradation: any error here returns
	// an empty suggestion list, not a hard error. The rule from the task
	// spec: "parse errors return []AISuggestion{} not error".
	suggestions, _ := parseAIResponse([]byte(content))
	if suggestions == nil {
		suggestions = []AISuggestion{}
	}
	return suggestions, model, nil
}

func (c *AIClient) requestURL() string {
	base := strings.TrimRight(c.baseURL, "/")
	// Support both "http://host" and "http://host/v1" forms. If the base
	// already ends in /v1 we append /chat/completions directly, otherwise
	// we include the /v1 prefix.
	if strings.HasSuffix(base, "/v1") {
		return base + "/chat/completions"
	}
	return base + "/v1/chat/completions"
}

// checkRateLimit implements a simple per-tenant counter. It is not
// persistent across process restarts — good enough for a soft cap.
// A production deployment should use Redis for durable counters.
//
// Cleanup strategy: stale keys (from previous minutes) are swept only when
// the current epoch minute differs from lastSweepMinute. This avoids
// O(N) map traversal on every call — the sweep runs at most once per minute.
func (c *AIClient) checkRateLimit(_ context.Context, tenantID string) error {
	if c.rateLimit <= 0 {
		return nil
	}
	key := tenantID
	if key == "" {
		key = "_global"
	}
	now := time.Now().Unix()
	curMinute := now / 60
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.tenantCalls == nil {
		c.tenantCalls = make(map[string]int64)
	}

	// Sweep stale keys only when the minute has changed since the last
	// cleanup. This bounds the sweep to once per minute instead of once
	// per call.
	if curMinute != c.lastSweepMinute {
		suffix := fmt.Sprintf("@%d", curMinute)
		for k := range c.tenantCalls {
			if !strings.HasSuffix(k, suffix) {
				delete(c.tenantCalls, k)
			}
		}
		c.lastSweepMinute = curMinute
	}

	minuteKey := fmt.Sprintf("%s@%d", key, curMinute)
	c.tenantCalls[minuteKey]++
	count := c.tenantCalls[minuteKey]
	if count > int64(c.rateLimit) {
		return ErrRateLimited
	}
	return nil
}

// ResetRateLimits clears the per-tenant counters. Test helper.
func (c *AIClient) ResetRateLimits() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.tenantCalls = make(map[string]int64)
}
