package repository

import (
	"context"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/supply-chain/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- SBOM ---

func (r *Repository) CreateSBOM(ctx context.Context, sbom *models.SBOM) error {
	sbom.ID = uuid.New().String()
	sbom.CreatedAt = time.Now().UTC()
	if sbom.SBOMFormat == "" {
		sbom.SBOMFormat = models.SBOMFormatSPDX
	}
	if sbom.SBOMVersion == "" {
		sbom.SBOMVersion = "1.4"
	}
	if sbom.Metadata == "" {
		sbom.Metadata = "{}"
	}
	if sbom.Components == "" {
		sbom.Components = "[]"
	}
	if sbom.Dependencies == "" {
		sbom.Dependencies = "[]"
	}
	if sbom.Vulnerabilities == "" {
		sbom.Vulnerabilities = "[]"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO supply_chain_sboms (id, tenant_id, pipeline_id, artifact_id, sbom_format, sbom_version, components, dependencies, vulnerabilities, metadata, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		sbom.ID, sbom.TenantID, sbom.PipelineID, sbom.ArtifactID, sbom.SBOMFormat, sbom.SBOMVersion,
		sbom.Components, sbom.Dependencies, sbom.Vulnerabilities, sbom.Metadata, sbom.CreatedAt)
	return err
}

func (r *Repository) GetSBOM(ctx context.Context, tenantID, sbomID string) (*models.SBOM, error) {
	var sbom models.SBOM
	err := r.db.GetContext(ctx, &sbom,
		`SELECT * FROM supply_chain_sboms WHERE id = $1 AND tenant_id = $2`, sbomID, tenantID)
	if err != nil {
		return nil, err
	}
	return &sbom, nil
}

func (r *Repository) ListSBOMs(ctx context.Context, tenantID string, q models.ListSBOMsQuery) ([]models.SBOM, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	cond := `WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	paramIdx := 2
	if q.ArtifactID != "" {
		cond += ` AND artifact_id = $` + strconv.Itoa(paramIdx)
		args = append(args, q.ArtifactID)
		paramIdx++
	}
	if q.PipelineID != "" {
		cond += ` AND pipeline_id = $` + strconv.Itoa(paramIdx)
		args = append(args, q.PipelineID)
		paramIdx++
	}
	if q.Format != "" {
		cond += ` AND sbom_format = $` + strconv.Itoa(paramIdx)
		args = append(args, q.Format)
		paramIdx++
	}
	cond += ` ORDER BY created_at DESC LIMIT $` + strconv.Itoa(paramIdx) + ` OFFSET $` + strconv.Itoa(paramIdx+1)
	args = append(args, q.Limit, q.Offset)
	var sboms []models.SBOM
	err := r.db.SelectContext(ctx, &sboms, `SELECT * FROM supply_chain_sboms `+cond, args...)
	return sboms, err
}

// --- Vulnerability ---

func (r *Repository) InsertVulnerability(ctx context.Context, vuln *models.Vulnerability) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO supply_chain_vulnerabilities (cve_id, name, version, description, severity, remediation, affected_range)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		vuln.CVEID, vuln.Name, vuln.Version, vuln.Description, vuln.Severity, vuln.Remediation, vuln.AffectedRange)
	return err
}

func (r *Repository) GetVulnerabilitiesForComponent(ctx context.Context, name, version string) ([]models.Vulnerability, error) {
	var vulns []models.Vulnerability
	err := r.db.SelectContext(ctx, &vulns,
		`SELECT * FROM supply_chain_vulnerabilities WHERE name = $1 AND version = $2 ORDER BY severity DESC`, name, version)
	return vulns, err
}

// --- Dependency Graph ---

func (r *Repository) InsertDependencyGraph(ctx context.Context, tenantID, packageName, packageVersion string, directDeps, transitiveDeps, vulnerablePaths []byte, depth int) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dependency_graphs (id, tenant_id, package_name, package_version, direct_deps, transitive_deps, vulnerable_paths, depth, analyzed_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		uuid.New().String(), tenantID, packageName, packageVersion, directDeps, transitiveDeps, vulnerablePaths, depth, time.Now().UTC())
	return err
}

func (r *Repository) GetDependencyGraph(ctx context.Context, tenantID, packageName, packageVersion string) (*models.DependencyGraph, error) {
	var graph models.DependencyGraph
	err := r.db.GetContext(ctx, &graph,
		`SELECT * FROM dependency_graphs WHERE tenant_id = $1 AND package_name = $2 AND package_version = $3 ORDER BY analyzed_at DESC LIMIT 1`,
		tenantID, packageName, packageVersion)
	if err != nil {
		return nil, err
	}
	return &graph, nil
}

// --- Artifact Signature ---

func (r *Repository) CreateSignature(ctx context.Context, sig *models.ArtifactSignature) error {
	sig.ID = uuid.New().String()
	sig.SignedAt = time.Now().UTC()
	if sig.SignatureType == "" {
		sig.SignatureType = "sha256"
	}
	sig.Verified = false
	if sig.Metadata == "" {
		sig.Metadata = "{}"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO artifact_signatures (id, tenant_id, artifact_id, signature, signature_type, public_key, certificate, signed_by, signed_at, verified, metadata)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		sig.ID, sig.TenantID, sig.ArtifactID, sig.Signature, sig.SignatureType, sig.PublicKey, sig.Certificate,
		sig.SignedBy, sig.SignedAt, sig.Verified, sig.Metadata)
	return err
}

func (r *Repository) GetSignature(ctx context.Context, artifactID, signature string) (*models.ArtifactSignature, error) {
	var sig models.ArtifactSignature
	err := r.db.GetContext(ctx, &sig,
		`SELECT * FROM artifact_signatures WHERE artifact_id = $1 AND signature = $2 ORDER BY signed_at DESC LIMIT 1`,
		artifactID, signature)
	if err != nil {
		return nil, err
	}
	return &sig, nil
}

func (r *Repository) VerifySignature(ctx context.Context, artifactID, signature string, verified bool) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE artifact_signatures SET verified = $1, verified_at = $2
		 WHERE artifact_id = $3 AND signature = $4`,
		verified, now, artifactID, signature)
	return err
}

func (r *Repository) GetSignaturesForArtifact(ctx context.Context, artifactID string) ([]models.ArtifactSignature, error) {
	var sigs []models.ArtifactSignature
	err := r.db.SelectContext(ctx, &sigs,
		`SELECT * FROM artifact_signatures WHERE artifact_id = $1 ORDER BY signed_at DESC`, artifactID)
	return sigs, err
}

// --- Supply Chain Report ---

func (r *Repository) GetSupplyChainReport(ctx context.Context, tenantID, pipelineID string) (*models.SupplyChainReport, error) {
	var report models.SupplyChainReport
	err := r.db.GetContext(ctx, &report,
		`SELECT * FROM supply_chain_reports WHERE tenant_id = $1 AND pipeline_id = $2 ORDER BY generated_at DESC LIMIT 1`,
		tenantID, pipelineID)
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *Repository) CreateSupplyChainReport(ctx context.Context, report *models.SupplyChainReport) error {
	report.GeneratedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO supply_chain_reports (id, tenant_id, pipeline_id, artifact_id, sbom_count, component_count, signature_count, vulnerability_summary, compliance_status, risk_score, generated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		uuid.New().String(), report.TenantID, report.PipelineID, report.ArtifactID, report.SBOMCount,
		report.ComponentCount, report.SignatureCount, report.VulnerabilitySummary,
		report.ComplianceStatus, report.RiskScore, report.GeneratedAt)
	return err
}

// --- Stats ---

func (r *Repository) GetSBOMCountForPipeline(ctx context.Context, tenantID, pipelineID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM supply_chain_sboms WHERE tenant_id = $1 AND pipeline_id = $2`, tenantID, pipelineID)
	return count, err
}

func (r *Repository) GetSignatureCountForArtifact(ctx context.Context, artifactID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM artifact_signatures WHERE artifact_id = $1`, artifactID)
	return count, err
}
