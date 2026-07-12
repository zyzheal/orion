package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/config/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------- Config ----------

func (r *Repository) Create(ctx context.Context, c *models.Config) error {
	c.ID = uuid.New().String()
	c.CreatedAt = time.Now().UTC()
	c.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO configs (id, tenant_id, name, description, key, value, environment, data_type, status, created_by, created_at, updated_at) VALUES (:id, :tenant_id, :name, :description, :key, :value, :environment, :data_type, :status, :created_by, :created_at, :updated_at)`, c)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Config, error) {
	var m models.Config
	err := r.db.GetContext(ctx, &m, `SELECT * FROM configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, filter ConfigFilter) ([]models.Config, int, error) {
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := filter.Page * pageSize
	query := `SELECT * FROM configs WHERE tenant_id=$1`
	args := []any{tenantID}
	argIdx := 2
	if filter.Environment != "" {
		query += fmt.Sprintf(" AND environment=$%d", argIdx)
		args = append(args, filter.Environment)
		argIdx++
	}
	if filter.Status != "" {
		query += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, filter.Status)
		argIdx++
	}
	if filter.Search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR key ILIKE $%d)", argIdx, argIdx+1)
		args = append(args, "%"+filter.Search+"%", "%"+filter.Search+"%")
		argIdx += 2
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, pageSize, offset)
	var items []models.Config
	err := r.db.SelectContext(ctx, &items, query, args...)
	if err != nil {
		return nil, 0, err
	}
	countQuery := `SELECT count(*) FROM configs WHERE tenant_id=$1`
	countArgs := []any{tenantID}
	ci := 2
	if filter.Environment != "" {
		countQuery += fmt.Sprintf(" AND environment=$%d", ci)
		countArgs = append(countArgs, filter.Environment)
		ci++
	}
	if filter.Status != "" {
		countQuery += fmt.Sprintf(" AND status=$%d", ci)
		countArgs = append(countArgs, filter.Status)
		ci++
	}
	var total int
	err = r.db.GetContext(ctx, &total, countQuery, countArgs...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]any) error {
	if len(updates) == 0 {
		return nil
	}
	cols := make([]string, 0, len(updates)+1)
	args := make([]any, 0, len(updates)+2)
	for k, v := range updates {
		cols = append(cols, fmt.Sprintf("%s=$%d", k, len(args)+1))
		args = append(args, v)
	}
	cols = append(cols, fmt.Sprintf("updated_at=NOW()"))
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx, `UPDATE configs SET `+strings.Join(cols, ", ")+` WHERE id=$`+fmt.Sprintf("%d", len(args)-1)+` AND tenant_id=$`+fmt.Sprintf("%d", len(args)), args...)
	return err
}

func (r *Repository) SoftDelete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE configs SET status='archived', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---------- ConfigVersion ----------

