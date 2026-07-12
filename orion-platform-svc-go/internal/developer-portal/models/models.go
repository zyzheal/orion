package models

import "time"

// DeveloperPortal is the top-level resource (legacy compatibility).
type DeveloperPortal struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateDeveloperPortalRequest struct {
	Name string `json:"name" binding:"required"`
}

type UpdateDeveloperPortalRequest struct {
	Name *string `json:"name"`
}

// ----- Portal Document -----

type PortalDocument struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Title       string    `json:"title" db:"title"`
	Category    string    `json:"category" db:"category"`
	Content     string    `json:"content" db:"content"`
	Status      string    `json:"status" db:"status"` // draft, review, published
	Views       int       `json:"views" db:"views"`
	Helpful     int       `json:"helpful" db:"helpful"`
	Version     string    `json:"version" db:"version"`
	CreatedBy   string    `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type CreateDocumentRequest struct {
	Title    string `json:"title" binding:"required"`
	Category string `json:"category"`
	Content  string `json:"content" binding:"required"`
}

type UpdateDocumentRequest struct {
	Title    *string `json:"title"`
	Category *string `json:"category"`
	Content  *string `json:"content"`
}

type SearchDocumentRequest struct {
	Query string `json:"query" form:"query"`
}

// ----- Document Version -----

type DocumentVersion struct {
	ID        string    `json:"id" db:"id"`
	DocumentID string   `json:"document_id" db:"document_id"`
	Version   string    `json:"version" db:"version"`
	Content   string    `json:"content" db:"content"`
	CreatedBy string    `json:"created_by" db:"created_by"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CreateVersionRequest struct {
	Version string `json:"version" binding:"required"`
}

// ----- Document Review -----

type ReviewDecision struct {
	Reason string `json:"reason"`
}

// ----- Document Stats -----

type DocumentStats struct {
	Total      int `json:"total"`
	Draft      int `json:"draft"`
	Review     int `json:"review"`
	Published  int `json:"published"`
	TotalViews int `json:"total_views"`
}

// ----- Category -----

type CategoryInfo struct {
	Category string `json:"category"`
	Count    int    `json:"count"`
}

// ----- Mock Rule -----

