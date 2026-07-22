package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"orion/platform-svc-go/internal/api-market/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateAPIKey(ctx context.Context, key *models.APIKey) error
	CreateDeveloperApp(ctx context.Context, app *models.DeveloperApp) error
	CreateProduct(ctx context.Context, product *models.Product) error
	CreateSubscription(ctx context.Context, sub *models.Subscription) error
	DeleteProduct(ctx context.Context, id string, tenantID string) (bool, error)
	GetAPIKeyByCredentials(ctx context.Context, tenantID string, clientID string, keyHash string) (*models.APIKey, error)
	GetAppByID(ctx context.Context, id string, tenantID string) (*models.DeveloperApp, error)
	GetProductByID(ctx context.Context, id string, tenantID string) (*models.Product, error)
	GetSubscription(ctx context.Context, appID string, productID string, tenantID string) (*models.Subscription, error)
	ListAPIKeysByApp(ctx context.Context, appID string, tenantID string) ([]models.APIKey, error)
	ListAppsByDeveloper(ctx context.Context, tenantID string, developerID string) ([]models.DeveloperApp, error)
	ListProducts(ctx context.Context, tenantID string) ([]models.Product, error)
	ListSubscriptionsByApp(ctx context.Context, appID string, tenantID string) ([]models.Subscription, error)
	UpdateProductStatus(ctx context.Context, id string, tenantID string, status string) (*models.Product, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Products ---

func (s *Service) CreateProduct(ctx context.Context, req *models.CreateProductRequest, ownerID string, tenantID string) (*models.Product, error) {
	product := &models.Product{
		Name:        req.Name,
		OwnerID:     &ownerID,
		TenantID:    tenantID,
		Description: req.Description,
		Version:     req.Version,
	}
	if err := s.repo.CreateProduct(ctx, product); err != nil {
		return nil, err
	}
	return s.repo.GetProductByID(ctx, product.ID, tenantID)
}

func (s *Service) ListProducts(ctx context.Context, tenantID string) ([]models.Product, error) {
	products, err := s.repo.ListProducts(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if products == nil {
		products = []models.Product{}
	}
	return products, nil
}

func (s *Service) GetProduct(ctx context.Context, id string, tenantID string) (*models.Product, error) {
	product, err := s.repo.GetProductByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrProductNotFound
		}
		return nil, err
	}
	return product, nil
}

func (s *Service) PublishProduct(ctx context.Context, id string, tenantID string) (*models.Product, error) {
	// Validate product exists
	_, err := s.repo.GetProductByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrProductNotFound
		}
		return nil, err
	}
	product, err := s.repo.UpdateProductStatus(ctx, id, tenantID, "published")
	return product, err
}

func (s *Service) DeleteProduct(ctx context.Context, id string, tenantID string) (bool, error) {
	return s.repo.DeleteProduct(ctx, id, tenantID)
}

// --- Developer Apps ---

func (s *Service) CreateDeveloperApp(ctx context.Context, req *models.CreateDeveloperAppRequest, developerID string, tenantID string) (*models.DeveloperApp, error) {
	redirectUris := "[]"
	if len(req.RedirectUris) > 0 {
		parts := make([]string, len(req.RedirectUris))
		for i, u := range req.RedirectUris {
			parts[i] = "\"" + u + "\""
		}
		redirectUris = "[" + strings.Join(parts, ",") + "]"
	}
	app := &models.DeveloperApp{
		Name:         req.Name,
		DeveloperID:  &developerID,
		TenantID:     tenantID,
		Description:  req.Description,
		RedirectUris: redirectUris,
		ProductID:    uuid.New().String(), // placeholder; not required in TS
	}
	if err := s.repo.CreateDeveloperApp(ctx, app); err != nil {
		return nil, err
	}
	return s.repo.GetAppByID(ctx, app.ID, tenantID)
}

func (s *Service) ListAppsByDeveloper(ctx context.Context, tenantID string, developerID string) ([]models.DeveloperApp, error) {
	apps, err := s.repo.ListAppsByDeveloper(ctx, tenantID, developerID)
	if err != nil {
		return nil, err
	}
	if apps == nil {
		apps = []models.DeveloperApp{}
	}
	return apps, nil
}

func (s *Service) GetApp(ctx context.Context, id string, tenantID string) (*models.DeveloperApp, error) {
	app, err := s.repo.GetAppByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAppNotFound
		}
		return nil, err
	}
	return app, nil
}

// --- API Keys ---

