package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/project-member/models"
)

var ErrNotFound = errors.New("project member not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
	CREATE TABLE IF NOT EXISTS project_members (
		id UUID PRIMARY KEY,
		tenant_id UUID NOT NULL,
		project_id UUID NOT NULL,
		user_id VARCHAR(255) NOT NULL,
		role VARCHAR(32) NOT NULL DEFAULT 'viewer',
		permissions JSONB DEFAULT '[]',
		status VARCHAR(32) NOT NULL DEFAULT 'active',
		invited_by VARCHAR(255) DEFAULT '',
		invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		joined_at TIMESTAMP WITH TIME ZONE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		UNIQUE(tenant_id, project_id, user_id)
	);
	CREATE INDEX IF NOT EXISTS idx_project_members_tenant ON project_members(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(tenant_id, project_id);
	CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(tenant_id, user_id);
	`)
	return err
}

func (r *Repository) Create(ctx context.Context, tenantID string, m *models.ProjectMember) (*models.ProjectMember, error) {
	m.ID = uuid.New().String()
	m.TenantID = tenantID
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = m.CreatedAt
	m.InvitedAt = m.CreatedAt
	if m.Status == "" { m.Status = "active" }
	if m.Role == "" { m.Role = "viewer" }
	perms, _ := json.Marshal(m.Permissions)
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO project_members (id, tenant_id, project_id, user_id, role, permissions, status, invited_by, invited_at, joined_at, created_at, updated_at)
		VALUES (:id, :tenant_id, :project_id, :user_id, :role, :permissions, :status, :invited_by, :invited_at, :joined_at, :created_at, :updated_at)
		ON CONFLICT (tenant_id, project_id, user_id) DO NOTHING`, map[string]interface{}{
		"id": m.ID, "tenant_id": m.TenantID, "project_id": m.ProjectID, "user_id": m.UserID,
		"role": m.Role, "permissions": string(perms), "status": m.Status,
		"invited_by": m.InvitedBy, "invited_at": m.InvitedAt, "joined_at": m.JoinedAt,
		"created_at": m.CreatedAt, "updated_at": m.UpdatedAt,
	})
	if err != nil { return nil, err }
	return r.GetByID(ctx, tenantID, m.ID)
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ProjectMember, error) {
	var m models.ProjectMember
	err := r.db.GetContext(ctx, &m, `SELECT * FROM project_members WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) { return nil, ErrNotFound }
	return &m, err
}

func (r *Repository) GetByProjectUser(ctx context.Context, tenantID, projectID, userID string) (*models.ProjectMember, error) {
	var m models.ProjectMember
	err := r.db.GetContext(ctx, &m, `SELECT * FROM project_members WHERE tenant_id=$1 AND project_id=$2 AND user_id=$3`, tenantID, projectID, userID)
	if errors.Is(err, sql.ErrNoRows) { return nil, ErrNotFound }
	return &m, err
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListMembersQuery) ([]models.ProjectMember, int, error) {
	cond := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}; idx := 2
	if q.ProjectID != "" { cond += " AND project_id = $" + strconv.Itoa(idx); args = append(args, q.ProjectID); idx++ }
	if q.UserID != "" { cond += " AND user_id = $" + strconv.Itoa(idx); args = append(args, q.UserID); idx++ }
	if q.Role != "" { cond += " AND role = $" + strconv.Itoa(idx); args = append(args, q.Role); idx++ }
	if q.Status != "" { cond += " AND status = $" + strconv.Itoa(idx); args = append(args, q.Status); idx++ }
	limit, offset := 50, 0
	if q.Limit != nil && *q.Limit > 0 { limit = *q.Limit }
	if q.Offset != nil { offset = *q.Offset }
	var total int
	err := r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM project_members "+cond, args...)
	if err != nil { return nil, 0, err }
	var items []models.ProjectMember
	err = r.db.SelectContext(ctx, &items, cond+" ORDER BY created_at DESC LIMIT $"+strconv.Itoa(idx)+" OFFSET $"+strconv.Itoa(idx+1), append(args, limit, offset)...)
	return items, total, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ProjectMember, error) {
	updates["updated_at"] = time.Now().UTC()
	if perms, ok := updates["permissions"].([]string); ok { b, _ := json.Marshal(perms); updates["permissions"] = string(b) }
	_, err := r.db.NamedExecContext(ctx, `UPDATE project_members SET @:updates WHERE id = :id AND tenant_id = :tenant_id`,
		map[string]interface{}{"updates": updates, "id": id, "tenant_id": tenantID})
	if err != nil { return nil, err }
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM project_members WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func (r *Repository) DeleteByProject(ctx context.Context, tenantID, projectID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM project_members WHERE tenant_id = $1 AND project_id = $2`, tenantID, projectID)
	return err
}

func (r *Repository) CountByProject(ctx context.Context, tenantID, projectID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM project_members WHERE tenant_id=$1 AND project_id=$2`, tenantID, projectID)
	return count, err
}

func (r *Repository) GetByProject(ctx context.Context, tenantID, projectID string) ([]models.ProjectMember, error) {
	var items []models.ProjectMember
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM project_members WHERE tenant_id=$1 AND project_id=$2 ORDER BY role, created_at`, tenantID, projectID)
	return items, err
}

func (r *Repository) HasRole(ctx context.Context, tenantID, projectID, userID, role string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM project_members WHERE tenant_id=$1 AND project_id=$2 AND user_id=$3 AND role=$4 AND status='active'`, tenantID, projectID, userID, role)
	return count > 0, err
}
