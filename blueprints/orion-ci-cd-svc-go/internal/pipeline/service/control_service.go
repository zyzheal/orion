package service

import (
	"context"
	"fmt"

	"orion/ci-cd-svc-go/internal/pipeline/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var controlTracer = otel.Tracer("orion-pipeline-svc-control")

// ControlService manages execution control operations: pause, resume, abort,
// retry, restart, checkpoints, and control logs.
type ControlService struct {
	db          *sqlx.DB
	pipelineSvc *PipelineService
}

func NewControlService(db *sqlx.DB, pipelineSvc *PipelineService) *ControlService {
	return &ControlService{db: db, pipelineSvc: pipelineSvc}
}

// ==================== Execution Control ====================

// PauseRun pauses a running pipeline run.
func (s *ControlService) PauseRun(ctx context.Context, tenantID, pipelineID, runID, userID string) error {
	ctx, span := controlTracer.Start(ctx, "ControlService.PauseRun",
		trace.WithAttributes(
			attribute.String("run.id", runID),
			attribute.String("pipeline.id", pipelineID),
		))
	defer span.End()

	// Verify the run exists and is running
	run, err := s.pipelineSvc.GetRunStatus(ctx, runID)
	if err != nil {
		span.RecordError(err)
		return err
	}
	if run.TenantID != tenantID {
		err := fmt.Errorf("run %s does not belong to tenant %s", runID, tenantID)
		span.RecordError(err)
		return err
	}

	query := `UPDATE pipeline_runs SET status = 'paused', updated_at = NOW() WHERE id = $1 AND status = 'running'`
	result, err := s.db.ExecContext(ctx, query, runID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("pause run: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("run is not in a pauseable state")
	}

	// Log the control action
	s.logControlAction(ctx, runID, "pause", userID, "run paused")

	return nil
}

// ResumeRun resumes a paused pipeline run.
func (s *ControlService) ResumeRun(ctx context.Context, tenantID, pipelineID, runID, userID string) error {
	ctx, span := controlTracer.Start(ctx, "ControlService.ResumeRun",
		trace.WithAttributes(
			attribute.String("run.id", runID),
			attribute.String("pipeline.id", pipelineID),
		))
	defer span.End()

	run, err := s.pipelineSvc.GetRunStatus(ctx, runID)
	if err != nil {
		span.RecordError(err)
		return err
	}
	if run.TenantID != tenantID {
		err := fmt.Errorf("run %s does not belong to tenant %s", runID, tenantID)
		span.RecordError(err)
		return err
	}

	query := `UPDATE pipeline_runs SET status = 'running', updated_at = NOW() WHERE id = $1 AND status = 'paused'`
	result, err := s.db.ExecContext(ctx, query, runID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("resume run: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("run is not in a resumable state")
	}

	s.logControlAction(ctx, runID, "resume", userID, "run resumed")

	return nil
}

// AbortRun aborts a running pipeline run.
func (s *ControlService) AbortRun(ctx context.Context, tenantID, pipelineID, runID, userID string) error {
	ctx, span := controlTracer.Start(ctx, "ControlService.AbortRun",
		trace.WithAttributes(
			attribute.String("run.id", runID),
			attribute.String("pipeline.id", pipelineID),
		))
	defer span.End()

	run, err := s.pipelineSvc.GetRunStatus(ctx, runID)
	if err != nil {
		span.RecordError(err)
		return err
	}
	if run.TenantID != tenantID {
		err := fmt.Errorf("run %s does not belong to tenant %s", runID, tenantID)
		span.RecordError(err)
		return err
	}

	query := `UPDATE pipeline_runs SET status = 'cancelled', completed_at = NOW(), duration_ms =
		CASE WHEN started_at IS NOT NULL THEN EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 ELSE 0 END,
		updated_at = NOW() WHERE id = $1 AND status IN ('pending', 'running', 'paused')`
	result, err := s.db.ExecContext(ctx, query, runID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("abort run: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("run is not in an aborteable state")
	}

	s.logControlAction(ctx, runID, "abort", userID, "run aborted")

	return nil
}

// RetryRun retries a failed or cancelled pipeline run by creating a new run.
func (s *ControlService) RetryRun(ctx context.Context, tenantID, pipelineID, runID, userID string) (*models.PipelineRun, error) {
	ctx, span := controlTracer.Start(ctx, "ControlService.RetryRun",
		trace.WithAttributes(
			attribute.String("run.id", runID),
			attribute.String("pipeline.id", pipelineID),
		))
	defer span.End()

	// Get the original run to copy its context
	originalRun, err := s.pipelineSvc.GetRunStatus(ctx, runID)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}
	if originalRun.TenantID != tenantID {
		err := fmt.Errorf("run %s does not belong to tenant %s", runID, tenantID)
		span.RecordError(err)
		return nil, err
	}

	// Only retry failed or cancelled runs
	if originalRun.Status != models.StatusFailed && originalRun.Status != models.StatusCancelled {
		return nil, fmt.Errorf("run is not in a retryable state (current: %s)", originalRun.Status)
	}

	// Create a new run as a retry of the original
	newRun, err := s.pipelineSvc.RunPipeline(ctx, tenantID, pipelineID, models.RunPipelineRequest{
		TriggerType: models.TriggerManual,
		Environment: originalRun.Environment,
		Context: map[string]string{
			"retry_of":  runID,
			"triggered_by": userID,
		},
	})
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("retry run: %w", err)
	}

	s.logControlAction(ctx, runID, "retry", userID, fmt.Sprintf("retried as run %s", newRun.ID))

	return newRun, nil
}

// RestartRun restarts a pipeline run from the beginning.
func (s *ControlService) RestartRun(ctx context.Context, tenantID, pipelineID, runID, userID string) (*models.PipelineRun, error) {
	ctx, span := controlTracer.Start(ctx, "ControlService.RestartRun",
		trace.WithAttributes(
			attribute.String("run.id", runID),
			attribute.String("pipeline.id", pipelineID),
		))
	defer span.End()

	run, err := s.pipelineSvc.GetRunStatus(ctx, runID)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}
	if run.TenantID != tenantID {
		err := fmt.Errorf("run %s does not belong to tenant %s", runID, tenantID)
		span.RecordError(err)
		return nil, err
	}

	// Create a completely new run (like RetryRun but always creates fresh)
	newRun, err := s.pipelineSvc.RunPipeline(ctx, tenantID, pipelineID, models.RunPipelineRequest{
		TriggerType: models.TriggerManual,
		Environment: run.Environment,
		Context: map[string]string{
			"restart_of":  runID,
			"triggered_by": userID,
		},
	})
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("restart run: %w", err)
	}

	s.logControlAction(ctx, runID, "restart", userID, fmt.Sprintf("restarted as run %s", newRun.ID))

	return newRun, nil
}

