package models

import "time"

// Space represents a knowledge space (workspace/namespace).
type Space struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Type        string    `json:"type" db:"type"` // public, internal, private
	Description string    `json:"description" db:"description"`
	TeamID      string    `json:"team_id,omitempty" db:"team_id"`
	OwnerID     string    `json:"owner_id" db:"owner_id"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// Document represents a knowledge document.
type Document struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Title     string    `json:"title" db:"title"`
	Content   string    `json:"content" db:"content"`
	SpaceID   string    `json:"space_id" db:"space_id"`
	Tags      []string  `json:"tags,omitempty" db:"tags"`
	Status    string    `json:"status" db:"status"` // draft, published, archived
	AuthorID  string    `json:"author_id" db:"author_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// DocVersion represents a document version entry.
type DocVersion struct {
	ID         int       `json:"id" db:"id"`
	DocumentID string    `json:"document_id" db:"document_id"`
	Content    string    `json:"content" db:"content"`
	AuthorID   string    `json:"author_id" db:"author_id"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// SyncLog represents a document center sync log entry.
type SyncLog struct {
	ID        int       `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Source    string    `json:"source" db:"source"`
	Status    string    `json:"status" db:"status"` // running, completed, failed
	ErrorMsg  string    `json:"error_msg" db:"error_msg"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// --- Request models ---

type CreateSpaceRequest struct {
	Name        string `json:"name" binding:"required"`
	Type        string `json:"type"`
	Description string `json:"description"`
	TeamID      string `json:"team_id"`
	OwnerID     string `json:"owner_id"`
}

type UpdateSpaceRequest struct {
	Name        *string `json:"name"`
	Type        *string `json:"type"`
	Description *string `json:"description"`
	TeamID      *string `json:"team_id"`
}

type CreateDocumentRequest struct {
	Title    string   `json:"title" binding:"required"`
	Content  string   `json:"content" binding:"required"`
	SpaceID  string   `json:"space_id" binding:"required"`
	Tags     []string `json:"tags"`
	Status   string   `json:"status"`
	AuthorID string   `json:"author_id"`
}

type UpdateDocumentRequest struct {
	Title   *string   `json:"title"`
	Content *string   `json:"content"`
	Tags    *[]string `json:"tags"`
	Status  *string   `json:"status"`
}

type SyncTriggerRequest struct {
	Source string `json:"source"`
}

// --- RAG models ---

// RAGRetrieveResult is the raw internal result from the repository.
type RAGRetrieveResult struct {
	ID         string
	Title      string
	Content    string
	SpaceID    string
	Similarity float64
}

type RetrieveRequest struct {
	Query   string `json:"query" binding:"required"`
	SpaceID string `json:"space_id"`
	TopK    *int   `json:"top_k"`
}

type RetrieveResult struct {
	ID      string  `json:"doc_id"`
	Title   string  `json:"title"`
	Snippet string  `json:"snippet"`
	Score   float64 `json:"score"`
}

type RetrieveResponse struct {
	Results []RetrieveResult `json:"results"`
	Total   int              `json:"total"`
}

type RAGQueryRequest struct {
	Query   string `json:"query" binding:"required"`
	SpaceID string `json:"space_id"`
	TopK    *int   `json:"top_k"`
}

type RAGQueryResponse struct {
	Answer     string      `json:"answer"`
	Sources    []RAGSource `json:"sources"`
	Confidence float64     `json:"confidence"`
}

type RAGSource struct {
	DocumentID     string  `json:"document_id"`
	Title          string  `json:"title"`
	Snippet        string  `json:"snippet"`
	RelevanceScore float64 `json:"relevance_score"`
	SpaceID        string  `json:"space_id"`
}

// --- Knowledge Graph models ---

type GraphNode struct {
	ID      string `json:"id"`
	Type    string `json:"type"` // space, doc, tag
	Label   string `json:"label"`
	SpaceID string `json:"space_id,omitempty"`
}

type GraphEdge struct {
	Source   string `json:"source"`
	Target   string `json:"target"`
	Relation string `json:"relation"` // contains, tagged
}

type GraphResponse struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

// --- Query helpers ---

type SpaceListQuery struct {
	Type   string
	Search string
	Limit  int
	Offset int
}

type DocListQuery struct {
	SpaceID string
	Status  string
	Tag     string
	Search  string
	Limit   int
	Offset  int
}

// --- Response envelope helpers ---

type PaginatedResponse struct {
	Data any  `json:"data"`
	Meta Meta `json:"meta"`
}

type Meta struct {
	Total   int    `json:"total"`
	Page    int    `json:"page"`
	PerPage int    `json:"per_page"`
	Type    string `json:"type,omitempty"`
}
