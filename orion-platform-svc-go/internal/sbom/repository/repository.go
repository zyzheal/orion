package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/sbom/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- SBOMDocuments ---

func (r *Repository) CreateSBOM(ctx context.Context, sbom *models.SBOMDocument) error {
	sbom.ID = uuid.New().String()
	sbom.CreatedAt = time.Now().UTC()
	sbom.UpdatedAt = sbom.CreatedAt
	sbom.Metadata = "{}"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO sbom_documents (id, tenant_id, name, version, format, status, artifact_id, artifact_type,
		   components_count, vulnerabilities_count, licenses_count, created_at, updated_at, expires_at, metadata)
		 VALUES (:id, :tenantId, :name, :version, :format, :status, :artifactId, :artifactType,
		   :componentsCount, :vulnerabilitiesCount, :licensesCount, :createdAt, :updatedAt, :expiresAt, :metadata)`,
		sbom)
	return err
}

func (r *Repository) GetSBOM(ctx context.Context, id string, tenantID string) (*models.SBOMDocument, error) {
	var sbom models.SBOMDocument
	err := r.db.GetContext(ctx, &sbom,
		`SELECT * FROM sbom_documents WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &sbom, nil
}

func (r *Repository) ListSBOMs(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.SBOMDocument, int, error) {
	offset := q.Offset
	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	sort := q.Sort
	if sort == "" {
		sort = "created_at"
	}
	order := q.Order
	if order == "" {
		order = "DESC"
	}

	conds := []condition{{"tenant_id", tenantID}}
	if q.ArtifactID != "" {
		conds = append(conds, condition{"artifact_id", q.ArtifactID})
	}
	if q.ArtifactType != "" {
		conds = append(conds, condition{"artifact_type", q.ArtifactType})
	}
	if q.Status != "" {
		conds = append(conds, condition{"status", q.Status})
	}
	if q.Format != "" {
		conds = append(conds, condition{"format", q.Format})
	}

	where, args := buildWhere(conds)

	var total int
	err := r.db.GetContext(ctx, &total,
		"SELECT COUNT(*) FROM sbom_documents "+where, args...)
	if err != nil {
		return nil, 0, err
	}

	var docs []models.SBOMDocument
	listSQL := fmt.Sprintf("SELECT * FROM sbom_documents %s ORDER BY %s %s LIMIT $%d OFFSET $%d",
		where, sort, order, len(args)+1, len(args)+2)
	err = r.db.SelectContext(ctx, &docs, listSQL, append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	if docs == nil {
		docs = []models.SBOMDocument{}
	}
	return docs, total, nil
}

func (r *Repository) UpdateSBOMStatus(ctx context.Context, id string, tenantID string, status string) (*models.SBOMDocument, error) {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE sbom_documents SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, now, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetSBOM(ctx, id, tenantID)
}

func (r *Repository) UpdateSBOMCounts(ctx context.Context, id string, tenantID string, compCount, vulnCount, licCount int) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE sbom_documents SET components_count=$1, vulnerabilities_count=$2, licenses_count=$3, updated_at=$4
		 WHERE id=$5 AND tenant_id=$6`,
		compCount, vulnCount, licCount, now, id, tenantID)
	return err
}

func (r *Repository) DeleteSBOM(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM sbom_documents WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- SBOMComponents ---

func (r *Repository) CreateComponent(ctx context.Context, comp *models.SBOMComponent) error {
	comp.ID = uuid.New().String()
	comp.CreatedAt = time.Now().UTC()
	comp.Dependencies = "[]"
	comp.Properties = "{}"
	comp.Hash = "{}"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO sbom_components (id, sbom_id, name, version, type, supplier, author, publisher,
		   purl, cpe, swid, hash, license_id, license_name, license_type, dependencies, properties, created_at)
		 VALUES (:id, :sbomId, :name, :version, :type, :supplier, :author, :publisher,
		   :purl, :cpe, :swid, :hash, :licenseId, :licenseName, :licenseType, :dependencies, :properties, :createdAt)`,
		comp)
	return err
}

func (r *Repository) ListComponents(ctx context.Context, sbomID string, tenantID string, offset, limit int) ([]models.SBOMComponent, int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM sbom_components c
		 JOIN sbom_documents d ON c.sbom_id=d.id WHERE c.sbom_id=$1 AND d.tenant_id=$2`,
		sbomID, tenantID)
	if err != nil {
		return nil, 0, err
	}

	var comps []models.SBOMComponent
	err = r.db.SelectContext(ctx, &comps,
		`SELECT c.* FROM sbom_components c
		 JOIN sbom_documents d ON c.sbom_id=d.id
		 WHERE c.sbom_id=$1 AND d.tenant_id=$2
		 ORDER BY c.name ASC LIMIT $3 OFFSET $4`,
		sbomID, tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	if comps == nil {
		comps = []models.SBOMComponent{}
	}
	return comps, total, nil
}

func (r *Repository) CountComponentsBySBOM(ctx context.Context, sbomID string, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM sbom_components c
		 JOIN sbom_documents d ON c.sbom_id=d.id WHERE c.sbom_id=$1 AND d.tenant_id=$2`,
		sbomID, tenantID)
	return count, err
}

