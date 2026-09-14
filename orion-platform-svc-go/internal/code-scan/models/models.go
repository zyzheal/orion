package models

import "time"

// ScanRecord represents a code scan run.
//
// Every field carries a db tag because sqlx's default NameMapper lowercases
// Go field names: TotalVulns would bind to "totalvulns", which matches no
// placeholder in the INSERT and no column in the SELECT, so every write would
// die with 'could not find name total_vulns' and every read with
// 'missing destination name total_vulns'. The tags make the mapping explicit.
//
// The json tags are the wire contract for orion-frontend
// (src/pages/security/CodeScan/types.ts): it reads totalVulns / critical /
// high / medium / low / duration (seconds, rendered as "Ns") / startedAt and
// filters scans by status === 'completed', so the names and the unit must not
// change. TenantID, Error and the audit times are additive; the page ignores
// unknown keys.
type ScanRecord struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenantId,omitempty" db:"tenant_id"`
	Target      string     `json:"target" db:"target"`
	Branch      string     `json:"branch" db:"branch"`
	Status      string     `json:"status" db:"status"`
	TotalVulns  int        `json:"totalVulns" db:"total_vulns"`
	Critical    int        `json:"critical" db:"critical_count"`
	High        int        `json:"high" db:"high_count"`
	Medium      int        `json:"medium" db:"medium_count"`
	Low         int        `json:"low" db:"low_count"`
	Duration    int        `json:"duration" db:"duration_sec"`
	Error       string     `json:"error,omitempty" db:"error"`
	StartedAt   *time.Time `json:"startedAt,omitempty" db:"started_at"`
	CompletedAt *time.Time `json:"completedAt,omitempty" db:"completed_at"`
	CreatedAt   time.Time  `json:"createdAt,omitempty" db:"created_at"`
}

// VulnFinding represents a vulnerability finding produced by one scan run.
type VulnFinding struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenantId,omitempty" db:"tenant_id"`
	ScanID      string    `json:"scanId" db:"scan_id"`
	Category    string    `json:"category" db:"category"`
	Severity    string    `json:"severity" db:"severity"`
	File        string    `json:"file" db:"file_path"`
	Line        int       `json:"line" db:"line"`
	Description string    `json:"description" db:"description"`
	Fix         string    `json:"fix,omitempty" db:"fix"`
	CreatedAt   time.Time `json:"createdAt,omitempty" db:"created_at"`
}

// Counts holds the per-severity aggregation of one scan run. The json tags
// reuse ScanRecord's names so a count set can be applied to a ScanRecord
// without a field-by-field copy.
type Counts struct {
	Total    int `json:"totalVulns"`
	Critical int `json:"critical"`
	High     int `json:"high"`
	Medium   int `json:"medium"`
	Low      int `json:"low"`
}

// CreateScanRequest is the request body for creating a new scan.
type CreateScanRequest struct {
	Target string `json:"target" binding:"required"`
	Branch string `json:"branch,omitempty"`
}
