package models

import "time"

// Secret is the core domain model persisted in PostgreSQL.
// EncryptedValue stores the AES-256-GCM encrypted secret (IV + authTag + ciphertext) as BYTEA.
// The plaintext value is never persisted.
type Secret struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenant_id"`
	Name           string     `db:"name" json:"name"`
	EncryptedValue []byte     `db:"encrypted_value" json:"-"` // never exposed to client
	Scope          string     `db:"scope" json:"scope"`
	Description    string     `db:"description" json:"description"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updated_at"`
	CreatedBy      string     `db:"created_by" json:"created_by"`
}

// CreateSecretRequest is the input for creating a new secret.
type CreateSecretRequest struct {
	Name        string `json:"name" binding:"required"`
	Value       string `json:"value" binding:"required"`
	Scope       string `json:"scope"`
	Description string `json:"description"`
}

// UpdateSecretRequest is the input for updating a secret.
type UpdateSecretRequest struct {
	Value       *string `json:"value"`
	Description *string `json:"description"`
}

// ResolveSecretsRequest is the input for resolving secret references.
type ResolveSecretsRequest struct {
	Parameters map[string]string `json:"parameters" binding:"required"`
}

// ResolveSecretsResult is the output of the resolve endpoint.
type ResolveSecretsResult struct {
	Parameters    map[string]string `json:"parameters"`
	Resolved      int               `json:"resolved"`
	Unresolved    []string          `json:"unresolved"`
}

// ListFilter carries optional filter criteria for listing secrets.
type ListFilter struct {
	Scope *string // "org", "project", "environment"
}