// ==================== Checkpoints ====================

// ListCheckpoints lists all checkpoints for a run.
func (s *ControlService) ListCheckpoints(ctx context.Context, runID string) ([]models.Checkpoint, error) {
	ctx, span := controlTracer.Start(ctx, "ControlService.ListCheckpoints",
		trace.WithAttributes(attribute.String("run.id", runID)))
	defer span.End()

	var checkpoints []models.Checkpoint
	err := s.db.SelectContext(ctx, &checkpoints,
		`SELECT * FROM pipeline_run_checkpoints WHERE run_id = $1 ORDER BY created_at ASC`,
		runID)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("list checkpoints: %w", err)
	}
	if checkpoints == nil {
		checkpoints = []models.Checkpoint{}
	}
	return checkpoints, nil
}

// ==================== Control Logs ====================

// ListControlLogs lists all control logs for a run.
func (s *ControlService) ListControlLogs(ctx context.Context, runID string) ([]models.ControlLog, error) {
	ctx, span := controlTracer.Start(ctx, "ControlService.ListControlLogs",
		trace.WithAttributes(attribute.String("run.id", runID)))
	defer span.End()

	var logs []models.ControlLog
	err := s.db.SelectContext(ctx, &logs,
		`SELECT * FROM pipeline_control_logs WHERE run_id = $1 ORDER BY created_at DESC`,
		runID)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("list control logs: %w", err)
	}
	if logs == nil {
		logs = []models.ControlLog{}
	}
	return logs, nil
}

// ==================== Internal ====================

// logControlAction logs a control action to the pipeline_control_logs table.
func (s *ControlService) logControlAction(ctx context.Context, runID, action, userID, message string) {
	logEntry := models.ControlLog{
		ID:      uuid.New().String(),
		RunID:   runID,
		Action:  action,
		UserID:  userID,
		Message: message,
	}

	query := `INSERT INTO pipeline_control_logs (id, run_id, action, user_id, message, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())`
	_, err := s.db.ExecContext(ctx, query,
		logEntry.ID, logEntry.RunID, logEntry.Action, logEntry.UserID, logEntry.Message)
	if err != nil {
		// Non-fatal: log action failure should not block the main operation
		_, span := controlTracer.Start(ctx, "ControlService.logControlAction")
		span.End()
	}
}