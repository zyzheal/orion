package models

import (
	"fmt"
	"time"
)

// CoverageStatus indicates the RLS state of a table.
type CoverageStatus string

const (
	CoverageEnabled  CoverageStatus = "enabled"
	CoverageDisabled CoverageStatus = "disabled"
	CoverageMissing  CoverageStatus = "missing"
)

// PolicyType classifies a policy's effect.
type PolicyType string

const (
	PolicyPermit   PolicyType = "PERMIT"
	PolicyRestrict PolicyType = "RESTRICT"
)

// PolicyCommand classifies the SQL command the policy applies to.
type PolicyCommand string

const (
	CommandAll      PolicyCommand = "ALL"
	CommandSelect   PolicyCommand = "SELECT"
	CommandInsert   PolicyCommand = "INSERT"
	CommandUpdate   PolicyCommand = "UPDATE"
	CommandDelete   PolicyCommand = "DELETE"
	CommandTruncate PolicyCommand = "TRUNCATE"
)

// TableAudit holds the audit state of one table.
type TableAudit struct {
	SchemaName    string         `json:"schemaName"`
	TableName     string         `json:"tableName"`
	RLSEnabled    bool           `json:"rlsEnabled"`
	RLSForce      bool           `json:"rlsForce"`
	Coverage      CoverageStatus `json:"coverage"`
	Policies      []PolicyAudit  `json:"policies"`
	PolicyCount   int            `json:"policyCount"`
	Columns       []string       `json:"columns,omitempty"`
	SizeBytes     int64          `json:"sizeBytes,omitempty"`
	Sensitivity   string         `json:"sensitivity,omitempty"`
	TenantColumn  string         `json:"tenantColumn,omitempty"`
	LastCheckedAt time.Time      `json:"lastCheckedAt"`
}

// PolicyAudit describes one RLS policy on a table.
type PolicyAudit struct {
	Name       string        `json:"name"`
	Type       PolicyType    `json:"type"`
	Command    PolicyCommand `json:"command"`
	Roles      []string      `json:"roles"`
	UsingExpr  string        `json:"usingExpr,omitempty"`
	WithCheck  string        `json:"withCheck,omitempty"`
	IsRowLevel bool          `json:"isRowLevel"`
}

// DatabaseAudit aggregates coverage across a database.
type DatabaseAudit struct {
	DatabaseName string        `json:"databaseName"`
	Host         string        `json:"host"`
	Tables       []*TableAudit `json:"tables"`
	Score        float64       `json:"score"`
	Covered      int           `json:"covered"`
	Total        int           `json:"total"`
	Gaps         int           `json:"gaps"`
	AssessedAt   time.Time     `json:"assessedAt"`
}

// CoverageSummary is a concise per-database summary.
type CoverageSummary struct {
	DatabaseName string         `json:"databaseName"`
	Score        float64        `json:"score"`
	Covered      int            `json:"covered"`
	Total        int            `json:"total"`
	Gaps         int            `json:"gaps"`
	Status       CoverageStatus `json:"status"`
}

// GapFinding describes a specific RLS gap.
type GapFinding struct {
	SchemaName     string `json:"schemaName"`
	TableName      string `json:"tableName"`
	Issue          string `json:"issue"`
	Severity       string `json:"severity"`
	Recommendation string `json:"recommendation"`
}

// AuditScanResult is the top-level output of an audit run.
type AuditScanResult struct {
	Databases    []*DatabaseAudit `json:"databases"`
	TotalScore   float64          `json:"totalScore"`
	TotalCovered int              `json:"totalCovered"`
	TotalTables  int              `json:"totalTables"`
	GapCount     int              `json:"gapCount"`
	Gaps         []GapFinding     `json:"gaps"`
	ScannedAt    time.Time        `json:"scannedAt"`
}

// RemediationStep represents an automated or semi-automated fix action.
type RemediationStep struct {
	Action  string `json:"action"`
	SQL     string `json:"sql,omitempty"`
	DryRun  bool   `json:"dryRun"`
	Applied bool   `json:"applied"`
}

// EnableRLS generates a remediation to enable RLS on a table.
func EnableRLS(schema, table string) *RemediationStep {
	return &RemediationStep{
		Action: "enable_rls",
		SQL:    fmt.Sprintf(`ALTER TABLE %q.%q ENABLE ROW LEVEL SECURITY;`, schema, table),
		DryRun: true,
	}
}

// CreateTenantPolicy generates a remediation to add a tenant-scoped policy.
func CreateTenantPolicy(schema, table, tenantCol, policyName string) *RemediationStep {
	return &RemediationStep{
		Action: "add_tenant_policy",
		SQL: fmt.Sprintf(`CREATE POLICY %q ON %q.%q FOR ALL USING (%q = current_setting('app.current_tenant', true));`,
			policyName, schema, table, tenantCol),
		DryRun: true,
	}
}
