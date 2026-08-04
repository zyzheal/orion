package llmprovider

import (
	"time"
)

// ProviderHealth represents the observed health of a single LLM provider.
type ProviderHealth struct {
	Name       ProviderType `json:"name"`
	Enabled    bool         `json:"enabled"`
	Reachable  bool         `json:"reachable"`
	TotalCalls int64        `json:"totalCalls"`
	Success    int64        `json:"success"`
	LastError  string       `json:"lastError"`
	LastCheck  time.Time    `json:"lastCheck"`
	LatencyMs  int64        `json:"latencyMs"`
}

// SuccessRate returns the success rate (0-100) as a percentage.
// Returns 100.0 when no calls have been made.
func (h ProviderHealth) SuccessRate() float64 {
	if h.TotalCalls == 0 {
		return 100.0
	}
	return float64(h.Success) / float64(h.TotalCalls) * 100.0
}
