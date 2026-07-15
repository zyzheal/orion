package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/smart-deploy/models"
	"orion/platform-svc-go/internal/smart-deploy/repository"
)

var (
	ErrNotFound     = errors.New("not found")
	ErrInvalidInput = errors.New("invalid input")
	ErrInvalidState = errors.New("invalid state")
)

// validEnvironments is the set of accepted deployment environments.
var validEnvironments = map[string]bool{
	"dev":           true,
	"staging":       true,
	"prod":          true,
	"development":   true,
	"production":    true,
	"pre-prod":      true,
}

// validStrategies is the set of accepted deployment strategies.
var validStrategies = map[string]bool{
	"blue-green": true,
	"canary":     true,
	"rolling":    true,
	"recreate":   true,
}

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// stagesTemplate returns the JSON-serialized stages description for a strategy.
func stagesTemplate(strategy models.DeploymentStrategyType) string {
	stages := map[string][]map[string]interface{}{
		"blue-green": {
			{"name": "pre-deployment-checks", "steps": []map[string]interface{}{
				{"name": "validate-configuration"},
				{"name": "check-cluster-capacity"},
				{"name": "verify-image-availability"},
			}},
			{"name": "deploy-green-environment", "steps": []map[string]interface{}{
				{"name": "create-green-deployment"},
				{"name": "run-health-checks"},
				{"name": "run-smoke-tests"},
			}},
			{"name": "traffic-switch", "steps": []map[string]interface{}{
				{"name": "switch-traffic-to-green"},
				{"name": "verify-traffic-routing"},
			}},
			{"name": "cleanup", "steps": []map[string]interface{}{
				{"name": "monitor-stability"},
				{"name": "decommission-blue-environment"},
			}},
		},
		"canary": {
			{"name": "pre-deployment-checks", "steps": []map[string]interface{}{
				{"name": "validate-configuration"},
				{"name": "check-cluster-capacity"},
			}},
			{"name": "canary-10-percent", "steps": []map[string]interface{}{
				{"name": "deploy-canary-instances"},
				{"name": "route-10-percent-traffic"},
				{"name": "monitor-metrics"},
			}},
			{"name": "canary-50-percent", "steps": []map[string]interface{}{
				{"name": "route-50-percent-traffic"},
				{"name": "monitor-metrics"},
			}},
			{"name": "full-rollout", "steps": []map[string]interface{}{
				{"name": "route-100-percent-traffic"},
				{"name": "final-health-checks"},
			}},
		},
		"rolling": {
			{"name": "pre-deployment-checks", "steps": []map[string]interface{}{
				{"name": "validate-configuration"},
				{"name": "check-cluster-capacity"},
			}},
			{"name": "rolling-update", "steps": []map[string]interface{}{
				{"name": "update-batch-1"},
				{"name": "verify-batch-1"},
				{"name": "update-batch-2"},
				{"name": "verify-batch-2"},
			}},
			{"name": "post-deployment-validation", "steps": []map[string]interface{}{
				{"name": "run-integration-tests"},
				{"name": "verify-all-instances-healthy"},
			}},
		},
		"recreate": {
			{"name": "pre-deployment-checks", "steps": []map[string]interface{}{
				{"name": "validate-configuration"},
			}},
			{"name": "teardown-old-version", "steps": []map[string]interface{}{
				{"name": "scale-down-old-version"},
				{"name": "verify-old-version-removed"},
			}},
			{"name": "deploy-new-version", "steps": []map[string]interface{}{
				{"name": "create-new-deployment"},
				{"name": "wait-for-ready"},
				{"name": "run-health-checks"},
			}},
		},
	}

	template := stages["rolling"]
	if s, ok := stages[string(strategy)]; ok {
		template = s
	}

	for i, stage := range template {
		stage["status"] = "pending"
		for j, step := range stage["steps"].([]map[string]interface{}) {
			step["status"] = "pending"
			_ = i
			_ = j
		}
	}

	b, _ := json.Marshal(template)
	return string(b)
}

// Deploy creates a deployment and simulates its execution.
func (s *Service) Deploy(ctx context.Context, tenantID string, req models.CreateDeploymentRequest) (*models.Deployment, error) {
	// Validate environment
	if !validEnvironments[req.Environment] {
		return nil, fmt.Errorf("%w: invalid environment. Must be one of: dev, staging, prod, development, production, pre-prod", ErrInvalidInput)
	}

	// Validate strategy if provided
	if req.Strategy != "" && !validStrategies[string(req.Strategy)] {
		return nil, fmt.Errorf("%w: invalid strategy. Must be one of: blue-green, canary, rolling, recreate", ErrInvalidInput)
	}

	// Build request for repository with stages
	strategyConfig := make(map[string]interface{})
	if req.StrategyConfig != nil {
		for k, v := range *req.StrategyConfig {
			strategyConfig[k] = v
		}
	}
	stagesJSON := stagesTemplate(req.Strategy)
	if len(stagesJSON) > 0 {
		strategyConfig["stages"] = stagesJSON
	}

	// Override StrategyConfig for the repo layer
	if req.StrategyConfig == nil {
		sc := strategyConfig
		req.StrategyConfig = &sc
	} else {
		*req.StrategyConfig = strategyConfig
	}

	deployment, err := s.repo.Create(ctx, tenantID, req)
	if err != nil {
		return nil, err
	}

	// Audit: deployment created
	s.repo.CreateAuditEntry(ctx, tenantID, models.AuditEntry{
		DeploymentID: deployment.ID,
		Action:       "deployment_created",
		PerformedBy:  req.InitiatedBy,
		Details:      fmt.Sprintf(`{"appName":"%s","version":"%s","environment":"%s","strategy":"%s"}`, req.AppName, req.Version, req.Environment, req.Strategy),
	})

	// Simulate async deployment progression
	go s.simulateDeploymentProgress(ctx, tenantID, deployment)

	return deployment, nil
}

