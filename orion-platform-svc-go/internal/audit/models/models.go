package models

import "time"

// AuditLog represents a single audit log entry.
type AuditLog struct {
	ID           string      `json:"id" db:"id"`
	TenantID     string      `json:"tenant_id" db:"tenant_id"`
	UserID       string      `json:"user_id" db:"user_id"`
	Action       string      `json:"action" db:"action"`
	ResourceType string      `json:"resource_type" db:"resource_type"`
	ResourceID   string      `json:"resource_id" db:"resource_id"`
	RequestMethod string     `json:"request_method" db:"request_method"`
	RequestPath  string      `json:"request_path" db:"request_path"`
	RequestBody  string      `json:"request_body" db:"request_body"`
	ResponseCode int         `json:"response_code" db:"response_code"`
	ResponseBody string      `json:"response_body" db:"response_body"`
	IPAddress    string      `json:"ip_address" db:"ip_address"`
	UserAgent    string      `json:"user_agent" db:"user_agent"`
	PrevHash     string      `json:"prev_hash" db:"prev_hash"`
	Hash         string      `json:"hash" db:"hash"`
	CreatedAt    time.Time   `json:"created_at" db:"created_at"`
}

// AuditLogEntry is the frontend-friendly representation of an audit log.
type AuditLogEntry struct {
	ID             string            `json:"id"`
	Timestamp      time.Time         `json:"timestamp"`
	Action         string            `json:"action"`
	UserID         string            `json:"userId"`
	TenantID       string            `json:"tenantId"`
	Details        map[string]any    `json:"details"`
	Resource       string            `json:"resource"`
	ResourceID     string            `json:"resourceId"`
	IPAddress      string            `json:"ipAddress"`
	UserAgent      string            `json:"userAgent"`
	PrevHash       string            `json:"prevHash"`
	ContentHash    string            `json:"contentHash"`
	ChainHash      string            `json:"chainHash"`
	SequenceNumber int               `json:"sequenceNumber"`
	RequestMethod  string            `json:"requestMethod"`
	RequestPath    string            `json:"requestPath"`
	ResponseCode   int               `json:"responseCode"`
}

// AuditLogCreateRequest is the request body for creating an audit log.
type AuditLogCreateRequest struct {
	Action        string            `json:"action" binding:"required"`
	UserID        string            `json:"userId"`
	TenantID      string            `json:"tenantId"`
	Details       map[string]any    `json:"details"`
	ResourceType  string            `json:"resourceType"`
	ResourceID    string            `json:"resourceId"`
	IPAddress     string            `json:"ipAddress"`
	UserAgent     string            `json:"userAgent"`
	RequestMethod string            `json:"requestMethod"`
	RequestPath   string            `json:"requestPath"`
	RequestBody   map[string]any    `json:"requestBody"`
	ResponseCode  int               `json:"responseCode"`
	ResponseBody  map[string]any    `json:"responseBody"`
}

// AuditLogQuery represents query parameters for listing/exporting audit logs.
type AuditLogQuery struct {
	TenantID     string `json:"tenantId"`
	UserID       string `json:"userId"`
	Action       string `json:"action"`
	ResourceType string `json:"resourceType"`
	ResourceID   string `json:"resourceId"`
	DateFrom     string `json:"dateFrom"`
	DateTo       string `json:"dateTo"`
	Format       string `json:"format"` // csv or json
	Page         int    `json:"page"`
	Limit        int    `json:"limit"`
}

// AuditLogListResult is the paginated result for listing audit logs.
type AuditLogListResult struct {
	Entries    []AuditLogEntry `json:"entries"`
	Total      int             `json:"total"`
	Page       int             `json:"page"`
	Limit      int             `json:"limit"`
	TotalPages int             `json:"totalPages"`
}

// AuditLogExportResult is the result of exporting audit logs.
type AuditLogExportResult struct {
	Filename string `json:"filename"`
	Content  string `json:"content"`
}

// ChainVerifyResult is the result of verifying the audit chain.
type ChainVerifyResult struct {
	Valid          bool     `json:"valid"`
	TotalVerified  int      `json:"totalVerified"`
	Breaks         []ChainBreak `json:"breaks"`
	VerifiedAt     string   `json:"verifiedAt"`
}

// ChainBreak represents a break in the audit chain.
type ChainBreak struct {
	BreakType   string `json:"breakType"`
	Description string `json:"description"`
	DetectedAt  string `json:"detectedAt"`
}

// ChainInfo is the compatibility chain info response.
type ChainInfo struct {
	TotalEntries  int    `json:"totalEntries"`
	FirstSequence int    `json:"firstSequence"`
	LastSequence  int    `json:"lastSequence"`
	LastChainHash string `json:"lastChainHash"`
	GenesisHash   string `json:"genesisHash"`
}

// StorageStats is the compatibility storage stats response.
type StorageStats struct {
	TotalEntries int    `json:"totalEntries"`
	StorageSize  int64  `json:"storageSize"`
	LastFlushAt  string `json:"lastFlushAt"`
	IsHealthy    bool   `json:"isHealthy"`
}

// ComplianceReport is a generic compliance report.
type ComplianceReport struct {
	ReportType string `json:"reportType"`
	// Additional fields added by specific compliance reports
}

// AuditCoverageStats holds coverage statistics.
type AuditCoverageStats struct {
	// Coverage fields populated by compliance service
}
