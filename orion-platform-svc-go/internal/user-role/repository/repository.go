package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/user-role/models"
)

// ErrNotFound 供 service 层检测 404。
var ErrNotFound = errors.New("user_role not found")

// Repository 提供 user_role 表的 PostgreSQL 持久化访问。
type Repository struct {
	db *sqlx.DB
}

// NewRepository 创建新的 Repository 实例。
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create 插入一条 user_role 记录。
func (r *Repository) Create(ctx context.Context, ur *models.UserRole) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO user_role (
			id, tenant_id, user_id, role, source, granted_by, granted_at,
			expires_at, revoked_at, status, reason, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		ur.ID, ur.TenantID, ur.UserID, ur.Role, ur.Source,
		ur.GrantedBy, ur.GrantedAt, ur.ExpiresAt, ur.RevokedAt,
		ur.Status, ur.Reason, ur.CreatedAt, ur.UpdatedAt,
	)
	return err
}

// GetByID 根据 id + tenant_id 获取单条 user_role。
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.UserRole, error) {
	var ur models.UserRole
	err := r.db.GetContext(ctx, &ur,
		`SELECT * FROM user_role WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &ur, nil
}

// List 分页查询 user_role。
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.UserRole, int, error) {
	query := "SELECT * FROM user_role WHERE tenant_id=$1"
	countQuery := "SELECT COUNT(*) FROM user_role WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	countArgs := []interface{}{tenantID}
	idx := 2

	if filter != nil {
		if filter.UserID != nil {
			query += fmt.Sprintf(" AND user_id=$%d", idx)
			args = append(args, *filter.UserID)
			idx++
			countQuery += fmt.Sprintf(" AND user_id=$%d", len(countArgs)+1)
			countArgs = append(countArgs, *filter.UserID)
		}
		if filter.Role != nil {
			query += fmt.Sprintf(" AND role=$%d", idx)
			args = append(args, *filter.Role)
			idx++
			countQuery += fmt.Sprintf(" AND role=$%d", len(countArgs)+1)
			countArgs = append(countArgs, *filter.Role)
		}
		if filter.Status != nil {
			query += fmt.Sprintf(" AND status=$%d", idx)
			args = append(args, *filter.Status)
			idx++
			countQuery += fmt.Sprintf(" AND status=$%d", len(countArgs)+1)
			countArgs = append(countArgs, *filter.Status)
		}
	}

	query += " ORDER BY created_at DESC LIMIT $L OFFSET $O"
	args = append(args, limit, offset)

	var items []models.UserRole
	if err := r.db.SelectContext(ctx, &items, query, args...); err != nil {
		return nil, 0, err
	}

	var total int
	if err := r.db.GetContext(ctx, &total, countQuery, countArgs...); err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

// Update 部分更新 user_role（expires_at / reason / status）。
func (r *Repository) Update(ctx context.Context, tenantID, id string, req *models.PatchRequest) error {
	if req.ExpiresAt != nil {
		if _, err := r.db.ExecContext(ctx,
			`UPDATE user_role SET expires_at=$1, updated_at=now() WHERE id=$2 AND tenant_id=$3`,
			*req.ExpiresAt, id, tenantID); err != nil {
			return err
		}
	}
	if req.Reason != nil {
		if _, err := r.db.ExecContext(ctx,
			`UPDATE user_role SET reason=$1, updated_at=now() WHERE id=$2 AND tenant_id=$3`,
			*req.Reason, id, tenantID); err != nil {
			return err
		}
	}
	if req.Status != nil {
		var rev *time.Time
		if *req.Status == models.StatusRevoked {
			now := time.Now()
			rev = &now
		}
		if _, err := r.db.ExecContext(ctx,
			`UPDATE user_role SET status=$1, revoked_at=$2, updated_at=now() WHERE id=$3 AND tenant_id=$4`,
			*req.Status, rev, id, tenantID); err != nil {
			return err
		}
	}
	return nil
}

// Delete 软删（status='revoked'）。
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE user_role SET status='revoked', revoked_at=now(), updated_at=now()
		 WHERE id=$1 AND tenant_id=$2 AND status='active'`,
		id, tenantID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// RolesForUser 获取某用户的所有 active 角色。
func (r *Repository) RolesForUser(ctx context.Context, tenantID, userID string) ([]string, error) {
	var roles []string
	err := r.db.SelectContext(ctx, &roles,
		`SELECT role FROM user_role
		 WHERE tenant_id=$1 AND user_id=$2
		   AND status='active'
		   AND (expires_at IS NULL OR expires_at > now())`,
		tenantID, userID)
	if err != nil {
		return nil, err
	}
	return roles, nil
}

// UsersWithRole 获取某租户下拥有指定角色的所有 active 用户 ID。
func (r *Repository) UsersWithRole(ctx context.Context, tenantID, role string) ([]string, error) {
	var ids []string
	err := r.db.SelectContext(ctx, &ids,
		`SELECT user_id FROM user_role
		 WHERE tenant_id=$1 AND role=$2
		   AND status='active'
		   AND (expires_at IS NULL OR expires_at > now())`,
		tenantID, role)
	if err != nil {
		return nil, err
	}
	return ids, nil
}
