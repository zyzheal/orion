package models

import "time"

// EphemeralEnv represents a temporary disposable environment.
type EphemeralEnv struct {
	ID              string    `db:"id" json:"id"`
	TenantID        string    `db:"tenant_id" json:"tenant_id"`
	EnvironmentName string    `db:"environment_name" json:"environment_name"`
	TTLSeconds      int       `db:"ttl_seconds" json:"ttl_seconds"`
	Status          string    `db:"status" json:"status"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time `db:"updated_at" json:"updated_at"`
}

// CreateEphemeralEnvRequest is the request body for creating an environment.
type CreateEphemeralEnvRequest struct {
	EnvironmentName string `json:"environment_name" binding:"required"`
	TTLSeconds      int    `json:"ttl_seconds" binding:"required"`
}

// ExtendTTLRequest is the request body for extending TTL.
type ExtendTTLRequest struct {
	TTLSeconds int `json:"ttl_seconds" binding:"required"`
}

// EnvLog represents a log entry for an ephemeral environment.
type EnvLog struct {
	ID         string    `db:"id" json:"id"`
	EnvID      string    `db:"env_id" json:"env_id"`
	Level      string    `db:"level" json:"level"`
	Message    string    `db:"message" json:"message"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// ListEnvsResponse returns a paginated list.
type ListEnvsResponse struct {
	Envs  []EphemeralEnv `json:"envs"`
	Total int            `json:"total"`
}