type MockRule struct {
	ID        string `json:"id" db:"id"`
	TenantID  string `json:"tenant_id" db:"tenant_id"`
	Name      string `json:"name" db:"name"`
	Method    string `json:"method" db:"method"`
	Path      string `json:"path" db:"path"`
	Responses any    `json:"responses" db:"responses"` // JSON blob
	Enabled   bool   `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateMockRuleRequest struct {
	Name      string `json:"name" binding:"required"`
	Method    string `json:"method" binding:"required"`
	Path      string `json:"path" binding:"required"`
	Responses any    `json:"responses"`
	Enabled   *bool  `json:"enabled"`
}

type UpdateMockRuleRequest struct {
	Name      *string `json:"name"`
	Method    *string `json:"method"`
	Path      *string `json:"path"`
	Responses any     `json:"responses"`
	Enabled   *bool   `json:"enabled"`
}

type MockRuleFilter struct {
	Enabled  *bool
	Method   string
	Page     int
	PageSize int
}

type MockRuleListResult struct {
	Data       []MockRule `json:"data"`
	Total      int        `json:"total"`
	Page       int        `json:"page"`
	PageSize   int        `json:"page_size"`
}

type MockRuleStats struct {
	Total        int `json:"total"`
	Enabled      int `json:"enabled"`
	Disabled     int `json:"disabled"`
	TotalHits    int `json:"total_hits"`
}

type MockSimulateRequest struct {
	Method string `json:"method" binding:"required"`
	Path   string `json:"path" binding:"required"`
}

type MockSimulateResult struct {
	Matched bool    `json:"matched"`
	Rule    *MockRule `json:"rule"`
	Response any     `json:"response"`
}

// ----- SDK Task -----

type SDKTask struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Language  string    `json:"language" db:"language"`
	Status    string    `json:"status" db:"status"` // pending, generating, completed, failed
	OutputURL string    `json:"output_url" db:"output_url"`
	Error     string    `json:"error" db:"error"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateSDKTaskRequest struct {
	Name     string `json:"name" binding:"required"`
	Language string `json:"language" binding:"required"`
}

type SDKTaskFilter struct {
	Language string
	Status   string
	Page     int
	PageSize int
}

type SDKTaskListResult struct {
	Data     []SDKTask `json:"data"`
	Total    int       `json:"total"`
	Page     int       `json:"page"`
	PageSize int       `json:"page_size"`
}

type SDKTaskStats struct {
	Total        int `json:"total"`
	Pending      int `json:"pending"`
	Generating   int `json:"generating"`
	Completed    int `json:"completed"`
	Failed       int `json:"failed"`
}

type SDKLanguage struct {
	Name    string `json:"name"`
	Alias   string `json:"alias"`
	Version string `json:"version"`
}

// ----- Subscription -----

type Subscription struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	UserID       string    `json:"user_id" db:"user_id"`
	APIName      string    `json:"api_name" db:"api_name"`
	PlanName     string    `json:"plan_name" db:"plan_name"`
	QuotaPerDay  int       `json:"quota_per_day" db:"quota_per_day"`
	QuotaPerMonth int      `json:"quota_per_month" db:"quota_per_month"`
	UsedPerDay   int       `json:"used_per_day" db:"used_per_day"`
	UsedPerMonth int       `json:"used_per_month" db:"used_per_month"`
	Reason       string    `json:"reason" db:"reason"`
	Status       string    `json:"status" db:"status"` // pending, approved, rejected, suspended, cancelled
	ApprovedBy   string    `json:"approved_by" db:"approved_by"`
	RejectReason string    `json:"reject_reason" db:"reject_reason"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type CreateSubscriptionRequest struct {
	APIName      string `json:"api_name" binding:"required"`
	PlanName     string `json:"plan_name"`
	QuotaPerDay  *int   `json:"quota_per_day"`
	QuotaPerMonth *int  `json:"quota_per_month"`
	Reason       string `json:"reason"`
}

type SubscriptionFilter struct {
	UserID   string
	APIName  string
	Status   string
	Page     int
	PageSize int
}

type SubscriptionListResult struct {
	Data     []Subscription `json:"data"`
	Total    int            `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"page_size"`
}

type RejectSubscriptionRequest struct {
	Reason string `json:"reason"`
}

type SubscriptionStats struct {
	Total      int `json:"total"`
	Active     int `json:"active"`
	Pending    int `json:"pending"`
	Rejected   int `json:"rejected"`
	Suspended  int `json:"suspended"`
	Cancelled  int `json:"cancelled"`
}

type UsageRecord struct {
	ID          string    `json:"id" db:"id"`
	SubscriptionID string  `json:"subscription_id" db:"subscription_id"`
	APIName     string    `json:"api_name" db:"api_name"`
	Method      string    `json:"method" db:"method"`
	Path        string    `json:"path" db:"path"`
	Status      int       `json:"status" db:"status"`
	LatencyMs   int       `json:"latency_ms" db:"latency_ms"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

type UsageRecordListResult struct {
	Data     []UsageRecord `json:"data"`
	Total    int           `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
}

type UsageRecordFilter struct {
	Page     int
	PageSize int
}

// ----- Playground -----

type PlaygroundRequest struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	UserID       string    `json:"user_id" db:"user_id"`
	Name         string    `json:"name" db:"name"`
	Method       string    `json:"method" db:"method"`
	Path         string    `json:"path" db:"path"`
	Headers      any       `json:"headers" db:"headers"`
	Body         any       `json:"body" db:"body"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type CreatePlaygroundRequestRequest struct {
	Name    string `json:"name" binding:"required"`
	Method  string `json:"method" binding:"required"`
	Path    string `json:"path" binding:"required"`
	Headers any    `json:"headers"`
	Body    any    `json:"body"`
}

type UpdatePlaygroundRequestRequest struct {
	Name    *string `json:"name"`
	Method  *string `json:"method"`
	Path    *string `json:"path"`
	Headers any     `json:"headers"`
	Body    any     `json:"body"`
}

type PlaygroundExecuteRequest struct {
	Method  string `json:"method" binding:"required"`
	Path    string `json:"path" binding:"required"`
	Headers any    `json:"headers"`
	Body    any    `json:"body"`
}

type PlaygroundExecuteResult struct {
	Status   int    `json:"status"`
	Headers  any    `json:"headers"`
	Body     any    `json:"body"`
	LatencyMs int   `json:"latency_ms"`
	Error    string `json:"error"`
}

type PlaygroundStats struct {
	TotalRequests    int `json:"total_requests"`
	TotalExecutions  int `json:"total_executions"`
	SuccessfulExecs  int `json:"successful_execs"`
	FailedExecs      int `json:"failed_execs"`
}

type PlaygroundRequestFilter struct {
	Method   string
	Page     int
	PageSize int
}

type PlaygroundRequestListResult struct {
	Data     []PlaygroundRequest `json:"data"`
	Total    int                 `json:"total"`
	Page     int                 `json:"page"`
	PageSize int                 `json:"page_size"`
}

// ----- Response History -----

type ResponseHistoryEntry struct {
	ID          string    `json:"id" db:"id"`
	RequestID   string    `json:"request_id" db:"request_id"`
	Status      int       `json:"status" db:"status"`
	Headers     any       `json:"headers" db:"headers"`
	Body        any       `json:"body" db:"body"`
	LatencyMs   int       `json:"latency_ms" db:"latency_ms"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

type ResponseHistoryListResult struct {
	Data     []ResponseHistoryEntry `json:"data"`
	Total    int                    `json:"total"`
	Page     int                    `json:"page"`
	PageSize int                    `json:"page_size"`
}