// GetDeployment retrieves a deployment by ID.
func (s *Service) GetDeployment(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// ListDeployments lists deployments for a tenant with optional filters.
func (s *Service) ListDeployments(ctx context.Context, tenantID string, opt models.ListDeploymentsOptions) ([]models.Deployment, int, error) {
	return s.repo.List(ctx, tenantID, opt)
}

// GetLatestDeployment returns the latest deployment for a given app + environment.
func (s *Service) GetLatestDeployment(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error) {
	return s.repo.GetLatest(ctx, tenantID, appName, environment)
}

// GetMetrics returns aggregated deployment metrics.
func (s *Service) GetMetrics(ctx context.Context, tenantID string) (*models.DeploymentMetrics, error) {
	return s.repo.GetMetrics(ctx, tenantID)
}

// CancelDeployment cancels a running deployment.
func (s *Service) CancelDeployment(ctx context.Context, tenantID, id, cancelledBy string) (*models.Deployment, error) {
	deployment, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if deployment.Status != models.DeploymentStatusPending && deployment.Status != models.DeploymentStatusPreparing && deployment.Status != models.DeploymentStatusDeploying && deployment.Status != models.DeploymentStatusVerifying {
		return nil, fmt.Errorf("%w: can only cancel pending/preparing/deploying/verifying deployments", ErrInvalidState)
	}

	updated, err := s.repo.UpdateStatus(ctx, tenantID, id, models.DeploymentStatusCancelled)
	if err != nil {
		return nil, err
	}

	s.repo.CreateAuditEntry(ctx, tenantID, models.AuditEntry{
		DeploymentID: id,
		Action:       "deployment_cancelled",
		PerformedBy:  cancelledBy,
		Details:      "{}",
	})

	return updated, nil
}

// Rollback triggers a rollback for a deployment.
func (s *Service) Rollback(ctx context.Context, tenantID, deploymentID string, req models.CreateRollbackRequest) (*models.Rollback, error) {
	// Verify deployment exists
	_, err := s.repo.GetByID(ctx, tenantID, deploymentID)
	if err != nil {
		return nil, fmt.Errorf("%w: deployment not found", ErrNotFound)
	}

	rollback, err := s.repo.CreateRollback(ctx, tenantID, req, deploymentID)
	if err != nil {
		return nil, err
	}

	// Audit: rollback triggered
	s.repo.CreateAuditEntry(ctx, tenantID, models.AuditEntry{
		DeploymentID: deploymentID,
		Action:       "rollback_triggered",
		PerformedBy:  req.TriggeredBy,
		Details:      fmt.Sprintf(`{"reason":"%s","targetVersion":"%s","rollbackId":"%s"}`, req.Reason, rollback.TargetVersion, rollback.ID),
	})

	// Simulate rollback completion
	go func() {
		time.Sleep(200 * time.Millisecond)
		if err := s.repo.SetRollbackCompleted(ctx, tenantID, rollback.ID); err == nil {
			// Update deployment status to rolled_back
			_, _ = s.repo.UpdateStatus(ctx, tenantID, deploymentID, models.DeploymentStatusRolledBack)
		}
	}()

	return rollback, nil
}

// GetRollbackHistory returns the rollback history for a deployment.
func (s *Service) GetRollbackHistory(ctx context.Context, tenantID, deploymentID string) ([]models.Rollback, error) {
	return s.repo.ListRollbacks(ctx, tenantID, deploymentID)
}

// GetAuditTrail returns the audit trail for a deployment.
func (s *Service) GetAuditTrail(ctx context.Context, tenantID, deploymentID string) ([]models.AuditEntry, error) {
	return s.repo.ListAuditEntries(ctx, tenantID, deploymentID)
}

// simulateDeploymentProgress simulates the deployment stages completing over time.
func (s *Service) simulateDeploymentProgress(ctx context.Context, tenantID string, deployment *models.Deployment) {
	// Simulate pre-deployment checks completing
	time.Sleep(200 * time.Millisecond)
	_, _ = s.repo.UpdateStatus(ctx, tenantID, deployment.ID, models.DeploymentStatusPreparing)

	// Simulate deployment running
	time.Sleep(500 * time.Millisecond)
	_, _ = s.repo.UpdateStatus(ctx, tenantID, deployment.ID, models.DeploymentStatusDeploying)

	// Simulate verification
	time.Sleep(300 * time.Millisecond)
	_, _ = s.repo.UpdateStatus(ctx, tenantID, deployment.ID, models.DeploymentStatusVerifying)

	// Simulate completion
	time.Sleep(200 * time.Millisecond)
	_, _ = s.repo.UpdateStatus(ctx, tenantID, deployment.ID, models.DeploymentStatusCompleted)

	// Audit: deployment completed
	s.repo.CreateAuditEntry(ctx, tenantID, models.AuditEntry{
		DeploymentID: deployment.ID,
		Action:       "deployment_completed",
		PerformedBy:  "system",
		Details:      "{}",
	})
}

// CreateAuditEntry is a helper to create an audit entry for internal use.
func (s *Service) CreateAuditEntry(ctx context.Context, tenantID string, deploymentID, action, performedBy, details string) error {
	return s.repo.CreateAuditEntry(ctx, tenantID, models.AuditEntry{
		DeploymentID: deploymentID,
		Action:       action,
		PerformedBy:  performedBy,
		Details:      details,
	})
}
