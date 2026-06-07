package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"orion/pipeline-svc-go/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.opentelemetry.io/otel"
)

var triggerTracer = otel.Tracer("orion-pipeline-svc-trigger")

// TriggerService manages pipeline triggers and processes trigger events
type TriggerService struct {
	db            *sqlx.DB
	pipelineSvc   *PipelineService
}

func NewTriggerService(db *sqlx.DB, pipelineSvc *PipelineService) *TriggerService {
	return &TriggerService{db: db, pipelineSvc: pipelineSvc}
}

// Create creates a new trigger for a pipeline
func (s *TriggerService) Create(ctx context.Context, tenantID, pipelineID string, req models.CreateTriggerRequest) (*models.PipelineTrigger, error) {
	// Verify pipeline exists
	if _, err := s.pipelineSvc.GetByID(ctx, tenantID, pipelineID); err != nil {
		return nil, fmt.Errorf("pipeline not found: %w", err)
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	trigger := &models.PipelineTrigger{
		ID:           uuid.New().String(),
		PipelineID:   pipelineID,
		TenantID:     tenantID,
		Type:         req.Type,
		Name:         req.Name,
		Enabled:      enabled,
		Config:       req.Config,
		PathFilter:   req.PathFilter,
		BranchFilter: req.BranchFilter,
	}

	query := `INSERT INTO pipeline_triggers (id, pipeline_id, tenant_id, type, name, enabled, config, path_filter, branch_filter)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
	_, err := s.db.ExecContext(ctx, query,
		trigger.ID, trigger.PipelineID, trigger.TenantID, trigger.Type,
		trigger.Name, trigger.Enabled, trigger.Config, trigger.PathFilter, trigger.BranchFilter,
	)
	if err != nil {
		return nil, fmt.Errorf("create trigger: %w", err)
	}
	return trigger, nil
}

// List returns triggers for a pipeline
func (s *TriggerService) List(ctx context.Context, pipelineID string) ([]models.PipelineTrigger, error) {
	var triggers []models.PipelineTrigger
	err := s.db.SelectContext(ctx, &triggers,
		"SELECT * FROM pipeline_triggers WHERE pipeline_id = $1 ORDER BY created_at DESC", pipelineID)
	return triggers, err
}

// GetByID returns a trigger by ID
func (s *TriggerService) GetByID(ctx context.Context, id string) (*models.PipelineTrigger, error) {
	var trigger models.PipelineTrigger
	err := s.db.GetContext(ctx, &trigger, "SELECT * FROM pipeline_triggers WHERE id = $1", id)
	if err != nil {
		return nil, fmt.Errorf("trigger not found: %w", err)
	}
	return &trigger, nil
}

// Delete deletes a trigger
func (s *TriggerService) Delete(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM pipeline_triggers WHERE id = $1", id)
	return err
}

// Toggle enables or disables a trigger
func (s *TriggerService) Toggle(ctx context.Context, id string, enabled bool) error {
	_, err := s.db.ExecContext(ctx, "UPDATE pipeline_triggers SET enabled = $1, updated_at = NOW() WHERE id = $2", enabled, id)
	return err
}

// ProcessWebhook processes an incoming webhook event
func (s *TriggerService) ProcessWebhook(ctx context.Context, triggerID string, payload []byte, headers map[string]string) (*models.PipelineRun, error) {
	_, span := triggerTracer.Start(ctx, "TriggerService.ProcessWebhook")
	defer span.End()

	trigger, err := s.GetByID(ctx, triggerID)
	if err != nil {
		return nil, err
	}
	if !trigger.Enabled {
		return nil, fmt.Errorf("trigger %s is disabled", triggerID)
	}

	// Verify webhook signature if secret is set
	if trigger.Secret != "" {
		sig := headers["X-Hub-Signature-256"]
		if sig == "" {
			sig = headers["X-Signature"]
		}
		if !verifyWebhookSignature(payload, sig, trigger.Secret) {
			return nil, fmt.Errorf("invalid webhook signature")
		}
	}

	// Parse event from payload
	var event struct {
		Branch string   `json:"branch"`
		Commit string   `json:"commit"`
		Paths  []string `json:"paths"`
	}
	json.Unmarshal(payload, &event)

	// Check branch filter
	if trigger.BranchFilter != "" && event.Branch != "" {
		if !matchFilter(event.Branch, trigger.BranchFilter) {
			return nil, fmt.Errorf("branch %s does not match filter %s", event.Branch, trigger.BranchFilter)
		}
	}

	// Check path filter
	if trigger.PathFilter != "" && len(event.Paths) > 0 {
		if !matchPathFilter(event.Paths, trigger.PathFilter) {
			return nil, fmt.Errorf("changed paths do not match path filter")
		}
	}

	// Trigger the pipeline run
	run, err := s.pipelineSvc.RunPipeline(ctx, trigger.TenantID, trigger.PipelineID, models.RunPipelineRequest{
		TriggerType: models.TriggerWebhook,
		Environment: "webhook",
		Context: map[string]string{
			"trigger_id": triggerID,
			"branch":     event.Branch,
			"commit":     event.Commit,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("trigger pipeline run: %w", err)
	}

	// Update trigger stats
	s.db.ExecContext(ctx,
		"UPDATE pipeline_triggers SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = $1",
		triggerID)

	return run, nil
}

// ProcessSCMEvent processes an SCM event (push, PR, tag)
func (s *TriggerService) ProcessSCMEvent(ctx context.Context, event models.SCMTriggerEvent) ([]*models.PipelineRun, error) {
	_, span := triggerTracer.Start(ctx, "TriggerService.ProcessSCMEvent")
	defer span.End()

	// Find all SCM triggers for this repo/event type
	var triggers []models.PipelineTrigger
	err := s.db.SelectContext(ctx, &triggers,
		`SELECT * FROM pipeline_triggers WHERE type = 'scm' AND enabled = true`)
	if err != nil {
		return nil, err
	}

	var runs []*models.PipelineRun
	for _, trigger := range triggers {
		// Parse SCM config
		var scmConfig models.SCMTriggerConfig
		if err := json.Unmarshal([]byte(trigger.Config), &scmConfig); err != nil {
			continue
		}

		// Check event type match
		eventMatch := false
		for _, e := range scmConfig.Events {
			if e == string(event.Type) {
				eventMatch = true
				break
			}
		}
		if !eventMatch {
			continue
		}

		// Check branch filter
		if scmConfig.BranchFilter != "" && event.Branch != "" {
			if !matchFilter(event.Branch, scmConfig.BranchFilter) {
				continue
			}
		}

		// Check path filter
		if scmConfig.PathFilter != "" && len(event.Paths) > 0 {
			if !matchPathFilter(event.Paths, scmConfig.PathFilter) {
				continue
			}
		}

		// Trigger pipeline
		run, err := s.pipelineSvc.RunPipeline(ctx, trigger.TenantID, trigger.PipelineID, models.RunPipelineRequest{
			TriggerType: models.TriggerWebhook,
			Environment: "scm",
			Context: map[string]string{
				"trigger_id": trigger.ID,
				"branch":     event.Branch,
				"commit":     event.Commit,
				"event_type": string(event.Type),
			},
		})
		if err != nil {
			continue
		}

		// Update trigger stats
		s.db.ExecContext(ctx,
			"UPDATE pipeline_triggers SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = $1",
			trigger.ID)

		runs = append(runs, run)
	}

	return runs, nil
}

// verifyWebhookSignature verifies HMAC-SHA256 signature
func verifyWebhookSignature(payload []byte, signature, secret string) bool {
	if signature == "" {
		return false
	}
	// Remove algorithm prefix if present
	sig := strings.TrimPrefix(signature, "sha256=")
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(sig), []byte(expected))
}

// matchFilter checks if a value matches a comma-separated filter pattern
func matchFilter(value, filter string) bool {
	patterns := strings.Split(filter, ",")
	for _, p := range patterns {
		p = strings.TrimSpace(p)
		if p == "*" || p == value {
			return true
		}
		// Support prefix match: "feature/*"
		if strings.HasSuffix(p, "/*") {
			prefix := strings.TrimSuffix(p, "/*")
			if strings.HasPrefix(value, prefix+"/") {
				return true
			}
		}
	}
	return false
}

// matchPathFilter checks if any changed path matches the path filter
func matchPathFilter(paths []string, filter string) bool {
	patterns := strings.Split(filter, ",")
	for _, path := range paths {
		for _, p := range patterns {
			p = strings.TrimSpace(p)
			if strings.HasPrefix(path, p) {
				return true
			}
		}
	}
	return false
}
