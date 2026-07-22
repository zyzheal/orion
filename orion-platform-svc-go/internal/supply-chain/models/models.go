package models

import "time"

// SBOMFormat represents the SBOM format type.
type SBOMFormat string

const (
	SBOMFormatCycloneDX SBOMFormat = "cyclonedx"
	SBOMFormatSPDX      SBOMFormat = "spdx"
)

// VulnerabilitySeverity represents a vulnerability severity level.
type VulnerabilitySeverity string

const (
	SeverityCritical VulnerabilitySeverity = "critical"
	SeverityHigh     VulnerabilitySeverity = "high"
	SeverityMedium   VulnerabilitySeverity = "medium"
	SeverityLow      VulnerabilitySeverity = "low"
)

// Artifact represents a supply-chain artifact record.
type Artifact struct {
	ID       string    `json:"id" db:"id"`
	TenantID string    `json:"tenant_id" db:"tenant_id"`
	Name     string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// SBOM represents a Software Bill of Materials.
type SBOM struct {
	ID            string            `json:"id" db:"id"`
	TenantID      string            `json:"tenant_id" db:"tenant_id"`
	PipelineID    *string           `json:"pipeline_id,omitempty" db:"pipeline_id"`
	ArtifactID    string            `json:"artifact_id" db:"artifact_id"`
	SBOMFormat    SBOMFormat        `json:"sbom_format" db:"sbom_format"`
	SBOMVersion   string            `json:"sbom_version" db:"sbom_version"`
	Components    string            `json:"components" db:"components"`         // JSON array
	Dependencies  string            `json:"dependencies" db:"dependencies"`     // JSON array
	Vulnerabilities string          `json:"vulnerabilities" db:"vulnerabilities"` // JSON array
	Metadata      string            `json:"metadata" db:"metadata"`             // JSON object
	CreatedAt     time.Time         `json:"created_at" db:"created_at"`
}

// SBOMListResponse is the paginated list of SBOMs.
type SBOMListResponse struct {
	SBOMs []SBOM `json:"sboms"`
	Total int    `json:"total"`
}

// --- Request models ---

// GenerateSBOMRequest is the request to generate a new SBOM.
type GenerateSBOMRequest struct {
	ArtifactID   string      `json:"artifact_id" binding:"required"`
	PipelineID   *string     `json:"pipeline_id"`
	Format       SBOMFormat  `json:"format"`
	Version      string      `json:"version"`
	Components   string      `json:"components" binding:"required"` // JSON array
	Dependencies string      `json:"dependencies"`                  // JSON array
}

// ListSBOMsQuery is the query parameters for listing SBOMs.
type ListSBOMsQuery struct {
	ArtifactID string `form:"artifact_id"`
	PipelineID string `form:"pipeline_id"`
	Format     string `form:"sbom_format"`
	Limit      int    `form:"limit"`
	Offset     int    `form:"offset"`
}

// AnalyzeDependenciesRequest is the request to analyze package dependencies.
type AnalyzeDependenciesRequest struct {
	PackageName string `json:"package_name"` // path param
	Version     string `json:"version"`       // path param
	Depth       *int   `json:"depth"`
}

// GetDependencyGraphRequest is the request to build a dependency graph.
type GetDependencyGraphRequest struct {
	Packages []string `json:"packages" binding:"required"`
}

// SignArtifactRequest is the request to sign an artifact.
type SignArtifactRequest struct {
	PrivateKey    string `json:"private_key"`
	SignedBy      string `json:"signed_by"`
	SignatureType string `json:"signature_type"`
}

// VerifySignatureRequest is the request to verify an artifact signature.
type VerifySignatureRequest struct {
	Signature string `json:"signature" binding:"required"`
	PublicKey string `json:"public_key"`
}

// --- Response models ---

// DependencyTree represents the analyzed dependency tree.
type DependencyTree struct {
	Root                 *DependencyNode `json:"root"`
	TotalNodes           int             `json:"total_nodes"`
	MaxDepth             int             `json:"max_depth"`
	CircularDependencies [][]string      `json:"circular_dependencies"`
	VulnerablePaths      []string        `json:"vulnerable_paths"`
}

// DependencyNode represents a node in the dependency tree.
type DependencyNode struct {
	Name     string           `json:"name"`
	Version  string           `json:"version"`
	Scope    string           `json:"scope"`
	Depth    int              `json:"depth"`
	Children []DependencyNode `json:"children,omitempty"`
}

// DependencyGraph represents a multi-package dependency graph.
type DependencyGraph struct {
	Packages   []DependencyNode `json:"packages"`
	Nodes      int              `json:"nodes"`
	Edges      int              `json:"edges"`
	Depth      int              `json:"depth"`
	GeneratedAt time.Time       `json:"generated_at"`
}

// ArtifactSignature represents a persisted artifact signature record.
type ArtifactSignature struct {
	ID           string     `json:"id" db:"id"`
	TenantID     string     `json:"tenant_id" db:"tenant_id"`
	ArtifactID   string     `json:"artifact_id" db:"artifact_id"`
	Signature    string     `json:"signature" db:"signature"`
	SignatureType string    `json:"signature_type" db:"signature_type"`
	PublicKey    *string    `json:"public_key,omitempty" db:"public_key"`
	Certificate  *string    `json:"certificate,omitempty" db:"certificate"`
	SignedBy     string     `json:"signed_by" db:"signed_by"`
	SignedAt     time.Time  `json:"signed_at" db:"signed_at"`
	Verified     bool       `json:"verified" db:"verified"`
	VerifiedAt   *time.Time `json:"verified_at,omitempty" db:"verified_at"`
	Metadata     string     `json:"metadata" db:"metadata"` // JSON object
}

// ArtifactSignatureResponse is the response for a signing/verification operation.
type ArtifactSignatureResponse struct {
	ID          string `json:"id"`
	ArtifactID  string `json:"artifact_id"`
	Signature   string `json:"signature"`
	SignatureType string `json:"signature_type"`
	SignedBy    string `json:"signed_by"`
	SignedAt    string `json:"signed_at"`
	Verified    bool   `json:"verified"`
}

// Vulnerability represents a found vulnerability in a component.
type Vulnerability struct {
	CVEID         string             `json:"cve_id" db:"cve_id"`
	TenantID      string             `json:"tenant_id" db:"tenant_id"`
	Name          string             `json:"name" db:"name"`
	Version       string             `json:"version" db:"version"`
	Description   string             `json:"description" db:"description"`
	Severity      VulnerabilitySeverity `json:"severity" db:"severity"`
	Remediation   *string            `json:"remediation,omitempty" db:"remediation"`
	AffectedRange string             `json:"affected_range" db:"affected_range"`
}

// VulnerabilityReport is the vulnerability report for a component.
type VulnerabilityReport struct {
	Vulnerabilities []Vulnerability `json:"vulnerabilities"`
	ComponentName   string          `json:"component_name"`
	ComponentVersion string         `json:"component_version"`
	Total           int             `json:"total"`
}

// SupplyChainReport is the aggregate supply-chain security report for a pipeline.
type SupplyChainReport struct {
	TenantID          string                         `db:"tenant_id" json:"tenantId"`
	PipelineID        string                         `json:"pipeline_id"`
	ArtifactID          *string                        `json:"artifact_id"`
	SBOMCount           int                            `json:"sbom_count"`
	ComponentCount      int                            `json:"component_count"`
	SignatureCount      int                            `json:"signature_count"`
	VulnerabilitySummary VulnerabilitySummary          `json:"vulnerability_summary"`
	ComplianceStatus    string                         `json:"compliance_status"`
	RiskScore           int                            `json:"risk_score"`
	GeneratedAt         time.Time                      `json:"generated_at"`
}

// VulnerabilitySummary aggregates vulnerability counts by severity.
type VulnerabilitySummary struct {
	Critical int `json:"critical"`
	High     int `json:"high"`
	Medium   int `json:"medium"`
	Low      int `json:"low"`
	Total    int `json:"total"`
}
