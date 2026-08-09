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
	Type     string  `json:"type" binding:"required"` // knowledge, vector, external
	ID       string  `json:"id"`
	Weight   float64 `json:"weight"`
	Filters  string  `json:"filters"`
}

// SearchResult represents a single result.
type SearchResult struct {
	ID        string    `json:"id"`
	Source    string    `json:"source"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Score     float64   `json:"score"`
	Metadata  string    `json:"metadata"`
	Rank      int       `json:"rank,omitempty"`
	FusedScore float64  `json:"fused_score,omitempty"`
}

// SearchResponse wraps search results.
type SearchResponse struct {
	Query      string         `json:"query"`
	TopK       int            `json:"top_k"`
	Total      int64          `json:"total"`
	Results    []SearchResult `json:"results"`
	Summary    string         `json:"summary"`
	SearchTime time.Duration  `json:"search_time"`
}

// IndexRequest for indexing content.
type IndexRequest struct {
	Source   string `json:"source" binding:"required"`
	Content  string `json:"content" binding:"required"`
	Title    string `json:"title"`
	Metadata string `json:"metadata"`
}

// SearchConfig holds hybrid search tuning parameters.
type SearchConfig struct {
	ID                 string  `json:"id"`
	TenantID           string  `json:"tenant_id"`
	HybridEnabled      bool    `json:"hybrid_enabled"`
	VectorWeight       float64 `json:"vector_weight"`
	KeywordWeight      float64 `json:"keyword_weight"`
	RRFEnabled         bool    `json:"rrf_enabled"`
	RRFK               int     `json:"rrf_k"`
	VectorTopK         int     `json:"vector_top_k"`
	KeywordTopK        int     `json:"keyword_top_k"`
	MinScoreThreshold  float64 `json:"min_score_threshold"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// SetDefaults fills in sensible defaults for SearchConfig.
func (c *SearchConfig) SetDefaults() {
	if c.RRFK <= 0 {
		c.RRFK = 60
	}
	if c.VectorTopK <= 0 {
		c.VectorTopK = 100
	}
	if c.KeywordTopK <= 0 {
		c.KeywordTopK = 100
	}
	if c.VectorWeight <= 0 && c.KeywordWeight <= 0 {
		c.VectorWeight = 0.6
		c.KeywordWeight = 0.4
	}
}

// DefaultSearchConfig returns a SearchConfig with standard defaults.
func DefaultSearchConfig() SearchConfig {
	return SearchConfig{
		HybridEnabled:     true,
		VectorWeight:      0.6,
		KeywordWeight:     0.4,
		RRFEnabled:        true,
		RRFK:              60,
		VectorTopK:        100,
		KeywordTopK:       100,
		MinScoreThreshold: 0.0,
	}
}
