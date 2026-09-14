package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"orion/platform-svc-go/internal/distributed-config/models"

	"github.com/jmoiron/sqlx"
)

// The eight column lists below are the migrations' own column sets in
// declaration order: seven of them from 395_create_distributed_config.sql and
// the last three columns of config_item from 406. Every read spells them out
// instead of using SELECT *, so a later migration that adds a column the
// models do not declare cannot fail a whole read route.
const (
	namespaceColumns      = `id, tenant_id, name, description, status, created_at, updated_at`
	groupColumns          = `id, tenant_id, namespace_id, name, description, created_at, updated_at`
	itemColumns           = `id, tenant_id, group_id, namespace_id, key_name, value, value_type, encrypted, description, labels, created_at, updated_at, level, override_of, priority`
	itemHistoryColumns    = `id, tenant_id, item_id, version, old_value, new_value, operator, reason, created_at`
	snapshotColumns       = `id, tenant_id, group_id, namespace_id, environment, version, data, checksum, created_at, created_by`
	releaseColumns        = `id, tenant_id, snapshot_id, group_id, environment, release_version, status, release_note, released_at, released_by, rollback_to_snapshot_id, created_at`
	releaseHistoryColumns = `id, tenant_id, release_id, group_id, environment, version, operator, action, detail, created_at`
	auditColumns          = `id, tenant_id, actor, action, target_type, target_id, detail, ip_address, user_agent, created_at`
)

// The two whitelists are the injection boundary of the UPDATE statements.
// Both used to build their SET clause with a raw fmt.Sprintf over the caller's
// map keys, so a caller could write id, tenant_id or key_name: renaming the
// key breaks idx_group_key_config_item, and re-pointing tenant_id or group_id
// moves a row into someone else's namespace.
var (
	itemUpdatable = []string{
		"value", "value_type", "encrypted", "description", "labels", "level", "priority", "override_of",
	}
	releaseUpdatable = []string{
		"release_version", "status", "release_note", "released_at", "released_by", "rollback_to_snapshot_id",
	}
)

