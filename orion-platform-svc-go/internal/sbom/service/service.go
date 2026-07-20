package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"orion/platform-svc-go/internal/sbom/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CountComponentsByLicense(ctx context.Context, sbomID string, tenantID string, licenseID string) (int, error)
	CountComponentsBySBOM(ctx context.Context, sbomID string, tenantID string) (int, error)
	CreateAttestation(ctx context.Context, att *models.SBOMAttestation) error
	CreateComponent(ctx context.Context, comp *models.SBOMComponent) error
	CreateSBOM(ctx context.Context, sbom *models.SBOMDocument) error
	CreateVulnerability(ctx context.Context, vuln *models.Vulnerability) error
	DeleteSBOM(ctx context.Context, id string, tenantID string) (bool, error)
	DistinctLicenses(ctx context.Context, sbomID string, tenantID string) ([]models.SBOMComponent, error)
	GetSBOM(ctx context.Context, id string, tenantID string) (*models.SBOMDocument, error)
	ListAttestations(ctx context.Context, sbomID string, tenantID string) ([]models.SBOMAttestation, error)
	ListComponents(ctx context.Context, sbomID string, tenantID string, offset, limit int) ([]models.SBOMComponent, int, error)
	ListSBOMs(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.SBOMDocument, int, error)
	ListVulnerabilities(ctx context.Context, sbomID string, tenantID string, severity *string, offset, limit int) ([]models.Vulnerability, int, error)
	UpdateSBOMCounts(ctx context.Context, id string, tenantID string, compCount, vulnCount, licCount int) error
	UpdateSBOMStatus(ctx context.Context, id string, tenantID string, status string) (*models.SBOMDocument, error)
}

// Repository defines the persistence contract for SBOM data.
type Repository interface {
	CreateSBOM(ctx context.Context, sbom *models.SBOMDocument) error
	GetSBOM(ctx context.Context, id string, tenantID string) (*models.SBOMDocument, error)
	ListSBOMs(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.SBOMDocument, int, error)
	DeleteSBOM(ctx context.Context, id string, tenantID string) (bool, error)
	CreateComponent(ctx context.Context, comp *models.SBOMComponent) error
	ListComponents(ctx context.Context, sbomID string, tenantID string, offset, limit int) ([]models.SBOMComponent, int, error)
	CountComponentsBySBOM(ctx context.Context, sbomID string, tenantID string) (int, error)
	UpdateSBOMCounts(ctx context.Context, id string, tenantID string, compCount, vulnCount, licCount int) error
	UpdateSBOMStatus(ctx context.Context, id string, tenantID string, status string) (*models.SBOMDocument, error)
	ListVulnerabilities(ctx context.Context, sbomID string, tenantID string, severity *string, offset, limit int) ([]models.Vulnerability, int, error)
	CreateVulnerability(ctx context.Context, vuln *models.Vulnerability) error
	DistinctLicenses(ctx context.Context, sbomID string, tenantID string) ([]models.SBOMComponent, error)
	CountComponentsByLicense(ctx context.Context, sbomID string, tenantID string, licenseID string) (int, error)
	ListAttestations(ctx context.Context, sbomID string, tenantID string) ([]models.SBOMAttestation, error)
	CreateAttestation(ctx context.Context, att *models.SBOMAttestation) error
}

type Service struct {
	repo Repository
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- SBOM CRUD ---

func (s *Service) GenerateSBOM(ctx context.Context, req *models.GenerateSBOMRequest, tenantID string) (*models.SBOMDocument, error) {
	format := req.Format
	if format == "" {
		format = models.FormatCycloneDX
	}

	sbom := &models.SBOMDocument{
		TenantID:     tenantID,
		Name:         req.Name,
		Version:      req.Version,
		Format:       format,
		Status:       models.StatusGenerated,
		ArtifactID:   req.ArtifactID,
		ArtifactType: req.ArtifactType,
	}
	if err := s.repo.CreateSBOM(ctx, sbom); err != nil {
		return nil, err
	}

	// Generate mock components
	if req.DeepScan != nil && *req.DeepScan {
		s.generateMockComponents(ctx, tenantID, sbom.ID, 50)
	} else {
		s.generateMockComponents(ctx, tenantID, sbom.ID, 20)
	}

	return s.repo.GetSBOM(ctx, sbom.ID, tenantID)
}

func (s *Service) ListSBOMs(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.SBOMDocument, int, error) {
	docs, total, err := s.repo.ListSBOMs(ctx, tenantID, q)
	if err != nil {
		return nil, 0, err
	}
	return docs, total, nil
}

func (s *Service) GetSBOM(ctx context.Context, id string, tenantID string) (*models.SBOMDocument, error) {
	sbom, err := s.repo.GetSBOM(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSBOMNotFound
		}
		return nil, err
	}
	return sbom, nil
}

