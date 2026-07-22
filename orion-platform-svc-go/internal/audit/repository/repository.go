package repository

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/audit/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// computeHash builds the content hash for an audit log row (mirrors TS behaviour).
func computeHash(tenantID, userID, action, resourceType, resourceID string, details string, ts time.Time) string {
	s := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s", tenantID, userID, action, resourceType, resourceID, details, ts.Format(time.RFC3339))
	b := sha256.Sum256([]byte(s))
	return hex.EncodeToString(b[:])
}

// Create inserts a new audit log row and returns the filled model.
func (r *Repository) Create(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLog, error) {
	now := time.Now().UTC()
	details := "{}"
	if req.Details != nil {
		// Keep as JSON-ish string for hash; caller can serialize first if needed
		details = fmt.Sprintf("%v", req.Details)
	}
	rb := "{}"
	if req.RequestBody != nil {
		rb = fmt.Sprintf("%v", req.RequestBody)
	}
	respBody := "{}"
	if req.ResponseBody != nil {
		respBody = fmt.Sprintf("%v", req.ResponseBody)
	}
	hash := computeHash(tenantID, req.UserID, req.Action, req.ResourceType, req.ResourceID, details, now)

	m := &models.AuditLog{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		UserID:        req.UserID,
		Action:        req.Action,
		ResourceType:  req.ResourceType,
		ResourceID:    req.ResourceID,
		RequestMethod: req.RequestMethod,
		RequestPath:   req.RequestPath,
		RequestBody:   rb,
		ResponseCode:  req.ResponseCode,
		ResponseBody:  respBody,
		IPAddress:     req.IPAddress,
		UserAgent:     req.UserAgent,
		Hash:          hash,
		CreatedAt:     now,
	}

	query := `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id,
		request_method, request_path, request_body, response_code, response_body,
		ip_address, user_agent, prev_hash, hash, created_at)
		VALUES (:id, :tenant_id, :user_id, :action, :resource_type, :resource_id,
		:request_method, :request_path, :request_body, :response_code, :response_body,
		:ip_address, :user_agent, :prev_hash, :hash, :created_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return m, err
}

// GetByID retrieves a single audit log.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.AuditLog, error) {
	var m models.AuditLog
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM audit_logs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// List returns paginated audit logs filtered by the given criteria.
func (r *Repository) List(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, int, error) {
	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := (q.Page - 1) * limit
	if q.Page <= 0 {
		q.Page = 1
		offset = 0
	}

	cond := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}

	if q.UserID != "" {
		cond += fmt.Sprintf(" AND user_id=$%d", len(args)+1)
		args = append(args, q.UserID)
	}
	if q.Action != "" {
		cond += fmt.Sprintf(" AND action=$%d", len(args)+1)
		args = append(args, q.Action)
	}
	if q.ResourceType != "" {
		cond += fmt.Sprintf(" AND resource_type=$%d", len(args)+1)
		args = append(args, q.ResourceType)
	}

	// Count query
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	var total int
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM audit_logs %s", cond)
	err := r.db.GetContext(ctx, &total, countSQL, countArgs...)
	if err != nil {
		return nil, 0, err
	}

	// Data query
	dataSQL := fmt.Sprintf("SELECT * FROM audit_logs %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		cond, len(args)+1, len(args)+2)
	args = append(args, limit, offset)

	var items []models.AuditLog
	err = r.db.SelectContext(ctx, &items, dataSQL, args...)
	return items, total, err
}

// Count returns the number of audit logs for a tenant (optionally filtered).
func (r *Repository) Count(ctx context.Context, tenantID string, q models.AuditLogQuery) (int, error) {
	cond := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	if q.UserID != "" {
		cond += " AND user_id=$2"
		args = append(args, q.UserID)
	}
	if q.Action != "" {
		cond += " AND action=$3"
		args = append(args, q.Action)
	}
	if q.ResourceType != "" {
		cond += " AND resource_type=$4"
		args = append(args, q.ResourceType)
	}
	if q.ResourceID != "" {
		cond += " AND resource_id=$5"
		args = append(args, q.ResourceID)
	}
	if q.DateFrom != "" {
		cond += " AND created_at >= $6"
		args = append(args, q.DateFrom)
	}
	if q.DateTo != "" {
		cond += " AND created_at <= $7"
		args = append(args, q.DateTo)
	}

	var total int
	err := r.db.GetContext(ctx, &total, fmt.Sprintf("SELECT COUNT(*) FROM audit_logs %s", cond), args...)
	return total, err
}

// Export retrieves audit logs for export (no pagination cap — up to 10k).
func (r *Repository) Export(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error) {
	cond := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	if q.UserID != "" {
		cond += " AND user_id=$2"
		args = append(args, q.UserID)
	}
	if q.Action != "" {
		cond += " AND action=$3"
		args = append(args, q.Action)
	}
	if q.ResourceType != "" {
		cond += " AND resource_type=$4"
		args = append(args, q.ResourceType)
	}
	if q.ResourceID != "" {
		cond += " AND resource_id=$5"
		args = append(args, q.ResourceID)
	}
	if q.DateFrom != "" {
		cond += " AND created_at >= $6"
		args = append(args, q.DateFrom)
	}
	if q.DateTo != "" {
		cond += " AND created_at <= $7"
		args = append(args, q.DateTo)
	}

	sql := fmt.Sprintf("SELECT * FROM audit_logs %s ORDER BY created_at DESC LIMIT 10000", cond)
	var items []models.AuditLog
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

// GetActions returns distinct action types for a tenant.
// Tenant filter is always enforced; empty tenantID returns no results.
func (r *Repository) GetActions(ctx context.Context, tenantID string) ([]string, error) {
	var actions []string
	return actions, r.db.SelectContext(ctx, &actions,
		`SELECT DISTINCT action FROM audit_logs WHERE tenant_id=$1 ORDER BY action`, tenantID)
}

// GetResourceTypes returns distinct resource types for a tenant.
// Tenant filter is always enforced; empty tenantID returns no results.
func (r *Repository) GetResourceTypes(ctx context.Context, tenantID string) ([]string, error) {
	var resourceTypes []string
	return resourceTypes, r.db.SelectContext(ctx, &resourceTypes,
		`SELECT DISTINCT resource_type FROM audit_logs WHERE tenant_id=$1 ORDER BY resource_type`, tenantID)
}

// GetLatest returns the most recent audit log for a tenant.
// Tenant filter is always enforced; empty tenantID returns not found.
func (r *Repository) GetLatest(ctx context.Context, tenantID string) (*models.AuditLog, error) {
	var m models.AuditLog
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1`, tenantID)
	return &m, err
}

