package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"orion/platform-svc-go/internal/policy/engine"
	"orion/platform-svc-go/internal/policy/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CountExemptions(ctx context.Context, tenantID string) (int, error)
	CreateBundle(ctx context.Context, b *models.PolicyBundle) error
	CreateEvaluation(ctx context.Context, e *models.PolicyEvaluation) error
	CreateExemption(ctx context.Context, e *models.Exemption) error
	CreateOverride(ctx context.Context, o *models.PolicyOverride) error
	CreatePolicy(ctx context.Context, m *models.Policy) error
	DeletePolicy(ctx context.Context, tenantID, id string) error
	GetBundle(ctx context.Context, tenantID, id string) (*models.PolicyBundle, error)
	GetExemption(ctx context.Context, tenantID, id string) (*models.Exemption, error)
	GetPolicy(ctx context.Context, tenantID, id string) (*models.Policy, error)
	GetViolation(ctx context.Context, tenantID, id string) (*models.Violation, error)
	ListBundles(ctx context.Context, tenantID string) ([]models.PolicyBundle, error)
	ListEvaluationHistory(ctx context.Context, tenantID, policyID string, limit, offset int) ([]models.PolicyEvaluation, error)
	ListEvaluations(ctx context.Context, tenantID string, limit, offset int) ([]models.PolicyEvaluation, error)
	ListExemptions(ctx context.Context, tenantID string, status models.ExemptionStatus, policyID string, limit, offset int) ([]models.Exemption, error)
	ListOverrides(ctx context.Context, tenantID string, limit, offset int) ([]models.PolicyOverride, error)
	ListPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.Policy, error)
	ListViolations(ctx context.Context, tenantID string, limit, offset int) ([]models.Violation, error)
	TogglePolicy(ctx context.Context, tenantID, id string, enabled bool) (*models.Policy, error)
	UpdateExemption(ctx context.Context, tenantID, id string, status models.ExemptionStatus, reviewer, note string) error
	UpdatePolicy(ctx context.Context, tenantID, id string, m *models.Policy) error
	UpdateViolationStatus(ctx context.Context, tenantID, id string, status string) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
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
	policy, err := s.repo.GetPolicy(ctx, tenantID, req.PolicyID)
	if err != nil {
		return nil, ErrPolicyNotFound
	}
	if !policy.Enabled {
		return &models.EvaluatePolicyResponse{
			Decision: "unknown",
			Rego:     policy.Rego,
			Result:   map[string]interface{}{},
			Error:    fmt.Sprintf("policy %q is disabled", policy.ID),
		}, nil
	}

	result := s.evaluateRego(policy.Rego, req.Input)

	eval := &models.PolicyEvaluation{
		TenantID:   tenantID,
		PolicyID:   req.PolicyID,
		RunID:      "",
		ResourceID: req.ResourceID,
		InputJSON:  result.inputJSON,
		OutputJSON: result.outputJSON,
		Decision:   result.decision,
		ExecutedBy: "",
	}
	if result.err != "" {
		eval.Decision = "unknown"
	}
	_ = s.repo.CreateEvaluation(ctx, eval)
	return result.resp, nil
}

// evaluateResult wraps the response, decision, persisted JSON and any parse error.
type evaluateResult struct {
	resp       *models.EvaluatePolicyResponse
	decision   string
	inputJSON  string
	outputJSON string
	err        string
}