func (r *Repository) DistinctLicenses(ctx context.Context, sbomID string, tenantID string) ([]models.SBOMComponent, error) {
	var comps []models.SBOMComponent
	err := r.db.SelectContext(ctx, &comps,
		`SELECT DISTINCT ON (c.license_id) c.license_id, c.license_name, c.license_type
		 FROM sbom_components c
		 JOIN sbom_documents d ON c.sbom_id=d.id
		 WHERE c.sbom_id=$1 AND d.tenant_id=$2`,
		sbomID, tenantID)
	if err != nil {
		return nil, err
	}
	if comps == nil {
		comps = []models.SBOMComponent{}
	}
	return comps, nil
}

func (r *Repository) CountComponentsByLicense(ctx context.Context, sbomID string, tenantID string, licenseID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM sbom_components c
		 JOIN sbom_documents d ON c.sbom_id=d.id
		 WHERE c.sbom_id=$1 AND d.tenant_id=$2 AND c.license_id=$3`,
		sbomID, tenantID, licenseID)
	return count, err
}

// --- Vulnerabilities ---

func (r *Repository) CreateVulnerability(ctx context.Context, vuln *models.Vulnerability) error {
	vuln.ID = uuid.New().String()
	vuln.References = "[]"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO sbom_vulnerabilities (id, sbom_id, component_id, component_name, cve_id, severity,
		   cvss_score, description, affected_versions, fixed_versions, references, status, published_at, discovered_at)
		 VALUES (:id, :sbomId, :componentId, :componentName, :cveId, :severity,
		   :cvssScore, :description, :affectedVersions, :fixedVersions, :references, :status, :publishedAt, :discoveredAt)`,
		vuln)
	return err
}

func (r *Repository) ListVulnerabilities(ctx context.Context, sbomID string, tenantID string, severity *string, offset, limit int) ([]models.Vulnerability, int, error) {
	conds := []condition{
		{"c.sbom_id", sbomID},
		{"d.tenant_id", tenantID},
	}
	if severity != nil && *severity != "" {
		conds = append(conds, condition{"c.severity", *severity})
	}
	where, args := buildWhere(conds)

	var total int
	err := r.db.GetContext(ctx, &total,
		"SELECT COUNT(*) FROM sbom_vulnerabilities c JOIN sbom_documents d ON c.sbom_id=d.id "+where,
		args...)
	if err != nil {
		return nil, 0, err
	}

	var vulns []models.Vulnerability
	listSQL := fmt.Sprintf(`SELECT c.* FROM sbom_vulnerabilities c JOIN sbom_documents d ON c.sbom_id=d.id %s ORDER BY c.cvss_score DESC LIMIT $%d OFFSET $%d`,
		where, len(args)+1, len(args)+2)
	err = r.db.SelectContext(ctx, &vulns, listSQL, append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	if vulns == nil {
		vulns = []models.Vulnerability{}
	}
	return vulns, total, nil
}

// --- SBOMAttestations ---

func (r *Repository) CreateAttestation(ctx context.Context, att *models.SBOMAttestation) error {
	att.ID = uuid.New().String()
	att.CreatedAt = time.Now().UTC()
	att.Payload = "{}"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO sbom_attestations (id, sbom_id, type, policy, verified_by, verified_at,
		   signature, public_key, payload, created_at)
		 VALUES (:id, :sbomId, :type, :policy, :verifiedBy, :verifiedAt,
		   :signature, :publicKey, :payload, :createdAt)`,
		att)
	return err
}

func (r *Repository) ListAttestations(ctx context.Context, sbomID string, tenantID string) ([]models.SBOMAttestation, error) {
	var atts []models.SBOMAttestation
	err := r.db.SelectContext(ctx, &atts,
		`SELECT a.* FROM sbom_attestations a
		 JOIN sbom_documents d ON a.sbom_id=d.id
		 WHERE a.sbom_id=$1 AND d.tenant_id=$2
		 ORDER BY a.verified_at DESC`,
		sbomID, tenantID)
	if err != nil {
		return nil, err
	}
	if atts == nil {
		atts = []models.SBOMAttestation{}
	}
	return atts, nil
}

// --- Internal helpers ---

type condition struct {
	col string
	val interface{}
}

func buildWhere(conds []condition) (string, []interface{}) {
	parts := make([]string, len(conds))
	args := make([]interface{}, len(conds))
	for i, c := range conds {
		n := i + 1
		parts[i] = fmt.Sprintf("%s=$%d", c.col, n)
		args[i] = c.val
	}
	return "WHERE " + joinStrings(parts, " AND "), args
}

func joinStrings(ss []string, sep string) string {
	if len(ss) == 0 {
		return ""
	}
	result := ss[0]
	for _, s := range ss[1:] {
		result += sep + s
	}
	return result
}
