package models

import "time"

// CodeEmbedding represents an embedding for a code snippet.
type CodeEmbedding struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	RepoID    string    `json:"repo_id"`
	FilePath  string    `json:"file_path"`
	Language  string    `json:"language"`
	Content   string    `json:"content"`
	Vector    []float64 `json:"vector"`
	Model     string    `json:"model"`
	CreatedAt time.Time `json:"created_at"`
}

// EmbedRequest for generating an embedding.
type EmbedRequest struct {
	RepoID   string                 `json:"repo_id" binding:"required"`
	FilePath string                 `json:"file_path" binding:"required"`
	Language string                 `json:"language"`
	Content  string                 `json:"content" binding:"required"`
	Model    string                 `json:"model"`
}

// SearchRequest for searching code embeddings.
type SearchRequest struct {
	RepoID    string    `json:"repo_id" binding:"required"`
	Query     string    `json:"query" binding:"required"`
	Language  string    `json:"language"`
	TopK      int       `json:"top_k"`
	ScoreThresh float64 `json:"score_threshold"`
}

// SearchResult for code embedding search.
type SearchResult struct {
	ID        string    `json:"id"`
	RepoID    string    `json:"repo_id"`
	FilePath  string    `json:"file_path"`
	Language  string    `json:"language"`
	Content   string    `json:"content"`
	Score     float64   `json:"score"`
	CreatedAt time.Time `json:"created_at"`
}

// EmbedResponse wraps embedding result.
type EmbedResponse struct {
	Embedding *CodeEmbedding `json:"embedding"`
}

// SearchResponse wraps search results.
type SearchResponse struct {
	Query   string         `json:"query"`
	TopK    int            `json:"top_k"`
	Results []SearchResult `json:"results"`
}
