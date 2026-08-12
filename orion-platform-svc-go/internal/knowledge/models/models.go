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

// --- RAG Pipeline models ---

// Conversation represents a RAG chat session.
type Conversation struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Title     string    `json:"title" db:"title"`
	SpaceID   string    `json:"space_id,omitempty" db:"space_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// ChatMessage represents a single message in a RAG conversation.
type ChatMessage struct {
	ID         string        `json:"id" db:"id"`
	TenantID   string        `json:"tenant_id" db:"tenant_id"`
	ConvID     string        `json:"conversation_id" db:"conversation_id"`
	Role       string        `json:"role" db:"role"` // user, assistant
	Content    string        `json:"content" db:"content"`
	Sources    []RAGSource   `json:"sources,omitempty" db:"sources"`
	Confidence float64       `json:"confidence,omitempty" db:"confidence"`
	CreatedAt  time.Time     `json:"created_at" db:"created_at"`
}

// FeedbackEvent records a user thumbs-up/thumbs-down with optional correction.
type FeedbackEvent struct {
	ID             string `json:"id" db:"id"`
	TenantID       string `json:"tenant_id" db:"tenant_id"`
	UserID         string `json:"user_id" db:"user_id"`
	ConvID         string `json:"conversation_id" db:"conversation_id"`
	MessageID      string `json:"message_id" db:"message_id"`
	IsPositive     bool   `json:"is_positive" db:"is_positive"`
	CorrectedAnswer string `json:"corrected_answer,omitempty" db:"corrected_answer"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

