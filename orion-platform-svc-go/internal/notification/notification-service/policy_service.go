package service

import (
	"context"
	"fmt"
	"log"

	"orion/platform-svc-go/internal/notification/notification/models"
	"orion/platform-svc-go/internal/notification/notification/repository"
	"orion/go-common/pkg/otel"

	"go.uber.org/zap"
)

// ErrPolicyNotFound is returned when a policy lookup fails.
var ErrPolicyNotFound = fmt.Errorf("notification policy not found")

// ErrWorkflowNotFound is returned when a workflow lookup fails.
var ErrWorkflowNotFound = fmt.Errorf("notification workflow not found")

// PolicyService implements the notification policy business logic.
type PolicyService struct {
	repo      *repository.PolicyRepository
	logger    *zap.Logger
}

// NewPolicyService creates a new PolicyService.
func NewPolicyService(repo *repository.PolicyRepository, logger *zap.Logger) *PolicyService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &PolicyService{
		repo:   repo,
		logger: logger,
	}
}

// ==================== Policy CRUD ====================

// CreatePolicy creates a new notification policy.
func (s *PolicyService) CreatePolicy(ctx context.Context, tenantID, createdBy string, req *models.CreatePolicyRequest) (*models.NotificationPolicyEntity, error) {
	ctx, span := otel.Tracer("orion-notification-policy-svc").Start(ctx, "PolicyService.CreatePolicy")
	defer span.End()

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	throttleMinutes := 0
	if req.ThrottleMinutes > 0 {
		throttleMinutes = req.ThrottleMinutes
	}

	policy := &models.NotificationPolicyEntity{
		TenantID:       tenantID,
		Name:           req.Name,
		Description:    req.Description,
		Conditions:     req.Conditions,
		Channels:       req.Channels,
		Recipients:     req.Recipients,
		ThrottleMinutes: throttleMinutes,
		Enabled:        enabled,
		CreatedBy:      &createdBy,
	}

	if err := s.repo.CreatePolicy(ctx, policy); err != nil {
		s.logger.Error("failed to create policy", zap.Error(err), zap.String("name", req.Name))
		return nil, fmt.Errorf("failed to create policy: %w", err)
	}

	s.logger.Info("notification policy created", zap.String("policy_id", policy.ID), zap.String("name", policy.Name))
	return policy, nil
}

// GetPolicy returns a single policy by id.
func (s *PolicyService) GetPolicy(ctx context.Context, tenantID, id string) (*models.NotificationPolicyEntity, error) {
	ctx, span := otel.Tracer("orion-notification-policy-svc").Start(ctx, "PolicyService.GetPolicy")
	defer span.End()

	policy, err := s.repo.GetPolicy(ctx, tenantID, id)
	if err != nil {
		s.logger.Warn("policy not found", zap.String("id", id), zap.Error(err))
		return nil, ErrPolicyNotFound
	}
	return policy, nil
}

// ListPolicies returns all policies for a tenant.
func (s *PolicyService) ListPolicies(ctx context.Context, tenantID string) ([]models.NotificationPolicyEntity, error) {
	ctx, span := otel.Tracer("orion-notification-policy-svc").Start(ctx, "PolicyService.ListPolicies")
	defer span.End()

	policies, err := s.repo.ListPolicies(ctx, tenantID)
	if err != nil {
		s.logger.Error("failed to list policies", zap.Error(err))
		return nil, fmt.Errorf("failed to list policies: %w", err)
	}
	return policies, nil
}

