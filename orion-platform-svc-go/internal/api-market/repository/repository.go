package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/api-market/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Products ---

func (r *Repository) CreateProduct(ctx context.Context, product *models.Product) error {
	product.ID = uuid.New().String()
	product.CreatedAt = time.Now().UTC()
	product.Status = "draft"
	product.Pricing = "{}"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO api_market_products (id, tenant_id, name, description, version, pricing, status, owner_id, created_at)
		 VALUES (:id, :tenantId, :name, :description, :version, :pricing, :status, :ownerId, :createdAt)`,
		product)
	return err
}

func (r *Repository) GetProductByID(ctx context.Context, id string, tenantID string) (*models.Product, error) {
	var product models.Product
	err := r.db.GetContext(ctx, &product,
		`SELECT * FROM api_market_products WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *Repository) ListProducts(ctx context.Context, tenantID string) ([]models.Product, error) {
	var products []models.Product
	err := r.db.SelectContext(ctx, &products,
		`SELECT * FROM api_market_products WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return products, err
}

func (r *Repository) UpdateProductStatus(ctx context.Context, id string, tenantID string, status string) (*models.Product, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE api_market_products SET status=$1 WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetProductByID(ctx, id, tenantID)
}

func (r *Repository) DeleteProduct(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM api_market_products WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Developer Apps ---

func (r *Repository) CreateDeveloperApp(ctx context.Context, app *models.DeveloperApp) error {
	app.ID = uuid.New().String()
	app.CreatedAt = time.Now().UTC()
	app.Status = "active"
	app.RedirectUris = "[]"
	app.ApiKeys = "{}"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO api_market_apps (id, tenant_id, product_id, name, description, status, developer_id, redirect_uris, api_keys, created_at)
		 VALUES (:id, :tenantId, :productId, :name, :description, :status, :developerId, :redirectUris, :apiKeys, :createdAt)`,
		app)
	return err
}

func (r *Repository) GetAppByID(ctx context.Context, id string, tenantID string) (*models.DeveloperApp, error) {
	var app models.DeveloperApp
	err := r.db.GetContext(ctx, &app,
		`SELECT * FROM api_market_apps WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &app, nil
}

func (r *Repository) ListAppsByDeveloper(ctx context.Context, tenantID string, developerID string) ([]models.DeveloperApp, error) {
	var apps []models.DeveloperApp
	err := r.db.SelectContext(ctx, &apps,
		`SELECT * FROM api_market_apps WHERE tenant_id=$1 AND developer_id=$2 ORDER BY created_at DESC`, tenantID, developerID)
	return apps, err
}

// --- API Keys ---

func (r *Repository) CreateAPIKey(ctx context.Context, key *models.APIKey) error {
	key.ID = uuid.New().String()
	key.CreatedAt = time.Now().UTC()
	key.Status = "active"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO api_market_keys (id, app_id, tenant_id, client_id, key_hash, scopes, rate_limit_per_min, status, expires_at, created_at)
		 VALUES (:id, :appId, :tenantId, :clientId, :keyHash, :scopes, :rateLimitPerMin, :status, :expiresAt, :createdAt)`,
		key)
	return err
}

func (r *Repository) ListAPIKeysByApp(ctx context.Context, appID string, tenantID string) ([]models.APIKey, error) {
	var keys []models.APIKey
	err := r.db.SelectContext(ctx, &keys,
		`SELECT * FROM api_market_keys WHERE app_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, appID, tenantID)
	if err != nil {
		return nil, err
	}
	return keys, nil
}

func (r *Repository) GetAPIKeyByCredentials(ctx context.Context, tenantID string, clientID string, keyHash string) (*models.APIKey, error) {
	var key models.APIKey
	err := r.db.GetContext(ctx, &key,
		`SELECT k.* FROM api_market_keys k
		 JOIN api_market_apps a ON k.app_id = a.id
		 WHERE k.client_id=$1 AND k.key_hash=$2 AND k.status=$3 AND k.tenant_id=$4 AND a.tenant_id=$4`,
		clientID, keyHash, "active", tenantID)
	if err != nil {
		return nil, err
	}
	return &key, nil
}

// --- Subscriptions ---

func (r *Repository) CreateSubscription(ctx context.Context, sub *models.Subscription) error {
	sub.ID = uuid.New().String()
	sub.CreatedAt = time.Now().UTC()
	now := time.Now().UTC()
	sub.StartedAt = &now
	sub.Status = "active"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO api_market_subscriptions (id, app_id, product_id, plan, quota_per_day, status, started_at, created_at)
		 VALUES (:id, :appId, :productId, :plan, :quotaPerDay, :status, :startedAt, :createdAt)`,
		sub)
	return err
}

func (r *Repository) GetSubscription(ctx context.Context, appID string, productID string, tenantID string) (*models.Subscription, error) {
	var sub models.Subscription
	err := r.db.GetContext(ctx, &sub,
		`SELECT s.* FROM api_market_subscriptions s
		 JOIN api_market_apps a ON s.app_id = a.id
		 WHERE s.app_id=$1 AND s.product_id=$2 AND s.status=$3 AND a.tenant_id=$4`,
		appID, productID, "active", tenantID)
	return &sub, err
}

func (r *Repository) ListSubscriptionsByApp(ctx context.Context, appID string, tenantID string) ([]models.Subscription, error) {
	var subs []models.Subscription
	err := r.db.SelectContext(ctx, &subs,
		`SELECT s.* FROM api_market_subscriptions s
		 JOIN api_market_apps a ON s.app_id = a.id
		 WHERE s.app_id=$1 AND a.tenant_id=$2 ORDER BY s.created_at DESC`, appID, tenantID)
	return subs, err
}
