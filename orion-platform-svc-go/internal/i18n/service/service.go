package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"orion/platform-svc-go/internal/i18n/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateLocale(ctx context.Context, locale *models.Locale) error
	DeleteTranslation(ctx context.Context, tenantID, localeCode, namespace, key string) (bool, error)
	GetAllTranslations(ctx context.Context, tenantID, localeCode string) (map[string]map[string]string, error)
	GetTranslationsByNamespace(ctx context.Context, tenantID, localeCode, namespace string) (map[string]string, error)
	ListLocales(ctx context.Context, tenantID string) ([]models.Locale, error)
	SetBulkTranslations(ctx context.Context, tenantID, localeCode, namespace string, kv map[string]string) (int, error)
	SetTranslation(ctx context.Context, t *models.Translation) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// CreateLocale creates a new locale for the tenant.
func (s *Service) CreateLocale(ctx context.Context, tenantID string, req models.CreateLocaleRequest) (*models.Locale, error) {
	locale := &models.Locale{
		TenantID:   tenantID,
		LocaleCode: req.LocaleCode,
		LocaleName: req.LocaleName,
		IsDefault:  req.IsDefault,
	}
	if err := s.repo.CreateLocale(ctx, locale); err != nil {
		return nil, err
	}
	return locale, nil
}

// ListLocales returns all locales for the tenant.
func (s *Service) ListLocales(ctx context.Context, tenantID string) ([]models.Locale, error) {
	return s.repo.ListLocales(ctx, tenantID)
}

// SetTranslation creates or updates a single translation.
func (s *Service) SetTranslation(ctx context.Context, tenantID, localeCode, namespace, key, value string) (*models.Translation, error) {
	t := &models.Translation{
		TenantID:   tenantID,
		LocaleCode: localeCode,
		Namespace:  namespace,
		Key:        key,
		Value:      value,
	}
	if err := s.repo.SetTranslation(ctx, t); err != nil {
		return nil, err
	}
	// Read back to return the persisted record
	byKey, err := s.repo.GetTranslationsByNamespace(ctx, tenantID, localeCode, namespace)
	if err != nil {
		return t, nil
	}
	t.Value = byKey[key]
	return t, nil
}

// SetBulkTranslations creates or updates many translations at once.
func (s *Service) SetBulkTranslations(ctx context.Context, tenantID, localeCode, namespace string, kv map[string]string) (int, error) {
	return s.repo.SetBulkTranslations(ctx, tenantID, localeCode, namespace, kv)
}

// GetTranslationsByNamespace returns translations for a given locale and namespace.
func (s *Service) GetTranslationsByNamespace(ctx context.Context, tenantID, localeCode, namespace string) (map[string]string, error) {
	return s.repo.GetTranslationsByNamespace(ctx, tenantID, localeCode, namespace)
}

// GetAllTranslations returns all translations grouped by namespace for a locale.
func (s *Service) GetAllTranslations(ctx context.Context, tenantID, localeCode string) (map[string]map[string]string, error) {
	return s.repo.GetAllTranslations(ctx, tenantID, localeCode)
}

// DeleteTranslation deletes a translation and reports whether it existed.
func (s *Service) DeleteTranslation(ctx context.Context, tenantID, localeCode, namespace, key string) (bool, error) {
	return s.repo.DeleteTranslation(ctx, tenantID, localeCode, namespace, key)
}
