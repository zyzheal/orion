package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/pipeline-svc-go/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ApprovalGateService manages approval gates in pipeline execution
type ApprovalGateService struct {
	db          *sqlx.DB
	stageRepo   interface {
		MarkRunning(ctx context.Context, id string) error
		MarkCompleted(ctx context.Context, id string, status models.StageStatus) error
	}
}

func NewApprovalGateService(db *sqlx.DB) *ApprovalGateService {
	return &ApprovalGateService{db: db}
}

// CreateGate creates an approval gate for a stage
func (s *ApprovalGateService) CreateGate(ctx context.Context, runID, stageID, pipelineID string, approvers []string, requiredApprovals int) (*models.ApprovalGate, error) {
	approversJSON, _ := json.Marshal(approvers)

	gate := &models.ApprovalGate{
		ID:                uuid.New().String(),
		RunID:             runID,
		StageID:           stageID,
		PipelineID:        pipelineID,
		Status:            "pending",
		RequiredApprovals: requiredApprovals,
		CurrentApprovals:  0,
		Approvers:         string(approversJSON),
	}

	query := `INSERT INTO approval_gates (id, run_id, stage_id, pipeline_id, status, required_approvals, current_approvals, approvers)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := s.db.ExecContext(ctx, query,
		gate.ID, gate.RunID, gate.StageID, gate.PipelineID,
		gate.Status, gate.RequiredApprovals, gate.CurrentApprovals, gate.Approvers,
	)
	if err != nil {
		return nil, fmt.Errorf("create approval gate: %w", err)
	}
	return gate, nil
}

// GetGate returns an approval gate by ID
func (s *ApprovalGateService) GetGate(ctx context.Context, id string) (*models.ApprovalGate, error) {
	var gate models.ApprovalGate
	err := s.db.GetContext(ctx, &gate, "SELECT * FROM approval_gates WHERE id = $1", id)
	if err != nil {
		return nil, fmt.Errorf("gate not found: %w", err)
	}
	return &gate, nil
}

// GetGatesByRun returns all gates for a pipeline run
func (s *ApprovalGateService) GetGatesByRun(ctx context.Context, runID string) ([]models.ApprovalGate, error) {
	var gates []models.ApprovalGate
	err := s.db.SelectContext(ctx, &gates,
		"SELECT * FROM approval_gates WHERE run_id = $1 ORDER BY created_at", runID)
	return gates, err
}

// Approve approves an approval gate
func (s *ApprovalGateService) Approve(ctx context.Context, gateID, userID, comments string) (*models.ApprovalGate, error) {
	gate, err := s.GetGate(ctx, gateID)
	if err != nil {
		return nil, err
	}
	if gate.Status != "pending" {
		return nil, fmt.Errorf("gate is not pending (status: %s)", gate.Status)
	}

	// Verify user is an approver
	var approvers []string
	json.Unmarshal([]byte(gate.Approvers), &approvers)
	isApprover := false
	for _, a := range approvers {
		if a == userID {
			isApprover = true
			break
		}
	}
	if !isApprover {
		return nil, fmt.Errorf("user %s is not an approver for this gate", userID)
	}

	newApprovals := gate.CurrentApprovals + 1
	now := time.Now()

	if newApprovals >= gate.RequiredApprovals {
		// Fully approved
		_, err = s.db.ExecContext(ctx,
			`UPDATE approval_gates SET status = 'approved', current_approvals = $1,
			approved_by = $2, approved_at = $3, comments = $4, updated_at = NOW()
			WHERE id = $5`,
			newApprovals, userID, now, comments, gateID)
	} else {
		// Partially approved
		_, err = s.db.ExecContext(ctx,
			`UPDATE approval_gates SET current_approvals = $1, updated_at = NOW() WHERE id = $2`,
			newApprovals, gateID)
	}
	if err != nil {
		return nil, err
	}

	return s.GetGate(ctx, gateID)
}

// Reject rejects an approval gate
func (s *ApprovalGateService) Reject(ctx context.Context, gateID, userID, reason string) (*models.ApprovalGate, error) {
	gate, err := s.GetGate(ctx, gateID)
	if err != nil {
		return nil, err
	}
	if gate.Status != "pending" {
		return nil, fmt.Errorf("gate is not pending (status: %s)", gate.Status)
	}

	now := time.Now()
	_, err = s.db.ExecContext(ctx,
		`UPDATE approval_gates SET status = 'rejected', rejected_by = $1, rejected_at = $2,
		comments = $3, updated_at = NOW() WHERE id = $4`,
		userID, now, reason, gateID)
	if err != nil {
		return nil, err
	}

	return s.GetGate(ctx, gateID)
}

// IsGateApproved checks if a gate is approved
func (s *ApprovalGateService) IsGateApproved(ctx context.Context, stageID string) (bool, error) {
	var status string
	err := s.db.GetContext(ctx, &status,
		"SELECT status FROM approval_gates WHERE stage_id = $1 ORDER BY created_at DESC LIMIT 1", stageID)
	if err != nil {
		return true, nil // No gate means auto-approved
	}
	return status == "approved", nil
}
