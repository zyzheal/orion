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
// transferColumns is the explicit projection every SELECT against
// ticket_transfers uses. Never SELECT *: sqlx runs in safe mode, and 571 / 572
// add deleted_at, created_by, updated_by and updated_at to this table, none of
// which models.TransferRecord has a db destination for — a SELECT * fails the
// whole read.
//
// tenant_id 由 Migration 704 引入（ADR-011 多租户隔离），
// nullable + 回填自 tickets.tenant_id。
const transferColumns = "id, tenant_id, ticket_id, from_user_id, to_user_id, initiated_by, reason, hold_duration_ms, created_at"

type TransferRepository struct {
	db *database.DB
}

func NewTransferRepository(db *database.DB) *TransferRepository {
	return &TransferRepository{db: db}
}

// Create 写入 ticket_transfers。tenant_id 若未设置，自动从父工单 tickets.tenant_id 带出。
func (r *TransferRepository) Create(ctx context.Context, rec *models.TransferRecord) error {
	// created_at is NOT NULL with no default in 076; no caller sets it.
	if rec.CreatedAt.IsZero() {
		rec.CreatedAt = time.Now().UTC()
	}

	// 自动补 tenant_id：从 tickets 表拉
	if rec.TenantID == "" && rec.TicketID != "" {
		var tid string
		if err := r.db.GetContext(ctx, &tid,
			"SELECT tenant_id::text FROM tickets WHERE id = $1", rec.TicketID); err == nil {
			rec.TenantID = tid
		}
	}

	// 076's columns are from_user_id and to_user_id, not from_engineer_id and
	// to_engineer_id; initiated_by and hold_duration_ms come from
	// 696_add_ticket_relation_transfer_columns.sql.
	query := `INSERT INTO ticket_transfers (id, tenant_id, ticket_id, from_user_id, to_user_id, initiated_by, reason, hold_duration_ms, created_at)
		VALUES ($1, NULLIF($2, ''), $3, $4, $5, $6, $7, $8, $9)`
	_, err := r.db.ExecContext(ctx, query,
		rec.ID, rec.TenantID, rec.TicketID, rec.FromEngineerID, rec.ToEngineerID,
		rec.InitiatedBy, rec.Reason, rec.HoldDurationMs, rec.CreatedAt,
	)
	return err
}

// ListByTicket 返回指定工单的转移记录，并通过父工单 tenant 做 ADR-011 多租户过滤。
func (r *TransferRepository) ListByTicket(ctx context.Context, ticketID string) ([]models.TransferRecord, error) {
	var records []models.TransferRecord
	query := `SELECT tr.` + transferColumns + ` FROM ticket_transfers tr
		 JOIN tickets t ON tr.ticket_id = t.id
		 WHERE tr.ticket_id = $1
		   AND (tr.tenant_id = t.tenant_id OR tr.tenant_id IS NULL)
		 ORDER BY tr.created_at DESC`
	err := r.db.SelectContext(ctx, &records, query, ticketID)
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