func (s *Service) evaluateRego(rego string, input map[string]interface{}) *evaluateResult {
	inputJSON, _ := json.Marshal(input)
	resp := &models.EvaluatePolicyResponse{
		Decision: "allow",
		Rego:     rego,
		Result:   map[string]interface{}{},
	}

	eng, err := engine.Compile(rego)
	if err != nil {
		resp.Decision = "unknown"
		resp.Error = fmt.Sprintf("rego compile error: %v", err)
		outputJSON, _ := json.Marshal(resp)
		return &evaluateResult{resp: resp, decision: "unknown", inputJSON: string(inputJSON), outputJSON: string(outputJSON), err: resp.Error}
	}
	evalOut, err := eng.Evaluate(input)
	if err != nil {
		resp.Decision = "unknown"
		resp.Error = fmt.Sprintf("rego eval error: %v", err)
		outputJSON, _ := json.Marshal(resp)
		return &evaluateResult{resp: resp, decision: "unknown", inputJSON: string(inputJSON), outputJSON: string(outputJSON), err: resp.Error}
	}
	resp.Result = evalOut

	// Determine decision from evaluation.
	// If allow exists, use it; otherwise deny if any derived rule is true, else allow.
	if allow, ok := evalOut["allow"]; ok {
		switch v := allow.(type) {
		case bool:
			if !v {
				resp.Decision = "deny"
			}
		default:
			if !isBoolTrue(v) {
				resp.Decision = "deny"
			}
		}
	}
	outputJSON, _ := json.Marshal(resp)
	return &evaluateResult{resp: resp, decision: resp.Decision, inputJSON: string(inputJSON), outputJSON: string(outputJSON), err: ""}
}

func isBoolTrue(v interface{}) bool {
	switch t := v.(type) {
	case bool:
		return t
	default:
		return false
	}
}

func (s *Service) GetEvaluationHistory(ctx context.Context, tenantID, policyID string, limit, offset int) ([]models.PolicyEvaluation, error) {
	return s.repo.ListEvaluationHistory(ctx, tenantID, policyID, limit, offset)
}

func (s *Service) ListEvaluations(ctx context.Context, tenantID string, limit, offset int) ([]models.PolicyEvaluation, error) {
	return s.repo.ListEvaluations(ctx, tenantID, limit, offset)
}

