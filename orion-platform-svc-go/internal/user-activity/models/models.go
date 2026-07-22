package models

import (
	"encoding/json"
	"time"
)

// UserActivity represents a single user activity log entry.
type UserActivity struct {
	ID           string    `json:"id" db:"id"`
	UserID       string    `json:"userId" db:"user_id"`
	Action       string    `json:"action" db:"action"`
	ResourceType string    `json:"resourceType" db:"resource_type"`
	ResourceID   string    `json:"resourceId" db:"resource_id"`
	Details      any       `json:"details" db:"details"` // JSON blob
	IPAddress    string    `json:"ipAddress" db:"ip_address"`
	UserAgent    string    `json:"userAgent" db:"user_agent"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
}

// ActivitiesResponse is returned by GET /users/:id/activities.
type ActivitiesResponse struct {
	Data     []UserActivity `json:"data"`
	Total    int            `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"pageSize"`
}

// GetDetailsJSON parses the Details field as a JSON object.
func (a *UserActivity) GetDetailsJSON() (map[string]any, error) {
	var m map[string]any
	if b, ok := a.Details.(string); ok && b != "" {
		return m, json.Unmarshal([]byte(b), &m)
	}
	return m, nil
}
