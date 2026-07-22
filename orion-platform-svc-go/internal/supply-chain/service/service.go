package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"orion/platform-svc-go/internal/supply-chain/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateSBOM(ctx context.Context, sbom *models.SBOM) error
	CreateSignature(ctx context.Context, sig *models.ArtifactSignature) error
	CreateSupplyChainReport(ctx context.Context, report *models.SupplyChainReport) error
	GetDependencyGraph(ctx context.Context, tenantID, packageName, packageVersion string) (*models.DependencyGraph, error)
	GetSBOM(ctx context.Context, tenantID, sbomID string) (*models.SBOM, error)
	GetSBOMCountForPipeline(ctx context.Context, tenantID, pipelineID string) (int, error)
	GetSignature(ctx context.Context, artifactID, signature string) (*models.ArtifactSignature, error)
	GetSignatureCountForArtifact(ctx context.Context, artifactID string) (int, error)
	GetSupplyChainReport(ctx context.Context, tenantID, pipelineID string) (*models.SupplyChainReport, error)
	GetVulnerabilitiesForComponent(ctx context.Context, tenantID, name, version string) ([]models.Vulnerability, error)
	InsertDependencyGraph(ctx context.Context, tenantID, packageName, packageVersion string, directDeps, transitiveDeps, vulnerablePaths []byte, depth int) error
	ListSBOMs(ctx context.Context, tenantID string, q models.ListSBOMsQuery) ([]models.SBOM, error)
	VerifySignature(ctx context.Context, artifactID, signature string, verified bool) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) GenerateSBOM(ctx context.Context, tenantID string, req *models.GenerateSBOMRequest) (*models.SBOM, error) {
	sbom := &models.SBOM{
		TenantID:        tenantID,
		ArtifactID:      req.ArtifactID,
		PipelineID:      req.PipelineID,
		SBOMFormat:      req.Format,
		SBOMVersion:     req.Version,
		Components:      req.Components,
		Dependencies:    req.Dependencies,
		Vulnerabilities: "[]",
		Metadata:        "{}",
	}
	err := s.repo.CreateSBOM(ctx, sbom)
	return sbom, err
}

func (s *Service) GetSBOM(ctx context.Context, tenantID, sbomID string) (*models.SBOM, error) {
	return s.repo.GetSBOM(ctx, tenantID, sbomID)
}

func (s *Service) ListSBOMs(ctx context.Context, tenantID string, q models.ListSBOMsQuery) ([]models.SBOM, error) {
	return s.repo.ListSBOMs(ctx, tenantID, q)
}

func (s *Service) AnalyzeDependencies(ctx context.Context, tenantID, packageName, version string, depth int) error {
	return s.repo.InsertDependencyGraph(ctx, tenantID, packageName, version, []byte("[]"), []byte("[]"), []byte("[]"), depth)
}

func (s *Service) GetDependencyGraph(ctx context.Context, tenantID, packageName, version string) (*models.DependencyGraph, error) {
	return s.repo.GetDependencyGraph(ctx, tenantID, packageName, version)
}

func (s *Service) SignArtifact(ctx context.Context, tenantID, artifactID string, req *models.SignArtifactRequest) (*models.ArtifactSignature, error) {
	sig := &models.ArtifactSignature{
		TenantID:      tenantID,
		ArtifactID:    artifactID,
		Signature:     "placeholder-signature",
		SignatureType: req.SignatureType,
		SignedBy:      req.SignedBy,
		Metadata:      "{}",
	}
	err := s.repo.CreateSignature(ctx, sig)
	return sig, err
}

func (s *Service) VerifyArtifactSignature(ctx context.Context, artifactID, signature string, req *models.VerifySignatureRequest) (*models.ArtifactSignature, error) {
	err := s.repo.VerifySignature(ctx, artifactID, signature, true)
	if err != nil {
		return nil, err
	}
	return s.repo.GetSignature(ctx, artifactID, signature)
}

func (s *Service) GenerateSupplyChainReport(ctx context.Context, tenantID, pipelineID, artifactID string) (*models.SupplyChainReport, error) {
	sbomCount, _ := s.repo.GetSBOMCountForPipeline(ctx, tenantID, pipelineID)
	sigCount, _ := s.repo.GetSignatureCountForArtifact(ctx, artifactID)

	report := &models.SupplyChainReport{
		TenantID:         tenantID,
		PipelineID:       pipelineID,
		ArtifactID:       &artifactID,
		SBOMCount:        sbomCount,
		SignatureCount:   sigCount,
		ComplianceStatus: "passed",
		RiskScore:        0,
		VulnerabilitySummary: models.VulnerabilitySummary{
			Critical: 0,
			High:     0,
			Medium:   0,
			Low:      0,
			Total:    0,
		},
	}
	err := s.repo.CreateSupplyChainReport(ctx, report)
	return report, err
}

func (s *Service) GetSupplyChainReport(ctx context.Context, tenantID, pipelineID string) (*models.SupplyChainReport, error) {
	return s.repo.GetSupplyChainReport(ctx, tenantID, pipelineID)
}

func (s *Service) GetVulnerabilitiesForComponent(ctx context.Context, tenantID, name, version string) ([]models.Vulnerability, error) {
	return s.repo.GetVulnerabilitiesForComponent(ctx, tenantID, name, version)
}
