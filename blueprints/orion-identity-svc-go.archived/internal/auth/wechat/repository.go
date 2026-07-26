package wechat

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"orion/go-common/pkg/database"
)

// WechatRepository handles persistence for WeChat Work accounts and departments.
type WechatRepository struct {
	db *database.DB
}

// NewWechatRepository creates a new WechatRepository.
func NewWechatRepository(db *database.DB) *WechatRepository {
	return &WechatRepository{db: db}
}

// --- Account operations ---

// CreateAccount inserts or updates a WeChat Work account.
func (r *WechatRepository) CreateAccount(ctx context.Context, acct *WeChatWorkAccount) error {
	deptIDs := arrayToText(acct.DepartmentIDs)
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO wechat_work_accounts (id, tenant_id, user_id, wechat_userid, wechat_openid, name, email, mobile,
			department_ids, position, avatar, linked, last_synced_at, created_at, updated_at)
		VALUES (:id, :tenant_id, :user_id, :wechat_userid, :wechat_openid, :name, :email, :mobile,
			:department_ids, :position, :avatar, :linked, :last_synced_at, :created_at, :updated_at)
		ON CONFLICT (wechat_userid) DO UPDATE SET
			name = EXCLUDED.name,
			email = EXCLUDED.email,
			mobile = EXCLUDED.mobile,
			department_ids = EXCLUDED.department_ids,
			position = EXCLUDED.position,
			avatar = EXCLUDED.avatar,
			linked = EXCLUDED.linked,
			last_synced_at = EXCLUDED.last_synced_at,
			updated_at = EXCLUDED.updated_at
	`, struct {
		ID             string         `db:"id"`
		TenantID       string         `db:"tenant_id"`
		UserID         string         `db:"user_id"`
		WechatUserID   string         `db:"wechat_userid"`
		WechatOpenID   sql.NullString `db:"wechat_openid"`
		Name           sql.NullString `db:"name"`
		Email          sql.NullString `db:"email"`
		Mobile         sql.NullString `db:"mobile"`
		DepartmentIDs  sql.NullString `db:"department_ids"`
		Position       sql.NullString `db:"position"`
		Avatar         sql.NullString `db:"avatar"`
		Linked         bool           `db:"linked"`
		LastSyncedAt   sql.NullTime   `db:"last_synced_at"`
		CreatedAt      time.Time      `db:"created_at"`
		UpdatedAt      time.Time      `db:"updated_at"`
	}{
		ID:             acct.ID,
		TenantID:       acct.TenantID,
		UserID:         acct.UserID,
		WechatUserID:   acct.WechatUserID,
		WechatOpenID:   acct.WechatOpenID,
		Name:           acct.Name,
		Email:          acct.Email,
		Mobile:         acct.Mobile,
		DepartmentIDs:  sql.NullString{String: deptIDs, Valid: true},
		Position:       acct.Position,
		Avatar:         acct.Avatar,
		Linked:         acct.Linked,
		LastSyncedAt:   sql.NullTime{Time: *acct.LastSyncedAt, Valid: acct.LastSyncedAt != nil},
		CreatedAt:      acct.CreatedAt,
		UpdatedAt:      acct.UpdatedAt,
	})
	return err
}

// GetAccountByWechatID retrieves an account by its WeChat Work user ID.
func (r *WechatRepository) GetAccountByWechatID(ctx context.Context, wechatUserID string) (*WeChatWorkAccount, error) {
	var a WeChatWorkAccount
	err := r.db.GetContext(ctx, &a, "SELECT * FROM wechat_work_accounts WHERE wechat_userid = $1", wechatUserID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &a, err
}

// GetAccountByUserID retrieves an account by the linked Orion user ID.
func (r *WechatRepository) GetAccountByUserID(ctx context.Context, tenantID, userID string) (*WeChatWorkAccount, error) {
	var a WeChatWorkAccount
	err := r.db.GetContext(ctx, &a, "SELECT * FROM wechat_work_accounts WHERE tenant_id = $1 AND user_id = $2", tenantID, userID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &a, err
}

// ListAccounts returns all accounts for a tenant.
func (r *WechatRepository) ListAccounts(ctx context.Context, tenantID string) ([]WeChatWorkAccount, error) {
	var accounts []WeChatWorkAccount
	err := r.db.SelectContext(ctx, &accounts, "SELECT * FROM wechat_work_accounts WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	return accounts, err
}

// LinkAccount marks an account as linked to a local user.
func (r *WechatRepository) LinkAccount(ctx context.Context, wechatUserID, userID string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE wechat_work_accounts SET user_id = $1, linked = true, updated_at = now() WHERE wechat_userid = $2",
		userID, wechatUserID)
	return err
}

// --- Department operations ---

// UpsertDepartment inserts or updates a department mapping.
func (r *WechatRepository) UpsertDepartment(ctx context.Context, dept *WeChatWorkDepartment) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO wechat_work_departments (id, tenant_id, wechat_dept_id, wechat_dept_name, wechat_parent_id,
			orion_group_id, orion_group_name, enabled, last_synced_at, created_at, updated_at)
		VALUES (:id, :tenant_id, :wechat_dept_id, :wechat_dept_name, :wechat_parent_id,
			:orion_group_id, :orion_group_name, :enabled, :last_synced_at, :created_at, :updated_at)
		ON CONFLICT (wechat_dept_id) DO UPDATE SET
			wechat_dept_name = EXCLUDED.wechat_dept_name,
			wechat_parent_id = EXCLUDED.wechat_parent_id,
			enabled = EXCLUDED.enabled,
			last_synced_at = EXCLUDED.last_synced_at,
			updated_at = EXCLUDED.updated_at
	`, struct {
		ID              string         `db:"id"`
		TenantID        string         `db:"tenant_id"`
		WechatDeptID    int64          `db:"wechat_dept_id"`
		WechatDeptName  sql.NullString `db:"wechat_dept_name"`
		WechatParentID  int64          `db:"wechat_parent_id"`
		OrionGroupID    sql.NullString `db:"orion_group_id"`
		OrionGroupName  sql.NullString `db:"orion_group_name"`
		Enabled         bool           `db:"enabled"`
		LastSyncedAt    sql.NullTime   `db:"last_synced_at"`
		CreatedAt       time.Time      `db:"created_at"`
		UpdatedAt       time.Time      `db:"updated_at"`
	}{
		ID:             dept.ID,
		TenantID:       dept.TenantID,
		WechatDeptID:   dept.WechatDeptID,
		WechatDeptName: dept.WechatDeptName,
		WechatParentID: dept.WechatParentID,
		OrionGroupID:   dept.OrionGroupID,
		OrionGroupName: dept.OrionGroupName,
		Enabled:        dept.Enabled,
		LastSyncedAt:   sql.NullTime{Time: *dept.LastSyncedAt, Valid: dept.LastSyncedAt != nil},
		CreatedAt:      dept.CreatedAt,
		UpdatedAt:      dept.UpdatedAt,
	})
	return err
}

// GetDepartment retrieves a department by WeChat Work ID.
func (r *WechatRepository) GetDepartment(ctx context.Context, wechatDeptID int64) (*WeChatWorkDepartment, error) {
	var d WeChatWorkDepartment
	err := r.db.GetContext(ctx, &d, "SELECT * FROM wechat_work_departments WHERE wechat_dept_id = $1", wechatDeptID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &d, err
}

// ListDepartments returns all department mappings for a tenant.
func (r *WechatRepository) ListDepartments(ctx context.Context, tenantID string) ([]WeChatWorkDepartment, error) {
	var depts []WeChatWorkDepartment
	err := r.db.SelectContext(ctx, &depts, "SELECT * FROM wechat_work_departments WHERE tenant_id = $1 ORDER BY wechat_parent_id, wechat_dept_id", tenantID)
	return depts, err
}

// Helper: convert int64 slice to PostgreSQL array text.
func arrayToText(ids []int64) string {
	if len(ids) == 0 {
		return ""
	}
	parts := make([]string, len(ids))
	for i, id := range ids {
		parts[i] = fmt.Sprintf("%d", id)
	}
	return "{" + strings.Join(parts, ",") + "}"
}
