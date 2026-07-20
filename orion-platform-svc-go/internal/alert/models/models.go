package models

import "time"

// Alert is the core alert entity.
type Alert struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenant_id" db:"tenant_id"`
	Name        string     `json:"name" db:"name"`
	Severity    string     `json:"severity" db:"severity"` // critical, warning, info
	Status      string     `json:"status" db:"status"`     // firing, resolved, suppressed
	Fingerprint string     `json:"fingerprint" db:"fingerprint"`
	SourceType  string     `json:"source_type" db:"source_type"`
	SourceID    string     `json:"source_id" db:"source_id"`
	SourceName  string     `json:"source_name" db:"source_name"`
	Labels      any        `json:"labels" db:"labels"`           // JSON blob
	Annotations any        `json:"annotations" db:"annotations"` // JSON blob
	Value       float64    `json:"value" db:"value"`
	Threshold   float64    `json:"threshold" db:"threshold"`
	Metric      string     `json:"metric" db:"metric"`
	IsDuplicate bool       `json:"is_duplicate" db:"is_duplicate"`
	GroupID     string     `json:"group_id" db:"group_id"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
	ResolvedAt  *time.Time `json:"resolved_at" db:"resolved_at"`
}

// IngestRequest is the body for POST /alert/ingest.
type IngestRequest struct {
	Name        string            `json:"name" binding:"required"`
	Severity    string            `json:"severity"`
	SourceType  string            `json:"sourceType"`
	SourceID    string            `json:"sourceId"`
	SourceName  string            `json:"sourceName"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Value       float64           `json:"value"`
	Threshold   float64           `json:"threshold"`
	Metric      string            `json:"metric"`
	TenantID    string            `json:"tenantId"`
}

// IngestResponse is the body returned by POST /alert/ingest.
type IngestResponse struct {
	Status      string `json:"status"` // created, updated, suppressed
	Reason      string `json:"reason,omitempty"`
	Alert       Alert  `json:"alert,omitempty"`
	IsDuplicate bool   `json:"isDuplicate"`
}

// CorrelationRequest is the body for POST /alert/correlate.
type CorrelationRequest struct {
	Alerts []Alert `json:"alerts" binding:"required"`
}

// CorrelationAnalysis is the result of correlation analysis.
type CorrelationAnalysis struct {
	RootCauses       []Alert           `json:"rootCauses"`
	CorrelatedGroups []CorrelatedGroup `json:"correlatedGroups"`
	TopologyUpdate   TopologyUpdate    `json:"topologyUpdate"`
}

// CorrelatedGroup groups alerts that share a root cause.
type CorrelatedGroup struct {
	GroupID    string   `json:"groupId"`
	AlertIDs   []string `json:"alertIds"`
	CommonRoot bool     `json:"commonRoot"`
	Similarity float64  `json:"similarity"`
}

// Topology is the alert dependency graph.
type Topology struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Nodes     any       `json:"nodes" db:"nodes"` // JSON blob
	Edges     any       `json:"edges" db:"edges"` // JSON blob
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// TopologyUpdate holds the result of a topology update.
type TopologyUpdate struct {
	NodeCount int `json:"nodeCount"`
	EdgeCount int `json:"edgeCount"`
}

// AlertGroup is a deduplicated group of alerts sharing the same fingerprint.
type AlertGroup struct {
	GroupID     string    `json:"groupId" db:"group_id"`
	Fingerprint string    `json:"fingerprint" db:"fingerprint"`
	AlertCount  int       `json:"alertCount" db:"alert_count"`
	Severity    string    `json:"severity" db:"severity"`
	Status      string    `json:"status" db:"status"`
	Alerts      []Alert   `json:"alerts"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// DedupStats holds deduplication statistics.
type DedupStats struct {
	TotalGroups  int `json:"totalGroups" db:"total_groups"`
	TotalAlerts  int `json:"totalAlerts" db:"total_alerts"`
	Duplicates   int `json:"duplicates" db:"duplicates"`
	UniqueAlerts int `json:"uniqueAlerts" db:"unique_alerts"`
}

// SuppressionStats holds suppression statistics.
type SuppressionStats struct {
	TotalSuppressed int `json:"totalSuppressed" db:"total_suppressed"`
	ActiveWindows   int `json:"activeWindows" db:"active_windows"`
	ActiveIssues    int `json:"activeIssues" db:"active_issues"`
}

// MaintenanceWindow defines a time period during which alerts are suppressed.
type MaintenanceWindow struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	StartTime time.Time `json:"startTime" db:"start_time"`
	EndTime   time.Time `json:"endTime" db:"end_time"`
	Scope     any       `json:"scope" db:"scope"`   // JSON blob: services, labels, etc.
	Status    string    `json:"status" db:"status"` // active, expired
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// AddMaintenanceWindowRequest is the body for POST /alert/suppression/maintenance-windows.
type AddMaintenanceWindowRequest struct {
	Name      string                 `json:"name" binding:"required"`
	StartTime string                 `json:"startTime" binding:"required"`
	EndTime   string                 `json:"endTime" binding:"required"`
	Scope     map[string]interface{} `json:"scope"`
}

// KnownIssue defines a known issue pattern to suppress.
type KnownIssue struct {
	ID                 string    `json:"id" db:"id"`
	TenantID           string    `json:"tenant_id" db:"tenant_id"`
	Title              string    `json:"title" db:"title"`
	Description        string    `json:"description" db:"description"`
	FingerprintPattern string    `json:"fingerprintPattern" db:"fingerprint_pattern"`
	LabelSelectors     any       `json:"labelSelectors" db:"label_selectors"`   // JSON blob
	SilenceDuration    int64     `json:"silenceDuration" db:"silence_duration"` // ms
	Status             string    `json:"status" db:"status"`                    // open, closed
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time `json:"updated_at" db:"updated_at"`
}

// AddKnownIssueRequest is the body for POST /alert/suppression/known-issues.
type AddKnownIssueRequest struct {
	Title              string            `json:"title" binding:"required"`
	Description        string            `json:"description"`
	FingerprintPattern string            `json:"fingerprintPattern"`
	LabelSelectors     map[string]string `json:"labelSelectors"`
	SilenceDuration    int64             `json:"silenceDuration"`
}

// AlertListResponse is returned by GET /alert/list.
type AlertListResponse struct {
	Alerts []Alert `json:"alerts"`
	Total  int     `json:"total"`
}

// NodeHealth is a node in the alert topology.
type NodeHealth struct {
	NodeID     string    `json:"nodeId"`
	NodeName   string    `json:"nodeName"`
	Health     string    `json:"health"` // healthy, degraded, down
	AlertCount int       `json:"alertCount"`
	LastUpdate time.Time `json:"lastUpdate"`
}

// TopologyNodes request payload
type TopologyNodesRequest struct {
	Nodes any `json:"nodes"`
	Edges any `json:"edges"`
}
