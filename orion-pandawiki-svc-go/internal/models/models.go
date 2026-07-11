package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a custom type for JSONB columns in PostgreSQL.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// JSONArray is a custom type for JSON arrays in PostgreSQL.
type JSONArray []string

func (a JSONArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}

func (a *JSONArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into JSONArray", src)
	}
}

// ============================================================================
// Space models
// ============================================================================

type SpaceType string

const (
	SpaceTypePublic   SpaceType = "public"
	SpaceTypeInternal SpaceType = "internal"
	SpaceTypePrivate  SpaceType = "private"
	SpaceTypeDocs     SpaceType = "docs"
)

type ContentSource string

const (
	SourceManual ContentSource = "manual"
	SourceSynced ContentSource = "synced"
)

// Space represents a knowledge space (logical grouping of documents).
type Space struct {
	ID          string        `db:"id" json:"id"`
	TenantID    string        `db:"tenant_id" json:"tenant_id"`
	Name        string        `db:"name" json:"name"`
	Type        SpaceType     `db:"type" json:"type"`
	Source      ContentSource `db:"source" json:"source,omitempty"`
	OwnerID     string        `db:"owner_id" json:"owner_id"`
	TeamID      *string       `db:"team_id" json:"team_id,omitempty"`
	Description *string       `db:"description" json:"description,omitempty"`
	DocCount    int           `db:"doc_count" json:"doc_count"`
	CreatedAt   time.Time     `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time     `db:"updated_at" json:"updated_at"`
}

// CreateSpaceRequest is the request body for creating a space.
type CreateSpaceRequest struct {
	Name        string      `json:"name" binding:"required"`
	Type        SpaceType   `json:"type" binding:"oneof=public internal private docs"`
	Source      ContentSource `json:"source" binding:"oneof=manual synced"`
	OwnerID     string      `json:"owner_id"`
	TeamID      *string     `json:"team_id"`
	Description *string     `json:"description"`
}

// UpdateSpaceInput is the input for updating a space.
type UpdateSpaceInput struct {
	Name        *string     `json:"name"`
	Type        *SpaceType  `json:"type"`
	Source      *ContentSource `json:"source"`
	TeamID      *string     `json:"team_id"`
	Description *string     `json:"description"`
}

// ============================================================================
// Document models
// ============================================================================

type DocStatus string

const (
	DocStatusDraft     DocStatus = "draft"
	DocStatusPublished DocStatus = "published"
	DocStatusArchived  DocStatus = "archived"
)

// Doc represents a knowledge document within a space.
type Doc struct {
	ID        string      `db:"id" json:"id"`
	TenantID  string      `db:"tenant_id" json:"tenant_id"`
	SpaceID   string      `db:"space_id" json:"space_id"`
	Title     string      `db:"title" json:"title"`
	Content   string      `db:"content" json:"content"`
	Type      string      `db:"type" json:"type"`
	Source    ContentSource `db:"source" json:"source"`
	Tags      JSONArray   `db:"tags" json:"tags"`
	Status    DocStatus   `db:"status" json:"status"`
	Version   int         `db:"version" json:"version"`
	AuthorID  *string     `db:"author_id" json:"author_id"`
	CreatedAt time.Time   `db:"created_at" json:"created_at"`
	UpdatedAt time.Time   `db:"updated_at" json:"updated_at"`
}

// CreateDocInput is the input for creating a document.
type CreateDocInput struct {
	Title    string    `json:"title" binding:"required"`
	Content  string    `json:"content" binding:"required"`
	SpaceID  string    `json:"space_id" binding:"required"`
	Type     *string   `json:"type"`
	Source   *ContentSource `json:"source"`
	Tags     []string  `json:"tags"`
	Status   *DocStatus `json:"status"`
	AuthorID *string   `json:"author_id"`
}

// UpdateDocInput is the input for updating a document.
type UpdateDocInput struct {
	Title    *string    `json:"title"`
	Content  *string    `json:"content"`
	Tags     *[]string  `json:"tags"`
	Status   *DocStatus `json:"status"`
	Source   *ContentSource `json:"source"`
}

// DocVersion represents a historical version of a document.
type DocVersion struct {
	ID        string    `db:"id" json:"id"`
	DocID     string    `db:"doc_id" json:"doc_id"`
	Version   int       `db:"version" json:"version"`
	Title     string    `db:"title" json:"title"`
	Content   string    `db:"content" json:"content"`
	Tags      JSONArray `db:"tags" json:"tags"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// ============================================================================
// Search / RAG models
// ============================================================================

// SearchResult is returned by RAG retrieval and search.
type SearchResult struct {
	ID        string    `db:"id" json:"id"`
	Title     string    `db:"title" json:"title"`
	Content   string    `db:"content" json:"content"`
	Similarity float64  `db:"similarity" json:"similarity"`
	SpaceID   string    `db:"space_id" json:"space_id"`
	Tags      JSONArray `db:"tags" json:"tags"`
	Status    DocStatus `db:"status" json:"status"`
}

// ============================================================================
// Document Center models
// ============================================================================

// DocTag is a tag with document count.
type DocTag struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// DocTocItem is a table-of-contents item.
type DocTocItem struct {
	ID       string  `json:"id"`
	Title    string  `json:"title"`
	ParentID *string `json:"parentId"`
	Order    int     `json:"order"`
}

// ============================================================================
// Sync models
// ============================================================================

type SyncStatus string

const (
	SyncStatusPending SyncStatus = "pending"
	SyncStatusRunning SyncStatus = "running"
	SyncStatusSuccess SyncStatus = "success"
	SyncStatusFailed  SyncStatus = "failed"
)

// SyncLog represents a document sync operation log.
type SyncLog struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	Status      SyncStatus `db:"status" json:"status"`
	Source      *string    `db:"source" json:"source,omitempty"`
	TotalDocs   int        `db:"total_docs" json:"total_docs"`
	SuccessDocs int        `db:"success_docs" json:"success_docs"`
	FailedDocs  int        `db:"failed_docs" json:"failed_docs"`
	ErrorMsg    *string    `db:"error_message" json:"error_message"`
	StartedAt   time.Time  `db:"started_at" json:"started_at"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
}

// ============================================================================
// Graph models
// ============================================================================

// GraphNode represents a node in the knowledge graph.
type GraphNode struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	Label string `json:"label"`
}

// GraphEdge represents an edge in the knowledge graph.
type GraphEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Relation string `json:"relation"`
}

// KnowledgeGraph is the full graph response.
type KnowledgeGraph struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

// ============================================================================
// Pagination
// ============================================================================

// PaginatedRequest is shared pagination input.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