// GenerateAPIKeyResult holds the generated key plus the plaintext secret (shown once).
type GenerateAPIKeyResult struct {
	ID              string    `json:"id"`
	ClientID        string    `json:"clientId"`
	ClientSecret    string    `json:"clientSecret"`
	Scopes          string    `json:"scopes"`
	RateLimitPerMin int       `json:"rateLimitPerMin"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"createdAt"`
}

func (s *Service) GenerateAPIKey(ctx context.Context, appID string, scopes []string, tenantID string) (*GenerateAPIKeyResult, error) {
	// Validate app exists
	_, err := s.repo.GetAppByID(ctx, appID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAppNotFound
		}
		return nil, err
	}
	clientID := uuid.New().String()
	clientSecret := uuid.New().String()
	keyHash := hashKey(clientSecret)
	scopesStr := "[]"
	if len(scopes) > 0 {
		parts := make([]string, len(scopes))
		// Use a unique loop variable to avoid shadowing the receiver name 's'
		for i, sc := range scopes {
			parts[i] = "\"" + sc + "\""
		}
		scopesStr = "[" + strings.Join(parts, ",") + "]"
	}
	key := &models.APIKey{
		AppID:           appID,
		TenantID:        tenantID,
		ClientID:        clientID,
		KeyHash:         keyHash,
		Scopes:          scopesStr,
		RateLimitPerMin: 60,
	}
	if err := s.repo.CreateAPIKey(ctx, key); err != nil {
		return nil, err
	}
	return &GenerateAPIKeyResult{
		ID:              key.ID,
		ClientID:        clientID,
		ClientSecret:    clientSecret,
		Scopes:          scopesStr,
		RateLimitPerMin: 60,
		Status:          "active",
		CreatedAt:       key.CreatedAt,
	}, nil
}

func (s *Service) ListAPIKeys(ctx context.Context, appID string, tenantID string) ([]models.SafeAPIKey, error) {
	keys, err := s.repo.ListAPIKeysByApp(ctx, appID, tenantID)
	if err != nil {
		return nil, err
	}
	safe := make([]models.SafeAPIKey, len(keys))
	for i, k := range keys {
		safe[i] = k.ToSafeKey()
	}
	return safe, nil
}

func (s *Service) ValidateAPIKey(ctx context.Context, tenantID string, clientID string, clientSecret string) (*models.APIKeyValidationResult, error) {
	keyHash := hashKey(clientSecret)
	key, err := s.repo.GetAPIKeyByCredentials(ctx, tenantID, clientID, keyHash)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	return &models.APIKeyValidationResult{
		CredentialID:    key.ID,
		AppID:           key.AppID,
		Scopes:          key.Scopes,
		RateLimitPerMin: key.RateLimitPerMin,
	}, nil
}

// --- Subscriptions ---

func (s *Service) CheckSubscription(ctx context.Context, appID string, productID string, tenantID string) (bool, error) {
	_, err := s.repo.GetSubscription(ctx, appID, productID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (s *Service) Subscribe(ctx context.Context, req *models.SubscribeRequest, tenantID string) error {
	_, err := s.repo.GetAppByID(ctx, req.AppID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return ErrAppNotFound
		}
		return err
	}
	_, err = s.repo.GetProductByID(ctx, req.ProductID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return ErrProductNotFound
		}
		return err
	}
	quota := 1000
	if req.QuotaPerDay != nil {
		quota = *req.QuotaPerDay
	}
	sub := &models.Subscription{
		AppID:       req.AppID,
		ProductID:   req.ProductID,
		Plan:        req.Plan,
		QuotaPerDay: &quota,
	}
	return s.repo.CreateSubscription(ctx, sub)
}

func (s *Service) ListSubscriptions(ctx context.Context, appID string, tenantID string) ([]models.Subscription, error) {
	subs, err := s.repo.ListSubscriptionsByApp(ctx, appID, tenantID)
	if err != nil {
		return nil, err
	}
	if subs == nil {
		subs = []models.Subscription{}
	}
	return subs, nil
}

// --- Helpers ---

func hashKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

func nowTimestamp() time.Time {
	return time.Now().UTC()
}

// --- Errors ---

var (
	ErrProductNotFound    = errors.New("product not found")
	ErrAppNotFound        = errors.New("app not found")
	ErrInvalidCredentials = errors.New("invalid credentials")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrProductNotFound) || errors.Is(err, ErrAppNotFound)
}

// NewSafeKeys converts a slice of APIKey to SafeAPIKey.
func NewSafeKeys(keys []models.APIKey) []models.SafeAPIKey {
	safe := make([]models.SafeAPIKey, len(keys))
	for i, k := range keys {
		safe[i] = k.ToSafeKey()
	}
	return safe
}