func (r *Repository) CreateVersion(ctx context.Context, v *models.ConfigVersion) error {
	v.ID = uuid.New().String()
	v.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO config_versions (id, config_id, version, value, data, created_by, created_at) VALUES (:id, :config_id, :version, :value, :data, :created_by, :created_at)`, v)
	return err
}

func (r *Repository) GetVersions(ctx context.Context, configID string) ([]models.ConfigVersion, error) {
	var versions []models.ConfigVersion
	err := r.db.SelectContext(ctx, &versions, `SELECT * FROM config_versions WHERE config_id=$1 ORDER BY created_at DESC`, configID)
	if err != nil {
		return nil, err
	}
	return versions, nil
}

func (r *Repository) GetVersion(ctx context.Context, configID, version string) (*models.ConfigVersion, error) {
	var v models.ConfigVersion
	err := r.db.GetContext(ctx, &v, `SELECT * FROM config_versions WHERE config_id=$1 AND version=$2`, configID, version)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// ---------- GitOps ----------

func (r *Repository) CreateGitOps(ctx context.Context, m *models.GitOpsConfig) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	m.Status = "enabled"
	m.SyncStatus = "pending"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO gitops_configs (id, tenant_id, repository_url, branch, path, status, sync_status, created_at, updated_at) VALUES (:id, :tenant_id, :repository_url, :branch, :path, :status, :sync_status, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) ListGitOpsConfigs(ctx context.Context, tenantID string) ([]models.GitOpsConfig, error) {
	var items []models.GitOpsConfig
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM gitops_configs WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) GetGitOpsConfig(ctx context.Context, tenantID, id string) (*models.GitOpsConfig, error) {
	var m models.GitOpsConfig
	err := r.db.GetContext(ctx, &m, `SELECT * FROM gitops_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateGitOpsStatus(ctx context.Context, tenantID, id string, status string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE gitops_configs SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	return err
}

func (r *Repository) RecordSyncStatus(ctx context.Context, s *models.GitOpsSyncStatus) error {
	s.ID = uuid.New().String()
	s.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO gitops_sync_status (id, config_id, status, error, created_at) VALUES (:id, :config_id, :status, :error, :created_at)`, s)
	return err
}

func (r *Repository) GetSyncStatus(ctx context.Context, tenantID string, limit int) ([]models.GitOpsSyncStatus, error) {
	if limit <= 0 {
		limit = 20
	}
	var items []models.GitOpsSyncStatus
	err := r.db.SelectContext(ctx, &items, `SELECT s.* FROM gitops_sync_status s JOIN gitops_configs g ON s.config_id=g.id WHERE g.tenant_id=$1 ORDER BY s.created_at DESC LIMIT $2`, tenantID, limit)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// ---------- Change Request ----------

func (r *Repository) CreateChangeRequest(ctx context.Context, m *models.ChangeRequest) error {
	m.ID = uuid.New().String()
	m.Status = "pending"
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO change_requests (id, tenant_id, config_id, description, status, requested_by, approved_by, reject_reason, created_at, updated_at) VALUES (:id, :tenant_id, :config_id, :description, :status, :requested_by, :approved_by, :reject_reason, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) ListChangeRequests(ctx context.Context, tenantID string, status string, limit, offset int) ([]models.ChangeRequest, int, error) {
	if limit <= 0 {
		limit = 20
	}
	query := `SELECT * FROM change_requests WHERE tenant_id=$1`
	args := []any{tenantID}
	argIdx := 2
	if status != "" {
		query += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	countQuery := query
	err := r.db.SelectContext(ctx, &args, query+fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1), append(args, limit, offset)...)
	var items []models.ChangeRequest
	err = r.db.SelectContext(ctx, &items, query+fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1), append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	var total int
	err = r.db.GetContext(ctx, &total, countQuery)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) GetChangeRequest(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error) {
	var m models.ChangeRequest
	err := r.db.GetContext(ctx, &m, `SELECT * FROM change_requests WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateChangeRequestStatus(ctx context.Context, tenantID, id string, status string, approvedBy string, reason string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE change_requests SET status=$1, approved_by=$2, reject_reason=$3, updated_at=NOW() WHERE id=$4 AND tenant_id=$5`,
		status, approvedBy, reason, id, tenantID)
	return err
}

// ---------- Audit ----------

func (r *Repository) CreateAuditEntry(ctx context.Context, a *models.AuditEntry) error {
	a.ID = uuid.New().String()
	a.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO config_audit (id, config_id, action, details, user_id, created_at) VALUES (:id, :config_id, :action, :details, :user_id, :created_at)`, a)
	return err
}

func (r *Repository) GetAuditTrail(ctx context.Context, configID string, limit int) ([]models.AuditEntry, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.AuditEntry
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM config_audit WHERE config_id=$1 ORDER BY created_at DESC LIMIT $2`, configID, limit)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// ---------- Template ----------

func (r *Repository) CreateTemplate(ctx context.Context, t *models.ConfigTemplate) error {
	t.ID = uuid.New().String()
	t.Version = "1.0"
	t.CreatedAt = time.Now().UTC()
	t.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO config_templates (id, tenant_id, name, description, schema, version, created_by, created_at, updated_at) VALUES (:id, :tenant_id, :name, :description, :schema, :version, :created_by, :created_at, :updated_at)`, t)
	return err
}

func (r *Repository) ListTemplates(ctx context.Context, tenantID string) ([]models.ConfigTemplate, error) {
	var items []models.ConfigTemplate
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM config_templates WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) GetTemplate(ctx context.Context, tenantID, id string) (*models.ConfigTemplate, error) {
	var t models.ConfigTemplate
	err := r.db.GetContext(ctx, &t, `SELECT * FROM config_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) UpdateTemplate(ctx context.Context, tenantID string, t *models.ConfigTemplate) error {
	t.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE config_templates SET name=:name, description=:description, schema=:schema, version=:version, updated_at=:updated_at WHERE id=:id AND tenant_id=:tenant_id`, t)
	return err
}

