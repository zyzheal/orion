package repository

import (
	"context"
	"time"

	"orion/config-mgmt-svc-go/internal/models"
)

// ==================== Config Templates ====================

func (r *Repository) CreateTemplate(ctx context.Context, t *models.ConfigTemplate) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_templates (id, tenant_id, name, description, content, format, tags)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		t.ID, t.TenantID, t.Name, t.Description, t.Content, t.Format, t.Tags)
	return err
}

func (r *Repository) GetTemplate(ctx context.Context, tenantID, id string) (*models.ConfigTemplate, error) {
	var t models.ConfigTemplate
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM config_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) ListTemplates(ctx context.Context, tenantID string, offset, limit int) ([]models.ConfigTemplate, error) {
	var items []models.ConfigTemplate
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM config_templates WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) UpdateTemplate(ctx context.Context, t *models.ConfigTemplate) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE config_templates SET name=$1, description=$2, content=$3, format=$4, tags=$5, updated_at=$6
		 WHERE id=$7 AND tenant_id=$8`,
		t.Name, t.Description, t.Content, t.Format, t.Tags, time.Now(), t.ID, t.TenantID)
	return err
}

func (r *Repository) DeleteTemplate(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM config_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CountTemplates(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM config_templates WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ==================== Template Versions ====================

func (r *Repository) CreateTemplateVersion(ctx context.Context, v *models.TemplateVersion) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO template_versions (id, tenant_id, template_id, version_number, content)
		 VALUES ($1,$2,$3,$4,$5)`,
		v.ID, v.TenantID, v.TemplateID, v.VersionNumber, v.Content)
	return err
}

func (r *Repository) ListTemplateVersions(ctx context.Context, tenantID, templateID string) ([]models.TemplateVersion, error) {
	var items []models.TemplateVersion
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM template_versions WHERE tenant_id=$1 AND template_id=$2 ORDER BY version_number DESC`,
		tenantID, templateID)
	return items, err
}

func (r *Repository) GetLatestTemplateVersion(ctx context.Context, tenantID, templateID string) (*models.TemplateVersion, error) {
	var v models.TemplateVersion
	err := r.db.GetContext(ctx, &v,
		`SELECT * FROM template_versions WHERE tenant_id=$1 AND template_id=$2 ORDER BY version_number DESC LIMIT 1`,
		tenantID, templateID)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// ==================== Webhooks ====================

func (r *Repository) CreateWebhook(ctx context.Context, w *models.Webhook) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_webhooks (id, tenant_id, name, url, secret, events, enabled)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		w.ID, w.TenantID, w.Name, w.URL, w.Secret, w.Events, w.Enabled)
	return err
}

func (r *Repository) GetWebhook(ctx context.Context, tenantID, id string) (*models.Webhook, error) {
	var w models.Webhook
	err := r.db.GetContext(ctx, &w,
		`SELECT * FROM config_webhooks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *Repository) ListWebhooks(ctx context.Context, tenantID string) ([]models.Webhook, error) {
	var items []models.Webhook
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM config_webhooks WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) UpdateWebhook(ctx context.Context, w *models.Webhook) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE config_webhooks SET name=$1, url=$2, secret=$3, events=$4, enabled=$5, updated_at=$6
		 WHERE id=$7 AND tenant_id=$8`,
		w.Name, w.URL, w.Secret, w.Events, w.Enabled, time.Now(), w.ID, w.TenantID)
	return err
}

func (r *Repository) DeleteWebhook(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM config_webhooks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}