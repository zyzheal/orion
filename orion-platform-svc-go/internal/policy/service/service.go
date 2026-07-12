package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/policy/models"
	"orion/platform-svc-go/internal/policy/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- Policy definitions ---

func (s *Service) CreatePolicy(ctx context.Context, tenantID string, req models.CreatePolicyRequest) (*models.Policy, error) {
	m := &models.Policy{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Rego:        req.Rego,
		Enabled:     req.Enabled,
	}
	if err := s.repo.CreatePolicy(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetPolicy(ctx context.Context, tenantID, id string) (*models.Policy, error) {
	return s.repo.GetPolicy(ctx, tenantID, id)
}

func (s *Service) ListPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.Policy, error) {
	return s.repo.ListPolicies(ctx, tenantID, limit, offset)
}

func (s *Service) UpdatePolicy(ctx context.Context, tenantID, id string, req models.UpdatePolicyRequest) (*models.Policy, error) {
	// Fetch existing policy to merge updates.
	existing, err := s.repo.GetPolicy(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.Rego != nil {
		existing.Rego = *req.Rego
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}
	if err := s.repo.UpdatePolicy(ctx, tenantID, id, existing); err != nil {
		return nil, err
	}
	return s.repo.GetPolicy(ctx, tenantID, id)
}

func (s *Service) DeletePolicy(ctx context.Context, tenantID, id string) error {
	return s.repo.DeletePolicy(ctx, tenantID, id)
}

func (s *Service) TogglePolicy(ctx context.Context, tenantID, id string, enabled bool) (*models.Policy, error) {
	return s.repo.TogglePolicy(ctx, tenantID, id, enabled)
}

// --- Policy evaluations ---

func (s *Service) EvaluatePolicy(ctx context.Context, tenantID string, req models.EvaluatePolicyRequest) (*models.EvaluatePolicyResponse, error) {
	// TODO: evaluate Rego policy against input using OPA.
	// For now, return a placeholder response.
	policy, err := s.repo.GetPolicy(ctx, tenantID, req.PolicyID)
	if err != nil {
		return nil, ErrPolicyNotFound
	}
	result := models.EvaluatePolicyResponse{
		Decision: "unknown",
		Rego:     policy.Rego,
		Result:   map[string]interface{}{},
	}
	// Persist evaluation record.
	inputJSON, _ := json.Marshal(req.Input)
	outputJSON, _ := json.Marshal(result)
	eval := &models.PolicyEvaluation{
		TenantID:   tenantID,
		PolicyID:   req.PolicyID,
		RunID:      "",
		ResourceID: req.ResourceID,
		InputJSON:  string(inputJSON),
		OutputJSON: string(outputJSON),
		Decision:   result.Decision,
		ExecutedBy: "",
	}
	_ = s.repo.CreateEvaluation(ctx, eval)
	return &result, nil
}

func (s *Service) GetEvaluationHistory(ctx context.Context, tenantID, policyID string, limit, offset int) ([]models.PolicyEvaluation, error) {
	return s.repo.ListEvaluationHistory(ctx, tenantID, policyID, limit, offset)
}

func (s *Service) ListEvaluations(ctx context.Context, tenantID string, limit, offset int) ([]models.PolicyEvaluation, error) {
	return s.repo.ListEvaluations(ctx, tenantID, limit, offset)
}

func (s *Service) EvaluateGate(ctx context.Context, tenantID, gateID string, input map[string]interface{}) (*models.EvaluatePolicyResponse, error) {
	// TODO: evaluate gate policy.
	result := models.EvaluatePolicyResponse{
		Decision: "unknown",
		Result:   map[string]interface{}{},
	}
	eval := &models.PolicyEvaluation{
		TenantID:   tenantID,
		PolicyID:   gateID,
		InputJSON:  "",
		OutputJSON: "",
		Decision:   result.Decision,
	}
	inputJSON, _ := json.Marshal(input)
	eval.InputJSON = string(inputJSON)
	outputJSON, _ := json.Marshal(result)
	eval.OutputJSON = string(outputJSON)
	_ = s.repo.CreateEvaluation(ctx, eval)
	return &result, nil
}

// --- Violations ---

func (s *Service) ListViolations(ctx context.Context, tenantID string, limit, offset int) ([]models.Violation, error) {
	return s.repo.ListViolations(ctx, tenantID, limit, offset)
}

func (s *Service) GetViolation(ctx context.Context, tenantID, id string) (*models.Violation, error) {
	return s.repo.GetViolation(ctx, tenantID, id)
}

func (s *Service) WaiveViolation(ctx context.Context, tenantID, id string, req models.WaiveViolationRequest) error {
	_, err := s.repo.GetViolation(ctx, tenantID, id)
	if err != nil {
		return err
	}
	// Log waiver note in details field.
	return s.repo.UpdateViolationStatus(ctx, tenantID, id, "waived")
}

func (s *Service) ResolveViolation(ctx context.Context, tenantID, id string, req models.ResolveViolationRequest) error {
	_, err := s.repo.GetViolation(ctx, tenantID, id)
	if err != nil {
		return err
	}
	return s.repo.UpdateViolationStatus(ctx, tenantID, id, "resolved")
}

// --- Overrides ---

func (s *Service) ListOverrides(ctx context.Context, tenantID string, limit, offset int) ([]models.PolicyOverride, error) {
	return s.repo.ListOverrides(ctx, tenantID, limit, offset)
}

func (s *Service) CreateOverride(ctx context.Context, tenantID string, req models.CreateOverrideRequest, overrideBy string) (*models.PolicyOverride, error) {
	// Parse expires_in into time.
	expiresAt := time.Now().UTC().Add(24 * time.Hour) // default 24h
	if req.ExpiresIn != "" {
		d, err := time.ParseDuration(req.ExpiresIn)
		if err == nil {
			expiresAt = time.Now().UTC().Add(d)
		}
	}
	o := &models.PolicyOverride{
		TenantID:   tenantID,
		PolicyID:   req.PolicyID,
		ResourceID: req.ResourceID,
		OverrideBy: overrideBy,
		Reason:     req.Reason,
		ExpiresAt:  expiresAt,
	}
	if err := s.repo.CreateOverride(ctx, o); err != nil {
		return nil, err
	}
	return o, nil
}

// --- Bundles ---

func (s *Service) ListBundles(ctx context.Context, tenantID string) ([]models.PolicyBundle, error) {
	return s.repo.ListBundles(ctx, tenantID)
}

func (s *Service) GetBundle(ctx context.Context, tenantID, id string) (*models.PolicyBundle, error) {
	return s.repo.GetBundle(ctx, tenantID, id)
}

func (s *Service) SyncBundles(ctx context.Context, tenantID string, sourceURL string) (*models.SyncBundlesResponse, error) {
	// TODO: actually sync bundles from source URL.
	// For now, create a bundle record.
	b := &models.PolicyBundle{
		TenantID:  tenantID,
		Name:      "sync-" + time.Now().Format("20060102-150405"),
		SourceURL: sourceURL,
		Status:    "synced",
	}
	_ = s.repo.CreateBundle(ctx, b)
	return &models.SyncBundlesResponse{Updated: 1, Message: "bundles synced"}, nil
}

// --- Policy testing ---

func (s *Service) TestPolicy(ctx context.Context, rego string, testCases []map[string]interface{}) ([]models.TestCaseResult, error) {
	// TODO: evaluate Rego against test cases using OPA.
	results := make([]models.TestCaseResult, 0, len(testCases))
	for _, tc := range testCases {
		name, _ := tc["name"]
		results = append(results, models.TestCaseResult{
			Name:   fmt.Sprintf("%v", name),
			Passed: false,
			Output: map[string]interface{}{},
			Error:  "OPA evaluation not yet implemented",
		})
	}
	return results, nil
}

// --- Exemptions ---

func (s *Service) SubmitExemption(ctx context.Context, tenantID string, req models.CreateExemptionRequest) (*models.Exemption, error) {
	e := &models.Exemption{
		TenantID:    tenantID,
		ViolationID: req.ViolationID,
		PolicyID:    req.PolicyID,
		RunID:       req.RunID,
		Reason:      req.Reason,
		Category:    req.Category,
		RequestedBy: req.RequestedBy,
		ExpiresAt:   req.ExpiresAt,
	}
	if err := s.repo.CreateExemption(ctx, e); err != nil {
		return nil, err
	}
	return e, nil
}

func (s *Service) GetExemption(ctx context.Context, tenantID, id string) (*models.Exemption, error) {
	return s.repo.GetExemption(ctx, tenantID, id)
}

func (s *Service) ListExemptions(ctx context.Context, tenantID string, req models.ListExemptionsRequest) (*models.ListExemptionsResponse, error) {
	exemptions, err := s.repo.ListExemptions(ctx, tenantID, req.Status, req.PolicyID, req.Limit, req.Offset)
	if err != nil {
		return nil, err
	}
	total, err := s.repo.CountExemptions(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &models.ListExemptionsResponse{Exemptions: exemptions, Total: total}, nil
}

func (s *Service) ReviewExemption(ctx context.Context, tenantID, id string, req models.ReviewExemptionRequest) (*models.Exemption, error) {
	existing, err := s.repo.GetExemption(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if existing.Status != "pending" {
		return nil, ErrInvalidState
	}
	var status models.ExemptionStatus
	if req.Action == "approve" {
		status = "approved"
	} else {
		status = "rejected"
	}
	note := req.Comment
	if err := s.repo.UpdateExemption(ctx, tenantID, id, status, req.Reviewer, note); err != nil {
		return nil, err
	}
	return s.repo.GetExemption(ctx, tenantID, id)
}

func (s *Service) RevokeExemption(ctx context.Context, tenantID, id string) (*models.Exemption, error) {
	existing, err := s.repo.GetExemption(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if existing.Status != "approved" {
		return nil, ErrInvalidState
	}
	if err := s.repo.UpdateExemption(ctx, tenantID, id, "revoked", "", "revoked by user"); err != nil {
		return nil, err
	}
	return s.repo.GetExemption(ctx, tenantID, id)
}

// --- Error helpers ---

func IsNotFound(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "no rows in result set") || errors.Is(err, sql.ErrNoRows)
}

// --- Errors ---

var (
	ErrNotFound        = errors.New("not found")
	ErrPolicyNotFound  = fmt.Errorf("policy not found: %w", ErrNotFound)
	ErrInvalidState    = errors.New("invalid state")
	ErrValidation      = errors.New("validation error")
)

func ErrNotFoundPolicy(id string) error {
	return fmt.Errorf("policy %q not found: %w", id, ErrNotFound)
}
