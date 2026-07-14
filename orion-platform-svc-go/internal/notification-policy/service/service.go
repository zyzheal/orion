package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/notification-policy/models"
	"orion/platform-svc-go/internal/notification-policy/repository"

	"github.com/google/uuid"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- Policies ---

func (s *Service) Create(ctx context.Context, tenantID string, userID string, req *models.CreatePolicyRequest) (*models.Policy, error) {
	policy := &models.Policy{
		TenantID:    tenantID,
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		Conditions:  req.Conditions,
		Actions:     req.Actions,
		Priority:    req.Priority,
		Order:       req.Order,
		Enabled:     req.Enabled,
	}
	if err := s.repo.Create(ctx, policy); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, policy.ID, tenantID)
}

func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter, page, pageSize int) ([]models.Policy, int, error) {
	offset := (page - 1) * pageSize
	policies, err := s.repo.List(ctx, tenantID, filter, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	if policies == nil {
		policies = []models.Policy{}
	}
	total, err := s.repo.Count(ctx, tenantID)
	if err != nil {
		return nil, 0, err
	}
	return policies, total, nil
}

func (s *Service) Get(ctx context.Context, tenantID string, id string) (*models.Policy, error) {
	policy, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrPolicyNotFound
		}
		return nil, err
	}
	return policy, nil
}

func (s *Service) Update(ctx context.Context, tenantID string, id string, req *models.UpdatePolicyRequest) (*models.Policy, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Conditions != nil {
		updates["conditions"] = *req.Conditions
	}
	if req.Actions != nil {
		updates["actions"] = *req.Actions
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.Order != nil {
		updates["order"] = *req.Order
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	policy, err := s.repo.Update(ctx, id, tenantID, updates)
	if err != nil {
		return nil, err
	}
	return policy, nil
}

func (s *Service) Delete(ctx context.Context, tenantID string, id string) (bool, error) {
	return s.repo.Delete(ctx, id, tenantID)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// --- Workflows ---

func (s *Service) CreateWorkflow(ctx context.Context, tenantID string, userID string, req *models.CreateWorkflowRequest) (*models.PolicyWorkflow, error) {
	workflow := &models.PolicyWorkflow{
		TenantID:    tenantID,
		UserID:      userID,
		PolicyID:    req.PolicyID,
		Name:        req.Name,
		Description: req.Description,
		Steps:       req.Steps,
		Enabled:     req.Enabled,
	}
	if err := s.repo.CreateWorkflow(ctx, workflow); err != nil {
		return nil, err
	}
	return workflow, nil
}

func (s *Service) ListWorkflows(ctx context.Context, tenantID string, policyID string, page, pageSize int) ([]models.PolicyWorkflow, int, error) {
	workflows, err := s.repo.ListWorkflowsByPolicyID(ctx, policyID)
	if err != nil {
		return nil, 0, err
	}
	if workflows == nil {
		workflows = []models.PolicyWorkflow{}
	}
	return workflows, len(workflows), nil
}

func (s *Service) GetWorkflow(ctx context.Context, tenantID string, policyID string, id string) (*models.PolicyWorkflow, error) {
	workflow, err := s.repo.GetWorkflowByID(ctx, policyID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrWorkflowNotFound
		}
		return nil, err
	}
	return workflow, nil
}

func (s *Service) UpdateWorkflow(ctx context.Context, tenantID string, policyID string, id string, req *models.UpdateWorkflowRequest) (*models.PolicyWorkflow, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Steps != nil {
		updates["steps"] = *req.Steps
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	workflow, err := s.repo.UpdateWorkflow(ctx, policyID, id, updates)
	if err != nil {
		return nil, err
	}
	return workflow, nil
}

func (s *Service) DeleteWorkflow(ctx context.Context, tenantID string, policyID string, id string) (bool, error) {
	return s.repo.DeleteWorkflow(ctx, policyID, id)
}

// --- Evaluate ---

func (s *Service) Evaluate(ctx context.Context, tenantID string, userID string, req *models.EvaluateRequest) ([]models.EvaluateResult, error) {
	policies, err := s.repo.List(ctx, tenantID, &models.ListFilter{Enabled: boolPtr(true)}, 0, 0)
	if err != nil {
		return nil, err
	}

	results := make([]models.EvaluateResult, 0, len(policies))
	for _, p := range policies {
		result := models.EvaluateResult{
			PolicyID:   p.ID,
			PolicyName: p.Name,
			Matched:    false,
			Actions:    parseActions(p.Actions),
			Reason:     "no match",
		}

		if matched, reason := evaluateConditions(p.Conditions, req.Context); matched {
			result.Matched = true
			result.Reason = reason
		}

		results = append(results, result)
	}

	return results, nil
}

// --- Errors ---

var (
	ErrPolicyNotFound   = errors.New("notification policy not found")
	ErrWorkflowNotFound = errors.New("notification policy workflow not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrPolicyNotFound) || errors.Is(err, ErrWorkflowNotFound)
}

// --- Helpers ---

func nowTimestamp() time.Time {
	return time.Now().UTC()
}

func newUUID() string {
	return uuid.New().String()
}

func boolPtr(b bool) *bool {
	return &b
}

// evaluateConditions checks if the policy conditions match the given context.
// conditions is a JSON string; for now, if it is empty or "{}", all policies match.
func evaluateConditions(conditions string, context map[string]string) (bool, string) {
	if conditions == "" || conditions == "{}" {
		return true, "no conditions (matches all)"
	}

	var condMap map[string]string
	if err := json.Unmarshal([]byte(conditions), &condMap); err != nil {
		return false, "invalid conditions format"
	}

	for key, expectedVal := range condMap {
		actualVal, exists := context[key]
		if !exists {
			return false, "missing context key: " + key
		}
		if actualVal != expectedVal {
			return false, "context value mismatch for key: " + key
		}
	}

	return true, "all conditions matched"
}

// parseActions parses a JSON string of actions into a string slice.
func parseActions(actions string) []string {
	if actions == "" || actions == "[]" {
		return []string{}
	}
	var result []string
	if err := json.Unmarshal([]byte(actions), &result); err != nil {
		return []string{}
	}
	return result
}