// UpdatePolicy updates an existing policy.
func (s *PolicyService) UpdatePolicy(ctx context.Context, tenantID, id string, req *models.UpdatePolicyRequest) (*models.NotificationPolicyEntity, error) {
	ctx, span := otel.Tracer("orion-notification-policy-svc").Start(ctx, "PolicyService.UpdatePolicy")
	defer span.End()

	// Verify policy exists
	_, err := s.repo.GetPolicy(ctx, tenantID, id)
	if err != nil {
		return nil, ErrPolicyNotFound
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = req.Description
	}
	if req.Conditions != nil {
		updates["conditions"] = req.Conditions
	}
	if req.Channels != nil {
		updates["channels"] = req.Channels
	}
	if req.Recipients != nil {
		updates["recipients"] = req.Recipients
	}
	if req.ThrottleMinutes != nil {
		updates["throttle_minutes"] = *req.ThrottleMinutes
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	policy, err := s.repo.UpdatePolicy(ctx, id, updates)
	if err != nil {
		s.logger.Error("failed to update policy", zap.Error(err), zap.String("id", id))
		return nil, fmt.Errorf("failed to update policy: %w", err)
	}

	s.logger.Info("notification policy updated", zap.String("policy_id", id))
	return policy, nil
}

// DeletePolicy removes a policy and its associated workflows.
func (s *PolicyService) DeletePolicy(ctx context.Context, tenantID, id string) error {
	ctx, span := otel.Tracer("orion-notification-policy-svc").Start(ctx, "PolicyService.DeletePolicy")
	defer span.End()

	// Verify policy exists
	policy, err := s.repo.GetPolicy(ctx, tenantID, id)
	if err != nil {
		return ErrPolicyNotFound
	}

	// Delete associated workflows first
	workflows, err := s.repo.ListWorkflowsByPolicyID(ctx, id)
	if err != nil {
		s.logger.Error("failed to list workflows for deletion", zap.Error(err), zap.String("policy_id", id))
		return fmt.Errorf("failed to list workflows: %w", err)
	}

	for _, wf := range workflows {
		if err := s.repo.DeleteWorkflow(ctx, wf.ID); err != nil {
			s.logger.Warn("failed to delete workflow", zap.Error(err), zap.String("workflow_id", wf.ID))
		}
	}

	if err := s.repo.DeletePolicy(ctx, tenantID, id); err != nil {
		s.logger.Error("failed to delete policy", zap.Error(err), zap.String("policy_id", id))
		return fmt.Errorf("failed to delete policy: %w", err)
	}

	s.logger.Info("notification policy deleted", zap.String("policy_id", id), zap.String("name", policy.Name))
	return nil
}

// ==================== Policy Evaluation ====================

// EvaluatePolicies evaluates all enabled policies against an event and returns matched policies.
func (s *PolicyService) EvaluatePolicies(ctx context.Context, tenantID string, event map[string]interface{}) ([]models.NotificationPolicyEntity, error) {
	ctx, span := otel.Tracer("orion-notification-policy-svc").Start(ctx, "PolicyService.EvaluatePolicies")
	defer span.End()

	policies, err := s.repo.FindEnabledPolicies(ctx, tenantID)
	if err != nil {
		s.logger.Error("failed to fetch enabled policies", zap.Error(err))
		return nil, fmt.Errorf("failed to fetch policies: %w", err)
	}

	matched := s.filterMatchedPolicies(policies, event)
	s.logger.Info("policy evaluation completed",
		zap.Int("total_policies", len(policies)),
		zap.Int("matched_policies", len(matched)),
	)

	return matched, nil
}

// MatchesConditions checks if an event matches all conditions of a policy (AND logic).
func (s *PolicyService) MatchesConditions(event map[string]interface{}, conditions []models.PolicyCondition) bool {
	if len(conditions) == 0 {
		return true
	}

	for _, condition := range conditions {
		fieldValue := getNestedValue(event, condition.Field)
		if !evaluateCondition(fieldValue, condition.Operator, condition.Value) {
			return false
		}
	}
	return true
}

func (s *PolicyService) filterMatchedPolicies(policies []models.NotificationPolicyEntity, event map[string]interface{}) []models.NotificationPolicyEntity {
	matched := make([]models.NotificationPolicyEntity, 0)
	for _, policy := range policies {
		if s.MatchesConditions(event, policy.Conditions) {
			matched = append(matched, policy)
		}
	}
	return matched
}

// evaluateCondition evaluates a single condition.
func evaluateCondition(fieldValue interface{}, operator models.PolicyOp, conditionValue interface{}) bool {
	switch operator {
	case models.PolicyOpEQ:
		return fieldValue == conditionValue
	case models.PolicyOpNEQ:
		return fieldValue != conditionValue
	case models.PolicyOpContains:
		if fieldValueStr, ok := fieldValue.(string); ok {
			if conditionValueStr, ok := conditionValue.(string); ok {
				return contains(fieldValueStr, conditionValueStr)
			}
		}
		return false
	case models.PolicyOpGT:
		return compareNumbers(fieldValue, conditionValue, func(a, b float64) bool { return a > b })
	case models.PolicyOpLT:
		return compareNumbers(fieldValue, conditionValue, func(a, b float64) bool { return a < b })
	case models.PolicyOpGTE:
		return compareNumbers(fieldValue, conditionValue, func(a, b float64) bool { return a >= b })
	case models.PolicyOpLTE:
		return compareNumbers(fieldValue, conditionValue, func(a, b float64) bool { return a <= b })
	case models.PolicyOpIn:
		return isIn(fieldValue, conditionValue)
	case models.PolicyOpRegex:
		if fieldValueStr, ok := fieldValue.(string); ok {
			if conditionValueStr, ok := conditionValue.(string); ok {
				return matchRegex(fieldValueStr, conditionValueStr)
			}
		}
		return false
	default:
		log.Printf("[policy-svc] unknown operator: %s", operator)
		return false
	}
}

// getNestedValue retrieves a value from a nested map using dot notation (e.g., "pipeline.status").
func getNestedValue(obj map[string]interface{}, path string) interface{} {
	keys := splitPath(path)
	current := interface{}(obj)
	for _, key := range keys {
		if m, ok := current.(map[string]interface{}); ok {
			current = m[key]
		} else {
			return nil
		}
		if current == nil {
			return nil
		}
	}
	return current
}

func splitPath(path string) []string {
	result := make([]string, 0)
	current := ""
	for _, ch := range path {
		if ch == '.' {
			if current != "" {
				result = append(result, current)
				current = ""
			}
		} else {
			current += string(ch)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func compareNumbers(a, b interface{}, op func(float64, float64) bool) bool {
	aNum, okA := toFloat64(a)
	bNum, okB := toFloat64(b)
	if !okA || !okB {
		return false
	}
	return op(aNum, bNum)
}

func toFloat64(v interface{}) (float64, bool) {
	switch val := v.(type) {
	case float64:
		return val, true
	case float32:
		return float64(val), true
	case int:
		return float64(val), true
	case int64:
		return float64(val), true
	case int32:
		return float64(val), true
	case uint:
		return float64(val), true
	case uint64:
		return float64(val), true
	case uint32:
		return float64(val), true
	case string:
		var f float64
		if _, err := fmt.Sscanf(val, "%f", &f); err == nil {
			return f, true
		}
	}
	return 0, false
}

func isIn(value interface{}, list interface{}) bool {
	listSlice, ok := list.([]interface{})
	if !ok {
		return false
	}
	for _, item := range listSlice {
		if item == value {
			return true
		}
	}
	return false
}

func matchRegex(s, pattern string) bool {
	// Simple regex matching - in production use a proper regex library
	// For now, support basic patterns
	if len(pattern) == 0 {
		return false
	}
	// Support wildcard * at the end
	if pattern[len(pattern)-1] == '*' {
		prefix := pattern[:len(pattern)-1]
		return len(s) >= len(prefix) && s[:len(prefix)] == prefix
	}
	return s == pattern
}

// ==================== Workflow CRUD ====================

// CreateWorkflow creates a new notification workflow.
func (s *PolicyService) CreateWorkflow(ctx context.Context, tenantID, createdBy string, req *models.CreateWorkflowRequest) (*models.NotificationWorkflowEntity, error) {
	ctx, span := otel.Tracer("orion-notification-policy-svc").Start(ctx, "PolicyService.CreateWorkflow")
	defer span.End()

	// Verify policy exists
	_, err := s.repo.FindPolicyByID(ctx, req.PolicyID)
	if err != nil {
		s.logger.Warn("policy not found for workflow", zap.String("policy_id", req.PolicyID), zap.Error(err))
		return nil, fmt.Errorf("policy not found: %s", req.PolicyID)
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	workflow := &models.NotificationWorkflowEntity{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		PolicyID:    req.PolicyID,
		Steps:       req.Steps,
		Enabled:     enabled,
		CreatedBy:   &createdBy,
	}

	if err := s.repo.CreateWorkflow(ctx, workflow); err != nil {
		s.logger.Error("failed to create workflow", zap.Error(err), zap.String("name", req.Name))
		return nil, fmt.Errorf("failed to create workflow: %w", err)
	}

	s.logger.Info("notification workflow created", zap.String("workflow_id", workflow.ID), zap.String("name", workflow.Name))
	return workflow, nil
}

// GetWorkflow returns a single workflow by id.
func (s *PolicyService) GetWorkflow(ctx context.Context, id string) (*models.NotificationWorkflowEntity, error) {
	ctx, span := otel.Tracer("orion-notification-policy-svc").Start(ctx, "PolicyService.GetWorkflow")
	defer span.End()

	workflow, err := s.repo.GetWorkflow(ctx, id)
	if err != nil {
		s.logger.Warn("workflow not found", zap.String("id", id), zap.Error(err))
		return nil, ErrWorkflowNotFound
	}
	return workflow, nil
}

// ListWorkflows returns workflows, optionally filtered by policyId.
func (s *PolicyService) ListWorkflows(ctx context.Context, tenantID string, policyID string) ([]models.NotificationWorkflowEntity, error) {
	ctx, span := otel.Tracer("orion-notification-policy-svc").Start(ctx, "PolicyService.ListWorkflows")
	defer span.End()

	var workflows []models.NotificationWorkflowEntity
	var err error

	if policyID != "" {
		workflows, err = s.repo.ListWorkflowsByPolicyID(ctx, policyID)
	} else {
		workflows, err = s.repo.ListWorkflowsByTenant(ctx, tenantID)
	}

	if err != nil {
		s.logger.Error("failed to list workflows", zap.Error(err))
		return nil, fmt.Errorf("failed to list workflows: %w", err)
	}
	return workflows, nil
}

// UpdateWorkflow updates an existing workflow.
func (s *PolicyService) UpdateWorkflow(ctx context.Context, id string, req *models.UpdateWorkflowRequest) (*models.NotificationWorkflowEntity, error) {
	ctx, span := otel.Tracer("orion-notification-policy-svc").Start(ctx, "PolicyService.UpdateWorkflow")
	defer span.End()

	// Verify workflow exists
	_, err := s.repo.GetWorkflow(ctx, id)
	if err != nil {
		return nil, ErrWorkflowNotFound
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = req.Description
	}
	if req.Steps != nil {
		updates["steps"] = req.Steps
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	workflow, err := s.repo.UpdateWorkflow(ctx, id, updates)
	if err != nil {
		s.logger.Error("failed to update workflow", zap.Error(err), zap.String("id", id))
		return nil, fmt.Errorf("failed to update workflow: %w", err)
	}

	s.logger.Info("notification workflow updated", zap.String("workflow_id", id))
	return workflow, nil
}

// DeleteWorkflow removes a workflow by id.
func (s *PolicyService) DeleteWorkflow(ctx context.Context, id string) error {
	ctx, span := otel.Tracer("orion-notification-policy-svc").Start(ctx, "PolicyService.DeleteWorkflow")
	defer span.End()

	// Verify workflow exists
	_, err := s.repo.GetWorkflow(ctx, id)
	if err != nil {
		return ErrWorkflowNotFound
	}

	if err := s.repo.DeleteWorkflow(ctx, id); err != nil {
		s.logger.Error("failed to delete workflow", zap.Error(err), zap.String("id", id))
		return fmt.Errorf("failed to delete workflow: %w", err)
	}

	s.logger.Info("notification workflow deleted", zap.String("workflow_id", id))
	return nil
}
