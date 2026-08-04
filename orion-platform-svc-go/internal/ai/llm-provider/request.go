package llmprovider

import "time"

// RequestOptions holds optional parameters that can be passed alongside a
// ChatRequest to influence provider selection, retry behaviour, and
// timeout handling. These options are understood by ProviderRegistry.CallWithOptions.
type RequestOptions struct {
	// PreferredProvider constrains resolution to this provider type when set.
	// If the provider is unavailable, the registry will NOT fall back.
	PreferredProvider ProviderType

	// MaxAttempts caps the number of retry attempts across providers before
	// returning an error. A value of 0 means "try all enabled providers".
	MaxAttempts int

	// TimeoutPerProvider limits the duration of a single provider call.
	// A value of 0 means "no per-provider timeout (use the context timeout)".
	TimeoutPerProvider time.Duration

	// RequireStreaming when true causes CallWithOptions to use ChatStream
	// instead of Chat for each provider attempt.
	RequireStreaming bool
}

// ChatMessage is an alias for the existing Message type; retained for callers
// that prefer the ChatMessage / CompletionResponse naming convention.
type ChatMessage = Message

// CompletionResponse is an alias for the existing ChatResponse type; retained
// for callers that prefer the ChatMessage / CompletionResponse naming convention.
type CompletionResponse = ChatResponse