func (r *Repository) DeleteTemplate(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM config_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CreateTemplateVersion(ctx context.Context, v *models.ConfigTemplateVersion) error {
	v.ID = uuid.New().String()
	v.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO config_template_versions (id, template_id, version, schema, created_by, created_at) VALUES (:id, :template_id, :version, :schema, :created_by, :created_at)`, v)
	return err
}

func (r *Repository) ListTemplateVersions(ctx context.Context, templateID string) ([]models.ConfigTemplateVersion, error) {
	var items []models.ConfigTemplateVersion
	_ = templateID
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM config_template_versions WHERE template_id=$1 ORDER BY created_at DESC`, templateID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// ---------- Canary ----------

func (r *Repository) CreateCanary(ctx context.Context, m *models.CanaryDeployment) error {
	m.ID = uuid.New().String()
	m.Status = "running"
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO canary_deployments (id, tenant_id, config_id, status, traffic_percent, created_at, updated_at) VALUES (:id, :tenant_id, :config_id, :status, :traffic_percent, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetCanary(ctx context.Context, tenantID, id string) (*models.CanaryDeployment, error) {
	var m models.CanaryDeployment
	err := r.db.GetContext(ctx, &m, `SELECT * FROM canary_deployments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateCanaryStatus(ctx context.Context, tenantID, id string, status string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE canary_deployments SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	return err
}

// ---------- Snapshot ----------

func (r *Repository) CreateSnapshot(ctx context.Context, s *models.ConfigSnapshot) error {
	s.ID = uuid.New().String()
	s.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO config_snapshots (id, tenant_id, config_id, data, created_by, created_at) VALUES (:id, :tenant_id, :config_id, :data, :created_by, :created_at)`, s)
	return err
}

func (r *Repository) ListSnapshots(ctx context.Context, tenantID, configID string) ([]models.ConfigSnapshot, error) {
	var items []models.ConfigSnapshot
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM config_snapshots WHERE tenant_id=$1 AND config_id=$2 ORDER BY created_at DESC`, tenantID, configID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) GetSnapshot(ctx context.Context, tenantID, snapshotID string) (*models.ConfigSnapshot, error) {
	var s models.ConfigSnapshot
	err := r.db.GetContext(ctx, &s, `SELECT * FROM config_snapshots WHERE id=$1 AND tenant_id=$2`, snapshotID, tenantID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) DeleteSnapshot(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM config_snapshots WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---------- Diff ----------

func (r *Repository) GetEnvironments(ctx context.Context, tenantID string) ([]string, error) {
	var envs []string
	err := r.db.SelectContext(ctx, &envs, `SELECT DISTINCT environment FROM configs WHERE tenant_id=$1 AND environment != '' ORDER BY environment`, tenantID)
	if err != nil {
		return nil, err
	}
	return envs, nil
}

func (r *Repository) GetConfigByKeyEnv(ctx context.Context, tenantID, key, environment string) (*models.Config, error) {
	var m models.Config
	err := r.db.GetContext(ctx, &m, `SELECT * FROM configs WHERE tenant_id=$1 AND key=$2 AND environment=$3`, tenantID, key, environment)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// ---------- Webhook ----------

func (r *Repository) CreateWebhook(ctx context.Context, m *models.ConfigWebhook) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO config_webhooks (id, tenant_id, name, url, secret, events, enabled, created_at, updated_at) VALUES (:id, :tenant_id, :name, :url, :secret, :events, :enabled, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) ListWebhooks(ctx context.Context, tenantID string) ([]models.ConfigWebhook, error) {
	var items []models.ConfigWebhook
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM config_webhooks WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) GetWebhook(ctx context.Context, tenantID, id string) (*models.ConfigWebhook, error) {
	var m models.ConfigWebhook
	err := r.db.GetContext(ctx, &m, `SELECT * FROM config_webhooks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateWebhook(ctx context.Context, tenantID string, m *models.ConfigWebhook) error {
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE config_webhooks SET name=:name, url=:url, secret=:secret, events=:events, enabled=:enabled, updated_at=:updated_at WHERE id=:id AND tenant_id=:tenant_id`, m)
	return err
}

func (r *Repository) DeleteWebhook(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM config_webhooks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---------- Filter ----------

type ConfigFilter struct {
	Environment string
	Status      string
	Search      string
	Page        int
	PageSize    int
}

// ---------- Helpers ----------

func isNotFoundError(err error) bool {
	if err == nil {
		return false
	}
	// Check for pgx "no rows" error pattern
	return strings.Contains(err.Error(), "no rows in result set") || strings.Contains(err.Error(), "not found")
}
