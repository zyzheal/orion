package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ticket/models"

	"orion/go-common/pkg/database"
)

type DispatchRepository struct {
	db *database.DB
}

func NewDispatchRepository(db *database.DB) *DispatchRepository {
	return &DispatchRepository{db: db}
}

// Engineers

func (r *DispatchRepository) CreateEngineer(ctx context.Context, ep *models.EngineerProfile) error {
	expertiseJSON, err := json.Marshal(ep.Expertise)
	if err != nil {
		return fmt.Errorf("marshal expertise: %w", err)
	}
	skillsJSON, err := json.Marshal(ep.Skills)
	if err != nil {
		return fmt.Errorf("marshal skills: %w", err)
	}
	query := `INSERT INTO dispatch_engineers (id, name, expertise, current_load, max_capacity, availability,
		skills, team, on_call, total_resolved, avg_resolution_ms, sla_compliance, success_rate)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`
	_, err = r.db.ExecContext(ctx, query,
		ep.ID, ep.Name, string(expertiseJSON), ep.CurrentLoad, ep.MaxCapacity, ep.Availability,
		string(skillsJSON), ep.Team, ep.OnCall, ep.TotalResolved, ep.AvgResolutionMs,
		ep.SLACompliance, ep.SuccessRate,
	)
	return err
}

func (r *DispatchRepository) UpdateEngineer(ctx context.Context, ep *models.EngineerProfile) error {
	expertiseJSON, err := json.Marshal(ep.Expertise)
	if err != nil {
		return fmt.Errorf("marshal expertise: %w", err)
	}
	skillsJSON, err := json.Marshal(ep.Skills)
	if err != nil {
		return fmt.Errorf("marshal skills: %w", err)
	}
	query := `UPDATE dispatch_engineers SET name=$1, expertise=$2, current_load=$3, max_capacity=$4,
		availability=$5, skills=$6, team=$7, on_call=$8, total_resolved=$9, avg_resolution_ms=$10,
		sla_compliance=$11, success_rate=$12, updated_at=NOW() WHERE id=$13`
	_, err = r.db.ExecContext(ctx, query,
		ep.Name, string(expertiseJSON), ep.CurrentLoad, ep.MaxCapacity, ep.Availability,
		string(skillsJSON), ep.Team, ep.OnCall, ep.TotalResolved, ep.AvgResolutionMs,
		ep.SLACompliance, ep.SuccessRate, ep.ID,
	)
	return err
}

