package models

import "time"

// AuthKey represents a JWT key for rotation.
type AuthKey struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	KeyID     string    `db:"key_id" json:"keyId"`
	Algorithm string    `db:"algorithm" json:"algorithm"` // HS256|RS256
	PublicKey string    `db:"public_key" json:"publicKey"`
	Secret    string    `db:"secret" json:"secret"`
	Status    string    `db:"status" json:"status"` // active|deprecated
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// CreateAuthKeyRequest is the request for creating an auth key.
type CreateAuthKeyRequest struct {
	Algorithm string `json:"algorithm" binding:"required"` // HS256|RS256
}

// AuthTokenBlacklist represents a blacklisted token.
type AuthTokenBlacklist struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	TokenID   string    `db:"token_id" json:"tokenId"`
	ExpiresAt time.Time `db:"expires_at" json:"expiresAt"`
	Reason    string    `db:"reason" json:"reason"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// CreateBlacklistRequest is the request for blacklisting a token.
type CreateBlacklistRequest struct {
	TokenID string `json:"tokenId" binding:"required"`
	Reason  string `json:"reason"`
}
