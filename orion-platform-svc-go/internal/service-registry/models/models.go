package models

import (
	"encoding/json"
	"time"
)

// ServiceRegistry represents a registered service instance in the service registry.
type ServiceRegistry struct {
	ID              string     `json:"id" db:"id"`
	TenantID        string     `json:"tenant_id" db:"tenant_id"`
	ServiceID       string     `json:"service_id" db:"service_id"`
	ServiceName     string     `json:"service_name" db:"service_name"`
	ServiceURL      string     `json:"service_url" db:"service_url"`
	Protocol        string     `json:"protocol" db:"protocol"`
	Version         string     `json:"version" db:"version"`
	Status          string     `json:"status" db:"status"`
	HealthStatus    string     `json:"health_status" db:"health_status"`
	LastHeartbeatAt *time.Time `json:"last_heartbeat_at" db:"last_heartbeat_at"`
	Metadata        JSONB      `json:"metadata" db:"metadata"`
	RegisteredAt    time.Time  `json:"registered_at" db:"registered_at"`
	DeregisteredAt  *time.Time `json:"deregistered_at" db:"deregistered_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

// JSONB is a database/sql driver-compatible JSON type.
type JSONB json.RawMessage

// Scan implements sql.Scanner for JSONB.
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = JSONB("{}")
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	*j = bytes
	return nil
}

// Value implements driver.Valuer for JSONB.
func (j JSONB) Value() (interface{}, error) {
	if len(j) == 0 {
		return JSONB("{}"), nil
	}
	return json.RawMessage(j), nil
}

// UnmarshalTo parses JSONB into a target struct.
func (j JSONB) UnmarshalTo(v interface{}) error {
	return json.Unmarshal(json.RawMessage(j), v)
}

// MarshalFrom serializes a struct to JSONB.
func MarshalFrom(v interface{}) (JSONB, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return JSONB(b), nil
}

// RegisterRequest is the body for POST /register.
type RegisterRequest struct {
	ServiceID   string         `json:"serviceId" binding:"required"`
	ServiceName string         `json:"serviceName" binding:"required"`
	ServiceURL  string         `json:"serviceUrl" binding:"required"`
	Protocol    string         `json:"protocol"`
	Version     string         `json:"version"`
	Metadata    map[string]any `json:"metadata"`
}

// HeartbeatResponse is the body for POST /services/:id/heartbeat.
type HeartbeatResponse struct {
	Message string `json:"message"`
}

// HealthResponse is the body for GET /services/:id/health.
type HealthResponse struct {
	ServiceID     string  `json:"serviceId"`
	Status        string  `json:"status"`
	LatencyMs     float64 `json:"latencyMs"`
	LastChecked   string  `json:"lastChecked"`
	ErrorRate     float64 `json:"errorRate"`
	LastHeartbeat *string `json:"lastHeartbeat"`
}

// DeregisterResponse is the body for DELETE /services/:id.
type DeregisterResponse struct {
	Message string `json:"message"`
}

// ListResponse is the paginated body for GET /services.
type ListResponse struct {
	Data  []ServiceRegistry `json:"data"`
	Total int               `json:"total"`
	Page  int               `json:"page"`
	Limit int               `json:"limit"`
}
