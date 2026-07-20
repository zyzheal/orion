package models

import (
	"time"
)

// LineageRule represents a data quality rule.
type Rule struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenantId" db:"tenant_id"`
	Name         string    `json:"name" db:"name"`
	Description  *string   `json:"description" db:"description"`
	TargetTable  *string   `json:"targetTable" db:"target_table"`
	TargetColumn *string   `json:"targetColumn" db:"target_column"`
	RuleType     string    `json:"ruleType" db:"rule_type"`
	Expression   *string   `json:"expression" db:"expression"`
	Threshold    *float64  `json:"threshold" db:"threshold"`
	Severity     string    `json:"severity" db:"severity"`
	Status       string    `json:"status" db:"status"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateRuleRequest is the request body for creating a rule.
type CreateRuleRequest struct {
	Name         string   `json:"name" binding:"required"`
	Description  *string  `json:"description"`
	TargetTable  *string  `json:"targetTable"`
	TargetColumn *string  `json:"targetColumn"`
	RuleType     string   `json:"ruleType" binding:"required"`
	Expression   *string  `json:"expression"`
	Threshold    *float64 `json:"threshold"`
	Severity     string   `json:"severity"`
}

// UpdateRuleRequest is the request body for updating a rule.
type UpdateRuleRequest struct {
	Name         *string  `json:"name"`
	Description  *string  `json:"description"`
	TargetTable  *string  `json:"targetTable"`
	TargetColumn *string  `json:"targetColumn"`
	RuleType     *string  `json:"ruleType"`
	Expression   *string  `json:"expression"`
	Threshold    *float64 `json:"threshold"`
	Severity     *string  `json:"severity"`
	Status       *string  `json:"status"`
}

// ScanResult represents a quality scan result.
type ScanResult struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenantId" db:"tenant_id"`
	RuleID        string    `json:"ruleId" db:"rule_id"`
	ScanDate      string    `json:"scanDate" db:"scan_date"`
	TotalRecords  int64     `json:"totalRecords" db:"total_records"`
	PassedRecords int64     `json:"passedRecords" db:"passed_records"`
	FailedRecords int64     `json:"failedRecords" db:"failed_records"`
	PassRate      *float64  `json:"passRate" db:"pass_rate"`
	Status        string    `json:"status" db:"status"`
	Errors        *string   `json:"errors" db:"errors"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
}

// CreateScanResultRequest is the request body for creating a scan result.
type CreateScanResultRequest struct {
	RuleID        string  `json:"ruleId" binding:"required"`
	ScanDate      string  `json:"scanDate" binding:"required"`
	TotalRecords  int64   `json:"totalRecords" binding:"required"`
	PassedRecords int64   `json:"passedRecords"`
	FailedRecords int64   `json:"failedRecords"`
	Status        string  `json:"status"`
	Errors        *string `json:"errors"`
}

// Alert represents a quality alert.
type Alert struct {
	ID           string     `json:"id" db:"id"`
	TenantID     string     `json:"tenantId" db:"tenant_id"`
	RuleID       string     `json:"ruleId" db:"rule_id"`
	ScanResultID string     `json:"scanResultId" db:"scan_result_id"`
	Message      *string    `json:"message" db:"message"`
	Severity     string     `json:"severity" db:"severity"`
	Status       string     `json:"status" db:"status"`
	ResolvedAt   *time.Time `json:"resolvedAt" db:"resolved_at"`
	ResolvedBy   *string    `json:"resolvedBy" db:"resolved_by"`
	CreatedAt    time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time  `json:"updatedAt" db:"updated_at"`
}

// CreateAlertRequest is the request body for creating an alert.
type CreateAlertRequest struct {
	RuleID       string  `json:"ruleId" binding:"required"`
	ScanResultID string  `json:"scanResultId" binding:"required"`
	Message      *string `json:"message"`
	Severity     string  `json:"severity" binding:"required"`
}

// UpdateAlertRequest is the request body for updating an alert.
type UpdateAlertRequest struct {
	Status     *string `json:"status"`
	ResolvedBy *string `json:"resolvedBy"`
}

// RuleFilter represents filter parameters for listing rules.
type RuleFilter struct {
	RuleType *string
	Severity *string
	Status   *string
	Limit    int
	Offset   int
}

// QualityStats holds aggregated quality statistics.
type QualityStats struct {
	TotalRules     int     `json:"totalRules"`
	ActiveRules    int     `json:"activeRules"`
	TotalScans     int     `json:"totalScans"`
	AvgPassRate    float64 `json:"avgPassRate"`
	OpenAlerts     int     `json:"openAlerts"`
	CriticalAlerts int     `json:"criticalAlerts"`
}
