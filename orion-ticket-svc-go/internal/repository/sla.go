package repository

import (
	"time"

	"orion-ticket-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type SLARepository struct {
	db *sqlx.DB
}

func NewSLARepository(db *sqlx.DB) *SLARepository {
	return &SLARepository{db: db}
}

// SLA Targets

func (r *SLARepository) CreateTarget(target *models.SLATarget) error {
	query := `INSERT INTO sla_targets (id, name, priority, target_response_time_ms, target_resolution_time_ms, enabled)
		VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.Exec(query,
		target.ID, target.Name, target.Priority,
		target.TargetResponseTimeMs, target.TargetResolutionTimeMs, target.Enabled,
	)
	return err
}

func (r *SLARepository) ListTargets() ([]models.SLATarget, error) {
	var targets []models.SLATarget
	err := r.db.Select(&targets, "SELECT * FROM sla_targets ORDER BY priority, name")
	return targets, err
}

func (r *SLARepository) GetTargetByPriority(priority string) (*models.SLATarget, error) {
	var target models.SLATarget
	err := r.db.Get(&target,
		"SELECT * FROM sla_targets WHERE priority = $1 AND enabled = true LIMIT 1", priority)
	if err != nil {
		return nil, err
	}
	return &target, nil
}

func (r *SLARepository) DeleteTarget(id string) error {
	_, err := r.db.Exec("DELETE FROM sla_targets WHERE id = $1", id)
	return err
}

// SLA Records

func (r *SLARepository) CreateRecord(record *models.SLARecord) error {
	query := `INSERT INTO sla_records (id, ticket_id, sla_target_id, priority, response_deadline_at, resolution_deadline_at, breached, paused)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.Exec(query,
		record.ID, record.TicketID, record.SLATargetID, record.Priority,
		record.ResponseDeadlineAt, record.ResolutionDeadlineAt, record.Breached, record.Paused,
	)
	return err
}

func (r *SLARepository) GetRecordByTicket(ticketID string) (*models.SLARecord, error) {
	var record models.SLARecord
	err := r.db.Get(&record, "SELECT * FROM sla_records WHERE ticket_id = $1", ticketID)
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *SLARepository) UpdateRecord(record *models.SLARecord) error {
	query := `UPDATE sla_records SET responded_at=$1, resolved_at=$2, breached=$3, breach_type=$4,
		paused=$5, paused_at=$6, paused_reason=$7, updated_at=NOW() WHERE id=$8`
	_, err := r.db.Exec(query,
		record.RespondedAt, record.ResolvedAt, record.Breached, record.BreachType,
		record.Paused, record.PausedAt, record.PausedReason, record.ID,
	)
	return err
}

func (r *SLARepository) FindBreachedRecords() ([]models.SLARecord, error) {
	var records []models.SLARecord
	err := r.db.Select(&records,
		`SELECT * FROM sla_records WHERE breached = true AND resolved_at IS NULL ORDER BY resolution_deadline_at ASC`)
	return records, err
}

func (r *SLARepository) FindPendingRecords() ([]models.SLARecord, error) {
	var records []models.SLARecord
	err := r.db.Select(&records,
		`SELECT * FROM sla_records WHERE breached = false AND resolved_at IS NULL AND paused = false ORDER BY resolution_deadline_at ASC`)
	return records, err
}

func (r *SLARepository) PauseRecord(ticketID, reason string) error {
	_, err := r.db.Exec(
		`UPDATE sla_records SET paused = true, paused_at = NOW(), paused_reason = $1, updated_at = NOW() WHERE ticket_id = $2`,
		reason, ticketID)
	return err
}

func (r *SLARepository) UnpauseRecord(ticketID string) error {
	_, err := r.db.Exec(
		`UPDATE sla_records SET paused = false, paused_at = NULL, paused_reason = '', updated_at = NOW() WHERE ticket_id = $1`,
		ticketID)
	return err
}

// Compliance reporting

func (r *SLARepository) GetComplianceReport(start, end time.Time) (*models.SLAComplianceReport, error) {
	report := &models.SLAComplianceReport{
		ByPriority: make(map[string]models.SLAPriorityStats),
	}

	// Total and breached counts
	err := r.db.Get(&report.TotalTickets,
		`SELECT COUNT(*) FROM sla_records WHERE created_at BETWEEN $1 AND $2`, start, end)
	if err != nil {
		return nil, err
	}

	err = r.db.Get(&report.BreachedCount,
		`SELECT COUNT(*) FROM sla_records WHERE breached = true AND created_at BETWEEN $1 AND $2`, start, end)
	if err != nil {
		return nil, err
	}

	if report.TotalTickets > 0 {
		report.ComplianceRate = float64(report.TotalTickets-report.BreachedCount) / float64(report.TotalTickets) * 100
	}

	// Average times
	r.db.Get(&report.AvgResponseMs,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (responded_at - created_at)) * 1000), 0)
		FROM sla_records WHERE responded_at IS NOT NULL AND created_at BETWEEN $1 AND $2`, start, end)

	r.db.Get(&report.AvgResolutionMs,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000), 0)
		FROM sla_records WHERE resolved_at IS NOT NULL AND created_at BETWEEN $1 AND $2`, start, end)

	// By priority
	rows, err := r.db.Query(
		`SELECT priority, COUNT(*) as total,
		COUNT(CASE WHEN breached THEN 1 END) as breached
		FROM sla_records WHERE created_at BETWEEN $1 AND $2
		GROUP BY priority`, start, end)
	if err != nil {
		return report, nil
	}
	defer rows.Close()

	for rows.Next() {
		var priority string
		var total, breached int
		if err := rows.Scan(&priority, &total, &breached); err != nil {
			continue
		}
		rate := float64(0)
		if total > 0 {
			rate = float64(total-breached) / float64(total) * 100
		}
		report.ByPriority[priority] = models.SLAPriorityStats{
			Total: total, Breached: breached, ComplianceRate: rate,
		}
	}

	return report, nil
}
