package models

import "time"

type GatewayRequest struct {
	Model       string  `json:"model" binding:"required"`
	Provider    string  `json:"provider"`
	Input       string  `json:"input" binding:"required"`
	MaxTokens   int     `json:"maxTokens"`
	Temperature float64 `json:"temperature"`
}

type GatewayResponse struct {
	ID        string    `json:"id"`
	Model     string    `json:"model"`
	Provider  string    `json:"provider"`
	Input     string    `json:"input"`
	Output    string    `json:"output"`
	Tokens    int       `json:"tokens"`
	LatencyMs int64     `json:"latencyMs"`
	CreatedAt time.Time `json:"createdAt"`
}

type ListQuery struct {
	Provider string `json:"provider"`
	Limit    int    `json:"limit"`
}
