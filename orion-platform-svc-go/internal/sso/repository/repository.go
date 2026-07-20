package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"time"

	"orion/platform-svc-go/internal/sso/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateProvider(ctx context.Context, p *models.SSOProvider) error {
	p.ID = uuid.New().String()
	now := time.Now().UTC()
	p.CreatedAt = now
	p.UpdatedAt = now
	if p.Status == "" {
		p.Status = "active"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO sso_config (id, tenant_id, name, provider_type, config, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :provider_type, :config, :status, :created_at, :updated_at)`,
		p)
	return err
}

func (r *Repository) GetProvider(ctx context.Context, tenantID, id string) (*models.SSOProvider, error) {
	var p models.SSOProvider
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM sso_config WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListProviders(ctx context.Context, tenantID string, q models.ListProvidersQuery) ([]models.SSOProvider, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	var sql string
	var args []interface{}
	if q.Status != "" {
		sql = `SELECT * FROM sso_config WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
		args = []interface{}{tenantID, q.Status, q.Limit, q.Offset}
	} else {
		sql = `SELECT * FROM sso_config WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
		args = []interface{}{tenantID, q.Limit, q.Offset}
	}
	var items []models.SSOProvider
	err := r.db.SelectContext(ctx, &items, sql, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CountProviders(ctx context.Context, tenantID string, q models.ListProvidersQuery) (int, error) {
	var sql string
	var args []interface{}
	if q.Status != "" {
		sql = `SELECT COUNT(*) FROM sso_config WHERE tenant_id=$1 AND status=$2`
		args = []interface{}{tenantID, q.Status}
	} else {
		sql = `SELECT COUNT(*) FROM sso_config WHERE tenant_id=$1`
		args = []interface{}{tenantID}
	}
	var count int
	err := r.db.GetContext(ctx, &count, sql, args...)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (r *Repository) UpdateProvider(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = time.Now().UTC()
	fields := make([]string, 0, len(updates))
	for k := range updates {
		fields = append(fields, fmt.Sprintf("%s = :%s", k, k))
	}
	sort.Strings(fields)
	args := map[string]interface{}{
		"id":        id,
		"tenant_id": tenantID,
	}
	for k, v := range updates {
		args[k] = v
	}
	sql := fmt.Sprintf(`UPDATE sso_config SET %s WHERE id=$1 AND tenant_id=$2`, joinStrings(fields, ", "))
	_, err := r.db.NamedExecContext(ctx, sql, args)
	return err
}

func (r *Repository) DeleteProvider(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE sso_config SET status='disabled' WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CreateSession(ctx context.Context, s *models.SSOSession) error {
	s.ID = uuid.New().String()
	s.State = uuid.New().String()
	now := time.Now().UTC()
	s.CreatedAt = now
	if s.ExpiresAt.IsZero() {
		s.ExpiresAt = now.Add(30 * time.Minute)
	}
	if s.Status == "" {
		s.Status = "pending"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO sso_session (id, tenant_id, provider_id, state, redirect_url, user_id, status, expires_at, created_at)
		 VALUES (:id, :tenant_id, :provider_id, :state, :redirect_url, :user_id, :status, :expires_at, :created_at)`,
		s)
	return err
}

func (r *Repository) GetSession(ctx context.Context, tenantID, id string) (*models.SSOSession, error) {
	var s models.SSOSession
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM sso_session WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &s, nil
}

func (r *Repository) GetSessionByState(ctx context.Context, tenantID, state string) (*models.SSOSession, error) {
	var s models.SSOSession
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM sso_session WHERE state=$1 AND tenant_id=$2`, state, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &s, nil
}

func (r *Repository) UpdateSession(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	args := map[string]interface{}{
		"id":        id,
		"tenant_id": tenantID,
	}
	for k, v := range updates {
		args[k] = v
	}
	fields := make([]string, 0, len(updates))
	for k := range updates {
		fields = append(fields, fmt.Sprintf("%s = :%s", k, k))
	}
	sort.Strings(fields)
	sql := fmt.Sprintf(`UPDATE sso_session SET %s WHERE id=$1 AND tenant_id=$2`, joinStrings(fields, ", "))
	_, err := r.db.NamedExecContext(ctx, sql, args)
	return err
}

func (r *Repository) ListSessions(ctx context.Context, tenantID string, status string, limit int) ([]models.SSOSession, error) {
	if limit <= 0 {
		limit = 50
	}
	var sql string
	var args []interface{}
	if status != "" {
		sql = `SELECT * FROM sso_session WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3`
		args = []interface{}{tenantID, status, limit}
	} else {
		sql = `SELECT * FROM sso_session WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2`
		args = []interface{}{tenantID, limit}
	}
	var items []models.SSOSession
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

func joinStrings(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	result := parts[0]
	for _, p := range parts[1:] {
		result += sep + p
	}
	return result
}