// EvaluateGate evaluates a gate policy against the input using the policy engine.
func (s *Service) EvaluateGate(ctx context.Context, tenantID, gateID string, input map[string]interface{}) (*models.EvaluatePolicyResponse, error) {
	result := models.EvaluatePolicyResponse{
		Decision: "unknown",
		Result:   map[string]interface{}{},
	}
	if input == nil {
		input = map[string]interface{}{}
	}
	eng, err := engine.Compile(gateID)
	if err != nil {
		result.Error = fmt.Sprintf("gate policy compile error: %v", err)
		result.Decision = "deny"
	} else {
		out, evalErr := eng.Evaluate(input)
		if evalErr != nil {
			result.Error = fmt.Sprintf("gate policy evaluation error: %v", evalErr)
			result.Decision = "unknown"
		} else {
			result.Result = out
			if allow, ok := out["allow"]; ok {
				if b, ok := allow.(bool); ok && b {
					result.Decision = "allow"
				} else {
					_ = b
				}
			} else {
				result.Decision = "deny"
			}
		}
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

// SyncBundles fetches Rego content from sourceURL and persists it as a bundle.
func (s *Service) SyncBundles(ctx context.Context, tenantID string, sourceURL string) (*models.SyncBundlesResponse, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequestWithContext(ctx, "GET", sourceURL, nil)
	if err != nil {
		b := recordSyncBundle(tenantID, sourceURL, "failed")
		_ = s.repo.CreateBundle(ctx, b)
		return &models.SyncBundlesResponse{Updated: 0, Message: fmt.Sprintf("sync failed: %v", err)}, nil
	}
	resp, err := client.Do(req)
	if err != nil {
		b := recordSyncBundle(tenantID, sourceURL, "failed")
		_ = s.repo.CreateBundle(ctx, b)
		return &models.SyncBundlesResponse{Updated: 0, Message: fmt.Sprintf("sync failed: %v", err)}, nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b := recordSyncBundle(tenantID, sourceURL, "failed")
		_ = s.repo.CreateBundle(ctx, b)
		return &models.SyncBundlesResponse{Updated: 0, Message: fmt.Sprintf("sync failed: HTTP %d", resp.StatusCode)}, nil
	}
	body, err := readBodyJSON(resp.Body)
	if err != nil {
		b := recordSyncBundle(tenantID, sourceURL, "failed")
		_ = s.repo.CreateBundle(ctx, b)
		return &models.SyncBundlesResponse{Updated: 0, Message: fmt.Sprintf("sync failed to parse bundle: %v", err)}, nil
	}
	bundles := parseBundlePayload(body, sourceURL)
	updated := 0
	for _, b := range bundles {
		pb := &models.PolicyBundle{
			TenantID:  tenantID,
			Name:      b.ID,
			SourceURL: sourceURL,
			Version:   b.Rego,
			Status:    "synced",
		}
		if s.repo.CreateBundle(ctx, pb) == nil {
			updated++
		}
	}
	msg := fmt.Sprintf("synced %d bundle(s) from %s", updated, sourceURL)
	return &models.SyncBundlesResponse{Updated: updated, Message: msg}, nil
}

func recordSyncBundle(tenantID, sourceURL, status string) *models.PolicyBundle {
	return &models.PolicyBundle{
		TenantID:  tenantID,
		Name:      "sync-" + time.Now().Format("20060102-150405"),
		SourceURL: sourceURL,
		Status:    status,
	}
}

func readBodyJSON(r io.Reader) (map[string]interface{}, error) {
	var out map[string]interface{}
	dec := json.NewDecoder(r)
	return out, dec.Decode(&out)
}

type regoBundle struct {
	ID   string
	Rego string
}

func parseBundlePayload(body map[string]interface{}, sourceURL string) []regoBundle {
	var bundles []regoBundle
	if bundlesSlice, ok := body["bundles"].([]interface{}); ok {
		for _, bi := range bundlesSlice {
			if m, ok := bi.(map[string]interface{}); ok {
				bundles = append(bundles, regoBundle{
					ID:   fmt.Sprintf("%v", m["id"]),
					Rego: fmt.Sprintf("%v", m["rego"]),
				})
			}
		}
	} else if rego, ok := body["rego"]; ok {
		bundles = []regoBundle{{ID: sourceURL + "/" + time.Now().Format("20060102-150405"), Rego: fmt.Sprintf("%v", rego)}}
	}
	if len(bundles) == 0 {
		// Treat the entire body as a single Rego document.
		bundles = []regoBundle{{ID: sourceURL + "/" + time.Now().Format("20060102-150405"), Rego: fmt.Sprintf("%v", body)}}
	}
	return bundles
}

// --- Policy testing ---

func (s *Service) TestPolicy(ctx context.Context, rego string, testCases []map[string]interface{}) ([]models.TestCaseResult, error) {
	eng, err := engine.Compile(rego)
	if err != nil {
		results := make([]models.TestCaseResult, len(testCases))
		for i, tc := range testCases {
			name, _ := tc["name"]
			results[i] = models.TestCaseResult{
				Name:   fmt.Sprintf("%v", name),
				Passed: false,
				Error:  fmt.Sprintf("rego compile error: %v", err),
			}
		}
		return results, nil
	}
	results := make([]models.TestCaseResult, len(testCases))
	for i, tc := range testCases {
		name, _ := tc["name"]
		// The "expected" key (if present) is compared against the evaluation
		// result's "allow" value to determine pass/fail.
		evalOut, evalErr := eng.Evaluate(tc)
		if evalErr != nil {
			results[i] = models.TestCaseResult{
				Name:   fmt.Sprintf("%v", name),
				Passed: false,
				Output: map[string]interface{}{},
				Error:  fmt.Sprintf("evaluation error: %v", evalErr),
			}
			continue
		}
		expected, _ := tc["expected"]
		passed := true
		if expected != nil {
			allow, ok := evalOut["allow"]
			if !ok {
				passed = false
			} else {
				switch e := expected.(type) {
				case bool:
					if allow != e {
						passed = false
					}
				case float64:
					if e == 0 && allow == true {
						passed = false
					} else if e != 0 && allow == false {
						passed = false
					}
				default:
					if fmt.Sprintf("%v", allow) != fmt.Sprintf("%v", e) {
						passed = false
					}
				}
			}
		}
		results[i] = models.TestCaseResult{
			Name:   fmt.Sprintf("%v", name),
			Passed: passed,
			Output: evalOut,
		}
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

	ErrPolicyNotFound = fmt.Errorf("policy not found: %w", sentinel.NotFound)
	ErrInvalidState   = errors.New("invalid state")
	ErrValidation     = errors.New("validation error")
)

func ErrNotFoundPolicy(id string) error {
	return fmt.Errorf("policy %q not found: %w", id, sentinel.NotFound)
}
