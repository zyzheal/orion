package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/api-governance/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateContract(ctx context.Context, req *models.CreateContractRequest, tenantID string) (*models.Contract, error)
	CreateRule(ctx context.Context, req *models.CreateRuleRequest, tenantID string) (*models.Rule, error)
	CreateVerification(ctx context.Context, req *models.VerifyRequest, contractID string, passed bool, violations []string, tenantID string) error
	CreateVersion(ctx context.Context, req *models.CreateVersionRequest, tenantID string) (*models.Version, error)
	GetContract(ctx context.Context, id string, tenantID string) (*models.Contract, error)
	GetGovernanceStats(ctx context.Context, tenantID string) (models.GovernanceStats, error)
	GetVerificationHistory(ctx context.Context, contractID string, tenantID string) ([]models.VerificationHistory, error)
	GetVersion(ctx context.Context, id string, tenantID string) (*models.Version, error)
	ListContracts(ctx context.Context, tenantID string, apiName *string, status *string) ([]models.Contract, error)
	ListDeprecatedVersions(ctx context.Context, tenantID string) ([]models.Version, error)
	ListVersions(ctx context.Context, tenantID string, apiName *string, status *string) ([]models.Version, error)
	ListViolations(ctx context.Context, tenantID string, contractID *string, severity *string) ([]models.Violation, error)
	UpdateVersion(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Version, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

var (
	ErrNotFound = errors.New("resource not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

// getTenantID extracts tenant ID from context string.
func getTenantID(tenantID string) string {
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// ---- Contracts ----

func (s *Service) CreateContract(ctx context.Context, req *models.CreateContractRequest, tenantID string) (*models.Contract, error) {
	return s.repo.CreateContract(ctx, req, getTenantID(tenantID))
}

func (s *Service) GetContract(ctx context.Context, id string, tenantID string) (*models.Contract, error) {
	c, err := s.repo.GetContract(ctx, id, getTenantID(tenantID))
	if err != nil {
		return nil, ErrNotFound
	}
	return c, nil
}

func (s *Service) ListContracts(ctx context.Context, tenantID string, apiName *string, status *string) ([]models.Contract, error) {
	return s.repo.ListContracts(ctx, getTenantID(tenantID), apiName, status)
}

// ---- Verification ----

func (s *Service) EvaluateContract(ctx context.Context, id string, tenantID string) (*models.Contract, error) {
	// Evaluate always returns compliance=true with static checks.
	c, err := s.GetContract(ctx, id, tenantID)
	if err != nil {
		return nil, ErrNotFound
	}
	return c, nil
}

func (s *Service) VerifyContract(ctx context.Context, id string, req *models.VerifyRequest, tenantID string) (*models.VerifyResult, error) {
	c, err := s.GetContract(ctx, id, tenantID)
	if err != nil {
		return nil, ErrNotFound
	}

	// Parse response schema and check fields
	var responseSchema map[string]interface{}
	if c.ResponseSchema != "" {
		_ = json.Unmarshal([]byte(c.ResponseSchema), &responseSchema)
	}

	violations := []string{}
	actualResponse := req.ActualResponse
	if actualResponse == nil {
		actualResponse = make(map[string]interface{})
	}
	for key := range responseSchema {
		if _, ok := actualResponse[key]; !ok {
			violations = append(violations, "Missing required field: "+key)
		}
	}

	endpoint := ""
	method := ""
	if req.Endpoint != nil {
		endpoint = *req.Endpoint
	}
	if req.Method != nil {
		method = *req.Method
	}
	if endpoint == "" {
		endpoint = c.Path
	}
	if method == "" {
		method = c.Method
	}

	passed := len(violations) == 0

	_ = s.repo.CreateVerification(ctx, req, id, passed, violations, getTenantID(tenantID))
	return &models.VerifyResult{
		ContractID: id,
		Passed:     passed,
		Violations: violations,
		Endpoint:   endpoint,
		Method:     method,
		VerifiedAt: time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func (s *Service) GetVerificationHistory(ctx context.Context, id string, tenantID string) ([]models.VerificationHistory, error) {
	return s.repo.GetVerificationHistory(ctx, id, getTenantID(tenantID))
}

// ---- Violations ----

func (s *Service) ListViolations(ctx context.Context, tenantID string, contractID *string, severity *string) ([]models.Violation, error) {
	return s.repo.ListViolations(ctx, getTenantID(tenantID), contractID, severity)
}

// ---- API Versions ----

func (s *Service) CreateVersion(ctx context.Context, req *models.CreateVersionRequest, tenantID string) (*models.Version, error) {
	return s.repo.CreateVersion(ctx, req, getTenantID(tenantID))
}

func (s *Service) ListVersions(ctx context.Context, tenantID string, apiName *string, status *string) ([]models.Version, error) {
	return s.repo.ListVersions(ctx, getTenantID(tenantID), apiName, status)
}

func (s *Service) DeprecateVersion(ctx context.Context, id string, req *models.DeprecateVersionRequest, tenantID string) (*models.Version, error) {
	updates := map[string]interface{}{
		"status":           "deprecated",
		"deprecation_date": time.Now().UTC(),
	}
	if req.ReplacementVersion != nil {
		updates["replacement_version"] = *req.ReplacementVersion
	}
	if req.RetirementDate != nil {
		// Accept string or leave nil; parse if present
		t, err := time.Parse(time.RFC3339, *req.RetirementDate)
		if err == nil {
			updates["retirement_date"] = t
		}
	}
	v, err := s.repo.UpdateVersion(ctx, id, getTenantID(tenantID), updates)
	if err != nil {
		return nil, ErrNotFound
	}
	return v, nil
}

func (s *Service) RetireVersion(ctx context.Context, id string, tenantID string) (*models.Version, error) {
	v, err := s.repo.GetVersion(ctx, id, getTenantID(tenantID))
	if err != nil {
		return nil, ErrNotFound
	}
	if v.Status != "deprecated" {
		return nil, errors.New("only deprecated versions can be retired")
	}
	updates := map[string]interface{}{
		"status":          "retired",
		"retirement_date": time.Now().UTC(),
	}
	v, err = s.repo.UpdateVersion(ctx, id, getTenantID(tenantID), updates)
	if err != nil {
		return nil, ErrNotFound
	}
	return v, nil
}

func (s *Service) ListDeprecatedVersions(ctx context.Context, tenantID string) ([]models.Version, error) {
	return s.repo.ListDeprecatedVersions(ctx, getTenantID(tenantID))
}

// ---- Compatibility ----

func (s *Service) CheckCompatibility(ctx context.Context, sourceVersion, targetVersion string) (*models.CompatibilityResult, error) {
	return &models.CompatibilityResult{
		SourceVersion:   sourceVersion,
		TargetVersion:   targetVersion,
		Compatible:      true,
		BreakingChanges: []string{},
		Recommendations: []string{"Add deprecation notice before removing old endpoints"},
	}, nil
}

// ---- Rules ----

func (s *Service) CreateRule(ctx context.Context, req *models.CreateRuleRequest, tenantID string) (*models.Rule, error) {
	return s.repo.CreateRule(ctx, req, getTenantID(tenantID))
}

// ---- Report ----

func (s *Service) GetGovernanceStats(ctx context.Context, tenantID string) (models.GovernanceStats, error) {
	return s.repo.GetGovernanceStats(ctx, getTenantID(tenantID))
}

// ---- DTOs for handler responses ----

// VerifyResult is returned from VerifyContract.
type VerifyResult struct {
	ContractID string   `json:"contractId"`
	Passed     bool     `json:"passed"`
	Violations []string `json:"violations"`
	Endpoint   string   `json:"endpoint"`
	Method     string   `json:"method"`
	VerifiedAt string   `json:"verifiedAt"`
}

// CompatibilityResult is returned from CheckCompatibility.
type CompatibilityResult struct {
	SourceVersion   string   `json:"sourceVersion"`
	TargetVersion   string   `json:"targetVersion"`
	Compatible      bool     `json:"compatible"`
	BreakingChanges []string `json:"breakingChanges"`
	Recommendations []string `json:"recommendations"`
}

// EvaluatedContract is returned from EvaluateContract.
type EvaluatedContract struct {
	ContractID  string      `json:"contractId"`
	Compliance  bool        `json:"compliance"`
	Checks      []EvalCheck `json:"checks"`
	EvaluatedAt string      `json:"evaluatedAt"`
}

// EvalCheck is a single evaluation check.
type EvalCheck struct {
	Name   string `json:"name"`
	Passed bool   `json:"passed"`
}