func (s *Service) DeleteSBOM(ctx context.Context, id string, tenantID string) (bool, error) {
	deleted, err := s.repo.DeleteSBOM(ctx, id, tenantID)
	if err != nil {
		return false, err
	}
	return deleted, nil
}

// --- Components ---

func (s *Service) ListComponents(ctx context.Context, sbomID string, tenantID string, offset, limit int) ([]models.SBOMComponent, int, error) {
	if limit <= 0 {
		limit = 50
	}
	comps, total, err := s.repo.ListComponents(ctx, sbomID, tenantID, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	return comps, total, nil
}

// --- Vulnerabilities ---

func (s *Service) ListVulnerabilities(ctx context.Context, sbomID string, tenantID string, severity *string, offset, limit int) ([]models.Vulnerability, int, error) {
	if limit <= 0 {
		limit = 50
	}
	vulns, total, err := s.repo.ListVulnerabilities(ctx, sbomID, tenantID, severity, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	return vulns, total, nil
}

func (s *Service) ScanSBOM(ctx context.Context, id string, tenantID string, req *models.ScanRequest) (*models.SBOMDocument, error) {
	// Verify SBOM exists
	_, err := s.repo.GetSBOM(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSBOMNotFound
		}
		return nil, err
	}

	sbom, err := s.repo.UpdateSBOMStatus(ctx, id, tenantID, models.StatusScanning)
	if err != nil {
		return nil, err
	}

	// Generate mock vulnerabilities
	s.generateMockVulnerabilities(ctx, tenantID, id)

	sbom, err = s.repo.UpdateSBOMStatus(ctx, id, tenantID, models.StatusScanned)
	if err != nil {
		return nil, err
	}
	return sbom, nil
}

// --- Licenses ---

func (s *Service) GetLicenses(ctx context.Context, sbomID string, tenantID string) ([]models.LicenseInfo, error) {
	distinctLicenses, err := s.repo.DistinctLicenses(ctx, sbomID, tenantID)
	if err != nil {
		return nil, err
	}
	if len(distinctLicenses) == 0 {
		return []models.LicenseInfo{}, nil
	}

	licenses := make([]models.LicenseInfo, len(distinctLicenses))
	for i, comp := range distinctLicenses {
		count, _ := s.repo.CountComponentsByLicense(ctx, sbomID, tenantID, comp.LicenseID)
		licenses[i] = models.LicenseInfo{
			ID:              "license_" + comp.LicenseID,
			Name:            comp.LicenseName,
			SpdxID:          comp.LicenseID,
			Type:            comp.LicenseType,
			ComponentsCount: count,
			RiskLevel:       getLicenseRiskLevel(comp.LicenseType),
			Obligations:     getLicenseObligations(comp.LicenseType),
			Restrictions:    getLicenseRestrictions(comp.LicenseType),
			Compatibility:   getLicenseCompatibility(comp.LicenseType),
		}
	}
	return licenses, nil
}

// --- Attestations ---

func (s *Service) ListAttestations(ctx context.Context, sbomID string, tenantID string) ([]models.SBOMAttestation, error) {
	atts, err := s.repo.ListAttestations(ctx, sbomID, tenantID)
	if err != nil {
		return nil, err
	}
	return atts, nil
}

func (s *Service) CreateAttestation(ctx context.Context, sbomID string, tenantID string, req *models.CreateAttestationRequest) (*models.SBOMAttestation, error) {
	_, err := s.repo.GetSBOM(ctx, sbomID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSBOMNotFound
		}
		return nil, err
	}

	att := &models.SBOMAttestation{
		SBOMID:     sbomID,
		Type:       req.Type,
		Policy:     req.Policy,
		VerifiedBy: "policy-engine",
		VerifiedAt: time.Now().UTC(),
	}
	if req.Payload != nil {
		att.Payload = "{}" // In production would JSON-encode payload
	}
	if err := s.repo.CreateAttestation(ctx, att); err != nil {
		return nil, err
	}

	sbom, err := s.repo.UpdateSBOMStatus(ctx, sbomID, tenantID, models.StatusAttested)
	if err != nil {
		return nil, err
	}
	_ = sbom

	return att, nil
}

// --- Export ---

func (s *Service) ExportSBOM(ctx context.Context, id string, tenantID string, format string) (*models.ExportResponse, error) {
	sbom, err := s.GetSBOM(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}

	if format == "" {
		format = models.FormatCycloneDX
	}

	comps, _, err := s.repo.ListComponents(ctx, id, tenantID, 0, 1000)
	if err != nil {
		return nil, err
	}

	content := formatSBOMContent(sbom, comps, format)
	return &models.ExportResponse{Format: format, Content: content}, nil
}

// --- Compare ---

