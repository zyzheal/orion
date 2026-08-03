package models

import "time"

// DriftType 漂移类型
type DriftType string

const (
	DriftTypeCIMissing          DriftType = "ci_missing"
	DriftTypeCIPropertyChanged  DriftType = "ci_property_changed"
	DriftTypeRelationshipChanged DriftType = "relationship_changed"
	DriftTypeCIAdded            DriftType = "ci_added"
	DriftTypeConfigValueChanged DriftType = "config_value_changed"
)

// DriftSeverity 漂移严重程度
type DriftSeverity string

const (
	SeverityCritical DriftSeverity = "critical"
	SeverityWarning  DriftSeverity = "warning"
	SeverityInfo     DriftSeverity = "info"
)

// DriftRecord 漂移记录
type DriftRecord struct {
	ID            string        `db:"id" json:"id"`
	TenantID      string        `db:"tenant_id" json:"tenantId"`
	CIID          string        `db:"ci_id" json:"ciId"`
	CIName        string        `db:"ci_name" json:"ciName"`
	CIType        string        `db:"ci_type" json:"ciType"`
	Property      string        `db:"property" json:"property"`
	Environment   string        `db:"environment" json:"environment"`
	ExpectedValue string        `db:"expected_value" json:"expectedValue"`
	ActualValue   string        `db:"actual_value" json:"actualValue"`
	DriftType     DriftType     `db:"drift_type" json:"driftType"`
	Severity      DriftSeverity `db:"severity" json:"severity"`
	DetectedAt    time.Time     `db:"detected_at" json:"detectedAt"`
	ResolvedAt    *time.Time    `db:"resolved_at" json:"resolvedAt,omitempty"`
	ResolvedBy    string        `db:"resolved_by" json:"resolvedBy,omitempty"`
	Resolution    string        `db:"resolution" json:"resolution,omitempty"`
	Remediated    bool          `db:"remediated" json:"remediated"`
	CreatedAt     time.Time     `db:"created_at" json:"createdAt"`
	UpdatedAt     time.Time     `db:"updated_at" json:"updatedAt"`
}

// DriftFilter 漂移查询过滤器
type DriftFilter struct {
	Environment    string       `form:"environment"`
	CIID           string       `form:"ciId"`
	CIType         string       `form:"ciType"`
	DriftType      DriftType    `form:"driftType"`
	Severity       DriftSeverity `form:"severity"`
	UnresolvedOnly bool         `form:"unresolved"`
	Page           int          `form:"page"`
	PageSize       int          `form:"pageSize"`
}

// DriftScanResult 扫描结果
type DriftScanResult struct {
	TenantID    string        `json:"tenantId"`
	Environment string        `json:"environment"`
	ScannedAt   time.Time     `json:"scannedAt"`
	TotalCIs    int           `json:"totalCIs"`
	DriftCount  int           `json:"driftCount"`
	Drifts      []DriftRecord `json:"drifts,omitempty"`
}

// DriftStats 漂移统计
type DriftStats struct {
	TotalDrifts      int            `json:"totalDrifts"`
	UnresolvedCount  int            `json:"unresolvedCount"`
	CriticalCount    int            `json:"criticalCount"`
	WarningCount     int            `json:"warningCount"`
	InfoCount        int            `json:"infoCount"`
	ByType           map[string]int `json:"byType"`
	BySeverity       map[string]int `json:"bySeverity"`
}

// RemediationResult 自动修复结果
type RemediationResult struct {
	DriftID string `json:"driftId"`
	Success bool   `json:"success"`
	Action  string `json:"action"`
	Message string `json:"message"`
}

// --- Request/Response types ---

type CreateDriftRequest struct {
	CIID          string        `json:"ciId" binding:"required"`
	CIName        string        `json:"ciName"`
	CIType        string        `json:"ciType"`
	Property      string        `json:"property"`
	Environment   string        `json:"environment" binding:"required"`
	ExpectedValue string        `json:"expectedValue"`
	ActualValue   string        `json:"actualValue"`
	DriftType     DriftType     `json:"driftType" binding:"required"`
	Severity      DriftSeverity `json:"severity"`
}

type ScanRequest struct {
	Environment string `json:"environment" binding:"required"`
}

type ResolveRequest struct {
	ResolvedBy string `json:"resolvedBy" binding:"required"`
	Resolution string `json:"resolution"`
}