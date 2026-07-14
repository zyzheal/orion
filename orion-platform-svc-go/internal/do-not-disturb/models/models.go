package models

import "time"

// DoNotDisturb represents a user's do-not-disturb schedule.
type DoNotDisturb struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	UserID    string    `db:"user_id" json:"userId"`
	Enabled   bool      `db:"enabled" json:"enabled"`
	StartHour int       `db:"start_hour" json:"startHour"`
	EndHour   int       `db:"end_hour" json:"endHour"`
	Timezone  string    `db:"timezone" json:"timezone"`
	Weekdays  []int     `db:"weekdays" json:"weekdays"` // 0=Sunday, 6=Saturday
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}

// CreateDoNotDisturbRequest is the request body for creating a DND schedule.
type CreateDoNotDisturbRequest struct {
	Enabled   bool   `json:"enabled"`
	StartHour int    `json:"startHour"`
	EndHour   int    `json:"endHour"`
	Timezone  string `json:"timezone"`
	Weekdays  []int  `json:"weekdays"`
}

// UpdateDoNotDisturbRequest is the request body for updating a DND schedule.
type UpdateDoNotDisturbRequest struct {
	Enabled   *bool   `json:"enabled"`
	StartHour *int    `json:"startHour"`
	EndHour   *int    `json:"endHour"`
	Timezone  *string `json:"timezone"`
	Weekdays  []int   `json:"weekdays"`
}