// VerifyChain checks hash continuity for a tenant. Returns total verified and first break.
// Tenant filter is always enforced; empty tenantID returns empty results.
func (r *Repository) VerifyChain(ctx context.Context, tenantID string) (int, bool, error) {
	var logs []models.AuditLog
	err := r.db.SelectContext(ctx, &logs,
		`SELECT id, hash, prev_hash, created_at FROM audit_logs WHERE tenant_id=$1 ORDER BY created_at ASC`,
		tenantID)
	if err != nil {
		return 0, false, err
	}
	if len(logs) == 0 {
		return 0, true, nil
	}
	prev := ""
	verified := 0
	for _, l := range logs {
		if l.PrevHash != prev && verified > 0 {
			return verified, false, nil
		}
		prev = l.Hash
		verified++
	}
	return verified, true, nil
}

// CoverageStats returns basic coverage counts.
func (r *Repository) CoverageStats(ctx context.Context, tenantID string) (models.AuditCoverageStats, error) {
	// Placeholder: implement full coverage logic if needed
	return models.AuditCoverageStats{}, nil
}

// FormatCSV serializes audit logs to CSV string.
func FormatCSV(logs []models.AuditLog) string {
	var sb strings.Builder
	sb.WriteString("id,tenant_id,user_id,action,resource_type,resource_id,request_method,request_path,response_code,ip_address,user_agent,hash,created_at\n")
	for _, l := range logs {
		sb.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s,%s,%s,%s,%d,%s,%s,%s,%s\n",
			l.ID, l.TenantID, l.UserID, l.Action, l.ResourceType, l.ResourceID,
			l.RequestMethod, l.RequestPath, l.ResponseCode, l.IPAddress, l.UserAgent, l.Hash, l.CreatedAt.Format(time.RFC3339)))
	}
	return sb.String()
}
