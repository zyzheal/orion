package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ticket/models"

	"orion/go-common/pkg/database"
)

type SLARepository struct {
	db *database.DB
}

func NewSLARepository(db *database.DB) *SLARepository {
	return &SLARepository{db: db}
}

// SLA Targets

func (r *SLARepository) CreateTarget(ctx context.Context, target *models.SLATarget) error {
	// tenant_id is in the column list on purpose. 686 created the column and
	// this was the only INSERT in the codebase writing sla_targets, but it
	// skipped the column, so every target row landed with NULL ownership and
	// GetTargetByPriority could hand another tenant's windows to this tenant's
	// ticket. The column is nullable, which made the omission legal SQL and so
	// invisible to any build or migration check.
	query := `INSERT INTO sla_targets (id, tenant_id, name, priority, target_response_time_ms, target_resolution_time_ms, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.ExecContext(ctx, query,
		target.ID, target.TenantID, target.Name, target.Priority,
		target.TargetResponseTimeMs, target.TargetResolutionTimeMs, target.Enabled,
	)
	return err
}

func (r *SLARepository) ListTargets(ctx context.Context, tenantID string) ([]models.SLATarget, error) {
	var targets []models.SLATarget
	err := r.db.SelectContext(ctx, &targets,
		"SELECT * FROM sla_targets WHERE tenant_id = $1 ORDER BY priority, name", tenantID)
	return targets, err
}

func (r *SLARepository) GetTargetByPriority(ctx context.Context, tenantID, priority string) (*models.SLATarget, error) {
	// tenant_id leads the predicate: priority alone resolved the first enabled
	// row with that priority anywhere in the registry, which is how a target
	// written by a different tenant became the SLA deadline of this tenant's
	// ticket. Rows with NULL tenant_id (written before this column was wired)
	// match no predicate, so they are no longer reachable from any tenant.
	var target models.SLATarget
	err := r.db.GetContext(ctx, &target,
		"SELECT * FROM sla_targets WHERE tenant_id = $1 AND priority = $2 AND enabled = true LIMIT 1",
		tenantID, priority)
	if err != nil {
		return nil, err
	}
	return &target, nil
}

func (r *SLARepository) DeleteTarget(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		"DELETE FROM sla_targets WHERE id = $2 AND tenant_id = $1", tenantID, id)
	return err
}

// SLA Records
//
// sla_records has no tenant_id by design (see 686: no INSERT in the codebase
// writes one, so a NOT NULL column plus a WHERE predicate would have turned
// every legitimate call into not found). Ownership is therefore derived from
// the parent ticket, and every read below ends in the same semi-join,
// ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1). sla_records.
// ticket_id matches at most one tickets.id, so the join can only narrow the
// result set, never widen it. CreateRecord and UpdateRecord are exempt: they
// are keyed by the record primary key, and every record handed to UpdateRecord
// comes out of a scoped read in this file.

func (r *SLARepository) CreateRecord(ctx context.Context, record *models.SLARecord) error {
	query := `INSERT INTO sla_records (id, ticket_id, sla_target_id, priority, response_deadline_at, resolution_deadline_at, breached, paused)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.ExecContext(ctx, query,
		record.ID, record.TicketID, record.SLATargetID, record.Priority,
		record.ResponseDeadlineAt, record.ResolutionDeadlineAt, record.Breached, record.Paused,
	)
	return err
}

