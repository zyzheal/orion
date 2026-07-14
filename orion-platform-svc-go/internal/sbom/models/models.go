package models

import "time"

// Format constants
const (
	FormatSPDX      = "spdx"
	FormatCycloneDX = "cyclonedx"
	FormatSWID      = "swid"
)

// Status constants
const (
	StatusGenerated = "generated"
	StatusScanning  = "scanning"
	StatusScanned   = "scanned"
	StatusAttested  = "attested"
	StatusExpired   = "expired"
)

// Severity constants
const (
	SeverityCritical   = "critical"
	SeverityHigh       = "high"
	SeverityMedium     = "medium"
	SeverityLow        = "low"
	SeverityNegligible = "negligible"
	SeverityUnknown    = "unknown"
)

// License type constants
const (
	LicensePermissive = "permissive"
	LicenseProprietary = "proprietary"
	LicenseGPL        = "gpl"
	LicenseLGPL       = "lgpl"
	LicenseMIT        = "mit"
	LicenseApache     = "apache"
	LicenseBSD        = "bsd"
	LicenseCDDL       = "cddl"
	LicenseECL        = "ecl"
	LicenseUnknown    = "unknown"
)

// Vulnerability status constants
const (
	VulnStatusOpen     = "open"
	VulnStatusFixed    = "fixed"
	VulnStatusIgnored  = "ignored"
	VulnStatusAccepted = "accepted"
)

// Attestation type constants
const (
	AttestationProvenance  = "provenance"
	AttestationVulnerability = "vulnerability"
	AttestationLicense     = "license"
	AttestationQuality     = "quality"
)

// --- Domain Models ---

// SBOMDocument represents a Software Bill of Materials document.
type SBOMDocument struct {
	ID          string `db:"id" json:"id"`
	TenantID    string `db:"tenant_id" json:"tenantId"`
	Name        string `db:"name" json:"name"`
	Version     string `db:"version" json:"version"`
	Format      string `db:"format" json:"format"`
	Status      string `db:"status" json:"status"`
	ArtifactID  string `db:"artifact_id" json:"artifactId"`
	ArtifactType string `db:"artifact_type" json:"artifactType"`
	ComponentsCount   int    `db:"components_count" json:"componentsCount"`
	VulnerabilitiesCount int `db:"vulnerabilities_count" json:"vulnerabilitiesCount"`
	LicensesCount       int  `db:"licenses_count" json:"licensesCount"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
	ExpiresAt   *time.Time `db:"expires_at" json:"expiresAt"`
	Metadata    string `db:"metadata" json:"metadata"`
}

// SBOMComponent represents a component within an SBOM.
type SBOMComponent struct {
	ID              string `db:"id" json:"id"`
	SBOMID          string `db:"sbom_id" json:"sbomId"`
	Name            string `db:"name" json:"name"`
	Version         string `db:"version" json:"version"`
	Type            string `db:"type" json:"type"`
	Supplier        *string `db:"supplier" json:"supplier"`
	Author          *string `db:"author" json:"author"`
	Publisher       *string `db:"publisher" json:"publisher"`
	Purl            *string `db:"purl" json:"purl"`
	Cpe             *string `db:"cpe" json:"cpe"`
	Swid            *string `db:"swid" json:"swid"`
	Hash            string `db:"hash" json:"hash"`
	LicenseID       string `db:"license_id" json:"licenseId"`
	LicenseName     string `db:"license_name" json:"licenseName"`
	LicenseType     string `db:"license_type" json:"licenseType"`
	Dependencies    string `db:"dependencies" json:"dependencies"`
	Properties      string `db:"properties" json:"properties"`
	CreatedAt       time.Time `db:"created_at" json:"createdAt"`
}

// Vulnerability represents a vulnerability finding in an SBOM component.
type Vulnerability struct {
	ID              string  `db:"id" json:"id"`
	SBOMID          string  `db:"sbom_id" json:"sbomId"`
	ComponentID     string  `db:"component_id" json:"componentId"`
	ComponentName   string  `db:"component_name" json:"componentName"`
	CVEID           string  `db:"cve_id" json:"cveId"`
	Severity        string  `db:"severity" json:"severity"`
	CVSSScore       float64 `db:"cvss_score" json:"cvssScore"`
	Description     string  `db:"description" json:"description"`
	AffectedVersions string `db:"affected_versions" json:"affectedVersions"`
	FixedVersions   *string `db:"fixed_versions" json:"fixedVersions"`
	References      string  `db:"references" json:"references"`
	Status          string  `db:"status" json:"status"`
	PublishedAt     time.Time `db:"published_at" json:"publishedAt"`
	DiscoveredAt    time.Time `db:"discovered_at" json:"discoveredAt"`
}

// LicenseInfo represents a license summary within an SBOM.
type LicenseInfo struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	SpdxID          string `json:"spdxId"`
	Type            string `json:"type"`
	ComponentsCount int    `json:"componentsCount"`
	RiskLevel       string `json:"riskLevel"`
	Obligations     string `json:"obligations"`
	Restrictions    string `json:"restrictions"`
	Compatibility   string `json:"compatibility"`
}

// SBOMAttestation represents a proof/attestation for an SBOM.
type SBOMAttestation struct {
	ID          string    `db:"id" json:"id"`
	SBOMID      string    `db:"sbom_id" json:"sbomId"`
	Type        string    `db:"type" json:"type"`
	Policy      string    `db:"policy" json:"policy"`
	VerifiedBy  string    `db:"verified_by" json:"verifiedBy"`
	VerifiedAt  time.Time `db:"verified_at" json:"verifiedAt"`
	Signature   *string   `db:"signature" json:"signature"`
	PublicKey   *string   `db:"public_key" json:"publicKey"`
	Payload     string    `db:"payload" json:"payload"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
}

