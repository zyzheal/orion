package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ticket/models"

	"orion/go-common/pkg/database"
	"github.com/google/uuid"
)

type SLAPolicyRepository struct {
	db *database.DB
}

func NewSLAPolicyRepository(db *database.DB) *SLAPolicyRepository {
	return &SLAPolicyRepository{db: db}
}

func (r *SLAPolicyRepository) Create(ctx context.Context, policy *models.SLAPolicy) error {
	policy.ID = uuid.New().String()
	policy.CreatedAt = time.Now().UTC()
	policy.UpdatedAt = time.Now().UTC()
	enabled := policy.Enabled
	if !enabled {
		enabled = true
	}
	query := `INSERT INTO sla_policies (id, tenant_id, name, description, priority,
		target_response_time_ms, target_resolution_time_ms, enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
	_, err := r.db.ExecContext(ctx, query,
		policy.ID, policy.TenantID, policy.Name, policy.Description, policy.Priority,
		policy.TargetResponseTimeMs, policy.TargetResolutionTimeMs, enabled,
		policy.CreatedAt, policy.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("create sla policy: %w", err)
	}
	return nil
}

func (r *SLAPolicyRepository) GetByID(ctx context.Context, tenantID, id string) (*models.SLAPolicy, error) {
	var p models.SLAPolicy
	err := r.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, name, description, priority, target_response_time_ms,
			target_resolution_time_ms, enabled, created_at, updated_at
			FROM sla_policies WHERE id = $1 AND tenant_id = $2`, id, tenantID).Scan(
		&p.ID, &p.TenantID, &p.Name, &p.Description, &p.Priority,
		&p.TargetResponseTimeMs, &p.TargetResolutionTimeMs, &p.Enabled, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("sla policy not found")
		}
		return nil, err
	}
	return &p, nil
}

