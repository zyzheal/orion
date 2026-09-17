package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ticket/models"

	"orion/go-common/pkg/database"
)

// transferColumns is the explicit projection every SELECT against
// ticket_transfers uses. Never SELECT *: sqlx runs in safe mode, and 571 / 572
// add deleted_at, created_by, updated_by and updated_at to this table, none of
// which models.TransferRecord has a db destination for — a SELECT * fails the
// whole read.
const transferColumns = "id, ticket_id, from_user_id, to_user_id, initiated_by, reason, hold_duration_ms, created_at"

type TransferRepository struct {
	db *database.DB
}

func NewTransferRepository(db *database.DB) *TransferRepository {
	return &TransferRepository{db: db}
}

func (r *TransferRepository) Create(ctx context.Context, rec *models.TransferRecord) error {
	// created_at is NOT NULL with no default in 076; no caller sets it.
	if rec.CreatedAt.IsZero() {
		rec.CreatedAt = time.Now().UTC()
	}

	// 076's columns are from_user_id and to_user_id, not from_engineer_id and
	// to_engineer_id; initiated_by and hold_duration_ms come from
	// 696_add_ticket_relation_transfer_columns.sql.
	query := `INSERT INTO ticket_transfers (id, ticket_id, from_user_id, to_user_id, initiated_by, reason, hold_duration_ms, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.ExecContext(ctx, query,
		rec.ID, rec.TicketID, rec.FromEngineerID, rec.ToEngineerID,
		rec.InitiatedBy, rec.Reason, rec.HoldDurationMs, rec.CreatedAt,
	)
	return err
}

func (r *TransferRepository) ListByTicket(ctx context.Context, ticketID string) ([]models.TransferRecord, error) {
	var records []models.TransferRecord
	err := r.db.SelectContext(ctx, &records,
		"SELECT "+transferColumns+" FROM ticket_transfers WHERE ticket_id = $1 ORDER BY created_at DESC", ticketID)
	return records, err
}

func (r *TransferRepository) GetStats(ctx context.Context, start, end time.Time) (map[string]any, error) {
	stats := make(map[string]any)

	var total int
	if err := r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM ticket_transfers WHERE created_at BETWEEN $1 AND $2", start, end); err != nil {
		return nil, fmt.Errorf("total transfers: %w", err)
	}
	stats["total_transfers"] = total

	var avgHold float64
	r.db.GetContext(ctx, &avgHold,
		`SELECT COALESCE(AVG(hold_duration_ms), 0) FROM ticket_transfers WHERE created_at BETWEEN $1 AND $2`, start, end)
	stats["avg_hold_duration_ms"] = avgHold

	// By engineer. 076's column is to_user_id; the response key stays
	// top_receivers so the report shape does not change.
	rows, err := r.db.QueryContext(ctx,
		`SELECT to_user_id, COUNT(*) as cnt FROM ticket_transfers
		WHERE created_at BETWEEN $1 AND $2 GROUP BY to_user_id ORDER BY cnt DESC LIMIT 10`, start, end)
	if err == nil {
		defer rows.Close()
		topEngineers := make(map[string]int)
		for rows.Next() {
			var eid string
			var cnt int
			rows.Scan(&eid, &cnt)
			topEngineers[eid] = cnt
		}
		stats["top_receivers"] = topEngineers
	}

	return stats, nil
}