func (r *DispatchRepository) GetEngineer(ctx context.Context, id string) (*models.EngineerProfile, error) {
	var ep models.EngineerProfile
	var expertiseJSON, skillsJSON string
	err := r.db.QueryRowContext(ctx, 
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
	if err := json.Unmarshal([]byte(expertiseJSON), &ep.Expertise); err != nil {
		return nil, fmt.Errorf("unmarshal expertise: %w", err)
	}
	if err := json.Unmarshal([]byte(skillsJSON), &ep.Skills); err != nil {
		return nil, fmt.Errorf("unmarshal skills: %w", err)
	}
	return &ep, nil
}

func (r *DispatchRepository) ListEngineers(ctx context.Context) ([]models.EngineerProfile, error) {
	rows, err := r.db.QueryContext(ctx,
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
		if err := json.Unmarshal([]byte(expertiseJSON), &ep.Expertise); err != nil {
			continue
		}
		if err := json.Unmarshal([]byte(skillsJSON), &ep.Skills); err != nil {
			continue
		}
		engineers = append(engineers, ep)
	}
	return engineers, nil
}

func (r *DispatchRepository) IncrementLoad(ctx context.Context, engineerID string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE dispatch_engineers SET current_load = current_load + 1, updated_at = NOW() WHERE id = $1", engineerID)
	return err
}

func (r *DispatchRepository) DecrementLoad(ctx context.Context, engineerID string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE dispatch_engineers SET current_load = GREATEST(current_load - 1, 0), updated_at = NOW() WHERE id = $1", engineerID)
	return err
}

// Dispatch Records

func (r *DispatchRepository) CreateRecord(ctx context.Context, rec *models.DispatchRecord) error {
	query := `INSERT INTO dispatch_records (id, ticket_id, engineer_id, assigned_by, method, score, reason)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.ExecContext(ctx, query,
		rec.ID, rec.TicketID, rec.EngineerID, rec.AssignedBy, rec.Method, rec.Score, rec.Reason,
	)
	return err
}

func (r *DispatchRepository) GetRecordByTicket(ctx context.Context, ticketID string) (*models.DispatchRecord, error) {
	var rec models.DispatchRecord
	err := r.db.GetContext(ctx, &rec, "SELECT * FROM dispatch_records WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1", ticketID)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *DispatchRepository) ListRecordsByEngineer(ctx context.Context, engineerID string, limit int) ([]models.DispatchRecord, error) {
	var records []models.DispatchRecord
	err := r.db.SelectContext(ctx, &records,
		"SELECT * FROM dispatch_records WHERE engineer_id = $1 ORDER BY created_at DESC LIMIT $2", engineerID, limit)
	return records, err
}

// Dispatch Rules

func (r *DispatchRepository) CreateRule(ctx context.Context, rule *models.DispatchRule) error {
	query := `INSERT INTO dispatch_rules (id, name, condition, engineer_id, priority) VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.ExecContext(ctx, query, rule.ID, rule.Name, rule.Condition, rule.EngineerID, rule.Priority)
	return err
}

func (r *DispatchRepository) ListRules(ctx context.Context) ([]models.DispatchRule, error) {
	var rules []models.DispatchRule
	err := r.db.SelectContext(ctx, &rules, "SELECT * FROM dispatch_rules ORDER BY priority DESC, name")
	return rules, err
}

func (r *DispatchRepository) DeleteRule(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM dispatch_rules WHERE id = $1", id)
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

func (r *DispatchRepository) Enqueue(ctx context.Context, ticketID, tenantID, priority string) error {
	query := `INSERT INTO dispatch_queue (ticket_id, tenant_id, priority, enqueued_at, attempts)
		VALUES ($1, $2, $3, NOW(), 0)
		ON CONFLICT (ticket_id) DO NOTHING`
	_, err := r.db.ExecContext(ctx, query, ticketID, tenantID, priority)
	return err
}

func (r *DispatchRepository) Dequeue(ctx context.Context, limit int) ([]models.DispatchQueueEntry, error) {
	var entries []models.DispatchQueueEntry
	err := r.db.SelectContext(ctx, &entries,
		`SELECT * FROM dispatch_queue ORDER BY
		CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
		enqueued_at ASC LIMIT $1`, limit)
	return entries, err
}

func (r *DispatchRepository) RemoveFromQueue(ctx context.Context, ticketID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM dispatch_queue WHERE ticket_id = $1", ticketID)
	return err
}

func (r *DispatchRepository) UpdateQueueEntry(ctx context.Context, ticketID, lastError string, attempts int) error {
	_, err := r.db.ExecContext(ctx, "UPDATE dispatch_queue SET attempts = $1, last_error = $2 WHERE ticket_id = $3",
		attempts, lastError, ticketID)
	return err
}

func (r *DispatchRepository) GetQueueStatus(ctx context.Context) (*models.DispatchQueueStatus, error) {
	status := &models.DispatchQueueStatus{}

	if err := r.db.GetContext(ctx, &status.PendingCount, "SELECT COUNT(*) FROM dispatch_queue"); err != nil {
		return nil, fmt.Errorf("count pending: %w", err)
	}

	var oldest *time.Time
	if err := r.db.GetContext(ctx, &oldest, "SELECT MIN(enqueued_at) FROM dispatch_queue"); err != nil {
		return nil, fmt.Errorf("oldest entry: %w", err)
	}
	status.OldestEntry = oldest

	if err := r.db.GetContext(ctx, &status.AvgWaitMs,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - enqueued_at)) * 1000), 0) FROM dispatch_queue`); err != nil {
		return nil, fmt.Errorf("avg wait: %w", err)
	}

	return status, nil
}

// Dispatch Metrics

func (r *DispatchRepository) GetMetrics(ctx context.Context, start, end time.Time) (*models.DispatchMetrics, error) {
	metrics := &models.DispatchMetrics{}

	if err := r.db.GetContext(ctx, &metrics.TotalDispatches,
		"SELECT COUNT(*) FROM dispatch_records WHERE created_at BETWEEN $1 AND $2", start, end); err != nil {
		return nil, fmt.Errorf("total dispatches: %w", err)
	}
	if err := r.db.GetContext(ctx, &metrics.AutoDispatches,
		"SELECT COUNT(*) FROM dispatch_records WHERE method = 'auto' AND created_at BETWEEN $1 AND $2", start, end); err != nil {
		return nil, fmt.Errorf("auto dispatches: %w", err)
	}
	if err := r.db.GetContext(ctx, &metrics.ManualDispatches,
		"SELECT COUNT(*) FROM dispatch_records WHERE method = 'manual' AND created_at BETWEEN $1 AND $2", start, end); err != nil {
		return nil, fmt.Errorf("manual dispatches: %w", err)
	}

	if metrics.TotalDispatches > 0 {
		metrics.SuccessRate = 100.0 // simplified
	}

	return metrics, nil
}
