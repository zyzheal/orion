package repository

import (
	"context"
	"orion-ticket-svc-go/internal/models"

	"orion/go-common/pkg/database"
)

type SuspendRepository struct {
	db *database.DB
}

func NewSuspendRepository(db *database.DB) *SuspendRepository {
	return &SuspendRepository{db: db}
}

func (r *SuspendRepository) Create(ctx context.Context, s *models.SuspendRecord) error {
	query := `INSERT INTO suspend_records (id, engineer_id, reason, status, start_time, end_time,
		backup_engineer_id, auto_reassign_pending, pause_sla_for_pending, notes, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	_, err := r.db.ExecContext(ctx, query,
		s.ID, s.EngineerID, s.Reason, s.Status, s.StartTime, s.EndTime,
		s.BackupEngineerID, s.AutoReassignPending, s.PauseSLAForPending, s.Notes, s.CreatedBy,
	)
	return err
}

func (r *SuspendRepository) GetByID(ctx context.Context, id string) (*models.SuspendRecord, error) {
	var s models.SuspendRecord
	err := r.db.GetContext(ctx, &s, "SELECT * FROM suspend_records WHERE id = $1", id)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *SuspendRepository) Update(ctx context.Context, s *models.SuspendRecord) error {
	query := `UPDATE suspend_records SET status=$1, activated_at=$2, ended_at=$3, cancelled_at=$4, updated_at=NOW()
		WHERE id=$5`
	_, err := r.db.ExecContext(ctx, query, s.Status, s.ActivatedAt, s.EndedAt, s.CancelledAt, s.ID)
	return err
}

func (r *SuspendRepository) ListByStatus(ctx context.Context, status string) ([]models.SuspendRecord, error) {
	var records []models.SuspendRecord
	if status == "" {
		err := r.db.SelectContext(ctx, &records, "SELECT * FROM suspend_records ORDER BY created_at DESC")
		return records, err
	}
	err := r.db.SelectContext(ctx, &records, "SELECT * FROM suspend_records WHERE status = $1 ORDER BY created_at DESC", status)
	return records, err
}

func (r *SuspendRepository) ListByEngineer(ctx context.Context, engineerID string) ([]models.SuspendRecord, error) {
	var records []models.SuspendRecord
	err := r.db.SelectContext(ctx, &records,
		"SELECT * FROM suspend_records WHERE engineer_id = $1 ORDER BY created_at DESC", engineerID)
	return records, err
}

func (r *SuspendRepository) FindActiveByEngineer(ctx context.Context, engineerID string) (*models.SuspendRecord, error) {
	var s models.SuspendRecord
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM suspend_records WHERE engineer_id = $1 AND status = 'active' LIMIT 1`, engineerID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *SuspendRepository) CountPendingByEngineer(ctx context.Context, engineerID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM tickets WHERE assigned_to = $1 AND status IN ('open', 'assigned')`, engineerID)
	return count, err
}

func (r *SuspendRepository) CountActiveByEngineer(ctx context.Context, engineerID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM tickets WHERE assigned_to = $1 AND status = 'in-progress'`, engineerID)
	return count, err
}