// UserCorrection stores cross-session user corrections with similarity hashing.
type UserCorrection struct {
	ID             string    `json:"id" db:"id"`
	TenantID       string    `json:"tenant_id" db:"tenant_id"`
	UserID         string    `json:"user_id" db:"user_id"`
	Query          string    `json:"query" db:"query"`
	OriginalAnswer string    `json:"original_answer,omitempty" db:"original_answer"`
	CorrectedAnswer string   `json:"corrected_answer" db:"corrected_answer"`
	SimilarityHash string    `json:"similarity_hash" db:"similarity_hash"`
	AppliedCount   int       `json:"applied_count" db:"applied_count"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

// UserPreferences stores per-user query patterns and preferences.
type UserPreferences struct {
	ID              string    `json:"id" db:"id"`
	TenantID        string    `json:"tenant_id" db:"tenant_id"`
	UserID          string    `json:"user_id" db:"user_id"`
	PreferredScope  string    `json:"preferred_scope,omitempty" db:"preferred_scope"`
	ExcludedTopics  string    `json:"excluded_topics,omitempty" db:"excluded_topics"` // JSON array
	QueryPatterns   string    `json:"query_patterns,omitempty" db:"query_patterns"` // JSON object
	ActiveUntil     time.Time `json:"active_until,omitempty" db:"active_until"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

// EvalMetric stores RAG evaluation metrics per query.
type EvalMetric struct {
	ID          string  `json:"id" db:"id"`
	TenantID    string  `json:"tenant_id" db:"tenant_id"`
	QueryID     string  `json:"query_id" db:"query_id"`
	RecallAt5   float64 `json:"recall_at_5,omitempty" db:"recall_at_5"`
	Precision   float64 `json:"precision,omitempty" db:"precision"`
	NDCG        float64 `json:"ndcg,omitempty" db:"ndcg"`
	HallucinationRate float64 `json:"hallucination_rate,omitempty" db:"hallucination_rate"`
	LatencyMs   int     `json:"latency_ms,omitempty" db:"latency_ms"`
	Score       float64 `json:"score,omitempty" db:"score"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// EvalGroundTruth stores ground truth data for offline evaluation.
type EvalGroundTruth struct {
	ID         string `json:"id" db:"id"`
	TenantID   string `json:"tenant_id" db:"tenant_id"`
	Query      string `json:"query" db:"query"`
	GoldAnswer string `json:"gold_answer" db:"gold_answer"`
	GoldSources string `json:"gold_sources,omitempty" db:"gold_sources"` // JSON array of doc IDs
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// SemanticCache stores cached query-answer pairs with semantic hash.
type SemanticCache struct {
	ID            string        `json:"id" db:"id"`
	TenantID      string        `json:"tenant_id" db:"tenant_id"`
	QueryHash     string        `json:"query_hash" db:"query_hash"`
	OriginalQuery string        `json:"original_query" db:"original_query"`
	CachedAnswer  string        `json:"cached_answer" db:"cached_answer"`
	Sources       []RAGSource   `json:"sources,omitempty" db:"sources"`
	HitCount      int           `json:"hit_count" db:"hit_count"`
	LastAccessedAt time.Time    `json:"last_accessed_at" db:"last_accessed_at"`
	ExpiresAt     time.Time     `json:"expires_at" db:"expires_at"`
	CreatedAt     time.Time     `json:"created_at" db:"created_at"`
}

// PromptTemplate stores versioned prompt templates.
type PromptTemplate struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Version   string    `json:"version" db:"version"`
	Content   string    `json:"content" db:"content"`
	IsActive  bool      `json:"is_active" db:"is_active"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// RAGQueryRequest is the incoming RAG query.
type RAGQueryRequest struct {
	Query        string `json:"query" binding:"required"`
	SpaceID      string `json:"space_id"`
	TopK         *int   `json:"top_k"`
	ConversationID string `json:"conversation_id,omitempty"`
	UserID       string `json:"user_id,omitempty"`
}

// RAGQueryResponse is the structured output returned to the client.
type RAGQueryResponse struct {
	Answer         string      `json:"answer"`
	Sources        []RAGSource `json:"sources"`
	Confidence     float64     `json:"confidence"`
	FeedbackToken  string      `json:"feedback_token,omitempty"`
	QueryType      string      `json:"query_type,omitempty"` // simple, moderate, complex
	LatencyMs      int         `json:"latency_ms,omitempty"`
}

// RAGFeedbackRequest is the user feedback submission.
type RAGFeedbackRequest struct {
	Token           string `json:"token" binding:"required"`
	IsPositive      bool   `json:"is_positive"`
	CorrectedAnswer string `json:"corrected_answer,omitempty"`
}

type RAGSource struct {
	DocumentID     string  `json:"document_id"`
	Title          string  `json:"title"`
	Snippet        string  `json:"snippet"`
	RelevanceScore float64 `json:"relevance_score"`
	SpaceID        string  `json:"space_id"`
}

// RAGQueryAuditLog records a RAG query for security auditing.
type RAGQueryAuditLog struct {
	ID               string     `json:"id" db:"id"`
	TenantID         string     `json:"tenant_id" db:"tenant_id"`
	UserID           string     `json:"user_id" db:"user_id"`
	QueryText        string     `json:"query_text" db:"query_text"`
	QueryHash        string     `json:"query_hash" db:"query_hash"`
	QueryType        string     `json:"query_type" db:"query_type"`
	Confidence       float64    `json:"confidence" db:"confidence"`
	LatencyMs        int        `json:"latency_ms" db:"latency_ms"`
	SourceCount      int        `json:"source_count" db:"source_count"`
	AnswerLength     int        `json:"answer_length" db:"answer_length"`
	HasFeedback      bool       `json:"has_feedback" db:"has_feedback"`
	FeedbackPositive *bool      `json:"feedback_positive,omitempty" db:"feedback_positive"`
	HasCorrection    bool       `json:"has_correction" db:"has_correction"`
	CorrectionText   string     `json:"correction_text,omitempty" db:"correction_text"`
	SafetyFlagged    bool       `json:"safety_flagged" db:"safety_flagged"`
	SafetyReason     string     `json:"safety_reason,omitempty" db:"safety_reason"`
	IPAddress        string     `json:"ip_address" db:"ip_address"`
	UserAgent        string     `json:"user_agent" db:"user_agent"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
}

// SafetyFilterResult holds the result of content safety filtering.
type SafetyFilterResult struct {
	IsSafe  bool
	Reason  string
	Flagged bool
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