func (s *Service) CompareSBOMs(ctx context.Context, fromID, toID, tenantID string) (*models.SBOMComparison, error) {
	_, err := s.repo.GetSBOM(ctx, fromID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSBOMNotFound
		}
		return nil, err
	}
	_, err = s.repo.GetSBOM(ctx, toID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSBOMNotFound
		}
		return nil, err
	}

	fromComps, _, _ := s.repo.ListComponents(ctx, fromID, tenantID, 0, 1000)
	toComps, _, _ := s.repo.ListComponents(ctx, toID, tenantID, 0, 1000)

	fromNames := make(map[string]models.SBOMComponent, len(fromComps))
	for _, c := range fromComps {
		fromNames[c.Name] = c
	}
	toNames := make(map[string]models.SBOMComponent, len(toComps))
	for _, c := range toComps {
		toNames[c.Name] = c
	}

	var added, removed []string
	for name, comp := range toNames {
		if _, ok := fromNames[name]; !ok {
			added = append(added, comp.Name)
		}
	}
	for name, comp := range fromNames {
		if _, ok := toNames[name]; !ok {
			removed = append(removed, comp.Name)
		}
	}

	var updated []string
	for name, toComp := range toNames {
		if fromComp, ok := fromNames[name]; ok && fromComp.Version != toComp.Version {
			updated = append(updated, fmt.Sprintf("%s:%s→%s", name, fromComp.Version, toComp.Version))
		}
	}

	summary := fmt.Sprintf("SBOM 比较: 新增 %d 个组件，移除 %d 个组件，更新 %d 个组件", len(added), len(removed), len(updated))

	return &models.SBOMComparison{
		ID:                   "compare_" + uuid.New().String(),
		FromSBOMID:           fromID,
		ToSBOMID:             toID,
		AddedComponents:      toJSONArray(added),
		RemovedComponents:    toJSONArray(removed),
		UpdatedComponents:    toJSONArray(updated),
		NewVulnerabilities:   "[]",
		FixedVulnerabilities: "[]",
		LicenseChanges:       "[]",
		Summary:              summary,
	}, nil
}

// --- Mock generation ---

func (s *Service) generateMockComponents(ctx context.Context, tenantID string, sbomID string, count int) {
	packages := []struct {
		name    string
		version string
		license string
	}{
		{"express", "4.18.2", "MIT"},
		{"lodash", "4.17.21", "MIT"},
		{"axios", "1.4.0", "MIT"},
		{"react", "18.2.0", "MIT"},
		{"typescript", "5.0.4", "Apache-2.0"},
		{"webpack", "5.88.0", "MIT"},
		{"jest", "29.5.0", "MIT"},
		{"eslint", "8.44.0", "MIT"},
		{"fastify", "4.21.0", "MIT"},
		{"node", "20.5.0", "MIT"},
	}

	for i := 0; i < count; i++ {
		pkg := packages[i%len(packages)]
		comp := &models.SBOMComponent{
			SBOMID:       sbomID,
			Name:         pkg.name,
			Version:      pkg.version,
			Type:         "library",
			Purl:         stringPtr(fmt.Sprintf("pkg:npm/%s@%s", pkg.name, pkg.version)),
			Hash:         fmt.Sprintf(`{"algorithm":"sha256","value":"hash_%d"}`, i),
			LicenseID:    pkg.license,
			LicenseName:  pkg.license,
			LicenseType:  getLicenseType(pkg.license),
			Dependencies: "[]",
			Properties:   "{}",
		}
		_ = s.repo.CreateComponent(ctx, comp)
	}

	compCount, _ := s.repo.CountComponentsBySBOM(ctx, sbomID, tenantID)
	licCount := len(packages)
	_ = s.repo.UpdateSBOMCounts(ctx, sbomID, tenantID, compCount, 0, licCount)
}

func (s *Service) generateMockVulnerabilities(ctx context.Context, tenantID string, sbomID string) {
	comps, _, _ := s.repo.ListComponents(ctx, sbomID, tenantID, 0, 10)
	if len(comps) == 0 {
		return
	}

	vulns := []struct {
		cveID    string
		severity string
		cvss     float64
	}{
		{"CVE-2023-1234", models.SeverityHigh, 8.5},
		{"CVE-2023-5678", models.SeverityMedium, 5.5},
		{"CVE-2023-9012", models.SeverityCritical, 9.8},
	}

	n := len(comps)
	if n > 5 {
		n = 5
	}

	vulnCount := 0
	for i := 0; i < n; i++ {
		v := vulns[rand.Intn(len(vulns))]
		vuln := &models.Vulnerability{
			SBOMID:           sbomID,
			ComponentID:      comps[i].ID,
			ComponentName:    comps[i].Name,
			CVEID:            v.cveID,
			Severity:         v.severity,
			CVSSScore:        v.cvss,
			Description:      fmt.Sprintf("安全漏洞 %s", v.cveID),
			AffectedVersions: comps[i].Version,
			References:       fmt.Sprintf("[\"https://nvd.nist.gov/vuln/detail/%s\"]", v.cveID),
			Status:           models.VulnStatusOpen,
			PublishedAt:      time.Now().UTC(),
			DiscoveredAt:     time.Now().UTC(),
		}
		_ = s.repo.CreateVulnerability(ctx, vuln)
		vulnCount++
	}

	compCount, _ := s.repo.CountComponentsBySBOM(ctx, sbomID, tenantID)
	_ = s.repo.UpdateSBOMCounts(ctx, sbomID, tenantID, compCount, vulnCount, 0)
}

