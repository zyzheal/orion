package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/i18n/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		db: db,
	}
}

// ==================== Locale Repository ====================

func (r *Repository) CreateLocale(ctx context.Context, locale *models.Locale) error {
	locale.ID = uuid.New().String()
	locale.CreatedAt = time.Now().UTC()
	locale.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO i18n_locales (id, tenant_id, locale_code, locale_name, is_default, created_at, updated_at)
		 VALUES (:id, :tenant_id, :locale_code, :locale_name, :is_default, :created_at, :updated_at)`,
		locale)
	return err
}

func (r *Repository) ListLocales(ctx context.Context, tenantID string) ([]models.Locale, error) {
	var locales []models.Locale
	err := r.db.SelectContext(ctx, &locales,
		`SELECT * FROM i18n_locales WHERE tenant_id=$1 ORDER BY locale_code`, tenantID)
	if err != nil {
		return nil, err
	}
	return locales, nil
}

// ==================== Translation Repository ====================

func (r *Repository) SetTranslation(ctx context.Context, t *models.Translation) error {
	now := time.Now().UTC()
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	t.CreatedAt = now
	t.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO i18n_translations (id, tenant_id, locale_code, namespace, key, value, created_at, updated_at)
		 VALUES (:id, :tenant_id, :locale_code, :namespace, :key, :value, :created_at, :updated_at)
		 ON CONFLICT (tenant_id, locale_code, namespace, key)
		 DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		t)
	return err
}

func (r *Repository) SetBulkTranslations(ctx context.Context, tenantID, localeCode, namespace string, kv map[string]string) (int, error) {
	if len(kv) == 0 {
		return 0, nil
	}
	for key, value := range kv {
		t := &models.Translation{
			TenantID:   tenantID,
			LocaleCode: localeCode,
			Namespace:  namespace,
			Key:        key,
			Value:      value,
		}
		if err := r.SetTranslation(ctx, t); err != nil {
			return 0, fmt.Errorf("failed to set translation key %q: %w", key, err)
		}
	}
	return len(kv), nil
}

func (r *Repository) GetTranslationsByNamespace(ctx context.Context, tenantID, localeCode, namespace string) (map[string]string, error) {
	var translations []models.Translation
	err := r.db.SelectContext(ctx, &translations,
		`SELECT key, value FROM i18n_translations
		 WHERE tenant_id=$1 AND locale_code=$2 AND namespace=$3
		 ORDER BY key`, tenantID, localeCode, namespace)
	if err != nil {
		return nil, err
	}
	m := make(map[string]string, len(translations))
	for _, t := range translations {
		m[t.Key] = t.Value
	}
	return m, nil
}

func (r *Repository) GetAllTranslations(ctx context.Context, tenantID, localeCode string) (map[string]map[string]string, error) {
	var translations []models.Translation
	err := r.db.SelectContext(ctx, &translations,
		`SELECT namespace, key, value FROM i18n_translations
		 WHERE tenant_id=$1 AND locale_code=$2
		 ORDER BY namespace, key`, tenantID, localeCode)
	if err != nil {
		return nil, err
	}
	result := make(map[string]map[string]string)
	for _, t := range translations {
		if _, ok := result[t.Namespace]; !ok {
			result[t.Namespace] = make(map[string]string)
		}
		result[t.Namespace][t.Key] = t.Value
	}
	return result, nil
}

func (r *Repository) DeleteTranslation(ctx context.Context, tenantID, localeCode, namespace, key string) (bool, error) {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM i18n_translations
		 WHERE tenant_id=$1 AND locale_code=$2 AND namespace=$3 AND key=$4`,
		tenantID, localeCode, namespace, key)
	if err != nil {
		return false, err
	}
	rows, _ := res.RowsAffected()
	return rows > 0, nil
}
