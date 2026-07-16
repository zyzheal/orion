package repository

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"

	"orion/governance-svc-go/internal/audit/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides database access for audit log operations.
// All methods accept context.Context as the first parameter and use
// r.db.QueryContext / r.db.ExecContext / r.db.GetContext / r.db.SelectContext.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new audit log entry with SHA256 hash chain integrity.
// The hash is computed as SHA256(json(payload) + prevHash), matching the
// Node.js AuditRepository.create() logic.
func (r *Repository) Create(ctx context.Context, a *models.AuditLog) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO audit_logs
			(id, tenant_id, user_id, action, resource_type, resource_id,
			 request_method, request_path, request_body,
			 response_code, response_body,
			 ip_address, user_agent, prev_hash, hash)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
		a.ID, a.TenantID, nullStr(a.ActorID), a.Action, a.ResourceType,
		a.ResourceID, a.RequestMethod, a.RequestPath, a.RequestBody,
		a.ResponseCode, a.ResponseBody,
		a.IPAddress, a.UserAgent, a.PrevHash, a.Hash,
	)
	return err
}

// FindByID retrieves a single audit log entry by its primary key.
func (r *Repository) FindByID(ctx context.Context, id string) (*models.AuditLog, error) {
	var log models.AuditLog
	err := r.db.GetContext(ctx, &log,
		`SELECT id, tenant_id, user_id, action, resource_type, resource_id,
		        request_method, request_path, request_body,
		        response_code, response_body,
		        ip_address, user_agent, prev_hash, hash, created_at
		 FROM audit_logs WHERE id = $1`, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &log, nil
}

// FindAll retrieves audit logs with optional filters and pagination.
// Supports filtering by tenant_id, user_id, action, resource_type, resource_id.
func (r *Repository) FindAll(ctx context.Context, f models.ListAuditLogFilters) ([]models.AuditLog, error) {
	query := `SELECT id, tenant_id, user_id, action, resource_type, resource_id,
	                 request_method, request_path, request_body,
	                 response_code, response_body,
	                 ip_address, user_agent, prev_hash, hash, created_at
	          FROM audit_logs`
	args := []interface{}{}
	conds := []string{}

	if f.TenantID != "" {
		args = append(args, f.TenantID)
		conds = append(conds, fmt.Sprintf("tenant_id = $%d", len(args)))
	}
	if f.UserID != "" {
		args = append(args, f.UserID)
		conds = append(conds, fmt.Sprintf("user_id = $%d", len(args)))
	}
	if f.Action != "" {
		args = append(args, f.Action)
		conds = append(conds, fmt.Sprintf("action = $%d", len(args)))
	}
	if f.ResourceType != "" {
		args = append(args, f.ResourceType)
		conds = append(conds, fmt.Sprintf("resource_type = $%d", len(args)))
	}
	if f.ResourceID != "" {
		args = append(args, f.ResourceID)
		conds = append(conds, fmt.Sprintf("resource_id = $%d", len(args)))
	}

	if len(conds) > 0 {
		query += " WHERE " + joinAnd(conds)
	}
	query += " ORDER BY created_at DESC"

	if f.Limit > 0 {
		args = append(args, f.Limit)
		query += fmt.Sprintf(" LIMIT $%d", len(args))
	}
	if f.Offset > 0 {
		args = append(args, f.Offset)
		query += fmt.Sprintf(" OFFSET $%d", len(args))
	}

	var items []models.AuditLog
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Count returns the total number of audit logs matching the given filters.
func (r *Repository) Count(ctx context.Context, f models.ListAuditLogFilters) (int, error) {
	query := "SELECT COUNT(*) FROM audit_logs"
	args := []interface{}{}
	conds := []string{}

	if f.TenantID != "" {
		args = append(args, f.TenantID)
		conds = append(conds, fmt.Sprintf("tenant_id = $%d", len(args)))
	}
	if f.UserID != "" {
		args = append(args, f.UserID)
		conds = append(conds, fmt.Sprintf("user_id = $%d", len(args)))
	}
	if f.Action != "" {
		args = append(args, f.Action)
		conds = append(conds, fmt.Sprintf("action = $%d", len(args)))
	}
	if f.ResourceType != "" {
		args = append(args, f.ResourceType)
		conds = append(conds, fmt.Sprintf("resource_type = $%d", len(args)))
	}

	if len(conds) > 0 {
		query += " WHERE " + joinAnd(conds)
	}

	var count int
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

// Delete removes an audit log entry by ID, scoped to a tenant.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM audit_logs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// GetLatestHash retrieves the most recent hash for a given tenant,
// used to build the hash chain (the new entry's prev_hash).
func (r *Repository) GetLatestHash(ctx context.Context, tenantID string) (string, error) {
	var hash string
	err := r.db.GetContext(ctx, &hash,
		`SELECT hash FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
		tenantID)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return hash, err
}

// ComputeHash computes the SHA256 hash of an audit log entry,
// matching the Node.js logic: SHA256(JSON.stringify(payload) + prevHash).
func ComputeHash(a *models.AuditLog) string {
	payload := map[string]interface{}{
		"tenant_id":      a.TenantID,
		"user_id":        a.ActorID,
		"action":         a.Action,
		"resource_type":  a.ResourceType,
		"resource_id":    nullStrVal(a.ResourceID),
		"request_method": nullStrVal(a.RequestMethod),
		"request_path":   nullStrVal(a.RequestPath),
		"request_body":   a.RequestBody,
		"response_code":  nullIntVal(a.ResponseCode),
		"response_body":  a.ResponseBody,
		"ip_address":     nullStrVal(a.IPAddress),
		"user_agent":     nullStrVal(a.UserAgent),
		"timestamp":      a.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	data, _ := json.Marshal(payload)
	prevHash := ""
	if a.PrevHash.Valid {
		prevHash = a.PrevHash.String
	}
	h := sha256.Sum256(append(data, []byte(prevHash)...))
	return fmt.Sprintf("%x", h)
}

// VerifyChain verifies the hash chain integrity for a tenant using cursor-based
// pagination (PAGE_SIZE=5000). It walks the chain from oldest to newest,
// recomputing each entry's hash and checking prev_hash continuity.
// Returns the first break point or (true, totalVerified) if chain is intact.
func (r *Repository) VerifyChain(ctx context.Context, tenantID string) (*models.ChainVerificationResult, error) {
	const pageSize = 5000
	var lastCreatedAt *string
	var lastID *string
	totalVerified := 0

	// Load the first entry to start the chain
	var prev *models.AuditLog

	for {
		var rows []models.AuditLog
		var err error

		if lastCreatedAt == nil {
			// First page
			err = r.db.SelectContext(ctx, &rows,
				`SELECT id, tenant_id, user_id, action, resource_type, resource_id,
				        request_method, request_path, request_body,
				        response_code, response_body,
				        ip_address, user_agent, prev_hash, hash, created_at
				 FROM audit_logs WHERE tenant_id = $1
				 ORDER BY created_at ASC, id ASC LIMIT $2`,
				tenantID, pageSize)
		} else {
			// Subsequent pages using keyset pagination
			err = r.db.SelectContext(ctx, &rows,
				`SELECT id, tenant_id, user_id, action, resource_type, resource_id,
				        request_method, request_path, request_body,
				        response_code, response_body,
				        ip_address, user_agent, prev_hash, hash, created_at
				 FROM audit_logs WHERE tenant_id = $1
				   AND (created_at, id) > ($2, $3)
				 ORDER BY created_at ASC, id ASC LIMIT $4`,
				tenantID, *lastCreatedAt, *lastID, pageSize)
		}
		if err != nil {
			return nil, err
		}
		if len(rows) == 0 {
			break
		}

		for i := range rows {
			entry := &rows[i]

			if prev != nil {
				// Recompute hash for previous entry
				expectedHash := ComputeHash(prev)
				if prev.Hash != expectedHash {
					return &models.ChainVerificationResult{
						Valid:         false,
						BrokenAt:      &prev.CreatedAt,
						TotalVerified: totalVerified,
					}, nil
				}
				// Check chain continuity
				if entry.PrevHash.Valid && entry.PrevHash.String != prev.Hash {
					return &models.ChainVerificationResult{
						Valid:         false,
						BrokenAt:      &entry.CreatedAt,
						TotalVerified: totalVerified,
					}, nil
				}
			}

			prev = entry
			totalVerified++
		}

		// Advance cursor
		ts := rows[len(rows)-1].CreatedAt.Format("2006-01-02T15:04:05.000Z")
		lastCreatedAt = &ts
		id := rows[len(rows)-1].ID
		lastID = &id

		if len(rows) < pageSize {
			break
		}
	}

	return &models.ChainVerificationResult{
		Valid:         true,
		TotalVerified: totalVerified,
	}, nil
}

// Update modifies non-hash-chain fields of an audit log entry.
// Audit log integrity (hash, prev_hash) is preserved — update only touches
// response_code, response_body, ip_address, user_agent, request_body.
func (r *Repository) Update(ctx context.Context, tenantID, id string, req *models.UpdateAuditRequest) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE audit_logs
		 SET response_code = COALESCE($1, response_code),
		     response_body = $2,
		     ip_address = NULLIF($3, ''),
		     user_agent = NULLIF($4, ''),
		     request_body = $5
		  WHERE id = $6 AND tenant_id = $7`,
		nullInt(req.ResponseCode),
		models.JSONB(req.ResponseBody),
		req.IPAddress,
		req.UserAgent,
		models.JSONB(req.RequestBody),
		id, tenantID,
	)
	return err
}

// GetActions returns the distinct action values for a given tenant,
// ordered alphabetically.
func (r *Repository) GetActions(ctx context.Context, tenantID string) ([]string, error) {
	var actions []string
	err := r.db.SelectContext(ctx, &actions,
		`SELECT DISTINCT action FROM audit_logs WHERE tenant_id = $1 ORDER BY action`,
		tenantID)
	return actions, err
}

// GetResourceTypes returns the distinct resource_type values for a given tenant,
// ordered alphabetically.
func (r *Repository) GetResourceTypes(ctx context.Context, tenantID string) ([]string, error) {
	var types []string
	err := r.db.SelectContext(ctx, &types,
		`SELECT DISTINCT resource_type FROM audit_logs WHERE tenant_id = $1 ORDER BY resource_type`,
		tenantID)
	return types, err
}

// --- helpers ---

// nullStr converts an empty string to sql.NullString (NULL in DB),
// and a non-empty string to a valid sql.NullString.
func nullStr(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}

// nullStrVal extracts the string value from sql.NullString.
func nullStrVal(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

// nullIntVal extracts the int32 value from sql.NullInt32.
func nullIntVal(ni sql.NullInt32) interface{} {
	if ni.Valid {
		return ni.Int32
	}
	return nil
}

// nullInt converts an optional *int to sql.NullInt32.
func nullInt(i *int) sql.NullInt32 {
	if i == nil {
		return sql.NullInt32{}
	}
	return sql.NullInt32{Int32: int32(*i), Valid: true}
}

// joinAnd joins condition strings with " AND ".
func joinAnd(conds []string) string {
	result := ""
	for i, c := range conds {
		if i > 0 {
			result += " AND "
		}
		result += c
	}
	return result
}