func (r *SLARepository) GetRecordByTicket(ctx context.Context, tenantID, ticketID string) (*models.SLARecord, error) {
	// The old body answered SELECT * ... WHERE ticket_id = $1 alone, so any
	// authenticated tenant could read any other tenant's SLA deadline and
	// breach state by guessing or learning a ticket id.
	var record models.SLARecord
	err := r.db.GetContext(ctx, &record,
		`SELECT r.* FROM sla_records r
		 WHERE r.ticket_id = $2
		   AND r.ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)`,
		tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *SLARepository) UpdateRecord(ctx context.Context, record *models.SLARecord) error {
	query := `UPDATE sla_records SET responded_at=$1, resolved_at=$2, breached=$3, breach_type=$4,
		paused=$5, paused_at=$6, paused_reason=$7, updated_at=NOW() WHERE id=$8`
	_, err := r.db.ExecContext(ctx, query,
		record.RespondedAt, record.ResolvedAt, record.Breached, record.BreachType,
		record.Paused, record.PausedAt, record.PausedReason, record.ID,
	)
	return err
}

func (r *SLARepository) FindBreachedRecords(ctx context.Context, tenantID string) ([]models.SLARecord, error) {
	var records []models.SLARecord
	err := r.db.SelectContext(ctx, &records,
		`SELECT r.* FROM sla_records r
		 WHERE r.breached = true AND r.resolved_at IS NULL
		   AND r.ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)
		 ORDER BY r.resolution_deadline_at ASC`,
		tenantID)
	return records, err
}

func (r *SLARepository) FindPendingRecords(ctx context.Context, tenantID string) ([]models.SLARecord, error) {
	var records []models.SLARecord
	err := r.db.SelectContext(ctx, &records,
		`SELECT r.* FROM sla_records r
		 WHERE r.breached = false AND r.resolved_at IS NULL AND r.paused = false
		   AND r.ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)
		 ORDER BY r.resolution_deadline_at ASC`,
		tenantID)
	return records, err
}

func (r *SLARepository) PauseRecord(ctx context.Context, tenantID, ticketID, reason string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE sla_records SET paused = true, paused_at = NOW(), paused_reason = $1, updated_at = NOW()
		 WHERE ticket_id = $2
		   AND ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $3)`,
		reason, ticketID, tenantID)
	return err
}

func (r *SLARepository) UnpauseRecord(ctx context.Context, tenantID, ticketID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE sla_records SET paused = false, paused_at = NULL, paused_reason = '', updated_at = NOW()
		 WHERE ticket_id = $2
		   AND ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)`,
		tenantID, ticketID)
	return err
}

// Compliance reporting

func (r *SLARepository) GetComplianceReport(ctx context.Context, tenantID string, start, end time.Time) (*models.SLAComplianceReport, error) {
	report := &models.SLAComplianceReport{
		ByPriority: make(map[string]models.SLAPriorityStats),
	}

	// All five counts are scoped to tenant_id by the semi-join; tenantID is $1
	// in every query and the window bounds are $2 and $3, so the same three
	// arguments are bound in the same order throughout.
	// Total and breached counts
	err := r.db.GetContext(ctx, &report.TotalTickets,
		`SELECT COUNT(*) FROM sla_records r
		 WHERE r.created_at BETWEEN $2 AND $3
		   AND r.ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)`,
		tenantID, start, end)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &report.BreachedCount,
		`SELECT COUNT(*) FROM sla_records r
		 WHERE r.breached = true AND r.created_at BETWEEN $2 AND $3
		   AND r.ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)`,
		tenantID, start, end)
	if err != nil {
		return nil, err
	}

	if report.TotalTickets > 0 {
		report.ComplianceRate = float64(report.TotalTickets-report.BreachedCount) / float64(report.TotalTickets) * 100
	}

	// Average times. Both of these errors used to be discarded, which made a
	// driver fault here look like "average response time: 0ms" on
	// GET /tickets/sla/compliance. Zero is also a legitimate answer from the
	// COALESCE, so the route had no way to tell a healthy empty average from a
	// database that refused to answer.
	if err := r.db.GetContext(ctx, &report.AvgResponseMs,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (r.responded_at - r.created_at)) * 1000), 0)
		FROM sla_records r
		WHERE r.responded_at IS NOT NULL AND r.created_at BETWEEN $2 AND $3
		AND r.ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)`, tenantID, start, end); err != nil {
		return nil, fmt.Errorf("avg response: %w", err)
	}
	if err := r.db.GetContext(ctx, &report.AvgResolutionMs,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (r.resolved_at - r.created_at)) * 1000), 0)
		FROM sla_records r
		WHERE r.resolved_at IS NOT NULL AND r.created_at BETWEEN $2 AND $3
		AND r.ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)`, tenantID, start, end); err != nil {
		return nil, fmt.Errorf("avg resolution: %w", err)
	}

	// By priority
	rows, err := r.db.QueryContext(ctx,
		`SELECT r.priority, COUNT(*) as total,
		COUNT(CASE WHEN r.breached THEN 1 END) as breached
		FROM sla_records r
		WHERE r.created_at BETWEEN $2 AND $3
		AND r.ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)
		GROUP BY r.priority`, tenantID, start, end)
	if err != nil {
		// This used to be return report, nil: the partial report held real total
		// and breached counts and an empty ByPriority map, so the route answered
		// 200 with a plausible-looking compliance figure that simply had no
		// breakdown behind it.
		return nil, fmt.Errorf("by priority: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var priority string
		var total, breached int
		if err := rows.Scan(&priority, &total, &breached); err != nil {
			return nil, fmt.Errorf("scan priority row: %w", err)
		}
		rate := float64(0)
		if total > 0 {
			rate = float64(total-breached) / float64(total) * 100
		}
		report.ByPriority[priority] = models.SLAPriorityStats{
			Total: total, Breached: breached, ComplianceRate: rate,
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate priority rows: %w", err)
	}

	return report, nil
}