func (r *SLAPolicyRepository) List(ctx context.Context, tenantID string, enabled *bool) ([]models.SLAPolicy, error) {
	var rows *sql.Rows
	var err error
	if enabled != nil {
		rows, err = r.db.QueryContext(ctx,
			`SELECT id, tenant_id, name, description, priority, target_response_time_ms,
				target_resolution_time_ms, enabled, created_at, updated_at
				FROM sla_policies WHERE tenant_id = $1 AND enabled = $2 ORDER BY priority, name`,
			tenantID, *enabled)
	} else {
		rows, err = r.db.QueryContext(ctx,
			`SELECT id, tenant_id, name, description, priority, target_response_time_ms,
				target_resolution_time_ms, enabled, created_at, updated_at
				FROM sla_policies WHERE tenant_id = $1 ORDER BY priority, name`,
			tenantID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var policies []models.SLAPolicy
	for rows.Next() {
		var p models.SLAPolicy
		if err := rows.Scan(&p.ID, &p.TenantID, &p.Name, &p.Description, &p.Priority,
			&p.TargetResponseTimeMs, &p.TargetResolutionTimeMs, &p.Enabled, &p.CreatedAt, &p.UpdatedAt); err != nil {
			continue
		}
		policies = append(policies, p)
	}
	return policies, nil
}

func (r *SLAPolicyRepository) Update(ctx context.Context, policy *models.SLAPolicy) error {
	policy.UpdatedAt = time.Now().UTC()
	query := `UPDATE sla_policies SET name = $1, description = $2, priority = $3,
		target_response_time_ms = $4, target_resolution_time_ms = $5, enabled = $6, updated_at = $7
		WHERE id = $8 AND tenant_id = $9`
	result, err := r.db.ExecContext(ctx, query,
		policy.Name, policy.Description, policy.Priority,
		policy.TargetResponseTimeMs, policy.TargetResolutionTimeMs, policy.Enabled,
		policy.UpdatedAt, policy.ID, policy.TenantID,
	)
	if err != nil {
		return fmt.Errorf("update sla policy: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("sla policy not found")
	}
	return nil
}

func (r *SLAPolicyRepository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM sla_policies WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return fmt.Errorf("delete sla policy: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("sla policy not found")
	}
	return nil
}

// FindMatching finds the best matching SLA policy for a ticket priority
func (r *SLAPolicyRepository) FindMatching(ctx context.Context, tenantID, priority string) (*models.SLAPolicy, error) {
	var p models.SLAPolicy
	err := r.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, name, description, priority, target_response_time_ms,
			target_resolution_time_ms, enabled, created_at, updated_at
			FROM sla_policies WHERE tenant_id = $1 AND priority = $2 AND enabled = true
			ORDER BY created_at DESC LIMIT 1`,
		tenantID, priority).Scan(
		&p.ID, &p.TenantID, &p.Name, &p.Description, &p.Priority,
		&p.TargetResponseTimeMs, &p.TargetResolutionTimeMs, &p.Enabled, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

// GetCompliance gets compliance stats for a policy over a period
func (r *SLAPolicyRepository) GetCompliance(ctx context.Context, tenantID, policyID string, start, end time.Time) (*models.SLAComplianceDetail, error) {
	var total, breached int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(DISTINCT r.ticket_id), COUNT(DISTINCT CASE WHEN r.breached THEN r.ticket_id END)
			FROM sla_records r JOIN sla_targets t ON r.sla_target_id = t.id
			WHERE t.tenant_id = $1 AND r.sla_target_id IN (
				SELECT id FROM sla_policies WHERE id = $2
			) AND r.created_at >= $3 AND r.created_at < $4`,
		tenantID, policyID, start, end).Scan(&total, &breached)
	if err != nil {
		return nil, err
	}

	var policyName string
	if err := r.db.QueryRowContext(ctx,
		`SELECT name FROM sla_policies WHERE id = $1 AND tenant_id = $2`, policyID, tenantID).Scan(&policyName); err != nil {
		return nil, err
	}

	complianceRate := 0.0
	if total > 0 {
		complianceRate = float64(total-breached) / float64(total)
	}

	return &models.SLAComplianceDetail{
		PolicyID:       policyID,
		PolicyName:     policyName,
		PeriodStart:    start,
		PeriodEnd:      end,
		TotalTickets:   total,
		BreachedCount:  breached,
		ComplianceRate: complianceRate,
	}, nil
}

// GetTicketSLAStatus gets current SLA status for a ticket
func (r *SLAPolicyRepository) GetTicketSLAStatus(ctx context.Context, tenantID, ticketID string) (*models.TicketSLAStatus, error) {
	var status models.TicketSLAStatus
	var respondedAt, resolvedAt sql.NullTime
	err := r.db.QueryRowContext(ctx,
		`SELECT r.id, t.priority, t.target_response_time_ms, t.target_resolution_time_ms,
			r.response_deadline_at, r.resolution_deadline_at, r.responded_at, r.resolved_at,
			r.breached, r.breach_type
			FROM sla_records r JOIN sla_targets t ON r.sla_target_id = t.id
			WHERE r.ticket_id = $1 AND t.tenant_id = $2
			ORDER BY r.created_at DESC LIMIT 1`,
		ticketID, tenantID).Scan(
		&status.PolicyID, &status.Priority, &status.TargetResponseTimeMs, &status.TargetResolutionTimeMs,
		&status.ResponseDeadlineAt, &status.ResolutionDeadlineAt, &respondedAt, &resolvedAt,
		&status.Breached, &status.BreachType,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("sla record not found for ticket")
		}
		return nil, err
	}

	status.TicketID = ticketID
	if respondedAt.Valid {
		status.RespondedAt = &respondedAt.Time
	}
	if resolvedAt.Valid {
		status.ResolvedAt = &resolvedAt.Time
	}

	// Determine status
	if status.Breached {
		status.Status = "breached"
	} else {
		now := time.Now().UTC()
		if now.Before(status.ResponseDeadlineAt) {
			status.Status = "on_track"
		} else {
			status.Status = "at_risk"
		}
	}

	return &status, nil
}