// --- License helpers ---

func getLicenseType(licenseID string) string {
	switch {
	case strings.HasPrefix(licenseID, "MIT"):
		return models.LicenseMIT
	case strings.HasPrefix(licenseID, "Apache"):
		return models.LicenseApache
	case strings.HasPrefix(licenseID, "BSD"):
		return models.LicenseBSD
	case strings.HasPrefix(licenseID, "GPL"):
		return models.LicenseGPL
	case strings.HasPrefix(licenseID, "LGPL"):
		return models.LicenseLGPL
	default:
		return models.LicensePermissive
	}
}

func getLicenseRiskLevel(lt string) string {
	switch lt {
	case models.LicenseGPL:
		return "high"
	case models.LicenseLGPL, models.LicenseCDDL, models.LicenseECL:
		return "medium"
	default:
		return "low"
	}
}

func getLicenseObligations(lt string) string {
	switch lt {
	case models.LicenseGPL:
		return `["源代码必须公开","衍生作品必须使用相同许可证"]`
	case models.LicenseLGPL:
		return `["库使用需要注明","修改库需要公开源代码"]`
	case models.LicenseApache, models.LicenseMIT:
		return `["保留版权声明","保留许可证文本"]`
	default:
		return "[]"
	}
}

func getLicenseRestrictions(lt string) string {
	switch lt {
	case models.LicenseGPL:
		return `["不能与其他许可证混合","商业使用需要开源"]`
	case models.LicenseProprietary:
		return `["禁止分发","禁止修改"]`
	default:
		return "[]"
	}
}

func getLicenseCompatibility(lt string) string {
	switch lt {
	case models.LicenseMIT:
		return `["Apache-2.0","BSD","GPL"]`
	case models.LicenseApache:
		return `["MIT","BSD","GPL-3.0"]`
	case models.LicenseGPL:
		return `["GPL"]`
	default:
		return "[]"
	}
}

// --- Export formatting ---

func formatSBOMContent(sbom *models.SBOMDocument, comps []models.SBOMComponent, format string) string {
	if format == models.FormatSPDX {
		pkgs := make([]string, len(comps))
		for i, c := range comps {
			pkgs[i] = fmt.Sprintf(`{"SPDXID":"SPDXRef-%s","name":"%s","versionInfo":"%s","licenseConcluded":"%s"}`, c.ID, c.Name, c.Version, c.LicenseID)
		}
		return fmt.Sprintf(`{"spdxVersion":"SPDX-2.3","dataLicense":"CC0-1.0","SPDXID":"SPDXRef-%s","name":"%s","documentNamespace":"https://example.com/%s","packages":[%s]}`,
			sbom.ID, sbom.Name, sbom.ID, strings.Join(pkgs, ","))
	}

	// CycloneDX format
	compsJSON := make([]string, len(comps))
	for i, c := range comps {
		purl := ""
		if c.Purl != nil {
			purl = *c.Purl
		}
		compsJSON[i] = fmt.Sprintf(`{"bomRef":"%s","type":"%s","name":"%s","version":"%s","purl":"%s","licenses":[{"license":{"id":"%s"}]}`,
			c.ID, c.Type, c.Name, c.Version, purl, c.LicenseID)
	}
	return fmt.Sprintf(`{"bomFormat":"CycloneDX","specVersion":"1.5","serialNumber":"urn:uuid:%s","metadata":{"component":{"type":"%s","name":"%s","version":"%s"},"components":[%s]}`,
		sbom.ID, sbom.ArtifactType, sbom.Name, sbom.Version, strings.Join(compsJSON, ","))
}

// --- Utility helpers ---

func stringPtr(s string) *string {
	return &s
}

func toJSONArray(items []string) string {
	if len(items) == 0 {
		return "[]"
	}
	parts := make([]string, len(items))
	for i, v := range items {
		// Escape quotes in value
		v = strings.ReplaceAll(v, `"`, `\"`)
		parts[i] = fmt.Sprintf(`"%s"`, v)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

// --- Errors ---

var (
	ErrSBOMNotFound = errors.New("sbom not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrSBOMNotFound)
}

