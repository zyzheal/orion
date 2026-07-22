package models

import "time"

// ChangeAnalysis represents an AI-powered semantic blast radius analysis for a change.
type ChangeAnalysis struct {
	ID                string    `db:"id" json:"id"`
	TenantID          string    `db:"tenant_id" json:"tenantId"`
	ChangeID          string    `db:"change_id" json:"changeId"`
	ServiceName       string    `db:"service_name" json:"serviceName"`
	RiskScore         float64   `db:"risk_score" json:"riskScore"`
	BlastRadius       string    `db:"blast_radius" json:"blastRadius"`
	AffectedServices  string    `db:"affected_services" json:"affectedServices"`
	Recommendations   string    `db:"recommendations" json:"recommendations"`
	CreatedAt         time.Time `db:"created_at" json:"createdAt"`
	CreatedBy         string    `db:"created_by" json:"createdBy"`
}

// BlastRadiusItem represents a single service's impact within a blast radius analysis.
type BlastRadiusItem struct {
	ServiceID   string  `json:"serviceId"`
	ServiceName string  `json:"serviceName"`
	ImpactLevel string  `json:"impactLevel"`
	Probability float64 `json:"probability"`
}

// RiskFactor represents an individual risk factor contributing to the overall risk score.
type RiskFactor struct {
	Factor      string  `json:"factor"`
	Score       float64 `json:"score"`
	Description string  `json:"description"`
}

// AnalyzeRequest is the request body for triggering a change analysis.
type AnalyzeRequest struct {
	ChangeID    string `json:"changeId" binding:"required"`
	ServiceName string `json:"serviceName" binding:"required"`
	Changes     string `json:"changes" binding:"required"`
}

// ReportSummary is a lightweight summary of a change analysis report for list views.
type ReportSummary struct {
	ID          string    `json:"id"`
	ChangeID    string    `json:"changeId"`
	ServiceName string    `json:"serviceName"`
	RiskScore   float64   `json:"riskScore"`
	CreatedAt   time.Time `json:"createdAt"`
}

// BlastRadiusResponse is the full response returned for a blast radius query.
type BlastRadiusResponse struct {
	AnalysisID       string             `json:"analysisId"`
	ServiceName      string             `json:"serviceName"`
	RiskScore        float64            `json:"riskScore"`
	AffectedServices []BlastRadiusItem  `json:"affectedServices"`
	Recommendations  []string           `json:"recommendations"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}