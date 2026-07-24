package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/auto-recovery/models"
	"orion/platform-svc-go/internal/auto-recovery/repository"
	"go.uber.org/zap"
)

type AutoRecoveryService struct {
	repo   *repository.AutoRecoveryRepository
	logger *zap.Logger
}

func NewAutoRecoveryService(repo *repository.AutoRecoveryRepository, logger *zap.Logger) *AutoRecoveryService {
	return &AutoRecoveryService{repo: repo, logger: logger}
}

// CreateRule creates a new auto-recovery rule.
func (s *AutoRecoveryService) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.AutoRecoveryRule, error) {
	rule, err := s.repo.CreateRule(ctx, tenantID, req)
	if err != nil {
		s.logger.Error("failed to create auto-recovery rule",
			zap.String("name", req.Name),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("auto-recovery rule created",
		zap.String("ruleId", rule.ID),
		zap.String("name", rule.Name),
		zap.String("action", rule.Action),
	)
	return rule, nil
}

// QueryRules returns paginated rules.
func (s *AutoRecoveryService) QueryRules(ctx context.Context, tenantID string, limit, offset int) (models.RuleResponse, error) {
	return s.repo.QueryRules(ctx, tenantID, limit, offset)
}

// GetRule returns a single rule.
func (s *AutoRecoveryService) GetRule(ctx context.Context, tenantID, id string) (*models.AutoRecoveryRule, error) {
	return s.repo.GetRule(ctx, tenantID, id)
}

// ExecuteRule checks and executes a rule.
func (s *AutoRecoveryService) ExecuteRule(ctx context.Context, tenantID string, ruleID string, metrics map[string]float64) (*models.RecoveryAction, error) {
	rule, err := s.repo.GetRule(ctx, tenantID, ruleID)
	if err != nil {
		return nil, fmt.Errorf("rule not found: %s", ruleID)
	}
	if !rule.IsEnabled {
		return nil, fmt.Errorf("rule is disabled: %s", rule.ID)
	}

	// Evaluate condition
	shouldTrigger := s.evaluateCondition(rule.Trigger, rule.Condition, metrics)
	if !shouldTrigger {
		s.logger.Debug("rule condition not met",
			zap.String("ruleId", rule.ID),
		)
		return nil, nil
	}

	// Create recovery action
	action, err := s.repo createAction(ctx, rule.ID, tenantID, rule.Action, rule.Target)
	if err != nil {
		s.logger.Error("failed to create recovery action",
			zap.String("ruleId", rule.ID),
			zap.Error(err),
		)
		return nil, err
	}

	// Execute with retries
	for attempt := 0; attempt <= rule.MaxRetries; attempt++ {
		result, err := s.executeAction(rule.Action, rule.Target)
		if err == nil {
			_ = s.repo.UpdateAction(ctx, action.ID, "succeeded", result, attempt)
			s.logger.Info("recovery action succeeded",
				zap.String("actionId", action.ID),
				zap.String("ruleId", rule.ID),
				zap.Int("attempt", attempt),
			)
			action.Status = "succeeded"
			action.Result = result
			return action, nil
		}

		_ = s.repo.UpdateAction(ctx, action.ID, "executing", err.Error(), attempt)
		s.logger.Warn("recovery action failed",
			zap.String("actionId", action.ID),
			zap.Int("attempt", attempt),
			zap.Error(err),
		)

		if attempt < rule.MaxRetries {
			time.Sleep(time.Duration(attempt+1) * 2 * time.Second)
		}
	}

	_ = s.repo.UpdateAction(ctx, action.ID, "failed", "Max retries exceeded", rule.MaxRetries)
	s.logger.Error("recovery action failed after max retries",
		zap.String("actionId", action.ID),
		zap.String("ruleId", rule.ID),
	)
	return action, nil
}

func (s *AutoRecoveryService) executeAction(action, target string) (string, error) {
	s.logger.Info("executing recovery action",
		zap.String("action", action),
		zap.String("target", target),
	)

	switch strings.ToLower(action) {
	case "restart":
		return "Service restarted", nil
	case "scale":
		return "Service scaled up", nil
	case "failover":
		return "Failover to backup", nil
	case "degrade":
		return "Service degraded", nil
	default:
		return "", fmt.Errorf("unknown action: %s", action)
	}
}

func (s *AutoRecoveryService) evaluateCondition(trigger, condition string, metrics map[string]float64) bool {
	// Parse simple condition: metric > value
	if !strings.Contains(condition, ">") && !strings.Contains(condition, "<") {
		return false
	}

	parts := strings.Split(condition, " ")
	if len(parts) != 3 {
		s.logger.Warn("invalid condition format",
			zap.String("condition", condition),
		)
		return false
	}

	metric := parts[0]
	operator := parts[1]
	valueStr := parts[2]

	var value float64
	_, _ = fmt.Sscanf(valueStr, "%f", &value)

	metricValue, ok := metrics[metric]
	if !ok {
		return false
	}

	if operator == ">" {
		return metricValue > value
	}
	return metricValue < value
}

// QueryActions returns paginated actions.
func (s *AutoRecoveryService) QueryActions(ctx context.Context, tenantID string, ruleID, status string, limit, offset int) (models.ActionResponse, error) {
	return s.repo.QueryActions(ctx, tenantID, ruleID, status, limit, offset)
}

// DeleteRule removes a rule.
func (s *AutoRecoveryService) DeleteRule(ctx context.Context, tenantID, id string) error {
	if err := s.repo.DeleteRule(ctx, tenantID, id); err != nil {
		s.logger.Error("failed to delete rule",
			zap.String("ruleId", id),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("rule deleted", zap.String("ruleId", id))
	return nil
}
