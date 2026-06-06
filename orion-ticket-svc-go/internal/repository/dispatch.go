package repository

import (
	"encoding/json"
	"fmt"
	"time"

	"orion-ticket-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type DispatchRepository struct {
	db *sqlx.DB
}

func NewDispatchRepository(db *sqlx.DB) *DispatchRepository {
	return &DispatchRepository{db: db}
}

// Engineers

func (r *DispatchRepository) CreateEngineer(ep *models.EngineerProfile) error {
	expertiseJSON, _ := json.Marshal(ep.Expertise)
	skillsJSON, _ := json.Marshal(ep.Skills)
	query := `INSERT INTO dispatch_engineers (id, name, expertise, current_load, max_capacity, availability,
		skills, team, on_call, total_resolved, avg_resolution_ms, sla_compliance, success_rate)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`
	_, err := r.db.Exec(query,
		ep.ID, ep.Name, string(expertiseJSON), ep.CurrentLoad, ep.MaxCapacity, ep.Availability,
		string(skillsJSON), ep.Team, ep.OnCall, ep.TotalResolved, ep.AvgResolutionMs,
		ep.SLACompliance, ep.SuccessRate,
	)
	return err
}

func (r *DispatchRepository) UpdateEngineer(ep *models.EngineerProfile) error {
	expertiseJSON, _ := json.Marshal(ep.Expertise)
	skillsJSON, _ := json.Marshal(ep.Skills)
	query := `UPDATE dispatch_engineers SET name=$1, expertise=$2, current_load=$3, max_capacity=$4,
		availability=$5, skills=$6, team=$7, on_call=$8, total_resolved=$9, avg_resolution_ms=$10,
		sla_compliance=$11, success_rate=$12, updated_at=NOW() WHERE id=$13`
	_, err := r.db.Exec(query,
		ep.Name, string(expertiseJSON), ep.CurrentLoad, ep.MaxCapacity, ep.Availability,
		string(skillsJSON), ep.Team, ep.OnCall, ep.TotalResolved, ep.AvgResolutionMs,
		ep.SLACompliance, ep.SuccessRate, ep.ID,
	)
	return err
}