// SBOMComparison represents a diff between two SBOM documents.
type SBOMComparison struct {
	ID                 string             `json:"id"`
	FromSBOMID         string             `json:"fromSBOMId"`
	ToSBOMID           string             `json:"toSBOMId"`
	AddedComponents    string             `json:"addedComponents"`
	RemovedComponents  string             `json:"removedComponents"`
	UpdatedComponents  string             `json:"updatedComponents"`
	NewVulnerabilities string             `json:"newVulnerabilities"`
	FixedVulnerabilities string           `json:"fixedVulnerabilities"`
	LicenseChanges     string             `json:"licenseChanges"`
	Summary            string             `json:"summary"`
}

// --- Request Models ---

// GenerateSBOMRequest is the request body for generating an SBOM.
type GenerateSBOMRequest struct {
	ArtifactID   string `json:"artifactId" binding:"required"`
	ArtifactType string `json:"artifactType" binding:"required"`
	Name         string `json:"name" binding:"required"`
	Version      string `json:"version" binding:"required"`
	Format       string `json:"format"`
	DeepScan     *bool  `json:"deepScan"`
}

// ScanRequest is the request body for executing a vulnerability scan.
type ScanRequest struct {
	Scanner            *string `json:"scanner"`
	SeverityThreshold  *string `json:"severityThreshold"`
}

// CreateAttestationRequest is the request body for creating an attestation.
type CreateAttestationRequest struct {
	Type    string                 `json:"type" binding:"required"`
	Policy  string                 `json:"policy" binding:"required"`
	Payload map[string]interface{} `json:"payload"`
}

// CompareSBOMRequest is the request body for comparing two SBOMs.
type CompareSBOMRequest struct {
	FromSBOMID string `json:"fromSBOMId" binding:"required"`
	ToSBOMID   string `json:"toSBOMId" binding:"required"`
}

// ListQuery is a generic pagination/filter query for listing SBOMs.
type ListQuery struct {
	Offset       int    `form:"offset"`
	Limit        int    `form:"limit"`
	Sort         string `form:"sort"`
	Order        string `form:"order"`
	ArtifactID   string `form:"artifactId"`
	ArtifactType string `form:"artifactType"`
	Status       string `form:"status"`
	Format       string `form:"format"`
}

// ExportResponse is the response for exporting an SBOM.
type ExportResponse struct {
	Format  string `json:"format"`
	Content string `json:"content"`
}

// PaginatedResponse is a generic paginated response envelope.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Offset   int         `json:"offset"`
	Limit    int         `json:"limit"`
}
