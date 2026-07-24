package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ticket/models"

	"orion/go-common/pkg/database"
)

type TransferRepository struct {
	db *database.DB
}

func NewTransferRepository(db *database.DB) *TransferRepository {
	return &TransferRepository{db: db}
}

func (r *TransferRepository) Create(ctx context.Context, rec *models.TransferRecord) error {
	query := `INSERT INTO ticket_transfers (id, ticket_id, from_engineer_id, to_engineer_id, initiated_by, reason, hold_duration_ms)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.ExecContext(ctx, query,
		rec.ID, rec.TicketID, rec.FromEngineerID, rec.ToEngineerID,
		rec.InitiatedBy, rec.Reason, rec.HoldDurationMs,
	)
	return err
}

func (r *TransferRepository) ListByTicket(ctx context.Context, ticketID string) ([]models.TransferRecord, error) {
	var records []models.TransferRecord
	err := r.db.SelectContext(ctx, &records,
		"SELECT * FROM ticket_transfers WHERE ticket_id = $1 ORDER BY created_at DESC", ticketID)
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

	// By engineer
	rows, err := r.db.QueryContext(ctx,
		`SELECT to_engineer_id, COUNT(*) as cnt FROM ticket_transfers
		WHERE created_at BETWEEN $1 AND $2 GROUP BY to_engineer_id ORDER BY cnt DESC LIMIT 10`, start, end)
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
