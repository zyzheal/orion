package models

import "time"

// Product represents an API marketplace product.
type Product struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenantId"`
	Name        string     `db:"name" json:"name"`
	Description *string    `db:"description" json:"description"`
	Version     *string    `db:"version" json:"version"`
	Pricing     string     `db:"pricing" json:"pricing"`
	Status      string     `db:"status" json:"status"`
	OwnerID     *string    `db:"owner_id" json:"ownerId"`
	CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
}

// CreateProductRequest is the request body for creating a product.
type CreateProductRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	Version     *string `json:"version"`
}

// DeveloperApp represents a developer application in the marketplace.
type DeveloperApp struct {
	ID           string     `db:"id" json:"id"`
	TenantID     string     `db:"tenant_id" json:"tenantId"`
	ProductID    string     `db:"product_id" json:"productId"`
	Name         string     `db:"name" json:"name"`
	Description  *string    `db:"description" json:"description"`
	Status       string     `db:"status" json:"status"`
	DeveloperID  *string    `db:"developer_id" json:"developerId"`
	RedirectUris string     `db:"redirect_uris" json:"redirectUris"`
	ApiKeys      string     `db:"api_keys" json:"apiKeys"`
	CreatedAt    time.Time  `db:"created_at" json:"createdAt"`
}

// CreateDeveloperAppRequest is the request body for creating a developer app.
type CreateDeveloperAppRequest struct {
	Name         string   `json:"name" binding:"required"`
	Description  *string  `json:"description"`
	RedirectUris []string `json:"redirectUris"`
}

// APIKey represents a marketplace API key.
type APIKey struct {
	ID            string     `db:"id" json:"id"`
	TenantID      string     `db:"tenant_id" json:"tenantId"`
	AppID         string     `db:"app_id" json:"appId"`
	ClientID      string     `db:"client_id" json:"clientId"`
	KeyHash       string     `db:"key_hash" json:"-"`
	Scopes        string     `db:"scopes" json:"scopes"`
	RateLimitPerMin int      `db:"rate_limit_per_min" json:"rateLimitPerMin"`
	Status        string     `db:"status" json:"status"`
	ExpiresAt     *time.Time `db:"expires_at" json:"expiresAt"`
	LastUsedAt    *time.Time `db:"last_used_at" json:"lastUsedAt"`
	CreatedAt     time.Time  `db:"created_at" json:"createdAt"`
}

// SafeAPIKey is an APIKey response without the hashed secret.
type SafeAPIKey struct {
	ID            string     `json:"id"`
	ClientID      string     `json:"clientId"`
	Scopes        string     `json:"scopes"`
	RateLimitPerMin int      `json:"rateLimitPerMin"`
	ExpiresAt     *time.Time `json:"expiresAt"`
	LastUsedAt    *time.Time `json:"lastUsedAt"`
	CreatedAt     time.Time  `json:"createdAt"`
}

// ToSafeKey creates a SafeAPIKey from an APIKey, stripping sensitive data.
func (k *APIKey) ToSafeKey() SafeAPIKey {
	return SafeAPIKey{
		ID:            k.ID,
		ClientID:      k.ClientID,
		Scopes:        k.Scopes,
		RateLimitPerMin: k.RateLimitPerMin,
		ExpiresAt:     k.ExpiresAt,
		LastUsedAt:    k.LastUsedAt,
		CreatedAt:     k.CreatedAt,
	}
}

// GenerateAPIKeyRequest is the request body for generating an API key.
type GenerateAPIKeyRequest struct {
	Scopes []string `json:"scopes"`
}

// APIKeyValidationResult is the result of validating an API key.
type APIKeyValidationResult struct {
	CredentialID    string  `json:"credentialId"`
	AppID           string  `json:"appId"`
	Scopes          string  `json:"scopes"`
	RateLimitPerMin int     `json:"rateLimitPerMin"`
}

// Subscription represents an app's subscription to a product.
type Subscription struct {
	ID        string     `db:"id" json:"id"`
	AppID     string     `db:"app_id" json:"appId"`
	ProductID string     `db:"product_id" json:"productId"`
	Plan      string     `db:"plan" json:"plan"`
	QuotaPerDay *int     `db:"quota_per_day" json:"quotaPerDay"`
	Status    string     `db:"status" json:"status"`
	StartedAt *time.Time `db:"started_at" json:"startedAt"`
	CreatedAt time.Time  `db:"created_at" json:"createdAt"`
}

// SubscribeRequest is the request body for subscribing to a product.
type SubscribeRequest struct {
	AppID      string `json:"appId" binding:"required"`
	ProductID  string `json:"productId" binding:"required"`
	Plan       string `json:"plan" binding:"required"`
	QuotaPerDay *int  `json:"quotaPerDay"`
}

// ValidateTokenRequest is the request body for validating an API key.
type ValidateTokenRequest struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
