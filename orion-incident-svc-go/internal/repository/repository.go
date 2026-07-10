package repository

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"orion/go-common/pkg/database"
	"orion/incident-svc-go/internal/models"
)

// IncidentRepository provides data access for incident entities (tenant-scoped).
type IncidentRepository struct {
	database.BaseRepository
}

func NewIncidentRepository(db *database.DB) *IncidentRepository {
	return &IncidentRepository{
		BaseRepository: database.NewBaseRepository(db),
	}
}

func (r *IncidentRepository) Create(ctx context.Context, incident *models.Incident) error {
	query := `INSERT INTO incidents (
		id, tenant_id, title, description, type, severity, status,
		priority, impact, urgency, service, environment, error_message,
		detected_by, affected_services, tags,
		deployment_id, pipeline_run_id, commit_sha, assigned_team,
		postmortem_required, escalation_level, sla_breach, detected_at, created_at, updated_at
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7,
		$8, $9, $10, $11, $12, $13,
		$14, $15, $16,
		$17, $18, $19, $20,
		$21, $22, $23, $24, $25, $26
	) RETURNING id, created_at, updated_at, detected_at`
	err := r.DB().QueryRowContext(ctx, query,
		incident.ID, incident.TenantID, incident.Title, incident.Description,
		incident.Type, incident.Severity, incident.Status,
		incident.Priority, incident.Impact, incident.Urgency,
		incident.Service, incident.Environment, incident.ErrorMessage,
		incident.DetectedBy, incident.AffectedServices, incident.Tags,
		incident.DeploymentID, incident.PipelineRunID, incident.CommitSHA,
		incident.AssignedTeam, incident.PostmortemRequired, incident.EscalationLevel,
		incident.SLABreach, incident.DetectedAt, incident.CreatedAt, incident.UpdatedAt,
	).Scan(&incident.ID, &incident.CreatedAt, &incident.UpdatedAt, &incident.DetectedAt)
	return err
}

func (r *IncidentRepository) GetByID(ctx context.Context, id, tenantID string) (*models.Incident, error) {
	var incident models.Incident
	query := `SELECT * FROM incidents WHERE id = $1 AND tenant_id = $2`
	err := r.DB().GetContext(ctx, &incident, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("incident not found: %w", err)
	}
	return &incident, nil
}

func (r *IncidentRepository) List(ctx context.Context, tenantID string, filters models.IncidentListFilters) ([]models.Incident, error) {
	query := `SELECT * FROM incidents WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filters.Status != nil {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *filters.Status)
		argIdx++
	}
	if filters.Severity != nil {
		query += fmt.Sprintf(" AND severity = $%d", argIdx)
		args = append(args, *filters.Severity)
		argIdx++
	}
	if filters.Priority != nil {
		query += fmt.Sprintf(" AND priority = $%d", argIdx)
		args = append(args, *filters.Priority)
		argIdx++
	}
	if filters.Type != nil {
		query += fmt.Sprintf(" AND type = $%d", argIdx)
		args = append(args, *filters.Type)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY detected_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, filters.Limit, filters.Offset)

	var incidents []models.Incident
	err := r.DB().SelectContext(ctx, &incidents, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list incidents: %w", err)
	}
	return incidents, nil
}

func (r *IncidentRepository) Count(ctx context.Context, tenantID string, filters models.IncidentListFilters) (int, error) {
	query := `SELECT COUNT(*) FROM incidents WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filters.Status != nil {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *filters.Status)
		argIdx++
	}
	if filters.Severity != nil {
		query += fmt.Sprintf(" AND severity = $%d", argIdx)
		args = append(args, *filters.Severity)
		argIdx++
	}
	if filters.Priority != nil {
		query += fmt.Sprintf(" AND priority = $%d", argIdx)
		args = append(args, *filters.Priority)
		argIdx++
	}

	var count int
	err := r.DB().GetContext(ctx, &count, query, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to count incidents: %w", err)
	}
	return count, nil
}

func (r *IncidentRepository) Update(ctx context.Context, incident *models.Incident) error {
	query := `UPDATE incidents SET
		title = $1, description = $2, severity = $3, status = $4,
		priority = $5, impact = $6, urgency = $7,
		service = $8, environment = $9, error_message = $10,
		detected_by = $11, affected_services = $12, tags = $13,
		assigned_team = $14, postmortem_required = $15,
		related_problem_id = $16, linked_problem_id = $17, linked_change_id = $18,
		sla_breach = $19, escalation_level = $20, resolved_by = $21,
		closed_by = $22, acknowledged_at = $23, resolved_at = $24, closed_at = $25,
		recovery_time_ms = $26, updated_at = $27
		WHERE id = $28 AND tenant_id = $29`
	_, err := r.DB().ExecContext(ctx, query,
		incident.Title, incident.Description, incident.Severity, incident.Status,
		incident.Priority, incident.Impact, incident.Urgency,
		incident.Service, incident.Environment, incident.ErrorMessage,
		incident.DetectedBy, incident.AffectedServices, incident.Tags,
		incident.AssignedTeam, incident.PostmortemRequired,
		incident.RelatedProblemID, incident.LinkedProblemID, incident.LinkedChangeID,
		incident.SLABreach, incident.EscalationLevel, incident.ResolvedBy,
		incident.ClosedBy, incident.AcknowledgedAt, incident.ResolvedAt, incident.ClosedAt,
		incident.RecoveryTimeMs, incident.UpdatedAt,
		incident.ID, incident.TenantID,
	)
	return err
}

func (r *IncidentRepository) SoftDelete(ctx context.Context, id, tenantID string) error {
	_, err := r.DB().ExecContext(ctx,
		"DELETE FROM incidents WHERE id = $1 AND tenant_id = $2",
		id, tenantID,
	)
	return err
}

// Acknowledge sets incident status to 'acknowledged' and sets acknowledged_at.
func (r *IncidentRepository) Acknowledge(ctx context.Context, id, tenantID string) (*models.Incident, error) {
	var incident models.Incident
	query := `UPDATE incidents SET status = 'acknowledged', acknowledged_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND tenant_id = $2 RETURNING *`
	err := r.DB().GetContext(ctx, &incident, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to acknowledge incident: %w", err)
	}
	return &incident, nil
}

// Resolve sets incident status to 'resolved', sets resolved_at, and auto-calculates recovery_time_ms.
func (r *IncidentRepository) Resolve(ctx context.Context, id, tenantID string) (*models.Incident, error) {
	var incident models.Incident
	query := `UPDATE incidents SET
		status = 'resolved',
		resolved_at = NOW(),
		recovery_time_ms = EXTRACT(EPOCH FROM (NOW() - detected_at))::BIGINT * 1000,
		updated_at = NOW()
		WHERE id = $1 AND tenant_id = $2 RETURNING *`
	err := r.DB().GetContext(ctx, &incident, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve incident: %w", err)
	}
	return &incident, nil
}

// GenerateIncidentID generates a UUID-style incident ID.
func GenerateIncidentID() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	buf[6] = (buf[6] & 0x0f) | 0x40 // version 4
	buf[8] = (buf[8] & 0x3f) | 0x80 // variant
	return hex.EncodeToString(buf[:4]) + "-" +
		hex.EncodeToString(buf[4:6]) + "-" +
		hex.EncodeToString(buf[6:8]) + "-" +
		hex.EncodeToString(buf[8:10]) + "-" +
		hex.EncodeToString(buf[10:]), nil
}
