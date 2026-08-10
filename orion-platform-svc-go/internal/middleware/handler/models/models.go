package models

type RateLimitConfig struct {
        Rate      int           `json:"rate"`
        Burst     int           `json:"burst"`
        Window    string        `json:"window"`
        Endpoints []Endpoint    `json:"endpoints"`
}

type Endpoint struct {
        Path    string `json:"path"`
        Methods []string `json:"methods"`
}

type MiddlewareStats struct {
        RateLimitEndpoints int    `json:"rate_limit_endpoints"`
        TimeoutDefault     string `json:"timeout_default"`
        TracingEnabled     bool   `json:"tracing_enabled"`
}

type MiddlewareUpdateRequest struct {
        RateLimitConfig *RateLimitConfig `json:"rate_limit_config,omitempty"`
        Timeout         string           `json:"timeout,omitempty"`
}
