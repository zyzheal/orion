// Package repository provides data access for auth-enhanced.
package repository

import (
	"context"
	"time"
)

// JwtKeyRepository is the key rotation repository used by keyrotation.
type JwtKeyRepository struct{}

// JwtKey is the model used by key rotation.
type JwtKey struct {
	ID           string     `db:"id" json:"id"`
	KeyID        string     `db:"key_id" json:"keyId"`
	KeyHash      string     `db:"key_hash" json:"keyHash"`
	KeyStrength  string     `db:"key_strength" json:"keyStrength"`
	Status       string     `db:"status" json:"status"`
	RotationType string     `db:"rotation_type" json:"rotationType"`
	CreatedAt    time.Time  `db:"created_at" json:"createdAt"`
	ActivatedAt  *time.Time `db:"activated_at" json:"activatedAt"`
	ExpiresAt    *time.Time `db:"expires_at" json:"expiresAt"`
}

func (r *JwtKeyRepository) ListByStatus(ctx context.Context, status string) ([]JwtKey, error) {
	return nil, nil
}

func (r *JwtKeyRepository) List(ctx context.Context) ([]JwtKey, error) {
	return nil, nil
}

func (r *JwtKeyRepository) CountByStatus(ctx context.Context, status string) (int, error) {
	return 0, nil
}

func (r *JwtKeyRepository) Create(ctx context.Context, key *JwtKey) error {
	return nil
}

func (r *JwtKeyRepository) FindByKeyID(ctx context.Context, keyID string) (*JwtKey, error) {
	return nil, nil
}

func (r *JwtKeyRepository) Update(ctx context.Context, key *JwtKey) error {
	return nil
}
