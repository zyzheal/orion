package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/google/uuid"
	"orion/security-svc-go/internal/ai-security/models"
	"time"
)

type Repository struct {
	db *pgx.Conn
}

func NewRepository(db *pgx.Conn) *Repository {
	return &Repository{db: db}
}

// LogScan records a security scan result.
func (r *Repository) LogScan(ctx context.Context, result *models.ScanResult) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO ai_security_logs (id, tenant_id, user_id, session_id, risk_score,
			sanitized, has_violation, violations, input_length, recommendation, scanned_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, uuid.New().String(), result.TenantID, result.UserID, result.SessionID, result.RiskScore,
		result.Sanitized, result.HasViolation, string(toJSONB(result.Violations)), len(result.Input),
		result.Recommendation, result.ScannedAt)
	return err
}

func toJSONB(v []string) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}

// ListScans lists scan results with optional filters.
func (r *Repository) ListScans(ctx context.Context, tenantID, userID string, startTime, endTime *time.Time, page, pageSize int) ([]models.ScanResult, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 1

	if userID != "" {
		argIdx++
		where += fmt.Sprintf(" AND user_id = $%d", argIdx)
		args = append(args, userID)
	}
	if startTime != nil {
		argIdx++
		where += fmt.Sprintf(" AND scanned_at >= $%d", argIdx)
		args = append(args, *startTime)
	}
	if endTime != nil {
		argIdx++
		where += fmt.Sprintf(" AND scanned_at <= $%d", argIdx)
		args = append(args, *endTime)
	}

	limit := pageSize
	offset := (page - 1) * pageSize

	query := fmt.Sprintf(`
		SELECT id, user_id, session_id, risk_score, sanitized, has_violation,
		       violations, recommendation, scanned_at
		FROM ai_security_logs %s
		ORDER BY scanned_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx+1, argIdx+2)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.ScanResult
	for rows.Next() {
		var r models.ScanResult
		var violationsRaw []byte
		err := rows.Scan(&r.ID, &r.UserID, &r.SessionID, &r.RiskScore,
			&r.Sanitized, &r.HasViolation, &violationsRaw, &r.Recommendation, &r.ScannedAt)
		if err != nil {
			return nil, err
		}
		if len(violationsRaw) > 0 {
			_ = json.Unmarshal(violationsRaw, &r.Violations)
		}
		results = append(results, r)
	}
	return results, nil
}

// GetScanBySessionID gets scan results for a specific session.
func (r *Repository) GetScanBySessionID(ctx context.Context, tenantID, sessionID string) ([]models.ScanResult, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, session_id, risk_score, sanitized, has_violation,
		       violations, recommendation, scanned_at
		FROM ai_security_logs WHERE tenant_id = $1 AND session_id = $2
		ORDER BY scanned_at DESC
	`, tenantID, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.ScanResult
	for rows.Next() {
		var r models.ScanResult
		var violationsRaw []byte
		err := rows.Scan(&r.ID, &r.UserID, &r.SessionID, &r.RiskScore,
			&r.Sanitized, &r.HasViolation, &violationsRaw, &r.Recommendation, &r.ScannedAt)
		if err != nil {
			return nil, err
		}
		if len(violationsRaw) > 0 {
			_ = json.Unmarshal(violationsRaw, &r.Violations)
		}
		results = append(results, r)
	}
	return results, nil
}

// ListAlerts lists security alerts (violations only).
func (r *Repository) ListAlerts(ctx context.Context, tenantID, userID string, startTime, endTime *time.Time, page, pageSize int) ([]models.SecurityAlert, error) {
	where := "WHERE tenant_id = $1 AND has_violation = $2"
	args := []interface{}{tenantID, true}
	argIdx := 2

	if userID != "" {
		argIdx++
		where += fmt.Sprintf(" AND user_id = $%d", argIdx)
		args = append(args, userID)
	}
	if startTime != nil {
		argIdx++
		where += fmt.Sprintf(" AND scanned_at >= $%d", argIdx)
		args = append(args, *startTime)
	}
	if endTime != nil {
		argIdx++
		where += fmt.Sprintf(" AND scanned_at <= $%d", argIdx)
		args = append(args, *endTime)
	}

	limit := pageSize
	offset := (page - 1) * pageSize

	query := fmt.Sprintf(`
		SELECT id, user_id, session_id, risk_score, violations, scanned_at
		FROM ai_security_logs %s
		ORDER BY scanned_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx+1, argIdx+2)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []models.SecurityAlert
	for rows.Next() {
		var a models.SecurityAlert
		var violationsRaw []byte
		err := rows.Scan(&a.ID, &a.UserID, &a.SessionID, &a.RiskScore, &violationsRaw, &a.ScannedAt)
		if err != nil {
			return nil, err
		}
		if len(violationsRaw) > 0 {
			_ = json.Unmarshal(violationsRaw, &a.Violations)
		}
		alerts = append(alerts, a)
	}
	return alerts, nil
}

// GetAlertByID gets a specific alert by ID.
func (r *Repository) GetAlertByID(ctx context.Context, tenantID, id string) (*models.SecurityAlert, error) {
	var a models.SecurityAlert
	var violationsRaw []byte
	err := r.db.QueryRow(ctx, `
		SELECT id, user_id, session_id, risk_score, violations, scanned_at
		FROM ai_security_logs WHERE id = $1 AND tenant_id = $2 AND has_violation = $3
	`, id, tenantID, true).Scan(&a.ID, &a.UserID, &a.SessionID, &a.RiskScore, &violationsRaw, &a.ScannedAt)
	if err == pgx.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}
	if len(violationsRaw) > 0 {
		_ = json.Unmarshal(violationsRaw, &a.Violations)
	}
	return &a, nil
}

// ListAuditLogs lists all audit logs with filters.
func (r *Repository) ListAuditLogs(ctx context.Context, tenantID, userID, action string, startTime, endTime *time.Time) ([]models.ScanResult, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 1

	if userID != "" {
		argIdx++
		where += fmt.Sprintf(" AND user_id = $%d", argIdx)
		args = append(args, userID)
	}
	if startTime != nil {
		argIdx++
		where += fmt.Sprintf(" AND scanned_at >= $%d", argIdx)
		args = append(args, *startTime)
	}
	if endTime != nil {
		argIdx++
		where += fmt.Sprintf(" AND scanned_at <= $%d", argIdx)
		args = append(args, *endTime)
	}

	query := fmt.Sprintf(`
		SELECT id, user_id, session_id, risk_score, sanitized, has_violation,
		       violations, recommendation, scanned_at
		FROM ai_security_logs %s
		ORDER BY scanned_at DESC
		LIMIT 1000
	`, where)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.ScanResult
	for rows.Next() {
		var r models.ScanResult
		var violationsRaw []byte
		err := rows.Scan(&r.ID, &r.UserID, &r.SessionID, &r.RiskScore,
			&r.Sanitized, &r.HasViolation, &violationsRaw, &r.Recommendation, &r.ScannedAt)
		if err != nil {
			return nil, err
		}
		if len(violationsRaw) > 0 {
			_ = json.Unmarshal(violationsRaw, &r.Violations)
		}
		results = append(results, r)
	}
	return results, nil
}

// GetAuditLogsByFilter filters audit logs by session ID.
func (r *Repository) GetAuditLogsByFilter(ctx context.Context, tenantID, userID string, startTime, endTime *time.Time, sessionID string) ([]models.ScanResult, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 1

	if userID != "" {
		argIdx++
		where += fmt.Sprintf(" AND user_id = $%d", argIdx)
		args = append(args, userID)
	}
	if sessionID != "" {
		argIdx++
		where += fmt.Sprintf(" AND session_id = $%d", argIdx)
		args = append(args, sessionID)
	}
	if startTime != nil {
		argIdx++
		where += fmt.Sprintf(" AND scanned_at >= $%d", argIdx)
		args = append(args, *startTime)
	}
	if endTime != nil {
		argIdx++
		where += fmt.Sprintf(" AND scanned_at <= $%d", argIdx)
		args = append(args, *endTime)
	}

	query := fmt.Sprintf(`
		SELECT id, user_id, session_id, risk_score, sanitized, has_violation,
		       violations, recommendation, scanned_at
		FROM ai_security_logs %s
		ORDER BY scanned_at DESC
	`, where)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.ScanResult
	for rows.Next() {
		var r models.ScanResult
		var violationsRaw []byte
		err := rows.Scan(&r.ID, &r.UserID, &r.SessionID, &r.RiskScore,
			&r.Sanitized, &r.HasViolation, &violationsRaw, &r.Recommendation, &r.ScannedAt)
		if err != nil {
			return nil, err
		}
		if len(violationsRaw) > 0 {
			_ = json.Unmarshal(violationsRaw, &r.Violations)
		}
		results = append(results, r)
	}
	return results, nil
}
