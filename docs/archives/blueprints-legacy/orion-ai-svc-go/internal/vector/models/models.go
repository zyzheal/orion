package models

import "time"

// VectorStore represents a vector database store.
type VectorStore struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	Name          string    `json:"name" db:"name"`
	Dimensions    int       `json:"dimensions" db:"dimensions"`
	Metric        string    `json:"metric" db:"metric"`
	VectorCount   int64     `json:"vector_count" db:"vector_count"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// Vector represents a single vector entry.
type Vector struct {
	ID         string      `json:"id" db:"id"`
	StoreID    string      `json:"store_id" db:"store_id"`
	Data       []float64   `json:"data" db:"data"`
	Payload    string      `json:"payload" db:"payload"`
	CreatedAt  time.Time   `json:"created_at" db:"created_at"`
}

// SearchRequest for vector search.
type SearchRequest struct {
	StoreID string     `json:"store_id" binding:"required"`
	Query   []float64  `json:"query" binding:"required"`
	TopK    int        `json:"top_k"`
}

// SearchResult for vector search.
type SearchResult struct {
	ID      string    `json:"id"`
	Payload string    `json:"payload"`
	Score   float64   `json:"score"`
}

// CreateStoreRequest for creating a vector store.
type CreateStoreRequest struct {
	Name       string `json:"name" binding:"required"`
	Dimensions int    `json:"dimensions" binding:"required,min=1"`
	Metric     string `json:"metric"`
}

// VectorResponse wraps vector query results.
type VectorResponse struct {
	Total int64    `json:"total"`
	Data  []Vector `json:"data"`
}

// SearchResponse wraps search results.
type SearchResponse struct {
	Query  []SearchResult `json:"query"`
	TopK   int            `json:"top_k"`
}