func (r *DispatchRepository) GetEngineer(id string) (*models.EngineerProfile, error) {
	var ep models.EngineerProfile
	var expertiseJSON, skillsJSON string
	err := r.db.QueryRow(
		`SELECT id, name, expertise, current_load, max_capacity, availability, skills, team, on_call,
		total_resolved, avg_resolution_ms, sla_compliance, success_rate, created_at, updated_at
		FROM dispatch_engineers WHERE id = $1`, id).Scan(
		&ep.ID, &ep.Name, &expertiseJSON, &ep.CurrentLoad, &ep.MaxCapacity, &ep.Availability,
		&skillsJSON, &ep.Team, &ep.OnCall, &ep.TotalResolved, &ep.AvgResolutionMs,
		&ep.SLACompliance, &ep.SuccessRate, &ep.CreatedAt, &ep.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	json.Unmarshal([]byte(expertiseJSON), &ep.Expertise)
	json.Unmarshal([]byte(skillsJSON), &ep.Skills)
	return &ep, nil
}

func (r *DispatchRepository) ListEngineers() ([]models.EngineerProfile, error) {
	rows, err := r.db.Query(
		`SELECT id, name, expertise, current_load, max_capacity, availability, skills, team, on_call,
		total_resolved, avg_resolution_ms, sla_compliance, success_rate, created_at, updated_at
		FROM dispatch_engineers ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var engineers []models.EngineerProfile
	for rows.Next() {
		var ep models.EngineerProfile
		var expertiseJSON, skillsJSON string
		if err := rows.Scan(
			&ep.ID, &ep.Name, &expertiseJSON, &ep.CurrentLoad, &ep.MaxCapacity, &ep.Availability,
			&skillsJSON, &ep.Team, &ep.OnCall, &ep.TotalResolved, &ep.AvgResolutionMs,
			&ep.SLACompliance, &ep.SuccessRate, &ep.CreatedAt, &ep.UpdatedAt,
		); err != nil {
			continue
		}
		json.Unmarshal([]byte(expertiseJSON), &ep.Expertise)
		json.Unmarshal([]byte(skillsJSON), &ep.Skills)
		engineers = append(engineers, ep)
	}
	return engineers, nil
}

func (r *DispatchRepository) IncrementLoad(engineerID string) error {
	_, err := r.db.Exec("UPDATE dispatch_engineers SET current_load = current_load + 1, updated_at = NOW() WHERE id = $1", engineerID)
	return err
}

func (r *DispatchRepository) DecrementLoad(engineerID string) error {
	_, err := r.db.Exec("UPDATE dispatch_engineers SET current_load = GREATEST(current_load - 1, 0), updated_at = NOW() WHERE id = $1", engineerID)
	return err
}

// Dispatch Records

func (r *DispatchRepository) CreateRecord(rec *models.DispatchRecord) error {
	query := `INSERT INTO dispatch_records (id, ticket_id, engineer_id, assigned_by, method, score, reason)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.Exec(query,
		rec.ID, rec.TicketID, rec.EngineerID, rec.AssignedBy, rec.Method, rec.Score, rec.Reason,
	)
	return err
}

func (r *DispatchRepository) GetRecordByTicket(ticketID string) (*models.DispatchRecord, error) {
	var rec models.DispatchRecord
	err := r.db.Get(&rec, "SELECT * FROM dispatch_records WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1", ticketID)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *DispatchRepository) ListRecordsByEngineer(engineerID string, limit int) ([]models.DispatchRecord, error) {
	var records []models.DispatchRecord
	err := r.db.Select(&records,
		"SELECT * FROM dispatch_records WHERE engineer_id = $1 ORDER BY created_at DESC LIMIT $2", engineerID, limit)
	return records, err
}

// Dispatch Rules

func (r *DispatchRepository) CreateRule(rule *models.DispatchRule) error {
	query := `INSERT INTO dispatch_rules (id, name, condition, engineer_id, priority) VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.Exec(query, rule.ID, rule.Name, rule.Condition, rule.EngineerID, rule.Priority)
	return err
}

func (r *DispatchRepository) ListRules() ([]models.DispatchRule, error) {
	var rules []models.DispatchRule
	err := r.db.Select(&rules, "SELECT * FROM dispatch_rules ORDER BY priority DESC, name")
	return rules, err
}

func (r *DispatchRepository) DeleteRule(id string) error {
	result, err := r.db.Exec("DELETE FROM dispatch_rules WHERE id = $1", id)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("not found")
	}
	return nil
}

// Dispatch Queue

func (r *DispatchRepository) Enqueue(ticketID, tenantID, priority string) error {
	query := `INSERT INTO dispatch_queue (ticket_id, tenant_id, priority, enqueued_at, attempts)
		VALUES ($1, $2, $3, NOW(), 0)
		ON CONFLICT (ticket_id) DO NOTHING`
	_, err := r.db.Exec(query, ticketID, tenantID, priority)
	return err
}

func (r *DispatchRepository) Dequeue(limit int) ([]models.DispatchQueueEntry, error) {
	var entries []models.DispatchQueueEntry
	err := r.db.Select(&entries,
		`SELECT * FROM dispatch_queue ORDER BY
		CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
		enqueued_at ASC LIMIT $1`, limit)
	return entries, err
}

func (r *DispatchRepository) RemoveFromQueue(ticketID string) error {
	_, err := r.db.Exec("DELETE FROM dispatch_queue WHERE ticket_id = $1", ticketID)
	return err
}

func (r *DispatchRepository) UpdateQueueEntry(ticketID, lastError string, attempts int) error {
	_, err := r.db.Exec("UPDATE dispatch_queue SET attempts = $1, last_error = $2 WHERE ticket_id = $3",
		attempts, lastError, ticketID)
	return err
}

func (r *DispatchRepository) GetQueueStatus() (*models.DispatchQueueStatus, error) {
	status := &models.DispatchQueueStatus{}

	r.db.Get(&status.PendingCount, "SELECT COUNT(*) FROM dispatch_queue")

	var oldest *time.Time
	r.db.Get(&oldest, "SELECT MIN(enqueued_at) FROM dispatch_queue")
	status.OldestEntry = oldest

	r.db.Get(&status.AvgWaitMs,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - enqueued_at)) * 1000), 0) FROM dispatch_queue`)

	return status, nil
}

// Dispatch Metrics

func (r *DispatchRepository) GetMetrics(start, end time.Time) (*models.DispatchMetrics, error) {
	metrics := &models.DispatchMetrics{}

	r.db.Get(&metrics.TotalDispatches,
		"SELECT COUNT(*) FROM dispatch_records WHERE created_at BETWEEN $1 AND $2", start, end)
	r.db.Get(&metrics.AutoDispatches,
		"SELECT COUNT(*) FROM dispatch_records WHERE method = 'auto' AND created_at BETWEEN $1 AND $2", start, end)
	r.db.Get(&metrics.ManualDispatches,
		"SELECT COUNT(*) FROM dispatch_records WHERE method = 'manual' AND created_at BETWEEN $1 AND $2", start, end)

	if metrics.TotalDispatches > 0 {
		metrics.SuccessRate = 100.0 // simplified
	}

	return metrics, nil
}
