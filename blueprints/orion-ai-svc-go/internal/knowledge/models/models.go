package models

import "time"

// KnowledgeBase represents a knowledge base for RAG.
type KnowledgeBase struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	IsEnabled   bool      `json:"is_enabled" db:"is_enabled"`
	EmbeddingModel string `json:"embedding_model" db:"embedding_model"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// Document represents a document in a knowledge base.
type Document struct {
	ID          string    `json:"id" db:"id"`
	BaseID      string    `json:"base_id" db:"base_id"`
	Title       string    `json:"title" db:"title"`
	Content     string    `json:"content" db:"content"`
	Embedding   []float64 `json:"embedding" db:"embedding"`
	Metadata    string    `json:"metadata" db:"metadata"`
	Status      string    `json:"status" db:"status"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// QueryRequest for semantic search.
type QueryRequest struct {
	BaseID    string  `json:"base_id" binding:"required"`
	Query     string  `json:"query" binding:"required"`
	TopK      int     `json:"top_k"`
	Filters   string  `json:"filters"`
	ScoreThresh float64 `json:"score_threshold"`
}

// SearchResult represents a search result.
type SearchResult struct {
	ID      string    `json:"id"`
	Title   string    `json:"title"`
	Content string    `json:"content"`
	Score   float64   `json:"score"`
}

// CreateBaseRequest for creating a knowledge base.
type CreateBaseRequest struct {
	Name         string `json:"name" binding:"required"`
	Description  string `json:"description"`
	EmbeddingModel string `json:"embedding_model"`
}

// DocumentResponse wraps document query results.
type DocumentResponse struct {
	Total int64      `json:"total"`
	Data  []Document `json:"data"`
}

// KnowledgeBaseResponse wraps knowledge base query results.
type KnowledgeBaseResponse struct {
	Total int64           `json:"total"`
	Data  []KnowledgeBase `json:"data"`
}

// SearchResponse wraps search results.
type SearchResponse struct {
	Query  string         `json:"query"`
	TopK   int            `json:"top_k"`
	Results []SearchResult `json:"results"`
}
