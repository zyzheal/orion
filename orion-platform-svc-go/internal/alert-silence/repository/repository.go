package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/alert-silence/models"
	"go.uber.org/zap"
)

type AlertSilenceRepository struct {
	db     *DB
	logger *zap.Logger
}

func NewAlertSilenceRepository(db *DB, logger *zap.Logger) *AlertSilenceRepository {
	return &AlertSilenceRepository{db: db, logger: logger}
}

// Create creates a new silence record.
func (r *AlertSilenceRepository) Create(ctx context.Context, tenantID uuid.UUID, alertID *uuid.UUID, matcher string, duration int, reason, createdBy string) (*models.Silence, error) {
	now := time.Now()
	expiresAt := now.Add(time.Duration(duration) * time.Second)
	id := uuid.New()

	query := `INSERT INTO alert_silences (id, tenant_id, alert_id, matcher, duration, reason, created_by, expires_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`
	args := []any{id, tenantID, nullUUID(alertID), matcher, duration, reason, createdBy, expiresAt, now, now}

	if _, err := r.db.Pool().Exec(ctx, query, args...); err != nil {
		r.logger.Error("failed to create alert silence", zap.Error(err))
		return nil, fmt.Errorf("create silence: %w", err)
	}

	silence := &models.Silence{
		ID:        id,
		TenantID:  tenantID,
		AlertID:   alertID,
		Matcher:   matcher,
		Duration:  duration,
		Reason:    reason,
		CreatedBy: createdBy,
		ExpiresAt: expiresAt,
		CreatedAt: now,
		UpdatedAt: now,
	}

	r.logger.Info("alert silence created",
		zap.String("silenceId", id.String()),
		zap.String("tenantId", tenantID.String()),
		zap.Int("duration", duration),
	)
	return silence, nil
}

// Query returns paginated silences for a tenant.
func (r *AlertSilenceRepository) Query(ctx context.Context, tenantID uuid.UUID, status string, limit, offset int) (models.SilenceResponse, error) {
	var resp models.SilenceResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	where := []string{"tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2

	if status != "" {
		if status == "active" {
			where = append(where, fmt.Sprintf("expires_at > NOW()"))
		} else if status == "expired" {
			where = append(where, fmt.Sprintf("expires_at <= NOW()"))
		}
	}

	whereClause := "WHERE " + joinStrings(where, " AND ")
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM alert_silences %s`, whereClause)
	query := fmt.Sprintf(`
		SELECT id, tenant_id, alert_id, matcher, duration, reason, created_by, expires_at, created_at, updated_at
		FROM alert_silences %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	if err := r.db.Pool().QueryRow(ctx, countQuery, args[:len(args)-2]...).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count silences: %w", err)
	}

	rows, err := r.db.Pool().Query(ctx, query, args...)
	if err != nil {
		return resp, fmt.Errorf("query silences: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var s models.Silence
		var alertID sql.NullString
		if err := rows.Scan(&s.ID, &s.TenantID, &alertID, &s.Matcher, &s.Duration, &s.Reason, &s.CreatedBy, &s.ExpiresAt, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return resp, fmt.Errorf("scan silence: %w", err)
		}
		if alertID.Valid {
			if u, err := uuid.Parse(alertID.String); err == nil {
				s.AlertID = &u
			}
		}
		resp.Data = append(resp.Data, s)
	}
	return resp, nil
}

// GetByID returns a single silence by ID.
func (r *AlertSilenceRepository) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*models.Silence, error) {
	var s models.Silence
	var alertID sql.NullString

	query := `SELECT id, tenant_id, alert_id, matcher, duration, reason, created_by, expires_at, created_at, updated_at FROM alert_silences WHERE id = $1 AND tenant_id = $2`
	if err := r.db.Pool().QueryRow(ctx, query, id, tenantID).Scan(
		&s.ID, &s.TenantID, &alertID, &s.Matcher, &s.Duration, &s.Reason, &s.CreatedBy, &s.ExpiresAt, &s.CreatedAt, &s.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("silence not found: %s", id)
		}
		return nil, fmt.Errorf("get silence: %w", err)
	}

	if alertID.Valid {
		if u, err := uuid.Parse(alertID.String); err == nil {
			s.AlertID = &u
		}
	}
	return &s, nil
}

// Delete removes a silence by ID.
func (r *AlertSilenceRepository) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	result, err := r.db.Pool().Exec(ctx, `DELETE FROM alert_silences WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete silence: %w", err)
	}
	rows := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("silence not found: %s", id)
	}
	return nil
}

// IsActive checks if an alert is currently silenced.
func (r *AlertSilenceRepository) IsActive(ctx context.Context, tenantID, alertID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Pool().QueryRow(ctx,
		`SELECT COUNT(*) FROM alert_silences WHERE alert_id = $1 AND tenant_id = $2 AND expires_at > NOW()`,
		alertID, tenantID).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check silence: %w", err)
	}
	return count > 0, nil
}

func nullUUID(u *uuid.UUID) interface{} {
	if u == nil {
		return nil
	}
	return *u
}

func joinStrings(items []string, sep string) string {
	result := ""
	for i, item := range items {
		if i > 0 {
			result += sep
		}
		result += item
	}
	return result
}

// Pool returns the underlying PostgreSQL connection pool.
func (r *AlertSilenceRepository) Pool() *pgxpool.Pool {
	return r.db.Pool
}
