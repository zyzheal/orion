package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// SpaceType represents the type of a knowledge space.
type SpaceType string

const (
	SpaceTypePublic    SpaceType = "public"
	SpaceTypeInternal  SpaceType = "internal"
	SpaceTypePrivate   SpaceType = "private"
	SpaceTypeDocs      SpaceType = "docs"
)

// ContentSource represents the source of content.
type ContentSource string

const (
	ContentSourceManual ContentSource = "manual"
	ContentSourceSynced ContentSource = "synced"
)

// DocStatus represents the status of a document.
type DocStatus string

const (
	DocStatusDraft      DocStatus = "draft"
	DocStatusPublished  DocStatus = "published"
	DocStatusArchived   DocStatus = "archived"
)

// DocType represents the type of a document.
type DocType string

const (
	DocTypeDocs      DocType = "docs"
	DocTypeKnowledge DocType = "knowledge"
)

// StringArray is a JSON-serializable string array for PostgreSQL text[].
type StringArray []string

func (a StringArray) Value() (driver.Value, error) {
	return json.Marshal(a)
}

func (a *StringArray) Scan(value interface{}) error {
	if value == nil {
		*a = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, a)
}

// JSONMap is a generic JSONB map.
type JSONMap map[string]interface{}

func (j JSONMap) Value() (driver.Value, error) {
	return json.Marshal(j)
}

func (j *JSONMap) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, j)
}

// KnowledgeSpace represents a knowledge space (kb_spaces table).
type KnowledgeSpace struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	Name        string     `db:"name" json:"name"`
	Type        SpaceType  `db:"type" json:"type"`
	Source      *string    `db:"source" json:"source,omitempty"`
	OwnerID     string     `db:"owner_id" json:"owner_id"`
	TeamID      *string    `db:"team_id" json:"team_id,omitempty"`
	Description *string    `db:"description" json:"description,omitempty"`
	DocCount    int        `db:"doc_count" json:"doc_count"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updated_at"`
}

// CreateSpaceRequest represents the request to create a space.
type CreateSpaceRequest struct {
	Name        string     `json:"name"`
	Type        SpaceType  `json:"type"`
	Source      *string    `json:"source"`
	OwnerID     string     `json:"owner_id"`
	TeamID      *string    `json:"team_id"`
	Description *string    `json:"description"`
}

// UpdateSpaceRequest represents the request to update a space.
type UpdateSpaceRequest struct {
	Name        *string     `json:"name"`
	Type        *SpaceType  `json:"type"`
	Source      *string     `json:"source"`
	TeamID      *string     `json:"team_id"`
	Description *string     `json:"description"`
}

// KnowledgeDoc represents a knowledge document (kb_docs table).
type KnowledgeDoc struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	SpaceID     string     `db:"space_id" json:"space_id"`
	Title       string     `db:"title" json:"title"`
	Content     string     `db:"content" json:"content"`
	Type        DocType    `db:"type" json:"type"`
	Source      *string    `db:"source" json:"source,omitempty"`
	Tags        []byte     `db:"tags" json:"tags,omitempty"`
	Status      DocStatus  `db:"status" json:"status"`
	Version     int        `db:"version" json:"version"`
	AuthorID    *string    `db:"author_id" json:"author_id,omitempty"`
	Embedding   []byte     `db:"embedding" json:"embedding,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updated_at"`
}

// CreateDocRequest represents the request to create a document.
type CreateDocRequest struct {
	Title    string    `json:"title"`
	Content  string    `json:"content"`
	SpaceID  string    `json:"space_id"`
	Type     DocType   `json:"type"`
	Source   *string   `json:"source"`
	Tags     []string  `json:"tags"`
	Status   DocStatus `json:"status"`
	AuthorID *string   `json:"author_id"`
}

// UpdateDocRequest represents the request to update a document.
type UpdateDocRequest struct {
	Title   *string    `json:"title"`
	Content *string    `json:"content"`
	Tags    []string   `json:"tags"`
	Status  *DocStatus `json:"status"`
}

// DocVersion represents a document version (kb_doc_versions table).
type DocVersion struct {
	ID        string     `db:"id" json:"id"`
	DocID     string     `db:"doc_id" json:"doc_id"`
	Version   int        `db:"version" json:"version"`
	Title     string     `db:"title" json:"title"`
	Content   string     `db:"content" json:"content"`
	Tags      []byte     `db:"tags" json:"tags,omitempty"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
}

// KnowledgeSearchResult represents a RAG search result.
type KnowledgeSearchResult struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Content     string  `json:"content"`
	Similarity  float64 `json:"similarity"`
	SpaceID     string  `json:"space_id"`
	Tags        []byte  `json:"tags,omitempty"`
	Status      string  `json:"status"`
}

// GraphNode represents a node in the knowledge graph.
type GraphNode struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	Label string `json:"label"`
}

// GraphEdge represents an edge in the knowledge graph.
type GraphEdge struct {
	Source   string `json:"source"`
	Target   string `json:"target"`
	Relation string `json:"relation"`
}

// KnowledgeGraph represents the knowledge graph response.
type KnowledgeGraph struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

// DocTag represents a document tag with count.
type DocTag struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// DocTocItem represents a table of contents item.
type DocTocItem struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	ParentID *string `json:"parent_id"`
	Order    int    `json:"order"`
}

// SyncLog represents a document sync log entry.
type SyncLog struct {
	ID          string    `json:"id"`
	Status      string    `json:"status"`
	StartedAt   time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
	TotalDocs   int       `json:"total_docs"`
	SuccessDocs int       `json:"success_docs"`
	FailedDocs  int       `json:"failed_docs"`
	ErrorMessage *string  `json:"error_message,omitempty"`
}

// SyncRequest represents a sync trigger request.
type SyncRequest struct {
	Source *string `json:"source"`
}

// RAGRetrieveRequest represents a RAG retrieve request.
type RAGRetrieveRequest struct {
	Query   string  `json:"query"`
	SpaceID *string `json:"space_id"`
	TopK    *int    `json:"top_k"`
}

// RAGQueryResponse represents a RAG query response.
type RAGQueryResponse struct {
	Answer      string                `json:"answer"`
	Sources     []RAGSource           `json:"sources"`
	Confidence  float64               `json:"confidence"`
}

// RAGSource represents a source in a RAG response.
type RAGSource struct {
	DocumentID      string  `json:"documentId"`
	Title           string  `json:"title"`
	Snippet         string  `json:"snippet"`
	RelevanceScore  float64 `json:"relevanceScore"`
	SpaceID         string  `json:"spaceId"`
}

// SpaceListFilters represents filter options for listing spaces.
type SpaceListFilters struct {
	Type    *string
	Source  *string
	Search  *string
	Limit   int
	Offset  int
}

// DocListFilters represents filter options for listing documents.
type DocListFilters struct {
	SpaceID *string
	Status  *string
	Tag     *string
	Search  *string
	Type    *string
	Source  *string
	Limit   int
	Offset  int
}
