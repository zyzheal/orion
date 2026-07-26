package models

import "time"

// SearchRequest for semantic search.
type SearchRequest struct {
	Query      string          `json:"query" binding:"required"`
	Sources    []SearchSource  `json:"sources"`
	TopK       int             `json:"top_k"`
	Language   string          `json:"language"`
	MaxTokens  int             `json:"max_tokens"`
}

// SearchSource specifies a data source.
type SearchSource struct {
	Type     string `json:"type" binding:"required"` // knowledge, vector, external
	ID       string `json:"id"`
	Weight   float64 `json:"weight"`
	Filters  string  `json:"filters"`
}

// SearchResult represents a single result.
type SearchResult struct {
	ID       string    `json:"id"`
	Source   string    `json:"source"`
	Title    string    `json:"title"`
	Content  string    `json:"content"`
	Score    float64   `json:"score"`
	Metadata string    `json:"metadata"`
}

// SearchResponse wraps search results.
type SearchResponse struct {
	Query       string         `json:"query"`
	TopK        int            `json:"top_k"`
	Total       int64          `json:"total"`
	Results     []SearchResult `json:"results"`
	Summary     string         `json:"summary"`
	SearchTime  time.Duration  `json:"search_time"`
}

// IndexRequest for indexing content.
type IndexRequest struct {
	Source  string `json:"source" binding:"required"`
	Content string `json:"content" binding:"required"`
	Title   string `json:"title"`
	Metadata string `json:"metadata"`
}