const (
	defaultAuditLimit = 50
	maxAuditLimit     = 500
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// toDBValue converts a Go value to the literal Postgres will accept for the
// column it is bound to. lib/pq renders a Go bool as the text true or false
// regardless of the target column's type, and Postgres refuses that text for a
// SMALLINT column, so config_item.encrypted could never be written true.
func toDBValue(column string, v interface{}) interface{} {
	if column == "encrypted" {
		if b, ok := v.(bool); ok {
			if b {
				return int64(1)
			}
			return int64(0)
		}
	}
	return v
}

// buildSET turns a caller-supplied attribute map into a SET clause whose column
// order is fixed by the whitelist rather than by the map's iteration order,
// and whose placeholder numbering is correct for whatever subset was supplied.
// An unknown key is an error instead of a silent drop: a dropped key would
// answer 200 to a request whose attribute never reached the database.
func buildSET(table string, attrs map[string]interface{}, updatable []string) (string, []interface{}, error) {
	known := map[string]bool{}
	for _, c := range updatable {
		known[c] = true
	}
	keys := make([]string, 0, len(attrs))
	for k := range attrs {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		if !known[k] {
			return "", nil, fmt.Errorf("column %q is not updatable on %s", k, table)
		}
	}
	set := []string{}
	args := []interface{}{}
	for _, col := range updatable {
		v, ok := attrs[col]
		if !ok {
			continue
		}
		args = append(args, toDBValue(col, v))
		set = append(set, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	if len(set) == 0 {
		return "", nil, fmt.Errorf("no updatable columns supplied for %s", table)
	}
	return strings.Join(set, ", "), args, nil
}

func (r *Repository) CreateNamespace(ctx context.Context, ns *models.ConfigNamespace) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO config_namespace ("+namespaceColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7)",
		ns.ID, ns.TenantID, ns.Name, ns.Description, ns.Status, ns.CreatedAt, ns.UpdatedAt)
	return err
}

func (r *Repository) GetNamespace(ctx context.Context, id, tenantID string) (*models.ConfigNamespace, error) {
	var ns models.ConfigNamespace
	err := r.db.GetContext(ctx, &ns, "SELECT "+namespaceColumns+" FROM config_namespace WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &ns, nil
}

func (r *Repository) ListNamespaces(ctx context.Context, tenantID string) ([]models.ConfigNamespace, error) {
	var items []models.ConfigNamespace
	err := r.db.SelectContext(ctx, &items, "SELECT "+namespaceColumns+" FROM config_namespace WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	return items, err
}

func (r *Repository) CreateGroup(ctx context.Context, g *models.ConfigGroup) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO config_group ("+groupColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7)",
		g.ID, g.TenantID, g.NamespaceID, g.Name, g.Description, g.CreatedAt, g.UpdatedAt)
	return err
}

func (r *Repository) GetGroup(ctx context.Context, id, tenantID string) (*models.ConfigGroup, error) {
	var g models.ConfigGroup
	err := r.db.GetContext(ctx, &g, "SELECT "+groupColumns+" FROM config_group WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *Repository) ListGroups(ctx context.Context, tenantID, namespaceID string) ([]models.ConfigGroup, error) {
	if namespaceID != "" {
		var items []models.ConfigGroup
		err := r.db.SelectContext(ctx, &items, "SELECT "+groupColumns+" FROM config_group WHERE tenant_id = $1 AND namespace_id = $2 ORDER BY created_at DESC", tenantID, namespaceID)
		return items, err
	}
	var items []models.ConfigGroup
	err := r.db.SelectContext(ctx, &items, "SELECT "+groupColumns+" FROM config_group WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	return items, err
}

func (r *Repository) CreateItem(ctx context.Context, item *models.ConfigItem) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO config_item ("+itemColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)",
		item.ID, item.TenantID, item.GroupID, item.NamespaceID, item.KeyName, item.Value, item.ValueType,
		toDBValue("encrypted", item.Encrypted), item.Description, item.Labels, item.CreatedAt, item.UpdatedAt,
		item.Level, item.OverrideOf, item.Priority)
	return err
}

func (r *Repository) GetItem(ctx context.Context, id, tenantID string) (*models.ConfigItem, error) {
	var item models.ConfigItem
	err := r.db.GetContext(ctx, &item, "SELECT "+itemColumns+" FROM config_item WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *Repository) ListItems(ctx context.Context, tenantID, groupID, namespaceID string) ([]models.ConfigItem, error) {
	where := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	if groupID != "" {
		where = append(where, fmt.Sprintf("group_id = $%d", len(args)+1))
		args = append(args, groupID)
	}
	if namespaceID != "" {
		where = append(where, fmt.Sprintf("namespace_id = $%d", len(args)+1))
		args = append(args, namespaceID)
	}
	query := fmt.Sprintf("SELECT %s FROM config_item WHERE %s ORDER BY key_name, priority DESC",
		itemColumns, strings.Join(where, " AND "))
	var items []models.ConfigItem
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// ListItemsFiltered 支持 Phase 302 的 Level 过滤和 OverrideOnly 过滤。
func (r *Repository) ListItemsFiltered(ctx context.Context, tenantID string, filter *models.GetItemsFilter) ([]models.ConfigItem, error) {
	if filter == nil {
		return r.ListItems(ctx, tenantID, "", "")
	}
	where := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	if filter.GroupID != "" {
		where = append(where, fmt.Sprintf("group_id = $%d", len(args)+1))
		args = append(args, filter.GroupID)
	}
	if filter.NamespaceID != "" {
		where = append(where, fmt.Sprintf("namespace_id = $%d", len(args)+1))
		args = append(args, filter.NamespaceID)
	}
	if filter.Level.IsValid() {
		where = append(where, fmt.Sprintf("level = $%d", len(args)+1))
		args = append(args, string(filter.Level))
	}
	if filter.OverrideOnly {
		where = append(where, "EXISTS (SELECT 1 FROM config_item c2 WHERE c2.override_of = config_item.id AND c2.tenant_id = config_item.tenant_id)")
	}
	query := fmt.Sprintf("SELECT %s FROM config_item WHERE %s ORDER BY key_name, priority DESC",
		itemColumns, strings.Join(where, " AND "))
	var items []models.ConfigItem
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// ListOverrides 返回所有 override_of = itemID 的下层 item（Phase 302）。
func (r *Repository) ListOverrides(ctx context.Context, tenantID, itemID string) ([]models.ConfigItem, error) {
	var items []models.ConfigItem
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+itemColumns+" FROM config_item WHERE tenant_id = $1 AND override_of = $2 ORDER BY priority DESC, created_at ASC",
		tenantID, itemID)
	return items, err
}

func (r *Repository) UpdateItemValue(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigItem, error) {
	if len(attrs) == 0 {
		return r.GetItem(ctx, id, tenantID)
	}
	set, args, err := buildSET("config_item", attrs, itemUpdatable)
	if err != nil {
		return nil, err
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE config_item SET %s, updated_at = NOW() WHERE id = $%d AND tenant_id = $%d",
		set, len(args)-1, len(args))
	if _, err := r.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}
	return r.GetItem(ctx, id, tenantID)
}

func (r *Repository) DeleteItem(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, "DELETE FROM config_item WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return false, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return rows > 0, nil
}

// GetItemLatestVersion returns the highest history version of an item, or zero
// when it has none. The version is a business value, not a probe for existence,
// so an empty history is zero rather than an error: folding it into an error
// made every update's next version reset to one and collide with the create.
func (r *Repository) GetItemLatestVersion(ctx context.Context, tenantID, itemID string) (int, error) {
	var version int
	err := r.db.GetContext(ctx, &version,
		"SELECT COALESCE(MAX(version), 0) FROM config_item_history WHERE tenant_id = $1 AND item_id = $2",
		tenantID, itemID)
	if err != nil {
		return 0, err
	}
	return version, nil
}

func (r *Repository) CreateHistory(ctx context.Context, h *models.ConfigItemHistory) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO config_item_history ("+itemHistoryColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
		h.ID, h.TenantID, h.ItemID, h.Version, h.OldValue, h.NewValue, h.Operator, h.Reason, h.CreatedAt)
	return err
}

func (r *Repository) GetItemHistory(ctx context.Context, itemID, tenantID string, limit int) ([]models.ConfigItemHistory, error) {
	var items []models.ConfigItemHistory
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+itemHistoryColumns+" FROM config_item_history WHERE item_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT $3",
		itemID, tenantID, limit)
	return items, err
}

func (r *Repository) CreateSnapshot(ctx context.Context, snap *models.ConfigSnapshot) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO config_snapshot ("+snapshotColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
		snap.ID, snap.TenantID, snap.GroupID, snap.NamespaceID, snap.Environment, snap.Version, snap.Data, snap.Checksum, snap.CreatedAt, snap.CreatedBy)
	return err
}

func (r *Repository) ListSnapshots(ctx context.Context, tenantID, groupID, env string) ([]models.ConfigSnapshot, error) {
	where := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	if groupID != "" {
		where = append(where, fmt.Sprintf("group_id = $%d", len(args)+1))
		args = append(args, groupID)
	}
	if env != "" {
		where = append(where, fmt.Sprintf("environment = $%d", len(args)+1))
		args = append(args, env)
	}
	query := fmt.Sprintf("SELECT %s FROM config_snapshot WHERE %s ORDER BY created_at DESC",
		snapshotColumns, strings.Join(where, " AND "))
	var items []models.ConfigSnapshot
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) GetSnapshot(ctx context.Context, id, tenantID string) (*models.ConfigSnapshot, error) {
	var snap models.ConfigSnapshot
	err := r.db.GetContext(ctx, &snap, "SELECT "+snapshotColumns+" FROM config_snapshot WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &snap, nil
}

// GetLatestSnapshotVersion returns the highest config_snapshot version for a
// group and environment, or zero when there is none.
func (r *Repository) GetLatestSnapshotVersion(ctx context.Context, tenantID, groupID, env string) (int, error) {
	var version int
	err := r.db.GetContext(ctx, &version,
		"SELECT COALESCE(MAX(version), 0) FROM config_snapshot WHERE tenant_id = $1 AND group_id = $2 AND environment = $3",
		tenantID, groupID, env)
	if err != nil {
		return 0, err
	}
	return version, nil
}

func (r *Repository) GetSnapshotData(ctx context.Context, id, tenantID string) (map[string]interface{}, error) {
	snap, err := r.GetSnapshot(ctx, id, tenantID)
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
		"INSERT INTO config_release ("+releaseColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
		r2.ID, r2.TenantID, r2.SnapshotID, r2.GroupID, r2.Environment, r2.ReleaseVersion, r2.Status, r2.ReleaseNote, r2.ReleasedAt, r2.ReleasedBy, r2.RollbackToSnapshotID, r2.CreatedAt)
	return err
}

func (r *Repository) GetRelease(ctx context.Context, id, tenantID string) (*models.ConfigRelease, error) {
	var r2 models.ConfigRelease
	err := r.db.GetContext(ctx, &r2, "SELECT "+releaseColumns+" FROM config_release WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &r2, nil
}

func (r *Repository) ListReleases(ctx context.Context, tenantID, groupID, env string) ([]models.ConfigRelease, error) {
	where := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	if groupID != "" {
		where = append(where, fmt.Sprintf("group_id = $%d", len(args)+1))
		args = append(args, groupID)
	}
	if env != "" {
		where = append(where, fmt.Sprintf("environment = $%d", len(args)+1))
		args = append(args, env)
	}
	query := fmt.Sprintf("SELECT %s FROM config_release WHERE %s ORDER BY created_at DESC",
		releaseColumns, strings.Join(where, " AND "))
	var items []models.ConfigRelease
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// GetLatestReleaseVersion returns the highest config_release release_version for
// a group and environment, or zero when there is none. The release counter used
// to come from config_snapshot.version, whose rows were all zero, so every
// published release got version one and overwrote the previous one.
func (r *Repository) GetLatestReleaseVersion(ctx context.Context, tenantID, groupID, env string) (int, error) {
	var version int
	err := r.db.GetContext(ctx, &version,
		"SELECT COALESCE(MAX(release_version), 0) FROM config_release WHERE tenant_id = $1 AND group_id = $2 AND environment = $3",
		tenantID, groupID, env)
	if err != nil {
		return 0, err
	}
	return version, nil
}

func (r *Repository) UpdateRelease(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigRelease, error) {
	if len(attrs) == 0 {
		return r.GetRelease(ctx, id, tenantID)
	}
	set, args, err := buildSET("config_release", attrs, releaseUpdatable)
	if err != nil {
		return nil, err
	}
	args = append(args, id, tenantID)
	// config_release has no updated_at column, so unlike UpdateItemValue this
	// clause must not append one: it would fail the statement.
	query := fmt.Sprintf("UPDATE config_release SET %s WHERE id = $%d AND tenant_id = $%d",
		set, len(args)-1, len(args))
	if _, err := r.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}
	return r.GetRelease(ctx, id, tenantID)
}

func (r *Repository) CreateReleaseHistory(ctx context.Context, h *models.ConfigReleaseHistory) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO config_release_history ("+releaseHistoryColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
		h.ID, h.TenantID, h.ReleaseID, h.GroupID, h.Environment, h.Version, h.Operator, h.Action, h.Detail, h.CreatedAt)
	return err
}

func (r *Repository) ListReleaseHistory(ctx context.Context, releaseID, tenantID string) ([]models.ConfigReleaseHistory, error) {
	var items []models.ConfigReleaseHistory
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+releaseHistoryColumns+" FROM config_release_history WHERE release_id = $1 AND tenant_id = $2 ORDER BY created_at DESC",
		releaseID, tenantID)
	return items, err
}

func (r *Repository) CreateAudit(ctx context.Context, a *models.ConfigAudit) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO config_audit ("+auditColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
		a.ID, a.TenantID, a.Actor, a.Action, a.TargetType, a.TargetID, a.Detail, a.IPAddress, a.UserAgent, a.CreatedAt)
	return err
}

func (r *Repository) ListAudit(ctx context.Context, tenantID string, limit int) ([]models.ConfigAudit, error) {
	// Postgres rejects a negative LIMIT outright, and an unbounded read on an
	// append-only audit table is an outage, so both ends are clamped here at
	// the SQL boundary rather than in every caller.
	if limit <= 0 {
		limit = defaultAuditLimit
	}
	if limit > maxAuditLimit {
		limit = maxAuditLimit
	}
	var items []models.ConfigAudit
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+auditColumns+" FROM config_audit WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2",
		tenantID, limit)
	return items, err
}
