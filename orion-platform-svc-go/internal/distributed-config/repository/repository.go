package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/distributed-config/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateNamespace(ctx context.Context, ns *models.ConfigNamespace) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_namespace (id, tenant_id, name, description, status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		ns.ID, ns.TenantID, ns.Name, ns.Description, ns.Status, ns.CreatedAt, ns.UpdatedAt)
	return err
}

func (r *Repository) GetNamespace(ctx context.Context, id, tenantID string) (*models.ConfigNamespace, error) {
	var ns models.ConfigNamespace
	err := r.db.GetContext(ctx, &ns, `SELECT * FROM config_namespace WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &ns, nil
}

func (r *Repository) ListNamespaces(ctx context.Context, tenantID string) ([]models.ConfigNamespace, error) {
	var items []models.ConfigNamespace
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM config_namespace WHERE tenant_id=? ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) CreateGroup(ctx context.Context, g *models.ConfigGroup) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_group (id, tenant_id, namespace_id, name, description, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		g.ID, g.TenantID, g.NamespaceID, g.Name, g.Description, g.CreatedAt, g.UpdatedAt)
	return err
}

func (r *Repository) GetGroup(ctx context.Context, id, tenantID string) (*models.ConfigGroup, error) {
	var g models.ConfigGroup
	err := r.db.GetContext(ctx, &g, `SELECT * FROM config_group WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *Repository) ListGroups(ctx context.Context, tenantID, namespaceID string) ([]models.ConfigGroup, error) {
	var items []models.ConfigGroup
	if namespaceID != "" {
		err := r.db.SelectContext(ctx, &items, `SELECT * FROM config_group WHERE tenant_id=? AND namespace_id=? ORDER BY created_at DESC`, tenantID, namespaceID)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM config_group WHERE tenant_id=? ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) CreateItem(ctx context.Context, item *models.ConfigItem) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_item (id, tenant_id, group_id, namespace_id, key_name, value, value_type, encrypted, description, labels, level, override_of, priority, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		item.ID, item.TenantID, item.GroupID, item.NamespaceID, item.KeyName, item.Value, item.ValueType, item.Encrypted, item.Description, item.Labels, item.Level, item.OverrideOf, item.Priority, item.CreatedAt, item.UpdatedAt)
	return err
}

func (r *Repository) GetItem(ctx context.Context, id, tenantID string) (*models.ConfigItem, error) {
	var item models.ConfigItem
	err := r.db.GetContext(ctx, &item, `SELECT * FROM config_item WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *Repository) ListItems(ctx context.Context, tenantID, groupID, namespaceID string) ([]models.ConfigItem, error) {
	where := "tenant_id=?"
	args := []interface{}{tenantID}
	if groupID != "" {
		where += " AND group_id=?"
		args = append(args, groupID)
	}
	if namespaceID != "" {
		where += " AND namespace_id=?"
		args = append(args, namespaceID)
	}
	query := fmt.Sprintf("SELECT * FROM config_item WHERE %s ORDER BY key_name, priority DESC", where)
	var items []models.ConfigItem
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// ListItemsFiltered 支持 Phase 302 的 Level 过滤和 OverrideOnly 过滤。
func (r *Repository) ListItemsFiltered(ctx context.Context, tenantID string, filter *models.GetItemsFilter) ([]models.ConfigItem, error) {
	if filter == nil {
		return r.ListItems(ctx, tenantID, "", "")
	}
	where := "tenant_id=?"
	args := []interface{}{tenantID}
	if filter.GroupID != "" {
		where += " AND group_id=?"
		args = append(args, filter.GroupID)
	}
	if filter.NamespaceID != "" {
		where += " AND namespace_id=?"
		args = append(args, filter.NamespaceID)
	}
	if filter.Level.IsValid() {
		where += " AND level=?"
		args = append(args, string(filter.Level))
	}
	if filter.OverrideOnly {
		where += " AND EXISTS (SELECT 1 FROM config_item c2 WHERE c2.override_of = config_item.id AND c2.tenant_id = config_item.tenant_id)"
	}
	query := fmt.Sprintf("SELECT * FROM config_item WHERE %s ORDER BY key_name, priority DESC", where)
	var items []models.ConfigItem
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// ListOverrides 返回所有 override_of = itemID 的下层 item（Phase 302）。
func (r *Repository) ListOverrides(ctx context.Context, tenantID, itemID string) ([]models.ConfigItem, error) {
	var items []models.ConfigItem
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM config_item WHERE tenant_id=? AND override_of=? ORDER BY priority DESC, created_at ASC`,
		tenantID, itemID)
	return items, err
}

func (r *Repository) UpdateItemValue(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigItem, error) {
	fields := []string{}
	args := []interface{}{}
	for k, v := range attrs {
		fields = append(fields, fmt.Sprintf("%s=?", k))
		args = append(args, v)
	}
	fields = append(fields, "updated_at=NOW()")
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE config_item SET %s WHERE id=? AND tenant_id=?", strings.Join(fields, ", "))
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	item, err := r.GetItem(ctx, id, tenantID)
	return item, err
}

func (r *Repository) DeleteItem(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM config_item WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

func (r *Repository) GetItemLatestVersion(ctx context.Context, itemID string) (int, error) {
	var version int
	err := r.db.GetContext(ctx, &version, `SELECT MAX(version) FROM config_item_history WHERE item_id=?`, itemID)
	if err != nil || version == 0 {
		return 0, err
	}
	return version, nil
}

func (r *Repository) CreateHistory(ctx context.Context, h *models.ConfigItemHistory) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_item_history (id, tenant_id, item_id, version, old_value, new_value, operator, reason, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		h.ID, h.TenantID, h.ItemID, h.Version, h.OldValue, h.NewValue, h.Operator, h.Reason, h.CreatedAt)
	return err
}

func (r *Repository) GetItemHistory(ctx context.Context, itemID, tenantID string, limit int) ([]models.ConfigItemHistory, error) {
	var items []models.ConfigItemHistory
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM config_item_history WHERE item_id=? AND tenant_id=? ORDER BY created_at DESC LIMIT ?`,
		itemID, tenantID, limit)
	return items, err
}

func (r *Repository) CreateSnapshot(ctx context.Context, snap *models.ConfigSnapshot) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_snapshot (id, tenant_id, group_id, namespace_id, environment, version, data, checksum, created_at, created_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		snap.ID, snap.TenantID, snap.GroupID, snap.NamespaceID, snap.Environment, snap.Version, snap.Data, snap.Checksum, snap.CreatedAt, snap.CreatedBy)
	return err
}

func (r *Repository) ListSnapshots(ctx context.Context, tenantID, groupID, env string) ([]models.ConfigSnapshot, error) {
	where := "tenant_id=?"
	args := []interface{}{tenantID}
	if groupID != "" {
		where += " AND group_id=?"
		args = append(args, groupID)
	}
	if env != "" {
		where += " AND environment=?"
		args = append(args, env)
	}
	query := fmt.Sprintf("SELECT * FROM config_snapshot WHERE %s ORDER BY created_at DESC", where)
	var items []models.ConfigSnapshot
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) GetSnapshot(ctx context.Context, id string) (*models.ConfigSnapshot, error) {
	var snap models.ConfigSnapshot
	err := r.db.GetContext(ctx, &snap, `SELECT * FROM config_snapshot WHERE id=?`, id)
	if err != nil {
		return nil, err
	}
	return &snap, nil
}

func (r *Repository) GetLatestSnapshot(ctx context.Context, tenantID, groupID, env string) (*models.ConfigSnapshot, error) {
	var snap models.ConfigSnapshot
	where := "tenant_id=?"
	args := []interface{}{tenantID}
	if groupID != "" {
		where += " AND group_id=?"
		args = append(args, groupID)
	}
	if env != "" {
		where += " AND environment=?"
		args = append(args, env)
	}
	query := fmt.Sprintf("SELECT * FROM config_snapshot WHERE %s ORDER BY created_at DESC LIMIT 1", where)
	err := r.db.GetContext(ctx, &snap, query, args...)
	if err != nil {
		return nil, err
	}
	return &snap, nil
}

func (r *Repository) GetSnapshotData(ctx context.Context, id string) (map[string]interface{}, error) {
	snap, err := r.GetSnapshot(ctx, id)
	if err != nil {
		return nil, err
	}
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(snap.Data), &data); err != nil {
		return nil, err
	}
	return data, nil
}

func (r *Repository) CreateRelease(ctx context.Context, r2 *models.ConfigRelease) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_release (id, tenant_id, snapshot_id, group_id, environment, release_version, status, release_note, released_at, released_by, rollback_to_snapshot_id, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		r2.ID, r2.TenantID, r2.SnapshotID, r2.GroupID, r2.Environment, r2.ReleaseVersion, r2.Status, r2.ReleaseNote, r2.ReleasedAt, r2.ReleasedBy, r2.RollbackToSnapshotID, r2.CreatedAt)
	return err
}

func (r *Repository) GetRelease(ctx context.Context, id, tenantID string) (*models.ConfigRelease, error) {
	var r2 models.ConfigRelease
	err := r.db.GetContext(ctx, &r2, `SELECT * FROM config_release WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &r2, nil
}

func (r *Repository) ListReleases(ctx context.Context, tenantID, groupID, env string) ([]models.ConfigRelease, error) {
	where := "tenant_id=?"
	args := []interface{}{tenantID}
	if groupID != "" {
		where += " AND group_id=?"
		args = append(args, groupID)
	}
	if env != "" {
		where += " AND environment=?"
		args = append(args, env)
	}
	query := fmt.Sprintf("SELECT * FROM config_release WHERE %s ORDER BY created_at DESC", where)
	var items []models.ConfigRelease
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) UpdateRelease(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigRelease, error) {
	fields := []string{}
	args := []interface{}{}
	for k, v := range attrs {
		fields = append(fields, fmt.Sprintf("%s=?", k))
		args = append(args, v)
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE config_release SET %s WHERE id=? AND tenant_id=?", strings.Join(fields, ", "))
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetRelease(ctx, id, tenantID)
}

func (r *Repository) CreateReleaseHistory(ctx context.Context, h *models.ConfigReleaseHistory) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_release_history (id, tenant_id, release_id, group_id, environment, version, operator, action, detail, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		h.ID, h.TenantID, h.ReleaseID, h.GroupID, h.Environment, h.Version, h.Operator, h.Action, h.Detail, h.CreatedAt)
	return err
}

func (r *Repository) ListReleaseHistory(ctx context.Context, releaseID, tenantID string) ([]models.ConfigReleaseHistory, error) {
	var items []models.ConfigReleaseHistory
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM config_release_history WHERE release_id=? AND tenant_id=? ORDER BY created_at DESC`,
		releaseID, tenantID)
	return items, err
}

func (r *Repository) CreateAudit(ctx context.Context, a *models.ConfigAudit) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_audit (id, tenant_id, actor, action, target_type, target_id, detail, ip_address, user_agent, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.TenantID, a.Actor, a.Action, a.TargetType, a.TargetID, a.Detail, a.IPAddress, a.UserAgent, a.CreatedAt)
	return err
}

func (r *Repository) ListAudit(ctx context.Context, tenantID string, limit int) ([]models.ConfigAudit, error) {
	var items []models.ConfigAudit
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM config_audit WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?`,
		tenantID, limit)
	return items, err
}
