package models

import (
	"encoding/json"
	"time"
)

// CodeEmbedding represents an embedding for a code snippet.
type CodeEmbedding struct {
	ID        string          `json:"id" db:"id"`
	TenantID  string          `json:"tenant_id" db:"tenant_id"`
	RepoID    string          `json:"repo_id" db:"repo_id"`
	FilePath  string          `json:"file_path" db:"file_path"`
	Language  string          `json:"language" db:"language"`
	Content   string          `json:"content" db:"content"`
	Vector    json.RawMessage `json:"vector" db:"vector"`
	Model     string          `json:"model" db:"model"`
	CreatedAt time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt time.Time       `json:"updated_at" db:"updated_at"`
}

// VectorAsFloats returns Vector decoded as []float64.
func (e *CodeEmbedding) VectorAsFloats() ([]float64, error) {
	var v []float64
	if e.Vector == nil || len(e.Vector) == 0 {
		return nil, nil
	}
	return v, json.Unmarshal(e.Vector, &v)
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
	RepoID      string  `json:"repo_id" binding:"required"`
	Query       string  `json:"query" binding:"required"`
	Language    string  `json:"language"`
	TopK        int     `json:"top_k"`
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

// EmbedStats tracks embedding storage statistics.
type EmbedStats struct {
	TotalEmbeddings int `json:"totalEmbeddings" db:"total_embeddings"`
	TotalRepos      int `json:"totalRepos" db:"total_repos"`
}